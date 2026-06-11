import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { parse as parseCsv } from "csv-parse/sync";
import { prisma } from "../db/prisma.js";
import { issueCertificate, PlanLimitError } from "../services/certificateIssuer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storageDir = path.join(__dirname, "../../storage/uploads");

// Ensure upload dir exists
fs.mkdirSync(storageDir, { recursive: true });

/**
 * POST /batches
 * Accepts multipart/form-data with:
 *   file: Excel (.xlsx/.xls) or CSV
 *   name: batch name (optional)
 *   templateId: template UUID (optional)
 *   courseName: default course name for all rows (optional)
 *
 * Required columns (case-insensitive): name OR recipient_name
 * Optional columns: email, course_name / course
 */
export async function createBatch(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "يرجى رفع ملف Excel أو CSV." });
    }

    const rows = await parseFile(req.file);
    if (rows.length === 0) {
      return res.status(400).json({ message: "الملف فارغ أو لا يحتوي على بيانات صالحة." });
    }
    if (rows.length > 500) {
      return res.status(400).json({ message: "الحد الأقصى 500 صف في كل دفعة." });
    }

    const organization = req.organization;
    const batchName = req.body.name?.trim() || `دفعة ${new Date().toLocaleDateString("ar-SA")}`;
    const defaultCourse = req.body.courseName?.trim() || null;
    const templateId = req.body.templateId?.trim() || null;

    // Create the batch record first
    const batch = await prisma.batch.create({
      data: {
        id: crypto.randomUUID(),
        organizationId: organization.id,
        name: batchName,
        templateId: templateId || null,
        totalCount: rows.length,
        status: "processing",
        createdBy: req.user.id,
      },
    });

    // Process certificates asynchronously (non-blocking response)
    processBatchAsync(batch.id, rows, organization, defaultCourse, templateId);

    return res.status(202).json({
      message: "جارٍ معالجة الدفعة…",
      batchId: batch.id,
      total: rows.length,
    });
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return res.status(402).json({ message: err.message });
    }
    console.error("[createBatch]", err);
    return res.status(500).json({ message: "حدث خطأ أثناء رفع الدفعة." });
  }
}

/**
 * GET /batches
 * List batches for the authenticated org
 */
export async function listBatches(req, res) {
  try {
    const batches = await prisma.batch.findMany({
      where: { organizationId: req.organization.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        totalCount: true,
        successCount: true,
        failedCount: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
    });
    return res.json({ data: batches });
  } catch (err) {
    console.error("[listBatches]", err);
    return res.status(500).json({ message: "حدث خطأ." });
  }
}

/**
 * GET /batches/:id
 * Get batch details + certificate list
 */
export async function getBatch(req, res) {
  try {
    const batch = await prisma.batch.findFirst({
      where: { id: req.params.id, organizationId: req.organization.id },
      include: {
        certificates: {
          select: {
            id: true,
            recipientName: true,
            recipientEmail: true,
            courseName: true,
            verificationCode: true,
            status: true,
            pdfUrl: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!batch) return res.status(404).json({ message: "الدفعة غير موجودة." });
    return res.json(batch);
  } catch (err) {
    console.error("[getBatch]", err);
    return res.status(500).json({ message: "حدث خطأ." });
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Parse an uploaded xlsx or csv file into normalised row objects.
 * Uses exceljs (xlsx) and csv-parse (csv) — both free of the Prototype
 * Pollution / ReDoS vulnerabilities present in the old `xlsx` package.
 */
async function parseFile(file) {
  const isCsv =
    file.mimetype === "text/csv" ||
    file.mimetype === "application/csv" ||
    file.originalname.match(/\.csv$/i);

  const raw = isCsv ? parseCsvBuffer(file.buffer) : await parseXlsxBuffer(file.buffer);

  return raw
    .map((row) => {
      const norm = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [String(k).trim().toLowerCase(), String(v ?? "").trim()])
      );
      const name =
        norm["name"] ||
        norm["recipient_name"] ||
        norm["الاسم"] ||
        norm["اسم المتدرب"] ||
        "";
      if (!name) return null;
      return {
        recipientName: name,
        recipientEmail: norm["email"] || norm["البريد"] || undefined,
        courseName:
          norm["course_name"] ||
          norm["course"] ||
          norm["الدورة"] ||
          norm["اسم الدورة"] ||
          undefined,
      };
    })
    .filter(Boolean);
}

/** Read the first sheet of an xlsx buffer; return array of plain objects. */
async function parseXlsxBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const rows = [];
  let headers = null;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // ExcelJS row.values is 1-indexed; index 0 is always null.
    const vals = row.values.slice(1).map(cellText);
    if (rowNumber === 1) {
      headers = vals;
    } else if (headers) {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
      rows.push(obj);
    }
  });

  return rows;
}

/** Safely stringify an ExcelJS cell value (handles rich text, formulas, dates). */
function cellText(v) {
  if (v == null) return "";
  if (typeof v === "object") {
    if (v.result !== undefined) return String(v.result); // formula result
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join(""); // rich text
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v).trim();
}

/** Parse a CSV buffer; return array of plain objects keyed by header row. */
function parseCsvBuffer(buffer) {
  try {
    return parseCsv(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (e) {
    console.warn("[parseCsvBuffer] parse error:", e.message);
    return [];
  }
}

async function processBatchAsync(batchId, rows, organization, defaultCourse, templateId) {
  let successCount = 0;
  let failedCount = 0;

  for (const row of rows) {
    try {
      await issueCertificate(
        organization,
        {
          ...row,
          courseName: row.courseName || defaultCourse || undefined,
          templateId: templateId || undefined,
          batchId,
        },
        true // render PDF for each
      );
      successCount++;
    } catch (err) {
      failedCount++;
      console.error(`[batch ${batchId}] Failed for "${row.recipientName}":`, err.message);
    }
  }

  await prisma.batch.update({
    where: { id: batchId },
    data: {
      successCount,
      failedCount,
      status: failedCount === rows.length ? "failed" : "completed",
      completedAt: new Date(),
    },
  });
}
