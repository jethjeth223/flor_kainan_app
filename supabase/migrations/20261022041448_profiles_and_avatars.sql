ALTER TABLE kainan.files DROP CONSTRAINT files_purpose_check;
ALTER TABLE kainan.files ADD CONSTRAINT files_purpose_check CHECK (purpose IN ('chat','food','avatar'));
ALTER TABLE kainan.files ADD COLUMN uploaded_by text;
ALTER TABLE kainan.files ADD CONSTRAINT avatar_has_uploader CHECK (purpose <> 'avatar' OR uploaded_by IS NOT NULL);

CREATE TABLE kainan.profiles (
  user_id text PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  phone text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 20),
  avatar_file_id text REFERENCES kainan.files(id) ON DELETE SET NULL
);
ALTER TABLE kainan.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON kainan.profiles FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON kainan.profiles TO kainan_server;
CREATE POLICY kainan_server_profiles ON kainan.profiles TO kainan_server USING (true) WITH CHECK (true);
CREATE INDEX profiles_avatar_file_idx ON kainan.profiles(avatar_file_id) WHERE avatar_file_id IS NOT NULL;
CREATE INDEX files_uploaded_by_idx ON kainan.files(uploaded_by) WHERE uploaded_by IS NOT NULL;
