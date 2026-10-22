-- Public, immutable application releases only. Customer images remain private
-- in kainan-files. No client upload policies are granted for this bucket.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('app-releases','app-releases',true,20000000,
 ARRAY['application/vnd.android.package-archive','text/plain','application/json']);
