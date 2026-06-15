"use client";

import { authedFetch } from "./auth";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  primary_color: string;
  secondary_color: string | null;
  logo_url: string | null;
  signature_url: string | null;
  verify_domain: string | null;
  default_template_id: string | null;
};

export async function getOrganization(): Promise<Organization> {
  const res = await authedFetch("organization");
  if (!res.ok) throw new Error("تعذّر تحميل بيانات المنظمة.");
  return res.json();
}

export async function updateOrganization(input: {
  primaryColor?: string;
  secondaryColor?: string;
}): Promise<Organization> {
  const res = await authedFetch("organization", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذّر الحفظ.");
  return data;
}

export async function setDefaultTemplate(
  templateId: string | null,
): Promise<Organization> {
  const res = await authedFetch("organization/default-template", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذّر تعيين القالب.");
  return data;
}

export async function uploadBranding(
  kind: "logo" | "signature",
  file: File,
): Promise<Organization> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await authedFetch(`organization/branding/${kind}`, { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذّر رفع الصورة.");
  return data;
}

export async function deleteBranding(kind: "logo" | "signature"): Promise<Organization> {
  const res = await authedFetch(`organization/branding/${kind}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذّر الحذف.");
  return data;
}
