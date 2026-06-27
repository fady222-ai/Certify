import { authedFetch } from "./auth";

export type WaField = {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  set: boolean;
  preview: string | null;
};

export type WaConfig = {
  platform_enabled: boolean;
  plan_allowed?: boolean;
  enabled: boolean;
  available: boolean;
  fields: WaField[];
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? "تعذر تنفيذ الطلب.");
  }
  return res.json() as Promise<T>;
}

// ── Platform admin ───────────────────────────────────────────────────────────
export async function getAdminWhatsapp(): Promise<{ enabled: boolean }> {
  return json(await authedFetch("admin/whatsapp"));
}

export async function setAdminWhatsapp(enabled: boolean): Promise<{ enabled: boolean; message?: string }> {
  return json(
    await authedFetch("admin/whatsapp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
  );
}

// ── Organization owner ───────────────────────────────────────────────────────
export async function getWhatsapp(): Promise<WaConfig> {
  return json(await authedFetch("whatsapp"));
}

export async function updateWhatsapp(payload: {
  enabled?: boolean;
  fields?: Record<string, string>;
}): Promise<{ message: string; config: WaConfig }> {
  return json(
    await authedFetch("whatsapp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}
