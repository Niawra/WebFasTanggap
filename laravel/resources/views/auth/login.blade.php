<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Masuk · FasTanggap</title>
    <link rel="icon" href="{{ asset('img/favicon.png') }}">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Roboto:wght@400;500&display=swap">
    <link rel="stylesheet" href="{{ asset('css/app.css') }}">
</head>
<body>
<div class="halaman-login">
    <div class="kotak-login">
        <div class="logo">
            <img src="{{ asset('img/logo.png') }}" alt="FasTanggap">
            <h1>Masuk ke FasTanggap</h1>
            <p style="margin:0;color:var(--tinta-lembut)">Pelaporan kerusakan fasilitas sekolah</p>
        </div>

        <div class="kartu">
            @if (session('ok'))
                <div class="pesan ok">{{ session('ok') }}</div>
            @endif

            <form method="POST" action="{{ url('/login') }}" novalidate>
                @csrf
                <div class="isian">
                    <label for="email">Email</label>
                    <input id="email" type="email" name="email" value="{{ old('email') }}" autofocus autocomplete="username">
                    @error('email') <div class="salah">{{ $message }}</div> @enderror
                </div>
                <div class="isian">
                    <label for="password">Kata sandi</label>
                    <input id="password" type="password" name="password" autocomplete="current-password">
                    @error('password') <div class="salah">{{ $message }}</div> @enderror
                </div>
                <button class="tombol" type="submit">Masuk</button>
            </form>
        </div>

        <div class="akun-uji">
            Pakai akun FasTanggap yang sama dengan aplikasi Android dan website.
            Datanya juga sama, karena tersimpan di database Supabase yang sama.
        </div>
    </div>
</div>
</body>
</html>
