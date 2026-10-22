# Flor’s Kainan Android client

An installable, release-signed Android client for the shared cloud application:
https://flors-kainan.onrender.com

The app uses Android WebView, supports screenshot/photo picking, authenticated
report downloads, back navigation, persistent sign-in, and verified HTTPS app
links. It requires Android 10 or later and an internet connection. It does not
contain database passwords, Supabase secret keys, or an offline database.

## Build

Use JDK 21, Android SDK platform 36, and the pinned Gradle wrapper:

    ./gradlew assembleRelease

Set your SDK path in local.properties. Create signing.properties with storeFile,
storePassword, keyAlias, and keyPassword, pointing to a private release keystore.
These files and .signing/ are excluded from Git. The current signing materials
are saved locally in android/.signing/ and android/signing.properties.

Back up BOTH the keystore and its passwords securely. They are required to sign
updates that install over this APK. They must never be uploaded to GitHub,
Supabase Storage, or the public server. Only the certificate fingerprint appears
in public/.well-known/assetlinks.json for Android app-link verification.

Release output: app/build/outputs/apk/release/app-release.apk.
The versioned download and SHA-256 checksum are published separately to the
app-releases Storage bucket, not committed as APK binaries in source control.

## Verification

The release build and lint checks must pass. Verify the package using Android
build tools apksigner verify --verbose --print-certs. Check Android app links
after assetlinks.json is live on the HTTPS origin. Rehearse login, payment image
upload, back navigation, and downloads on Flor’s actual phone before daily use.

No phone/emulator UI rehearsal has been completed for the first release yet.
Render Free can take time to wake after idle periods. Its waiting time affects
the Android client too.
