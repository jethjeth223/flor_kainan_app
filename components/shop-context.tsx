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
import type { Snapshot } from "@/lib/types";
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
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState<Modal>(null),
    [chatId, setChatId] = useState("");
  const currentRefresh = useRef<() => Promise<void>>(async () => {});
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
      const r = await fetch(`/api/snapshot?day=${day}&from=${from}&to=${day}`, {
        cache: "no-store",
      });
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
  }, [day, range, view]);
  useEffect(() => {
    currentRefresh.current = refresh;
  }, [refresh]);
  useEffect(() => {
    setLoading(!data);
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden && !locked.current) void refresh();
    }, 15000);
    const onFocus = () => void refresh();
    window.addEventListener("online", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onFocus);
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
        const result = (await r.json()) as { error?: string };
        if (!r.ok) {
          if (r.status === 409) await currentRefresh.current();
          throw new Error(result.error || "Could not save");
        }
        await currentRefresh.current();
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
      }}
    >
      {children}
    </Context.Provider>
  );
}
