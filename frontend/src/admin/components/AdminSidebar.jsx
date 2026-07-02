import { NavLink, useNavigate } from "react-router-dom";
import {
  BadgePercent,
  BarChart3,
  Bell,
  CreditCard,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Truck,
  TrendingUp,
  Workflow,
  UserRound,
  Users,
  Warehouse,
  X,
} from "lucide-react";

const navGroups = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        path: "/luma-control-room/dashboard",
        icon: LayoutDashboard,
      },
      {
        label: "Analytics",
        path: "/luma-control-room/analytics",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Store",
    items: [
      {
        label: "Products",
        path: "/luma-control-room/products",
        icon: Package,
      },
      {
        label: "Product sales",
        path: "/luma-control-room/product-sales",
        icon: Sparkles,
      },
      {
        label: "Orders",
        path: "/luma-control-room/orders",
        icon: ShoppingBag,
      },
      {
        label: "Discounts",
        path: "/luma-control-room/discounts",
        icon: BadgePercent,
      },
      {
        label: "Currency rates",
        path: "/luma-control-room/currency-rates",
        icon: CircleDollarSign,
      },
    ],
  },
  {
    label: "Customers",
    items: [
      {
        label: "Customers",
        path: "/luma-control-room/customers",
        icon: UserRound,
      },
      {
        label: "Waitlist",
        path: "/luma-control-room/waitlist",
        icon: Users,
      },
      {
        label: "Enquiries",
        path: "/luma-control-room/enquiries",
        icon: Mail,
      },
      {
        label: "Mail",
        path: "/luma-control-room/mail",
        icon: Mail,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        label: "Inventory",
        path: "/luma-control-room/inventory",
        icon: Warehouse,
      },
      {
        label: "Delivery",
        path: "/luma-control-room/delivery",
        icon: Truck,
      },
    ],
  },
  {
    label: "Growth",
    items: [
      {
        label: "Growth tools",
        path: "/luma-control-room/growth",
        icon: TrendingUp,
      },
      {
        label: "Email broadcasts",
        path: "/luma-control-room/email-broadcasts",
        icon: Mail,
      },
      {
        label: "Automations",
        path: "/luma-control-room/automations",
        icon: Workflow,
      },

      {
        label: "Abandoned carts",
        path: "/luma-control-room/abandoned-carts",
        icon: ShoppingCart,
      },
      {
        label: "Abandoned checkouts",
        path: "/luma-control-room/abandoned-checkouts",
        icon: CreditCard,
      },
      {
        label: "Product waitlists",
        path: "/luma-control-room/product-waitlists",
        icon: Bell,
      },
    ],
  },
  {
    label: "Manage",
    items: [
      {
        label: "Website content",
        path: "/luma-control-room/content",
        icon: FileText,
      },
      {
        label: "Settings",
        path: "/luma-control-room/settings",
        icon: Settings,
      },
    ],
  },
];

export function AdminSidebar({ isCollapsed, onCollapse, onClose }) {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("luma_admin_token");
    localStorage.removeItem("luma_admin_user");
    onClose?.();
    navigate("/luma-control-room/login");
  }

  return (
    <aside className="admin-sidebar" aria-label="Admin navigation">
      <div className="admin-sidebar-top">
        <div className="admin-logo" aria-label="LUMA Control Room">
          <span>Control Room</span>
          <h2>LUMA</h2>
        </div>

        <div className="admin-sidebar-controls">
          <button
            type="button"
            className="admin-sidebar-collapse"
            onClick={onCollapse}
            aria-label={isCollapsed ? "Expand admin navigation" : "Collapse admin navigation"}
            title={isCollapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button
            type="button"
            className="admin-sidebar-close"
            onClick={onClose}
            aria-label="Close admin navigation"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <nav className="admin-nav">
        {navGroups.map((group) => (
          <section className="admin-nav-group" key={group.label}>
            <p>{group.label}</p>

            {group.items.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  title={isCollapsed ? item.label : undefined}
                  aria-label={item.label}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </section>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <button type="button" className="admin-logout" onClick={handleLogout} title={isCollapsed ? "Logout" : undefined}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}







