<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rancangan tabel `profiles`, `reports`, dan `report_status_history` (MK-1).
 * Tabel aslinya ada di Supabase (dipakai bersama Android dan web); migration ini
 * mendokumentasikan strukturnya. `profiles.id` = id akun di Supabase Auth.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('full_name')->nullable();
            $table->enum('role', ['siswa', 'petugas'])->default('siswa');
            $table->string('class_name')->nullable();
            $table->string('student_number')->nullable();
            $table->string('phone')->nullable();
            $table->integer('warning_count')->default(0);
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code')->unique()->nullable();           // FT-YYMM-NNN (trigger)
            $table->foreignUuid('reporter_id')->constrained('profiles');
            $table->foreignUuid('category_id')->constrained('categories');
            $table->foreignUuid('location_id')->constrained('locations');
            $table->string('title');
            $table->text('description');
            $table->string('photo_path')->nullable();                // bucket report-photos
            $table->enum('status', ['menunggu_verifikasi', 'diproses', 'selesai', 'ditolak'])->default('menunggu_verifikasi');
            $table->enum('priority', ['rendah', 'sedang', 'tinggi'])->nullable();
            $table->text('rejection_reason')->nullable();
            $table->foreignUuid('verified_by')->nullable()->constrained('profiles');
            $table->timestamp('verified_at')->nullable();
            $table->foreignUuid('assigned_to')->nullable()->constrained('profiles');
            $table->timestamp('assigned_at')->nullable();
            $table->boolean('is_hidden')->default(false);
            $table->string('ai_verdict')->nullable();
            $table->text('ai_reason')->nullable();
            $table->timestamps();
        });

        Schema::create('report_status_history', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('report_id')->constrained('reports')->cascadeOnDelete();
            $table->string('old_status')->nullable();
            $table->string('new_status');
            $table->foreignUuid('changed_by')->nullable()->constrained('profiles');
            $table->text('note')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_status_history');
        Schema::dropIfExists('reports');
        Schema::dropIfExists('profiles');
    }
};
