export const ORDER_STATES = [
  "pending",
  "accepted",
  "ready",
  "picked_up",
  "declined",
  "cancelled",
  "no_show",
] as const;
export type OrderState = (typeof ORDER_STATES)[number];
export function manilaDay(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function shiftDay(day: string, amount: number): string {
  return new Date(Date.parse(day + "T00:00:00Z") + amount * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function money(cents: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
}
export function available(item: {
  capacity: number;
  reserved: number;
  sold: number;
  waste: number;
}): number {
  return item.capacity - item.reserved - item.sold - item.waste;
}
export function paymentLabel(total: number, paid: number, pending = 0): string {
  return paid >= total
    ? "Paid"
    : pending > 0
      ? "For verification"
      : paid > 0
        ? "Partially paid"
        : "Unpaid";
}
export function niceDate(day: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(day + "T00:00:00+08:00"));
}
export const transitions: Record<string, string[]> = {
  pending: ["accepted", "declined", "cancelled"],
  accepted: ["ready", "picked_up", "cancelled", "no_show"],
  ready: ["picked_up", "cancelled", "no_show"],
  picked_up: [],
  declined: [],
  cancelled: [],
  no_show: [],
};
