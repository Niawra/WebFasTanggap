package id.fastanggap.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Inbox
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.ReceiptLong
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import dev.chrisbanes.haze.HazeState
import id.fastanggap.app.AppViewModel
import id.fastanggap.app.data.ContohData
import id.fastanggap.app.data.Peran
import id.fastanggap.app.data.Status
import id.fastanggap.app.ui.petugas.AksiPetugas
import id.fastanggap.app.ui.petugas.AkunLayar
import id.fastanggap.app.ui.petugas.DaftarTugas
import id.fastanggap.app.ui.petugas.RingkasanPetugas
import id.fastanggap.app.ui.petugas.TugasSaya
import id.fastanggap.app.ui.siswa.BerandaSiswa
import id.fastanggap.app.ui.siswa.DetailLaporan
import id.fastanggap.app.ui.siswa.DialogHapus
import id.fastanggap.app.ui.siswa.KartuLaporan
import id.fastanggap.app.ui.siswa.LaporFlow
import id.fastanggap.app.ui.siswa.LaporanSaya

/*
 * Kumpulan @Preview untuk Android Studio. Semuanya memakai AppViewModel.contoh(...)
 * yang berisi data palsu (data/ContohData.kt), jadi tidak butuh internet atau Supabase.
 * Preview untuk komponen private ada di bagian bawah file masing-masing.
 */

@Composable
private fun Layar(isi: @Composable () -> Unit) {
    TemaFasTanggap {
        Box(Modifier.fillMaxSize().background(Warna.Latar)) { isi() }
    }
}

private const val Pixel = "spec:width=411dp,height=891dp"

/* ---------- Aplikasi utuh ---------- */

@Preview(name = "Aplikasi · Siswa", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewAplikasiSiswa() {
    TemaFasTanggap { Aplikasi(AppViewModel.contoh(Peran.SISWA)) }
}

@Preview(name = "Aplikasi · Petugas", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewAplikasiPetugas() {
    TemaFasTanggap { Aplikasi(AppViewModel.contoh(Peran.PETUGAS)) }
}

@Preview(name = "Aplikasi · Belum masuk", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewAplikasiKeluar() {
    TemaFasTanggap { Aplikasi(AppViewModel.contoh(masuk = false)) }
}

@Preview(name = "E.1 Splash (memuat)", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewSplash() {
    TemaFasTanggap { Aplikasi(AppViewModel.contoh(memuat = true)) }
}

/* ---------- Masuk ---------- */

@Preview(name = "E.2 Login", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewMasuk() {
    Layar { MasukLayar(AppViewModel.contoh(masuk = false)) }
}

/* ---------- Siswa ---------- */

@Preview(name = "E.4 Home · Siswa", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewBerandaSiswa() {
    Layar { Box(Modifier.statusBarsPadding()) { BerandaSiswa(AppViewModel.contoh(Peran.SISWA), {}, {}, {}) } }
}

@Preview(name = "E.5 Daftar Data · Laporan", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewLaporanSaya() {
    Layar { Box(Modifier.statusBarsPadding()) { LaporanSaya(AppViewModel.contoh(Peran.SISWA), {}) } }
}

@Preview(name = "E.8 Detail Data", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewDetailSiswa() {
    Layar { DetailLaporan(AppViewModel.contoh(Peran.SISWA), ContohData.laporan[1], tutup = {}) }
}

@Preview(name = "E.6 Form Tambah · Buat laporan", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewLaporFlow() {
    Layar { LaporFlow(AppViewModel.contoh(Peran.SISWA), tutup = {}, lihat = {}) }
}

@Preview(name = "E.3 Register", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewDaftar() {
    Layar { DaftarLayar(AppViewModel.contoh(masuk = false)) }
}

@Preview(name = "E.8 Konfirmasi Hapus", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewDialogHapus() {
    Layar {
        DetailLaporan(AppViewModel.contoh(Peran.SISWA), ContohData.laporan[0], tutup = {})
        DialogHapus(kode = ContohData.laporan[0].kode, sibuk = false, batal = {}, hapus = {})
    }
}

@Preview(name = "Siswa · Akun", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewAkunSiswa() {
    Layar { Box(Modifier.statusBarsPadding()) { AkunLayar(AppViewModel.contoh(Peran.SISWA)) } }
}

@Preview(name = "E.5 item_row · Kartu laporan", showBackground = true)
@Composable
private fun PreviewKartuLaporan() {
    TemaFasTanggap {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            ContohData.laporan.forEach { KartuLaporan(it, onClick = {}, modifier = Modifier.fillMaxWidth()) }
        }
    }
}

/* ---------- Petugas ---------- */

@Preview(name = "Petugas · Daftar tugas", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewDaftarTugas() {
    Layar { Box(Modifier.statusBarsPadding()) { DaftarTugas(AppViewModel.contoh(Peran.PETUGAS), {}) } }
}

@Preview(name = "Petugas · Tugasku", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewTugasSaya() {
    Layar { Box(Modifier.statusBarsPadding()) { TugasSaya(AppViewModel.contoh(Peran.PETUGAS), {}) } }
}

@Preview(name = "Petugas · Ringkasan", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewRingkasan() {
    Layar { Box(Modifier.statusBarsPadding()) { RingkasanPetugas(AppViewModel.contoh(Peran.PETUGAS)) } }
}

@Preview(name = "Petugas · Akun", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewAkunPetugas() {
    Layar { Box(Modifier.statusBarsPadding()) { AkunLayar(AppViewModel.contoh(Peran.PETUGAS)) } }
}

@Preview(name = "E.7 Form Ubah · Ubah status (petugas)", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewDetailPetugas() {
    val vm = AppViewModel.contoh(Peran.PETUGAS)
    val l = ContohData.laporan[0]
    Layar { DetailLaporan(vm, l, tutup = {}, aksi = { AksiPetugas(vm, l) }) }
}

/* ---------- TanggapAI & komponen umum ---------- */

@Preview(name = "TanggapAI", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewTanggapAi() {
    Layar { TanggapAiLayar(AppViewModel.contoh(Peran.SISWA), tutup = {}) }
}

@Preview(name = "Tombol TanggapAI", showBackground = true)
@Composable
private fun PreviewTombolAi() {
    TemaFasTanggap { Box(Modifier.padding(16.dp)) { TombolTanggapAi(buka = {}) } }
}

@Preview(name = "Chat laporan", device = Pixel, showSystemUi = true)
@Composable
private fun PreviewChat() {
    Layar { KartuChat(AppViewModel.contoh(Peran.SISWA), ContohData.laporan[1], Modifier.padding(16.dp)) }
}

@Preview(name = "Bilah navigasi kaca", showBackground = true, widthDp = 411)
@Composable
private fun PreviewBilahKaca() {
    TemaFasTanggap {
        Box(Modifier.fillMaxWidth().background(Warna.Latar).padding(vertical = 24.dp)) {
            BilahKaca(
                state = HazeState(),
                item = listOf(
                    ItemNav("Beranda", Icons.Rounded.Home),
                    ItemNav("Laporan", Icons.Rounded.ReceiptLong),
                    ItemNav("Akun", Icons.Rounded.Person),
                ),
                terpilih = 0,
                pilih = {},
                aksi = Icons.Rounded.Add,
                labelAksi = "Buat laporan",
            )
        }
    }
}

@Preview(name = "Komponen", showBackground = true)
@Composable
private fun PreviewKomponen() {
    TemaFasTanggap {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            JudulBesar("Judul besar", "Sub judul")
            Status.entries.forEach { PilStatus(it) }
            TombolUtama("Tombol utama", onClick = {})
            TombolSekunder("Tombol sekunder", onClick = {})
            Kosong("Belum ada laporan", "Laporan yang kamu buat akan muncul di sini.", Icons.Rounded.Inbox)
        }
    }
}
