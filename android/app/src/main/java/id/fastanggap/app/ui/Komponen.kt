package id.fastanggap.app.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.chrisbanes.haze.HazeState
import dev.chrisbanes.haze.HazeStyle
import dev.chrisbanes.haze.HazeTint
import dev.chrisbanes.haze.hazeEffect
import id.fastanggap.app.data.Status
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/* ---------- Kaca ---------- */

/** Gaya kaca buram ala iOS: putih tipis di atas blur yang kuat. */
val GayaKaca = HazeStyle(
    backgroundColor = Warna.Latar,
    tints = listOf(HazeTint(Color.White.copy(alpha = 0.55f))),
    blurRadius = 28.dp,
    noiseFactor = 0.05f,
)

/**
 * Kaca cair: blur (Haze) + "rim light" seperti liquid-glass-js — tepi atas
 * berkilau terang, tepi bawah meredup — ditambah kilau tipis di bagian atas.
 */
fun Modifier.kaca(state: HazeState, bentuk: RoundedCornerShape = RoundedCornerShape(50)): Modifier =
    this
        .shadow(24.dp, bentuk, ambientColor = Color(0x33501010), spotColor = Color(0x33501010))
        .clip(bentuk)
        .hazeEffect(state = state, style = GayaKaca)
        .drawWithContent {
            drawContent()
            // Kilau dalam: pantulan cahaya di setengah atas.
            drawRect(
                Brush.verticalGradient(
                    0f to Color.White.copy(alpha = 0.35f),
                    0.45f to Color.White.copy(alpha = 0.04f),
                    1f to Color.Transparent,
                ),
            )
        }
        .border(
            BorderStroke(
                1.2.dp,
                Brush.verticalGradient(
                    0f to Color.White.copy(alpha = 0.95f),
                    0.5f to Color.White.copy(alpha = 0.35f),
                    1f to Color.White.copy(alpha = 0.6f),
                ),
            ),
            bentuk,
        )

data class ItemNav(val label: String, val ikon: ImageVector)

/**
 * Bilah navigasi kaca yang mengambang. Pil merah muda meluncur dengan pegas
 * ke tab yang dipilih; tombol bulat di kanan untuk aksi utama (mis. lapor).
 */
@Composable
fun BilahKaca(
    state: HazeState,
    item: List<ItemNav>,
    terpilih: Int,
    pilih: (Int) -> Unit,
    modifier: Modifier = Modifier,
    aksi: ImageVector? = null,
    labelAksi: String = "",
    tekanAksi: () -> Unit = {},
) {
    Row(
        modifier = modifier.padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        BoxWithConstraints(
            Modifier
                .weight(1f)
                .height(66.dp)
                .kaca(state)
                .padding(5.dp),
        ) {
            val lebarItem = maxWidth / item.size
            val x by animateDpAsState(lebarItem * terpilih, pegas(), label = "pil")
            Box(
                Modifier
                    .offset(x = x)
                    .width(lebarItem)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(50))
                    .background(Warna.MerahLembut.copy(alpha = 0.9f)),
            )
            Row(Modifier.fillMaxWidth()) {
                item.forEachIndexed { i, it ->
                    val aktif = i == terpilih
                    val warna by animateColorAsState(if (aktif) Warna.MerahTua else Warna.TintaLembut, label = "warna")
                    val skala by animateFloatAsState(if (aktif) 1.08f else 1f, pegas(), label = "skala")
                    Column(
                        Modifier
                            .width(lebarItem)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(50))
                            .clickable(remember { MutableInteractionSource() }, indication = null) { pilih(i) },
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Icon(it.ikon, null, tint = warna, modifier = Modifier.size(23.dp).scale(skala))
                        Spacer(Modifier.height(2.dp))
                        Text(it.label, color = warna, fontSize = 11.sp, fontWeight = if (aktif) FontWeight.SemiBold else FontWeight.Medium, maxLines = 1)
                    }
                }
            }
        }
        if (aksi != null) {
            val sumber = remember { MutableInteractionSource() }
            val ditekan by sumber.collectIsPressedAsState()
            val skala by animateFloatAsState(if (ditekan) 0.9f else 1f, pegas(), label = "aksi")
            Box(
                Modifier
                    .size(66.dp)
                    .scale(skala)
                    .shadow(20.dp, CircleShape, ambientColor = Warna.Merah, spotColor = Warna.Merah)
                    .clip(CircleShape)
                    .background(Warna.Merah)
                    .clickable(sumber, indication = null, onClick = tekanAksi),
                contentAlignment = Alignment.Center,
            ) {
                Icon(aksi, labelAksi, tint = Color.White, modifier = Modifier.size(28.dp))
            }
        }
    }
}

/* ---------- Kartu & tombol ---------- */

/** Kartu putih membulat yang sedikit mengecil saat ditekan. */
@Composable
fun Kartu(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    padding: PaddingValues = PaddingValues(18.dp),
    isi: @Composable () -> Unit,
) {
    val sumber = remember { MutableInteractionSource() }
    val ditekan by sumber.collectIsPressedAsState()
    val skala by animateFloatAsState(if (ditekan) 0.97f else 1f, pegas(), label = "kartu")
    val bentuk = RoundedCornerShape(24.dp)
    Box(
        modifier
            .graphicsLayer { scaleX = skala; scaleY = skala }
            .shadow(10.dp, bentuk, ambientColor = Color(0x14501010), spotColor = Color(0x1A501010))
            .clip(bentuk)
            .background(Warna.Kartu)
            .then(if (onClick != null) Modifier.clickable(sumber, indication = null, onClick = onClick) else Modifier)
            .padding(padding),
    ) { isi() }
}

@Composable
fun TombolUtama(
    teks: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    aktif: Boolean = true,
    sibuk: Boolean = false,
    warna: Color = Warna.Merah,
    ikon: ImageVector? = null,
) {
    val sumber = remember { MutableInteractionSource() }
    val ditekan by sumber.collectIsPressedAsState()
    val skala by animateFloatAsState(if (ditekan) 0.96f else 1f, pegas(), label = "tombol")
    val latar by animateColorAsState(if (aktif) warna else warna.copy(alpha = 0.35f), label = "latar")
    Row(
        modifier
            .height(56.dp)
            .scale(skala)
            .clip(RoundedCornerShape(50))
            .background(latar)
            .clickable(sumber, indication = null, enabled = aktif && !sibuk, onClick = onClick)
            .padding(horizontal = 22.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (sibuk) {
            CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.5.dp)
        } else {
            if (ikon != null) {
                Icon(ikon, null, tint = Color.White, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
            }
            Text(teks, color = Color.White, style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
fun TombolSekunder(teks: String, onClick: () -> Unit, modifier: Modifier = Modifier, ikon: ImageVector? = null) {
    val sumber = remember { MutableInteractionSource() }
    val ditekan by sumber.collectIsPressedAsState()
    val skala by animateFloatAsState(if (ditekan) 0.96f else 1f, pegas(), label = "sekunder")
    Row(
        modifier
            .height(52.dp)
            .scale(skala)
            .clip(RoundedCornerShape(50))
            .background(Warna.MerahLembut)
            .clickable(sumber, indication = null, onClick = onClick)
            .padding(horizontal = 20.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (ikon != null) {
            Icon(ikon, null, tint = Warna.MerahTua, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
        }
        Text(teks, color = Warna.MerahTua, style = MaterialTheme.typography.labelLarge)
    }
}

/* ---------- Status ---------- */

fun warnaStatus(s: Status): Pair<Color, Color> = when (s) {
    Status.MENUNGGU -> Warna.Tunggu to Warna.TungguLatar
    Status.DIPROSES -> Warna.Proses to Warna.ProsesLatar
    Status.SELESAI -> Warna.Selesai to Warna.SelesaiLatar
    Status.DITOLAK -> Warna.Tolak to Warna.TolakLatar
}

@Composable
fun PilStatus(status: Status, modifier: Modifier = Modifier) {
    val (depan, latar) = warnaStatus(status)
    Row(
        modifier
            .clip(RoundedCornerShape(50))
            .background(latar)
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(depan))
        Spacer(Modifier.width(6.dp))
        Text(status.label, color = depan, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

/* ---------- Judul & angka ---------- */

/** Judul besar ala iOS di atas halaman. */
@Composable
fun JudulBesar(judul: String, sub: String? = null, modifier: Modifier = Modifier) {
    Column(modifier.padding(horizontal = 22.dp).padding(top = 12.dp, bottom = 8.dp)) {
        if (sub != null) {
            Text(sub.uppercase(), color = Warna.Merah, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.2.sp)
            Spacer(Modifier.height(4.dp))
        }
        Text(judul, style = MaterialTheme.typography.displaySmall)
    }
}

/** Angka yang berhitung naik saat pertama tampil. */
@Composable
fun AngkaBerhitung(nilai: Int, modifier: Modifier = Modifier, warna: Color = Warna.Tinta, ukuran: Dp = 34.dp) {
    val anim = remember { Animatable(0f) }
    LaunchedEffect(nilai) {
        anim.animateTo(nilai.toFloat(), tween(900, easing = FastOutSlowInEasing))
    }
    Text(
        anim.value.toInt().toString(),
        modifier = modifier,
        color = warna,
        fontSize = ukuran.value.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = (-1).sp,
    )
}

@Composable
fun Kosong(judul: String, teks: String, ikon: ImageVector, modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxWidth().padding(36.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(76.dp).clip(CircleShape).background(Warna.MerahLembut),
            contentAlignment = Alignment.Center,
        ) { Icon(ikon, null, tint = Warna.Merah, modifier = Modifier.size(34.dp)) }
        Spacer(Modifier.height(16.dp))
        Text(judul, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
        Spacer(Modifier.height(6.dp))
        Text(teks, color = Warna.TintaLembut, style = MaterialTheme.typography.bodyMedium, textAlign = TextAlign.Center)
    }
}

/* ---------- Waktu ---------- */

private val formatTanggal = DateTimeFormatter.ofPattern("d MMM yyyy · HH.mm", Locale.forLanguageTag("id"))

fun tanggal(iso: String): String = runCatching {
    OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.of("Asia/Jakarta")).format(formatTanggal)
}.getOrDefault(iso.take(10))

fun sejak(iso: String): String = runCatching {
    val menit = java.time.Duration.between(OffsetDateTime.parse(iso), OffsetDateTime.now()).toMinutes()
    when {
        menit < 1 -> "baru saja"
        menit < 60 -> "$menit menit lalu"
        menit < 60 * 24 -> "${menit / 60} jam lalu"
        else -> "${menit / (60 * 24)} hari lalu"
    }
}.getOrDefault("")
