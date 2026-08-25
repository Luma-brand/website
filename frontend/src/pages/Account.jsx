import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  LogOut,
  Mail,
  ShoppingBag,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useAuth } from "../context/AuthContext";
import "../styles/account-modern.css";

function validateEmail(email) {
  return /^\S+@\S+\.\S+$/.test(String(email || "").trim());
}

function PasswordField({ value, onChange, placeholder = "Password", autoComplete = "current-password", disabled }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="luma-auth-field">
      <label htmlFor={`luma-password-${autoComplete}`}>{placeholder}</label>
      <div className="luma-auth-input">
        <LockKeyhole size={18} />
        <input
          id={`luma-password-${autoComplete}`}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={6}
          disabled={disabled}
          required
        />
        <button
          type="button"
          className="luma-auth-password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          disabled={disabled}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </div>
  );
}

export function Account({ initialMode = "signin" }) {
  const navigate = useNavigate();
  const {
    user,
    displayName,
    isAuthenticated,
    isAuthLoading,
    signUp,
    signIn,
    signOut,
    forgotPassword,
    verifyPasswordResetCode,
    resetPassword,
  } = useAuth();

  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setServerError("");
    setNotice("");
  }, [initialMode]);

  function switchMode(nextMode) {
    setMode(nextMode);
    setServerError("");
    setNotice("");
    setPassword("");
    if (nextMode !== "reset") setCode("");
  }

  async function handlePrimarySubmit(event) {
    event.preventDefault();
    setServerError("");
    setNotice("");

    if (!validateEmail(email)) {
      setServerError("Enter a valid email address.");
      return;
    }

    if (!password || password.length < 6) {
      setServerError("Your password must be at least 6 characters.");
      return;
    }

    try {
      setIsSubmitting(true);

      if (mode === "signup") {
        await signUp({ email: email.trim(), password });
      } else {
        await signIn({ email: email.trim(), password });
      }

      navigate("/cart");
    } catch (error) {
      setServerError(error.message || "We could not access your account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    setServerError("");
    setNotice("");

    if (!validateEmail(email)) {
      setServerError("Enter the email on your LUMA account.");
      return;
    }

    try {
      setIsSubmitting(true);
      await forgotPassword({ email: email.trim() });
      setNotice("We sent a reset code to your email.");
      setMode("reset");
    } catch (error) {
      setServerError(error.message || "We could not send the reset code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setServerError("");
    setNotice("");

    if (!validateEmail(email)) {
      setServerError("Enter the email on your LUMA account.");
      return;
    }
    if (!code.trim()) {
      setServerError("Enter the reset code from your email.");
      return;
    }
    if (!password || password.length < 6) {
      setServerError("Your new password must be at least 6 characters.");
      return;
    }

    try {
      setIsSubmitting(true);
      await verifyPasswordResetCode({ email: email.trim(), code: code.trim() });
      await resetPassword({
        email: email.trim(),
        code: code.trim(),
        password,
        confirmPassword: password,
      });
      setPassword("");
      setCode("");
      setNotice("Password changed. You can sign in now.");
      setMode("signin");
    } catch (error) {
      setServerError(error.message || "We could not reset your password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    try {
      setIsSubmitting(true);
      await signOut();
      setMode("signin");
      setNotice("You are signed out.");
    } catch (error) {
      setServerError(error.message || "We could not sign you out.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isAuthLoading) {
    return (
      <main className="page-shell inner-page">
        <Header />
        <section className="luma-auth-page">
          <div className="luma-auth-shell">
            <div className="luma-auth-story">
              <div className="luma-auth-story-content">
                <p className="luma-auth-kicker">LUMA account</p>
                <h1>One small step.</h1>
                <p>Checking your saved LUMA session.</p>
              </div>
            </div>
            <div className="luma-auth-card">
              <h2>Loading...</h2>
              <p>This should only take a moment.</p>
            </div>
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
        <section className="luma-auth-page">
          <div className="luma-auth-shell">
            <div className="luma-auth-story">
              <div className="luma-auth-story-content">
                <p className="luma-auth-kicker"><Sparkles size={15} /> Your LUMA</p>
                <h1>Welcome back.</h1>
                <p>Your bag, order details and account stay connected without getting in the way of shopping.</p>
              </div>
            </div>

            <div className="luma-auth-card">
              <p className="luma-auth-kicker">Signed in</p>
              <h2>{displayName}</h2>
              <p>{user.email}</p>

              <div className="luma-account-actions">
                <Link to="/cart">
                  <span><ShoppingBag size={17} /> Your bag</span>
                  <ArrowRight size={17} />
                </Link>
                <Link to="/products">
                  <span>Shop LUMA</span>
                  <ArrowRight size={17} />
                </Link>
                <Link to="/settings">
                  <span><UserRound size={17} /> Account settings</span>
                  <ArrowRight size={17} />
                </Link>
                <button type="button" onClick={handleSignOut} disabled={isSubmitting}>
                  <span><LogOut size={17} /> Sign out</span>
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  const isSignUp = mode === "signup";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";

  return (
    <main className="page-shell inner-page">
      <Header />

      <section className="luma-auth-page">
        <div className="luma-auth-shell">
          <div className="luma-auth-story">
            <div className="luma-auth-story-content">
              <p className="luma-auth-kicker">No long forms. No Google sign-in.</p>
              <h1>Your brows. Your bag. That simple.</h1>
              <p>
                LUMA accounts are intentionally lightweight. Use your email and password, then continue straight to shopping and checkout.
              </p>
            </div>
          </div>

          <div className="luma-auth-card">
            <p className="luma-auth-kicker">
              {isSignUp ? "New to LUMA" : isForgot || isReset ? "Account recovery" : "Welcome back"}
            </p>
            <h2>
              {isSignUp
                ? "Create your account."
                : isForgot
                  ? "Reset your password."
                  : isReset
                    ? "Choose a new password."
                    : "Sign in."}
            </h2>
            <p>
              {isSignUp
                ? "Email and password. That's it."
                : isForgot
                  ? "We'll email you a short reset code."
                  : isReset
                    ? "Enter the code from your email and your new password."
                    : "Two fields, then you're back to your bag."}
            </p>

            {serverError && <div className="luma-auth-error">{serverError}</div>}
            {notice && <div className="luma-auth-notice">{notice}</div>}

            {isForgot ? (
              <form className="luma-auth-form" onSubmit={handleForgotPassword}>
                <div className="luma-auth-field">
                  <label htmlFor="luma-auth-email">Email</label>
                  <div className="luma-auth-input">
                    <Mail size={18} />
                    <input
                      id="luma-auth-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="luma-auth-submit" disabled={isSubmitting}>
                  {isSubmitting ? "Sending..." : "Send reset code"} <ArrowRight size={17} />
                </button>
              </form>
            ) : isReset ? (
              <form className="luma-auth-form" onSubmit={handleResetPassword}>
                <div className="luma-auth-field">
                  <label htmlFor="luma-auth-email">Email</label>
                  <div className="luma-auth-input">
                    <Mail size={18} />
                    <input
                      id="luma-auth-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>
                <div className="luma-auth-field">
                  <label htmlFor="luma-reset-code">Reset code</label>
                  <div className="luma-auth-input">
                    <LockKeyhole size={18} />
                    <input
                      id="luma-reset-code"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      placeholder="6-digit code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>
                <PasswordField
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
                <button type="submit" className="luma-auth-submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save new password"} <ArrowRight size={17} />
                </button>
              </form>
            ) : (
              <form className="luma-auth-form" onSubmit={handlePrimarySubmit}>
                <div className="luma-auth-field">
                  <label htmlFor="luma-auth-email">Email</label>
                  <div className="luma-auth-input">
                    <Mail size={18} />
                    <input
                      id="luma-auth-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      disabled={isSubmitting}
                      required
                    />
                  </div>
                </div>
                <PasswordField
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  disabled={isSubmitting}
                />
                <button type="submit" className="luma-auth-submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? isSignUp ? "Creating account..." : "Signing in..."
                    : isSignUp ? "Create account" : "Sign in"}
                  <ArrowRight size={17} />
                </button>
              </form>
            )}

            <div className="luma-auth-links">
              {isSignUp ? (
                <span>Already have an account? <button type="button" onClick={() => switchMode("signin")}>Sign in</button></span>
              ) : isForgot || isReset ? (
                <button type="button" onClick={() => switchMode("signin")}>Back to sign in</button>
              ) : (
                <>
                  <span>New here? <button type="button" onClick={() => switchMode("signup")}>Create account</button></span>
                  <button type="button" onClick={() => switchMode("forgot")}>Forgot password?</button>
                </>
              )}
            </div>

            <p className="luma-auth-mini-note">
              Your delivery name, phone number and address are collected at checkout only when they're actually needed for your order.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
