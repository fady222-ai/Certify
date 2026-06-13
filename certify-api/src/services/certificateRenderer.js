import path from "node:path";
import fs from "node:fs/promises";
import puppeteer from "puppeteer";
import QRCode from "qrcode";
import { config } from "../config/index.js";
import { prisma } from "../db/prisma.js";
import { certificateHtml } from "../templates/certificate.js";
import { renderDesignToHtml } from "../templates/designRenderer.js";

/**
 * Renders certificates to PDF using headless Chrome (puppeteer). Chrome handles
 * Arabic shaping/RTL natively, giving pixel-perfect output that matches the
 * visual template editor.
 *
 * A single browser instance is reused across renders for performance.
 */
let browserPromise = null;

async function launchBrowser() {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: config.chromePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  // If Chrome dies, drop the cached instance so the next render relaunches.
  browser.on("disconnected", () => {
    browserPromise = null;
  });
  return browser;
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((e) => {
      browserPromise = null;
      throw e;
    });
  }
  let browser = await browserPromise;
  if (!browser.connected) {
    browserPromise = null;
    browser = await getBrowser();
  }
  return browser;
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

/** Resolve a stored asset path to an absolute URL Chrome can fetch. */
function assetUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${config.appUrl.replace(/\/$/, "")}/storage/${url}`;
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

  // If the certificate uses a custom visual template, render from its design.
  const template =
    cert.template ??
    (cert.templateId
      ? await prisma.template.findUnique({ where: { id: cert.templateId } })
      : null);

  const design = parseDesign(template?.designData);
  if (design) {
    const vars = {
      recipient_name: cert.recipientName,
      course_name: cert.courseName ?? "",
      issue_date: issueDateLabel(cert.issueDate),
      org_name: org?.name ?? "منصة الشهادات",
      verification_code: cert.verificationCode,
    };
    // Inject the organization's logo (from settings) at the template's logo slot
    // at render time — kept dynamic so updating the logo in settings applies
    // everywhere, and saved templates never embed a logo.
    const logoUrl = assetUrl(org?.logoUrl);
    const box = design.theme?.logoBox;
    if (logoUrl && box && box.width) {
      // Drop the template's default emblem/ornament sitting at the logo slot so
      // the org logo replaces it (no double logo), then place the org logo.
      design.elements = design.elements.filter(
        (el) => !(el.type === "ornament" && boxesOverlap(el, box)),
      );
      design.elements.push(
        { type: "image", role: "logo", src: logoUrl, left: box.left, top: box.top, width: box.width, height: box.height },
      );
    }
    return renderDesignToHtml(design, vars, qrSvg);
  }

  return certificateHtml({
    orgName: org?.name ?? "منصة الشهادات",
    recipientName: cert.recipientName,
    courseName: cert.courseName,
    issueDateLabel: issueDateLabel(cert.issueDate),
    verificationCode: cert.verificationCode,
    qrSvg,
    primaryColor: org?.primaryColor ?? "#4f46e5",
    logoUrl: assetUrl(org?.logoUrl),
    signatureUrl: assetUrl(org?.signatureUrl),
  });
}

/** Axis-aligned box intersection (height defaults to width when absent). */
function boxesOverlap(el, box) {
  const w = el.width ?? 0;
  const h = el.height ?? w;
  if (!w || !h) return false;
  return !(
    el.left + w <= box.left ||
    el.left >= box.left + box.width ||
    el.top + h <= box.top ||
    el.top >= box.top + box.height
  );
}

function parseDesign(designData) {
  if (!designData) return null;
  try {
    const d = typeof designData === "string" ? JSON.parse(designData) : designData;
    return Array.isArray(d?.elements) && d.elements.length ? d : null;
  } catch {
    return null;
  }
}

/**
 * Render the certificate to a PDF, store it under the storage dir, persist the
 * relative path on the record, and return that path.
 */
export async function renderPdf(cert) {
  const html = await buildHtml(cert);

  // Acquire a page, relaunching once if the browser connection dropped.
  let page;
  try {
    page = await (await getBrowser()).newPage();
  } catch {
    browserPromise = null;
    page = await (await getBrowser()).newPage();
  }

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
