/**
 * GK Group – SOP Management & Performance Dashboard 2027
 * Backend: Google Apps Script web app + Google Sheets (this spreadsheet is the database).
 *
 * - GET  ?action=publicData  → read-only data for the public dashboard (no login)
 * - GET  ?action=config      → public configuration (Google OAuth Client ID)
 * - POST {action, token, payload} → admin operations; `token` is a Google ID token from "Sign in with Google".
 *
 * Every write: verifies the Google ID token, checks the `admins` tab, validates input, takes a script lock,
 * writes the row(s) and appends an entry to `audit_logs`. Calculations are NOT done here – the browser runs the
 * tested calculation engine (src/lib/engine) on the raw data, so the dashboard and exports always agree.
 *
 * See docs/HANDOVER.md for ownership / redeploy instructions.
 */

// ------------------------------------------------------------------------------------------------
// Schema – every column is stored as plain text (number format "@") and converted with its type.
// ------------------------------------------------------------------------------------------------
var SCHEMA = {
  organizations: ['id', 'organization_name', 'organization_code', 'description', 'sort_order:n', 'is_active:b', 'created_at', 'updated_at'],
  sop_tasks: [
    'id', 'task_number', 'task_seq:n', 'organization_id', 'sop_name', 'task_type', 'document_classification', 'workflow_status',
    'critical:b', 'start_date', 'end_date', 'actual_end_date', 'progress_percentage:n', 'progress_source',
    'legacy_m:n', 'legacy_n:n', 'legacy_o:n', 'remark', 'is_active:b', 'source_row:n', 'created_at', 'updated_at', 'created_by', 'updated_by'
  ],
  sop_progress_history: ['id', 'task_id', 'workflow_status', 'progress_percentage:n', 'progress_source', 'legacy_m:n', 'legacy_n:n', 'legacy_o:n', 'actual_end_date', 'changed_by_email', 'changed_at'],
  monthly_targets: ['id', 'year:n', 'month:n', 'target:n', 'completion_weight:n', 'awareness_weight:n', 'updated_at'],
  monthly_achievements: ['id', 'year:n', 'month:n', 'sop_completion:n', 'sop_awareness:n', 'notes', 'updated_at'],
  holidays: ['id', 'holiday_date', 'holiday_name', 'category', 'description', 'exclude_from_working_days:b', 'source', 'created_at', 'updated_at'],
  system_settings: ['key', 'value:j', 'description', 'updated_at', 'updated_by'],
  admins: ['email', 'name', 'is_active:b', 'note', 'created_at', 'created_by'],
  audit_logs: ['id', 'created_at', 'user_email', 'table_name', 'record_id', 'action', 'changed_fields:j', 'old_data:j', 'new_data:j']
};

var TASK_TYPES = ['CAT', 'Additional'];
var DOC_CLASSES = ['New', 'Revision'];
var STATUSES = ['Not Started', 'In Progress', 'Completed', 'Hold'];
var HOLIDAY_CATEGORIES = ['National Holiday', 'Joint Leave', 'Company Holiday', 'Other Holiday'];
var PUBLIC_CACHE_KEY = 'publicData:v1';

/**
 * ID of the Google Sheet used as database (the part between /d/ and /edit in its URL).
 * Lets this script also work as a standalone Apps Script project. To move the database, change this value
 * or set Script Property DB_SPREADSHEET_ID (Project Settings → Script properties).
 */
var DB_SPREADSHEET_ID = '1J3fxwntNgMsfuS9M3UeQ5cScVNi6gjz55R7gi8ZNegk';
var TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo?id_token=';

// ------------------------------------------------------------------------------------------------
// Errors & responses
// ------------------------------------------------------------------------------------------------
function AppError(code, message, errors) {
  this.code = code;
  this.message = message;
  this.errors = errors || null;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(e) {
  if (e instanceof AppError) return { ok: false, code: e.code, message: e.message, errors: e.errors };
  console.error(e && e.stack ? e.stack : e);
  return { ok: false, code: 'error', message: 'Terjadi kesalahan di server: ' + (e && e.message ? e.message : String(e)) };
}

// ------------------------------------------------------------------------------------------------
// HTTP entry points
// ------------------------------------------------------------------------------------------------
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'publicData';
    if (action === 'publicData') return json_({ ok: true, data: publicData_() });
    if (action === 'config') return json_({ ok: true, data: { oauthClientId: getSetting_('oauth_client_id') || '', version: 1 } });
    if (action === 'ping') return json_({ ok: true, data: { time: new Date().toISOString() } });
    return json_({ ok: false, code: 'not_found', message: 'Aksi tidak dikenal.' });
  } catch (err) {
    return json_(fail_(err));
  }
}

function doPost(e) {
  return json_(handlePost_(e && e.postData ? e.postData.contents : ''));
}

/** Separated from doPost so it can be unit-tested. */
function handlePost_(raw) {
  try {
    var req;
    try {
      req = JSON.parse(raw || '{}');
    } catch (x) {
      throw new AppError('bad_request', 'Body bukan JSON yang valid.');
    }
    var action = String(req.action || '');
    var handler = ACTIONS[action];
    if (!handler) throw new AppError('not_found', 'Aksi tidak dikenal: ' + action);
    var email = identify_(req.token);
    if (action === 'whoami') return { ok: true, data: whoami_(email) };
    var admin = requireAdmin_(email);
    if (handler.write) {
      var lock = LockService.getScriptLock();
      if (!lock.tryLock(20000)) throw new AppError('busy', 'Server sedang sibuk, coba lagi.');
      try {
        var out = handler.fn(req.payload || {}, admin);
        CacheService.getScriptCache().remove(PUBLIC_CACHE_KEY);
        return { ok: true, data: out === undefined ? null : out.data, message: out && out.message };
      } finally {
        lock.releaseLock();
      }
    }
    return { ok: true, data: handler.fn(req.payload || {}, admin) };
  } catch (err) {
    return fail_(err);
  }
}

// ------------------------------------------------------------------------------------------------
// Authentication (Google Sign-In ID token) & authorization (admins tab)
// ------------------------------------------------------------------------------------------------
function identify_(token) {
  if (!token) return null;
  token = String(token);
  var cache = CacheService.getScriptCache();
  var key = 'tok:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  var cached = cache.get(key);
  if (cached) return cached;
  var clientId = getSetting_('oauth_client_id');
  if (!clientId) throw new AppError('config', 'OAuth Client ID belum diatur. Lihat docs/HANDOVER.md langkah "OAuth Client ID".');
  var res = UrlFetchApp.fetch(TOKENINFO_URL + encodeURIComponent(token), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new AppError('auth', 'Sesi login tidak valid atau kedaluwarsa. Silakan login ulang.');
  var info = JSON.parse(res.getContentText());
  var issOk = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
  var expSec = Number(info.exp || 0);
  if (info.aud !== clientId || !issOk || String(info.email_verified) !== 'true' || expSec * 1000 < Date.now()) {
    throw new AppError('auth', 'Token login tidak diterima. Silakan login ulang.');
  }
  var email = String(info.email).toLowerCase();
  var ttl = Math.max(1, Math.min(600, Math.floor(expSec - Date.now() / 1000)));
  cache.put(key, email, ttl);
  return email;
}

function whoami_(email) {
  if (!email) return { email: null, isAdmin: false };
  var a = findAdmin_(email);
  return { email: email, isAdmin: !!a };
}

function findAdmin_(email) {
  if (!email) return null;
  var rows = table_('admins').rows;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].email === email && rows[i].is_active) return rows[i];
  }
  return null;
}

function requireAdmin_(email) {
  if (!email) throw new AppError('auth', 'Silakan login dengan akun Google Administrator.');
  var a = findAdmin_(email);
  if (!a) throw new AppError('forbidden', email + ' tidak terdaftar sebagai Administrator aktif.');
  return { email: email };
}

// ------------------------------------------------------------------------------------------------
// Sheet-backed tables
// ------------------------------------------------------------------------------------------------
var ssCache_ = null;
function ss_() {
  if (ssCache_) return ssCache_;
  var id = '';
  try {
    id = PropertiesService.getScriptProperties().getProperty('DB_SPREADSHEET_ID') || '';
  } catch (x) {
    /* properties unavailable */
  }
  id = id || DB_SPREADSHEET_ID;
  ssCache_ = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  return ssCache_;
}

function colDefs_(name) {
  return SCHEMA[name].map(function (c) {
    var p = c.split(':');
    return { name: p[0], type: p[1] || 's' };
  });
}

function fromCell_(v, type) {
  if (v === null || v === undefined || v === '') return null;
  if (type === 'n') {
    var n = Number(v);
    return isFinite(n) ? n : null;
  }
  if (type === 'b') return v === true || String(v).toUpperCase() === 'TRUE';
  if (type === 'j') {
    try {
      return JSON.parse(String(v));
    } catch (x) {
      return null;
    }
  }
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Jakarta', 'yyyy-MM-dd');
  return String(v);
}

function toCell_(v, type) {
  if (v === null || v === undefined) return '';
  if (type === 'b') return v ? 'TRUE' : 'FALSE';
  if (type === 'j') return JSON.stringify(v);
  return String(v);
}

function sheetFor_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new AppError('config', 'Tab "' + name + '" belum ada. Jalankan menu GK SOP → Setup database.');
  return sh;
}

/** Loads a whole table. Each row object carries a hidden `__row` (1-based sheet row). */
function table_(name) {
  var defs = colDefs_(name);
  var sh = sheetFor_(name);
  var values = sh.getDataRange().getValues();
  var header = values[0] || [];
  var idx = defs.map(function (d) {
    return header.indexOf(d.name);
  });
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var line = values[r];
    var empty = true;
    for (var k = 0; k < line.length; k++) if (line[k] !== '' && line[k] !== null) empty = false;
    if (empty) continue;
    var obj = {};
    for (var c = 0; c < defs.length; c++) obj[defs[c].name] = idx[c] < 0 ? null : fromCell_(line[idx[c]], defs[c].type);
    Object.defineProperty(obj, '__row', { value: r + 1, enumerable: false, writable: true });
    rows.push(obj);
  }
  return { name: name, defs: defs, sheet: sh, rows: rows, header: header };
}

function rowValues_(t, obj) {
  return t.header.map(function (h) {
    for (var i = 0; i < t.defs.length; i++) if (t.defs[i].name === h) return toCell_(obj[h], t.defs[i].type);
    return '';
  });
}

function insertRow_(t, obj) {
  var sh = t.sheet;
  var row = Math.max(sh.getLastRow(), 1) + 1;
  if (row > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 200);
  var range = sh.getRange(row, 1, 1, t.header.length);
  range.setNumberFormat('@');
  range.setValues([rowValues_(t, obj)]);
  Object.defineProperty(obj, '__row', { value: row, enumerable: false, writable: true });
  t.rows.push(obj);
  return obj;
}

function writeRow_(t, obj) {
  var range = t.sheet.getRange(obj.__row, 1, 1, t.header.length);
  range.setNumberFormat('@');
  range.setValues([rowValues_(t, obj)]);
}

function deleteRow_(t, obj) {
  t.sheet.deleteRow(obj.__row);
}

function plain_(obj) {
  return obj ? JSON.parse(JSON.stringify(obj)) : null;
}

function nowIso_() {
  return new Date().toISOString();
}

function uuid_() {
  return Utilities.getUuid();
}

function audit_(user, tableName, recordId, action, oldObj, newObj) {
  var changed = null;
  if (action === 'UPDATE') {
    changed = [];
    Object.keys(newObj).forEach(function (k) {
      if (k === 'updated_at' || k === 'updated_by') return;
      if (JSON.stringify(oldObj[k]) !== JSON.stringify(newObj[k])) changed.push(k);
    });
    if (!changed.length) return;
    changed.sort();
  }
  insertRow_(table_('audit_logs'), {
    id: uuid_(),
    created_at: nowIso_(),
    user_email: user ? user.email : null,
    table_name: tableName,
    record_id: recordId,
    action: action,
    changed_fields: changed,
    old_data: plain_(oldObj),
    new_data: plain_(newObj)
  });
}

/** Update helper: applies `changes`, writes the row and the audit entry. */
function updateWithAudit_(t, row, changes, user) {
  var before = plain_(row);
  Object.keys(changes).forEach(function (k) {
    row[k] = changes[k];
  });
  if (t.defs.some(function (d) { return d.name === 'updated_at'; })) row.updated_at = nowIso_();
  if (t.defs.some(function (d) { return d.name === 'updated_by'; })) row.updated_by = user ? user.email : null;
  writeRow_(t, row);
  audit_(user, t.name, row.id || row.key || row.email, 'UPDATE', before, plain_(row));
  return row;
}

// ------------------------------------------------------------------------------------------------
// Settings
// ------------------------------------------------------------------------------------------------
function getSetting_(key) {
  var sh = ss_().getSheetByName('system_settings');
  if (!sh) return null;
  var rows = table_('system_settings').rows;
  for (var i = 0; i < rows.length; i++) if (rows[i].key === key) return rows[i].value;
  return null;
}

function setSetting_(key, value, description, user) {
  var t = table_('system_settings');
  var row = null;
  for (var i = 0; i < t.rows.length; i++) if (t.rows[i].key === key) row = t.rows[i];
  if (row) return updateWithAudit_(t, row, { value: value, description: description || row.description }, user);
  var obj = { key: key, value: value, description: description || null, updated_at: nowIso_(), updated_by: user ? user.email : null };
  insertRow_(t, obj);
  audit_(user, 'system_settings', key, 'INSERT', null, obj);
  return obj;
}

// ------------------------------------------------------------------------------------------------
// Read models
// ------------------------------------------------------------------------------------------------
function settingsObj_() {
  var s = {};
  table_('system_settings').rows.forEach(function (r) {
    s[r.key] = r.value;
  });
  return {
    weights: s.weights || { cat: 80, additional: 20 },
    project: s.project || { start: '2027-01-01', end: '2027-12-31', name: 'SPC Project Schedule 2027' },
    treat_uninput_as_zero: s.treat_uninput_as_zero === undefined || s.treat_uninput_as_zero === null ? true : !!s.treat_uninput_as_zero,
    source: s.source || null
  };
}

function publicData_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(PUBLIC_CACHE_KEY);
  if (hit) return JSON.parse(hit);
  var settings = settingsObj_();
  var data = {
    organizations: table_('organizations').rows.filter(function (o) { return o.is_active; }),
    tasks: table_('sop_tasks').rows.filter(function (t) { return t.is_active; }),
    holidays: table_('holidays').rows,
    monthlyTargets: table_('monthly_targets').rows,
    monthlyAchievements: table_('monthly_achievements').rows,
    settings: { weights: settings.weights, project: settings.project, treat_uninput_as_zero: settings.treat_uninput_as_zero },
    generatedAt: nowIso_()
  };
  var s = JSON.stringify(data);
  if (s.length < 90000) cache.put(PUBLIC_CACHE_KEY, s, 60);
  return data;
}

function adminData_() {
  var settings = settingsObj_();
  return {
    organizations: table_('organizations').rows,
    tasks: table_('sop_tasks').rows,
    holidays: table_('holidays').rows,
    monthlyTargets: table_('monthly_targets').rows,
    monthlyAchievements: table_('monthly_achievements').rows,
    settings: settings,
    admins: table_('admins').rows,
    oauthClientId: getSetting_('oauth_client_id') || '',
    generatedAt: nowIso_()
  };
}

// ------------------------------------------------------------------------------------------------
// Validation helpers (mirror src/lib/validation.ts)
// ------------------------------------------------------------------------------------------------
function isIsoDate_(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  var p = v.split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return p[0] >= 1900 && p[0] <= 2200 && d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
}

function str_(v, max) {
  if (v === null || v === undefined) return '';
  var s = String(v).replace(/\s+/g, ' ').trim();
  return max ? s.slice(0, max) : s;
}

function optDate_(v, field, errors) {
  var s = str_(v);
  if (!s) return null;
  if (!isIsoDate_(s)) {
    errors[field] = 'Format tanggal tidak valid.';
    return null;
  }
  return s;
}

function normName_(s) {
  return str_(s).toLowerCase();
}

function throwIfErrors_(errors, message) {
  if (Object.keys(errors).length) throw new AppError('validation', message || 'Periksa kembali isian formulir.', errors);
}

function validateSop_(p) {
  var errors = {};
  var out = {
    organization_id: str_(p.organization_id),
    sop_name: str_(p.sop_name, 300),
    task_type: str_(p.task_type),
    document_classification: str_(p.document_classification),
    critical: p.critical === true || p.critical === 'true',
    remark: str_(p.remark, 2000) || null
  };
  if (!out.organization_id) errors.organization_id = 'Divisi/Departemen/Business Unit wajib dipilih.';
  if (!out.sop_name) errors.sop_name = 'Nama SOP wajib diisi.';
  if (TASK_TYPES.indexOf(out.task_type) < 0) errors.task_type = 'Jenis tugas (CAT/Additional) wajib dipilih.';
  if (DOC_CLASSES.indexOf(out.document_classification) < 0) errors.document_classification = 'Pilih New atau Revision.';
  out.start_date = optDate_(p.start_date, 'start_date', errors);
  out.end_date = optDate_(p.end_date, 'end_date', errors);
  if (!errors.start_date && !errors.end_date) {
    if ((out.start_date && !out.end_date) || (!out.start_date && out.end_date)) errors.end_date = 'Isi Start Date dan End Date bersamaan.';
    else if (out.start_date && out.end_date && out.end_date < out.start_date) errors.end_date = 'End Date tidak boleh lebih awal daripada Start Date.';
  }
  return { value: out, errors: errors };
}

function statusProgressError_(status, pct) {
  if (!isFinite(pct) || pct < 0 || pct > 100) return 'Progress harus di antara 0–100%.';
  if (status === 'Not Started' && pct !== 0) return 'Status Not Started harus 0%.';
  if (status === 'Completed' && pct !== 100) return 'Status Completed harus 100%.';
  if (status === 'In Progress' && (pct < 1 || pct > 99)) return 'Status In Progress harus 1–99%.';
  return null;
}

function findById_(t, id, label) {
  for (var i = 0; i < t.rows.length; i++) if (t.rows[i].id === id) return t.rows[i];
  throw new AppError('not_found', (label || 'Data') + ' tidak ditemukan.');
}

function nextTaskSeq_(tasks, orgId) {
  var max = 0;
  tasks.rows.forEach(function (t) {
    if (t.organization_id === orgId && t.task_seq > max) max = t.task_seq;
  });
  return max + 1;
}

function duplicateTask_(tasks, orgId, name, excludeId) {
  var n = normName_(name);
  for (var i = 0; i < tasks.rows.length; i++) {
    var t = tasks.rows[i];
    if (t.is_active && t.id !== excludeId && t.organization_id === orgId && normName_(t.sop_name) === n) return t;
  }
  return null;
}

function history_(task, user) {
  insertRow_(table_('sop_progress_history'), {
    id: uuid_(),
    task_id: task.id,
    workflow_status: task.workflow_status,
    progress_percentage: task.progress_percentage,
    progress_source: task.progress_source,
    legacy_m: task.legacy_m,
    legacy_n: task.legacy_n,
    legacy_o: task.legacy_o,
    actual_end_date: task.actual_end_date,
    changed_by_email: user ? user.email : null,
    changed_at: nowIso_()
  });
}

// ------------------------------------------------------------------------------------------------
// Actions
// ------------------------------------------------------------------------------------------------
function createSop_(p, user) {
  var v = validateSop_(p);
  var orgs = table_('organizations');
  var org = null;
  orgs.rows.forEach(function (o) { if (o.id === v.value.organization_id) org = o; });
  if (!org && !v.errors.organization_id) v.errors.organization_id = 'Organisasi tidak ditemukan.';
  throwIfErrors_(v.errors);
  var tasks = table_('sop_tasks');
  var dup = duplicateTask_(tasks, org.id, v.value.sop_name);
  if (dup) throw new AppError('validation', 'Periksa kembali isian formulir.', { sop_name: 'Sudah ada SOP dengan nama ini (Task ' + dup.task_number + ').' });
  var seq = nextTaskSeq_(tasks, org.id);
  var now = nowIso_();
  var row = {
    id: uuid_(),
    task_number: org.sort_order + '.' + seq,
    task_seq: seq,
    organization_id: org.id,
    sop_name: v.value.sop_name,
    task_type: v.value.task_type,
    document_classification: v.value.document_classification,
    workflow_status: 'Not Started',
    critical: v.value.critical,
    start_date: v.value.start_date,
    end_date: v.value.end_date,
    actual_end_date: null,
    progress_percentage: 0,
    progress_source: 'direct',
    legacy_m: null,
    legacy_n: null,
    legacy_o: null,
    remark: v.value.remark,
    is_active: true,
    source_row: null,
    created_at: now,
    updated_at: now,
    created_by: user.email,
    updated_by: user.email
  };
  insertRow_(tasks, row);
  audit_(user, 'sop_tasks', row.id, 'INSERT', null, plain_(row));
  history_(row, user);
  return { data: { id: row.id, task_number: row.task_number }, message: 'SOP tersimpan dengan Task Number ' + row.task_number + '.' };
}

function updateSop_(p, user) {
  var tasks = table_('sop_tasks');
  var row = findById_(tasks, str_(p.id), 'SOP');
  var v = validateSop_(p);
  var orgs = table_('organizations');
  var org = null;
  orgs.rows.forEach(function (o) { if (o.id === v.value.organization_id) org = o; });
  if (!org && !v.errors.organization_id) v.errors.organization_id = 'Organisasi tidak ditemukan.';
  throwIfErrors_(v.errors);
  var dup = duplicateTask_(tasks, org.id, v.value.sop_name, row.id);
  if (dup) throw new AppError('validation', 'Periksa kembali isian formulir.', { sop_name: 'Sudah ada SOP dengan nama ini (Task ' + dup.task_number + ').' });
  var changes = {
    sop_name: v.value.sop_name,
    task_type: v.value.task_type,
    document_classification: v.value.document_classification,
    critical: v.value.critical,
    start_date: v.value.start_date,
    end_date: v.value.end_date,
    remark: v.value.remark
  };
  if (org.id !== row.organization_id) {
    var seq = nextTaskSeq_(tasks, org.id);
    changes.organization_id = org.id;
    changes.task_seq = seq;
    changes.task_number = org.sort_order + '.' + seq;
  }
  updateWithAudit_(tasks, row, changes, user);
  return { data: { id: row.id }, message: 'Perubahan SOP disimpan. Dashboard, Gantt Chart, dan perhitungan telah diperbarui.' };
}

function updateProgress_(p, user) {
  var tasks = table_('sop_tasks');
  var row = findById_(tasks, str_(p.id), 'SOP');
  var status = str_(p.workflow_status);
  var pct = Number(p.progress_percentage);
  var errors = {};
  if (STATUSES.indexOf(status) < 0) errors.workflow_status = 'Status tidak valid.';
  var msg = statusProgressError_(status, pct);
  if (msg) errors.progress_percentage = msg;
  var actual = optDate_(p.actual_end_date, 'actual_end_date', errors);
  throwIfErrors_(errors);
  updateWithAudit_(tasks, row, { workflow_status: status, progress_percentage: pct, progress_source: 'direct', actual_end_date: actual }, user);
  history_(row, user);
  return { data: { id: row.id }, message: 'Progres diperbarui.' };
}

function setSopActive_(p, user) {
  var tasks = table_('sop_tasks');
  var row = findById_(tasks, str_(p.id), 'SOP');
  var active = !!p.active;
  if (active) {
    var dup = duplicateTask_(tasks, row.organization_id, row.sop_name, row.id);
    if (dup) throw new AppError('conflict', 'Tidak dapat dipulihkan: sudah ada SOP aktif dengan nama yang sama (Task ' + dup.task_number + ').');
  }
  updateWithAudit_(tasks, row, { is_active: active }, user);
  return { message: active ? 'SOP dipulihkan.' : 'SOP diarsipkan dan tidak lagi dihitung.' };
}

function deleteSop_(p, user) {
  var tasks = table_('sop_tasks');
  var row = findById_(tasks, str_(p.id), 'SOP');
  if (str_(p.confirmation) !== row.task_number) throw new AppError('validation', 'Ketik nomor task "' + row.task_number + '" untuk konfirmasi.');
  var before = plain_(row);
  deleteRow_(tasks, row);
  audit_(user, 'sop_tasks', before.id, 'DELETE', before, null);
  return { message: 'SOP dihapus permanen.' };
}

function saveOrganization_(p, user) {
  var errors = {};
  var name = str_(p.organization_name, 150);
  var code = str_(p.organization_code, 30).toUpperCase() || null;
  var desc = str_(p.description, 1000) || null;
  if (!name) errors.organization_name = 'Nama organisasi wajib diisi.';
  var orgs = table_('organizations');
  var id = str_(p.id);
  orgs.rows.forEach(function (o) {
    if (o.id === id) return;
    if (name && normName_(o.organization_name) === normName_(name)) errors.organization_name = 'Nama organisasi sudah digunakan.';
    if (code && o.organization_code && o.organization_code.toUpperCase() === code) errors.organization_code = 'Kode organisasi sudah digunakan.';
  });
  throwIfErrors_(errors);
  if (id) {
    var row = findById_(orgs, id, 'Organisasi');
    updateWithAudit_(orgs, row, { organization_name: name, organization_code: code, description: desc }, user);
    return { message: 'Organisasi diperbarui.' };
  }
  var max = 0;
  orgs.rows.forEach(function (o) { if (o.sort_order > max) max = o.sort_order; });
  var now = nowIso_();
  var obj = { id: uuid_(), organization_name: name, organization_code: code, description: desc, sort_order: max + 1, is_active: true, created_at: now, updated_at: now };
  insertRow_(orgs, obj);
  audit_(user, 'organizations', obj.id, 'INSERT', null, plain_(obj));
  return { data: { id: obj.id }, message: 'Organisasi ditambahkan.' };
}

function setOrganizationActive_(p, user) {
  var orgs = table_('organizations');
  var row = findById_(orgs, str_(p.id), 'Organisasi');
  updateWithAudit_(orgs, row, { is_active: !!p.active }, user);
  return { message: p.active ? 'Organisasi diaktifkan.' : 'Organisasi dinonaktifkan (tidak tampil di dashboard).' };
}

function saveHoliday_(p, user) {
  var errors = {};
  var date = str_(p.holiday_date);
  var name = str_(p.holiday_name, 200);
  var category = str_(p.category);
  if (!isIsoDate_(date)) errors.holiday_date = 'Tanggal tidak valid.';
  if (!name) errors.holiday_name = 'Nama hari libur wajib diisi.';
  if (HOLIDAY_CATEGORIES.indexOf(category) < 0) errors.category = 'Kategori tidak valid.';
  var hol = table_('holidays');
  var id = str_(p.id);
  hol.rows.forEach(function (h) {
    if (h.id !== id && h.holiday_date === date && normName_(h.holiday_name) === normName_(name)) errors.holiday_name = 'Hari libur dengan tanggal dan nama yang sama sudah ada.';
  });
  throwIfErrors_(errors);
  var values = {
    holiday_date: date,
    holiday_name: name,
    category: category,
    description: str_(p.description, 1000) || null,
    exclude_from_working_days: p.exclude_from_working_days === true || p.exclude_from_working_days === 'true',
    source: str_(p.source, 500) || null
  };
  if (id) {
    updateWithAudit_(hol, findById_(hol, id, 'Hari libur'), values, user);
  } else {
    var now = nowIso_();
    var obj = Object.assign({ id: uuid_(), created_at: now, updated_at: now }, values);
    insertRow_(hol, obj);
    audit_(user, 'holidays', obj.id, 'INSERT', null, plain_(obj));
  }
  return { message: 'Hari libur disimpan. Mandays, Actual Days, dan Gantt Chart dihitung ulang.' };
}

function deleteHoliday_(p, user) {
  var hol = table_('holidays');
  var row = findById_(hol, str_(p.id), 'Hari libur');
  var before = plain_(row);
  deleteRow_(hol, row);
  audit_(user, 'holidays', before.id, 'DELETE', before, null);
  return { message: 'Hari libur dihapus.' };
}

function setHolidayExclude_(p, user) {
  var hol = table_('holidays');
  updateWithAudit_(hol, findById_(hol, str_(p.id), 'Hari libur'), { exclude_from_working_days: !!p.exclude }, user);
  return { message: 'Status hari kerja diperbarui.' };
}

function setCategoryExclude_(p, user) {
  var category = str_(p.category);
  if (HOLIDAY_CATEGORIES.indexOf(category) < 0) throw new AppError('validation', 'Kategori tidak valid.');
  var hol = table_('holidays');
  var n = 0;
  hol.rows.forEach(function (h) {
    if (h.category === category && h.exclude_from_working_days !== !!p.exclude) {
      updateWithAudit_(hol, h, { exclude_from_working_days: !!p.exclude }, user);
      n++;
    }
  });
  return { message: (p.exclude ? 'Semua ' + category + ' kini dihitung sebagai hari non-kerja' : 'Semua ' + category + ' kini tetap dihitung hari kerja') + ' (' + n + ' tanggal diubah).' };
}

function saveMonthly_(p, user) {
  var year = Number(p.year);
  if (!(year >= 2000 && year <= 2100)) throw new AppError('validation', 'Tahun tidak valid.');
  var rows = p.rows || [];
  var errors = {};
  var clean = [];
  for (var m = 1; m <= 12; m++) {
    var r = rows.filter(function (x) { return Number(x.month) === m; })[0] || {};
    var num = function (v, field, allowNull) {
      if (v === null || v === undefined || v === '') {
        if (!allowNull) errors[field + '_' + m] = 'Wajib diisi.';
        return null;
      }
      var n = Number(v);
      if (!isFinite(n) || n < 0 || n > 10) {
        errors[field + '_' + m] = 'Nilai tidak valid.';
        return null;
      }
      return n;
    };
    var target = num(r.target, 'target', false);
    var cw = num(r.completion_weight, 'cw', false);
    if (cw !== null && cw > 1) errors['cw_' + m] = 'Bobot Completion 0–100%.';
    var completion = num(r.sop_completion, 'completion', true);
    var awareness = num(r.sop_awareness, 'awareness', true);
    clean.push({ month: m, target: target, completion_weight: cw, awareness_weight: cw === null ? null : Math.round((1 - cw) * 10000) / 10000, sop_completion: completion, sop_awareness: awareness });
  }
  throwIfErrors_(errors, 'Periksa kembali nilai yang ditandai.');
  var targets = table_('monthly_targets');
  var ach = table_('monthly_achievements');
  clean.forEach(function (c) {
    var t = targets.rows.filter(function (x) { return x.year === year && x.month === c.month; })[0];
    var tv = { target: c.target, completion_weight: c.completion_weight, awareness_weight: c.awareness_weight };
    if (t) updateWithAudit_(targets, t, tv, user);
    else {
      var o = Object.assign({ id: uuid_(), year: year, month: c.month, updated_at: nowIso_() }, tv);
      insertRow_(targets, o);
      audit_(user, 'monthly_targets', o.id, 'INSERT', null, plain_(o));
    }
    var a = ach.rows.filter(function (x) { return x.year === year && x.month === c.month; })[0];
    var av = { sop_completion: c.sop_completion, sop_awareness: c.sop_awareness };
    if (a) updateWithAudit_(ach, a, av, user);
    else {
      var o2 = Object.assign({ id: uuid_(), year: year, month: c.month, notes: null, updated_at: nowIso_() }, av);
      insertRow_(ach, o2);
      audit_(user, 'monthly_achievements', o2.id, 'INSERT', null, plain_(o2));
    }
  });
  return { message: 'Monthly Achievement disimpan.' };
}

function saveSettings_(p, user) {
  var errors = {};
  var cat = Number(p.weights && p.weights.cat);
  var add = Number(p.weights && p.weights.additional);
  if (!isFinite(cat) || !isFinite(add) || cat < 0 || add < 0 || cat > 100 || add > 100 || Math.abs(cat + add - 100) > 1e-9) {
    errors.weight_cat = 'Total bobot CAT + Additional harus tepat 100%.';
  }
  var start = str_(p.project && p.project.start);
  var end = str_(p.project && p.project.end);
  if (!isIsoDate_(start) || !isIsoDate_(end) || end < start) errors.project_end = 'Periode project tidak valid.';
  var clientId = str_(p.oauth_client_id);
  if (clientId && !/\.apps\.googleusercontent\.com$/.test(clientId)) errors.oauth_client_id = 'Format OAuth Client ID tidak valid.';
  var srcId = str_(p.source && p.source.spreadsheet_id);
  if (srcId && !/^[A-Za-z0-9_-]{20,}$/.test(srcId)) errors.source_spreadsheet_id = 'ID spreadsheet tidak valid.';
  throwIfErrors_(errors);
  setSetting_('weights', { cat: cat, additional: add }, 'Bobot Overall Achievement (%). Total wajib 100.', user);
  setSetting_('project', { start: start, end: end, name: str_(p.project.name, 150) || 'SPC Project Schedule' }, 'Periode project (M4:M5).', user);
  setSetting_('treat_uninput_as_zero', p.treat_uninput_as_zero !== false, 'SOP tanpa input progres dihitung 0 pada rata-rata divisi.', user);
  if (clientId) setSetting_('oauth_client_id', clientId, 'Google OAuth Client ID untuk login Administrator.', user);
  if (srcId) setSetting_('source', { spreadsheet_id: srcId, sheet_name: str_(p.source.sheet_name, 100) || 'SPC Schedule 2027' }, 'Sumber impor (read-only).', user);
  return { message: 'Pengaturan disimpan dan seluruh perhitungan diperbarui.' };
}

function addAdmin_(p, user) {
  var email = str_(p.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('validation', 'Email tidak valid.', { email: 'Email tidak valid.' });
  var t = table_('admins');
  var existing = t.rows.filter(function (a) { return a.email === email; })[0];
  if (existing) {
    if (existing.is_active) throw new AppError('conflict', 'Email sudah terdaftar sebagai Administrator.');
    updateWithAudit_(t, existing, { is_active: true }, user);
    return { message: email + ' diaktifkan kembali.' };
  }
  var obj = { email: email, name: str_(p.name, 100) || null, is_active: true, note: str_(p.note, 200) || null, created_at: nowIso_(), created_by: user.email };
  insertRow_(t, obj);
  audit_(user, 'admins', email, 'INSERT', null, plain_(obj));
  return { message: email + ' ditambahkan sebagai Administrator. Ia dapat langsung login dengan akun Google tersebut.' };
}

function setAdminActive_(p, user) {
  var email = str_(p.email).toLowerCase();
  if (email === user.email) throw new AppError('validation', 'Anda tidak dapat menonaktifkan akun sendiri.');
  var t = table_('admins');
  var row = t.rows.filter(function (a) { return a.email === email; })[0];
  if (!row) throw new AppError('not_found', 'Administrator tidak ditemukan.');
  if (!p.active) {
    var others = t.rows.filter(function (a) { return a.is_active && a.email !== email; }).length;
    if (others === 0) throw new AppError('validation', 'Minimal harus ada satu Administrator aktif.');
  }
  updateWithAudit_(t, row, { is_active: !!p.active }, user);
  return { message: p.active ? 'Administrator diaktifkan.' : 'Administrator dinonaktifkan.' };
}

function auditLog_(p) {
  var rows = table_('audit_logs').rows.slice().reverse();
  var f = p || {};
  rows = rows.filter(function (r) {
    if (f.table && r.table_name !== f.table) return false;
    if (f.action && r.action !== f.action) return false;
    if (f.user && String(r.user_email || '').indexOf(String(f.user).toLowerCase()) < 0) return false;
    if (f.from && r.created_at < f.from) return false;
    if (f.to && r.created_at > f.to) return false;
    return true;
  });
  var size = Math.min(200, Math.max(1, Number(f.pageSize) || 50));
  var page = Math.max(1, Number(f.page) || 1);
  return { total: rows.length, page: page, pageSize: size, rows: rows.slice((page - 1) * size, page * size) };
}

function taskHistory_(p) {
  var id = str_(p.id);
  return table_('sop_progress_history').rows.filter(function (h) { return h.task_id === id; }).reverse().slice(0, 100);
}

/** Reads the source workbook (read-only). Dates are returned as yyyy-mm-dd strings. */
function fetchSource_() {
  var src = getSetting_('source');
  if (!src || !src.spreadsheet_id) throw new AppError('config', 'ID spreadsheet sumber belum diatur di System Settings.');
  var book;
  try {
    book = SpreadsheetApp.openById(src.spreadsheet_id);
  } catch (x) {
    throw new AppError('forbidden', 'Spreadsheet sumber tidak dapat dibuka oleh pemilik Apps Script. Pastikan akun pemilik memiliki akses (minimal Viewer).');
  }
  var sheet = book.getSheetByName(src.sheet_name || 'SPC Schedule 2027');
  if (!sheet) throw new AppError('not_found', 'Sheet "' + src.sheet_name + '" tidak ditemukan di spreadsheet sumber.');
  var tz = book.getSpreadsheetTimeZone();
  var values = sheet.getRange(1, 1, Math.min(sheet.getMaxRows(), 200), 21).getValues();
  return values.map(function (row) {
    return row.map(function (v) {
      if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      return v;
    });
  });
}

/** Commits rows that were parsed & previewed in the browser. Every row is re-validated here. */
function importCommit_(p, user) {
  var mode = p.mode === 'upsert-legacy' ? 'upsert-legacy' : 'insert-only';
  var report = { inserted: 0, updated: 0, skipped: 0, failed: [], organizationsCreated: 0, monthlyUpdated: false };
  var orgs = table_('organizations');
  var tasks = table_('sop_tasks');
  var orgByName = {};
  orgs.rows.forEach(function (o) { orgByName[normName_(o.organization_name)] = o; });
  var used = {};
  orgs.rows.forEach(function (o) { used[o.sort_order] = true; });

  (p.organizations || []).forEach(function (o) {
    var k = normName_(o.organization_name);
    if (!k || orgByName[k]) return;
    var order = Number(o.sort_order) || 1;
    while (used[order]) order++;
    var now = nowIso_();
    var obj = { id: uuid_(), organization_name: str_(o.organization_name, 150), organization_code: null, description: 'Impor dari SPC Schedule baris ' + o.source_row, sort_order: order, is_active: true, created_at: now, updated_at: now };
    insertRow_(orgs, obj);
    audit_(user, 'organizations', obj.id, 'INSERT', null, plain_(obj));
    orgByName[k] = obj;
    used[order] = true;
    report.organizationsCreated++;
  });

  (p.tasks || []).forEach(function (t) {
    var label = String(t.task_number || '');
    var org = orgByName[normName_(t.organization_name)];
    var name = str_(t.sop_name, 300);
    var problems = [];
    if (!org) problems.push('organisasi tidak ditemukan');
    if (!name) problems.push('nama SOP kosong');
    if (t.task_type && TASK_TYPES.indexOf(t.task_type) < 0) problems.push('kategori tidak valid');
    if (t.document_classification && DOC_CLASSES.indexOf(t.document_classification) < 0) problems.push('New/Revision tidak valid');
    if (t.workflow_status && STATUSES.indexOf(t.workflow_status) < 0) problems.push('status tidak valid');
    ['start_date', 'end_date', 'actual_end_date'].forEach(function (k) { if (t[k] && !isIsoDate_(t[k])) problems.push(k + ' tidak valid'); });
    ['legacy_m', 'legacy_n', 'legacy_o'].forEach(function (k) {
      if (t[k] !== null && t[k] !== undefined && !(Number(t[k]) >= 0 && Number(t[k]) <= 10)) problems.push(k + ' tidak valid');
    });
    if (problems.length) {
      report.failed.push({ row: t.source_row, task: label, error: problems.join(', ') });
      return;
    }
    var payload = {
      sop_name: name,
      task_type: t.task_type || null,
      document_classification: t.document_classification || null,
      workflow_status: t.workflow_status || null,
      critical: !!t.critical,
      start_date: t.start_date || null,
      end_date: t.end_date || null,
      actual_end_date: t.actual_end_date || null,
      progress_percentage: null,
      progress_source: 'legacy',
      legacy_m: t.legacy_m === undefined ? null : t.legacy_m,
      legacy_n: t.legacy_n === undefined ? null : t.legacy_n,
      legacy_o: t.legacy_o === undefined ? null : t.legacy_o,
      remark: str_(t.remark, 2000) || null,
      source_row: Number(t.source_row) || null
    };
    var existing = duplicateTask_(tasks, org.id, name);
    if (existing) {
      if (mode === 'insert-only') { report.skipped++; return; }
      if (existing.progress_source !== 'legacy') { report.skipped++; return; }
      updateWithAudit_(tasks, existing, payload, user);
      history_(existing, user);
      report.updated++;
      return;
    }
    var seq = Number(t.task_seq) || 0;
    var taken = !seq || tasks.rows.some(function (x) { return x.organization_id === org.id && x.task_seq === seq; });
    if (taken) seq = nextTaskSeq_(tasks, org.id);
    var now = nowIso_();
    var row = Object.assign({ id: uuid_(), task_number: org.sort_order + '.' + seq, task_seq: seq, organization_id: org.id, is_active: true, created_at: now, updated_at: now, created_by: user.email, updated_by: user.email }, payload);
    insertRow_(tasks, row);
    audit_(user, 'sop_tasks', row.id, 'INSERT', null, plain_(row));
    history_(row, user);
    report.inserted++;
  });

  if (p.includeMonthly && p.monthly && p.monthly.length) {
    var year = Number(String((settingsObj_().project || {}).start || '2027').slice(0, 4)) || 2027;
    var rows = [];
    var targets = table_('monthly_targets').rows;
    for (var m = 1; m <= 12; m++) {
      var src = p.monthly.filter(function (x) { return Number(x.month) === m; })[0] || {};
      var cur = targets.filter(function (x) { return x.year === year && x.month === m; })[0];
      var cw = cur ? cur.completion_weight : m >= 10 ? 0.7 : 1;
      rows.push({ month: m, target: src.target !== null && src.target !== undefined ? src.target : cur ? cur.target : null, completion_weight: cw, sop_completion: src.sop_completion, sop_awareness: src.sop_awareness });
    }
    saveMonthly_({ year: year, rows: rows }, user);
    report.monthlyUpdated = true;
  }
  report.message = 'Selesai: ' + report.inserted + ' SOP baru, ' + report.updated + ' diperbarui, ' + report.skipped + ' dilewati, ' + report.failed.length + ' gagal.';
  return { data: report, message: report.message };
}

var ACTIONS = {
  whoami: { fn: function () {} },
  adminData: { fn: function () { return adminData_(); } },
  auditLog: { fn: auditLog_ },
  taskHistory: { fn: taskHistory_ },
  fetchSource: { fn: fetchSource_ },
  createSop: { fn: createSop_, write: true },
  updateSop: { fn: updateSop_, write: true },
  updateProgress: { fn: updateProgress_, write: true },
  setSopActive: { fn: setSopActive_, write: true },
  deleteSop: { fn: deleteSop_, write: true },
  saveOrganization: { fn: saveOrganization_, write: true },
  setOrganizationActive: { fn: setOrganizationActive_, write: true },
  saveHoliday: { fn: saveHoliday_, write: true },
  deleteHoliday: { fn: deleteHoliday_, write: true },
  setHolidayExclude: { fn: setHolidayExclude_, write: true },
  setCategoryExclude: { fn: setCategoryExclude_, write: true },
  saveMonthly: { fn: saveMonthly_, write: true },
  saveSettings: { fn: saveSettings_, write: true },
  addAdmin: { fn: addAdmin_, write: true },
  setAdminActive: { fn: setAdminActive_, write: true },
  importCommit: { fn: importCommit_, write: true }
};

// ------------------------------------------------------------------------------------------------
// Setup & spreadsheet menu (run by the owner from the spreadsheet)
// ------------------------------------------------------------------------------------------------
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GK SOP')
    .addItem('1. Setup database', 'setupDatabase')
    .addItem('2. Atur OAuth Client ID', 'promptOAuthClientId')
    .addItem('Lindungi tab dari edit manual', 'protectTabs')
    .addItem('Info deployment', 'showInfo')
    .addToUi();
}

/** Creates missing tabs with headers and seeds initial data (idempotent). */
function setupDatabase() {
  var ss = ss_();
  var created = [];
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    var cols = colDefs_(name).map(function (d) { return d.name; });
    if (!sh) {
      sh = ss.insertSheet(name);
      created.push(name);
    }
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
      sh.getRange(1, 1, 1, cols.length).setValues([cols]);
      sh.setFrozenRows(1);
    }
  });
  var owner = Session.getEffectiveUser().getEmail();
  var seeded = seedIfEmpty_(owner);
  var msg = 'Tab dibuat: ' + (created.join(', ') || '-') + '. Data awal: ' + seeded + '.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (x) { /* running from the editor */ }
  return msg;
}

function seedIfEmpty_(ownerEmail) {
  var sys = { email: 'setup' };
  var done = [];
  var admins = table_('admins');
  if (!admins.rows.length) {
    var emails = (SEED.admins || []).slice();
    if (ownerEmail && emails.indexOf(ownerEmail.toLowerCase()) < 0) emails.push(ownerEmail.toLowerCase());
    emails.forEach(function (e) {
      insertRow_(admins, { email: e, name: null, is_active: true, note: e === ownerEmail ? 'Pemilik Apps Script' : 'Administrator awal', created_at: nowIso_(), created_by: 'setup' });
    });
    done.push(emails.length + ' admin');
  }
  var settings = table_('system_settings');
  if (!settings.rows.length) {
    Object.keys(SEED.settings).forEach(function (k) {
      insertRow_(settings, { key: k, value: SEED.settings[k].value, description: SEED.settings[k].description, updated_at: nowIso_(), updated_by: 'setup' });
    });
    done.push('pengaturan');
  }
  var orgs = table_('organizations');
  var idBySort = {};
  if (!orgs.rows.length) {
    SEED.organizations.forEach(function (o) {
      var now = nowIso_();
      var obj = { id: uuid_(), organization_name: o.organization_name, organization_code: o.organization_code, description: o.description, sort_order: o.sort_order, is_active: true, created_at: now, updated_at: now };
      insertRow_(orgs, obj);
      idBySort[o.sort_order] = obj.id;
    });
    done.push(SEED.organizations.length + ' organisasi');
    var tasks = table_('sop_tasks');
    if (!tasks.rows.length) {
      SEED.tasks.forEach(function (t) {
        var now = nowIso_();
        var row = Object.assign({ id: uuid_(), organization_id: idBySort[t.org_sort], is_active: true, progress_percentage: null, progress_source: 'legacy', created_at: now, updated_at: now, created_by: 'migrasi', updated_by: 'migrasi' }, t);
        delete row.org_sort;
        insertRow_(tasks, row);
        history_(row, sys);
      });
      done.push(SEED.tasks.length + ' SOP');
    }
  }
  var hol = table_('holidays');
  if (!hol.rows.length) {
    SEED.holidays.forEach(function (h) {
      var now = nowIso_();
      insertRow_(hol, Object.assign({ id: uuid_(), created_at: now, updated_at: now }, h));
    });
    done.push(SEED.holidays.length + ' hari libur');
  }
  var mt = table_('monthly_targets');
  if (!mt.rows.length) {
    SEED.monthly.forEach(function (m) {
      insertRow_(mt, { id: uuid_(), year: m.year, month: m.month, target: m.target, completion_weight: m.completion_weight, awareness_weight: m.awareness_weight, updated_at: nowIso_() });
    });
    done.push('target bulanan');
  }
  var ma = table_('monthly_achievements');
  if (!ma.rows.length) {
    SEED.monthly.forEach(function (m) {
      insertRow_(ma, { id: uuid_(), year: m.year, month: m.month, sop_completion: m.sop_completion, sop_awareness: m.sop_awareness, notes: null, updated_at: nowIso_() });
    });
    done.push('input bulanan');
  }
  CacheService.getScriptCache().remove(PUBLIC_CACHE_KEY);
  return done.join(', ') || 'tidak ada (data sudah ada)';
}

function promptOAuthClientId() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('OAuth Client ID', 'Tempel Client ID (….apps.googleusercontent.com):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var v = r.getResponseText().trim();
  if (!/\.apps\.googleusercontent\.com$/.test(v)) return ui.alert('Format tidak valid.');
  setSetting_('oauth_client_id', v, 'Google OAuth Client ID untuk login Administrator.', { email: Session.getEffectiveUser().getEmail() });
  ui.alert('Tersimpan.');
}

/** Only the owner (and editors explicitly added later) can edit the database tabs by hand. */
function protectTabs() {
  var me = Session.getEffectiveUser();
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss_().getSheetByName(name);
    if (!sh) return;
    var p = sh.protect().setDescription('Database GK SOP – ubah melalui aplikasi');
    p.addEditor(me);
    p.removeEditors(p.getEditors().filter(function (u) { return u.getEmail() !== me.getEmail(); }));
    if (p.canDomainEdit()) p.setDomainEdit(false);
  });
  SpreadsheetApp.getUi().alert('Tab database dilindungi. Perubahan dilakukan melalui aplikasi (tercatat di Audit Log).');
}

function showInfo() {
  var url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert(
    'Pemilik: ' + Session.getEffectiveUser().getEmail() + '\n' +
    'Web App URL: ' + (url || '(belum di-deploy)') + '\n' +
    'OAuth Client ID: ' + (getSetting_('oauth_client_id') || '(belum diatur)')
  );
}
