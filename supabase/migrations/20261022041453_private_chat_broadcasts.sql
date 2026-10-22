-- Clients may RECEIVE only their own private topic. There is deliberately no
-- INSERT policy: clients cannot forge chat events. Only committed DB writes send.
CREATE POLICY kainan_receive_own_chat ON realtime.messages
FOR SELECT TO authenticated USING (
  extension = 'broadcast' AND
  (SELECT realtime.topic()) = 'kainan:user:' || (SELECT auth.uid())::text AND
  topic = (SELECT realtime.topic())
);

CREATE FUNCTION kainan.broadcast_chat_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  recipient text;
  payload jsonb;
BEGIN
  payload := jsonb_build_object('record', to_jsonb(NEW), 'customer', (
    SELECT jsonb_build_object('id', c.id, 'name', c.name, 'avatar_file_id', p.avatar_file_id)
    FROM kainan.customers c LEFT JOIN kainan.profiles p ON p.user_id=c.user_id
    WHERE c.id=NEW.customer_id
  ));
  FOR recipient IN
    SELECT owner_id FROM kainan.settings WHERE id=1
    UNION
    SELECT user_id FROM kainan.customers WHERE id=NEW.customer_id AND user_id IS NOT NULL
  LOOP
    PERFORM realtime.send(payload, 'chat_message', 'kainan:user:' || recipient, true);
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION kainan.broadcast_chat_message() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION kainan.broadcast_chat_message() TO kainan_server;
CREATE TRIGGER broadcast_chat_message AFTER INSERT OR UPDATE ON kainan.messages
FOR EACH ROW EXECUTE FUNCTION kainan.broadcast_chat_message();
