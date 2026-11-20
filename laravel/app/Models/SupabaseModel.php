<?php

namespace App\Models;

use App\Services\Supabase;
use Illuminate\Support\Collection;

/**
 * Model dasar untuk tabel di Supabase.
 *
 * Mirip Eloquent (all, find, create, update, delete), tetapi datanya dibaca/ditulis
 * lewat API Supabase supaya sama dengan aplikasi Android dan web.
 */
abstract class SupabaseModel
{
    protected static string $table;

    protected static string $select = '*';

    public function __construct(protected array $attributes = []) {}

    public function __get(string $kolom): mixed
    {
        return $this->attributes[$kolom] ?? null;
    }

    public function __set(string $kolom, mixed $nilai): void
    {
        $this->attributes[$kolom] = $nilai;
    }

    public function __isset(string $kolom): bool
    {
        return isset($this->attributes[$kolom]);
    }

    /** Model baru (belum tersimpan) belum punya id. */
    public function exists(): bool
    {
        return isset($this->attributes['id']);
    }

    protected static function db(): Supabase
    {
        return Supabase::make();
    }

    /** Ubah satu baris hasil API menjadi objek model. */
    public static function dariBaris(array $baris): static
    {
        return new static($baris);
    }

    public static function where(array $filter = [], string $order = 'created_at.desc'): Collection
    {
        $baris = static::db()->select(static::$table, ['select' => static::$select, 'order' => $order] + $filter);

        return collect($baris)->map(fn ($b) => static::dariBaris($b));
    }

    public static function all(string $order = 'created_at.desc'): Collection
    {
        return static::where([], $order);
    }

    public static function find(string $id): ?static
    {
        if (! \Illuminate\Support\Str::isUuid($id)) {
            return null;
        }
        $baris = static::db()->select(static::$table, ['select' => static::$select, 'id' => "eq.{$id}"]);

        return $baris ? static::dariBaris($baris[0]) : null;
    }

    public static function findOrFail(string $id): static
    {
        return static::find($id) ?? abort(404);
    }

    public static function create(array $data): static
    {
        return static::dariBaris(static::db()->insert(static::$table, $data));
    }

    /** true kalau baris benar-benar berubah (false = ditolak aturan akses Supabase). */
    public function update(array $data): bool
    {
        return static::db()->update(static::$table, $this->id, $data) > 0;
    }

    public function delete(): bool
    {
        return static::db()->delete(static::$table, $this->id) > 0;
    }

    public static function count(array $filter = []): int
    {
        return static::db()->hitung(static::$table, $filter);
    }
}
