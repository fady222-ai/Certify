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
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "إتمام دورة — كلاسيكي",
      design: {
        width: 1123,
        height: 794,
        background: "#ffffff",
        elements: [
          { type: "rect", left: 40, top: 40, width: 1043, height: 714, fill: "transparent", stroke: "#4f46e5", strokeWidth: 4, rx: 16 },
          { type: "rect", left: 60, top: 60, width: 1003, height: 674, fill: "transparent", stroke: "#c7d2fe", strokeWidth: 2, rx: 10 },
          { type: "text", left: 211, top: 140, width: 701, text: "شهادة إتمام", fontSize: 52, fontWeight: 800, fill: "#111827", textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 211, top: 240, width: 701, text: "تشهد هذه الشهادة بأن", fontSize: 22, fontWeight: 500, fill: "#6b7280", textAlign: "center" },
          { type: "variable", variableKey: "recipient_name", left: 161, top: 290, width: 801, fontSize: 44, fontWeight: 800, fill: "#4f46e5", textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 211, top: 385, width: 701, text: "قد أتمّ بنجاح", fontSize: 22, fontWeight: 500, fill: "#6b7280", textAlign: "center" },
          { type: "variable", variableKey: "course_name", left: 161, top: 430, width: 801, fontSize: 30, fontWeight: 700, fill: "#111827", textAlign: "center", fontFamily: "Cairo" },
          { type: "variable", variableKey: "issue_date", left: 120, top: 650, width: 300, fontSize: 16, fontWeight: 600, fill: "#6b7280", textAlign: "center" },
          { type: "variable", variableKey: "org_name", left: 703, top: 650, width: 300, fontSize: 16, fontWeight: 700, fill: "#111827", textAlign: "center" },
          { type: "qr", left: 511, top: 595, width: 100 },
          { type: "variable", variableKey: "verification_code", left: 461, top: 705, width: 200, fontSize: 12, fontWeight: 600, fill: "#9ca3af", textAlign: "center" },
        ],
      },
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "شهادة حضور — عصري",
      design: {
        width: 1123,
        height: 794,
        background: "#ffffff",
        elements: [
          { type: "rect", left: 0, top: 0, width: 1123, height: 150, fill: "#0ea5e9", strokeWidth: 0 },
          { type: "text", left: 211, top: 50, width: 701, text: "شهادة حضور", fontSize: 46, fontWeight: 800, fill: "#ffffff", textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 211, top: 230, width: 701, text: "نشهد بحضور", fontSize: 22, fontWeight: 500, fill: "#64748b", textAlign: "center" },
          { type: "variable", variableKey: "recipient_name", left: 161, top: 280, width: 801, fontSize: 42, fontWeight: 800, fill: "#0ea5e9", textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 211, top: 375, width: 701, text: "فعالية", fontSize: 20, fontWeight: 500, fill: "#64748b", textAlign: "center" },
          { type: "variable", variableKey: "course_name", left: 161, top: 415, width: 801, fontSize: 28, fontWeight: 700, fill: "#0f172a", textAlign: "center", fontFamily: "Cairo" },
          { type: "line", left: 411, top: 520, width: 300, stroke: "#e2e8f0", strokeWidth: 2 },
          { type: "variable", variableKey: "org_name", left: 411, top: 540, width: 300, fontSize: 18, fontWeight: 700, fill: "#0f172a", textAlign: "center" },
          { type: "variable", variableKey: "issue_date", left: 120, top: 700, width: 300, fontSize: 14, fontWeight: 600, fill: "#94a3b8", textAlign: "center" },
          { type: "qr", left: 960, top: 620, width: 90 },
          { type: "variable", variableKey: "verification_code", left: 90, top: 730, width: 240, fontSize: 11, fontWeight: 600, fill: "#cbd5e1", textAlign: "center" },
        ],
      },
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "شهادة تقدير — أنيق",
      design: {
        width: 1123,
        height: 794,
        background: "#fffbeb",
        elements: [
          { type: "rect", left: 40, top: 40, width: 1043, height: 714, fill: "transparent", stroke: "#b45309", strokeWidth: 3, rx: 0 },
          { type: "rect", left: 55, top: 55, width: 1013, height: 684, fill: "transparent", stroke: "#d97706", strokeWidth: 1, rx: 0 },
          { type: "text", left: 211, top: 150, width: 701, text: "شهادة تقدير", fontSize: 54, fontWeight: 800, fill: "#92400e", textAlign: "center", fontFamily: "Cairo" },
          { type: "text", left: 211, top: 260, width: 701, text: "تُمنح هذه الشهادة تقديراً لـ", fontSize: 22, fontWeight: 500, fill: "#a16207", textAlign: "center" },
          { type: "variable", variableKey: "recipient_name", left: 161, top: 310, width: 801, fontSize: 46, fontWeight: 800, fill: "#b45309", textAlign: "center", fontFamily: "Cairo" },
          { type: "variable", variableKey: "course_name", left: 161, top: 425, width: 801, fontSize: 26, fontWeight: 600, fill: "#78350f", textAlign: "center", fontFamily: "Cairo" },
          { type: "variable", variableKey: "issue_date", left: 120, top: 650, width: 300, fontSize: 16, fontWeight: 600, fill: "#a16207", textAlign: "center" },
          { type: "variable", variableKey: "org_name", left: 703, top: 650, width: 300, fontSize: 16, fontWeight: 700, fill: "#92400e", textAlign: "center" },
          { type: "qr", left: 511, top: 590, width: 100 },
          { type: "variable", variableKey: "verification_code", left: 461, top: 700, width: 200, fontSize: 12, fontWeight: 600, fill: "#d6b45e", textAlign: "center" },
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

  console.log("Seeded plans, demo org, demo certificate (CERT-SMOK-0001), and 3 public templates.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
