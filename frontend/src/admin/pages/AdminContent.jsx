import { AdminTopbar } from "../components/AdminTopbar";

export function AdminContent() {
  return (
    <>
      <AdminTopbar
        title="Website Content"
        subtitle="Review the content management area for future homepage and store edits."
      />

      <section className="admin-content">
        <div className="admin-card admin-empty">
          Content controls are not connected yet. Keep editing product, order,
          growth, and inventory data from the active admin sections for now.
        </div>
      </section>
    </>
  );
}
