<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Login Laravel memakai akun Supabase (sama dengan Android dan web).
        \Illuminate\Support\Facades\Auth::provider('supabase', fn () => new \App\Auth\SupabaseUserProvider);
    }
}
