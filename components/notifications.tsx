"use client";
import { Bell, MessageCircle, ShoppingBag, Utensils } from "lucide-react";
import { useShop } from "./shop-context";
import { Dialog, Empty } from "./ui";
export function ActivityDot({
  count,
  label,
}: {
  count: number;
  label: string;
}) {
  return count > 0 ? (
    <span
      className="activity-dot"
      role="img"
      aria-label={`${label}: ${count} unread updates`}
    />
  ) : null;
}
export function NotificationBell() {
  const { data, setModal } = useShop();
  if (!data?.user) return null;
  const total = Object.values(data.notificationCounts || {}).reduce(
    (n, x) => n + x,
    0,
  );
  return (
    <button
      className="notification-button icon-button activity-bell"
      aria-label={`Notifications${total ? `, ${total} unread` : ""}`}
      onClick={() => setModal({ kind: "notifications" })}
    >
      <Bell size={20} />
      <ActivityDot count={total} label="Notifications" />
    </button>
  );
}
export function NotificationCenter() {
  const { data, setModal, setView, setChatId, run, busy } = useShop();
  const notifications = data?.notifications || [];
  const total = Object.values(data?.notificationCounts || {}).reduce(
    (n, x) => n + x,
    0,
  );
  return (
    <Dialog
      title="Notifications"
      subtitle="Menu, orders, and conversations — all in one place."
      onClose={() => setModal(null)}
    >
      {total > 0 && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            run(
              { action: "readNotifications" },
              "Notifications marked as read.",
            )
          }
        >
          Mark all as read
        </button>
      )}
      <div className="notification-feed">
        {notifications.map((item) => {
          const Icon =
            item.section === "menu"
              ? Utensils
              : item.section === "orders"
                ? ShoppingBag
                : MessageCircle;
          return (
            <button
              key={item.id}
              className={"notification-item " + (!item.read_at ? "unread" : "")}
              onClick={() => {
                void run(
                  { action: "readNotifications", notificationId: item.id },
                  "",
                );
                setView(item.section);
                if (
                  item.section === "chat" &&
                  data?.role === "owner" &&
                  item.entity_id
                )
                  setChatId(item.entity_id);
                if (
                  item.section === "orders" &&
                  item.entity_id &&
                  data?.orders.some((o) => o.id === item.entity_id)
                )
                  setModal({ kind: "order", data: { id: item.entity_id } });
                else setModal(null);
              }}
            >
              <span className="notification-icon">
                <Icon size={19} />
              </span>
              <span>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
                <small>
                  {new Date(item.created_at).toLocaleString("en-PH", {
                    timeZone: "Asia/Manila",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </small>
              </span>
              <ActivityDot
                count={item.read_at ? 0 : 1}
                label="Unread notification"
              />
            </button>
          );
        })}
      </div>
      {!notifications.length && (
        <Empty
          icon={Bell}
          title="You’re all caught up"
          description="New menu, order, and chat activity will appear here."
        />
      )}
    </Dialog>
  );
}
