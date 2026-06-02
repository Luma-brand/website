import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { loginAdmin } from "../../services/api";
import "../admin.css";

export function AdminLogin() {
  const navigate = useNavigate();
  const token = localStorage.getItem("luma_admin_token");

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (token) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError("");

      const response = await loginAdmin(formData);

      localStorage.setItem("luma_admin_token", response.token);
      localStorage.setItem("luma_admin_user", JSON.stringify(response.admin));

      navigate("/admin/dashboard");
    } catch (error) {
      setError(error.message || "Unable to login. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="admin-login-page">
      <div className="admin-login-card">
        <h1>LUMA Admin</h1>
        <p>Sign in to manage waitlist users, enquiries, and store activity.</p>

        <form className="admin-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              name="email"
              placeholder="admin@luma.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              placeholder="Enter password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </label>

          {error && <div className="admin-error">{error}</div>}

          <button type="submit" className="admin-button" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
            <ArrowUpRight size={16} />
          </button>
        </form>
      </div>
    </section>
  );
}