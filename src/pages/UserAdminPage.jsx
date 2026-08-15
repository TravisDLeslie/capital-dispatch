import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";

const roles = [
  { value: "pending", label: "Pending" },
  { value: "customer", label: "Customer" },
  { value: "admin", label: "Admin" },
  { value: "superAdmin", label: "Super Admin" },
];

const workViews = [
  { value: "operations", label: "Operations" },
  { value: "driver", label: "Driver" },
  { value: "sales", label: "Sales" },
  { value: "receiving", label: "Receiving" },
  { value: "south", label: "PO's / South" },
  { value: "delivery", label: "Delivery" },
  { value: "accounting", label: "Accounting" },
];

const permissionGroups = [
  {
    title: "Dashboard",
    permissions: [
      { id: "dashboard", label: "Dashboard" },
    ],
  },
  {
    title: "Receiving",
    permissions: [
      { id: "receiving", label: "Receiving" },
      { id: "check-in", label: "Check In" },
      { id: "today", label: "Today's Check-Ins" },
      { id: "search", label: "Search PO" },
      { id: "trace", label: "Trace PO / Order" },
    ],
  },
  {
    title: "Yard Tasks",
    permissions: [
      { id: "yard-tasks", label: "Yard Tasks" },
    ],
  },
  {
    title: "PO's",
    permissions: [
      { id: "south", label: "PO's" },
      { id: "south-overview", label: "South Overview" },
      { id: "supplier-runs-add", label: "Add POs" },
      { id: "their-truck-overview", label: "Their Truck Overview" },
      { id: "their-truck-pos", label: "Add Their Truck PO" },
      { id: "supplier-runs-dispatch", label: "Needs Dispatch" },
      { id: "supplier-runs-check", label: "View POs to Pick Up" },
      { id: "supplier-runs-calendar", label: "South Calendar" },
      { id: "south-calendar", label: "South Only Calendar" },
      { id: "their-truck-calendar", label: "Their Truck Calendar" },
      { id: "po-calendar", label: "All PO Calendar" },
      { id: "supplier-runs-history", label: "South History" },
      { id: "their-truck-history", label: "Their Truck History" },
    ],
  },
  {
    title: "Deliveries",
    permissions: [
      { id: "deliveries", label: "Deliveries" },
      { id: "deliveries-add", label: "Add Deliveries" },
      { id: "deliveries-dispatch", label: "Needs Dispatch" },
      { id: "deliveries-calendar", label: "Delivery Calendar" },
      { id: "deliveries-queue", label: "To Be Delivered" },
      { id: "deliveries-history", label: "Delivery History" },
    ],
  },
  {
    title: "Sales",
    permissions: [
      { id: "sales", label: "Sales" },
      { id: "sales-orders", label: "Sales Orders" },
      { id: "customers-add", label: "Add Customer" },
      { id: "customers-view", label: "View Customers" },
      { id: "sales-tools", label: "Tools" },
      { id: "sales-converter", label: "Converter" },
      { id: "trace", label: "PO Lookup" },
    ],
  },
  {
    title: "Documents",
    permissions: [
      { id: "documents", label: "Documents" },
      { id: "stocking-handbook", label: "Stocking Handbook" },
    ],
  },
  {
    title: "Accounting",
    permissions: [
      { id: "accounting", label: "Accounting" },
      { id: "accounting-customers", label: "Customer Statements" },
      { id: "customer-payment-links", label: "Payment Links" },
    ],
  },
  {
    title: "Admin",
    permissions: [
      { id: "admin", label: "Admin" },
      { id: "user-admin", label: "User Access" },
      { id: "email-list", label: "Email List" },
      { id: "delivery-settings", label: "Delivery Settings" },
      { id: "vendor-settings", label: "Vendor Settings" },
      { id: "sales-report", label: "Sales Pulse" },
    ],
  },
];

const allPermissionIds = permissionGroups.flatMap((group) =>
  group.permissions.map((permission) => permission.id),
);

function getProfileDisplayName(user) {
  const emailName = String(user?.email || "").split("@")[0] || "";

  return user?.displayName || user?.driverName || emailName || "";
}

function getUniqueOptions(options) {
  const seenOptions = new Set();

  return options
    .map((option) => String(option || "").trim())
    .filter(Boolean)
    .filter((option) => {
      const key = option.toLowerCase();

      if (seenOptions.has(key)) {
        return false;
      }

      seenOptions.add(key);
      return true;
    })
    .sort((firstOption, secondOption) =>
      firstOption.localeCompare(secondOption, undefined, {
        sensitivity: "base",
      }),
    );
}

const rolePermissionPresets = {
  pending: [],
  customer: ["dashboard"],
  admin: allPermissionIds.filter(
    (permissionId) =>
      !["user-admin", "fleet", "bouncie"].includes(permissionId),
  ),
  superAdmin: allPermissionIds,
};

const legacyRolePermissionPresets = {
  driver: [
    "dashboard",
    "south",
    "supplier-runs-check",
    "supplier-runs-calendar",
    "south-calendar",
    "deliveries",
    "deliveries-queue",
  ],
  receiving: [
    "dashboard",
    "receiving",
    "check-in",
    "today",
    "search",
    "trace",
  ],
  "yard-tasks": ["dashboard", "yard-tasks"],
  south: [
    "dashboard",
    "south",
    "south-overview",
    "supplier-runs-add",
    "their-truck-overview",
    "their-truck-pos",
    "south-calendar",
    "supplier-runs-dispatch",
    "supplier-runs-check",
    "supplier-runs-calendar",
    "their-truck-calendar",
    "po-calendar",
    "supplier-runs-history",
    "their-truck-history",
  ],
  delivery: [
    "dashboard",
    "deliveries",
    "deliveries-add",
    "deliveries-dispatch",
    "deliveries-queue",
    "deliveries-history",
  ],
  sales: [
    "dashboard",
    "south",
    "south-overview",
    "supplier-runs-add",
    "their-truck-overview",
    "their-truck-pos",
    "their-truck-calendar",
    "their-truck-history",
    "po-calendar",
    "trace",
    "sales",
    "sales-orders",
    "customers-add",
    "customers-view",
    "sales-tools",
    "sales-converter",
    "documents",
    "stocking-handbook",
  ],
  accounting: [
    "dashboard",
    "accounting",
    "accounting-customers",
    "customer-payment-links",
  ],
};

const statuses = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "disabled", label: "Disabled" },
];

function getStatusClass(status) {
  if (status === "approved") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "disabled") {
    return "bg-red-100 text-red-700";
  }

  return "bg-amber-100 text-amber-700";
}

function getUserPermissions(user) {
  if (Array.isArray(user.permissions)) {
    return user.permissions.filter(
      (permission) => typeof permission === "string",
    );
  }

  return (
    rolePermissionPresets[user.role] ||
    legacyRolePermissionPresets[user.role] ||
    []
  );
}

function getPresetRole(role) {
  if (role === "superAdmin" || role === "admin" || role === "pending") {
    return role;
  }

  return "customer";
}

function getWorkView(user) {
  if (typeof user.workView === "string" && user.workView) {
    return user.workView;
  }

  if (
    ["driver", "sales", "receiving", "south", "delivery", "accounting"].includes(
      user.role,
    )
  ) {
    return user.role;
  }

  return "operations";
}

export default function UserAdminPage({
  users,
  currentUserProfile,
  onUpdateUserProfile,
  onPageChange,
}) {
  const [drafts, setDrafts] = useState({});
  const [savingUserId, setSavingUserId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [openAccessPanels, setOpenAccessPanels] = useState({});
  const [openAccessGroups, setOpenAccessGroups] = useState({});
  const driverNameOptions = getUniqueOptions(
    users
      .filter((appUser) => appUser.status === "approved")
      .map(getProfileDisplayName),
  );

  function getDraft(user) {
    return {
      role: getPresetRole(user.role || "pending"),
      workView: getWorkView(user),
      status: user.status || "pending",
      displayName: user.displayName || "",
      driverName: user.driverName || "",
      permissions: getUserPermissions(user),
      ...(drafts[user.id] || {}),
    };
  }

  function updateDraft(userId, field, value) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [userId]: {
        ...(currentDrafts[userId] || {}),
        [field]: value,
      },
    }));
    setMessage("");
    setError("");
  }

  async function saveUser(user) {
    const draft = getDraft(user);
    const approvedAt =
      draft.status === "approved" && user.status !== "approved"
        ? new Date().toISOString()
        : user.approvedAt || null;
    const approvedBy =
      draft.status === "approved" && user.status !== "approved"
        ? currentUserProfile?.email || ""
        : user.approvedBy || "";

    setSavingUserId(user.id);
    setMessage("");
    setError("");

    try {
      await onUpdateUserProfile(user.id, {
        role: draft.role,
        workView: draft.workView || "operations",
        status: draft.status,
        displayName: draft.displayName,
        driverName: draft.driverName,
        permissions: draft.permissions || [],
        approvedAt,
        approvedBy,
      });

      setDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[user.id];
        return nextDrafts;
      });
      setMessage(`Updated ${user.email || "user"}.`);
    } catch (saveError) {
      console.error("Unable to update user:", saveError);
      setError("Unable to update that user. Check Firebase rules.");
    } finally {
      setSavingUserId("");
    }
  }

  function applyRolePreset(userId, role) {
    setDrafts((currentDrafts) => ({
      ...currentDrafts,
      [userId]: {
        ...(currentDrafts[userId] || {}),
        role,
        permissions: [...(rolePermissionPresets[role] || [])],
      },
    }));
    setMessage("");
    setError("");
  }

  function togglePermission(userId, permissionId) {
    const user = users.find((savedUser) => savedUser.id === userId);
    const currentDraft = user ? getDraft(user) : { permissions: [] };
    const currentPermissions = currentDraft.permissions || [];
    const nextPermissions = currentPermissions.includes(permissionId)
      ? currentPermissions.filter(
          (permission) => permission !== permissionId,
        )
      : [...currentPermissions, permissionId];

    updateDraft(userId, "permissions", nextPermissions);
  }

  function getAccessGroupKey(userId, groupTitle) {
    return `${userId}::${groupTitle}`;
  }

  function isAccessGroupOpen(userId, group, draft) {
    const groupKey = getAccessGroupKey(userId, group.title);

    if (groupKey in openAccessGroups) {
      return openAccessGroups[groupKey];
    }

    return group.permissions.some((permission) =>
      (draft.permissions || []).includes(permission.id),
    );
  }

  function toggleAccessGroup(userId, group, draft) {
    const groupKey = getAccessGroupKey(userId, group.title);
    const groupIsOpen = isAccessGroupOpen(userId, group, draft);

    setOpenAccessGroups((currentOpenAccessGroups) => ({
      ...currentOpenAccessGroups,
      [groupKey]: !groupIsOpen,
    }));
  }

  function toggleAccessPanel(userId) {
    setOpenAccessPanels((currentOpenAccessPanels) => ({
      ...currentOpenAccessPanels,
      [userId]: !currentOpenAccessPanels[userId],
    }));
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Admin", onClick: () => onPageChange?.("admin") },
          { label: "User Access" },
        ]}
      />

      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FC2C38]">
          Admin
        </p>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">
          User Access
        </h1>

        <p className="mt-2 text-lg text-slate-500">
          Approve new sign-ins and assign what each person can see.
        </p>
      </div>

      {message ? (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        {users.map((user) => {
          const draft = getDraft(user);
          const hasChanges =
            draft.role !== (user.role || "pending") ||
            draft.workView !== getWorkView(user) ||
            draft.status !== (user.status || "pending") ||
            draft.displayName !== (user.displayName || "") ||
            draft.driverName !== (user.driverName || "") ||
            JSON.stringify([...(draft.permissions || [])].sort()) !==
              JSON.stringify(getUserPermissions(user).sort());
          const accessPanelIsOpen = Boolean(openAccessPanels[user.id]);

          return (
            <section
              key={user.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl font-black text-slate-900">
                      {user.displayName || user.email || "New user"}
                    </h2>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${getStatusClass(
                        user.status,
                      )}`}
                    >
                      {user.status || "pending"}
                    </span>
                  </div>

                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {user.email || "No email"}
                  </p>

                  {user.lastLoginAt ? (
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      Last login:{" "}
                      {new Date(user.lastLoginAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 xl:w-[900px]">
                  <label className="block sm:col-span-2 xl:col-span-1">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Display Name
                    </span>
                    <input
                      type="text"
                      value={draft.displayName}
                      onChange={(event) =>
                        updateDraft(
                          user.id,
                          "displayName",
                          event.target.value,
                        )
                      }
                      placeholder="Austin Miller"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Status
                    </span>
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        updateDraft(
                          user.id,
                          "status",
                          event.target.value,
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    >
                      {statuses.map((status) => (
                        <option
                          key={status.value}
                          value={status.value}
                        >
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Preset
                    </span>
                    <select
                      value={draft.role}
                      onChange={(event) =>
                        applyRolePreset(
                          user.id,
                          event.target.value,
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    >
                      {roles.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Work View
                    </span>
                    <select
                      value={draft.workView}
                      onChange={(event) =>
                        updateDraft(
                          user.id,
                          "workView",
                          event.target.value,
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    >
                      {workViews.map((workView) => (
                        <option key={workView.value} value={workView.value}>
                          {workView.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Driver Name
                    </span>
                    <select
                      value={draft.driverName}
                      onChange={(event) =>
                        updateDraft(
                          user.id,
                          "driverName",
                          event.target.value,
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    >
                      <option value="">None</option>
                      {driverNameOptions.map((driver) => (
                        <option key={driver} value={driver}>
                          {driver}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => toggleAccessPanel(user.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-4 text-left transition hover:bg-slate-100"
                  aria-expanded={accessPanelIsOpen}
                >
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Page Access
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Pick exactly what this user can open.
                    </p>
                  </div>

                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 shadow-sm">
                      {(draft.permissions || []).length} selected
                    </span>

                    <ChevronDown
                      aria-hidden="true"
                      className={`h-5 w-5 text-slate-400 transition-transform ${
                        accessPanelIsOpen ? "rotate-180" : ""
                      }`}
                      strokeWidth={2.5}
                    />
                  </span>
                </button>

                {accessPanelIsOpen ? (
                <div className="space-y-2 border-t border-slate-200 p-4">
                  {permissionGroups.map((group) => {
                    const selectedCount = group.permissions.filter(
                      (permission) =>
                        (draft.permissions || []).includes(
                          permission.id,
                        ),
                    ).length;
                    const groupIsOpen = isAccessGroupOpen(
                      user.id,
                      group,
                      draft,
                    );

                    return (
                      <div
                        key={group.title}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            toggleAccessGroup(user.id, group, draft)
                          }
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                          aria-expanded={groupIsOpen}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-black text-slate-900">
                              {group.title}
                            </span>
                            <span className="mt-0.5 block text-xs font-bold text-slate-500">
                              {selectedCount} of{" "}
                              {group.permissions.length} selected
                            </span>
                          </span>

                          <span className="flex shrink-0 items-center gap-2">
                            {selectedCount > 0 ? (
                              <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-[#FC2C38]">
                                {selectedCount}
                              </span>
                            ) : null}

                            <ChevronDown
                              aria-hidden="true"
                              className={`h-5 w-5 text-slate-400 transition-transform ${
                                groupIsOpen ? "rotate-180" : ""
                              }`}
                              strokeWidth={2.5}
                            />
                          </span>
                        </button>

                        {groupIsOpen ? (
                          <div className="space-y-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
                            {group.permissions.map((permission) => (
                              <label
                                key={permission.id}
                                className="flex items-center gap-2 text-sm font-bold text-slate-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={(
                                    draft.permissions || []
                                  ).includes(permission.id)}
                                  onChange={() =>
                                    togglePermission(
                                      user.id,
                                      permission.id,
                                    )
                                  }
                                  className="h-4 w-4 rounded border-slate-300 text-[#FC2C38] focus:ring-red-200"
                                />
                                <span>{permission.label}</span>
                              </label>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                ) : null}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => saveUser(user)}
                  disabled={!hasChanges || savingUserId === user.id}
                  className="rounded-xl bg-[#FC2C38] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {savingUserId === user.id
                    ? "Saving..."
                    : "Save Access"}
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </PageContainer>
  );
}
