import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { computeHash, toDateOnly } from "../src/services/certificateHasher.js";

const prisma = new PrismaClient();

async function main() {
  // --- Plans (from pricing model) ---
  const plans = [
    { slug: "free",     name: "Free",     priceMonthly: 0,  priceYearly: 0,   certificatesPerMonth: 10,    teamMembersLimit: 1 },
    { slug: "starter",  name: "Starter",  priceMonthly: 9,  priceYearly: 90,  certificatesPerMonth: 200,   teamMembersLimit: 1 },
    { slug: "pro",      name: "Pro",      priceMonthly: 29, priceYearly: 290, certificatesPerMonth: 2000,  teamMembersLimit: 3, hasApi: true },
    { slug: "business", name: "Business", priceMonthly: 79, priceYearly: 790, certificatesPerMonth: 10000, teamMembersLimit: 10, hasApi: true, hasWhiteLabel: true },
  ];
  for (const p of plans) {
    await prisma.plan.upsert({ where: { slug: p.slug }, create: p, update: p });
  }
  const free = await prisma.plan.findUnique({ where: { slug: "free" } });

  // --- Demo user + organization ---
  const user = await prisma.user.upsert({
    where: { email: "demo@certify.test" },
    create: { name: "مدرب تجريبي", email: "demo@certify.test" },
    update: {},
  });

  const org = await prisma.organization.upsert({
    where: { slug: "demo-academy" },
    create: {
      name: "أكاديمية المسار للتدريب",
      slug: "demo-academy",
      ownerId: user.id,
      planId: free.id,
      primaryColor: "#4f46e5",
    },
    update: { planId: free.id },
  });

  // --- Demo certificate (used by the landing page "try verification" link) ---
  await prisma.certificate.deleteMany({ where: { verificationCode: "CERT-SMOK-0001" } });

  const id = crypto.randomUUID();
  const issueDate = new Date("2026-06-10");
  const verificationCode = "CERT-SMOK-0001";
  const recipientName = "عبدالرحمن محمد الأحمدي";
  const recipientEmail = "student@example.com";
  const courseName = "أساسيات إدارة المشاريع الاحترافية";

  const verificationHash = computeHash({
    id,
    organizationId: org.id,
    recipientName,
    recipientEmail,
    courseName,
    issueDate: toDateOnly(issueDate),
    verificationCode,
  });

  await prisma.certificate.create({
    data: {
      id,
      organizationId: org.id,
      recipientName,
      recipientEmail,
      courseName,
      issueDate,
      status: "active",
      verificationCode,
      verificationHash,
      events: { create: { eventType: "issued" } },
    },
  });

  // --- Ready-made public templates (available to every organization) ---
  // Public templates have organizationId = null + isPublic = true, so
  // templateController.listTemplates returns them to all users. design_data
  // follows the schema in src/templates/designRenderer.js (incl. gradient rects
  // and named `ornament` elements rendered from src/templates/ornaments.js).
  const C = "#ca8a04"; // shared gold
  const presetTemplates = [
    // ── 1) تقدير — شركة عصري (لوحة بنفسجية متدرّجة) ─────────────────────────
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "تقدير — شركة عصري",
      design: {
        width: 1123, height: 794, background: "#f1f2f5",
        elements: [
          { type: "rect", left: 793, top: 0, width: 330, height: 794, gradient: { from: "#7c3aed", to: "#4f46e5", angle: 160 } },
          { type: "rect", left: 1092, top: 0, width: 31, height: 794, fill: "#8b5cf6" },
          { type: "ornament", name: "chip", color: "#ddd6fe", left: 893, top: 70, width: 130, height: 130 },
          { type: "variable", variableKey: "org_name", left: 793, top: 220, width: 330, fontSize: 20, fontWeight: 700, fill: "#ede9fe", textAlign: "center", fontFamily: "Cairo" },
          { type: "variable", variableKey: "issue_date", left: 793, top: 470, width: 330, fontSize: 14, fontWeight: 600, fill: "#ddd6fe", textAlign: "center" },
          { type: "text", left: 60, top: 70, width: 680, text: "شهادة تقدير", fontSize: 58, fontWeight: 800, fill: "#111827", textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 60, top: 185, width: 680, text: "تُمنح هذه الشهادة إلى", fontSize: 20, fontWeight: 500, fill: "#6b7280", textAlign: "center" },
          { type: "variable", variableKey: "recipient_name", left: 40, top: 225, width: 720, fontSize: 46, fontWeight: 800, fill: "#6d28d9", textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 100, top: 320, width: 600, text: "لنشهد بأنه/ها قد أتمّ الدورة التعليمية بنجاح، مظهراً التفاني والكفاءة وأنه اكتسب المعرفة النظرية والعملية في هذا المجال.", fontSize: 17, fontWeight: 500, fill: "#4b5563", textAlign: "center", lineHeight: 1.9 },
          { type: "line", left: 90, top: 480, width: 200, stroke: "#6d28d9", strokeWidth: 1 },
          { type: "text", left: 90, top: 488, width: 200, text: "مساعد المدير", fontSize: 13, fontWeight: 600, fill: "#6b7280", textAlign: "center" },
          { type: "line", left: 500, top: 480, width: 200, stroke: "#6d28d9", strokeWidth: 1 },
          { type: "text", left: 500, top: 488, width: 200, text: "المدير التنفيذي", fontSize: 13, fontWeight: 600, fill: "#6b7280", textAlign: "center" },
          { type: "qr", left: 90, top: 590, width: 78 },
          { type: "variable", variableKey: "verification_code", left: 60, top: 675, width: 150, fontSize: 10, fontWeight: 600, fill: "#9ca3af", textAlign: "center" },
        ],
      },
    },

    // ── 2) خبير — داكن حكومي (كحلي + خطوط قطرية + ختم) ──────────────────────
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "شهادة خبير — داكن حكومي",
      design: {
        width: 1123, height: 794, background: "#0b2540",
        elements: [
          { type: "rect", left: 0, top: 0, width: 1123, height: 794, gradient: { from: "#0b2540", to: "#143a5e", angle: 150 } },
          { type: "ornament", name: "sealGold", left: 975, top: 45, width: 78, height: 78 },
          { type: "variable", variableKey: "org_name", left: 600, top: 64, width: 360, fontSize: 18, fontWeight: 700, fill: "#e2e8f0", textAlign: "right", fontFamily: "Cairo" },
          { type: "text", left: 120, top: 215, width: 883, text: "شهادة خبير", fontSize: 54, fontWeight: 800, fill: "#5eead4", textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 160, top: 320, width: 803, text: "تمنح هذه الجهة الشهادة للمتدرب", fontSize: 23, fontWeight: 600, fill: "#cbd5e1", textAlign: "center" },
          { type: "variable", variableKey: "recipient_name", left: 120, top: 372, width: 883, fontSize: 42, fontWeight: 800, fill: "#ffffff", textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 160, top: 470, width: 803, text: "وذلك لإتمامه بنجاح", fontSize: 21, fontWeight: 500, fill: "#cbd5e1", textAlign: "center" },
          { type: "variable", variableKey: "course_name", left: 120, top: 508, width: 883, fontSize: 26, fontWeight: 700, fill: "#5eead4", textAlign: "center", fontFamily: "Cairo" },
          { type: "ornament", name: "diagonalLines", left: 0, top: 624, width: 360, height: 170 },
          { type: "rect", left: 974, top: 648, width: 104, height: 104, fill: "#ffffff", rx: 8 },
          { type: "qr", left: 982, top: 656, width: 88 },
          { type: "variable", variableKey: "issue_date", left: 430, top: 690, width: 280, fontSize: 14, fontWeight: 600, fill: "#94a3b8", textAlign: "center" },
          { type: "variable", variableKey: "verification_code", left: 430, top: 724, width: 280, fontSize: 11, fontWeight: 600, fill: "#475569", textAlign: "center" },
        ],
      },
    },

    // ── 3) تقدير — كلاسيكي بأركان ذهبية (ختم + شريط) ────────────────────────
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "تقدير — كلاسيكي فاخر",
      design: {
        width: 1123, height: 794, background: "#ffffff",
        elements: [
          { type: "ornament", name: "corner", color: "#14233f", orientation: "TL", left: 0, top: 0, width: 150, height: 150 },
          { type: "ornament", name: "corner", color: "#14233f", orientation: "TR", left: 973, top: 0, width: 150, height: 150 },
          { type: "ornament", name: "corner", color: "#14233f", orientation: "BL", left: 0, top: 644, width: 150, height: 150 },
          { type: "ornament", name: "corner", color: "#14233f", orientation: "BR", left: 973, top: 644, width: 150, height: 150 },
          { type: "rect", left: 42, top: 42, width: 1039, height: 710, fill: "transparent", stroke: C, strokeWidth: 2 },
          { type: "ornament", name: "sealGold", left: 905, top: 78, width: 110, height: 110 },
          { type: "text", left: 161, top: 120, width: 801, text: "شهادة", fontSize: 72, fontWeight: 800, fill: "#14233f", textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 161, top: 228, width: 801, text: "من التقدير", fontSize: 28, fontWeight: 700, fill: C, textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 211, top: 300, width: 701, text: "تُمنح هذه الشهادة لـ", fontSize: 20, fontWeight: 500, fill: "#6b7280", textAlign: "center" },
          { type: "variable", variableKey: "recipient_name", left: 161, top: 340, width: 801, fontSize: 50, fontWeight: 800, fill: "#14233f", textAlign: "center", fontFamily: "Cairo" },
          { type: "line", left: 361, top: 420, width: 400, stroke: C, strokeWidth: 1 },
          { type: "text", left: 261, top: 442, width: 601, text: "نقدّر ونُثني على جهودكم الدؤوبة وإنجازاتكم المتميّزة، ونرجو أن تكون هذه الخطوة الأولى نحو مستقبل مشرق.", fontSize: 16, fontWeight: 500, fill: "#6b7280", textAlign: "center", lineHeight: 1.9 },
          { type: "ornament", name: "ribbonSeal", color: "#14233f", left: 511, top: 560, width: 100, height: 138 },
          { type: "line", left: 150, top: 660, width: 200, stroke: "#14233f", strokeWidth: 1 },
          { type: "text", left: 150, top: 668, width: 200, text: "مدرّس", fontSize: 13, fontWeight: 600, fill: "#6b7280", textAlign: "center" },
          { type: "line", left: 773, top: 660, width: 200, stroke: "#14233f", strokeWidth: 1 },
          { type: "text", left: 773, top: 668, width: 200, text: "مدير المنظمة", fontSize: 13, fontWeight: 600, fill: "#6b7280", textAlign: "center" },
          { type: "qr", left: 70, top: 600, width: 70 },
          { type: "variable", variableKey: "verification_code", left: 44, top: 676, width: 122, fontSize: 9, fontWeight: 600, fill: "#9ca3af", textAlign: "center" },
        ],
      },
    },

    // ── 4) تقدير — ذهبي بشريط جانبي (كريمي + لوحة كحلية) ───────────────────
    {
      id: "44444444-4444-4444-8444-444444444444",
      name: "تقدير — ذهبي بشريط جانبي",
      design: {
        width: 1123, height: 794, background: "#faf7f0",
        elements: [
          { type: "rect", left: 803, top: 0, width: 320, height: 794, fill: "#14233f" },
          { type: "ornament", name: "ribbonSeal", color: "#b8860b", left: 720, top: 70, width: 150, height: 200 },
          { type: "ornament", name: "laurel", color: "#b8860b", left: 110, top: 55, width: 80, height: 80 },
          { type: "variable", variableKey: "org_name", left: 200, top: 75, width: 320, fontSize: 18, fontWeight: 700, fill: "#5c3d0a", textAlign: "right", fontFamily: "Cairo" },
          { type: "text", left: 80, top: 200, width: 660, text: "شهادة تقدير", fontSize: 56, fontWeight: 800, fill: "#14233f", textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 80, top: 305, width: 660, text: "يتم تقديم هذه الشهادة بكل فخر إلى", fontSize: 19, fontWeight: 500, fill: "#6b7280", textAlign: "center" },
          { type: "variable", variableKey: "recipient_name", left: 60, top: 345, width: 700, fontSize: 48, fontWeight: 800, fill: "#14233f", textAlign: "center", fontFamily: "Cairo" },
          { type: "line", left: 230, top: 425, width: 360, stroke: "#b8860b", strokeWidth: 1 },
          { type: "variable", variableKey: "course_name", left: 80, top: 448, width: 660, fontSize: 22, fontWeight: 700, fill: "#14233f", textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 140, top: 505, width: 540, text: "شكراً لك على ما بذلته من مجهودات، ونتمنى لك التقدّم والنجاح الدائم.", fontSize: 16, fontWeight: 500, fill: "#6b7280", textAlign: "center", lineHeight: 1.9 },
          { type: "line", left: 110, top: 650, width: 220, stroke: "#14233f", strokeWidth: 1 },
          { type: "text", left: 110, top: 658, width: 220, text: "التوقيع", fontSize: 13, fontWeight: 600, fill: "#6b7280", textAlign: "center" },
          { type: "variable", variableKey: "issue_date", left: 470, top: 622, width: 220, fontSize: 16, fontWeight: 700, fill: "#14233f", textAlign: "center" },
          { type: "line", left: 470, top: 650, width: 220, stroke: "#14233f", strokeWidth: 1 },
          { type: "text", left: 470, top: 658, width: 220, text: "التاريخ", fontSize: 13, fontWeight: 600, fill: "#6b7280", textAlign: "center" },
          { type: "qr", left: 705, top: 540, width: 78 },
          { type: "variable", variableKey: "verification_code", left: 670, top: 626, width: 150, fontSize: 10, fontWeight: 600, fill: "#a8895a", textAlign: "center" },
        ],
      },
    },

    // ── 5) إتمام دورة — حديث (ترويسة متدرّجة + ختم) ────────────────────────
    {
      id: "55555555-5555-4555-8555-555555555555",
      name: "إتمام دورة — حديث",
      design: {
        width: 1123, height: 794, background: "#ffffff",
        elements: [
          { type: "rect", left: 0, top: 0, width: 1123, height: 180, gradient: { from: "#4f46e5", to: "#0ea5e9", angle: 120 } },
          { type: "rect", left: 0, top: 778, width: 1123, height: 16, gradient: { from: "#0ea5e9", to: "#4f46e5", angle: 120 } },
          { type: "text", left: 161, top: 56, width: 801, text: "شهادة إتمام", fontSize: 50, fontWeight: 800, fill: "#ffffff", textAlign: "center", fontFamily: "Cairo" },
          { type: "ornament", name: "sealGold", left: 516, top: 122, width: 110, height: 110 },
          { type: "text", left: 211, top: 270, width: 701, text: "تشهد هذه الجهة بأن", fontSize: 20, fontWeight: 500, fill: "#6b7280", textAlign: "center" },
          { type: "variable", variableKey: "recipient_name", left: 161, top: 312, width: 801, fontSize: 46, fontWeight: 800, fill: "#4f46e5", textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 211, top: 405, width: 701, text: "قد أتمّ بنجاح متطلبات", fontSize: 20, fontWeight: 500, fill: "#6b7280", textAlign: "center" },
          { type: "variable", variableKey: "course_name", left: 161, top: 445, width: 801, fontSize: 30, fontWeight: 700, fill: "#0f172a", textAlign: "center", fontFamily: "Cairo" },
          { type: "line", left: 130, top: 660, width: 240, stroke: "#4f46e5", strokeWidth: 1 },
          { type: "variable", variableKey: "org_name", left: 130, top: 668, width: 240, fontSize: 16, fontWeight: 700, fill: "#0f172a", textAlign: "center" },
          { type: "text", left: 130, top: 694, width: 240, text: "الجهة المانحة", fontSize: 12, fontWeight: 500, fill: "#94a3b8", textAlign: "center" },
          { type: "line", left: 753, top: 660, width: 240, stroke: "#4f46e5", strokeWidth: 1 },
          { type: "variable", variableKey: "issue_date", left: 753, top: 668, width: 240, fontSize: 16, fontWeight: 700, fill: "#0f172a", textAlign: "center" },
          { type: "text", left: 753, top: 694, width: 240, text: "تاريخ الإصدار", fontSize: 12, fontWeight: 500, fill: "#94a3b8", textAlign: "center" },
          { type: "qr", left: 524, top: 628, width: 76 },
          { type: "variable", variableKey: "verification_code", left: 461, top: 712, width: 200, fontSize: 11, fontWeight: 600, fill: "#94a3b8", textAlign: "center" },
        ],
      },
    },

    // ── 6) حضور — أنيق ذهبي (إطار + إكليل غار) ─────────────────────────────
    {
      id: "66666666-6666-4666-8666-666666666666",
      name: "حضور — أنيق ذهبي",
      design: {
        width: 1123, height: 794, background: "#fffdf5",
        elements: [
          { type: "rect", left: 28, top: 28, width: 1067, height: 738, fill: "transparent", stroke: "#b8860b", strokeWidth: 4 },
          { type: "rect", left: 40, top: 40, width: 1043, height: 714, fill: "transparent", stroke: "#d4af37", strokeWidth: 1 },
          { type: "ornament", name: "laurel", color: "#b8860b", left: 521, top: 70, width: 80, height: 80 },
          { type: "text", left: 161, top: 170, width: 801, text: "شهادة حضور", fontSize: 54, fontWeight: 800, fill: "#5c3d0a", textAlign: "center", fontFamily: "Cairo" },
          { type: "line", left: 411, top: 260, width: 300, stroke: "#d4af37", strokeWidth: 1 },
          { type: "rect", left: 553, top: 252, width: 16, height: 16, fill: "#b8860b", angle: 45 },
          { type: "text", left: 211, top: 292, width: 701, text: "تشهد هذه الجهة بحضور", fontSize: 20, fontWeight: 500, fill: "#92722f", textAlign: "center" },
          { type: "variable", variableKey: "recipient_name", left: 161, top: 332, width: 801, fontSize: 48, fontWeight: 800, fill: "#b8860b", textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 211, top: 432, width: 701, text: "فعاليات", fontSize: 18, fontWeight: 500, fill: "#92722f", textAlign: "center" },
          { type: "variable", variableKey: "course_name", left: 161, top: 470, width: 801, fontSize: 28, fontWeight: 700, fill: "#5c3d0a", textAlign: "center", fontFamily: "Cairo" },
          { type: "line", left: 140, top: 664, width: 240, stroke: "#5c3d0a", strokeWidth: 1 },
          { type: "variable", variableKey: "org_name", left: 140, top: 672, width: 240, fontSize: 16, fontWeight: 700, fill: "#5c3d0a", textAlign: "center" },
          { type: "text", left: 140, top: 698, width: 240, text: "الجهة المانحة", fontSize: 12, fontWeight: 500, fill: "#a8895a", textAlign: "center" },
          { type: "line", left: 743, top: 664, width: 240, stroke: "#5c3d0a", strokeWidth: 1 },
          { type: "variable", variableKey: "issue_date", left: 743, top: 672, width: 240, fontSize: 16, fontWeight: 700, fill: "#5c3d0a", textAlign: "center" },
          { type: "text", left: 743, top: 698, width: 240, text: "التاريخ", fontSize: 12, fontWeight: 500, fill: "#a8895a", textAlign: "center" },
          { type: "qr", left: 524, top: 600, width: 74 },
          { type: "variable", variableKey: "verification_code", left: 461, top: 682, width: 200, fontSize: 11, fontWeight: 600, fill: "#a8895a", textAlign: "center" },
        ],
      },
    },
  ];

  for (const t of presetTemplates) {
    const data = {
      name: t.name,
      category: "completion",
      orientation: "landscape",
      isPublic: true,
      designData: JSON.stringify(t.design),
    };
    await prisma.template.upsert({
      where: { id: t.id },
      create: { id: t.id, ...data },
      update: data,
    });
  }

  console.log(`Seeded plans, demo org, demo certificate (CERT-SMOK-0001), and ${presetTemplates.length} public templates.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
