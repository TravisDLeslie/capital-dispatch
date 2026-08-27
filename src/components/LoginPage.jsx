import { useState } from "react";
import { LogIn } from "lucide-react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import capitalLumberLogo from "../assets/capital-lumber-new.svg";
import { auth, isFirebaseConfigured } from "../utils/firebase";

function getLoginErrorMessage(error) {
  const errorCode = error?.code || "";

  if (errorCode === "auth/operation-not-allowed") {
    return "Google sign-in is not enabled in Firebase Authentication yet.";
  }

  if (errorCode === "auth/unauthorized-domain") {
    return "This domain is not allowed in Firebase Authentication. Add this app domain under Authentication > Settings > Authorized domains.";
  }

  if (errorCode === "auth/account-exists-with-different-credential") {
    return "That Google email is already connected to another login method.";
  }

  if (errorCode === "auth/popup-closed-by-user") {
    return "Google sign-in was closed before it finished.";
  }

  if (errorCode === "auth/popup-blocked") {
    return "The browser blocked the Google sign-in window. Allow pop-ups and try again.";
  }

  if (errorCode === "auth/network-request-failed") {
    return "Unable to reach Firebase. Check the internet connection and try again.";
  }

  return `Unable to sign in with Google. Firebase error: ${
    errorCode || "unknown"
  }`;
}

export default function LoginPage() {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleGoogleSignIn() {
    if (!auth) {
      setError("Firebase Auth is not configured yet.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const provider = new GoogleAuthProvider();

      await signInWithPopup(auth, provider);
    } catch (loginError) {
      console.error("Unable to sign in with Google:", loginError);

      if (loginError?.code === "auth/popup-blocked") {
        await signInWithRedirect(auth, provider);
        return;
      }

      setError(getLoginErrorMessage(loginError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <img
          src={capitalLumberLogo}
          alt="Capital Lumber Co."
          className="mx-auto h-auto w-52 max-w-full"
        />

        <div className="mt-8 text-center">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#FC2C38]">
            Capital Dispatch
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            Login
          </h1>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            Sign in with Google to view receiving, South runs, and
            deliveries.
          </p>
        </div>

        {!isFirebaseConfigured ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Firebase is not configured yet. Add your Vite Firebase
            environment values before using login.
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting || !isFirebaseConfigured}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-[#FC2C38] px-5 py-4 text-base font-black text-white shadow-md transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <LogIn className="h-5 w-5" aria-hidden="true" />
          {isSubmitting ? "Signing in..." : "Continue with Google"}
        </button>
      </section>
    </main>
  );
}
