import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { computeHash, toDateOnly } from "../src/services/certificateHasher.js";
import { presetTemplates } from "../src/templates/presetTemplates.js";

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

  // --- Ready-made public templates (defined in src/templates/presetTemplates.js) ---
  // Public: organizationId = null + isPublic = true, so listTemplates returns
  // them to every org. Neutral visual styles (no certificate-type wording).
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
