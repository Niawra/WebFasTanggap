<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Hanya akun dengan role "petugas" yang boleh lewat. */
class PastikanPetugas
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->isPetugas()) {
            abort(403, 'Halaman ini khusus petugas.');
        }

        return $next($request);
    }
}
