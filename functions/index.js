const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
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
