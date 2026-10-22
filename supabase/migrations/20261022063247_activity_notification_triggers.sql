-- Build each notification inside the business transaction. A rollback never
-- leaves a notification or broadcast behind. Browser clients cannot publish it.
CREATE FUNCTION kainan.notify_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  owner_user text;
  buyer_user text;
  audience text[];
  recipient text;
  target text;
  heading text;
  detail text := '';
  entity text;
  public_menu boolean := false;
BEGIN
  SELECT owner_id INTO owner_user FROM kainan.settings WHERE id=1;
  IF owner_user IS NULL THEN RETURN NEW; END IF;
  audience := ARRAY[owner_user];
  IF TG_TABLE_NAME='foods' THEN
    IF TG_OP='UPDATE' AND NEW.name=OLD.name AND NEW.price=OLD.price AND NEW.description=OLD.description AND NEW.image=OLD.image AND NEW.enabled=OLD.enabled AND NEW.archived=OLD.archived THEN RETURN NEW; END IF;
    target := 'menu'; entity := NEW.id; detail := NEW.name;
    heading := CASE WHEN TG_OP='INSERT' THEN 'New dish added' WHEN NEW.enabled=0 OR NEW.archived=1 THEN 'Dish unavailable' ELSE 'Menu updated' END;
    SELECT catalog_published=1 AND (NEW.enabled=1 OR (TG_OP='UPDATE' AND OLD.enabled=1)) INTO public_menu FROM kainan.settings WHERE id=1;
  ELSIF TG_TABLE_NAME='settings' THEN
    IF NEW.catalog_published=OLD.catalog_published THEN RETURN NEW; END IF;
    target := 'menu'; entity := 'catalog'; public_menu := true;
    heading := CASE WHEN NEW.catalog_published=1 THEN 'Menu is open' ELSE 'Menu paused' END;
    detail := CASE WHEN NEW.catalog_published=1 THEN 'See what Flor is offering.' ELSE 'New orders are temporarily paused.' END;
  ELSIF TG_TABLE_NAME='orders' THEN
    IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN RETURN NEW; END IF;
    SELECT user_id INTO buyer_user FROM kainan.customers WHERE id=NEW.customer_id;
    audience := ARRAY[owner_user,buyer_user]; target := 'orders'; entity := NEW.id;
    heading := CASE WHEN TG_OP='INSERT' THEN 'New order' ELSE 'Order updated' END;
    detail := '#' || upper(right(NEW.id,6)) || ' · ' || replace(NEW.status,'_',' ');
  ELSIF TG_TABLE_NAME='messages' THEN
    -- The separate order notification already represents generated summaries.
    IF NEW.order_id IS NOT NULL AND NEW.body LIKE E'Preorder placed\n%' THEN RETURN NEW; END IF;
    SELECT user_id INTO buyer_user FROM kainan.customers WHERE id=NEW.customer_id;
    audience := CASE WHEN NEW.sender='customer' THEN ARRAY[owner_user] ELSE ARRAY[buyer_user] END;
    target := 'chat'; entity := NEW.customer_id; heading := 'New message';
    detail := CASE WHEN NEW.file_id IS NOT NULL THEN 'An image was sent.' ELSE left(NEW.body,120) END;
  ELSIF TG_TABLE_NAME='payments' THEN
    IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN RETURN NEW; END IF;
    SELECT c.user_id INTO buyer_user FROM kainan.orders o JOIN kainan.customers c ON c.id=o.customer_id WHERE o.id=NEW.order_id;
    audience := ARRAY[owner_user,buyer_user]; target := 'orders'; entity := NEW.order_id;
    heading := 'Payment update'; detail := 'Payment ' || NEW.status || '.';
  END IF;
  IF public_menu THEN
    audience := audience || ARRAY(SELECT user_id FROM kainan.customers WHERE user_id IS NOT NULL UNION SELECT user_id FROM kainan.profiles);
  END IF;
  FOR recipient IN SELECT DISTINCT x FROM unnest(audience) x WHERE x IS NOT NULL LOOP
    INSERT INTO kainan.notifications(user_id,section,title,body,entity_id) VALUES(recipient,target,heading,detail,entity);
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION kainan.notify_activity() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notify_food AFTER INSERT OR UPDATE ON kainan.foods FOR EACH ROW EXECUTE FUNCTION kainan.notify_activity();
CREATE TRIGGER notify_menu AFTER UPDATE ON kainan.settings FOR EACH ROW EXECUTE FUNCTION kainan.notify_activity();
CREATE TRIGGER notify_order AFTER INSERT OR UPDATE ON kainan.orders FOR EACH ROW EXECUTE FUNCTION kainan.notify_activity();
CREATE TRIGGER notify_chat AFTER INSERT ON kainan.messages FOR EACH ROW EXECUTE FUNCTION kainan.notify_activity();
CREATE TRIGGER notify_payment AFTER INSERT OR UPDATE ON kainan.payments FOR EACH ROW EXECUTE FUNCTION kainan.notify_activity();

CREATE FUNCTION kainan.broadcast_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE recipient text;
BEGIN
  FOR recipient IN SELECT DISTINCT user_id FROM changed_notifications LOOP
    PERFORM realtime.send('{}'::jsonb,'activity','kainan:user:' || recipient,true);
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION kainan.broadcast_notification() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER notification_live_insert AFTER INSERT ON kainan.notifications REFERENCING NEW TABLE AS changed_notifications FOR EACH STATEMENT EXECUTE FUNCTION kainan.broadcast_notification();
CREATE TRIGGER notification_live_update AFTER UPDATE ON kainan.notifications REFERENCING NEW TABLE AS changed_notifications FOR EACH STATEMENT EXECUTE FUNCTION kainan.broadcast_notification();
