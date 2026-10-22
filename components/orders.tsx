"use client";
import { useState } from "react";
import {
  Plus,
  Search,
  ShoppingBag,
  ArrowUpRight,
  Clock,
  Check,
  PackageCheck,
} from "lucide-react";
import { useShop } from "./shop-context";
import { money, paymentLabel, niceDate } from "@/lib/domain";
import { Badge, Avatar, Empty, statusText, statusTone } from "./ui";
export function OrdersView() {
  const { data: d, orderDate, setOrderDate, setModal, run, busy } = useShop();
  const [filter, setFilter] = useState("All"),
    [query, setQuery] = useState("");
  if (!d) return null;
  const base = d.orders.filter(
    (o) =>
      (!orderDate || o.day === orderDate) &&
      o.customer_name.toLowerCase().includes(query.toLowerCase()),
  );
  const matching = base.filter(
    (o) =>
      filter === "All" ||
      (filter === "New requests" && o.status === "pending") ||
      (filter === "In the kitchen" && o.status === "accepted") ||
      (filter === "Ready" && o.status === "ready") ||
      (filter === "Completed" && o.status === "picked_up") ||
      (filter === "Cancelled" &&
        ["cancelled", "declined", "no_show"].includes(o.status)),
  );
  matching.sort(
    (a, b) =>
      b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  );
  const list = orderDate ? matching : matching.slice(0, 10);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">EVERY ORDER, TAKEN CARE OF</div>
          <h1>Orders sa kusina</h1>
          <p>
            Latest 10 orders, or choose a pickup date to see that day’s orders.
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => setModal({ kind: "sale" })}
        >
          <Plus size={18} />
          Bagong benta
        </button>
      </div>
      <div className="filter-row">
        <div className="category-tabs">
          {[
            "All",
            "New requests",
            "In the kitchen",
            "Ready",
            "Completed",
            "Cancelled",
          ].map((s) => (
            <button
              key={s}
              className={filter === s ? "active" : ""}
              onClick={() => setFilter(s)}
            >
              {s}
              {s === "New requests" &&
                base.some((o) => o.status === "pending") && (
                  <span className="tab-count">
                    {base.filter((o) => o.status === "pending").length}
                  </span>
                )}
            </button>
          ))}
        </div>
      </div>
      <div className="list-tools">
        <label className="search-box">
          <Search size={17} />
          <input
            placeholder="Search customer…"
            aria-label="Search customer orders"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="order-date-filter">
          <span>Pickup date</span>
          <input
            type="date"
            aria-label="Filter orders by pickup date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
          />
        </label>
        {orderDate && (
          <button className="button secondary" onClick={() => setOrderDate("")}>
            Show latest 10
          </button>
        )}
      </div>
      <p className="muted" role="status">
        {orderDate
          ? `${list.length} matching orders for ${niceDate(orderDate)}`
          : `Showing ${list.length} most recent${query || filter !== "All" ? " matching" : ""} orders`}
      </p>
      <section className="panel order-list-panel">
        <div className="order-table-wrap">
          <table className="order-table full">
            <thead>
              <tr>
                <th>Customer / Order</th>
                <th>Food</th>
                <th>Pickup</th>
                <th>Total & payment</th>
                <th>Status</th>
                <th>Next step</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  <td>
                    <button
                      className="person person-button"
                      onClick={() => setModal({ kind: "order", data: o })}
                    >
                      <Avatar name={o.customer_name} />
                      <span>
                        <strong>{o.customer_name}</strong>
                        <small>
                          #{o.id.slice(-6).toUpperCase()}{" "}
                          <span>
                            · {o.source === "walkin" ? "Walk-in" : "Preorder"}
                          </span>
                        </small>
                      </span>
                    </button>
                  </td>
                  <td className="food-cell">
                    {o.items.map((i) => (
                      <span key={i.id}>
                        {i.quantity}× {i.name}
                      </span>
                    ))}
                  </td>
                  <td>
                    <strong>{o.pickup_time}</strong>
                    <small>{niceDate(o.day)}</small>
                  </td>
                  <td>
                    <strong>{money(o.total)}</strong>
                    <small
                      className={o.paid >= o.total ? "green-text" : "muted"}
                    >
                      {paymentLabel(o.total, o.paid, o.pending)}
                    </small>
                  </td>
                  <td>
                    <Badge tone={statusTone[o.status]}>
                      {statusText[o.status]}
                    </Badge>
                  </td>
                  <td>
                    {o.status === "pending" ? (
                      <button
                        className="button small primary"
                        disabled={busy}
                        onClick={() =>
                          run(
                            {
                              action: "orderStatus",
                              id: o.id,
                              status: "accepted",
                            },
                            "Order accepted. Portions reserved.",
                          )
                        }
                      >
                        <Check size={15} />
                        Tanggapin
                      </button>
                    ) : o.status === "accepted" ? (
                      <button
                        className="button small secondary"
                        disabled={busy}
                        onClick={() =>
                          run(
                            {
                              action: "orderStatus",
                              id: o.id,
                              status: "ready",
                            },
                            "Order marked ready.",
                          )
                        }
                      >
                        <PackageCheck size={15} />
                        Handa na
                      </button>
                    ) : (
                      <button
                        className="button small secondary"
                        onClick={() => setModal({ kind: "order", data: o })}
                      >
                        View order
                        <ArrowUpRight size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.length && (
          <Empty
            icon={ShoppingBag}
            title="No orders here yet"
            description="Preorders and walk-in sales will show up here, with their own payment and pickup status."
          />
        )}
      </section>
      <p className="gentle-note">
        <Clock size={15} />
        Pending requests reserve portions only when you accept. Choose a pickup
        date to find older orders.
      </p>
    </>
  );
}
