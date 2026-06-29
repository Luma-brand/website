import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useAuth } from "../context/AuthContext";

export function Settings() {
  const { user, isAuthenticated, updateUser } = useAuth();

  const [formData, setFormData] = useState({
    name: user?.name || user?.full_name || user?.user_metadata?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    customerType: user?.customer_type || "regular_customer",
    lumaUseCase: user?.luma_use_case || "",
    referralSource: user?.referral_source || "",
    marketing: user?.marketing_opt_in !== false,
    launchUpdates: true,
  });

  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState("");

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));

    setSaved(false);
    setServerError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      await updateUser({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        customerType: formData.customerType,
        lumaUseCase: formData.lumaUseCase,
        referralSource: formData.referralSource,
        marketing: formData.marketing,
        launchUpdates: formData.launchUpdates,
      });

      setSaved(true);
    } catch (error) {
      setServerError(error.message || "Unable to save settings.");
    }
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
            Manage account details, contact information, and update preferences.
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

            <div className="form-grid two">
              <div className="form-field">
                <label htmlFor="settings-phone">Phone</label>
                <input
                  id="settings-phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>

              <div className="form-field">
                <label htmlFor="settings-customer-type">Customer type</label>
                <select
                  id="settings-customer-type"
                  name="customerType"
                  value={formData.customerType}
                  onChange={handleChange}
                >
                  <option value="regular_customer">Regular customer</option>
                  <option value="vendor">Vendor</option>
                  <option value="retailer">Retailer</option>
                </select>
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="settings-use-case">What are you using LUMA for?</label>
              <input
                id="settings-use-case"
                name="lumaUseCase"
                value={formData.lumaUseCase}
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label htmlFor="settings-referral">Where did you hear about LUMA?</label>
              <input
                id="settings-referral"
                name="referralSource"
                value={formData.referralSource}
                onChange={handleChange}
              />
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
            {serverError && <p className="settings-saved">{serverError}</p>}
          </form>
        )}
      </section>

      <Footer />
    </main>
  );
}
