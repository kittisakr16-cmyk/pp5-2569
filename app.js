/* ================================================================
   app.js — จุดเริ่มต้นระบบ: โหลดข้อมูล, จัดการนำทางระหว่างหน้า
   ================================================================ */

const AppState = {
  subjects: [],   // รายวิชา/ครูผู้สอน (จาก Sheet จริง หรือ SEED_SUBJECTS)
  reports: []     // รายงานผลที่บันทึกไว้ทั้งหมด
};

const App = (() => {

  function goPage(name) {
    $(".page").addClass("hidden");
    $(`#page-${name}`).removeClass("hidden");
    $(".nav-item").removeClass("is-active");
    $(`.nav-item[data-page="${name}"]`).addClass("is-active");

    const titles = { dashboard: "แดชบอร์ด", form: "กรอกรายงานผล", print: "พิมพ์ ปพ.5 / ดาวน์โหลด" };
    $("#page-title").text(titles[name] || "");
    $(".sidebar").removeClass("is-open");

    if (name === "dashboard") Dashboard.render();
    if (name === "form") FormPage.render();
    if (name === "print") ReportPage.init();
  }

  async function updateConnectionStatus() {
    const status = await Api.checkConnection();
    const $dot = $("#conn-dot"), $label = $("#conn-label");
    if (!Api.isOnline()) {
      $dot.removeClass("ok").addClass("offline");
      $label.text("โหมดออฟไลน์ (บันทึกในเครื่องนี้)");
    } else if (status.ok) {
      $dot.removeClass("offline").addClass("ok");
      $label.text("เชื่อมต่อฐานข้อมูลสำเร็จ");
    } else {
      $dot.removeClass("ok").addClass("offline");
      $label.text("เชื่อมต่อฐานข้อมูลไม่สำเร็จ");
    }
  }

  function bindNav() {
    $(".nav-item").on("click", function () { goPage($(this).data("page")); });
    $("[data-page]").on("click", function () { goPage($(this).data("page")); });
    $("#mobile-menu-btn").on("click", () => $(".sidebar").toggleClass("is-open"));
  }

  async function init() {
    bindNav();
    Dashboard.bindFilterEvents();
    FormPage.bindEvents();
    ReportPage.bindEvents();

    updateConnectionStatus();

    AppState.subjects = await Api.getSubjects();
    AppState.reports = await Api.getReports();

    goPage("dashboard");
  }

  return { goPage, init };
})();

$(function () { App.init(); });
