# Android release v0.1.1

- Package: com.florskainan.app
- Minimum Android: 10 (API 29)
- Target/compile Android: 16 (API 36)
- Backend origin: https://flors-kainan.onrender.com
- APK size: 21,856 bytes
- APK SHA-256: 52eab32eaee8cfba35d94b162eb3e23a932c268f91f9685caa153c2137c234e8
- Signing certificate SHA-256: 6AD8903DD5113DC388A28119F45F8AF3B8C1BC49377433A6C457D30C477D4773

[Download the signed APK](https://soeptuxxgxvluorkhkgt.supabase.co/storage/v1/object/public/app-releases/flors-kainan-0.1.1.apk?download=flors-kainan-0.1.1.apk)

[Download its checksum](https://soeptuxxgxvluorkhkgt.supabase.co/storage/v1/object/public/app-releases/flors-kainan-0.1.1.apk.sha256)

This is a small native WebView client for the cloud app, not an offline copy.
It supports image picking, persistent sessions, back navigation, app links,
and authenticated downloads. Only Internet permission is requested. The APK
contains no Supabase secret, database password, or signing private key.

The release build, full Android lint, APK Signature Scheme v2 verification,
public download hash match, and anonymous upload denial were checked. Lint
retains nonfatal notices for deliberately pinned tooling/target SDK and the
JavaScript requirement of the web app. Real-device UI and upload rehearsal
is still pending. Do that before daily shop use.

Back up android/.signing/flors-kainan.jks and android/signing.properties securely.
Both are intentionally excluded from Git and from public artifacts. An update
must use the same signing key and a higher versionCode. Never overwrite an
already published version's APK or checksum.
