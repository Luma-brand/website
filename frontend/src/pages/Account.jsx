import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, UserRound } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useAuth } from "../context/AuthContext";

const initialSignUp = {
  name: "",
  email: "",
  password: "",
  beautyFocus: "Brows",
};

const initialSignIn = {
  email: "",
  password: "",
};

export function Account() {
  const navigate = useNavigate();

  const {
    user,
    displayName,
    isAuthenticated,
    isAuthLoading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
  } = useAuth();

  const [mode, setMode] = useState("signup");
  const [signUpData, setSignUpData] = useState(initialSignUp);
  const [signInData, setSignInData] = useState(initialSignIn);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateEmail(email) {
    return /^\S+@\S+\.\S+$/.test(email);
  }

  function handleSignUpChange(event) {
    const { name, value } = event.target;

    setSignUpData((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => ({ ...current, [name]: "" }));
    setServerError("");
  }

  function handleSignInChange(event) {
    const { name, value } = event.target;

    setSignInData((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => ({ ...current, [name]: "" }));
    setServerError("");
  }

  async function handleSignUpSubmit(event) {
    event.preventDefault();

    const nextErrors = {};

    if (!signUpData.name.trim()) {
      nextErrors.name = "Please enter your name.";
    }

    if (!signUpData.email.trim()) {
      nextErrors.email = "Please enter your email.";
    } else if (!validateEmail(signUpData.email)) {
      nextErrors.email = "Please enter a valid email.";
    }

    if (!signUpData.password.trim()) {
      nextErrors.password = "Please enter a password.";
    } else if (signUpData.password.length < 6) {
      nextErrors.password = "Password must be at least 6 characters.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setServerError("");
      setNotice("");

      await signUp(signUpData);

      setNotice(
        "Account created. Please check your email to confirm your account, then sign in."
      );

      setMode("signin");
      setSignInData({
        email: signUpData.email,
        password: "",
      });
    } catch (error) {
      setServerError(error.message || "Unable to create account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignInSubmit(event) {
    event.preventDefault();

    const nextErrors = {};

    if (!signInData.email.trim()) {
      nextErrors.email = "Please enter your email.";
    } else if (!validateEmail(signInData.email)) {
      nextErrors.email = "Please enter a valid email.";
    }

    if (!signInData.password.trim()) {
      nextErrors.password = "Please enter your password.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setServerError("");
      setNotice("");

      await signIn(signInData);

      navigate("/cart");
    } catch (error) {
      setServerError(error.message || "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    try {
      setIsSubmitting(true);
      setServerError("");

      await signInWithGoogle();
    } catch (error) {
      setServerError(error.message || "Unable to continue with Google.");
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      setMode("signin");
    } catch (error) {
      setServerError(error.message || "Unable to sign out.");
    }
  }

  if (isAuthLoading) {
    return (
      <main className="page-shell inner-page">
        <Header />

        <section className="commerce-page">
          <div className="empty-state">
            <h2>Loading account...</h2>
            <p>Please wait while we check your LUMA session.</p>
          </div>
        </section>

        <Footer />
      </main>
    );
  }

  if (isAuthenticated && user) {
    return (
      <main className="page-shell inner-page">
        <Header />

        <section className="commerce-page">
          <div className="commerce-heading">
            <Link to="/products" className="back-link">
              <ArrowLeft size={17} />
              Back to products
            </Link>

            <p className="eyebrow">Your account</p>
            <h1>Welcome, {displayName}.</h1>
            <p>
              Your LUMA account is active. You can now continue to checkout
              securely.
            </p>
          </div>

          <div className="account-panel">
            <div className="account-card">
              <UserRound size={28} />

              <h2>Account details</h2>

              <div className="summary-row">
                <span>Name</span>
                <strong>{displayName}</strong>
              </div>

              <div className="summary-row">
                <span>Email</span>
                <strong>{user.email}</strong>
              </div>

              <div className="summary-row">
                <span>Beauty focus</span>
                <strong>{user.user_metadata?.beautyFocus || "Brows"}</strong>
              </div>

              <div className="account-actions">
                <Link to="/cart" className="btn btn-primary">
                  Continue to cart
                  <ArrowRight size={18} />
                </Link>

                <Link to="/products" className="btn btn-secondary">
                  Shop products
                </Link>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </div>

              {serverError && (
                <div className="empty-state" style={{ marginTop: 18 }}>
                  <p>{serverError}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <Footer />
      </main>
    );
  }

  return (
    <main className="page-shell inner-page">
      <Header />

      <section className="commerce-page">
        <div className="commerce-heading">
          <Link to="/cart" className="back-link">
            <ArrowLeft size={17} />
            Back to cart
          </Link>

          <p className="eyebrow">LUMA account</p>
          <h1>Create an account before checkout.</h1>
          <p>
            Sign in or create a LUMA account before placing an order.
          </p>
        </div>

        <div className="account-panel">
          <div className="account-tabs">
            <button
              type="button"
              className={mode === "signup" ? "active" : ""}
              onClick={() => {
                setMode("signup");
                setErrors({});
                setServerError("");
                setNotice("");
              }}
            >
              Create account
            </button>

            <button
              type="button"
              className={mode === "signin" ? "active" : ""}
              onClick={() => {
                setMode("signin");
                setErrors({});
                setServerError("");
                setNotice("");
              }}
            >
              Sign in
            </button>
          </div>

          {notice && (
            <div className="empty-state" style={{ marginBottom: 18 }}>
              <p>{notice}</p>
            </div>
          )}

          {serverError && (
            <div className="empty-state" style={{ marginBottom: 18 }}>
              <p>{serverError}</p>
            </div>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: "100%", marginBottom: 16 }}
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
          >
            Continue with Google
          </button>

          {mode === "signup" ? (
            <form className="checkout-form" onSubmit={handleSignUpSubmit} noValidate>
              <div className="form-field">
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  name="name"
                  value={signUpData.name}
                  onChange={handleSignUpChange}
                  placeholder="Your full name"
                  disabled={isSubmitting}
                />
                {errors.name && <small>{errors.name}</small>}
              </div>

              <div className="form-field">
                <label htmlFor="signup-email">Email</label>
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  value={signUpData.email}
                  onChange={handleSignUpChange}
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                />
                {errors.email && <small>{errors.email}</small>}
              </div>

              <div className="form-field">
                <label htmlFor="signup-password">Password</label>
                <input
                  id="signup-password"
                  name="password"
                  type="password"
                  value={signUpData.password}
                  onChange={handleSignUpChange}
                  placeholder="Minimum 6 characters"
                  disabled={isSubmitting}
                />
                {errors.password && <small>{errors.password}</small>}
              </div>

              <div className="form-field">
                <label htmlFor="beautyFocus">Beauty focus</label>
                <select
                  id="beautyFocus"
                  name="beautyFocus"
                  value={signUpData.beautyFocus}
                  onChange={handleSignUpChange}
                  disabled={isSubmitting}
                >
                  <option>Brows</option>
                  <option>Lashes</option>
                  <option>Edges</option>
                  <option>Full routine</option>
                </select>
              </div>

              <button
                type="submit"
                className="waitlist-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating account..." : "Create account"}
                <ArrowRight size={17} />
              </button>
            </form>
          ) : (
            <form className="checkout-form" onSubmit={handleSignInSubmit} noValidate>
              <div className="form-field">
                <label htmlFor="signin-email">Email</label>
                <input
                  id="signin-email"
                  name="email"
                  type="email"
                  value={signInData.email}
                  onChange={handleSignInChange}
                  placeholder="you@example.com"
                  disabled={isSubmitting}
                />
                {errors.email && <small>{errors.email}</small>}
              </div>

              <div className="form-field">
                <label htmlFor="signin-password">Password</label>
                <input
                  id="signin-password"
                  name="password"
                  type="password"
                  value={signInData.password}
                  onChange={handleSignInChange}
                  placeholder="Your password"
                  disabled={isSubmitting}
                />
                {errors.password && <small>{errors.password}</small>}
              </div>

              <button
                type="submit"
                className="waitlist-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Signing in..." : "Sign in"}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}