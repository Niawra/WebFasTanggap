<?php

namespace App\Services;

use RuntimeException;

/** Token Supabase sudah tidak berlaku; pengguna perlu login ulang. */
class SesiHabis extends RuntimeException {}
