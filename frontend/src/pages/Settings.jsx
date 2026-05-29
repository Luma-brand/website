import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useAuth } from "../context/AuthContext";

export function Settings() {
  const { user, isAuthenticated, updateUser } = useAuth();

  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    beautyFocus: user?.beautyFocus || "Brows",
    marketing: true,
    launchUpdates: true,
  });

  const [saved, setSaved] = useState(false);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));

    setSaved(false);
  }

  function handleSubmit(event) {
    event.preventDefault();

    updateUser({
      name: formData.name,
      email: formData.email,
      beautyFocus: formData.beautyFocus,
      marketing: formData.marketing,
      launchUpdates: formData.launchUpdates,
    });

    setSaved(true);
  }

  return (
    <main className="page-shell inner-page">
      <Header />

      <section className="account-page">
        <div className="commerce-heading">
          <Link to="/account" className="back-link">
            <ArrowLeft size={17} />
            Back to account
          </Link>

          <p className="eyebrow">Settings</p>
          <h1>Personalize your LUMA profile.</h1>
          <p>
            Manage account details, beauty focus, and update preferences. Saved
            locally for now until backend accounts are connected.
          </p>
        </div>

        {!isAuthenticated ? (
          <div className="empty-state">
            <h2>You need an account first.</h2>
            <p>Create a LUMA account before editing settings.</p>
            <Link to="/account" className="btn btn-primary">
              Go to account
            </Link>
          </div>
        ) : (
          <form className="settings-card" onSubmit={handleSubmit}>
            <div className="form-grid two">
              <div className="form-field">
                <label htmlFor="settings-name">Name</label>
                <input
                  id="settings-name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>

              <div className="form-field">
                <label htmlFor="settings-email">Email</label>
                <input
                  id="settings-email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="settings-focus">Beauty focus</label>
              <select
                id="settings-focus"
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

            <div className="settings-options">
              <label>
                <input
                  type="checkbox"
                  name="marketing"
                  checked={formData.marketing}
                  onChange={handleChange}
                />
                <span>Receive beauty tips and soft ritual content</span>
              </label>

              <label>
                <input
                  type="checkbox"
                  name="launchUpdates"
                  checked={formData.launchUpdates}
                  onChange={handleChange}
                />
                <span>Receive product launch and restock updates</span>
              </label>
            </div>

            <button type="submit" className="waitlist-button">
              Save settings
              <Save size={17} />
            </button>

            {saved && <p className="settings-saved">Settings saved successfully.</p>}
          </form>
        )}
      </section>

      <Footer />
    </main>
  );
}