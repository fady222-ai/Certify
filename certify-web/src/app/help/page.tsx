import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { IconShield, IconArrow } from "@/components/icons";

export const metadata: Metadata = {
  title: "مركز المساعدة | Certify",
  description: "أسئلة شائعة وأدلة سريعة لاستخدام منصة الشهادات الرقمية.",
};

const faqs = [
  {
    q: "كيف أُصدر أول شهادة؟",
    a: "بعد تسجيل الدخول، اذهب إلى لوحة التحكم واضغط «إصدار شهادة جديدة»، ثم أدخل اسم المتدرب واسم الدورة (والبريد اختيارياً). ستُولّد الشهادة فوراً برمز تحقق فريد.",
  },
  {
    q: "كيف أُصدر شهادات لمجموعة كبيرة دفعة واحدة؟",
    a: "من «الإصدار الجماعي»، ارفع ملف Excel أو CSV يحتوي عمود name (مطلوب)، و email وcourse_name (اختياريان). سيُصدر النظام شهادة لكل صف ويرسل البريد تلقائياً عند توفّره — حتى 500 صف في الدفعة.",
  },
  {
    q: "كيف يتحقق المتلقّي من صحة الشهادة؟",
    a: "كل شهادة تحمل رمز تحقق ورمز QR يقودان إلى صفحة تحقق عامة تعرض البيانات وتؤكد عدم التلاعب عبر بصمة رقمية مشفّرة (HMAC-SHA256).",
  },
  {
    q: "كيف تمنع المنصة تزوير الشهادات؟",
    a: "عند الإصدار نحسب بصمة رقمية لبيانات الشهادة ونخزّنها. في كل مرة تُفتح صفحة التحقق نعيد حساب البصمة ونقارنها؛ أي تعديل في البيانات يكشفه النظام فوراً.",
  },
  {
    q: "هل يمكن تخصيص تصميم الشهادة بهوية منظمتي؟",
    a: "نعم. من «إعدادات المنظمة» حدّد اللون الأساسي وارفع الشعار والتوقيع — تظهر تلقائياً على الشهادات. كما يمكنك تصميم قوالب مخصّصة من محرّر القوالب المرئي.",
  },
  {
    q: "كيف يضيف المتدرب الشهادة إلى لينكدإن؟",
    a: "في صفحة التحقق يوجد زر «إضافة إلى لينكدإن» يملأ بيانات الشهادة تلقائياً في قسم الشهادات بملفه — إعلان مجاني لمنظمتك مع كل شهادة.",
  },
  {
    q: "ماذا يحدث عند بلوغ حد الباقة الشهري؟",
    a: "يتوقف الإصدار مؤقتاً مع رسالة توضيحية. يمكنك الترقية من «الباقة والفوترة» لرفع الحد فوراً، أو الانتظار لتجديد العدّاد بداية الشهر التالي.",
  },
  {
    q: "كيف ألغي شهادة صدرت بالخطأ؟",
    a: "افتح الشهادة من «إدارة الشهادات» واضغط «إلغاء الشهادة» مع تحديد السبب. ستظهر الشهادة كـ«ملغاة» في صفحة التحقق العامة.",
  },
];

export default function HelpPage() {
  return (
    <>
      <SiteHeader />
      <main className="mesh-bg flex-1">
        <div className="absolute inset-0 dot-grid opacity-40" />
        <div className="relative mx-auto max-w-3xl px-5 py-16 lg:py-24">
          <div className="text-center">
            <span className="chip"><IconShield className="h-4 w-4" /> مركز المساعدة</span>
            <h1 className="mt-5 font-display text-3xl font-black text-ink sm:text-4xl">كيف يمكننا مساعدتك؟</h1>
            <p className="mt-4 text-lg text-ink-soft">إجابات سريعة لأكثر الأسئلة شيوعاً حول إصدار الشهادات والتحقق منها.</p>
          </div>

          <div className="mt-12 space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="card group p-5 [&_summary]:cursor-pointer">
                <summary className="flex items-center justify-between gap-4 font-extrabold text-ink list-none">
                  {f.q}
                  <IconArrow className="h-4 w-4 shrink-0 -rotate-90 text-ink-muted transition group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-12 card flex flex-col items-center gap-3 p-8 text-center">
            <h2 className="font-display text-xl font-black text-ink">لم تجد إجابتك؟</h2>
            <p className="text-sm text-ink-soft">جرّب المنصة مباشرةً أو ابدأ حسابك المجاني الآن.</p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="btn-primary">ابدأ مجاناً <IconArrow className="h-4 w-4 rotate-180" /></Link>
              <Link href="/" className="btn-ghost">العودة للرئيسية</Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
