import { API_URL } from "./api";

export type WalletCert = {
  recipient_name: string;
  course_name: string | null;
  organization_name: string | null;
  verification_code: string;
  issue_date: string | null;
  verify_url: string;
  pdf_url: string | null;
};

export type Wallet = { email: string; certificates: WalletCert[] };

/** Request a magic link to the trainee's certificate wallet (always generic). */
export async function requestWalletLink(email: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/wallet/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message ?? "حدث خطأ ما.");
  }
}

/** Load a wallet by its capability token (from the emailed link). */
export async function getWallet(token: string): Promise<Wallet> {
  const res = await fetch(`${API_URL}/api/wallet/${encodeURIComponent(token)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message ?? "تعذر فتح المحفظة.");
  }
  return res.json() as Promise<Wallet>;
}
