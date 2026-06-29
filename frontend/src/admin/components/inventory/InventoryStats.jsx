export function InventoryStats() {
  return (
    <div className="admin-grid">
      <article className="admin-card stat-card">
        <small>Total products</small>
        <strong>--</strong>
      </article>

      <article className="admin-card stat-card">
        <small>Low stock</small>
        <strong>--</strong>
      </article>

      <article className="admin-card stat-card">
        <small>Out of stock</small>
        <strong>--</strong>
      </article>

      <article className="admin-card stat-card">
        <small>Low-stock threshold</small>
        <strong>20</strong>
      </article>
    </div>
  );
}
