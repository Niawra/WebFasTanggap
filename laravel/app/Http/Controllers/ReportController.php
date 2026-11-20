<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Location;
use App\Models\Profile;
use App\Models\Report;
use App\Services\Supabase;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ReportController extends Controller
{
    /** Siswa hanya boleh mengubah/menghapus laporan yang belum diproses. */
    private function pastikanBisaDiubah(Request $request, Report $report): void
    {
        abort_if(
            ! $request->user()->isPetugas() && $report->status !== 'menunggu_verifikasi',
            403,
            'Laporan yang sudah diproses tidak bisa diubah.'
        );
    }

    public function index(Request $request)
    {
        $request->validate(['status' => ['nullable', Rule::in(array_keys(Report::STATUS))]]);

        return view('reports.index', [
            'reports' => Report::halaman($request->status, $request->cari, max(1, (int) $request->page)),
        ]);
    }

    private function formData(Report $report): array
    {
        return [
            'report' => $report,
            'categories' => Category::where(['is_active' => 'is.true'], 'name.asc'),
            'locations' => Location::where(['is_active' => 'is.true'], 'name.asc'),
        ];
    }

    public function create()
    {
        return view('reports.form', $this->formData(new Report(['status' => 'menunggu_verifikasi'])));
    }

    private function validasi(Request $request): array
    {
        $aturan = [
            'title' => ['required', 'string', 'max:120'],
            'description' => ['required', 'string', 'min:10'],
            'category_id' => ['required', 'uuid'],
            'location_id' => ['required', 'uuid'],
            'photo' => ['nullable', 'image', 'max:2048'],
        ];
        if ($request->user()->isPetugas()) {
            $aturan['status'] = ['sometimes', Rule::in(array_keys(Report::STATUS))];
            $aturan['priority'] = ['nullable', Rule::in(array_keys(Report::PRIORITAS))];
            $aturan['rejection_reason'] = ['nullable', 'required_if:status,ditolak', 'string', 'max:255'];
        }

        $data = $request->validate($aturan, [
            'title.required' => 'Judul wajib diisi.',
            'description.required' => 'Deskripsi wajib diisi.',
            'description.min' => 'Deskripsi minimal 10 karakter.',
            'category_id.required' => 'Pilih kategori.',
            'location_id.required' => 'Pilih lokasi.',
            'photo.image' => 'File harus berupa gambar.',
            'photo.max' => 'Ukuran foto maksimal 2 MB.',
            'rejection_reason.required_if' => 'Alasan penolakan wajib diisi kalau status Ditolak.',
        ]);
        unset($data['photo']);

        return $data;
    }

    /** Unggah foto ke storage Supabase (bucket report-photos), sama seperti Android. */
    private function unggahFoto(Request $request): ?string
    {
        if (! $request->hasFile('photo')) {
            return null;
        }
        $file = $request->file('photo');
        $jalur = $request->user()->id.'/'.Str::uuid().'.'.($file->extension() ?: 'jpg');
        Supabase::make()->unggahFoto($jalur, $file->get(), $file->getMimeType());

        return $jalur;
    }

    public function store(Request $request)
    {
        $data = $this->validasi($request);
        $data['reporter_id'] = $request->user()->id;
        if ($foto = $this->unggahFoto($request)) {
            $data['photo_path'] = $foto;
        }

        // Nomor FT-YYMM-NNN dan riwayat status diisi otomatis oleh trigger Supabase.
        $report = Report::create($data);

        return redirect()->route('reports.show', $report->id)->with('ok', "Laporan {$report->code} terkirim.");
    }

    public function show(string $report)
    {
        $report = Report::findOrFail($report);
        Profile::lengkapiPelapor(collect([$report]));

        return view('reports.show', [
            'report' => $report,
            'riwayat' => $report->riwayat(),
            'foto' => $report->urlFoto(),
        ]);
    }

    public function edit(Request $request, string $report)
    {
        $report = Report::findOrFail($report);
        $this->pastikanBisaDiubah($request, $report);

        return view('reports.form', $this->formData($report));
    }

    public function update(Request $request, string $report)
    {
        $report = Report::findOrFail($report);
        $this->pastikanBisaDiubah($request, $report);

        $data = $this->validasi($request);
        if ($foto = $this->unggahFoto($request)) {
            if ($report->photo_path) {
                Supabase::make()->hapusFoto($report->photo_path);
            }
            $data['photo_path'] = $foto;
        }
        if (isset($data['status']) && $data['status'] !== 'ditolak') {
            $data['rejection_reason'] = null;
        }

        if (! $report->update($data)) {
            return back()->withInput()->with('gagal', 'Perubahan ditolak oleh aturan akses Supabase.');
        }

        return redirect()->route('reports.show', $report->id)->with('ok', 'Laporan diperbarui.');
    }

    public function destroy(Request $request, string $report)
    {
        $report = Report::findOrFail($report);
        $this->pastikanBisaDiubah($request, $report);

        if (! $report->delete()) {
            return back()->with('gagal', 'Laporan tidak bisa dihapus (sudah diambil petugas atau tidak diizinkan).');
        }
        if ($report->photo_path) {
            Supabase::make()->hapusFoto($report->photo_path);
        }

        return redirect()->route('reports.index')->with('ok', "Laporan {$report->code} dihapus.");
    }
}
