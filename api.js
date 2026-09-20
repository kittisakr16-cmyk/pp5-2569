/* ================================================================
   api.js — ชั้นเชื่อมต่อฐานข้อมูล (Google Apps Script Web App)

   วิธีเชื่อมต่อกับ Google Sheet จริง:
   1) เปิดไฟล์ apps-script/Code.gs ในโปรเจกต์นี้
   2) นำโค้ดไปวางใน Google Apps Script ที่ผูกกับ Google Sheet ของคุณ
      (Extensions > Apps Script) แล้ว Deploy เป็น Web App
      (ดูขั้นตอนละเอียดใน README.md)
   3) คัดลอก URL ของ Web App ที่ได้ มาใส่ในตัวแปร API_URL ด้านล่างนี้

   ถ้ายังไม่ได้ตั้งค่า API_URL ระบบจะทำงานแบบ "โหมดออฟไลน์"
   โดยเก็บข้อมูลไว้ใน localStorage ของเบราว์เซอร์แทน (ใช้ทดสอบระบบได้ทันที
   แต่ข้อมูลจะไม่ถูกแชร์ข้ามเครื่อง/เบราว์เซอร์)
   ================================================================ */

const CONFIG = {
  // วาง URL ของ Google Apps Script Web App ที่นี่ เช่น
  // "https://script.google.com/macros/s/AKfycb.../exec"
  API_URL: "https://script.google.com/macros/s/AKfycbywpgj4WGEs887AFyz3x_s3HGta29e021lbL9No3pB371uxfxXZ1YbihbwpGDNlUQqL/exec",
  LOCAL_KEY: "ppa5_reports_v1"
};

const Api = (() => {

  const isOnline = () => !!CONFIG.API_URL;

  function localGetAll() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.LOCAL_KEY) || "[]");
    } catch (e) { return []; }
  }
  function localSaveAll(list) {
    localStorage.setItem(CONFIG.LOCAL_KEY, JSON.stringify(list));
  }

  async function checkConnection() {
    if (!isOnline()) return { ok: false, mode: "offline" };
    try {
      const res = await fetch(`${CONFIG.API_URL}?action=ping`);
      const data = await res.json();
      return { ok: !!data.ok, mode: "online" };
    } catch (e) {
      return { ok: false, mode: "error" };
    }
  }

  async function getReports() {
    if (!isOnline()) return localGetAll();
    try {
      const res = await fetch(`${CONFIG.API_URL}?action=listReports`);
      const data = await res.json();
      return data.reports || [];
    } catch (e) {
      console.warn("getReports failed, falling back to local cache", e);
      return localGetAll();
    }
  }

  // บันทึกรายงานหลายวิชาในครั้งเดียว (batch)
  async function saveReports(reportsArray) {
    if (!isOnline()) {
      const all = localGetAll();
      reportsArray.forEach(r => {
        const idx = all.findIndex(x => x.id === r.id);
        if (idx >= 0) all[idx] = r; else all.push(r);
      });
      localSaveAll(all);
      return { ok: true };
    }
    try {
      const res = await fetch(CONFIG.API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // ต้องเป็น text/plain เพื่อเลี่ยง CORS preflight ของ Apps Script
        body: JSON.stringify({ action: "saveReports", reports: reportsArray })
      });
      return await res.json();
    } catch (e) {
      console.warn("saveReports failed, saving to local cache instead", e);
      const all = localGetAll();
      reportsArray.forEach(r => {
        const idx = all.findIndex(x => x.id === r.id);
        if (idx >= 0) all[idx] = r; else all.push(r);
      });
      localSaveAll(all);
      return { ok: true, offline: true };
    }
  }

  async function deleteReport(id) {
    if (!isOnline()) {
      const all = localGetAll().filter(x => x.id !== id);
      localSaveAll(all);
      return { ok: true };
    }
    try {
      const res = await fetch(CONFIG.API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "deleteReport", id })
      });
      return await res.json();
    } catch (e) {
      const all = localGetAll().filter(x => x.id !== id);
      localSaveAll(all);
      return { ok: true, offline: true };
    }
  }

  // รายวิชา/ครูผู้สอน — พยายามดึงจาก Sheet จริงก่อน ถ้าไม่ได้ใช้ SEED_SUBJECTS
  async function getSubjects() {
    if (!isOnline()) return SEED_SUBJECTS;
    try {
      const res = await fetch(`${CONFIG.API_URL}?action=listSubjects`);
      const data = await res.json();
      return (data.subjects && data.subjects.length) ? data.subjects : SEED_SUBJECTS;
    } catch (e) {
      return SEED_SUBJECTS;
    }
  }

  return { isOnline, checkConnection, getReports, saveReports, deleteReport, getSubjects };
})();
