import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import { deliveryDrivers } from "../data/options";

const roles = [
  { value: "pending", label: "Pending" },
  { value: "driver", label: "Driver" },
  { value: "receiving", label: "Receiving" },
  { value: "south", label: "Dispatch" },
  { value: "delivery", label: "Delivery" },
  { value: "sales", label: "Sales" },
  { value: "admin", label: "Admin" },
  { value: "superAdmin", label: "Super Admin" },
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
    ],
  },
  {
    title: "South",
    permissions: [
      { id: "south", label: "South" },
      { id: "supplier-runs-add", label: "Add POs" },
      { id: "supplier-runs-dispatch", label: "Needs Dispatch" },
      { id: "supplier-runs-check", label: "View POs to Pick Up" },
      { id: "supplier-runs-history", label: "South History" },
    ],
  },
  {
    title: "Deliveries",
    permissions: [
      { id: "deliveries", label: "Deliveries" },
      { id: "deliveries-add", label: "Add Deliveries" },
      { id: "deliveries-queue", label: "To Be Delivered" },
      { id: "deliveries-history", label: "Delivery History" },
    ],
  },
  {
    title: "Sales",
    permissions: [
      { id: "sales", label: "Sales" },
      { id: "customers-add", label: "Add Customer" },
      { id: "customers-view", label: "View Customers" },
      { id: "customer-payment-links", label: "Payment Links" },
      { id: "sales-converter", label: "Converter" },
      { id: "sales-report", label: "Sales Pulse" },
    ],
  },
  {
    title: "Admin",
    permissions: [
      { id: "admin", label: "Admin" },
      { id: "user-admin", label: "User Access" },
      { id: "email-list", label: "Email List" },
    ],
  },
];

const allPermissionIds = permissionGroups.flatMap((group) =>
  group.permissions.map((permission) => permission.id),
);

const rolePermissionPresets = {
  pending: [],
  driver: [
    "dashboard",
    "south",
    "supplier-runs-check",
    "deliveries",
    "deliveries-queue",
  ],
  receiving: ["dashboard", "receiving", "check-in", "today", "search"],
  south: [
    "dashboard",
    "south",
    "supplier-runs-add",
    "supplier-runs-dispatch",
    "supplier-runs-check",
    "supplier-runs-history",
  ],
  delivery: ["dashboard", "deliveries", "deliveries-queue", "deliveries-history"],
  sales: [
    "dashboard",
    "south",
    "supplier-runs-add",
    "sales",
    "customers-add",
    "customers-view",
    "sales-converter",
  ],
  admin: allPermissionIds.filter(
    (permissionId) =>
      !["user-admin", "fleet", "bouncie"].includes(permissionId),
  ),
  superAdmin: allPermissionIds,
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

  return rolePermissionPresets[user.role] || [];
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

  function getDraft(user) {
    return {
      role: user.role || "pending",
      status: user.status || "pending",
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
        status: draft.status,
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
            draft.status !== (user.status || "pending") ||
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

                <div className="grid gap-3 sm:grid-cols-3 lg:w-[540px]">
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
                      Driver
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
                      {deliveryDrivers.map((driver) => (
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
