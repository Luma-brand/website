import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Mail,
  Package,
  ShoppingBag,
  FileText,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  {
    label: "Overview",
    path: "/luma-control-room/dashboard",
  },
  {
    label: "Waitlist",
    path: "/luma-control-room/waitlist",
  },
  {
    label: "Enquiries",
    path: "/luma-control-room/enquiries",
  },
  {
    label: "Products",
    path: "/luma-control-room/products",
  },
  {
    label: "Orders",
    path: "/luma-control-room/orders",
  },
  {
    label: "Website content",
    path: "/luma-control-room/content",
  },
  {
    label: "Admin settings",
    path: "/luma-control-room/settings",
  },
];
export function AdminSidebar() {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("luma_admin_token");
    localStorage.removeItem("luma_admin_user");
    navigate("/luma-control-room/login");
  }

  return (
    <aside className="admin-sidebar">
      <div className="admin-logo">
        <span>Control Panel</span>
        <h2>LUMA Admin</h2>
      </div>

      <nav className="admin-nav">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink key={item.path} to={item.path}>
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <button type="button" className="admin-logout" onClick={handleLogout}>
        <LogOut size={18} />
        Logout
      </button>
    </aside>
  );
}