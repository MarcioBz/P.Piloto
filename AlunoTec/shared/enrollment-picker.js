/* Seleção de alunos reutilizada por Matrícula e Turmas.
 * A seleção transmite IDs; não cria outra matrícula nem copia fichas de saúde. */
(() => {
  "use strict";
  let dialog;
  let config;
  let documentData;
  let poloId = "";
  let selected = null;
  const model = window.AlunoTecEnrollmentModel;
  const repository = window.AlunoTecEnrollment;
  const esc = window.AlunoTecUtils.escapeHTML;

  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement("dialog");
    dialog.className = "en-pick-dialog";
    dialog.id = "en-pick-dialog";
    dialog.setAttribute("aria-labelledby", "en-pick-title");
    dialog.innerHTML = `
      <header class="en-pick-heading">
        <h2 id="en-pick-title">Adicionar aluno</h2>
        <button type="button" data-pick-close aria-label="Fechar seleção">×</button>
      </header>
      <div class="en-pick-body">
        <button type="button" class="en-pick-back" hidden>← Escolher outro polo</button>
        <p class="en-pick-context"></p>
        <label class="en-pick-search" hidden>
          <span>Pesquisar aluno</span>
          <input type="search" placeholder="Pesquisar aluno pelo nome..." autocomplete="off">
        </label>
        <div class="en-pick-options"></div>
        <p class="en-pick-preview" hidden></p>
        <p class="en-pick-error" role="alert" hidden></p>
      </div>
      <footer class="en-pick-footer">
        <button type="button" class="en-pick-cancel" data-pick-close>Cancelar</button>
        <button type="button" class="en-pick-confirm" disabled>Confirmar inclusão</button>
      </footer>`;
    document.body.append(dialog);
    dialog.querySelectorAll("[data-pick-close]").forEach(button => {
      button.addEventListener("click", () => dialog.close());
    });
    dialog.querySelector(".en-pick-search input").addEventListener("input", render);
    dialog.querySelector(".en-pick-back").addEventListener("click", () => {
      poloId = "";
      selected = null;
      dialog.querySelector(".en-pick-search input").value = "";
      render();
    });
    dialog.querySelector(".en-pick-options").addEventListener("click", event => {
      const polo = event.target.closest("[data-pick-polo]");
      if (polo) {
        poloId = polo.dataset.pickPolo;
        render();
        dialog.querySelector(".en-pick-search input").focus();
        return;
      }
      const button = event.target.closest("[data-pick-student]");
      if (!button) return;
      selected = candidates().find(item => item.key === button.dataset.pickStudent) || null;
      render();
      [...dialog.querySelectorAll("[data-pick-student]")].find(item => item.dataset.pickStudent === selected?.key)?.focus();
    });
    dialog.querySelector(".en-pick-confirm").addEventListener("click", async () => {
      if (!selected) return;
      const button = dialog.querySelector(".en-pick-confirm");
      button.disabled = true;
      try {
        await config.onSelect(selected);
        dialog.close();
      } catch (error) {
        const message = dialog.querySelector(".en-pick-error");
        message.textContent = error.message;
        message.hidden = false;
      } finally {
        button.disabled = !selected;
      }
    });
    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener("keydown", event => {
      if (event.key === "Escape") event.stopPropagation();
    });
  }

  function candidates() {
    if (config.mode === "identity") {
      return [
        ...documentData.students.map(student => ({
          key: `student:${student.id}`,
          studentId: student.id,
          name: student.personal.name,
          phone: student.personal.guardianPhone || "",
          context: student.personal.birthDate ? `Nascimento: ${student.personal.birthDate.split("-").reverse().join("/")}` : "Cadastro existente",
        })),
        ...model.legacyStudents(repository.readClasses(), documentData).map(student => ({
          key: `legacy:${student.id}`,
          legacyId: student.id,
          name: student.name,
          phone: student.guardianPhone,
          context: student.classes.map(item => `${item.name} · ${item.year}`).join("; "),
        })),
      ];
    }
    return model.enrolledStudents(documentData, poloId, config.year).map(student => ({
      ...student,
      key: student.enrollmentId,
      context: `${student.grade}º ano · ${student.year}`,
    }));
  }

  function render() {
    const options = dialog.querySelector(".en-pick-options");
    const identity = config.mode === "identity";
    const choosingPolo = !identity && !poloId;
    dialog.querySelector(".en-pick-search").hidden = choosingPolo;
    dialog.querySelector(".en-pick-back").hidden = identity || choosingPolo;
    dialog.querySelector(".en-pick-confirm").disabled = !selected;
    dialog.querySelector(".en-pick-error").hidden = true;
    const context = dialog.querySelector(".en-pick-context");
    if (choosingPolo) {
      context.textContent = `Escolha o polo para consultar os alunos de ${config.year}.`;
      const polos = documentData.polos.filter(polo => !polo.archived);
      options.innerHTML = polos.map(polo => {
        const count = documentData.enrollments.filter(item => item.poloId === polo.id && item.year === config.year).length;
        return `<button type="button" class="en-pick-polo" data-pick-polo="${esc(polo.id)}"><strong>${esc(polo.name)}</strong><small>${count} matrícula(s)</small><span aria-hidden="true">›</span></button>`;
      }).join("") || '<p class="en-pick-empty">Nenhum polo cadastrado. Cadastre o polo e a matrícula na aba Matrícula.</p>';
    } else {
      context.textContent = identity ? "Reutilize o cadastro de um aluno já existente, inclusive das turmas atuais." :
        `${documentData.polos.find(item => item.id === poloId)?.name || "Polo"} · Ano letivo ${config.year}`;
      const query = model.normalize(dialog.querySelector(".en-pick-search input").value);
      const list = candidates().filter(item => !query || model.normalize(item.name).includes(query))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
      options.innerHTML = list.map(item => `<button type="button" class="en-pick-student${selected?.key === item.key ? " is-selected" : ""}" data-pick-student="${esc(item.key)}" aria-pressed="${selected?.key === item.key}"><span class="en-pick-check" aria-hidden="true">${selected?.key === item.key ? "✓" : ""}</span><span><strong>${esc(item.name)}</strong><small>${esc(item.context)}</small></span></button>`).join("") ||
        '<p class="en-pick-empty">Nenhum aluno encontrado.</p>';
    }
    const preview = dialog.querySelector(".en-pick-preview");
    preview.hidden = !selected;
    preview.textContent = selected ? `${selected.name} · Telefone do responsável: ${selected.phone || "não informado"}` : "";
  }

  function open(options) {
    const session = window.AlunoTecAccess?.session();
    if (session?.mode !== "local" || session.role !== "LOCAL") throw new Error("Abra o modo local de edição para selecionar alunos.");
    ensureDialog();
    config = options;
    documentData = repository.read();
    poloId = "";
    selected = null;
    dialog.querySelector("#en-pick-title").textContent = options.mode === "identity" ? "Escolher aluno existente" : "Adicionar aluno matriculado";
    dialog.querySelector(".en-pick-confirm").textContent = options.mode === "identity" ? "Usar cadastro" : "Confirmar inclusão";
    dialog.querySelector(".en-pick-search input").value = "";
    render();
    dialog.showModal();
  }

  window.AlunoTecEnrollmentPicker = Object.freeze({ open });
})();
