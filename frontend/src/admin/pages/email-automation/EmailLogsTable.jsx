export function EmailLogsTable({ logs = [], isLoading }) {
  if (isLoading) return <div className="admin-empty">Loading email logs...</div>;
  if (!logs.length) return <div className="admin-empty">No email logs have been recorded yet.</div>;

  return (
    <div className="admin-card admin-table-card">
      <div className="admin-table-header">
        <h2>Recent email logs</h2>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Recipient</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{String(log.type || log.email_type || "email").replaceAll("_", " ")}</td>
                <td>{log.recipient || log.recipient_email || "-"}</td>
                <td>{log.subject || "-"}</td>
                <td><span className="admin-badge">{log.status || "unknown"}</span></td>
                <td>{log.created_at ? new Date(log.created_at).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
