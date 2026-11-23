/* ALUNOTEC | UTILITÁRIOS E VÍNCULOS DOS ALUNOS
   Os vínculos são consultados por ano. As listas são ordenadas por nome
   sem alterar a ordem dos registros salvos nem o histórico das chamadas. */
(() => {
  "use strict";
  const root = typeof window === "undefined" ? globalThis : window;
  const compare = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" }).compare;
  const norm = value => String(value ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
  const text = value => String(value ?? "");
  const yearOf = item => text(item?.year || item?.date?.slice?.(0, 4) || new Date().getFullYear());
  const dateKey = value => {
    const raw = text(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza",
      year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const part = name => parts.find(item => item.type === name)?.value || "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  function escapeHTML(value) {
    return text(value).replace(/[&<>"']/g, char =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function decodeStudentCSV(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let content;
    const decode = encoding => new TextDecoder(encoding, { fatal: true }).decode(bytes);
    if (bytes[0] === 0xff && bytes[1] === 0xfe) content = decode("utf-16le");
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) content = decode("utf-16be");
    else {
      try { content = decode("utf-8"); }
      catch (error) {
        if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
          throw new Error("O CSV UTF-8 contém caracteres danificados. Salve uma nova cópia a partir do arquivo original.");
        content = decode("windows-1252");
      }
    }
    if (content.includes("\ufffd"))
      throw new Error("O CSV já contém caracteres ilegíveis (�). Corrija os nomes no arquivo original e salve novamente como CSV UTF-8.");
    return content;
  }
  function parseStudentCSV(value) {
    const input = text(value).replace(/^\uFEFF/, "");
    let quoted = false, commas = 0, semicolons = 0;
    for (let i = 0; i < input.length; i++) {
      if (input[i] === '"') quoted = !quoted;
      if (!quoted && /[\r\n]/.test(input[i])) break;
      if (!quoted && input[i] === ',') commas++;
      if (!quoted && input[i] === ';') semicolons++;
    }
    const separator = semicolons >= commas ? ';' : ',';
    const rows = []; let row = [], cell = ""; quoted = false;
    function finishRow() {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    }
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      if (char === '"') {
        if (quoted && input[i + 1] === '"') { cell += '"'; i++; }
        else quoted = !quoted;
      } else if (!quoted && char === separator) { row.push(cell.trim()); cell = ""; }
      else if (!quoted && /[\r\n]/.test(char)) {
        finishRow();
        if (char === '\r' && input[i + 1] === '\n') i++;
      } else cell += char;
    }
    if (quoted) throw new Error("O CSV contém aspas sem fechamento. Confira o arquivo e tente novamente.");
    finishRow();
    if (!rows.length) return [];
    const header = rows[0].map(norm);
    const nameColumn = header.findIndex(label => ["nome", "nome do aluno", "aluno"].includes(label));
    const hasHeader = nameColumn >= 0;
    const phoneColumn = hasHeader ? header.findIndex(label => /whatsapp|telefone|celular/.test(label)) : 1;
    const statusColumn = hasHeader ? header.findIndex(label => ["status", "situacao"].includes(label)) : -1;
    return rows.slice(hasHeader ? 1 : 0).filter(values => values[hasHeader ? nameColumn : 0])
      .map(values => ({ name: values[hasHeader ? nameColumn : 0].normalize("NFC"),
        whatsapp: values[phoneColumn] || "",
        status: norm(values[statusColumn]) === "inativo" ? "Inativo" : "Ativo" }));
  }
  function sorted(students, name = item => item.name || item.studentName || "") {
    return [...students].sort((a, b) => compare(text(name(a)), text(name(b))) ||
      compare(text(a.id || a.studentId || a.key), text(b.id || b.studentId || b.key)));
  }
  function flatten(raw) {
    if (Array.isArray(raw)) return raw.filter(item => item && typeof item === "object");
    if (!raw || typeof raw !== "object") return [];
    for (const key of ["movements", "remanejamentos", "historico", "history", "items", "data"]) {
      if (Array.isArray(raw[key])) return flatten(raw[key]);
    }
    return Object.values(raw).flatMap(value => Array.isArray(value) ? flatten(value) :
      value && typeof value === "object" ? [value] : []);
  }
  function movement(raw, defaultType = "base") {
    return {
      ...raw,
      studentId: text(raw.studentId ?? raw.alunoId ?? raw.idAluno ?? raw.student_id),
      sourceClassId: text(raw.sourceClassId ?? raw.fromClassId ?? raw.turmaOrigemId ?? raw.origemId),
      destinationClassId: text(raw.destinationClassId ?? raw.toClassId ?? raw.turmaDestinoId ?? raw.destinoId ?? raw.classToId),
      type: raw.type === "electives" ? "elective" : raw.type || defaultType,
      day: dateKey(raw.date ?? raw.data ?? raw.movedAt ?? raw.createdAt ?? raw.dataRemanejamento),
      cancelled: raw.status === "Cancelado" || raw.cancelled === true,
    };
  }
  function createIndex(data, rawMovements = [], year = new Date().getFullYear()) {
    year = text(year);
    const classes = ["base", "electives"].flatMap(type =>
      (Array.isArray(data?.[type]) ? data[type] : []).filter(item => item && yearOf(item) === year)
        .map(item => ({ ...item, id: text(item.id), type: type === "base" ? "base" : "elective" })));
    const byClass = new Map(classes.map(item => [item.id, item]));
    const records = classes.flatMap(item => (Array.isArray(item.students) ? item.students : [])
      .filter(student => student && norm(student.name)).map((student, index) => ({
        ...student, id: text(student.id), classId: item.id, className: item.name,
        type: item.type, recordKey: `${item.type}:${item.id}:${student.id || index}`,
      })));
    const entities = new Map();
    const byId = new Map();
    const baseNames = new Map();
    const attach = (key, record) => {
      if (!entities.has(key)) entities.set(key, { key, records: [] });
      const entity = entities.get(key);
      entity.records.push(record);
      if (record.id) byId.set(record.id, entity);
      return entity;
    };
    for (const record of records.filter(item => item.type === "base")) {
      const anchor = text(record.originStudentId || record.sourceStudentId || record.id);
      const entity = attach(anchor ? `id:${anchor}` : record.recordKey, record);
      if (anchor) byId.set(anchor, entity);
      const name = norm(record.name);
      if (!baseNames.has(name)) baseNames.set(name, new Set());
      baseNames.get(name).add(entity);
    }
    for (const record of records.filter(item => item.type === "elective")) {
      const anchor = text(record.originStudentId || record.sourceStudentId || record.studentId);
      let entity = byId.get(anchor || record.id);
      // Os cadastros antigos de Eletivas usam IDs novos. Homônimos não são
      // relacionados por nome quando há mais de um aluno possível.
      if (!entity && !anchor) {
        const names = baseNames.get(norm(record.name));
        if (names?.size === 1) entity = [...names][0];
      }
      entity = attach(entity?.key || (anchor ? `id:${anchor}` : record.id ? `id:${record.id}` : record.recordKey), record);
      if (anchor) byId.set(anchor, entity);
    }
    const names = new Map();
    for (const entity of entities.values()) for (const record of entity.records) {
      if (!names.has(norm(record.name))) names.set(norm(record.name), new Set());
      names.get(norm(record.name)).add(entity);
    }
    const movements = flatten(rawMovements).map(item => {
      const type = byClass.get(text(item.sourceClassId))?.type ||
        byClass.get(text(item.destinationClassId))?.type || "base";
      return movement(item, type);
    }).filter(item => byClass.has(item.sourceClassId) || byClass.has(item.destinationClassId) ||
      item.day.startsWith(`${year}-`));
    function describe(student = {}, options = {}) {
      const id = text(student.id ?? student.studentId);
      const entity = byId.get(id) || byId.get(text(student.originStudentId)) || (() => {
        const candidates = names.get(norm(student.name || student.studentName));
        return candidates?.size === 1 ? [...candidates][0] : null;
      })();
      const linked = entity?.records || [];
      const own = linked.find(item => item.id === id && (!options.classId || item.classId === text(options.classId))) ||
        linked.find(item => item.id === id) || student;
      const base = linked.filter(item => item.type === "base");
      const ids = new Set([id, ...linked.map(item => item.id)].filter(Boolean));
      const histories = linked.flatMap(item => flatten(item.transferHistory).map(event => movement(event, item.type)));
      const related = [...movements.filter(item => ids.has(item.studentId)), ...histories]
        .filter(item => !item.cancelled && item.destinationClassId &&
          (!byClass.has(item.destinationClassId) || yearOf(byClass.get(item.destinationClassId)) === year));
      const seen = new Set();
      const history = related.filter(item => {
        const key = `${item.type}|${item.sourceClassId}|${item.destinationClassId}|${item.date || item.day}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      }).sort((a, b) => text(a.date || a.day).localeCompare(text(b.date || b.day)));
      const date = options.date || "9999-12-31";
      const classRef = (classId, fallback) => ({ id: text(classId),
        name: text(byClass.get(text(classId))?.name || fallback || "") });
      const firstBase = base[0];
      const baseHistory = history.filter(item => item.type === "base");
      const ownElectiveHistory = history.filter(item => item.type === "elective" &&
        (!item.studentId || item.studentId === own.id));
      const positionHistory = firstBase ? baseHistory : ownElectiveHistory;
      const originalId = text(firstBase?.originBaseClassId || firstBase?.originClassId ||
        own.originBaseClassId || (baseHistory.length ? baseHistory[0].sourceClassId : "") ||
        firstBase?.classId || student.originClassId || positionHistory[0]?.sourceClassId || own.classId || "");
      const origin = classRef(originalId, firstBase?.originBaseClassName || firstBase?.originClassName ||
        own.originBaseClassName || baseHistory[0]?.sourceClassName || student.originClassName);
      let current = firstBase ? classRef(firstBase.classId, firstBase.className) :
        own.classId ? classRef(own.classId, own.className) : origin;
      if (positionHistory.length) {
        current = classRef(positionHistory[0].sourceClassId || origin.id,
          positionHistory[0].sourceClassName || origin.name);
        for (const event of positionHistory.filter(item => !item.day || item.day <= date)) {
          current = classRef(event.destinationClassId, event.destinationClassName);
        }
      }
      if (firstBase && !baseHistory.length && (firstBase.frequencyClassId || firstBase.attendanceClassId)) {
        current = classRef(firstBase.frequencyClassId || firstBase.attendanceClassId, "");
      }
      const electives = [];
      for (const record of linked.filter(item => item.type === "elective" && item.status !== "Inativo")) {
        if (options.date && record.linkedAt && dateKey(record.linkedAt) > date) continue;
        let elective = classRef(record.classId, record.className);
        const changes = history.filter(item => item.type === "elective" &&
          (!item.studentId || item.studentId === record.id));
        if (changes.length) {
          elective = classRef(changes[0].sourceClassId, changes[0].sourceClassName);
          changes.filter(item => !item.day || item.day <= date).forEach(item => {
            elective = classRef(item.destinationClassId, item.destinationClassName);
          });
        }
        if (elective.name && !electives.some(item => item.id === elective.id)) electives.push(elective);
      }
      electives.sort((a, b) => compare(a.name, b.name));
      const baseRemapped = Boolean(origin.id && current.id && origin.id !== current.id);
      const electiveRemapped = history.some(item => item.type === "elective" &&
        (!item.day || item.day <= date) && item.sourceClassId !== item.destinationClassId);
      return {
        id, year, name: text(student.name || student.studentName || own.name || "Aluno sem nome"),
        origin, current, electives,
        remapped: baseRemapped || electiveRemapped, baseRemapped, electiveRemapped,
        history, linked,
      };
    }
    return { classes, records, entities: [...entities.values()], describe };
  }

  let cached;
  function getIndex(options = {}) {
    let raw = "{}", remaps = "[]", year = text(options.year || options.date?.slice(0, 4) || new Date().getFullYear());
    try {
      raw = root.localStorage.getItem("alunotec_turmas_v2") || "{}";
      remaps = root.localStorage.getItem("alunotec_alunos_remanejamentos_v1") || "[]";
      year = text(options.year || root.AlunoTecShell?.getYear?.() ||
        root.localStorage.getItem("alunotecSchoolYear") || year);
    } catch {}
    if (cached?.raw === raw && cached?.remaps === remaps && cached?.year === year) return cached.index;
    let data = {}, movements = [];
    try { data = JSON.parse(raw); } catch {}
    try { movements = JSON.parse(remaps); } catch {}
    cached = { raw, remaps, year, index: createIndex(data, movements, year) };
    return cached.index;
  }
  const info = (student, options = {}) => getIndex(options).describe(student, options);
  function detailsText(value) {
    const parts = [`Eletiva${value.electives.length > 1 ? "s" : ""}: ${value.electives.map(item => item.name).join(", ") || "nenhuma vinculada"}`,
      `Origem: ${value.origin.name || "não identificada"}`];
    if (value.baseRemapped) parts.push(`Remanejado para: ${value.current.name || "turma não identificada"}`);
    else if (value.electiveRemapped) parts.push("Eletiva remanejada");
    return parts.join(" · ");
  }
  function label(student, options = {}) {
    const value = info(student, options);
    return `<span class="at-student-label"><span class="at-student-label-name">${escapeHTML(value.name)}</span>
      <span class="at-student-label-details">
        <span class="at-student-electives${value.electives.length ? "" : " is-empty"}">${escapeHTML(value.electives.length ?
          `Eletiva${value.electives.length > 1 ? "s" : ""}: ${value.electives.map(item => item.name).join(", ")}` : "Sem eletiva vinculada")}</span>
        <span class="at-student-origin">Origem: ${escapeHTML(value.origin.name || "não identificada")}</span>
        ${value.baseRemapped ? '<span class="at-student-remapped">Remanejado</span>' :
          value.electiveRemapped ? '<span class="at-student-remapped">Eletiva remanejada</span>' : ""}
      </span></span>`;
  }
  function transferred(student, source, destination, options = {}) {
    const type = options.type === "electives" ? "elective" : options.type || "base";
    const date = options.date || new Date().toISOString();
    const value = info(student, { year: yearOf(source), classId: source.id });
    const event = { id: `transfer-${text(student.id)}-${date}`, studentId: text(student.id),
      sourceClassId: text(source.id), sourceClassName: source.name,
      destinationClassId: text(destination.id), destinationClassName: destination.name, type, date };
    const next = { ...student, transferHistory: [...flatten(student.transferHistory), event] };
    if (type === "base") {
      next.originBaseClassId = value.origin.id || text(source.id);
      next.originBaseClassName = value.origin.name || source.name;
      next.originClassId = next.originBaseClassId;
      next.originClassName = next.originBaseClassName;
    }
    return next;
  }
  function electiveCopy(student, source) {
    const value = info(student, { year: yearOf(source), classId: source.id });
    return { ...student, originStudentId: text(student.originStudentId || student.id),
      originBaseClassId: value.origin.id || text(source.id),
      originBaseClassName: value.origin.name || source.name,
      transferHistory: [], linkedAt: new Date().toISOString() };
  }
  const api = Object.freeze({ compare, sorted, createIndex, info, label, detailsText,
    transferred, electiveCopy, dateKey });
  root.AlunoTecUtils = Object.freeze({ ...(root.AlunoTecUtils || {}), escapeHTML, decodeStudentCSV, parseStudentCSV });
  root.AlunoTecStudents = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document !== "undefined" && !document.getElementById("at-student-links-css")) {
    const scriptURL = document.currentScript?.src;
    if (scriptURL) {
      const link = document.createElement("link");
      link.id = "at-student-links-css";
      link.rel = "stylesheet";
      link.href = new URL("student-links.css", scriptURL).href;
      document.head.append(link);
    }
  }
})();
