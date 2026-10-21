"use client";
import { useState, useRef } from "react";
import {
  Plus,
  Minus,
  Check,
  Wallet,
  ShoppingBag,
  MessageCircle,
  Clock,
  ExternalLink,
  ArrowRight,
  BookOpen,
  AlertCircle,
  Paperclip,
} from "lucide-react";
import { useShop } from "./shop-context";
import {
  Dialog,
  Field,
  Submit,
  PesoInput,
  formData,
  pesos,
  FoodImage,
  Badge,
  statusText,
  statusTone,
  Empty,
} from "./ui";
import { money, available, paymentLabel, niceDate } from "@/lib/domain";
import type { Order, Customer } from "@/lib/types";

export function Dialogs() {
  const { modal, setModal } = useShop();
  if (!modal) return null;
  const close = () => setModal(null);
  switch (modal.kind) {
    case "sale":
      return (
        <Dialog
          title="Bagong benta"
          subtitle="A quick sale, with everything recorded."
          wide
          onClose={close}
        >
          <SaleForm />
        </Dialog>
      );
    case "order":
      return <OrderDialog orderId={modal.data.id} />;
    case "payment":
      return (
        <Dialog
          title="Record payment"
          subtitle="Record only what was actually received."
          onClose={close}
        >
          <PaymentForm target={modal.data} />
        </Dialog>
      );
    case "proof":
      return (
        <Dialog
          title="Send GCash payment proof"
          subtitle="Flor will check receipt before confirming your payment."
          onClose={close}
        >
          <PaymentForm target={modal.data} proof />
        </Dialog>
      );
    case "money":
      return (
        <Dialog
          title="Record money"
          subtitle="Every peso has its place."
          onClose={close}
        >
          <MoneyForm kind={modal.data?.kind} />
        </Dialog>
      );
    case "menuItem":
      return (
        <Dialog
          title="Adjust this dish"
          subtitle="Changes apply only to this date’s menu."
          onClose={close}
        >
          <MenuItemForm item={modal.data} />
        </Dialog>
      );
    case "food":
      return (
        <Dialog
          title={modal.data ? "Edit food catalog" : "Add a dish"}
          subtitle="Save it once. Put it on the menu any day."
          onClose={close}
        >
          <FoodForm food={modal.data} />
        </Dialog>
      );
    case "catalog":
      return (
        <Dialog
          title="Your food list"
          subtitle="Create once, cook again and again."
          wide
          onClose={close}
        >
          <Catalog />
        </Dialog>
      );
    case "customer":
      return (
        <Dialog
          title="Add a customer"
          subtitle="Keep your suki’s records together."
          onClose={close}
        >
          <CustomerForm />
        </Dialog>
      );
    case "debt":
      return (
        <Dialog
          title="Record old utang"
          subtitle="Bring an existing notebook balance into the app."
          onClose={close}
        >
          <DebtForm customerId={modal.data?.customerId} />
        </Dialog>
      );
    case "ledger":
      return (
        <Dialog
          title={modal.data.name + "’s ledger"}
          subtitle="Charges and repayments, all in one place."
          wide
          onClose={close}
        >
          <Ledger customer={modal.data} />
        </Dialog>
      );
    case "close":
      return (
        <Dialog
          title="Close the day"
          subtitle="Count the drawer before wrapping up."
          onClose={close}
        >
          <CloseForm />
        </Dialog>
      );
    case "reopen":
      return (
        <Dialog
          title="Reopen this day"
          subtitle="The reason will be kept in the audit trail."
          onClose={close}
        >
          <ReopenForm />
        </Dialog>
      );
    case "refund":
      return (
        <Dialog
          title="Record refund sent"
          subtitle="Save this after you have returned the money."
          onClose={close}
        >
          <RefundForm order={modal.data} />
        </Dialog>
      );
    case "cancel":
      return (
        <Dialog
          title="Cancel this order"
          subtitle="Decide what should happen to its reserved portions."
          onClose={close}
        >
          <CancelForm order={modal.data} />
        </Dialog>
      );
    case "profile":
      return (
        <Dialog
          title="A little introduction"
          subtitle="Flor needs your name and number for pickup."
          onClose={close}
        >
          <ProfileForm />
        </Dialog>
      );
    case "reset":
      return (
        <Dialog
          title="Start your real shop"
          subtitle="This clears the fictional sample transactions."
          onClose={close}
        >
          <ResetForm />
        </Dialog>
      );
    default:
      return null;
  }
}

function SaleForm() {
  const { data: d, run, setModal, busy } = useShop();
  const [cart, setCart] = useState<Record<string, number>>({}),
    [payMethod, setPayMethod] = useState("cash"),
    [customerId, setCustomerId] = useState(""),
    [newCustomer, setNewCustomer] = useState(false),
    [credit, setCredit] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  if (!d) return null;
  const items = d.menu.filter((m) => m.enabled && available(m) > 0);
  const total = items.reduce((n, m) => n + (cart[m.id] || 0) * m.price, 0);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    const f = formData(e);
    let cid = customerId;
    if (newCustomer) {
      const r = await run(
        {
          action: "customer",
          name: String(f.get("customerName")),
          phone: String(f.get("phone") || ""),
        },
        "",
      );
      if (!r) return;
      cid = r.id;
    }
    const cash =
      payMethod === "cash"
        ? pesos(f, "paid")
        : payMethod === "split"
          ? pesos(f, "cash")
          : 0;
    const gcash =
      payMethod === "gcash"
        ? pesos(f, "paid")
        : payMethod === "split"
          ? pesos(f, "gcash")
          : 0;
    const r = await run(
      {
        action: "order",
        requestId: requestId.current,
        day: d!.today,
        pickupTime: d!.settings?.pickup_start || "10:00",
        walkin: true,
        items: Object.entries(cart)
          .filter(([, q]) => q > 0)
          .map(([id, quantity]) => ({ id, quantity })),
        expectedTotal: total,
        customerId: cid || null,
        credit,
        cash,
        gcash,
        reference: String(f.get("reference") || ""),
      },
      "Benta saved. Stock and payments updated.",
    );
    if (r) setModal(null);
  }
  if (!d.published)
    return (
      <Empty
        icon={ShoppingBag}
        title="Publish today’s menu first"
        description="Your quick sales use the same daily stock as preorders."
      />
    );
  return (
    <form onSubmit={submit}>
      <div className="sale-items">
        {items.map((m) => (
          <div className="sale-item" key={m.id}>
            <FoodImage image={m.image} name={m.name} />
            <div>
              <strong>{m.name}</strong>
              <small>
                {money(m.price)} · {available(m)} available
              </small>
            </div>
            <div className="quantity-control">
              <button
                type="button"
                aria-label={"Remove " + m.name}
                disabled={!cart[m.id]}
                onClick={() =>
                  setCart({
                    ...cart,
                    [m.id]: Math.max(0, (cart[m.id] || 0) - 1),
                  })
                }
              >
                <Minus size={14} />
              </button>
              <span>{cart[m.id] || 0}</span>
              <button
                type="button"
                aria-label={"Add " + m.name}
                disabled={(cart[m.id] || 0) >= available(m)}
                onClick={() =>
                  setCart({ ...cart, [m.id]: (cart[m.id] || 0) + 1 })
                }
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="bill-total">
        <span>Total</span>
        <strong>{money(total)}</strong>
      </div>
      <div className="form-grid">
        <Field label="Payment method">
          <select
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="gcash">GCash — already verified</option>
            <option value="split">Cash + GCash</option>
          </select>
        </Field>
        {payMethod !== "split" ? (
          <Field
            label="Amount received"
            hint="Enter the net amount after change."
          >
            <PesoInput
              name="paid"
              key={total + "-" + payMethod}
              defaultValue={total / 100}
            />
          </Field>
        ) : (
          <>
            <Field label="Cash received">
              <PesoInput name="cash" defaultValue={0} />
            </Field>
            <Field label="GCash received">
              <PesoInput name="gcash" defaultValue={0} />
            </Field>
          </>
        )}
        {payMethod !== "cash" && (
          <Field
            label="GCash reference"
            hint="Check receipt in your GCash transaction history first."
          >
            <input name="reference" required maxLength={100} />
          </Field>
        )}
      </div>
      <label className="check-card">
        <input
          type="checkbox"
          checked={credit}
          onChange={(e) => setCredit(e.target.checked)}
        />
        <span>
          <strong>Allow the remaining balance as utang</strong>
          <small>Only for a named customer you approve.</small>
        </span>
      </label>
      <Field label="Customer" hint="Optional for fully paid walk-in sales.">
        <select
          value={newCustomer ? "new" : customerId}
          onChange={(e) => {
            setNewCustomer(e.target.value === "new");
            if (e.target.value !== "new") setCustomerId(e.target.value);
          }}
          required={credit}
        >
          <option value="">Walk-in customer</option>
          {d.customers.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
          <option value="new">+ Add a new customer</option>
        </select>
      </Field>
      {newCustomer && (
        <div className="form-grid">
          <Field label="Customer name">
            <input name="customerName" required minLength={2} maxLength={80} />
          </Field>
          <Field label="Phone (optional)">
            <input name="phone" type="tel" maxLength={20} />
          </Field>
        </div>
      )}
      <div className="form-actions">
        <span className="muted">Saved only after a successful connection.</span>
        <Submit disabled={!total}>
          Save sale
          <Check size={17} />
        </Submit>
      </div>
    </form>
  );
}

function OrderDialog({ orderId }: { orderId: string }) {
  const {
    data: d,
    setModal,
    run,
    busy,
    setView,
    setChatId,
    shopMode,
  } = useShop();
  const [credit, setCredit] = useState(false);
  const o = d?.orders.find((x) => x.id === orderId);
  if (!o) return null;
  const owner = d?.role === "owner" && !shopMode;
  const due = o.total - o.paid;
  return (
    <Dialog
      title={"Order #" + o.id.slice(-6).toUpperCase()}
      subtitle={o.customer_name + " · " + niceDate(o.day)}
      wide
      onClose={() => setModal(null)}
    >
      <div className="order-detail-meta">
        <Badge tone={statusTone[o.status]}>{statusText[o.status]}</Badge>
        <Badge
          tone={o.paid >= o.total ? "green" : o.pending ? "blue" : "amber"}
        >
          {paymentLabel(o.total, o.paid, o.pending)}
        </Badge>
        <span>
          <Clock size={15} />
          {o.pickup_time} pickup
        </span>
      </div>
      <div className="detail-lines">
        {o.items.map((i) => (
          <div key={i.id}>
            <span>
              <strong>
                {i.quantity}× {i.name}
              </strong>
              <small>{i.serving}</small>
            </span>
            <strong>{money(i.price * i.quantity)}</strong>
          </div>
        ))}
      </div>
      <div className="summary-line">
        <span>Order total</span>
        <strong>{money(o.total)}</strong>
      </div>
      <div className="summary-line">
        <span>Verified payments</span>
        <strong>{money(o.paid)}</strong>
      </div>
      <div className="bill-total">
        <span>Remaining balance</span>
        <strong>{money(Math.max(0, due))}</strong>
      </div>
      {o.note && (
        <div className="info-box">
          <MessageCircle size={17} />
          <span>{o.note}</span>
        </div>
      )}
      {d?.payments
        .filter((p) => p.order_id === o.id)
        .map((p) => (
          <div className="payment-history" key={p.id}>
            <span>
              <strong>
                {p.method === "cash" ? "Cash" : "GCash"} · {money(p.amount)}
              </strong>
              <small>
                {p.reference || niceDate(p.day)}
                {p.note ? " · " + p.note : ""}
              </small>
            </span>
            <Badge
              tone={
                p.status === "verified"
                  ? "green"
                  : p.status === "pending"
                    ? "amber"
                    : "red"
              }
            >
              {p.status === "verified"
                ? "Received"
                : p.status === "pending"
                  ? "For review"
                  : "Needs correction"}
            </Badge>
            {p.file_id && (
              <a
                className="icon-button"
                aria-label="View payment image"
                target="_blank"
                rel="noreferrer"
                href={"/api/files/" + p.file_id}
              >
                <ExternalLink size={16} />
              </a>
            )}
          </div>
        ))}
      {owner && ["accepted", "ready"].includes(o.status) && due > 0 && (
        <label className="check-card">
          <input
            type="checkbox"
            checked={credit}
            disabled={!o.customer_id}
            onChange={(e) => setCredit(e.target.checked)}
          />
          <span>
            <strong>I-record ang {money(due)} bilang utang</strong>
            <small>
              Explicitly approve credit before handing over unpaid food.
            </small>
          </span>
        </label>
      )}
      <div className="detail-actions">
        {owner && (
          <>
            {o.status === "pending" && (
              <>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    run(
                      { action: "orderStatus", id: o.id, status: "accepted" },
                      "Order accepted. Portions reserved.",
                    )
                  }
                >
                  <Check size={16} />
                  Tanggapin
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    run(
                      { action: "orderStatus", id: o.id, status: "declined" },
                      "Order declined.",
                    )
                  }
                >
                  Decline
                </button>
              </>
            )}
            {o.status === "accepted" && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() =>
                  run(
                    { action: "orderStatus", id: o.id, status: "ready" },
                    "Ready for pickup!",
                  )
                }
              >
                Handa na
              </button>
            )}
            {["accepted", "ready"].includes(o.status) && (
              <button
                className="button primary"
                disabled={busy || (due > 0 && !credit)}
                onClick={() =>
                  run(
                    {
                      action: "orderStatus",
                      id: o.id,
                      status: "picked_up",
                      credit,
                    },
                    "Pickup recorded. Salamat po!",
                  )
                }
              >
                Na-pick up
                <Check size={17} />
              </button>
            )}
            {due > 0 &&
              ["accepted", "ready", "picked_up"].includes(o.status) && (
                <button
                  className="button secondary"
                  onClick={() =>
                    setModal({ kind: "payment", data: { order: o } })
                  }
                >
                  <Wallet size={16} />
                  Receive payment
                </button>
              )}
            {["pending", "accepted", "ready"].includes(o.status) && (
              <button
                className="button danger-text"
                onClick={() => setModal({ kind: "cancel", data: o })}
              >
                Cancel / no-show
              </button>
            )}
            {["cancelled", "no_show", "declined"].includes(o.status) &&
              o.paid > o.refunded && (
                <button
                  className="button secondary"
                  onClick={() => setModal({ kind: "refund", data: o })}
                >
                  Record refund sent
                </button>
              )}
          </>
        )}
        {!owner && (
          <>
            {o.status === "pending" && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  run(
                    { action: "orderStatus", id: o.id, status: "cancelled" },
                    "Request cancelled.",
                  )
                }
              >
                Cancel request
              </button>
            )}
            {["accepted", "ready", "picked_up"].includes(o.status) &&
              due > 0 && (
                <button
                  className="button primary"
                  onClick={() =>
                    setModal({ kind: "proof", data: { order: o } })
                  }
                >
                  Send GCash proof
                </button>
              )}
          </>
        )}
        <button
          className="button secondary"
          disabled={!o.customer_id}
          onClick={() => {
            setChatId(o.customer_id || "");
            setView("chat");
            setModal(null);
          }}
        >
          <MessageCircle size={16} />
          {owner ? "Chat with customer" : "Chat with Flor"}
        </button>
      </div>
    </Dialog>
  );
}

function PaymentForm({
  target,
  proof = false,
}: {
  target: any;
  proof?: boolean;
}) {
  const { run, setModal, notify } = useShop();
  const [paymentMethod, setMethod] = useState(proof ? "gcash" : "cash"),
    [file, setFile] = useState<File | null>(null),
    [sending, setSending] = useState(false);
  const requestId = useRef(crypto.randomUUID()),
    uploadedId = useRef<string | null>(null);
  const due = target.order
    ? target.order.total - target.order.paid
    : target.debt.amount - target.debt.paid;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    const f = formData(e);
    setSending(true);
    try {
      if (file && !uploadedId.current) {
        const body = new FormData();
        body.set("file", file);
        if (target.order?.customer_id)
          body.set("customerId", target.order.customer_id);
        const r = await fetch("/api/upload", { method: "POST", body });
        const j = (await r.json()) as { id: string; error: string };
        if (!r.ok) throw new Error(j.error);
        uploadedId.current = j.id;
      }
      const r = await run(
        {
          action: "payment",
          requestId: requestId.current,
          orderId: target.order?.id,
          debtId: target.debt?.id,
          asProof: proof,
          amount: pesos(f, "amount"),
          method: paymentMethod,
          reference: String(f.get("reference") || ""),
          fileId: uploadedId.current,
          note: String(f.get("note") || ""),
        },
        proof
          ? "Payment proof sent. Waiting for Flor to verify."
          : "Payment received and balance updated.",
      );
      if (r) setModal(null);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Not sent. Please try again.");
    } finally {
      setSending(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <div className="balance-callout">
        <span>Remaining balance</span>
        <strong>{money(due)}</strong>
      </div>
      <Field label="Amount">
        <PesoInput
          name="amount"
          min={0.01}
          max={due / 100}
          defaultValue={due / 100}
        />
      </Field>
      {!proof && (
        <Field label="Payment method">
          <select
            value={paymentMethod}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="gcash">GCash — verified received</option>
          </select>
        </Field>
      )}
      {paymentMethod === "gcash" && (
        <Field label="GCash reference number">
          <input name="reference" required maxLength={100} />
        </Field>
      )}
      {proof && (
        <Field label="Screenshot" hint="JPG, PNG, or WebP, up to 5 MB.">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              uploadedId.current = null;
            }}
          />
        </Field>
      )}
      <Field label="Note (optional)">
        <textarea name="note" rows={2} maxLength={500} />
      </Field>
      <div className="info-box">
        <AlertCircle size={18} />
        <span>
          {proof
            ? "Sending a screenshot does not mark the order paid. Flor will confirm receipt."
            : "Confirm GCash against your own transaction history before saving."}
        </span>
      </div>
      <div className="form-actions">
        <Submit disabled={sending}>
          {sending
            ? "Uploading…"
            : proof
              ? "Send payment proof"
              : "Confirm received"}
        </Submit>
      </div>
    </form>
  );
}
function MoneyForm({ kind = "expense" }: { kind?: string }) {
  const { data: d, run, setModal, day } = useShop();
  const requestId = useRef(crypto.randomUUID());
  const [entryKind, setKind] = useState(kind);
  return (
    <form
      onSubmit={async (e) => {
        const f = formData(e);
        const r = await run(
          {
            action: "money",
            requestId: requestId.current,
            kind: entryKind,
            category: String(f.get("category")),
            amount: pesos(f, "amount"),
            method: String(f.get("method")),
            day: String(f.get("day")),
            note: String(f.get("note") || ""),
          },
          "Money entry saved.",
        );
        if (r) setModal(null);
      }}
    >
      <Field label="What are you recording?">
        <select value={entryKind} onChange={(e) => setKind(e.target.value)}>
          <option value="expense">Gastos — business spending</option>
          <option value="capital">Dagdag puhunan — money added by Flor</option>
          <option value="withdrawal">Withdrawal — money taken out</option>
        </select>
      </Field>
      <div className="form-grid">
        <Field label="Amount">
          <PesoInput name="amount" min={0.01} />
        </Field>
        <Field label="Date">
          <input
            type="date"
            name="day"
            required
            defaultValue={day > d!.today ? d!.today : day}
            max={d!.today}
          />
        </Field>
      </div>
      <Field label="Category">
        <input
          name="category"
          required
          maxLength={80}
          placeholder={
            entryKind === "expense"
              ? "e.g. Ingredients, packaging, gas"
              : "e.g. Extra cooking funds"
          }
          list="expense-categories"
        />
        <datalist id="expense-categories">
          {[
            "Ingredients",
            "Packaging",
            "Gas & electricity",
            "Transport",
            "Dagdag puhunan",
            "Personal withdrawal",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </datalist>
      </Field>
      <Field label="Paid from / received into">
        <select name="method">
          <option value="cash">Cash</option>
          <option value="gcash">GCash</option>
        </select>
      </Field>
      <Field label="Note (optional)">
        <textarea name="note" rows={2} maxLength={500} />
      </Field>
      <div className="form-actions">
        <Submit>Save entry</Submit>
      </div>
    </form>
  );
}
function MenuItemForm({ item }: { item: any }) {
  const { run, setModal } = useShop();
  return (
    <form
      onSubmit={async (e) => {
        const f = formData(e);
        const r = await run(
          {
            action: "menuItem",
            id: item.id,
            capacity: Number(f.get("capacity")),
            price: pesos(f, "price"),
            enabled: f.get("enabled") === "on",
            waste: Number(f.get("waste")),
          },
          "Menu updated. Existing order prices are unchanged.",
        );
        if (r) setModal(null);
      }}
    >
      <div className="dish-form-preview">
        <FoodImage image={item.image} name={item.name} />
        <div>
          <h3>{item.name}</h3>
          <p>
            {niceDate(item.day)} · {item.serving}
          </p>
        </div>
      </div>
      <div className="form-grid">
        <Field
          label="Total portions"
          hint={`${item.reserved} reserved · ${item.sold} served`}
        >
          <input
            name="capacity"
            type="number"
            required
            min={item.reserved + item.sold + item.waste}
            max={10000}
            defaultValue={item.capacity}
          />
        </Field>
        <Field label="Price per serving">
          <PesoInput name="price" min={0.01} defaultValue={item.price / 100} />
        </Field>
      </div>
      <Field
        label="Unavailable / wasted portions"
        hint="Included within your total portions."
      >
        <input
          name="waste"
          type="number"
          min={0}
          max={item.capacity - item.sold - item.reserved}
          defaultValue={item.waste}
          required
        />
      </Field>
      <label className="check-card">
        <input name="enabled" type="checkbox" defaultChecked={!!item.enabled} />
        <span>
          <strong>Offer this dish</strong>
          <small>Customers can request it when this menu is published.</small>
        </span>
      </label>
      <div className="form-actions">
        <Submit>Save changes</Submit>
      </div>
    </form>
  );
}
function FoodForm({ food }: { food?: any }) {
  const { run, setModal, day, notify } = useShop();
  const [file, setFile] = useState<File | null>(null),
    [sending, setSending] = useState(false);
  const uploaded = useRef<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        const f = formData(e);
        setSending(true);
        try {
          let image = food?.image || "";
          if (file) {
            if (!uploaded.current) {
              const body = new FormData();
              body.set("file", file);
              body.set("purpose", "food");
              const r = await fetch("/api/upload", { method: "POST", body });
              const j = (await r.json()) as { url: string; error: string };
              if (!r.ok) throw new Error(j.error);
              uploaded.current = j.url;
            }
            image = uploaded.current;
          }
          const r = await run(
            {
              action: "food",
              id: food?.id,
              name: String(f.get("name")),
              description: String(f.get("description")),
              serving: String(f.get("serving")),
              category: String(f.get("category")),
              price: pesos(f, "price"),
              image,
              day: food ? undefined : day,
            },
            food
              ? "Food catalog updated. Existing order prices stay unchanged."
              : "Dish added to your food list and this menu.",
          );
          if (r) setModal(null);
        } catch (e) {
          notify(e instanceof Error ? e.message : "Could not upload image.");
        } finally {
          setSending(false);
        }
      }}
    >
      <Field label="Dish name">
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={food?.name}
          placeholder="e.g. Ginataang Kalabasa"
        />
      </Field>
      <div className="form-grid">
        <Field label="Category">
          <select name="category" defaultValue={food?.category || "Ulam"}>
            {["Ulam", "Gulay", "Rice & sides", "Merienda"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="Default price">
          <PesoInput
            name="price"
            min={0.01}
            defaultValue={food?.price ? food.price / 100 : undefined}
          />
        </Field>
      </div>
      <Field label="Serving description">
        <input
          name="serving"
          required
          maxLength={60}
          defaultValue={food?.serving || "1 serving"}
        />
      </Field>
      <Field label="Short description (optional)">
        <textarea
          name="description"
          rows={3}
          maxLength={250}
          defaultValue={food?.description}
        />
      </Field>
      <Field
        label="Food photo (optional)"
        hint="Publicly visible food photo. Keep payment screenshots in private chat. JPG, PNG, or WebP up to 5 MB."
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            uploaded.current = null;
          }}
        />
      </Field>
      <p className="gentle-note">
        {food
          ? "Default changes apply when this dish is added to future menus. Adjust dated menu prices separately."
          : `Added as 20 draft portions for ${niceDate(day)}. Adjust before publishing.`}
      </p>
      <div className="form-actions">
        <Submit disabled={sending}>
          {sending ? "Uploading…" : food ? "Save dish" : "Add dish"}
        </Submit>
      </div>
    </form>
  );
}

function Catalog() {
  const { data: d, setModal, run, busy } = useShop();
  return (
    <>
      <p className="muted">
        Your reusable dishes. Archiving hides a dish from future menu copies and
        keeps its history.
      </p>
      {d?.foods.map((f) => (
        <div className="catalog-row" key={f.id}>
          <FoodImage name={f.name} image={f.image} />
          <div>
            <strong>
              {f.name}
              {f.archived ? " · Archived" : ""}
            </strong>
            <small>
              {money(f.price)} · {f.serving}
            </small>
          </div>
          <button
            className="button secondary small"
            onClick={() => setModal({ kind: "food", data: f })}
          >
            Edit
          </button>
          <button
            className="button secondary small"
            disabled={busy}
            onClick={() =>
              run(
                { action: "archiveFood", id: f.id, archived: !f.archived },
                f.archived
                  ? "Dish restored."
                  : "Dish archived. Existing orders stay safe.",
              )
            }
          >
            {f.archived ? "Restore" : "Archive"}
          </button>
        </div>
      ))}
    </>
  );
}
function CustomerForm() {
  const { run, setModal } = useShop();
  return (
    <form
      onSubmit={async (e) => {
        const f = formData(e);
        const r = await run(
          {
            action: "customer",
            name: String(f.get("name")),
            phone: String(f.get("phone") || ""),
          },
          "Customer added.",
        );
        if (r) setModal(null);
      }}
    >
      <Field label="Customer name">
        <input name="name" required minLength={2} maxLength={80} />
      </Field>
      <Field label="Phone (optional)">
        <input type="tel" name="phone" maxLength={20} />
      </Field>
      <div className="form-actions">
        <Submit>Save customer</Submit>
      </div>
    </form>
  );
}
function DebtForm({ customerId }: { customerId?: string }) {
  const { data: d, run, setModal } = useShop();
  const requestId = useRef(crypto.randomUUID());
  return (
    <form
      onSubmit={async (e) => {
        const f = formData(e);
        const r = await run(
          {
            action: "openingDebt",
            requestId: requestId.current,
            customerId: String(f.get("customerId")),
            amount: pesos(f, "amount"),
            day: String(f.get("day")),
            note: String(f.get("note")),
          },
          "Opening utang recorded. This is not counted as a new sale.",
        );
        if (r) setModal(null);
      }}
    >
      <Field label="Customer">
        <select name="customerId" required defaultValue={customerId || ""}>
          <option value="" disabled>
            Choose a customer
          </option>
          {d?.customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="form-grid">
        <Field label="Remaining amount">
          <PesoInput name="amount" min={0.01} />
        </Field>
        <Field label="Balance as of">
          <input
            type="date"
            name="day"
            required
            defaultValue={d?.today}
            max={d?.today}
          />
        </Field>
      </div>
      <Field label="Where did this balance come from?">
        <textarea
          name="note"
          required
          rows={2}
          maxLength={500}
          defaultValue="Opening balance from paper notebook"
        />
      </Field>
      <div className="info-box">
        <BookOpen size={18} />
        <span>
          New unpaid food should be recorded through a sale. Use this form for
          balances that existed before using the app.
        </span>
      </div>
      <div className="form-actions">
        <Submit>Record opening balance</Submit>
      </div>
    </form>
  );
}
function Ledger({ customer }: { customer: Customer }) {
  const { data: d, setModal } = useShop();
  const c = d?.customers.find((x) => x.id === customer.id) || customer;
  const charges = [
    ...(d?.debts
      .filter((x) => x.customer_id === c.id)
      .map((x) => ({
        id: x.id,
        day: x.day,
        total: x.amount,
        paid: x.paid,
        label: x.note,
        debt: x,
      })) || []),
    ...(d?.orders
      .filter(
        (x) => x.customer_id === c.id && x.credit && x.status === "picked_up",
      )
      .map((x) => ({
        id: x.id,
        day: x.day,
        total: x.total,
        paid: x.paid,
        label: "Food order #" + x.id.slice(-6).toUpperCase(),
        order: x,
      })) || []),
  ].sort((a, b) => b.day.localeCompare(a.day));
  return (
    <>
      <div className="balance-callout">
        <span>Remaining utang</span>
        <strong>{money(c.balance)}</strong>
      </div>
      {charges.map((x: any) => (
        <div className="ledger-charge" key={x.id}>
          <div>
            <strong>{x.label}</strong>
            <small>
              {niceDate(x.day)} · Charged {money(x.total)} · Paid{" "}
              {money(x.paid)}
            </small>
          </div>
          <strong>{money(x.total - x.paid)}</strong>
          {x.total > x.paid && (
            <button
              className="button secondary small"
              onClick={() =>
                setModal({
                  kind: "payment",
                  data: x.order ? { order: x.order } : { debt: x.debt },
                })
              }
            >
              Receive payment
            </button>
          )}
        </div>
      ))}
      {!charges.length && (
        <Empty
          icon={BookOpen}
          title="No charges recorded"
          description="This customer’s old balances and unpaid collected orders will appear here."
        />
      )}
      <h3 className="section-subtitle">Repayment history</h3>
      {d?.payments
        .filter(
          (p) =>
            p.status === "verified" &&
            charges.some((x) => x.id === p.order_id || x.id === p.debt_id),
        )
        .map((p) => (
          <div className="summary-line" key={p.id}>
            <span>
              {niceDate(p.day)} · {p.method === "cash" ? "Cash" : "GCash"}
            </span>
            <strong>{money(p.amount)}</strong>
          </div>
        ))}
      <div className="form-actions">
        <button
          className="button secondary"
          onClick={() => setModal({ kind: "debt", data: { customerId: c.id } })}
        >
          Record an old balance
        </button>
      </div>
    </>
  );
}
function CloseForm() {
  const { data: d, day, run, setModal } = useShop();
  return (
    <form
      onSubmit={async (e) => {
        const f = formData(e);
        const r = await run(
          {
            action: "closeDay",
            day,
            openingCash: pesos(f, "opening"),
            actualCash: pesos(f, "actual"),
            note: String(f.get("note") || ""),
          },
          "Day closed. Your cash count is saved.",
        );
        if (r) setModal(null);
      }}
    >
      <p className="muted">
        For {niceDate(day)}. All pending and uncollected orders must be resolved
        first.
      </p>
      <Field
        label="Cash in the drawer at the start"
        hint="Opening float only. Money added later belongs in Dagdag puhunan."
      >
        <PesoInput name="opening" defaultValue={0} />
      </Field>
      <Field label="Cash you counted now">
        <PesoInput name="actual" defaultValue={0} />
      </Field>
      <Field label="Note (optional)">
        <textarea name="note" rows={2} maxLength={500} />
      </Field>
      <div className="info-box">
        <Wallet size={18} />
        <span>
          Expected cash is calculated from the opening float, cash payments,
          spending, contributions, withdrawals, transfers, and refunds. GCash is
          excluded.
        </span>
      </div>
      <div className="form-actions">
        <Submit>Save cash count & close</Submit>
      </div>
    </form>
  );
}
function ReopenForm() {
  const { day, run, setModal } = useShop();
  return (
    <form
      onSubmit={async (e) => {
        const f = formData(e);
        const r = await run(
          { action: "reopenDay", day, reason: String(f.get("reason")) },
          "Day reopened. Changes will be recorded in the audit trail.",
        );
        if (r) setModal(null);
      }}
    >
      <Field label="Reason for reopening">
        <textarea
          name="reason"
          required
          minLength={5}
          maxLength={500}
          rows={3}
        />
      </Field>
      <div className="form-actions">
        <Submit>Reopen day</Submit>
      </div>
    </form>
  );
}
function RefundForm({ order }: { order: Order }) {
  const { run, setModal } = useShop();
  const requestId = useRef(crypto.randomUUID());
  return (
    <form
      onSubmit={async (e) => {
        const f = formData(e);
        const r = await run(
          {
            action: "refund",
            requestId: requestId.current,
            orderId: order.id,
            amount: pesos(f, "amount"),
            method: String(f.get("method")),
            reference: String(f.get("reference") || ""),
          },
          "Refund recorded.",
        );
        if (r) setModal(null);
      }}
    >
      <div className="balance-callout">
        <span>Refund still owed</span>
        <strong>{money(order.paid - order.refunded)}</strong>
      </div>
      <Field label="Amount returned">
        <PesoInput
          name="amount"
          min={0.01}
          max={(order.paid - order.refunded) / 100}
          defaultValue={(order.paid - order.refunded) / 100}
        />
      </Field>
      <Field label="Refund method">
        <select name="method">
          <option value="cash">Cash</option>
          <option value="gcash">GCash</option>
        </select>
      </Field>
      <Field label="Transaction reference (required for GCash)">
        <input name="reference" maxLength={100} />
      </Field>
      <div className="info-box">
        <AlertCircle size={18} />
        <span>
          This records a refund you already sent. The app does not move money.
        </span>
      </div>
      <div className="form-actions">
        <Submit>Confirm refund sent</Submit>
      </div>
    </form>
  );
}
function CancelForm({ order }: { order: Order }) {
  const { run, setModal } = useShop();
  return (
    <form
      onSubmit={async (e) => {
        const f = formData(e);
        const r = await run(
          {
            action: "orderStatus",
            id: order.id,
            status: String(f.get("status")),
            restock: f.get("restock") === "on",
            note: String(f.get("note") || order.note),
          },
          "Order updated. Check Payment review if a refund is owed.",
        );
        if (r) setModal(null);
      }}
    >
      <Field label="Reason">
        <select name="status">
          <option value="cancelled">Cancelled order</option>
          {order.status !== "pending" && (
            <option value="no_show">Customer did not arrive</option>
          )}
        </select>
      </Field>
      {order.status !== "pending" && (
        <label className="check-card">
          <input name="restock" type="checkbox" />
          <span>
            <strong>Return portions to available stock</strong>
            <small>
              Choose only if the food is still available to sell. Otherwise the
              portions are marked unavailable.
            </small>
          </span>
        </label>
      )}
      <Field label="Note">
        <textarea
          name="note"
          rows={2}
          maxLength={500}
          defaultValue={order.note}
        />
      </Field>
      {order.paid > 0 && (
        <p className="muted">
          There is a verified payment of {money(order.paid)}. Any refund must be
          sent and recorded separately.
        </p>
      )}
      <div className="form-actions">
        <Submit>Confirm update</Submit>
      </div>
    </form>
  );
}
function ProfileForm() {
  const { data: d, run, setModal } = useShop();
  return (
    <form
      onSubmit={async (e) => {
        const f = formData(e);
        const r = await run(
          {
            action: "profile",
            name: String(f.get("name")),
            phone: String(f.get("phone")),
          },
          "Your pickup details are saved.",
        );
        if (r) setModal(null);
      }}
    >
      <Field label="Your name">
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={d?.user?.name?.includes("@") ? "" : d?.user?.name}
        />
      </Field>
      <Field label="Contact number">
        <input
          name="phone"
          type="tel"
          required
          minLength={7}
          maxLength={20}
          placeholder="09xx xxx xxxx"
        />
      </Field>
      <div className="form-actions">
        <Submit>Save pickup details</Submit>
      </div>
    </form>
  );
}
function ResetForm() {
  const { run, setModal } = useShop();
  return (
    <form
      onSubmit={async (e) => {
        const f = formData(e);
        const r = await run(
          { action: "resetDemo", confirmation: String(f.get("confirmation")) },
          "Your real shop is ready for a fresh start.",
        );
        if (r) setModal(null);
      }}
    >
      <p>
        Sample orders, customers, payments, utang, and menus will be cleared.
        The starter food catalog stays so you can edit it for Flor.
      </p>
      <Field label="Type START FRESH to continue">
        <input
          name="confirmation"
          pattern="START FRESH"
          required
          autoComplete="off"
        />
      </Field>
      <div className="form-actions">
        <Submit>Clear sample records</Submit>
      </div>
    </form>
  );
}
