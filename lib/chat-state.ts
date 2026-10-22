import type { Customer, Message, Snapshot } from "./types";

/** Reconnects and the sender's HTTP response can repeat an already seen event. */
export function mergeChatMessage(
  data: Snapshot,
  message: Message,
  customer?: Pick<Customer, "id" | "name" | "avatar_file_id">,
): Snapshot {
  if (
    !data.user ||
    (data.role !== "owner" &&
      data.customerId &&
      data.customerId !== message.customer_id)
  )
    return data;
  const previous = data.messages.find((m) => m.id === message.id);
  const next = {
    ...message,
    read_at: message.read_at || previous?.read_at || null,
  };
  const customers = [...data.customers];
  if (
    data.role === "owner" &&
    customer &&
    !customers.some((c) => c.id === customer.id)
  )
    customers.push({ ...customer, user_id: null, phone: "", balance: 0 });
  return {
    ...data,
    customers,
    messages: [next, ...data.messages.filter((m) => m.id !== next.id)]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 500),
  };
}
