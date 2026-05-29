export function PageSkeleton() {
  return (
    <div className="page-skeleton" aria-hidden="true">
      <div className="skeleton-shell">
        <div className="skeleton-line skeleton-line-small" />
        <div className="skeleton-line skeleton-line-large" />
        <div className="skeleton-line skeleton-line-medium" />

        <div className="skeleton-grid">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      </div>
    </div>
  );
}