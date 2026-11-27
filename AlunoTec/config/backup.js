/* Cópia completa dos dados locais, com anexos e uma restauração reversível. */
(() => {
  "use strict";
  const keys = Object.freeze([
    "alunotec_turmas_v2", "alunotec_turmas_activity_v1", "alunotec_alunos_remanejamentos_v1",
    "alunotecSchoolYear", "alunotec.profile.v1", "alunotec_frequencia_v1",
    "alunotec_frequencia_alertas_v1", "alunotec_frequencia_alertas_ocultos_v1", "alunotec_institution_v1", "alunotec_professores_v1", "alunotec_matriculas_v1",
  ]);
  const root = typeof window === "undefined" ? globalThis : window;
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  function validateBackup(value) {
    if (!object(value) || value.application !== "AlunoTec" || ![1, 2].includes(value.formatVersion) ||
      !object(value.localStorage)) throw new Error("Selecione uma cópia JSON válida do AlunoTec.");
    const data = {};
    for (const key of keys) {
      if (!(key in value.localStorage)) continue;
      const raw = value.localStorage[key];
      if (typeof raw !== "string") throw new Error(`O campo ${key} está em formato inválido.`);
      if (key === "alunotecSchoolYear") {
        if (!/^\d{4}$/.test(raw)) throw new Error("O ano letivo da cópia é inválido.");
      } else {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { throw new Error(`Os dados de ${key} não são JSON válido.`); }
        if (key === "alunotec_professores_v1") {
          const teachers = root.AlunoTecTeachers || (typeof module !== "undefined" && module.exports ? require("../shared/teachers-store.js") : null);
          if (!teachers) throw new Error("O validador do cadastro de professores não foi carregado.");
          teachers.validate(parsed);
        } else if (key === "alunotec_matriculas_v1") {
          const enrollment = root.AlunoTecEnrollmentModel || (typeof module !== "undefined" && module.exports ? require("../shared/enrollment-store.js") : null);
          if (!enrollment) throw new Error("O validador de matrículas não foi carregado.");
          enrollment.validate(parsed);
        } else if (key === "alunotec_turmas_v2") {
          if (!object(parsed) || !Array.isArray(parsed.base) || !Array.isArray(parsed.electives))
            throw new Error("A cópia não contém uma estrutura válida de turmas.");
          for (const item of [...parsed.base, ...parsed.electives]) {
            if (!object(item) || item.id == null || typeof item.name !== "string" || !Array.isArray(item.students) ||
              item.students.some(student => !object(student) || student.id == null || typeof student.name !== "string"))
              throw new Error("Há uma turma ou um aluno inválido na cópia.");
          }
        } else if (key === "alunotec_frequencia_v1") {
          if (!object(parsed) || Object.values(parsed).some(call => !object(call) || !object(call.students)))
            throw new Error("Há uma chamada inválida na cópia.");
        } else if (["alunotec.profile.v1", "alunotec_institution_v1"].includes(key)) {
          if (!object(parsed)) throw new Error(`O cadastro de ${key} é inválido.`);
        } else if (key === "alunotec_alunos_remanejamentos_v1") {
          if (!Array.isArray(parsed) && !object(parsed)) throw new Error("O histórico de remanejamentos é inválido.");
        } else if (!Array.isArray(parsed)) {
          throw new Error(`A lista de ${key} é inválida.`);
        }
      }
      data[key] = raw;
    }
    // Confere as referências das novas matrículas sem rejeitar listas legadas.
    if (data.alunotec_matriculas_v1 && data.alunotec_turmas_v2) {
      const registry = JSON.parse(data.alunotec_matriculas_v1);
      const classes = JSON.parse(data.alunotec_turmas_v2);
      for (const item of [...classes.base, ...classes.electives]) {
        for (const member of item.students) {
          if (!member.enrollmentId) continue;
          const enrollment = registry.enrollments.find(entry => entry.id === member.enrollmentId);
          if (!enrollment || enrollment.studentId !== member.studentId ||
              String(item.year || item.date?.slice(0, 4)) !== enrollment.year) {
            throw new Error("Há um vínculo de turma sem matrícula correspondente na cópia.");
          }
        }
      }
    }
    if (!Object.keys(data).length) throw new Error("A cópia não contém dados reconhecidos do AlunoTec.");
    const attachments = value.formatVersion === 2 ? value.attachments || [] : [];
    if (!Array.isArray(attachments) || attachments.some(file => !object(file) || typeof file.id !== "string" ||
      typeof file.data !== "string" || file.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)))
      throw new Error("Os anexos da cópia são inválidos.");
    return { application: "AlunoTec", formatVersion: value.formatVersion,
      exportedAt: value.exportedAt || "", localStorage: data, attachments };
  }
  function openDB(name, store) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(store);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
  async function storedAttachments() {
    const db = await openDB("alunotec-anexos-frequencia", "atestados");
    return new Promise((resolve, reject) => {
      const tx = db.transaction("atestados", "readonly");
      const store = tx.objectStore("atestados"), ids = store.getAllKeys(), files = store.getAll();
      tx.oncomplete = () => { db.close(); resolve(ids.result.map((id, index) => ({ id: String(id), file: files.result[index] }))); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }
  function base64(bytes) {
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 32768)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    return btoa(binary);
  }
  async function buildBackup() {
    const data = {};
    keys.forEach(key => { const value = localStorage.getItem(key); if (value !== null) data[key] = value; });
    const files = await storedAttachments();
    const attachments = await Promise.all(files.map(async ({ id, file }) => ({ id,
      name: file.name || "anexo", type: file.type || "application/octet-stream",
      data: base64(new Uint8Array(await file.arrayBuffer())) })));
    return { application: "AlunoTec", formatVersion: 2, exportedAt: new Date().toISOString(),
      localStorage: data, attachments };
  }
  async function putAttachments(files) {
    if (!files.length) return;
    const db = await openDB("alunotec-anexos-frequencia", "atestados");
    return new Promise((resolve, reject) => {
      const tx = db.transaction("atestados", "readwrite"), store = tx.objectStore("atestados");
      files.forEach(item => {
        const raw = atob(item.data), bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
        store.put(new File([bytes], item.name || "anexo", { type: item.type || "application/octet-stream" }), item.id);
      });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }
  async function undoData(value) {
    const db = await openDB("alunotec-backup-recovery", "copies");
    return new Promise((resolve, reject) => {
      const tx = db.transaction("copies", value ? "readwrite" : "readonly");
      const request = value ? tx.objectStore("copies").put(value, "beforeRestore") :
        tx.objectStore("copies").get("beforeRestore");
      tx.oncomplete = () => { db.close(); resolve(request.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }
  function replaceData(data, preserveMissingTeachers = false) {
    keys.forEach(key => { if (!(preserveMissingTeachers && ["alunotec_professores_v1", "alunotec_matriculas_v1"].includes(key) && !(key in data))) localStorage.removeItem(key); });
    keys.forEach(key => { if (key in data) localStorage.setItem(key, data[key]); });
  }
  async function restoreBackup(value) {
    const valid = validateBackup(value), before = await buildBackup();
    const previousSync = localStorage.getItem("alunotec_turmas_pending_sync_v1");
    const previousEnrollmentSync = localStorage.getItem("alunotec_matriculas_sync_v1");
    const previousSyncState = localStorage.getItem("alunotec_turmas_sync_state_v1");
    await undoData(before);
    try {
      await putAttachments(valid.attachments);
      replaceData(valid.localStorage, true);
      const enrollmentModel = root.AlunoTecEnrollmentModel;
      const enrollmentRaw = localStorage.getItem("alunotec_matriculas_v1");
      if (enrollmentModel && enrollmentRaw) {
        const registry = enrollmentModel.validate(JSON.parse(enrollmentRaw));
        const classes = JSON.parse(localStorage.getItem("alunotec_turmas_v2") || '{"base":[],"electives":[]}');
        localStorage.setItem("alunotec_turmas_v2", JSON.stringify(enrollmentModel.projectClasses(classes, registry)));
        const previousState = JSON.parse(previousEnrollmentSync || "{}");
        localStorage.setItem("alunotec_matriculas_sync_v1", JSON.stringify({ ...previousState, pending: true, localRevision: registry.revision }));
      }
      localStorage.setItem("alunotec_turmas_pending_sync_v1", JSON.stringify({
        savedAt: new Date().toISOString(), data: JSON.parse(localStorage.getItem("alunotec_turmas_v2") || '{"base":[],"electives":[]}'),
      }));
      localStorage.removeItem("alunotec_turmas_sync_state_v1");
      localStorage.removeItem("alunotec_turmas_remote_conflict_v1");
    } catch (error) {
      replaceData(before.localStorage);
      if (previousEnrollmentSync === null) localStorage.removeItem("alunotec_matriculas_sync_v1");
      else localStorage.setItem("alunotec_matriculas_sync_v1", previousEnrollmentSync);
      if (previousSync === null) localStorage.removeItem("alunotec_turmas_pending_sync_v1");
      else localStorage.setItem("alunotec_turmas_pending_sync_v1", previousSync);
      if (previousSyncState === null) localStorage.removeItem("alunotec_turmas_sync_state_v1");
      else localStorage.setItem("alunotec_turmas_sync_state_v1", previousSyncState);
      await putAttachments(before.attachments);
      throw new Error(`A cópia não foi restaurada. Os dados anteriores foram preservados. ${error.message || ""}`);
    }
    root.dispatchEvent(new Event("alunotec:datarestored"));
    return valid;
  }
  const api = Object.freeze({ keys, validateBackup, buildBackup, restoreBackup, undoData });
  root.AlunoTecBackup = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
