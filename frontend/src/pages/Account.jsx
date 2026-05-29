import { useState } from "react";
import { OrderHistory } from "../components/account/OrderHistory";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  LogOut,
  Settings as SettingsIcon,
  UserRound,
} from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const initialForm = {
  name: "",
  email: "",
  password: "",
  beautyFocus: "Brows",
};

export function Account() {
  const { user, isAuthenticated, signUp, signIn, signOut } = useAuth();
  const { orders } = useCart();

  const [mode, setMode] = useState("signup");
  const [formData, setFormData] = useState(initialForm);
  const [errors, setErrors] = useState({});

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => ({
      ...current,
      [name]: "",
    }));
  }

  function validate() {
    const nextErrors = {};

    if (mode === "signup" && !formData.name.trim()) {
      nextErrors.name = "Name is required.";
    }

    if (!formData.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      nextErrors.email = "Enter a valid email.";
    }

    if (!formData.password.trim()) {
      nextErrors.password = "Password is required.";
    } else if (formData.password.length < 6) {
      nextErrors.password = "Use at least 6 characters.";
    }

    return nextErrors;
  }

  function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validate();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (mode === "signup") {
      signUp(formData);
    } else {
      signIn(formData);
    }

    setFormData(initialForm);
  }

  return (
    <main className="page-shell inner-page">
      <Header />

      <section className="account-page">
        <div className="commerce-heading">
          <p className="eyebrow">LUMA account</p>
          <h1>Your beauty shelf, saved.</h1>
          <p>
            Create an account-style profile for saved cart, beauty preferences,
            and future order history. This is local frontend auth for now.
          </p>
        </div>

        {isAuthenticated ? (
          <div className="account-dashboard">
            <div className="profile-card">
              <div className="profile-avatar">
                <UserRound size={30} />
              </div>

              <p className="eyebrow">Signed in</p>
              <h2>{user.name}</h2>
              <p>{user.email}</p>

              <div className="profile-tags">
                <span>{user.beautyFocus}</span>
                <span>LUMA member</span>
              </div>

              <div className="profile-actions">
                <Link to="/settings" className="btn btn-primary">
                  Settings
                  <SettingsIcon size={18} />
                </Link>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={signOut}
                >
                  Sign out
                  <LogOut size={18} />
                </button>
              </div>
            </div>

            <div className="account-panel">
              <h2>Account overview</h2>

              <div className="overview-grid">
                <div>
                  <span>Orders</span>
                  <strong>{orders.length}</strong>
                  <p>Frontend checkout orders saved in your browser.</p>
                </div>

                <div>
                  <span>Saved routine</span>
                  <strong>{user.beautyFocus}</strong>
                  <p>Used to personalize product suggestions.</p>
                </div>

                <div>
                  <span>Checkout</span>
                  <strong>Ready</strong>
                  <p>Your email can prefill checkout forms.</p>
                </div>
              </div>
            </div>

            <OrderHistory />
          </div>
        ) : (
          <div className="auth-layout">
            <div className="auth-card">
              <div className="auth-switch">
                <button
                  type="button"
                  className={mode === "signup" ? "active" : ""}
                  onClick={() => setMode("signup")}
                >
                  Sign up
                </button>

                <button
                  type="button"
                  className={mode === "signin" ? "active" : ""}
                  onClick={() => setMode("signin")}
                >
                  Sign in
                </button>
              </div>

              <form className="waitlist-form" onSubmit={handleSubmit} noValidate>
                {mode === "signup" && (
                  <div className="form-field">
                    <label htmlFor="name">Name</label>
                    <input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your name"
                    />
                    {errors.name && <small>{errors.name}</small>}
                  </div>
                )}

                <div className="form-field">
                  <label htmlFor="account-email">Email</label>
                  <input
                    id="account-email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                  />
                  {errors.email && <small>{errors.email}</small>}
                </div>

                <div className="form-field">
                  <label htmlFor="account-password">Password</label>
                  <input
                    id="account-password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Minimum 6 characters"
                  />
                  {errors.password && <small>{errors.password}</small>}
                </div>

                {mode === "signup" && (
                  <div className="form-field">
                    <label htmlFor="beautyFocus">Beauty focus</label>
                    <select
                      id="beautyFocus"
                      name="beautyFocus"
                      value={formData.beautyFocus}
                      onChange={handleChange}
                    >
                      <option>Brows</option>
                      <option>Lashes</option>
                      <option>Edges</option>
                      <option>Full LUMA system</option>
                    </select>
                  </div>
                )}

                <button type="submit" className="waitlist-button">
                  {mode === "signup" ? "Create account" : "Sign in"}
                  <ArrowRight size={17} />
                </button>
              </form>
            </div>

            <div className="auth-note">
              <p className="eyebrow">Frontend note</p>
              <h2>Real auth comes later.</h2>
              <p>
                This page behaves like account creation, but it stores the user
                locally in the browser. Later, connect Supabase, Firebase,
                Clerk, NextAuth, or your own backend.
              </p>
            </div>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}