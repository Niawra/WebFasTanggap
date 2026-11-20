<?php

namespace App\Models;

/** Tabel `categories` di Supabase. */
class Category extends SupabaseModel
{
    protected static string $table = 'categories';

    /** Kategori beserta jumlah laporannya (dihitung dari laporan yang terlihat). */
    public static function denganJumlahLaporan(): \Illuminate\Support\Collection
    {
        $jumlah = collect(static::db()->select('reports', ['select' => 'category_id']))->countBy('category_id');

        return static::all('name.asc')->each(fn ($k) => $k->reports_count = $jumlah[$k->id] ?? 0);
    }
}
