<?php

namespace App\Models;

use Illuminate\Support\Collection;
use Illuminate\Support\Fluent;

/** Tabel `profiles` di Supabase (data akun: nama, kelas, role). */
class Profile extends SupabaseModel
{
    protected static string $table = 'profiles';

    /** Peta id => nama lengkap untuk sekumpulan id. */
    public static function namaUntuk(array $ids): array
    {
        if (! $ids) {
            return [];
        }
        $baris = static::db()->select('profiles', ['select' => 'id,full_name', 'id' => 'in.('.implode(',', $ids).')']);

        return collect($baris)->pluck('full_name', 'id')->all();
    }

    /** Tambahkan $laporan->reporter (nama + kelas) ke setiap laporan. */
    public static function lengkapiPelapor(Collection $laporan): void
    {
        $ids = $laporan->pluck('reporter_id')->filter()->unique()->values()->all();
        $profil = $ids
            ? collect(static::db()->select('profiles', ['select' => 'id,full_name,class_name', 'id' => 'in.('.implode(',', $ids).')']))->keyBy('id')
            : collect();

        $laporan->each(fn ($r) => $r->reporter = new Fluent([
            'name' => $profil[$r->reporter_id]['full_name'] ?? 'Siswa',
            'class_name' => $profil[$r->reporter_id]['class_name'] ?? null,
        ]));
    }
}
