"use client";

import { API_URL } from "@/lib/api";
import { IconQr, IconLinkedin, IconBadge } from "@/components/icons";

type Props = {
  code: string;
  pdfUrl: string | null;
  courseName: string | null;
  orgName: string | null;
  issueDate: string | null; // YYYY-MM-DD
  expiryDate: string | null; // YYYY-MM-DD
  /** Whether to surface the verifiable-credential (Open Badge) download. */
  openBadge?: boolean;
};

/** Fire-and-forget tracking ping (download / share / LinkedIn add). */
function track(code: string, type: "downloaded" | "shared" | "added_to_linkedin") {
  const url = `${API_URL}/api/verify/${encodeURIComponent(code)}/track`;
  const body = JSON.stringify({ type });
  // Prefer sendBeacon so the request survives a same-tab navigation.
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
  } else {
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }
}

/**
 * Build a LinkedIn "Add to Profile" certification URL.
 * https://addtoprofile.linkedin.com / profile/add?startTask=CERTIFICATION_NAME
 */
function linkedinUrl({ code, courseName, orgName, issueDate, expiryDate }: Props): string {
  const verifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${code}`
      : `/verify/${code}`;

  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: courseName?.trim() || "شهادة معتمدة",
    organizationName: orgName?.trim() || "Certify",
    certUrl: verifyUrl,
    certId: code,
  });

  if (issueDate) {
    const [y, m] = issueDate.split("-");
    if (y) params.set("issueYear", y);
    if (m) params.set("issueMonth", String(parseInt(m, 10)));
  }
  if (expiryDate) {
    const [y, m] = expiryDate.split("-");
    if (y) params.set("expirationYear", y);
    if (m) params.set("expirationMonth", String(parseInt(m, 10)));
  }

  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

export function CertificateActions(props: Props) {
  const { code, pdfUrl, openBadge } = props;
  const credentialPage = `/verify/${encodeURIComponent(code)}/credential`;

  return (
    <div className="mt-7 flex flex-wrap gap-3">
      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => track(code, "downloaded")}
          className="btn-primary"
        >
          <IconQr className="h-4 w-4" />
          عرض الشهادة (PDF)
        </a>
      )}
      <a
        href={linkedinUrl(props)}
        target="_blank"
        rel="noreferrer"
        onClick={() => track(code, "added_to_linkedin")}
        className="btn-ghost"
      >
        <IconLinkedin className="h-4 w-4 text-[#0a66c2]" />
        إضافة إلى لينكدإن
      </a>
      {openBadge && (
        <a
          href={credentialPage}
          className="btn-ghost"
          title="شهادة رقمية موثّقة متوافقة مع معيار Open Badges 3.0"
        >
          <IconBadge className="h-4 w-4 text-brand-600" />
          الشهادة الرقمية الموثّقة
        </a>
      )}
    </div>
  );
}
