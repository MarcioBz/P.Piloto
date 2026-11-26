/* ==========================================================
   ALUNOTEC | MAPA DE EDIÇÃO — LÓGICA DE CONFIGURAÇÕES
   Inicializa opções de ano letivo, persiste a escolha e trata ações de
   backup/restauração. Os IDs correspondem a config.html; a chave do ano
   letivo também é lida pelas telas de painel, turmas e relatórios.
========================================================== */

"use strict";

(() => {
  /* ==========================================================
     OPÇÕES DO ANO LETIVO
     Cria as opções do período escolar, restaura a seleção anterior e atualiza os controles de configuração.
  ========================================================== */
  const yearForm = document.getElementById("yearForm");
  const yearSelect = document.getElementById("schoolYear");
  const yearStatus = document.getElementById("yearStatus");
  const backupStatus = document.getElementById("backupStatus");
  function refreshYearOptions(preferredYear = "") {
    const currentYear = new Date().getFullYear();
    const years = window.AlunoTecShell?.getYears?.() || [String(currentYear)];
    const requested = String(
      preferredYear ||
        window.AlunoTecShell?.getYear?.() ||
        localStorage.getItem("alunotecSchoolYear") ||
        currentYear,
    );
    const selectedYear = years.includes(requested) ? requested : years[0];
    yearSelect.replaceChildren(
      ...years.map((year) => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        option.selected = year === selectedYear;
        return option;
      }),
    );
  }

  refreshYearOptions();

  document.addEventListener("alunotec:yearchange", (event) => {
    const year = String(event.detail?.year || "");
    refreshYearOptions(year);
  });

  /* ==========================================================
     SALVAMENTO
     Grava o ano letivo escolhido para que as outras páginas possam usar a mesma referência.
  ========================================================== */
  yearForm.addEventListener("submit", (event) => {
    event.preventDefault();
    window.AlunoTecShell?.setYears(
      window.AlunoTecShell.getYears(),
      yearSelect.value,
      true,
    );
    yearStatus.textContent = `Ano letivo ${yearSelect.value} salvo neste navegador.`;
  });

  window.addEventListener("storage", (event) => {
    if (event.key === "alunotec_turmas_v2") refreshYearOptions();
  });

  /* ==========================================================
     CÓPIA DE SEGURANÇA
     Exporta e restaura as chaves locais usadas pelo sistema, com validação antes de substituir os dados.
  ========================================================== */
  document.getElementById("exportBackup").addEventListener("click", async () => {
    const localSession = window.AlunoTecAccess?.session();
    if (localSession?.mode !== "local" || localSession.role !== "LOCAL") {
      backupStatus.textContent = "A cópia dos cadastros locais está disponível apenas na entrada local de edição.";
      return;
    }
    const button = document.getElementById("exportBackup");
    button.disabled = true;
    try {
      const backup = await window.AlunoTecBackup.buildBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `alunotec-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      backupStatus.textContent = "Cópia completa criada, incluindo os anexos locais.";
    } catch (error) { backupStatus.textContent = `Não foi possível criar a cópia: ${error.message || "erro de armazenamento"}`; }
    finally { button.disabled = false; }
  });
})();
