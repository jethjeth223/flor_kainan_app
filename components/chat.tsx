"use client";
import { useState, useEffect, useRef } from "react";
import {
  Send,
  Paperclip,
  MessageCircle,
  X,
  ArrowLeft,
  Search,
  ImageIcon,
  ShoppingBag,
} from "lucide-react";
import { useShop } from "./shop-context";
import { Avatar, Empty } from "./ui";
export function ChatView({ customerView = false }: { customerView?: boolean }) {
  const { data: d, chatId, setChatId, run, notify, setModal } = useShop();
  const [body, setBody] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [sending, setSending] = useState(false),
    [search, setSearch] = useState("");
  const end = useRef<HTMLDivElement>(null),
    fileInput = useRef<HTMLInputElement>(null);
  const requestId = useRef(crypto.randomUUID());
  const active = customerView ? d?.customerId : chatId;
  const customer = d?.customers.find((c) => c.id === active);
  const msgs = (d?.messages || [])
    .filter((m) => m.customer_id === active)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
    if (active) void run({ action: "readMessages", customerId: active }, "");
  }, [active, msgs.length]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if ((!body.trim() && !file) || sending) return;
    if (!d?.user) {
      window.location.href = "/signin-with-chatgpt?return_to=/";
      return;
    }
    if (customerView && !d.customerId) {
      setModal({ kind: "profile" });
      return;
    }
    setSending(true);
    let fileId: string | undefined;
    try {
      if (file) {
        const f = new FormData();
        f.set("file", file);
        if (active) f.set("customerId", active);
        const r = await fetch("/api/upload", { method: "POST", body: f });
        const j = (await r.json()) as { id: string; error: string };
        if (!r.ok) throw new Error(j.error);
        fileId = j.id;
      }
      const r = await run(
        {
          action: "message",
          requestId: requestId.current,
          customerId: active || undefined,
          body,
          fileId,
        },
        "",
      );
      if (r) {
        setBody("");
        setFile(null);
        requestId.current = crypto.randomUUID();
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : "Image could not be sent.");
    } finally {
      setSending(false);
    }
  }
  if (!d) return null;
  const conversations = d.customers
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const last = (id: string) =>
        d.messages.find((m) => m.customer_id === id)?.created_at || "";
      return last(b.id).localeCompare(last(a.id));
    });
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A LITTLE CONVERSATION GOES A LONG WAY</div>
          <h1>{customerView ? "Chat with Flor" : "Messages"}</h1>
          <p>
            {customerView
              ? "Questions about your food or pickup? Send a message."
              : "Your customers, just a message away."}
          </p>
        </div>
      </div>
      <section
        className={
          "chat-layout panel " +
          (active ? "has-active" : "") +
          (customerView ? " customer-chat" : "")
        }
      >
        {!customerView && (
          <aside className="conversation-list">
            <div className="chat-search">
              <Search size={17} />
              <input
                aria-label="Search conversations"
                placeholder="Search conversations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {conversations.map((c) => {
              const last = d.messages.find((m) => m.customer_id === c.id),
                unread = d.messages.filter(
                  (m) =>
                    m.customer_id === c.id &&
                    m.sender === "customer" &&
                    !m.read_at,
                ).length;
              return (
                <button
                  className={
                    "conversation " + (c.id === active ? "active" : "")
                  }
                  key={c.id}
                  onClick={() => setChatId(c.id)}
                >
                  <Avatar name={c.name} />
                  <span>
                    <strong>{c.name}</strong>
                    <small>
                      {last?.body ||
                        (last?.file_id
                          ? "Sent an image"
                          : "Start a conversation")}
                    </small>
                  </span>
                  {unread > 0 && <span className="unread-count">{unread}</span>}
                </button>
              );
            })}
            {!conversations.length && (
              <Empty
                icon={MessageCircle}
                title="No conversations yet"
                description="Customers can message you from their ordering page."
              />
            )}
          </aside>
        )}
        <div className="chat-main">
          {active || customerView ? (
            <>
              <header className="chat-header">
                {!customerView && (
                  <button
                    className="icon-button chat-back"
                    aria-label="Back to conversations"
                    onClick={() => setChatId("")}
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                <Avatar
                  name={customerView ? "Flor" : customer?.name || "Customer"}
                />
                <div>
                  <strong>
                    {customerView ? "Flor’s Kainan" : customer?.name}
                  </strong>
                  <small>
                    {customerView
                      ? "Lutong bahay, alagang Flor"
                      : customer?.phone || "Customer conversation"}
                  </small>
                </div>
              </header>
              <div className="messages-scroll">
                {!msgs.length && (
                  <Empty
                    icon={MessageCircle}
                    title={customerView ? "Kumusta po!" : "Say hello"}
                    description="Send a message or attach an image to start the conversation."
                  />
                )}
                {msgs.map((m) => (
                  <div
                    key={m.id}
                    className={
                      "message " +
                      (m.sender === (customerView ? "customer" : "owner")
                        ? "mine"
                        : "")
                    }
                  >
                    <div className="message-bubble">
                      {m.order_id && (
                        <small className="message-order">
                          <ShoppingBag size={12} />
                          Order #{m.order_id.slice(-6).toUpperCase()}
                        </small>
                      )}
                      {m.body && <p>{m.body}</p>}
                      {m.file_id && (
                        <a
                          href={"/api/files/" + m.file_id}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={"/api/files/" + m.file_id}
                            alt="Image attached to message"
                            loading="lazy"
                          />
                        </a>
                      )}
                      <small className="message-time">
                        {new Date(m.created_at).toLocaleTimeString("en-PH", {
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: "Asia/Manila",
                        })}
                      </small>
                    </div>
                  </div>
                ))}
                <div ref={end} />
              </div>
              {!customerView && (
                <div className="quick-replies">
                  {[
                    "Handa na po!",
                    "Na-check ko na ang bayad.",
                    "Salamat po!",
                  ].map((s) => (
                    <button key={s} onClick={() => setBody(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {file && (
                <div className="attachment-chip">
                  <ImageIcon size={16} />
                  {file.name}
                  <button
                    className="icon-button"
                    aria-label="Remove attachment"
                    onClick={() => setFile(null)}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <form className="chat-compose" onSubmit={send}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  ref={fileInput}
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.size <= 5_000_000) setFile(f);
                    else if (f) notify("Choose an image smaller than 5 MB.");
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Attach image"
                  disabled={sending}
                  onClick={() => fileInput.current?.click()}
                >
                  <Paperclip size={21} />
                </button>
                <textarea
                  rows={1}
                  placeholder="Write a message…"
                  aria-label="Message"
                  value={body}
                  maxLength={2000}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <button
                  className="send-button"
                  disabled={sending || (!body.trim() && !file)}
                  aria-label="Send message"
                >
                  <Send size={19} />
                </button>
              </form>
            </>
          ) : (
            <Empty
              icon={MessageCircle}
              title="A friendly hello starts here"
              description="Choose a customer on the left to open your conversation."
            />
          )}
        </div>
      </section>
    </>
  );
}
