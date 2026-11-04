import java.util.Base64

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Use one --dart-define for both native Maps configuration and the Flutter UI.
// Keep personal API keys in an ignored JSON file, never in this source file.
val dartDefines = (project.findProperty("dart-defines") as? String)
    ?.split(",")?.associate {
        val decoded = String(Base64.getDecoder().decode(it))
        val parts = decoded.split("=", limit = 2)
        parts[0] to parts.getOrElse(1) { "" }
    } ?: emptyMap()

android {
    namespace = "com.chargeflow.chargeflow_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.chargeflow.chargeflow_mobile"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        manifestPlaceholders["mapsApiKey"] = dartDefines["GOOGLE_MAPS_API_KEY"] ?: ""
        // Retain the optional API auth scaffold; the demo never invokes it.
        manifestPlaceholders["appAuthRedirectScheme"] = "com.chargeflow.app"
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
