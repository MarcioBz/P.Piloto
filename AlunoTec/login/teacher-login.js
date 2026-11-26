(() => {
  "use strict";
  const service = window.AlunoTecTeacherService, form = document.getElementById("teacherLoginForm");
  if (!form) return;
  const code = document.getElementById("teacherLoginCode"), button = document.getElementById("teacherLoginSubmit"), error = document.getElementById("teacherLoginError");
  document.getElementById("teacherLoginNotice").textContent = service.enabled ? "Use o código fornecido pela secretaria. As turmas são verificadas pelo serviço da escola." :
    "Acesso ainda não ativado. O cadastro local não autentica professores; a escola precisa conectar seu serviço de autenticação e banco compartilhado.";
  code.disabled = button.disabled = !service.enabled;
  let busy = false;
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (busy || !service.enabled) return;
    if (!/^\d{5}$/.test(code.value)) { error.textContent = "Digite os 5 dígitos do código individual."; error.hidden = false; return; }
    busy = true; button.disabled = true; error.hidden = true;
    try {
      await window.AlunoTecAuth.teacherLogin(code.value);
      code.value = "";
      location.href = new URL("professores/area.html", location.href).href;
    } catch (problem) { code.value = ""; error.textContent = problem.message || "Não foi possível entrar. Confira seu código com a secretaria."; error.hidden = false; }
    finally { busy = false; button.disabled = false; }
  });
})();
