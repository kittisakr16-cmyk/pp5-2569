/* ================================================================
   form.js — หน้ากรอกแบบรายงานผลการเรียน (หน้า 2)
   เลือกครู -> ระบบดึงรายวิชาที่สอนทั้งหมดมาให้กรอกพร้อมกันหลายวิชา
   คำนวณร้อยละอัตโนมัติทุกคอลัมน์ (ผลการเรียน / คุณลักษณะฯ / การอ่านฯ)
   ================================================================ */

const FormPage = (() => {
  let currentSubjects = []; // รายวิชาของครูที่เลือก ในเทอม/ปีที่เลือก
  let editingIds = new Set(); // id ของรายงานที่กำลังแก้ไข (มีอยู่แล้วใน AppState.reports)

  function uniqueTeachersFromSeed() {
    const map = new Map();
    (AppState.subjects || []).forEach(s => map.set(s.teacherCode, s.teacherName));
    return [...map.entries()].map(([code, name]) => ({ code, name })).sort((a,b)=>a.name.localeCompare(b.name,'th'));
  }

  function fillTeacherOptions() {
    const $t = $("#in-teacher");
    $t.find("option:not(:first)").remove();
    uniqueTeachersFromSeed().forEach(t => {
      $t.append(`<option value="${t.code}">${t.name}</option>`);
    });
  }

  function makeId(groupCode, year, term) {
    return `${groupCode}__${year}__${term}`;
  }

  function findExistingReport(id) {
    return (AppState.reports || []).find(r => r.id === id);
  }

  function subjectCardTemplate(subj, existing) {
    const g = (existing && existing.grades) || {};
    const c = (existing && existing.charProps) || {};
    const rd = (existing && existing.readThink) || {};
    const studentCount = existing ? existing.studentCount : "";

    const gradeCells = GRADE_COLS.map(col => `
      <td><input type="number" min="0" class="grade-in" data-col="${col}" value="${g[col] ?? ''}"></td>
    `).join("");

    const charCells = RATING_COLS.map(col => `
      <td><input type="number" min="0" class="char-in" data-col="${col}" value="${c[col] ?? ''}"></td>
    `).join("");

    const readCells = RATING_COLS.map(col => `
      <td><input type="number" min="0" class="read-in" data-col="${col}" value="${rd[col] ?? ''}"></td>
    `).join("");

    return `
    <div class="subject-card" data-group-code="${subj.groupCode}" data-subject-code="${subj.subjectCode}"
         data-subject-name="${subj.subjectName}" data-credit="${subj.credit}" data-level="${subj.level}"
         data-group-no="${subj.groupNo}" data-subject-group="${subj.subjectGroup}">
      <div class="subject-card-head">
        <div>
          <div class="subject-title">${subj.level} — ${subj.subjectCode} ${subj.subjectName} (กลุ่ม ${subj.groupNo})</div>
          <div class="subject-meta">หน่วยกิต ${subj.credit} · กลุ่มสาระ: ${subj.subjectGroup}</div>
        </div>
        <div class="field" style="min-width:160px">
          <label>จำนวนนักเรียน</label>
          <input type="number" min="0" class="input input-sm student-count-in" value="${studentCount}">
        </div>
      </div>

      <div class="grade-section-label">ผลการเรียน</div>
      <div class="grade-grid-wrap">
        <table class="grade-table">
          <thead><tr>${GRADE_COLS.map(c=>`<th>${c}</th>`).join("")}</tr></thead>
          <tbody><tr>${gradeCells}</tr></tbody>
        </table>
      </div>

      <div style="display:flex; gap:24px; flex-wrap:wrap; margin-top:10px;">
        <div>
          <div class="grade-section-label">คุณลักษณะอันพึงประสงค์</div>
          <table class="grade-table" style="min-width:220px">
            <thead><tr>${RATING_COLS.map(c=>`<th>${c}</th>`).join("")}</tr></thead>
            <tbody><tr>${charCells}</tr></tbody>
          </table>
        </div>
        <div>
          <div class="grade-section-label">การอ่าน คิดวิเคราะห์ และเขียน</div>
          <table class="grade-table" style="min-width:220px">
            <thead><tr>${RATING_COLS.map(c=>`<th>${c}</th>`).join("")}</tr></thead>
            <tbody><tr>${readCells}</tr></tbody>
          </table>
        </div>
      </div>

      <div class="subject-summary">
        <span>รวมผลการเรียนที่กรอก: <b class="sum-grades">0</b> / <span class="target-count">0</span> คน</span>
        <span class="mismatch-msg count-warn hidden">จำนวนที่กรอกไม่ตรงกับจำนวนนักเรียน</span>
      </div>
    </div>`;
  }

  function renderSubjectCards() {
    const html = currentSubjects.map(s => {
      const id = makeId(s.groupCode, $("#in-year").val(), $("#in-term").val());
      const existing = findExistingReport(id);
      return subjectCardTemplate(s, existing);
    }).join("");
    $("#subject-rows-wrap").html(html || `<p class="text-muted" style="padding:20px 0">ไม่พบรายวิชาของครูท่านนี้ในภาคเรียน/ปีการศึกษาที่เลือก</p>`);
    bindLiveCalc();
  }

  function bindLiveCalc() {
    $(".subject-card").each(function () {
      const $card = $(this);
      const recalc = () => {
        let sum = 0;
        $card.find(".grade-in").each(function () { sum += Number($(this).val()) || 0; });
        const target = Number($card.find(".student-count-in").val()) || 0;
        $card.find(".sum-grades").text(sum);
        $card.find(".target-count").text(target);
        $card.find(".mismatch-msg").toggleClass("hidden", sum === target || target === 0);
      };
      $card.find(".grade-in, .student-count-in").off("input").on("input", recalc);
      recalc();
    });
  }

  function refreshSubjectsForSelection() {
    const teacherCode = $("#in-teacher").val();
    const term = $("#in-term").val();
    const year = $("#in-year").val();
    if (!teacherCode) {
      currentSubjects = [];
      $("#subject-rows-wrap").html("");
      $("#teacher-hint").text("เลือกครูผู้สอนเพื่อแสดงรายวิชาที่รับผิดชอบโดยอัตโนมัติ").removeClass("hidden");
      return;
    }
    currentSubjects = (AppState.subjects || []).filter(s =>
      s.teacherCode === teacherCode && String(s.term) === String(term) && String(s.year) === String(year)
    );
    $("#teacher-hint").text(`พบ ${currentSubjects.length} รายวิชา/กลุ่มที่รับผิดชอบ — กรอกผลการประเมินด้านล่างแล้วกดบันทึกทั้งหมด`);
    renderSubjectCards();
  }

  function collectReportsFromForm() {
    const teacherCode = $("#in-teacher").val();
    const teacherOpt = uniqueTeachersFromSeed().find(t => t.code === teacherCode);
    const term = $("#in-term").val();
    const year = $("#in-year").val();
    const now = new Date().toISOString();

    const reports = [];
    $(".subject-card").each(function () {
      const $card = $(this);
      const grades = {}; GRADE_COLS.forEach(col => grades[col] = Number($card.find(`.grade-in[data-col="${col}"]`).val()) || 0);
      const charProps = {}; RATING_COLS.forEach(col => charProps[col] = Number($card.find(`.char-in[data-col="${col}"]`).val()) || 0);
      const readThink = {}; RATING_COLS.forEach(col => readThink[col] = Number($card.find(`.read-in[data-col="${col}"]`).val()) || 0);

      const groupCode = $card.data("group-code");
      const id = makeId(groupCode, year, term);
      const existing = findExistingReport(id);

      reports.push({
        id,
        level: $card.data("level"),
        groupNo: $card.data("group-no"),
        groupCode,
        subjectCode: $card.data("subject-code"),
        subjectName: $card.data("subject-name"),
        credit: $card.data("credit"),
        subjectGroup: $card.data("subject-group"),
        term, year,
        teacherCode, teacherName: teacherOpt ? teacherOpt.name : "",
        studentCount: Number($card.find(".student-count-in").val()) || 0,
        grades, charProps, readThink,
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now
      });
    });
    return reports;
  }

  async function saveAll() {
    if (!$("#in-teacher").val()) {
      Swal.fire({ icon: "warning", title: "กรุณาเลือกครูผู้สอนก่อนบันทึก" });
      return;
    }
    const reports = collectReportsFromForm();
    if (!reports.length) {
      Swal.fire({ icon: "warning", title: "ไม่มีรายวิชาให้บันทึก" });
      return;
    }
    Swal.fire({ title: "กำลังบันทึก...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const res = await Api.saveReports(reports);

    reports.forEach(r => {
      const idx = AppState.reports.findIndex(x => x.id === r.id);
      if (idx >= 0) AppState.reports[idx] = r; else AppState.reports.push(r);
    });

    Swal.fire({
      icon: "success",
      title: "บันทึกรายงานสำเร็จ",
      text: res.offline ? "บันทึกลงเครื่องนี้ชั่วคราว (ยังไม่ได้เชื่อมต่อฐานข้อมูลกลาง)" : `บันทึก ${reports.length} รายวิชาเรียบร้อย`,
      timer: 1800, showConfirmButton: false
    });
    Dashboard.render();
  }

  function loadForEdit(report) {
    fillTeacherOptions();
    $("#in-teacher").val(report.teacherCode);
    $("#in-term").val(report.term);
    $("#in-year").val(report.year);
    refreshSubjectsForSelection();
  }

  function clearForm() {
    $("#in-teacher").val("");
    $("#in-year").val(2569);
    $("#in-term").val("1");
    refreshSubjectsForSelection();
  }

  function bindEvents() {
    $("#in-teacher, #in-term, #in-year").on("change", refreshSubjectsForSelection);
    $("#btn-save-report").on("click", saveAll);
    $("#btn-clear-form").on("click", clearForm);
  }

  function render() {
    fillTeacherOptions();
    refreshSubjectsForSelection();
  }

  return { render, bindEvents, loadForEdit };
})();
