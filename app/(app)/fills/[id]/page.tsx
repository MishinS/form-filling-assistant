"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function FillDetailPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/fills"); }, [router]);
  return null;
}
