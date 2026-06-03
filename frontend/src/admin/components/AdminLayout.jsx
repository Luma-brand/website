import { Navigate, Outlet } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import "../admin.css";

const ADMIN_LOGIN_PATH = "/luma-control-room/login";

export function AdminLayout() {
  const token = localStorage.getItem("luma_admin_token");

  if (!token) {
    return <Navigate to={ADMIN_LOGIN_PATH} replace />;
  }

  return (
    <div className="admin-shell">
      <AdminSidebar />

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}