import path from "node:path";
import fs from "node:fs/promises";
import puppeteer from "puppeteer";
import QRCode from "qrcode";
import { config } from "../config/index.js";
import { prisma } from "../db/prisma.js";
import { certificateHtml } from "../templates/certificate.js";

/**
 * Renders certificates to PDF using headless Chrome (puppeteer). Chrome handles
 * Arabic shaping/RTL natively, giving pixel-perfect output that matches the
 * visual template editor.
 *
 * A single browser instance is reused across renders for performance.
 */
let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: "new",
      executablePath: config.chromePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}

export function verifyUrl(verificationCode) {
  return `${config.verifyBaseUrl.replace(/\/$/, "")}/verify/${verificationCode}`;
}

function issueDateLabel(date) {
  return new Intl.DateTimeFormat("ar", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date instanceof Date ? date : new Date(date));
}

/** Build the certificate HTML for a certificate record (+ its organization). */
export async function buildHtml(cert) {
  const org = cert.organization ?? (cert.organizationId
    ? await prisma.organization.findUnique({ where: { id: cert.organizationId } })
    : null);

  const qrSvg = await QRCode.toString(verifyUrl(cert.verificationCode), {
    type: "svg",
    margin: 0,
    width: 140,
  });

  return certificateHtml({
    orgName: org?.name ?? "منصة الشهادات",
    recipientName: cert.recipientName,
    courseName: cert.courseName,
    issueDateLabel: issueDateLabel(cert.issueDate),
    verificationCode: cert.verificationCode,
    qrSvg,
    primaryColor: org?.primaryColor ?? "#4f46e5",
    logoUrl: org?.logoUrl ?? null,
    signatureUrl: org?.signatureUrl ?? null,
  });
}

/**
 * Render the certificate to a PDF, store it under the storage dir, persist the
 * relative path on the record, and return that path.
 */
export async function renderPdf(cert) {
  const html = await buildHtml(cert);
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    const relPath = path.join("certificates", `${cert.id}.pdf`);
    const absPath = path.join(config.storageDir, relPath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, pdf);

    await prisma.certificate.update({
      where: { id: cert.id },
      data: { pdfUrl: relPath },
    });

    return relPath;
  } finally {
    await page.close();
  }
}
