import { useCallback, useEffect, useMemo, useState } from "react";
import { Mail, Send, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { AdminTopbar } from "../components/AdminTopbar";
import { useToast } from "../../context/ToastContext";
import {
  deleteEnquiry,
  getEnquiries,
  markEnquiryAsRead,
  replyToEnquiry,
} from "../../services/api";

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

export function AdminEnquiries() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [enquiries, setEnquiries] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(searchParams.get("inquiry") || "");
  const [replyMessage, setReplyMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const selectedEnquiry = useMemo(
    () => enquiries.find((item) => String(item.id) === String(selectedId)) || null,
    [enquiries, selectedId]
  );

  const loadEnquiries = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const response = await getEnquiries();
      setEnquiries(response.data || []);
    } catch (loadError) {
      setError(loadError.message || "Failed to load enquiries.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadEnquiries();
    });
  }, [loadEnquiries]);

  const filteredEnquiries = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    return enquiries.filter((item) => !searchValue || [
      item.full_name,
      item.email,
      item.phone,
      item.subject,
      item.message,
    ].some((value) => String(value || "").toLowerCase().includes(searchValue)));
  }, [search, enquiries]);

  async function openEnquiry(item) {
    setSelectedId(item.id);
    setSearchParams({ inquiry: item.id });
    setReplyMessage("");
    if (item.status === "new") {
      try {
        await markEnquiryAsRead(item.id);
        setEnquiries((current) => current.map((entry) => (
          entry.id === item.id ? { ...entry, status: "read" } : entry
        )));
      } catch {
        // The enquiry remains viewable even if the read receipt cannot be saved.
      }
    }
  }

  function closeEnquiry() {
    setSelectedId("");
    setSearchParams({});
    setReplyMessage("");
  }

  async function sendReply(event) {
    event.preventDefault();
    if (!selectedEnquiry || !replyMessage.trim()) return;
    try {
      setIsSending(true);
      await replyToEnquiry(selectedEnquiry.id, replyMessage.trim());
      setReplyMessage("");
      await loadEnquiries();
      showToast(`Inquiry response sent to ${selectedEnquiry.email}.`);
    } catch (sendError) {
      showToast(sendError.message || "The inquiry response could not be sent.", "error");
    } finally {
      setIsSending(false);
    }
  }

  async function removeEnquiry(item) {
    if (!window.confirm(`Delete the enquiry from ${item.email}?`)) return;
    try {
      await deleteEnquiry(item.id);
      setEnquiries((current) => current.filter((entry) => entry.id !== item.id));
      closeEnquiry();
      showToast("Enquiry deleted.");
    } catch (deleteError) {
      showToast(deleteError.message || "The enquiry could not be deleted.", "error");
    }
  }

  const metadata = selectedEnquiry?.metadata || {};

  return (
    <>
      <AdminTopbar
        title="Enquiries"
        subtitle="Review enquiries and send branded email responses from LUMA."
      />

      <section className="admin-content">
        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <div><h2>Contact enquiries</h2><p>New messages are also delivered to hello@shopwithluma.com.</p></div>
            <input className="admin-search" type="search" placeholder="Search enquiries..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>

          {error && <div className="admin-error">{error}</div>}
          {isLoading ? (
            <div className="admin-empty">Loading enquiries...</div>
          ) : filteredEnquiries.length === 0 ? (
            <div className="admin-empty">No enquiries found.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Name</th><th>Contact</th><th>Subject</th><th>Status</th><th>Received</th><th /></tr></thead>
                <tbody>
                  {filteredEnquiries.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.full_name}</strong></td>
                      <td>{item.email}<small>{item.phone || "No phone"}</small></td>
                      <td>{item.subject || "General enquiry"}</td>
                      <td><span className={`admin-badge ${item.status === "replied" ? "success" : item.status === "new" ? "warning" : ""}`}>{item.status || "new"}</span></td>
                      <td>{formatDateTime(item.created_at)}</td>
                      <td><button type="button" className="admin-button secondary" onClick={() => openEnquiry(item)}>View & respond</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedEnquiry && (
          <div className="admin-card admin-table-card">
            <div className="admin-table-header">
              <div><h2>{selectedEnquiry.subject || "General enquiry"}</h2><p>Received {formatDateTime(selectedEnquiry.created_at)} (Lagos time)</p></div>
              <div className="admin-actions-row">
                <button type="button" className="admin-button danger" onClick={() => removeEnquiry(selectedEnquiry)}><Trash2 size={15} /> Delete</button>
                <button type="button" className="admin-button secondary" onClick={closeEnquiry}>Close</button>
              </div>
            </div>

            <div className="admin-form-grid compact">
              <p><strong>Name</strong><br />{selectedEnquiry.full_name}</p>
              <p><strong>Email</strong><br /><a href={`mailto:${selectedEnquiry.email}`}>{selectedEnquiry.email}</a></p>
              <p><strong>Phone</strong><br /><a href={`tel:${selectedEnquiry.phone || ""}`}>{selectedEnquiry.phone || "—"}</a></p>
              <p><strong>Admin notification</strong><br />{selectedEnquiry.admin_notified_at ? `Sent ${formatDateTime(selectedEnquiry.admin_notified_at)}` : "Pending or not configured"}</p>
              <p><strong>Source page</strong><br />{metadata.sourcePage || "—"}</p>
              <p><strong>Browser timezone</strong><br />{metadata.browserTimezone || "—"}</p>
            </div>

            <div className="selected-pickup-card">
              <Mail size={18} />
              <div><strong>Inquiry details</strong><p style={{ whiteSpace: "pre-wrap" }}>{selectedEnquiry.message}</p></div>
            </div>

            {(selectedEnquiry.replies || []).length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h3>Response history</h3>
                {selectedEnquiry.replies.map((reply) => (
                  <div className="selected-pickup-card" key={reply.id} style={{ marginTop: 10 }}>
                    <Send size={17} />
                    <div>
                      <strong>{reply.status === "sent" ? "Sent" : "Delivery failed"} · {formatDateTime(reply.sent_at || reply.created_at)}</strong>
                      <p style={{ whiteSpace: "pre-wrap" }}>{reply.message}</p>
                      {reply.error_message && <small className="form-error">{reply.error_message}</small>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form className="pickup-location-form" onSubmit={sendReply} style={{ marginTop: 24 }}>
              <label>
                <strong>Respond to {selectedEnquiry.full_name}</strong>
                <textarea rows="7" value={replyMessage} onChange={(event) => setReplyMessage(event.target.value)} placeholder="Write LUMA's response..." required />
              </label>
              <button type="submit" className="admin-button" disabled={isSending || !replyMessage.trim()}>
                <Send size={16} /> {isSending ? "Sending email..." : "Send inquiry response"}
              </button>
            </form>
          </div>
        )}
      </section>
    </>
  );
}
