"use client";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Utensils,
  ShoppingBag,
  Wallet,
  MessageCircle,
  Settings,
  Plus,
  ArrowUpRight,
  Leaf,
  Bell,
  ChevronDown,
  CalendarDays,
  LoaderCircle,
  RefreshCw,
  CheckCircle2,
  Store,
  Heart,
  ArrowRight,
  WifiOff,
  Sun,
} from "lucide-react";
import { ShopProvider, useShop, type View } from "@/components/shop-context";
import { Overview } from "@/components/overview";
import { MenuView } from "@/components/menu";
import { OrdersView } from "@/components/orders";
import { MoneyView } from "@/components/money";
import { ChatView } from "@/components/chat";
import { SettingsView } from "@/components/settings";
import { CustomerView } from "@/components/customer";
import { Dialogs } from "@/components/dialogs";
import { niceDate } from "@/lib/domain";
import { Avatar } from "@/components/ui";
export default function Kainan() {
  return (
    <ShopProvider>
      <App />
    </ShopProvider>
  );
}
const nav: { id: View; label: string; short: string; icon: any }[] = [
  { id: "home", label: "Overview", short: "Home", icon: LayoutDashboard },
  { id: "menu", label: "Tinda & menu", short: "Tinda", icon: Utensils },
  { id: "orders", label: "Orders", short: "Orders", icon: ShoppingBag },
  { id: "money", label: "Pera & utang", short: "Pera", icon: Wallet },
  { id: "chat", label: "Messages", short: "Chat", icon: MessageCircle },
];
function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Utensils size={23} strokeWidth={1.6} />
      </span>
      <span>
        <strong>
          Flor’s
          <span className="brand-leaf">
            <Leaf size={17} />
          </span>
        </strong>
        <small>KAINAN</small>
      </span>
    </div>
  );
}
function App() {
  const {
    data: d,
    day,
    setDay,
    view,
    setView,
    shopMode,
    setShopMode,
    error,
    loading,
    refresh,
    setModal,
  } = useShop();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (loading && !d)
    return (
      <div className="app-loading">
        <Logo />
        <LoaderCircle className="spin" />
        <p>Getting your kitchen ready…</p>
      </div>
    );
  if (!d)
    return (
      <div className="app-loading">
        <Logo />
        <h2>Let’s reconnect.</h2>
        <p>{error}</p>
        <button className="button primary" onClick={() => refresh()}>
          <RefreshCw size={17} />
          Try again
        </button>
      </div>
    );
  if (!d.settings)
    return (
      <>
        <Onboarding />
        <Toast />
      </>
    );
  const owner = d.role === "owner" && !shopMode;
  const unread = d.messages.filter(
    (m) => m.sender === (owner ? "customer" : "owner") && !m.read_at,
  ).length;
  const pending = d.orders.filter(
    (o) => o.status === "pending" && o.day === day,
  ).length;
  return (
    <div className={"app-shell " + (!owner ? "shop-shell" : "")}>
      {owner && (
        <aside className="sidebar">
          <a
            className="brand-link"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setView("home");
            }}
          >
            <Logo />
          </a>
          <div className="workspace-label">YOUR DAILY KITCHEN</div>
          <nav aria-label="Main navigation">
            {nav.map((n) => (
              <button
                key={n.id}
                className={view === n.id ? "active" : ""}
                onClick={() => setView(n.id)}
              >
                <n.icon size={19} />
                {n.label}
                {n.id === "orders" && pending > 0 && (
                  <span className="nav-count">{pending}</span>
                )}
                {n.id === "chat" && unread > 0 && <span className="nav-dot" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-note">
            <span className="note-sun">
              <Sun size={25} strokeWidth={1.4} />
            </span>
            <strong>
              Good food.
              <br />A good day.
            </strong>
            <p>
              You take care of the cooking.
              <br />
              We’ll help with the rest.
            </p>
          </div>
          <div className="sidebar-bottom">
            <button
              className={view === "settings" ? "active" : ""}
              onClick={() => setView("settings")}
            >
              <Settings size={18} />
              Shop settings
            </button>
            <button
              onClick={() => {
                setShopMode(true);
                setView("menu");
              }}
            >
              <Store size={18} />
              View customer shop
              <ArrowUpRight size={15} />
            </button>
            <div className="owner-profile">
              <Avatar name="Flor" />
              <div>
                <strong>Flor’s kitchen</strong>
                <small>Owner workspace</small>
              </div>
              <span className="online-dot" />
            </div>
          </div>
        </aside>
      )}
      <div className="main-shell">
        <header className="topbar">
          {owner ? (
            <div className="breadcrumb">
              Flor’s Kainan<span>/</span>
              <strong>
                {view === "settings"
                  ? "Shop settings"
                  : nav.find((n) => n.id === view)?.label}
              </strong>
            </div>
          ) : (
            <Logo />
          )}
          {owner ? (
            <div className="topbar-actions">
              <label className="date-picker">
                <CalendarDays size={16} />
                <span>{niceDate(day)}</span>
                <input
                  type="date"
                  aria-label="Choose selling date"
                  value={day}
                  onChange={(e) => e.target.value && setDay(e.target.value)}
                />
                <ChevronDown size={14} />
              </label>
              <button
                className="notification-button icon-button"
                aria-label="Review new orders and messages"
                onClick={() => setView(unread ? "chat" : "orders")}
              >
                <Bell size={20} />
                {(unread > 0 || pending > 0) && <span />}
              </button>
              <button
                className="topbar-avatar"
                aria-label="Open shop settings"
                onClick={() => setView("settings")}
              >
                F
              </button>
            </div>
          ) : (
            <div className="shop-nav">
              {[
                ["menu", "Our menu"],
                ["orders", "My orders"],
                ["chat", "Chat with Flor"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={view === id ? "active" : ""}
                  onClick={() => setView(id as View)}
                >
                  {label}
                </button>
              ))}
              {d.role === "owner" && (
                <button
                  className="button secondary small"
                  onClick={() => {
                    setShopMode(false);
                    setView("home");
                  }}
                >
                  Back to kitchen
                  <ArrowUpRight size={15} />
                </button>
              )}
              {!d.user && (
                <a className="button primary small" href="/login" target="_top">
                  Sign in
                </a>
              )}
            </div>
          )}
        </header>
        {(offline || error) && (
          <div className="connection-banner" role="alert">
            <WifiOff size={17} />
            {offline
              ? "You’re offline. Changes cannot be saved until you reconnect."
              : error}
            <button onClick={() => refresh()}>Retry</button>
          </div>
        )}
        {d.settings.demo === 1 && (
          <div className="demo-banner">
            <span>
              <Leaf size={14} />
              <strong>Sample shop</strong> · Fictional records for exploring the
              app.
            </span>
            {owner && (
              <button onClick={() => setModal({ kind: "reset" })}>
                Start fresh
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        )}
        {owner && !d.settings.configured && view !== "settings" && (
          <div className="setup-banner">
            <span>
              Before real orders: review your pickup hours, location, and GCash
              details.
            </span>
            <button onClick={() => setView("settings")}>
              Set up shop
              <ArrowRight size={14} />
            </button>
          </div>
        )}
        <main
          id="main-content"
          className={"main-content " + (!owner ? "customer-content" : "")}
        >
          {d.day !== day ? (
            <div className="inline-loading">
              <LoaderCircle className="spin" size={24} />
              <p>Loading this day’s kitchen…</p>
            </div>
          ) : owner ? (
            view === "home" ? (
              <Overview />
            ) : view === "menu" ? (
              <MenuView />
            ) : view === "orders" ? (
              <OrdersView />
            ) : view === "money" ? (
              <MoneyView />
            ) : view === "chat" ? (
              <ChatView />
            ) : (
              <SettingsView />
            )
          ) : (
            <CustomerView />
          )}
        </main>
        {!owner && (
          <footer className="customer-footer">
            <Logo />
            <p>
              Lutong bahay. Alagang Flor.
              <br />
              Pickup in {d.settings.location}.
            </p>
            <span>
              Made with <Heart size={13} /> for everyday meals.
            </span>
          </footer>
        )}
      </div>
      {owner && (
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              onClick={() => setView(n.id)}
            >
              <n.icon size={21} />
              <span>{n.short}</span>
              {n.id === "orders" && pending > 0 && <i>{pending}</i>}
            </button>
          ))}
        </nav>
      )}
      <Dialogs />
      <Toast />
    </div>
  );
}
function Toast() {
  const { toast } = useShop();
  return toast ? (
    <div role="status" aria-live="polite" className="toast">
      <CheckCircle2 size={18} />
      {toast}
    </div>
  ) : null;
}
function Onboarding() {
  const { data: d, run, busy } = useShop();
  return (
    <div className="onboarding">
      <div className="onboarding-brand">
        <Logo />
      </div>
      <div className="onboarding-main">
        <div className="onboarding-copy">
          <span className="eyebrow">
            <Leaf size={15} />A LITTLE LESS PAPERWORK. A LITTLE MORE COOKING.
          </span>
          <h1>
            Your everyday kitchen,
            <br />
            <em>taken care of.</em>
          </h1>
          <p>
            Menus, orders, benta, and utang.
            <br />
            One comfortable place for Flor to start her day.
          </p>
          <div className="onboarding-features">
            <span>
              <CheckCircle2 size={18} />
              Simple daily menus
            </span>
            <span>
              <CheckCircle2 size={18} />
              Every peso remembered
            </span>
            <span>
              <CheckCircle2 size={18} />
              Made for Flor’s phone
            </span>
          </div>
        </div>
        <section className="onboarding-card">
          <div className="welcome-illustration">
            <div
              className="onboarding-food"
              role="img"
              aria-label="Illustrative home-cooked Filipino food"
            />
          </div>
          <div className="onboarding-card-body">
            <span className="eyebrow">TULOY PO KAYO</span>
            <h2>Welcome to Flor’s Kainan.</h2>
            <p>
              Start your kitchen with a clean ledger, or take a look around with
              fictional sample orders.
            </p>
            {d?.canSetup ? (
              <>
                <button
                  className="button primary full-width"
                  disabled={busy}
                  onClick={() =>
                    run(
                      { action: "setup", demo: false },
                      "Welcome, Flor! Your kitchen is ready.",
                    )
                  }
                >
                  <Plus size={18} />
                  Start my real shop
                </button>
                <button
                  className="button secondary full-width"
                  disabled={busy}
                  onClick={() =>
                    run(
                      { action: "setup", demo: true },
                      "Sample shop ready. All sample records are fictional.",
                    )
                  }
                >
                  Explore the sample shop
                  <ArrowRight size={17} />
                </button>
                <small>
                  Suggested dishes stay in your catalog until you choose to
                  publish a menu.
                </small>
              </>
            ) : d?.user ? (
              <p>Flor is preparing this kitchen. Please come back soon.</p>
            ) : (
              <a
                className="button primary full-width"
                href="/login"
                target="_top"
              >
                Sign in to open your kitchen
                <ArrowRight size={18} />
              </a>
            )}
          </div>
        </section>
      </div>
      <footer>
        Flor’s Kainan <span>·</span> Lutong bahay, alagang Flor.
      </footer>
    </div>
  );
}
