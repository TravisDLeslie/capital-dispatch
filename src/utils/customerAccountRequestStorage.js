import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export async function submitCustomerAccountRequest(accountRequest) {
  if (!functions) {
    throw new Error(
      "Customer account setup is temporarily unavailable. Please call 208-343-5481.",
    );
  }

  const submitRequest = httpsCallable(
    functions,
    "submitCustomerAccountRequest",
  );
  const response = await submitRequest(accountRequest);

  return response.data;
}

export async function verifyCustomerPortalEmail() {
  if (!functions) {
    throw new Error(
      "Customer account verification is temporarily unavailable. Please call 208-343-5481.",
    );
  }

  const verifyEmail = httpsCallable(functions, "verifyCustomerPortalEmail");
  const response = await verifyEmail();

  return response.data;
}
