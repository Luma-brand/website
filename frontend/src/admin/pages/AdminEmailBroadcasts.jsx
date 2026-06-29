import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Mail, Plus, RefreshCw, Search, Send, Trash2, X } from "lucide-react";
import { AdminTopbar } from "../components/AdminTopbar";
import { useToast } from "../../context/ToastContext";
import {
  createEmailBroadcast,
  deleteEmailBroadcast,
  getEmailBroadcastRecipients,
  getEmailBroadcasts,
  getEmailStatus,
  previewEmailBroadcast,
  resolveEmailBroadcastRecipients,
  searchEmailBroadcastRecipients,
  sendEmailBroadcast,
  sendEmailBroadcastTest,
  updateEmailBroadcast,
} from "../../services/api";

const recipientGroups = [
  { label: "All customers", value: "all_customers" },
  { label: "Newsletter subscribers", value: "newsletter_subscribers" },
  { label: "Abandoned cart customers", value: "abandoned_cart_customers" },
  { label: "Selected customers", value: "selected_customers" },
  { label: "Selected emails", value: "selected_emails" },
  { label: "All available contacts", value: "all_available_contacts" },
];

const emptyForm = {
  id: "",
  title: "",
  subject: "",
  preheader: "",
  body: "",
  imageUrl: "",
  ctaLabel: "",
  ctaUrl: "",
  recipientGroup: "newsletter_subscribers",
  status: "draft",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getGroupLabel(value) {
  return recipientGroups.find((group) => group.value === value)?.label || value;
}

export function AdminEmailBroadcasts() {
  const { showToast } = useToast();
  const [broadcasts, setBroadcasts] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [manualEmail, setManualEmail] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientSuggestions, setRecipientSuggestions] = useState([]);
  const [resolvedRecipients, setResolvedRecipients] = useState([]);
  const [preview, setPreview] = useState(null);
  const [sendResults, setSendResults] = useState(null);
  const [recipientLogs, setRecipientLogs] = useState([]);
  const [emailStatus, setEmailStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState("");

  const selectedCustomerIds = useMemo(
    () => selectedCustomers.map((customer) => customer.customerId || customer.customer_id),
    [selectedCustomers]
  );

  const payload = useMemo(
    () => ({
      ...formData,
      customerIds: selectedCustomerIds.filter(Boolean),
      emails: selectedEmails,
    }),
    [formData, selectedCustomerIds, selectedEmails]
  );
  const isEditingLocked = Boolean(formData.id && formData.status !== "draft");

  const loadBroadcasts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");
      const response = await getEmailBroadcasts();
      setBroadcasts(response.data || []);
    } catch (error) {
      setError(error.message || "Failed to load email broadcasts.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadEmailStatus = useCallback(async () => {
    try {
      const response = await getEmailStatus();
      setEmailStatus(response.data || null);
    } catch {
      setEmailStatus(null);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(loadBroadcasts);
    queueMicrotask(loadEmailStatus);
  }, [loadBroadcasts, loadEmailStatus]);

  useEffect(() => {
    if (recipientQuery.trim().length < 2) {
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        setIsSearching(true);
        const response = await searchEmailBroadcastRecipients(recipientQuery);
        setRecipientSuggestions(response.data || []);
      } catch {
        setRecipientSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [recipientQuery]);

  async function handleResolveRecipients(nextPayload = payload) {
    const response = await resolveEmailBroadcastRecipients(nextPayload);
    setResolvedRecipients(response.data?.recipients || []);
    return response.data?.recipients || [];
  }

  function updateField(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setError("");
    setPreview(null);
  }

  function addSelectedCustomer(customer) {
    const email = normalizeEmail(customer.email);
    if (!email) return;

    setSelectedCustomers((current) => {
      if (current.some((item) => normalizeEmail(item.email) === email)) return current;
      return [...current, customer];
    });
  }

  function addAllVisibleCustomers() {
    recipientSuggestions.forEach(addSelectedCustomer);
  }

  function removeSelectedCustomer(email) {
    setSelectedCustomers((current) =>
      current.filter((customer) => normalizeEmail(customer.email) !== normalizeEmail(email))
    );
  }

  function addManualEmail() {
    const email = normalizeEmail(manualEmail);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setSelectedEmails((current) => (current.includes(email) ? current : [...current, email]));
    setManualEmail("");
    setError("");
  }

  function removeManualEmail(email) {
    setSelectedEmails((current) => current.filter((item) => item !== email));
  }

  async function handleSaveDraft(event) {
    event.preventDefault();

    try {
      setIsSaving(true);
      setError("");
      if (isEditingLocked) {
        throw new Error("Only draft broadcasts can be edited. Create a new draft to resend a previous campaign.");
      }

      const recipients = await handleResolveRecipients();
      const nextPayload = { ...payload, recipientCount: recipients.length };
      const response = formData.id
        ? await updateEmailBroadcast(formData.id, nextPayload)
        : await createEmailBroadcast(nextPayload);

      setFormData((current) => ({ ...current, id: response.data.id }));
      showToast(`Draft saved with ${recipients.length} recipient(s).`);
      await loadBroadcasts();
    } catch (error) {
      const message = error.message || "Failed to save broadcast.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePreview() {
    try {
      setError("");
      if (isEditingLocked) {
        throw new Error("Only draft broadcasts can be edited. Create a new draft to resend a previous campaign.");
      }

      let broadcastId = formData.id;

      if (!broadcastId) {
        const response = await createEmailBroadcast(payload);
        broadcastId = response.data.id;
        setFormData((current) => ({ ...current, id: broadcastId }));
        await loadBroadcasts();
      } else {
        await updateEmailBroadcast(broadcastId, payload);
      }

      const [previewResponse] = await Promise.all([
        previewEmailBroadcast(broadcastId),
        handleResolveRecipients(),
      ]);
      setPreview(previewResponse.data);
      showToast("Preview generated.");
    } catch (error) {
      const message = error.message || "Failed to preview broadcast.";
      setError(message);
      showToast(message, "error");
    }
  }

  async function handleSendBroadcastTest() {
    try {
      setIsTesting(true);
      setError("");
      let broadcastId = formData.id;

      if (!broadcastId) {
        const response = await createEmailBroadcast(payload);
        broadcastId = response.data.id;
        setFormData((current) => ({ ...current, id: broadcastId }));
        await loadBroadcasts();
      } else if (!isEditingLocked) {
        await updateEmailBroadcast(broadcastId, payload);
      }

      const response = await sendEmailBroadcastTest(broadcastId, { to: testRecipient.trim() || undefined });
      const result = response.data || {};
      setSendResults({
        sentCount: 1,
        failedCount: 0,
        results: [
          {
            email: result.to,
            status: "test_sent",
            providerMessageId: result.providerMessageId,
            error: "-",
          },
        ],
      });
      showToast(`Test email accepted by Resend${result.providerMessageId ? `: ${result.providerMessageId}` : "."}`);
    } catch (error) {
      const message = error.message || "Failed to send test email.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSend() {
    try {
      setIsSending(true);
      setError("");
      if (isEditingLocked) {
        throw new Error("Only draft broadcasts can be edited. Create a new draft to resend a previous campaign.");
      }

      let broadcastId = formData.id;

      if (!broadcastId) {
        const response = await createEmailBroadcast(payload);
        broadcastId = response.data.id;
        setFormData((current) => ({ ...current, id: broadcastId }));
      } else {
        await updateEmailBroadcast(broadcastId, payload);
      }
      const recipients = await handleResolveRecipients();

      if (recipients.length === 0) {
        throw new Error("No valid recipients found.");
      }

      const confirmed = window.confirm(
        `You are about to send this email to ${recipients.length} recipient(s). Continue?`
      );

      if (!confirmed) return;

      const response = await sendEmailBroadcast(broadcastId, payload);
      setSendResults(response.data || null);
      const logs = await getEmailBroadcastRecipients(broadcastId);
      setRecipientLogs(logs.data || []);
      showToast("Broadcast send completed.");
      await loadBroadcasts();
    } catch (error) {
      const message = error.message || "Failed to send broadcast.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSending(false);
    }
  }

  async function handleEditDraft(broadcast) {
    setFormData({
      id: broadcast.id,
      title: broadcast.title || "",
      subject: broadcast.subject || "",
      preheader: broadcast.preheader || "",
      body: broadcast.body || "",
      imageUrl: broadcast.image_url || "",
      ctaLabel: broadcast.cta_label || "",
      ctaUrl: broadcast.cta_url || "",
      recipientGroup: broadcast.recipient_group || "newsletter_subscribers",
      status: broadcast.status || "draft",
    });
    setSelectedCustomers([]);
    setSelectedEmails(broadcast.selection_payload?.emails || []);
    setPreview(null);
    setSendResults(null);
    const logs = await getEmailBroadcastRecipients(broadcast.id).catch(() => ({ data: [] }));
    setRecipientLogs(logs.data || []);
  }

  async function handleDeleteDraft(broadcast) {
    if (!window.confirm(`Delete draft "${broadcast.title}"?`)) return;

    try {
      await deleteEmailBroadcast(broadcast.id);
      showToast("Draft deleted.");
      await loadBroadcasts();
    } catch (error) {
      const message = error.message || "Failed to delete draft.";
      setError(message);
      showToast(message, "error");
    }
  }

  function resetForm() {
    setFormData(emptyForm);
    setSelectedCustomers([]);
    setSelectedEmails([]);
    setRecipientSuggestions([]);
    setResolvedRecipients([]);
    setPreview(null);
    setSendResults(null);
    setRecipientLogs([]);
    setError("");
  }

  return (
    <>
      <AdminTopbar
        title="Email broadcasts"
        subtitle="Create, preview, and send manual LUMA email campaigns through Resend."
      />

      <section className="admin-content">
        {error && <div className="admin-error">{error}</div>}

        <div className="admin-table-header">
          <button type="button" className="admin-button secondary" onClick={loadBroadcasts}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button type="button" className="admin-button" onClick={resetForm}>
            <Plus size={16} />
            New broadcast
          </button>
        </div>

        <div className="admin-section-grid">
          <form className="admin-card email-broadcast-form" onSubmit={handleSaveDraft}>
            <div className="admin-table-header">
              <h2>{formData.id ? "Edit broadcast" : "Create broadcast"}</h2>
            </div>

            <div className="form-grid two">
              <label className="admin-form-field">
                Campaign title
                <input
                  name="title"
                  value={formData.title}
                  onChange={updateField}
                  placeholder="Internal campaign name"
                />
              </label>
              <label className="admin-form-field">
                Email subject
                <input
                  name="subject"
                  value={formData.subject}
                  onChange={updateField}
                  placeholder="Subject customers will see"
                />
              </label>
            </div>

            <label className="admin-form-field">
              Preheader
              <input
                name="preheader"
                value={formData.preheader}
                onChange={updateField}
                placeholder="Short inbox preview text"
              />
            </label>

            <label className="admin-form-field">
              Email body
              <textarea
                name="body"
                value={formData.body}
                onChange={updateField}
                rows={9}
                placeholder="Write the campaign message. Line breaks are preserved."
              />
            </label>

            <div className="form-grid two">
              <label className="admin-form-field">
                Image URL
                <input
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={updateField}
                  placeholder="https://..."
                />
              </label>
              <label className="admin-form-field">
                Recipient group
                <select
                  name="recipientGroup"
                  value={formData.recipientGroup}
                  onChange={updateField}
                >
                  {recipientGroups.map((group) => (
                    <option value={group.value} key={group.value}>
                      {group.label}
                    </option>
                  ))}
                </select>
                <small className="admin-muted">
                  Customer accounts and newsletter subscribers are separate lists. Use All customers or Selected customers to reach account emails.
                </small>
              </label>
            </div>

            <div className="form-grid two">
              <label className="admin-form-field">
                CTA label
                <input
                  name="ctaLabel"
                  value={formData.ctaLabel}
                  onChange={updateField}
                  placeholder="Button text"
                />
              </label>
              <label className="admin-form-field">
                CTA URL
                <input
                  name="ctaUrl"
                  value={formData.ctaUrl}
                  onChange={updateField}
                  placeholder="https://..."
                />
              </label>
            </div>

            {(formData.recipientGroup === "selected_customers" ||
              formData.recipientGroup === "selected_emails") && (
              <div className="email-recipient-box">
                {formData.recipientGroup === "selected_customers" && (
                  <>
                    <label className="admin-form-field">
                      Search customers
                      <div className="admin-search-row">
                        <Search size={16} />
                        <input
                          value={recipientQuery}
                          onChange={(event) => {
                            const value = event.target.value;
                            setRecipientQuery(value);
                            if (value.trim().length < 2) {
                              setRecipientSuggestions([]);
                            }
                          }}
                          placeholder="Search by name, email, or phone"
                        />
                      </div>
                    </label>
                    {recipientSuggestions.length > 0 && (
                      <div className="email-suggestion-list">
                        <button type="button" className="admin-button secondary" onClick={addAllVisibleCustomers}>
                          Select visible
                        </button>
                        {recipientSuggestions.map((recipient) => (
                          <button
                            type="button"
                            key={`${recipient.source}-${recipient.email}`}
                            onClick={() => addSelectedCustomer(recipient)}
                          >
                            <strong>{recipient.name || recipient.email}</strong>
                            <small>{recipient.email}</small>
                          </button>
                        ))}
                      </div>
                    )}
                    {isSearching && <div className="admin-empty">Searching recipients...</div>}
                  </>
                )}

                {formData.recipientGroup === "selected_emails" && (
                  <div className="admin-search-row">
                    <input
                      value={manualEmail}
                      onChange={(event) => setManualEmail(event.target.value)}
                      placeholder="name@example.com"
                    />
                    <button type="button" className="admin-button secondary" onClick={addManualEmail}>
                      Add email
                    </button>
                  </div>
                )}

                <div className="customer-tag-list">
                  {selectedCustomers.map((customer) => (
                    <span className="status-pill active" key={customer.email}>
                      {customer.email}
                      <button type="button" onClick={() => removeSelectedCustomer(customer.email)}>
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                  {selectedEmails.map((email) => (
                    <span className="status-pill active" key={email}>
                      {email}
                      <button type="button" onClick={() => removeManualEmail(email)}>
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <label className="admin-form-field">
              Test recipient
              <input
                value={testRecipient}
                onChange={(event) => setTestRecipient(event.target.value)}
                placeholder="name@example.com"
              />
              <small className="admin-muted">Optional. If empty, the backend uses ADMIN_TEST_EMAIL.</small>
            </label>

            <div className="admin-action-row">
              <button type="submit" className="admin-button secondary" disabled={isSaving || isEditingLocked}>
                {isSaving ? "Saving..." : "Save draft"}
              </button>
              <button type="button" className="admin-button secondary" onClick={handlePreview} disabled={isEditingLocked}>
                <Eye size={16} />
                Preview
              </button>
              <button type="button" className="admin-button secondary" onClick={handleSendBroadcastTest} disabled={isTesting}>
                <Mail size={16} />
                {isTesting ? "Sending test..." : "Send test email"}
              </button>
              <button type="button" className="admin-button" onClick={handleSend} disabled={isSending || isEditingLocked}>
                <Send size={16} />
                {isSending ? "Sending..." : "Send email"}
              </button>
            </div>
          </form>

          <div className="admin-card">
            <div className="admin-table-header">
              <h2>Email preview</h2>
              <span className="admin-badge">{resolvedRecipients.length} recipient(s)</span>
              {emailStatus && (
                <span className={emailStatus.resendConfigured && emailStatus.emailFromConfigured ? "admin-badge success" : "admin-badge danger"}>
                  Resend {emailStatus.resendConfigured && emailStatus.emailFromConfigured ? "configured" : "needs setup"}
                </span>
              )}
            </div>

            {preview ? (
              <div className="email-preview-frame">
                <p className="admin-eyebrow">Subject</p>
                <h3>{preview.subject}</h3>
                <iframe title="Email preview" srcDoc={preview.html} />
              </div>
            ) : (
              <div className="admin-empty">
                Save or preview a broadcast to see the email layout.
              </div>
            )}
          </div>
        </div>

        {sendResults && (
          <div className="admin-card admin-table-card">
            <div className="admin-table-header">
              <h2>Send results</h2>
              <span className="admin-badge">
                {sendResults.sentCount || 0} sent / {sendResults.failedCount || 0} failed
              </span>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Provider ID</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {(recipientLogs.length ? recipientLogs : sendResults.results || []).map((row) => (
                    <tr key={row.id || row.email}>
                      <td>{row.recipient_email || row.email}</td>
                      <td>{row.status}</td>
                      <td>{row.provider_message_id || row.providerMessageId || "-"}</td>
                      <td>{row.error_message || row.error || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="admin-card admin-table-card">
          <div className="admin-table-header">
            <h2>Broadcast history</h2>
          </div>

          {isLoading ? (
            <div className="admin-empty">Loading broadcasts...</div>
          ) : broadcasts.length === 0 ? (
            <div className="admin-empty">No email broadcasts yet.</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Group</th>
                    <th>Status</th>
                    <th>Recipients</th>
                    <th>Sent</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {broadcasts.map((broadcast) => (
                    <tr key={broadcast.id}>
                      <td>
                        <strong>{broadcast.title}</strong>
                        <small>{broadcast.subject}</small>
                      </td>
                      <td>{getGroupLabel(broadcast.recipient_group)}</td>
                      <td>
                        <span className="admin-badge">{broadcast.status}</span>
                      </td>
                      <td>{broadcast.total_recipients || 0}</td>
                      <td>
                        {broadcast.sent_count || 0} sent
                        {broadcast.failed_count ? `, ${broadcast.failed_count} failed` : ""}
                      </td>
                      <td>{formatDate(broadcast.created_at)}</td>
                      <td>
                        <div className="abandoned-cart-actions">
                          <button
                            type="button"
                            className="admin-button secondary"
                            onClick={() => handleEditDraft(broadcast)}
                          >
                            <Mail size={15} />
                            View
                          </button>
                          {broadcast.status === "draft" && (
                            <button
                              type="button"
                              className="admin-button danger"
                              onClick={() => handleDeleteDraft(broadcast)}
                            >
                              <Trash2 size={15} />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

