@extends('layouts.app')
@section('judul', $report->code)

@section('isi')
@php $bisaUbah = auth()->user()->isPetugas() || $report->status === 'menunggu_verifikasi'; @endphp
<div class="kepala">
    <div>
        <h1>{{ $report->title }}</h1>
        <p>{{ $report->code }} · dibuat {{ $report->created_at->translatedFormat('d M Y, H:i') }}</p>
    </div>
    <div style="display:flex;gap:8px">
        <a class="tombol garis" href="{{ route('reports.index') }}">Kembali</a>
        @if ($bisaUbah)
            <a class="tombol" href="{{ route('reports.edit', $report->id) }}">Ubah</a>
            <form class="sebaris" method="POST" action="{{ route('reports.destroy', $report->id) }}" onsubmit="return confirm('Hapus laporan ini?')">
                @csrf @method('DELETE')
                <button class="tombol bahaya" type="submit">Hapus</button>
            </form>
        @endif
    </div>
</div>

<div class="dua-kolom">
    <div class="kartu">
        <dl class="detail">
            <dt>Status</dt><dd><span class="lencana s-{{ $report->status }}">{{ $report->statusLabel() }}</span></dd>
            @if ($report->rejection_reason)
                <dt>Alasan penolakan</dt><dd>{{ $report->rejection_reason }}</dd>
            @endif
            <dt>Kategori</dt><dd>{{ $report->category->name }}</dd>
            <dt>Lokasi</dt><dd>{{ $report->location->name }}</dd>
            <dt>Prioritas</dt><dd class="p-{{ $report->priority }}">{{ $report->prioritasLabel() }}</dd>
            <dt>Pelapor</dt><dd>{{ $report->reporter->name }} {{ $report->reporter->class_name ? '('.$report->reporter->class_name.')' : '' }}</dd>
            <dt>Deskripsi</dt><dd style="white-space:pre-line">{{ $report->description }}</dd>
        </dl>
        @if ($foto)
            <img src="{{ $foto }}" alt="Foto kerusakan" style="max-width:100%;border-radius:10px">
        @endif
    </div>

    <div class="kartu">
        <h3>Riwayat status</h3>
        <ul class="riwayat">
            <li>
                <span class="lencana s-menunggu_verifikasi">Laporan dikirim</span><br>
                <small>{{ $report->created_at->translatedFormat('d M Y, H:i') }} · {{ $report->reporter->name }}</small>
            </li>
            @forelse ($riwayat as $h)
                <li>
                    <span class="lencana s-{{ $h->new_status }}">{{ \App\Models\Report::STATUS[$h->new_status] ?? $h->new_status }}</span><br>
                    <small>{{ $h->waktu->translatedFormat('d M Y, H:i') }}{{ $h->oleh ? ' · '.$h->oleh : '' }}</small>
                    @if ($h->note) <div>{{ $h->note }}</div> @endif
                </li>
            @empty
            @endforelse
        </ul>
    </div>
</div>
@endsection
