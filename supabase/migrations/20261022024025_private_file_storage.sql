-- Only the server's secret key may access object storage directly.
-- Customer ownership is checked by /api/files/:id before any private download.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('kainan-files','kainan-files',false,5000000,ARRAY['image/jpeg','image/png','image/webp']);
