<?php

namespace App\Models;

use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Fluent;

/** Tabel `reports` di Supabase (laporan kerusakan). */
class Report extends SupabaseModel
{
    public const STATUS = [
        'menunggu_verifikasi' => 'Menunggu verifikasi',
        'diproses' => 'Diproses',
        'selesai' => 'Selesai',
        'ditolak' => 'Ditolak',
    ];

    public const PRIORITAS = [
        'rendah' => 'Rendah',
        'sedang' => 'Sedang',
        'tinggi' => 'Tinggi',
    ];

    protected static string $table = 'reports';

    protected static string $select = '*,category:categories(id,name),location:locations(id,name)';

    public static function dariBaris(array $baris): static
    {
        $r = new static($baris);
        $r->category = new Fluent($baris['category'] ?? ['name' => '-']);
        $r->location = new Fluent($baris['location'] ?? ['name' => '-']);
        $r->created_at = Carbon::parse($baris['created_at'] ?? now())->timezone(config('app.timezone'));

        return $r;
    }

    /** Daftar laporan dengan pencarian, saringan status, dan halaman. */
    public static function halaman(?string $status, ?string $cari, int $hal, int $per = 10): LengthAwarePaginator
    {
        $q = ['select' => static::$select, 'order' => 'created_at.desc'];
        if ($status) {
            $q['status'] = "eq.{$status}";
        }
        if ($cari) {
            $cari = str_replace([',', '(', ')', '*'], ' ', $cari);
            $q['or'] = "(title.ilike.*{$cari}*,code.ilike.*{$cari}*)";
        }

        [$baris, $total] = static::db()->selectHalaman('reports', $q, ($hal - 1) * $per, $hal * $per - 1);
        $items = collect($baris)->map(fn ($b) => static::dariBaris($b));
        Profile::lengkapiPelapor($items);

        return new LengthAwarePaginator($items, $total, $per, $hal, [
            'path' => request()->url(),
            'query' => request()->query(),
        ]);
    }

    /** Ringkasan untuk dashboard: jumlah per status dan total. */
    public static function ringkasan(): array
    {
        $semua = collect(static::db()->select('reports', ['select' => 'status']));

        return ['total' => $semua->count(), 'perStatus' => $semua->countBy('status')];
    }

    /** Riwayat status (diisi otomatis oleh trigger di Supabase). */
    public function riwayat()
    {
        $baris = static::db()->select('report_status_history', [
            'report_id' => "eq.{$this->id}", 'order' => 'created_at.asc',
        ]);
        $nama = Profile::namaUntuk(collect($baris)->pluck('changed_by')->filter()->unique()->all());

        return collect($baris)->map(fn ($h) => new Fluent($h + [
            'oleh' => $nama[$h['changed_by'] ?? ''] ?? null,
            'waktu' => Carbon::parse($h['created_at'])->timezone(config('app.timezone')),
        ]));
    }

    public function statusLabel(): string
    {
        return self::STATUS[$this->status] ?? $this->status;
    }

    public function prioritasLabel(): string
    {
        return self::PRIORITAS[$this->priority] ?? '-';
    }

    public function urlFoto(): ?string
    {
        return $this->photo_path ? static::db()->urlFoto($this->photo_path) : null;
    }
}
