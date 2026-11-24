import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  ImagePlus,
  KeyRound,
  LoaderCircle,
  MessageSquareText,
  Save,
  Send,
  ShieldCheck,
  Settings2,
  Smartphone,
  Trash2,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { getFirebaseErrorMessage } from "../utils/firebaseErrorMessages";
import {
  defaultTwilioSettings,
  saveTwilioSetting,
  saveTwilioSettings,
  subscribeToTwilioSettings,
} from "../utils/twilioSettingsStorage";
import { isDeliveryComplete } from "../utils/deliveryStatus";
import {
  deleteTwilioDeliveryPhoto,
  uploadTwilioDeliveryPhoto,
} from "../utils/photoStorage";
import {
  sendTwilioCustomerMessage,
  sendTwilioNotificationTestMessage,
  sendTwilioTestMessage,
} from "../utils/twilioMessaging";

const accountSidPattern = /^AC[0-9a-fA-F]{32}$/;
const messagingServiceSidPattern = /^MG[0-9a-fA-F]{32}$/;

const templateFields = [
  {
    messageType: "orderSummary",
    enabledKey: "orderSummaryEnabled",
    templateKey: "orderSummaryTemplate",
    title: "Processed order summary",
    description: "Send automatically after an opted-in customer order is processed.",
  },
  {
    messageType: "potentialDelivery",
    enabledKey: "potentialDeliveryEnabled",
    templateKey: "potentialDeliveryTemplate",
    title: "Potential delivery",
    description: "Use when an order may be delivered but is not scheduled yet.",
  },
  {
    messageType: "scheduledDelivery",
    enabledKey: "scheduledDeliveryEnabled",
    templateKey: "scheduledDeliveryTemplate",
    title: "Scheduled delivery",
    description:
      "Send automatically after the date, driver, and truck are assigned.",
  },
  {
    messageType: "deliveryToday",
    enabledKey: "deliveryTodayEnabled",
    templateKey: "deliveryTodayTemplate",
    title: "Delivery today",
    description: "Send automatically at 7:00 AM on the delivery date.",
  },
  {
    messageType: "deliveryComplete",
    enabledKey: "deliveryCompleteEnabled",
    templateKey: "deliveryCompleteTemplate",
    title: "Delivery complete",
    description:
      "Send automatically after delivery completion photos are saved.",
  },
  {
    messageType: "willCall",
    enabledKey: "willCallEnabled",
    templateKey: "willCallTemplate",
    title: "Will Call ready",
    description:
      "Send automatically after every South and Their Truck item on a Will Call order is checked into receiving.",
  },
];

function getDefaultTemplateTestDate() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

function fillTemplateTestPreview(template, values) {
  const fields = {
    customer: String(values.customer || "Customer").trim(),
    business: String(values.business || "Customer business").trim(),
    order: String(values.order || "123-456").trim(),
    date: String(values.date || getDefaultTemplateTestDate()).trim(),
    address: String(values.address || "123 Test Jobsite, Boise, ID").trim(),
    summaryurl: String(
      values.summaryUrl || "https://dispatch.capitallumber.co",
    ).trim(),
  };

  return String(template || "").replace(
    /{{\s*(customer|business|order|date|address|summaryUrl)\s*}}/gi,
    (match, key) => fields[String(key).toLowerCase()] || match,
  );
}

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

function getDeliveryBusiness(delivery) {
  return (
    String(delivery?.businessName || "").trim() ||
    String(delivery?.customerName || "").trim() ||
    "your business"
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

function getDeliveryPhotos(delivery, maxCombinedBytes = 4_500_000) {
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
      if (photo.size && combinedBytes + photo.size > maxCombinedBytes) {
        return false;
      }

      seenUrls.add(photo.url);
      combinedBytes += photo.size;
      return true;
    })
    .slice(0, 2);
}

function getGlobalPhotoError(error) {
  const code = String(error?.code || "").toLowerCase();

  if (code.includes("storage/unauthorized")) {
    return "Firebase Storage denied the all-deliveries photo. Confirm you are signed in as an administrator and deploy the latest Storage rules.";
  }
  if (code.includes("storage/unauthenticated")) {
    return "Your login expired. Refresh the app, sign in again, and retry the photo.";
  }

  return String(error?.message || "Unable to save the all-deliveries photo.");
}

function fillPreviewTemplate(template, delivery) {
  const fields = {
    customer: getDeliveryCustomer(delivery),
    business: getDeliveryBusiness(delivery),
    order: String(delivery?.orderNumber || "your order").trim(),
    date: formatCompletedAt(delivery),
    address: getDeliveryAddress(delivery) || "the delivery address",
    summaryurl: "https://secure-order-link.example",
  };

  return String(template || "").replace(
    /{{\s*(customer|business|order|date|address|summaryUrl)\s*}}/gi,
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
  const [activeView, setActiveView] = useState("menu");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState("");
  const [notificationTestDraft, setNotificationTestDraft] = useState({
    toPhoneNumber: "",
    customer: "Jordan",
    business: "ABC Construction",
    order: "123-456",
    date: getDefaultTemplateTestDate(),
    address: "123 Test Jobsite, Boise, ID",
    summaryUrl: "https://dispatch.capitallumber.co",
  });
  const [sendingNotificationTestType, setSendingNotificationTestType] =
    useState("");
  const [notificationTestResults, setNotificationTestResults] = useState({});
  const [notificationTestError, setNotificationTestError] = useState("");
  const [savingNotificationToggleType, setSavingNotificationToggleType] =
    useState("");
  const [notificationToggleResults, setNotificationToggleResults] = useState({});
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [deliveryPhoneNumber, setDeliveryPhoneNumber] = useState("");
  const [isSendingDeliveryComplete, setIsSendingDeliveryComplete] =
    useState(false);
  const [deliveryCompleteMessage, setDeliveryCompleteMessage] = useState("");
  const [deliveryCompleteError, setDeliveryCompleteError] = useState("");
  const [isUploadingGlobalPhoto, setIsUploadingGlobalPhoto] = useState(false);
  const [isRemovingGlobalPhoto, setIsRemovingGlobalPhoto] = useState(false);
  const [globalPhotoError, setGlobalPhotoError] = useState("");
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
    () => {
      const globalPhotoSize = Math.max(
        0,
        Number(settings.deliveryCompleteGlobalPhoto?.size) || 0,
      );

      return selectedDelivery
        ? getDeliveryPhotos(
            selectedDelivery,
            Math.max(0, 4_500_000 - globalPhotoSize),
          )
        : [];
    }, [selectedDelivery, settings.deliveryCompleteGlobalPhoto?.size],
  );
  const selectedDeliveryMedia = useMemo(
    () => [
      ...selectedDeliveryPhotos,
      ...(settings.deliveryCompleteGlobalPhoto?.url
        ? [
            {
              ...settings.deliveryCompleteGlobalPhoto,
              isGlobal: true,
            },
          ]
        : []),
    ],
    [selectedDeliveryPhotos, settings.deliveryCompleteGlobalPhoto],
  );

  function updateSetting(key, value) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      [key]: value,
    }));
    setMessage("");
    setError("");
  }

  async function handleGlobalPhotoUpload(file) {
    if (!file) return;

    setIsUploadingGlobalPhoto(true);
    setGlobalPhotoError("");
    setMessage("");
    setError("");

    const previousPhoto = settings.deliveryCompleteGlobalPhoto;

    try {
      const uploadedPhoto = await uploadTwilioDeliveryPhoto({ file });
      const savedSettings = await saveTwilioSettings({
        ...settings,
        deliveryCompleteGlobalPhoto: uploadedPhoto,
      });
      setSettings(savedSettings);
      setMessage("The all-deliveries photo is saved and will be attached to every delivery-complete MMS.");

      if (previousPhoto?.path && previousPhoto.path !== uploadedPhoto.path) {
        deleteTwilioDeliveryPhoto(previousPhoto.path).catch((deleteError) => {
          console.warn("Unable to remove replaced Twilio photo:", deleteError);
        });
      }
    } catch (uploadError) {
      console.error("Unable to save all-deliveries photo:", uploadError);
      setGlobalPhotoError(getGlobalPhotoError(uploadError));
    } finally {
      setIsUploadingGlobalPhoto(false);
    }
  }

  async function handleGlobalPhotoRemove() {
    const currentPhoto = settings.deliveryCompleteGlobalPhoto;
    if (!currentPhoto) return;

    setIsRemovingGlobalPhoto(true);
    setGlobalPhotoError("");
    setMessage("");
    setError("");

    try {
      const savedSettings = await saveTwilioSettings({
        ...settings,
        deliveryCompleteGlobalPhoto: null,
      });
      setSettings(savedSettings);
      setMessage("The all-deliveries photo was removed.");

      if (currentPhoto.path) {
        deleteTwilioDeliveryPhoto(currentPhoto.path).catch((deleteError) => {
          console.warn("Unable to remove Twilio photo file:", deleteError);
        });
      }
    } catch (removeError) {
      console.error("Unable to remove all-deliveries photo:", removeError);
      setGlobalPhotoError(getGlobalPhotoError(removeError));
    } finally {
      setIsRemovingGlobalPhoto(false);
    }
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

  function updateNotificationTestDraft(key, value) {
    setNotificationTestDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }));
    setNotificationTestError("");
    setNotificationTestResults({});
  }

  async function handleNotificationTemplateTest(field) {
    if (validationError) {
      setNotificationTestError(validationError);
      return;
    }
    if (notificationTestDraft.toPhoneNumber.replace(/\D/g, "").length < 10) {
      setNotificationTestError(
        "Enter a valid mobile number for the notification test.",
      );
      return;
    }
    if (!String(settings[field.templateKey] || "").trim()) {
      setNotificationTestError(`Enter a ${field.title} message template first.`);
      return;
    }

    setSendingNotificationTestType(field.messageType);
    setNotificationTestError("");
    setNotificationTestResults((currentResults) => ({
      ...currentResults,
      [field.messageType]: null,
    }));
    setMessage("");
    setError("");

    try {
      const result = await sendTwilioNotificationTestMessage({
        messageType: field.messageType,
        messageTemplate: settings[field.templateKey],
        ...notificationTestDraft,
      });
      setNotificationTestResults((currentResults) => ({
        ...currentResults,
        [field.messageType]: {
          status: "success",
          message: `Queued to ${result.maskedTo || "the test phone"}.`,
        },
      }));
    } catch (sendError) {
      console.error(`Unable to test ${field.messageType}:`, sendError);
      setNotificationTestResults((currentResults) => ({
        ...currentResults,
        [field.messageType]: {
          status: "error",
          message: getFirebaseErrorMessage(sendError),
        },
      }));
    } finally {
      setSendingNotificationTestType("");
    }
  }

  async function handleNotificationToggle(field) {
    const wasEnabled = Boolean(settings[field.enabledKey]);
    const nextEnabled = !wasEnabled;

    setSavingNotificationToggleType(field.messageType);
    setNotificationToggleResults((currentResults) => ({
      ...currentResults,
      [field.messageType]: null,
    }));
    setSettings((currentSettings) => ({
      ...currentSettings,
      [field.enabledKey]: nextEnabled,
    }));

    try {
      await saveTwilioSetting(field.enabledKey, nextEnabled);
      setNotificationToggleResults((currentResults) => ({
        ...currentResults,
        [field.messageType]: {
          status: "success",
          message: `${field.title} ${nextEnabled ? "turned on" : "turned off"}.`,
        },
      }));
    } catch (saveError) {
      console.error(`Unable to toggle ${field.messageType}:`, saveError);
      setSettings((currentSettings) => ({
        ...currentSettings,
        [field.enabledKey]: wasEnabled,
      }));
      setNotificationToggleResults((currentResults) => ({
        ...currentResults,
        [field.messageType]: {
          status: "error",
          message: getFirebaseErrorMessage(saveError),
        },
      }));
    } finally {
      setSavingNotificationToggleType("");
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
        business: getDeliveryBusiness(selectedDelivery),
        order: selectedDelivery.orderNumber,
        date: formatCompletedAt(selectedDelivery),
        address: getDeliveryAddress(selectedDelivery),
        deliveryId: selectedDelivery.id,
        mediaUrls: selectedDeliveryPhotos.map((photo) => photo.url),
      });
      const sentPhotoCount = Math.max(
        0,
        Number(result.mediaCount) || selectedDeliveryMedia.length,
      );
      setDeliveryCompleteMessage(
        `Delivery complete ${sentPhotoCount ? "MMS" : "message"} queued to ${result.maskedTo || "the customer"} for order ${selectedDelivery.orderNumber}${sentPhotoCount ? ` with ${sentPhotoCount} photo${sentPhotoCount === 1 ? "" : "s"}` : ""}.`,
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
          activeView === "menu"
            ? { label: "Twilio Messaging" }
            : {
                label: "Twilio Messaging",
                onClick: () => setActiveView("menu"),
              },
          ...(activeView === "tests"
            ? [{ label: "Text Notification Dashboard" }]
            : []),
          ...(activeView === "settings" ? [{ label: "Settings" }] : []),
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
            Admin
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {activeView === "tests"
              ? "Text Notification Dashboard"
              : activeView === "settings"
                ? "Twilio Settings"
                : "Twilio Messaging"}
          </h1>
          <p className="mt-2 max-w-3xl text-base font-semibold text-slate-500 sm:text-lg">
            {activeView === "tests"
              ? "Preview and test every customer text notification from one place."
              : activeView === "settings"
                ? "Manage the Twilio connection, templates, attachments, and live notification switches."
                : "Choose the notification test dashboard or manage Twilio settings."}
          </p>
        </div>

        {activeView === "settings" ? (
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
        ) : null}
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">
          Loading Twilio settings…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <section
            hidden={activeView !== "menu"}
            style={activeView === "menu" ? undefined : { display: "none" }}
            className="grid gap-5 lg:grid-cols-2"
          >
            <button
              type="button"
              onClick={() => setActiveView("tests")}
              className="group min-h-64 rounded-3xl border border-slate-200 bg-white p-7 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-red-300 hover:shadow-lg"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38] transition group-hover:bg-[#FC2C38] group-hover:text-white">
                <MessageSquareText className="h-7 w-7" aria-hidden="true" />
              </span>
              <span className="mt-8 block text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                Test center
              </span>
              <span className="mt-2 block text-2xl font-black text-slate-950">
                Text Notification Dashboard
              </span>
              <span className="mt-3 block max-w-xl text-sm font-semibold leading-6 text-slate-500">
                Preview all six customer notifications and send individual tests
                to your own phone.
              </span>
              <span className="mt-7 inline-flex items-center gap-2 text-sm font-black text-slate-950">
                Open dashboard
                <span aria-hidden="true">→</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView("settings")}
              className="group min-h-64 rounded-3xl border border-slate-200 bg-white p-7 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-700 group-hover:text-white">
                <Settings2 className="h-7 w-7" aria-hidden="true" />
              </span>
              <span className="mt-8 block text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                Configuration
              </span>
              <span className="mt-2 block text-2xl font-black text-slate-950">
                Settings
              </span>
              <span className="mt-3 block max-w-xl text-sm font-semibold leading-6 text-slate-500">
                Manage the Twilio connection, live switches, templates, and the
                standard delivery photo.
              </span>
              <span className="mt-7 inline-flex items-center gap-2 text-sm font-black text-slate-950">
                Open settings
                <span aria-hidden="true">→</span>
              </span>
            </button>
          </section>

          <div
            hidden={activeView === "menu"}
            style={activeView === "menu" ? { display: "none" } : undefined}
          >
            <button
              type="button"
              onClick={() => setActiveView("menu")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Twilio Messaging
            </button>
          </div>

          <section
            hidden={activeView !== "settings"}
            style={activeView === "settings" ? undefined : { display: "none" }}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
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

          <section
            hidden={activeView !== "settings"}
            style={activeView === "settings" ? undefined : { display: "none" }}
            className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6"
          >
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

          <section
            hidden={activeView !== "tests"}
            style={activeView === "tests" ? undefined : { display: "none" }}
            className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm sm:p-6"
          >
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

          <section
            hidden={activeView !== "tests"}
            style={activeView === "tests" ? undefined : { display: "none" }}
            className="overflow-hidden rounded-3xl border border-slate-300 bg-slate-950 shadow-sm"
          >
            <div className="flex flex-col gap-4 border-b border-slate-800 px-5 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FC2C38] text-white shadow-sm">
                  <MessageSquareText className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
                    Twilio test center
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-white">
                    Notification test dashboard
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
                    Preview and send one real test message at a time. Tests work
                    even when that notification is disabled and never change an
                    order, delivery, or live automation.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs font-black leading-5 text-amber-200">
                Each Send test button sends one SMS or MMS to the number below.
              </div>
            </div>

            <div className="bg-white p-5 sm:p-6">
              <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Test mobile number
                  </span>
                  <input
                    value={notificationTestDraft.toPhoneNumber}
                    onChange={(event) =>
                      updateNotificationTestDraft(
                        "toPhoneNumber",
                        event.target.value,
                      )
                    }
                    placeholder="Your mobile number"
                    inputMode="tel"
                    autoComplete="tel"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-950 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Contact name
                  </span>
                  <input
                    value={notificationTestDraft.customer}
                    onChange={(event) =>
                      updateNotificationTestDraft("customer", event.target.value)
                    }
                    placeholder="Jordan"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-950 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Business name
                  </span>
                  <input
                    value={notificationTestDraft.business}
                    onChange={(event) =>
                      updateNotificationTestDraft("business", event.target.value)
                    }
                    placeholder="ABC Construction"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-950 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Order number
                  </span>
                  <input
                    value={notificationTestDraft.order}
                    onChange={(event) =>
                      updateNotificationTestDraft("order", event.target.value)
                    }
                    placeholder="123-456"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-950 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Date or timing
                  </span>
                  <input
                    value={notificationTestDraft.date}
                    onChange={(event) =>
                      updateNotificationTestDraft("date", event.target.value)
                    }
                    placeholder="Monday, November 23, 2026"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-950 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Delivery address
                  </span>
                  <input
                    value={notificationTestDraft.address}
                    onChange={(event) =>
                      updateNotificationTestDraft("address", event.target.value)
                    }
                    placeholder="123 Test Jobsite, Boise, ID"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-950 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  />
                </label>

                <label className="block md:col-span-2 xl:col-span-3">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Sample order-summary link
                  </span>
                  <input
                    value={notificationTestDraft.summaryUrl}
                    onChange={(event) =>
                      updateNotificationTestDraft("summaryUrl", event.target.value)
                    }
                    placeholder="https://dispatch.capitallumber.co"
                    inputMode="url"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-950 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                  />
                  <span className="mt-2 block text-xs font-bold text-slate-500">
                    This checks the order-summary message and clickable link. It
                    does not generate a new customer PDF.
                  </span>
                </label>
              </div>

              {notificationTestError ? (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700"
                >
                  {notificationTestError}
                </div>
              ) : null}

              {!settings.enabled ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
                  <span className="font-black">Master customer texting is off.</span>{" "}
                  You can still test every message and set its individual switch,
                  but automatic customer texts remain paused until Customer
                  Texting is enabled in Settings.
                </div>
              ) : null}

              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                {templateFields.map((field) => {
                  const result = notificationTestResults[field.messageType];
                  const toggleResult =
                    notificationToggleResults[field.messageType];
                  const isSending =
                    sendingNotificationTestType === field.messageType;
                  const isSavingToggle =
                    savingNotificationToggleType === field.messageType;
                  const isEnabled = Boolean(settings[field.enabledKey]);

                  return (
                    <article
                      key={`test-${field.messageType}`}
                      className="relative flex flex-col overflow-hidden rounded-3xl border-2 border-slate-200 bg-slate-50 p-5 shadow-md"
                    >
                      <span
                        className={
                          isEnabled
                            ? "absolute inset-x-0 top-0 h-1.5 bg-emerald-500"
                            : "absolute inset-x-0 top-0 h-1.5 bg-slate-300"
                        }
                        aria-hidden="true"
                      />
                      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 pt-1">
                        <div>
                          <p className="text-lg font-black text-slate-950">
                            {field.title}
                          </p>
                          <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                            {field.description}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                            {isSavingToggle
                              ? "Saving…"
                              : isEnabled
                                ? "On"
                                : "Off"}
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isEnabled}
                            aria-label={`${isEnabled ? "Turn off" : "Turn on"} ${field.title}`}
                            onClick={() => handleNotificationToggle(field)}
                            disabled={Boolean(savingNotificationToggleType)}
                            className={
                              isEnabled
                                ? "mt-1 flex h-8 w-14 items-center rounded-full bg-emerald-600 p-1 transition disabled:cursor-wait disabled:opacity-50"
                                : "mt-1 flex h-8 w-14 items-center rounded-full bg-slate-300 p-1 transition disabled:cursor-wait disabled:opacity-50"
                            }
                          >
                            <span
                              className={
                                isEnabled
                                  ? "h-6 w-6 translate-x-6 rounded-full bg-white shadow-sm transition"
                                  : "h-6 w-6 translate-x-0 rounded-full bg-white shadow-sm transition"
                              }
                            />
                          </button>
                        </div>
                      </div>

                      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                        Customer message preview
                      </p>
                      <div className="mt-2 min-h-32 flex-1 whitespace-pre-wrap rounded-2xl border border-slate-300 bg-white p-4 text-sm font-semibold leading-6 text-slate-950 shadow-sm">
                        {fillTemplateTestPreview(
                          settings[field.templateKey],
                          notificationTestDraft,
                        ) || "Add a template below to preview this message."}
                      </div>

                      {field.messageType === "deliveryComplete" &&
                      settings.deliveryCompleteGlobalPhoto?.url ? (
                        <div className="mt-3 flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-2.5">
                          <img
                            src={settings.deliveryCompleteGlobalPhoto.url}
                            alt="Standard delivery-complete test attachment"
                            className="h-12 w-12 rounded-lg border border-violet-200 bg-white object-cover"
                          />
                          <p className="text-xs font-black text-violet-800">
                            The standard all-deliveries photo will be attached to
                            this MMS test.
                          </p>
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => handleNotificationTemplateTest(field)}
                        disabled={Boolean(sendingNotificationTestType)}
                        className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-4 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-50"
                      >
                        {isSending ? (
                          <LoaderCircle
                            className="h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Send className="h-4 w-4" aria-hidden="true" />
                        )}
                        {isSending ? "Sending test…" : `Send ${field.title} test`}
                      </button>

                      {toggleResult ? (
                        <div
                          role={
                            toggleResult.status === "error" ? "alert" : "status"
                          }
                          className={
                            toggleResult.status === "error"
                              ? "mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700"
                              : "mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-800"
                          }
                        >
                          {toggleResult.message}
                        </div>
                      ) : null}

                      {result ? (
                        <div
                          role={result.status === "error" ? "alert" : "status"}
                          className={
                            result.status === "error"
                              ? "mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700"
                              : "mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800"
                          }
                        >
                          {result.message}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section
            hidden={activeView !== "settings"}
            style={activeView === "settings" ? undefined : { display: "none" }}
            className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-sm">
                <ImagePlus className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Photo attached to every delivery
                </h2>
                <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-600">
                  Upload one reusable image for every delivery-complete MMS. It
                  will be included alongside each delivery&apos;s proof photos.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 rounded-2xl border border-violet-200 bg-white p-4 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)] md:items-center">
              {settings.deliveryCompleteGlobalPhoto?.url ? (
                <img
                  src={settings.deliveryCompleteGlobalPhoto.url}
                  alt="All-deliveries MMS attachment"
                  className="h-52 w-full rounded-2xl border border-slate-200 bg-slate-100 object-contain"
                />
              ) : (
                <div className="flex h-52 items-center justify-center rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/60 px-6 text-center">
                  <div>
                    <ImagePlus className="mx-auto h-9 w-9 text-violet-500" aria-hidden="true" />
                    <p className="mt-3 text-sm font-black text-slate-800">
                      No all-deliveries photo yet
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      JPG, PNG, HEIC, or another image format
                    </p>
                  </div>
                </div>
              )}

              <div>
                {settings.deliveryCompleteGlobalPhoto?.url ? (
                  <>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-700">
                      Active on every completed delivery
                    </p>
                    <p className="mt-2 break-words text-base font-black text-slate-950">
                      {settings.deliveryCompleteGlobalPhoto.name || "All-deliveries photo"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      This photo is automatically added by Firebase when the
                      delivery-complete message is sent.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-black text-slate-950">
                      Add the standard customer photo
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      The image is compressed for reliable MMS delivery and
                      saved immediately after upload.
                    </p>
                  </>
                )}

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-black text-white transition hover:bg-violet-800 has-[:disabled]:cursor-wait has-[:disabled]:opacity-60">
                    {isUploadingGlobalPhoto ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ImagePlus className="h-4 w-4" aria-hidden="true" />
                    )}
                    {isUploadingGlobalPhoto
                      ? "Uploading…"
                      : settings.deliveryCompleteGlobalPhoto?.url
                        ? "Replace photo"
                        : "Upload photo"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingGlobalPhoto || isRemovingGlobalPhoto}
                      onChange={(event) => {
                        handleGlobalPhotoUpload(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                      className="sr-only"
                    />
                  </label>

                  {settings.deliveryCompleteGlobalPhoto?.url ? (
                    <button
                      type="button"
                      onClick={handleGlobalPhotoRemove}
                      disabled={isUploadingGlobalPhoto || isRemovingGlobalPhoto}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-black text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                    >
                      {isRemovingGlobalPhoto ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      )}
                      {isRemovingGlobalPhoto ? "Removing…" : "Remove photo"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {globalPhotoError ? (
              <div
                role="alert"
                className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700"
              >
                {globalPhotoError}
              </div>
            ) : null}
          </section>

          <section
            hidden={activeView !== "tests"}
            style={activeView === "tests" ? undefined : { display: "none" }}
            className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-6"
          >
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
                  <div className="mt-3 min-h-28 flex-1 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold leading-6 text-slate-950 shadow-inner">
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
                          {selectedDeliveryMedia.length} attached
                        </span>
                      </div>
                      {selectedDeliveryMedia.length > 0 ? (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          {selectedDeliveryMedia.map((photo, photoIndex) => (
                            <div key={photo.url} className="relative">
                              <img
                                src={photo.previewUrl || photo.url}
                                alt={photo.isGlobal ? "All-deliveries attachment" : `Delivery proof ${photoIndex + 1}`}
                                className="h-28 w-full rounded-xl border border-slate-200 bg-slate-100 object-cover"
                              />
                              {photo.isGlobal ? (
                                <span className="absolute bottom-2 left-2 rounded-full bg-violet-700 px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-white shadow-sm">
                                  All deliveries
                                </span>
                              ) : null}
                            </div>
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

          <section
            hidden={activeView !== "settings"}
            style={activeView === "settings" ? undefined : { display: "none" }}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                <MessageSquareText className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Customer message templates
                </h2>
                <p className="text-sm font-semibold text-slate-500">
                  Available fields: {"{{customer}}"}, {"{{business}}"}, {"{{order}}"}, {"{{date}}"}, {"{{address}}"}, and {"{{summaryUrl}}"}.
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

          <div
            hidden={activeView !== "settings"}
            style={activeView === "settings" ? undefined : { display: "none" }}
            className="sticky bottom-4 z-10 flex justify-end rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur"
          >
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-5 w-5" />
              {isSaving ? "Saving…" : "Save Twilio settings"}
            </button>
          </div>

          <div
            hidden={activeView !== "settings"}
            style={activeView === "settings" ? undefined : { display: "none" }}
            className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900"
          >
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
