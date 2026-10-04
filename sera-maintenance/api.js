(function () {
  const API = (window.SERA_CONFIG && window.SERA_CONFIG.API_URL || "").trim();
  const DEMO = !API;
  const KEY = "sera-maint-demo";

  const SERVICES = {
    plumbing: { ar: "سباكة", en: "Plumbing" },
    electrical: { ar: "كهرباء", en: "Electrical" },
    ac: { ar: "تكييف", en: "A/C" },
    carpentry: { ar: "نجارة وأبواب", en: "Carpentry" },
    painting: { ar: "دهانات", en: "Painting" },
    appliances: { ar: "أجهزة منزلية", en: "Appliances" },
    cleaning: { ar: "تنظيف", en: "Cleaning" },
    other: { ar: "أخرى", en: "Other" }
  };
  const STATUS = {
    new: { ar: "جديد", en: "New" },
    progress: { ar: "قيد التنفيذ", en: "In progress" },
    done: { ar: "مكتمل", en: "Completed" },
    cancelled: { ar: "ملغى", en: "Cancelled" }
  };

  function readDemo() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function writeDemo(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {}
  }
  function last4(p) { return String(p || "").replace(/\D/g, "").slice(-4); }

  async function get(params) {
    const url = API + "?" + new URLSearchParams(params).toString();
    const res = await fetch(url, { method: "GET" });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "تعذّر الاتصال بالخادم");
    return json;
  }
  async function post(body) {
    // text/plain يتجنب طلب preflight الذي لا يدعمه Apps Script
    const res = await fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "تعذّر الاتصال بالخادم");
    return json;
  }

  window.SeraAPI = {
    DEMO, SERVICES, STATUS,

    async create(data) {
      if (!DEMO) return (await post({ action: "create", data })).item;
      const items = readDemo();
      const now = new Date().toISOString();
      const item = Object.assign({}, data, {
        id: "SR-" + (1001 + items.length), createdAt: now, updatedAt: now, status: "new", adminNote: ""
      });
      items.push(item); writeDemo(items);
      return item;
    },

    async track(id, phone) {
      id = String(id || "").trim().toUpperCase();
      if (!/^SR-/.test(id)) id = "SR-" + id.replace(/\D/g, "");
      if (!DEMO) return (await get({ action: "track", id, phone: last4(phone) })).item;
      return readDemo().find(x => x.id === id && last4(x.phone) === last4(phone)) || null;
    },

    async list() {
      if (!DEMO) return (await get({ action: "list" })).items;
      return readDemo().slice().reverse();
    },

    async update(id, patch) {
      if (!DEMO) return (await post({ action: "update", id, patch })).item;
      const items = readDemo();
      const it = items.find(x => x.id === id);
      if (!it) throw new Error("الطلب غير موجود");
      Object.assign(it, patch, { updatedAt: new Date().toISOString() });
      writeDemo(items);
      return it;
    },

    fmtDate(iso) {
      if (!iso) return "";
      const d = new Date(iso);
      if (isNaN(d)) return iso;
      return d.toLocaleString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    }
  };
})();
