package id.fastanggap.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Mail
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.fastanggap.app.AppViewModel
import kotlinx.coroutines.launch

@Composable
fun MasukLayar(vm: AppViewModel) {
    var email by remember { mutableStateOf("") }
    var sandi by remember { mutableStateOf("") }
    var galat by remember { mutableStateOf<String?>(null) }
    var sibuk by remember { mutableStateOf(false) }
    val lingkup = rememberCoroutineScope()

    // Masuk bertahap: blok merah turun, lalu kartu naik.
    val turun = remember { Animatable(0f) }
    val naik = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        turun.animateTo(1f, pegas())
    }
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(160)
        naik.animateTo(1f, pegas())
    }
    val ayun = rememberInfiniteTransition(label = "ayun")
    val goyang by ayun.animateFloat(-6f, 6f, infiniteRepeatable(tween(2600), RepeatMode.Reverse), label = "goyang")

    Column(
        Modifier
            .fillMaxSize()
            .background(Warna.Latar)
            .verticalScroll(rememberScrollState())
            .imePadding(),
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .graphicsLayer { translationY = (1 - turun.value) * -120f; alpha = turun.value }
                .clip(RoundedCornerShape(bottomStart = 40.dp, bottomEnd = 40.dp))
                .background(Warna.Merah)
                .statusBarsPadding()
                .padding(horizontal = 26.dp)
                .padding(top = 28.dp, bottom = 64.dp),
        ) {
            // Lingkaran dekoratif "simpul merah".
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 40.dp, y = (-10).dp)
                    .graphicsLayer { rotationZ = goyang }
                    .size(170.dp)
                    .border(26.dp, Color.White.copy(alpha = 0.12f), CircleShape),
            )
            Column {
                Box(
                    Modifier.size(54.dp).clip(CircleShape).background(Color.White),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("FT", color = Warna.Merah, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                }
                Spacer(Modifier.height(36.dp))
                Text(
                    "Fasilitas rusak?\nLapor dalam\nsatu menit.",
                    color = Color.White,
                    fontSize = 34.sp,
                    lineHeight = 39.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.8).sp,
                )
                Spacer(Modifier.height(12.dp))
                Text(
                    "FasTanggap · SMK Telkom Purwokerto",
                    color = Color.White.copy(alpha = 0.78f),
                    fontSize = 14.sp,
                )
            }
        }

        Column(
            Modifier
                .graphicsLayer { translationY = (1 - naik.value) * 160f; alpha = naik.value }
                .offset(y = (-34).dp)
                .padding(horizontal = 18.dp),
        ) {
            Kartu(padding = androidx.compose.foundation.layout.PaddingValues(20.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Masuk", style = MaterialTheme.typography.headlineSmall)
                    Text(
                        "Pakai akun yang sama dengan website. Siswa dan petugas masuk dari sini.",
                        color = Warna.TintaLembut,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Spacer(Modifier.height(2.dp))
                    Isian(email, { email = it; galat = null }, "Email sekolah", Icons.Rounded.Mail, KeyboardType.Email)
                    Isian(sandi, { sandi = it; galat = null }, "Kata sandi", Icons.Rounded.Lock, KeyboardType.Password, rahasia = true)
                    AnimatedVisibility(galat != null, enter = expandVertically() + fadeIn()) {
                        Text(galat.orEmpty(), color = Warna.Merah, style = MaterialTheme.typography.bodyMedium)
                    }
                    TombolUtama(
                        "Masuk",
                        onClick = {
                            sibuk = true
                            lingkup.launch {
                                galat = vm.masuk(email, sandi)
                                sibuk = false
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        aktif = email.contains("@") && sandi.length >= 6,
                        sibuk = sibuk,
                    )
                }
            }
            Spacer(Modifier.height(18.dp))
            listOf(
                "Laporan langsung masuk ke petugas sarana",
                "Petugas dapat kabar lewat WhatsApp",
                "Pantau status sampai selesai",
            ).forEach {
                Row(Modifier.padding(horizontal = 8.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(22.dp).clip(CircleShape).background(Warna.MerahLembut),
                        contentAlignment = Alignment.Center,
                    ) { Icon(Icons.Rounded.Check, null, tint = Warna.Merah, modifier = Modifier.size(14.dp)) }
                    Spacer(Modifier.width(10.dp))
                    Text(it, color = Warna.TintaLembut, style = MaterialTheme.typography.bodyMedium)
                }
            }
            Spacer(Modifier.navigationBarsPadding().height(24.dp))
        }
    }
}

/** Kolom isian bergaya iOS: latar abu lembut, ikon di kiri, tanpa garis bawah. */
@Composable
fun Isian(
    nilai: String,
    ubah: (String) -> Unit,
    petunjuk: String,
    ikon: ImageVector? = null,
    jenis: KeyboardType = KeyboardType.Text,
    rahasia: Boolean = false,
    baris: Int = 1,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(Color(0xFFF3EFED))
            .padding(horizontal = 16.dp, vertical = if (baris > 1) 14.dp else 0.dp)
            .height(if (baris > 1) (baris * 22 + 4).dp else 54.dp),
        verticalAlignment = if (baris > 1) Alignment.Top else Alignment.CenterVertically,
    ) {
        if (ikon != null) {
            Icon(ikon, null, tint = Warna.TintaLembut, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(12.dp))
        }
        Box(Modifier.weight(1f)) {
            if (nilai.isEmpty()) Text(petunjuk, color = Warna.TintaLembut.copy(alpha = 0.7f), fontSize = 16.sp)
            BasicTextField(
                value = nilai,
                onValueChange = ubah,
                singleLine = baris == 1,
                textStyle = TextStyle(fontSize = 16.sp, color = Warna.Tinta, lineHeight = 22.sp),
                cursorBrush = SolidColor(Warna.Merah),
                keyboardOptions = KeyboardOptions(keyboardType = jenis),
                visualTransformation = if (rahasia) PasswordVisualTransformation() else VisualTransformation.None,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}
