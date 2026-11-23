(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const api = window.AlunoTecBackup;
  let selectedBackup = null;
  function feedback(message) { $("restoreStatus").textContent = message; }
  function refreshYear() {
    window.AlunoTecShell?.setYears([], localStorage.getItem("alunotecSchoolYear"), true);
  }
  $("restoreFile").addEventListener("change", async event => {
    selectedBackup = null; $("restoreBackup").disabled = true;
    $("restoreSummary").hidden = true;
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 40 * 1024 * 1024) return feedback("Selecione uma cópia de até 40 MB.");
    try {
      selectedBackup = api.validateBackup(JSON.parse(await file.text()));
      const classes = JSON.parse(selectedBackup.localStorage.alunotec_turmas_v2 || '{"base":[],"electives":[]}');
      $("restoreSummary").textContent = `${classes.base.length} turma(s) da Base Comum · ${classes.electives.length} eletiva(s) · ${selectedBackup.attachments.length} anexo(s).`;
      $("restoreSummary").hidden = false;
      $("restoreBackup").disabled = !window.AlunoTecAccess?.canEdit();
      feedback("Cópia validada. Revise o resumo antes de restaurar.");
    } catch (error) { feedback(error.message || "Não foi possível ler essa cópia."); }
  });
  $("restoreBackup").addEventListener("click", () => {
    if (selectedBackup && window.AlunoTecAccess?.canEdit()) $("restoreConfirm").showModal();
  });
  $("cancelRestore").addEventListener("click", () => $("restoreConfirm").close());
  $("confirmRestore").addEventListener("click", async () => {
    $("confirmRestore").disabled = true;
    try {
      await api.restoreBackup(selectedBackup); refreshYear();
      feedback("Dados restaurados. A cópia anterior está disponível em Desfazer última restauração.");
      $("undoRestore").disabled = false; $("restoreConfirm").close();
    } catch (error) { feedback(error.message); $("restoreConfirm").close(); }
    finally { $("confirmRestore").disabled = false; }
  });
  $("undoRestore").addEventListener("click", async () => {
    if (!window.AlunoTecAccess?.canEdit()) return;
    $("undoRestore").disabled = true;
    try {
      const previous = await api.undoData();
      if (!previous) return feedback("Não há uma restauração anterior para desfazer.");
      await api.restoreBackup(previous); refreshYear(); feedback("Os dados anteriores foram recuperados.");
    } catch (error) { feedback(error.message); }
    finally { $("undoRestore").disabled = false; }
  });
  api.undoData().then(previous => { $("undoRestore").disabled = !previous || !window.AlunoTecAccess?.canEdit(); })
    .catch(() => { $("undoRestore").disabled = true; });
})();
