// AGP 9 sudah membawa Kotlin bawaan, jadi plugin kotlin-android tidak perlu.
// Versi Kotlin plugin compose/serialization harus sama dengan Kotlin bawaan AGP (2.2.10).
plugins {
    id("com.android.application") version "9.3.2" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.10" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.2.10" apply false
}
