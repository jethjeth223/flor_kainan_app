import { createClient } from "@supabase/supabase-js";

function bucket() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase Storage is not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from("kainan-files");
}
// The entire bucket is private. Public food images also pass through the
// application's file route; customer screenshots always require authorization.
export const storage = {
  async put(key: string, data: ArrayBuffer, mime: string) {
    const { error } = await bucket().upload(key, data, {
      contentType: mime,
      upsert: false,
    });
    if (error) throw new Error("Could not upload image");
  },
  async get(key: string) {
    const { data, error } = await bucket().download(key);
    if (error) return null;
    return data;
  },
  async delete(key: string) {
    const { error } = await bucket().remove([key]);
    if (error) throw new Error("Could not remove image");
  },
};
