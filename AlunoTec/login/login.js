"use strict";

/*
===========================================================
ALUNOTEC
SISTEMA DE LOGIN
===========================================================

ACESSOS:

ADMINISTRADOR
- Login principal.

AGENTE EDUCACIONAL
- Conta institucional.
- Login através de INEP + senha.

CONVIDADO
- Conta convidado.
- Somente visualização.

IMPORTANTE:
As permissões e senhas devem ser validadas pelo backend.
*/


(() => {

  /* =====================================================
     LOGIN PRINCIPAL
  ====================================================== */

  const form =
    document.getElementById("loginForm");

  const email =
    document.getElementById("email");

  const password =
    document.getElementById("password");

  const remember =
    document.getElementById("remember");

  const togglePassword =
    document.getElementById("togglePassword");

  const eyeIcon =
    document.getElementById("eyeIcon");

  const connectionStatus =
    document.getElementById("connectionStatus");

  const connectionText =
    document.getElementById("connectionText");

  const message =
    document.getElementById("loginMessage");

  const loginButton =
    document.getElementById("loginButton");

  const loginButtonText =
    document.getElementById("loginButtonText");

  const institutionalButton =
    document.getElementById("institutionalLogin");

  const guestButton =
    document.getElementById("guestLogin");

  const forgotButton =
    document.getElementById("forgotPassword");


  /* =====================================================
     MODAL INSTITUCIONAL
  ====================================================== */

  const institutionalModal =
    document.getElementById("institutionalModal");

  const institutionalOverlay =
    document.getElementById("institutionalOverlay");

  const closeInstitutionalModalButton =
    document.getElementById("closeInstitutionalModal");

  const institutionalForm =
    document.getElementById("institutionalForm");

  const institutionalInep =
    document.getElementById("institutionalInep");

  const institutionalPassword =
    document.getElementById("institutionalPassword");

  const toggleInstitutionalPassword =
    document.getElementById("toggleInstitutionalPassword");

  const institutionalEyeIcon =
    document.getElementById("institutionalEyeIcon");

  const institutionalMessage =
    document.getElementById("institutionalMessage");

  const institutionalSubmit =
    document.getElementById("institutionalSubmit");

  const institutionalSubmitText =
    document.getElementById("institutionalSubmitText");


  let busy = false;


  /* =====================================================
     SUPER ADMIN
  ====================================================== */

  const ADMIN_EMAIL =
    "marcio.bezrrati@gmail.com";


  /* =====================================================
     AUTENTICAÇÃO
  ====================================================== */

  function getAuthMethod(name) {

    const auth =
      window.AlunoTecAuth;


    if (
      !auth ||
      typeof auth[name] !== "function"
    ) {

      throw new Error(
        "Este acesso ainda precisa ser conectado à autenticação do AlunoTec."
      );

    }


    return auth[name].bind(auth);

  }


  /* =====================================================
     CONEXÃO
  ====================================================== */

  function updateConnection() {

    const online =
      navigator.onLine;


    connectionStatus.classList.toggle(
      "online",
      online
    );


    connectionStatus.classList.toggle(
      "offline",
      !online
    );


    connectionText.textContent =
      online
        ? "Online"
        : "Offline — sem conexão com a internet";

  }


  /* =====================================================
     MENSAGENS
  ====================================================== */

  function showMessage(
    element,
    text
  ) {

    element.textContent =
      text;

    element.hidden =
      false;

  }


  function clearMessage(element) {

    element.textContent =
      "";

    element.hidden =
      true;

  }


  /* =====================================================
     ESTADO
  ====================================================== */

  function setBusy(value) {

    busy =
      value;


    loginButton.disabled =
      value;

    institutionalButton.disabled =
      value;

    guestButton.disabled =
      value;

    forgotButton.disabled =
      value;


    form.setAttribute(
      "aria-busy",
      String(value)
    );

  }


  /* =====================================================
     EXECUTAR AÇÃO
  ====================================================== */

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

        error instanceof Error &&
        error.message

          ? error.message

          : "Não foi possível concluir o acesso."
      );

    } finally {

      setBusy(false);

    }

  }


  /* =====================================================
     OLHO LOGIN PRINCIPAL
  ====================================================== */

  togglePassword.addEventListener(
    "click",
    () => {

      const show =
        password.type === "password";


      password.type =
        show
          ? "text"
          : "password";


      togglePassword.setAttribute(
        "aria-label",
        show
          ? "Ocultar senha"
          : "Mostrar senha"
      );


      togglePassword.setAttribute(
        "aria-pressed",
        String(show)
      );


      eyeIcon.setAttribute(
        "href",
        show
          ? "#icon-eye-off"
          : "#icon-eye"
      );

    }
  );


  /* =====================================================
     LOGIN ADMIN
  ====================================================== */

  form.addEventListener(
    "submit",
    (event) => {

      event.preventDefault();


      if (
        busy ||
        !form.reportValidity()
      ) {
        return;
      }


      const username =
        email.value
          .trim()
          .toLowerCase();


      if (username !== ADMIN_EMAIL) {

        showMessage(
          message,
          "Este login é exclusivo do administrador."
        );

        email.focus();

        return;

      }


      runAction(
        async () => {

          const login =
            getAuthMethod("login");


          loginButtonText.textContent =
            "ENTRANDO…";


          try {

            await login({

              email: username,

              password:
                password.value,

              remember:
                remember.checked,

              requestedRole:
                "SUPER_ADMIN"

            });

          } finally {

            loginButtonText.textContent =
              "ENTRAR";

          }

        }
      );

    }
  );


  /* =====================================================
     ABRIR MODAL INSTITUCIONAL
  ====================================================== */

  function openInstitutionalModal() {

    clearMessage(
      institutionalMessage
    );


    institutionalModal.classList.add(
      "active"
    );


    institutionalModal.setAttribute(
      "aria-hidden",
      "false"
    );


    document.body.classList.add(
      "modal-open"
    );


    setTimeout(
      () => {

        institutionalInep.focus();

      },
      100
    );

  }


  /* =====================================================
     FECHAR MODAL
  ====================================================== */

  function closeInstitutionalModal() {

    institutionalModal.classList.remove(
      "active"
    );


    institutionalModal.setAttribute(
      "aria-hidden",
      "true"
    );


    document.body.classList.remove(
      "modal-open"
    );


    institutionalForm.reset();


    institutionalPassword.type =
      "password";


    institutionalEyeIcon.setAttribute(
      "href",
      "#icon-eye"
    );


    clearMessage(
      institutionalMessage
    );

  }


  institutionalButton.addEventListener(
    "click",
    openInstitutionalModal
  );


  closeInstitutionalModalButton.addEventListener(
    "click",
    closeInstitutionalModal
  );


  institutionalOverlay.addEventListener(
    "click",
    closeInstitutionalModal
  );


  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Escape" &&
        institutionalModal.classList.contains(
          "active"
        )
      ) {

        closeInstitutionalModal();

      }

    }
  );


  /* =====================================================
     INEP SOMENTE NÚMEROS
  ====================================================== */

  institutionalInep.addEventListener(
    "input",
    () => {

      institutionalInep.value =
        institutionalInep.value.replace(
          /\D/g,
          ""
        );


      clearMessage(
        institutionalMessage
      );

    }
  );


  /* =====================================================
     OLHO SENHA INSTITUCIONAL
  ====================================================== */

  toggleInstitutionalPassword.addEventListener(
    "click",
    () => {

      const show =
        institutionalPassword.type ===
        "password";


      institutionalPassword.type =
        show
          ? "text"
          : "password";


      toggleInstitutionalPassword.setAttribute(
        "aria-label",
        show
          ? "Ocultar senha"
          : "Mostrar senha"
      );


      toggleInstitutionalPassword.setAttribute(
        "aria-pressed",
        String(show)
      );


      institutionalEyeIcon.setAttribute(
        "href",
        show
          ? "#icon-eye-off"
          : "#icon-eye"
      );

    }
  );


  /* =====================================================
     LOGIN INSTITUCIONAL
  ====================================================== */

  institutionalForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      if (
        !institutionalForm.reportValidity()
      ) {
        return;
      }


      const inep =
        institutionalInep.value.trim();


      const accessPassword =
        institutionalPassword.value;


      if (inep.length !== 8) {

        showMessage(
          institutionalMessage,
          "Informe um INEP válido com 8 números."
        );

        institutionalInep.focus();

        return;

      }


      clearMessage(
        institutionalMessage
      );


      institutionalSubmit.disabled =
        true;


      institutionalSubmitText.textContent =
        "ENTRANDO…";


      try {

        const institutionalLogin =
          getAuthMethod(
            "institutionalLogin"
          );


        await institutionalLogin({

          inep,

          password:
            accessPassword,

          requestedRole:
            "AGENTE_EDUCACIONAL"

        });


      } catch (error) {

        showMessage(
          institutionalMessage,

          error instanceof Error &&
          error.message

            ? error.message

            : "INEP ou senha inválidos."
        );


      } finally {

        institutionalSubmit.disabled =
          false;


        institutionalSubmitText.textContent =
          "ENTRAR";

      }

    }
  );


  /* =====================================================
     CONTA CONVIDADO
  ====================================================== */

  guestButton.addEventListener(
    "click",
    () => {

      runAction(
        async () => {

          const guestLogin =
            getAuthMethod(
              "guestLogin"
            );


          await guestLogin({

            requestedRole:
              "CONVIDADO",

            permissions: {

              view: true,

              create: false,

              edit: false,

              delete: false,

              disable: false

            }

          });

        }
      );

    }
  );


  /* =====================================================
     ESQUECI SENHA
  ====================================================== */

  forgotButton.addEventListener(
    "click",
    () => {

      runAction(
        async () => {

          const forgotPassword =
            getAuthMethod(
              "forgotPassword"
            );


          await forgotPassword({

            email:
              email.value
                .trim()
                .toLowerCase()

          });

        }
      );

    }
  );


  /* =====================================================
     LIMPAR ERROS
  ====================================================== */

  email.addEventListener(
    "input",
    () => clearMessage(message)
  );


  password.addEventListener(
    "input",
    () => clearMessage(message)
  );


  institutionalPassword.addEventListener(
    "input",
    () =>
      clearMessage(
        institutionalMessage
      )
  );


  /* =====================================================
     CONEXÃO
  ====================================================== */

  window.addEventListener(
    "online",
    updateConnection
  );


  window.addEventListener(
    "offline",
    updateConnection
  );


  updateConnection();

})();