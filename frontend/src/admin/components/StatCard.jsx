export function StatCard({ label, value }) {
  return (
    <div className="admin-card stat-card">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}