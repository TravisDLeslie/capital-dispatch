import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Store,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import AddressAutocompleteInput from "./AddressAutocompleteInput";
import DeliveryPriceEstimate from "./DeliveryPriceEstimate";
import capitalLumberLogo from "../assets/logo-black-text.svg";
import { inventoryCatalogItems } from "../data/inventoryCatalog";
import {
  getCustomerPortalProfile,
  listMyCustomerQuoteRequests,
  submitCustomerQuoteRequest,
  updateMyCustomerQuoteRequest,
  updateCustomerPortalProfile,
} from "../utils/customerAccountRequestStorage";

const PUBLIC_CATALOG = inventoryCatalogItems
  .map((item) => ({
    itemNumber: String(item.itemNumber || "").trim(),
    description: String(item.description || "").trim(),
    brand: String(item.brand || "").trim(),
    groupSection: String(item.groupSection || "").trim(),
  }))
  .filter((item) => item.itemNumber && item.description);

const EMPTY_PROFILE = {
  accountNumber: "",
  address: "",
  businessName: "",
  email: "",
  name: "",
  phone: "",
  status: "emailVerified",
};

const TIMELINE_OPTIONS = [
  { value: "as-soon-as-possible", label: "As soon as possible" },
  { value: "within-one-week", label: "Within one week" },
  { value: "within-two-weeks", label: "Within two weeks" },
  { value: "this-month", label: "Sometime this month" },
  { value: "flexible", label: "My timing is flexible" },
];

const QUOTE_STATUS_DETAILS = {
  new: {
    label: "Request received",
    className: "bg-amber-100 text-amber-800",
  },
  reviewing: {
    label: "Under review",
    className: "bg-blue-100 text-blue-800",
  },
  quoted: {
    label: "Quote ready",
    className: "bg-emerald-100 text-emerald-800",
  },
  closed: {
    label: "Closed",
    className: "bg-slate-200 text-slate-600",
  },
};

function formatQuoteDate(value, options = {}) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  }).format(date);
}

const customerCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCustomerCurrency(value) {
  const amount = Number(value);
  return customerCurrencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

function getQuoteValidityLabel(quote) {
  if (quote.status === "closed") return "Quote closed";
  if (quote.status !== "quoted") return "Valid for 2 weeks once issued";

  const issuedAt = new Date(
    quote.reviewedAt || quote.updatedAt || quote.createdAt || "",
  );
  if (Number.isNaN(issuedAt.getTime())) return "Valid for 2 weeks from issue";
  issuedAt.setDate(issuedAt.getDate() + (Number(quote.validityDays) || 14));
  return `Valid through ${formatQuoteDate(issuedAt)}`;
}

function customerErrorMessage(error, fallback) {
  const message = String(error?.message || "").replace(/^Firebase:\s*/i, "");
  const normalizedMessage = message.trim().toLowerCase();

  if (
    !normalizedMessage ||
    normalizedMessage === "internal" ||
    normalizedMessage.includes("functions/internal")
  ) {
    return fallback;
  }

  if (/unauthenticated|permission-denied/i.test(message)) {
    return "Your secure session has expired. Sign out, then request a new email link.";
  }
  if (/invalid-argument/i.test(message)) {
    return "Review the highlighted information and try again.";
  }
  if (/unavailable|network/i.test(message)) {
    return "We could not reach Capital Lumber. Check your connection and try again.";
  }

  return message || fallback;
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (digits.length !== 10) return value;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function NavButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition sm:px-4 ${
        active
          ? "bg-slate-950 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function InfoLine({ dark = false, icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
          dark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className={`text-[10px] font-black uppercase tracking-[0.15em] ${dark ? "text-slate-500" : "text-slate-400"}`}>
          {label}
        </p>
        <p className={`mt-0.5 truncate text-sm font-black ${dark ? "text-white" : "text-slate-800"}`}>
          {value || "Not provided"}
        </p>
      </div>
    </div>
  );
}

function ProfileField({ id, label, icon: Icon, ...inputProps }) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <span className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 transition focus-within:border-slate-900 focus-within:ring-4 focus-within:ring-slate-100">
        <Icon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
        <input
          id={id}
          name={id}
          className="min-w-0 flex-1 border-0 bg-transparent py-4 text-base font-bold text-slate-900 outline-none placeholder:text-slate-400"
          {...inputProps}
        />
      </span>
    </label>
  );
}

export default function CustomerPortalDashboard({
  accountLink,
  currentUser,
  onBackToEmployeeLogin,
  onSignOut,
}) {
  const [view, setView] = useState("dashboard");
  const [profile, setProfile] = useState(() => ({
    ...EMPTY_PROFILE,
    accountNumber: accountLink?.accountNumber || "",
    email: currentUser?.email || "",
    status: accountLink?.status || "emailVerified",
  }));
  const [profileDraft, setProfileDraft] = useState(profile);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileStatus, setProfileStatus] = useState("idle");
  const [profileError, setProfileError] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [quoteItems, setQuoteItems] = useState([]);
  const [isAddingQuoteItem, setIsAddingQuoteItem] = useState(false);
  const [deliveryNeeded, setDeliveryNeeded] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [quoteStatus, setQuoteStatus] = useState("idle");
  const [quoteError, setQuoteError] = useState("");
  const [quoteConfirmation, setQuoteConfirmation] = useState(null);
  const [quoteHistory, setQuoteHistory] = useState([]);
  const [quoteHistoryStatus, setQuoteHistoryStatus] = useState("loading");
  const [quoteHistoryError, setQuoteHistoryError] = useState("");
  const [showAllQuoteHistory, setShowAllQuoteHistory] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [editingQuote, setEditingQuote] = useState(null);
  const catalogSearchRef = useRef(null);

  useEffect(() => {
    let isActive = true;

    getCustomerPortalProfile()
      .then((loadedProfile) => {
        if (!isActive) return;
        const nextProfile = {
          ...EMPTY_PROFILE,
          ...loadedProfile,
          email: loadedProfile.email || currentUser?.email || "",
        };
        setProfile(nextProfile);
        setProfileDraft(nextProfile);
        setDeliveryAddress(nextProfile.address || "");
      })
      .catch((error) => {
        if (!isActive) return;
        console.error("Unable to load customer profile:", error);
        setProfileError(
          customerErrorMessage(error, "We could not load your account information."),
        );
      })
      .finally(() => {
        if (isActive) setIsLoadingProfile(false);
      });

    return () => {
      isActive = false;
    };
  }, [currentUser?.email]);

  useEffect(() => {
    if (!selectedQuote) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSelectedQuote(null);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedQuote]);

  useEffect(() => {
    let isActive = true;
    setQuoteHistoryStatus("loading");
    setQuoteHistoryError("");

    listMyCustomerQuoteRequests()
      .then((requests) => {
        if (!isActive) return;
        setQuoteHistory(requests);
        setQuoteHistoryStatus("loaded");
      })
      .catch((error) => {
        if (!isActive) return;
        console.error("Unable to load customer quote history:", error);
        setQuoteHistoryError(
          customerErrorMessage(error, "We could not load your prior quotes."),
        );
        setQuoteHistoryStatus("error");
      });

    return () => {
      isActive = false;
    };
  }, [currentUser?.email]);

  const catalogResults = useMemo(() => {
    const search = catalogSearch.trim().toLowerCase();
    if (search.length < 2) return [];

    return PUBLIC_CATALOG.filter((item) =>
      [item.itemNumber, item.description, item.brand, item.groupSection]
        .join(" ")
        .toLowerCase()
        .includes(search),
    ).slice(0, 10);
  }, [catalogSearch]);

  const firstName = String(profile.name || currentUser?.displayName || "there")
    .trim()
    .split(/\s+/)[0];
  const accountIsLinked = profile.status === "approved";

  function resetQuoteBuilder() {
    setEditingQuote(null);
    setQuoteItems([]);
    setCatalogSearch("");
    setIsAddingQuoteItem(false);
    setDeliveryNeeded(false);
    setDeliveryAddress(profile.address || "");
    setNeededBy("");
    setQuoteNotes("");
    setQuoteStatus("idle");
    setQuoteError("");
    setQuoteConfirmation(null);
  }

  function openQuote() {
    resetQuoteBuilder();
    setView("quote");
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => catalogSearchRef.current?.focus());
    });
  }

  function editExistingQuote(quote) {
    setEditingQuote(quote);
    setQuoteItems(
      (quote.items || []).map((item) => ({
        itemNumber: item.itemNumber,
        description: item.description,
        brand: item.brand || "",
        groupSection: item.groupSection || "",
        quantity: Number(item.quantity) || 1,
      })),
    );
    setDeliveryNeeded(quote.deliveryNeeded === true);
    setDeliveryAddress(
      quote.deliveryNeeded
        ? quote.deliveryAddress || profile.address || ""
        : profile.address || "",
    );
    setNeededBy(quote.neededBy || "");
    setQuoteNotes(quote.notes || "");
    setCatalogSearch("");
    setIsAddingQuoteItem(true);
    setQuoteStatus("idle");
    setQuoteError("");
    setQuoteConfirmation(null);
    setSelectedQuote(null);
    setView("quote");
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => catalogSearchRef.current?.focus());
    });
  }

  function openSettings() {
    setView("settings");
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() =>
        document.getElementById("portal-name")?.focus(),
      );
    });
  }

  function addQuoteItem(item) {
    setQuoteItems((currentItems) => {
      const existingItem = currentItems.find(
        (currentItem) => currentItem.itemNumber === item.itemNumber,
      );
      if (existingItem) {
        return currentItems.map((currentItem) =>
          currentItem.itemNumber === item.itemNumber
            ? { ...currentItem, quantity: Number(currentItem.quantity || 0) + 1 }
            : currentItem,
        );
      }
      return [...currentItems, { ...item, quantity: 1 }];
    });
    setCatalogSearch("");
    setIsAddingQuoteItem(false);
    setQuoteError("");
  }

  function openInlineCatalogSearch() {
    setCatalogSearch("");
    setIsAddingQuoteItem(true);
    window.requestAnimationFrame(() => catalogSearchRef.current?.focus());
  }

  function closeInlineCatalogSearch() {
    setCatalogSearch("");
    setIsAddingQuoteItem(false);
  }

  function chooseDelivery() {
    setDeliveryNeeded(true);
    setDeliveryAddress(
      (currentAddress) =>
        currentAddress || profileDraft.address || profile.address || "",
    );
  }

  function updateQuoteQuantity(itemNumber, quantity) {
    setQuoteItems((currentItems) =>
      currentItems.map((item) =>
        item.itemNumber === itemNumber ? { ...item, quantity } : item,
      ),
    );
  }

  async function saveProfile(event) {
    event.preventDefault();
    setProfileStatus("saving");
    setProfileError("");

    try {
      const updatedProfile = await updateCustomerPortalProfile({
        name: profileDraft.name,
        businessName: profileDraft.businessName,
        address: profileDraft.address,
        phone: profileDraft.phone,
      });
      const nextProfile = { ...profile, ...updatedProfile };
      setProfile(nextProfile);
      setProfileDraft(nextProfile);
      setDeliveryAddress((currentAddress) => currentAddress || nextProfile.address);
      setProfileStatus("saved");
    } catch (error) {
      console.error("Unable to update customer profile:", error);
      setProfileError(
        customerErrorMessage(error, "We could not save your account information."),
      );
      setProfileStatus("error");
    }
  }

  async function submitQuote(event) {
    event.preventDefault();
    setQuoteError("");

    if (quoteItems.length === 0) {
      setQuoteError("Add at least one material item to request a quote.");
      return;
    }
    if (quoteItems.some((item) => !Number(item.quantity) || Number(item.quantity) <= 0)) {
      setQuoteError("Every material item needs a quantity greater than zero.");
      return;
    }
    if (!neededBy) {
      setQuoteError("Choose how soon you need the material.");
      return;
    }
    if (deliveryNeeded && !deliveryAddress.trim()) {
      setQuoteError("Enter the address where the material would be delivered.");
      return;
    }

    setQuoteStatus("submitting");

    try {
      const quotePayload = {
        items: quoteItems.map((item) => ({
          itemNumber: item.itemNumber,
          description: item.description,
          brand: item.brand,
          groupSection: item.groupSection,
          quantity: Number(item.quantity),
        })),
        deliveryNeeded,
        deliveryAddress: deliveryNeeded ? deliveryAddress.trim() : "",
        neededBy,
        notes: quoteNotes.trim(),
      };
      const result = editingQuote
        ? await updateMyCustomerQuoteRequest({
            requestId: editingQuote.id,
            ...quotePayload,
          })
        : await submitCustomerQuoteRequest(quotePayload);
      const updatedQuote = {
        ...(editingQuote || {}),
        id: result.requestId || editingQuote?.id || result.reference,
        reference: result.reference || editingQuote?.reference,
        status: result.status || "new",
        validityDays: result.validityDays || editingQuote?.validityDays || 14,
        createdAt:
          editingQuote?.createdAt || result.createdAt || new Date().toISOString(),
        updatedAt: result.updatedAt || result.createdAt || new Date().toISOString(),
        reviewedAt: "",
        items: quotePayload.items,
        deliveryNeeded,
        deliveryAddress: quotePayload.deliveryAddress,
        neededBy,
        notes: quotePayload.notes,
        pricingPublished: false,
        pricingVersion: 0,
        publicNote: "",
        taxRate: 0,
        deliveryCharge: 0,
        materialSubtotal: 0,
        subtotal: 0,
        taxAmount: 0,
        total: 0,
      };
      setQuoteHistory((currentQuotes) => [
        updatedQuote,
        ...currentQuotes.filter(
          (quote) =>
            quote.id !== updatedQuote.id &&
            quote.reference !== updatedQuote.reference,
        ),
      ]);
      setQuoteHistoryStatus("loaded");
      setQuoteConfirmation({ ...result, updated: Boolean(editingQuote) });
      setEditingQuote(null);
      setQuoteItems([]);
      setCatalogSearch("");
      setIsAddingQuoteItem(false);
      setDeliveryNeeded(false);
      setDeliveryAddress(profile.address || "");
      setNeededBy("");
      setQuoteNotes("");
      setQuoteStatus("submitted");
    } catch (error) {
      console.error("Unable to submit quote request:", error);
      setQuoteError(customerErrorMessage(
        error,
        editingQuote
          ? "We could not update your quote request."
          : "We could not submit your quote request.",
      ));
      setQuoteStatus("error");
    }
  }

  function renderCatalogSearch({ id, inline = false }) {
    return (
      <div className={inline ? "mt-4 rounded-3xl border-2 border-slate-950 bg-slate-50 p-4 sm:p-5" : ""}>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={id} className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            {inline ? "Search for another item" : "Find an item"}
          </label>
          {inline ? (
            <button
              type="button"
              onClick={closeInlineCatalogSearch}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-slate-950"
              aria-label="Close item search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            ref={catalogSearchRef}
            id={id}
            value={catalogSearch}
            onChange={(event) => setCatalogSearch(event.target.value)}
            placeholder={inline ? "Type an item number, description, or brand…" : "Search item number, description, or brand…"}
            className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-base font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
          />
        </div>
        {catalogSearch.trim().length > 0 && catalogSearch.trim().length < 2 ? (
          <p className="mt-2 text-xs font-semibold text-slate-500">Enter at least two characters to search.</p>
        ) : null}
        {catalogResults.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {catalogResults.map((item) => (
              <button key={item.itemNumber} type="button" onClick={() => addQuoteItem(item)} className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50">
                <span className="min-w-0"><span className="block text-xs font-black uppercase tracking-[0.12em] text-[#FC2C38]">{item.itemNumber}</span><span className="mt-1 block text-sm font-bold text-slate-800">{item.description}</span>{item.brand || item.groupSection ? <span className="mt-1 block text-xs font-semibold text-slate-500">{[item.brand, item.groupSection].filter(Boolean).join(" · ")}</span> : null}</span>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-950 text-white"><Plus className="h-4 w-4" /></span>
              </button>
            ))}
          </div>
        ) : catalogSearch.trim().length >= 2 ? (
          <p className="mt-3 rounded-2xl bg-white px-4 py-4 text-sm font-bold text-slate-500">No catalog items match that search.</p>
        ) : null}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F6F3] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setView("dashboard")}
            className="shrink-0"
            aria-label="Customer portal dashboard"
          >
            <img
              src={capitalLumberLogo}
              alt="Capital Lumber Co."
              className="h-auto w-40 sm:w-48"
            />
          </button>

          <nav className="order-3 flex w-full items-center justify-center rounded-2xl bg-slate-50 p-1 sm:order-none sm:w-auto">
            <NavButton
              active={view === "dashboard"}
              icon={LayoutDashboard}
              label="Dashboard"
              onClick={() => setView("dashboard")}
            />
            <NavButton
              active={view === "quote"}
              icon={FileText}
              label="Get Quote"
              onClick={openQuote}
            />
            <NavButton
              active={view === "settings"}
              icon={Settings}
              label="Settings"
              onClick={openSettings}
            />
          </nav>

          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right md:block">
              <p className="max-w-56 truncate text-sm font-black text-slate-950">
                {profile.businessName || profile.name || currentUser?.email}
              </p>
              <p className="max-w-56 truncate text-xs font-bold text-slate-500">
                {accountIsLinked && profile.accountNumber
                  ? `Account ${profile.accountNumber}`
                  : "Email verified"}
              </p>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-slate-400 hover:text-slate-950"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {view === "dashboard" ? (
        <div className="mb-6 overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl">
          <div className="grid gap-6 px-6 py-7 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                Capital Lumber Customer Portal
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                {isLoadingProfile ? "Loading your account…" : `Welcome, ${firstName}.`}
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300 sm:text-base">
                {accountIsLinked
                  ? "Your verified Capital Lumber account is connected and ready for customer services."
                  : "Your email is verified. We are matching it to the correct Capital Lumber account before private account details or special pricing are shown."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openQuote}
                className="flex items-center gap-2 rounded-2xl bg-[#FC2C38] px-5 py-3 text-sm font-black text-white shadow-lg transition hover:bg-red-600"
              >
                Get a quote <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={openSettings}
                className="flex items-center gap-2 rounded-2xl border border-slate-700 px-5 py-3 text-sm font-black text-white transition hover:bg-white hover:text-slate-950"
              >
                Update information <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="grid gap-px bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-slate-900 px-6 py-4">
              <InfoLine dark icon={Building2} label="Business" value={profile.businessName} />
            </div>
            <div className="bg-slate-900 px-6 py-4">
              <InfoLine dark icon={UserRound} label="Contact" value={profile.name} />
            </div>
            <div className="bg-slate-900 px-6 py-4">
              <InfoLine dark icon={Phone} label="Phone" value={formatPhone(profile.phone)} />
            </div>
            <div className="bg-slate-900 px-6 py-4">
              <InfoLine dark icon={Mail} label="Email" value={profile.email} />
            </div>
          </div>
        </div>
        ) : null}

        {profileError && view !== "settings" && view !== "quote" ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
            {profileError}
          </div>
        ) : null}

        {view === "dashboard" ? (
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                Quick request
              </p>
              <div className="mt-3 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
                    Need material pricing?
                  </h2>
                  <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-600">
                    Search our product catalog, enter quantities, and tell us how soon you need it. Pricing stays off the form; our team will prepare the quote for you.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openQuote}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-[#FC2C38]"
                >
                  Start quote <PackageSearch className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  [Search, "Find material", "Search item number, description, or brand."],
                  [Plus, "Set quantity", "Add the amount needed for each item."],
                  [Truck, "Choose delivery", "Tell us pickup or delivery and your timing."],
                ].map(([Icon, title, copy], index) => (
                  <div key={title} className="rounded-2xl bg-slate-50 p-4">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#FC2C38] shadow-sm">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <p className="mt-4 text-sm font-black text-slate-950">
                      {index + 1}. {title}
                    </p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{copy}</p>
                  </div>
                ))}
              </div>
            </section>

            <aside className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Account status</p>
                  <h2 className="mt-2 text-2xl font-black">
                    {accountIsLinked ? "Account connected" : "Connection pending"}
                  </h2>
                </div>
                <span className={`grid h-12 w-12 place-items-center rounded-2xl ${accountIsLinked ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {accountIsLinked ? <CheckCircle2 className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                </span>
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
                {accountIsLinked
                  ? `This login is connected to Capital Lumber account ${profile.accountNumber || "on file"}.`
                  : "You can use the portal now. Our team will manually verify the account connection before account-specific pricing is available."}
              </p>
              <div className="mt-6 rounded-2xl border border-slate-200 p-4">
                <InfoLine icon={MapPin} label="Address on file" value={profile.address} />
              </div>
              <button
                type="button"
                onClick={openSettings}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
              >
                Review account information <ArrowRight className="h-4 w-4" />
              </button>
            </aside>

            <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm lg:col-span-2">
              <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                <div className="flex items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-50 text-[#FC2C38]">
                    <FileText className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                      Quote history
                    </p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight">
                      Your prior quotes
                    </h2>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">
                  <Clock3 className="h-4 w-4 text-red-400" aria-hidden="true" />
                  All quotes are valid for 2 weeks
                </div>
              </div>

              <div className="p-6 sm:p-8">
                {quoteHistoryStatus === "loading" ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="h-48 animate-pulse rounded-2xl bg-slate-100" />
                    ))}
                  </div>
                ) : quoteHistoryError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">
                    {quoteHistoryError}
                  </div>
                ) : quoteHistory.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                    <FileText className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
                    <p className="mt-3 text-lg font-black text-slate-800">No quote requests yet</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Your submitted quotes will appear here for easy reference.
                    </p>
                    <button
                      type="button"
                      onClick={openQuote}
                      className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-[#FC2C38]"
                    >
                      Request your first quote <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {quoteHistory
                        .slice(0, showAllQuoteHistory ? quoteHistory.length : 6)
                        .map((quote) => {
                        const status =
                          QUOTE_STATUS_DETAILS[quote.status] ||
                          QUOTE_STATUS_DETAILS.new;
                        const timing = TIMELINE_OPTIONS.find(
                          (option) => option.value === quote.neededBy,
                        )?.label;

                        return (
                          <button
                            type="button"
                            key={quote.id || quote.reference}
                            onClick={() => setSelectedQuote(quote)}
                            aria-label={`View full details for ${quote.reference || "quote request"}`}
                            className="group flex min-h-56 cursor-pointer flex-col rounded-3xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-red-100"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                                  Quote reference
                                </p>
                                <h3 className="mt-1 text-lg font-black text-slate-950">
                                  {quote.reference || "Quote request"}
                                </h3>
                              </div>
                              <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${status.className}`}>
                                {status.label}
                              </span>
                            </div>

                            <p className="mt-3 text-xs font-bold text-slate-500">
                              Submitted {formatQuoteDate(quote.createdAt)}
                            </p>

                            <div className="mt-4 flex-1 rounded-2xl bg-white p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                                  Material
                                </p>
                                <span className="text-xs font-black text-slate-700">
                                  {quote.items?.length || 0} {(quote.items?.length || 0) === 1 ? "item" : "items"}
                                </span>
                              </div>
                              <div className="mt-2 space-y-1.5">
                                {(quote.items || []).slice(0, 2).map((item) => (
                                  <p key={`${quote.id}-${item.itemNumber}`} className="truncate text-sm font-bold text-slate-700">
                                    <span className="text-[#FC2C38]">{item.quantity}×</span> {item.description}
                                  </p>
                                ))}
                                {(quote.items?.length || 0) > 2 ? (
                                  <p className="text-xs font-black text-slate-400">
                                    +{quote.items.length - 2} more items
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-black">
                              <span className="text-slate-500">
                                {quote.deliveryNeeded ? "Delivery" : "Customer pickup"}
                                {timing ? ` · ${timing}` : ""}
                              </span>
                              <span className={quote.pricingPublished ? "text-base text-emerald-700" : quote.status === "quoted" ? "text-emerald-700" : "text-slate-500"}>
                                {quote.pricingPublished ? `V${Math.max(1, Number(quote.pricingVersion) || 1)} · Total ${formatCustomerCurrency(quote.total)}` : getQuoteValidityLabel(quote)}
                              </span>
                            </div>
                            <span className="mt-4 flex items-center justify-center gap-1 rounded-xl bg-slate-950 px-3 py-2.5 text-xs font-black text-white transition group-hover:bg-[#FC2C38]">
                              View full details
                              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" />
                            </span>
                          </button>
                        );
                        })}
                    </div>
                    {quoteHistory.length > 6 ? (
                      <div className="mt-5 text-center">
                        <button
                          type="button"
                          onClick={() => setShowAllQuoteHistory((current) => !current)}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 transition hover:border-slate-950 hover:text-slate-950"
                        >
                          {showAllQuoteHistory
                            ? "Show recent quotes only"
                            : `View all ${quoteHistory.length} quotes`}
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {view === "settings" ? (
          <section className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">Settings</p>
                <h2 className="mt-2 text-2xl font-black sm:text-3xl">Your account information</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Keep your contact and business information current.</p>
              </div>
              <button type="button" onClick={() => setView("dashboard")} className="flex items-center gap-2 text-sm font-black text-slate-500 hover:text-slate-950">
                <ArrowLeft className="h-4 w-4" /> Back to dashboard
              </button>
            </div>
            <form onSubmit={saveProfile} className="p-6 sm:p-8">
              <div className="grid gap-5 sm:grid-cols-2">
                <ProfileField id="portal-name" label="Your name" icon={UserRound} value={profileDraft.name} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} autoComplete="name" required />
                <ProfileField id="portal-business" label="Business name" icon={Building2} value={profileDraft.businessName} onChange={(event) => setProfileDraft((current) => ({ ...current, businessName: event.target.value }))} autoComplete="organization" required />
                <ProfileField id="portal-phone" label="Phone number" icon={Phone} type="tel" value={profileDraft.phone} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} autoComplete="tel" required />
                <ProfileField id="portal-email" label="Verified email" icon={Mail} type="email" value={profileDraft.email} disabled readOnly />
                <div className="sm:col-span-2">
                  <label htmlFor="portal-address" className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">Business or billing address</label>
                  <div className="relative rounded-2xl border border-slate-200 bg-white focus-within:border-slate-900 focus-within:ring-4 focus-within:ring-slate-100">
                    <MapPin className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <AddressAutocompleteInput id="portal-address" value={profileDraft.address} onChange={(address) => setProfileDraft((current) => ({ ...current, address }))} enableLocalFallback showStatus={false} placeholder="Start typing your address…" className="w-full rounded-2xl border-0 bg-transparent py-4 pl-12 pr-4 text-base font-bold text-slate-900 outline-none" />
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
                <InfoLine icon={ShieldCheck} label="Account status" value={accountIsLinked ? "Verified and connected" : "Email verified · account review pending"} />
                <InfoLine icon={Building2} label="Account number" value={accountIsLinked ? profile.accountNumber : "Shown after verification"} />
              </div>

              {profileError ? <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{profileError}</div> : null}
              {profileStatus === "saved" ? <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"><Check className="h-4 w-4" /> Your information was saved.</div> : null}

              <button type="submit" disabled={profileStatus === "saving" || isLoadingProfile} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white transition hover:bg-[#FC2C38] disabled:cursor-wait disabled:bg-slate-400">
                {profileStatus === "saving" ? "Saving information…" : "Save changes"}
              </button>
            </form>
          </section>
        ) : null}

        {view === "quote" ? (
          <form onSubmit={submitQuote} className="grid gap-6 xl:grid-cols-[1fr_390px]">
            <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">Material request</p>
                    <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                      {editingQuote ? `Update ${editingQuote.reference}` : "Build your quote"}
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {editingQuote
                        ? "Add material, change quantities, or update the request details. Capital Lumber will review the changes and refresh pricing."
                        : "Search our item catalog. Material pricing is prepared by our team; delivery estimates appear after you enter an address."}
                    </p>
                  </div>
                  <button type="button" onClick={() => { resetQuoteBuilder(); setView("dashboard"); }} className="flex items-center gap-2 text-sm font-black text-slate-500 hover:text-slate-950"><ArrowLeft className="h-4 w-4" /> Back</button>
                </div>
              </div>
              <div className="p-6 sm:p-8">
                {quoteItems.length === 0 ? renderCatalogSearch({ id: "catalog-search" }) : null}

                <div className={`${quoteItems.length === 0 ? "mt-8" : ""} flex items-center justify-between gap-4`}>
                  <div><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Selected material</p><h3 className="mt-1 text-xl font-black">{quoteItems.length} {quoteItems.length === 1 ? "item" : "items"}</h3></div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                    {editingQuote ? "Pricing will be refreshed" : "No pricing shown"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3">
                  {quoteItems.length === 0 ? (
                    <div className="rounded-3xl border-2 border-dashed border-slate-200 px-6 py-10 text-center">
                      <PackageSearch className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-black text-slate-600">Search above to add material</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">Item descriptions only—our team will prepare pricing.</p>
                    </div>
                  ) : quoteItems.map((item) => (
                    <div key={item.itemNumber} className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-[1fr_130px_44px] sm:items-center">
                      <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#FC2C38]">{item.itemNumber}</p><p className="mt-1 text-sm font-black text-slate-900">{item.description}</p></div>
                      <label><span className="mb-1 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Quantity</span><input type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => updateQuoteQuantity(item.itemNumber, event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-black outline-none focus:border-slate-900" /></label>
                      <button type="button" onClick={() => setQuoteItems((current) => current.filter((currentItem) => currentItem.itemNumber !== item.itemNumber))} className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${item.description}`}><Trash2 className="h-5 w-5" /></button>
                    </div>
                  ))}
                </div>
                {quoteItems.length > 0 ? (
                  isAddingQuoteItem ? renderCatalogSearch({ id: "catalog-search-more", inline: true }) : (
                    <button type="button" onClick={openInlineCatalogSearch} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-black text-slate-700 transition hover:border-slate-950 hover:bg-white hover:text-slate-950">
                      <Plus className="h-5 w-5" /> Add another item
                    </button>
                  )
                ) : null}
              </div>
            </section>

            <aside className="h-fit rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-7 xl:sticky xl:top-28">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">Quote details</p>
              <h3 className="mt-2 text-2xl font-black">How do you need it?</h3>

              <fieldset className="mt-6">
                <legend className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Fulfillment</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setDeliveryNeeded(false)} className={`rounded-2xl border-2 px-3 py-4 text-center transition ${!deliveryNeeded ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}><Store className="mx-auto h-5 w-5" /><span className="mt-2 block text-sm font-black">I will pick up</span></button>
                  <button type="button" onClick={chooseDelivery} className={`rounded-2xl border-2 px-3 py-4 text-center transition ${deliveryNeeded ? "border-[#FC2C38] bg-red-50 text-red-700" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}><Truck className="mx-auto h-5 w-5" /><span className="mt-2 block text-sm font-black">Need delivery</span></button>
                </div>
              </fieldset>

              {deliveryNeeded ? (
                <div className="mt-5"><label htmlFor="quote-delivery-address" className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Delivery address</label><div className="relative mt-2 rounded-2xl border border-slate-200"><MapPin className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-slate-400" /><AddressAutocompleteInput id="quote-delivery-address" value={deliveryAddress} onChange={setDeliveryAddress} onPlaceSelected={(_place, address) => setDeliveryAddress(address)} autoComplete="off" enableLocalFallback showStatus={false} placeholder="Start typing a delivery address…" className="w-full rounded-2xl border-0 bg-transparent py-4 pl-12 pr-4 text-sm font-bold outline-none" /></div><p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{profileDraft.address || profile.address ? "Auto-filled from your saved address. Start typing to change it, then select the complete Google address." : "Start typing, then select the complete address from Google's suggestions."}</p><DeliveryPriceEstimate address={deliveryAddress} compact /></div>
              ) : null}

              <label htmlFor="quote-timeline" className="mt-5 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">How soon do you need it?</label>
              <div className="relative mt-2"><Clock3 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><select id="quote-timeline" value={neededBy} onChange={(event) => setNeededBy(event.target.value)} className="w-full appearance-none rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm font-black text-slate-800 outline-none focus:border-slate-900"><option value="">Choose timing…</option>{TIMELINE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>

              <label htmlFor="quote-notes" className="mt-5 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">Project notes <span className="normal-case tracking-normal text-slate-400">(optional)</span></label>
              <textarea id="quote-notes" value={quoteNotes} onChange={(event) => setQuoteNotes(event.target.value)} maxLength={1200} rows={4} placeholder="Sizes, substitutions, project details, or questions…" className="mt-2 w-full resize-y rounded-2xl border border-slate-200 p-4 text-sm font-semibold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100" />

              {quoteError ? <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-5 text-red-700">{quoteError}</div> : null}
              {quoteConfirmation ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-800"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> {quoteConfirmation.updated ? "Quote updated" : "Quote request received"}</div><p className="mt-2 text-xs font-semibold leading-5 text-emerald-700">Reference {quoteConfirmation.reference}. Our team will review your material list and contact you.</p></div> : null}

              <button type="submit" disabled={quoteStatus === "submitting" || quoteItems.length === 0} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FC2C38] px-5 py-4 text-base font-black text-white shadow-lg transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300">
                {quoteStatus === "submitting"
                  ? editingQuote ? "Saving changes…" : "Sending request…"
                  : editingQuote ? "Save quote changes" : "Request quote"}
                {quoteStatus !== "submitting" ? <ArrowRight className="h-5 w-5" /> : null}
              </button>
              <p className="mt-3 text-center text-xs font-semibold leading-5 text-slate-500">Material pricing is prepared by our team. Any delivery price shown is an estimate and will be confirmed with your quote.</p>
            </aside>
          </form>
        ) : null}

        {selectedQuote ? (() => {
          const selectedStatus =
            QUOTE_STATUS_DETAILS[selectedQuote.status] || QUOTE_STATUS_DETAILS.new;
          const selectedTiming = TIMELINE_OPTIONS.find(
            (option) => option.value === selectedQuote.neededBy,
          )?.label || "Timing not provided";

          return (
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="customer-quote-detail-title"
            >
              <button
                type="button"
                aria-label="Close quote details"
                className="absolute inset-0 cursor-default"
                onClick={() => setSelectedQuote(null)}
              />
              <section className="relative z-10 max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2rem]">
                <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur sm:px-8 sm:py-6">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                        Quote details
                      </p>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${selectedStatus.className}`}>
                        {selectedStatus.label}
                      </span>
                    </div>
                    <h2 id="customer-quote-detail-title" className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                      {selectedQuote.reference || "Quote request"}
                    </h2>
                    <p className="mt-1 text-sm font-bold text-slate-500">
                      Submitted {formatQuoteDate(selectedQuote.createdAt, { day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedQuote(null)}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-950 hover:text-slate-950"
                    aria-label="Close quote details"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </header>

                <div className="p-6 sm:p-8">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-950 p-4 text-white">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Status</p>
                      <p className="mt-2 text-base font-black">{selectedStatus.label}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Fulfillment</p>
                      <p className="mt-2 text-base font-black text-slate-900">
                        {selectedQuote.deliveryNeeded ? "Delivery" : "Customer pickup"}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Quote validity</p>
                      <p className="mt-2 text-base font-black text-slate-900">{getQuoteValidityLabel(selectedQuote)}</p>
                    </div>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#FC2C38]">Requested material</p>
                        <h3 className="mt-1 text-xl font-black text-slate-950">Full item list</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 shadow-sm">
                          {selectedQuote.items?.length || 0} {(selectedQuote.items?.length || 0) === 1 ? "item" : "items"}
                        </span>
                        <button
                          type="button"
                          onClick={() => editExistingQuote(selectedQuote)}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white transition hover:bg-[#FC2C38]"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Add or change items
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {(selectedQuote.items || []).map((item, index) => (
                        <div key={`${selectedQuote.id}-${item.itemNumber}-${index}`} className={`grid gap-3 px-5 py-4 sm:items-center sm:px-6 ${selectedQuote.pricingPublished ? "sm:grid-cols-[90px_1fr_150px]" : "sm:grid-cols-[90px_1fr]"}`}>
                          <span className="w-fit rounded-xl bg-red-50 px-3 py-2 text-sm font-black text-[#FC2C38]">
                            Qty {item.quantity}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-950">{item.description}</p>
                          </div>
                          {selectedQuote.pricingPublished ? (
                            <div className="sm:text-right">
                              <p className="text-base font-black text-slate-950">{formatCustomerCurrency(item.lineTotal)}</p>
                              <p className="mt-0.5 text-xs font-bold text-slate-400">{formatCustomerCurrency(item.unitPrice)} each</p>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedQuote.pricingPublished ? (
                    <section className="mt-6 overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50/40">
                      <div className="border-b border-emerald-200 px-5 py-4 sm:px-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Quote ready</p>
                            <h3 className="mt-1 text-xl font-black text-slate-950">Your pricing</h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 shadow-sm">Version {Math.max(1, Number(selectedQuote.pricingVersion) || 1)}</span>
                            <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 shadow-sm">Valid for 2 weeks</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-5 p-5 sm:grid-cols-[1fr_280px] sm:p-6">
                        <div>
                          <p className="text-sm font-semibold leading-6 text-slate-600">
                            Pricing includes the requested material{selectedQuote.deliveryNeeded ? ", delivery," : ""} and sales tax.
                          </p>
                          {selectedQuote.publicNote ? (
                            <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
                              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Message from Capital Lumber</p>
                              <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{selectedQuote.publicNote}</p>
                            </div>
                          ) : null}
                        </div>
                        <div className="rounded-2xl bg-white p-4 shadow-sm">
                          <dl className="space-y-2 text-sm font-bold text-slate-600">
                            <div className="flex justify-between gap-3"><dt>Material</dt><dd>{formatCustomerCurrency(selectedQuote.materialSubtotal)}</dd></div>
                            {selectedQuote.deliveryNeeded ? <div className="flex justify-between gap-3"><dt>Delivery</dt><dd>{formatCustomerCurrency(selectedQuote.deliveryCharge)}</dd></div> : null}
                            <div className="flex justify-between gap-3 border-t border-slate-100 pt-2"><dt>Subtotal</dt><dd>{formatCustomerCurrency(selectedQuote.subtotal)}</dd></div>
                            <div className="flex justify-between gap-3"><dt>Tax ({Number(selectedQuote.taxRate || 0).toFixed(2)}%)</dt><dd>{formatCustomerCurrency(selectedQuote.taxAmount)}</dd></div>
                          </dl>
                          <div className="mt-3 flex items-end justify-between gap-3 border-t-2 border-slate-950 pt-3">
                            <span className="text-sm font-black uppercase tracking-[0.1em] text-slate-950">Total</span>
                            <span className="text-2xl font-black text-slate-950">{formatCustomerCurrency(selectedQuote.total)}</span>
                          </div>
                        </div>
                      </div>
                    </section>
                  ) : null}

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-slate-200 p-5">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600">
                          {selectedQuote.deliveryNeeded ? <Truck className="h-5 w-5" /> : <Store className="h-5 w-5" />}
                        </span>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Fulfillment details</p>
                          <p className="mt-1 text-sm font-black text-slate-900">{selectedTiming}</p>
                        </div>
                      </div>
                      {selectedQuote.deliveryNeeded ? (
                        <p className="mt-4 flex items-start gap-2 text-sm font-bold leading-6 text-slate-600">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#FC2C38]" aria-hidden="true" />
                          {selectedQuote.deliveryAddress || "Delivery address not provided"}
                        </p>
                      ) : (
                        <p className="mt-4 text-sm font-bold leading-6 text-slate-600">Material will be picked up at Capital Lumber.</p>
                      )}
                    </div>

                    <div className="rounded-3xl border border-slate-200 p-5">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600">
                          <FileText className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Project notes</p>
                          <p className="mt-1 text-sm font-black text-slate-900">Your request details</p>
                        </div>
                      </div>
                      <p className="mt-4 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">
                        {selectedQuote.notes || "No additional project notes were included."}
                      </p>
                    </div>
                  </div>

                  {selectedQuote.deliveryNeeded ? (
                    <section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50/40 p-5 sm:p-6">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                            Delivery estimate
                          </p>
                          <h3 className="mt-1 text-xl font-black text-slate-950">
                            Distance, drive time, and delivery rates
                          </h3>
                          <p className="mt-2 flex items-start gap-2 text-sm font-bold leading-6 text-slate-600">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#FC2C38]" aria-hidden="true" />
                            {selectedQuote.deliveryAddress || "Delivery address not provided"}
                          </p>
                        </div>
                        <span className="w-fit rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800 shadow-sm">
                          Estimate only
                        </span>
                      </div>
                      <DeliveryPriceEstimate
                        address={selectedQuote.deliveryAddress}
                        className="mt-4"
                      />
                    </section>
                  ) : null}

                  <div className="mt-6 rounded-2xl bg-blue-50 px-5 py-4 text-sm font-bold leading-6 text-blue-900">
                    {selectedQuote.pricingPublished
                      ? "Questions about this quote? Call Capital Lumber at 208-343-5481."
                      : "Material pricing is prepared by the Capital Lumber team and will be shared here when it is ready. Questions? Call 208-343-5481."}
                  </div>
                </div>
              </section>
            </div>
          );
        })() : null}

        <footer className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 text-center text-xs font-semibold text-slate-500 sm:flex-row sm:text-left">
          <p>Need help? Call Capital Lumber at 208-343-5481.</p>
          <button type="button" onClick={onBackToEmployeeLogin} className="font-black text-slate-600 hover:text-slate-950">Employee sign in</button>
        </footer>
      </section>
    </main>
  );
}
