"use strict";

(() => {
  const yearForm = document.getElementById("yearForm");
  const yearSelect = document.getElementById("schoolYear");
  const yearStatus = document.getElementById("yearStatus");
  const backupStatus = document.getElementById("backupStatus");
  const currentYear = new Date().getFullYear();
  const savedYear = localStorage.getItem("alunotecSchoolYear") || String(currentYear);
  const years = new Set(Array.from({ length: 9 }, (_, index) => String(currentYear - 3 + index)));
  years.add(savedYear);
  [...years].sort().forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    option.selected = year === savedYear;
    yearSelect.append(option);
  });

  yearForm.addEventListener("submit", (event) => {
    event.preventDefault();
    localStorage.setItem("alunotecSchoolYear", yearSelect.value);
    yearStatus.textContent = `Ano letivo ${yearSelect.value} salvo neste navegador.`;
  });

  document.getElementById("exportBackup").addEventListener("click", () => {
    const keys = [
      "alunotec_turmas_v2",
      "alunotec_turmas_activity_v1",
      "alunotec_alunos_remanejamentos_v1",
      "alunotecSchoolYear",
      "alunotec.profile.v1",
      "alunotec_frequencia_v1",
      "alunotec_frequencia_alertas_v1",
      "alunotec_frequencia_alertas_ocultos_v1",
      "alunotec_institution_v1",
    ];
    const data = {};
    keys.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    });
    const backup = {
      application: "AlunoTec",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      localStorage: data,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `alunotec-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    backupStatus.textContent = "Cópia criada. Guarde o arquivo em um local seguro.";
  });
})();
