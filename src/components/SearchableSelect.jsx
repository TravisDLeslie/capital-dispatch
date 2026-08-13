import { useMemo, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export default function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder = "Select...",
  disabled = false,
  allowCustomValue = false,
  accent = "emerald",
  className = "",
}) {
  const safeOptions = Array.isArray(options) ? options : [];
  const [isOpen, setIsOpen] = useState(false);
  const normalizedValue = normalizeText(value);
  const filteredOptions = useMemo(() => {
    if (!normalizedValue) {
      return safeOptions;
    }

    return safeOptions.filter((option) =>
      normalizeText(option).includes(normalizedValue),
    );
  }, [normalizedValue, safeOptions]);
  const focusClasses =
    accent === "red"
      ? "focus:border-[#FC2C38] focus:ring-red-100"
      : accent === "blue"
        ? "focus:border-blue-600 focus:ring-blue-100"
        : "focus:border-emerald-600 focus:ring-emerald-100";

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          id={id}
          type="text"
          autoComplete="off"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 150);
          }}
          readOnly={!allowCustomValue}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full rounded-xl border border-slate-300 bg-white px-4 py-4 pr-12 text-lg font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:ring-4 ${focusClasses}`}
        />

        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setIsOpen((current) => !current)}
          disabled={disabled}
          className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
          aria-label="Open options"
        >
          <ChevronDown
            aria-hidden="true"
            className={`h-5 w-5 transition ${isOpen ? "rotate-180" : ""}`}
            strokeWidth={2.5}
          />
        </button>
      </div>

      {isOpen && !disabled ? (
        <div className="absolute left-0 right-0 z-40 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="max-h-72 overflow-y-auto overscroll-contain p-2">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = normalizeText(option) === normalizedValue;

                return (
                  <button
                    key={option}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(option);
                      setIsOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-base font-bold text-slate-800 transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  >
                    <span>{option}</span>
                    {isSelected ? (
                      <Check
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0 text-emerald-600"
                        strokeWidth={2.7}
                      />
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-5 text-sm font-bold text-slate-500">
                {allowCustomValue
                  ? "No saved option. Keep typing to use this value."
                  : "No matching options."}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
