/* ==========================================================
   ALUNOTEC | MAPA DE EDIÇÃO — LÓGICA DE ENTRADA
   As seções abaixo tratam acesso principal, institucional e convidado,
   estado da conexão, mensagens e modal. Os IDs devem corresponder a
   ../index.html. Regras de autenticação e permissões pertencem ao
   servidor; este arquivo cuida da interface e das chamadas existentes.
========================================================== */

"use strict";

/* ==========================================================
   ALUNOTEC | SISTEMA DE LOGIN
   Agrupa a autenticação da página, os estados de formulário e a entrada institucional ou convidada.
========================================================== */

(() => {
  document.querySelectorAll("[data-current-year]").forEach(element => {
    element.textContent = String(new Date().getFullYear());
  });
  /* ==========================================================
     LOGIN PRINCIPAL
     Lê os campos de acesso comum e apresenta estados de envio, sucesso ou erro.
  ========================================================== */

  const form = document.getElementById("loginForm");

  const email = document.getElementById("email");

  const password = document.getElementById("password");

  const remember = document.getElementById("remember");

  const togglePassword = document.getElementById("togglePassword");

  const eyeIcon = document.getElementById("eyeIcon");

  const connectionStatus = document.getElementById("connectionStatus");

  const connectionText = document.getElementById("connectionText");

  const message = document.getElementById("loginMessage");

  const loginButton = document.getElementById("loginButton");

  const loginButtonText = document.getElementById("loginButtonText");

  const institutionalButton = document.getElementById("institutionalLogin");

  const guestButton = document.getElementById("guestLogin");

  const forgotButton = document.getElementById("forgotPassword");

  /* ==========================================================
     MODAL INSTITUCIONAL
     Reúne os seletores e o estado compartilhado da janela de acesso institucional.
  ========================================================== */

  const institutionalModal = document.getElementById("institutionalModal");

  const institutionalOverlay = document.getElementById("institutionalOverlay");

  const closeInstitutionalModalButton = document.getElementById(
    "closeInstitutionalModal",
  );

  const institutionalForm = document.getElementById("institutionalForm");

  const institutionalInep = document.getElementById("institutionalInep");

  const institutionalPassword = document.getElementById(
    "institutionalPassword",
  );

  const toggleInstitutionalPassword = document.getElementById(
    "toggleInstitutionalPassword",
  );

  const institutionalEyeIcon = document.getElementById("institutionalEyeIcon");

  const institutionalMessage = document.getElementById("institutionalMessage");

  const institutionalSubmit = document.getElementById("institutionalSubmit");

  const institutionalSubmitText = document.getElementById(
    "institutionalSubmitText",
  );

  let busy = false;

  /* ==========================================================
     SUPER ADMIN
     Identifica o fluxo de acesso administrativo especial e seus dados de validação.
  ========================================================== */

  const ADMIN_EMAIL = "marcio.bezrrati@gmail.com";

  /* ==========================================================
     AUTENTICAÇÃO
     Centraliza a verificação das credenciais e a decisão de qual página abrir após o acesso.
  ========================================================== */

  function getAuthMethod(name) {
    const auth = window.AlunoTecAuth;

    if (!auth || typeof auth[name] !== "function") {
      throw new Error(
        "Este acesso ainda precisa ser conectado à autenticação do AlunoTec.",
      );
    }

    return auth[name].bind(auth);
  }

  /* ==========================================================
     CONEXÃO
     Atualiza o indicador de rede e mantém a resposta coerente com o estado online ou offline.
  ========================================================== */

  function updateConnection() {
    const online = navigator.onLine;

    connectionStatus.classList.toggle("online", online);

    connectionStatus.classList.toggle("offline", !online);

    connectionText.textContent = online
      ? "Online"
      : "Offline — sem conexão com a internet";
  }

  /* ==========================================================
     MENSAGENS
     Exibe avisos de validação e retorno sem depender de alertas nativos do navegador.
  ========================================================== */

  function showMessage(element, text) {
    element.textContent = text;

    element.hidden = false;
  }

  function clearMessage(element) {
    element.textContent = "";

    element.hidden = true;
  }

  /* ==========================================================
     ESTADO
     Controla bloqueio do botão, progresso e disponibilidade dos campos durante uma operação.
  ========================================================== */

  function setBusy(value) {
    busy = value;

    loginButton.disabled = value;

    institutionalButton.disabled = value;

    guestButton.disabled = value;

    forgotButton.disabled = value;

    form.setAttribute("aria-busy", String(value));
  }

  /* ==========================================================
     EXECUTAR AÇÃO
     Executa a ação de acesso escolhida e mantém o tratamento comum de erros e carregamento.
  ========================================================== */

  async function runAction(action) {
    if (busy) {
      return;
    }

    clearMessage(message);

    setBusy(true);

    try {
      await action();
    } catch (error) {
      showMessage(
        message,

        error instanceof Error && error.message
          ? error.message
          : "Não foi possível concluir o acesso.",
      );
    } finally {
      setBusy(false);
    }
  }

  /* ==========================================================
     OLHO LOGIN PRINCIPAL
     Alterna a visibilidade da senha no formulário de acesso principal.
  ========================================================== */

  togglePassword.addEventListener("click", () => {
    const show = password.type === "password";

    password.type = show ? "text" : "password";

    togglePassword.setAttribute(
      "aria-label",
      show ? "Ocultar senha" : "Mostrar senha",
    );

    togglePassword.setAttribute("aria-pressed", String(show));

    eyeIcon.setAttribute("href", show ? "#icon-eye-off" : "#icon-eye");
  });

  /* ==========================================================
     LOGIN ADMIN
     Valida o acesso administrativo e encaminha a conta autorizada para sua área.
  ========================================================== */

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (busy || !form.reportValidity()) {
      return;
    }

    const username = email.value.trim().toLowerCase();

    if (username !== ADMIN_EMAIL) {
      showMessage(message, "Este login é exclusivo do administrador.");

      email.focus();

      return;
    }

    runAction(async () => {
      const login = getAuthMethod("login");

      loginButtonText.textContent = "ENTRANDO…";

      try {
        await login({
          email: username,

          password: password.value,

          remember: remember.checked,

          requestedRole: "SUPER_ADMIN",
        });
      } finally {
        loginButtonText.textContent = "ENTRAR";
      }
    });
  });

  /* ==========================================================
     ABRIR MODAL INSTITUCIONAL
     Abre a janela institucional, atualiza o estado acessível e posiciona o primeiro campo.
  ========================================================== */

  function openInstitutionalModal() {
    clearMessage(institutionalMessage);

    institutionalModal.classList.add("active");

    institutionalModal.setAttribute("aria-hidden", "false");

    document.body.classList.add("modal-open");

    setTimeout(() => {
      institutionalInep.focus();
    }, 100);
  }

  /* ==========================================================
     FECHAR MODAL
     Fecha a janela institucional pelos controles disponíveis e restaura o foco da página.
  ========================================================== */

  function closeInstitutionalModal() {
    institutionalModal.classList.remove("active");

    institutionalModal.setAttribute("aria-hidden", "true");

    document.body.classList.remove("modal-open");

    institutionalForm.reset();

    institutionalPassword.type = "password";

    institutionalEyeIcon.setAttribute("href", "#icon-eye");

    clearMessage(institutionalMessage);
  }

  institutionalButton.addEventListener("click", openInstitutionalModal);

  closeInstitutionalModalButton.addEventListener(
    "click",
    closeInstitutionalModal,
  );

  institutionalOverlay.addEventListener("click", closeInstitutionalModal);

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      institutionalModal.classList.contains("active")
    ) {
      closeInstitutionalModal();
    }
  });

  /* ==========================================================
     INEP SOMENTE NÚMEROS
     Remove caracteres não numéricos do identificador INEP antes da validação.
  ========================================================== */

  institutionalInep.addEventListener("input", () => {
    institutionalInep.value = institutionalInep.value.replace(/\D/g, "");

    clearMessage(institutionalMessage);
  });

  /* ==========================================================
     OLHO SENHA INSTITUCIONAL
     Alterna a visibilidade da senha dentro do formulário institucional.
  ========================================================== */

  toggleInstitutionalPassword.addEventListener("click", () => {
    const show = institutionalPassword.type === "password";

    institutionalPassword.type = show ? "text" : "password";

    toggleInstitutionalPassword.setAttribute(
      "aria-label",
      show ? "Ocultar senha" : "Mostrar senha",
    );

    toggleInstitutionalPassword.setAttribute("aria-pressed", String(show));

    institutionalEyeIcon.setAttribute(
      "href",
      show ? "#icon-eye-off" : "#icon-eye",
    );
  });

  /* ==========================================================
     LOGIN INSTITUCIONAL
     Valida os campos da instituição e executa a autenticação correspondente.
  ========================================================== */

  institutionalForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!institutionalForm.reportValidity()) {
      return;
    }

    const inep = institutionalInep.value.trim();

    const accessPassword = institutionalPassword.value;

    if (inep.length !== 8) {
      showMessage(
        institutionalMessage,
        "Informe um INEP válido com 8 números.",
      );

      institutionalInep.focus();

      return;
    }

    clearMessage(institutionalMessage);

    institutionalSubmit.disabled = true;

    institutionalSubmitText.textContent = "ENTRANDO…";

    try {
      const institutionalLogin = getAuthMethod("institutionalLogin");

      await institutionalLogin({
        inep,

        password: accessPassword,

        requestedRole: "AGENTE_EDUCACIONAL",
      });
    } catch (error) {
      showMessage(
        institutionalMessage,

        error instanceof Error && error.message
          ? error.message
          : "INEP ou senha inválidos.",
      );
    } finally {
      institutionalSubmit.disabled = false;

      institutionalSubmitText.textContent = "ENTRAR";
    }
  });

  /* ==========================================================
     CONTA CONVIDADO
     Prepara o acesso de demonstração sem misturá-lo com a autenticação institucional.
  ========================================================== */

  guestButton.addEventListener("click", () => {
    runAction(async () => {
      const guestLogin = getAuthMethod("guestLogin");

      await guestLogin({
        requestedRole: "CONVIDADO",

        permissions: {
          view: true,

          create: false,

          edit: false,

          delete: false,

          disable: false,
        },
      });
    });
  });

  /* ==========================================================
     ESQUECI SENHA
     Apresenta a orientação para recuperação da senha quando o usuário solicita ajuda.
  ========================================================== */

  forgotButton.addEventListener("click", () => {
    runAction(async () => {
      const forgotPassword = getAuthMethod("forgotPassword");

      await forgotPassword({
        email: email.value.trim().toLowerCase(),
      });
    });
  });

  /* ==========================================================
     LIMPAR ERROS
     Remove mensagens e estados de validação anteriores quando os campos voltam a ser editados.
  ========================================================== */

  email.addEventListener("input", () => clearMessage(message));

  password.addEventListener("input", () => clearMessage(message));

  institutionalPassword.addEventListener("input", () =>
    clearMessage(institutionalMessage),
  );

  /* ==========================================================
     CONEXÃO
     Atualiza o indicador de rede e mantém a resposta coerente com o estado online ou offline.
  ========================================================== */

  window.addEventListener("online", updateConnection);

  window.addEventListener("offline", updateConnection);

  updateConnection();
})();
