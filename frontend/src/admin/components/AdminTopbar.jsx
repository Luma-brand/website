import { Link } from "react-router-dom";
import { Menu, Settings, UserRound } from "lucide-react";

export function AdminTopbar({ title, subtitle, description, actions }) {
  const adminUser = JSON.parse(localStorage.getItem("luma_admin_user") || "{}");

  function openMobileMenu() {
    window.dispatchEvent(new CustomEvent("luma-admin-menu-open"));
  }

  return (
    <header className="admin-topbar">
      <div className="admin-topbar-title">
        <button
          type="button"
          className="admin-mobile-menu"
          onClick={openMobileMenu}
          aria-label="Open admin navigation"
        >
          <Menu size={20} />
        </button>

        <div>
          <h1>{title}</h1>
          {(subtitle || description) && <p>{subtitle || description}</p>}
        </div>
      </div>

      <div className="admin-topbar-actions">
        {actions && <div className="admin-page-actions">{actions}</div>}
        <Link
          to="/luma-control-room/settings"
          className="admin-icon-button"
          aria-label="Open admin settings"
        >
          <Settings size={18} />
        </Link>

        <div className="admin-profile-pill">
          <UserRound size={16} />
          <span>{adminUser?.email || "LUMA Admin"}</span>
        </div>
      </div>
    </header>
  );
}
