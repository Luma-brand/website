import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import "../admin.css";

const ADMIN_LOGIN_PATH = "/luma-control-room/login";

export function AdminLayout() {
  const token = localStorage.getItem("luma_admin_token");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    function openSidebar() {
      setIsMobileSidebarOpen(true);
    }

    window.addEventListener("luma-admin-menu-open", openSidebar);

    return () => {
      window.removeEventListener("luma-admin-menu-open", openSidebar);
    };
  }, []);

  if (!token) {
    return <Navigate to={ADMIN_LOGIN_PATH} replace />;
  }

  return (
    <div className={isMobileSidebarOpen ? "admin-shell sidebar-open" : "admin-shell"}>
      <button
        type="button"
        className="admin-sidebar-backdrop"
        aria-label="Close admin navigation"
        onClick={() => setIsMobileSidebarOpen(false)}
      />

      <AdminSidebar onClose={() => setIsMobileSidebarOpen(false)} />

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
