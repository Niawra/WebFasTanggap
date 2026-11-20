<?php

namespace App\Http\Controllers;

use App\Models\Location;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    private array $info = ['judul' => 'Lokasi', 'rute' => 'locations'];

    public function index()
    {
        return view('master.index', $this->info + ['items' => Location::denganJumlahLaporan()]);
    }

    public function create()
    {
        return view('master.form', $this->info + ['item' => new Location(['is_active' => true])]);
    }

    private function validasi(Request $request, ?string $kecuali = null): array
    {
        $data = $request->validate(['name' => ['required', 'max:60']], ['name.required' => 'Nama wajib diisi.']);
        $data['name'] = trim($data['name']);
        $data['is_active'] = $request->boolean('is_active');

        $kembar = Location::all()->first(fn ($k) => strcasecmp($k->name, $data['name']) === 0 && $k->id !== $kecuali);
        if ($kembar) {
            throw \Illuminate\Validation\ValidationException::withMessages(['name' => 'Nama ini sudah ada.']);
        }

        return $data;
    }

    public function store(Request $request)
    {
        Location::create($this->validasi($request));

        return redirect()->route('locations.index')->with('ok', 'Lokasi ditambahkan.');
    }

    public function edit(string $location)
    {
        return view('master.form', $this->info + ['item' => Location::findOrFail($location)]);
    }

    public function update(Request $request, string $location)
    {
        $item = Location::findOrFail($location);
        $item->update($this->validasi($request, $item->id));

        return redirect()->route('locations.index')->with('ok', 'Lokasi diperbarui.');
    }

    public function destroy(string $location)
    {
        $item = Location::findOrFail($location);
        if (Location::denganJumlahLaporan()->firstWhere('id', $item->id)?->reports_count) {
            return back()->with('gagal', 'Lokasi masih dipakai laporan. Nonaktifkan saja lewat tombol Ubah.');
        }
        $item->delete();

        return redirect()->route('locations.index')->with('ok', 'Lokasi dihapus.');
    }
}
