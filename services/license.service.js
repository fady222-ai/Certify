// server/services/license.service.js
// سيرفر الكيان — يتصل بالسيرفر المركزي للتحقق من التراخيص
'use strict';

const db  = require('../repositories/db.repository');
const { validationError } = require('../middleware/error.middleware');

const PLANS = {
  free: { max_branches: 2,   label: 'مجاني',   federation: false },
  pro:  { max_branches: 999, label: 'احترافي', federation: true  },
};

// ── التحقق من الترخيص عبر السيرفر المركزي ────────────────
// serverUrl: رابط هذا السيرفر — يُرسَل للمركزي لتسجيله في الدليل
async function validateLicenseKey(key, serverUrl = '') {
  if (!key?.trim()) return { valid: false, reason: 'missing', message: 'كود التفعيل مطلوب' };

  const centralUrl = process.env.CENTRAL_SERVER_URL;
  if (!centralUrl) {
    return { valid: false, reason: 'no_central', message: 'لم يُضبط رابط السيرفر المركزي (CENTRAL_SERVER_URL)' };
  }

  try {
    const params = new URLSearchParams({ key: key.trim() });
    if (serverUrl) params.set('server_url', serverUrl);
    const res = await fetch(`${centralUrl}/api/licenses/validate?${params}`);
    if (!res.ok) return { valid: false, reason: 'central_error', message: 'تعذّر الاتصال بسيرفر التحقق' };
    return await res.json();
  } catch (err) {
    console.error('[license] Central server unreachable:', err.message);
    return { valid: false, reason: 'network', message: 'تعذّر الاتصال بسيرفر التراخيص. تحقق من الاتصال.' };
  }
}

// ── تفعيل هذا السيرفر (يُستدعى من داشبورد الأدمن مرة واحدة) ──
async function activateServer(key, serverUrl = '') {
  const result = await validateLicenseKey(key, serverUrl);
  if (!result.valid) throw validationError(result.message);

  return db.serverLicense.activate({
    license_key:  key.trim(),
    entity_id:    result.entity_id,
    entity_name:  result.entity_name,
    plan:         result.plan,
    max_branches: result.max_branches,
    expires_at:   result.expires_at,
  });
}

// ── جلب حالة تفعيل هذا السيرفر ──────────────────────────
function getServerStatus() {
  const sl = db.serverLicense.get();
  if (!sl || sl.status !== 'active') return { activated: false };
  if (sl.expires_at && new Date(sl.expires_at) < new Date())
    return { activated: false, reason: 'expired' };
  return {
    activated:    true,
    entity_id:    sl.entity_id,
    entity_name:  sl.entity_name,
    plan:         sl.plan,
    plan_label:   PLANS[sl.plan]?.label || sl.plan,
    max_branches: sl.max_branches,
    federation:   PLANS[sl.plan]?.federation ?? false,
    expires_at:   sl.expires_at,
    activated_at: sl.activated_at,
  };
}

// ── التحقق عند إضافة فرع جديد ────────────────────────────
function checkBranchLimit() {
  const status = getServerStatus();
  if (!status.activated) throw validationError('السيرفر غير مفعَّل. يرجى إدخال كود التفعيل من داشبورد الأدمن.');

  // الحد على الفروع فقط (المخازن غير محدودة)
  const branchCount = db.users.findAll().filter(u => u.type === 'branch').length;
  if (branchCount >= status.max_branches) {
    throw validationError(
      `وصلت للحد الأقصى من الفروع في باقة "${status.plan_label}" (${status.max_branches}). يرجى الترقية إلى الباقة الاحترافية.`
    );
  }
}

function getAllPlans() {
  return Object.entries(PLANS).map(([key, val]) => ({ key, ...val }));
}

// ── فرض حد الفروع عند Downgrade ────────────────────────
// السياسة: الفروع الأقدم created_at تبقى. الزائدة تُعطَّل (is_active=0)
// تُرجَع قائمة المعطَّلين ليطردهم socket handler
function enforceBranchLimit() {
  const sl = db.serverLicense.get();
  if (!sl) return { deactivated: [], limit: 0 };
  const limit = sl.max_branches || 0;
  const branches = db.users.findAll().filter(u => u.type === 'branch' && u.is_active === 1);
  if (branches.length <= limit) return { deactivated: [], limit, active: branches.length };

  const sorted = branches.slice().sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  const toDeactivate = sorted.slice(limit);
  toDeactivate.forEach(b => db.users.updateActive(b.id, 0));
  return {
    deactivated: toDeactivate.map(b => ({ id: b.id, name: b.name })),
    limit,
    active: limit,
  };
}

// ── مزامنة مع المركزي (heartbeat) ──────────────────────
// يُحدِّث server_url في المركزي ويعالج السيرفرات القديمة التي لا تحوي entity_id
async function runHeartbeat(getServerUrl, forceLogoutFn = null) {
  const sl = db.serverLicense.get();
  if (!sl?.license_key || sl.status !== 'active') {
    return { ok: false, reason: 'not_activated' };
  }
  const serverUrl = (typeof getServerUrl === 'function') ? getServerUrl() : getServerUrl;
  const result = await validateLicenseKey(sl.license_key, serverUrl);
  if (!result.valid) {
    console.warn('[heartbeat] فشل التحقق:', result.message);
    return { ok: false, reason: result.reason, message: result.message };
  }
  const changed = (
    sl.entity_id   !== result.entity_id  ||
    sl.entity_name !== result.entity_name ||
    sl.plan        !== result.plan       ||
    sl.max_branches!== result.max_branches
  );
  const isDowngrade = changed && (
    (sl.plan === 'pro' && result.plan === 'free') ||
    (result.max_branches < sl.max_branches)
  );
  if (changed) {
    db.serverLicense.activate({
      license_key:  sl.license_key,
      entity_id:    result.entity_id,
      entity_name:  result.entity_name,
      plan:         result.plan,
      max_branches: result.max_branches,
      expires_at:   result.expires_at,
    });
    console.log('[heartbeat] تم تحديث بيانات الكيان من المركزي');
  }

  // عند Downgrade — طبّق حد الفروع وأخرج الجلسات الزائدة
  let enforced = null;
  if (isDowngrade) {
    enforced = enforceBranchLimit();
    if (enforced.deactivated.length) {
      console.warn(`[heartbeat] downgrade — تم تعطيل ${enforced.deactivated.length} فرع`);
      if (typeof forceLogoutFn === 'function') {
        enforced.deactivated.forEach(b => {
          try { forceLogoutFn(b.id, 'plan_downgrade'); } catch {}
        });
      }
    }
  }

  return { ok: true, entity_id: result.entity_id, server_url: serverUrl, changed, enforced };
}

let _hbTimer = null;
function startHeartbeat(getServerUrl, intervalMs = 6 * 60 * 60 * 1000, forceLogoutFn = null) {
  setTimeout(() => {
    runHeartbeat(getServerUrl, forceLogoutFn).catch(e => console.warn('[heartbeat] خطأ:', e.message));
  }, 30 * 1000);
  if (_hbTimer) clearInterval(_hbTimer);
  _hbTimer = setInterval(() => {
    runHeartbeat(getServerUrl, forceLogoutFn).catch(e => console.warn('[heartbeat] خطأ:', e.message));
  }, intervalMs);
}

// ── تشخيص حالة federation ──────────────────────────────
async function getDiagnostics(getServerUrl) {
  const sl = db.serverLicense.get();
  const serverUrl = (typeof getServerUrl === 'function') ? getServerUrl() : getServerUrl;
  const central = process.env.CENTRAL_SERVER_URL;

  const out = {
    activated:           sl?.status === 'active',
    entity_id_present:   !!sl?.entity_id,
    entity_id:           sl?.entity_id || null,
    plan:                sl?.plan || null,
    server_url_local:    serverUrl || null,
    central_url:         central || null,
    central_reachable:   false,
    server_url_registered: false,
    can_generate_codes:  false,
  };

  if (!central) return out;

  // فحص الاتصال بالمركزي وحالة التسجيل
  try {
    if (sl?.entity_id) {
      const res = await fetch(`${central.replace(/\/$/, '')}/api/entity/${encodeURIComponent(sl.entity_id)}`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json().catch(() => ({}));
      out.central_reachable     = res.ok && data.ok === true;
      out.server_url_registered = out.central_reachable && data.server_url === serverUrl;
    } else if (sl?.license_key) {
      const res = await fetch(`${central.replace(/\/$/, '')}/api/licenses/validate?key=${encodeURIComponent(sl.license_key)}`, {
        signal: AbortSignal.timeout(5000),
      });
      out.central_reachable = res.ok;
    }
  } catch (e) {
    out.central_error = e.message;
  }

  out.can_generate_codes = out.activated && out.entity_id_present;
  return out;
}

module.exports = {
  validateLicenseKey, activateServer,
  getServerStatus, checkBranchLimit, getAllPlans,
  runHeartbeat, startHeartbeat, getDiagnostics,
  enforceBranchLimit,
};
