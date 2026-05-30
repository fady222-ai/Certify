// services/federation.service.js
// التواصل P2P بين السيرفرات — كود قصير: BC-ABCD.userId.signature
'use strict';

const crypto = require('crypto');
const db     = require('../repositories/db.repository');
const licSvc = require('./license.service');
const { validationError } = require('../middleware/error.middleware');

// ── ذاكرة مؤقتة لرابط هذا السيرفر ────────────────────────
let _cachedServerUrl = '';

function getOwnServerUrl() {
  if (_cachedServerUrl) return _cachedServerUrl;
  if (process.env.SERVER_URL) {
    _cachedServerUrl = process.env.SERVER_URL.replace(/\/$/, '');
    return _cachedServerUrl;
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    _cachedServerUrl = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    return _cachedServerUrl;
  }
  return '';
}

function rememberServerUrlFromRequest(req) {
  if (_cachedServerUrl) return;
  if (process.env.SERVER_URL || process.env.RAILWAY_PUBLIC_DOMAIN) return;
  const host  = req.get('host');
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
  if (host) _cachedServerUrl = `${proto}://${host}`.replace(/\/$/, '');
}

// ── ذاكرة مؤقتة: entity_id → server_url (لتفادي طلبات متكررة للمركزي) ─
const _entityCache = new Map();
const ENTITY_CACHE_TTL = 5 * 60 * 1000; // 5 دقائق

async function resolveEntity(entityId) {
  const cached = _entityCache.get(entityId);
  if (cached && Date.now() - cached.at < ENTITY_CACHE_TTL) return cached.data;

  const central = process.env.CENTRAL_SERVER_URL;
  if (!central) throw validationError('السيرفر المركزي غير مضبوط');

  const res = await fetch(`${central.replace(/\/$/, '')}/api/entity/${encodeURIComponent(entityId)}`, {
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw validationError(data.error || 'الكيان غير موجود في السجل المركزي');

  _entityCache.set(entityId, { at: Date.now(), data });
  return data;
}

// ── سر التوقيع (مفتاح الترخيص نفسه) ──────────────────────
function getServerSecret() {
  const sl = db.serverLicense.get();
  return sl?.license_key || process.env.SERVER_SECRET || 'default_secret_change_me';
}

// ── توليد كود اتصال قصير: BC-ABCD.userId.sig ─────────────
function generateContactCode(userId) {
  const user = db.users.findById(userId);
  if (!user) throw validationError('المستخدم غير موجود');

  const sl = db.serverLicense.get();
  if (!sl?.entity_id) throw validationError(
    'السيرفر مفعَّل لكن لا يحوي معرّف الكيان. اضغط "إعادة المزامنة مع المركزي" من داشبورد الأدمن لإصلاح ذلك.'
  );

  const payload = `${sl.entity_id}.${userId}`;
  const sig = crypto.createHmac('sha256', getServerSecret())
                    .update(payload).digest('hex').slice(0, 8);
  return `${payload}.${sig}`;
}

// ── فك تشفير الكود: BC-ABCD.userId.sig → { entity_id, user_id, sig } ─
function decodeContactCode(code) {
  const parts = (code || '').trim().split('.');
  if (parts.length !== 3) return null;
  const [entity_id, userIdStr, sig] = parts;
  if (!/^[A-Z0-9-]+$/i.test(entity_id)) return null;
  const user_id = parseInt(userIdStr, 10);
  if (!user_id || !sig) return null;
  return { entity_id: entity_id.toUpperCase(), user_id, sig };
}

// ── التحقق من Pro ────────────────────────────────────────
function requirePro() {
  const status = licSvc.getServerStatus();
  if (!status.activated)     throw validationError('السيرفر غير مفعَّل');
  if (status.plan !== 'pro') throw validationError('هذه الميزة متاحة للباقة الاحترافية فقط. يرجى الترقية.');
}

// ── lookup عن جهة (preview قبل إرسال الطلب) ──────────────
async function lookupContact(code) {
  const decoded = decodeContactCode(code);
  if (!decoded) throw validationError('كود الاتصال غير صحيح');

  const sl = db.serverLicense.get();
  if (sl?.entity_id === decoded.entity_id)
    throw validationError('لا يمكن إضافة جهة اتصال من نفس الكيان');

  // 1) سؤال المركزي عن رابط الكيان
  const entity = await resolveEntity(decoded.entity_id);

  // 2) سؤال سيرفر الكيان عن الفرع/المخزن
  let acc = { user_name: '', user_type: '', verified: false };
  try {
    const res = await _fetchRemote(entity.server_url, '/api/federation/lookup', { code });
    if (res?.ok) acc = { user_name: res.user_name || '', user_type: res.user_type || '', verified: true };
  } catch {}

  return {
    server_url: entity.server_url,
    entity_id:  decoded.entity_id,
    entity:     entity.entity_name,
    user_id:    decoded.user_id,
    user_name:  acc.user_name,
    user_type:  acc.user_type,
    verified:   acc.verified,
  };
}

// ── إرسال طلب تواصل لسيرفر آخر ───────────────────────────
async function sendContactRequest(localUserId, targetCode) {
  const decoded = decodeContactCode(targetCode);
  if (!decoded) throw validationError('كود الاتصال غير صحيح');

  const localUser = db.users.findById(localUserId);
  if (!localUser) throw validationError('المستخدم غير موجود');

  if (db.externalContacts.findByRemoteCode(targetCode))
    throw validationError('أنت متصل بهذه الجهة مسبقاً');

  const existing = db.externalContacts.findRequestByRemoteCode(targetCode, 'outgoing');
  if (existing?.status === 'pending')
    throw validationError('تم إرسال طلب مسبقاً لهذه الجهة');

  const entity  = await resolveEntity(decoded.entity_id);
  const myCode  = generateContactCode(localUserId);
  const status  = licSvc.getServerStatus();

  try {
    await _fetchRemote(entity.server_url, '/api/federation/request', {
      from_code:   myCode,
      from_name:   localUser.name,
      from_entity: status.entity_name || '',
      from_server: getOwnServerUrl(),
      to_code:     targetCode,
    });
  } catch {}

  db.externalContacts.createRequest({
    direction:      'outgoing',
    local_user_id:  localUserId,
    remote_name:    `${entity.entity_name} — مستخدم #${decoded.user_id}`,
    remote_user_id: decoded.user_id,
    remote_server:  entity.server_url,
    remote_code:    targetCode,
  });

  return { ok: true, remote_name: entity.entity_name };
}

// ── قبول طلب ─────────────────────────────────────────────
async function acceptRequest(localUserId, requestId) {
  const req = db.externalContacts.findRequest(requestId);
  if (!req || req.local_user_id !== localUserId) throw validationError('الطلب غير موجود');
  if (req.status !== 'pending') throw validationError('تم الرد على هذا الطلب مسبقاً');

  db.externalContacts.updateRequest(requestId, 'accepted');
  db.externalContacts.addContact({
    local_user_id:  localUserId,
    remote_name:    req.remote_name,
    remote_user_id: req.remote_user_id,
    remote_server:  req.remote_server,
    remote_code:    req.remote_code,
  });

  const myCode    = generateContactCode(localUserId);
  const localUser = db.users.findById(localUserId);
  const status    = licSvc.getServerStatus();

  try {
    await _fetchRemote(req.remote_server, '/api/federation/accepted', {
      from_code:   myCode,
      from_name:   localUser.name,
      from_entity: status.entity_name || '',
      from_server: getOwnServerUrl(),
      to_code:     req.remote_code,
    });
  } catch {}

  return { ok: true };
}

// ── رفض طلب ──────────────────────────────────────────────
function rejectRequest(localUserId, requestId) {
  const req = db.externalContacts.findRequest(requestId);
  if (!req || req.local_user_id !== localUserId) throw validationError('الطلب غير موجود');
  db.externalContacts.updateRequest(requestId, 'rejected');
  return { ok: true };
}

// ── إرسال رسالة خارجية ───────────────────────────────────
async function sendExternalMessage({ localUserId, remoteCode, text }) {
  if (!text?.trim()) throw validationError('النص مطلوب');

  const contact = db.externalContacts.findByRemoteCode(remoteCode);
  if (!contact || contact.local_user_id !== localUserId)
    throw validationError('جهة الاتصال غير موجودة');

  const localUser = db.users.findById(localUserId);
  const myCode    = generateContactCode(localUserId);

  await _fetchRemote(contact.remote_server, '/api/federation/message', {
    from_code: myCode,
    from_name: localUser.name,
    to_code:   remoteCode,
    text:      text.trim(),
  });

  return db.externalContacts.saveExtMsg({
    local_user_id: localUserId,
    remote_code:   remoteCode,
    remote_name:   contact.remote_name,
    from_remote:   false,
    text:          text.trim(),
  });
}

// ── HTTP helper موحَّد ────────────────────────────────────
async function _fetchRemote(serverUrl, endpoint, body) {
  if (!serverUrl) throw new Error('عنوان السيرفر المقصود غير معروف');
  const url = serverUrl.replace(/\/$/, '') + endpoint;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-federation': '1' },
    body:    JSON.stringify(body || {}),
    signal:  AbortSignal.timeout(8000),
  });
  return await res.json();
}

module.exports = {
  generateContactCode,
  decodeContactCode,
  lookupContact,
  sendContactRequest,
  acceptRequest,
  rejectRequest,
  sendExternalMessage,
  requirePro,
  getOwnServerUrl,
  rememberServerUrlFromRequest,
};
