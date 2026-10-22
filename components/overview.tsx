"use client";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Wallet,
  ShoppingBag,
  Coins,
  BookOpen,
  Clock,
  CheckCircle2,
  CalendarDays,
  Utensils,
  Sun,
  Leaf,
} from "lucide-react";
import { useShop } from "./shop-context";
import { money, available, shiftDay, niceDate } from "@/lib/domain";
import {
  Panel,
  FoodImage,
  Badge,
  Avatar,
  Empty,
  LinkButton,
  statusText,
  statusTone,
} from "./ui";
export function Overview() {
  const { data: d, day, setView, setDay, setModal } = useShop();
  if (!d) return null;
  const orders = d.orders.filter(
    (o) =>
      o.day === day && !["cancelled", "declined", "no_show"].includes(o.status),
  );
  const pending = orders.filter((o) => o.status === "pending"),
    ready = orders.filter((o) => o.status === "ready");
  const live = orders
    .filter((o) => ["pending", "accepted", "ready"].includes(o.status))
    .slice(0, 5);
  const menu = d.menu.filter((m) => m.enabled);
  const points = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDay(day, i - 6);
    return {
      day: date,
      amount: d.recent.find((x) => x.day === date)?.amount || 0,
    };
  });
  const max = Math.max(...points.map((p) => p.amount), 100);
  return (
    <>
      <div className="welcome-row">
        <div>
          <div className="eyebrow">
            <Sun size={15} /> A FRESH START, EVERY DAY
          </div>
          <h1>
            Kumusta, Flor<span className="heading-dot">.</span>
          </h1>
          <p>Here’s what’s cooking in your kitchen today.</p>
        </div>
        <button
          className="button primary"
          onClick={() => setModal({ kind: "sale" })}
        >
          <Plus size={19} />
          Bagong benta
        </button>
      </div>
      <div className="stats-grid">
        {[
          {
            title: "Benta",
            value: money(d.stats.sales),
            note: "Food handed over",
            icon: Coins,
            tone: "green",
          },
          {
            title: "Nakolekta",
            value: money(d.stats.cash + d.stats.gcash),
            note: "Cash + verified GCash",
            icon: Wallet,
            tone: "sand",
          },
          {
            title: "Orders",
            value: String(orders.length),
            note: `${pending.length} waiting for you`,
            icon: ShoppingBag,
            tone: "blue",
          },
          {
            title: "Utang balance",
            value: money(d.stats.debt),
            note: "All unpaid customer balances",
            icon: BookOpen,
            tone: "rose",
          },
        ].map((s) => (
          <div className="stat-card" key={s.title}>
            <div className="stat-top">
              <span>{s.title}</span>
              <span className={"stat-icon " + s.tone}>
                <s.icon size={18} />
              </span>
            </div>
            <strong>{s.value}</strong>
            <small>{s.note}</small>
          </div>
        ))}
      </div>
      {pending.length > 0 && (
        <button className="attention-strip" onClick={() => setView("orders")}>
          <span className="attention-icon">
            <Clock size={18} />
          </span>
          <span>
            <strong>
              {pending.length} order{" "}
              {pending.length === 1 ? "request needs" : "requests need"} your
              okay
            </strong>
            <small>Check the portions, then tap Tanggapin.</small>
          </span>
          <ArrowRight size={19} />
        </button>
      )}
      <div className="dashboard-grid">
        <Panel
          title="Orders sa kusina"
          subtitle="A little order, a smoother day."
          action={
            <LinkButton onClick={() => setView("orders")}>
              View all orders
            </LinkButton>
          }
        >
          <div className="order-table-wrap">
            <table className="order-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Order</th>
                  <th>Pickup</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {live.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setModal({ kind: "order", data: o })}
                  >
                    <td>
                      <div className="person">
                        <Avatar name={o.customer_name} />
                        <div>
                          <strong>{o.customer_name}</strong>
                          <small>#{o.id.slice(-6).toUpperCase()}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span>
                        {o.items
                          .map((i) => `${i.quantity}× ${i.name}`)
                          .join(", ")}
                      </span>
                      <small>{money(o.total)}</small>
                    </td>
                    <td>
                      <span>{o.pickup_time}</span>
                    </td>
                    <td>
                      <Badge tone={statusTone[o.status]}>
                        {statusText[o.status]}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={"Open order for " + o.customer_name}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!live.length && (
            <Empty
              icon={CheckCircle2}
              title="All caught up, Flor"
              description="New requests and orders being prepared will appear here."
            />
          )}
          <div className="panel-foot">
            <span className="mini-dot" /> {ready.length} ready for pickup{" "}
            <span className="muted">·</span> {d.stats.portions} portions
            available
          </div>
        </Panel>
        <Panel
          title="Tinda ngayon"
          subtitle={
            d.published
              ? "Your menu is live. Tara, kain!"
              : "Your menu is still a draft."
          }
          action={<span className="count-pill">{menu.length} dishes</span>}
        >
          <div className="mini-menu">
            {menu.slice(0, 4).map((m) => (
              <div className="mini-dish" key={m.id}>
                <FoodImage image={m.image} name={m.name} />
                <div>
                  <strong>{m.name}</strong>
                  <small>
                    {money(m.price)} <span> / {m.serving}</span>
                  </small>
                </div>
                <span
                  className={"remaining " + (available(m) < 6 ? "low" : "")}
                >
                  {available(m)}
                  <small>left</small>
                </span>
              </div>
            ))}
          </div>
          {!menu.length && (
            <Empty
              title="What’s cooking?"
              description="Choose your dishes and publish a menu."
            />
          )}
          <button className="wide-text-button" onClick={() => setView("menu")}>
            Manage your menu
            <ArrowRight size={16} />
          </button>
        </Panel>
        <Panel
          title="Benta this week"
          subtitle="Food sales over the last seven days"
          action={
            <span className="chart-total">
              {money(points.reduce((n, p) => n + p.amount, 0))}
            </span>
          }
        >
          <div
            className="chart"
            role="img"
            aria-label={points
              .map((p) => `${p.day}: ${money(p.amount)}`)
              .join("; ")}
          >
            <div className="chart-grid-lines">
              <span />
              <span />
              <span />
            </div>
            {points.map((p, i) => (
              <div className="chart-column" key={p.day}>
                <div
                  className={"chart-bar " + (i === 6 ? "current" : "")}
                  style={{
                    height: `${Math.max((p.amount / max) * 130, p.amount ? 8 : 2)}px`,
                  }}
                  title={money(p.amount)}
                >
                  <span>{money(p.amount)}</span>
                </div>
                <small>
                  {new Date(p.day + "T12:00:00").toLocaleDateString("en-PH", {
                    weekday: "short",
                  })}
                </small>
              </div>
            ))}
          </div>
          <div className="panel-foot">
            <Leaf size={14} />
            One serving at a time. Every sale counts.
          </div>
        </Panel>
        <div className="right-stack">
          <section className="tomorrow-card">
            <div className="tomorrow-icon">
              <CalendarDays size={22} />
            </div>
            <div className="eyebrow">A LITTLE HEAD START</div>
            <h2>Ayusin ang tinda.</h2>
            <p>
              All your dishes, in one place.
              <br />
              Switch on, set portions, publish.
            </p>
            <button
              className="button"
              onClick={() => {
                setDay(d.today);
                setView("menu");
              }}
            >
              Ayusin ang menu
              <ArrowRight size={16} />
            </button>
            <span className="tomorrow-decoration">
              <Utensils size={78} strokeWidth={1} />
            </span>
          </section>
          <div className="quick-actions">
            <button
              onClick={() =>
                setModal({ kind: "money", data: { kind: "expense" } })
              }
            >
              <span className="quick-icon">
                <Plus size={18} />
              </span>
              <div>
                <strong>Add gastos</strong>
                <small>Keep the little costs in check</small>
              </div>
              <ArrowUpRight size={18} />
            </button>
            <button onClick={() => setView("money")}>
              <span className="quick-icon">
                <BookOpen size={18} />
              </span>
              <div>
                <strong>Pera at utang</strong>
                <small>Know where every peso goes</small>
              </div>
              <ArrowUpRight size={18} />
            </button>
          </div>
        </div>
      </div>
      <div className="page-foot">
        <Leaf size={13} />
        Made for your everyday, Flor.<span>{niceDate(day)}</span>
      </div>
    </>
  );
}
