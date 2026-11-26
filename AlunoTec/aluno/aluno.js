/* ==========================================================
   ALUNOTEC | MAPA DE EDIÇÃO — LÓGICA DE ALUNOS
   Ordem: leitura de dados; pesquisa e tipos de turma; cartões e resumo
   e renderização; detalhes e remanejamento; avisos/conexão; eventos.
   Os IDs usados aqui vêm de aluno.html. As chaves alunotec_* são usadas
   também pelo painel, turmas e frequência; não as renomeie isoladamente.
========================================================== */

(() => {
  "use strict";

  // Evita eventos e seletores duplicados se o arquivo for incluído duas vezes.
  if (window.AlunoTecAlunos?.studentsBrowserReady) return;

  const TURMAS_KEY = "alunotec_turmas_v2";
  const ACTIVITY_KEY = "alunotec_turmas_activity_v1";
  const MOVEMENTS_KEY = "alunotec_alunos_remanejamentos_v1";
  const collator = new Intl.Collator("pt-BR", {
    numeric: true,
    sensitivity: "base",
  });

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  let activeType = "base";
  let openedClassId = "";
  let lastRenderedYear = "";
  let lastRenderedRows = new Map();
  let internetReachable = null;
  let toastTimer;

  /* ==========================================================
     UTILITÁRIOS
     Normaliza valores, compara texto e protege dados dinâmicos antes de inseri-los no HTML.
  ========================================================== */
  const escapeHtml = window.AlunoTecUtils.escapeHTML;

  function normalizeName(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  /* ==========================================================
     DADOS LOCAIS
     Lê e agrupa turmas e estudantes armazenados no navegador para uso na tela.
  ========================================================== */
  function readClasses() {
    try {
      const data = JSON.parse(localStorage.getItem(TURMAS_KEY) || "{}");
      return {
        ...data,
        base: Array.isArray(data.base) ? data.base : [],
        electives: Array.isArray(data.electives) ? data.electives : [],
      };
    } catch {
      return { base: [], electives: [] };
    }
  }

  function readMovements() {
    try {
      const data = JSON.parse(localStorage.getItem(MOVEMENTS_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function readActivities() {
    try {
      const data = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function selectedSchoolYear() {
    return String(
      window.AlunoTecShell?.getYear?.() ||
        localStorage.getItem("alunotecSchoolYear") ||
        new Date().getFullYear(),
    );
  }

  function classSchoolYear(classItem) {
    return String(
      window.AlunoTecShell?.getClassYear?.(
        classItem?.id,
        classItem?.year || classItem?.date?.slice?.(0, 4),
      ) ||
        classItem?.year ||
        classItem?.date?.slice?.(0, 4) ||
        new Date().getFullYear(),
    );
  }

  function allClasses(year = selectedSchoolYear()) {
    const data = readClasses();
    return [
      ...data.base.map((item) => ({ ...item, type: "base" })),
      ...data.electives.map((item) => ({ ...item, type: "elective" })),
    ].filter((item) => classSchoolYear(item) === String(year));
  }

  function findClass(id, data = readClasses()) {
    for (const type of ["base", "electives"]) {
      const item = data[type].find((entry) => String(entry.id) === String(id));
      if (item) return { item, type };
    }
    return null;
  }

  function getStudentGroups(year = selectedSchoolYear()) {
    const groups = new Map();
    const records = [];
    const scopedClasses = allClasses(year);
    const scopedClassIds = new Set(scopedClasses.map((item) => String(item.id)));

    for (const classItem of scopedClasses) {
      const students = Array.isArray(classItem.students) ? classItem.students : [];
      students.forEach((student, index) => {
        if (!normalizeName(student.name)) return;
        records.push({
          ...student,
          recordKey: JSON.stringify([classItem.type, String(classItem.id), String(student.id || index)]),
          classId: String(classItem.id),
          className: classItem.name || "Turma sem nome",
          classYear: classSchoolYear(classItem),
          grade: classItem.grade || "",
          shift: classItem.shift || "",
          type: classItem.type,
        });
      });
    }

    function addRecord(key, record) {
      if (!groups.has(key)) {
        groups.set(key, { key, name: record.name, baseRecords: [], electiveRecords: [], movements: [] });
      }
      const group = groups.get(key);
      group[record.type === "base" ? "baseRecords" : "electiveRecords"].push(record);
    }

    // Identificadores preservam alunos diferentes que têm o mesmo nome.
    for (const record of records.filter((item) => item.type === "base")) {
      addRecord(record.id ? `id:${record.id}` : record.recordKey, record);
    }

    const baseByName = new Map();
    const groupById = new Map();
    for (const group of groups.values()) {
      const name = normalizeName(group.name);
      if (!baseByName.has(name)) baseByName.set(name, new Set());
      baseByName.get(name).add(group.key);
      group.baseRecords.forEach((record) => {
        if (record.id) groupById.set(String(record.id), group.key);
      });
    }

    for (const record of records.filter((item) => item.type === "elective")) {
      const anchor = record.originStudentId || record.sourceStudentId;
      let key = groupById.get(String(anchor || record.id || ""));
      // Cópias legadas em Eletivas recebem outro ID. Só relaciona por nome
      // quando há um único cadastro correspondente na Base Comum.
      if (!key && !anchor) {
        const candidates = baseByName.get(normalizeName(record.name));
        if (candidates?.size === 1) key = [...candidates][0];
      }
      key ||= record.id ? `id:${record.id}` : record.recordKey;
      addRecord(key, record);
      if (record.id) groupById.set(String(record.id), key);
    }

    const groupsByName = new Map();
    for (const group of groups.values()) {
      const name = normalizeName(group.name);
      if (!groupsByName.has(name)) groupsByName.set(name, []);
      groupsByName.get(name).push(group);
    }

    for (const movement of readMovements()) {
      const belongsToYear = scopedClassIds.has(String(movement.sourceClassId || "")) ||
        scopedClassIds.has(String(movement.destinationClassId || "")) ||
        (!movement.sourceClassId && !movement.destinationClassId &&
          String(movement.date || "").slice(0, 4) === String(year));
      if (!belongsToYear) continue;
      const key = groupById.get(String(movement.studentId || ""));
      const names = groupsByName.get(normalizeName(movement.studentName));
      const group = key ? groups.get(key) : names?.length === 1 ? names[0] : null;
      group?.movements.push(movement);
    }

    return [...groups.values()].map((group) => {
      group.baseRecords.sort((a, b) => collator.compare(a.className, b.className));
      group.electiveRecords.sort((a, b) => collator.compare(a.className, b.className));
      group.movements.sort((a, b) => new Date(a.date) - new Date(b.date));
      const primary = group.baseRecords[0] || group.electiveRecords[0];
      const links = window.AlunoTecStudents?.info(primary, { year, classId: primary.classId });
      if (links) group.movements = links.history;
      const source = group.baseRecords[0];
      const frequencyRecords = group.baseRecords.length ? group.baseRecords : group.electiveRecords;
      const frequencyIds = new Set(frequencyRecords.map((item) => String(item.id)));
      const latestMovement = group.movements.filter((item) =>
        item.active !== false && frequencyIds.has(String(item.studentId))).at(-1) || null;
      return {
        ...group,
        id: primary.id || "",
        name: primary.name || group.name,
        status: primary.status || "Ativo",
        sourceName: links?.origin.name || source?.className || "—",
        sourceClassId: links?.origin.id || source?.classId || primary.classId,
        classYear: primary.classYear,
        grade: primary.grade,
        electiveNames: links ? links.electives.map((item) => item.name) : [...new Set(group.electiveRecords.map((item) => item.className))],
        latestMovement,
        frequencyClassName: links?.current.name || latestMovement?.destinationClassName || source?.className || primary.className,
        frequencyClassId: links?.current.id || latestMovement?.destinationClassId || source?.classId || primary.classId,
        moved: Boolean(links?.remapped || group.movements.length),
      };
    }).sort((a, b) => collator.compare(a.name, b.name) || collator.compare(a.id, b.id));
  }

  /* ==========================================================
     AVISOS E ATIVIDADES
     Cria mensagens temporárias e organiza atividades recentes compartilhadas com a página.
  ========================================================== */
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 3000);
  }

  function recordActivity(message) {
    const activities = readActivities();
    activities.unshift({
      id: `aluno-${Date.now()}`,
      message,
      date: new Date().toISOString(),
      read: false,
    });
    localStorage.setItem(
      ACTIVITY_KEY,
      JSON.stringify(activities.slice(0, 100)),
    );
    updateBell();
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
  }

  function localDateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const part = (type) => parts.find((item) => item.type === type).value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  }

  function todayKey() {
    return localDateKey(new Date());
  }

  /* ==========================================================
     FILTROS
     Sincroniza controles personalizados com seus campos originais e preserva os valores selecionados.
  ========================================================== */
  function enhanceSelect(select) {
    if (select.dataset.enhanced === "true") {
      refreshSelect(select);
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "custom-select";
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    select.classList.add("custom-select-native");
    select.dataset.enhanced = "true";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "select-trigger";
    trigger.setAttribute("role", "combobox");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");

    const menu = document.createElement("div");
    menu.className = "select-menu";
    menu.setAttribute("role", "listbox");
    menu.id = `${select.id || select.name}-options`;
    trigger.setAttribute("aria-controls", menu.id);
    trigger.setAttribute("aria-label", select.getAttribute("aria-label") ||
      select.closest("label")?.textContent.trim() || "Selecionar opção");
    trigger.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "ArrowUp", "Escape"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "Escape") {
        closeSelectMenus();
        return;
      }
      closeSelectMenus();
      wrapper.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
      const options = $$("button:not(:disabled)", menu);
      const target = $("[aria-selected='true']", menu) ||
        options[event.key === "ArrowUp" ? options.length - 1 : 0];
      target?.focus();
    });
    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSelectMenus();
        trigger.focus();
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const options = $$("button:not(:disabled)", menu);
      const current = options.indexOf(document.activeElement);
      let next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 :
        (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      options[next]?.focus();
    });
    wrapper.addEventListener("focusout", (event) => {
      if (!wrapper.contains(event.relatedTarget)) {
        wrapper.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
      }
    });

    wrapper.append(trigger, menu);
    select._customSelect = { wrapper, trigger, menu };

    trigger.addEventListener("click", () => {
      const open = !wrapper.classList.contains("open");
      closeSelectMenus();
      wrapper.classList.toggle("open", open);
      trigger.setAttribute("aria-expanded", String(open));
    });

    menu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-option-value]");
      if (!option || option.disabled) return;

      select.value = option.dataset.optionValue;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      wrapper.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      trigger.focus();
    });

    select.addEventListener("change", () => refreshSelect(select));
    refreshSelect(select);
  }

  function refreshSelect(select) {
    const custom = select._customSelect;
    if (!custom) return;

    const selected = select.options[select.selectedIndex];
    custom.trigger.textContent = selected?.textContent || "Selecione";

    custom.menu.innerHTML = [...select.options]
      .map(
        (option) =>
          `<button class="select-option" type="button" role="option"
                data-option-value="${escapeHtml(option.value)}"
                aria-selected="${option.selected}"
                ${option.disabled ? "disabled" : ""}>
                <span>${escapeHtml(option.textContent)}</span>
                ${option.selected ? '<span class="select-check" aria-hidden="true">✓</span>' : ""}
            </button>`,
      )
      .join("");
  }

  function closeSelectMenus() {
    $$(".custom-select.open").forEach((wrapper) => {
      wrapper.classList.remove("open");
      $(".select-trigger", wrapper)?.setAttribute("aria-expanded", "false");
    });
  }

  function enhanceAllSelects(root = document) {
    const selector = root === document ? ".students-browser select, #dialogBox select" : "select";
    $$(selector, root).forEach(enhanceSelect);
  }

  /* ==========================================================
     LISTA E RESUMO
     Monta as opções de filtro, calcula contagens e renderiza a lista de estudantes.
  ========================================================== */
  function fillFilters() {
    const currentYear = selectedSchoolYear();
    const data = readClasses();
    const available = window.AlunoTecShell?.getYears?.() ||
      [...new Set([...data.base, ...data.electives].map(classSchoolYear))]
        .sort((a, b) => Number(b) - Number(a));
    const years = available.length ? available.map(String) : [currentYear];
    const year = years.includes(currentYear) ? currentYear : years[0];
    const options = years.map((value) =>
      `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
    const list = $("#listYearFilter");
    if (list.innerHTML !== options) list.innerHTML = options;
    list.value = year;
    window.AlunoTecShell?.setYears(years, year);
    enhanceAllSelects();
    return year;
  }

  function isActive(student) {
    return student.status !== "Inativo";
  }

  function updateSummary(students) {
    const active = students.filter(isActive).length;
    $("#totalCount").textContent = students.length;
    $("#activeCount").textContent = active;
    $("#inactiveCount").textContent = students.length - active;
    $("#movedCount").textContent = students.filter((student) => student.moved).length;
  }

  function plural(count, singular, pluralForm) {
    return `${count} ${count === 1 ? singular : pluralForm}`;
  }

  function recordsForType(student, type = activeType) {
    return type === "base" ? student.baseRecords : student.electiveRecords;
  }

  function selectRows(students, { type = activeType, classId = openedClassId,
    term = "", status = "" } = {}) {
    const nameTerm = normalizeName(term);
    return students.flatMap((student) => {
      const records = recordsForType(student, type).filter((record) =>
        !classId || String(record.classId) === String(classId));
      if (!records.length || (nameTerm && !normalizeName(student.name).includes(nameTerm))) return [];
      const context = records[0];
      const row = { ...student, status: context.status || "Ativo", contextClassId: context.classId,
        contextRecordId: context.id, contextType: type };
      if (status === "Remanejado" && !row.moved) return [];
      if (status && status !== "Remanejado" && row.status !== status) return [];
      return [row];
    });
  }

  function renderClasses(classes) {
    $("#classesTitle").textContent = activeType === "base" ? "Turmas da Base Comum" : "Turmas Eletivas";
    $("#classCountLabel").textContent = plural(classes.length, "turma", "turmas");
    $("#classCards").innerHTML = classes.length ? window.AlunoTecUtils.renderClassGroups(classes, (item) => {
      const count = (Array.isArray(item.students) ? item.students : []).filter((student) =>
        normalizeName(student.name)).length;
      const info = [item.grade, item.shift, plural(count, "aluno", "alunos")].filter(Boolean).join(" · ");
      return `<button class="students-class-card" type="button" data-class-id="${escapeHtml(item.id)}"
        aria-label="Abrir ${escapeHtml(item.name || "turma")}, ${plural(count, "aluno", "alunos")}">
        <span class="students-class-icon"><svg aria-hidden="true"><use href="#i-users"></use></svg></span>
        <span class="students-class-copy"><strong>${escapeHtml(item.name || "Turma sem nome")}</strong>
          <small>${escapeHtml(info)}</small></span>
        <svg class="students-class-arrow" aria-hidden="true"><use href="#i-chevron-right"></use></svg>
      </button>`;
    }, "students-class-grid") : `<div class="students-browser-empty">
      <svg aria-hidden="true"><use href="#i-users"></use></svg>
      <strong>${activeType === "base" ? "Nenhuma turma da Base Comum" : "Nenhuma eletiva cadastrada"} neste ano.</strong>
      <p>Cadastre as turmas pela aba Turmas para consultar os alunos aqui.</p>
      <a href="../turmas/index.html">Ir para Turmas <span aria-hidden="true">→</span></a>
    </div>`;
  }

  function render() {
    const year = fillFilters();
    if (lastRenderedYear && lastRenderedYear !== year) {
      openedClassId = "";
      $("#statusFilter").value = "";
      refreshSelect($("#statusFilter"));
    }
    lastRenderedYear = year;
    const classes = allClasses(year);
    const students = getStudentGroups(year);
    $("#baseClassCount").textContent = classes.filter((item) => item.type === "base").length;
    $("#electiveClassCount").textContent = classes.filter((item) => item.type === "elective").length;
    $$("[data-student-type]").forEach((button) => {
      const active = button.dataset.studentType === activeType;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    $("#studentsTypePanel").setAttribute("aria-labelledby",
      activeType === "base" ? "baseStudentsTab" : "electiveStudentsTab");

    const scopedClasses = classes.filter((item) => item.type === activeType)
      .sort((a, b) => collator.compare(a.name, b.name));
    let openedClass = scopedClasses.find((item) => String(item.id) === openedClassId);
    if (!openedClass) openedClassId = "";
    const summaryStudents = openedClass ?
      selectRows(students, { type: activeType, classId: openedClass.id }) : students;
    updateSummary(summaryStudents);
    const term = $("#searchInput").value.trim();
    const showResults = Boolean(openedClass || term);
    $("#studentsBrowser").classList.toggle("has-opened-class", Boolean(openedClass));
    $("#studentsBackBar").hidden = !openedClass;
    $("#classBrowserPanel").hidden = showResults;
    $("#studentResults").hidden = !showResults;
    renderClasses(scopedClasses);
    if (!showResults) {
      lastRenderedRows = new Map();
      $("#studentRows").innerHTML = "";
      return;
    }

    const filtered = selectRows(students, { term, status: $("#statusFilter").value });
    lastRenderedRows = new Map(filtered.map((student) => [student.key, student]));
    $("#studentResultsTitle").textContent = openedClass?.name || "Resultados da pesquisa";
    $("#studentResultsDescription").textContent = openedClass ?
      [openedClass.grade, openedClass.shift, `Ano letivo ${year}`].filter(Boolean).join(" · ") :
      `${activeType === "base" ? "Base Comum" : "Eletivas"} · Ano letivo ${year}`;
    $("#studentResultsCount").textContent = plural(filtered.length, "aluno", "alunos");

    if (!filtered.length) {
      const hasStudents = openedClass && Array.isArray(openedClass.students) && openedClass.students.length;
      const message = openedClass && !hasStudents ? "Esta turma ainda não possui alunos cadastrados." :
        "Nenhum aluno corresponde à pesquisa e à situação selecionadas.";
      $("#studentRows").innerHTML = `<tr><td colspan="8" class="empty-state">${message}</td></tr>`;
      $("#storageNote").textContent = openedClass && !hasStudents ?
        "Os cadastros feitos na aba Turmas aparecem automaticamente nesta lista." : "";
      return;
    }

    $("#studentRows").innerHTML = filtered.map((student, index) => {
      const statusClass = !isActive(student) ? "inactive" : student.moved ? "moved" : "";
      const statusLabel = !isActive(student) ? "Inativo" : student.moved ? "Remanejado" : "Ativo";
      const electives = student.electiveNames.length ? student.electiveNames.map((name) =>
        `<span class="elective-tag">${escapeHtml(name)}</span>`).join("") : "—";
      const movement = student.latestMovement ?
        `${escapeHtml(student.latestMovement.sourceClassName)} → ${escapeHtml(student.latestMovement.destinationClassName)}<small>${formatDate(student.latestMovement.date)}</small>` :
        escapeHtml(student.frequencyClassName || "—");
      return `<tr>
        <td>${index + 1}</td><td class="student-name">${window.AlunoTecStudents?.label(student, {
          classId: student.contextClassId, year: student.classYear,
        }) || escapeHtml(student.name)}</td>
        <td>${escapeHtml(student.sourceName)}</td><td><div class="elective-tags">${electives}</div></td>
        <td>${escapeHtml(student.grade || "—")}</td>
        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        <td class="movement-detail">${movement}</td>
        <td><div class="actions">
          <button class="icon-button" type="button" data-action="view" data-key="${escapeHtml(student.key)}"
            title="Visualizar aluno" aria-label="Visualizar ${escapeHtml(student.name)}"><svg aria-hidden="true"><use href="#i-eye"></use></svg></button>
          <button class="icon-button" type="button" data-action="transfer" data-key="${escapeHtml(student.key)}"
            title="Remanejar aluno" aria-label="Remanejar ${escapeHtml(student.name)}"><svg aria-hidden="true"><use href="#i-transfer"></use></svg></button>
        </div></td></tr>`;
    }).join("");
    $("#storageNote").textContent = "A turma de origem continua registrada. Os remanejamentos preservam o histórico do aluno.";
  }

  /* ==========================================================
     DETALHES E REMANEJAMENTOS
     Abre os detalhes e executa o fluxo de movimentação do estudante entre turmas.
  ========================================================== */
  function showDialog(content, variant = "") {
    const dialog = $("#appDialog");
    const box = $("#dialogBox");
    dialog.classList.toggle("student-record-dialog", ["student-profile", "student-transfer"].includes(variant));
    dialog.classList.toggle("student-profile-dialog", variant === "student-profile");
    dialog.classList.toggle("student-transfer-dialog", variant === "student-transfer");
    box.innerHTML = content;
    const heading = box.querySelector("h2");
    if (heading) {
      heading.id = "student-dialog-title";
      dialog.setAttribute("aria-labelledby", heading.id);
    }
    enhanceAllSelects(box);
    dialog.showModal();
  }

  function showStudent(student) {
    const nameParts = String(student.name || "").trim().split(/\s+/).filter(Boolean);
    const initials = [nameParts[0], nameParts.length > 1 ? nameParts.at(-1) : ""]
      .map(part => Array.from(part || "")[0] || "").join("").toLocaleUpperCase("pt-BR");
    const statusClass = !isActive(student) ? "inactive" : student.moved ? "moved" : "";
    const statusLabel = !isActive(student) ? "Inativo" : student.moved ? "Remanejado" : "Ativo";
    const electives = student.electiveNames.length
      ? student.electiveNames.map(name =>
          `<span class="student-profile-elective">${escapeHtml(name)}</span>`).join("")
      : `<span class="student-profile-placeholder">Nenhuma eletiva vinculada</span>`;

    const history = student.movements.length
      ? `<ol class="student-profile-timeline">${student.movements.slice()
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .map(item => {
            const date = new Date(item.date);
            const formatted = Number.isNaN(date.getTime()) ? "Data não informada" :
              date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
            return `<li><div class="student-profile-route">
              <strong>${escapeHtml(item.sourceClassName || "Turma de origem")}</strong>
              <span aria-hidden="true">→</span>
              <strong>${escapeHtml(item.destinationClassName || "Turma de destino")}</strong>
              </div><time>${escapeHtml(formatted)}</time></li>`;
          }).join("")}</ol>`
      : `<div class="student-profile-empty">
          <span class="student-profile-empty-icon" aria-hidden="true">
            <svg><use href="#i-transfer"></use></svg>
          </span>
          <div><strong>Nenhum remanejamento registrado</strong>
            <p>As movimentações de turma aparecerão aqui.</p></div>
        </div>`;

    showDialog(`
      <button type="button" class="dialog-close" data-close
        aria-label="Fechar detalhes do aluno">×</button>
      <header class="student-profile-heading">
        <span class="student-profile-avatar" aria-hidden="true">${escapeHtml(initials || "A")}</span>
        <div class="student-profile-heading-copy">
          <span class="student-profile-eyebrow">Ficha do aluno</span>
          <h2>${escapeHtml(student.name)}</h2>
          <span class="status-badge ${statusClass}">${statusLabel}</span>
        </div>
      </header>
      <div class="student-profile-body">
        <dl class="student-profile-grid">
          <div class="student-profile-field">
            <dt>Turma de origem</dt><dd>${escapeHtml(student.sourceName || "—")}</dd>
          </div>
          <div class="student-profile-field">
            <dt>Turma da frequência</dt><dd>${escapeHtml(student.frequencyClassName || "—")}</dd>
          </div>
          <div class="student-profile-field student-profile-field--wide">
            <dt>Eletivas vinculadas</dt><dd class="student-profile-electives">${electives}</dd>
          </div>
          <div class="student-profile-field student-profile-field--small">
            <dt>Ano letivo</dt><dd>${escapeHtml(student.classYear || "—")}</dd>
          </div>
          <div class="student-profile-field student-profile-field--small">
            <dt>Ano/série</dt><dd>${escapeHtml(student.grade || "—")}</dd>
          </div>
        </dl>
        <section class="student-profile-history" aria-labelledby="student-profile-history-title">
          <div class="student-profile-history-heading">
            <h3 id="student-profile-history-title">
              <svg aria-hidden="true"><use href="#i-transfer"></use></svg>
              Histórico de remanejamentos
            </h3>
            ${student.movements.length ? `<span>${student.movements.length}</span>` : ""}
          </div>
          ${history}
        </section>
      </div>
      <footer class="dialog-actions student-profile-actions">
        <button type="button" class="button primary" data-close>Fechar</button>
      </footer>`, "student-profile");
  }

  function showTransfer(student) {
    const data = readClasses();
    const origin = [...student.baseRecords, ...student.electiveRecords].find((record) =>
      record.classId === student.contextClassId && String(record.id) === String(student.contextRecordId)) ||
      student.baseRecords[0] || student.electiveRecords[0];
    if (!origin) return;

    const collection = origin.type === "base" ? data.base : data.electives;
    const destinations = collection.filter(
      (item) => String(item.id) !== String(origin.classId) &&
        classSchoolYear(item) === student.classYear,
    );

    if (!destinations.length) {
      showToast(
        origin.type === "base"
          ? "Cadastre outra turma da Base Comum neste ano para remanejar este aluno."
          : "Cadastre outra eletiva para transferir este aluno.",
      );
      return;
    }

    const options = destinations
      .map(
        (item) =>
          `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`,
      )
      .join("");

    showDialog(`
      <button type="button" class="dialog-close" data-close
        aria-label="Fechar remanejamento">×</button>
      <header class="student-profile-heading">
        <span class="student-profile-avatar" aria-hidden="true">
          <svg><use href="#i-transfer"></use></svg>
        </span>
        <div class="student-profile-heading-copy">
          <span class="student-profile-eyebrow">Movimentação de turma</span>
          <h2>Remanejar aluno</h2>
          <p class="student-transfer-subtitle">Escolha a turma de destino para a frequência.</p>
        </div>
      </header>
      <form id="transferForm" class="student-transfer-form">
        <div class="student-profile-body">
          <div class="student-transfer-student">
            <span>Aluno selecionado</span>
            <strong>${escapeHtml(student.name)}</strong>
            <dl><div><dt>Turma de origem</dt><dd>${escapeHtml(origin.className)}</dd></div></dl>
          </div>
          <label class="student-transfer-destination">Turma de destino
            <select name="destinationId" aria-label="Turma de destino" required>
              <option value="">Selecione uma turma</option>${options}
            </select>
          </label>
          <p class="student-transfer-note">O aluno continuará cadastrado na turma de origem.
            A frequência será considerada na turma de destino.</p>
        </div>
        <footer class="dialog-actions student-profile-actions">
          <button type="button" class="button secondary" data-close>Cancelar</button>
          <button class="button primary" type="submit">Confirmar remanejamento</button>
        </footer>
        <input type="hidden" name="studentId" value="${escapeHtml(origin.id)}">
        <input type="hidden" name="studentName" value="${escapeHtml(student.name)}">
        <input type="hidden" name="sourceId" value="${escapeHtml(origin.classId)}">
      </form>`, "student-transfer");
  }

  function handleTransfer(event) {
    if (event.target.id !== "transferForm") return;
    event.preventDefault();

    const form = new FormData(event.target);
    const data = readClasses();
    const studentId = String(form.get("studentId") || "");
    const sourceId = String(form.get("sourceId") || "");
    const destinationId = String(form.get("destinationId") || "");
    const source = findClass(sourceId, data);
    const destination = findClass(destinationId, data);

    if (
      !source ||
      !destination ||
      source.type !== destination.type ||
      classSchoolYear(source.item) !== classSchoolYear(destination.item) ||
      sourceId === destinationId
    ) {
      showToast("Selecione uma turma de destino válida.");
      return;
    }

    const student = (source.item.students || []).find(
      (item) => String(item.id) === studentId,
    );
    if (!student) {
      showToast("Não foi possível localizar o aluno na turma de origem.");
      return;
    }

    const movements = readMovements();
    movements.forEach((item) => {
      if (String(item.studentId) === studentId) item.active = false;
    });

    movements.push({
      id: `movement-${Date.now()}`,
      studentId,
      studentName: student.name,
      sourceClassId: sourceId,
      sourceClassName: source.item.name,
      destinationClassId: destinationId,
      destinationClassName: destination.item.name,
      date: new Date().toISOString(),
      active: true,
    });

    localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(movements));
    recordActivity(
      `${student.name} remanejado(a) de ${source.item.name} para ${destination.item.name}.`,
    );
    $("#appDialog").close();
    render();
    showToast("Remanejamento registrado. O aluno continua na turma de origem.");
  }

  /* ==========================================================
     NOTIFICAÇÕES E CONEXÃO
     Atualiza avisos recentes e o indicador de disponibilidade da rede.
  ========================================================== */
  function showNotifications() {
    const items = readActivities()
      .filter(
        (item) => localDateKey(item.date || item.createdAt) === todayKey(),
      )
      .sort(
        (a, b) =>
          new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt),
      );

    $("#notificationList").innerHTML = items.length
      ? items
          .map((item) => {
            const date = new Date(item.date || item.createdAt);
            const time = Number.isNaN(date.getTime())
              ? ""
              : date.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
            return `<article class="notification-item">${escapeHtml(item.message || "Atividade registrada")}<time>${time}</time></article>`;
          })
          .join("")
      : `<p class="notification-empty">Nenhuma notificação hoje.</p>`;

    $("#notificationDialog").showModal();
  }

  function updateBell() {
    if (window.AlunoTecNotifications) { window.AlunoTecNotifications.update(); return; }
    const count = readActivities().filter(
      (item) => localDateKey(item.date || item.createdAt) === todayKey(),
    ).length;
    $("#activityBellCount").textContent = count;
    $("#activityBellCount").hidden = count === 0;
  }

  function updateConnectionStatus() {
    const button = $("#connectionStatus");
    const checking = navigator.onLine && internetReachable === null;
    const online = navigator.onLine && internetReachable === true;

    button.classList.toggle("offline", !online && !checking);
    button.classList.toggle("checking", checking);
    $("#connectionTitle").textContent = online
      ? "Online"
      : checking
        ? "Verificando"
        : "Offline";
    $("#connectionSubtitle").textContent = checking
      ? "Verificando acesso à internet…"
      : online
        ? "Salvo neste dispositivo • Supabase pendente"
        : "Alterações salvas neste dispositivo";
  }

  async function checkInternetConnection() {
    if (!navigator.onLine) {
      internetReachable = false;
      updateConnectionStatus();
      return;
    }

    internetReachable = null;
    updateConnectionStatus();

    try {
      await fetch("https://www.gstatic.com/generate_204", {
        mode: "no-cors",
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      internetReachable = true;
    } catch {
      internetReachable = false;
    }

    updateConnectionStatus();
  }

  $("#studentRows").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const student = lastRenderedRows.get(button.dataset.key);
    if (!student) return;

    if (button.dataset.action === "view") showStudent(student);
    if (button.dataset.action === "transfer") showTransfer(student);
  });

  $("#dialogBox").addEventListener("click", (event) => {
    if (event.target.closest("[data-close]")) $("#appDialog").close();
  });

  $("#dialogBox").addEventListener("submit", handleTransfer);

  $("#appDialog").addEventListener("click", (event) => {
    if (event.target === $("#appDialog")) $("#appDialog").close();
  });

  $("#searchInput").addEventListener("input", render);
  $("#listYearFilter").addEventListener("change", () => {
    const year = $("#listYearFilter").value;
    openedClassId = "";
    if (window.AlunoTecShell?.setYears) {
      window.AlunoTecShell.setYears(window.AlunoTecShell.getYears(), year, true);
    } else {
      localStorage.setItem("alunotecSchoolYear", year);
    }
    render();
  });
  document.addEventListener("alunotec:yearchange", render);
  $("#statusFilter").addEventListener("change", render);

  $(".students-type-tabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-student-type]");
    if (!button) return;
    activeType = button.dataset.studentType;
    openedClassId = "";
    $("#statusFilter").value = "";
    render();
  });
  $(".students-type-tabs").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = $$("[data-student-type]");
    const current = buttons.indexOf(event.target.closest("[data-student-type]"));
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 :
      (current + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].click();
    buttons[next].focus();
  });
  $("#classCards").addEventListener("click", (event) => {
    const button = event.target.closest("[data-class-id]");
    if (!button) return;
    openedClassId = button.dataset.classId;
    $("#statusFilter").value = "";
    render();
    $("#studentResultsTitle").focus({ preventScroll: true });
  });
  $("#backToClasses").addEventListener("click", () => {
    const previousClass = openedClassId;
    openedClassId = "";
    $("#searchInput").value = "";
    $("#statusFilter").value = "";
    render();
    const card = $$("[data-class-id]").find((button) => button.dataset.classId === previousClass);
    (card || $("#searchInput")).focus({ preventScroll: true });
  });

  if (!window.AlunoTecNotifications) $("#activityBell").addEventListener("click", showNotifications);
  $$(".notification-dialog [data-close-notifications]").forEach((button) =>
    button.addEventListener("click", () => $("#notificationDialog").close()),
  );

  $("#notificationDialog").addEventListener("click", (event) => {
    if (event.target === $("#notificationDialog"))
      $("#notificationDialog").close();
  });

  $("#clearNotifications").addEventListener("click", () => {
    localStorage.setItem(ACTIVITY_KEY, "[]");
    $("#notificationList").innerHTML =
      `<p class="notification-empty">Nenhuma notificação hoje.</p>`;
    updateBell();
    showToast("Notificações limpas.");
  });

  $("#connectionStatus").addEventListener("click", checkInternetConnection);

  /* ==========================================================
     EVENTOS DA PÁGINA
     Conecta pesquisa, filtros, ações por estudante e fechamento dos diálogos.
  ========================================================== */
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".custom-select")) closeSelectMenus();
  });

  window.addEventListener("online", checkInternetConnection);
  window.addEventListener("offline", () => {
    internetReachable = false;
    updateConnectionStatus();
  });

  window.addEventListener("storage", (event) => {
    if (
      !event.key ||
      [TURMAS_KEY, ACTIVITY_KEY, MOVEMENTS_KEY].includes(event.key)
    ) {
      render();
      updateBell();
    }
  });

  window.AlunoTecAlunos = {
    studentsBrowserReady: true,
    getFrequencyClass(studentId, originalClassId) {
      return (
        readMovements()
          .filter(
            (item) =>
              String(item.studentId) === String(studentId) &&
              item.active !== false,
          )
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .at(-1)?.destinationClassId || originalClassId
      );
    },
  };

  updateConnectionStatus();
  checkInternetConnection();
  render();
  updateBell();
})();
