export function AdminTopbar({ title, subtitle }) {
  const adminUser = JSON.parse(localStorage.getItem("luma_admin_user") || "{}");

  return (
    <header className="admin-topbar">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>

      <div className="admin-profile-pill">
        {adminUser?.email || "LUMA Admin"}
      </div>
    </header>
  );
}