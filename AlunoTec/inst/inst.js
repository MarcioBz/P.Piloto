/* ==========================================================
   ALUNOTEC | MAPA DE EDIÇÃO — LÓGICA DA INSTITUIÇÃO
   Carrega os campos salvos ao abrir a página, valida e grava os dados
   do formulário. Os IDs devem coincidir com inst.html; STORAGE_KEY
   identifica o registro local da instituição.
========================================================== */

"use strict";

(() => {
  /* ==========================================================
     CAMPOS E CHAVE
     Centraliza a chave de armazenamento e associa os controles da tela aos campos do formulário.
  ========================================================== */
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

  /* ==========================================================
     CARREGAMENTO
     Preenche o formulário com os dados institucionais já salvos quando a página é aberta.
  ========================================================== */
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

  /* ==========================================================
     SALVAMENTO
     Valida e normaliza os campos antes de persistir as informações da instituição.
  ========================================================== */
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

  /* ==========================================================
     LIMPEZA
     Limpa os campos atuais do formulário sem remover os dados já armazenados.
  ========================================================== */
  document.getElementById("clearInstitution").addEventListener("click", () => {
    form.reset();
    status.textContent =
      "Formulário limpo. Os dados já salvos permanecem guardados até você salvar novamente.";
  });
})();
