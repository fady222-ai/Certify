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
  // templateController.listTemplates returns them to all users. The design_data
  // follows the schema expected by src/templates/designRenderer.js.
  const presetTemplates = [
    // ── 1) إتمام دورة — كلاسيكي فاخر (كحلي + ذهبي) ──────────────────────────
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "إتمام دورة — كلاسيكي فاخر",
      design: {
        width: 1123,
        height: 794,
        background: "#ffffff",
        elements: [
          // borders
          { type: "rect", left: 28, top: 28, width: 1067, height: 738, fill: "transparent", stroke: "#1e3a5f", strokeWidth: 6, rx: 4 },
          { type: "rect", left: 44, top: 44, width: 1035, height: 706, fill: "transparent", stroke: "#c19b4a", strokeWidth: 2, rx: 2 },
          // top medallion (seal)
          { type: "rect", left: 511, top: 66, width: 100, height: 100, fill: "#1e3a5f", rx: 50 },
          { type: "rect", left: 519, top: 74, width: 84, height: 84, fill: "transparent", stroke: "#c19b4a", strokeWidth: 2, rx: 42 },
          { type: "text", left: 511, top: 86, width: 100, text: "★", fontSize: 46, fontWeight: 700, fill: "#c19b4a", textAlign: "center" },
          // title
          { type: "text", left: 161, top: 196, width: 801, text: "شهادة إتمام", fontSize: 56, fontWeight: 800, fill: "#1e3a5f", textAlign: "center", fontFamily: "Cairo" },
          // divider with diamond
          { type: "line", left: 411, top: 286, width: 300, stroke: "#c19b4a", strokeWidth: 2 },
          { type: "rect", left: 553, top: 278, width: 16, height: 16, fill: "#c19b4a", angle: 45 },
          // body
          { type: "text", left: 211, top: 318, width: 701, text: "تشهد هذه الشهادة بأن", fontSize: 20, fontWeight: 500, fill: "#64748b", textAlign: "center" },
          { type: "variable", variableKey: "recipient_name", left: 161, top: 356, width: 801, fontSize: 48, fontWeight: 800, fill: "#c19b4a", textAlign: "center", fontFamily: "Cairo" },
          { type: "line", left: 361, top: 432, width: 400, stroke: "#e5e7eb", strokeWidth: 1 },
          { type: "text", left: 211, top: 452, width: 701, text: "قد أتمّ بنجاح متطلبات", fontSize: 20, fontWeight: 500, fill: "#64748b", textAlign: "center" },
          { type: "variable", variableKey: "course_name", left: 161, top: 492, width: 801, fontSize: 30, fontWeight: 700, fill: "#1e3a5f", textAlign: "center", fontFamily: "Cairo" },
          // signature (left) + date (right)
          { type: "line", left: 130, top: 662, width: 240, stroke: "#1e3a5f", strokeWidth: 1 },
          { type: "variable", variableKey: "org_name", left: 130, top: 670, width: 240, fontSize: 16, fontWeight: 700, fill: "#1e3a5f", textAlign: "center" },
          { type: "text", left: 130, top: 696, width: 240, text: "الجهة المانحة", fontSize: 12, fontWeight: 500, fill: "#94a3b8", textAlign: "center" },
          { type: "line", left: 753, top: 662, width: 240, stroke: "#1e3a5f", strokeWidth: 1 },
          { type: "variable", variableKey: "issue_date", left: 753, top: 670, width: 240, fontSize: 16, fontWeight: 700, fill: "#1e3a5f", textAlign: "center" },
          { type: "text", left: 753, top: 696, width: 240, text: "تاريخ الإصدار", fontSize: 12, fontWeight: 500, fill: "#94a3b8", textAlign: "center" },
          // QR + code
          { type: "qr", left: 524, top: 628, width: 76 },
          { type: "variable", variableKey: "verification_code", left: 461, top: 712, width: 200, fontSize: 11, fontWeight: 600, fill: "#94a3b8", textAlign: "center" },
        ],
      },
    },

    // ── 2) شهادة حضور — عصري بشريط جانبي (تركواز) ──────────────────────────
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "شهادة حضور — عصري",
      design: {
        width: 1123,
        height: 794,
        background: "#ffffff",
        elements: [
          // right side band
          { type: "rect", left: 823, top: 0, width: 300, height: 794, fill: "#0d9488" },
          { type: "rect", left: 793, top: 0, width: 8, height: 794, fill: "#14b8a6" },
          // seal on band
          { type: "rect", left: 893, top: 90, width: 160, height: 160, fill: "#14b8a6", rx: 80 },
          { type: "rect", left: 905, top: 102, width: 136, height: 136, fill: "transparent", stroke: "#ffffff", strokeWidth: 2, rx: 68 },
          { type: "text", left: 893, top: 118, width: 160, text: "✔", fontSize: 84, fontWeight: 700, fill: "#ffffff", textAlign: "center" },
          { type: "text", left: 843, top: 360, width: 260, text: "شهادة حضور", fontSize: 38, fontWeight: 800, fill: "#ffffff", textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 843, top: 430, width: 260, text: "نفخر بمشاركتكم", fontSize: 16, fontWeight: 500, fill: "#ccfbf1", textAlign: "center" },
          // content area (left of band)
          { type: "rect", left: 60, top: 90, width: 700, height: 5, fill: "#0d9488" },
          { type: "text", left: 60, top: 230, width: 700, text: "نشهد بحضور", fontSize: 22, fontWeight: 500, fill: "#64748b", textAlign: "center" },
          { type: "variable", variableKey: "recipient_name", left: 40, top: 275, width: 740, fontSize: 44, fontWeight: 800, fill: "#0d9488", textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 60, top: 372, width: 700, text: "فعاليات", fontSize: 18, fontWeight: 500, fill: "#64748b", textAlign: "center" },
          { type: "variable", variableKey: "course_name", left: 40, top: 412, width: 740, fontSize: 28, fontWeight: 700, fill: "#0f172a", textAlign: "center", fontFamily: "Cairo" },
          { type: "line", left: 230, top: 505, width: 360, stroke: "#e2e8f0", strokeWidth: 2 },
          { type: "variable", variableKey: "org_name", left: 210, top: 525, width: 400, fontSize: 18, fontWeight: 700, fill: "#0f172a", textAlign: "center" },
          { type: "variable", variableKey: "issue_date", left: 200, top: 590, width: 420, fontSize: 14, fontWeight: 600, fill: "#94a3b8", textAlign: "center" },
          { type: "qr", left: 80, top: 600, width: 84 },
          { type: "variable", variableKey: "verification_code", left: 430, top: 700, width: 330, fontSize: 11, fontWeight: 600, fill: "#cbd5e1", textAlign: "center" },
        ],
      },
    },

    // ── 3) شهادة تقدير — ذهبي فاخر (كريمي + ذهبي) ──────────────────────────
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "شهادة تقدير — ذهبي فاخر",
      design: {
        width: 1123,
        height: 794,
        background: "#fffdf5",
        elements: [
          { type: "rect", left: 28, top: 28, width: 1067, height: 738, fill: "transparent", stroke: "#b8860b", strokeWidth: 4 },
          { type: "rect", left: 40, top: 40, width: 1043, height: 714, fill: "transparent", stroke: "#d4af37", strokeWidth: 1 },
          // corner accents (L shapes)
          { type: "rect", left: 40, top: 40, width: 90, height: 6, fill: "#b8860b" },
          { type: "rect", left: 40, top: 40, width: 6, height: 90, fill: "#b8860b" },
          { type: "rect", left: 993, top: 40, width: 90, height: 6, fill: "#b8860b" },
          { type: "rect", left: 1077, top: 40, width: 6, height: 90, fill: "#b8860b" },
          { type: "rect", left: 40, top: 748, width: 90, height: 6, fill: "#b8860b" },
          { type: "rect", left: 40, top: 664, width: 6, height: 90, fill: "#b8860b" },
          { type: "rect", left: 993, top: 748, width: 90, height: 6, fill: "#b8860b" },
          { type: "rect", left: 1077, top: 664, width: 6, height: 90, fill: "#b8860b" },
          // seal
          { type: "rect", left: 521, top: 66, width: 80, height: 80, fill: "transparent", stroke: "#b8860b", strokeWidth: 3, rx: 40 },
          { type: "text", left: 521, top: 82, width: 80, text: "❖", fontSize: 40, fontWeight: 700, fill: "#b8860b", textAlign: "center" },
          // title + divider
          { type: "text", left: 161, top: 180, width: 801, text: "شهادة تقدير", fontSize: 56, fontWeight: 800, fill: "#5c3d0a", textAlign: "center", fontFamily: "Cairo" },
          { type: "line", left: 411, top: 270, width: 300, stroke: "#d4af37", strokeWidth: 1 },
          { type: "rect", left: 553, top: 262, width: 16, height: 16, fill: "#b8860b", angle: 45 },
          // body
          { type: "text", left: 211, top: 300, width: 701, text: "تُمنح هذه الشهادة تقديراً وعرفاناً لـ", fontSize: 20, fontWeight: 500, fill: "#92722f", textAlign: "center" },
          { type: "variable", variableKey: "recipient_name", left: 161, top: 342, width: 801, fontSize: 48, fontWeight: 800, fill: "#b8860b", textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 211, top: 440, width: 701, text: "على جهوده المتميزة في", fontSize: 20, fontWeight: 500, fill: "#92722f", textAlign: "center" },
          { type: "variable", variableKey: "course_name", left: 161, top: 480, width: 801, fontSize: 28, fontWeight: 700, fill: "#5c3d0a", textAlign: "center", fontFamily: "Cairo" },
          // signature + date
          { type: "line", left: 140, top: 664, width: 240, stroke: "#5c3d0a", strokeWidth: 1 },
          { type: "variable", variableKey: "org_name", left: 140, top: 672, width: 240, fontSize: 16, fontWeight: 700, fill: "#5c3d0a", textAlign: "center" },
          { type: "text", left: 140, top: 698, width: 240, text: "التوقيع", fontSize: 12, fontWeight: 500, fill: "#a8895a", textAlign: "center" },
          { type: "line", left: 743, top: 664, width: 240, stroke: "#5c3d0a", strokeWidth: 1 },
          { type: "variable", variableKey: "issue_date", left: 743, top: 672, width: 240, fontSize: 16, fontWeight: 700, fill: "#5c3d0a", textAlign: "center" },
          { type: "text", left: 743, top: 698, width: 240, text: "التاريخ", fontSize: 12, fontWeight: 500, fill: "#a8895a", textAlign: "center" },
          { type: "qr", left: 524, top: 632, width: 74 },
          { type: "variable", variableKey: "verification_code", left: 461, top: 714, width: 200, fontSize: 11, fontWeight: 600, fill: "#a8895a", textAlign: "center" },
        ],
      },
    },

    // ── 4) شهادة إنجاز — حديث (محاذاة يمين بنفسجي) ──────────────────────────
    {
      id: "44444444-4444-4444-8444-444444444444",
      name: "شهادة إنجاز — حديث",
      design: {
        width: 1123,
        height: 794,
        background: "#ffffff",
        elements: [
          { type: "rect", left: 0, top: 0, width: 1123, height: 14, fill: "#4f46e5" },
          { type: "rect", left: 0, top: 780, width: 1123, height: 14, fill: "#4f46e5" },
          { type: "rect", left: 995, top: 120, width: 8, height: 554, fill: "#4f46e5" },
          { type: "text", left: 120, top: 120, width: 855, text: "شهادة إنجاز", fontSize: 60, fontWeight: 800, fill: "#0f172a", textAlign: "right", fontFamily: "Cairo" },
          { type: "text", left: 120, top: 230, width: 855, text: "تشهد هذه الجهة بأن", fontSize: 22, fontWeight: 500, fill: "#64748b", textAlign: "right" },
          { type: "variable", variableKey: "recipient_name", left: 120, top: 274, width: 855, fontSize: 50, fontWeight: 800, fill: "#4f46e5", textAlign: "right", fontFamily: "Cairo" },
          { type: "text", left: 120, top: 378, width: 855, text: "قد حقّق إنجازاً متميزاً في", fontSize: 22, fontWeight: 500, fill: "#64748b", textAlign: "right" },
          { type: "variable", variableKey: "course_name", left: 120, top: 422, width: 855, fontSize: 32, fontWeight: 700, fill: "#0f172a", textAlign: "right", fontFamily: "Cairo" },
          { type: "line", left: 120, top: 522, width: 855, stroke: "#e2e8f0", strokeWidth: 2 },
          { type: "variable", variableKey: "org_name", left: 575, top: 600, width: 400, fontSize: 18, fontWeight: 700, fill: "#0f172a", textAlign: "right" },
          { type: "text", left: 575, top: 628, width: 400, text: "الجهة المانحة", fontSize: 13, fontWeight: 500, fill: "#94a3b8", textAlign: "right" },
          { type: "variable", variableKey: "issue_date", left: 575, top: 668, width: 400, fontSize: 16, fontWeight: 600, fill: "#64748b", textAlign: "right" },
          { type: "qr", left: 120, top: 580, width: 90 },
          { type: "variable", variableKey: "verification_code", left: 120, top: 678, width: 200, fontSize: 11, fontWeight: 600, fill: "#cbd5e1", textAlign: "center" },
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
