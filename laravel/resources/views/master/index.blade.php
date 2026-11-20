@extends('layouts.app')
@section('judul', $judul)

@section('isi')
<div class="kepala">
    <div>
        <h1>{{ $judul }}</h1>
        <p>Kelola data {{ strtolower($judul) }} yang dipakai di form laporan.</p>
    </div>
    <a class="tombol" href="{{ route($rute.'.create') }}">+ Tambah {{ strtolower($judul) }}</a>
</div>

<div class="kartu tabel-gulir">
    <table>
        <thead><tr><th>No</th><th>Nama</th><th>Status</th><th>Jumlah laporan</th><th>Aksi</th></tr></thead>
        <tbody>
        @forelse ($items as $i => $item)
            <tr>
                <td>{{ $i + 1 }}</td>
                <td>{{ $item->name }}</td>
                <td>
                    <span class="lencana {{ $item->is_active ? 's-selesai' : 's-ditolak' }}">{{ $item->is_active ? 'Aktif' : 'Nonaktif' }}</span>
                </td>
                <td>{{ $item->reports_count }}</td>
                <td>
                    <div class="aksi">
                        <a class="tombol garis kecil" href="{{ route($rute.'.edit', $item->id) }}">Ubah</a>
                        <form class="sebaris" method="POST" action="{{ route($rute.'.destroy', $item->id) }}" onsubmit="return confirm('Hapus {{ $item->name }}?')">
                            @csrf @method('DELETE')
                            <button class="tombol bahaya kecil" type="submit">Hapus</button>
                        </form>
                    </div>
                </td>
            </tr>
        @empty
            <tr><td colspan="5">Belum ada data.</td></tr>
        @endforelse
        </tbody>
    </table>
</div>
@endsection
