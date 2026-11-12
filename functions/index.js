const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { defineSecret, defineString } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const { Resend } = require("resend");

initializeApp();

const resendApiKey = defineSecret("RESEND_API_KEY");
const supplierChatFromEmail = defineString("SUPPLIER_CHAT_FROM_EMAIL", {
  default: "Capital Lumber <supplier-chat@mail.capitallumber.co>",
  description: "Verified Resend sender used for supplier invitations.",
});
const appBaseUrl = defineString("APP_BASE_URL", {
  default: "https://dispatch.capitallumber.co",
  description: "Public Capital Lumber app URL.",
});

const BOOTSTRAP_SUPER_ADMIN_EMAIL = "travis@capitallumber.co";

function normalizedEmail(value) {
  return String(value || "").trim().toLowerCase();
}

exports.claimSupplierInvitation = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Sign in with the Google account that received this invitation.",
      );
    }

    const invitationId = String(request.data?.invitationId || "").trim();
    const userId = request.auth.uid;
    const signedInEmail = normalizedEmail(request.auth.token.email);

    if (!invitationId) {
      throw new HttpsError("invalid-argument", "The supplier invitation is missing.");
    }
    if (!signedInEmail) {
      throw new HttpsError(
        "failed-precondition",
        "The signed-in Google account does not have an email address.",
      );
    }

    const firestore = getFirestore();
    const invitationRef = firestore.doc(`supplierInvitations/${invitationId}`);
    const userRef = firestore.doc(`users/${userId}`);

    return firestore.runTransaction(async (transaction) => {
      const invitationSnapshot = await transaction.get(invitationRef);
      if (!invitationSnapshot.exists) {
        throw new HttpsError("not-found", "This supplier invitation no longer exists.");
      }

      const invitation = invitationSnapshot.data() || {};
      const invitationEmail = normalizedEmail(invitation.email);
      const invitationStatus = String(invitation.status || "pending");
      const isExistingClaim =
        invitationStatus === "claimed" && invitation.claimedBy === userId;

      if (invitationEmail !== signedInEmail) {
        throw new HttpsError(
          "permission-denied",
          `This invitation belongs to ${invitationEmail || "another email address"}. Sign in with that Google account.`,
        );
      }
      if (invitationStatus !== "pending" && !isExistingClaim) {
        throw new HttpsError(
          "failed-precondition",
          invitationStatus === "canceled"
            ? "This supplier invitation was canceled."
            : "This supplier invitation has already been used.",
        );
      }
      if (!invitation.vendorId || !invitation.vendorName) {
        throw new HttpsError(
          "failed-precondition",
          "This invitation is missing its vendor assignment. Ask Capital Lumber to create a new invitation.",
        );
      }

      const userSnapshot = await transaction.get(userRef);
      const existingProfile = userSnapshot.data() || {};
      const existingRole = String(existingProfile.role || "").trim();
      if (existingRole && !["pending", "supplier"].includes(existingRole)) {
        throw new HttpsError(
          "failed-precondition",
          "This Google account is already assigned to a Capital Lumber employee profile.",
        );
      }

      const now = FieldValue.serverTimestamp();
      const displayName =
        String(existingProfile.displayName || "").trim() ||
        String(invitation.contactName || "").trim() ||
        String(request.auth.token.name || "").trim();
      const profile = {
        uid: userId,
        email: signedInEmail,
        displayName,
        photoURL:
          String(existingProfile.photoURL || "").trim() ||
          String(request.auth.token.picture || "").trim(),
        role: "supplier",
        status: existingProfile.status === "approved" ? "approved" : "pending",
        workView: "supplier",
        employeeActive: false,
        driverName: "",
        vendorId: invitation.vendorId,
        vendorName: invitation.vendorName,
        permissions: ["supplier-chat"],
        supplierInvitationId: invitationId,
        supplierInvitedBy: invitation.createdBy || "",
        supplierInvitationClaimedAt: now,
        lastLoginAt: now,
        updatedAt: now,
      };
      if (!userSnapshot.exists) profile.createdAt = now;

      transaction.set(userRef, profile, { merge: true });
      if (!isExistingClaim) {
        transaction.update(invitationRef, {
          status: "claimed",
          claimedBy: userId,
          claimedAt: now,
          updatedAt: now,
        });
      }

      return {
        role: "supplier",
        status: profile.status,
        workView: "supplier",
        vendorId: invitation.vendorId,
        vendorName: invitation.vendorName,
      };
    });
  },
);

exports.diagnoseSupplierChatAccess = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before checking Supplier Chat.");
    }

    const firestore = getFirestore();
    const userId = request.auth.uid;
    const email = normalizedEmail(request.auth.token.email);
    const userSnapshot = await firestore.doc(`users/${userId}`).get();

    if (!userSnapshot.exists) {
      return {
        code: "SC-PROFILE-001",
        title: "Supplier profile is missing",
        message: "User Access does not contain a profile for this Google account.",
        action: "Ask an administrator to have the supplier reopen the original invitation link.",
        userId,
        email,
      };
    }

    const profile = userSnapshot.data() || {};
    const role = String(profile.role || "").trim();
    const status = String(profile.status || "").trim();
    const vendorId = String(profile.vendorId || "").trim();
    const vendorName = String(profile.vendorName || "").trim();
    const baseResult = {
      userId,
      email,
      role,
      status,
      workView: String(profile.workView || "").trim(),
      vendorId,
      vendorName,
    };

    if (role !== "supplier") {
      return {
        ...baseResult,
        code: "SC-PROFILE-002",
        title: "Account role is not Supplier",
        message: `User Access currently lists this account as ${role || "no role"}.`,
        action: "Set the role to Supplier; the Supplier work view and chat-only permission should follow automatically.",
      };
    }
    if (status !== "approved") {
      return {
        ...baseResult,
        code: "SC-PROFILE-003",
        title: "Supplier account is not approved",
        message: `User Access currently shows ${status || "no approval status"}.`,
        action: "Approve this supplier in User Access.",
      };
    }
    if (!vendorId) {
      return {
        ...baseResult,
        code: "SC-PROFILE-004",
        title: "Vendor assignment is missing",
        message: "The supplier profile is approved but has no vendor ID.",
        action: "Choose the supplier's vendor in User Access and save the profile.",
      };
    }

    const assignedSnapshot = await firestore
      .collection("supplierConversations")
      .where("supplierParticipantUids", "array-contains", userId)
      .get();
    const emailSnapshot = email
      ? await firestore
          .collection("supplierConversations")
          .where("supplierContactEmail", "==", email)
          .get()
      : { docs: [] };
    const matchingVendorCount = assignedSnapshot.docs.filter(
      (document) => String(document.data()?.vendorId || "") === vendorId,
    ).length;
    const authorizedConversationIds = assignedSnapshot.docs
      .filter(
        (document) => String(document.data()?.vendorId || "") === vendorId,
      )
      .map((document) => document.id);
    const counts = {
      assignedConversationCount: assignedSnapshot.size,
      matchingVendorConversationCount: matchingVendorCount,
      emailConversationCount: emailSnapshot.docs.length,
    };

    if (
      assignedSnapshot.empty &&
      emailSnapshot.docs.length === 0 &&
      request.data?.createIfMissing === true
    ) {
      const authenticationTime = Number(request.auth.token.auth_time || 0);
      const currentTime = Math.floor(Date.now() / 1000);
      if (
        !Number.isFinite(authenticationTime) ||
        authenticationTime <= 0 ||
        authenticationTime > currentTime + 60 ||
        currentTime - authenticationTime >= 30 * 60
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Unlock Supplier Chat again before starting a conversation.",
        );
      }

      const displayName =
        String(profile.displayName || "").trim() ||
        String(request.auth.token.name || "").trim() ||
        email ||
        "Supplier contact";
      const conversationRef = firestore.collection("supplierConversations").doc();
      const now = FieldValue.serverTimestamp();
      await conversationRef.set({
        vendorId,
        vendorName,
        title: `${vendorName} pricing`,
        participantUids: [userId],
        internalParticipantUids: [],
        supplierParticipantUids: [userId],
        supplierContactName: displayName,
        supplierContactEmail: email,
        active: true,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
      });

      logger.info("Supplier started conversation", {
        conversationId: conversationRef.id,
        supplierUserId: userId,
        vendorId,
      });
      return {
        ...baseResult,
        assignedConversationCount: 1,
        matchingVendorConversationCount: 1,
        emailConversationCount: 1,
        authorizedConversationIds: [conversationRef.id],
        conversationId: conversationRef.id,
        created: true,
        code: "SC-ACCESS-002",
        title: "Conversation started",
        message: "The supplier conversation is ready.",
        action: "Send the first message to Capital Lumber.",
      };
    }

    if (assignedSnapshot.empty && emailSnapshot.docs.length > 0) {
      return {
        ...baseResult,
        ...counts,
        code: "SC-ASSIGNMENT-001",
        title: "Conversation is linked to an old account",
        message: "A conversation uses this email, but its supplier user ID does not match the current Google account.",
        action: "Open the conversation as an administrator and use Edit supplier access to assign this supplier account.",
      };
    }
    if (assignedSnapshot.empty) {
      return {
        ...baseResult,
        ...counts,
        code: "SC-ASSIGNMENT-002",
        title: "No conversation is assigned",
        message: "The supplier profile is valid, but no conversation includes this supplier account.",
        action: "Create a conversation or edit an existing conversation and assign this supplier contact.",
      };
    }
    if (matchingVendorCount === 0) {
      return {
        ...baseResult,
        ...counts,
        code: "SC-ASSIGNMENT-003",
        title: "Conversation vendor does not match",
        message: "The supplier is assigned to a conversation, but its vendor ID differs from User Access.",
        action: "Make the conversation vendor and the supplier's User Access vendor match.",
      };
    }

    return {
      ...baseResult,
      ...counts,
      authorizedConversationIds,
      code: "SC-ACCESS-001",
      title: "Profile and assignment are valid",
      message: "The supplier profile, vendor, and conversation assignment all match. Firestore rules or the refreshed Google session rejected the browser request.",
      action: "Deploy the latest Firestore rules, then sign out, sign back in, and unlock Supplier Chat again.",
    };
  },
);

exports.processSupplierAccountDeletion = onDocumentCreated(
  {
    document: "supplierAccountDeletionRequests/{requestId}",
    region: "us-central1",
    retry: false,
  },
  async (event) => {
    const requestSnapshot = event.data;
    if (!requestSnapshot) return;

    const deletionRequest = requestSnapshot.data() || {};
    const supplierUserId = String(deletionRequest.targetUserId || "").trim();
    const createdBy = String(deletionRequest.createdBy || "").trim();
    const firestore = getFirestore();

    try {
      if (!supplierUserId || !createdBy || supplierUserId === createdBy) {
        throw new Error("The supplier deletion request is invalid.");
      }

      const callerSnapshot = await firestore.doc(`users/${createdBy}`).get();
      const callerProfile = callerSnapshot.data() || {};
      const callerEmail = normalizedEmail(callerProfile.email);
      const isSuperAdmin =
        callerProfile.role === "superAdmin" ||
        callerEmail === BOOTSTRAP_SUPER_ADMIN_EMAIL;
      if (callerProfile.status !== "approved" || !isSuperAdmin) {
        throw new Error(
          "Only an approved super administrator can delete supplier accounts.",
        );
      }

      const supplierRef = firestore.doc(`users/${supplierUserId}`);
      const supplierSnapshot = await supplierRef.get();
      if (!supplierSnapshot.exists) {
        throw new Error("That supplier account no longer exists.");
      }

      const supplierProfile = supplierSnapshot.data() || {};
      if (supplierProfile.role !== "supplier") {
        throw new Error(
          "Only supplier portal accounts can be deleted with this action.",
        );
      }

      await requestSnapshot.ref.update({
        status: "processing",
        updatedAt: FieldValue.serverTimestamp(),
      });

      const conversationsSnapshot = await firestore
        .collection("supplierConversations")
        .where("supplierParticipantUids", "array-contains", supplierUserId)
        .get();
      for (const conversationDocument of conversationsSnapshot.docs) {
        await firestore.recursiveDelete(conversationDocument.ref);
      }

      const supplierEmail = normalizedEmail(supplierProfile.email);
      let deletedInvitations = 0;
      if (supplierEmail) {
        const invitationsSnapshot = await firestore
          .collection("supplierInvitations")
          .where("email", "==", supplierEmail)
          .get();
        for (const invitationDocument of invitationsSnapshot.docs) {
          await invitationDocument.ref.delete();
          deletedInvitations += 1;
        }
      }

      try {
        await getAuth().deleteUser(supplierUserId);
      } catch (error) {
        if (error?.code !== "auth/user-not-found") throw error;
      }

      await supplierRef.delete();
      await requestSnapshot.ref.update({
        status: "completed",
        deletedConversations: conversationsSnapshot.size,
        deletedInvitations,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info("Supplier account deleted", {
        supplierUserId,
        deletedConversations: conversationsSnapshot.size,
        deletedInvitations,
        deletedBy: createdBy,
      });
    } catch (error) {
      logger.error("Unable to delete supplier account", {
        supplierUserId,
        createdBy,
        error: error?.message || String(error),
      });
      await requestSnapshot.ref.update({
        status: "failed",
        error: String(
          error?.message || "The supplier account could not be deleted.",
        ).slice(0, 500),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  },
);

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function invitationEmail({ contactName, vendorName, invitationUrl }) {
  const safeContactName = escapeHtml(contactName || "there");
  const safeVendorName = escapeHtml(vendorName || "your company");
  const safeInvitationUrl = escapeHtml(invitationUrl);

  return `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:620px;margin:0 auto;padding:32px 18px;">
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:32px;">
            <p style="margin:0 0 10px;color:#fc2c38;font-size:12px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;">Capital Lumber Supplier Chat</p>
            <h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;">You're invited to a secure supplier conversation</h1>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi ${safeContactName},</p>
            <p style="margin:0 0 22px;font-size:16px;line-height:1.6;">Capital Lumber invited you to discuss pricing, availability, and product details for <strong>${safeVendorName}</strong>.</p>
            <a href="${safeInvitationUrl}" style="display:inline-block;border-radius:12px;background:#fc2c38;color:#ffffff;padding:14px 22px;text-decoration:none;font-weight:800;">Open Capital Lumber</a>
            <div style="margin-top:24px;border-radius:12px;background:#f1f5f9;padding:16px;font-size:14px;line-height:1.6;color:#475569;">
              Sign in with the Google account that received this invitation. Capital Lumber must approve the account before supplier messages or pricing become visible.
            </div>
            <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">If you were not expecting this invitation, you can ignore this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

exports.sendSupplierInvitation = onDocumentCreated(
  {
    document: "supplierInvitations/{invitationId}",
    region: "us-central1",
    secrets: [resendApiKey],
    retry: false,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const invitation = snapshot.data();
    const invitationId = event.params.invitationId;
    const email = String(invitation.email || "").trim().toLowerCase();

    const currentSnapshot = await snapshot.ref.get();
    if (!currentSnapshot.exists || currentSnapshot.data()?.status !== "pending") {
      logger.info("Skipping a canceled supplier invitation", { invitationId });
      return;
    }

    if (!email || !email.includes("@")) {
      await snapshot.ref.update({
        emailStatus: "failed",
        emailError: "Invitation email address is invalid.",
        emailLastAttemptAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    await snapshot.ref.update({
      emailStatus: "sending",
      emailError: FieldValue.delete(),
      emailLastAttemptAt: FieldValue.serverTimestamp(),
    });

    const invitationUrl = new URL(appBaseUrl.value());
    invitationUrl.searchParams.set("supplierInvite", invitationId);
    const resend = new Resend(resendApiKey.value());

    try {
      const { data, error } = await resend.emails.send(
        {
          from: supplierChatFromEmail.value(),
          to: [email],
          subject: `${invitation.vendorName || "Supplier"} invitation from Capital Lumber`,
          html: invitationEmail({
            contactName: invitation.contactName,
            vendorName: invitation.vendorName,
            invitationUrl: invitationUrl.toString(),
          }),
        },
        { idempotencyKey: `supplier-invitation/${invitationId}` },
      );

      if (error) throw new Error(error.message || "Resend rejected the email.");

      await snapshot.ref.update({
        emailStatus: "sent",
        emailProvider: "resend",
        emailProviderId: data?.id || "",
        emailSentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      logger.error("Unable to send supplier invitation", {
        invitationId,
        error: error?.message || String(error),
      });
      await snapshot.ref.update({
        emailStatus: "failed",
        emailError: String(error?.message || "Unable to send invitation.").slice(0, 500),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  },
);
