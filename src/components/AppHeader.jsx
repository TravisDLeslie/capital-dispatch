const navigationItems = [
  {
    id: "check-in",
    label: "Check In",
  },
  {
    id: "today",
    label: "Today's Check-Ins",
  },
  {
    id: "search",
    label: "Search PO",
  },
];

export default function AppHeader({ currentPage, onPageChange }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex min-h-20 flex-col justify-center gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => onPageChange("check-in")}
            className="text-left"
          >
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">
              Capital Lumber
            </p>

            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Dispatch CL
            </h1>
          </button>

          <nav className="flex gap-2 overflow-x-auto">
            {navigationItems.map((item) => {
              const isActive = currentPage === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onPageChange(item.id)}
                  className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    isActive
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}