"use client";
import { Download, ShieldCheck, Smartphone, LogOut } from "lucide-react";
import { useShop } from "./shop-context";
import { Field, Submit, formData, Panel } from "./ui";
export function SettingsView() {
  const { data: d, run, setModal, setShopMode, setView } = useShop();
  if (!d?.settings) return null;
  const s = d.settings;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SET IT UP, THEN KEEP IT SIMPLE</div>
          <h1>Shop settings</h1>
          <p>The details that keep each selling day running smoothly.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => {
            setShopMode(true);
            setView("menu");
          }}
        >
          View customer shop
        </button>
      </div>
      <div className="settings-grid">
        <Panel
          title="Your kitchen"
          subtitle="These details are visible to customers."
        >
          <form
            onSubmit={async (e) => {
              const f = formData(e);
              await run(
                {
                  action: "settings",
                  shopName: String(f.get("shopName")),
                  location: String(f.get("location")),
                  pickupStart: String(f.get("pickupStart")),
                  pickupEnd: String(f.get("pickupEnd")),
                  cutoff: String(f.get("cutoff")),
                  gcashName: String(f.get("gcashName")),
                  gcashNumber: String(f.get("gcashNumber")),
                  notice: String(f.get("notice")),
                },
                "Shop details updated.",
              );
            }}
          >
            <Field label="Shop name">
              <input
                name="shopName"
                required
                maxLength={80}
                defaultValue={s.shop_name}
              />
            </Field>
            <Field
              label="Pickup location"
              hint="Add a landmark or exact instructions before taking real orders."
            >
              <input
                name="location"
                required
                maxLength={250}
                defaultValue={s.location}
              />
            </Field>
            <div className="form-grid">
              <Field label="Pickup starts">
                <input
                  type="time"
                  name="pickupStart"
                  required
                  defaultValue={s.pickup_start}
                />
              </Field>
              <Field label="Pickup ends">
                <input
                  type="time"
                  name="pickupEnd"
                  required
                  defaultValue={s.pickup_end}
                />
              </Field>
            </div>
            <Field
              label="Tomorrow’s preorder cutoff"
              hint="Philippine time. Today’s requests close when pickup hours end."
            >
              <input
                type="time"
                name="cutoff"
                required
                defaultValue={s.cutoff}
              />
            </Field>
            <div className="form-grid">
              <Field label="GCash recipient name">
                <input
                  name="gcashName"
                  maxLength={80}
                  defaultValue={s.gcash_name}
                />
              </Field>
              <Field label="GCash number">
                <input
                  name="gcashNumber"
                  type="tel"
                  maxLength={20}
                  defaultValue={s.gcash_number}
                />
              </Field>
            </div>
            <Field label="Customer notice / cancellation instructions">
              <textarea
                rows={3}
                name="notice"
                maxLength={500}
                defaultValue={s.notice}
              />
            </Field>
            <div className="form-actions">
              <Submit>Save shop settings</Submit>
            </div>
          </form>
        </Panel>
        <div className="settings-side">
          <Panel title="Your records belong to you">
            <p className="muted">
              Download a complete data snapshot or a readable audit trail. Image
              metadata is included; image files remain in private storage.
            </p>
            <a
              className="button secondary full-width"
              href="/api/export?type=backup"
            >
              <Download size={17} />
              Download data backup
            </a>
            <a
              className="button secondary full-width"
              href="/api/export?type=audit"
            >
              <ShieldCheck size={17} />
              Export audit trail
            </a>
          </Panel>
          <Panel title="On Flor’s phone">
            <div className="install-icon">
              <Smartphone size={29} />
            </div>
            <p className="muted">
              Open the app in Chrome on Android, then choose{" "}
              <strong>Add to Home screen</strong> from the browser menu.
            </p>
            <p className="muted">
              An internet connection is needed to save orders, stock, and
              payments.
            </p>
          </Panel>
          {s.demo === 1 && (
            <Panel title="Ready for real selling?">
              <p className="muted">
                You’re using fictional sample records. Clear them before
                recording real business.
              </p>
              <button
                className="button secondary full-width"
                onClick={() => setModal({ kind: "reset" })}
              >
                Start fresh with Flor
              </button>
            </Panel>
          )}
          <a
            href="/signout-with-chatgpt?return_to=/"
            target="_top"
            className="button secondary full-width"
          >
            <LogOut size={17} />
            Sign out
          </a>
        </div>
      </div>
    </>
  );
}
