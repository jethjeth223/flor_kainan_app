-- Public notifications carry no rows or identifiers. Snapshots remain the only
-- source of truth and enforce the caller's identity on every refresh.
CREATE FUNCTION kainan.broadcast_catalog_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM realtime.send('{}'::jsonb, 'shop_changed', 'kainan:catalog', false);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION kainan.broadcast_catalog_change() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER catalog_foods AFTER INSERT OR UPDATE OR DELETE ON kainan.foods
FOR EACH STATEMENT EXECUTE FUNCTION kainan.broadcast_catalog_change();
CREATE TRIGGER catalog_menu AFTER INSERT OR UPDATE OR DELETE ON kainan.menu_items
FOR EACH STATEMENT EXECUTE FUNCTION kainan.broadcast_catalog_change();
CREATE TRIGGER catalog_days AFTER INSERT OR UPDATE OR DELETE ON kainan.menu_days
FOR EACH STATEMENT EXECUTE FUNCTION kainan.broadcast_catalog_change();
CREATE TRIGGER catalog_settings AFTER INSERT OR UPDATE OR DELETE ON kainan.settings
FOR EACH STATEMENT EXECUTE FUNCTION kainan.broadcast_catalog_change();

-- Accounting and order notifications go only to Flor and the affected buyer.
-- No private data is sent on the public catalog topic.
CREATE FUNCTION kainan.broadcast_private_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  row_data jsonb := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  buyer text;
  recipient text;
BEGIN
  IF TG_TABLE_NAME='orders' THEN
    SELECT user_id INTO buyer FROM kainan.customers WHERE id=row_data->>'customer_id';
  ELSIF row_data->>'order_id' IS NOT NULL THEN
    SELECT c.user_id INTO buyer FROM kainan.orders o JOIN kainan.customers c ON c.id=o.customer_id WHERE o.id=row_data->>'order_id';
  ELSIF row_data->>'customer_id' IS NOT NULL THEN
    SELECT user_id INTO buyer FROM kainan.customers WHERE id=row_data->>'customer_id';
  ELSIF TG_TABLE_NAME IN ('customers','profiles') THEN
    buyer := row_data->>'user_id';
  END IF;
  FOR recipient IN
    SELECT owner_id FROM kainan.settings WHERE id=1
    UNION SELECT buyer WHERE buyer IS NOT NULL
  LOOP
    PERFORM realtime.send('{}'::jsonb, 'shop_changed', 'kainan:user:' || recipient, true);
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION kainan.broadcast_private_change() FROM PUBLIC, anon, authenticated, service_role;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['orders','order_items','payments','refunds','customers','profiles','debts','money_entries','closeouts'] LOOP
    EXECUTE format('CREATE TRIGGER private_changes AFTER INSERT OR UPDATE OR DELETE ON kainan.%I FOR EACH ROW EXECUTE FUNCTION kainan.broadcast_private_change()',t);
  END LOOP;
END;
$$;
