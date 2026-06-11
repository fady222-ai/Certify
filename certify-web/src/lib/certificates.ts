"use client";

import { authedFetch } from "./auth";

export type CertEvent = { type: string; at: string };

export type CertificateDetail = {
  id: string;
  recipient_name: string;
  recipient_email: string | null;
  course_name: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
  verification_code: string;
  pdf_url: string | null;
  opened_count: number;
  downloaded_count: number;
  shared_count: number;
  linkedin_added: boolean;
  revoked_at: string | null;
  revoked_reason: string | null;
  template: { id: string; name: string } | null;
  created_at: string;
  events: CertEvent[];
};

export async function getCertificate(id: string): Promise<CertificateDetail> {
  const res = await authedFetch(`certificates/${id}`);
  if (!res.ok) throw new Error("الشهادة غير موجودة.");
  return res.json();
}

export async function revokeCertificate(id: string, reason: string) {
  const res = await authedFetch(`certificates/${id}/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذّر الإلغاء.");
  return data;
}

export async function resendCertificateEmail(id: string) {
  const res = await authedFetch(`certificates/${id}/resend-email`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذّر الإرسال.");
  return data as { message: string; transport: string };
}

const EVENT_LABELS: Record<string, string> = {
  issued: "تم الإصدار",
  opened: "فُتحت صفحة التحقق",
  downloaded: "تم تحميل الشهادة",
  shared: "تمت مشاركة الرابط",
  added_to_linkedin: "أُضيفت إلى لينكدإن",
  emailed: "أُرسل البريد",
  revoked: "أُلغيت الشهادة",
};

export function eventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type;
}
