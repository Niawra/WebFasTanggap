package id.fastanggap.app.data

/** Data palsu khusus untuk @Preview di Android Studio. Tidak dipakai saat aplikasi berjalan. */
object ContohData {
    val siswa = Sesi(
        id = "siswa-1",
        email = "12345@student.smktelkom-pwt.sch.id",
        nama = "Siswa",
        peran = Peran.SISWA,
        kelas = "XI PPLG 4",
        telepon = "6281234567890",
        peringatan = 1,
    )

    val petugas = Sesi(
        id = "petugas-1",
        email = "sarana@sekolah.sch.id",
        nama = "Petugas",
        peran = Peran.PETUGAS,
        kelas = "",
        telepon = "6281298765432",
    )

    val kategori = listOf(
        Ref("k1", "Kebersihan"),
        Ref("k2", "Listrik & Lampu"),
        Ref("k3", "Air & Toilet"),
        Ref("k4", "Meja & Kursi"),
        Ref("k5", "Fasilitas Kelas"),
    )

    val lokasi = listOf(
        Ref("l1", "Ruang XI PPLG 4"),
        Ref("l2", "Toilet Lantai 2"),
        Ref("l3", "Lab Komputer"),
        Ref("l4", "Kantin"),
        Ref("l5", "Lapangan"),
    )

    val profil = mapOf(
        siswa.id to Profil(siswa.id, siswa.nama, "siswa", siswa.kelas, siswa.telepon, 1),
        petugas.id to Profil(petugas.id, petugas.nama, "petugas", null, petugas.telepon, 0),
    )

    val laporan = listOf(
        Laporan(
            id = "r1", code = "FT-0001", title = "Lampu kelas mati",
            description = "Dua lampu di sisi kiri ruangan tidak menyala sejak kemarin, kelas jadi gelap.",
            status = "menunggu_verifikasi", priority = "tinggi",
            createdAt = "2026-11-18T07:30:00+07:00", reporterId = siswa.id,
            categories = Nama("Listrik & Lampu"), locations = Nama("Ruang XI PPLG 4"),
        ),
        Laporan(
            id = "r2", code = "FT-0002", title = "Keran toilet bocor",
            description = "Keran wastafel di toilet lantai 2 terus meneteskan air.",
            status = "diproses", priority = "sedang",
            createdAt = "2026-11-17T10:15:00+07:00", reporterId = siswa.id,
            assignedTo = petugas.id, assignedAt = "2026-11-17T11:00:00+07:00",
            categories = Nama("Air & Toilet"), locations = Nama("Toilet Lantai 2"),
        ),
        Laporan(
            id = "r3", code = "FT-0003", title = "Kursi patah",
            description = "Sandaran kursi di barisan belakang patah dan berbahaya diduduki.",
            status = "selesai", priority = "rendah",
            createdAt = "2026-11-10T08:00:00+07:00", reporterId = siswa.id,
            assignedTo = petugas.id, assignedAt = "2026-11-10T09:00:00+07:00",
            categories = Nama("Meja & Kursi"), locations = Nama("Lab Komputer"),
        ),
        Laporan(
            id = "r4", code = "FT-0004", title = "Tes tes",
            description = "asdfgh",
            status = "ditolak", alasanTolak = "Isi laporan tidak jelas.",
            createdAt = "2026-11-09T13:20:00+07:00", reporterId = siswa.id,
            categories = Nama("Kebersihan"), locations = Nama("Kantin"),
        ),
    )

    val pesan = listOf(
        Pesan("m1", "r2", siswa.id, "Pak, keran masih bocor ya?", "2026-11-17T11:10:00+07:00"),
        Pesan("m2", "r2", petugas.id, "Siap, hari ini saya cek.", "2026-11-17T11:12:00+07:00"),
    )

    val draf = DrafLaporan(
        judul = "Lampu kelas mati",
        kategori = "Listrik & Lampu",
        lokasi = "Ruang XI PPLG 4",
        deskripsi = "Dua lampu di sisi kiri ruangan tidak menyala.",
    )
}
