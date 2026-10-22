CREATE TABLE kainan.notifications (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  section text NOT NULL CHECK (section IN ('menu','orders','chat')),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  entity_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
ALTER TABLE kainan.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON kainan.notifications FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON kainan.notifications TO kainan_server;
CREATE POLICY kainan_server_notifications ON kainan.notifications TO kainan_server USING (true) WITH CHECK (true);
CREATE INDEX notifications_user_recent ON kainan.notifications(user_id,created_at DESC,id DESC);
CREATE INDEX notifications_user_unread ON kainan.notifications(user_id,section) WHERE read_at IS NULL;
