import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CircleUserRound,
  Hash,
  Mail,
  MapPin,
  Phone,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import AddressAutocompleteInput from "./AddressAutocompleteInput";
import CustomerPortalDashboard from "./CustomerPortalDashboard";
import capitalLumberLogo from "../assets/logo-black-text.svg";
import {
  submitCustomerAccountRequest,
  verifyCustomerPortalEmail,
} from "../utils/customerAccountRequestStorage";
import {
  completeCustomerPortalSignIn,
  getStoredCustomerPortalEmail,
  isCustomerPortalEmailLink,
  sendCustomerPortalSignInLink,
  signOutCustomerPortal,
} from "../utils/customerPortalAuth";

const EMPTY_FORM = {
  accountNumber: "",
  name: "",
  businessName: "",
  address: "",
  phone: "",
  email: "",
  website: "",
};

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function getErrorMessage(error) {
  const message = String(error?.message || "");

  if (/resource-exhausted/i.test(message)) {
    return "Too many requests were submitted. Please wait a few minutes and try again.";
  }

  if (/invalid-argument/i.test(message)) {
    return "Please review the highlighted information and try again.";
  }

  if (/operation-not-allowed/i.test(message)) {
    return "Customer email sign in has not been enabled yet. Please call 208-343-5481.";
  }

  if (/unauthorized-domain/i.test(message)) {
    return "This website has not been authorized for customer sign in yet.";
  }

  if (/invalid-action-code|expired-action-code/i.test(message)) {
    return "That secure sign-in link is expired or has already been used. Request a new link below.";
  }

  if (/invalid-email/i.test(message)) {
    return "Enter a valid email address.";
  }

  if (/unavailable|network/i.test(message)) {
    return "We could not reach Capital Lumber. Check your connection and try again.";
  }

  return (
    message.replace(/^Firebase:\s*/i, "") ||
    "We could not submit your account request. Please call 208-343-5481."
  );
}

function Field({
  id,
  label,
  icon: Icon,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
  placeholder,
  inputMode,
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-600">
        {label}
      </span>
      <span
        className={`flex items-center gap-3 rounded-2xl border bg-white px-4 transition focus-within:ring-4 ${
          error
            ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-100"
            : "border-slate-200 focus-within:border-slate-900 focus-within:ring-slate-100"
        }`}
      >
        <Icon
          className={`h-5 w-5 shrink-0 ${error ? "text-red-500" : "text-slate-400"}`}
          aria-hidden="true"
        />
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-w-0 flex-1 border-0 bg-transparent py-4 text-base font-bold text-slate-900 outline-none placeholder:font-semibold placeholder:text-slate-400"
        />
      </span>
      {error ? (
        <span
          id={`${id}-error`}
          className="mt-1.5 block text-sm font-bold text-red-600"
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}

export default function CustomerAccountOnboarding({
  onBackToEmployeeLogin,
  currentUser,
}) {
  const customerAuthUser = useMemo(
    () =>
      currentUser?.providerData?.some(
        (provider) => provider.providerId === "password",
      )
        ? currentUser
        : null,
    [currentUser],
  );
  const [step, setStep] = useState(() =>
    isCustomerPortalEmailLink() ? "sign-in" : "account-question",
  );
  const [hasExistingAccount, setHasExistingAccount] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [signInEmail, setSignInEmail] = useState(
    () => getStoredCustomerPortalEmail() || "",
  );
  const [signInStatus, setSignInStatus] = useState("idle");
  const [signInError, setSignInError] = useState("");
  const [accountLink, setAccountLink] = useState({
    status: "",
    accountNumber: "",
  });
  const hasHandledEmailLink = useRef(false);
  const hasLoadedPortalStatus = useRef(false);

  const progressLabel = useMemo(() => {
    if (step === "account-question") return "Step 1 of 2";
    if (step === "details") return "Step 2 of 2";
    if (step === "complete") return "Complete";
    if (step === "verified") return "Signed in";
    return "Secure customer sign in";
  }, [step]);

  useEffect(() => {
    if (customerAuthUser && !isCustomerPortalEmailLink()) {
      setStep("verified");
      if (!hasLoadedPortalStatus.current) {
        hasLoadedPortalStatus.current = true;
        verifyCustomerPortalEmail()
          .then((verification) => {
            setAccountLink({
              status: verification?.status || "",
              accountNumber: verification?.accountNumber || "",
            });
          })
          .catch((error) => {
            console.error("Unable to refresh customer account status:", error);
          });
      }
      return;
    }

    if (!isCustomerPortalEmailLink() || hasHandledEmailLink.current) return;

    hasHandledEmailLink.current = true;
    const storedEmail = getStoredCustomerPortalEmail();
    setStep("sign-in");

    if (!storedEmail) {
      setSignInStatus("needs-email");
      return;
    }

    finishEmailLinkSignIn(storedEmail);
  }, [customerAuthUser]);

  function cleanEmailLinkFromAddressBar() {
    const nextUrl = new URL(window.location.href);
    window.history.replaceState({}, "", nextUrl.pathname);
  }

  async function finishEmailLinkSignIn(email) {
    setSignInStatus("verifying");
    setSignInError("");

    try {
      const result = await completeCustomerPortalSignIn(email);
      const completedEmail = result.user?.email || email;
      setSignInEmail(completedEmail);
      setSignInStatus("verified");
      setAccountLink({
        status: result.verification?.status || "",
        accountNumber: result.verification?.accountNumber || "",
      });
      hasLoadedPortalStatus.current = true;
      setStep("verified");
      cleanEmailLinkFromAddressBar();
    } catch (error) {
      console.error("Unable to verify customer email:", error);
      setSignInError(getErrorMessage(error));
      setSignInStatus("needs-email");
    }
  }

  async function handleCustomerSignIn(event) {
    event.preventDefault();
    const email = signInEmail.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSignInError("Enter a valid email address.");
      return;
    }

    if (isCustomerPortalEmailLink()) {
      await finishEmailLinkSignIn(email);
      return;
    }

    setSignInStatus("sending");
    setSignInError("");

    try {
      await sendCustomerPortalSignInLink(email);
      setSignInStatus("sent");
    } catch (error) {
      console.error("Unable to send customer sign-in link:", error);
      setSignInError(getErrorMessage(error));
      setSignInStatus("idle");
    }
  }

  async function handleCustomerSignOut() {
    setSignInError("");

    try {
      await signOutCustomerPortal();
      setAccountLink({ status: "", accountNumber: "" });
      hasLoadedPortalStatus.current = false;
      setSignInEmail("");
      setSignInStatus("idle");
      setStep("account-question");
    } catch (error) {
      setSignInError(getErrorMessage(error));
    }
  }

  function chooseAccountStatus(value) {
    setHasExistingAccount(value);
    setForm((currentForm) => ({
      ...currentForm,
      accountNumber: value ? currentForm.accountNumber : "",
    }));
    setErrors({});
    setSubmitError("");
    setStep("details");
  }

  function handleFieldChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      [name]: "",
    }));
    setSubmitError("");
  }

  function handleAddressChange(address) {
    setForm((currentForm) => ({
      ...currentForm,
      address,
    }));
    setErrors((currentErrors) => ({
      ...currentErrors,
      address: "",
    }));
    setSubmitError("");
  }

  function validateForm() {
    const nextErrors = {};
    const email = form.email.trim();
    const phoneDigits = normalizePhone(form.phone);

    if (hasExistingAccount && !form.accountNumber.trim()) {
      nextErrors.accountNumber = "Enter your Capital Lumber account number.";
    }
    if (!form.name.trim()) nextErrors.name = "Enter your name.";
    if (!form.businessName.trim()) {
      nextErrors.businessName = "Enter your business name.";
    }
    if (!form.address.trim()) nextErrors.address = "Enter your address.";
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      nextErrors.phone = "Enter a valid phone number with area code.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const result = await submitCustomerAccountRequest({
        hasExistingAccount,
        accountNumber: form.accountNumber.trim(),
        name: form.name.trim(),
        businessName: form.businessName.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        website: form.website,
      });

      let emailLinkSent = false;
      let emailLinkError = "";

      try {
        await sendCustomerPortalSignInLink(form.email);
        emailLinkSent = true;
      } catch (error) {
        console.error("Account request saved, but sign-in email failed:", error);
        emailLinkError = getErrorMessage(error);
      }

      setConfirmation({
        ...(result || {}),
        emailLinkSent,
        emailLinkError,
      });
      setStep("complete");
    } catch (error) {
      console.error("Unable to submit customer account request:", error);
      setSubmitError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function startOver() {
    setStep("account-question");
    setHasExistingAccount(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setSubmitError("");
    setConfirmation(null);
  }

  function openCustomerSignIn() {
    setSignInError("");
    setSignInStatus("idle");
    setStep("sign-in");
  }

  if (customerAuthUser && step === "verified") {
    return (
      <CustomerPortalDashboard
        accountLink={accountLink}
        currentUser={customerAuthUser}
        onBackToEmployeeLogin={onBackToEmployeeLogin}
        onSignOut={handleCustomerSignOut}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F7F5] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <img
            src={capitalLumberLogo}
            alt="Capital Lumber Co."
            className="h-auto w-44 sm:w-52"
          />
          <div className="flex items-center gap-2">
            {customerAuthUser ? (
              <button
                type="button"
                onClick={handleCustomerSignOut}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:border-slate-400 hover:text-slate-950 sm:px-4 sm:text-sm"
              >
                Customer sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={openCustomerSignIn}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:border-slate-400 hover:text-slate-950 sm:px-4 sm:text-sm"
              >
                Customer sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-81px)] max-w-6xl items-start gap-8 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-8 lg:py-16">
        <div className="lg:pr-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FC2C38]">
            Capital Lumber Customer Portal
          </p>
          <h1 className="mt-4 max-w-xl text-4xl font-black leading-[1.02] tracking-tight text-slate-950 sm:text-5xl">
            Your Capital Lumber account, built around you.
          </h1>
          <p className="mt-5 max-w-lg text-base font-semibold leading-7 text-slate-600 sm:text-lg">
            Tell us who you are so we can connect you to the right Capital
            Lumber account and prepare your online access.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {[
              "Your information stays separate from our internal operations.",
              "We will verify existing account numbers before linking access.",
              "Questions? Call us at 208-343-5481.",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="text-sm font-bold leading-5 text-slate-700">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-7">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                Create your account
              </p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {progressLabel}
              </p>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </span>
          </div>

          {step === "sign-in" ? (
            <form onSubmit={handleCustomerSignIn} className="p-5 sm:p-7">
              <button
                type="button"
                onClick={() => setStep("account-question")}
                className="flex items-center gap-2 text-sm font-black text-slate-500 transition hover:text-slate-950"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </button>

              <p className="mt-5 text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                Passwordless access
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                {isCustomerPortalEmailLink()
                  ? "Verify your email"
                  : "Sign in to your account"}
              </h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                {isCustomerPortalEmailLink()
                  ? "Enter the same email address that received this secure link."
                  : "We will email you a secure, one-time sign-in link. No password is needed."}
              </p>

              <div className="mt-6">
                <Field
                  id="customerSignInEmail"
                  label="Email address"
                  icon={Mail}
                  value={signInEmail}
                  onChange={(event) => {
                    setSignInEmail(event.target.value);
                    setSignInError("");
                  }}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@business.com"
                />
              </div>

              {signInStatus === "sent" ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-left">
                  <p className="font-black text-emerald-800">Check your email</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-emerald-700">
                    We sent a secure sign-in link to {signInEmail.trim()}.
                    Open it on this device to verify your email and sign in.
                  </p>
                </div>
              ) : null}

              {signInError ? (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
                >
                  {signInError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={
                  signInStatus === "sending" || signInStatus === "verifying"
                }
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#FC2C38] px-5 py-4 text-base font-black text-white shadow-lg transition hover:bg-red-600 disabled:cursor-wait disabled:bg-slate-400"
              >
                {signInStatus === "sending"
                  ? "Sending secure link..."
                  : signInStatus === "verifying"
                    ? "Verifying email..."
                    : isCustomerPortalEmailLink()
                      ? "Verify and sign in"
                      : signInStatus === "sent"
                        ? "Send a new link"
                        : "Email me a secure sign-in link"}
                {signInStatus !== "sending" &&
                signInStatus !== "verifying" ? (
                  <Send className="h-5 w-5" aria-hidden="true" />
                ) : null}
              </button>
              <p className="mt-3 text-center text-xs font-semibold leading-5 text-slate-500">
                For security, each link can only be used once.
              </p>
            </form>
          ) : null}

          {step === "account-question" ? (
            <div className="p-5 sm:p-7">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                Let&apos;s get started
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Do you already have an account with us?
              </h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                Choose the option that best matches your relationship with
                Capital Lumber.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => chooseAccountStatus(true)}
                  className="group flex min-h-48 flex-col items-start rounded-3xl border-2 border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#FC2C38] hover:shadow-lg"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-[#FC2C38] transition group-hover:bg-[#FC2C38] group-hover:text-white">
                    <Hash className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="mt-5 text-xl font-black text-slate-950">
                    Yes, I have an account
                  </span>
                  <span className="mt-2 text-sm font-semibold leading-5 text-slate-500">
                    Have your Capital Lumber account number ready.
                  </span>
                  <span className="mt-auto flex items-center gap-2 pt-5 text-sm font-black text-[#FC2C38]">
                    Continue <ArrowRight className="h-4 w-4" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => chooseAccountStatus(false)}
                  className="group flex min-h-48 flex-col items-start rounded-3xl border-2 border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-slate-950 hover:shadow-lg"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-950 group-hover:text-white">
                    <CircleUserRound className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="mt-5 text-xl font-black text-slate-950">
                    No, I&apos;m new here
                  </span>
                  <span className="mt-2 text-sm font-semibold leading-5 text-slate-500">
                    Start a new Capital Lumber customer account request.
                  </span>
                  <span className="mt-auto flex items-center gap-2 pt-5 text-sm font-black text-slate-950">
                    Continue <ArrowRight className="h-4 w-4" />
                  </span>
                </button>
              </div>
            </div>
          ) : null}

          {step === "details" ? (
            <form onSubmit={handleSubmit} noValidate className="p-5 sm:p-7">
              <button
                type="button"
                onClick={() => setStep("account-question")}
                className="flex items-center gap-2 text-sm font-black text-slate-500 transition hover:text-slate-950"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back
              </button>

              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
                {hasExistingAccount
                  ? "Connect your Capital Lumber account"
                  : "Tell us about your business"}
              </h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                All fields are required
                {hasExistingAccount ? ", including your account number" : ""}.
              </p>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {hasExistingAccount ? (
                  <div className="sm:col-span-2">
                    <Field
                      id="accountNumber"
                      label="Capital Lumber account number"
                      icon={Hash}
                      value={form.accountNumber}
                      onChange={handleFieldChange}
                      error={errors.accountNumber}
                      autoComplete="off"
                      placeholder="Enter your account number"
                    />
                  </div>
                ) : null}

                <Field
                  id="name"
                  label="Your name"
                  icon={UserRound}
                  value={form.name}
                  onChange={handleFieldChange}
                  error={errors.name}
                  autoComplete="name"
                  placeholder="First and last name"
                />
                <Field
                  id="businessName"
                  label="Business name"
                  icon={Building2}
                  value={form.businessName}
                  onChange={handleFieldChange}
                  error={errors.businessName}
                  autoComplete="organization"
                  placeholder="Your company"
                />
                <div className="sm:col-span-2">
                  <div>
                    <label
                      className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-600"
                      htmlFor="address"
                    >
                      Business or billing address
                    </label>
                    <span
                      className={`relative block rounded-2xl border bg-white transition focus-within:ring-4 ${
                        errors.address
                          ? "border-red-400 focus-within:border-red-500 focus-within:ring-red-100"
                          : "border-slate-200 focus-within:border-slate-900 focus-within:ring-slate-100"
                      }`}
                    >
                      <MapPin
                        className={`pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 ${
                          errors.address ? "text-red-500" : "text-slate-400"
                        }`}
                        aria-hidden="true"
                      />
                      <AddressAutocompleteInput
                        id="address"
                        value={form.address}
                        onChange={handleAddressChange}
                        autoComplete="off"
                        enableLocalFallback
                        placeholder="Start typing your address…"
                        showStatus={false}
                        className="w-full rounded-2xl border-0 bg-transparent py-4 pl-12 pr-4 text-base font-bold text-slate-900 outline-none placeholder:font-semibold placeholder:text-slate-400"
                      />
                    </span>
                    {errors.address ? (
                      <span
                        id="address-error"
                        className="mt-1.5 block text-sm font-bold text-red-600"
                      >
                        {errors.address}
                      </span>
                    ) : (
                      <span className="mt-1.5 block text-xs font-semibold text-slate-500">
                        Start typing, then choose the complete address from the list.
                      </span>
                    )}
                  </div>
                </div>
                <Field
                  id="phone"
                  label="Phone number"
                  icon={Phone}
                  value={form.phone}
                  onChange={handleFieldChange}
                  error={errors.phone}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(208) 555-0123"
                />
                <Field
                  id="email"
                  label="Email address"
                  icon={Mail}
                  value={form.email}
                  onChange={handleFieldChange}
                  error={errors.email}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@business.com"
                />

                <label className="hidden" aria-hidden="true">
                  Website
                  <input
                    name="website"
                    value={form.website}
                    onChange={handleFieldChange}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </label>
              </div>

              {submitError ? (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
                >
                  {submitError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#FC2C38] px-5 py-4 text-base font-black text-white shadow-lg transition hover:bg-red-600 disabled:cursor-wait disabled:bg-slate-400"
              >
                {isSubmitting ? "Submitting securely..." : "Create my account"}
                {!isSubmitting ? (
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                ) : null}
              </button>
              <p className="mt-3 text-center text-xs font-semibold leading-5 text-slate-500">
                We will verify your information before customer portal access
                is activated.
              </p>
            </form>
          ) : null}

          {step === "complete" ? (
            <div className="p-6 text-center sm:p-10">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="h-8 w-8" aria-hidden="true" />
              </span>
              <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                Request received
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Thanks, {form.name.trim().split(/\s+/)[0]}.
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-slate-600">
                We received the account request for {form.businessName.trim()}.
                {confirmation?.emailLinkSent
                  ? ` We sent a secure sign-in link to ${form.email.trim()} so you can verify your email now.`
                  : ` Capital Lumber will verify the information and contact you at ${form.email.trim()} with the next step.`}
              </p>
              {confirmation?.emailLinkError ? (
                <div className="mx-auto mt-5 max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">
                  Your request was saved, but the sign-in email could not be
                  sent. Use Customer sign in above to request a new link.
                </div>
              ) : null}
              {confirmation?.reference ? (
                <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  Reference {confirmation.reference}
                </p>
              ) : null}
              <button
                type="button"
                onClick={startOver}
                className="mt-7 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
              >
                Submit another request
              </button>
            </div>
          ) : null}
        </section>
      </section>

      <footer className="border-t border-slate-200 bg-white/70">
        <div className="mx-auto flex max-w-6xl items-center justify-center px-4 py-5 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onBackToEmployeeLogin}
            className="text-[11px] font-bold text-slate-400 transition hover:text-slate-700"
          >
            Employee sign in
          </button>
        </div>
      </footer>
    </main>
  );
}
