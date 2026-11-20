<?php

namespace App\Services;

use RuntimeException;

/** Supabase menolak permintaan (misalnya aturan akses atau data tidak valid). */
class GagalSupabase extends RuntimeException {}
