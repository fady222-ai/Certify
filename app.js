// app.js — نقطة الدخول الرئيسية
'use strict';

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const helmet     = require('helmet');
const path       = require('path');
const rl         = require('./middleware/rate-limit.middleware');

const cfg        = require('./config');
const db         = require('./repositories/db.repository');
const { initSocket, forceLogout } = require('./socket/socket.handler');
const { errorHandler } = require('./middleware/error.middleware');
const licSvc    = require('./services/license.service');
const fedSvc    = require('./services/federation.service');

// ── Routes ───────────────────────────────────────────────
const authRoutes     = require('./routes/auth.routes');
const userRoutes     = require('./routes/users.routes');
const msgRoutes      = require('./routes/messages.routes');
const fileRoutes     = require('./routes/files.routes');
const keysRoutes     = require('./routes/keys.routes');
const qrRoutes       = require('./routes/qr.routes');
const adminRoutes    = require('./routes/admin.routes');
const licenseRoutes     = require('./routes/license.routes');
const federationRoutes  = require('./routes/federation.routes');
const extRoutes         = require('./routes/ext.routes');

// ── تهيئة قاعدة البيانات ─────────────────────────────────
db.init();

// ── إنشاء التطبيق ────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] },
  ...cfg.socket,
});

// ── Middleware ────────────────────────────────────────────
// Trust X-Forwarded-* (Railway/proxy) — لازم لـ rate limit حسب IP الحقيقي
app.set('trust proxy', 1);

app.use(helmet({
  // الداشبورد يستخدم inline styles — CSP صارم سيحتاج refactor، نُبقيه معطّلاً مؤقتاً
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/api', rl.general);

// ── تخزين io و onlineUsers في app للوصول من الـ routes ──
app.set('io', io);
const onlineUsers = initSocket(io);
app.set('onlineUsers', onlineUsers);

// ── مسارات الصحة والجذر ──────────────────────────────────
app.get('/',       (_, res) => res.json({ app: 'Branch Chat', version: '2.0.0', status: 'running' }));
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── API Routes ────────────────────────────────────────────
// ── مسارات مستقلة (قبل /api) ────────────────────────────
app.get('/mobile', (_, res) => res.sendFile(path.join(__dirname, 'mobile-upload.html')));
app.get('/admin',  (_, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ── مسارات API ────────────────────────────────────────────
app.use('/api',          authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/messages', msgRoutes);
app.use('/api',          fileRoutes);
app.use('/api/keys',     keysRoutes);
app.use('/api',          qrRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/federation', federationRoutes); // server-to-server
app.use('/api/ext',        extRoutes);        // client → local server
app.use('/',               licenseRoutes);

// ── معالجة الأخطاء (يجب أن تكون آخر middleware) ──────────
app.use(errorHandler);

// ── تشغيل السيرفر ────────────────────────────────────────
server.listen(cfg.port, () => {
  console.log(`\n🚀 Branch Chat Server v2.0.0`);
  console.log(`📡 Port: ${cfg.port}`);
  console.log(`💾 DB:   ${cfg.db.path}`);
  console.log(`📁 Uploads: ${cfg.storage.localDir}`);

  if (!process.env.CENTRAL_SERVER_URL) {
    console.warn('⚠️  CENTRAL_SERVER_URL غير مضبوط — التفعيل وlookup الخارجي سيفشلان');
  } else {
    console.log(`🔗 Central: ${process.env.CENTRAL_SERVER_URL}`);
  }
  console.log();

  // مزامنة دورية مع المركزي + طرد الفروع الزائدة عند Downgrade
  licSvc.startHeartbeat(
    () => fedSvc.getOwnServerUrl(),
    6 * 60 * 60 * 1000,
    forceLogout,
  );
});
