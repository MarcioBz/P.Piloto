"use strict";

(() => {
  const KEY_ATTENDANCE = "alunotec_frequencia_v1";
  const KEY_YEAR = "alunotecSchoolYear";
  const yearSelect = document.getElementById("reportYear");
  const monthSelect = document.getElementById("reportMonth");
  const rows = document.getElementById("reportRows");
  const emptyMessage = document.getElementById("emptyMessage");
  const status = document.getElementById("reportStatus");
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  months.forEach((label, index) => {
    const option = document.createElement("option");
    option.value = String(index + 1).padStart(2, "0");
    option.textContent = label;
    monthSelect.append(option);
  });

  let attendance = {};
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY_ATTENDANCE) || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) attendance = parsed;
  } catch {
    status.textContent = "Os dados locais de frequência estão inválidos. Confira a cópia de segurança antes de substituir dados.";
  }

  const recordYears = Object.values(attendance).map((call) => String(call?.year || call?.date?.slice?.(0, 4) || "")).filter((year) => /^\d{4}$/.test(year));
  const selectedYear = localStorage.getItem(KEY_YEAR) || String(new Date().getFullYear());
  const years = [...new Set([...recordYears, selectedYear])].sort().reverse();
  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    option.selected = year === selectedYear;
    yearSelect.append(option);
  });

  function getFilteredCalls() {
    return Object.values(attendance).filter((call) => {
      if (!call || typeof call !== "object" || !call.date) return false;
      const year = String(call.year || call.date.slice(0, 4));
      return year === yearSelect.value && (monthSelect.value === "all" || call.date.slice(5, 7) === monthSelect.value);
    });
  }

  function calculate() {
    const calls = getFilteredCalls();
    const byClass = new Map();
    let students = 0, present = 0, absent = 0;
    calls.forEach((call) => {
      const classId = String(call.classId ?? call.className ?? "sem-turma");
      const className = String(call.className || "Turma sem nome");
      if (!byClass.has(classId)) byClass.set(classId, { name: className, calls: 0, students: 0, present: 0, absent: 0, justified: 0 });
      const summary = byClass.get(classId);
      summary.calls += 1;
      const records = call.students && typeof call.students === "object" ? Object.values(call.students) : [];
      records.forEach((record) => {
        if (!record || typeof record !== "object" || !record.status) return;
        summary.students += 1;
        students += 1;
        if (record.status === "presente") { summary.present += 1; present += 1; }
        else if (record.status === "ausente") { summary.absent += 1; absent += 1; }
        else if (record.status === "justificado") summary.justified += 1;
      });
    });
    document.getElementById("callCount").textContent = String(calls.length);
    document.getElementById("studentCount").textContent = String(students);
    document.getElementById("presentCount").textContent = String(present);
    document.getElementById("absenceCount").textContent = String(absent);
    rows.replaceChildren();
    [...byClass.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).forEach((item) => {
      const row = document.createElement("tr");
      [item.name, item.calls, item.students, item.present, item.absent, item.justified].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        row.append(cell);
      });
      rows.append(row);
    });
    emptyMessage.hidden = calls.length > 0;
  }

  function csvCell(value) {
    let text = String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }
  function exportCsv() {
    const data = [...getFilteredCalls()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (!data.length) { status.textContent = "Não há chamadas para exportar com esses filtros."; return; }
    const lines = [["Data", "Ano letivo", "Turma", "Turno", "Aluno", "Situação"]];
    data.forEach((call) => Object.values(call.students || {}).forEach((student) => {
      lines.push([call.date, call.year || call.date.slice(0, 4), call.className || "", call.shift || "", student.studentName || "", student.status || ""]);
    }));
    const csv = "\uFEFF" + lines.map((line) => line.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `alunotec-frequencia-${yearSelect.value}-${monthSelect.value}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    status.textContent = `${data.length} chamada(s) exportada(s).`;
  }

  yearSelect.addEventListener("change", calculate);
  monthSelect.addEventListener("change", calculate);
  document.getElementById("exportReport").addEventListener("click", exportCsv);
  calculate();
})();
