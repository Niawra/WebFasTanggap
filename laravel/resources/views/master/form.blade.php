@extends('layouts.app')
@php $baru = ! $item->exists(); @endphp
@section('judul', ($baru ? 'Tambah ' : 'Ubah ').strtolower($judul))

@section('isi')
<div class="kepala">
    <h1>{{ $baru ? 'Tambah' : 'Ubah' }} {{ strtolower($judul) }}</h1>
</div>

<div class="kartu" style="max-width:520px">
    <form method="POST" action="{{ $baru ? route($rute.'.store') : route($rute.'.update', $item->id) }}">
        @csrf
        @unless ($baru) @method('PUT') @endunless

        <div class="isian">
            <label for="name">Nama</label>
            <input id="name" name="name" value="{{ old('name', $item->name) }}" autofocus>
            @error('name') <div class="salah">{{ $message }}</div> @enderror
        </div>
        <div class="isian">
            <label style="font-weight:400">
                <input type="checkbox" name="is_active" value="1" style="width:auto" @checked(old('is_active', $item->is_active))>
                Aktif (muncul di pilihan form laporan Android dan web)
            </label>
        </div>

        <div style="display:flex;gap:8px">
            <button class="tombol" type="submit">Simpan</button>
            <a class="tombol garis" href="{{ route($rute.'.index') }}">Batal</a>
        </div>
    </form>
</div>
@endsection
