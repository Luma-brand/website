import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Inbox,
  Mail,
  RefreshCw,
  Search,
  Send,
  Star,
} from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import { useToast } from "../../context/ToastContext";
import {
  getMailInboxes,
  getMailTicket,
  getMailTickets,
  replyToMailTicket,
  updateMailTicketPriority,
  updateMailTicketStatus,
} from "../../services/api";

const statusOptions = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Pending", value: "pending" },
  { label: "Closed", value: "closed" },
];

const priorityOptions = ["low", "normal", "high", "urgent"];

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

function formatStatus(value) {
  return String(value || "open").replaceAll("_", " ");
}

function getInboxLabel(ticket) {
  return ticket.inbox_name || (ticket.inbox_email === "hello@shopwithluma.com" ? "Hello" : "Support");
}

function getMessageBody(message) {
  return message.text_body || message.body_text || message.subject || "";
}

function TicketRow({ ticket, isActive, onClick }) {
  const preview = ticket.preview || "Open the conversation to read this message.";

  return (
    <button
      type="button"
      className={isActive ? "mail-ticket-row active" : "mail-ticket-row"}
      onClick={onClick}
    >
      <span className="mail-ticket-row-top">
        <strong>{ticket.customer_name || ticket.customer_email}</strong>
        <small>{formatDate(ticket.last_message_at || ticket.created_at)}</small>
      </span>
      <span className="mail-ticket-subject">{ticket.subject || "Customer message"}</span>
      <span className="mail-ticket-preview">{preview}</span>
      <span className="mail-ticket-meta">
        <span className="admin-badge">{formatStatus(ticket.status)}</span>
        <span className="admin-badge">{getInboxLabel(ticket)}</span>
        <span>{ticket.message_count || 0} message(s)</span>
      </span>
    </button>
  );
}

function MessageBubble({ message, ticket }) {
  const isOutbound = message.direction === "outbound";

  return (
    <article className={isOutbound ? "mail-message outbound" : "mail-message inbound"}>
      <div className="mail-message-meta">
        <strong>{isOutbound ? ticket?.reply_from_name || "LUMA Support" : message.from_email || "Customer"}</strong>
        <span>{formatDate(message.created_at)}</span>
      </div>
      <p>{getMessageBody(message)}</p>
    </article>
  );
}

export function AdminMail() {
  const { showToast } = useToast();
  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inboxes, setInboxes] = useState([
    { key: "all", label: "All inboxes", email: null },
    { key: "support", label: "Support", email: "support@shopwithluma.com" },
    { key: "hello", label: "Hello", email: "hello@shopwithluma.com" },
  ]);
  const [inbox, setInbox] = useState("all");
  const [status, setStatus] = useState("open");
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isLoadingTicket, setIsLoadingTicket] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const activeTicket = useMemo(() => {
    return selectedTicket || tickets.find((ticket) => ticket.id === selectedTicketId) || null;
  }, [selectedTicket, selectedTicketId, tickets]);

  const loadTickets = useCallback(async () => {
    try {
      setIsLoadingTickets(true);
      setError("");
      const response = await getMailTickets({
        status,
        search,
        limit: 50,
        inbox,
      });
      const nextTickets = response.data?.tickets || [];
      setTickets(nextTickets);

      if (!selectedTicketId && nextTickets[0]?.id) {
        setSelectedTicketId(nextTickets[0].id);
      }
    } catch (error) {
      setError(error.message || "Failed to load support inbox.");
    } finally {
      setIsLoadingTickets(false);
    }
  }, [inbox, search, selectedTicketId, status]);

  useEffect(() => {
    void getMailInboxes()
      .then((response) => {
        const available = response.data;
        if (Array.isArray(available) && available.length) setInboxes(available);
      })
      .catch(() => {
        // The fallback options keep the existing Mail page usable during rollout.
      });
  }, []);

  const loadTicket = useCallback(async (ticketId) => {
    if (!ticketId) {
      setSelectedTicket(null);
      setMessages([]);
      return;
    }

    try {
      setIsLoadingTicket(true);
      setError("");
      const response = await getMailTicket(ticketId);
      setSelectedTicket(response.data?.ticket || null);
      setMessages(response.data?.messages || []);
    } catch (error) {
      setError(error.message || "Failed to load this conversation.");
    } finally {
      setIsLoadingTicket(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTickets();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadTickets]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadTicket(selectedTicketId);
    });
  }, [loadTicket, selectedTicketId]);

  function handleInboxChange(event) {
    setInbox(event.target.value);
    setSelectedTicketId("");
    setSelectedTicket(null);
    setMessages([]);
  }

  async function handleReplySubmit(event) {
    event.preventDefault();
    if (!selectedTicketId || !reply.trim()) return;

    try {
      setIsSending(true);
      setError("");
      await replyToMailTicket(selectedTicketId, { message: reply });
      setReply("");
      showToast("Support reply sent.");
      await Promise.all([loadTicket(selectedTicketId), loadTickets()]);
    } catch (error) {
      const message = error.message || "Failed to send reply.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSending(false);
    }
  }

  async function handleStatusChange(nextStatus) {
    if (!selectedTicketId) return;
    try {
      await updateMailTicketStatus(selectedTicketId, { status: nextStatus });
      showToast("Ticket status updated.");
      await Promise.all([loadTicket(selectedTicketId), loadTickets()]);
    } catch (error) {
      const message = error.message || "Failed to update ticket status.";
      setError(message);
      showToast(message, "error");
    }
  }

  async function handlePriorityChange(nextPriority) {
    if (!selectedTicketId) return;
    try {
      await updateMailTicketPriority(selectedTicketId, { priority: nextPriority });
      showToast("Ticket priority updated.");
      await Promise.all([loadTicket(selectedTicketId), loadTickets()]);
    } catch (error) {
      const message = error.message || "Failed to update ticket priority.";
      setError(message);
      showToast(message, "error");
    }
  }

  return (
    <>
      <AdminTopbar
        title="Mail"
        subtitle="Read Support and Hello emails and reply from the LUMA control room."
      />

      <section className="admin-content">
        {error && <div className="admin-error">{error}</div>}

        <div className="admin-card mail-inbox-shell">
          <aside className="mail-ticket-panel">
            <div className="mail-ticket-toolbar">
              <div>
                <p className="admin-eyebrow">Mail inboxes</p>
                <h2>Customer mail</h2>
              </div>
              <button
                type="button"
                className="admin-button secondary mail-icon-button"
                onClick={loadTickets}
                disabled={isLoadingTickets}
                aria-label="Refresh mail tickets"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="mail-filters">
              <select value={inbox} onChange={handleInboxChange} aria-label="Filter by inbox">
                {inboxes.map((option) => (
                  <option key={option.key} value={option.email || option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label className="mail-search-field">
                <Search size={16} />
                <input
                  type="search"
                  placeholder="Search mail"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mail-ticket-list">
              {isLoadingTickets ? (
                <div className="admin-empty">Loading mail...</div>
              ) : tickets.length === 0 ? (
                <div className="admin-empty">
                  <Inbox size={22} />
                  No emails found.
                </div>
              ) : (
                tickets.map((ticket) => (
                  <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    isActive={ticket.id === selectedTicketId}
                    onClick={() => setSelectedTicketId(ticket.id)}
                  />
                ))
              )}
            </div>
          </aside>

          <main className="mail-conversation-panel">
            {!activeTicket ? (
              <div className="mail-empty-state">
                <Mail size={30} />
                <h2>Select a conversation</h2>
                <p>Choose a customer email from the list to read and reply.</p>
              </div>
            ) : (
              <>
                <div className="mail-conversation-header">
                  <div>
                    <p className="admin-eyebrow">{activeTicket.customer_email}</p>
                    <h2>{activeTicket.subject || "Customer message"}</h2>
                    <small>Inbox: {activeTicket.inbox_email || "support@shopwithluma.com"}</small>
                  </div>

                  <div className="mail-controls">
                    <label>
                      <Archive size={15} />
                      <select
                        value={activeTicket.status || "open"}
                        onChange={(event) => handleStatusChange(event.target.value)}
                      >
                        {statusOptions
                          .filter((option) => option.value !== "all")
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </select>
                    </label>

                    <label>
                      <Star size={15} />
                      <select
                        value={activeTicket.priority || "normal"}
                        onChange={(event) => handlePriorityChange(event.target.value)}
                      >
                        {priorityOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="mail-message-list">
                  {isLoadingTicket ? (
                    <div className="admin-empty">Loading conversation...</div>
                  ) : messages.length === 0 ? (
                    <div className="admin-empty">No messages have been saved for this ticket yet.</div>
                  ) : (
                    messages.map((message) => (
                      <MessageBubble key={message.id} message={message} ticket={activeTicket} />
                    ))
                  )}
                </div>

                <form className="mail-reply-box" onSubmit={handleReplySubmit}>
                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder="Write a helpful reply..."
                    rows={5}
                  />
                  <div className="mail-reply-actions">
                    <span>
                      Replying from {activeTicket.reply_from_name || "LUMA Support"}{" "}
                      &lt;{activeTicket.reply_from_email || "support@shopwithluma.com"}&gt;
                    </span>
                    <button
                      type="submit"
                      className="admin-button"
                      disabled={isSending || !reply.trim()}
                    >
                      <Send size={16} />
                      {isSending ? "Sending..." : "Send reply"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </main>
        </div>
      </section>
    </>
  );
}


