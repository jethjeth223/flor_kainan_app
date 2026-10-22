"use client";
import { useState, useEffect } from "react";
import {
  Plus,
  Globe,
  Pause,
  Search,
  Check,
  ChefHat,
  Eye,
  Pencil,
} from "lucide-react";
import { useShop } from "./shop-context";
import { FoodImage, Badge, Empty } from "./ui";
import { money, available } from "@/lib/domain";
export function MenuView() {
  const { data: d, day, setDay, run, busy, setModal } = useShop();
  useEffect(() => {
    if (d && day !== d.today) setDay(d.today);
  }, [d?.today, day, setDay]);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("All dishes");
  if (!d) return null;
  const items = d.menu.filter(
    (m) =>
      (category === "All dishes" || m.category === category) &&
      m.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE HEART OF YOUR KITCHEN</div>
          <h1>Tinda & menu</h1>
          <p>Turn dishes on or off, then publish your menu.</p>
        </div>
        <div className="button-row">
          <button
            className="button secondary"
            onClick={() => setModal({ kind: "catalog" })}
          >
            Food list
          </button>
          <button
            className="button primary"
            onClick={() => setModal({ kind: "food" })}
          >
            <Plus size={18} />
            Add a dish
          </button>
        </div>
      </div>
      <div className="menu-toolbar">
        <strong>All dishes</strong>
        <div className="toolbar-right">
          <button
            className={"button " + (d.published ? "secondary" : "primary")}
            disabled={busy || !d.menu.length}
            onClick={() =>
              run(
                { action: "catalogPublish", published: !d.published },
                d.published
                  ? "Menu paused for new orders."
                  : "Your menu is live!",
              )
            }
          >
            {d.published ? <Pause size={16} /> : <Globe size={16} />}{" "}
            {d.published ? "Pause menu" : "I-publish ang menu"}
          </button>
        </div>
      </div>
      <div className={"menu-status " + (d.published ? "live" : "")}>
        <span className="status-circle">
          {d.published ? <Check size={17} /> : <Pencil size={16} />}
        </span>
        <div>
          <strong>
            {d.published ? "Open for orders" : "Menu paused for new orders"}
          </strong>
          <span>
            {d.published
              ? "Customers can request the available dishes below."
              : "Your dish choices are saved. Publish when you’re ready."}
          </span>
        </div>
        <Badge tone={d.published ? "green" : "amber"}>
          {d.published ? "Live menu" : "Paused"}
        </Badge>
      </div>
      <div className="filter-row">
        <div className="category-tabs">
          {["All dishes", "Ulam", "Gulay", "Rice & sides", "Merienda"].map(
            (c) => (
              <button
                className={category === c ? "active" : ""}
                key={c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ),
          )}
        </div>
        <label className="search-box">
          <Search size={17} />
          <input
            placeholder="Search dishes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search dishes"
          />
        </label>
      </div>
      <div className="food-grid">
        {items.map((m) => (
          <article
            className={"food-card " + (!m.enabled ? "paused" : "")}
            key={m.id}
          >
            <div className="food-photo">
              <FoodImage image={m.image} name={m.name} />
              <Badge
                tone={
                  !m.enabled ? "neutral" : available(m) > 0 ? "green" : "red"
                }
              >
                {!m.enabled
                  ? "Not on menu"
                  : available(m) > 0
                    ? "Available"
                    : "Sold out"}
              </Badge>
              <button
                className="photo-edit"
                aria-label={"Edit " + m.name}
                onClick={() =>
                  setModal({
                    kind: "menuItem",
                    data: { ...m, catalogFoodId: m.food_id },
                  })
                }
              >
                <Pencil size={16} />
              </button>
            </div>
            <div className="food-card-body">
              <div className="food-title-row">
                <div>
                  <small className="food-category">{m.category}</small>
                  <h2>{m.name}</h2>
                </div>
                <strong className="food-price">{money(m.price)}</strong>
              </div>
              <p>{m.description}</p>
              <div className="stock-line">
                <span>{m.serving}</span>
                <strong>
                  {available(m)} <span>of {m.capacity} left</span>
                </strong>
              </div>
              <div className="stock-track">
                <span
                  style={{
                    width: `${m.capacity ? Math.max(0, (available(m) / m.capacity) * 100) : 0}%`,
                  }}
                />
              </div>
              <div className="food-card-bottom">
                <small>
                  {m.reserved} reserved <span>·</span> {m.sold} served
                </small>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={!!m.enabled}
                    disabled={busy || day < d.today}
                    aria-label={"Offer " + m.name}
                    onChange={(e) =>
                      run(
                        {
                          action: "catalogDish",
                          id: m.food_id,
                          enabled: e.target.checked,
                        },
                        e.target.checked
                          ? "Dish is available."
                          : "Dish paused for new orders.",
                      )
                    }
                  />
                  <span />
                </label>
              </div>
              <button
                className="button small secondary"
                onClick={() =>
                  setModal({
                    kind: "menuItem",
                    data: { ...m, catalogFoodId: m.food_id },
                  })
                }
              >
                <Pencil size={14} /> Edit / refill portions
              </button>
            </div>
          </article>
        ))}
      </div>
      {!d.menu.length && (
        <Empty
          icon={ChefHat}
          title="Your dishes go here"
          description="Add your first dish, turn it on, then publish your menu."
        />
      )}
      {d.menu.length > 0 && !items.length && (
        <Empty
          title="No matching dishes"
          description="Try another category or search term."
        />
      )}
      <p className="gentle-note">
        <Eye size={15} />
        Switching off a dish stops new requests. Existing orders stay safe.
        Starter food photos are AI illustrations.
      </p>
    </>
  );
}
