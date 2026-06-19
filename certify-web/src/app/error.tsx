"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the error in the console for debugging; production reporting is
    // handled server-side. Avoid leaking details to the UI.
    console.error(error);
  }, [error]);

  return (
    <main className="mesh-bg flex flex-1 items-center justify-center px-5 py-24" dir="rtl">
      <div className="relative mx-auto max-w-md text-center">
        <h1 className="font-display text-3xl font-black text-ink">حدث خطأ غير متوقع</h1>
        <p className="mt-4 text-ink-soft">
          نعتذر — واجهنا مشكلة أثناء تحميل هذه الصفحة. حاول مجددا، وإن استمرت المشكلة تواصل مع الدعم.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="btn-primary">إعادة المحاولة</button>
          <Link href="/" className="btn-ghost">العودة للرئيسية</Link>
        </div>
      </div>
    </main>
  );
}
