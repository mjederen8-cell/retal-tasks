/**
 * سيرا للصيانة — الخادم (Google Apps Script)
 * يحفظ الطلبات في ورقة "Requests" داخل Google Sheet المرتبط بهذا السكربت.
 */
const SHEET = 'Requests';
const HEAD = ['id', 'createdAt', 'name', 'phone', 'building', 'unit', 'service', 'priority', 'notes', 'status', 'adminNote', 'updatedAt'];
const SERVICES = ['plumbing', 'electrical', 'ac', 'carpentry', 'painting', 'appliances', 'cleaning', 'other'];
const STATUSES = ['new', 'progress', 'done', 'cancelled'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:L').setNumberFormat('@'); // كل الأعمدة نص (يحفظ الصفر في بداية الجوال)
    sh.setRightToLeft(true);
  }
  return sh;
}

function rows_(sh) {
  const v = sh.getDataRange().getValues();
  v.shift();
  return v.filter(r => r[0]).map(r => {
    const o = {};
    HEAD.forEach((h, i) => { o[h] = r[i] instanceof Date ? r[i].toISOString() : String(r[i]); });
    return o;
  });
}

// يمنع حقن الصيغ في الجدول ويحدد الطول
function clean_(s, max) {
  s = String(s == null ? '' : s).slice(0, max || 200).trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function last4_(p) { return String(p || '').replace(/\D/g, '').slice(-4); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet(e) {
  try {
    const p = e.parameter || {};
    const sh = sheet_();
    if (p.action === 'list') return out_({ ok: true, items: rows_(sh).reverse() });
    if (p.action === 'track') {
      const id = String(p.id || '').toUpperCase();
      const item = rows_(sh).find(r => r.id === id && last4_(r.phone) === last4_(p.phone) && last4_(p.phone).length === 4);
      return out_({ ok: true, item: item || null });
    }
    return out_({ ok: false, error: 'طلب غير معروف' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const b = JSON.parse(e.postData.contents);
    const sh = sheet_();

    if (b.action === 'create') {
      const d = b.data || {};
      if (!d.name || !d.phone || !d.unit) return out_({ ok: false, error: 'بيانات ناقصة' });
      const now = new Date().toISOString();
      const rec = {
        id: 'SR-' + (1000 + sh.getLastRow()),
        createdAt: now,
        name: clean_(d.name, 80),
        phone: clean_(d.phone, 20),
        building: clean_(d.building, 80),
        unit: clean_(d.unit, 20),
        service: SERVICES.indexOf(d.service) > -1 ? d.service : 'other',
        priority: d.priority === 'urgent' ? 'urgent' : 'normal',
        notes: clean_(d.notes, 1000),
        status: 'new',
        adminNote: '',
        updatedAt: now
      };
      sh.appendRow(HEAD.map(h => rec[h]));
      return out_({ ok: true, item: rec });
    }

    if (b.action === 'update') {
      const ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues().map(r => String(r[0]));
      const i = ids.indexOf(String(b.id));
      if (i < 0) return out_({ ok: false, error: 'الطلب غير موجود' });
      const row = i + 2;
      const patch = b.patch || {};
      if (STATUSES.indexOf(patch.status) > -1) sh.getRange(row, HEAD.indexOf('status') + 1).setValue(patch.status);
      if (patch.adminNote != null) sh.getRange(row, HEAD.indexOf('adminNote') + 1).setValue(clean_(patch.adminNote, 300));
      sh.getRange(row, HEAD.indexOf('updatedAt') + 1).setValue(new Date().toISOString());
      const vals = sh.getRange(row, 1, 1, HEAD.length).getValues()[0];
      const item = {}; HEAD.forEach((h, k) => item[h] = String(vals[k]));
      return out_({ ok: true, item: item });
    }

    return out_({ ok: false, error: 'طلب غير معروف' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
