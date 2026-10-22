"use client";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { manilaDay, shiftDay } from "@/lib/domain";
import type { Snapshot, Message, Customer } from "@/lib/types";
import { browserClient } from "@/lib/supabase/browser";
import { mergeChatMessage } from "@/lib/chat-state";
export type View = "home" | "menu" | "orders" | "money" | "chat" | "settings";
export type Modal = { kind: string; data?: any } | null;
type ShopContextValue = {
  data: Snapshot | null;
  day: string;
  setDay: (d: string) => void;
  view: View;
  setView: (v: View) => void;
  shopMode: boolean;
  setShopMode: (v: boolean) => void;
  range: string;
  orderDate: string;
  setOrderDate: (day: string) => void;
  setRange: (r: string) => void;
  busy: boolean;
  loading: boolean;
  error: string;
  toast: string;
  notify: (s: string) => void;
  refresh: () => Promise<void>;
  run: (payload: Record<string, unknown>, success?: string) => Promise<any>;
  modal: Modal;
  setModal: (m: Modal) => void;
  chatId: string;
  setChatId: (s: string) => void;
  chatConnection: "connecting" | "live" | "reconnecting";
};
const Context = createContext<ShopContextValue | null>(null);
export function useShop() {
  const c = useContext(Context);
  if (!c) throw new Error("Missing shop context");
  return c;
}
export function ShopProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Snapshot | null>(null),
    [day, setDay] = useState(manilaDay),
    [view, setView] = useState<View>("home"),
    [shopMode, setShopMode] = useState(false),
    [range, setRange] = useState("day"),
    [orderDate, setOrderDate] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState<Modal>(null),
    [chatId, setChatId] = useState("");
  const currentRefresh = useRef<() => Promise<void>>(async () => {});
  const lastNotificationAck = useRef("");
  const previousToday = useRef(manilaDay());
  useEffect(() => {
    if (!data?.today || data.today === previousToday.current) return;
    const oldToday = previousToday.current;
    previousToday.current = data.today;
    setDay((selected) => (selected === oldToday ? data.today : selected));
  }, [data?.today]);
  // Coalesce events from one committed transaction without losing events that
  // arrive during an in-flight snapshot. At most one live refresh runs at once.
  const liveRefreshState = useRef({ running: false, dirty: false });
  const requestLiveRefresh = useCallback(async () => {
    const state = liveRefreshState.current;
    state.dirty = true;
    if (state.running) return;
    state.running = true;
    try {
      await new Promise((resolve) => setTimeout(resolve, 75));
      while (state.dirty) {
        state.dirty = false;
        await currentRefresh.current();
      }
    } finally {
      state.running = false;
    }
  }, []);
  const [chatConnection, setChatConnection] = useState<
    "connecting" | "live" | "reconnecting"
  >("connecting");
  const sequence = useRef(0),
    locked = useRef(false);
  const notify = useCallback((s: string) => setToast(s), []);
  const refresh = useCallback(async () => {
    const seq = ++sequence.current;
    let from = day;
    if (view === "money") {
      if (range === "week") from = shiftDay(day, -6);
      if (range === "month") from = day.slice(0, 7) + "-01";
    }
    try {
      const r = await fetch(
        `/api/snapshot?day=${day}&from=${from}&to=${day}${view === "orders" && orderDate ? `&ordersDay=${orderDate}` : ""}`,
        {
          cache: "no-store",
        },
      );
      const json = (await r.json()) as Snapshot & { error?: string };
      if (!r.ok) throw new Error(json.error || "Could not load shop");
      if (seq === sequence.current) {
        setData(json);
        setError("");
      }
    } catch (e) {
      if (seq === sequence.current)
        setError(e instanceof Error ? e.message : "Could not connect");
    } finally {
      if (seq === sequence.current) setLoading(false);
    }
  }, [day, range, view, orderDate]);
  useEffect(() => {
    currentRefresh.current = refresh;
  }, [refresh]);
  useEffect(() => {
    const client = browserClient();
    const channel = client.channel("kainan:catalog");
    channel
      .on("broadcast", { event: "shop_changed" }, () => {
        void requestLiveRefresh();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void requestLiveRefresh();
      });
    return () => {
      void client.removeChannel(channel);
    };
  }, [requestLiveRefresh]);
  useEffect(() => {
    if (!data?.user) return;
    let disposed = false;
    const client = browserClient();
    setChatConnection("connecting");
    const channel = client.channel(`kainan:user:${data.user.id}`, {
      config: { private: true },
    });
    const { data: authListener } = client.auth.onAuthStateChange(
      (_event, session) => {
        if (session) void client.realtime.setAuth(session.access_token);
      },
    );
    void (async () => {
      await client.realtime.setAuth();
      if (disposed) return;
      channel
        .on("broadcast", { event: "activity" }, () => {
          if (!disposed) void requestLiveRefresh();
        })
        .on("broadcast", { event: "shop_changed" }, () => {
          if (!disposed) void requestLiveRefresh();
        })
        .on("broadcast", { event: "chat_message" }, ({ payload }) => {
          if (disposed || !payload?.record?.id) return;
          ++sequence.current;
          setData((previous) =>
            previous
              ? mergeChatMessage(
                  previous,
                  payload.record as Message,
                  payload.customer as Customer,
                )
              : previous,
          );
          // Chat can invalidate an older in-flight snapshot. Queue another so
          // order cards and stock also catch up after that snapshot completes.
          void requestLiveRefresh();
        })
        .subscribe((status) => {
          if (disposed) return;
          setChatConnection(status === "SUBSCRIBED" ? "live" : "reconnecting");
          if (status === "SUBSCRIBED") void currentRefresh.current();
        });
    })().catch(() => {
      if (!disposed) setChatConnection("reconnecting");
    });
    return () => {
      disposed = true;
      authListener.subscription.unsubscribe();
      void client.removeChannel(channel);
    };
  }, [data?.user?.id, requestLiveRefresh]);
  useEffect(() => {
    if (!data?.user || document.hidden || modal) return;
    const section =
      view === "home" && (data.role !== "owner" || shopMode) ? "menu" : view;
    if (section !== "menu" && section !== "orders" && section !== "chat")
      return;
    if (!data.notificationCounts?.[section] || !data.notifications?.length)
      return;
    const entityId =
      section === "chat" && data.role === "owner" && !shopMode
        ? chatId
        : undefined;
    if (section === "chat" && data.role === "owner" && !shopMode && !entityId)
      return;
    const through = data.notifications[0].created_at;
    const key = `${data.user.id}:${section}:${entityId || ""}:${through}`;
    if (lastNotificationAck.current === key) return;
    lastNotificationAck.current = key;
    void fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "readNotifications",
        section,
        entityId,
        through,
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Could not mark notifications read");
        void requestLiveRefresh();
      })
      .catch(() => {
        if (lastNotificationAck.current === key)
          lastNotificationAck.current = "";
      });
  }, [data, view, shopMode, chatId, modal, requestLiveRefresh]);
  useEffect(() => {
    setLoading(!data);
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden && !locked.current) void refresh();
    }, 15000);
    const onFocus = () => {
      if (!document.hidden) void currentRefresh.current();
    };
    window.addEventListener("online", onFocus);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onFocus);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  const run = useCallback(
    async (payload: Record<string, unknown>, success = "Na-save na!") => {
      if (locked.current) return null;
      locked.current = true;
      setBusy(true);
      try {
        const r = await fetch("/api/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = (await r.json()) as {
          error?: string;
          message?: Message;
        };
        if (!r.ok) {
          if (r.status === 409) await currentRefresh.current();
          throw new Error(result.error || "Could not save");
        }
        if (result.message) {
          ++sequence.current;
          setData((previous) =>
            previous ? mergeChatMessage(previous, result.message!) : previous,
          );
          void currentRefresh.current();
        } else await currentRefresh.current();
        if (success) notify(success);
        return result;
      } catch (e) {
        notify(
          e instanceof Error
            ? e.message
            : "Not sent. Please check your connection and try again.",
        );
        return null;
      } finally {
        locked.current = false;
        setBusy(false);
      }
    },
    [refresh, notify],
  );
  return (
    <Context.Provider
      value={{
        data,
        day,
        setDay,
        view,
        setView,
        shopMode,
        setShopMode,
        range,
        orderDate,
        setOrderDate,
        setRange,
        busy,
        loading,
        error,
        toast,
        notify,
        refresh,
        run,
        modal,
        setModal,
        chatId,
        setChatId,
        chatConnection,
      }}
    >
      {children}
    </Context.Provider>
  );
}
