SET LOCAL search_path = kainan, pg_catalog;
CREATE INDEX debts_customer ON debts(customer_id);
CREATE INDEX menu_items_food ON menu_items(food_id);
CREATE INDEX messages_file ON messages(file_id);
CREATE INDEX messages_order ON messages(order_id);
CREATE INDEX order_items_menu ON order_items(menu_item_id);
CREATE INDEX payments_file ON payments(file_id);
