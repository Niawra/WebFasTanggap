@extends('layouts.app')
@php $baru = ! $report->exists(); @endphp
@section('judul', $baru ? 'Buat laporan' : 'Ubah laporan')

@section('isi')
<div class="kepala">
    <div>
        <h1>{{ $baru ? 'Buat laporan' : 'Ubah laporan '.$report->code }}</h1>
        <p>Isi data kerusakan dengan jelas supaya petugas cepat menindaklanjuti.</p>
    </div>
</div>

<div class="kartu" style="max-width:720px">
    <form method="POST" enctype="multipart/form-data"
          action="{{ $baru ? route('reports.store') : route('reports.update', $report->id) }}">
        @csrf
        @unless ($baru) @method('PUT') @endunless

        <div class="isian">
            <label for="title">Judul</label>
            <input id="title" name="title" value="{{ old('title', $report->title) }}" placeholder="Contoh: Lampu kelas mati">
            @error('title') <div class="salah">{{ $message }}</div> @enderror
        </div>

        <div class="baris-isian">
            <div class="isian">
                <label for="category_id">Kategori</label>
                <select id="category_id" name="category_id">
                    <option value="">Pilih kategori</option>
                    @foreach ($categories as $c)
                        <option value="{{ $c->id }}" @selected(old('category_id', $report->category_id) == $c->id)>{{ $c->name }}</option>
                    @endforeach
                </select>
                @error('category_id') <div class="salah">{{ $message }}</div> @enderror
            </div>
            <div class="isian">
                <label for="location_id">Lokasi</label>
                <select id="location_id" name="location_id">
                    <option value="">Pilih lokasi</option>
                    @foreach ($locations as $l)
                        <option value="{{ $l->id }}" @selected(old('location_id', $report->location_id) == $l->id)>{{ $l->name }}</option>
                    @endforeach
                </select>
                @error('location_id') <div class="salah">{{ $message }}</div> @enderror
            </div>
        </div>

        <div class="isian">
            <label for="description">Deskripsi</label>
            <textarea id="description" name="description" rows="4" placeholder="Jelaskan kerusakannya">{{ old('description', $report->description) }}</textarea>
            @error('description') <div class="salah">{{ $message }}</div> @enderror
        </div>

        <div class="isian">
            <label for="photo">Foto (opsional)</label>
            <input id="photo" type="file" name="photo" accept="image/*">
            <div class="bantu">JPG/PNG, maksimal 2 MB.{{ $report->photo_path ? ' Kosongkan kalau tidak ingin mengganti foto.' : '' }}</div>
            @error('photo') <div class="salah">{{ $message }}</div> @enderror
        </div>

        @if (auth()->user()->isPetugas())
            <div class="baris-isian">
                <div class="isian">
                    <label for="status">Status</label>
                    <select id="status" name="status">
                        @foreach (\App\Models\Report::STATUS as $kode => $label)
                            <option value="{{ $kode }}" @selected(old('status', $report->status) === $kode)>{{ $label }}</option>
                        @endforeach
                    </select>
                </div>
                <div class="isian">
                    <label for="priority">Prioritas</label>
                    <select id="priority" name="priority">
                        <option value="">Belum ditentukan</option>
                        @foreach (\App\Models\Report::PRIORITAS as $kode => $label)
                            <option value="{{ $kode }}" @selected(old('priority', $report->priority) === $kode)>{{ $label }}</option>
                        @endforeach
                    </select>
                </div>
            </div>
            <div class="isian">
                <label for="rejection_reason">Alasan penolakan</label>
                <input id="rejection_reason" name="rejection_reason" value="{{ old('rejection_reason', $report->rejection_reason) }}" placeholder="Diisi kalau status Ditolak">
                @error('rejection_reason') <div class="salah">{{ $message }}</div> @enderror
            </div>
        @endif

        <div style="display:flex;gap:8px">
            <button class="tombol" type="submit">{{ $baru ? 'Kirim laporan' : 'Simpan perubahan' }}</button>
            <a class="tombol garis" href="{{ $baru ? route('reports.index') : route('reports.show', $report->id) }}">Batal</a>
        </div>
    </form>
</div>
@endsection
