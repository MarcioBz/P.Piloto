/* ==========================================================
   ALUNOTEC | MAPA DE EDIÇÃO — LÓGICA DA INSTITUIÇÃO
   Carrega os campos salvos ao abrir a página, valida e grava os dados
   do formulário. Os IDs devem coincidir com inst.html; STORAGE_KEY
   identifica o registro local da instituição.
========================================================== */

"use strict";

(() => {
  /* CAMPOS E CHAVE: os IDs devem existir em inst.html. */
  const STORAGE_KEY = "alunotec_institution_v1";
  const form = document.getElementById("institutionForm");
  const status = document.getElementById("institutionStatus");
  const fields = [
    "schoolName",
    "schoolInep",
    "schoolPhone",
    "schoolEmail",
    "schoolAddress",
    "schoolCity",
    "schoolState",
  ];

  /* CARREGAMENTO: restaura os dados da escola ao abrir a tela. */
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    fields.forEach((id) => {
      const input = document.getElementById(id);
      if (typeof saved[id] === "string") input.value = saved[id];
    });
  } catch {
    status.textContent =
      "Os dados salvos não puderam ser lidos. Você pode preencher e salvar novamente.";
  }

  /* SALVAMENTO: valida, normaliza e grava os campos preenchidos. */
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(
      fields.map((id) => [id, document.getElementById(id).value.trim()]),
    );
    data.schoolState = data.schoolState.toUpperCase();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    status.textContent = "Dados da instituição salvos neste navegador.";
  });

  /* LIMPEZA: limpa o formulário atual sem apagar os dados já gravados. */
  document.getElementById("clearInstitution").addEventListener("click", () => {
    form.reset();
    status.textContent =
      "Formulário limpo. Os dados já salvos permanecem guardados até você salvar novamente.";
  });
})();
