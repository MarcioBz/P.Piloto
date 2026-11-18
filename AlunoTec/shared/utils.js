/* ==========================================================
   ALUNOTEC | UTILITÁRIOS COMPARTILHADOS
   Mantém helpers puros usados por mais de uma tela para evitar versões divergentes.
========================================================== */
(() => {
  "use strict";

  /* ==========================================================
     TEXTO SEGURO PARA HTML
     Converte caracteres especiais antes de inserir valores dinâmicos em HTML.
  ========================================================== */
  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }

  window.AlunoTecUtils = Object.freeze({ escapeHTML });
})();
