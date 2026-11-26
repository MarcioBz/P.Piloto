/* ALUNOTEC | CENTRAL DE RELATÓRIOS
   1. Leitura e cálculos puros. 2. Exportação PDF/XLSX sem bibliotecas externas.
   3. Seleção de relatórios/turmas, gráficos e tabelas da interface.
   As chaves de Turmas/Frequência são apenas lidas; este módulo não altera chamadas.
   "Sistema" agrupa pela origem salva; "Sala" agrupa pela turma da chamada. */
(() => {
  "use strict";
  const KEYS = {
    classes: "alunotec_turmas_v2",
    calls: "alunotec_frequencia_v1",
    movements: "alunotec_alunos_remanejamentos_v1",
    year: "alunotecSchoolYear",
    institution: "alunotec_institution_v1",
  };
  const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
  const compare = (a, b) => collator.compare(String(a), String(b));
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const integer = value => Number(value).toLocaleString("pt-BR");
  const percent = value => value == null ? "—" : `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const FREQUENCY_SERIES = [
    { key: "present", label: "Presenças", color: "#176c32", dash: "" },
    { key: "absent", label: "Faltas", color: "#e34e58", dash: "8 4" },
    { key: "justified", label: "Justificadas", color: "#2f80d0", dash: "3 4" },
  ];
  function today() {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = name => parts.find(item => item.type === name).value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  }
  function iso(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  const dateObject = date => new Date(`${date}T12:00:00`);
  const addDays = (date, number) => { const next = dateObject(date); next.setDate(next.getDate() + number); return iso(next); };
  const monday = date => addDays(date, -((dateObject(date).getDay() + 6) % 7));
  const br = date => /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? date.split("-").reverse().join("/") : "—";
  const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(String(date)) && !Number.isNaN(dateObject(date).getTime()) && iso(dateObject(date)) === date;
  function classYear(item) {
    const year = String(item?.year || item?.date?.slice?.(0, 4) || today().slice(0, 4));
    return /^\d{4}$/.test(year) ? year : today().slice(0, 4);
  }
  function periodRange(period, anchor, year) {
    if (period === "year") return { start: `${year}-01-01`, end: `${year}-12-31` };
    const date = dateObject(anchor);
    let start = period === "week" ? monday(anchor) : `${anchor.slice(0, 7)}-01`;
    let end = period === "week" ? addDays(start, 6) : iso(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12));
    start = start < `${year}-01-01` ? `${year}-01-01` : start;
    end = end > `${year}-12-31` ? `${year}-12-31` : end;
    return { start, end };
  }
  function flattenMovements(raw) {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== "object") return [];
    for (const key of ["movements", "remanejamentos", "historico", "history", "items", "data"]) {
      if (Array.isArray(raw[key])) return raw[key];
    }
    return Object.values(raw).flatMap(item => Array.isArray(item) ? item : item && typeof item === "object" ? [item] : []);
  }
  function prepareData(rawClasses, rawCalls, rawMovements = [], studentAPI) {
    let ignored = 0;
    const classes = ["base", "electives"].flatMap(type => (Array.isArray(rawClasses?.[type]) ? rawClasses[type] : [])
      .filter(item => item && item.id != null)
      .map(item => ({ ...item, id: String(item.id), type, year: classYear(item), name: String(item.name || "Turma sem nome"), students: Array.isArray(item.students) ? item.students.filter(student => student && typeof student === "object") : [] })));
    const classById = new Map(classes.map(item => [item.id, item]));
    const sourceByStudent = new Map();
    classes.filter(item => item.type === "base").forEach(item => item.students.forEach(student => {
      if (student?.id != null && !sourceByStudent.has(`${item.year}|${student.id}`)) sourceByStudent.set(`${item.year}|${student.id}`, item);
    }));
    const movements = flattenMovements(rawMovements);
    const indexes = new Map();
    const rows = [];
    Object.entries(rawCalls && typeof rawCalls === "object" ? rawCalls : {}).forEach(([key, call]) => {
      if (!call || typeof call !== "object" || !validDate(call.date)) { ignored++; return; }
      const systemId = String(call.classId ?? `historica:${call.className || key}`);
      const storedYear = /^\d{4}$/.test(String(call.year || "")) ? String(call.year) : call.date.slice(0, 4);
      const systemClass = classes.find(item => item.id === systemId && item.year === storedYear) || classById.get(systemId);
      const year = storedYear || String(systemClass?.year || call.date.slice(0, 4));
      if (studentAPI?.createIndex && !indexes.has(year)) {
        indexes.set(year, studentAPI.createIndex(rawClasses, movements, year));
      }
      const students = call.students && typeof call.students === "object" ? call.students : {};
      Object.entries(students).forEach(([studentKey, entry]) => {
        if (!entry || !["presente", "ausente", "justificado"].includes(entry.status)) { ignored++; return; }
        const studentId = String(entry.studentId ?? entry.id ?? (Array.isArray(students) ? `${key}:${studentKey}` : studentKey));
        const links = indexes.get(year)?.describe({ id: studentId, name: entry.studentName || entry.name || "" },
          { classId: systemId, date: call.date });
        const primary = links?.linked.find(item => item.type === "base") || links?.linked[0];
        const personId = String(primary?.originStudentId || primary?.sourceStudentId || primary?.id ||
          entry.originStudentId || studentId);
        // O histórico é lido sem reaplicar remanejamentos às chamadas já salvas.
        const movement = movements.find(item => String(item?.studentId) === studentId && item.sourceClassId && item.active !== false && (!classById.has(String(item.sourceClassId)) || classById.get(String(item.sourceClassId)).year === year));
        const originalClass = sourceByStudent.get(`${year}|${studentId}`);
        const originalStudent = originalClass?.students.find(student => String(student.id) === studentId);
        const originId = String(entry.originClassId || originalStudent?.originBaseClassId ||
          originalStudent?.originClassId || (links?.linked.some(item => item.type === "base") ? links.origin.id : "") ||
          movement?.sourceClassId || originalClass?.id || systemId);
        const originClass = classes.find(item => item.id === originId && item.year === year);
        rows.push({
          callId: String(call.id || key), date: call.date, year, shift: String(call.shift || systemClass?.shift || "Todos"),
          classShift: String(systemClass?.shift || ""),
          studentId, personId, studentName: String(entry.studentName || entry.name || primary?.name || originalClass?.students.find(s => String(s.id) === studentId)?.name || "Aluno sem nome"),
          originId, originName: String(entry.originClassName || originClass?.name || originalStudent?.originBaseClassName ||
            originalStudent?.originClassName || movement?.sourceClassName || call.className || "Turma sem nome"),
          systemId, systemName: String(call.className || systemClass?.name || "Turma sem nome"),
          type: systemClass?.type || (call.type === "elective" || call.type === "electives" ? "electives" : "base"),
          status: entry.status,
        });
      });
    });
    return { classes, classById, rows, ignored, movements };
  }
  function matchesShift(row, shift) {
    if (!shift) return true;
    const recorded = normalize(row.shift);
    return recorded === normalize(shift) || ((!recorded || recorded === "todos") &&
      normalize(row.classShift) === normalize(shift));
  }
  function filterRows(data, filters, view = "overview") {
    return data.rows.filter(row => row.year === filters.year && row.date >= filters.start && row.date <= filters.end &&
      matchesShift(row, filters.shift) &&
      (!filters.classId || (view === "system" ? row.originId : row.systemId) === filters.classId) &&
      (view !== "electives" || row.type === "electives") &&
      (view !== "system" || row.type === "base"));
  }
  function totals(rows) {
    const result = { present: 0, absent: 0, justified: 0, records: rows.length, students: new Set(rows.map(r => r.personId || r.studentId)).size, calls: new Set(rows.map(r => r.callId)).size };
    rows.forEach(row => { result[row.status === "presente" ? "present" : row.status === "ausente" ? "absent" : "justified"]++; });
    result.rate = result.records ? result.present / result.records * 100 : null;
    return result;
  }
  function completedSchoolDays(rows, referenceDate = today()) {
    return new Set(rows.filter(row => validDate(row.date) && row.date <= referenceDate)
      .map(row => row.date)).size;
  }
  function grouped(rows, keyFn, labelFn) {
    const groups = new Map();
    rows.forEach(row => {
      const key = keyFn(row);
      if (!groups.has(key)) groups.set(key, { key, name: labelFn(row), rows: [] });
      groups.get(key).rows.push(row);
    });
    return [...groups.values()].map(group => ({ ...group, ...totals(group.rows) }));
  }
  function previousRange(filters) {
    const duration = Math.round((dateObject(filters.end) - dateObject(filters.start)) / 86400000) + 1;
    return { ...filters, start: addDays(filters.start, -duration), end: addDays(filters.start, -1) };
  }

  function classChoices(data, year, shift = "", view = "overview") {
    const allowed = type => view === "system" ? type === "base" : view === "electives" ? type === "electives" : true;
    const choices = new Map(data.classes.filter(item => item.year === year && allowed(item.type) &&
      (!shift || !item.shift || normalize(item.shift) === "todos" || normalize(item.shift) === normalize(shift)))
      .map(item => [item.id, item.name]));
    data.rows.filter(row => row.year === year && allowed(row.type) && matchesShift(row, shift))
      .forEach(row => {
        const id = view === "system" ? row.originId : row.systemId;
        if (!choices.has(id)) choices.set(id, view === "system" ? row.originName : row.systemName);
      });
    return [...choices.entries()].sort((a, b) => compare(a[1], b[1]));
  }

  function activeElectives(data, filters) {
    return data.classes.filter(item => item.type === "electives" && item.year === filters.year &&
      !normalize(item.status).startsWith("inativ") && (!filters.classId || item.id === filters.classId) &&
      (!filters.shift || !item.shift || normalize(item.shift) === "todos" || normalize(item.shift) === normalize(filters.shift)));
  }

  function reportClasses(data, year, view = "system") {
    const baseRoster = data.classes.filter(item => item.year === year && item.type === "base")
      .flatMap(item => item.students.map((student, index) => ({ student, index, classId: item.id })));
    return classChoices(data, year, "", view).map(([id, name]) => {
      const registered = data.classes.find(item => item.id === id && item.year === year);
      const history = data.rows.filter(row => row.year === year &&
        (view === "system" ? row.originId === id && row.type === "base" : row.systemId === id));
      const roster = view === "system" ? baseRoster.filter(({ student, classId }) =>
        String(student.originBaseClassId || student.originClassId || classId) === id) :
        (registered?.students || []).map((student, index) => ({ student, index, classId: id }));
      const students = new Set(roster.filter(({ student }) => String(student.name || "").trim())
        .map(({ student, index, classId }) => String(student.originStudentId || student.sourceStudentId ||
          student.id || `${classId}:${index}`)));
      return { id, name, type: view === "system" ? "base" : registered?.type || history[0]?.type || "base",
        grade: String(registered?.grade || ""), shift: String(registered?.shift || ""),
        students: registered ? students.size : new Set(history.map(row => row.personId || row.studentId)).size,
        historical: !registered };
    });
  }

  function reportRange(data, year, report = "overview", referenceDate = today()) {
    year = String(year);
    const dates = data.rows.filter(row => row.year === year && row.date.slice(0, 4) === year &&
      row.date <= referenceDate).map(row => row.date).sort();
    const anchor = dates.at(-1) || (year === referenceDate.slice(0, 4) ? referenceDate : `${year}-12-31`);
    const period = report === "weekly" ? "week" : report === "closing" ? "month" : "year";
    return { year, period: report === "period" ? "custom" : period, shift: "", classId: "",
      ...periodRange(period, anchor, year) };
  }

  function absenceClasses(data, filters) {
    const people = new Map();
    filterRows(data, { ...filters, classId: "" }, "student").forEach(row => {
      if (row.status !== "ausente") return;
      if (!people.has(row.systemId)) people.set(row.systemId, new Set());
      people.get(row.systemId).add(row.personId || row.studentId);
    });
    return reportClasses(data, filters.year, "student").map(item => ({ ...item,
      absentStudents: people.get(item.id)?.size || 0 }));
  }

  function frequencyEvolution(rows, filters) {
    const duration = (dateObject(filters.end) - dateObject(filters.start)) / 86400000;
    const unit = duration > 62 ? "month" : duration > 14 ? "week" : "day";
    const keyFor = date => unit === "month" ? date.slice(0, 7) : unit === "week" ? monday(date) : date;
    const groups = new Map(grouped(rows, row => keyFor(row.date), row => row.date).map(item => [item.key, item]));
    const keys = [];
    for (let date = filters.start; date <= filters.end; date = addDays(date, 1)) {
      const key = keyFor(date);
      if (keys.at(-1) !== key) keys.push(key);
    }
    return { unit, series: FREQUENCY_SERIES, points: keys.map(key => {
      const summary = groups.get(key);
      return { key, records: summary?.records || 0,
        values: Object.fromEntries(FREQUENCY_SERIES.map(({ key }) => [key,
          summary?.records ? summary[key] / summary.records * 100 : null])),
        counts: Object.fromEntries(FREQUENCY_SERIES.map(({ key }) => [key, summary?.[key] || 0])) };
    }) };
  }

  function dateRangeError(start, end, year) {
    if (!start || !end) return "Escolha a data inicial e a data final.";
    if (!validDate(start) || !validDate(end)) return "Escolha datas válidas.";
    if (start.slice(0, 4) !== String(year) || end.slice(0, 4) !== String(year)) return `Escolha datas do ano letivo ${year}.`;
    return start > end ? "A data final deve ser igual ou posterior à data inicial." : "";
  }

  function calendarMonthDays(month, year) {
    const first = `${month}-01`;
    const offset = (dateObject(first).getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(first, index - offset);
      return { date, day: Number(date.slice(-2)), outside: date.slice(0, 7) !== month,
        disabled: date.slice(0, 4) !== String(year) };
    });
  }

  /* EXPORTAÇÃO | Planilha Office Open XML com texto literal (nenhuma fórmula).
     ZIP sem compressão: assinatura, CRC32 e diretório central compatíveis com XLSX. */
  const encoder = new TextEncoder();
  function crc32(bytes) {
    let crc = -1;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    return (crc ^ -1) >>> 0;
  }
  function concat(chunks) {
    const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
    let offset = 0;
    chunks.forEach(chunk => { result.set(chunk, offset); offset += chunk.length; });
    return result;
  }
  function zip(files) {
    const local = [], central = [];
    let offset = 0;
    Object.entries(files).forEach(([filename, content]) => {
      const name = encoder.encode(filename), bytes = encoder.encode(content), crc = crc32(bytes);
      const head = new Uint8Array(30), view = new DataView(head.buffer);
      view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(10, 0, true); view.setUint16(12, 33, true);
      view.setUint32(14, crc, true); view.setUint32(18, bytes.length, true); view.setUint32(22, bytes.length, true); view.setUint16(26, name.length, true);
      local.push(head, name, bytes);
      const entry = new Uint8Array(46), entryView = new DataView(entry.buffer);
      entryView.setUint32(0, 0x02014b50, true); entryView.setUint16(4, 20, true); entryView.setUint16(6, 20, true); entryView.setUint16(14, 33, true);
      entryView.setUint32(16, crc, true); entryView.setUint32(20, bytes.length, true); entryView.setUint32(24, bytes.length, true); entryView.setUint16(28, name.length, true); entryView.setUint32(42, offset, true);
      central.push(entry, name); offset += head.length + name.length + bytes.length;
    });
    const directory = concat(central), end = new Uint8Array(22), endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, Object.keys(files).length, true); endView.setUint16(10, Object.keys(files).length, true); endView.setUint32(12, directory.length, true); endView.setUint32(16, offset, true);
    return concat([...local, directory, end]);
  }
  const xml = value => escapeHTML(String(value ?? "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ""));
  function columnName(index) {
    let name = "";
    do { name = String.fromCharCode(65 + index % 26) + name; index = Math.floor(index / 26) - 1; } while (index >= 0);
    return name;
  }
  function xlsx(sheets) {
    const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const files = {
      "[Content_Types].xml": declaration + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") + '</Types>',
      "_rels/.rels": declaration + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      "xl/workbook.xml": declaration + `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` + sheets.map((sheet, i) => `<sheet name="${xml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") + '</sheets></workbook>',
      "xl/_rels/workbook.xml.rels": declaration + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") + '</Relationships>',
    };
    sheets.forEach((sheet, i) => {
      const columnCount = sheet.rows.reduce((max, row) => Math.max(max, row.length), 1);
      files[`xl/worksheets/sheet${i + 1}.xml`] = declaration + `<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>` + Array.from({ length: columnCount }, (_, n) => `<col min="${n + 1}" max="${n + 1}" width="${n === 0 ? 28 : 22}" customWidth="1"/>`).join("") + '</cols><sheetData>' + sheet.rows.map((row, r) => `<row r="${r + 1}">` + row.map((cell, c) => {
        const ref = `${columnName(c)}${r + 1}`;
        return typeof cell === "number" && Number.isFinite(cell) ? `<c r="${ref}"><v>${cell}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(cell)}</t></is></c>`;
      }).join("") + '</row>').join("") + '</sheetData></worksheet>';
    });
    return zip(files);
  }

  /* PDF A4 retrato, com timbre e cabeçalhos repetidos em cada página.
     Helvetica/WinAnsi cobre os caracteres usados em nomes e textos em português. */
  function latinBytes(text) {
    const special = { "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133, "†": 134, "‡": 135, "ˆ": 136, "‰": 137, "Š": 138, "‹": 139, "Œ": 140, "Ž": 142, "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151, "˜": 152, "™": 153, "š": 154, "›": 155, "œ": 156, "ž": 158, "Ÿ": 159 };
    return Uint8Array.from([...String(text)].map(char => special[char] ?? (char.codePointAt(0) <= 255 ? char.codePointAt(0) : 63)));
  }
  function letterheadTitle(view = "overview", mode = "default") {
    const modes = { period: "Frequência por período", monthly: "Evolução mensal",
      comparison: "Comparativo entre turmas", absences: "Alunos com maior ausência",
      closing: "Fechamento mensal" };
    const views = { overview: "Visão geral", room: "Realidade de sala", system: "Realidade do sistema",
      student: "Relatório individual", weekly: "Resumo semanal", electives: "Acompanhamento das eletivas" };
    return modes[mode] || views[view] || "Relatório";
  }
  const reportTextMetrics = (() => {
    const fontWidths = [
      [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584],
      [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584]
    ];
    const measure = (value, size, bold = false) => [...String(value)].reduce((sum, char) => {
      const base = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charCodeAt(0);
      return sum + (fontWidths[Number(bold)][base - 32] || (char === "—" ? 1000 : 600));
    }, 0) * size / 1000;
    function wrap(value, width, size, bold = false) {
      const words = String(value ?? "—").replace(/\s+/g, " ").trim().split(" ");
      const lines = [];
      let line = "";
      words.forEach(word => {
        const proposed = line ? `${line} ${word}` : word;
        if (measure(proposed, size, bold) <= width) { line = proposed; return; }
        if (line) { lines.push(line); line = ""; }
        for (const char of word) {
          if (line && measure(line + char, size, bold) > width) { lines.push(line); line = ""; }
          line += char;
        }
      });
      if (line || !lines.length) lines.push(line);
      return lines;
    }
    return { measure, wrap };
  })();
  function reportTitleLayout(value) {
    const title = String(value || "Relatório");
    const { measure, wrap } = reportTextMetrics;
    let fontSize = 15;
    while (fontSize > 10 && (wrap(title, 90, fontSize, true).length > 3 ||
        title.split(/\s+/).some(word => measure(word, fontSize, true) > 90))) fontSize -= .5;
    return { lines: wrap(title, 90, fontSize, true), fontSize, lineHeight: fontSize + 2 };
  }
  function pdf(table, meta, paper) {
    const escape = value => String(value ?? "").replace(/[\r\n\t]/g, " ")
      .replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    const { measure, wrap } = reportTextMetrics;
    const weights = table.headers.map(header => /turma|^aluno$|^eletiva$|semana/i.test(header) ? 2.5 :
      /data|mês|dias com falta|alunos cadastrados/i.test(header) ? 1.5 :
        /turno|situação|justificad|frequência/i.test(header) ? 1.4 : 1);
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    const pageWidth = 595.28, pageHeight = 841.89, margin = 34;
    const contentWidth = pageWidth - margin * 2, bodyBottom = 94;
    const minimums = table.headers.map(value => Math.max(...String(value).split(/\s+/).map(word => measure(word, 8, true))) + 12);
    const remaining = contentWidth - minimums.reduce((sum, width) => sum + width, 0);
    const widths = weights.map((value, index) => remaining > 0 ? minimums[index] + remaining * value / weightTotal : contentWidth * value / weightTotal);
    const positions = [margin];
    widths.slice(0, -1).forEach(width => positions.push(positions.at(-1) + width));
    const headings = table.headers.map((heading, index) => wrap(heading, widths[index] - 12, 8, true));
    const headerHeight = Math.max(...headings.map(lines => lines.length)) * 10 + 12;
    const pages = [];
    function text(page, value, x, y, size = 8, bold = false, color = "0.12 0.22 0.15") {
      page.commands.push(`${color} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escape(value)}) Tj ET`);
    }
    function startPage() {
      const page = { commands: [], y: 710 };
      if (paper) page.commands.push(`q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Paper Do Q`);
      const title = reportTitleLayout(meta.reportTitle || table.title);
      // Centraliza o bloco completo na altura do ícone, mesmo com várias linhas.
      const center = pageHeight - 23.25 * 72 / 25.4;
      const firstBaseline = center + (title.lines.length - 1) * title.lineHeight / 2 - title.fontSize * .2555;
      title.lines.forEach((line, index) =>
        text(page, line, 320, firstBaseline - index * title.lineHeight, title.fontSize, true, "0.02 0.25 0.16"));
      const block = (value, size, bold = false, color) => {
        wrap(value, contentWidth, size, bold).forEach(line => {
          text(page, line, margin, page.y, size, bold, color); page.y -= size + 4;
        });
        page.y -= 5;
      };
      block(meta.school || "AlunoTec", 11, true, "0.09 0.38 0.17");
      block(table.title, 14, true);
      block(meta.filters, 8);
      block(meta.summary, 8);
      page.bodyTop = page.y - headerHeight;
      if (page.bodyTop < bodyBottom + 30) throw new Error("Os títulos ou filtros são extensos demais para o cabeçalho do PDF.");
      page.commands.push(`0.91 0.96 0.91 rg ${margin} ${page.bodyTop.toFixed(2)} ${contentWidth} ${headerHeight} re f`);
      headings.forEach((lines, column) => lines.forEach((line, index) =>
        text(page, line, positions[column] + 6, page.y - 12 - index * 10, 8, true)));
      page.y = page.bodyTop;
      pages.push(page);
      return page;
    }
    let page = startPage();
    table.rows.forEach((row, rowIndex) => {
      const cells = table.headers.map((_, index) => wrap(row[index], widths[index] - 12, 8));
      const lineCount = Math.max(...cells.map(lines => lines.length));
      const rowHeight = lineCount * 11 + 12;
      if (page.y - rowHeight < bodyBottom && rowHeight <= page.bodyTop - bodyBottom) page = startPage();
      let offset = 0;
      while (offset < lineCount) {
        if (page.y - 23 < bodyBottom) page = startPage();
        const capacity = Math.max(1, Math.floor((page.y - bodyBottom - 12) / 11));
        const length = Math.min(capacity, lineCount - offset);
        const height = length * 11 + 12;
        // Linhas transparentes preservam a marca d'água do timbre.
        page.commands.push(`0.86 0.91 0.88 RG .35 w ${margin} ${(page.y - height).toFixed(2)} m ${pageWidth - margin} ${(page.y - height).toFixed(2)} l S`);
        cells.forEach((lines, column) => lines.slice(offset, offset + length).forEach((line, index) =>
          text(page, line, positions[column] + 6, page.y - 14 - index * 11)));
        page.y -= height;
        offset += length;
        if (offset < lineCount) page = startPage();
      }
    });
    if (!table.rows.length) { text(page, "Nenhum registro para os filtros escolhidos.", 40, page.y - 18, 9); page.y -= 30; }
    const note = wrap(table.note || "", contentWidth, 7);
    page.y -= 14;
    note.forEach(line => {
      if (page.y < bodyBottom) { page = startPage(); page.y -= 16; }
      text(page, line, 34, page.y, 7, false, "0.35 0.43 0.37"); page.y -= 10;
    });
    const objects = [null, "", "<< /Type /Catalog /Pages 1 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"];
    let paperId = null;
    if (paper) {
      const encoded = String(paper.dataUrl || "").match(/^data:image\/jpeg;base64,(.+)$/)?.[1];
      if (!encoded || !paper.width || !paper.height) throw new Error("O timbre do relatório não está disponível.");
      const bytes = typeof atob === "function" ? Uint8Array.from(atob(encoded), char => char.charCodeAt(0)) : Uint8Array.from(Buffer.from(encoded, "base64"));
      paperId = objects.length;
      objects.push(concat([latinBytes(`<< /Type /XObject /Subtype /Image /Width ${paper.width} /Height ${paper.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`), bytes, latinBytes("\nendstream")]));
    }
    const pageIds = [];
    pages.forEach((current, index) => {
      if (index === pages.length - 1) {
        text(current, "Fonte: registros locais do AlunoTec. Frequência = presenças / (presenças + faltas + justificadas).", margin, 72, 6.8);
        text(current, `${meta.generated || ""} | Página ${index + 1} de ${pages.length}`, margin, 60, 7);
      }
      const content = current.commands.join("\n"), streamId = objects.length;
      objects.push(`<< /Length ${latinBytes(content).length} >>\nstream\n${content}\nendstream`);
      const pageId = objects.length;
      objects.push(`<< /Type /Page /Parent 1 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${paperId ? ` /XObject << /Paper ${paperId} 0 R >>` : ""} >> /Contents ${streamId} 0 R >>`);
      pageIds.push(pageId);
    });
    objects[1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] >>`;
    const chunks = [latinBytes("%PDF-1.4\n")], offsets = [0];
    let length = chunks[0].length;
    objects.slice(1).forEach((object, index) => {
      offsets.push(length);
      const chunk = concat([latinBytes(`${index + 1} 0 obj\n`), typeof object === "string" ? latinBytes(object) : object, latinBytes("\nendobj\n")]);
      chunks.push(chunk); length += chunk.length;
    });
    const xref = length;
    chunks.push(latinBytes(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length} /Root 2 0 R >>\nstartxref\n${xref}\n%%EOF`));
    return concat(chunks);
  }

  /* TABELAS | O mesmo modelo alimenta a tela, o PDF, o Excel e a impressão. */
  function reportTable(data, filters, view = "overview", mode = "default", rows = filterRows(data, filters, view), studentName = "") {
    const headers = ["Turma", "Chamadas", "Alunos", "Presenças", "Faltas", "Justificadas", "Frequência"];
    const f = filters;
    let result = { title: "Resumo por turma", headers, rows: [], rateIndex: 6, note: "Alunos são contados por identificador em cada grupo. Um aluno pode aparecer em mais de uma turma; o indicador geral conta cada identificador uma vez." };
    if (mode === "absences") {
      const students = grouped(rows, row => row.personId || row.studentId, row => row.studentName).filter(item => item.absent > 0).sort((a, b) => compare(a.name, b.name));
      return { title: "Alunos com maior ausência", headers: ["Aluno", "Registros", "Presenças", "Faltas", "Dias com falta", "Justificadas", "Frequência"], rows: students.map(item => [item.name, item.records, item.present, item.absent, new Set(item.rows.filter(row => row.status === "ausente").map(row => row.date)).size, item.justified, percent(item.rate)]),
        studentRefs: students.map(item => ({ id: item.key, name: item.name })),
        rateIndex: 6, note: "Alunos em ordem alfabética. Os vínculos junto ao nome são os atuais do ano selecionado; os totais usam as chamadas do período. Dias com falta contam datas distintas. O contador de cada turma conta alunos distintos com faltas naquela turma; justificadas não entram nesse número." };
    }
    if (view === "student") {
      const name = studentName;
      return { title: name ? `Relatório individual · ${name}` : "Relatório individual do aluno", headers: ["Data", "Turma de origem", "Turma da chamada", "Turno", "Situação"], rows: [...rows].sort((a, b) => b.date.localeCompare(a.date) || compare(a.systemName, b.systemName)).map(row => [br(row.date), row.originName, row.systemName, row.shift, { presente: "Presente", ausente: "Falta", justificado: "Justificada" }[row.status]]), rateIndex: -1, note: "O histórico mostra os dados salvos em cada chamada. Remanejamentos atuais não reescrevem a turma das chamadas anteriores. Dias letivos realizados contam datas distintas com chamada do aluno no período selecionado, até hoje, independentemente da situação registrada. Chamadas da base e das eletivas no mesmo dia contam uma vez." };
    }
    if (view === "electives") {
      const groups = new Map(grouped(rows, row => row.systemId, row => row.systemName).map(item => [item.key, item]));
      activeElectives(data, f).forEach(item => { if (!groups.has(item.id)) groups.set(item.id, { key: item.id, name: item.name, ...totals([]) }); });
      return { title: "Acompanhamento das eletivas", headers: ["Eletiva", "Alunos cadastrados", "Chamadas", "Presenças", "Faltas", "Justificadas", "Frequência"], rows: [...groups.values()].sort((a, b) => compare(a.name, b.name)).map(item => [item.name, new Set((data.classById.get(item.key)?.students || []).filter(student => student.id != null && student.status !== "Inativo").map(student => String(student.id))).size, item.calls, item.present, item.absent, item.justified, percent(item.rate)]), rateIndex: 6, note: "Eletivas sem chamada aparecem com frequência —. Registre as chamadas na aba Frequência, escolhendo Eletivas. Cadastros de eletiva, por si só, não geram presença ou falta." };
    }
    if (view === "weekly") {
      const groups = grouped(rows, row => `${monday(row.date)}|${row.systemId}`, row => row.systemName)
        .sort((a, b) => monday(a.rows[0].date).localeCompare(monday(b.rows[0].date)) || compare(a.name, b.name));
      return { ...result, title: "Resumo semanal das turmas", headers: ["Semana (seg–dom)", ...headers],
        rows: groups.map(item => { const start = monday(item.rows[0].date);
          return [`${br(start)} a ${br(addDays(start, 6))}`, item.name, item.calls, item.students,
            item.present, item.absent, item.justified, percent(item.rate)]; }),
        rateIndex: 7, note: "Uma linha por turma e semana. Somente as chamadas dentro das datas aplicadas entram no cálculo; semanas podem estar parcialmente cobertas pelo filtro." };
    }
    if (["monthly", "period"].includes(mode)) {
      const monthly = mode === "monthly";
      const groups = grouped(rows, row => monthly ? row.date.slice(0, 7) : row.date, row => row.date).sort((a, b) => a.key.localeCompare(b.key));
      const label = item => monthly ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(dateObject(`${item.key}-01`)) : br(item.key);
      return { ...result, title: monthly ? "Evolução mensal da frequência" : "Frequência por período", headers: [monthly ? "Mês" : "Data", ...headers.slice(1)], rows: groups.map(item => [label(item), item.calls, item.students, item.present, item.absent, item.justified, percent(item.rate)]), note: "Cada linha considera somente chamadas dentro das datas aplicadas. Dias sem chamada não são tratados como falta." };
    }
    const system = view === "system";
    const groups = grouped(rows, row => system ? row.originId : row.systemId, row => system ? row.originName : row.systemName);
    groups.sort(mode === "comparison" ? (a, b) => (b.rate ?? -1) - (a.rate ?? -1) || compare(a.name, b.name) : (a, b) => compare(a.name, b.name));
    result.rows = groups.map(item => [item.name, item.calls, item.students, item.present, item.absent, item.justified, percent(item.rate)]);
    if (system) {
      result.title = "Realidade do sistema";
      result.headers = ["Turma de origem", ...headers.slice(1)];
      result.note = "Realidade do sistema: agrupado pela turma de origem do aluno, registrada no sistema. Mesmo remanejado para frequentar outra sala, o aluno continua vinculado à origem nesta visão. Quando o campo histórico falta, é usado o cadastro/histórico disponível.";
    } else if (view === "room") {
      result.title = "Realidade de sala";
      result.headers = ["Turma da chamada", ...headers.slice(1)];
      result.note = "Realidade de sala: agrupado pela turma onde a chamada foi registrada, incluindo os alunos que passaram a frequentar a sala após um remanejamento. O histórico preserva a sala de cada chamada.";
    } else if (mode === "closing") result.title = "Fechamento mensal da escola";
    if (mode === "comparison") result.title = "Comparativo entre turmas";
    return result;
  }

  // Permite validar os cálculos e arquivos exportados sem navegador.
  function studentCatalog(data, rows, filters, studentAPI) {
    const school = { base: data.classes.filter(item => item.type === "base"),
      electives: data.classes.filter(item => item.type === "electives") };
    const index = studentAPI?.createIndex(school, data.movements || [], filters.year);
    const identity = new Map();
    index?.entities.forEach(entity => {
      const primary = entity.records.find(item => item.type === "base") || entity.records[0];
      const id = String(primary.originStudentId || primary.id);
      const value = { id, name: primary.name, ids: new Set(entity.records.map(item => String(item.id))),
        classes: [...new Set(entity.records.map(item => item.className))] };
      value.ids.add(id);
      value.ids.forEach(alias => identity.set(alias, value));
    });
    const entries = new Map();
    function add(id, name, className) {
      const value = identity.get(String(id)) || { id: String(id), name,
        ids: new Set([String(id)]), classes: [className].filter(Boolean) };
      if (!entries.has(value.id)) entries.set(value.id, value);
    }
    rows.forEach(row => add(row.studentId, row.studentName, row.systemName));
    data.classes.filter(item => item.year === filters.year && (!filters.classId || item.id === filters.classId) &&
      (!filters.shift || !item.shift || normalize(item.shift) === "todos" || normalize(item.shift) === normalize(filters.shift)))
      .forEach(item => item.students.forEach(student => {
        if (student?.id != null) add(student.id, String(student.name || "Aluno sem nome"), item.name);
      }));
    const names = new Map();
    entries.forEach(item => names.set(normalize(item.name), (names.get(normalize(item.name)) || 0) + 1));
    return [...entries.values()].map(item => ({ ...item,
      label: names.get(normalize(item.name)) > 1 ?
        `${item.name} · ${item.classes.join(", ")} · cód. ${item.id.slice(-6)}` : item.name,
    })).sort((a, b) => compare(a.name, b.name) || compare(a.id, b.id));
  }

  function individualSelection(data, filters, classId = "", studentId = "", studentAPI) {
    const rosterFilters = { ...filters, classId };
    const registered = classId && data.classes.some(item => item.id === classId && item.year === filters.year);
    const rosterRows = registered ? [] : filterRows(data, { ...rosterFilters,
      start: `${filters.year}-01-01`, end: `${filters.year}-12-31` }, "student");
    const catalog = studentCatalog(data, rosterRows, rosterFilters, studentAPI);
    const selected = catalog.find(item => item.id === studentId) || catalog[0];
    const history = filterRows(data, { ...filters, classId: "" }, "student");
    return { catalog, selectedId: selected?.id || "", rows: history.filter(row =>
      selected?.ids.has(row.studentId) || selected?.ids.has(row.personId)) };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { prepareData, filterRows, totals, completedSchoolDays, grouped, periodRange, previousRange,
      classChoices, activeElectives, reportClasses, reportRange, absenceClasses, frequencyEvolution, dateRangeError, calendarMonthDays, reportTable, letterheadTitle, reportTitleLayout, pdf, xlsx, studentCatalog, individualSelection };
    return;
  }

  /* INTERFACE | Somente IDs e classes rp-* são controlados aqui. */
  const root = document.getElementById("rp-dashboard");
  if (!root) return;
  if (root.dataset.reportsReady === "true") return;
  root.dataset.reportsReady = "true";
  const $ = id => document.getElementById(`rp-${id}`);
  const icons = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    users: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 4 5v2"/>',
    user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    layers: '<path d="m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/>',
    cap: '<path d="m2 9 10-5 10 5-10 5zM6 11v5c3 3 9 3 12 0v-5M22 9v7"/>',
    chart: '<path d="M3 21h18M6 17v-6M12 17V4M18 17v-9"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
    file: '<path d="M14 2H5v20h14V7zM14 2v5h5M8 12h8M8 16h6"/>',
    sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12M15 9v12M3 15h18"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    print: '<path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6zM17 12h1"/>',
    book: '<path d="M12 5C8 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-3-1-7-2-10 1zm0 0v15"/>',
    swap: '<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',
    trend: '<path d="m3 17 6-6 4 4 8-10M15 5h6v6"/>',
    clipboard: '<rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 11h6M9 15h6M9 19h4"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
  };
  const iconHTML = name => `<span class="rp-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${icons[name] || icons.file}</svg></span>`;
  root.querySelectorAll("[data-rp-icon]").forEach(element => { element.innerHTML = `<svg viewBox="0 0 24 24">${icons[element.dataset.rpIcon] || icons.file}</svg>`; });
  const viewLabels = { overview: "Visão geral", room: "Realidade de sala", system: "Realidade do sistema", student: "Relatório individual", weekly: "Resumo semanal", electives: "Eletivas" };
  const state = { view: "overview", mode: "default", studentId: "", applied: null,
    data: null, table: null, rows: [], pickerOpen: false, classType: "base", stage: "catalog", rosterClassId: "",
    chartDraft: { start: "", end: "" } };
  const customSelects = new Map();

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch { state.readErrors.add(key); return fallback; }
  }
  function loadData() {
    state.readErrors = new Set();
    const savedClasses = read(KEYS.classes, {}), savedCalls = read(KEYS.calls, {});
    state.data = prepareData(savedClasses, savedCalls, read(KEYS.movements, []), window.AlunoTecStudents);
    state.institution = read(KEYS.institution, {});
    const warnings = [];
    if (state.readErrors.size) warnings.push("Alguns dados locais não puderam ser lidos. Confira a cópia de segurança nas Configurações.");
    if (state.data.ignored) warnings.push(`${integer(state.data.ignored)} registro(s) incompleto(s) foram ignorados nos cálculos.`);
    $("data-warning").hidden = !warnings.length;
    $("data-warning").textContent = warnings.join(" ");
  }

  /* Seletores com lista verde, seta animada, Escape e navegação por teclado. */
  function closeSelects(except = null) {
    customSelects.forEach(custom => {
      if (custom === except) return;
      custom.wrapper.classList.remove("is-open"); custom.menu.hidden = true;
      custom.button.setAttribute("aria-expanded", "false");
    });
  }
  function enhanceSelect(select) {
    if (customSelects.has(select)) return;
    const wrapper = document.createElement("div"); wrapper.className = "rp-select";
    select.before(wrapper); wrapper.append(select);
    const button = document.createElement("button"); button.type = "button"; button.className = "rp-select-button";
    button.id = `${select.id}-button`; button.setAttribute("role", "combobox"); button.setAttribute("aria-haspopup", "listbox"); button.setAttribute("aria-expanded", "false");
    const label = document.querySelector(`label[for="${select.id}"]`);
    if (label) { label.id ||= `${select.id}-label`; button.setAttribute("aria-labelledby", `${label.id} ${button.id}-value`); label.htmlFor = button.id; }
    const value = document.createElement("span"); value.id = `${button.id}-value`; button.append(value);
    const menu = document.createElement("div"); menu.className = "rp-select-menu"; menu.id = `${select.id}-menu`; menu.setAttribute("role", "listbox"); menu.hidden = true;
    menu.setAttribute("aria-label", label?.textContent || "Opções"); button.setAttribute("aria-controls", menu.id);
    wrapper.append(button, menu);
    const custom = { select, wrapper, button, value, menu };
    customSelects.set(select, custom);
    function open() { closeSelects(custom); menu.hidden = false; wrapper.classList.add("is-open"); button.setAttribute("aria-expanded", "true"); }
    button.addEventListener("click", () => { if (menu.hidden) open(); else closeSelects(); });
    button.addEventListener("keydown", event => {
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault(); open();
        const options = [...menu.querySelectorAll("button:not(:disabled)")];
        (options.find(option => option.getAttribute("aria-selected") === "true") || (event.key === "ArrowUp" ? options.at(-1) : options[0]))?.focus();
      }
    });
    menu.addEventListener("click", event => {
      const option = event.target.closest("[data-option-index]");
      if (!option || option.disabled) return;
      select.selectedIndex = Number(option.dataset.optionIndex);
      closeSelects(); refreshSelect(select); button.focus();
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    menu.addEventListener("keydown", event => {
      const options = [...menu.querySelectorAll("button:not(:disabled)")], current = options.indexOf(document.activeElement);
      let next;
      if (event.key === "ArrowDown") next = (current + 1) % options.length;
      if (event.key === "ArrowUp") next = (current + options.length - 1) % options.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = options.length - 1;
      if (next != null && options.length) { event.preventDefault(); options[next].focus(); }
      if (event.key === "Escape") { event.preventDefault(); closeSelects(); button.focus(); }
    });
    wrapper.addEventListener("focusout", event => { if (!wrapper.contains(event.relatedTarget)) { wrapper.classList.remove("is-open"); menu.hidden = true; button.setAttribute("aria-expanded", "false"); } });
    select.addEventListener("change", () => refreshSelect(select));
    refreshSelect(select);
  }
  function refreshSelect(select) {
    const custom = customSelects.get(select);
    if (!custom) return;
    custom.value.textContent = select.options[select.selectedIndex]?.textContent || "Selecione";
    custom.button.disabled = select.disabled;
    custom.menu.replaceChildren(...[...select.options].map((option, index) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "rp-select-option";
      button.dataset.optionIndex = String(index); button.setAttribute("role", "option"); button.setAttribute("aria-selected", String(option.selected)); button.disabled = option.disabled;
      const text = document.createElement("span"); text.textContent = option.textContent; button.append(text);
      if (option.selected) { const check = document.createElement("span"); check.className = "rp-option-check"; check.textContent = "✓"; check.setAttribute("aria-hidden", "true"); button.append(check); }
      return button;
    }));
  }
  function setOptions(select, options, preferred) {
    select.replaceChildren(...options.map(([value, label]) => new Option(label, value)));
    if (options.some(([value]) => value === String(preferred))) select.value = String(preferred);
    refreshSelect(select);
  }
  function selectedYear() {
    const year = String(window.AlunoTecShell?.getYear?.() || read(KEYS.year, "") || today().slice(0, 4));
    return /^\d{4}$/.test(year) ? year : today().slice(0, 4);
  }
  function activeReport() {
    return state.mode === "default" ? state.view : state.mode;
  }
  function isClassReport() {
    return (["room", "system", "student"].includes(state.view) && state.mode === "default") || state.mode === "absences";
  }
  function isIndividualReport() {
    return state.view === "student" && state.mode === "default";
  }
  function isClassChart() {
    return state.mode === "default" && ["room", "system"].includes(state.view);
  }
  function hasDateRange() {
    return isClassChart() || isIndividualReport() || state.mode === "comparison";
  }
  function selectedClassId() {
    return isIndividualReport() ? state.rosterClassId : state.applied.classId;
  }
  function chosenClass() {
    return reportClasses(state.data, state.applied.year, state.view)
      .find(item => item.id === selectedClassId());
  }
  function scrollToSection(id) {
    const section = $(id);
    section.focus({ preventScroll: true });
    section.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }
  function syncDateControls() {
    const f = state.applied;
    $("period-query").hidden = state.mode !== "period";
    $("weekly-query").hidden = state.view !== "weekly";
    $("monthly-query").hidden = state.mode !== "closing";
    [$("start"), $("end"), $("weekly-date")].forEach(input => {
      input.min = `${f.year}-01-01`; input.max = `${f.year}-12-31`;
      input.setCustomValidity("");
    });
    $("start").value = f.start; $("end").value = f.end;
    $("weekly-date").value = f.start;
    $("closing-month").min = `${f.year}-01`; $("closing-month").max = `${f.year}-12`;
    $("closing-month").value = f.start.slice(0, 7);
    $("closing-month").setCustomValidity("");
    state.chartDraft = { start: f.start, end: f.end };
    $("comparison-reality").value = state.view === "system" ? "system" : "room";
    refreshSelect($("comparison-reality"));
    updateChartDates();
    window.AlunoTecCalendar.refresh();
  }

  /* CALENDÁRIO | Datas pendentes só alteram a consulta ao aplicar o período. */
  function updateChartDates(error = "") {
    for (const field of ["start", "end"]) {
      const value = state.chartDraft[field];
      $("chart-" + field + "-label").textContent = value ? br(value) : "Selecione a data";
      $("chart-" + field + "-button").setAttribute("aria-invalid", String(Boolean(error)));
    }
    $("chart-range-error").textContent = error;
    $("chart-range-error").hidden = !error;
  }
  function closeCalendar() { window.AlunoTecCalendar.close(); }
  function openCalendar(field) {
    if (!hasDateRange() || state.stage !== "report") return;
    const year = state.applied.year;
    const annual = { ...state.applied, start: `${year}-01-01`, end: `${year}-12-31` };
    const rows = isIndividualReport() ? individualSelection(state.data, annual, state.rosterClassId,
      state.studentId, window.AlunoTecStudents).rows : filterRows(state.data, annual, state.view);
    window.AlunoTecCalendar.open({
      title: field === "start" ? "Data inicial" : "Data final",
      trigger: $("chart-" + field + "-button"), value: state.chartDraft[field],
      min: `${year}-01-01`, max: `${year}-12-31`, marks: new Set(rows.map(row => row.date)),
      onSelect(value) { state.chartDraft[field] = value; updateChartDates(); }
    });
  }
  function renderClassPicker() {
    const absences = state.mode === "absences";
    const classes = absences ? absenceClasses(state.data, state.applied) :
      reportClasses(state.data, state.applied.year, state.view);
    const visible = classes.filter(item => item.type === state.classType);
    $("picker-title").textContent = absences ? "Alunos com maior ausência" : viewLabels[state.view];
    $("picker-year").textContent = `Ano letivo ${state.applied.year}`;
    $("picker-description").textContent = absences ? "Escolha a turma. Cada aluno é contado uma vez, mesmo com várias faltas." :
      state.view === "system" ? "Escolha a turma de origem registrada no sistema." :
      state.view === "student" ? "Escolha a turma para localizar o aluno." : "Escolha a turma da chamada.";
    root.querySelectorAll("[data-class-type]").forEach(button => {
      const type = button.dataset.classType;
      button.hidden = state.view === "system" && type === "electives";
      button.classList.toggle("is-active", type === state.classType);
      button.setAttribute("aria-pressed", String(type === state.classType));
      button.querySelector("span").textContent = integer(classes.filter(item => item.type === type).length);
    });
    $("picker-list-title").textContent = state.classType === "base" ? "Turmas da Base Comum" : "Turmas eletivas";
    $("picker-grid").innerHTML = window.AlunoTecUtils.renderClassGroups(visible, item => {
      const info = [item.grade, item.shift, `${integer(item.students)} ${item.students === 1 ? "aluno" : "alunos"}`,
        item.historical ? "Histórico" : ""].filter(Boolean).join(" · ");
      const label = absences ? `${integer(item.absentStudents)} ${item.absentStudents === 1 ? "aluno" : "alunos"} com faltas` :
        `${integer(item.students)} ${item.students === 1 ? "aluno" : "alunos"}`;
      const badge = absences ? `<span class="rp-class-absences${item.absentStudents ? " has-absences" : ""}" aria-hidden="true">
        <strong>${integer(item.absentStudents)}</strong><small>com faltas</small></span>` : "";
      return `<button type="button" class="rp-class-card" data-report-class="${escapeHTML(item.id)}"
        aria-label="Consultar ${escapeHTML(item.name)}, ${label}">
        <span class="rp-class-symbol">${iconHTML(item.type === "electives" ? "cap" : "users")}</span>
        <span class="rp-class-copy"><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(info)}</small></span>
        ${badge}
        <span class="rp-class-arrow">${iconHTML("chevron")}</span></button>`;
    }, "rp-class-grid");
    $("picker-empty").hidden = visible.length > 0;
    $("picker-empty-title").textContent = state.classType === "base" ?
      "Nenhuma turma da Base Comum neste ano" : "Nenhuma eletiva neste ano";
    $("all-classes").disabled = !classes.length;
  }
  function showCatalog(scroll = true) {
    closeCalendar();
    state.stage = "catalog"; state.pickerOpen = false;
    $("status").textContent = "";
    closeSelects(); render();
    if (scroll) scrollToSection("catalog");
  }
  function chooseReport(action, scroll = true) {
    const actions = ["overview", "room", "system", "student", "weekly", "period", "electives", "comparison", "absences", "monthly", "closing"];
    if (!actions.includes(action)) return;
    closeCalendar();
    state.view = action === "comparison" ? "room" : action === "absences" ? "student" :
      ["room", "system", "student", "weekly", "electives"].includes(action) ? action : "overview";
    state.mode = ["comparison", "absences", "period", "monthly", "closing"].includes(action) ? action : "default";
    state.applied = reportRange(state.data, selectedYear(), action);
    state.pickerOpen = isClassReport();
    state.stage = state.pickerOpen ? "classes" : "report";
    state.studentId = ""; state.rosterClassId = "";
    const classes = reportClasses(state.data, state.applied.year, state.view);
    state.classType = state.view !== "system" && !classes.some(item => item.type === "base") &&
      classes.some(item => item.type === "electives") ? "electives" : "base";
    $("status").textContent = "";
    [$("analysis-details"), $("methodology")].forEach(details => { details.open = false; });
    closeSelects(); syncDateControls(); render();
    if (scroll) scrollToSection(state.pickerOpen ? "class-picker" : "view");
  }
  function openClassPicker() {
    state.pickerOpen = true; state.stage = "classes";
    $("status").textContent = "";
    const current = chosenClass();
    if (current) state.classType = current.type;
    render(); scrollToSection("class-picker");
  }
  function selectReportClass(id) {
    if (!isClassReport()) return;
    if (id && !reportClasses(state.data, state.applied.year, state.view).some(item => item.id === id)) {
      $("status").textContent = "Esta turma não está disponível no ano letivo selecionado.";
      return;
    }
    if (isIndividualReport()) {
      state.rosterClassId = id;
      state.studentId = "";
    } else state.applied = { ...state.applied, classId: id };
    state.pickerOpen = false; state.stage = "report";
    $("analysis-details").open = false;
    $("methodology").open = false;
    $("status").textContent = "";
    syncDateControls(); render(); scrollToSection("view");
  }
  function currentRows() {
    if (isIndividualReport()) {
      const selection = individualSelection(state.data, state.applied, state.rosterClassId,
        state.studentId, window.AlunoTecStudents);
      const options = selection.catalog.map(item => [item.id, item.label]);
      state.studentCatalog = new Map(selection.catalog.map(item => [item.id, item]));
      state.studentId = selection.selectedId;
      $("student").disabled = !options.length;
      setOptions($("student"), options.length ? options : [["", "Nenhum aluno disponível"]], state.studentId);
      return selection.rows;
    }
    return filterRows(state.data, state.applied, state.view);
  }
  function scopedActiveElectives() {
    const filters = state.view === "electives" ? state.applied : { ...state.applied, classId: "" };
    return activeElectives(state.data, filters);
  }
  function changeNote(current, previous, name, unit = "") {
    if (current == null || previous == null) return `${name}: sem base no período anterior`;
    const difference = current - previous;
    return `${difference > 0 ? "+" : ""}${difference.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${unit} em relação ao período anterior`;
  }
  function renderMetrics(rows) {
    const summary = totals(rows), previousFilters = previousRange(state.applied);
    let previous = filterRows(state.data, previousFilters, state.view);
    if (state.view === "student" && state.mode !== "absences") {
      const selected = state.studentCatalog.get(state.studentId);
      previous = previous.filter(row => selected?.ids.has(row.studentId) || selected?.ids.has(row.personId));
    }
    const before = totals(previous);
    $("rate").textContent = percent(summary.rate);
    $("rate-note").textContent = changeNote(summary.rate, before.rate, "Comparação", " p.p.");
    $("students").textContent = integer(summary.students);
    $("classes").textContent = integer(new Set(rows.map(row => state.view === "system" ? row.originId : row.systemId)).size);
    $("absences").textContent = integer(summary.absent);
    $("absences-note").textContent = previous.length ? changeNote(summary.absent, before.absent, "Faltas") : "Sem chamadas no período anterior";
    $("electives").textContent = integer(scopedActiveElectives().length);
    $("donut-rate").textContent = percent(summary.rate);
    const fraction = key => summary.records ? summary[key] / summary.records * 100 : 0;
    const present = fraction("present"), absent = fraction("absent");
    $("donut").style.background = summary.records ? `conic-gradient(#176c32 0 ${present}%, #e34e58 ${present}% ${present + absent}%, #2f80d0 ${present + absent}% 100%)` : "#edf1ed";
    $("donut").setAttribute("role", "img"); $("donut").setAttribute("aria-label", `${summary.records} registros: ${summary.present} presenças, ${summary.absent} faltas e ${summary.justified} justificadas.`);
    $("legend").innerHTML = FREQUENCY_SERIES.map(({ key, label, color }) => `<li style="--legend-color:${color}"><strong>${label}</strong>${integer(summary[key])} (${summary.records ? percent(fraction(key)) : "—"})</li>`).join("");
    const day = rows.map(row => row.date).sort().at(-1), daySummary = totals(rows.filter(row => row.date === day));
    $("day-date").textContent = day ? `Último dia com chamada no filtro: ${br(day)}` : "Nenhuma chamada nos filtros aplicados";
    $("day-values").innerHTML = [["users", "Presentes", integer(daySummary.present)], ["close", "Faltas", integer(daySummary.absent)], ["list", "Justificadas", integer(daySummary.justified)], ["check", "Frequência", percent(daySummary.rate)]].map(([icon, label, value]) => `<div class="rp-day-stat">${iconHTML(icon)}<small>${label}</small><strong>${value}</strong></div>`).join("");
  }
  function renderLine(rows) {
    const f = state.applied;
    const model = frequencyEvolution(rows, f);
    const cadence = { month: "Percentuais por mês", week: "Percentuais por semana", day: "Percentuais por dia" }[model.unit];
    $("chart-period").textContent = `${br(f.start)} a ${br(f.end)} · ${cadence.toLowerCase()}`;
    $("evolution-legend").innerHTML = model.series.map(({ label, color }) =>
      `<li style="--series-color:${color}">${label}</li>`).join("");
    if (!rows.length) { $("line-chart").innerHTML = '<div class="rp-chart-empty">O gráfico aparecerá quando houver chamadas neste período.</div>'; return; }
    const width = Math.max(220, Math.min(960, $("line-chart").clientWidth || 760));
    const height = 245, left = 40, right = width - 20, top = 20, bottom = 205;
    const points = model.points.map((point, index) => ({ ...point,
      x: model.points.length === 1 ? (left + right) / 2 : left + index / (model.points.length - 1) * (right - left) }));
    const path = segment => segment.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const grid = [0, 25, 50, 75, 100].map(value => { const y = bottom - value / 100 * (bottom - top); return `<path d="M${left} ${y}H${right}" stroke="#edf1ec" stroke-width="1"/><text x="${left - 7}" y="${y + 4}" fill="#849185" text-anchor="end" font-size="10">${value}%</text>`; }).join("");
    const plots = model.series.map(({ key, label, color, dash }) => {
      const segments = []; let segment = [];
      points.forEach(point => {
        if (point.values[key] == null) {
          if (segment.length) segments.push(segment);
          segment = [];
        } else segment.push({ ...point, y: bottom - point.values[key] / 100 * (bottom - top) });
      });
      if (segment.length) segments.push(segment);
      const lines = segments.filter(s => s.length > 1).map(s => `<path d="${path(s)}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="${dash}" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
      const dots = segments.flat().map(point => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#fff" stroke="${color}" stroke-width="2.5"><title>${escapeHTML(point.key)} · ${label}: ${integer(point.counts[key])} (${percent(point.values[key])})</title></circle>`).join("");
      return `<g data-rp-series="${key}">${lines}${dots}</g>`;
    }).join("");
    const tickCount = Math.min(points.length, Math.max(2, Math.min(7, Math.floor((right - left) / 45) + 1)));
    const tickIndexes = new Set(Array.from({ length: tickCount }, (_, index) =>
      tickCount === 1 ? 0 : Math.round(index * (points.length - 1) / (tickCount - 1))));
    const labels = points.filter((_, index) => tickIndexes.has(index)).map(point => `<text x="${point.x}" y="231" text-anchor="middle" fill="#78877b" font-size="10">${escapeHTML(model.unit === "month" ? new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(dateObject(`${point.key}-01`)) : br(point.key).slice(0, 5))}</text>`).join("");
    const description = points.filter(point => point.records).map(point => `${point.key}: ${model.series.map(({ key, label }) => `${label} ${percent(point.values[key])}`).join(", ")}`).join("; ");
    $("line-chart").innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="rp-chart-title rp-chart-desc"><title id="rp-chart-title">Evolução da frequência</title><desc id="rp-chart-desc">${escapeHTML(description)}. Períodos sem chamada ficam sem percentual.</desc>${grid}${plots}${labels}</svg>`;
  }

  /* TABELAS | Todas as visões usam as mesmas linhas filtradas dos indicadores. */
  function makeTable(rows) {
    const label = state.studentId ? $("student").options[$("student").selectedIndex]?.textContent || "" : "";
    const table = reportTable(state.data, state.applied, state.view, state.mode, rows, label);
    if (isIndividualReport()) table.note += " A turma escolhida organiza a lista de alunos; o histórico reúne as chamadas do aluno em todas as turmas dentro do período selecionado.";
    return table;
  }
  function renderTable(rows) {
    const table = makeTable(rows); state.table = table;
    $("result-title").textContent = table.title;
    $("table-caption").textContent = table.title;
    const calls = totals(rows).calls;
    $("result-description").textContent = `${br(state.applied.start)} a ${br(state.applied.end)} · ${integer(calls)} ${calls === 1 ? "chamada" : "chamadas"}${state.mode === "comparison" ? " · " + viewLabels[state.view] : ""}`;
    $("result-count").textContent = `${integer(table.rows.length)} ${state.view === "student" && state.mode !== "absences" ? "registro(s)" : "resultado(s)"}`;
    $("table-head").innerHTML = `<tr>${table.headers.map(heading => `<th scope="col">${escapeHTML(heading)}</th>`).join("")}</tr>`;
    $("table-body").replaceChildren(...table.rows.map((values, rowIndex) => {
      const row = document.createElement("tr");
      values.forEach((value, index) => {
        const cell = document.createElement("td");
        if (index === 0 && table.studentRefs?.[rowIndex] && window.AlunoTecStudents) {
          cell.innerHTML = window.AlunoTecStudents.label(table.studentRefs[rowIndex], { year: state.applied.year });
        } else if (index === table.rateIndex && value !== "—") {
          const badge = document.createElement("span"); badge.className = `rp-rate${Number(String(value).replace("%", "").replace(",", ".")) < 75 ? " is-low" : ""}`; badge.textContent = value; cell.append(badge);
        } else cell.textContent = String(value ?? "—");
        row.append(cell);
      });
      return row;
    }));
    $("empty").hidden = table.rows.length > 0;
    $("empty").querySelector("h3").textContent = state.mode === "absences" && rows.length ? "Nenhuma falta registrada no período" :
      state.view === "student" && state.mode !== "absences" ? "Nenhuma chamada para este aluno no período" : "Nenhuma chamada neste período";
    $("empty").querySelector("p").textContent = state.mode === "absences" && rows.length ? "Não há alunos com registros de ausência neste período." : "Não há chamadas salvas para esta consulta. Confira o ano letivo ou registre a frequência da turma.";
    $("empty").previousElementSibling.hidden = !table.rows.length;
    $("result-note").textContent = table.note;
    const individual = state.view === "student" && state.mode !== "absences";
    const noStudent = individual && !state.studentId;
    if (noStudent) {
      $("empty").querySelector("h3").textContent = "Nenhum aluno para consultar";
      $("empty").querySelector("p").textContent = state.rosterClassId ?
        "Esta turma não possui alunos cadastrados. Use Trocar turma para escolher outra." :
        "Não há alunos cadastrados ou com histórico neste ano letivo.";
    }
    $("empty").querySelector("a").hidden = noStudent;
    $("student-field").hidden = !individual;
    $("student-summary").hidden = !individual;
    if (individual) {
      const total = totals(rows), schoolDays = completedSchoolDays(rows);
      $("student-summary").innerHTML = `<div>Frequência<strong>${percent(total.rate)}</strong></div><div>Presenças<strong>${integer(total.present)}</strong></div><div>Faltas<strong>${integer(total.absent)}</strong></div><div title="Datas distintas com chamada do aluno no período selecionado, até hoje. Base e eletiva no mesmo dia contam uma vez.">Dias letivos realizados<strong>${integer(schoolDays)}</strong></div><div>Justificadas<strong>${integer(total.justified)}</strong></div>`;
    }
    $("export-description").textContent = [table.title, selectedClassId() ? chosenClass()?.name : "",
      `${br(state.applied.start)} a ${br(state.applied.end)}`].filter(Boolean).join(" · ");
    [$("pdf"), $("excel"), $("print-button")].forEach(button => { button.disabled = !table.rows.length; button.title = table.rows.length ? "Exportar relatório aplicado" : "Não há resultados para exportar"; });
  }
  function render() {
    if (!state.applied) return;
    const selectedReport = activeReport();
    root.querySelectorAll("[data-report]").forEach(button => {
      const active = state.stage !== "catalog" && button.dataset.report === selectedReport;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    root.dataset.stage = state.stage;
    $("catalog-context").textContent = `Ano letivo ${state.applied.year}`;
    $("catalog").hidden = state.stage !== "catalog";
    $("flow-nav").hidden = state.stage === "catalog";
    $("class-picker").hidden = state.stage !== "classes";
    $("workspace").hidden = state.stage !== "report";
    $("metrics").hidden = state.stage !== "report" || selectedReport !== "overview";
    if (state.stage !== "report") {
      if (state.stage === "classes") renderClassPicker();
      state.rows = []; state.table = null;
      $("print").replaceChildren();
      $("export-description").textContent = "";
      [$("pdf"), $("excel"), $("print-button")].forEach(button => {
        button.disabled = true; button.title = "Selecione uma turma para abrir o relatório";
      });
      return;
    }
    $("class-context").hidden = !isClassReport();
    if (isClassReport()) {
      $("selected-class-name").textContent = chosenClass()?.name || "Todas as turmas";
      $("selected-class-meta").textContent = selectedClassId() ?
        (state.mode === "absences" ? "Faltas registradas na turma" : state.view === "system" ? "Turma de origem no sistema" : isIndividualReport() ? "Turma para buscar o aluno" : "Turma da chamada") :
        (isIndividualReport() ? "Seleção de alunos" : "Consulta consolidada");
    }
    state.rows = currentRows();
    $("metrics").hidden = selectedReport !== "overview" || !state.rows.length;
    const classChart = isClassChart();
    const individual = isIndividualReport();
    const comparison = state.mode === "comparison";
    const query = $("chart-query");
    query.classList.toggle("is-individual", individual);
    query.classList.toggle("is-comparison", comparison);
    $("comparison-controls").hidden = !comparison;
    $("comparison-field").hidden = !comparison;
    $("range-apply").textContent = comparison ? "Aplicar filtros" : "Aplicar período";
    $("individual-controls").hidden = !individual;
    if (individual) {
      if ($("student-field").parentElement !== query) query.prepend($("student-field"));
      if (query.parentElement !== $("individual-controls")) $("individual-controls").append(query);
    } else {
      if ($("student-field").parentElement !== $("individual-controls")) $("individual-controls").append($("student-field"));
      if (comparison) {
        if (query.parentElement !== $("comparison-controls")) $("comparison-controls").append(query);
      } else if (query.parentElement !== $("evolution")) $("evolution").insertBefore(query, $("evolution-legend"));
    }
    $("date-range-hint").textContent = individual ?
      "O período vale para o histórico, os indicadores e as exportações do aluno." :
      "O período vale para o gráfico, a tabela e as exportações.";
    const chartParent = classChart ? $("class-evolution") : $("charts");
    if ($("evolution").parentElement !== chartParent) chartParent.prepend($("evolution"));
    $("class-evolution").hidden = !classChart;
    query.hidden = !hasDateRange();
    $("analysis-details").hidden = individual || classChart || !state.rows.length;
    if (individual) $("line-chart").replaceChildren();
    else { renderMetrics(state.rows); renderLine(state.rows); }
    renderTable(state.rows);
  }

  /* EXPORTAÇÕES DA INTERFACE | Capturam o relatório aplicado, nunca campos pendentes. */
  function metadata() {
    const f = state.applied, summary = totals(state.rows);
    const classItem = state.data.classes.find(item => item.id === f.classId && item.year === f.year);
    const recordClass = state.data.rows.find(row => row.year === f.year && (row.systemId === f.classId || row.originId === f.classId));
    const classLabel = classItem?.name || (recordClass?.systemId === f.classId ? recordClass?.systemName : recordClass?.originName) || "Todas as turmas";
    const scope = isIndividualReport() ? `Turma usada na seleção: ${chosenClass()?.name || "Todas as turmas"} | Histórico: todas as turmas do aluno` : state.mode === "comparison" ? `Realidade: ${viewLabels[state.view]} | Turmas: todas` : `Turma: ${classLabel}`;
    const schoolDays = isIndividualReport() ? ` | Dias letivos realizados: ${integer(completedSchoolDays(state.rows))}` : "";
    return { reportTitle: letterheadTitle(state.view, state.mode), school: state.institution?.schoolName || "AlunoTec · Central de Relatórios", filters: `Ano letivo ${f.year} | ${br(f.start)} a ${br(f.end)} | Turno: ${f.shift || "Todos"} | ${scope}`, summary: `${summary.calls} chamada(s) | ${summary.students} aluno(s) | Presenças: ${summary.present} | Faltas: ${summary.absent} | Justificadas: ${summary.justified} | Frequência: ${percent(summary.rate)}${schoolDays}`, generated: `Gerado em ${new Date().toLocaleString("pt-BR")}` };
  }
  function download(bytes, type, extension) {
    const link = document.createElement("a"), url = URL.createObjectURL(new Blob([bytes], { type }));
    link.href = url; link.download = `alunotec-${state.view}-${state.applied.start}-${state.applied.end}.${extension}`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportWithFeedback(action, message) {
    if (!state.table?.rows.length) {
      $("status").textContent = "Não há resultados neste relatório para exportar.";
      return;
    }
    try {
      action();
      $("status").textContent = message;
    } catch (error) {
      console.error("Falha ao exportar relatório", error);
      $("status").textContent = "Não foi possível gerar o arquivo. Tente novamente.";
    }
  }
  function buildPrint() {
    if (!state.table) { $("print").replaceChildren(); return; }
    const meta = metadata(), table = state.table, print = $("print");
    const report = $("view").cloneNode(true);
    // O conteúdo impresso acompanha a consulta aplicada. Controles de navegação
    // e exportação ficam somente na tela; gráficos e dados continuam no documento.
    report.querySelectorAll(".rp-results-heading, #rp-period-query, #rp-weekly-query, #rp-monthly-query, #rp-individual-controls, #rp-comparison-controls, #rp-chart-query, #rp-methodology, #rp-empty").forEach(element => element.remove());
    report.querySelectorAll("details").forEach(element => {
      if (element.hidden || !element.open) element.remove();
      else element.querySelector("summary")?.remove();
    });
    report.querySelectorAll("button, select, input, textarea").forEach(element => element.remove());
    [report, ...report.querySelectorAll("[id], [tabindex], [aria-labelledby], [aria-describedby]")].forEach(element => {
      ["id", "tabindex", "aria-labelledby", "aria-describedby"].forEach(attribute => element.removeAttribute(attribute));
    });
    report.className = "reports-app rp-print-report";
    const title = document.createElement("h1");
    title.className = "rp-print-letterhead-title";
    const titleLayout = reportTitleLayout(meta.reportTitle);
    title.style.fontSize = `${titleLayout.fontSize}pt`;
    title.style.lineHeight = `${titleLayout.lineHeight}pt`;
    const titleText = document.createElement("span");
    titleText.textContent = titleLayout.lines.join("\n");
    title.append(titleText);
    const artwork = document.createElement("img");
    artwork.className = "rp-print-paper";
    artwork.src = window.AlunoTecReportPaper.dataUrl;
    artwork.alt = "";
    artwork.setAttribute("aria-hidden", "true");
    const header = document.createElement("header");
    header.className = "rp-print-metadata";
    header.innerHTML = `<strong>${escapeHTML(meta.school)}</strong><h2>${escapeHTML(table.title)}</h2><p>${escapeHTML(meta.filters)}</p><p>${escapeHTML(meta.summary)}</p><small>${escapeHTML(meta.generated)}</small>`;
    const note = document.createElement("footer");
    note.className = "rp-print-notes";
    note.innerHTML = `<p>${escapeHTML(table.note)}</p><p>Frequência = presenças ÷ (presenças + faltas + justificadas). Fonte: registros locais do AlunoTec.</p>`;
    const layout = document.createElement("table");
    layout.className = "rp-print-layout";
    layout.setAttribute("role", "presentation");
    layout.innerHTML = `<thead aria-hidden="true"><tr><td><div class="rp-print-header-space"></div></td></tr></thead><tbody><tr><td class="rp-print-content"></td></tr></tbody><tfoot aria-hidden="true"><tr><td><div class="rp-print-footer-space"></div></td></tr></tfoot>`;
    layout.querySelector(".rp-print-content").append(header, report, note);
    print.replaceChildren(artwork, title, layout);
    // Fora do shell, para que somente o documento seja visível ao imprimir.
    document.body.append(print);
    return artwork;
  }
  $("pdf").addEventListener("click", () => {
    exportWithFeedback(() => download(pdf(state.table, metadata(), window.AlunoTecReportPaper), "application/pdf", "pdf"),
      "PDF do relatório aplicado gerado.");
  });
  $("excel").addEventListener("click", () => {
    exportWithFeedback(() => {
    const meta = metadata();
    const records = [...state.rows].sort((a, b) => compare(a.studentName, b.studentName) || a.date.localeCompare(b.date)).map(row => {
      const links = window.AlunoTecStudents?.info({ id: row.studentId, name: row.studentName }, { year: row.year });
      return [row.date, row.year, row.studentId, row.personId || row.studentId, row.studentName, row.originName, row.systemName, row.shift, row.classShift,
        { presente: "Presente", ausente: "Falta", justificado: "Justificada" }[row.status],
        links?.electives.map(item => item.name).join(", ") || "", links?.origin.name || "", links?.current.name || ""];
    });
    const sheets = [
      { name: "Resumo", rows: [state.table.headers, ...state.table.rows] },
      { name: "Registros", rows: [["Data", "Ano letivo", "ID na chamada", "ID consolidado do aluno", "Aluno", "Turma de origem na chamada", "Turma da chamada", "Turno da chamada", "Turno cadastrado da turma", "Situação", "Eletivas atuais", "Origem atual do cadastro", "Turma de frequência atual"], ...records] },
      { name: "Critérios", rows: [["Campo", "Valor"], ["Escola", meta.school], ["Relatório", state.table.title], ["Consulta", meta.filters], ["Resumo", meta.summary], ["Geração", meta.generated], ["Critério", "Presenças / (presenças + faltas + justificadas). Um registro por aluno/chamada."], ["Turno", isIndividualReport() ? "Todos os turnos das chamadas do aluno." : "Todos os turnos da turma selecionada."], ["Observação", state.table.note]] },
    ];
    download(xlsx(sheets), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx");
    }, "Excel gerado com resumo, registros e critérios aplicados.");
  });
  $("print-button").addEventListener("click", async () => {
    if (!state.table?.rows.length) return;
    const artwork = buildPrint();
    await artwork.decode().catch(() => {});
    window.print();
  });
  window.addEventListener("beforeprint", () => { if (state.table) buildPrint(); });

  /* EVENTOS | O ano vem do cabeçalho. Cada relatório mostra apenas seus próprios controles. */
  $("back-catalog").addEventListener("click", () => showCatalog());
  $("student").addEventListener("change", () => { state.studentId = $("student").value; render(); });
  root.querySelectorAll("[data-report]").forEach(button => button.addEventListener("click", () => chooseReport(button.dataset.report)));
  root.querySelectorAll("[data-class-type]").forEach(button => button.addEventListener("click", () => {
    if (!state.pickerOpen || (state.view === "system" && button.dataset.classType !== "base")) return;
    state.classType = button.dataset.classType;
    renderClassPicker();
  }));
  $("picker-grid").addEventListener("click", event => {
    const button = event.target.closest("[data-report-class]");
    if (button) selectReportClass(button.dataset.reportClass);
  });
  $("all-classes").addEventListener("click", () => selectReportClass(""));
  $("change-class").addEventListener("click", openClassPicker);
  root.querySelectorAll("[data-chart-date]").forEach(button => button.addEventListener("click", () => openCalendar(button.dataset.chartDate)));
  $("chart-query").addEventListener("submit", event => {
    event.preventDefault();
    if (!hasDateRange()) return;
    const { start, end } = state.chartDraft;
    const error = dateRangeError(start, end, state.applied.year);
    updateChartDates(error);
    if (error) return;
    if (state.mode === "comparison") state.view = $("comparison-reality").value === "system" ? "system" : "room";
    state.applied = { ...state.applied, period: "custom", start, end };
    $("status").textContent = "";
    syncDateControls(); render();
  });
  $("chart-year").addEventListener("click", () => {
    if (!hasDateRange()) return;
    state.applied = { ...state.applied, period: "year", ...periodRange("year", today(), state.applied.year) };
    $("status").textContent = "";
    syncDateControls(); render();
  });
  $("period-query").addEventListener("submit", event => {
    event.preventDefault();
    if (state.mode !== "period") return;
    $("end").setCustomValidity("");
    if (!$("period-query").reportValidity()) return;
    const start = $("start").value, end = $("end").value;
    if (!validDate(start) || !validDate(end) || start > end ||
      start.slice(0, 4) !== state.applied.year || end.slice(0, 4) !== state.applied.year) {
      $("end").setCustomValidity("Escolha datas válidas do ano letivo, com a data final igual ou posterior à inicial.");
      $("end").reportValidity(); return;
    }
    state.applied = { ...state.applied, period: "custom", start, end };
    render();
  });
  [$("start"), $("end")].forEach(input => input.addEventListener("input", () => $("end").setCustomValidity("")));
  $("weekly-date").addEventListener("change", () => {
    const input = $("weekly-date");
    if (!input.value) return;
    if (!input.reportValidity() || !validDate(input.value) || input.value.slice(0, 4) !== state.applied.year) return;
    state.applied = { ...state.applied, ...periodRange("week", input.value, state.applied.year) };
    syncDateControls(); render();
  });
  $("closing-month").addEventListener("change", () => {
    const input = $("closing-month");
    if (!input.value) return;
    if (!input.reportValidity() || !/^\d{4}-\d{2}$/.test(input.value) || input.value.slice(0, 4) !== state.applied.year) return;
    state.applied = { ...state.applied, ...periodRange("month", `${input.value}-01`, state.applied.year) };
    syncDateControls(); render();
  });
  document.addEventListener("click", event => { if (!event.target.closest(".rp-select")) closeSelects(); });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    const opened = [...customSelects.values()].find(custom => custom.wrapper.classList.contains("is-open"));
    if (opened) { closeSelects(); opened.button.focus(); }
  });
  function refreshFromStorage() {
    const action = activeReport();
    loadData();
    if (!state.applied || state.applied.year !== selectedYear()) {
      if (state.stage === "catalog") {
        state.applied = reportRange(state.data, selectedYear(), action);
        syncDateControls(); render(); return;
      }
      chooseReport(action, false); return;
    }
    if (state.stage !== "catalog" && isClassReport() && selectedClassId() && !chosenClass()) {
      state.pickerOpen = true; state.stage = "classes"; state.classType = "base";
      $("status").textContent = "A turma selecionada não está mais disponível. Escolha outra turma.";
    }
    render();
  }
  for (const id of ["start", "end", "weekly-date", "closing-month"]) {
    window.AlunoTecCalendar.bind({ input: $(id),
      title: ({ start: "Data inicial", end: "Data final", "weekly-date": "Semana de", "closing-month": "Mês do fechamento" })[id],
      marks: () => new Set(state.data.rows.filter(row => row.year === state.applied.year).map(row => row.date))
    });
  }
  document.addEventListener("alunotec:yearchange", refreshFromStorage);
  window.addEventListener("storage", event => {
    if (!event.key || Object.values(KEYS).includes(event.key)) refreshFromStorage();
  });
  window.addEventListener("alunotec:frequency-updated", refreshFromStorage);
  window.addEventListener("alunotec:datarestored", refreshFromStorage);
  window.addEventListener("focus", refreshFromStorage);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshFromStorage(); });
  if (typeof ResizeObserver !== "undefined") {
    let chartWidth = 0;
    new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (state.stage !== "report" || isIndividualReport() || !width || Math.abs(width - chartWidth) < 1) return;
      chartWidth = width;
      renderLine(state.rows);
    }).observe($("line-chart"));
  }
  loadData();
  root.querySelectorAll("[data-rp-select]").forEach(enhanceSelect);
  state.applied = reportRange(state.data, selectedYear(), "overview");
  syncDateControls(); render();
})();
