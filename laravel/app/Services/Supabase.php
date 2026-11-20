<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Penghubung ke Supabase (database yang sama dengan aplikasi Android dan web lama).
 *
 * Semua permintaan dikirim dengan token login pengguna, jadi aturan akses (RLS)
 * di Supabase tetap berlaku: siswa hanya melihat laporannya sendiri, petugas semua.
 */
class Supabase
{
    public function __construct(
        private string $url,
        private string $key,
    ) {}

    public static function make(): self
    {
        return new self(rtrim(config('services.supabase.url'), '/'), config('services.supabase.key'));
    }

    /* ---------- Auth ---------- */

    /** Login email + kata sandi. Mengembalikan data sesi atau null kalau salah. */
    public function login(string $email, string $password): ?array
    {
        $res = Http::withHeaders(['apikey' => $this->key])
            ->post("{$this->url}/auth/v1/token?grant_type=password", compact('email', 'password'));

        return $res->successful() ? $res->json() : null;
    }

    public function logout(): void
    {
        if ($token = session('supabase.access_token')) {
            Http::withHeaders(['apikey' => $this->key])->withToken($token)->post("{$this->url}/auth/v1/logout");
        }
    }

    public function simpanSesi(array $sesi): void
    {
        session([
            'supabase.access_token' => $sesi['access_token'],
            'supabase.refresh_token' => $sesi['refresh_token'],
            'supabase.expires_at' => time() + (int) ($sesi['expires_in'] ?? 3600) - 60,
        ]);
    }

    /** Token login yang masih berlaku; diperbarui otomatis kalau sudah kedaluwarsa. */
    private function token(): ?string
    {
        if (! session('supabase.access_token')) {
            return null;
        }
        if (time() >= (int) session('supabase.expires_at')) {
            $res = Http::withHeaders(['apikey' => $this->key])
                ->post("{$this->url}/auth/v1/token?grant_type=refresh_token", ['refresh_token' => session('supabase.refresh_token')]);
            if (! $res->successful()) {
                throw new SesiHabis;
            }
            $this->simpanSesi($res->json());
        }

        return session('supabase.access_token');
    }

    /* ---------- Database (PostgREST) ---------- */

    private function http(): PendingRequest
    {
        return Http::withHeaders(['apikey' => $this->key])
            ->withToken($this->token() ?? $this->key)
            ->acceptJson()
            ->timeout(15);
    }

    private function cek(Response $res): Response
    {
        if ($res->status() === 401) {
            throw new SesiHabis;
        }
        if ($res->failed()) {
            throw new GagalSupabase($res->json('message') ?? 'Permintaan ke Supabase gagal.');
        }

        return $res;
    }

    public function select(string $tabel, array $query = []): array
    {
        return $this->cek($this->http()->get("{$this->url}/rest/v1/{$tabel}", $query))->json();
    }

    /** Ambil sebagian baris + total keseluruhan (untuk halaman/pagination). */
    public function selectHalaman(string $tabel, array $query, int $dari, int $sampai): array
    {
        $res = $this->cek($this->http()
            ->withHeaders(['Prefer' => 'count=exact', 'Range-Unit' => 'items', 'Range' => "{$dari}-{$sampai}"])
            ->get("{$this->url}/rest/v1/{$tabel}", $query));
        $total = (int) explode('/', $res->header('Content-Range') ?: '0/0')[1];

        return [$res->json(), $total];
    }

    public function hitung(string $tabel, array $query = []): int
    {
        [, $total] = $this->selectHalaman($tabel, $query + ['select' => 'id'], 0, 0);

        return $total;
    }

    public function insert(string $tabel, array $data): array
    {
        $res = $this->cek($this->http()->withHeaders(['Prefer' => 'return=representation'])
            ->post("{$this->url}/rest/v1/{$tabel}", $data));

        return $res->json()[0] ?? [];
    }

    /** Mengembalikan jumlah baris yang benar-benar berubah (0 = ditolak aturan akses). */
    public function update(string $tabel, string $id, array $data): int
    {
        $res = $this->cek($this->http()->withHeaders(['Prefer' => 'return=representation'])
            ->patch("{$this->url}/rest/v1/{$tabel}?id=eq.{$id}", $data));

        return count($res->json());
    }

    public function delete(string $tabel, string $id): int
    {
        $res = $this->cek($this->http()->withHeaders(['Prefer' => 'return=representation'])
            ->delete("{$this->url}/rest/v1/{$tabel}?id=eq.{$id}"));

        return count($res->json());
    }

    /* ---------- Storage (foto laporan) ---------- */

    public function unggahFoto(string $jalur, string $isi, string $mime): void
    {
        $this->cek($this->http()->withBody($isi, $mime)
            ->post("{$this->url}/storage/v1/object/report-photos/{$jalur}"));
    }

    public function hapusFoto(string $jalur): void
    {
        $this->http()->delete("{$this->url}/storage/v1/object/report-photos/{$jalur}");
    }

    /** Foto disimpan privat; tampilkan lewat tautan sementara (1 jam). */
    public function urlFoto(string $jalur): ?string
    {
        $res = $this->http()->post("{$this->url}/storage/v1/object/sign/report-photos/{$jalur}", ['expiresIn' => 3600]);

        return $res->successful() ? $this->url.'/storage/v1'.$res->json('signedURL') : null;
    }
}
