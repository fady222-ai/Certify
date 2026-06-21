import QRCode from "qrcode";
import { prisma } from "../db/prisma.js";
import { verifyUrl } from "../services/certificateRenderer.js";

/**
 * GET /api/verify/:code/qr.png — public QR image (PNG) encoding the certificate's
 * verification URL. Lets the verification page (and shares) render a scannable
 * code via a plain <img>, reusing the existing `qrcode` dependency.
 */
export async function certificateQr(req, res) {
  const { code } = req.params;

  const cert = await prisma.certificate.findUnique({
    where: { verificationCode: code },
    select: { id: true },
  });
  if (!cert) return res.status(404).json({ message: "لم يتم العثور على شهادة بهذا الرمز." });

  const png = await QRCode.toBuffer(verifyUrl(code), {
    type: "png",
    margin: 1,
    width: 320,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.send(png);
}
