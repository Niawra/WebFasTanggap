<?php

namespace App\Auth;

use App\Models\User;
use App\Services\Supabase;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Contracts\Auth\UserProvider;

/**
 * Penyedia pengguna untuk sistem Auth Laravel.
 *
 * Kata sandi dicek oleh Supabase Auth (akun sama dengan Android/web). Setelah
 * berhasil, profil disimpan di session supaya middleware `auth` Laravel bekerja.
 */
class SupabaseUserProvider implements UserProvider
{
    public function retrieveById($identifier): ?Authenticatable
    {
        $profil = session('supabase.user');

        return $profil && $profil['id'] === $identifier ? new User($profil) : null;
    }

    public function retrieveByToken($identifier, $token): ?Authenticatable
    {
        return null;
    }

    public function updateRememberToken(Authenticatable $user, $token): void {}

    public function retrieveByCredentials(array $credentials): ?Authenticatable
    {
        $db = Supabase::make();
        $sesi = $db->login($credentials['email'] ?? '', $credentials['password'] ?? '');
        if (! $sesi) {
            return null;
        }
        $db->simpanSesi($sesi);

        $id = $sesi['user']['id'];
        $profil = $db->select('profiles', ['select' => 'full_name,role,class_name', 'id' => "eq.{$id}"])[0] ?? [];

        $data = [
            'id' => $id,
            'email' => $sesi['user']['email'],
            'name' => $profil['full_name'] ?? strstr($sesi['user']['email'], '@', true),
            'role' => $profil['role'] ?? 'siswa',
            'class_name' => $profil['class_name'] ?? null,
            'password' => '',
        ];
        session(['supabase.user' => $data]);

        return new User($data);
    }

    /** Kata sandi sudah dicek Supabase di retrieveByCredentials. */
    public function validateCredentials(Authenticatable $user, array $credentials): bool
    {
        return true;
    }

    public function rehashPasswordIfRequired(Authenticatable $user, array $credentials, bool $force = false): void {}
}
