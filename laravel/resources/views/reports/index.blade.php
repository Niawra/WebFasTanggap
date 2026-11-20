@extends('layouts.app')
@section('judul', 'Laporan')

@section('isi')
<div class="kepala">
    <div>
        <h1>{{ auth()->user()->isPetugas() ? 'Semua Laporan' : 'Laporan Saya' }}</h1>
        <p>Data laporan kerusakan fasilitas.</p>
    </div>
    <a class="tombol" href="{{ route('reports.create') }}">+ Buat laporan</a>
</div>

<div class="kartu tabel-gulir">
    <form class="saring" method="GET">
        <input type="search" name="cari" value="{{ request('cari') }}" placeholder="Cari judul atau kode">
        <select name="status">
            <option value="">Semua status</option>
            @foreach (\App\Models\Report::STATUS as $kode => $label)
                <option value="{{ $kode }}" @selected(request('status') === $kode)>{{ $label }}</option>
            @endforeach
        </select>
        <button class="tombol garis" type="submit">Saring</button>
    </form>

    <table>
        <thead>
        <tr>
            <th>Kode</th><th>Judul</th><th>Kategori</th><th>Lokasi</th>
            @if (auth()->user()->isPetugas()) <th>Pelapor</th> @endif
            <th>Prioritas</th><th>Status</th><th>Aksi</th>
        </tr>
        </thead>
        <tbody>
        @forelse ($reports as $r)
            @php $bisaUbah = auth()->user()->isPetugas() || $r->status === 'menunggu_verifikasi'; @endphp
            <tr>
                <td>{{ $r->code }}</td>
                <td>{{ $r->title }}</td>
                <td>{{ $r->category->name }}</td>
                <td>{{ $r->location->name }}</td>
                @if (auth()->user()->isPetugas()) <td>{{ $r->reporter->name }}</td> @endif
                <td class="p-{{ $r->priority }}">{{ $r->prioritasLabel() }}</td>
                <td><span class="lencana s-{{ $r->status }}">{{ $r->statusLabel() }}</span></td>
                <td>
                    <div class="aksi">
                        <a class="tombol garis kecil" href="{{ route('reports.show', $r->id) }}">Lihat</a>
                        @if ($bisaUbah)
                            <a class="tombol garis kecil" href="{{ route('reports.edit', $r->id) }}">Ubah</a>
                            <form class="sebaris" method="POST" action="{{ route('reports.destroy', $r->id) }}" onsubmit="return confirm('Hapus laporan {{ $r->code }}?')">
                                @csrf @method('DELETE')
                                <button class="tombol bahaya kecil" type="submit">Hapus</button>
                            </form>
                        @endif
                    </div>
                </td>
            </tr>
        @empty
            <tr><td colspan="8">Tidak ada laporan.</td></tr>
        @endforelse
        </tbody>
    </table>

    @if ($reports->hasPages())
        <div style="display:flex;gap:8px;align-items:center;margin-top:14px">
            @if (! $reports->onFirstPage())
                <a class="tombol garis kecil" href="{{ $reports->previousPageUrl() }}">&larr; Sebelumnya</a>
            @endif
            <span>Halaman {{ $reports->currentPage() }} dari {{ $reports->lastPage() }}</span>
            @if ($reports->hasMorePages())
                <a class="tombol garis kecil" href="{{ $reports->nextPageUrl() }}">Berikutnya &rarr;</a>
            @endif
        </div>
    @endif
</div>
@endsection
