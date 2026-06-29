import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AdminTopbar } from "../components/AdminTopbar";
import {
  changeAdminPassword,
  getAdminSecuritySettings,
  requestAdminPasswordChange,
  revokeAdminSession,
  revokeAllAdminSessions,
  revokeOtherAdminSessions,
  updateAdminProfile,
  verifyAdminPasswordCode,
} from "../../services/api";

const tabs = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "devices", label: "Devices" },
  { id: "activity", label: "Activity" },
  { id: "integrations", label: "Status" },
];

const initialPasswordForm = {
  currentPassword: "",
  code: "",
  newPassword: "",
  confirmPassword: "",
};

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getAdminFromStorage() {
  try {
    return JSON.parse(localStorage.getItem("luma_admin_user") || "{}");
  } catch {
    return {};
  }
}

function clearAdminSessionAndRedirect(navigate) {
  localStorage.removeItem("luma_admin_token");
  localStorage.removeItem("luma_admin_user");
  navigate("/luma-control-room/login");
}

function StatusBadge({ active, children }) {
  return (
    <span className={`admin-security-badge ${active ? "is-on" : "is-off"}`}>
      {children}
    </span>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
}) {
  return (
    <label className="admin-form-field admin-password-field">
      <span>{label}</span>
      <div className="admin-password-input">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
        />
        <button type="button" onClick={onToggle} aria-label={`Toggle ${label}`}>
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  );
}

export function AdminSettings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [error, setError] = useState("");
  const [profileName, setProfileName] = useState("");
  const [passwordForm, setPasswordForm] = useState(initialPasswordForm);
  const [visiblePasswords, setVisiblePasswords] = useState({});

  const adminUser = useMemo(() => getAdminFromStorage(), []);
  const profile = overview?.profile || adminUser;
  const sessions = overview?.sessions || [];
  const securityEvents = overview?.securityEvents || [];
  const configGroups = overview?.configStatus?.groups || [];
  const currentSession = sessions.find((session) => session.is_current);
  const activeSessions = sessions.filter((session) => !session.is_revoked);

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await getAdminSecuritySettings();
      const data = response.data || {};
      setOverview(data);
      setProfileName(data.profile?.full_name || adminUser?.full_name || "");
    } catch (error) {
      setError(error.message || "Failed to load admin settings.");
    } finally {
      setIsLoading(false);
    }
  }, [adminUser?.full_name]);

  useEffect(() => {
    queueMicrotask(() => {
      loadSettings();
    });
  }, [loadSettings]);

  const updatePasswordForm = (field, value) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
    setActionMessage("");
    setError("");
  };

  const togglePasswordVisibility = (field) => {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }));
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();

    try {
      setIsSavingProfile(true);
      setActionMessage("");
      setError("");

      const response = await updateAdminProfile({ fullName: profileName });
      const updatedProfile = response.data;
      localStorage.setItem(
        "luma_admin_user",
        JSON.stringify({ ...adminUser, ...updatedProfile })
      );
      setOverview((current) => ({ ...current, profile: updatedProfile }));
      setActionMessage("Admin profile updated.");
    } catch (error) {
      setError(error.message || "Failed to update admin profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSendCode = async (event) => {
    event.preventDefault();

    try {
      setIsSendingCode(true);
      setActionMessage("");
      setError("");
      const response = await requestAdminPasswordChange({
        currentPassword: passwordForm.currentPassword,
      });
      setActionMessage(
        `Verification code sent to ${response.data?.email || "the admin email"}.`
      );
    } catch (error) {
      setError(error.message || "Failed to send verification code.");
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    try {
      setIsVerifyingCode(true);
      setActionMessage("");
      setError("");
      await verifyAdminPasswordCode({ code: passwordForm.code });
      setActionMessage("Verification code confirmed.");
    } catch (error) {
      setError(error.message || "Failed to verify code.");
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();

    try {
      setIsChangingPassword(true);
      setActionMessage("");
      setError("");
      await changeAdminPassword({
        code: passwordForm.code,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      });
      setPasswordForm(initialPasswordForm);
      setActionMessage(
        "Password changed successfully. Other admin sessions were logged out."
      );
      loadSettings();
    } catch (error) {
      setError(error.message || "Failed to change password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRevokeSession = async (session) => {
    const confirmed = window.confirm(
      session.is_current
        ? "Revoke this current device and return to admin login?"
        : "Revoke this admin session?"
    );

    if (!confirmed) return;

    try {
      setActionMessage("");
      setError("");
      await revokeAdminSession(session.id);

      if (session.is_current) {
        clearAdminSessionAndRedirect(navigate);
        return;
      }

      setActionMessage("Admin session revoked.");
      loadSettings();
    } catch (error) {
      setError(error.message || "Failed to revoke session.");
    }
  };

  const handleRevokeOthers = async () => {
    if (!window.confirm("Log out every other admin device?")) return;

    try {
      setActionMessage("");
      setError("");
      await revokeOtherAdminSessions();
      setActionMessage("Other admin sessions were logged out.");
      loadSettings();
    } catch (error) {
      setError(error.message || "Failed to revoke other sessions.");
    }
  };

  const handleRevokeAll = async () => {
    if (!window.confirm("Log out all admin devices, including this one?")) return;

    try {
      setActionMessage("");
      setError("");
      await revokeAllAdminSessions();
      clearAdminSessionAndRedirect(navigate);
    } catch (error) {
      setError(error.message || "Failed to revoke all sessions.");
    }
  };

  return (
    <>
      <AdminTopbar
        title="Settings"
        subtitle="Manage admin profile, sessions, password security, and production readiness."
      />

      <section className="admin-content admin-settings-page">
        {actionMessage && <div className="admin-success">{actionMessage}</div>}
        {error && <div className="admin-error">{error}</div>}

        <div className="admin-settings-tabs" role="tablist" aria-label="Settings sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="admin-empty">Loading admin security settings...</div>
        ) : (
          <>
            {activeTab === "profile" && (
              <div className="admin-settings-grid">
                <div className="admin-card admin-security-card">
                  <div className="admin-section-heading">
                    <UserRound size={20} />
                    <div>
                      <h2>Admin profile</h2>
                      <p>Basic account details for the active admin user.</p>
                    </div>
                  </div>

                  <form className="admin-form-grid" onSubmit={handleProfileSave}>
                    <label className="admin-form-field">
                      <span>Full name</span>
                      <input
                        value={profileName}
                        onChange={(event) => setProfileName(event.target.value)}
                      />
                    </label>

                    <label className="admin-form-field">
                      <span>Email</span>
                      <input value={profile?.email || ""} disabled />
                    </label>

                    <label className="admin-form-field">
                      <span>Role</span>
                      <input value={profile?.role || "admin"} disabled />
                    </label>

                    <button
                      type="submit"
                      className="admin-button"
                      disabled={isSavingProfile}
                    >
                      {isSavingProfile ? "Saving..." : "Save profile"}
                    </button>
                  </form>
                </div>

                <div className="admin-card admin-security-card">
                  <div className="admin-section-heading">
                    <ShieldCheck size={20} />
                    <div>
                      <h2>Account timeline</h2>
                      <p>Security-relevant dates for this admin account.</p>
                    </div>
                  </div>

                  <dl className="admin-detail-list">
                    <div>
                      <dt>Created</dt>
                      <dd>{formatDate(profile?.created_at)}</dd>
                    </div>
                    <div>
                      <dt>Last login</dt>
                      <dd>{formatDate(profile?.last_login_at)}</dd>
                    </div>
                    <div>
                      <dt>Password changed</dt>
                      <dd>{formatDate(profile?.password_changed_at)}</dd>
                    </div>
                    <div>
                      <dt>Current session</dt>
                      <dd>{currentSession?.device_label || "Not tracked yet"}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="admin-settings-grid">
                <form className="admin-card admin-security-card" onSubmit={handleSendCode}>
                  <div className="admin-section-heading">
                    <KeyRound size={20} />
                    <div>
                      <h2>Request verification code</h2>
                      <p>Confirm your current password before a code is emailed.</p>
                    </div>
                  </div>

                  <PasswordInput
                    label="Current password"
                    value={passwordForm.currentPassword}
                    onChange={(value) => updatePasswordForm("currentPassword", value)}
                    visible={visiblePasswords.currentPassword}
                    onToggle={() => togglePasswordVisibility("currentPassword")}
                    autoComplete="current-password"
                  />

                  <button
                    type="submit"
                    className="admin-button"
                    disabled={isSendingCode}
                  >
                    {isSendingCode ? "Sending..." : "Send verification code"}
                  </button>
                </form>

                <form className="admin-card admin-security-card" onSubmit={handleChangePassword}>
                  <div className="admin-section-heading">
                    <LockKeyhole size={20} />
                    <div>
                      <h2>Change password</h2>
                      <p>Use the emailed code and a new password of at least 8 characters.</p>
                    </div>
                  </div>

                  <label className="admin-form-field">
                    <span>Verification code</span>
                    <div className="admin-inline-control">
                      <input
                        value={passwordForm.code}
                        onChange={(event) =>
                          updatePasswordForm("code", event.target.value)
                        }
                        inputMode="numeric"
                        autoComplete="one-time-code"
                      />
                      <button
                        type="button"
                        className="admin-button secondary"
                        onClick={handleVerifyCode}
                        disabled={isVerifyingCode}
                      >
                        {isVerifyingCode ? "Checking..." : "Verify"}
                      </button>
                    </div>
                  </label>

                  <PasswordInput
                    label="New password"
                    value={passwordForm.newPassword}
                    onChange={(value) => updatePasswordForm("newPassword", value)}
                    visible={visiblePasswords.newPassword}
                    onToggle={() => togglePasswordVisibility("newPassword")}
                    autoComplete="new-password"
                  />

                  <PasswordInput
                    label="Confirm new password"
                    value={passwordForm.confirmPassword}
                    onChange={(value) =>
                      updatePasswordForm("confirmPassword", value)
                    }
                    visible={visiblePasswords.confirmPassword}
                    onToggle={() => togglePasswordVisibility("confirmPassword")}
                    autoComplete="new-password"
                  />

                  <button
                    type="submit"
                    className="admin-button"
                    disabled={isChangingPassword}
                  >
                    {isChangingPassword ? "Changing..." : "Change password"}
                  </button>
                </form>
              </div>
            )}

            {activeTab === "devices" && (
              <div className="admin-card admin-table-card admin-security-card">
                <div className="admin-table-header">
                  <div className="admin-section-heading">
                    <Laptop size={20} />
                    <div>
                      <h2>Logged-in devices</h2>
                      <p>Review and revoke admin sessions created by successful logins.</p>
                    </div>
                  </div>

                  <div className="admin-action-row">
                    <button
                      type="button"
                      className="admin-button secondary"
                      onClick={loadSettings}
                    >
                      <RefreshCcw size={16} />
                      Refresh
                    </button>
                    <button
                      type="button"
                      className="admin-button secondary"
                      onClick={handleRevokeOthers}
                      disabled={activeSessions.length < 2}
                    >
                      Log out others
                    </button>
                    <button
                      type="button"
                      className="admin-button danger"
                      onClick={handleRevokeAll}
                      disabled={activeSessions.length === 0}
                    >
                      Log out all
                    </button>
                  </div>
                </div>

                {sessions.length === 0 ? (
                  <div className="admin-empty">
                    No admin sessions are tracked yet. New logins will appear here after the Phase 9 migration is applied.
                  </div>
                ) : (
                  <div className="admin-session-list">
                    {sessions.map((session) => (
                      <article className="admin-session-card" key={session.id}>
                        <div>
                          <div className="admin-session-title">
                            <strong>{session.device_label}</strong>
                            {session.is_current && (
                              <StatusBadge active>Current device</StatusBadge>
                            )}
                            {session.is_revoked && (
                              <StatusBadge active={false}>Revoked</StatusBadge>
                            )}
                          </div>
                          <p>
                            {session.ip_address || "IP not captured"} - Login{" "}
                            {formatDate(session.created_at)}
                          </p>
                          <p>Last active {formatDate(session.last_active_at)}</p>
                        </div>

                        <button
                          type="button"
                          className="admin-button secondary"
                          onClick={() => handleRevokeSession(session)}
                          disabled={session.is_revoked}
                        >
                          <Trash2 size={16} />
                          Revoke
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "activity" && (
              <div className="admin-card admin-table-card admin-security-card">
                <div className="admin-table-header">
                  <div className="admin-section-heading">
                    <ShieldCheck size={20} />
                    <div>
                      <h2>Security activity</h2>
                      <p>Recent logins, password requests, and session changes.</p>
                    </div>
                  </div>
                </div>

                {securityEvents.length === 0 ? (
                  <div className="admin-empty">No security activity recorded yet.</div>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Event</th>
                          <th>IP address</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {securityEvents.map((event) => (
                          <tr key={event.id}>
                            <td>{event.event_type?.replaceAll("_", " ")}</td>
                            <td>{event.ip_address || "Not captured"}</td>
                            <td>{formatDate(event.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "integrations" && (
              <div className="admin-card admin-table-card admin-security-card">
                <div className="admin-table-header">
                  <div className="admin-section-heading">
                    <CheckCircle2 size={20} />
                    <div>
                      <h2>Integration status</h2>
                      <p>Configuration readiness without exposing secret keys.</p>
                    </div>
                  </div>
                </div>

                {configGroups.length === 0 ? (
                  <div className="admin-empty">Configuration status is not available.</div>
                ) : (
                  <div className="admin-config-groups">
                    {configGroups.map((group) => (
                      <div className="admin-config-group" key={group.key}>
                        <h3>{group.label}</h3>
                        <div className="admin-config-list">
                          {group.items.map((item) => (
                            <div className="admin-config-item" key={item.key}>
                              <span>{item.label}</span>
                              <StatusBadge active={item.configured}>
                                {item.configured ? "Configured" : "Missing"}
                              </StatusBadge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
