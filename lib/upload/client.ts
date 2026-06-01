"use client";
import { upload } from "@vercel/blob/client";

export type UploadStatus = "uploading" | "ok" | "error";

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
    contentType: file.type,
    onUploadProgress: (e) => onProgress(e.percentage),
  });
  return { url: res.url };
}
