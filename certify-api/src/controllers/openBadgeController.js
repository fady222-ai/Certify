import { prisma } from "../db/prisma.js";
import {
  buildCredential,
  signCredentialJwt,
  issuerProfile,
  issuerJwks,
} from "../services/openBadge.js";

/**
 * GET /api/verify/:code/openbadge — return the certificate as an Open Badges 3.0
 * Verifiable Credential (JSON-LD) plus its signed VC-JWT. Public.
 *
 * `?format=jwt` returns the raw compact VC-JWT as a downloadable token instead.
 */
export async function getCredential(req, res) {
  const { code } = req.params;

  const cert = await prisma.certificate.findUnique({
    where: { verificationCode: code },
    include: { organization: true },
  });
  if (!cert) return res.status(404).json({ message: "لم يتم العثور على شهادة بهذا الرمز." });

  // A revoked certificate must not yield a valid signed credential.
  if (cert.status === "revoked") {
    return res.status(409).json({ message: "هذه الشهادة ملغاة." });
  }

  const credential = buildCredential(cert, cert.organization);
  const jwt = signCredentialJwt(credential);

  if (req.query.format === "jwt") {
    res.setHeader("Content-Type", "application/vc+jwt");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="certificate-${code}.jwt"`,
    );
    return res.send(jwt);
  }

  return res.json({ credential, jwt });
}

/** GET /api/credentials/issuer — public OB 3.0 issuer profile. */
export async function getIssuerProfile(_req, res) {
  // Single-platform issuer: the profile carries the platform identity. (Per-org
  // issuer identity can be layered later via did:web subdomains.)
  return res.json(issuerProfile(null));
}

/** GET /api/credentials/issuer/jwks.json — public keys for VC-JWT verification. */
export async function getIssuerJwks(_req, res) {
  return res.json(issuerJwks());
}
