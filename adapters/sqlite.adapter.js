// adapters/sqlite.adapter.js
// الطبقة الوحيدة التي تعرف أن قاعدة البيانات هي SQLite
// لتبديلها بـ PostgreSQL: أنشئ postgres.adapter.js بنفس الواجهة
'use strict';

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');
const cfg      = require('../config');

let db = null;

function getDB() {
  if (db) return db;

  // التأكد من وجود مجلد البيانات (Persistent Volume)
  const dir = path.dirname(cfg.db.path);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(cfg.db.path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

// ── تهيئة الجداول ────────────────────────────────────────
function init() {
  const db = getDB();
  const bcrypt = require('bcryptjs');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      type       TEXT    NOT NULL CHECK(type IN ('branch','store')),
      password   TEXT    NOT NULL,
      public_key TEXT,
      is_active  INTEGER DEFAULT 1,
      last_seen  TEXT,
      created_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id    INTEGER NOT NULL REFERENCES users(id),
      to_id      INTEGER NOT NULL REFERENCES users(id),
      text       TEXT    NOT NULL DEFAULT '',
      msg_type   TEXT    NOT NULL DEFAULT 'text',
      file_url   TEXT,
      file_name  TEXT,
      file_size  INTEGER,
      duration   INTEGER,
      is_read    INTEGER DEFAULT 0,
      is_edited  INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      edited_at  TEXT,
      created_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_msg_from ON messages(from_id);
    CREATE INDEX IF NOT EXISTS idx_msg_to   ON messages(to_id);
    CREATE INDEX IF NOT EXISTS idx_msg_date ON messages(created_at);

    CREATE TABLE IF NOT EXISTS admin (
      id       INTEGER PRIMARY KEY CHECK(id = 1),
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS server_license (
      id           INTEGER PRIMARY KEY CHECK(id = 1),
      license_key  TEXT,
      entity_id    TEXT,
      entity_name  TEXT,
      plan         TEXT CHECK(plan IN ('free','pro')),
      max_branches INTEGER,
      expires_at   TEXT,
      activated_at TEXT,
      status       TEXT DEFAULT 'inactive'
    );

    CREATE TABLE IF NOT EXISTS external_contacts (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      local_user_id  INTEGER NOT NULL REFERENCES users(id),
      remote_name    TEXT,
      remote_user_id INTEGER,
      remote_server  TEXT,
      remote_code    TEXT UNIQUE,
      status         TEXT DEFAULT 'active',
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contact_requests (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      direction      TEXT    NOT NULL CHECK(direction IN ('incoming','outgoing')),
      local_user_id  INTEGER NOT NULL REFERENCES users(id),
      remote_name    TEXT,
      remote_user_id INTEGER,
      remote_server  TEXT,
      remote_code    TEXT,
      status         TEXT DEFAULT 'pending',
      created_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_audit (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      action     TEXT NOT NULL,
      ip         TEXT,
      ua         TEXT,
      success    INTEGER DEFAULT 1,
      meta       TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_date ON admin_audit(created_at);

    CREATE TABLE IF NOT EXISTS external_messages (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      local_user_id INTEGER NOT NULL REFERENCES users(id),
      remote_code   TEXT    NOT NULL,
      remote_name   TEXT,
      from_remote   INTEGER DEFAULT 0,
      text          TEXT    NOT NULL DEFAULT '',
      msg_type      TEXT    DEFAULT 'text',
      file_url      TEXT,
      file_name     TEXT,
      file_size     INTEGER,
      is_read       INTEGER DEFAULT 0,
      created_at    TEXT    DEFAULT (datetime('now'))
    );
  `);

  // ترقية الجداول القديمة بأمان
  ['public_key','is_active','last_seen'].forEach(col => {
    try { db.exec(`ALTER TABLE users ADD COLUMN ${col} ${col === 'is_active' ? 'INTEGER DEFAULT 1' : 'TEXT'}`); }
    catch {}
  });
  [
    'ALTER TABLE messages ADD COLUMN is_edited  INTEGER DEFAULT 0',
    'ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0',
    'ALTER TABLE messages ADD COLUMN edited_at  TEXT',
    'ALTER TABLE messages ADD COLUMN duration   INTEGER',
    'ALTER TABLE server_license ADD COLUMN entity_id TEXT',
  ].forEach(sql => { try { db.exec(sql); } catch {} });

  // بيانات افتراضية
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount === 0) {
    const hash = bcrypt.hashSync('1234', 10);
    const ins  = db.prepare('INSERT INTO users (name, type, password) VALUES (?, ?, ?)');
    const seed = db.transaction(() => {
      [
        ['الفرع الأول',    'branch'],
        ['الفرع الثاني',   'branch'],
        ['الفرع الثالث',   'branch'],
        ['المخزن الرئيسي', 'store'],
        ['المخزن الثاني',  'store'],
        ['المخزن الثالث',  'store'],
        ['المخزن الرابع',  'store'],
      ].forEach(([name, type]) => ins.run(name, type, hash));
    });
    seed();
    console.log('✅ Default users created (password: 1234)');
  }

  const adminExists = db.prepare('SELECT id FROM admin WHERE id = 1').get();
  if (!adminExists) {
    db.prepare('INSERT INTO admin (id, password) VALUES (1, ?)')
      .run(bcrypt.hashSync('admin1234', 10));
    console.log('✅ Admin created (password: admin1234)');
  }

  // صف افتراضي لتفعيل السيرفر
  const slExists = db.prepare('SELECT id FROM server_license WHERE id = 1').get();
  if (!slExists) {
    db.prepare("INSERT INTO server_license (id, status) VALUES (1, 'inactive')").run();
    console.log('✅ Server license row initialized');
  }

  console.log(`✅ Database ready: ${cfg.db.path}`);
}

// ── واجهة موحدة (نفسها في أي adapter آخر) ──────────────

// Users
const users = {
  findByName:  name => getDB().prepare('SELECT * FROM users WHERE name = ?').get(name),
  findById:    id   => getDB().prepare('SELECT id,name,type,is_active,last_seen,public_key FROM users WHERE id = ?').get(id),
  findAll:     ()   => getDB().prepare('SELECT id,name,type,is_active,last_seen,public_key FROM users ORDER BY type,name').all(),
  create:      ({ name, type, passwordHash }) => {
    const r = getDB().prepare('INSERT INTO users (name,type,password) VALUES (?,?,?)').run(name, type, passwordHash);
    return getDB().prepare('SELECT id,name,type FROM users WHERE id = ?').get(r.lastInsertRowid);
  },
  updateName:     (id, name)         => getDB().prepare('UPDATE users SET name=? WHERE id=?').run(name, id),
  updatePassword: (id, passwordHash) => getDB().prepare('UPDATE users SET password=? WHERE id=?').run(passwordHash, id),
  updateActive:   (id, val)          => getDB().prepare('UPDATE users SET is_active=? WHERE id=?').run(val, id),
  updateLastSeen: id                 => getDB().prepare("UPDATE users SET last_seen=datetime('now') WHERE id=?").run(id),
  updatePublicKey:(id, key)          => getDB().prepare('UPDATE users SET public_key=? WHERE id=?').run(key, id),
  delete:         id                 => {
    getDB().prepare('DELETE FROM messages WHERE from_id=? OR to_id=?').run(id, id);
    getDB().prepare('DELETE FROM users WHERE id=?').run(id);
  },
  allPublicKeys: () => getDB().prepare('SELECT id,name,public_key FROM users WHERE public_key IS NOT NULL').all(),
};

// Messages
const messages = {
  save: ({ from_id, to_id, text='', msg_type='text', file_url=null, file_name=null, file_size=null, duration=null }) => {
    const r = getDB().prepare(
      'INSERT INTO messages (from_id,to_id,text,msg_type,file_url,file_name,file_size,duration) VALUES (?,?,?,?,?,?,?,?)'
    ).run(from_id, to_id, text, msg_type, file_url, file_name, file_size, duration);
    return getDB().prepare('SELECT * FROM messages WHERE id=?').get(r.lastInsertRowid);
  },
  getConversation: (uid1, uid2, limit=100) => getDB().prepare(`
    SELECT m.*,u1.name as from_name,u1.type as from_type
    FROM messages m
    JOIN users u1 ON m.from_id=u1.id
    WHERE (m.from_id=? AND m.to_id=?) OR (m.from_id=? AND m.to_id=?)
    ORDER BY m.created_at ASC LIMIT ?
  `).all(uid1, uid2, uid2, uid1, limit),
  markRead: (fromId, toId) => getDB().prepare(
    'UPDATE messages SET is_read=1 WHERE from_id=? AND to_id=? AND is_read=0'
  ).run(fromId, toId),
  getUnreadCounts: userId => getDB().prepare(
    'SELECT from_id, COUNT(*) as count FROM messages WHERE to_id=? AND is_read=0 GROUP BY from_id'
  ).all(userId),
  edit: (id, text) => {
    const db = getDB();
    db.prepare("UPDATE messages SET text=?, is_edited=1, edited_at=datetime('now') WHERE id=?").run(text, id);
    return db.prepare('SELECT * FROM messages WHERE id=?').get(id);
  },
  delete: (id) => {
    getDB().prepare("UPDATE messages SET is_deleted=1, text='', file_url=NULL, file_name=NULL WHERE id=?").run(id);
    return getDB().prepare('SELECT * FROM messages WHERE id=?').get(id);
  },
  findById: (id) => getDB().prepare('SELECT * FROM messages WHERE id=?').get(id),

  search: (uid1, uid2, query, limit=50) => getDB().prepare(`
    SELECT m.*,u1.name as from_name,u1.type as from_type
    FROM messages m JOIN users u1 ON m.from_id=u1.id
    WHERE ((m.from_id=? AND m.to_id=?) OR (m.from_id=? AND m.to_id=?))
      AND m.msg_type='text' AND m.text LIKE ?
    ORDER BY m.created_at DESC LIMIT ?
  `).all(uid1, uid2, uid2, uid1, '%'+query+'%', limit),
};

// Stats
const stats = {
  today: () => {
    const db   = getDB();
    const date = new Date().toISOString().slice(0,10) + ' 00:00:00';
    return {
      messages: db.prepare("SELECT COUNT(*) as c FROM messages WHERE created_at>=?").get(date).c,
      files:    db.prepare("SELECT COUNT(*) as c FROM messages WHERE msg_type!='text' AND created_at>=?").get(date).c,
      users:    db.prepare("SELECT COUNT(*) as c FROM users").get().c,
    };
  },
  userActivity: id => {
    const db   = getDB();
    const date = new Date().toISOString().slice(0,10) + ' 00:00:00';
    return {
      sent:     db.prepare("SELECT COUNT(*) as c FROM messages WHERE from_id=?").get(id).c,
      received: db.prepare("SELECT COUNT(*) as c FROM messages WHERE to_id=?").get(id).c,
      today:    db.prepare("SELECT COUNT(*) as c FROM messages WHERE from_id=? AND created_at>=?").get(id, date).c,
    };
  },
};

// Admin
const admin = {
  getPassword:    ()   => getDB().prepare('SELECT password FROM admin WHERE id=1').get(),
  updatePassword: hash => getDB().prepare('UPDATE admin SET password=? WHERE id=1').run(hash),
};

// Server License — مفتاح تفعيل السيرفر
const serverLicense = {
  get: () => {
    try { return getDB().prepare('SELECT * FROM server_license WHERE id = 1').get(); }
    catch { return null; }
  },
  activate: ({ license_key, entity_id, entity_name, plan, max_branches, expires_at }) => {
    getDB().prepare(`
      UPDATE server_license SET
        license_key  = ?,
        entity_id    = ?,
        entity_name  = ?,
        plan         = ?,
        max_branches = ?,
        expires_at   = ?,
        activated_at = datetime('now'),
        status       = 'active'
      WHERE id = 1
    `).run(license_key, entity_id || null, entity_name, plan, max_branches, expires_at || null);
    return getDB().prepare('SELECT * FROM server_license WHERE id = 1').get();
  },
  deactivate: () => getDB().prepare("UPDATE server_license SET status = 'inactive' WHERE id = 1").run(),
  isActive: () => {
    const sl = getDB().prepare('SELECT * FROM server_license WHERE id = 1').get();
    if (!sl || sl.status !== 'active') return false;
    if (sl.expires_at && new Date(sl.expires_at) < new Date()) return false;
    return true;
  },
  getPlan: () => {
    return getDB().prepare('SELECT * FROM server_license WHERE id = 1').get();
  },
};

// External Contacts
const externalContacts = {
  // توليد كود اتصال فريد لمستخدم
  getOrCreateCode: (userId) => {
    const db    = getDB();
    const user  = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
    if (!user) return null;
    // الكود = مشفر يحتوي userId + server signature
    return null; // يُولَّد في الـ service
  },

  // جهات الاتصال الخارجية
  findByLocalUser:   (localUserId) =>
    getDB().prepare('SELECT * FROM external_contacts WHERE local_user_id=? AND status="active" ORDER BY created_at DESC').all(localUserId),
  findByRemoteCode:  (remoteCode) =>
    getDB().prepare('SELECT * FROM external_contacts WHERE remote_code=?').get(remoteCode),
  addContact: ({ local_user_id, remote_name, remote_user_id, remote_server, remote_code }) =>
    getDB().prepare('INSERT OR IGNORE INTO external_contacts (local_user_id,remote_name,remote_user_id,remote_server,remote_code) VALUES (?,?,?,?,?)')
      .run(local_user_id, remote_name, remote_user_id, remote_server, remote_code),
  removeContact: (id) =>
    getDB().prepare("UPDATE external_contacts SET status='removed' WHERE id=?").run(id),

  // طلبات التواصل
  createRequest: ({ direction, local_user_id, remote_name, remote_user_id, remote_server, remote_code }) =>
    getDB().prepare('INSERT INTO contact_requests (direction,local_user_id,remote_name,remote_user_id,remote_server,remote_code) VALUES (?,?,?,?,?,?)')
      .run(direction, local_user_id, remote_name, remote_user_id, remote_server, remote_code),
  getPendingIncoming: (localUserId) =>
    getDB().prepare('SELECT * FROM contact_requests WHERE local_user_id=? AND direction="incoming" AND status="pending" ORDER BY created_at DESC').all(localUserId),
  getPendingOutgoing: (localUserId) =>
    getDB().prepare('SELECT * FROM contact_requests WHERE local_user_id=? AND direction="outgoing" AND status="pending"').all(localUserId),
  updateRequest: (id, status) =>
    getDB().prepare('UPDATE contact_requests SET status=? WHERE id=?').run(status, id),
  findRequest: (id) =>
    getDB().prepare('SELECT * FROM contact_requests WHERE id=?').get(id),
  findRequestByRemoteCode: (remoteCode, direction) =>
    getDB().prepare('SELECT * FROM contact_requests WHERE remote_code=? AND direction=?').get(remoteCode, direction),

  // الرسائل الخارجية
  saveExtMsg: ({ local_user_id, remote_code, remote_name, from_remote, text, msg_type, file_url, file_name, file_size }) => {
    const db = getDB();
    const r  = db.prepare('INSERT INTO external_messages (local_user_id,remote_code,remote_name,from_remote,text,msg_type,file_url,file_name,file_size) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(local_user_id, remote_code, remote_name, from_remote?1:0, text||'', msg_type||'text', file_url||null, file_name||null, file_size||null);
    return db.prepare('SELECT * FROM external_messages WHERE id=?').get(r.lastInsertRowid);
  },
  getExtConversation: (localUserId, remoteCode, limit=100) =>
    getDB().prepare('SELECT * FROM external_messages WHERE local_user_id=? AND remote_code=? ORDER BY created_at ASC LIMIT ?').all(localUserId, remoteCode, limit),
  markExtRead: (localUserId, remoteCode) =>
    getDB().prepare('UPDATE external_messages SET is_read=1 WHERE local_user_id=? AND remote_code=? AND from_remote=1 AND is_read=0').run(localUserId, remoteCode),
  getUnreadExtCounts: (localUserId) =>
    getDB().prepare('SELECT remote_code, COUNT(*) as count FROM external_messages WHERE local_user_id=? AND from_remote=1 AND is_read=0 GROUP BY remote_code').all(localUserId),
};

// Audit Log
const audit = {
  log: ({ action, ip, ua, success = 1, meta = null }) =>
    getDB().prepare('INSERT INTO admin_audit (action, ip, ua, success, meta) VALUES (?,?,?,?,?)')
      .run(action, ip || null, ua ? ua.slice(0, 250) : null, success ? 1 : 0, meta ? JSON.stringify(meta) : null),
  tail: (n = 50) =>
    getDB().prepare('SELECT * FROM admin_audit ORDER BY id DESC LIMIT ?').all(n),
};

module.exports = { init, users, messages, stats, admin, serverLicense, externalContacts, audit };
