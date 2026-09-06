import java.net.URI

plugins {
    id("com.android.application")
}

// Opt-in cross-platform validation package. Default Live/demo builds are unchanged.
val cospanUniSpike = providers.gradleProperty("cospanUniSpike").map(String::toBoolean).orElse(false).get()
if (cospanUniSpike) layout.buildDirectory.set(file("build-uni-spike"))
val generatedWebAssets = layout.buildDirectory.dir("generated/rallyWebAssets")
val rallyAssetHost = "rally.local"
val rallyDemoMode = cospanUniSpike || providers.gradleProperty("rallyDemoMode")
    .map(String::toBoolean)
    .orElse(false)
    .get()
val rallyApiOrigin = providers.gradleProperty("rallyApiOrigin")
    .orElse("https://101.43.172.166")
    .get()
    .removeSuffix("/")
val rallyAppOrigin = providers.gradleProperty("rallyAppOrigin")
    .orElse(rallyApiOrigin)
    .get()
    .removeSuffix("/")
val rallyApiUri = if (rallyDemoMode) null else URI(rallyApiOrigin)
val rallyAppUri = if (rallyDemoMode) null else URI(rallyAppOrigin)

require(
    rallyDemoMode || (
        rallyApiUri?.scheme == "https"
            && rallyApiUri.host != null
            && rallyApiUri.rawUserInfo == null
            && rallyApiUri.rawQuery == null
            && rallyApiUri.rawFragment == null
            && (rallyApiUri.path.isNullOrEmpty() || rallyApiUri.path == "/")
    )
) {
    "rallyApiOrigin must be an HTTPS origin without credentials, path, query, or fragment"
}
require(
    rallyDemoMode || (
        rallyAppUri?.scheme == "https"
            && rallyAppUri.host != null
            && rallyAppUri.rawUserInfo == null
            && rallyAppUri.rawQuery == null
            && rallyAppUri.rawFragment == null
            && (rallyAppUri.path.isNullOrEmpty() || rallyAppUri.path == "/")
    )
) {
    "rallyAppOrigin must be an HTTPS origin without credentials, path, query, or fragment"
}

val syncWebAssets by tasks.registering(Sync::class) {
    description = "Copies the current COSPAN mobile prototype into the APK."
    group = "build"
    inputs.property("rallyApiOrigin", rallyApiOrigin)
    inputs.property("rallyAppOrigin", rallyAppOrigin)
    inputs.property("rallyDemoMode", rallyDemoMode)
    inputs.property("cospanUniSpike", cospanUniSpike)
    if (cospanUniSpike) {
        val spikeSource = file("../../prototype/cross-platform-spike/dist/build/h5")
        doFirst { require(spikeSource.resolve("index.html").isFile) { "Build the cross-platform H5 spike before packaging." } }
        from(spikeSource)
    } else from("../../prototype/mobile-demo") {
        include(
            "index.html",
            "styles.css",
            "app.js",
            "api-client.js",
            "manifest.webmanifest",
            "offline.html",
            "sw.js",
            "assets/**",
            "shells/**",
        )
        filesMatching("index.html") {
            filter { line ->
                line.replace(
                    "if (\"serviceWorker\" in navigator) {",
                    "if (\"serviceWorker\" in navigator && location.hostname !== \"$rallyAssetHost\") {",
                ).replace(
                    "<meta name=\"rally-api-origin\" content=\"\" />",
                    "<meta name=\"rally-api-origin\" content=\"${if (rallyDemoMode) "" else rallyApiOrigin}\" />",
                ).replace(
                    "<meta name=\"rally-app-origin\" content=\"\" />",
                    "<meta name=\"rally-app-origin\" content=\"${if (rallyDemoMode) "" else rallyAppOrigin}\" />",
                )
            }
        }
    }
    into(generatedWebAssets.map { it.dir("www") })
}

android {
    namespace = "ai.rally.collaboration"
    compileSdk = 36

    defaultConfig {
        applicationId = if (cospanUniSpike) "ai.rally.collaboration.unispike" else "ai.rally.collaboration"
        minSdk = 26
        targetSdk = 36
        versionCode = 2
        versionName = if (cospanUniSpike) "0.1.0-uni-spike" else "0.2.0-live"
        buildConfigField("String", "RALLY_ASSET_HOST", "\"$rallyAssetHost\"")
        buildConfigField("String", "RALLY_APP_HOST", "\"${rallyAppUri?.host ?: "rally.invalid"}\"")
        buildConfigField("boolean", "RALLY_DEMO_MODE", rallyDemoMode.toString())
        manifestPlaceholders["rallyAppLinkHost"] = rallyAppUri?.host ?: "rally.invalid"
        manifestPlaceholders["cospanAppLabel"] = if (cospanUniSpike) "COSPAN 跨端验证" else "@string/app_name"
    }

    sourceSets.getByName("main").assets.srcDir(generatedWebAssets)

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }
}

tasks.named("preBuild").configure {
    dependsOn(syncWebAssets)
}
