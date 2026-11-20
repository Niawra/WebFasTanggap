<?php

namespace App\Models;

use Illuminate\Auth\GenericUser;

/**
 * Pengguna yang sedang login. Akunnya ada di Supabase Auth (akun yang sama
 * dengan aplikasi Android dan web), datanya diambil dari tabel `profiles`.
 */
class User extends GenericUser
{
    public function isPetugas(): bool
    {
        return ($this->attributes['role'] ?? null) === 'petugas';
    }
}
