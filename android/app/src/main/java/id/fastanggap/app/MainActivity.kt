package id.fastanggap.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import id.fastanggap.app.ui.Aplikasi
import id.fastanggap.app.ui.TemaFasTanggap

class MainActivity : ComponentActivity() {
    private val vm: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            TemaFasTanggap { Aplikasi(vm) }
        }
    }
}

@Preview(showBackground = true, showSystemUi = true)
@Composable
private fun AplikasiPreview() {
    TemaFasTanggap { Aplikasi(AppViewModel.contoh()) }
}
