/* Cadastro único de alunos e matrículas.
 * As listas antigas das turmas são projeções de compatibilidade por ID.
 * Dados de saúde nunca são copiados para essas listas. */
(() => {
  "use strict";

  const root = typeof window === "undefined" ? globalThis : window;
  const KEY = "alunotec_matriculas_v1";
  const CLASSES_KEY = "alunotec_turmas_v2";
  const JOURNAL_KEY = "alunotec_matriculas_transaction_v1";
  const SYNC_KEY = "alunotec_matriculas_sync_v1";
  const CLASSES_PENDING_KEY = "alunotec_turmas_pending_sync_v1";
  const clone = value => JSON.parse(JSON.stringify(value));
  const text = value => String(value ?? "").trim();
  const normalize = value => text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
  const digits = value => text(value).replace(/\D/g, "");
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const classYear = item => text(item.year || item.date?.slice(0, 4));

  function fail(message, code = "INVALID_DATA", details = {}) {
    const error = new Error(message);
    error.code = code;
    Object.assign(error, details);
    throw error;
  }

  function empty() {
    return {
      version: 1,
      revision: 0,
      polos: [],
      students: [],
      enrollments: [],
    };
  }

  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text(value))) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function validCPF(value) {
    const cpf = digits(value);
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
    for (let length = 9; length <= 10; length++) {
      let sum = 0;
      for (let index = 0; index < length; index++) {
        sum += Number(cpf[index]) * (length + 1 - index);
      }
      const check = (sum * 10 % 11) % 10;
      if (check !== Number(cpf[length])) return false;
    }
    return true;
  }

  // Rejeita estruturas malformadas antes de alterar qualquer chave local.
  function safeValues(value, depth = 0) {
    if (depth > 12) fail("Há campos com uma estrutura inválida.");
    if (typeof value === "string") {
      if (value.length > 20000) fail("Um dos campos excede 20.000 caracteres.");
      return;
    }
    if (value === null || typeof value === "boolean" || typeof value === "number") return;
    if (!Array.isArray(value) && !object(value)) fail("O formulário contém um valor inválido.");
    for (const [key, item] of Object.entries(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) fail("Campo de formulário inválido.");
      safeValues(item, depth + 1);
    }
  }

  function validate(document) {
    if (!object(document) || document.version !== 1 || !Number.isInteger(document.revision) || document.revision < 0) {
      fail("O cadastro de matrículas está em formato inválido. Os dados foram preservados.");
    }
    for (const key of ["polos", "students", "enrollments"]) {
      if (!Array.isArray(document[key])) fail(`A lista ${key} é inválida.`);
      const ids = new Set();
      for (const item of document[key]) {
        if (!object(item) || !text(item.id) || ids.has(text(item.id))) fail(`Há IDs ausentes ou repetidos em ${key}.`);
        ids.add(text(item.id));
      }
    }
    const polos = new Map(document.polos.map(item => [item.id, item]));
    const students = new Map(document.students.map(item => [item.id, item]));
    const cpfs = new Set();
    const registrations = new Set();
    const poloNames = new Set();
    for (const polo of document.polos) {
      if (!text(polo.name)) fail("Há um polo sem nome.");
      if (!polo.archived) {
        const name = normalize(polo.name);
        if (poloNames.has(name)) fail("Há polos ativos com o mesmo nome.");
        poloNames.add(name);
      }
    }
    for (const student of document.students) {
      if (!object(student.personal) || !text(student.personal.name)) fail("Há um aluno sem nome.");
      const cpf = digits(student.personal.cpf);
      if (cpf && (!validCPF(cpf) || cpfs.has(cpf))) fail("Há um CPF inválido ou repetido no cadastro de alunos.");
      if (cpf) cpfs.add(cpf);
      if (student.personal.birthDate && !validDate(student.personal.birthDate)) fail("Há uma data de nascimento inválida.");
    }
    for (const enrollment of document.enrollments) {
      if (!students.has(enrollment.studentId) || !polos.has(enrollment.poloId) || !/^\d{4}$/.test(enrollment.year) ||
          !object(enrollment.registration) || !object(enrollment.health)) {
        fail("Há uma matrícula sem vínculo válido com aluno, polo ou ano.");
      }
      const key = `${enrollment.studentId}|${enrollment.year}`;
      if (registrations.has(key)) fail("Há mais de uma matrícula do mesmo aluno no mesmo ano.");
      registrations.add(key);
    }
    safeValues(document);
    return document;
  }

  function validateClasses(value) {
    if (!object(value) || !Array.isArray(value.base) || !Array.isArray(value.electives)) {
      fail("O cadastro de turmas não pôde ser lido. Nenhum registro foi substituído.");
    }
    return value;
  }

  function rosterId(student) {
    return text(student.studentId || student.originStudentId || student.sourceStudentId || student.id);
  }

  // Mantém os IDs antigos, a situação e os históricos das turmas e chamadas.
  // Nome/telefone nestas listas são somente uma projeção do cadastro único.
  function projectClasses(data, document) {
    const projected = clone(validateClasses(data));
    const students = new Map(document.students.map(student => [student.id, student]));
    for (const type of ["base", "electives"]) {
      for (const item of projected[type]) {
        item.students = (item.students || []).map(member => {
          const person = students.get(rosterId(member)) || students.get(text(member.id));
          if (!person) return member;
          const enrollment = document.enrollments.find(entry => entry.studentId === person.id && entry.year === classYear(item));
          return {
            ...member,
            studentId: person.id,
            name: person.personal.name,
            whatsapp: person.personal.guardianPhone || "",
            ...(enrollment ? { enrollmentId: enrollment.id, poloId: enrollment.poloId } : {}),
          };
        });
      }
    }
    return projected;
  }

  // Relação explícita por IDs. Homônimos nunca são fundidos pelo nome.
  function legacyStudents(data, document = empty()) {
    const registered = new Set(document.students.map(student => student.id));
    const groups = new Map();
    for (const type of ["base", "electives"]) {
      for (const item of data[type] || []) {
        for (const member of item.students || []) {
          const id = rosterId(member);
          if (!id || registered.has(id) || !text(member.name)) continue;
          if (!groups.has(id)) {
            groups.set(id, {
              id,
              name: member.name,
              guardianPhone: member.whatsapp || "",
              classes: [],
            });
          }
          const group = groups.get(id);
          if (type === "base") {
            group.name = member.name;
            group.guardianPhone = member.whatsapp || group.guardianPhone;
          }
          group.classes.push({ id: text(item.id), name: item.name, year: classYear(item), type });
        }
      }
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  // Consulta pública da listagem: não inclui documentos pessoais nem saúde.
  function enrolledStudents(document, poloId, year, query = "") {
    const term = normalize(query);
    return document.enrollments.filter(item => item.poloId === poloId && item.year === String(year))
      .map(enrollment => {
        const student = document.students.find(item => item.id === enrollment.studentId);
        return {
          enrollmentId: enrollment.id,
          studentId: student.id,
          name: student.personal.name,
          socialName: student.personal.socialName || "",
          phone: student.personal.guardianPhone || "",
          grade: enrollment.registration.grade || "",
          year: enrollment.year,
        };
      })
      .filter(item => !term || normalize(item.name).includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  }

  function createRepository(options) {
    const storage = options.storage;
    const now = options.now || (() => new Date().toISOString());
    const id = options.id || (() => root.crypto.randomUUID());
    const authorize = options.authorize || (() => true);
    let queue = Promise.resolve();
    let writing = false;

    function parse(key, fallback) {
      const raw = storage.getItem(key);
      if (raw === null) return clone(fallback);
      try {
        return JSON.parse(raw);
      } catch {
        fail(`Não foi possível ler ${key}. Os dados existentes foram preservados.`);
      }
    }

    function restoreBefore(before) {
      for (const key of Object.keys(before)) {
        if (storage.getItem(key) !== before[key]) storage.removeItem(key);
      }
      for (const [key, raw] of Object.entries(before)) {
        if (raw !== null) storage.setItem(key, raw);
      }
    }

    function recover() {
      if (writing) return;
      const journal = parse(JOURNAL_KEY, null);
      if (!journal) return;
      if (!object(journal.before) || Object.values(journal.before).some(value => value !== null && typeof value !== "string") || !Number.isFinite(Date.parse(journal.startedAt))) fail("A recuperação local exige uma cópia de segurança válida.");
      if (Date.parse(now()) - Date.parse(journal.startedAt) < 10000) {
        fail("Há uma gravação em andamento. Aguarde alguns segundos e atualize a página.", "BUSY");
      }
      const allowed = [KEY, CLASSES_KEY, SYNC_KEY, CLASSES_PENDING_KEY];
      if (Object.keys(journal.before).some(key => !allowed.includes(key))) fail("O registro de recuperação local é inválido.");
      restoreBefore(journal.before);
      storage.removeItem(JOURNAL_KEY);
    }

    function read() {
      recover();
      return clone(validate(parse(KEY, empty())));
    }

    function readClasses() {
      recover();
      return clone(validateClasses(parse(CLASSES_KEY, { base: [], electives: [] })));
    }

    // As quatro chaves são restauradas juntas se ocorrer falha ou falta de espaço.
    function commit(document, classes, classesChanged, syncOverride = null) {
      validate(document);
      const keys = [KEY, CLASSES_KEY, SYNC_KEY, CLASSES_PENDING_KEY];
      const before = Object.fromEntries(keys.map(key => [key, storage.getItem(key)]));
      const time = now();
      writing = true;
      try {
        storage.setItem(JOURNAL_KEY, JSON.stringify({ startedAt: time, before }));
        storage.setItem(KEY, JSON.stringify(document));
        if (classesChanged) {
          storage.setItem(CLASSES_KEY, JSON.stringify(classes));
          if (syncOverride && syncOverride.pending === false) storage.removeItem(CLASSES_PENDING_KEY);
          else storage.setItem(CLASSES_PENDING_KEY, JSON.stringify({ savedAt: time, data: classes }));
        }
        const previousSync = parse(SYNC_KEY, {});
        storage.setItem(SYNC_KEY, JSON.stringify(syncOverride || { ...previousSync, pending: true, localRevision: document.revision }));
        storage.removeItem(JOURNAL_KEY);
      } catch (error) {
        try {
          restoreBefore(before);
          storage.removeItem(JOURNAL_KEY);
        } catch {
          fail("A gravação foi interrompida. Reabra a página para recuperar os registros anteriores.", "RECOVERY_REQUIRED");
        }
        fail(`Não foi possível salvar. Os dados anteriores foram preservados. ${error.message || "Verifique o espaço disponível."}`, "STORAGE_ERROR");
      } finally {
        writing = false;
      }
      options.onChange?.({ revision: document.revision, classesChanged });
    }

    function mutate(action) {
      const run = async () => {
        if (!authorize()) fail("Abra a entrada local de edição para gerenciar matrículas.", "FORBIDDEN");
        const document = read();
        const beforeClasses = readClasses();
        const classes = clone(beforeClasses);
        const result = action(document, classes);
        const projected = projectClasses(classes, document);
        document.revision += 1;
        commit(document, projected, JSON.stringify(beforeClasses) !== JSON.stringify(projected));
        return clone(result);
      };
      const guarded = () => options.lock ? options.lock(run) : run();
      const result = queue.then(guarded, guarded);
      queue = result.catch(() => {});
      return result;
    }

    function activePolo(document, poloId) {
      const polo = document.polos.find(item => item.id === poloId && !item.archived);
      if (!polo) fail("Selecione um polo ativo e válido.");
      return polo;
    }

    function savePolo(input) {
      return mutate(document => {
        const name = text(input.name).normalize("NFC");
        if (!name || name.length > 160) fail("Informe um nome de polo com até 160 caracteres.");
        if (document.polos.some(item => !item.archived && item.id !== input.id && normalize(item.name) === normalize(name))) {
          fail("Já existe um polo com esse nome.", "DUPLICATE_POLO");
        }
        let polo = input.id ? activePolo(document, input.id) : null;
        if (polo && input.expectedUpdatedAt && polo.updatedAt !== input.expectedUpdatedAt) fail("Este polo foi alterado em outra aba. Reabra a edição.", "CONFLICT");
        if (!polo) {
          polo = { id: id(), name, archived: false, createdAt: now() };
          document.polos.push(polo);
        }
        polo.name = name;
        polo.updatedAt = now();
        return polo;
      });
    }

    function removePolo(poloId, destinationId = "") {
      return mutate(document => {
        const polo = activePolo(document, poloId);
        const linked = document.enrollments.filter(item => item.poloId === poloId);
        if (!linked.length) {
          document.polos = document.polos.filter(item => item.id !== poloId);
          return { deleted: true, transferred: 0 };
        }
        if (!destinationId) fail("Este polo possui matrículas. Escolha outro polo para transferir os registros antes de arquivá-lo.", "POLO_HAS_LINKS");
        if (destinationId === poloId) fail("Escolha um polo de destino diferente.");
        activePolo(document, destinationId);
        for (const enrollment of linked) {
          enrollment.poloHistory ||= [];
          enrollment.poloHistory.push({ from: poloId, to: destinationId, date: now() });
          enrollment.poloId = destinationId;
          enrollment.updatedAt = now();
        }
        polo.archived = true;
        polo.updatedAt = now();
        return { deleted: false, archived: true, transferred: linked.length };
      });
    }

    function saveEnrollment(input) {
      return mutate((document, classes) => {
        activePolo(document, input.poloId);
        if (!/^\d{4}$/.test(text(input.year))) fail("Informe um ano letivo válido.");
        const personal = clone(input.personal || {});
        personal.name = text(personal.name).normalize("NFC");
        personal.guardianPhone = text(personal.guardianPhone);
        if (!personal.name) fail("Informe o nome completo do aluno.");
        if (!validDate(personal.birthDate) || personal.birthDate > now().slice(0, 10)) fail("Informe uma data de nascimento válida.");
        if (personal.cpf && !validCPF(personal.cpf)) fail("O CPF informado é inválido.");
        if (!/^[1-9]$/.test(text(input.registration?.grade))) fail("Selecione o ano/série que o aluno irá cursar.");
        let enrollment = input.id ? document.enrollments.find(item => item.id === input.id) : null;
        if (input.id && !enrollment) fail("A matrícula não está mais disponível.", "CONFLICT");
        if (enrollment && (enrollment.updatedAt !== input.expectedUpdatedAt || enrollment.year !== text(input.year))) {
          fail("Esta matrícula foi alterada em outra aba ou pertence a outro ano. Reabra a edição.", "CONFLICT");
        }
        let personId = enrollment?.studentId || text(input.studentId || input.legacyId);
        let student = document.students.find(item => item.id === personId);
        if (student && input.expectedPersonalUpdatedAt !== student.updatedAt) {
          fail("Os dados pessoais foram alterados em outra aba. Reabra o cadastro antes de salvar.", "CONFLICT");
        }
        if (enrollment && input.studentId && input.studentId !== enrollment.studentId) fail("A edição não pode trocar a identidade do aluno.");
        const legacy = input.legacyId ? legacyStudents(classes, document).find(item => item.id === input.legacyId) : null;
        if (input.legacyId && !student && !legacy) fail("O cadastro de origem foi alterado. Selecione o aluno novamente.");
        if (input.studentId && !student) fail("O aluno selecionado não está disponível.");
        const duplicate = document.students.find(item => item.id !== personId && (
          (digits(personal.cpf) && digits(item.personal.cpf) === digits(personal.cpf)) ||
          (normalize(item.personal.name) === normalize(personal.name) && item.personal.birthDate === personal.birthDate)
        ));
        if (duplicate) fail("Este aluno já tem cadastro. Use Escolher aluno existente para reutilizá-lo.", "DUPLICATE_STUDENT", { studentId: duplicate.id });
        if (!student && !legacy && !input.differentPerson) {
          const candidate = legacyStudents(classes, document).find(item => normalize(item.name) === normalize(personal.name));
          if (candidate) fail("Já existe um aluno com esse nome nas turmas. Escolha o cadastro existente ou confirme que é outra pessoa.", "LEGACY_MATCH", { legacyId: candidate.id });
        }
        if (!student) {
          personId ||= id();
          student = { id: personId, personal: {}, createdAt: now() };
          document.students.push(student);
        }
        if (!enrollment && document.enrollments.some(item => item.studentId === personId && item.year === text(input.year))) {
          fail("O aluno já tem matrícula neste ano letivo. Abra a matrícula existente para editar.", "DUPLICATE_ENROLLMENT", { studentId: personId });
        }
        student.personal = personal;
        student.updatedAt = now();
        if (!enrollment) {
          enrollment = {
            id: id(),
            studentId: student.id,
            poloId: input.poloId,
            year: text(input.year),
            createdAt: now(),
            poloHistory: [],
          };
          document.enrollments.push(enrollment);
        }
        enrollment.poloId = input.poloId;
        enrollment.registration = clone(input.registration || {});
        enrollment.health = clone(input.health || {});
        enrollment.formVersion = "croata-fundamental-saude-1";
        enrollment.updatedAt = now();
        return enrollment;
      });
    }

    function updateContact(studentId, name, guardianPhone) {
      return mutate(document => {
        const student = document.students.find(item => item.id === studentId);
        if (!student || !text(name)) fail("O aluno não foi encontrado ou o nome está vazio.");
        student.personal.name = text(name).normalize("NFC");
        student.personal.guardianPhone = text(guardianPhone);
        student.updatedAt = now();
        return student;
      });
    }

    function addToClass(input) {
      return mutate((document, classes) => {
        const enrollment = document.enrollments.find(item => item.id === input.enrollmentId);
        if (!enrollment) fail("A matrícula selecionada não existe.");
        const student = document.students.find(item => item.id === enrollment.studentId);
        const collection = input.type === "electives" ? classes.electives : classes.base;
        const item = collection.find(entry => text(entry.id) === text(input.classId));
        if (!item || classYear(item) !== enrollment.year) fail("A turma e a matrícula devem pertencer ao mesmo ano letivo.");
        item.students ||= [];
        if (item.students.some(member => rosterId(member) === student.id || text(member.id) === student.id)) {
          fail("Este aluno já está nesta turma.", "DUPLICATE_MEMBERSHIP");
        }
        const baseClass = classes.base.find(entry => classYear(entry) === enrollment.year &&
          (entry.students || []).some(member => rosterId(member) === student.id));
        if (input.type !== "electives" && baseClass) {
          fail(`O aluno já pertence à turma ${baseClass.name}. Use a transferência ou o remanejamento existente.`, "EXISTING_BASE_CLASS");
        }
        item.students.push({
          id: student.id,
          studentId: student.id,
          enrollmentId: enrollment.id,
          poloId: enrollment.poloId,
          name: student.personal.name,
          whatsapp: student.personal.guardianPhone || "",
          status: "Ativo",
          ...(input.type === "electives" && baseClass ? {
            originStudentId: student.id,
            originBaseClassId: text(baseClass.id),
            originBaseClassName: baseClass.name,
          } : {}),
        });
        return { studentId: student.id, classId: text(item.id), enrollmentId: enrollment.id };
      });
    }

    // O servidor deve verificar sessão, permissões e revisão em transação.
    // Uma resposta atrasada nunca substitui uma edição local mais recente.
    function acceptRemote(payload, expectedLocalRevision) {
      const run = () => {
        if (!authorize()) fail("A sincronização exige a entrada local de edição.", "FORBIDDEN");
        if (read().revision !== expectedLocalRevision) return false;
        const document = clone(validate(payload.document));
        const classes = projectClasses(validateClasses(payload.classes), document);
        commit(document, classes, true, {
          pending: false,
          localRevision: document.revision,
          remoteRevision: payload.remoteRevision,
        });
        return true;
      };
      const guarded = () => options.lock ? options.lock(run) : run();
      const task = queue.then(guarded, guarded);
      queue = task.catch(() => {});
      return task;
    }

    function acknowledgeSync(localRevision, remoteRevision, classesUnchanged = true) {
      if (!authorize()) fail("A sincronização exige a entrada local de edição.", "FORBIDDEN");
      storage.setItem(SYNC_KEY, JSON.stringify({
        pending: read().revision !== localRevision || !classesUnchanged,
        localRevision: read().revision,
        remoteRevision,
      }));
    }

    return Object.freeze({ read, readClasses, recover, savePolo, removePolo, saveEnrollment, updateContact, addToClass, acceptRemote, acknowledgeSync });
  }

  const api = {
    KEY,
    CLASSES_KEY,
    JOURNAL_KEY,
    SYNC_KEY,
    empty,
    validate,
    validDate,
    validCPF,
    normalize,
    digits,
    projectClasses,
    legacyStudents,
    enrolledStudents,
    rosterId,
    createRepository,
  };
  root.AlunoTecEnrollmentModel = Object.freeze(api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") {
    root.AlunoTecEnrollment = createRepository({
      storage: localStorage,
      authorize: () => {
        const session = root.AlunoTecAccess?.session();
        return session?.mode === "local" && session.role === "LOCAL";
      },
      lock: root.navigator?.locks ? run => root.navigator.locks.request("alunotec-matriculas-write", run) : null,
      onChange: detail => root.dispatchEvent(new CustomEvent("alunotec:enrollmentchange", { detail })),
    });
  }
})();
