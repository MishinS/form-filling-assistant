"use client";
import { upload } from "@vercel/blob/client";
import { MIME } from "@/lib/parse/types";

export type UploadStatus = "uploading" | "ok" | "error";

/**
 * Resolve a usable MIME type for a picked file. Browsers (notably on Linux / via
 * drag-drop) sometimes report an empty `file.type` for OOXML files, which would
 * get the upload rejected by the Blob route's allowedContentTypes. Fall back to
 * the extension for the three accepted formats.
 */
export function inferMime(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return MIME.pdf;
  if (ext === "xlsx") return MIME.xlsx;
  if (ext === "docx") return MIME.docx;
  return file.type; // unknown extension → let the Blob route reject it
}

export interface UploadFile {
  fileId: string;
  name: string;
  mime: string;
  size: string;
  blobUrl: string;
  pages: number;        // filled after parse
  scanned: boolean;     // filled after parse
  status: UploadStatus;
  progress: number;     // 0..100
  error?: string;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export async function uploadToBlob(
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ url: string }> {
  const res = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/blob/upload",
    contentType: inferMime(file),
    onUploadProgress: (e) => onProgress(e.percentage),
  });
  return { url: res.url };
}
