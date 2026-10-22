"use client";
import { useState, useRef } from "react";
import {
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  MapPin,
  Clock,
  Heart,
  Check,
  MessageCircle,
  Leaf,
} from "lucide-react";
import { useShop } from "./shop-context";
import { money, available, niceDate, shiftDay } from "@/lib/domain";
import { FoodImage, Badge, Empty, statusText, statusTone, Field } from "./ui";
import { ChatView } from "./chat";
export function CustomerView() {
  const {
    data: d,
    day,
    setDay,
    view,
    setView,
    setModal,
    run,
    busy,
  } = useShop();
  const [cart, setCart] = useState<Record<string, number>>({}),
    [category, setCategory] = useState("All"),
    [checkout, setCheckout] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  if (!d) return null;
  const orders = d.orders.filter((o) => o.user_id === d.user?.id);
  const menu = d.menu.filter(
    (m) => m.enabled && (category === "All" || m.category === category),
  );
  const total = d.menu.reduce((n, m) => n + (cart[m.id] || 0) * m.price, 0);
  const qty = Object.values(cart).reduce((n, q) => n + q, 0);
  async function order(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!d!.user) {
      window.location.href = "/login";
      return;
    }
    if (!d!.customerId) {
      setModal({ kind: "profile" });
      return;
    }
    const f = new FormData(e.currentTarget);
    const r = await run(
      {
        action: "order",
        requestId: requestId.current,
        day,
        pickupTime: String(f.get("pickupTime")),
        expectedTotal: total,
        note: String(f.get("note") || ""),
        items: Object.entries(cart)
          .filter(([, quantity]) => quantity > 0)
          .map(([id, quantity]) => ({ id, quantity })),
      },
      "Request sent. Flor will confirm your portions.",
    );
    if (r) {
      setCart({});
      setCheckout(false);
      requestId.current = crypto.randomUUID();
      setView("orders");
    }
  }
  if (view === "chat") return <ChatView customerView />;
  if (view === "orders")
    return (
      <>
        <div className="page-heading">
          <div className="eyebrow">SOMETHING GOOD IS ON ITS WAY</div>
          <h1>My orders</h1>
          <p>Check acceptance, payment, and pickup here.</p>
        </div>
        <div className="customer-orders">
          {orders.map((o) => (
            <button
              className="customer-order-card panel"
              key={o.id}
              onClick={() => setModal({ kind: "order", data: o })}
            >
              <div>
                <small>
                  #{o.id.slice(-6).toUpperCase()} · {niceDate(o.day)}
                </small>
                <h3>
                  {o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                </h3>
                <p>
                  <Clock size={15} />
                  {o.pickup_time} pickup <span>·</span>
                  {money(o.total)}
                </p>
              </div>
              <Badge tone={statusTone[o.status]}>{statusText[o.status]}</Badge>
              <ArrowRight size={18} />
            </button>
          ))}
        </div>
        {!orders.length && (
          <section className="panel">
            <Empty
              icon={ShoppingBag}
              title="Your first home-cooked order awaits"
              description="Choose from Flor’s menu, send a request, and wait for her confirmation."
              action={
                <button
                  className="button primary"
                  onClick={() => setView("menu")}
                >
                  Browse the menu
                </button>
              }
            />
          </section>
        )}
      </>
    );
  return (
    <>
      <section className="shop-hero">
        <div>
          <span className="eyebrow">
            <Leaf size={15} />
            MADE WITH CARE, SERVED WITH LOVE
          </span>
          <h1>
            Lutong bahay.
            <br />
            <em>Alagang Flor.</em>
          </h1>
          <p>
            A good meal feels like home. Choose your favorites,
            <br className="desktop-only" /> and we’ll have them ready for
            pickup.
          </p>
          <div className="shop-hero-details">
            <span>
              <MapPin size={16} />
              {d.settings?.location}
            </span>
            <span>
              <Clock size={16} />
              {d.settings?.pickup_start}–{d.settings?.pickup_end}
            </span>
          </div>
        </div>
        <div className="hero-food">
          <FoodImage
            image="/images/adobo.jpg"
            name="Illustrative chicken adobo"
          />
          <span className="hero-note">
            <Heart size={17} />
            Laging may pagmamahal.
          </span>
        </div>
      </section>
      <div className="page-heading shop-menu-heading">
        <div>
          <div className="eyebrow">FRESH FROM FLOR’S KITCHEN</div>
          <h2>Anong gusto mong kainin?</h2>
          <p>Fixed servings. Honest prices. Pickup only.</p>
        </div>
        <div className="segments">
          <button
            className={day === d.today ? "active" : ""}
            onClick={() => {
              setDay(d.today);
              setCart({});
              setCheckout(false);
            }}
          >
            Ngayon
          </button>
          <button
            className={day === shiftDay(d.today, 1) ? "active" : ""}
            onClick={() => {
              setDay(shiftDay(d.today, 1));
              setCart({});
              setCheckout(false);
            }}
          >
            Bukas
          </button>
        </div>
      </div>
      <div className="filter-row">
        <div className="category-tabs">
          {["All", "Ulam", "Gulay", "Rice & sides", "Merienda"].map((c) => (
            <button
              key={c}
              className={c === category ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <span className="muted">{niceDate(day)}</span>
      </div>
      {!d.published ? (
        <section className="panel">
          <Empty
            icon={Clock}
            title="A little something is cooking"
            description="Flor hasn’t published this date’s menu yet. Check back soon, or send her a message."
            action={
              <button
                className="button secondary"
                onClick={() => setView("chat")}
              >
                Chat with Flor
                <MessageCircle size={16} />
              </button>
            }
          />
        </section>
      ) : (
        <div className="food-grid customer-food-grid">
          {menu.map((m) => (
            <article className="food-card" key={m.id}>
              <div className="food-photo">
                <FoodImage image={m.image} name={m.name} />
                {available(m) < 6 && (
                  <Badge tone={available(m) > 0 ? "amber" : "red"}>
                    {available(m) > 0
                      ? "Only " + available(m) + " left"
                      : "Sold out"}
                  </Badge>
                )}
              </div>
              <div className="food-card-body">
                <small className="food-category">{m.category}</small>
                <div className="food-title-row">
                  <h2>{m.name}</h2>
                  <strong className="food-price">{money(m.price)}</strong>
                </div>
                <p>{m.description}</p>
                <div className="food-card-bottom">
                  <small>{m.serving}</small>
                  {cart[m.id] ? (
                    <div className="quantity-control">
                      <button
                        aria-label={"Remove " + m.name}
                        onClick={() =>
                          setCart({ ...cart, [m.id]: cart[m.id] - 1 })
                        }
                      >
                        <Minus size={14} />
                      </button>
                      <span>{cart[m.id]}</span>
                      <button
                        aria-label={"Add " + m.name}
                        disabled={cart[m.id] >= available(m)}
                        onClick={() =>
                          setCart({ ...cart, [m.id]: cart[m.id] + 1 })
                        }
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="button small secondary"
                      disabled={available(m) <= 0}
                      onClick={() => setCart({ ...cart, [m.id]: 1 })}
                    >
                      <Plus size={15} />
                      Add to order
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {qty > 0 && (
        <div className="cart-bar">
          <span className="cart-count">
            <ShoppingBag size={18} />
            {qty}
          </span>
          <div>
            <strong>Your home-cooked picks</strong>
            <small>
              {money(total)} · {niceDate(day)}
            </small>
          </div>
          <button
            className="button primary"
            onClick={() => setCheckout(!checkout)}
          >
            {checkout ? "Hide details" : "Review order"}
            <ArrowRight size={17} />
          </button>
        </div>
      )}
      {checkout && qty > 0 && (
        <section className="panel checkout-panel">
          <div className="panel-heading">
            <div>
              <h2>Review & request pickup</h2>
              <p>Your portions are reserved after Flor accepts.</p>
            </div>
          </div>
          <form onSubmit={order}>
            <div className="checkout-items">
              {d.menu
                .filter((m) => cart[m.id] > 0)
                .map((m) => (
                  <div className="summary-line" key={m.id}>
                    <span>
                      {cart[m.id]}× {m.name}
                    </span>
                    <strong>{money(cart[m.id] * m.price)}</strong>
                  </div>
                ))}
            </div>
            <div className="form-grid">
              <Field label="Pickup time">
                <input
                  type="time"
                  name="pickupTime"
                  required
                  min={d.settings?.pickup_start}
                  max={d.settings?.pickup_end}
                  defaultValue={d.settings?.pickup_start}
                />
              </Field>
              <Field label="Payment">
                <select disabled>
                  <option>Cash or GCash — arrange after acceptance</option>
                </select>
              </Field>
            </div>
            <Field label="Note for Flor (optional)">
              <textarea
                name="note"
                maxLength={500}
                rows={2}
                placeholder="Any pickup instructions?"
              />
            </Field>
            {d.settings?.notice && (
              <div className="info-box">{d.settings.notice}</div>
            )}
            {d.settings?.gcash_number && (
              <p className="muted">
                After acceptance: GCash {d.settings.gcash_number} ·{" "}
                {d.settings.gcash_name}. You can upload proof from your order.
              </p>
            )}
            <div className="form-actions">
              <strong>Total: {money(total)}</strong>
              <button className="button primary" disabled={busy}>
                {busy
                  ? "Sending…"
                  : !d.user
                    ? "Sign in to order"
                    : !d.customerId
                      ? "Add pickup details"
                      : "Send order request"}
                <Check size={17} />
              </button>
            </div>
          </form>
        </section>
      )}
      <p className="gentle-note">
        <Heart size={14} />
        Starter dish photos are AI illustrations. Actual servings may look
        different.
      </p>
    </>
  );
}
