import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
try {
  process.loadEnvFile(".env.local");
} catch {}

const file = "flors-kainan-0.1.1.apk";
const bytes = readFileSync("outputs/android/" + file);
if (!bytes.includes(Buffer.from("APK Sig Block 42")))
  throw new Error("A signed release APK is required");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const client = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } },
);
const bucket = client.storage.from("app-releases");

try {
  const testKey = "qa/" + randomUUID() + ".apk";
  const denied = await anon.storage
    .from("app-releases")
    .upload(testKey, bytes, {
      contentType: "application/vnd.android.package-archive",
    });
  if (!denied.error) {
    await bucket.remove([testKey]);
    throw new Error("Anonymous release uploads must be denied");
  }
  const upload = await bucket.upload(file, bytes, {
    contentType: "application/vnd.android.package-archive",
    cacheControl: "31536000",
    upsert: false,
  });
  if (upload.error)
    throw new Error(
      "Release upload failed; existing versions must never be overwritten",
    );
  const checksum = await bucket.upload(
    file + ".sha256",
    Buffer.from(sha256 + "  " + file + "\n"),
    { contentType: "text/plain", cacheControl: "31536000", upsert: false },
  );
  if (checksum.error) throw new Error("Checksum upload failed");
  const publicUrl = url + "/storage/v1/object/public/app-releases/" + file;
  const response = await fetch(publicUrl, {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error("Public APK download failed");
  const downloaded = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(downloaded).digest("hex") !== sha256)
    throw new Error("Published APK checksum mismatch");
  const metadata = {
    version: "0.1.1",
    package: "com.florskainan.app",
    minAndroid: 10,
    bytes: bytes.length,
    sha256,
    downloadUrl: publicUrl + "?download=" + file,
  };
  writeFileSync(
    "outputs/android/release.json",
    JSON.stringify(metadata, null, 2) + "\n",
  );
  console.log(
    "PASS: anonymous uploads denied; public download hash matches the signed APK",
  );
  console.log(JSON.stringify(metadata));
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Android release publication failed",
  );
  process.exitCode = 1;
}
