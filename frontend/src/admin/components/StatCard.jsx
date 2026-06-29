export function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="admin-card stat-card">
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
      {Icon && (
        <span className="stat-card-icon" aria-hidden="true">
          <Icon size={18} />
        </span>
      )}
    </div>
  );
}
