"use strict";

(() => {
  const STORAGE_KEY = "alunotec_institution_v1";
  const form = document.getElementById("institutionForm");
  const status = document.getElementById("institutionStatus");
  const fields = ["schoolName", "schoolInep", "schoolPhone", "schoolEmail", "schoolAddress", "schoolCity", "schoolState"];

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    fields.forEach((id) => {
      const input = document.getElementById(id);
      if (typeof saved[id] === "string") input.value = saved[id];
    });
  } catch {
    status.textContent = "Os dados salvos não puderam ser lidos. Você pode preencher e salvar novamente.";
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(fields.map((id) => [id, document.getElementById(id).value.trim()]));
    data.schoolState = data.schoolState.toUpperCase();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    status.textContent = "Dados da instituição salvos neste navegador.";
  });

  document.getElementById("clearInstitution").addEventListener("click", () => {
    form.reset();
    status.textContent = "Formulário limpo. Os dados já salvos permanecem guardados até você salvar novamente.";
  });
})();
