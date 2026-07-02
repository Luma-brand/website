import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import "../admin.css";

const ADMIN_LOGIN_PATH = "/luma-control-room/login";

export function AdminLayout() {
  const token = localStorage.getItem("luma_admin_token");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem("luma_admin_sidebar_collapsed") === "true";
  });

  useEffect(() => {
    function openSidebar() {
      setIsMobileSidebarOpen(true);
    }

    window.addEventListener("luma-admin-menu-open", openSidebar);

    return () => {
      window.removeEventListener("luma-admin-menu-open", openSidebar);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("admin-menu-open", isMobileSidebarOpen);

    return () => {
      document.body.classList.remove("admin-menu-open");
    };
  }, [isMobileSidebarOpen]);

  function toggleSidebar() {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem("luma_admin_sidebar_collapsed", String(next));
      return next;
    });
  }

  if (!token) {
    return <Navigate to={ADMIN_LOGIN_PATH} replace />;
  }

  return (
    <div
      className={[
        "admin-shell",
        isMobileSidebarOpen ? "sidebar-open" : "",
        isSidebarCollapsed ? "sidebar-collapsed" : "",
      ].filter(Boolean).join(" ")}
    >
      <button
        type="button"
        className="admin-sidebar-backdrop"
        aria-label="Close admin navigation"
        onClick={() => setIsMobileSidebarOpen(false)}
      />

      <AdminSidebar
        isCollapsed={isSidebarCollapsed}
        onCollapse={toggleSidebar}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
