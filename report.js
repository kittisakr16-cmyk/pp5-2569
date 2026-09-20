/* ================================================================
   report.js — หน้าพิมพ์ ปพ.5 และการดาวน์โหลด 4 รูปแบบ
   แบบที่ 1: ตามครูผู้สอน (รายวิชาทั้งหมดที่ครูคนนั้นสอน)
   แบบที่ 2: ตามรายวิชาที่สอน แยกตามระดับชั้น (ทุกกลุ่มที่สอนวิชาเดียวกัน)
   แบบที่ 3: ตามกลุ่มสาระ แยกตามระดับชั้น (ทุกวิชาในกลุ่มสาระ ระดับชั้นเดียวกัน)
   แบบที่ 4: ตามระดับชั้น รวมทุกกลุ่มสาระ (แถวคือกลุ่มสาระ)
   ================================================================ */

const ReportPage = (() => {

  function reportsInScope() {
    const term = $("#pf-term").val();
    const year = $("#pf-year").val();
    return (AppState.reports || []).filter(r => String(r.term) === String(term) && String(r.year) === String(year));
  }

  function calcStats(gradeCounts, studentCount) {
    let sumPoints = 0, numericN = 0;
    Object.keys(GRADE_POINTS).forEach(k => {
      const n = Number(gradeCounts[k]) || 0;
      sumPoints += n * GRADE_POINTS[k];
      numericN += n;
    });
    const mean = numericN ? sumPoints / numericN : 0;
    let sqDiffSum = 0;
    Object.keys(GRADE_POINTS).forEach(k => {
      const n = Number(gradeCounts[k]) || 0;
      sqDiffSum += n * Math.pow(GRADE_POINTS[k] - mean, 2);
    });
    const sd = numericN ? Math.sqrt(sqDiffSum / numericN) : 0;
    let ge2 = 0, ge3 = 0;
    Object.keys(GRADE_POINTS).forEach(k => {
      const n = Number(gradeCounts[k]) || 0;
      if (GRADE_POINTS[k] >= 2) ge2 += n;
      if (GRADE_POINTS[k] >= 3) ge3 += n;
    });
    const base = studentCount || numericN || 1;
    return {
      mean: mean.toFixed(2),
      sd: sd.toFixed(2),
      pctGE2: (ge2 / base * 100).toFixed(2),
      pctGE3: (ge3 / base * 100).toFixed(2)
    };
  }

  function sumGradeCounts(rows) {
    const out = {}; GRADE_COLS.forEach(c => out[c] = 0);
    rows.forEach(r => GRADE_COLS.forEach(c => out[c] += Number(r.grades?.[c]) || 0));
    return out;
  }

  function sumStudents(rows) { return rows.reduce((s, r) => s + (Number(r.studentCount) || 0), 0); }

  function pctRow(counts, base) {
    return GRADE_COLS.map(c => base ? ((counts[c] / base) * 100).toFixed(1) : "0.0");
  }

  /* ---------- populate the selector fields depending on chosen type ---------- */
  function fillSelectors() {
    const type = $("#pf-type").val();
    $("#pf-teacher-field, #pf-subject-field, #pf-group-field, #pf-level-field").addClass("hidden");

    if (type === "1") {
      $("#pf-teacher-field").removeClass("hidden");
      const $t = $("#pf-teacher"); $t.empty();
      const teachers = [...new Map((AppState.subjects||[]).map(s => [s.teacherCode, s.teacherName])).entries()];
      teachers.sort((a,b)=>a[1].localeCompare(b[1],'th')).forEach(([code,name]) => $t.append(`<option value="${code}">${name}</option>`));
    }
    if (type === "2") {
      $("#pf-subject-field").removeClass("hidden");
      const $s = $("#pf-subject"); $s.empty();
      const subs = [...new Map((AppState.subjects||[]).map(s => [s.subjectCode, s.subjectName])).entries()];
      subs.sort((a,b)=>a[0].localeCompare(b[0])).forEach(([code,name]) => $s.append(`<option value="${code}">${code} — ${name}</option>`));
    }
    if (type === "3") {
      $("#pf-group-field").removeClass("hidden");
      const $g = $("#pf-group"); $g.empty();
      SUBJECT_GROUPS.forEach(g => $g.append(`<option value="${g}">${g}</option>`));
    }
    if (type === "4") {
      $("#pf-level-field").removeClass("hidden");
      const $l = $("#pf-level"); $l.empty();
      LEVELS.forEach(l => $l.append(`<option value="${l}">${l}</option>`));
    }
  }

  /* ---------- header / cert / signature blocks (shared by all types) ---------- */
  function headBlock(subtitleRight) {
    return `
      <div class="ppa5-head">
        <h2>แบบรายงานผลการพัฒนาคุณภาพผู้เรียน (ปพ.5)</h2>
        <p>${SCHOOL_INFO.schoolNameFull}</p>
      </div>
      <div class="ppa5-meta">
        <span>ภาคเรียนที่ ${$("#pf-term").val()} ปีการศึกษา ${$("#pf-year").val()}</span>
        <span>${subtitleRight}</span>
      </div>`;
  }

  function certBlock() {
    return `<div class="ppa5-cert">ข้าพเจ้าขอรับรองว่าข้อมูลผลการเรียนที่ปรากฏในแบบรายงานฉบับนี้ถูกต้องตรงตามผลการประเมินจริงทุกประการ</div>`;
  }

  function signBlock(teacherName) {
    // ค้นหาหัวหน้ากลุ่มสาระของครูที่เลือก (ถ้ามี)
    return `
      <div class="ppa5-sign-grid">
        <div class="ppa5-sign-box"><div class="line">ลงชื่อ .............................. ครูผู้สอน</div>${teacherName ? `<div>(${teacherName})</div>` : ""}</div>
        <div class="ppa5-sign-box"><div class="line">ลงชื่อ .............................. หัวหน้ากลุ่มสาระการเรียนรู้</div></div>
        <div class="ppa5-sign-box"><div class="line">ลงชื่อ .............................. หัวหน้างานทะเบียนวัดผลและประเมินผล</div><div>(${SCHOOL_INFO.registrarHead})</div></div>
      </div>`;
  }

  function approveBlock() {
    return `
      <div class="ppa5-approve">
        <div class="ppa5-checkbox-row">
          <span><span class="ppa5-checkbox"></span>อนุมัติ</span>
          <span><span class="ppa5-checkbox"></span>ไม่อนุมัติ</span>
        </div>
        <div class="ppa5-approve-sign">
          <div>ลงชื่อ .............................. ผู้อำนวยการโรงเรียน<br>(${SCHOOL_INFO.director})<br>${SCHOOL_INFO.directorTitle}</div>
          <div>วันที่ .......... เดือน .............................. พ.ศ. ..........</div>
        </div>
      </div>`;
  }

  function footerBlock() {
    return `<div class="ppa5-footer">© ${SCHOOL_INFO.footerYear} ระบบรายงานผลการพัฒนาคุณภาพผู้เรียน | ${SCHOOL_INFO.schoolName} | พัฒนาโดย
      <a href="${SCHOOL_INFO.footerDevLink}" target="_blank">${SCHOOL_INFO.footerDevBy}</a></div>`;
  }

  const gradeHeaderCells = () => GRADE_COLS.map(c => `<th>${c}</th>`).join("") + `<th>X̄</th><th>SD</th><th>ร้อยละ<br>2.00 ขึ้นไป</th><th>ร้อยละ<br>3.00 ขึ้นไป</th>`;

  function statCells(counts, base) {
    const st = calcStats(counts, base);
    return `${GRADE_COLS.map(c => `<td>${counts[c] || 0}</td>`).join("")}<td>${st.mean}</td><td>${st.sd}</td><td>${st.pctGE2}%</td><td>${st.pctGE3}%</td>`;
  }

  /* ---------- แบบที่ 1: ตามครูผู้สอน ---------- */
  function renderType1() {
    const teacherCode = $("#pf-teacher").val();
    const rows = reportsInScope().filter(r => r.teacherCode === teacherCode);
    const teacherName = (AppState.subjects.find(s => s.teacherCode === teacherCode) || {}).teacherName || "";

    const bodyRows = rows.map(r => `
      <tr>
        <td class="left">${r.level}</td><td>${r.subjectCode}</td><td class="left">${r.subjectName}</td>
        <td>${r.credit}</td><td>${r.studentCount}</td>
        ${GRADE_COLS.map(c => `<td>${r.grades?.[c] || 0}</td>`).join("")}
      </tr>`).join("");

    const totals = sumGradeCounts(rows);
    const totalStudents = sumStudents(rows);
    const totalRow = `<tr><td colspan="5" class="left"><b>รวม</b></td>${GRADE_COLS.map(c=>`<td><b>${totals[c]}</b></td>`).join("")}</tr>`;
    const pctRowHtml = `<tr><td colspan="5" class="left"><b>ร้อยละ</b></td>${pctRow(totals, totalStudents).map(p=>`<td><b>${p}</b></td>`).join("")}</tr>`;

    return `
      ${headBlock(`ครูผู้สอน: ${teacherName}`)}
      <table class="ppa5-table">
        <thead><tr><th>ระดับชั้น</th><th>รหัสวิชา</th><th>ชื่อวิชา</th><th>นก.</th><th>จน.นร.</th>${GRADE_COLS.map(c=>`<th>${c}</th>`).join("")}</tr></thead>
        <tbody>${bodyRows || `<tr><td colspan="17">ไม่มีข้อมูล</td></tr>`}</tbody>
        <tfoot>${totalRow}${pctRowHtml}</tfoot>
      </table>
      ${certBlock()}
      ${signBlock(teacherName)}
      ${approveBlock()}
      ${footerBlock()}
    `;
  }

  /* ---------- แบบที่ 2: ตามรายวิชา แยกตามระดับชั้น ---------- */
  function renderType2() {
    const subjectCode = $("#pf-subject").val();
    const allRows = reportsInScope().filter(r => r.subjectCode === subjectCode);
    const subjectName = (allRows[0] || AppState.subjects.find(s=>s.subjectCode===subjectCode) || {}).subjectName || "";

    const bodyRows = LEVELS.map(level => {
      const rows = allRows.filter(r => r.level === level);
      if (!rows.length) return `<tr><td class="left">${level}</td><td>0</td>${GRADE_COLS.map(()=>`<td>0</td>`).join("")}<td>0.00</td><td>0.00</td><td>0.0%</td><td>0.0%</td></tr>`;
      const counts = sumGradeCounts(rows);
      const n = sumStudents(rows);
      return `<tr><td class="left">${level}</td><td>${n}</td>${statCells(counts, n)}</tr>`;
    }).join("");

    const grandCounts = sumGradeCounts(allRows);
    const grandN = sumStudents(allRows);
    const totalRow = `<tr><td class="left"><b>รวม</b></td><td><b>${grandN}</b></td>${statCells(grandCounts, grandN)}</tr>`;

    return `
      ${headBlock(`รายวิชา: ${subjectCode} ${subjectName}`)}
      <table class="ppa5-table">
        <thead><tr><th>ระดับชั้น</th><th>จน.นร.</th>${gradeHeaderCells()}</tr></thead>
        <tbody>${bodyRows}</tbody>
        <tfoot>${totalRow}</tfoot>
      </table>
      ${certBlock()}
      ${signBlock("")}
      ${approveBlock()}
      ${footerBlock()}
    `;
  }

  /* ---------- แบบที่ 3: ตามกลุ่มสาระ แยกตามระดับชั้น ---------- */
  function renderType3() {
    const group = $("#pf-group").val();
    const allRows = reportsInScope().filter(r => r.subjectGroup === group);

    const bodyRows = LEVELS.map(level => {
      const rows = allRows.filter(r => r.level === level);
      const counts = sumGradeCounts(rows);
      const n = sumStudents(rows);
      return `<tr><td class="left">${level}</td><td>${n}</td>${statCells(counts, n)}</tr>`;
    }).join("");

    const grandCounts = sumGradeCounts(allRows);
    const grandN = sumStudents(allRows);
    const totalRow = `<tr><td class="left"><b>รวม</b></td><td><b>${grandN}</b></td>${statCells(grandCounts, grandN)}</tr>`;

    return `
      ${headBlock(`กลุ่มสาระการเรียนรู้: ${group}`)}
      <table class="ppa5-table">
        <thead><tr><th>ระดับชั้น</th><th>จน.นร.</th>${gradeHeaderCells()}</tr></thead>
        <tbody>${bodyRows}</tbody>
        <tfoot>${totalRow}</tfoot>
      </table>
      ${certBlock()}
      ${signBlock(DEPT_HEADS[group] || "")}
      ${approveBlock()}
      ${footerBlock()}
    `;
  }

  /* ---------- แบบที่ 4: ตามระดับชั้น รวมทุกกลุ่มสาระ ---------- */
  function renderType4() {
    const level = $("#pf-level").val();
    const allRows = reportsInScope().filter(r => r.level === level);

    const bodyRows = SUBJECT_GROUPS.map(group => {
      const rows = allRows.filter(r => r.subjectGroup === group);
      const counts = sumGradeCounts(rows);
      const n = sumStudents(rows);
      return `<tr><td class="left">${group}</td><td>${n}</td>${statCells(counts, n)}</tr>`;
    }).join("");

    const grandCounts = sumGradeCounts(allRows);
    const grandN = sumStudents(allRows);
    const totalRow = `<tr><td class="left"><b>รวม</b></td><td><b>${grandN}</b></td>${statCells(grandCounts, grandN)}</tr>`;

    return `
      ${headBlock(`ระดับชั้น: ${level} (รวมทุกกลุ่มสาระ)`)}
      <table class="ppa5-table">
        <thead><tr><th>กลุ่มสาระ</th><th>จน.นร.</th>${gradeHeaderCells()}</tr></thead>
        <tbody>${bodyRows}</tbody>
        <tfoot>${totalRow}</tfoot>
      </table>
      ${certBlock()}
      ${signBlock("")}
      ${approveBlock()}
      ${footerBlock()}
    `;
  }

  function render() {
    const type = $("#pf-type").val();
    let html = "";
    if (type === "1") html = renderType1();
    else if (type === "2") html = renderType2();
    else if (type === "3") html = renderType3();
    else if (type === "4") html = renderType4();
    $("#ppa5-sheet").html(html);
  }

  function bindEvents() {
    $("#pf-type").on("change", fillSelectors);
    $("#btn-render-report").on("click", render);
    $("#btn-download-pdf").on("click", () => window.print());
  }

  function init() {
    fillSelectors();
    render();
  }

  return { init, bindEvents };
})();
