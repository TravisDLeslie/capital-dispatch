export function getFirebaseErrorMessage(error) {
  const errorCode = error?.code || "";
  const errorMessage = error?.message || "";

  if (errorCode === "permission-denied") {
    return "Firebase denied access. Publish Firestore rules that allow this app to access check-ins, yard tasks, supplier runs, South route orders, deliveries, customers, sales orders, email list entries, sales reports, stocking handbook items, and vendor settings.";
  }

  if (errorCode === "failed-precondition") {
    return "Firestore is not ready for this request. Make sure the Firestore database has been created in Firebase Console.";
  }

  if (errorCode === "not-found") {
    return "Firestore could not find the database. Create the Firestore database in Firebase Console for this project.";
  }

  if (errorCode === "unavailable") {
    return "Firebase is temporarily unavailable or this browser cannot reach it. Check the internet connection and try again.";
  }

  if (errorCode === "unauthenticated") {
    return "Firebase requires sign-in for this action. Update Firestore rules or add authentication.";
  }

  return errorMessage
    ? `Firebase error: ${errorMessage}`
    : "Unable to reach Firebase. Check the Firebase project, Firestore database, and rules.";
}
