/* ================================================================
   Code.gs — Backend สำหรับ "ระบบรายงานผลการพัฒนาคุณภาพผู้เรียน"
   โรงเรียนวังโพรงพิทยาคม

   วิธีติดตั้ง (สรุป ดูละเอียดใน README.md):
   1) เปิด Google Sheet ต้นฉบับของคุณ (ชีตที่มีรายชื่อครู/รายวิชา)
   2) เมนู Extensions > Apps Script
   3) ลบโค้ดตัวอย่างเดิมทั้งหมด แล้ววางไฟล์นี้ทั้งไฟล์แทน
   4) แก้ค่า ROSTER_SHEET_NAME ด้านล่างให้ตรงกับชื่อแท็บชีตที่มีข้อมูลครู/รายวิชา
   5) กด Deploy > New deployment > เลือกประเภท "Web app"
        - Execute as: Me
        - Who has access: Anyone
   6) คัดลอก URL ที่ได้ ไปวางในไฟล์ js/api.js ตัวแปร CONFIG.API_URL
   ================================================================ */

const ROSTER_SHEET_NAME = "29.+สถิติผลการเรียน--2569_1--"; // <-- แก้ให้ตรงกับชื่อแท็บจริงของคุณ
const REPORTS_SHEET_NAME = "Reports"; // ระบบจะสร้างแท็บนี้ให้อัตโนมัติถ้ายังไม่มี

const GRADE_COLS = ["4","3.5","3","2.5","2","1.5","1","0","ร","มส","ผ","มผ"];
const RATING_COLS = ["3","2","1","0"];

const REPORT_HEADERS = [
  "id","level","groupNo","groupCode","subjectCode","subjectName","credit","subjectGroup",
  "term","year","teacherCode","teacherName","studentCount",
  ...GRADE_COLS.map(c => "grade_" + c),
  ...RATING_COLS.map(c => "char_" + c),
  ...RATING_COLS.map(c => "read_" + c),
  "createdAt","updatedAt"
];

function doGet(e) {
  const action = (e.parameter.action || "").toString();
  try {
    if (action === "ping") return jsonOut({ ok: true, time: new Date().toISOString() });
    if (action === "listSubjects") return jsonOut({ ok: true, subjects: getSubjects() });
    if (action === "listReports") return jsonOut({ ok: true, reports: getReports() });
    return jsonOut({ ok: false, error: "unknown action" });
  } catch (err) {
    return jsonOut({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === "saveReports") {
      saveReports(body.reports || []);
      return jsonOut({ ok: true });
    }
    if (body.action === "deleteReport") {
      deleteReport(body.id);
      return jsonOut({ ok: true });
    }
    return jsonOut({ ok: false, error: "unknown action" });
  } catch (err) {
    return jsonOut({ ok: false, error: err.message });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- roster (ครู/รายวิชา) ---------------- */
function getSubjects() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_SHEET_NAME);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const idx = {
    level: headers.indexOf("ระดับชั้น"),
    groupNo: headers.indexOf("กลุ่มที่"),
    year: headers.indexOf("ปีการศึกษา"),
    term: headers.indexOf("ภาคเรียนที่"),
    groupCode: headers.indexOf("กลุ่ม"),
    subjectCode: headers.indexOf("รหัสวิชา"),
    subjectName: headers.indexOf("ชื่อวิชา"),
    credit: headers.indexOf("หน่วยกิต"),
    teacher: headers.indexOf("ครูผู้สอน"),
  };

  const groupMap = {
    "ท": "ภาษาไทย", "ค": "คณิตศาสตร์", "ว": "วิทยาศาสตร์และเทคโนโลยี",
    "ส": "สังคมศึกษา ศาสนาและวัฒนธรรม", "พ": "สุขศึกษาและพลศึกษา",
    "ศ": "ศิลปะ", "ง": "การงานอาชีพ", "อ": "ภาษาต่างประเทศ", "จ": "ภาษาต่างประเทศ"
  };

  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const subjectCode = String(row[idx.subjectCode] || "").trim();
    if (!subjectCode) continue;
    const teacherRaw = String(row[idx.teacher] || "").trim();
    const spaceIdx = teacherRaw.indexOf(" ");
    const teacherCode = spaceIdx > 0 ? teacherRaw.substring(0, spaceIdx) : teacherRaw;
    const teacherName = spaceIdx > 0 ? teacherRaw.substring(spaceIdx + 1) : teacherRaw;
    const prefix = subjectCode.substring(0, 1).toUpperCase() === "I" ? "IS" : subjectCode.charAt(0);

    out.push({
      level: String(row[idx.level] || "").trim(),
      groupNo: String(row[idx.groupNo] || "").trim(),
      year: String(row[idx.year] || "").trim(),
      term: String(row[idx.term] || "").trim(),
      groupCode: String(row[idx.groupCode] || "").trim(),
      subjectCode,
      subjectName: String(row[idx.subjectName] || "").trim(),
      credit: String(row[idx.credit] || "").trim(),
      subjectGroup: prefix === "IS" ? "IS" : (groupMap[prefix] || "อื่นๆ"),
      teacherCode, teacherName
    });
  }
  return out;
}

/* ---------------- reports (ข้อมูลที่ครูกรอก) ---------------- */
function getOrCreateReportsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(REPORTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(REPORTS_SHEET_NAME);
    sheet.appendRow(REPORT_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getReports() {
  const sheet = getOrCreateReportsSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;
    const obj = {};
    headers.forEach((h, j) => obj[h] = row[j]);
    out.push(rowObjToReport(obj));
  }
  return out;
}

function rowObjToReport(obj) {
  const grades = {}; GRADE_COLS.forEach(c => grades[c] = Number(obj["grade_" + c]) || 0);
  const charProps = {}; RATING_COLS.forEach(c => charProps[c] = Number(obj["char_" + c]) || 0);
  const readThink = {}; RATING_COLS.forEach(c => readThink[c] = Number(obj["read_" + c]) || 0);
  return {
    id: obj.id, level: obj.level, groupNo: obj.groupNo, groupCode: obj.groupCode,
    subjectCode: obj.subjectCode, subjectName: obj.subjectName, credit: obj.credit,
    subjectGroup: obj.subjectGroup, term: obj.term, year: obj.year,
    teacherCode: obj.teacherCode, teacherName: obj.teacherName,
    studentCount: Number(obj.studentCount) || 0,
    grades, charProps, readThink,
    createdAt: obj.createdAt, updatedAt: obj.updatedAt
  };
}

function reportToRow(r) {
  const row = [
    r.id, r.level, r.groupNo, r.groupCode, r.subjectCode, r.subjectName, r.credit, r.subjectGroup,
    r.term, r.year, r.teacherCode, r.teacherName, r.studentCount
  ];
  GRADE_COLS.forEach(c => row.push(r.grades?.[c] || 0));
  RATING_COLS.forEach(c => row.push(r.charProps?.[c] || 0));
  RATING_COLS.forEach(c => row.push(r.readThink?.[c] || 0));
  row.push(r.createdAt, r.updatedAt);
  return row;
}

function saveReports(reports) {
  const sheet = getOrCreateReportsSheet();
  const values = sheet.getDataRange().getValues();
  const idColIdx = 0;
  const idToRowIdx = {};
  for (let i = 1; i < values.length; i++) idToRowIdx[values[i][idColIdx]] = i + 1; // 1-based sheet row

  reports.forEach(r => {
    const row = reportToRow(r);
    if (idToRowIdx[r.id]) {
      sheet.getRange(idToRowIdx[r.id], 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
  });
}

function deleteReport(id) {
  const sheet = getOrCreateReportsSheet();
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) { sheet.deleteRow(i + 1); break; }
  }
}
