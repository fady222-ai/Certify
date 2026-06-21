import { prisma } from "../db/prisma.js";

/**
 * كم حدثاً نُبقي لكل شهادة في سجلّ النشاط. الأقدم يُحذف تلقائياً تخفيفاً للقاعدة.
 */
export const EVENT_RETENTION = 5;

/**
 * يُبقي آخر `keep` أحداث (الأحدث زمنياً) للشهادة ويحذف الباقي. آمن إذا كانت
 * الأحداث ≤ keep (لا يحذف شيئاً). `client` يسمح بتمرير معاملة (tx) أو prisma.
 */
export async function pruneCertificateEvents(client, certificateId, keep = EVENT_RETENTION) {
  const survivors = await client.certificateEvent.findMany({
    where: { certificateId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
    take: keep,
  });
  await client.certificateEvent.deleteMany({
    where: { certificateId, id: { notIn: survivors.map((s) => s.id) } },
  });
}

/**
 * ينشئ حدثاً للشهادة ثم يُقلّم السجلّ لآخر `EVENT_RETENTION` أحداث. مخصّص للاستدعاء
 * best-effort (`.catch(() => {})`) كما هي عادة تسجيل الأحداث.
 */
export async function logCertificateEvent(certificateId, eventType, data = {}) {
  const event = await prisma.certificateEvent.create({
    data: { certificateId, eventType, ...data },
  });
  await pruneCertificateEvents(prisma, certificateId);
  return event;
}
