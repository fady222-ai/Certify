"use client";

import { authedFetch } from "./auth";

export type DesignElement = {
  type: "text" | "variable" | "image" | "rect" | "line" | "qr" | "ornament";
  left: number;
  top: number;
  width?: number;
  height?: number;
  angle?: number;
  text?: string;
  variableKey?: string;
  fontSize?: number;
  fontWeight?: number | string;
  fill?: string;
  textAlign?: string;
  fontFamily?: string;
  stroke?: string;
  strokeWidth?: number;
  rx?: number;
  src?: string;
  // rect gradient fill
  gradient?: { from: string; to: string; angle?: number };
  // ornament element
  name?: string;
  color?: string;
  orientation?: string;
  // marks an injected logo image (customizer)
  role?: string;
};

export type DesignData = {
  width: number;
  height: number;
  background: string;
  elements: DesignElement[];
};

export type Template = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  orientation?: string;
  is_public?: boolean;
  design_data: DesignData | null;
  updated_at?: string;
};

export async function listTemplates(): Promise<Template[]> {
  const res = await authedFetch("templates");
  const data = await res.json();
  return data.data ?? [];
}

export async function getTemplate(id: string): Promise<Template> {
  const res = await authedFetch(`templates/${id}`);
  if (!res.ok) throw new Error("تعذّر تحميل القالب.");
  return res.json();
}

export async function createTemplate(input: {
  name: string;
  designData: DesignData;
}): Promise<Template> {
  const res = await authedFetch("templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذّر حفظ القالب.");
  return data;
}

export async function updateTemplate(
  id: string,
  input: { name: string; designData: DesignData },
): Promise<Template> {
  const res = await authedFetch(`templates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "تعذّر تحديث القالب.");
  return data;
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await authedFetch(`templates/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("تعذّر حذف القالب.");
}

export const VARIABLE_OPTIONS: { key: string; label: string }[] = [
  { key: "recipient_name", label: "اسم المتدرب" },
  { key: "course_name", label: "اسم الدورة" },
  { key: "issue_date", label: "تاريخ الإصدار" },
  { key: "org_name", label: "اسم المنظمة" },
  { key: "verification_code", label: "رمز التحقق" },
];

export function variableLabel(key?: string) {
  return VARIABLE_OPTIONS.find((v) => v.key === key)?.label ?? key ?? "";
}
