@extends('layouts.app')
@section('judul', 'Dashboard')

@section('isi')
<div class="kepala">
    <div>
        <h1>Halo, {{ auth()->user()->name }}</h1>
        <p>{{ auth()->user()->isPetugas() ? 'Ringkasan semua laporan kerusakan fasilitas sekolah.' : 'Ringkasan laporan yang pernah kamu kirim.' }}</p>
    </div>
    <a class="tombol" href="{{ route('reports.create') }}">+ Buat laporan</a>
</div>

<div class="grid-angka">
    <div class="kartu angka"><div class="nilai">{{ $total }}</div><div class="ket">Total laporan</div></div>
    @foreach (\App\Models\Report::STATUS as $kode => $label)
        <div class="kartu angka">
            <div class="nilai">{{ $perStatus[$kode] ?? 0 }}</div>
            <div class="ket"><span class="lencana s-{{ $kode }}">{{ $label }}</span></div>
        </div>
    @endforeach
    @if (auth()->user()->isPetugas())
        <div class="kartu angka"><div class="nilai">{{ $jumlahKategori }}</div><div class="ket">Kategori</div></div>
        <div class="kartu angka"><div class="nilai">{{ $jumlahLokasi }}</div><div class="ket">Lokasi</div></div>
        <div class="kartu angka"><div class="nilai">{{ $jumlahSiswa }}</div><div class="ket">Akun siswa</div></div>
    @endif
</div>

<div class="dua-kolom">
    <div class="kartu tabel-gulir">
        <div class="kepala" style="margin-bottom:8px">
            <h3>Laporan terbaru</h3>
            <a href="{{ route('reports.index') }}">Lihat semua</a>
        </div>
        <table>
            <thead><tr><th>Kode</th><th>Judul</th><th>Lokasi</th><th>Status</th></tr></thead>
            <tbody>
            @forelse ($terbaru as $r)
                <tr>
                    <td><a href="{{ route('reports.show', $r->id) }}">{{ $r->code }}</a></td>
                    <td>{{ $r->title }}</td>
                    <td>{{ $r->location->name }}</td>
                    <td><span class="lencana s-{{ $r->status }}">{{ $r->statusLabel() }}</span></td>
                </tr>
            @empty
                <tr><td colspan="4">Belum ada laporan.</td></tr>
            @endforelse
            </tbody>
        </table>
    </div>

    <div class="kartu">
        <h3>Laporan per kategori</h3>
        @php $maks = max(1, $perKategori->max('reports_count')); @endphp
        @foreach ($perKategori as $k)
            <div style="margin-top:12px">
                <div style="display:flex;justify-content:space-between;font-size:14px"><span>{{ $k->name }}</span><strong>{{ $k->reports_count }}</strong></div>
                <div class="batang"><span style="width: {{ $k->reports_count / $maks * 100 }}%"></span></div>
            </div>
        @endforeach
    </div>
</div>
@endsection
