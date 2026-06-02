import { AdminTopbar } from "../components/AdminTopbar";

export function AdminContent() {
  return (
    <>
      <AdminTopbar
        title="Website Content"
        subtitle="Manage homepage and store content later."
      />

      <section className="admin-content">
        <div className="admin-card admin-empty">
          Website content controls will be added later.
        </div>
      </section>
    </>
  );
}