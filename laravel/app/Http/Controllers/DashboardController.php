<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Location;
use App\Models\Profile;
use App\Models\Report;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request)
    {
        // Aturan akses Supabase otomatis membatasi: siswa hanya menghitung laporannya sendiri.
        $ringkasan = Report::ringkasan();
        $petugas = $request->user()->isPetugas();

        $terbaru = Report::where(['limit' => 5]);

        return view('dashboard', $ringkasan + [
            'jumlahKategori' => $petugas ? Category::count() : 0,
            'jumlahLokasi' => $petugas ? Location::count() : 0,
            'jumlahSiswa' => $petugas ? Profile::count(['role' => 'eq.siswa']) : 0,
            'terbaru' => $terbaru,
            'perKategori' => Category::denganJumlahLaporan()->sortByDesc('reports_count')->values(),
        ]);
    }
}
