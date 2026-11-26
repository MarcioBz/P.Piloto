/* Esta área recebe somente dados autorizados pela API; não lê cadastros locais. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id), service = window.AlunoTecTeacherService;
  let user = null, version = 0;
  const year = () => String(window.AlunoTecShell.getYear());
  document.querySelectorAll(".profile strong").forEach(item => { item.textContent = "Professor"; });
  document.querySelectorAll(".profile small").forEach(item => { item.textContent = "Área do professor"; });
  document.querySelectorAll(".profile .avatar").forEach(item => { item.textContent = "P"; });
  function deny(message) {
    $("teacherPortal").hidden = true; $("portalRoster").hidden = true; $("portalClasses").replaceChildren(); $("portalStudentList").replaceChildren();
    $("teacherPortalGuard").hidden = false; $("portalGuardTitle").textContent = "Acesso do professor"; $("portalGuardText").textContent = message;
  }
  async function verify() {
    if (!service.enabled) throw new Error("O acesso individual ainda não foi ativado. A escola precisa conectar a autenticação e o banco compartilhado. Os códigos locais não liberam acesso.");
    user = await service.session();
    if (user.authenticated !== true || user.role !== "PROFESSOR" || !user.profile?.id) throw new Error("Entre com o código fornecido pela secretaria para acessar suas eletivas.");
    return user;
  }
  async function render() {
    const request = ++version;
    $("portalRoster").hidden = true; $("portalStudentList").replaceChildren(); $("portalClasses").replaceChildren();
    try {
      await verify();
      const y = year(), term = $("portalSemester").value;
      const result = await service.classes(y, term);
      if (request !== version) return;
      if (!Array.isArray(result.classes)) throw new Error("O serviço retornou uma lista de turmas inválida.");
      $("teacherPortalGuard").hidden = true; $("teacherPortal").hidden = false;
      $("portalName").textContent = user.profile.name || "Professor"; $("portalSubject").textContent = user.profile.subject || "";
      document.querySelectorAll(".profile strong").forEach(item => { item.textContent = user.profile.name || "Professor"; });
      document.querySelectorAll(".profile .avatar").forEach(item => { item.textContent = String(user.profile.name || "Professor").split(/\s+/).slice(0,2).map(part => part[0]).join(""); });
      $("portalYear").textContent = `Ano letivo ${y} · ${term}º semestre`;
      $("portalFeedback").textContent = result.classes.length ? "Selecione uma turma para consultar os alunos autorizados." : "Nenhuma turma atribuída para este semestre. Consulte a secretaria.";
      for (const item of result.classes) {
        const button = document.createElement("button"); button.type = "button"; button.className = "portal-class";
        const name = document.createElement("strong"), summary = document.createElement("span"); name.textContent = item.name; summary.textContent = `${item.studentCount || 0} aluno(s)`;
        button.append(name, summary); button.addEventListener("click", () => open(item.id, y, term)); $("portalClasses").append(button);
      }
    } catch (error) { if (request === version) deny(error.message); }
  }
  async function open(id, y, term) {
    const request = ++version;
    try {
      await verify();
      const result = await service.roster(id, y, term);
      if (request !== version) return;
      if (!result.class || !Array.isArray(result.students)) throw new Error("Não foi possível consultar os alunos desta eletiva.");
      $("portalStudentList").replaceChildren();
      $("portalClassTitle").textContent = result.class.name; $("portalClassInfo").textContent = `${y} · ${term}º semestre · ${result.students.length} aluno(s)`;
      for (const student of result.students) { const row = document.createElement("li"); row.textContent = student.name; $("portalStudentList").append(row); }
      $("portalRoster").hidden = false;
    } catch (error) { if (request === version) deny(error.message); }
  }
  $("portalSemester").value = new Date().getMonth() < 6 ? "1" : "2";
  $("portalSemester").addEventListener("change", render);
  $("closePortalRoster").addEventListener("click", () => { version++; $("portalRoster").hidden = true; $("portalStudentList").replaceChildren(); });
  document.addEventListener("alunotec:yearchange", render);
  window.addEventListener("focus", render);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
  render();
})();
