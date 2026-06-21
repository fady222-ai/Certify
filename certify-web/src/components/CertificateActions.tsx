"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api";
import { whatsappShareUrl, twitterShareUrl, shareText } from "@/lib/share";
import { IconQr, IconLinkedin, IconWhatsapp, IconX, IconCopy, IconCheck } from "@/components/icons";

type Props = {
  code: string;
  pdfUrl: string | null;
  courseName: string | null;
  orgName: string | null;
  recipientName?: string | null;
  issueDate: string | null; // YYYY-MM-DD
  expiryDate: string | null; // YYYY-MM-DD
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
  const { code, pdfUrl, courseName, orgName, recipientName } = props;
  const [copied, setCopied] = useState(false);

  const verifyHref =
    typeof window !== "undefined" ? `${window.location.origin}/verify/${code}` : `/verify/${code}`;
  const text = shareText({ recipientName, courseName, orgName });

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(verifyHref);
      setCopied(true);
      track(code, "shared");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <div className="mt-7">
      <div className="flex flex-wrap gap-3">
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
      </div>

      {/* مشاركة الشهادة */}
      <div className="mt-4 border-t pt-4">
        <p className="mb-2 text-xs font-bold text-ink-muted">شارك الشهادة</p>
        <div className="flex flex-wrap gap-2">
          <a
            href={whatsappShareUrl({ text, url: verifyHref })}
            target="_blank"
            rel="noreferrer"
            onClick={() => track(code, "shared")}
            className="btn-ghost"
          >
            <IconWhatsapp className="h-4 w-4 text-[#25d366]" />
            واتساب
          </a>
          <a
            href={twitterShareUrl({ text, url: verifyHref })}
            target="_blank"
            rel="noreferrer"
            onClick={() => track(code, "shared")}
            className="btn-ghost"
          >
            <IconX className="h-4 w-4" />
            X
          </a>
          <button onClick={copyLink} className="btn-ghost">
            {copied ? (
              <>
                <IconCheck className="h-4 w-4 text-verify-600" />
                تم النسخ
              </>
            ) : (
              <>
                <IconCopy className="h-4 w-4" />
                نسخ الرابط
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
