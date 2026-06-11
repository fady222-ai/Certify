import { authedFetch } from "./auth";

export type AdminOrg = {
  id: string;
  name: string;
  slug: string;
  owner_name: string | null;
  owner_email: string | null;
  plan: { slug: string; name: string; limit: number } | null;
  certs_this_month: number;
  certs_total: number;
  suspended: boolean;
  suspended_at: string | null;
  created_at: string;
};

export type AdminStats = {
  total_organizations: number;
  total_users: number;
  total_certificates: number;
  certificates_this_month: number;
  recent_organizations: AdminOrg[];
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? "تعذّر تنفيذ الطلب.");
  }
  return res.json() as Promise<T>;
}

export async function getAdminStats(): Promise<AdminStats> {
  return json(await authedFetch("admin/stats"));
}

export async function listAdminOrganizations(search?: string): Promise<{ data: AdminOrg[] }> {
  const q = search ? `?search=${encodeURIComponent(search)}` : "";
  return json(await authedFetch(`admin/organizations${q}`));
}

export async function adminChangePlan(orgId: string, slug: string): Promise<{ message: string }> {
  return json(
    await authedFetch(`admin/organizations/${orgId}/plan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    })
  );
}

export async function adminToggleSuspend(
  orgId: string
): Promise<{ message: string; organization: AdminOrg }> {
  return json(await authedFetch(`admin/organizations/${orgId}/suspend`, { method: "PATCH" }));
}
