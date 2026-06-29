import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useAuth } from "../context/AuthContext";
import {
  buildE164Phone,
  getCountryByIso2,
  getCountryOptions,
} from "../utils/phoneCountries";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_SCRIPT_ID = "google-identity-services";

const initialSignUp = {
  name: "",
  email: "",
  phone: "",
  phoneCountryIso2: "US",
  password: "",
  confirmPassword: "",
};

const initialSignIn = {
  email: "",
  password: "",
};

const initialReset = {
  email: "",
  code: "",
  password: "",
  confirmPassword: "",
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.52z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.62-2.44l-3.24-2.51c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.88A6.01 6.01 0 0 1 6.1 12c0-.65.11-1.28.31-1.88V7.53H3.06A10 10 0 0 0 2 12c0 1.61.39 3.13 1.06 4.47l3.35-2.59z"
      />
      <path
        fill="#EA4335"
        d="M12 5.98c1.47 0 2.79.51 3.82 1.5l2.87-2.87A9.61 9.61 0 0 0 12 2a10 10 0 0 0-8.94 5.53l3.35 2.59C7.2 7.74 9.4 5.98 12 5.98z"
      />
    </svg>
  );
}

function PasswordToggle({ visible, onClick, disabled }) {
  return (
    <button
      type="button"
      className="password-toggle"
      onClick={onClick}
      disabled={disabled}
      aria-label={visible ? "Hide password" : "Show password"}
    >
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
}

function validateEmail(email) {
  return /^\S+@\S+\.\S+$/.test(email);
}

const countryOptions = getCountryOptions();

function PhoneCountryField({
  countryIso2,
  phone,
  onCountryChange,
  onPhoneChange,
  disabled,
  error,
}) {
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const selectedCountry = getCountryByIso2(countryIso2 || "US");

  function chooseCountry(nextIso2) {
    onCountryChange(nextIso2);
    setIsCountryOpen(false);
  }

  return (
    <div className="form-field auth-field phone-field">
      <label htmlFor="signup-phone">Phone number</label>
      <div className="phone-entry-grid">
        <div className="phone-country-picker">
          <button
            type="button"
            className="phone-country-trigger"
            onClick={() => setIsCountryOpen((current) => !current)}
            disabled={disabled}
            aria-label="Select phone country"
            aria-expanded={isCountryOpen}
          >
            <span className="phone-country-flag">{selectedCountry.flag}</span>
            <strong>+{selectedCountry.callingCode}</strong>
          </button>

          {isCountryOpen && !disabled && (
            <div className="phone-country-menu" role="listbox">
              {countryOptions.map((country) => (
                <button
                  type="button"
                  key={country.iso2}
                  className={country.iso2 === selectedCountry.iso2 ? "selected" : ""}
                  onClick={() => chooseCountry(country.iso2)}
                  role="option"
                  aria-selected={country.iso2 === selectedCountry.iso2}
                >
                  <span>{country.flag}</span>
                  <span>{country.name}</span>
                  <strong>+{country.callingCode}</strong>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="auth-input-wrap phone-number-wrap">
          <Phone className="auth-field-icon" size={18} />
          <input
            id="signup-phone"
            name="phone"
            value={phone}
            onChange={onPhoneChange}
            placeholder="Phone number"
            inputMode="tel"
            autoComplete="tel-national"
            disabled={disabled}
          />
        </div>
      </div>
      {error && <small>{error}</small>}
    </div>
  );
}
export function Account({ initialMode = "signup" }) {
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);

  const {
    user,
    displayName,
    isAuthenticated,
    isAuthLoading,
    needsProfileCompletion,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    forgotPassword,
    verifyPasswordResetCode,
    resetPassword,
  } = useAuth();

  const [mode, setMode] = useState(initialMode);
  const [signUpData, setSignUpData] = useState(initialSignUp);
  const [signInData, setSignInData] = useState(initialSignIn);
  const [resetData, setResetData] = useState(initialReset);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleGoogleCredential = useCallback(
    async (response) => {
      if (!response?.credential) {
        setServerError("Google did not return a sign-in credential.");
        return;
      }

      try {
        setIsSubmitting(true);
        setServerError("");
        setNotice("");

        const { customer } = await signInWithGoogle(response.credential);

        navigate(customer?.profile_completed ? "/cart" : "/complete-profile");
      } catch (error) {
        setServerError(error.message || "Unable to continue with Google.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [navigate, signInWithGoogle]
  );

  useEffect(() => {
    queueMicrotask(() => {
      setMode(initialMode);
    });
  }, [initialMode]);

  useEffect(() => {
    if (isAuthenticated || !GOOGLE_CLIENT_ID || !googleButtonRef.current) {
      return undefined;
    }

    let isMounted = true;

    function renderGoogleButton() {
      if (!isMounted || !window.google?.accounts?.id || !googleButtonRef.current) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        type: "standard",
        text: "continue_with",
        shape: "rectangular",
        width: Math.min(360, googleButtonRef.current.offsetWidth || 320),
      });
    }

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);

    if (existingScript) {
      renderGoogleButton();
    } else {
      const script = document.createElement("script");
      script.id = GOOGLE_SCRIPT_ID;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = renderGoogleButton;
      script.onerror = () => {
        if (isMounted) {
          setServerError("Google sign-in could not be loaded.");
        }
      };
      document.head.appendChild(script);
    }

    return () => {
      isMounted = false;
    };
  }, [handleGoogleCredential, isAuthenticated]);

  function setCleanMode(nextMode) {
    setMode(nextMode);
    setErrors({});
    setNotice("");
    setServerError("");
  }

  function updateSignUp(event) {
    const { name, value } = event.target;
    setSignUpData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setServerError("");
  }

  function updateSignIn(event) {
    const { name, value } = event.target;
    setSignInData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setServerError("");
  }

  function updateReset(event) {
    const { name, value } = event.target;
    setResetData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setServerError("");
  }

  async function handleSignUp(event) {
    event.preventDefault();
    const nextErrors = {};

    if (!signUpData.name.trim()) nextErrors.name = "Enter your full name.";
    if (!signUpData.phone.trim()) nextErrors.phone = "Enter your phone number.";
    if (!signUpData.email.trim()) nextErrors.email = "Enter your email.";
    else if (!validateEmail(signUpData.email)) nextErrors.email = "Enter a valid email.";
    if (!signUpData.password) nextErrors.password = "Enter a password.";
    else if (signUpData.password.length < 6) nextErrors.password = "Use at least 6 characters.";
    if (signUpData.password !== signUpData.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setServerError("");
      setNotice("");
      const selectedCountry = getCountryByIso2(signUpData.phoneCountryIso2);
      await signUp({
        ...signUpData,
        phoneCountryName: selectedCountry.name,
        phoneCountryIso2: selectedCountry.iso2,
        phoneCountryCode: selectedCountry.callingCode,
        phoneE164: buildE164Phone(signUpData.phone, selectedCountry),
      });
      setNotice("Account created. You are signed in.");
      navigate("/complete-profile");
    } catch (error) {
      setServerError(error.message || "Unable to create account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignIn(event) {
    event.preventDefault();
    const nextErrors = {};

    if (!signInData.email.trim()) nextErrors.email = "Enter your email.";
    else if (!validateEmail(signInData.email)) nextErrors.email = "Enter a valid email.";
    if (!signInData.password) nextErrors.password = "Enter your password.";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setServerError("");
      setNotice("");
      const { customer } = await signIn(signInData);
      navigate(customer?.profile_completed ? "/cart" : "/complete-profile");
    } catch (error) {
      setServerError(error.message || "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();

    if (!resetData.email.trim() || !validateEmail(resetData.email)) {
      setErrors({ email: "Enter the email on your LUMA account." });
      return;
    }

    try {
      setIsSubmitting(true);
      setServerError("");
      setNotice("");
      await forgotPassword({ email: resetData.email });
      setNotice("Check your email for a reset code.");
      setMode("reset");
    } catch (error) {
      setServerError(error.message || "Unable to send reset code.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    const nextErrors = {};

    if (!resetData.email.trim() || !validateEmail(resetData.email)) nextErrors.email = "Enter your email.";
    if (!resetData.code.trim()) nextErrors.code = "Enter the reset code.";
    if (!resetData.password) nextErrors.password = "Enter a new password.";
    else if (resetData.password.length < 6) nextErrors.password = "Use at least 6 characters.";
    if (resetData.password !== resetData.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      setServerError("");
      setNotice("");
      await verifyPasswordResetCode({
        email: resetData.email,
        code: resetData.code,
      });
      await resetPassword({
        email: resetData.email,
        code: resetData.code,
        password: resetData.password,
        confirmPassword: resetData.confirmPassword,
      });
      setNotice("Password reset successfully. Sign in with your new password.");
      setSignInData({ email: resetData.email, password: "" });
      setMode("signin");
    } catch (error) {
      setServerError(error.message || "Unable to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      setCleanMode("signin");
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

  if (isAuthenticated && needsProfileCompletion) {
    return <Navigate to="/complete-profile" replace />;
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
            <p>Your LUMA account is active. You can now continue to checkout securely.</p>
          </div>

          <div className="account-panel">
            <div className="account-card signed-in-card">
              <span className="account-avatar">
                <UserRound size={28} />
              </span>
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
                <span>Phone</span>
                <strong>{user.phone || "Not added"}</strong>
              </div>
              <div className="summary-row">
                <span>Customer type</span>
                <strong>{user.customer_type?.replace("_", " ") || "Customer"}</strong>
              </div>

              <div className="account-actions">
                <Link to="/cart" className="btn btn-primary">
                  Continue to cart
                  <ArrowRight size={18} />
                </Link>
                <Link to="/settings" className="btn btn-secondary">
                  Edit profile
                </Link>
                <button type="button" className="btn btn-secondary" onClick={handleSignOut}>
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

  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";

  return (
    <main className="page-shell inner-page">
      <Header />

      <section className="commerce-page auth-page-section">
        <div className="account-panel auth-panel auth-card-shell">
          <div className="auth-card">
            <Link to="/cart" className="auth-mobile-back">
              <ArrowLeft size={16} />
              Back to cart
            </Link>

            <div className="auth-card-header">
              <span className="auth-icon">
                {isSignup ? <UserPlus size={22} /> : <LockKeyhole size={22} />}
              </span>
              <div>
                <p className="auth-kicker">Secure customer access</p>
                <h2>
                  {isForgot
                    ? "Get a reset code"
                    : isReset
                      ? "Choose a new password"
                      : isSignup
                        ? "Start your account"
                        : "Sign in to continue"}
                </h2>
              </div>
            </div>

            {!isForgot && !isReset && (
              <div className="account-tabs" aria-label="Account mode">
                <button
                  type="button"
                  className={mode === "signup" ? "active" : ""}
                  onClick={() => setCleanMode("signup")}
                >
                  <UserPlus size={17} />
                  Create account
                </button>
                <button
                  type="button"
                  className={mode === "signin" ? "active" : ""}
                  onClick={() => setCleanMode("signin")}
                >
                  <LockKeyhole size={17} />
                  Sign in
                </button>
              </div>
            )}

            {notice && (
              <div className="auth-alert auth-alert-success">
                <CheckCircle2 size={18} />
                <p>{notice}</p>
              </div>
            )}

            {serverError && (
              <div className="auth-alert">
                <ShieldCheck size={18} />
                <p>{serverError}</p>
              </div>
            )}

            {!isForgot && !isReset && (
              <>
                <div className="google-signin-slot">
                  {GOOGLE_CLIENT_ID ? (
                    <div ref={googleButtonRef} />
                  ) : (
                    <button type="button" className="google-fallback-button" disabled>
                      <GoogleIcon />
                      Google sign-in is not configured
                    </button>
                  )}
                </div>

                <div className="auth-divider">
                  <span />
                  <p>or use email</p>
                  <span />
                </div>
              </>
            )}

            {isSignup && (
              <form className="auth-form" onSubmit={handleSignUp} noValidate>
                <div className="form-field auth-field">
                  <label htmlFor="signup-name">Full name</label>
                  <div className="auth-input-wrap">
                    <UserRound className="auth-field-icon" size={18} />
                    <input id="signup-name" name="name" value={signUpData.name} onChange={updateSignUp} placeholder="Your full name" disabled={isSubmitting} />
                  </div>
                  {errors.name && <small>{errors.name}</small>}
                </div>

                <div className="form-grid two">
                  <div className="form-field auth-field">
                    <label htmlFor="signup-email">Email</label>
                    <div className="auth-input-wrap">
                      <Mail className="auth-field-icon" size={18} />
                      <input id="signup-email" name="email" type="email" value={signUpData.email} onChange={updateSignUp} placeholder="Email address" disabled={isSubmitting} />
                    </div>
                    {errors.email && <small>{errors.email}</small>}
                  </div>

                  <PhoneCountryField
                    countryIso2={signUpData.phoneCountryIso2}
                    phone={signUpData.phone}
                    onCountryChange={(value) =>
                      setSignUpData((current) => ({
                        ...current,
                        phoneCountryIso2: value,
                      }))
                    }
                    onPhoneChange={updateSignUp}
                    disabled={isSubmitting}
                    error={errors.phone}
                  />
                </div>

                <div className="form-grid two">
                  <div className="form-field auth-field">
                    <label htmlFor="signup-password">Password</label>
                    <div className="auth-input-wrap">
                      <LockKeyhole className="auth-field-icon" size={18} />
                      <input id="signup-password" name="password" type={showSignUpPassword ? "text" : "password"} value={signUpData.password} onChange={updateSignUp} placeholder="Minimum 6 characters" disabled={isSubmitting} />
                      <PasswordToggle visible={showSignUpPassword} onClick={() => setShowSignUpPassword((current) => !current)} disabled={isSubmitting} />
                    </div>
                    {errors.password && <small>{errors.password}</small>}
                  </div>

                  <div className="form-field auth-field">
                    <label htmlFor="signup-confirm">Confirm password</label>
                    <div className="auth-input-wrap">
                      <LockKeyhole className="auth-field-icon" size={18} />
                      <input id="signup-confirm" name="confirmPassword" type={showSignUpPassword ? "text" : "password"} value={signUpData.confirmPassword} onChange={updateSignUp} placeholder="Repeat password" disabled={isSubmitting} />
                      <PasswordToggle visible={showSignUpPassword} onClick={() => setShowSignUpPassword((current) => !current)} disabled={isSubmitting} />
                    </div>
                    {errors.confirmPassword && <small>{errors.confirmPassword}</small>}
                  </div>
                </div>

                <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
                  {isSubmitting ? "Creating account..." : "Create account"}
                  <ArrowRight size={17} />
                </button>
              </form>
            )}

            {mode === "signin" && (
              <form className="auth-form" onSubmit={handleSignIn} noValidate>
                <div className="form-field auth-field">
                  <label htmlFor="signin-email">Email</label>
                  <div className="auth-input-wrap">
                    <Mail className="auth-field-icon" size={18} />
                    <input id="signin-email" name="email" type="email" value={signInData.email} onChange={updateSignIn} placeholder="Email address" disabled={isSubmitting} />
                  </div>
                  {errors.email && <small>{errors.email}</small>}
                </div>

                <div className="form-field auth-field">
                  <label htmlFor="signin-password">Password</label>
                  <div className="auth-input-wrap">
                    <LockKeyhole className="auth-field-icon" size={18} />
                    <input id="signin-password" name="password" type={showSignInPassword ? "text" : "password"} value={signInData.password} onChange={updateSignIn} placeholder="Your password" disabled={isSubmitting} />
                    <PasswordToggle visible={showSignInPassword} onClick={() => setShowSignInPassword((current) => !current)} disabled={isSubmitting} />
                  </div>
                  {errors.password && <small>{errors.password}</small>}
                </div>

                <button type="button" className="auth-link-button" onClick={() => setCleanMode("forgot")}>
                  Forgot password?
                </button>

                <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
                  {isSubmitting ? "Signing in..." : "Sign in"}
                  <ArrowRight size={17} />
                </button>
              </form>
            )}

            {isForgot && (
              <form className="auth-form" onSubmit={handleForgotPassword} noValidate>
                <div className="form-field auth-field">
                  <label htmlFor="reset-email">Account email</label>
                  <div className="auth-input-wrap">
                    <Mail className="auth-field-icon" size={18} />
                    <input id="reset-email" name="email" type="email" value={resetData.email} onChange={updateReset} placeholder="Email address" disabled={isSubmitting} />
                  </div>
                  {errors.email && <small>{errors.email}</small>}
                </div>
                <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
                  {isSubmitting ? "Sending code..." : "Send reset code"}
                  <ArrowRight size={17} />
                </button>
                <button type="button" className="auth-link-button" onClick={() => setCleanMode("signin")}>
                  Back to sign in
                </button>
              </form>
            )}

            {isReset && (
              <form className="auth-form" onSubmit={handleResetPassword} noValidate>
                <div className="form-grid two">
                  <div className="form-field auth-field">
                    <label htmlFor="reset-code-email">Email</label>
                    <div className="auth-input-wrap">
                      <Mail className="auth-field-icon" size={18} />
                      <input id="reset-code-email" name="email" type="email" value={resetData.email} onChange={updateReset} placeholder="Email address" disabled={isSubmitting} />
                    </div>
                    {errors.email && <small>{errors.email}</small>}
                  </div>
                  <div className="form-field auth-field">
                    <label htmlFor="reset-code">Verification code</label>
                    <div className="auth-input-wrap">
                      <ShieldCheck className="auth-field-icon" size={18} />
                      <input id="reset-code" name="code" value={resetData.code} onChange={updateReset} placeholder="6-digit code" disabled={isSubmitting} />
                    </div>
                    {errors.code && <small>{errors.code}</small>}
                  </div>
                </div>

                <div className="form-grid two">
                  <div className="form-field auth-field">
                    <label htmlFor="new-password">New password</label>
                    <div className="auth-input-wrap">
                      <LockKeyhole className="auth-field-icon" size={18} />
                      <input id="new-password" name="password" type={showResetPassword ? "text" : "password"} value={resetData.password} onChange={updateReset} placeholder="New password" disabled={isSubmitting} />
                      <PasswordToggle visible={showResetPassword} onClick={() => setShowResetPassword((current) => !current)} disabled={isSubmitting} />
                    </div>
                    {errors.password && <small>{errors.password}</small>}
                  </div>
                  <div className="form-field auth-field">
                    <label htmlFor="confirm-new-password">Confirm password</label>
                    <div className="auth-input-wrap">
                      <LockKeyhole className="auth-field-icon" size={18} />
                      <input id="confirm-new-password" name="confirmPassword" type={showResetConfirm ? "text" : "password"} value={resetData.confirmPassword} onChange={updateReset} placeholder="Repeat new password" disabled={isSubmitting} />
                      <PasswordToggle visible={showResetConfirm} onClick={() => setShowResetConfirm((current) => !current)} disabled={isSubmitting} />
                    </div>
                    {errors.confirmPassword && <small>{errors.confirmPassword}</small>}
                  </div>
                </div>

                <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
                  {isSubmitting ? "Resetting..." : "Reset password"}
                  <ArrowRight size={17} />
                </button>
              </form>
            )}

            <div className="auth-footnote">
              <ShieldCheck size={17} />
              <span>Protected checkout access for LUMA customers.</span>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}





