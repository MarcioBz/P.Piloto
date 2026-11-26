(() => {
  "use strict";

  const DATA_KEY = "alunotec_turmas_v2";
  const MOVEMENTS_KEY = "alunotec_alunos_remanejamentos_v1";
  const DRAFT_KEY = "alunotec_matricula_draft_v1";
  const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
  const $ = (selector) => document.querySelector(selector);

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function currentYear() {
    return String(window.AlunoTecShell?.getYear?.() ||
      localStorage.getItem("alunotecSchoolYear") || new Date().getFullYear());
  }

  function classYear(item) {
    return String(window.AlunoTecShell?.getClassYear?.(item.id,
      item.year || item.date?.slice?.(0, 4) || currentYear()) ||
      item.year || item.date?.slice?.(0, 4) || currentYear());
  }

  function normalizeName(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
  }

  function escapeHTML(value) {
    return window.AlunoTecUtils?.escapeHTML?.(value) || String(value ?? "")
      .replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function readData() {
    const data = readJSON(DATA_KEY, {});
    return {
      ...data,
      base: Array.isArray(data.base) ? data.base : [],
      electives: Array.isArray(data.electives) ? data.electives : [],
    };
  }

  function getClasses(data, year = currentYear()) {
    return [
      ...data.base.map((item) => ({ ...item, type: "base" })),
      ...data.electives.map((item) => ({ ...item, type: "elective" })),
    ].filter((item) => classYear(item) === String(year));
  }

  function getStudents(data, year) {
    const movements = readJSON(MOVEMENTS_KEY, []);
    const index = window.AlunoTecStudents?.createIndex?.(data, movements, year);
    if (!index) return [];

    return index.entities.map((entity) => {
      const primary = entity.records.find((record) => record.type === "base") || entity.records[0];
      const details = index.describe(primary, { year, classId: primary.classId });
      const currentClass = index.classes.find((item) => String(item.id) === String(details.current.id)) ||
        entity.records.find((record) => String(record.classId) === String(details.current.id)) || primary;
      const baseRecord = entity.records.find((record) => record.type === "base");
      const statusRecord = baseRecord || primary;
      const status = statusRecord.status === "Inativo" ? "Inativo" : "Ativo";
      const type = currentClass.type === "elective" ? "electives" : "base";
      return {
        key: entity.key,
        id: primary.id,
        name: details.name || primary.name || "Aluno sem nome",
        classId: currentClass.id || primary.classId,
        className: currentClass.className || currentClass.name || "Turma não identificada",
        classType: type,
        origin: details.origin.name || "Não identificada",
        electives: details.electives.map((item) => item.name).filter(Boolean),
        reality: details.baseRemapped ? "Realidade de sala" : "Realidade do sistema",
        status,
        moved: Boolean(details.remapped),
        grade: currentClass.grade || primary.grade || "",
      };
    }).sort((a, b) => collator.compare(a.name, b.name));
  }

  function populateClassFilters(data, year) {
    const classFilter = $("#enrollmentClassFilter");
    const studentClass = $("#newStudentClass");
    const classes = getClasses(data, year);
    const currentSelection = classFilter.value;
    const studentClassSelection = studentClass.value;
    classFilter.innerHTML = '<option value="">Todas as turmas</option>' + classes
      .map((item) => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name || "Turma sem nome")}</option>`)
      .join("");
    if (classes.some((item) => String(item.id) === currentSelection)) classFilter.value = currentSelection;

    const baseClasses = classes.filter((item) => item.type === "base")
      .sort((a, b) => collator.compare(a.name || "", b.name || ""));
    studentClass.innerHTML = '<option value="">Selecione a turma de origem</option>' + baseClasses
      .map((item) => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name || "Turma sem nome")}${item.grade ? ` · ${escapeHTML(item.grade)}` : ""}</option>`)
      .join("");
    if (baseClasses.some((item) => String(item.id) === studentClassSelection)) {
      studentClass.value = studentClassSelection;
    }
    return { classes, baseClasses };
  }

  function render() {
    const year = currentYear();
    const data = readData();
    const { classes } = populateClassFilters(data, year);
    const students = getStudents(data, year);
    const active = students.filter((student) => student.status !== "Inativo").length;
    const moved = students.filter((student) => student.moved).length;

    $("#enrollmentTotal").textContent = students.length;
    $("#enrollmentActive").textContent = active;
    $("#enrollmentInactive").textContent = students.length - active;
    $("#enrollmentMoved").textContent = moved;

    const term = normalizeName($("#enrollmentSearch").value);
    const classId = $("#enrollmentClassFilter").value;
    const statusFilter = $("#enrollmentStatusFilter").value;
    const filtered = students.filter((student) => {
      const matchesName = !term || normalizeName(`${student.name} ${student.className} ${student.origin} ${student.electives.join(" ")}`).includes(term);
      const matchesClass = !classId || String(student.classId) === classId;
      const matchesStatus = !statusFilter || (statusFilter === "Remanejado" ? student.moved : student.status === statusFilter);
      return matchesName && matchesClass && matchesStatus;
    });

    $("#enrollmentCount").textContent = `${filtered.length} ${filtered.length === 1 ? "aluno" : "alunos"}`;
    $("#enrollmentRows").innerHTML = filtered.map((student, position) => {
      const statusClass = student.status === "Inativo" ? " is-inactive" : "";
      const electiveTags = student.electives.length ? student.electives
        .map((name) => `<span class="enrollment-tag">${escapeHTML(name)}</span>`).join("") :
        '<span class="enrollment-tag is-muted">Sem eletiva vinculada</span>';
      const type = student.classType === "electives" ? "electives" : "base";
      const classHref = `../turmas/index.html?turma=${encodeURIComponent(student.classId)}&tipo=${type}`;
      return `<tr>
        <td>${position + 1}</td>
        <td>${escapeHTML(student.name)}${student.grade ? `<small class="enrollment-grade">${escapeHTML(student.grade)}</small>` : ""}</td>
        <td>${escapeHTML(student.className)}</td>
        <td>${escapeHTML(student.origin)}</td>
        <td><div class="enrollment-electives">${electiveTags}</div></td>
        <td><span class="enrollment-tag${student.reality === "Realidade de sala" ? "" : " is-muted"}">${escapeHTML(student.reality)}</span></td>
        <td><span class="enrollment-status${statusClass}">${escapeHTML(student.status)}${student.moved ? " · Remanejado" : ""}</span></td>
        <td><a class="enrollment-open-class" href="${classHref}" aria-label="Abrir turma ${escapeHTML(student.className)}">Abrir turma</a></td>
      </tr>`;
    }).join("");

    const empty = filtered.length === 0;
    $("#enrollmentEmpty").hidden = !empty;
    $("#enrollmentRows").parentElement.hidden = empty;
    if (empty && classes.length) {
      $("#enrollmentEmptyTitle").textContent = students.length ? "Nenhum aluno encontrado" : "Nenhuma matrícula neste ano";
      $("#enrollmentEmptyDescription").textContent = students.length ?
        "Não há alunos que correspondam aos filtros selecionados." :
        "Cadastre uma nova matrícula para começar a acompanhar os alunos deste ano letivo.";
      $("#enrollmentEmptyLink").textContent = "Cadastrar matrícula";
      $("#enrollmentEmptyLink").href = "#nova-matricula";
      $("#enrollmentEmptyLink").onclick = (event) => {
        event.preventDefault();
        openEnrollmentDialog();
      };
    } else if (empty) {
      $("#enrollmentEmptyTitle").textContent = "Nenhuma turma da Base Comum cadastrada";
      $("#enrollmentEmptyDescription").textContent = "Cadastre uma turma primeiro para poder vincular novos alunos.";
      $("#enrollmentEmptyLink").textContent = "Abrir Turmas";
      $("#enrollmentEmptyLink").href = "../turmas/index.html?nova=1&aba=base";
      $("#enrollmentEmptyLink").onclick = null;
    }
  }

  function openEnrollmentDialog() {
    const data = readData();
    const { baseClasses } = populateClassFilters(data, currentYear());
    const note = $("#enrollmentFormNote");
    const editable = window.AlunoTecAccess?.canEdit?.() !== false;
    note.textContent = baseClasses.length ?
      "A matrícula será concluída no cadastro da turma, mantendo os dados sincronizados com Alunos e Turmas." :
      "Não há turma da Base Comum neste ano. Cadastre a turma pela aba Turmas antes de matricular.";
    $("#continueEnrollmentButton").disabled = !baseClasses.length || !editable;
    $("#enrollmentDialog").showModal();
    $("#newStudentName").focus();
  }

  $("#newEnrollmentButton").addEventListener("click", openEnrollmentDialog);
  $("#cancelEnrollmentButton").addEventListener("click", () => $("#enrollmentDialog").close());
  $("#closeEnrollmentDialog").addEventListener("click", () => $("#enrollmentDialog").close());
  $("#enrollmentDialog").addEventListener("click", (event) => {
    if (event.target === $("#enrollmentDialog")) $("#enrollmentDialog").close();
  });
  $("#enrollmentForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("#newStudentName").value.trim().normalize("NFC");
    const whatsapp = $("#newStudentWhatsapp").value.trim();
    const classId = $("#newStudentClass").value;
    const target = getClasses(readData(), currentYear()).find((item) =>
      item.type === "base" && String(item.id) === classId);
    if (!name || !target) {
      $("#enrollmentFormNote").textContent = "Informe o nome e selecione uma turma válida.";
      return;
    }
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
        name, whatsapp, classId, year: currentYear(), createdAt: new Date().toISOString(),
      }));
    } catch {
      $("#enrollmentFormNote").textContent = "Não foi possível preparar o cadastro neste navegador. Tente novamente.";
      return;
    }
    const params = new URLSearchParams({ turma: String(target.id), tipo: "base", matricula: "1" });
    window.location.href = `../turmas/index.html?${params.toString()}`;
  });

  ["#enrollmentSearch", "#enrollmentClassFilter", "#enrollmentStatusFilter"].forEach((selector) => {
    $(selector).addEventListener(selector === "#enrollmentSearch" ? "input" : "change", render);
  });
  document.addEventListener("alunotec:yearchange", render);
  window.addEventListener("pageshow", render);
  window.addEventListener("storage", (event) => {
    if (!event.key || [DATA_KEY, MOVEMENTS_KEY, "alunotecSchoolYear"].includes(event.key)) render();
  });

  render();
})();
