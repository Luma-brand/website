import { AdminTopbar } from "../components/AdminTopbar";

export function AdminSettings() {
  const adminUser = JSON.parse(localStorage.getItem("luma_admin_user") || "{}");

  return (
    <>
      <AdminTopbar
        title="Settings"
        subtitle="View admin account and dashboard preferences."
      />

      <section className="admin-content">
        <div className="admin-card">
          <h2>Admin account</h2>
          <p>
            <strong>Email:</strong> {adminUser?.email || "—"}
          </p>
          <p>
            <strong>Role:</strong> {adminUser?.role || "admin"}
          </p>
        </div>
      </section>
    </>
  );
}