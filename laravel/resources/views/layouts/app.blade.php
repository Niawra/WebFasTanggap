<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('judul', 'Dashboard') · FasTanggap</title>
    <link rel="icon" href="{{ asset('img/favicon.png') }}">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Roboto:wght@400;500&display=swap">
    <link rel="stylesheet" href="{{ asset('css/app.css') }}">
    <link rel="stylesheet" href="{{ asset('css/kaca-cair.css') }}">
    <script src="{{ asset('js/kaca-cair.js') }}" defer></script>
</head>
<body>
<div class="kerangka">
    <aside class="samping kaca" data-kaca data-kaca-tepi="22" data-kaca-kuat="30">
        <div class="merek"><img src="{{ asset('img/logo.png') }}" alt=""> FasTanggap</div>

        <a class="menu {{ request()->routeIs('dashboard') ? 'aktif' : '' }}" href="{{ route('dashboard') }}">Dashboard</a>
        <a class="menu {{ request()->routeIs('reports.*') ? 'aktif' : '' }}" href="{{ route('reports.index') }}">
            {{ auth()->user()->isPetugas() ? 'Semua Laporan' : 'Laporan Saya' }}
        </a>

        @if (auth()->user()->isPetugas())
            <div class="label">Data master</div>
            <a class="menu {{ request()->routeIs('categories.*') ? 'aktif' : '' }}" href="{{ route('categories.index') }}">Kategori</a>
            <a class="menu {{ request()->routeIs('locations.*') ? 'aktif' : '' }}" href="{{ route('locations.index') }}">Lokasi</a>
        @endif

        <div class="bawah">
            <strong>{{ auth()->user()->name }}</strong><br>
            {{ ucfirst(auth()->user()->role) }}
            <form method="POST" action="{{ route('logout') }}">
                @csrf
                <button class="tombol garis kecil" type="submit">Keluar</button>
            </form>
        </div>
    </aside>

    <main class="isi">
        @if (session('ok'))
            <div class="pesan ok">{{ session('ok') }}</div>
        @endif
        @if (session('gagal'))
            <div class="pesan gagal">{{ session('gagal') }}</div>
        @endif

        @yield('isi')
    </main>
</div>
</body>
</html>
