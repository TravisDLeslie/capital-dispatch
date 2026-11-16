import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  Save,
  ShieldCheck,
  Target,
  UserRound,
  X,
} from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import PageContainer from "../components/PageContainer";
import {
  saveYardTrainingRecord,
  subscribeToYardTrainingRecords,
} from "../utils/yardTrainingStorage";

const yardGuides = [
  {
    week: 1,
    title: "Fundamentals & Safety",
    description: "Start with material identification, safe equipment habits, banding, stickers, and forklift visibility.",
    topics: ["Bander setup", "South 40 materials", "Safe forklift travel"],
    file: "/documents/yard/load-builder-week-1.pdf",
    tone: "border-red-200 bg-red-50 text-red-700",
    appSetup: {
      skill: "Open the Capital Lumber Dispatch app and save it in your browser or add it to your home screen.",
      url: "https://dispatch.capitallumber.co/",
      description: "Use the app to look up order information, receive items, and access other yard tools.",
    },
    skills: [
      "Properly operate the bander and securely band lumber and building materials.",
      "Identify all material types, sizes, and lengths stored in the far South 40.",
      "Pull three different sizes from the South 40 and band them into one secure load.",
      "Safely lift, transport, and position full units without damaging material.",
      "Travel in reverse whenever a forklift load blocks forward visibility.",
      "Explain why stickers are used: airflow, moisture control, protection, and support.",
      "Use one or two stickers correctly; truck-mounted forklifts require two stickers.",
      "Open the Capital Lumber Dispatch app and save it in your browser or add it to your home screen.",
    ],
    standard: "Employee can safely identify, pull, transport, sticker, and band a mixed South 40 load under trainer supervision.",
  },
  {
    week: 2,
    title: "Material Knowledge & Load Planning",
    description: "Build confidence with lumber terminology, grades, thicknesses, load order, and mixed-unit handling.",
    topics: ["Grades & thicknesses", "Load order", "Mixed pulls"],
    file: "/documents/yard/load-builder-week-2.pdf",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    skills: [
      "Identify 5/4 versus 4/4 exterior trim by actual thickness.",
      "Identify 4/4 interior material as 1 inch and 3/4 material as .75 inch.",
      "Identify ultralight MDF at 11/16 inch and thinner nominal 1/2 inch profiles.",
      "Identify #1 grade 2x4 and Select Structural 2x6 and larger lumber.",
      "Place pressure-treated material first or on top when planning a load.",
      "Load and unload full units safely and without material damage.",
      "Load and unload mixed or partial loads while keeping products separated.",
    ],
    standard: "Employee can identify common grades and thicknesses and plan a stable full, mixed, or partial load in the correct order.",
  },
  {
    week: 3,
    title: "Advanced Product Knowledge",
    description: "Identify engineered lumber, specialty profiles, sheet goods, siding, and where those products live.",
    topics: ["LVL & TJI", "Sheet goods", "Siding profiles"],
    file: "/documents/yard/load-builder-week-3.pdf",
    tone: "border-blue-200 bg-blue-50 text-blue-700",
    skills: [
      "Explain common LVL uses and identify the dimensions stocked in the yard.",
      "Explain TJI uses and identify stocked depths, series, and lengths.",
      "Identify the WP4 V-groove profile.",
      "Explain the difference between Fineline and WP4 profiles.",
      "Identify OSB, CDX, and ACX sheet goods.",
      "Identify 16/4, 16/3, and 16/2 siding groove patterns.",
      "Locate each engineered lumber, specialty profile, sheet good, and siding product in the yard.",
    ],
    standard: "Employee can identify and locate the major engineered lumber, specialty profile, sheet good, and siding products without assistance.",
  },
  {
    week: 4,
    title: "Independent Load Building",
    description: "Finish the first month by building orders independently and learning the stock yard and Building C.",
    topics: ["Independent orders", "Partial quantities", "Yard knowledge"],
    file: "/documents/yard/load-builder-week-4.pdf",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    skills: [
      "Build small and medium orders independently and accurately.",
      "Pull partial quantities without damaging material or mixing products.",
      "Identify and locate Allura products.",
      "Identify #1 and #2 grade beams and posts.",
      "Identify concrete packaging: 80 lb blue, ready-mix blue with printing, and 60 lb gray or tan.",
      "Stock and put away yard materials in their correct locations.",
      "Identify and locate the products stored in Building C.",
    ],
    standard: "Employee can build an accurate small or medium order independently, put material away correctly, and complete the 30-day review.",
  },
];

function safeEmployee(employee) {
  const name = String(employee?.displayName || employee?.name || employee?.email || "Employee").trim();
  return {
    id: String(employee?.id || employee?.uid || employee?.email || name).trim(),
    name,
    email: String(employee?.email || "").trim(),
    role: String(employee?.role || "").trim(),
    status: String(employee?.status || "approved").trim(),
  };
}

function recordId(employeeId, week) {
  const safeId = String(employeeId || "employee").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return `${safeId}-week-${week}`;
}

function DigitalGuide({ guide, trainee, record, currentUser, onSaved, onClose }) {
  const [completedSkills, setCompletedSkills] = useState(Array.isArray(record?.completedSkills) ? record.completedSkills : []);
  const [notes, setNotes] = useState(String(record?.notes || ""));
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const allSkillsComplete = completedSkills.length === guide.skills.length;

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function toggleSkill(skillIndex) {
    setCompletedSkills((current) => current.includes(skillIndex)
      ? current.filter((index) => index !== skillIndex)
      : [...current, skillIndex].sort((first, second) => first - second));
    setSaveMessage("");
  }

  async function handleSave(completed = false) {
    if (completed && !allSkillsComplete) {
      setSaveMessage("Check every skill before completing the week.");
      return;
    }

    const now = new Date().toISOString();
    const nextRecord = {
      id: recordId(trainee.id, guide.week),
      traineeId: trainee.id,
      traineeName: trainee.name,
      traineeEmail: trainee.email,
      week: guide.week,
      completedSkills,
      notes: notes.trim(),
      completed,
      completedAt: completed ? now : null,
      updatedAt: now,
      updatedBy: currentUser?.name || currentUser?.email || "Receiving team",
    };

    setSaving(true);
    setSaveMessage("");
    try {
      await saveYardTrainingRecord(nextRecord);
      onSaved(nextRecord);
      setSaveMessage(completed ? "Week completed." : "Progress saved.");
    } catch (error) {
      console.error("Unable to save yard training progress:", error);
      setSaveMessage("Progress could not sync. Check permissions and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={`Week ${guide.week}: ${guide.title}`}>
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">{trainee.name} · Week {guide.week}</p>
            <h2 className="truncate text-xl font-black text-slate-950 sm:text-2xl">{guide.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950" aria-label="Close digital guide">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Digital checklist</p>
                <p className="mt-1 text-sm font-bold text-slate-700">{completedSkills.length} of {guide.skills.length} skills complete</p>
              </div>
              <p className="text-2xl font-black text-blue-700">{Math.round((completedSkills.length / guide.skills.length) * 100)}%</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${(completedSkills.length / guide.skills.length) * 100}%` }} />
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {guide.skills.map((skill, skillIndex) => {
              const checked = completedSkills.includes(skillIndex);
              const isAppSetupSkill = guide.appSetup?.skill === skill;
              const rowClasses = checked ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50";

              if (isAppSetupSkill) {
                return (
                  <div key={skill} className={`rounded-2xl border p-4 transition ${rowClasses}`}>
                    <button type="button" onClick={() => toggleSkill(skillIndex)} className="flex w-full items-start gap-3 text-left">
                      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border ${checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent"}`}>
                        <Check aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-bold leading-6 text-slate-800 sm:text-base">{skill}</span>
                    </button>
                    <div className="ml-9 mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                      <p className="text-sm font-semibold leading-6 text-slate-700">{guide.appSetup.description}</p>
                      <a href={guide.appSetup.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-black text-blue-700 underline decoration-blue-300 underline-offset-4 transition hover:text-blue-900">
                        dispatch.capitallumber.co <ExternalLink aria-hidden="true" className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                );
              }

              return (
                <button key={skill} type="button" onClick={() => toggleSkill(skillIndex)} className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${rowClasses}`}>
                  <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border ${checked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent"}`}>
                    <Check aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-bold leading-6 text-slate-800 sm:text-base">{skill}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-800">Completion standard</p>
            <p className="mt-2 text-sm font-bold leading-6 text-amber-950">{guide.standard}</p>
          </div>

          <label className="mt-5 block">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-600">My notes <span className="text-slate-400">(optional)</span></span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Add anything you want to remember or practice again..." className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </label>
        </div>

        <div className="border-t border-slate-200 bg-white p-4 sm:px-6">
          {saveMessage ? <p className="mb-3 text-sm font-bold text-slate-700">{saveMessage}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <a href={guide.file} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
              Original PDF <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </a>
            <button type="button" onClick={() => handleSave(false)} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-800 transition hover:bg-slate-100 disabled:opacity-50 sm:ml-auto">
              <Save aria-hidden="true" className="h-4 w-4" /> Save progress
            </button>
            <button type="button" onClick={() => handleSave(true)} disabled={saving || !allSkillsComplete} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Complete week
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function YardDocumentsPage({ onPageChange, currentUser, users }) {
  const currentEmployee = safeEmployee(currentUser);
  const traineeOptions = useMemo(() => {
    const unique = new Map();
    [currentUser, ...(users || [])].forEach((user) => {
      const employee = safeEmployee(user);
      if (employee.id && employee.status !== "disabled" && employee.role !== "supplier") unique.set(employee.id, employee);
    });
    return [...unique.values()].sort((first, second) => first.name.localeCompare(second.name));
  }, [currentUser, users]);
  const [selectedTraineeId, setSelectedTraineeId] = useState(currentEmployee.id);
  const [activeGuide, setActiveGuide] = useState(null);
  const [records, setRecords] = useState([]);
  const [syncMessage, setSyncMessage] = useState("");

  useEffect(() => subscribeToYardTrainingRecords(setRecords, () => setSyncMessage("Training progress is using this device until Firestore access is available.")), []);

  useEffect(() => {
    if (!traineeOptions.some((employee) => employee.id === selectedTraineeId)) setSelectedTraineeId(traineeOptions[0]?.id || "");
  }, [selectedTraineeId, traineeOptions]);

  const trainee = traineeOptions.find((employee) => employee.id === selectedTraineeId) || currentEmployee;
  const traineeRecords = useMemo(() => records.filter((record) => String(record.traineeId) === trainee.id), [records, trainee.id]);
  const completedWeekCount = traineeRecords.filter((record) => record.completed).length;
  const guideRecord = (week) => traineeRecords.find((record) => Number(record.week) === week);

  function handleRecordSaved(nextRecord) {
    setRecords((current) => [nextRecord, ...current.filter((record) => record.id !== nextRecord.id)]);
  }

  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "Receiving", onClick: () => onPageChange?.("receiving") }, { label: "Yard Documents" }]} />

      <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-xl">
        <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-10 lg:py-10">
          <div>
            <div className="flex items-center gap-3 text-[#FC2C38]">
              <BookOpenCheck aria-hidden="true" className="h-6 w-6" />
              <p className="text-xs font-black uppercase tracking-[0.22em]">Receiving training library</p>
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Digital Load Builder</h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-300 sm:text-lg">Work through each weekly skill, check off your own progress, and mark the week complete when every item is done. The original guides remain available to view or print.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <Target aria-hidden="true" className="h-6 w-6 text-red-400" />
              <p className="mt-3 text-2xl font-black">{completedWeekCount}/4</p>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Weeks complete</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <ShieldCheck aria-hidden="true" className="h-6 w-6 text-emerald-400" />
              <p className="mt-3 truncate text-lg font-black">{trainee.name}</p>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Current trainee</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex sm:items-end sm:justify-between sm:gap-4">
        <label className="block flex-1">
          <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600"><UserRound aria-hidden="true" className="h-4 w-4" />Training record for</span>
          <select value={selectedTraineeId} onChange={(event) => setSelectedTraineeId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
            {traineeOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.email ? ` · ${employee.email}` : ""}</option>)}
          </select>
        </label>
        {syncMessage ? <p className="mt-3 max-w-xl text-xs font-bold text-amber-700 sm:mt-0">{syncMessage}</p> : null}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        {yardGuides.map((guide) => {
          const record = guideRecord(guide.week);
          const completeCount = Array.isArray(record?.completedSkills) ? record.completedSkills.length : 0;
          const progress = Math.round((completeCount / guide.skills.length) * 100);
          return (
            <article key={guide.week} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border text-xl font-black ${guide.tone}`}>{guide.week}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FC2C38]">Load Builder · Week {guide.week}</p>
                    <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">{guide.title}</h2>
                  </div>
                </div>
                {record?.completed ? <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-emerald-800">Complete</span> : <FileText aria-hidden="true" className="hidden h-6 w-6 shrink-0 text-slate-300 sm:block" />}
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{guide.description}</p>
              <div className="mt-5 flex items-center justify-between text-xs font-black uppercase tracking-[0.12em] text-slate-600"><span>{completeCount} of {guide.skills.length} skills</span><span>{progress}%</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${record?.completed ? "bg-emerald-500" : "bg-blue-600"}`} style={{ width: `${progress}%` }} /></div>
              <div className="mt-5 flex flex-wrap gap-2">{guide.topics.map((topic) => <span key={topic} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600" />{topic}</span>)}</div>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => setActiveGuide(guide)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800">{completeCount ? "Continue checklist" : "Start checklist"}<ArrowRight aria-hidden="true" className="h-4 w-4" /></button>
                <a href={guide.file} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">PDF<ExternalLink aria-hidden="true" className="h-4 w-4" /></a>
              </div>
            </article>
          );
        })}
      </section>

      {activeGuide ? <DigitalGuide key={`${trainee.id}-${activeGuide.week}`} guide={activeGuide} trainee={trainee} record={guideRecord(activeGuide.week)} currentUser={currentEmployee} onSaved={handleRecordSaved} onClose={() => setActiveGuide(null)} /> : null}
    </PageContainer>
  );
}
