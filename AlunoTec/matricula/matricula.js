/* Matrícula integra polos e fichas ao cadastro existente.
 * O formulário usa o mapeamento dos modelos, sem dados das fotografias. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const repository = window.AlunoTecEnrollment;
  const model = window.AlunoTecEnrollmentModel;
  const schema = window.AlunoTecEnrollmentFields;
  const esc = window.AlunoTecUtils.escapeHTML;
  const clone = value => JSON.parse(JSON.stringify(value));
  const state = {
    document: null,
    poloId: "",
    form: null,
    editingPolo: null,
    removingPolo: null,
    dirty: false,
    busy: false,
    part: "registration",
  };
  const year = () => String(window.AlunoTecShell?.getYear?.() || new Date().getFullYear());
  const today = () => new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const valueAt = (data, path) => path.split(".").reduce((value, key) => value?.[key], data);
  const formInputs = path => [...$("enrollmentForm").querySelectorAll(`[name="${path}"]`)];

  function feedback(message) {
    $("enrollmentFeedback").textContent = message;
  }

  function error(id, message = "") {
    $(id).textContent = message;
    $(id).hidden = !message;
  }

  function label(field) {
    return field.label.replace("{year}", state.form?.year || year())
      .replace("{nextYear}", String(Number(state.form?.year || year()) + 1));
  }

  function control(field) {
    const id = `mf-${field.path.replaceAll(".", "-")}`;
    const required = field.required ? " required" : "";
    const wide = field.wide || field.type === "multiple" ? " is-wide" : "";
    const help = field.help ? `<small class="enrollment-help">${esc(field.help)}</small>` : "";
    if (["radio", "multiple"].includes(field.type)) {
      const type = field.type === "radio" ? "radio" : "checkbox";
      return `<fieldset class="enrollment-form-field enrollment-field${wide}"><legend data-field-label="${field.path}">${esc(label(field))}</legend><div class="enrollment-choices">${field.options.map(([value, name], index) => `<label class="enrollment-choice" for="${id}-${index}"><input id="${id}-${index}" type="${type}" name="${field.path}" value="${esc(value)}"${required}><span>${esc(name)}</span></label>`).join("")}</div>${help}</fieldset>`;
    }
    if (field.type === "textarea") {
      return `<label class="enrollment-form-field enrollment-field${wide}" for="${id}"><span>${esc(label(field))}</span><textarea id="${id}" name="${field.path}" rows="3" maxlength="20000"${required}></textarea>${help}</label>`;
    }
    const max = field.path === "personal.birthDate" ? ` max="${today()}"` : "";
    const attributes = field.mask ? ` data-mask="${field.mask}" inputmode="numeric"` :
      field.digits ? ` data-digits="${field.digits}" inputmode="numeric" maxlength="${field.digits}"` : "";
    return `<label class="enrollment-form-field enrollment-field${wide}" for="${id}"><span>${esc(label(field))}</span><input id="${id}" name="${field.path}" type="${field.type || "text"}"${attributes}${max}${required}>${help}</label>`;
  }

  function buildForm() {
    $("registrationPanel").innerHTML = schema.registrationSections.map(section => `<section class="enrollment-form-section"><h3>${esc(section.title)}</h3><div class="enrollment-form-grid">${section.fields.map(control).join("")}</div></section>`).join("");
    $("healthPanel").innerHTML = schema.healthQuestions.map(question => `<section class="enrollment-health-question"><h3>${question.number}. ${esc(question.question)}</h3><div class="enrollment-form-grid">${[question.answer, ...question.details].map(control).join("")}</div></section>`).join("") +
      `<section class="enrollment-form-section"><h3>Observações, datas e assinaturas</h3><div class="enrollment-form-grid">${schema.healthFooter.map(control).join("")}</div><div class="enrollment-signatures">${[1, 2].map(() => '<div><p>Assinatura do Pai/Mãe ou responsável pela matrícula</p><p>Assinatura do Funcionário</p></div>').join("")}</div></section>`;
    $("enrollmentForm").querySelectorAll('input[type="date"]').forEach(input => {
      window.AlunoTecCalendar.bind({ input });
    });
  }

  function fillForm(data) {
    for (const field of schema.fields) {
      const value = valueAt(data, field.path);
      for (const input of formInputs(field.path)) {
        if (field.type === "radio") input.checked = value === input.value;
        else if (field.type === "multiple") input.checked = Array.isArray(value) && value.includes(input.value);
        else input.value = value ?? "";
      }
    }
    document.querySelectorAll("[data-field-label]").forEach(element => {
      const field = schema.fields.find(item => item.path === element.dataset.fieldLabel);
      element.textContent = label(field);
    });
    window.AlunoTecCalendar.refresh();
  }

  function collectForm() {
    const data = clone(state.form.values);
    for (const field of schema.fields) {
      const [scope, key] = field.path.split(".");
      const inputs = formInputs(field.path);
      let value;
      if (field.type === "radio") value = inputs.find(input => input.checked)?.value || "";
      else if (field.type === "multiple") value = inputs.filter(input => input.checked).map(input => input.value);
      else value = (inputs[0]?.value || "").trim().normalize("NFC");
      data[scope][key] = value;
    }
    return data;
  }

  function showPart(part, focus = false) {
    state.part = part;
    for (const name of ["registration", "health"]) {
      $(name + "Panel").hidden = name !== part;
      $(name + "Tab").setAttribute("aria-selected", String(name === part));
      $(name + "Tab").tabIndex = name === part ? 0 : -1;
    }
    $("nextEnrollmentPart").textContent = part === "registration" ? "Continuar para saúde →" : "← Voltar à ficha de matrícula";
    if (focus) $(part + "Tab").focus();
  }

  function confirmAction(message, title = "Confirmar", buttonText = "Continuar") {
    const dialog = $("enrollmentConfirm");
    $("enrollmentConfirmTitle").textContent = title;
    $("enrollmentConfirmText").textContent = message;
    $("enrollmentConfirmOk").textContent = buttonText;
    dialog.returnValue = "cancel";
    $("enrollmentConfirmOk").onclick = () => dialog.close("yes");
    $("enrollmentConfirmCancel").onclick = () => dialog.close("cancel");
    return new Promise(resolve => {
      dialog.addEventListener("close", () => resolve(dialog.returnValue === "yes"), { once: true });
      dialog.showModal();
    });
  }

  function linkedClasses(studentId, selectedYear) {
    const classes = repository.readClasses();
    return [...classes.base, ...classes.electives].filter(item => String(item.year || item.date?.slice(0, 4)) === selectedYear &&
      (item.students || []).some(student => model.rosterId(student) === studentId));
  }

  function populateClassFilter() {
    const classes = repository.readClasses();
    const selection = $("enrollmentClassFilter").value;
    const options = [...classes.base, ...classes.electives]
      .filter(item => String(item.year || item.date?.slice(0, 4)) === year())
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", { numeric: true }));
    $("enrollmentClassFilter").innerHTML = '<option value="">Todas as turmas</option>' + options
      .map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`)
      .join("");
    if (options.some(item => String(item.id) === selection)) {
      $("enrollmentClassFilter").value = selection;
    }
    window.AlunoTecSelect.refresh($("enrollmentClassFilter"));
  }

  // Reutiliza a leitura de origem e remanejamentos sem alterar o cadastro de turmas.
  // Apenas vínculos por ID são usados; homônimos não recebem vínculos pelo nome.
  function enrollmentLinks(student) {
    const data = repository.readClasses();
    const linked = {};
    for (const type of ["base", "electives"]) {
      linked[type] = data[type].map(item => ({
        ...item,
        students: (item.students || []).filter(member => model.rosterId(member) === student.studentId),
      }));
    }
    let movements = [];
    try {
      movements = JSON.parse(localStorage.getItem("alunotec_alunos_remanejamentos_v1") || "[]");
    } catch {}
    const index = window.AlunoTecStudents.createIndex(linked, movements, student.year);
    const primary = index.records.find(item => item.type === "base") || index.records[0];
    if (!primary) {
      return {
        classId: "",
        className: "Aguardando turma",
        origin: "—",
        electives: [],
        reality: "—",
        status: "Sem turma",
        moved: false,
      };
    }
    const details = index.describe(primary, { year: student.year, classId: primary.classId });
    const current = index.classes.find(item => item.id === details.current.id);
    return {
      classId: details.current.id || primary.classId,
      className: details.current.name || primary.className,
      classType: (current?.type || primary.type) === "elective" ? "electives" : "base",
      origin: details.origin.name || "Não identificada",
      electives: details.electives.map(item => item.name),
      reality: details.baseRemapped ? "Realidade de sala" : "Realidade do sistema",
      status: primary.status === "Inativo" ? "Inativo" : "Ativo",
      moved: details.remapped,
    };
  }

  function renderCatalog() {
    state.document = repository.read();
    const data = state.document;
    const polos = data.polos.filter(polo => !polo.archived).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const enrollments = data.enrollments.filter(item => item.year === year());
    $("poloCount").textContent = polos.length;
    $("enrollmentCount").textContent = enrollments.length;
    $("linkedCount").textContent = enrollments.filter(item => linkedClasses(item.studentId, item.year).length).length;
    $("unlinkedCount").textContent = enrollments.length - Number($("linkedCount").textContent);
    $("catalogYear").textContent = `Ano letivo ${year()}`;
    $("poloCards").innerHTML = polos.map(polo => {
      const count = enrollments.filter(item => item.poloId === polo.id).length;
      return `<article class="enrollment-polo-card">
        <button type="button" class="enrollment-polo-open" data-open-polo="${esc(polo.id)}">
          <span class="enrollment-polo-icon" aria-hidden="true"><svg><use href="#at-icon-building"></use></svg></span>
          <span class="enrollment-polo-copy"><strong>${esc(polo.name)}</strong><small>${count} matrícula(s) · ${year()}</small></span>
          <svg class="enrollment-polo-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
        </button>
        <div class="enrollment-polo-actions"><button type="button" data-edit-polo="${esc(polo.id)}" aria-label="Editar polo ${esc(polo.name)}">Editar polo</button><button type="button" data-remove-polo="${esc(polo.id)}" aria-label="Excluir polo ${esc(polo.name)}">Excluir polo</button></div>
      </article>`;
    }).join("");
    $("poloEmpty").hidden = polos.length > 0;
    $("catalogYear").textContent = `Ano letivo ${year()}`;
    const selected = polos.find(item => item.id === state.poloId);
    if (!selected) state.poloId = "";
    $("poloOverview").hidden = Boolean(selected);
    $("poloDetails").hidden = !selected;
    populateClassFilter();
    if (selected) renderPolo(selected);
    renderSyncStatus();
  }

  function renderPolo(polo) {
    $("poloTitle").textContent = polo.name;
    $("poloDescription").textContent = `Matrículas do ano letivo ${year()}`;
    const query = model.normalize($("enrollmentSearch").value);
    const classId = $("enrollmentClassFilter").value;
    const status = $("enrollmentStatusFilter").value;
    const list = model.enrolledStudents(state.document, polo.id, year(), query)
      .map(student => ({ ...student, ...enrollmentLinks(student) }))
      .filter(student => (!classId || student.classId === classId) &&
        (!status || (status === "Remanejado" ? student.moved : student.status === status)));
    $("enrollmentRows").innerHTML = list.map((student, position) => {
      const electives = student.electives.length ? student.electives
        .map(name => `<span class="enrollment-tag">${esc(name)}</span>`).join("") :
        '<span class="enrollment-tag is-muted">Sem eletiva vinculada</span>';
      const href = `../turmas/index.html?turma=${encodeURIComponent(student.classId)}&tipo=${student.classType}`;
      return `<tr>
        <td>${position + 1}</td>
        <td><strong>${esc(student.name)}</strong>${student.socialName ? `<small class="enrollment-grade">${esc(student.socialName)}</small>` : ""}${student.grade ? `<small class="enrollment-grade">${esc(student.grade)}º ano</small>` : ""}</td>
        <td>${esc(student.phone || "Não informado")}</td>
        <td>${esc(student.className)}</td>
        <td>${esc(student.origin)}</td>
        <td><div class="enrollment-electives">${electives}</div></td>
        <td><span class="enrollment-tag${student.reality === "Realidade de sala" ? "" : " is-muted"}">${esc(student.reality)}</span></td>
        <td><span class="enrollment-status${student.status === "Inativo" ? " is-inactive" : ""}">${esc(student.status)}${student.moved ? " · Remanejado" : ""}</span></td>
        <td><div class="enrollment-actions"><button type="button" class="enrollment-secondary" data-edit-enrollment="${esc(student.enrollmentId)}">Editar</button><button type="button" class="enrollment-secondary" data-print-enrollment="${esc(student.enrollmentId)}">Imprimir</button>${student.classId ? `<a class="enrollment-open-class" href="${href}">Abrir turma</a>` : ""}</div></td>
      </tr>`;
    }).join("");
    $("enrollmentEmpty").hidden = list.length > 0;
    $("enrollmentRows").closest("table").hidden = !list.length;
  }

  function showPolo(id) {
    if ($("enrollmentDialog").open) $("enrollmentDialog").close();
    state.poloId = id;
    state.form = null;
    state.dirty = false;
    $("enrollmentEditor").hidden = true;
    $("enrollmentCatalog").hidden = false;
    renderCatalog();
  }

  async function requestCloseEditor() {
    if (state.busy) return;
    if (state.dirty && !await confirmAction("As alterações ainda não foram salvas. Voltar ao polo e descartar o preenchimento?", "Alterações não salvas", "Descartar e voltar")) return;
    showPolo(state.poloId);
  }

  function openEnrollment(enrollmentId = "") {
    const data = repository.read();
    const enrollment = enrollmentId ? data.enrollments.find(item => item.id === enrollmentId) : null;
    if (enrollmentId && !enrollment) throw new Error("A matrícula não está disponível.");
    const poloId = enrollment?.poloId || state.poloId;
    const polo = data.polos.find(item => item.id === poloId && !item.archived);
    if (!polo) throw new Error("Escolha um polo antes de cadastrar a matrícula.");
    const student = enrollment ? data.students.find(item => item.id === enrollment.studentId) : null;
    let institution = {};
    try {
      institution = JSON.parse(localStorage.getItem("alunotec_institution_v1") || "{}");
    } catch {}
    state.form = {
      id: enrollment?.id,
      studentId: student?.id,
      poloId,
      year: enrollment?.year || year(),
      expectedUpdatedAt: enrollment?.updatedAt,
      expectedPersonalUpdatedAt: student?.updatedAt,
      values: {
        personal: clone(student?.personal || {}),
        registration: clone(enrollment?.registration || { school: institution.schoolName || "", inep: institution.schoolInep || "" }),
        health: clone(enrollment?.health || { enrollmentDate1: today(), employeeYear1: year() }),
      },
    };
    state.poloId = poloId;
    $("enrollmentEditorTitle").textContent = enrollment ? "Editar matrícula" : "Nova matrícula";
    $("enrollmentEditorContext").textContent = `${polo.name} · Ano letivo ${state.form.year}`;
    $("selectedIdentity").textContent = student ? student.personal.name : "Novo aluno";
    $("chooseExistingStudent").disabled = Boolean(enrollment);
    $("printEnrollmentButton").disabled = !enrollment;
    fillForm(state.form.values);
    showPart("registration");
    error("enrollmentFormError");
    state.dirty = false;
    $("enrollmentEditor").hidden = false;
    // Mantém a página atrás do pop-up, como no cadastro original do AlunoTec.
    if (!$("enrollmentDialog").open) $("enrollmentDialog").showModal();
    $("enrollmentDialog").scrollTop = 0;
    formInputs("personal.name")[0]?.focus();
  }

  function chooseExisting() {
    window.AlunoTecEnrollmentPicker.open({
      mode: "identity",
      year: state.form.year,
      onSelect: item => {
        const data = repository.read();
        const student = data.students.find(entry => entry.id === item.studentId);
        const existing = student && data.enrollments.find(entry => entry.studentId === student.id && entry.year === state.form.year);
        if (existing) {
          openEnrollment(existing.id);
          feedback("A matrícula existente deste ano foi aberta para edição.");
          return;
        }
        state.form.values = collectForm();
        state.form.studentId = student?.id;
        state.form.legacyId = item.legacyId;
        state.form.expectedPersonalUpdatedAt = student?.updatedAt;
        state.form.values.personal = clone(student?.personal || { name: item.name, guardianPhone: item.phone });
        fillForm(state.form.values);
        $("selectedIdentity").textContent = `${item.name} · cadastro existente`;
        state.dirty = true;
      },
    });
  }

  async function saveForm(event) {
    event.preventDefault();
    if (state.busy || !state.form || !$("enrollmentForm").reportValidity()) return;
    const values = collectForm();
    const payload = { ...state.form, ...values };
    delete payload.values;
    error("enrollmentFormError");
    setBusy(true);
    try {
      let saved;
      try {
        saved = await repository.saveEnrollment(payload);
      } catch (problem) {
        if (problem.code !== "LEGACY_MATCH") throw problem;
        const different = await confirmAction("Existe um aluno com o mesmo nome nas turmas. Para reutilizá-lo, cancele e use Escolher aluno existente. Continue somente se for outra pessoa.", "Aluno com nome semelhante", "Cadastrar outra pessoa");
        if (!different) return;
        saved = await repository.saveEnrollment({ ...payload, differentPerson: true });
      }
      state.dirty = false;
      showPolo(saved.poloId);
      feedback("Matrícula e ficha de saúde salvas. O aluno já está disponível para inclusão em Turmas.");
      window.AlunoTecEnrollmentService?.schedule();
    } catch (problem) {
      error("enrollmentFormError", problem.message);
      $("enrollmentFormError").scrollIntoView({ block: "center" });
    } finally {
      setBusy(false);
    }
  }

  function setBusy(value) {
    state.busy = value;
    $("saveEnrollmentButton").disabled = value;
    $("enrollmentForm").querySelectorAll('button[type="submit"]').forEach(button => {
      button.disabled = value;
    });
  }

  function printEnrollment(id) {
    if (state.form?.id === id && state.dirty) {
      error("enrollmentFormError", "Salve as alterações antes de imprimir as fichas atualizadas.");
      return;
    }
    const data = repository.read();
    const enrollment = data.enrollments.find(item => item.id === id);
    if (!enrollment) throw new Error("Abra uma matrícula salva para imprimir.");
    const student = data.students.find(item => item.id === enrollment.studentId);
    window.AlunoTecEnrollmentPrint.print(enrollment, student);
  }

  function openPoloDialog(id = "") {
    state.editingPolo = id ? repository.read().polos.find(item => item.id === id) : null;
    $("poloDialogTitle").textContent = id ? "Editar polo" : "Cadastrar novo polo";
    $("poloName").value = state.editingPolo?.name || "";
    error("poloError");
    $("poloDialog").showModal();
    $("poloName").focus();
  }

  function openRemovePolo(id) {
    const data = repository.read();
    const polo = data.polos.find(item => item.id === id);
    if (!polo) return;
    state.removingPolo = id;
    const count = data.enrollments.filter(item => item.poloId === id).length;
    const destinations = data.polos.filter(item => !item.archived && item.id !== id);
    $("removePoloText").textContent = count ? `O polo ${polo.name} tem ${count} matrícula(s), incluindo outros anos. Os registros serão transferidos e o polo será arquivado, mantendo o histórico.` : `Excluir o polo ${polo.name}? Ele não tem matrículas vinculadas.`;
    $("poloDestinationField").hidden = !count;
    $("poloDestination").innerHTML = '<option value="">Selecione o polo de destino</option>' + destinations.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("");
    $("poloDestination").required = Boolean(count);
    $("confirmRemovePolo").disabled = Boolean(count && !destinations.length);
    $("confirmRemovePolo").textContent = count ? "Transferir e arquivar" : "Excluir polo";
    error("removePoloError", count && !destinations.length ? "Cadastre outro polo para receber as matrículas antes de continuar." : "");
    window.AlunoTecSelect.refresh($("poloDestination"));
    $("removePoloDialog").showModal();
  }

  function renderSyncStatus() {
    $("enrollmentSyncStatus").textContent = window.AlunoTecEnrollmentService?.status() || "Matrículas salvas neste navegador. A integração compartilhada ainda não foi configurada.";
  }

  $("poloForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (!$("poloForm").reportValidity()) return;
    const button = $("poloForm").querySelector('[type="submit"]');
    button.disabled = true;
    try {
      await repository.savePolo({ id: state.editingPolo?.id, expectedUpdatedAt: state.editingPolo?.updatedAt, name: $("poloName").value });
      $("poloDialog").close();
      renderCatalog();
      feedback("Polo salvo.");
    } catch (problem) {
      error("poloError", problem.message);
    } finally {
      button.disabled = false;
    }
  });
  $("removePoloForm").addEventListener("submit", async event => {
    event.preventDefault();
    if ($("poloDestination").required && !$("poloDestination").value) {
      error("removePoloError", "Selecione o polo que receberá os registros.");
      document.getElementById("poloDestination-button")?.focus();
      return;
    }
    if (!$("removePoloForm").reportValidity()) return;
    $("confirmRemovePolo").disabled = true;
    try {
      const result = await repository.removePolo(state.removingPolo, $("poloDestination").value);
      $("removePoloDialog").close();
      renderCatalog();
      feedback(result.deleted ? "Polo excluído." : "Matrículas transferidas e polo arquivado com o histórico preservado.");
    } catch (problem) {
      error("removePoloError", problem.message);
    } finally {
      $("confirmRemovePolo").disabled = false;
    }
  });
  $("poloCards").addEventListener("click", event => {
    const open = event.target.closest("[data-open-polo]");
    const edit = event.target.closest("[data-edit-polo]");
    const remove = event.target.closest("[data-remove-polo]");
    if (open) showPolo(open.dataset.openPolo);
    if (edit) openPoloDialog(edit.dataset.editPolo);
    if (remove) openRemovePolo(remove.dataset.removePolo);
  });
  ["enrollmentSearch", "enrollmentClassFilter", "enrollmentStatusFilter"].forEach(id => {
    $(id).addEventListener(id === "enrollmentSearch" ? "input" : "change", () => {
      const polo = state.document.polos.find(item => item.id === state.poloId);
      if (polo) renderPolo(polo);
    });
  });
  $("poloDetails").addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-enrollment]");
    const print = event.target.closest("[data-print-enrollment]");
    if (edit) openEnrollment(edit.dataset.editEnrollment);
    if (print) printEnrollment(print.dataset.printEnrollment);
  });
  $("newPoloButton").addEventListener("click", () => openPoloDialog());
  $("newEnrollmentButton").addEventListener("click", () => openEnrollment());
  $("backToPolos").addEventListener("click", () => showPolo(""));
  $("backToPolo").addEventListener("click", requestCloseEditor);
  $("closeEnrollmentDialog").addEventListener("click", requestCloseEditor);
  $("enrollmentDialog").addEventListener("cancel", event => {
    event.preventDefault();
    requestCloseEditor();
  });
  $("chooseExistingStudent").addEventListener("click", chooseExisting);
  $("printEnrollmentButton").addEventListener("click", () => printEnrollment(state.form?.id));
  $("enrollmentForm").addEventListener("submit", saveForm);
  $("enrollmentForm").addEventListener("invalid", event => {
    showPart(event.target.closest("#healthPanel") ? "health" : "registration");
  }, true);
  $("enrollmentForm").addEventListener("input", event => {
    state.dirty = true;
    const input = event.target;
    let value = input.value;
    if (input.dataset.digits) value = value.replace(/\D/g, "").slice(0, Number(input.dataset.digits));
    if (input.dataset.mask) {
      const raw = value.replace(/\D/g, "");
      if (input.dataset.mask === "cpf") value = raw.slice(0, 11).replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
      if (input.dataset.mask === "cep") value = raw.slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
      if (input.dataset.mask === "phone") {
        const phone = raw.slice(0, 11);
        value = phone.length <= 2 ? phone : `(${phone.slice(0, 2)}) ${phone.slice(2)}`;
        if (phone.length > 6) value = `(${phone.slice(0, 2)}) ${phone.slice(2, phone.length > 10 ? 7 : 6)}-${phone.slice(phone.length > 10 ? 7 : 6)}`;
      }
    }
    if (value !== input.value) input.value = value;
  });
  $("enrollmentForm").addEventListener("change", () => { state.dirty = true; });
  document.querySelectorAll("[data-enrollment-tab]").forEach(button => {
    button.addEventListener("click", () => showPart(button.dataset.enrollmentTab));
    button.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      showPart(["ArrowRight", "End"].includes(event.key) ? "health" : "registration", true);
    });
  });
  $("nextEnrollmentPart").addEventListener("click", () => showPart(state.part === "registration" ? "health" : "registration", true));
  document.querySelectorAll("[data-close-enrollment]").forEach(button => {
    button.addEventListener("click", () => $(button.dataset.closeEnrollment).close());
  });
  window.addEventListener("afterprint", () => {
    document.body.classList.remove("enrollment-printing");
    $("enrollmentPrint").setAttribute("aria-hidden", "true");
  });
  window.addEventListener("beforeunload", event => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
  document.addEventListener("alunotec:yearchange", () => {
    if (state.form && state.form.year !== year() && state.dirty) {
      window.AlunoTecShell.setYears(window.AlunoTecShell.getYears(), state.form.year, true);
      feedback("Salve a matrícula ou volte ao polo antes de mudar o ano letivo.");
      return;
    }
    if (!state.form || state.form.year !== year()) showPolo(state.poloId);
  });
  window.addEventListener("storage", event => {
    if (![model.KEY, model.CLASSES_KEY].includes(event.key)) return;
    if (state.dirty) feedback("Os dados foram atualizados em outra aba. Seu preenchimento foi mantido; conflitos serão verificados ao salvar.");
    else if (state.form?.id) openEnrollment(state.form.id);
    renderCatalog();
  });
  window.addEventListener("alunotec:enrollmentchange", renderSyncStatus);
  window.addEventListener("alunotec:enrollmentsync", renderSyncStatus);

  // A entrada local explícita é necessária; não se simula uma conta autenticada.
  const session = window.AlunoTecAccess?.session();
  if (session?.mode !== "local" || session.role !== "LOCAL") {
    $("enrollmentGuardText").textContent = "Abra a entrada local de edição para gerenciar matrículas e fichas de saúde neste dispositivo.";
    return;
  }
  try {
    repository.recover();
    buildForm();
    ["poloDestination", "enrollmentClassFilter", "enrollmentStatusFilter"].forEach(id => {
      window.AlunoTecSelect.enhance($(id));
    });
    renderCatalog();
    $("enrollmentGuard").hidden = true;
    $("enrollmentContent").hidden = false;
    window.AlunoTecEnrollmentService?.schedule();
  } catch (problem) {
    $("enrollmentGuardText").textContent = problem.message;
  }
})();
