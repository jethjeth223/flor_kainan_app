-- Runs against Supabase without retaining fixtures. Any failed assertion raises.
BEGIN;
SET LOCAL ROLE kainan_server;
SET LOCAL search_path=kainan,pg_catalog;
DO $test$
DECLARE stock integer; failure text;
BEGIN
 INSERT INTO customers(id,name) VALUES ('qa-cloud-customer','QA fixture');
 INSERT INTO foods(id,name,price) VALUES ('qa-cloud-food','QA fixture',6500);
 INSERT INTO menu_days(day,published) VALUES ('2099-12-31',0);
 INSERT INTO menu_items(id,day,food_id,name,serving,price,capacity)
 VALUES ('qa-cloud-menu','2099-12-31','qa-cloud-food','QA fixture','1 serving',6500,1);
 INSERT INTO orders(id,customer_id,customer_name,day,total,created_at)
 VALUES ('qa-cloud-order','qa-cloud-customer','QA fixture','2099-12-31',6500,'2099-12-31T00:00:00Z');
 INSERT INTO order_items(id,order_id,menu_item_id,name,serving,price,quantity)
 VALUES ('qa-cloud-line','qa-cloud-order','qa-cloud-menu','QA fixture','1 serving',6500,1);
 UPDATE orders SET status='accepted' WHERE id='qa-cloud-order';
 SELECT reserved INTO stock FROM menu_items WHERE id='qa-cloud-menu';
 IF stock!=1 THEN RAISE EXCEPTION 'QA reservation failed'; END IF;
 BEGIN
  UPDATE orders SET status='picked_up',fulfilled_day=day,fulfilled_at=created_at WHERE id='qa-cloud-order';
  RAISE EXCEPTION 'QA unpaid order was allowed';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS failure=MESSAGE_TEXT;
  IF failure!='Unpaid balance' THEN RAISE; END IF;
 END;
 INSERT INTO payments(id,order_id,amount,method,status,day,created_at)
 VALUES ('qa-cloud-payment','qa-cloud-order',6500,'cash','verified','2099-12-31','2099-12-31T00:00:00Z');
 UPDATE orders SET status='picked_up',fulfilled_day=day,fulfilled_at=created_at WHERE id='qa-cloud-order';
 SELECT sold INTO stock FROM menu_items WHERE id='qa-cloud-menu';
 IF stock!=1 THEN RAISE EXCEPTION 'QA pickup failed'; END IF;
END $test$;
ROLLBACK;
SELECT 'Cloud stock, payment, pickup and runtime-role checks passed; fixtures rolled back' AS result;
