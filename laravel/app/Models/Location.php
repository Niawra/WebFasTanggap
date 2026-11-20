<?php

namespace App\Models;

/** Tabel `locations` di Supabase. */
class Location extends SupabaseModel
{
    protected static string $table = 'locations';

    /** Lokasi beserta jumlah laporannya (dihitung dari laporan yang terlihat). */
    public static function denganJumlahLaporan(): \Illuminate\Support\Collection
    {
        $jumlah = collect(static::db()->select('reports', ['select' => 'location_id']))->countBy('location_id');

        return static::all('name.asc')->each(fn ($l) => $l->reports_count = $jumlah[$l->id] ?? 0);
    }
}
