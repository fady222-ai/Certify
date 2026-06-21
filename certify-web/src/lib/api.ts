export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export type VerificationResult = {
  found: boolean;
  valid?: boolean;
  integrity?: boolean;
  status?: string;
  message?: string;
  certificate?: {
    recipient_name: string;
    course_name: string | null;
    issue_date: string | null;
    issue_date_label: string | null;
    expiry_date: string | null;
    verification_code: string;
    pdf_url: string | null;
    organization: {
      name: string | null;
      logo_url: string | null;
      primary_color: string;
    };
  };
};

export async function verifyCertificate(
  code: string,
): Promise<VerificationResult> {
  try {
    const res = await fetch(`${API_URL}/api/verify/${encodeURIComponent(code)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (res.status === 404) {
      const body = await res.json().catch(() => ({}));
      return { found: false, message: body.message };
    }
    if (!res.ok) {
      return { found: false, message: "تعذر الاتصال بخدمة التحقق." };
    }
    return (await res.json()) as VerificationResult;
  } catch {
    return { found: false, message: "تعذر الاتصال بخدمة التحقق." };
  }
}

/** A minimal view of the Open Badges 3.0 credential JSON-LD we render. */
export type OpenBadgeCredential = {
  "@context": string[];
  id: string;
  type: string[];
  name?: string;
  issuer: { id: string; name?: string; image?: { id: string } };
  validFrom?: string;
  validUntil?: string;
  credentialSubject: {
    name?: string;
    achievement?: { name?: string; description?: string };
  };
};

export type CredentialResult =
  | { ok: true; credential: OpenBadgeCredential; jwt: string }
  | { ok: false; status: "not_found" | "revoked" | "error"; message?: string };

/** Fetch the signed Open Badges 3.0 credential for a certificate (public). */
export async function getCredential(code: string): Promise<CredentialResult> {
  try {
    const res = await fetch(
      `${API_URL}/api/verify/${encodeURIComponent(code)}/openbadge`,
      { cache: "no-store", headers: { Accept: "application/json" } },
    );
    if (res.ok) {
      const body = (await res.json()) as { credential: OpenBadgeCredential; jwt: string };
      return { ok: true, ...body };
    }
    const body = await res.json().catch(() => ({}));
    if (res.status === 404) return { ok: false, status: "not_found", message: body.message };
    if (res.status === 409) return { ok: false, status: "revoked", message: body.message };
    return { ok: false, status: "error", message: body.message };
  } catch {
    return { ok: false, status: "error", message: "تعذر الاتصال بخدمة التحقق." };
  }
}
