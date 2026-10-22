ALTER TABLE kainan.settings ADD COLUMN catalog_mode integer NOT NULL DEFAULT 1 CHECK (catalog_mode IN (0,1));
ALTER TABLE kainan.settings ADD COLUMN catalog_published integer NOT NULL DEFAULT 0 CHECK (catalog_published IN (0,1));
ALTER TABLE kainan.foods ADD COLUMN enabled integer NOT NULL DEFAULT 0 CHECK (enabled IN (0,1));
ALTER TABLE kainan.foods ADD COLUMN capacity integer NOT NULL DEFAULT 20 CHECK (capacity BETWEEN 0 AND 10000);
-- Carry forward Flor's latest choices; leave historical portions and orders intact.
UPDATE kainan.foods f SET
  enabled=COALESCE((SELECT m.enabled FROM kainan.menu_items m WHERE m.food_id=f.id ORDER BY m.day DESC LIMIT 1),0),
  capacity=COALESCE((SELECT m.capacity FROM kainan.menu_items m WHERE m.food_id=f.id ORDER BY m.day DESC LIMIT 1),20);
UPDATE kainan.settings SET catalog_published=CASE WHEN EXISTS (SELECT 1 FROM kainan.menu_days WHERE published=1) THEN 1 ELSE 0 END;
