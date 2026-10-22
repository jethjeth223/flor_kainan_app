import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeChatMessage } from "../lib/chat-state.ts";

test("live events deduplicate HTTP echoes and preserve read receipts during reconnect", () => {
  const start = {
    user: { id: "owner" },
    role: "owner",
    messages: [],
    customers: [],
  };
  const message = {
    id: "m",
    customer_id: "c",
    sender: "customer",
    body: "Hello",
    file_id: null,
    order_id: null,
    created_at: "2026-10-22T00:00:00Z",
    read_at: null,
  };
  let data = mergeChatMessage(start, message, {
    id: "c",
    name: "Buyer",
    avatar_file_id: null,
  });
  data = mergeChatMessage(data, message);
  assert.equal(data.messages.length, 1);
  assert.equal(data.customers.length, 1);
  data = mergeChatMessage(data, {
    ...message,
    read_at: "2026-10-22T00:01:00Z",
  });
  data = mergeChatMessage(data, message);
  assert.equal(data.messages[0].read_at, "2026-10-22T00:01:00Z");
  const customer = { ...start, role: "customer", customerId: "mine" };
  assert.equal(mergeChatMessage(customer, message), customer);
  const anonymous = { ...start, user: null };
  assert.equal(mergeChatMessage(anonymous, message), anonymous);
});
