"use client";
import { useState } from "react";
import {
  Plus,
  Download,
  Wallet,
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  Check,
  ShieldCheck,
  CalendarCheck,
  Search,
  Coins,
  ExternalLink,
} from "lucide-react";
import { useShop } from "./shop-context";
import { money, niceDate } from "@/lib/domain";
import { Panel, Badge, Avatar, Empty } from "./ui";
export function MoneyView() {
  const { data: d, day, setModal, range, setRange, run, busy } = useShop();
  const [tab, setTab] = useState("Overview"),
    [search, setSearch] = useState("");
  if (!d) return null;
  const verifications = d.payments.filter((p) => p.status === "pending");
  const refunds = d.orders.filter(
    (o) =>
      ["cancelled", "declined", "no_show"].includes(o.status) &&
      o.paid > o.refunded,
  );
  const names: Record<string, string> = {
    expense: "Gastos",
    capital: "Dagdag puhunan",
    withdrawal: "Withdrawal",
    transfer_in: "Transfer in",
    transfer_out: "Transfer out",
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MALINAW ANG BAWAT PISO</div>
          <h1>Pera & utang</h1>
          <p>Your sales, spending, and customer balances in one place.</p>
        </div>
        <button
          className="button primary"
          onClick={() => setModal({ kind: "money", data: { kind: "expense" } })}
        >
          <Plus size={18} />
          Record money
        </button>
      </div>
      <div className="filter-row">
        <div className="category-tabs">
          {["Overview", "Utang", "Payment review"].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
              {t === "Payment review" && verifications.length > 0 && (
                <span className="tab-count">{verifications.length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="segments">
          {[
            ["day", "This day"],
            ["week", "7 days"],
            ["month", "This month"],
          ].map(([r, label]) => (
            <button
              key={r}
              className={range === r ? "active" : ""}
              onClick={() => setRange(r)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === "Overview" && (
        <>
          <div className="stats-grid money-stats">
            {[
              ["Benta", d.stats.sales, "Food already handed over"],
              [
                "Nakolekta",
                d.stats.cash + d.stats.gcash,
                "Includes advance & utang payments",
              ],
              ["Gastos", d.stats.expenses, "Recorded business spending"],
              [
                "Dagdag puhunan",
                d.stats.capital,
                "Owner contributions, separate from sales",
              ],
            ].map(([title, value, note]) => (
              <div className="stat-card" key={String(title)}>
                <span>{title}</span>
                <strong>{money(Number(value))}</strong>
                <small>{note}</small>
              </div>
            ))}
          </div>
          <div className="money-grid">
            <Panel title="Money received" subtitle="Verified payments only">
              <div className="money-method">
                <span className="method-icon cash">
                  <Wallet size={21} />
                </span>
                <div>
                  <strong>Cash</strong>
                  <small>Business cash received</small>
                </div>
                <strong>{money(d.stats.cash)}</strong>
              </div>
              <div className="money-method">
                <span className="method-icon gcash">G</span>
                <div>
                  <strong>GCash</strong>
                  <small>Manually verified by Flor</small>
                </div>
                <strong>{money(d.stats.gcash)}</strong>
              </div>
              <div className="summary-line">
                <span>Refunds sent</span>
                <strong>{money(d.stats.refunds)}</strong>
              </div>
              <p className="panel-note">
                Collections include old utang repayments and advance payments.
                Benta counts food handed over. These totals can be different.
              </p>
            </Panel>
            <Panel title="Daily cash count" subtitle={niceDate(day)}>
              <div className="cash-close-icon">
                <CalendarCheck size={30} />
              </div>
              {d.closeout ? (
                <>
                  <Badge tone="green">Day closed</Badge>
                  <div className="summary-line">
                    <span>Expected cash</span>
                    <strong>{money(d.closeout.expected_cash)}</strong>
                  </div>
                  <div className="summary-line">
                    <span>Actual count</span>
                    <strong>{money(d.closeout.actual_cash)}</strong>
                  </div>
                  <div className="summary-line">
                    <span>Difference</span>
                    <strong>
                      {money(d.closeout.actual_cash - d.closeout.expected_cash)}
                    </strong>
                  </div>
                  <button
                    className="button secondary full-width"
                    onClick={() => setModal({ kind: "reopen" })}
                  >
                    Reopen with a reason
                  </button>
                </>
              ) : (
                <>
                  <h3>Kumpleto na ba ang araw?</h3>
                  <p className="muted">
                    Resolve open orders, count the cash, and save a daily
                    closeout.
                  </p>
                  <button
                    className="button secondary full-width"
                    onClick={() => setModal({ kind: "close" })}
                  >
                    Review & close day
                    <ArrowUpRight size={16} />
                  </button>
                </>
              )}
            </Panel>
          </div>
          <Panel
            title="Gastos, puhunan & movements"
            subtitle="A clear record of what went in and out"
            action={
              <div className="button-row">
                <a
                  className="button small secondary"
                  href="/api/export?type=expenses"
                >
                  <Download size={15} />
                  Export CSV
                </a>
                <button
                  className="button small primary"
                  onClick={() =>
                    setModal({ kind: "money", data: { kind: "capital" } })
                  }
                >
                  <Plus size={15} />
                  Add entry
                </button>
              </div>
            }
          >
            <div className="order-table-wrap">
              <table className="order-table">
                <thead>
                  <tr>
                    <th>Entry</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Note</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {d.entries.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <div className="person">
                          <span
                            className={
                              "entry-icon " +
                              (e.kind === "expense" ? "out" : "in")
                            }
                          >
                            {e.kind === "expense" ? (
                              <ArrowUpRight size={18} />
                            ) : (
                              <ArrowDownLeft size={18} />
                            )}
                          </span>
                          <div>
                            <strong>{e.category}</strong>
                            <small>{names[e.kind]}</small>
                          </div>
                        </div>
                      </td>
                      <td>{niceDate(e.day)}</td>
                      <td>
                        <Badge tone={e.method === "gcash" ? "blue" : "neutral"}>
                          {e.method === "cash" ? "Cash" : "GCash"}
                        </Badge>
                      </td>
                      <td>{e.note || "—"}</td>
                      <td>
                        <strong>{money(e.amount)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!d.entries.length && (
              <Empty
                icon={Receipt}
                title="A clean page"
                description="Record ingredients, packaging, gas, or the money you put into the business."
              />
            )}
          </Panel>
          <div className="export-strip">
            <div>
              <ShieldCheck size={19} />
              <span>Keep a copy of your records.</span>
            </div>
            <a href="/api/export?type=sales">
              Sales CSV
              <Download size={15} />
            </a>
            <a href="/api/export?type=payments">
              Payments CSV
              <Download size={15} />
            </a>
            <a href="/api/export?type=backup">
              Full data backup
              <Download size={15} />
            </a>
          </div>
        </>
      )}
      {tab === "Utang" && (
        <>
          <div className="ledger-banner">
            <div className="ledger-symbol">
              <BookOpen size={30} />
            </div>
            <div>
              <small>TOTAL OUTSTANDING</small>
              <strong>{money(d.stats.debt)}</strong>
              <p>Opening balances + unpaid food already collected</p>
            </div>
            <div className="button-row">
              <button
                className="button secondary"
                onClick={() => setModal({ kind: "customer" })}
              >
                <Plus size={16} />
                Add customer
              </button>
              <button
                className="button primary"
                onClick={() => setModal({ kind: "debt" })}
              >
                <BookOpen size={16} />
                Record old utang
              </button>
            </div>
          </div>
          <div className="list-tools">
            <label className="search-box">
              <Search size={17} />
              <input
                placeholder="Search customers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search utang customers"
              />
            </label>
            <a className="button secondary small" href="/api/export?type=utang">
              <Download size={15} />
              Export ledger
            </a>
          </div>
          <div className="customer-grid">
            {d.customers
              .filter((c) =>
                c.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((c) => (
                <article className="customer-card" key={c.id}>
                  <div className="person">
                    <Avatar name={c.name} />
                    <div>
                      <strong>{c.name}</strong>
                      <small>{c.phone || "No phone saved"}</small>
                    </div>
                  </div>
                  <div className="customer-balance">
                    <small>Remaining utang</small>
                    <strong className={c.balance > 0 ? "" : "green-text"}>
                      {money(c.balance)}
                    </strong>
                  </div>
                  <button
                    className="button secondary full-width"
                    onClick={() => setModal({ kind: "ledger", data: c })}
                  >
                    View ledger & receive payment
                    <ArrowRightIcon />
                  </button>
                </article>
              ))}
          </div>
          {!d.customers.length && (
            <section className="panel">
              <Empty
                icon={BookOpen}
                title="Your suki, remembered"
                description="Add customers to keep their utang and repayments in one clear record."
                action={
                  <button
                    className="button primary"
                    onClick={() => setModal({ kind: "customer" })}
                  >
                    Add your first customer
                  </button>
                }
              />
            </section>
          )}
        </>
      )}
      {tab === "Payment review" && (
        <>
          <Panel
            title="GCash to verify"
            subtitle="Check your own GCash transactions before confirming receipt."
          >
            {verifications.map((p) => (
              <div className="review-row" key={p.id}>
                <span className="method-icon gcash">G</span>
                <div>
                  <strong>{p.customer_name || "Customer"}</strong>
                  <small>
                    {p.reference || "No reference"} · {niceDate(p.day)}
                  </small>
                  <p>{p.note}</p>
                  {p.file_id && (
                    <a
                      href={"/api/files/" + p.file_id}
                      target="_blank"
                      rel="noreferrer"
                      className="text-button"
                    >
                      View screenshot
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
                <strong>{money(p.amount)}</strong>
                <div className="button-row">
                  <button
                    className="button secondary small"
                    disabled={busy}
                    onClick={() =>
                      run(
                        {
                          action: "verifyPayment",
                          id: p.id,
                          verified: false,
                          note: "Please check the amount or reference and send proof again.",
                        },
                        "Customer asked to correct payment proof.",
                      )
                    }
                  >
                    Needs correction
                  </button>
                  <button
                    className="button primary small"
                    disabled={busy}
                    onClick={() =>
                      run(
                        { action: "verifyPayment", id: p.id, verified: true },
                        "GCash payment confirmed received.",
                      )
                    }
                  >
                    <Check size={15} />
                    Received
                  </button>
                </div>
              </div>
            ))}
            {!verifications.length && (
              <Empty
                icon={ShieldCheck}
                title="All payments reviewed"
                description="New payment screenshots will wait here for your confirmation."
              />
            )}
          </Panel>
          <Panel
            title="Refunds to send"
            subtitle="Cancelling an order does not automatically return its payment."
          >
            {refunds.map((o) => (
              <div className="review-row" key={o.id}>
                <Avatar name={o.customer_name} />
                <div>
                  <strong>{o.customer_name}</strong>
                  <small>
                    Order #{o.id.slice(-6).toUpperCase()} · {o.status}
                  </small>
                </div>
                <strong>{money(o.paid - o.refunded)}</strong>
                <button
                  className="button secondary small"
                  onClick={() => setModal({ kind: "refund", data: o })}
                >
                  Record refund sent
                </button>
              </div>
            ))}
            {!refunds.length && (
              <Empty
                icon={Check}
                title="No refunds outstanding"
                description="Cancelled paid orders needing a refund will appear here."
              />
            )}
          </Panel>
        </>
      )}
    </>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={16} />;
}
