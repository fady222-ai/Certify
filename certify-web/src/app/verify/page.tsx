"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { IconShield, IconArrow } from "@/components/icons";

// Accept a raw code or a full pasted verification URL and return the code.
function extractCode(input: string): string {
  const s = input.trim();
  const m = s.match(/\/verify\/([^/?#\s]+)/i);
  return (m ? m[1] : s).trim().toUpperCase();
}

export default function VerifyEntryPage() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = extractCode(value);
    if (!code) return;
    router.push(`/verify/${encodeURIComponent(code)}`);
  }

  return (
    <>
      <SiteHeader />
      <main className="mesh-bg flex-1">
        <div className="absolute inset-0 dot-grid opacity-50" />
        <div className="relative mx-auto max-w-xl px-5 py-16 lg:py-24">
          <div className="mx-auto mb-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <IconShield className="h-8 w-8" />
            </div>
            <h1 className="mt-5 font-display text-3xl font-black text-ink">التحقّق من شهادة</h1>
            <p className="mt-3 text-sm text-ink-soft">
              أدخل رمز التحقّق المطبوع على الشهادة (أو الصق رابط الشهادة كاملاً) للتأكد من صحتها.
            </p>
          </div>

          <form onSubmit={onSubmit} className="card p-6">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-ink">رمز التحقّق</span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="مثال: CERT-AB12-CD34"
                className="input font-mono"
                dir="ltr"
                autoFocus
              />
            </label>
            <button type="submit" disabled={!value.trim()} className="btn-primary mt-4 w-full disabled:opacity-60">
              <IconShield className="h-4 w-4" />
              تحقّق الآن
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-ink-muted">
            لمعاينة شكل النتيجة، {" "}
            <Link href="/verify/CERT-SMOK-0001" className="font-bold text-brand-700 hover:underline">
              جرّب رمزاً تجريبياً
            </Link>
          </p>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-ink-muted">
            <IconArrow className="h-4 w-4" />
            <Link href="/" className="hover:text-brand-700">العودة للرئيسية</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
