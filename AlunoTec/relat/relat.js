/* ==========================================================
   ALUNOTEC | MAPA DE EDIÇÃO — LÓGICA DE RELATÓRIOS
   Preenche filtros, seleciona as chamadas do ano/mês escolhido,
   calcula os totais e exporta os registros em CSV. Os IDs vêm de
   relat.html; os dados de frequência são compartilhados com a chamada.
========================================================== */

"use strict";

(() => {
  const KEY_ATTENDANCE = "alunotec_frequencia_v1";
  const KEY_CLASSES = "alunotec_turmas_v2";
  const yearSelect = document.getElementById("reportYear");
  const monthSelect = document.getElementById("reportMonth");
  const rows = document.getElementById("reportRows");
  const emptyMessage = document.getElementById("emptyMessage");
  const status = document.getElementById("reportStatus");
  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  /* ==========================================================
     FILTROS
     Preenche os seletores de mês e ano com os períodos disponíveis para consulta.
  ========================================================== */
  months.forEach((label, index) => {
    const option = document.createElement("option");
    option.value = String(index + 1).padStart(2, "0");
    option.textContent = label;
    monthSelect.append(option);
  });

  /* ==========================================================
     LEITURA
     Lê do armazenamento local as chamadas que serão usadas na montagem do relatório.
  ========================================================== */
  let attendance = {};
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY_ATTENDANCE) || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      attendance = parsed;
  } catch {
    status.textContent =
      "Os dados locais de frequência estão inválidos. Confira a cópia de segurança antes de substituir dados.";
  }

  function normalizeClassYear(item) {
    const year = String(item?.year || "").trim();
    if (/^\d{4}$/.test(year)) return year;
    const dateYear = String(item?.date || "").slice(0, 4);
    return /^\d{4}$/.test(dateYear)
      ? dateYear
      : String(new Date().getFullYear());
  }

  function getClassYearIndex() {
    const index = new Map();
    try {
      const saved = JSON.parse(localStorage.getItem(KEY_CLASSES) || "{}");
      ["base", "electives"].forEach((type) => {
        (Array.isArray(saved?.[type]) ? saved[type] : []).forEach((item) => {
          if (item?.id != null)
            index.set(String(item.id), normalizeClassYear(item));
        });
      });
    } catch {}
    return index;
  }

  let classYearById = getClassYearIndex();

  function getCallYear(call) {
    return String(
      classYearById.get(String(call?.classId ?? "")) ||
        call?.year ||
        call?.date?.slice?.(0, 4) ||
        "",
    );
  }

  function refreshYearOptions(preferredYear = "") {
    classYearById = getClassYearIndex();
    const years = window.AlunoTecShell?.getYears?.() || [];
    const options = years.length ? years : [String(new Date().getFullYear())];
    const current = String(
      preferredYear || window.AlunoTecShell?.getYear?.() || options[0],
    );
    const selectedYear = options.includes(current) ? current : options[0];
    yearSelect.replaceChildren(
      ...options.map((year) => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        option.selected = year === selectedYear;
        return option;
      }),
    );
  }

  refreshYearOptions();

  /* ==========================================================
     SELEÇÃO E CÁLCULO
     Aplica os filtros escolhidos, calcula os totais e atualiza as linhas da tabela.
  ========================================================== */
  function getFilteredCalls() {
    return Object.values(attendance).filter((call) => {
      if (!call || typeof call !== "object" || !call.date) return false;
      const year = getCallYear(call);
      return (
        year === yearSelect.value &&
        (monthSelect.value === "all" ||
          call.date.slice(5, 7) === monthSelect.value)
      );
    });
  }

  function calculate() {
    const calls = getFilteredCalls();
    const byClass = new Map();
    let students = 0,
      present = 0,
      absent = 0;
    calls.forEach((call) => {
      const classId = String(call.classId ?? call.className ?? "sem-turma");
      const className = String(call.className || "Turma sem nome");
      if (!byClass.has(classId))
        byClass.set(classId, {
          name: className,
          calls: 0,
          students: 0,
          present: 0,
          absent: 0,
          justified: 0,
        });
      const summary = byClass.get(classId);
      summary.calls += 1;
      const records =
        call.students && typeof call.students === "object"
          ? Object.values(call.students)
          : [];
      records.forEach((record) => {
        if (!record || typeof record !== "object" || !record.status) return;
        summary.students += 1;
        students += 1;
        if (record.status === "presente") {
          summary.present += 1;
          present += 1;
        } else if (record.status === "ausente") {
          summary.absent += 1;
          absent += 1;
        } else if (record.status === "justificado") summary.justified += 1;
      });
    });
    document.getElementById("callCount").textContent = String(calls.length);
    document.getElementById("studentCount").textContent = String(students);
    document.getElementById("presentCount").textContent = String(present);
    document.getElementById("absenceCount").textContent = String(absent);
    rows.replaceChildren();
    [...byClass.values()]
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .forEach((item) => {
        const row = document.createElement("tr");
        [
          item.name,
          item.calls,
          item.students,
          item.present,
          item.absent,
          item.justified,
        ].forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = String(value);
          row.append(cell);
        });
        rows.append(row);
      });
    emptyMessage.hidden = calls.length > 0;
  }

  /* ==========================================================
     EXPORTAÇÃO
     Escapa valores para CSV e inicia o download somente com os registros filtrados.
  ========================================================== */
  function csvCell(value) {
    let text = String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }
  function exportCsv() {
    const data = [...getFilteredCalls()].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
    if (!data.length) {
      status.textContent = "Não há chamadas para exportar com esses filtros.";
      return;
    }
    const lines = [
      ["Data", "Ano letivo", "Turma", "Turno", "Aluno", "Situação"],
    ];
    data.forEach((call) =>
      Object.values(call.students || {}).forEach((student) => {
        lines.push([
          call.date,
          getCallYear(call),
          call.className || "",
          call.shift || "",
          student.studentName || "",
          student.status || "",
        ]);
      }),
    );
    const csv =
      "\uFEFF" + lines.map((line) => line.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `alunotec-frequencia-${yearSelect.value}-${monthSelect.value}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    status.textContent = `${data.length} chamada(s) exportada(s).`;
  }

  /* ==========================================================
     EVENTOS
     Atualiza a consulta quando os filtros mudam e conecta o botão de exportação.
  ========================================================== */
  yearSelect.addEventListener("change", () => {
    if (window.AlunoTecShell?.setYears) {
      window.AlunoTecShell.setYears(
        window.AlunoTecShell.getYears(),
        yearSelect.value,
        true,
      );
    } else {
      calculate();
    }
  });
  document.addEventListener("alunotec:yearchange", (event) => {
    const year = String(event.detail?.year || "");
    refreshYearOptions(year);
    calculate();
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY_CLASSES) return;
    refreshYearOptions();
    calculate();
  });
  monthSelect.addEventListener("change", calculate);
  document.getElementById("exportReport").addEventListener("click", exportCsv);
  calculate();
})();
