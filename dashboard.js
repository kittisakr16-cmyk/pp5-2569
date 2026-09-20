/* ================================================================
   dashboard.js — หน้าแดชบอร์ด: สรุปข้อมูล + ตารางรายงานล่าสุด
   (กรองได้จาก ชื่อวิชา / ระดับชั้น / กลุ่มสาระ / ครูผู้สอน, แบ่งหน้าละ 15 แถว)
   ================================================================ */

const Dashboard = (() => {
  const PAGE_SIZE = 15;
  let state = { page: 1, filters: { name: "", level: "", group: "", teacher: "" } };

  function uniqueTeachers() {
    const set = new Map();
    (AppState.reports || []).forEach(r => set.set(r.teacherCode, r.teacherName));
    return [...set.entries()].map(([code, name]) => ({ code, name }));
  }

  function fillFilterOptions() {
    const $level = $("#f-level"), $group = $("#f-group"), $teacher = $("#f-teacher");
    $level.find("option:not(:first)").remove();
    $group.find("option:not(:first)").remove();
    $teacher.find("option:not(:first)").remove();

    LEVELS.forEach(l => $level.append(`<option value="${l}">${l}</option>`));
    SUBJECT_GROUPS.forEach(g => $group.append(`<option value="${g}">${g}</option>`));
    uniqueTeachers().forEach(t => $teacher.append(`<option value="${t.name}">${t.name}</option>`));
  }

  function getFiltered() {
    const { name, level, group, teacher } = state.filters;
    return (AppState.reports || [])
      .filter(r => !name || r.subjectName.toLowerCase().includes(name.toLowerCase()) || r.subjectCode.toLowerCase().includes(name.toLowerCase()))
      .filter(r => !level || r.level === level)
      .filter(r => !group || r.subjectGroup === group)
      .filter(r => !teacher || r.teacherName === teacher)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  function renderStats() {
    const all = AppState.reports || [];
    const totalStudents = all.reduce((s, r) => s + (Number(r.studentCount) || 0), 0);
    const teacherCount = new Set(all.map(r => r.teacherCode)).size;
    const subjectCount = new Set(all.map(r => r.subjectCode)).size;

    const cards = [
      { label: "แบบรายงานทั้งหมด", value: all.length },
      { label: "จำนวนนักเรียนที่รายงาน (รวม)", value: totalStudents.toLocaleString() },
      { label: "ครูผู้สอนที่ส่งรายงาน", value: teacherCount },
      { label: "รายวิชาที่มีการรายงาน", value: subjectCount },
    ];
    $("#stat-grid").html(cards.map(c => `
      <div class="stat-card">
        <div class="stat-value">${c.value}</div>
        <div class="stat-label">${c.label}</div>
      </div>`).join(""));
  }

  function renderTable() {
    const filtered = getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);

    if (!pageRows.length) {
      $("#report-tbody").html(`<tr class="empty-row"><td colspan="8">ยังไม่มีข้อมูลรายงานที่ตรงกับเงื่อนไข</td></tr>`);
    } else {
      $("#report-tbody").html(pageRows.map(r => `
        <tr>
          <td>${formatDate(r.updatedAt)}</td>
          <td><span class="badge">${r.level}</span></td>
          <td>${r.subjectCode}</td>
          <td>${r.subjectName}</td>
          <td>${r.subjectGroup}</td>
          <td>${r.teacherName}</td>
          <td>${r.studentCount}</td>
          <td class="text-right">
            <button class="btn-icon-sm" title="แก้ไข" onclick="Dashboard.editRow('${r.id}')">✎</button>
            <button class="btn-icon-sm" title="ลบ" onclick="Dashboard.deleteRow('${r.id}')">🗑</button>
          </td>
        </tr>`).join(""));
    }

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) { $("#pagination").html(""); return; }
    let html = `<button class="page-btn" ${state.page===1?'disabled':''} onclick="Dashboard.goPage(${state.page-1})">‹</button>`;
    for (let p = 1; p <= totalPages; p++) {
      html += `<button class="page-btn ${p===state.page?'is-active':''}" onclick="Dashboard.goPage(${p})">${p}</button>`;
    }
    html += `<button class="page-btn" ${state.page===totalPages?'disabled':''} onclick="Dashboard.goPage(${state.page+1})">›</button>`;
    $("#pagination").html(html);
  }

  function goPage(p) { state.page = p; renderTable(); }

  function formatDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString('th-TH', { day:'2-digit', month:'short', year:'2-digit' }) +
           " " + d.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });
  }

  function editRow(id) {
    const r = (AppState.reports || []).find(x => x.id === id);
    if (!r) return;
    App.goPage("form");   // สลับหน้าและเรียก FormPage.render() (ค่าเริ่มต้น) ก่อน
    FormPage.loadForEdit(r); // แล้วค่อยเติมค่าที่จะแก้ไขทับอีกที เพื่อไม่ให้ค่าเริ่มต้นไปเขียนทับ
  }

  function deleteRow(id) {
    Swal.fire({
      title: "ยืนยันการลบรายงานนี้?",
      text: "ข้อมูลที่ลบแล้วจะไม่สามารถกู้คืนได้",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบรายงาน",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#DC2626",
      cancelButtonColor: "#7C3AED",
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      await Api.deleteReport(id);
      AppState.reports = AppState.reports.filter(x => x.id !== id);
      renderStats(); renderTable();
      Swal.fire({ title: "ลบสำเร็จ", icon: "success", timer: 1200, showConfirmButton: false });
    });
  }

  function bindFilterEvents() {
    $("#f-name").on("input", (e) => { state.filters.name = e.target.value; state.page = 1; renderTable(); });
    $("#f-level").on("change", (e) => { state.filters.level = e.target.value; state.page = 1; renderTable(); });
    $("#f-group").on("change", (e) => { state.filters.group = e.target.value; state.page = 1; renderTable(); });
    $("#f-teacher").on("change", (e) => { state.filters.teacher = e.target.value; state.page = 1; renderTable(); });
  }

  function render() {
    fillFilterOptions();
    renderStats();
    renderTable();
  }

  return { render, bindFilterEvents, goPage, editRow, deleteRow };
})();
