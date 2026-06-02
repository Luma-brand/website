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
    path: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Waitlist",
    path: "/admin/waitlist",
    icon: Users,
  },
  {
    label: "Enquiries",
    path: "/admin/enquiries",
    icon: Mail,
  },
  {
    label: "Products",
    path: "/admin/products",
    icon: Package,
  },
  {
    label: "Orders",
    path: "/admin/orders",
    icon: ShoppingBag,
  },
  {
    label: "Website Content",
    path: "/admin/content",
    icon: FileText,
  },
  {
    label: "Settings",
    path: "/admin/settings",
    icon: Settings,
  },
];

export function AdminSidebar() {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("luma_admin_token");
    localStorage.removeItem("luma_admin_user");
    navigate("/admin/login");
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