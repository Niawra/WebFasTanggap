package id.fastanggap.app.ui

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/** Warna FasTanggap, mengikuti DESIGN.md website. */
object Warna {
    val Merah = Color(0xFFDD3333)
    val MerahTua = Color(0xFFB0222A)
    val MerahLembut = Color(0xFFFCE9E7)
    val Tinta = Color(0xFF1D1B1B)
    val TintaLembut = Color(0xFF6E6766)
    val Latar = Color(0xFFF6F3F1)
    val Kartu = Color(0xFFFFFFFF)
    val Garis = Color(0x14000000)

    val Tunggu = Color(0xFFB7791F)
    val TungguLatar = Color(0xFFFDF3E1)
    val Proses = Color(0xFF2F6FDB)
    val ProsesLatar = Color(0xFFE7EFFC)
    val Selesai = Color(0xFF1F8A55)
    val SelesaiLatar = Color(0xFFE3F4EA)
    val Tolak = Color(0xFF6E6766)
    val TolakLatar = Color(0xFFEDEAE8)
}

/** Pegas ala iOS: cepat, sedikit memantul. */
fun <T> pegas() = spring<T>(dampingRatio = 0.78f, stiffness = Spring.StiffnessMediumLow)

private val tipografi = Typography(
    displaySmall = TextStyle(fontSize = 34.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.6).sp, lineHeight = 40.sp),
    headlineSmall = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.3).sp),
    titleLarge = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.SemiBold, letterSpacing = (-0.2).sp),
    titleMedium = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.SemiBold),
    labelMedium = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium),
)

@Composable
fun TemaFasTanggap(isi: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Warna.Merah,
            onPrimary = Color.White,
            primaryContainer = Warna.MerahLembut,
            onPrimaryContainer = Warna.MerahTua,
            background = Warna.Latar,
            onBackground = Warna.Tinta,
            surface = Warna.Kartu,
            onSurface = Warna.Tinta,
            onSurfaceVariant = Warna.TintaLembut,
            outline = Warna.Garis,
        ),
        typography = tipografi,
        content = isi,
    )
}
