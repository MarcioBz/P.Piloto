/* Entrada local explícita. Contas online dependem de um provedor real. */
(() => {
  "use strict";
  const scriptURL = document.currentScript?.src || location.href;
  const baseURL = new URL("../", scriptURL);
  const sessionKey = "alunotecSession";
  function session() {
    try { return JSON.parse(sessionStorage.getItem(sessionKey) || "null"); }
    catch { return null; }
  }
  const canEdit = () => session()?.role !== "CONVIDADO";
  function enter(role) {
    sessionStorage.setItem(sessionKey, JSON.stringify({
      mode: "local", role, name: role === "CONVIDADO" ? "Visitante local" : "Operador local",
      startedAt: new Date().toISOString(),
    }));
    location.href = new URL("admin/dashboard.html", baseURL).href;
  }
  const externalAuth = Boolean(window.AlunoTecAuth);
  if (!externalAuth) {
    window.AlunoTecAuth = Object.freeze({
      guestLogin: async () => enter("CONVIDADO"),
      login: async () => { throw new Error("O serviço de contas online ainda não está configurado. Use a entrada local."); },
      institutionalLogin: async () => { throw new Error("O acesso institucional depende da configuração do serviço de contas."); },
      forgotPassword: async () => { throw new Error("A recuperação de senha ficará disponível quando o serviço de contas estiver configurado."); },
    });
  }
  window.AlunoTecAccess = Object.freeze({ canEdit, session, enterLocal: () => enter("LOCAL") });

  const mutations = [
    "#newButton", "a[data-mutation]", "#addStudentButton", "#importStudentsButton", "#studentImportInput",
    "[data-action='edit']", "[data-action='delete']", "[data-action='transfer']",
    "[data-student-action]", "[data-student-status] button", ".status-button", "[data-row-action]",
    "#markAllButton", "#saveButton", "#saveJustificationButton", "#restoreBackup", "#undoRestore",
    "#institutionForm button", "#institutionForm input", "#institutionForm select",
  ].join(",");
  function applyReadonly() {
    if (canEdit()) return;
    document.querySelectorAll(mutations).forEach(control => {
      if ("disabled" in control) control.disabled = true;
      control.setAttribute("aria-disabled", "true");
      control.title = "Abra o modo local de edição para alterar os dados.";
    });
  }
  document.addEventListener("submit", event => {
    if (canEdit()) return;
    if (event.target.matches("#baseForm,#electiveForm,#studentForm,#transferForm,#institutionForm")) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener("click", event => {
    if (!canEdit() && event.target.closest(mutations)) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);

  function help() {
    let dialog = document.getElementById("at-help-dialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "at-help-dialog"; dialog.className = "at-app-dialog";
      dialog.innerHTML = document.body.dataset.appPage === "teacher" ? `<button class="at-dialog-close" type="button" aria-label="Fechar ajuda">×</button><h2>Área do professor</h2><p>Use o código informado pela secretaria. As turmas disponíveis dependem das atribuições do seu ano e semestre.</p><p>Para corrigir o cadastro, recuperar o código ou solicitar mudanças de turma, procure a secretaria da escola.</p>` : `<button class="at-dialog-close" type="button" aria-label="Fechar ajuda">×</button>
        <h2>Como usar o AlunoTec</h2>
        <p>Os dados do modo local ficam neste navegador. Faça cópias de segurança regularmente.</p>
        <ol><li>Cadastre as turmas e os alunos em <a href="${new URL("turmas/index.html", baseURL)}">Turmas</a>.</li>
        <li>Vincule os alunos às eletivas e confira a origem e os remanejamentos.</li>
        <li>Registre a chamada em <a href="${new URL("frequencia/frequencia.html", baseURL)}">Frequência</a>.</li>
        <li>Consulte e exporte os resultados em <a href="${new URL("relat/relat.html", baseURL)}">Relatórios</a>.</li>
        <li>Exporte ou restaure os dados pelo menu do perfil, em <a href="${new URL("config/backup.html", baseURL)}">Dados e cópia de segurança</a>.</li></ol>
        <p>O acesso por contas e a sincronização entre dispositivos precisam de um servidor configurado.</p>`;
      dialog.querySelector("button").addEventListener("click", () => dialog.close());
      dialog.addEventListener("click", event => {
        if (event.target !== dialog) return;
        const r = dialog.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
      });
      document.body.append(dialog);
    }
    dialog.showModal();
  }
  document.addEventListener("click", event => {
    if (event.target.closest(".support-card")) help();
  });
  document.addEventListener("DOMContentLoaded", () => {
    const localButton = document.getElementById("localLogin");
    localButton?.addEventListener("click", () => enter("LOCAL"));
    if (!document.body.dataset.appPage && !externalAuth) {
      ["email", "password", "remember", "togglePassword", "loginButton", "institutionalLogin", "forgotPassword"]
        .forEach(id => { const control = document.getElementById(id); if (control) control.disabled = true; });
      const text = document.getElementById("loginButtonText");
      if (text) text.textContent = "CONTAS ONLINE NÃO CONFIGURADAS";
      const notice = document.getElementById("localAccessNotice");
      if (notice) notice.hidden = false;
    }
    if (document.body.dataset.appPage) {
      if (document.body.dataset.appPage === "teacher") {
        const badge = document.createElement("p"); badge.className = "at-mode-badge";
        badge.textContent = "Área do professor · acesso pelo serviço da escola";
        document.querySelector(".sidebar-bottom")?.prepend(badge);
        return;
      }
      if (!externalAuth || session()?.mode === "local") {
        document.querySelectorAll(".profile-text small, .dropdown-profile small").forEach(label => {
          label.textContent = canEdit() ? "Perfil local" : "Visualização local";
        });
      }
      const badge = document.createElement("p"); badge.className = "at-mode-badge";
      badge.textContent = canEdit() ? "Modo local · dados neste navegador" : "Visualização local · somente leitura";
      document.querySelector(".sidebar-bottom")?.prepend(badge);
      if (!canEdit()) {
        const banner = document.createElement("div"); banner.className = "at-readonly-notice";
        banner.innerHTML = `Você está em visualização local. <a href="${new URL("index.html", baseURL)}">Voltar à entrada para editar</a>`;
        document.querySelector(".topbar")?.after(banner);
        applyReadonly();
        new MutationObserver(applyReadonly).observe(document.body, { childList: true, subtree: true });
      }
    }
  });
})();
