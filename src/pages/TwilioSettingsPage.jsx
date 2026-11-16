import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  MessageSquareText,
  Save,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";
import {
  defaultTwilioSettings,
  saveTwilioSettings,
  subscribeToTwilioSettings,
} from "../utils/twilioSettingsStorage";

const accountSidPattern = /^AC[0-9a-fA-F]{32}$/;
const messagingServiceSidPattern = /^MG[0-9a-fA-F]{32}$/;

const templateFields = [
  {
    enabledKey: "potentialDeliveryEnabled",
    templateKey: "potentialDeliveryTemplate",
    title: "Potential delivery",
    description: "Use when an order may be delivered but is not scheduled yet.",
  },
  {
    enabledKey: "scheduledDeliveryEnabled",
    templateKey: "scheduledDeliveryTemplate",
    title: "Scheduled delivery",
    description: "Use after the date has been confirmed.",
  },
  {
    enabledKey: "willCallEnabled",
    templateKey: "willCallTemplate",
    title: "Will Call ready",
    description: "Use when an order is ready for customer pickup.",
  },
];

function ConfigurationStatus({ complete, label }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full ${
          complete
            ? "bg-emerald-600 text-white"
            : "bg-slate-200 text-slate-500"
        }`}
      >
        {complete ? <CheckCircle2 className="h-4 w-4" /> : "—"}
      </span>
      {label}
    </div>
  );
}

export default function TwilioSettingsPage({ onPageChange }) {
  const [settings, setSettings] = useState(defaultTwilioSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return subscribeToTwilioSettings(
      (savedSettings) => {
        setSettings(savedSettings);
        setIsLoading(false);
      },
      (loadError) => {
        console.error("Unable to load Twilio settings:", loadError);
        setError(getFirebaseErrorMessage(loadError));
        setIsLoading(false);
      },
    );
  }, []);

  const validationError = useMemo(() => {
    if (!settings.accountSid) return "Enter the Twilio Account SID.";
    if (!accountSidPattern.test(settings.accountSid)) {
      return "The Account SID must start with AC followed by 32 characters.";
    }
    if (!settings.messagingServiceSid) {
      return "Enter the Messaging Service SID.";
    }
    if (!messagingServiceSidPattern.test(settings.messagingServiceSid)) {
      return "The Messaging Service SID must start with MG followed by 32 characters.";
    }
    if (!settings.businessName.trim()) return "Enter the sender business name.";
    return "";
  }, [settings]);

  function updateSetting(key, value) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      [key]: value,
    }));
    setMessage("");
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setMessage("");
    setError("");

    try {
      const savedSettings = await saveTwilioSettings(settings);
      setSettings(savedSettings);
      setMessage("Twilio messaging settings saved.");
    } catch (saveError) {
      console.error("Unable to save Twilio settings:", saveError);
      setError(getFirebaseErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function copySecretCommand() {
    const command =
      "firebase functions:secrets:set TWILIO_AUTH_TOKEN --project capital-lumber-dispatch";

    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("The command could not be copied. Select it manually below.");
    }
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Admin", onClick: () => onPageChange?.("admin") },
          { label: "Twilio Messaging" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            Admin
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Twilio Messaging
          </h1>
          <p className="mt-2 max-w-3xl text-base font-semibold text-slate-500 sm:text-lg">
            Manage customer text settings for potential deliveries, scheduled
            deliveries, and Will Call orders.
          </p>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <input
            type="checkbox"
            checked={Boolean(settings.enabled)}
            onChange={(event) => updateSetting("enabled", event.target.checked)}
            className="h-5 w-5 accent-[#FC2C38]"
          />
          <span>
            <span className="block text-sm font-black text-slate-950">
              Customer texting
            </span>
            <span className="block text-xs font-bold text-slate-500">
              {settings.enabled ? "Enabled" : "Not live yet"}
            </span>
          </span>
        </label>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">
          Loading Twilio settings…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Smartphone className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Twilio connection
                </h2>
                <p className="text-sm font-semibold text-slate-500">
                  These identifiers are visible only to approved administrators.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Account SID
                </span>
                <input
                  value={settings.accountSid}
                  onChange={(event) => updateSetting("accountSid", event.target.value)}
                  placeholder="AC…"
                  autoCapitalize="none"
                  spellCheck="false"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 font-bold text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Messaging Service SID
                </span>
                <input
                  value={settings.messagingServiceSid}
                  onChange={(event) =>
                    updateSetting("messagingServiceSid", event.target.value)
                  }
                  placeholder="MG…"
                  autoCapitalize="none"
                  spellCheck="false"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 font-bold text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Sender phone number
                </span>
                <input
                  value={settings.senderPhoneNumber}
                  onChange={(event) =>
                    updateSetting("senderPhoneNumber", event.target.value)
                  }
                  placeholder="+12085550105"
                  inputMode="tel"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 font-bold text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
                <span className="mt-2 block text-xs font-bold text-slate-500">
                  Optional when the number is already in the Messaging Service sender pool.
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Business name
                </span>
                <input
                  value={settings.businessName}
                  onChange={(event) => updateSetting("businessName", event.target.value)}
                  placeholder="Capital Lumber"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 font-bold text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <ConfigurationStatus
                complete={accountSidPattern.test(settings.accountSid)}
                label="Account SID"
              />
              <ConfigurationStatus
                complete={messagingServiceSidPattern.test(
                  settings.messagingServiceSid,
                )}
                label="Messaging Service"
              />
              <ConfigurationStatus
                complete={Boolean(settings.senderPhoneNumber)}
                label="Sender number"
              />
            </div>
          </section>

          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
                <KeyRound className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black text-slate-950">
                  Secure Auth Token
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  The Twilio Auth Token is intentionally never saved in the app or
                  Firestore. Add it once to Firebase Secret Manager, then this page
                  controls the remaining settings.
                </p>

                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-xs font-bold text-white sm:text-sm">
                    firebase functions:secrets:set TWILIO_AUTH_TOKEN --project capital-lumber-dispatch
                  </code>
                  <button
                    type="button"
                    onClick={copySecretCommand}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-black text-amber-900 transition hover:bg-amber-100"
                  >
                    <Copy className="h-4 w-4" />
                    {copied ? "Copied" : "Copy command"}
                  </button>
                  <a
                    href="https://console.cloud.google.com/security/secret-manager?project=capital-lumber-dispatch"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-black text-amber-900 transition hover:bg-amber-100"
                  >
                    Secret Manager
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                <MessageSquareText className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Customer message templates
                </h2>
                <p className="text-sm font-semibold text-slate-500">
                  Available fields: {"{{customer}}"}, {"{{order}}"}, and {"{{date}}"}.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              {templateFields.map((field) => (
                <div
                  key={field.templateKey}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <label className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block font-black text-slate-950">
                        {field.title}
                      </span>
                      <span className="mt-1 block text-xs font-bold leading-5 text-slate-500">
                        {field.description}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(settings[field.enabledKey])}
                      onChange={(event) =>
                        updateSetting(field.enabledKey, event.target.checked)
                      }
                      className="mt-1 h-5 w-5 shrink-0 accent-[#FC2C38]"
                    />
                  </label>

                  <textarea
                    value={settings[field.templateKey]}
                    onChange={(event) =>
                      updateSetting(field.templateKey, event.target.value)
                    }
                    rows="5"
                    maxLength="1000"
                    disabled={!settings[field.enabledKey]}
                    className="mt-4 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold leading-6 text-slate-800 outline-none transition focus:border-violet-600 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  />
                </div>
              ))}
            </div>
          </section>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
              {message}
            </div>
          ) : null}

          <div className="sticky bottom-4 z-10 flex justify-end rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-5 w-5" />
              {isSaving ? "Saving…" : "Save Twilio settings"}
            </button>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
            The Auth Token stays server-side. Customer phones and text history
            will be protected separately before actual sending is enabled.
          </div>
        </form>
      )}
    </PageContainer>
  );
}
