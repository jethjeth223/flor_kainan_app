-- Supabase creates application roles without SET membership for postgres.
-- Permit the backend connection to drop to its restricted runtime role.
GRANT kainan_server TO postgres WITH SET TRUE;
