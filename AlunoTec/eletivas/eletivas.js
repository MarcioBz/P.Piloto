(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = window.AlunoTecUtils.escapeHTML;
  const norm = text => String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  let openedId = "";
  function data() {
    try { return JSON.parse(localStorage.getItem("alunotec_turmas_v2") || "{}"); }
    catch { return {}; }
  }
  function selectedYear() {
    return String(window.AlunoTecShell?.getYear() || localStorage.getItem("alunotecSchoolYear") || new Date().getFullYear());
  }
  function classYear(item) { return String(item.year || item.date?.slice(0, 4) || new Date().getFullYear()); }
  function render() {
    const year = selectedYear(), raw = data();
    const years = window.AlunoTecShell?.getYears() || [year];
    $("electiveYear").innerHTML = years.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
    $("electiveYear").value = year;
    const courses = (Array.isArray(raw.electives) ? raw.electives : [])
      .filter(item => item && classYear(item) === year)
      .sort((a, b) => window.AlunoTecStudents.compare(a.name, b.name));
    const term = norm($("electiveSearch").value.trim());
    const filtered = courses.filter(item => !term || norm([item.name, item.teacher, item.shift].join(" ")).includes(term) ||
      (item.students || []).some(student => norm(student.name).includes(term)));
    $("electiveTotal").textContent = courses.length;
    $("electiveActive").textContent = courses.filter(item => !norm(item.status).startsWith("inativ")).length;
    $("electiveEnrollments").textContent = courses.reduce((sum, item) => sum + (item.students || []).length, 0);
    $("electiveCards").innerHTML = filtered.length ? filtered.map(item => {
      const total = (item.students || []).length;
      return `<button type="button" class="elective-card" data-elective-id="${esc(item.id)}"
        aria-label="Abrir eletiva ${esc(item.name)}" aria-controls="electiveStudentsPanel" aria-expanded="${String(item.id) === openedId}">
        <span class="elective-symbol"><svg aria-hidden="true"><use href="#at-icon-capelo"></use></svg></span>
        <span class="elective-copy"><strong>${esc(item.name)}</strong>
          <small>${esc([item.shift, item.teacher ? `Professor: ${item.teacher}` : ""].filter(Boolean).join(" · ")) || "Professor não informado"}</small>
          <span>${total} aluno${total === 1 ? "" : "s"} · ${esc(item.status || "Ativa")}</span></span></button>`;
    }).join("") : `<div class="elective-empty">${courses.length ? "Nenhuma eletiva corresponde à pesquisa." : "Nenhuma eletiva cadastrada neste ano."}</div>`;
    const opened = courses.find(item => String(item.id) === openedId);
    $("electiveStudentsPanel").hidden = !opened;
    if (!opened) { openedId = ""; return; }
    $("electiveStudentsTitle").textContent = opened.name;
    $("manageElective").href = `../turmas/index.html?tipo=electives&turma=${encodeURIComponent(opened.id)}`;
    const roster = window.AlunoTecStudents.sorted((opened.students || []).filter(student =>
      !term || norm(opened.name).includes(term) || norm(student.name).includes(term)));
    $("electiveStudentsCount").textContent = `${roster.length} aluno(s)`;
    $("electiveStudentRows").innerHTML = roster.length ? roster.map((student, index) => {
      const options = { classId: opened.id, year };
      const links = window.AlunoTecStudents.info(student, options);
      const hasBaseEnrollment = links.linked.some(record => record.type === "base");
      const currentClass = hasBaseEnrollment ? links.current.name : "";
      return `<tr>
        <td>${index + 1}</td>
        <td><span class="elective-student-identity">
          ${window.AlunoTecStudents.label(student, options)}
          <span class="elective-current-class${currentClass ? "" : " is-empty"}"
            title="Turma atual da Base Comum">${currentClass ?
              `Turma atual: ${esc(currentClass)}` : "Turma não identificada"}</span>
        </span></td>
        <td>${esc(student.status || "Ativo")}</td>
      </tr>`;
    }).join("") :
      '<tr><td colspan="3" class="elective-empty">Nenhum aluno para exibir. Gerencie os vínculos pela área de Turmas.</td></tr>';
  }
  $("electiveSearch").addEventListener("input", render);
  $("electiveYear").addEventListener("change", () => {
    openedId = ""; window.AlunoTecShell.setYears([], $("electiveYear").value, true);
  });
  $("electiveCards").addEventListener("click", event => {
    const button = event.target.closest("[data-elective-id]");
    if (!button) return;
    openedId = button.dataset.electiveId; render();
    $("electiveStudentsTitle").focus({ preventScroll: true });
  });
  $("closeElectiveStudents").addEventListener("click", () => { openedId = ""; render(); });
  document.addEventListener("alunotec:yearchange", () => { openedId = ""; render(); });
  window.addEventListener("storage", event => {
    if (!event.key || ["alunotec_turmas_v2", "alunotec_alunos_remanejamentos_v1"].includes(event.key)) render();
  });
  window.addEventListener("focus", render);
  render();
})();
