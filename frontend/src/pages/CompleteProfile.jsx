import { useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, MessageCircle, ShieldCheck } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { useAuth } from "../context/AuthContext";
import {
  buildE164Phone,
  getCountryByIso2,
  getCountryOptions,
} from "../utils/phoneCountries";

const whyOptions = [
  "I want better-looking brows",
  "I saw good results and wanted to try it",
  "I heard about LUMA from someone",
  "I am trying LUMA for the first time",
  "I came back because I liked the results",
  "I want to improve my brow routine",
];

const firstTimeOptions = [
  "Yes, this is my first time",
  "No, I have tried it before",
  "I am buying for someone else",
];

const browGoalOptions = [
  "Fuller-looking brows",
  "More defined brows",
  "Healthier-looking brows",
  "Better brow routine",
  "Faster visible improvement",
  "I am not sure yet",
];

const referralOptions = [
  "Instagram",
  "TikTok",
  "Facebook",
  "Google",
  "ChatGPT",
  "A friend",
  "Other",
];

const countryOptions = getCountryOptions();

function ChoiceGrid({ label, value, options, onChange, error }) {
  return (
    <div className="onboarding-question">
      <h2>{label}</h2>
      <div className="onboarding-choice-grid">
        {options.map((option) => (
          <button
            type="button"
            className={value === option ? "onboarding-choice selected" : "onboarding-choice"}
            onClick={() => onChange(option)}
            key={option}
          >
            {option}
          </button>
        ))}
      </div>
      {error && <small className="form-error-text">{error}</small>}
    </div>
  );
}

function WhatsAppPhoneInput({ countryIso2, phone, onCountryChange, onPhoneChange }) {
  const selectedCountry = getCountryByIso2(countryIso2 || "US");

  return (
    <div className="phone-country-grid">
      <div className="auth-input-wrap auth-select-wrap">
        <select
          aria-label="WhatsApp country"
          value={selectedCountry.iso2}
          onChange={(event) => onCountryChange(event.target.value)}
        >
          {countryOptions.map((country) => (
            <option value={country.iso2} key={country.iso2}>
              {country.flag ? `${country.flag} ` : ""}{country.name} {country.callingCode ? `(+${country.callingCode})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="auth-input-wrap">
        <MessageCircle className="auth-field-icon" size={18} />
        <input
          value={phone}
          onChange={(event) => onPhoneChange(event.target.value)}
          placeholder={`+${selectedCountry.callingCode || "1"} WhatsApp number`}
        />
      </div>
    </div>
  );
}

export function CompleteProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    isAuthenticated,
    isAuthLoading,
    needsProfileCompletion,
    completeProfile,
  } = useAuth();

  const accountCountry = useMemo(
    () => getCountryByIso2(user?.phone_country_iso2 || "US"),
    [user?.phone_country_iso2]
  );

  const [formData, setFormData] = useState({
    whyLuma: user?.why_luma || "",
    firstTimeLuma: user?.first_time_luma || "",
    browGoal: user?.brow_goal || "",
    referralSource: user?.referral_source || "",
    referralSourceOther: user?.referral_source_other || "",
    whatsappIsAccountPhone: user?.whatsapp_is_account_phone !== false,
    whatsappCountryIso2: user?.whatsapp_country_iso2 || user?.phone_country_iso2 || "US",
    whatsappNumber: user?.whatsapp_number || user?.phone || "",
    marketing: user?.marketing_opt_in !== false,
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const stepLabels = ["Intent", "Experience", "Goal", "Referral", "Contact", "Review"];
  const isFinalStep = currentStep === stepLabels.length - 1;
  const canContinue = Object.keys(getStepErrors(currentStep)).length === 0;

  function updateField(name, value) {
    setFormData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setServerError("");
  }

  function getStepErrors(step = currentStep) {
    const nextErrors = {};

    if (step === 0 && !formData.whyLuma) {
      nextErrors.whyLuma = "Choose the reason that fits best.";
    }

    if (step === 1 && !formData.firstTimeLuma) {
      nextErrors.firstTimeLuma = "Choose one option.";
    }

    if (step === 2 && !formData.browGoal) {
      nextErrors.browGoal = "Choose your brow goal.";
    }

    if (step === 3) {
      if (!formData.referralSource) {
        nextErrors.referralSource = "Choose where you heard about LUMA.";
      }

      if (formData.referralSource === "Other" && !formData.referralSourceOther.trim()) {
        nextErrors.referralSourceOther = "Add where you heard about LUMA.";
      }
    }

    if (step === 4 && !formData.whatsappIsAccountPhone && !formData.whatsappNumber.trim()) {
      nextErrors.whatsappNumber = "Enter your WhatsApp number.";
    }

    return nextErrors;
  }

  function handleNextStep() {
    const nextErrors = getStepErrors();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setCurrentStep((step) => Math.min(step + 1, stepLabels.length - 1));
  }

  function handlePreviousStep() {
    setErrors({});
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  function handleSkipStep() {
    setErrors({});
    setCurrentStep((step) => Math.min(step + 1, stepLabels.length - 1));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};

    if (formData.referralSource === "Other" && !formData.referralSourceOther.trim()) {
      nextErrors.referralSourceOther = "Add where you heard about LUMA.";
    }
    if (!formData.whatsappIsAccountPhone && !formData.whatsappNumber.trim()) {
      nextErrors.whatsappNumber = "Enter your WhatsApp number.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const whatsappCountry = formData.whatsappIsAccountPhone
      ? accountCountry
      : getCountryByIso2(formData.whatsappCountryIso2);
    const whatsappNumber = formData.whatsappIsAccountPhone
      ? user?.phone || ""
      : formData.whatsappNumber;
    const whatsappE164 = formData.whatsappIsAccountPhone
      ? user?.phone_e164 || buildE164Phone(user?.phone || "", accountCountry)
      : buildE164Phone(formData.whatsappNumber, whatsappCountry);

    try {
      setIsSubmitting(true);
      setServerError("");
      setNotice("");

      await completeProfile({
        name: user?.name || user?.full_name,
        phone: user?.phone,
        phoneCountryName: user?.phone_country_name || accountCountry.name,
        phoneCountryIso2: user?.phone_country_iso2 || accountCountry.iso2,
        phoneCountryCode: user?.phone_country_code || accountCountry.callingCode,
        phoneE164: user?.phone_e164 || buildE164Phone(user?.phone || "", accountCountry),
        customerType: user?.customer_type || "regular_customer",
        whyLuma: formData.whyLuma || "Prefer not to say",
        firstTimeLuma: formData.firstTimeLuma || "Prefer not to say",
        browGoal: formData.browGoal || "Prefer not to say",
        referralSource: formData.referralSource || "Prefer not to say",
        referralSourceOther: formData.referralSourceOther,
        whatsappIsAccountPhone: formData.whatsappIsAccountPhone,
        whatsappNumber,
        whatsappE164,
        whatsappCountryName: whatsappCountry.name,
        whatsappCountryIso2: whatsappCountry.iso2,
        whatsappCountryCode: whatsappCountry.callingCode,
        marketing: formData.marketing,
      });

      setNotice("Your LUMA profile is complete.");
      navigate(location.state?.from === "checkout" ? "/checkout" : "/account");
    } catch (error) {
      setServerError(error.message || "Unable to complete your profile.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isAuthLoading) {
    return (
      <main className="page-shell inner-page">
        <Header />
        <section className="commerce-page">
          <div className="empty-state">
            <h2>Checking account...</h2>
            <p>Please wait while we confirm your LUMA session.</p>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!needsProfileCompletion) return <Navigate to="/account" replace />;

  return (
    <main className="page-shell inner-page">
      <Header />

      <section className="commerce-page">
        <div className="commerce-heading auth-heading">
          <Link to="/account" className="back-link">
            <ArrowLeft size={17} />
            Back to account
          </Link>
          <p className="eyebrow">Complete profile</p>
          <h1>Tell us about your brow goals.</h1>
          <p>These details help LUMA support your order, follow-up, and product guidance.</p>
        </div>

        <form className="account-panel auth-panel onboarding-panel" onSubmit={handleSubmit}>
          <div className="auth-card auth-form">
            <div className="auth-card-header">
              <span className="auth-icon">
                <ShieldCheck size={22} />
              </span>
              <div>
                <p className="auth-kicker">Brow profile</p>
                <h2>Complete your LUMA account</h2>
              </div>
            </div>

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

            <div className="onboarding-stepper" aria-label="Profile completion steps">
              {stepLabels.map((label, index) => (
                <button
                  type="button"
                  key={label}
                  className={`${index === currentStep ? "onboarding-step active" : "onboarding-step"}${index < currentStep ? " complete" : ""}`}
                  onClick={() => setCurrentStep(index)}
                  aria-label={`Go to ${label} step`}
                  aria-current={index === currentStep ? "step" : undefined}
                  title={label}
                >
                  <span aria-hidden="true" />
                </button>
              ))}
            </div>
            <p className="onboarding-step-label">{stepLabels[currentStep]}</p>

            {currentStep === 0 && (
              <ChoiceGrid
                label="Why did you choose LUMA?"
                value={formData.whyLuma}
                options={whyOptions}
                onChange={(value) => updateField("whyLuma", value)}
                error={errors.whyLuma}
              />
            )}

            {currentStep === 1 && (
              <ChoiceGrid
                label="Are you trying LUMA for the first time?"
                value={formData.firstTimeLuma}
                options={firstTimeOptions}
                onChange={(value) => updateField("firstTimeLuma", value)}
                error={errors.firstTimeLuma}
              />
            )}

            {currentStep === 2 && (
              <ChoiceGrid
                label="What brow result are you hoping to achieve?"
                value={formData.browGoal}
                options={browGoalOptions}
                onChange={(value) => updateField("browGoal", value)}
                error={errors.browGoal}
              />
            )}

            {currentStep === 3 && (
              <>
                <ChoiceGrid
                  label="Where did you hear about LUMA?"
                  value={formData.referralSource}
                  options={referralOptions}
                  onChange={(value) => updateField("referralSource", value)}
                  error={errors.referralSource}
                />

                {formData.referralSource === "Other" && (
                  <div className="form-field auth-field">
                    <label htmlFor="referral-source-other">Tell us where</label>
                    <div className="auth-input-wrap">
                      <input
                        id="referral-source-other"
                        value={formData.referralSourceOther}
                        onChange={(event) =>
                          updateField("referralSourceOther", event.target.value)
                        }
                        placeholder="Enter referral source"
                      />
                    </div>
                    {errors.referralSourceOther && <small>{errors.referralSourceOther}</small>}
                  </div>
                )}
              </>
            )}

            {currentStep === 4 && (
              <>
                <div className="onboarding-question">
                  <h2>Is this your WhatsApp number?</h2>
                  <p className="auth-muted">{user?.phone_e164 || user?.phone || "No phone saved"}</p>
                  <div className="onboarding-choice-grid two">
                    <button
                      type="button"
                      className={
                        formData.whatsappIsAccountPhone
                          ? "onboarding-choice selected"
                          : "onboarding-choice"
                      }
                      onClick={() => updateField("whatsappIsAccountPhone", true)}
                    >
                      Yes, use this as my WhatsApp number
                    </button>
                    <button
                      type="button"
                      className={
                        !formData.whatsappIsAccountPhone
                          ? "onboarding-choice selected"
                          : "onboarding-choice"
                      }
                      onClick={() => updateField("whatsappIsAccountPhone", false)}
                    >
                      No, I use a different WhatsApp number
                    </button>
                  </div>
                </div>

                {!formData.whatsappIsAccountPhone && (
                  <div className="form-field auth-field">
                    <label>WhatsApp number</label>
                    <WhatsAppPhoneInput
                      countryIso2={formData.whatsappCountryIso2}
                      phone={formData.whatsappNumber}
                      onCountryChange={(value) => updateField("whatsappCountryIso2", value)}
                      onPhoneChange={(value) => updateField("whatsappNumber", value)}
                    />
                    {errors.whatsappNumber && <small>{errors.whatsappNumber}</small>}
                  </div>
                )}

                <label className="auth-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.marketing}
                    onChange={(event) => updateField("marketing", event.target.checked)}
                  />
                  <span>Send me LUMA product, restock, and order updates.</span>
                </label>
              </>
            )}

            {currentStep === 5 && (
              <div className="onboarding-question onboarding-review">
                <p className="auth-kicker">Ready when you are</p>
                <h2>Your brow profile</h2>
                <p className="auth-muted">Review your choices. Anything skipped stays private and can be updated later.</p>
                <div className="onboarding-summary-grid">
                  <div><span>Why LUMA</span><strong>{formData.whyLuma || "Skipped"}</strong></div>
                  <div><span>Experience</span><strong>{formData.firstTimeLuma || "Skipped"}</strong></div>
                  <div><span>Brow goal</span><strong>{formData.browGoal || "Skipped"}</strong></div>
                  <div><span>Referral</span><strong>{formData.referralSource || "Skipped"}</strong></div>
                  <div><span>Updates</span><strong>{formData.marketing ? "Subscribed" : "Not subscribed"}</strong></div>
                </div>
              </div>
            )}

            <div className="onboarding-actions">
              {currentStep > 0 && (
                <button
                  type="button"
                  className="auth-link-button onboarding-back-button"
                  onClick={handlePreviousStep}
                  disabled={isSubmitting}
                >
                  Back
                </button>
              )}

              {isFinalStep ? (
                <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save brow profile"}
                  <ArrowRight size={17} />
                </button>
              ) : (
                <button
                  type="button"
                  className="auth-submit-button"
                  onClick={handleNextStep}
                  disabled={isSubmitting || !canContinue}
                >
                  Continue
                  <ArrowRight size={17} />
                </button>
              )}
            </div>

            {!isFinalStep && (
              <button type="button" className="onboarding-skip" onClick={handleSkipStep} disabled={isSubmitting}>
                Skip this question
              </button>
            )}
          </div>
        </form>
      </section>

      <Footer />
    </main>
  );
}
