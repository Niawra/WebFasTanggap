<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['petugas' => \App\Http\Middleware\PastikanPetugas::class]);
        $middleware->redirectGuestsTo('/login');
        $middleware->redirectUsersTo('/dashboard');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Token Supabase habis: keluarkan pengguna dan minta login ulang.
        $exceptions->render(function (\App\Services\SesiHabis $e, Request $request) {
            \Illuminate\Support\Facades\Auth::logout();
            $request->session()->invalidate();

            return redirect()->route('login')->withErrors(['email' => 'Sesi berakhir, silakan masuk lagi.']);
        });
        // Supabase menolak permintaan (misalnya aturan akses): tampilkan pesannya.
        $exceptions->render(function (\App\Services\GagalSupabase $e, Request $request) {
            return back()->withInput()->with('gagal', 'Supabase menolak: '.$e->getMessage());
        });
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
