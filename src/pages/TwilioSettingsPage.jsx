import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  MessageSquareText,
  Save,
  Send,
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
import { isDeliveryComplete } from "../utils/deliveryStatus";
import {
  sendTwilioCustomerMessage,
  sendTwilioTestMessage,
} from "../utils/twilioMessaging";

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
    enabledKey: "deliveryCompleteEnabled",
    templateKey: "deliveryCompleteTemplate",
    title: "Delivery complete",
    description: "Send manually after selecting a completed delivery.",
  },
  {
    enabledKey: "willCallEnabled",
    templateKey: "willCallTemplate",
    title: "Will Call ready",
    description: "Use when an order is ready for customer pickup.",
  },
];

function getDateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (Number.isFinite(Number(value?.seconds))) {
    return new Date(Number(value.seconds) * 1000);
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getCompletedAt(delivery) {
  return getDateValue(
    delivery?.deliveredAt ||
      delivery?.completedAt ||
      delivery?.updatedAt ||
      delivery?.deliveryDate,
  );
}

function formatCompletedAt(delivery) {
  const date = getCompletedAt(delivery);
  if (!date) return "delivery completion";

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getDeliveryCustomer(delivery) {
  return (
    String(delivery?.contactName || "").trim() ||
    String(delivery?.customerName || "").trim() ||
    "there"
  );
}

function getDeliveryPhone(delivery) {
  return String(
    delivery?.contactPhone || delivery?.phoneNumber || delivery?.phone || "",
  ).trim();
}

function getDeliveryAddress(delivery) {
  return String(
    delivery?.address || delivery?.deliveryAddress || delivery?.jobAddress || "",
  ).trim();
}

function getDeliveryPhotos(delivery) {
  const photoCandidates = [
    ...(Array.isArray(delivery?.deliveryPhotos)
      ? delivery.deliveryPhotos
      : []),
    delivery?.deliveryPhoto,
    ...(Array.isArray(delivery?.hardwarePhotos)
      ? delivery.hardwarePhotos
      : []),
    delivery?.hardwarePhoto,
  ].filter(Boolean);
  const seenUrls = new Set();
  let combinedBytes = 0;

  return photoCandidates
    .map((photo) => {
      const url = String(photo?.url || photo?.dataUrl || "").trim();
      const size = Math.max(0, Number(photo?.size) || 0);
      return { ...photo, url, size };
    })
    .filter((photo) => {
      if (!photo.url.startsWith("https://") || seenUrls.has(photo.url)) {
        return false;
      }
      if (photo.size && combinedBytes + photo.size > 4_500_000) {
        return false;
      }

      seenUrls.add(photo.url);
      combinedBytes += photo.size;
      return true;
    })
    .slice(0, 2);
}

function fillPreviewTemplate(template, delivery) {
  const fields = {
    customer: getDeliveryCustomer(delivery),
    order: String(delivery?.orderNumber || "your order").trim(),
    date: formatCompletedAt(delivery),
    address: getDeliveryAddress(delivery) || "the delivery address",
  };

  return String(template || "").replace(
    /{{\s*(customer|order|date|address)\s*}}/gi,
    (match, key) => fields[String(key).toLowerCase()] || match,
  );
}

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

export default function TwilioSettingsPage({
  deliveries = /** @type {Array<Record<string, any>>} */ ([]),
  onPageChange,
}) {
  const [settings, setSettings] = useState(defaultTwilioSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [deliveryPhoneNumber, setDeliveryPhoneNumber] = useState("");
  const [isSendingDeliveryComplete, setIsSendingDeliveryComplete] =
    useState(false);
  const [deliveryCompleteMessage, setDeliveryCompleteMessage] = useState("");
  const [deliveryCompleteError, setDeliveryCompleteError] = useState("");
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

  const completedDeliveries = useMemo(
    () =>
      deliveries
        .filter((delivery) => isDeliveryComplete(delivery))
        .sort(
          (firstDelivery, secondDelivery) =>
            (getCompletedAt(secondDelivery)?.getTime() || 0) -
            (getCompletedAt(firstDelivery)?.getTime() || 0),
        ),
    [deliveries],
  );

  const selectedDelivery = useMemo(
    () =>
      completedDeliveries.find(
        (delivery) => String(delivery.id) === selectedDeliveryId,
      ) || null,
    [completedDeliveries, selectedDeliveryId],
  );

  const deliveryCompletePreview = useMemo(
    () =>
      selectedDelivery
        ? fillPreviewTemplate(settings.deliveryCompleteTemplate, selectedDelivery)
        : "",
    [selectedDelivery, settings.deliveryCompleteTemplate],
  );

  const selectedDeliveryPhotos = useMemo(
    () => (selectedDelivery ? getDeliveryPhotos(selectedDelivery) : []),
    [selectedDelivery],
  );

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

  async function handleTestMessage() {
    if (validationError) {
      setError(validationError);
      return;
    }
    if (testPhoneNumber.replace(/\D/g, "").length < 10) {
      setError("Enter a valid mobile number for the test message.");
      return;
    }

    setIsSendingTest(true);
    setMessage("");
    setError("");

    try {
      const savedSettings = await saveTwilioSettings(settings);
      setSettings(savedSettings);
      const result = await sendTwilioTestMessage(testPhoneNumber);
      setMessage(
        `Twilio queued the test message to ${result.maskedTo || "the test phone"}.`,
      );
    } catch (sendError) {
      console.error("Unable to send Twilio test message:", sendError);
      setError(getFirebaseErrorMessage(sendError));
    } finally {
      setIsSendingTest(false);
    }
  }

  function chooseCompletedDelivery(deliveryId) {
    const delivery = completedDeliveries.find(
      (candidate) => String(candidate.id) === deliveryId,
    );

    setSelectedDeliveryId(deliveryId);
    setDeliveryPhoneNumber(getDeliveryPhone(delivery));
    setDeliveryCompleteMessage("");
    setDeliveryCompleteError("");
    setMessage("");
    setError("");
  }

  async function handleDeliveryCompleteMessage() {
    if (!selectedDelivery) {
      setDeliveryCompleteError("Select a completed delivery first.");
      return;
    }
    if (deliveryPhoneNumber.replace(/\D/g, "").length < 10) {
      setDeliveryCompleteError(
        "Enter a valid customer mobile number, including the area code.",
      );
      return;
    }
    if (validationError) {
      setDeliveryCompleteError(validationError);
      return;
    }
    if (!String(settings.deliveryCompleteTemplate || "").trim()) {
      setDeliveryCompleteError("Enter a Delivery complete message template.");
      return;
    }

    setIsSendingDeliveryComplete(true);
    setDeliveryCompleteMessage("");
    setDeliveryCompleteError("");
    setMessage("");
    setError("");

    try {
      // Clicking the explicit manual-send button is sufficient intent to turn
      // on the two switches required by the server for this message type.
      const savedSettings = await saveTwilioSettings({
        ...settings,
        enabled: true,
        deliveryCompleteEnabled: true,
      });
      setSettings(savedSettings);
      const result = await sendTwilioCustomerMessage({
        messageType: "deliveryComplete",
        toPhoneNumber: deliveryPhoneNumber,
        customer: getDeliveryCustomer(selectedDelivery),
        order: selectedDelivery.orderNumber,
        date: formatCompletedAt(selectedDelivery),
        address: getDeliveryAddress(selectedDelivery),
        deliveryId: selectedDelivery.id,
        mediaUrls: selectedDeliveryPhotos.map((photo) => photo.url),
      });
      setDeliveryCompleteMessage(
        `Delivery complete ${selectedDeliveryPhotos.length ? "MMS" : "message"} queued to ${result.maskedTo || "the customer"} for order ${selectedDelivery.orderNumber}${selectedDeliveryPhotos.length ? ` with ${selectedDeliveryPhotos.length} photo${selectedDeliveryPhotos.length === 1 ? "" : "s"}` : ""}.`,
      );
    } catch (sendError) {
      console.error("Unable to send delivery complete message:", sendError);
      setDeliveryCompleteError(getFirebaseErrorMessage(sendError));
    } finally {
      setIsSendingDeliveryComplete(false);
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

          <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
                  <Send className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">
                    Send a connection test
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-600">
                    Saves the settings above, then sends a fixed Capital Lumber
                    test message through the secure Firebase function. The Auth
                    Token never enters this browser.
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-xl">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Test mobile number</span>
                  <input
                    value={testPhoneNumber}
                    onChange={(event) => {
                      setTestPhoneNumber(event.target.value);
                      setMessage("");
                      setError("");
                    }}
                    placeholder="Test mobile number"
                    inputMode="tel"
                    autoComplete="tel"
                    className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 font-bold text-slate-950 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleTestMessage}
                  disabled={isSendingTest}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {isSendingTest ? "Sending…" : "Send test"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Send a delivery complete message
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Select a completed delivery, confirm the customer number and
                  preview the exact message and photos before sending it manually.
                </p>
              </div>
            </div>

            {completedDeliveries.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-white px-4 py-5 text-sm font-bold text-slate-600">
                No completed deliveries are available yet.
              </div>
            ) : (
              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Completed delivery
                    </span>
                    <select
                      value={selectedDeliveryId}
                      onChange={(event) =>
                        chooseCompletedDelivery(event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                    >
                      <option value="">Select a delivery…</option>
                      {completedDeliveries.map((delivery) => (
                        <option key={delivery.id} value={delivery.id}>
                          Order {delivery.orderNumber} · {delivery.customerName || "Customer"} · {formatCompletedAt(delivery)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Recipient mobile number
                    </span>
                    <input
                      value={deliveryPhoneNumber}
                      onChange={(event) => {
                        setDeliveryPhoneNumber(event.target.value);
                        setDeliveryCompleteMessage("");
                        setDeliveryCompleteError("");
                        setMessage("");
                        setError("");
                      }}
                      placeholder="Customer mobile number"
                      inputMode="tel"
                      autoComplete="tel"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                    />
                    <span className="mt-2 block text-xs font-bold text-slate-500">
                      For a test, replace the customer number with your own mobile number.
                    </span>
                  </label>

                  {selectedDelivery ? (
                    <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Customer</p>
                        <p className="mt-1 font-black text-slate-900">{selectedDelivery.customerName || "Not entered"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Order</p>
                        <p className="mt-1 font-black text-slate-900">{selectedDelivery.orderNumber || "Not entered"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Delivery address</p>
                        <p className="mt-1 font-black text-slate-900">{getDeliveryAddress(selectedDelivery) || "Not entered"}</p>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col rounded-2xl border border-emerald-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Message preview
                  </p>
                  <div className="mt-3 min-h-28 flex-1 rounded-2xl bg-slate-950 p-4 text-sm font-semibold leading-6 text-white">
                    {deliveryCompletePreview ||
                      "Select a delivery to preview the customer message."}
                  </div>
                  {selectedDelivery ? (
                    <div className="mt-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                          MMS photos
                        </p>
                        <span className="text-xs font-black text-emerald-700">
                          {selectedDeliveryPhotos.length} attached
                        </span>
                      </div>
                      {selectedDeliveryPhotos.length > 0 ? (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {selectedDeliveryPhotos.map((photo, photoIndex) => (
                            <img
                              key={photo.url}
                              src={photo.previewUrl || photo.url}
                              alt={`Delivery proof ${photoIndex + 1}`}
                              className="h-28 w-full rounded-xl border border-slate-200 bg-slate-100 object-cover"
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                          This delivery has no MMS-ready saved photos. The text can still be sent without images.
                        </p>
                      )}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleDeliveryCompleteMessage}
                    disabled={!selectedDelivery || isSendingDeliveryComplete}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {isSendingDeliveryComplete
                      ? "Sending…"
                      : "Send delivery complete message"}
                  </button>
                  {deliveryCompleteError ? (
                    <div
                      role="alert"
                      className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700"
                    >
                      {deliveryCompleteError}
                    </div>
                  ) : null}
                  {deliveryCompleteMessage ? (
                    <div
                      role="status"
                      className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800"
                    >
                      {deliveryCompleteMessage}
                    </div>
                  ) : null}
                </div>
              </div>
            )}
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
                  Available fields: {"{{customer}}"}, {"{{order}}"}, {"{{date}}"}, and {"{{address}}"}.
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
            The Auth Token stays server-side. Message logs store the message
            type, sender, provider status, and a masked phone number—not the
            full customer phone number or message body.
          </div>
        </form>
      )}
    </PageContainer>
  );
}
