(() => {
  "use strict";
  const $ = id => document.getElementById(id), model = window.AlunoTecTeachers, service = window.AlunoTecTeacherService;
  const esc = window.AlunoTecUtils.escapeHTML;
  const norm = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const paths = {
    users: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a5 5 0 0 1 10 0v3M17 4a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 4v3"/>',
    cap: '<path d="m2 8 10-5 10 5-10 5ZM6 10v6c3 3 9 3 12 0v-6M22 8v9"/>',
    inactive: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a5 5 0 0 1 9-3M17 15l5 5M22 15l-5 5"/>',
    layers: '<path d="m3 7 9-4 9 4-9 4ZM3 12l9 4 9-4M3 17l9 4 9-4"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>', plus: '<path d="M12 4v16M4 12h16"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="m15 4 5 5M4 16 17 3l4 4L8 20l-5 1ZM13 21H3"/>',
    toggle: '<path d="M12 2v10M7 5a9 9 0 1 0 10 0"/>',
    delete: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>', save: '<path d="M4 3h13l4 4v14H3V3ZM7 3v6h10V3M7 21v-8h10v8"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${name === "teacher" ? '<use href="#at-icon-teacher"></use>' : paths[name] || paths.users}</svg>`;
  document.querySelectorAll("[data-teacher-icon]").forEach(item => { item.innerHTML = icon(item.dataset.teacherIcon); });
  const state = { allowed: false, data: model.empty(), classes: { base: [], electives: [] }, page: 1, pageSize: 8, draft: null, pending: null, busy: false };
  const year = () => String(window.AlunoTecShell?.getYear?.() || localStorage.getItem("alunotecSchoolYear") || new Date().getFullYear());
  const semester = () => new Date().getMonth() < 6 ? "1" : "2";
  const classes = y => model.electivesForYear(state.classes, y);
  const className = (id, y) => classes(y).find(item => String(item.id) === id)?.name || "Eletiva removida do cadastro";
  function feedback(message) { $("teacherFeedback").textContent = message; }
  function guard(title, message) {
    $("teacherGuardTitle").textContent = title; $("teacherGuardText").textContent = message;
    $("teacherGuard").hidden = false; $("teacherContent").hidden = true;
  }
  async function authorize() {
    if (service.enabled) {
      state.allowed = service.canManage(await service.session());
      if (!state.allowed) throw new Error("Somente Administrador, Secretaria e Administrativo podem gerenciar professores.");
    } else {
      const local = window.AlunoTecAccess?.session();
      state.allowed = local?.mode === "local" && local.role === "LOCAL";
      if (!state.allowed) throw new Error("Abra a entrada local de edição para preparar o cadastro neste dispositivo. Professores e visitantes não gerenciam atribuições.");
    }
    $("teacherMode").textContent = service.enabled ? "Cadastro compartilhado · permissões verificadas pelo serviço da escola." :
      "Cadastro local neste dispositivo. Os códigos ficam reservados para cada professor; o login individual será ativado após conectar a autenticação e o banco compartilhado da escola.";
  }
  let loadVersion = 0;
  async function load() {
    const version = ++loadVersion;
    try {
      await authorize();
      const remote = service.enabled ? await service.list() : null;
      if (version !== loadVersion) return;
      state.data = model.validate(remote ? remote.document : model.read());
      state.classes = remote ? remote.classes : JSON.parse(localStorage.getItem("alunotec_turmas_v2") || '{"base":[],"electives":[]}');
      if (!state.classes || !Array.isArray(state.classes.electives)) throw new Error("Não foi possível ler o cadastro de turmas de eletivas. Nenhum dado foi alterado.");
      $("teacherGuard").hidden = true; $("teacherContent").hidden = false; render();
    } catch (error) { state.allowed = false; guard("Cadastro de professores indisponível", error.message); }
  }
  function termIds(teacher, y, term) { return teacher.assignments[y]?.[term] || []; }
  function render() {
    const all = state.data.teachers, y = year(), term = $("teacherTermFilter").value, status = $("teacherStatusFilter").value, query = norm($("teacherSearch").value.trim());
    $("teacherCount").textContent = all.length;
    $("teacherActive").textContent = all.filter(item => item.status === "active").length;
    $("teacherInactive").textContent = all.filter(item => item.status === "inactive").length;
    $("teacherSubjects").textContent = new Set(all.map(item => norm(item.subject.trim()))).size;
    $("teacherYearContext").textContent = `Atribuições do ano letivo ${y} · os códigos permanecem iguais entre semestres e anos.`;
    const filtered = all.filter(item => (status === "all" || item.status === status) &&
      (term === "all" || termIds(item, y, term).length) && (!query || norm([item.name, item.subject, item.code,
        ...["1", "2"].flatMap(t => termIds(item, y, t).map(id => className(id, y)))].join(" ")).includes(query)))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base", numeric: true }));
    const pages = Math.max(1, Math.ceil(filtered.length / state.pageSize)); state.page = Math.min(state.page, pages);
    const start = (state.page - 1) * state.pageSize, visible = filtered.slice(start, start + state.pageSize);
    $("teacherRows").innerHTML = visible.map(item => {
      const selectedTerms = ["1", "2"].filter(t => (term === "all" || term === t) && termIds(item, y, t).length);
      const terms = selectedTerms.map(t => `${t}º`).join(" e ");
      const initials = item.name.split(/\s+/).map(part => part[0]).filter(Boolean); const avatar = (initials[0] || "") + (initials.length > 1 ? initials.at(-1) : "");
      const actions = [["view", "eye", "Consultar cadastro", ""], ["edit", "edit", "Editar cadastro", "edit"], ["toggle", "toggle", item.status === "active" ? "Desativar professor" : "Ativar professor", "toggle"], ["delete", "delete", "Excluir professor", "delete"]];
      return `<tr><td><span class="teacher-identity"><span class="teacher-avatar" aria-hidden="true">${esc(avatar)}</span><strong>${esc(item.name)}</strong></span></td>
        <td>${esc(item.subject)}</td><td><span class="teacher-code"><code>${item.code}</code><button type="button" data-teacher-action="copy" data-teacher-id="${esc(item.id)}" aria-label="Copiar código de ${esc(item.name)}" title="Copiar código de acesso">${icon("copy")}</button></span></td>
        <td>${terms ? `${terms} semestre${selectedTerms.length > 1 ? "s" : ""}` : '<span class="teacher-empty-term">Sem atribuições</span>'}</td>
        <td>${selectedTerms.map(t => `<span class="teacher-linked-term">${selectedTerms.length > 1 ? `<small>${t}º</small>` : ""}${termIds(item, y, t).map(id => esc(className(id, y))).join(", ")}</span>`).join("") || '<span class="teacher-empty-term">—</span>'}</td>
        <td><span class="teacher-status${item.status === "inactive" ? " is-inactive" : ""}">${item.status === "active" ? "Ativo" : "Inativo"}</span></td>
        <td><span class="teacher-row-actions">${actions.map(([action, symbol, label, style]) => `<button type="button" class="teacher-icon-button ${style}" data-teacher-action="${action}" data-teacher-id="${esc(item.id)}" aria-label="${label}: ${esc(item.name)}" title="${label}">${icon(symbol)}</button>`).join("")}</span></td></tr>`;
    }).join("");
    $("teacherEmpty").hidden = filtered.length > 0;
    $("teacherEmptyTitle").textContent = all.length ? "Nenhum professor encontrado" : "Nenhum professor cadastrado";
    $("teacherEmptyText").textContent = all.length ? "Ajuste a busca ou os filtros para consultar outros cadastros." : "Use Novo Professor para começar.";
    $("teacherListCount").textContent = filtered.length ? `Mostrando ${start + 1} a ${Math.min(start + state.pageSize, filtered.length)} de ${filtered.length} professor${filtered.length === 1 ? "" : "es"}` : "0 professores nesta consulta";
    $("teacherPage").textContent = `${state.page} / ${pages}`;
    $("teacherPrev").disabled = state.page <= 1; $("teacherNext").disabled = state.page >= pages;
  }
  function formError(message) { $("teacherFormError").textContent = message; $("teacherFormError").hidden = !message; }
  function openForm(id = "") {
    if (!state.allowed || state.busy) return;
    const teacher = id ? state.data.teachers.find(item => item.id === id) : null;
    if (id && !teacher) return feedback("O professor não está mais no cadastro.");
    const y = year(), preferred = $("teacherTermFilter").value;
    state.draft = { id, year: y, teacher, terms: { "1": [...termIds(teacher || { assignments: {} }, y, "1")], "2": [...termIds(teacher || { assignments: {} }, y, "2")] }, touched: new Set(), term: preferred === "all" ? semester() : preferred };
    $("teacherForm").reset(); formError("");
    $("teacherDialogTitleText").textContent = teacher ? "Editar Professor" : "Cadastrar Professor";
    $("teacherName").value = teacher?.name || ""; $("teacherSubject").value = teacher?.subject || "";
    $("teacherStatus").value = teacher?.status || "active"; $("teacherTerm").value = state.draft.term;
    window.AlunoTecSelect.refreshAll();
    try { state.draft.previewCode = teacher?.code || (service.enabled ? "" : model.generateCode(state.data)); }
    catch (error) { return feedback(error.message); }
    $("teacherCode").value = state.draft.previewCode || "Gerado ao salvar";
    $("teacherFormYear").textContent = y;
    $("teacherFormInfo").textContent = service.enabled ? "O mesmo código individual permanece no 1º e no 2º semestre. Alterar os vínculos não gera outro código." :
      "O mesmo código será preservado entre os semestres. Neste modo, ele identifica o cadastro e ainda não permite login; a autenticação será feita pelo serviço da escola.";
    setClassPickerOpen(false); renderOptions(); $("teacherDialog").showModal(); $("teacherName").focus();
  }
  function renderTags() {
    const draft = state.draft, ids = new Set(draft.terms[draft.term]);
    $("teacherClassSummary").textContent = ids.size ? `${ids.size} eletiva${ids.size === 1 ? " selecionada" : "s selecionadas"}` : "Selecione as eletivas";
    $("teacherClassCount").textContent = `${ids.size} eletiva${ids.size === 1 ? " selecionada" : "s selecionadas"}`;
    $("teacherClassToggle").classList.toggle("has-selection", ids.size > 0);
    $("teacherClassTags").hidden = ids.size === 0;
    $("teacherClassTags").innerHTML = [...ids].map(id => `<button class="teacher-class-tag" type="button" data-remove-class="${esc(id)}" aria-label="Remover vínculo com ${esc(className(id, draft.year))}">${esc(className(id, draft.year))}${icon("close")}</button>`).join("");
  }
  function renderOptions() {
    const draft = state.draft, ids = new Set(draft.terms[draft.term]);
    const options = classes(draft.year).filter(item => model.activeClass(item) || ids.has(String(item.id))).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
    renderTags();
    $("teacherClassContext").textContent = `${draft.term}º semestre · Ano letivo ${draft.year}`;
    $("teacherClassOptions").innerHTML = options.map((item, index) => `<label for="teacherElectiveOption${index}"><input id="teacherElectiveOption${index}" type="checkbox" value="${esc(item.id)}" ${ids.has(String(item.id)) ? "checked" : ""} ${!model.activeClass(item) ? "disabled" : ""}><span>${esc(item.name)}${!model.activeClass(item) ? " (inativa)" : ""}</span></label>`).join("") ||
      '<p>Nenhuma eletiva ativa neste ano. Cadastre a turma em <a href="../turmas/index.html?aba=electives&amp;nova=1">Turmas → Eletivas</a> e volte para fazer o vínculo.</p>';
  }
  function setClassPickerOpen(open, focusToggle = false) {
    const picker = $("teacherClassPanel");
    if (open) {
      if (!state.draft || !$("teacherDialog").open) return;
      window.AlunoTecSelect.close(); renderOptions();
      if (!picker.open) picker.showModal();
      const options = [...$("teacherClassOptions").querySelectorAll("input:not(:disabled)")];
      (options.find(option => option.checked) || options[0] || $("teacherClassDone")).focus();
    } else if (picker.open) picker.close();
    syncClassPickerState();
    if (focusToggle && $("teacherDialog").open) $("teacherClassToggle").focus();
  }
  function syncClassPickerState() {
    const open = $("teacherClassPanel").open;
    $("teacherClassToggle").setAttribute("aria-expanded", String(open));
    $("teacherClassSelect").classList.toggle("is-open", open);
  }
  $("teacherClassToggle").addEventListener("click", () => setClassPickerOpen(true));
  $("teacherClassToggle").addEventListener("keydown", event => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault(); setClassPickerOpen(true);
    const options = [...$("teacherClassOptions").querySelectorAll("input:not(:disabled)")];
    (options.find(option => option.checked) || (event.key === "ArrowUp" ? options.at(-1) : options[0]))?.focus();
  });
  $("teacherClassDone").addEventListener("click", () => setClassPickerOpen(false, true));
  $("teacherClassClose").addEventListener("click", () => setClassPickerOpen(false, true));
  $("teacherClassPanel").addEventListener("cancel", event => {
    event.preventDefault(); setClassPickerOpen(false, true);
  });
  $("teacherClassPanel").addEventListener("close", syncClassPickerState);
  $("teacherClassPanel").addEventListener("click", event => {
    const picker = $("teacherClassPanel"); if (event.target !== picker) return;
    const rect = picker.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setClassPickerOpen(false, true);
  });
  $("teacherDialog").addEventListener("close", () => setClassPickerOpen(false));
  $("teacherClassOptions").addEventListener("change", event => {
    if (!state.draft || event.target.type !== "checkbox") return;
    const ids = new Set(state.draft.terms[state.draft.term]);
    if (event.target.checked) ids.add(event.target.value); else ids.delete(event.target.value);
    state.draft.terms[state.draft.term] = [...ids]; state.draft.touched.add(state.draft.term); renderTags();
  });
  $("teacherClassTags").addEventListener("click", event => {
    const button = event.target.closest("[data-remove-class]"); if (!button || !state.draft) return;
    state.draft.terms[state.draft.term] = state.draft.terms[state.draft.term].filter(id => id !== button.dataset.removeClass);
    state.draft.touched.add(state.draft.term); renderOptions(); $("teacherClassToggle").focus();
  });
  $("teacherTerm").addEventListener("change", () => { if (!state.draft) return; setClassPickerOpen(false); state.draft.term = $("teacherTerm").value; renderOptions(); });
  async function copyCode(id) {
    const item = state.data.teachers.find(item => item.id === id); if (!state.allowed || !item) return;
    try { await navigator.clipboard.writeText(item.code); feedback(`Código de ${item.name} copiado.`); }
    catch { feedback("O navegador não permitiu copiar. O código está disponível na coluna Código de acesso e na consulta do cadastro."); }
  }
  function view(id) {
    const teacher = state.data.teachers.find(item => item.id === id); if (!teacher || !state.allowed) return;
    $("teacherViewContent").innerHTML = `<dl><div><dt>Nome completo</dt><dd>${esc(teacher.name)}</dd></div><div><dt>Disciplina / Matéria</dt><dd>${esc(teacher.subject)}</dd></div><div><dt>Código individual</dt><dd><span class="teacher-code"><code>${teacher.code}</code><button type="button" data-copy-view="${esc(id)}" aria-label="Copiar código">${icon("copy")}</button></span></dd></div><div><dt>Status</dt><dd>${teacher.status === "active" ? "Ativo" : "Inativo"}</dd></div></dl>` +
      Object.entries(teacher.assignments).sort((a, b) => b[0].localeCompare(a[0])).map(([y, terms]) => `<h3>Ano letivo ${esc(y)}</h3>${["1", "2"].map(term => `<p><strong>${term}º semestre:</strong> ${(terms[term] || []).map(id => esc(className(id, y))).join(", ") || "Sem turmas atribuídas"}</p>`).join("")}`).join("");
    $("teacherView").showModal();
  }
  $("teacherViewContent").addEventListener("click", event => { const button = event.target.closest("[data-copy-view]"); if (button) copyCode(button.dataset.copyView); });
  function confirm(action, id) {
    const teacher = state.data.teachers.find(item => item.id === id); if (!teacher || !state.allowed) return;
    state.pending = { action, id, status: teacher.status === "active" ? "inactive" : "active" };
    $("teacherConfirmTitle").textContent = action === "delete" ? "Excluir professor?" : teacher.status === "active" ? "Desativar professor?" : "Ativar professor?";
    $("teacherConfirmText").textContent = action === "delete" ? `O cadastro de ${teacher.name} e suas atribuições serão excluídos. O código ficará reservado para impedir sua reutilização. As turmas, os alunos e as chamadas não serão excluídos.` :
      teacher.status === "active" ? `O cadastro de ${teacher.name} ficará inativo, mantendo o código e o histórico dos semestres.` : `O cadastro de ${teacher.name} voltará a ficar ativo com o mesmo código e as atribuições preservadas.`;
    $("teacherConfirmError").hidden = true; $("confirmTeacherAction").classList.toggle("danger", action === "delete");
    $("teacherConfirm").showModal(); $("cancelTeacherConfirm").focus();
  }
  $("teacherRows").addEventListener("click", event => {
    const button = event.target.closest("[data-teacher-action]"); if (!button || !state.allowed || state.busy) return;
    const id = button.dataset.teacherId, action = button.dataset.teacherAction;
    if (action === "view") view(id); else if (action === "edit") openForm(id); else if (action === "copy") copyCode(id); else confirm(action, id);
  });
  async function mutate(localAction, remoteAction) {
    if (!state.allowed) throw new Error("Você não tem permissão para alterar professores.");
    if (service.enabled) {
      if (!service.canManage(await service.session())) throw new Error("Sua permissão para gerenciar professores foi encerrada.");
      return remoteAction();
    }
    const local = window.AlunoTecAccess?.session();
    if (local?.mode !== "local" || local.role !== "LOCAL") throw new Error("Abra a entrada local de edição para alterar professores.");
    return model.mutate(localAction);
  }
  $("teacherForm").addEventListener("submit", async event => {
    event.preventDefault(); if (state.busy || !state.draft) return;
    const d = state.draft; if (d.year !== year()) return formError("O ano letivo mudou. Feche o cadastro e abra novamente.");
    const input = { id: d.id || undefined, expectedUpdatedAt: d.teacher?.updatedAt, name: $("teacherName").value,
      subject: $("teacherSubject").value, status: $("teacherStatus").value, year: d.year,
      terms: Object.fromEntries([...new Set([...d.touched, d.term])].map(term => [term, [...d.terms[term]]])) };
    formError(""); state.busy = true; $("saveTeacher").disabled = true;
    try {
      await mutate(data => model.save(data, input, JSON.parse(localStorage.getItem("alunotec_turmas_v2") || '{"base":[],"electives":[]}'), { code: d.previewCode }), () => service.save(input));
      $("teacherDialog").close(); state.draft = null; await load(); feedback(input.id ? "Cadastro atualizado. O código e as atribuições dos demais períodos foram preservados." : "Professor cadastrado. Consulte o código na listagem.");
    } catch (error) { formError(error.message); }
    finally { state.busy = false; $("saveTeacher").disabled = false; }
  });
  $("confirmTeacherAction").addEventListener("click", async () => {
    if (state.busy || !state.pending) return;
    const p = state.pending; state.busy = true; $("confirmTeacherAction").disabled = true;
    try {
      await mutate(data => p.action === "delete" ? model.remove(data, p.id) : model.setStatus(data, p.id, p.status),
        () => p.action === "delete" ? service.remove(p.id) : service.status(p.id, p.status));
      $("teacherConfirm").close(); state.pending = null; await load(); feedback(p.action === "delete" ? "Professor excluído. Turmas e chamadas preservadas." : "Status atualizado. O código e o histórico dos semestres foram preservados.");
    } catch (error) { $("teacherConfirmError").textContent = error.message; $("teacherConfirmError").hidden = false; }
    finally { state.busy = false; $("confirmTeacherAction").disabled = false; }
  });
  document.querySelectorAll("[data-close-teacher]").forEach(button => button.addEventListener("click", () => { if (!state.busy) $(button.dataset.closeTeacher).close(); }));
  for (const id of ["teacherDialog", "teacherView", "teacherConfirm"]) {
    $(id).addEventListener("cancel", event => { if (state.busy) event.preventDefault(); });
    $(id).addEventListener("click", event => {
      if (event.target !== $(id) || state.busy) return;
      const rect = $(id).getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $(id).close();
    });
  }
  $("newTeacher").addEventListener("click", () => openForm());
  for (const id of ["teacherSearch", "teacherStatusFilter", "teacherTermFilter"]) $(id).addEventListener(id === "teacherSearch" ? "input" : "change", () => { state.page = 1; render(); });
  for (const id of ["teacherStatusFilter", "teacherTermFilter", "teacherStatus", "teacherTerm"]) window.AlunoTecSelect.enhance($(id));
  $("teacherPrev").addEventListener("click", () => { state.page--; render(); }); $("teacherNext").addEventListener("click", () => { state.page++; render(); });
  document.addEventListener("alunotec:yearchange", () => { setClassPickerOpen(false); $("teacherDialog").close(); state.draft = null; state.page = 1; load(); });
  window.addEventListener("storage", event => { if (!event.key || [model.key, "alunotec_turmas_v2", "alunotecSchoolYear"].includes(event.key)) load(); });
  window.addEventListener("alunotec:datarestored", () => { setClassPickerOpen(false); $("teacherDialog").close(); state.draft = null; load(); });
  load();
})();
