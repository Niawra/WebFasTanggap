<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    private array $info = ['judul' => 'Kategori', 'rute' => 'categories'];

    public function index()
    {
        return view('master.index', $this->info + ['items' => Category::denganJumlahLaporan()]);
    }

    public function create()
    {
        return view('master.form', $this->info + ['item' => new Category(['is_active' => true])]);
    }

    private function validasi(Request $request, ?string $kecuali = null): array
    {
        $data = $request->validate(['name' => ['required', 'max:60']], ['name.required' => 'Nama wajib diisi.']);
        $data['name'] = trim($data['name']);
        $data['is_active'] = $request->boolean('is_active');

        $kembar = Category::all()->first(fn ($k) => strcasecmp($k->name, $data['name']) === 0 && $k->id !== $kecuali);
        if ($kembar) {
            throw \Illuminate\Validation\ValidationException::withMessages(['name' => 'Nama ini sudah ada.']);
        }

        return $data;
    }

    public function store(Request $request)
    {
        Category::create($this->validasi($request));

        return redirect()->route('categories.index')->with('ok', 'Kategori ditambahkan.');
    }

    public function edit(string $category)
    {
        return view('master.form', $this->info + ['item' => Category::findOrFail($category)]);
    }

    public function update(Request $request, string $category)
    {
        $item = Category::findOrFail($category);
        $item->update($this->validasi($request, $item->id));

        return redirect()->route('categories.index')->with('ok', 'Kategori diperbarui.');
    }

    public function destroy(string $category)
    {
        $item = Category::findOrFail($category);
        if (Category::denganJumlahLaporan()->firstWhere('id', $item->id)?->reports_count) {
            return back()->with('gagal', 'Kategori masih dipakai laporan. Nonaktifkan saja lewat tombol Ubah.');
        }
        $item->delete();

        return redirect()->route('categories.index')->with('ok', 'Kategori dihapus.');
    }
}
