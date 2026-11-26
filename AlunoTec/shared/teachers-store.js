/* Cadastro local de professores. Códigos locais não autenticam usuários. */
(() => {
  "use strict";
  const key = "alunotec_professores_v1";
  const clone = value => JSON.parse(JSON.stringify(value));
  const empty = () => ({ version: 1, revision: 0, teachers: [], revokedCodes: [] });
  const object = value => value && typeof value === "object" && !Array.isArray(value);
  const codeValid = value => typeof value === "string" && /^\d{5}$/.test(value);
  function validate(value) {
    if (!object(value) || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 ||
      !Array.isArray(value.teachers) || !Array.isArray(value.revokedCodes)) throw new Error("O cadastro de professores está inválido. Restaure uma cópia de segurança antes de alterar os dados.");
    const ids = new Set(), codes = new Set(value.revokedCodes);
    if (codes.size !== value.revokedCodes.length || [...codes].some(code => !codeValid(code))) throw new Error("A reserva de códigos de professores está inválida.");
    for (const teacher of value.teachers) {
      if (!object(teacher) || typeof teacher.id !== "string" || !teacher.id || ids.has(teacher.id) ||
        typeof teacher.name !== "string" || !teacher.name.trim() || typeof teacher.subject !== "string" || !teacher.subject.trim() ||
        !codeValid(teacher.code) || codes.has(teacher.code) || !["active", "inactive"].includes(teacher.status) || !object(teacher.assignments))
        throw new Error("Há um professor ou um código duplicado inválido na cópia.");
      for (const [year, terms] of Object.entries(teacher.assignments)) {
        if (!/^\d{4}$/.test(year) || !object(terms) || Object.entries(terms).some(([term, ids]) =>
          !["1", "2"].includes(term) || !Array.isArray(ids) || ids.some(id => typeof id !== "string" || !id) || new Set(ids).size !== ids.length))
          throw new Error("Há atribuições de semestre inválidas no cadastro de professores.");
      }
      ids.add(teacher.id); codes.add(teacher.code);
    }
    return clone(value);
  }
  function generateCode(data, rng = globalThis.crypto) {
    if (!rng?.getRandomValues) throw new Error("Abra o projeto pelo servidor local para gerar os códigos.");
    const used = new Set([...data.revokedCodes, ...data.teachers.map(item => item.code)]);
    if (used.size >= 100000) throw new Error("Todos os códigos de cinco dígitos já foram utilizados.");
    // Rejeição elimina o viés de reduzir números de 32 bits para 100.000 códigos.
    const buffer = new Uint32Array(1), limit = Math.floor(0x100000000 / 100000) * 100000;
    for (let tries = 0; tries < 1000000; tries++) {
      rng.getRandomValues(buffer);
      if (buffer[0] >= limit) continue;
      const code = String(buffer[0] % 100000).padStart(5, "0");
      if (!used.has(code)) return code;
    }
    throw new Error("Não foi possível gerar um código livre. Tente novamente.");
  }
  const classYear = item => String(item.year || item.date?.slice(0, 4) || new Date().getFullYear());
  const electivesForYear = (classes, year) => (Array.isArray(classes?.electives) ? classes.electives : [])
    .filter(item => item && item.id != null && classYear(item) === String(year));
  const activeClass = item => !String(item.status || "").toLocaleLowerCase("pt-BR").startsWith("inativ");
  function save(data, input, classes, options = {}) {
    const next = validate(data), existing = input.id ? next.teachers.find(item => item.id === input.id) : null;
    if (input.id && !existing) throw new Error("O professor foi excluído em outra janela. Atualize a lista.");
    if (existing && input.expectedUpdatedAt !== existing.updatedAt) throw new Error("Este cadastro mudou em outra janela. Feche o formulário e abra novamente para editar.");
    const name = String(input.name || "").trim(), subject = String(input.subject || "").trim(), year = String(input.year || "");
    if (!name || name.length > 160) throw new Error("Informe o nome completo, com até 160 caracteres.");
    if (!subject || subject.length > 160) throw new Error("Informe a disciplina/matéria, com até 160 caracteres.");
    if (!["active", "inactive"].includes(input.status) || !/^\d{4}$/.test(year)) throw new Error("Confira o status e o ano letivo.");
    if (!object(input.terms) || !Object.keys(input.terms).length || Object.keys(input.terms).some(term => !["1", "2"].includes(term))) throw new Error("Escolha o semestre de atribuição.");
    const available = new Map(electivesForYear(classes, year).map(item => [String(item.id), item]));
    const assignments = clone(existing?.assignments || {});
    assignments[year] ||= {};
    for (const [term, ids] of Object.entries(input.terms)) {
      if (!Array.isArray(ids) || ids.some(id => typeof id !== "string")) throw new Error("Selecione turmas de eletivas válidas.");
      const previous = new Set(existing?.assignments?.[year]?.[term] || []);
      for (const id of ids) if ((!available.has(id) || !activeClass(available.get(id))) && !previous.has(id)) throw new Error("Uma eletiva selecionada não está ativa neste ano. Atualize os vínculos.");
      assignments[year][term] = [...new Set(ids)];
    }
    if (!existing && !Object.values(assignments[year]).some(ids => ids.length)) throw new Error("Vincule pelo menos uma turma de eletiva ao professor.");
    const now = options.now || new Date().toISOString();
    const reserved = new Set([...next.revokedCodes, ...next.teachers.map(item => item.code)]);
    const newCode = codeValid(options.code) && !reserved.has(options.code) ? options.code : null;
    const teacher = { ...(existing || {}), id: existing?.id || options.id || crypto.randomUUID(), name, subject,
      code: existing?.code || newCode || generateCode(next, options.rng), status: input.status, assignments,
      createdAt: existing?.createdAt || now, updatedAt: now };
    if (existing) next.teachers[next.teachers.indexOf(existing)] = teacher; else next.teachers.push(teacher);
    next.revision++; return { data: validate(next), teacher: clone(teacher) };
  }
  function setStatus(data, id, status) {
    const next = validate(data), teacher = next.teachers.find(item => item.id === id);
    if (!teacher) throw new Error("Professor não encontrado.");
    if (!["active", "inactive"].includes(status)) throw new Error("Status inválido.");
    teacher.status = status; teacher.updatedAt = new Date().toISOString(); next.revision++;
    return validate(next);
  }
  function remove(data, id) {
    const next = validate(data), teacher = next.teachers.find(item => item.id === id);
    if (!teacher) throw new Error("Professor não encontrado.");
    next.revokedCodes.push(teacher.code);
    next.teachers = next.teachers.filter(item => item.id !== id); next.revision++;
    return validate(next);
  }
  const api = { key, empty, validate, generateCode, electivesForYear, activeClass, save, setStatus, remove };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  function read() {
    const raw = localStorage.getItem(key);
    return raw === null ? empty() : validate(JSON.parse(raw));
  }
  async function mutate(task) {
    if (!navigator.locks?.request) throw new Error("Para cadastrar professores, abra o AlunoTec pelo INICIAR.bat ou por localhost/HTTPS em um navegador atualizado.");
    return navigator.locks.request(key, () => {
      const result = task(read());
      const next = result.data || result;
      localStorage.setItem(key, JSON.stringify(validate(next)));
      window.dispatchEvent(new Event("alunotec:teachers-updated"));
      return result;
    });
  }
  window.AlunoTecTeachers = Object.freeze({ ...api, read, mutate });
})();
