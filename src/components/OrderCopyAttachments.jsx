import { useRef, useState } from "react";
import {
  ExternalLink,
  FileImage,
  FileText,
  LoaderCircle,
  Trash2,
  Upload,
} from "lucide-react";
import {
  deleteDispatchOrderCopyFile,
  uploadDispatchOrderCopyFiles,
} from "../utils/dispatchOrderCopyStorage";

function getDocumentKey(document) {
  return String(document?.path || document?.id || document?.url || "");
}

function isPdfDocument(document) {
  return (
    document?.type === "application/pdf" ||
    String(document?.name || "").toLowerCase().endsWith(".pdf")
  );
}

function getUploadError(error) {
  const code = String(error?.code || "");

  if (code.includes("storage/quota-exceeded")) {
    return "Firebase Storage is out of space. Increase the Storage plan or remove old files.";
  }

  if (code.includes("storage/unauthorized")) {
    return "You do not have permission to upload this Order Copy.";
  }

  return error?.message || "Unable to upload that Order Copy.";
}

/**
 * @param {{
 *   recordType: string;
 *   recordId: string;
 *   documents?: Array<Record<string, any>>;
 *   onChange: (documents: Array<Record<string, any>>) => Promise<void>;
 *   compact?: boolean;
 * }} props
 */
export default function OrderCopyAttachments({
  recordType,
  recordId,
  documents = [],
  onChange,
  compact = false,
}) {
  const inputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingKey, setDeletingKey] = useState("");
  const [error, setError] = useState("");
  const safeDocuments = Array.isArray(documents)
    ? documents.filter((document) => document?.url)
    : [];

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    if (safeDocuments.length + files.length > 8) {
      setError("Each PO can have up to 8 Order Copy files.");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const uploadedDocuments = await uploadDispatchOrderCopyFiles({
        recordType,
        recordId,
        files,
      });
      await onChange([...safeDocuments, ...uploadedDocuments]);
    } catch (uploadError) {
      console.error("Unable to upload Order Copy:", uploadError);
      setError(getUploadError(uploadError));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(document) {
    const documentName = document?.name || "this Order Copy";

    if (!window.confirm(`Delete ${documentName}?`)) {
      return;
    }

    const documentKey = getDocumentKey(document);
    const nextDocuments = safeDocuments.filter(
      (candidate) => getDocumentKey(candidate) !== documentKey,
    );
    setDeletingKey(documentKey);
    setError("");

    try {
      await onChange(nextDocuments);

      try {
        await deleteDispatchOrderCopyFile(document);
      } catch (storageDeleteError) {
        console.warn("Unable to remove Order Copy from Storage:", storageDeleteError);
      }
    } catch (deleteError) {
      console.error("Unable to delete Order Copy:", deleteError);
      setError("Unable to delete that Order Copy. Try again.");
    } finally {
      setDeletingKey("");
    }
  }

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white ${
        compact ? "p-2.5" : "p-3"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf,.pdf"
        multiple
        onChange={handleUpload}
        className="sr-only"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-700">
            Order Copy
          </p>
          {!compact ? (
            <p className="mt-0.5 text-[11px] font-bold text-slate-500">
              Photo or PDF · up to 15 MB
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isUploading ? (
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Upload aria-hidden="true" className="h-4 w-4" />
          )}
          {isUploading
            ? "Uploading"
            : safeDocuments.length > 0
              ? "Add Another"
              : "Upload"}
        </button>
      </div>

      {safeDocuments.length > 0 ? (
        <div className="mt-2 grid gap-1.5">
          {safeDocuments.map((document, index) => {
            const documentKey = getDocumentKey(document);
            const DocumentIcon = isPdfDocument(document)
              ? FileText
              : FileImage;

            return (
              <div
                key={documentKey || `${recordId}-order-copy-${index}`}
                className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2"
              >
                <DocumentIcon
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-blue-700"
                />
                <a
                  href={document.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 truncate text-xs font-black text-slate-700 hover:text-blue-700"
                  title={document.name || `Order Copy ${index + 1}`}
                >
                  {document.name || `Order Copy ${index + 1}`}
                </a>
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <button
                  type="button"
                  onClick={() => handleDelete(document)}
                  disabled={deletingKey === documentKey}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-red-600 transition hover:bg-red-50 disabled:text-slate-300"
                  aria-label={`Delete ${document.name || "Order Copy"}`}
                >
                  {deletingKey === documentKey ? (
                    <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs font-bold leading-5 text-red-700">{error}</p>
      ) : null}
    </div>
  );
}
