import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { config } from "../config/index.js";
import { verifyUrl } from "../services/certificateRenderer.js";
import { sendEmail, logMailFailure } from "../services/email/index.js";
import { walletLinkEmail } from "../services/email/walletTemplates.js";

// The trainee certificate wallet: a passwordless, account-free way for a
// recipient to access every certificate issued to their email across academies.
// Access is a signed, expiring capability token emailed ONLY to that address —
// so possession of the link proves control of the email (no enumeration: the
// request endpoint always responds the same whether or not certs exist).

const WALLET_TTL = "7d";

const requestSchema = z.object({
  email: z.string().trim().email("بريد إلكتروني غير صالح.").max(160),
});

function signWalletToken(email) {
  return jwt.sign({ typ: "wallet", email: email.toLowerCase() }, config.appKey, {
    expiresIn: WALLET_TTL,
    algorithm: "HS256",
  });
}

function walletUrl(token) {
  return `${config.verifyBaseUrl.replace(/\/$/, "")}/wallet/${token}`;
}

function pdfAbsoluteUrl(pdfUrl) {
  if (!pdfUrl) return null;
  if (/^https?:\/\//i.test(pdfUrl)) return pdfUrl;
  return `${config.appUrl.replace(/\/$/, "")}/storage/${pdfUrl}`;
}

/** POST /api/wallet/request — email a magic link if any certs match (generic response). */
export async function requestWalletLink(req, res, next) {
  try {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ message: parsed.error.issues[0]?.message ?? "بيانات غير صالحة." });
    }
    const email = parsed.data.email.toLowerCase();

    // Count non-revoked certs for this email; only send if there's something to show.
    const count = await prisma.certificate.count({
      where: { recipientEmail: email, status: { not: "revoked" } },
    });
    if (count > 0) {
      const msg = walletLinkEmail({ url: walletUrl(signWalletToken(email)), count });
      sendEmail({ to: email, ...msg }).catch(logMailFailure(`wallet link to ${email}`));
    }

    // Generic response either way — never reveal whether the email has certs.
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/wallet/:token — list the wallet's certificates (token proves email ownership). */
export async function getWallet(req, res, next) {
  try {
    let payload;
    try {
      payload = jwt.verify(req.params.token, config.appKey, { algorithms: ["HS256"] });
    } catch {
      return res.status(401).json({ message: "انتهت صلاحية الرابط أو أنه غير صالح." });
    }
    if (payload.typ !== "wallet" || !payload.email) {
      return res.status(401).json({ message: "رابط غير صالح." });
    }

    const certs = await prisma.certificate.findMany({
      where: { recipientEmail: payload.email, status: { not: "revoked" } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        recipientName: true,
        courseName: true,
        verificationCode: true,
        issueDate: true,
        pdfUrl: true,
        organization: { select: { name: true } },
      },
    });

    return res.json({
      email: payload.email,
      certificates: certs.map((c) => ({
        recipient_name: c.recipientName,
        course_name: c.courseName,
        organization_name: c.organization?.name ?? null,
        verification_code: c.verificationCode,
        issue_date: c.issueDate,
        verify_url: verifyUrl(c.verificationCode),
        pdf_url: pdfAbsoluteUrl(c.pdfUrl),
      })),
    });
  } catch (err) {
    return next(err);
  }
}
