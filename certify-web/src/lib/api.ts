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
