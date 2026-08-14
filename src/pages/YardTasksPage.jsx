import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import EmptyState from "../components/EmptyState";
import PageContainer from "../components/PageContainer";
import SearchableSelect from "../components/SearchableSelect";
import { createId } from "../utils/idHelpers";
import { locations, receivingTeamMembers } from "../data/options";

const priorityOptions = [
  { value: 1, label: "Low", tone: "bg-slate-100 text-slate-600" },
  { value: 2, label: "When you can", tone: "bg-blue-50 text-blue-700" },
  { value: 3, label: "Today", tone: "bg-amber-50 text-amber-800" },
  { value: 4, label: "Important", tone: "bg-orange-50 text-orange-800" },
  { value: 5, label: "Hot", tone: "bg-red-50 text-red-700" },
];

const MAX_ACTIVE_TASKS_PER_PERSON = 3;

function getPriority(priority) {
  return (
    priorityOptions.find(
      (priorityOption) => priorityOption.value === Number(priority),
    ) || priorityOptions[2]
  );
}

function getTaskAge(task) {
  if (!task.createdAt) {
    return "New task";
  }

  return new Date(task.createdAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function isAssignedToCurrentUser(task, currentUser) {
  const assignedTo = normalizeName(task.assignedTo);

  if (!assignedTo) {
    return false;
  }

  const displayName = normalizeName(
    currentUser?.name || currentUser?.displayName,
  );
  const emailName = normalizeName(
    String(currentUser?.email || "").split("@")[0],
  );
  const firstName = displayName.split(/\s+/)[0] || "";

  return [displayName, firstName, emailName]
    .filter(Boolean)
    .some(
      (userName) =>
        assignedTo === userName ||
        assignedTo.includes(userName) ||
        userName.includes(assignedTo),
    );
}

function isSameAssignedPerson(firstValue, secondValue) {
  const firstName = normalizeName(firstValue);
  const secondName = normalizeName(secondValue);

  if (!firstName || !secondName) {
    return false;
  }

  const firstShortName = firstName.split(/\s+/)[0] || "";
  const secondShortName = secondName.split(/\s+/)[0] || "";

  return (
    firstName === secondName ||
    firstShortName === secondName ||
    secondShortName === firstName ||
    firstName.includes(secondName) ||
    secondName.includes(firstName)
  );
}

function countOpenTasksForAssignee(tasks, assignee, excludedTaskId = "") {
  if (!assignee.trim()) {
    return 0;
  }

  return tasks.filter(
    (task) =>
      task.id !== excludedTaskId &&
      task.status !== "complete" &&
      isSameAssignedPerson(task.assignedTo, assignee),
  ).length;
}

function YardTaskCard({
  task,
  isAssignedToMe,
  canManageTasks,
  onRequestComplete,
  onEditTask,
  onDeleteTask,
}) {
  const isComplete = task.status === "complete";
  const priority = getPriority(task.priority);

  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm transition sm:p-5 ${
        isComplete
          ? "border-emerald-200 bg-emerald-50/30"
          : isAssignedToMe
            ? "border-red-200 bg-red-50/30 shadow-md ring-1 ring-red-100"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => {
            if (!isComplete && isAssignedToMe) {
              onRequestComplete(task);
            }
          }}
          disabled={isComplete || !isAssignedToMe}
          className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
            isComplete
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : isAssignedToMe
                ? "border-slate-200 bg-white text-slate-400 hover:border-emerald-200 hover:text-emerald-700"
                : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300"
          }`}
          aria-label={
            isComplete
              ? "Task complete"
              : isAssignedToMe
                ? "Complete task"
                : "Only the assigned user can complete this task"
          }
        >
          {isComplete ? (
            <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
          ) : (
            <Circle aria-hidden="true" className="h-5 w-5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${priority.tone}`}
            >
              P{priority.value} {priority.label}
            </span>
            {isAssignedToMe && !isComplete ? (
              <span className="rounded-full bg-[#FC2C38] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-white">
                Assigned to you
              </span>
            ) : null}
            {task.area ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                {task.area}
              </span>
            ) : null}
          </div>

          <h2
            className={`mt-3 text-2xl font-black leading-tight ${
              isComplete ? "text-slate-500 line-through" : "text-slate-950"
            }`}
          >
            {task.title}
          </h2>

          <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold text-slate-500">
            {task.assignedTo ? (
              <span
                className={`inline-flex items-center gap-2 ${
                  isAssignedToMe && !isComplete
                    ? "text-[#FC2C38]"
                    : ""
                }`}
              >
                <UserRound aria-hidden="true" className="h-4 w-4" />
                {task.assignedTo}
              </span>
            ) : null}
            <span>{getTaskAge(task)}</span>
          </div>

          {task.notes ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold leading-6 text-slate-600">
              {task.notes}
            </p>
          ) : null}
        </div>

        {canManageTasks ? (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => onEditTask(task)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
              aria-label="Edit yard task"
            >
              <Pencil aria-hidden="true" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteTask(task.id)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-red-500 transition hover:bg-red-50"
              aria-label="Delete yard task"
            >
              <Trash2 aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function YardTasksPage({
  yardTasks,
  currentUser,
  canManageTasks = false,
  onSaveTask,
  onUpdateTask,
  onDeleteTask,
  onPageChange,
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState(3);
  const [area, setArea] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("mine");
  const [taskLimitError, setTaskLimitError] = useState("");
  const [taskToComplete, setTaskToComplete] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState(3);
  const [editArea, setEditArea] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const openTasks = useMemo(
    () => yardTasks.filter((task) => task.status !== "complete"),
    [yardTasks],
  );
  const completedTasks = useMemo(
    () => yardTasks.filter((task) => task.status === "complete"),
    [yardTasks],
  );
  const assignedToMeCount = useMemo(
    () =>
      openTasks.filter((task) => isAssignedToCurrentUser(task, currentUser))
        .length,
    [currentUser, openTasks],
  );
  const visibleOpenTasks = useMemo(
    () =>
      viewMode === "mine"
        ? openTasks.filter((task) => isAssignedToCurrentUser(task, currentUser))
        : openTasks,
    [currentUser, openTasks, viewMode],
  );
  const visibleCompletedTasks = useMemo(
    () =>
      viewMode === "mine"
        ? completedTasks.filter((task) =>
            isAssignedToCurrentUser(task, currentUser),
          )
        : completedTasks,
    [completedTasks, currentUser, viewMode],
  );
  const filteredTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return visibleOpenTasks;
    }

    return visibleOpenTasks.filter((task) =>
      [task.title, task.area, task.assignedTo, task.notes]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [visibleOpenTasks, search]);

  function resetForm() {
    setTitle("");
    setPriority(3);
    setArea("");
    setAssignedTo("");
    setNotes("");
    setTaskLimitError("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    const trimmedAssignedTo = assignedTo.trim();

    if (
      trimmedAssignedTo &&
      countOpenTasksForAssignee(yardTasks, trimmedAssignedTo) >=
        MAX_ACTIVE_TASKS_PER_PERSON
    ) {
      setTaskLimitError(
        `${trimmedAssignedTo} already has ${MAX_ACTIVE_TASKS_PER_PERSON} active yard tasks. Complete one before assigning another.`,
      );
      return;
    }

    const createdAt = new Date().toISOString();

    onSaveTask({
      id: createId(),
      title: title.trim(),
      priority,
      area: area.trim(),
      assignedTo: trimmedAssignedTo,
      notes: notes.trim(),
      status: "open",
      createdAt,
      updatedAt: createdAt,
      createdById: currentUser?.uid || currentUser?.id || "",
      createdByName: currentUser?.name || currentUser?.displayName || "",
      createdByEmail: currentUser?.email || "",
    });
    setTaskLimitError("");
    resetForm();
  }

  function startEditTask(task) {
    setTaskLimitError("");
    setEditingTask(task);
    setEditTitle(task.title || "");
    setEditPriority(Number(task.priority || 3));
    setEditArea(task.area || "");
    setEditAssignedTo(task.assignedTo || "");
    setEditNotes(task.notes || "");
  }

  function closeEditTask() {
    setEditingTask(null);
    setTaskLimitError("");
    setEditTitle("");
    setEditPriority(3);
    setEditArea("");
    setEditAssignedTo("");
    setEditNotes("");
  }

  function handleEditSubmit(event) {
    event.preventDefault();

    if (!editingTask || !editTitle.trim()) {
      return;
    }

    const trimmedEditAssignedTo = editAssignedTo.trim();

    if (
      trimmedEditAssignedTo &&
      editingTask.status !== "complete" &&
      countOpenTasksForAssignee(
        yardTasks,
        trimmedEditAssignedTo,
        editingTask.id,
      ) >= MAX_ACTIVE_TASKS_PER_PERSON
    ) {
      setTaskLimitError(
        `${trimmedEditAssignedTo} already has ${MAX_ACTIVE_TASKS_PER_PERSON} active yard tasks. Complete one before assigning another.`,
      );
      return;
    }

    onUpdateTask(editingTask.id, {
      title: editTitle.trim(),
      priority: editPriority,
      area: editArea.trim(),
      assignedTo: trimmedEditAssignedTo,
      notes: editNotes.trim(),
    });
    setTaskLimitError("");
    closeEditTask();
  }

  function handleConfirmCompleteTask() {
    if (!taskToComplete) {
      return;
    }

    onUpdateTask(taskToComplete.id, {
      status: "complete",
      completedAt: new Date().toISOString(),
      completedById: currentUser?.uid || currentUser?.id || "",
      completedByName: currentUser?.name || currentUser?.displayName || "",
      completedByEmail: currentUser?.email || "",
    });
    setTaskToComplete(null);
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[
          { label: "Receiving", onClick: () => onPageChange("receiving") },
          { label: "Yard Tasks" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-[#FC2C38]">
            Yard Work
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Yard Tasks
          </h1>
          <p className="mt-2 max-w-3xl text-lg font-semibold leading-8 text-slate-500">
            Keep the loose yard work visible without turning it into a giant
            checklist.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:flex">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center shadow-sm">
            <p className="text-2xl font-black text-amber-900">
              {openTasks.length}
            </p>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">
              Open
            </p>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-center shadow-sm">
            <p className="text-2xl font-black text-[#FC2C38]">
              {assignedToMeCount}
            </p>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-600">
              Mine
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center shadow-sm">
            <p className="text-2xl font-black text-emerald-800">
              {completedTasks.length}
            </p>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
              Done
            </p>
          </div>
        </div>
      </div>

      {canManageTasks ? (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        >
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
              <Plus aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                Add Task
              </p>
              <h2 className="text-2xl font-black text-slate-950">
                What needs done?
              </h2>
            </div>
          </div>

          {taskLimitError ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black leading-6 text-amber-900">
              {taskLimitError}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <label className="block">
              <span className="text-sm font-black text-slate-800">
                Task
              </span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Move plywood bunks, clean bay, stage order..."
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-lg font-semibold text-slate-950 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
              />
            </label>

            <div>
              <span className="text-sm font-black text-slate-800">
                Priority
              </span>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {priorityOptions.map((priorityOption) => (
                  <button
                    key={priorityOption.value}
                    type="button"
                    onClick={() => setPriority(priorityOption.value)}
                    className={`rounded-xl border px-2 py-3 text-center text-sm font-black transition ${
                      priority === priorityOption.value
                        ? "border-[#FC2C38] bg-red-50 text-[#FC2C38]"
                        : "border-slate-200 bg-white text-slate-500 hover:border-red-200"
                    }`}
                  >
                    {priorityOption.value}
                  </button>
                ))}
              </div>
            </div>

            {taskLimitError ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black leading-6 text-amber-900">
                {taskLimitError}
              </div>
            ) : null}

            <label className="block">
              <span className="text-sm font-black text-slate-800">
                Area
              </span>
              <SearchableSelect
                id="yard-task-area"
                value={area}
                options={locations}
                onChange={setArea}
                placeholder="Select or type an area..."
                allowCustomValue
                accent="red"
                className="mt-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-800">
                Assigned To
              </span>
              <SearchableSelect
                id="yard-task-assigned-to"
                value={assignedTo}
                options={receivingTeamMembers}
                onChange={setAssignedTo}
                placeholder="Optional..."
                allowCustomValue
                accent="red"
                className="mt-2"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-black text-slate-800">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Anything the yard needs to know..."
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-950 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
            />
          </label>

          <button
            type="submit"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#FC2C38] px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-red-600"
          >
            <ClipboardList aria-hidden="true" className="h-5 w-5" />
            Save Yard Task
          </button>
        </form>
      ) : null}

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setViewMode("mine")}
            className={`rounded-lg px-3 py-2 text-sm font-black transition ${
              viewMode === "mine"
                ? "bg-white text-[#FC2C38] shadow-sm"
                : "text-slate-500"
            }`}
          >
            My Tasks ({assignedToMeCount})
          </button>
          <button
            type="button"
            onClick={() => setViewMode("all")}
            className={`rounded-lg px-3 py-2 text-sm font-black transition ${
              viewMode === "all"
                ? "bg-white text-[#FC2C38] shadow-sm"
                : "text-slate-500"
            }`}
          >
            All Tasks ({openTasks.length})
          </button>
        </div>
        <label className="block">
          <span className="sr-only">Search yard tasks</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              viewMode === "mine"
                ? "Search my open tasks..."
                : "Search all open tasks..."
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100"
          />
        </label>
      </div>

      {filteredTasks.length > 0 ? (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <YardTaskCard
              key={task.id}
              task={task}
              isAssignedToMe={isAssignedToCurrentUser(task, currentUser)}
              canManageTasks={canManageTasks}
              onRequestComplete={setTaskToComplete}
              onEditTask={startEditTask}
              onDeleteTask={onDeleteTask}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No open yard tasks"
          description={
            viewMode === "mine"
              ? "You do not have active yard tasks right now. Switch to All Tasks if you want to help someone else."
              : "Add one above when something loose needs to stay visible."
          }
        />
      )}

      {visibleCompletedTasks.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-slate-400">
            Completed
          </h2>
          <div className="space-y-3">
            {visibleCompletedTasks.slice(0, 10).map((task) => (
              <YardTaskCard
                key={task.id}
                task={task}
                isAssignedToMe={isAssignedToCurrentUser(task, currentUser)}
                canManageTasks={canManageTasks}
                onRequestComplete={setTaskToComplete}
                onEditTask={startEditTask}
                onDeleteTask={onDeleteTask}
              />
            ))}
          </div>
        </section>
      ) : null}

      {taskToComplete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                  Yard Task
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Did you complete the task?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setTaskToComplete(null)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"
                aria-label="Close complete task modal"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-base font-bold leading-6 text-slate-700">
              {taskToComplete.title}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTaskToComplete(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-700 transition hover:bg-slate-50"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleConfirmCompleteTask}
                className="rounded-xl bg-emerald-700 px-4 py-3 text-base font-black text-white shadow-sm transition hover:bg-emerald-800"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingTask && canManageTasks ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <form
            onSubmit={handleEditSubmit}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">
                  Edit Task
                </p>
                <h2 className="mt-2 text-3xl font-black text-slate-950">
                  Yard Task
                </h2>
              </div>
              <button
                type="button"
                onClick={closeEditTask}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100"
                aria-label="Close edit task modal"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <label className="block">
              <span className="text-sm font-black text-slate-800">
                Task
              </span>
              <input
                type="text"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-4 text-lg font-semibold text-slate-950 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
              />
            </label>

            <div className="mt-4">
              <span className="text-sm font-black text-slate-800">
                Priority
              </span>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {priorityOptions.map((priorityOption) => (
                  <button
                    key={priorityOption.value}
                    type="button"
                    onClick={() => setEditPriority(priorityOption.value)}
                    className={`rounded-xl border px-2 py-3 text-center text-sm font-black transition ${
                      editPriority === priorityOption.value
                        ? "border-[#FC2C38] bg-red-50 text-[#FC2C38]"
                        : "border-slate-200 bg-white text-slate-500 hover:border-red-200"
                    }`}
                  >
                    {priorityOption.value}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-black text-slate-800">
                  Area
                </span>
                <SearchableSelect
                  id="yard-task-edit-area"
                  value={editArea}
                  options={locations}
                  onChange={setEditArea}
                  placeholder="Select or type an area..."
                  allowCustomValue
                  accent="red"
                  className="mt-2"
                />
              </label>

              <label className="block">
                <span className="text-sm font-black text-slate-800">
                  Assigned To
                </span>
                <SearchableSelect
                  id="yard-task-edit-assigned-to"
                  value={editAssignedTo}
                  options={receivingTeamMembers}
                  onChange={setEditAssignedTo}
                  placeholder="Optional..."
                  allowCustomValue
                  accent="red"
                  className="mt-2"
                />
              </label>
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-black text-slate-800">
                Notes
              </span>
              <textarea
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-950 outline-none transition focus:border-[#FC2C38] focus:ring-4 focus:ring-red-100"
              />
            </label>

            <div className="mt-5 grid gap-3 sm:grid-cols-[0.35fr_0.65fr]">
              <button
                type="button"
                onClick={closeEditTask}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#FC2C38] px-4 py-3 text-base font-black text-white shadow-sm transition hover:bg-red-600"
              >
                Save Task Changes
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </PageContainer>
  );
}
