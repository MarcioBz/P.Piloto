/* Impressão das duas fichas em A4, na ordem dos modelos originais.
 * As assinaturas permanecem em branco para assinatura no papel. */
(() => {
  "use strict";
  const root = typeof window === "undefined" ? globalThis : window;
  const schema = root.AlunoTecEnrollmentFields || (typeof require === "function" ? require("./fields.js") : null);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
  const get = (record, path) => path.split(".").reduce((value, key) => value?.[key], record);
  const dateBR = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value.split("-").reverse().join("/") : "____/____/________";

  function choices(field, value) {
    return field.options.map(([key, label]) => {
      const selected = field.type === "multiple" ? Array.isArray(value) && value.includes(key) : value === key;
      return `<span class="fp-option">(${selected ? "X" : " "}) ${esc(label)}</span>`;
    }).join(" ");
  }

  function output(field, record, withLabel = true) {
    const value = get(record, field.path);
    const content = ["radio", "multiple"].includes(field.type) ? choices(field, value) :
      esc(field.type === "date" ? dateBR(value) : value || "______________");
    const name = field.label.replace("{year}", record.year).replace("{nextYear}", String(Number(record.year) + 1));
    return `<div class="fp-field${field.wide || field.type === "multiple" ? " fp-wide" : ""}">${withLabel ? `<span class="fp-label">${esc(name)}: </span>` : ""}<span class="fp-value">${content}</span>${field.help ? `<p class="fp-help">${esc(field.help)}</p>` : ""}</div>`;
  }

  // Tabelas mantêm o alinhamento também nos mecanismos de impressão A4.
  function fieldsTable(fields, record) {
    const full = new Set([
      "personal.socialName", "personal.ethnicity", "personal.birthCertificateNumber",
      "personal.address", "personal.livesWith", "registration.typicalConditions",
      "registration.disabilityTypes", "registration.otherConditions",
      "registration.studentSituation", "registration.responsibleAcknowledgment",
    ]);
    const rows = [];
    let pair = [];
    const flush = () => {
      if (!pair.length) return;
      rows.push(`<tr>${pair.map(field => `<td>${output(field, record)}</td>`).join("")}${pair.length === 1 ? "<td></td>" : ""}</tr>`);
      pair = [];
    };
    for (const field of fields) {
      if (full.has(field.path)) {
        flush();
        rows.push(`<tr><td colspan="2">${output(field, record)}</td></tr>`);
      } else {
        pair.push(field);
        if (pair.length === 2) flush();
      }
    }
    flush();
    return `<table class="fp-fields" width="100%"><colgroup><col width="50%"><col width="50%"></colgroup><tbody>${rows.join("")}</tbody></table>`;
  }

  function header(title) {
    return `<div class="fp-header"><table class="fp-institution-marks"><tbody><tr><td><strong>CROATÁ</strong></td><td>Secretaria de Educação</td><td>PAIC Integral</td><td>Escola em Tempo Integral</td></tr></tbody></table><p>Prefeitura Municipal de Croatá</p><strong>Secretaria de Educação</strong><h1>${esc(title)}</h1></div>`;
  }

  function footer() {
    return '<div class="fp-footer">SECRETARIA DE EDUCAÇÃO — AVENIDA SÃO FRANCISCO, 72 APTº 101/102 — CENTRO — CROATÁ-CE</div>';
  }

  function render(enrollment, student) {
    const record = {
      year: enrollment.year,
      personal: student.personal,
      registration: enrollment.registration,
      health: enrollment.health,
    };
    const gradeSection = schema.registrationSections.find(section => section.id === "grades");
    const fields = schema.registrationSections.filter(section => section.id !== "grades").map(section =>
      `<section class="fp-registration-section">${fieldsTable(section.fields, record)}</section>`).join("");
    const grades = `<table class="fp-grade-table" width="100%"><colgroup><col width="50%"><col width="50%"></colgroup><thead><tr>${gradeSection.fields.map(field => `<th>NÍVEL DE ENSINO QUE IRÁ CURSAR EM ${field.path.endsWith("nextGrade") ? Number(enrollment.year) + 1 : enrollment.year}</th>`).join("")}</tr></thead><tbody><tr>${gradeSection.fields.map(field => `<td><strong>Ensino Fundamental<br>(1º ao 5º ano)</strong><div>${choices({ ...field, options: field.options.slice(0, 5) }, get(record, field.path))}</div><strong>Ensino Fundamental<br>(6º ao 9º ano)</strong><div>${choices({ ...field, options: field.options.slice(5) }, get(record, field.path))}</div></td>`).join("")}</tr></tbody></table>`;
    const healthRows = schema.healthQuestions.map(question => `<tr><th scope="row">${question.number}. ${esc(question.question)}</th><td>${output(question.answer, record, false)}</td><td>${question.details.map(field => output(field, record)).join("")}</td></tr>`).join("");
    const signatures = `<table class="fp-signatures"><tbody><tr>${[1, 2].map(index => `<td><p>Data da Matrícula: ${dateBR(enrollment.health[`enrollmentDate${index}`])}</p><div class="fp-signature-line">Assinatura do Pai/Mãe ou responsável pela matrícula</div><div class="fp-signature-line">Assinatura do Funcionário (${esc(enrollment.health[`employeeYear${index}`] || "20____")})</div></td>`).join("")}</tr></tbody></table>`;
    return `<section class="fp-sheet fp-enrollment">${header("FICHA DE MATRÍCULA – ENSINO FUNDAMENTAL")}${fields}${grades}${footer()}</section><section class="fp-sheet fp-health">${header("FICHA DE SAÚDE")}<p class="fp-student-reference"><strong>Aluno(a):</strong> ${esc(student.personal.name)} · <strong>Ano letivo:</strong> ${esc(enrollment.year)}</p><table class="fp-health-table" width="100%"><colgroup><col width="34%"><col width="24%"><col width="42%"></colgroup><thead><tr><th>PERGUNTA</th><th>RESPOSTA<br>(SIM/NÃO)</th><th>DETALHES/COMENTÁRIOS</th></tr></thead><tbody>${healthRows}</tbody></table><div class="fp-observations"><strong>OBSERVAÇÕES ADICIONAIS</strong><p>${esc(enrollment.health.observations || "__________________________________________")}</p></div>${signatures}${footer()}</section>`;
  }

  function print(enrollment, student) {
    const host = document.getElementById("enrollmentPrint");
    host.innerHTML = render(enrollment, student);
    host.setAttribute("aria-hidden", "false");
    document.body.classList.add("enrollment-printing");
    window.print();
  }

  root.AlunoTecEnrollmentPrint = Object.freeze({ render, print });
  if (typeof module !== "undefined" && module.exports) module.exports = { render, choices, dateBR };
})();
