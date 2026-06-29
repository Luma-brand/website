export function EmailAutomationSettings({ overview }) {
  const settings = overview?.settings || {};
  const emailConfig = overview?.emailConfig || {};

  return (
    <div className="admin-card">
      <div className="admin-table-header">
        <h2>Automation settings</h2>
      </div>
      <div className="admin-detail-grid">
        <span>Reminder delay</span>
        <strong>{settings.delayMinutes || 0} minutes</strong>
        <span>Maximum reminders</span>
        <strong>{settings.maxEmails || 0}</strong>
        <span>Resend configured</span>
        <strong>{emailConfig.resendConfigured ? "Configured" : "Needs API key"}</strong>
        <span>Sender configured</span>
        <strong>{emailConfig.emailFromConfigured ? "Configured" : "Needs EMAIL_FROM"}</strong>
        <span>Cron endpoint</span>
        <strong>{settings.cronEndpoint || "Set BACKEND_URL"}</strong>
        <span>Resend webhook</span>
        <strong>{settings.resendWebhookEndpoint || "Set BACKEND_URL"}</strong>
      </div>
    </div>
  );
}
