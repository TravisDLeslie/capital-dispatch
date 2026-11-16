import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from "lucide-react";
import PageContainer from "./PageContainer";

const ADMIN_ACCESS_PASSWORD = "CL1905";

export default function AdminAccessGate({
  areaLabel = "Admin",
  onUnlock,
  onCancel,
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();

    if (password === ADMIN_ACCESS_PASSWORD) {
      setError("");
      onUnlock?.();
      return;
    }

    setError("Incorrect Admin password. Try again.");
    setPassword("");
  }

  return (
    <PageContainer className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-[#FC2C38]">
          <LockKeyhole className="h-8 w-8" aria-hidden="true" />
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            Restricted area
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {areaLabel} locked
          </h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Enter the {areaLabel} password to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-7">
          <label
            htmlFor="admin-access-password"
            className="text-xs font-black uppercase tracking-[0.14em] text-slate-600"
          >
            {areaLabel} password
          </label>

          <div className="relative mt-2">
            <input
              id="admin-access-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              autoComplete="current-password"
              autoFocus
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-4 pr-14 text-lg font-bold text-slate-950 outline-none transition focus:border-[#FC2C38] focus:bg-white focus:ring-4 focus:ring-red-100"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "admin-access-error" : undefined}
            />

            <button
              type="button"
              onClick={() => setShowPassword((currentValue) => !currentValue)}
              className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-slate-500 transition hover:text-slate-950"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Eye className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>

          {error ? (
            <p
              id="admin-access-error"
              className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="mt-5 w-full rounded-2xl bg-[#FC2C38] px-5 py-4 text-base font-black text-white shadow-md transition hover:bg-red-600 focus:outline-none focus:ring-4 focus:ring-red-200"
          >
            Unlock {areaLabel}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Dashboard
          </button>
        </form>
      </section>
    </PageContainer>
  );
}
