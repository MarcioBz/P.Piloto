/* ALUNOTEC | CENTRAL DE RELATÓRIOS
   1. Leitura e cálculos puros. 2. Exportação PDF/XLSX sem bibliotecas externas.
   3. Filtros, gráficos e tabelas da interface.
   As chaves de Turmas/Frequência são apenas lidas; este módulo não altera chamadas.
   "Sala" agrupa pela origem salva; "Sistema" agrupa pela turma da chamada. */
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
  function prepareData(rawClasses, rawCalls, rawMovements = []) {
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
    const rows = [];
    Object.entries(rawCalls && typeof rawCalls === "object" ? rawCalls : {}).forEach(([key, call]) => {
      if (!call || typeof call !== "object" || !validDate(call.date)) { ignored++; return; }
      const systemId = String(call.classId ?? `historica:${call.className || key}`);
      const systemClass = classById.get(systemId);
      const year = String(systemClass?.year || call.year || call.date.slice(0, 4));
      const students = call.students && typeof call.students === "object" ? call.students : {};
      Object.entries(students).forEach(([studentKey, entry]) => {
        if (!entry || !["presente", "ausente", "justificado"].includes(entry.status)) { ignored++; return; }
        const studentId = String(entry.studentId ?? entry.id ?? (Array.isArray(students) ? `${key}:${studentKey}` : studentKey));
        // O histórico é lido sem reaplicar remanejamentos às chamadas já salvas.
        const movement = movements.find(item => String(item?.studentId) === studentId && item.sourceClassId && item.active !== false && (!classById.has(String(item.sourceClassId)) || classById.get(String(item.sourceClassId)).year === year));
        const originalClass = sourceByStudent.get(`${year}|${studentId}`);
        const originId = String(entry.originClassId || movement?.sourceClassId || originalClass?.id || systemId);
        const originClass = classById.get(originId);
        rows.push({
          callId: String(call.id || key), date: call.date, year, shift: String(call.shift || systemClass?.shift || "Todos"),
          studentId, studentName: String(entry.studentName || entry.name || originalClass?.students.find(s => String(s.id) === studentId)?.name || "Aluno sem nome"),
          originId, originName: String(entry.originClassName || originClass?.name || movement?.sourceClassName || call.className || "Turma sem nome"),
          systemId, systemName: String(call.className || systemClass?.name || "Turma sem nome"),
          type: systemClass?.type || (call.type === "elective" || call.type === "electives" ? "electives" : "base"),
          status: entry.status,
        });
      });
    });
    return { classes, classById, rows, ignored };
  }
  function filterRows(data, filters, view = "overview") {
    return data.rows.filter(row => row.year === filters.year && row.date >= filters.start && row.date <= filters.end &&
      (!filters.shift || normalize(row.shift) === normalize(filters.shift)) &&
      (!filters.classId || (view === "room" ? row.originId : row.systemId) === filters.classId) &&
      (view !== "electives" || row.type === "electives") &&
      (view !== "room" || row.type === "base"));
  }
  function totals(rows) {
    const result = { present: 0, absent: 0, justified: 0, records: rows.length, students: new Set(rows.map(r => r.studentId)).size, calls: new Set(rows.map(r => r.callId)).size };
    rows.forEach(row => { result[row.status === "presente" ? "present" : row.status === "ausente" ? "absent" : "justified"]++; });
    result.rate = result.records ? result.present / result.records * 100 : null;
    return result;
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

  /* PDF A4 paisagem, com cabeçalhos repetidos e paginação.
     Helvetica/WinAnsi cobre os caracteres usados em nomes e textos em português. */
  function latinBytes(text) {
    const special = { "€": 128, "‚": 130, "ƒ": 131, "„": 132, "…": 133, "†": 134, "‡": 135, "ˆ": 136, "‰": 137, "Š": 138, "‹": 139, "Œ": 140, "Ž": 142, "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151, "˜": 152, "™": 153, "š": 154, "›": 155, "œ": 156, "ž": 158, "Ÿ": 159 };
    return Uint8Array.from([...String(text)].map(char => special[char] ?? (char.codePointAt(0) <= 255 ? char.codePointAt(0) : 63)));
  }
  function pdf(table, meta) {
    const escape = value => String(value ?? "").replace(/[\r\n\t]/g, " ").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    const objects = [null, '', '<< /Type /Catalog /Pages 1 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
    const pageIds = [], pageSize = 25;
    const pages = Math.max(1, Math.ceil(table.rows.length / pageSize));
    for (let page = 0; page < pages; page++) {
      const lines = [];
      const text = (value, x, y, size = 9, bold = false, color = '0.12 0.22 0.15') => lines.push(`${color} rg BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${escape(value)}) Tj ET`);
      text(meta.school || 'AlunoTec', 34, 557, 12, true, '0.09 0.38 0.17');
      text(table.title, 34, 535, 18, true);
      text(meta.filters, 34, 515, 9);
      text(meta.summary, 34, 498, 9);
      text('Frequência = presenças / registros válidos. Justificadas permanecem no denominador.', 34, 482, 8);
      const count = table.headers.length, first = count > 5 ? 174 : 220;
      const widths = [first, ...Array.from({ length: count - 1 }, () => (774 - first) / Math.max(count - 1, 1))];
      const positions = [34]; widths.slice(0, -1).forEach(width => positions.push(positions.at(-1) + width));
      lines.push('0.91 0.96 0.91 rg 34 449 774 24 re f');
      const fit = (value, width, size) => { const max = Math.max(3, Math.floor((width - 12) / (size * .56))); const text = String(value ?? '—'); return text.length > max ? `${text.slice(0, max - 3)}...` : text; };
      table.headers.forEach((heading, c) => text(fit(heading, widths[c], 8), positions[c] + 6, 458, 8, true));
      const rows = table.rows.slice(page * pageSize, (page + 1) * pageSize);
      rows.forEach((row, r) => {
        const y = 431 - r * 14;
        if (r % 2 === 0) lines.push(`0.97 0.98 0.97 rg 34 ${y - 4} 774 14 re f`);
        row.forEach((value, c) => text(fit(value, widths[c], 8), positions[c] + 6, y, 8));
      });
      if (!rows.length) text('Nenhum registro para os filtros escolhidos.', 40, 425, 10);
      text('Fonte: registros locais de Turmas, Alunos e Frequência. Textos extensos podem ser abreviados; consulte o Excel para o conteúdo completo.', 34, 45, 7);
      text(`${meta.generated}  |  Página ${page + 1} de ${pages}`, 34, 29, 8);
      const content = lines.join('\n');
      const streamId = objects.length;
      objects.push(`<< /Length ${latinBytes(content).length} >>\nstream\n${content}\nendstream`);
      const pageId = objects.length;
      objects.push(`<< /Type /Page /Parent 1 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
      pageIds.push(pageId);
    }
    objects[1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`;
    const chunks = [latinBytes('%PDF-1.4\n')], offsets = [0];
    let length = chunks[0].length;
    objects.slice(1).forEach((object, index) => { offsets.push(length); const chunk = latinBytes(`${index + 1} 0 obj\n${object}\nendobj\n`); chunks.push(chunk); length += chunk.length; });
    const xref = length;
    chunks.push(latinBytes(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length} /Root 2 0 R >>\nstartxref\n${xref}\n%%EOF`));
    return concat(chunks);
  }

  // Permite validar os cálculos e arquivos exportados sem navegador.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { prepareData, filterRows, totals, grouped, periodRange, previousRange, pdf, xlsx };
    return;
  }

  /* INTERFACE | Somente IDs e classes rp-* são controlados aqui. */
  const root = document.getElementById("rp-dashboard");
  if (!root) return;
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
  };
  const iconHTML = name => `<span class="rp-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${icons[name] || icons.file}</svg></span>`;
  root.querySelectorAll("[data-rp-icon]").forEach(element => { element.innerHTML = `<svg viewBox="0 0 24 24">${icons[element.dataset.rpIcon] || icons.file}</svg>`; });
  const viewLabels = { overview: "Visão Geral", room: "Realidade de Sala", system: "Realidade do Sistema", student: "Por Aluno", weekly: "Resumo Semanal", electives: "Eletivas" };
  const state = { view: "overview", mode: "default", studentId: "", applied: null, data: null, table: null, rows: [] };
  const customSelects = new Map();
  let syncingYear = false;

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch { state.readErrors.add(key); return fallback; }
  }
  function loadData() {
    state.readErrors = new Set();
    const savedClasses = read(KEYS.classes, {}), savedCalls = read(KEYS.calls, {});
    state.data = prepareData(savedClasses, savedCalls, read(KEYS.movements, []));
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
  function anchorForYear(year) {
    const current = today();
    const dates = state.data.rows.filter(row => row.year === year && row.date.slice(0, 4) === year && row.date <= current).map(row => row.date).sort();
    return dates.at(-1) || (year === current.slice(0, 4) ? current : `${year}-12-31`);
  }
  function fillFilters(preferredYear = "") {
    const years = [...new Set([...state.data.classes.map(item => item.year), ...state.data.rows.map(row => row.year), ...(window.AlunoTecShell?.getYears?.() || [])])].filter(year => /^\d{4}$/.test(year)).sort((a, b) => Number(b) - Number(a));
    if (!years.length) years.push(today().slice(0, 4));
    const year = String(preferredYear || $("year").value || window.AlunoTecShell?.getYear?.() || years[0]);
    setOptions($("year"), years.map(item => [item, item]), year);
    const shifts = [...new Set([...state.data.classes.filter(item => item.year === $("year").value).map(item => String(item.shift || "Todos")), ...state.data.rows.filter(row => row.year === $("year").value).map(row => row.shift)])].filter(shift => normalize(shift) !== "todos" && shift.trim()).sort(compare);
    setOptions($("shift"), [["", "Todos"], ...shifts.map(shift => [shift, shift])], $("shift").value);
    fillClassOptions();
  }
  function fillClassOptions() {
    const classes = new Map(state.data.classes.filter(item => item.year === $("year").value && (!$("shift").value || !item.shift || normalize(item.shift) === "todos" || normalize(item.shift) === normalize($("shift").value))).map(item => [item.id, item.name]));
    state.data.rows.filter(row => row.year === $("year").value).forEach(row => { if (!classes.has(row.systemId)) classes.set(row.systemId, row.systemName); if (!classes.has(row.originId)) classes.set(row.originId, row.originName); });
    setOptions($("class"), [["", "Todas as turmas"], ...[...classes.entries()].sort((a, b) => compare(a[1], b[1]))], $("class").value);
  }
  function setRange(anchor = anchorForYear($("year").value)) {
    const year = $("year").value;
    const range = periodRange($("period").value === "custom" ? "week" : $("period").value, anchor, year);
    $("start").value = range.start; $("end").value = range.end;
    [$("start"), $("end")].forEach(input => { input.min = `${year}-01-01`; input.max = `${year}-12-31`; });
  }
  function readFilters() { return { year: $("year").value, period: $("period").value, shift: $("shift").value, classId: $("class").value, start: $("start").value, end: $("end").value }; }
  function markDirty() { $("filter-feedback").textContent = "Filtros alterados. Clique em Aplicar filtros para atualizar os resultados."; $("filter-feedback").classList.add("is-dirty"); }
  function applyFilters() {
    $("end").setCustomValidity("");
    if (!$("filters").reportValidity()) return;
    const filters = readFilters();
    if (!validDate(filters.start) || !validDate(filters.end) || filters.start > filters.end) {
      $("end").setCustomValidity("A data final deve ser igual ou posterior à data inicial."); $("end").reportValidity(); return;
    }
    closeSelects(); loadData(); state.applied = filters;
    if (window.AlunoTecShell?.getYears?.().includes(filters.year) && window.AlunoTecShell.getYear() !== filters.year) {
      syncingYear = true;
      try { window.AlunoTecShell.setYears(window.AlunoTecShell.getYears(), filters.year, true); }
      finally { syncingYear = false; }
    }
    $("filter-feedback").classList.remove("is-dirty");
    render();
  }
  function studentOptions(rows) {
    const entries = new Map(rows.map(row => [row.studentId, row.studentName]));
    state.data.classes.filter(item => item.year === state.applied.year && (!state.applied.classId || item.id === state.applied.classId) && (!state.applied.shift || !item.shift || normalize(item.shift) === "todos" || normalize(item.shift) === normalize(state.applied.shift))).forEach(item => item.students.forEach(student => {
      if (student?.id != null && !entries.has(String(student.id))) entries.set(String(student.id), String(student.name || "Aluno sem nome"));
    }));
    return [...entries.entries()].sort((a, b) => compare(a[1], b[1]));
  }
  function currentRows() {
    let rows = filterRows(state.data, state.applied, state.view);
    if (state.view === "student" && state.mode !== "absences") {
      const options = studentOptions(rows);
      if (!options.some(([id]) => id === state.studentId)) state.studentId = options[0]?.[0] || "";
      setOptions($("student"), options.length ? options : [["", "Nenhum aluno disponível"]], state.studentId);
      rows = rows.filter(row => row.studentId === state.studentId);
    }
    return rows;
  }
  function setView(view, mode = "default", scroll = false) {
    state.view = view; state.mode = mode;
    root.querySelectorAll("[data-view]").forEach(button => { const active = button.dataset.view === view; button.classList.toggle("is-active", active); button.setAttribute("aria-selected", String(active)); button.tabIndex = active ? 0 : -1; });
    $("view").setAttribute("aria-labelledby", `rp-tab-${view}`);
    closeSelects(); render();
    if (scroll) $("view").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }
  function scopedActiveElectives() {
    const filters = state.applied;
    return state.data.classes.filter(item => item.type === "electives" && item.year === filters.year && item.status !== "Inativo" && (!filters.classId || item.id === filters.classId) && (!filters.shift || !item.shift || normalize(item.shift) === "todos" || normalize(item.shift) === normalize(filters.shift)));
  }
  function changeNote(current, previous, name, unit = "") {
    if (current == null || previous == null) return `${name}: sem base no período anterior`;
    const difference = current - previous;
    return `${difference > 0 ? "+" : ""}${difference.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${unit} em relação ao período anterior`;
  }
  function renderMetrics(rows) {
    const summary = totals(rows), previousFilters = previousRange(state.applied);
    let previous = filterRows(state.data, previousFilters, state.view);
    if (state.view === "student" && state.mode !== "absences") previous = previous.filter(row => row.studentId === state.studentId);
    const before = totals(previous);
    $("rate").textContent = percent(summary.rate);
    $("rate-note").textContent = changeNote(summary.rate, before.rate, "Comparação", " p.p.");
    $("students").textContent = integer(summary.students);
    $("classes").textContent = integer(new Set(rows.map(row => state.view === "room" ? row.originId : row.systemId)).size);
    $("absences").textContent = integer(summary.absent);
    $("absences-note").textContent = previous.length ? changeNote(summary.absent, before.absent, "Faltas") : "Sem chamadas no período anterior";
    $("electives").textContent = integer(scopedActiveElectives().length);
    $("donut-rate").textContent = percent(summary.rate);
    const fraction = key => summary.records ? summary[key] / summary.records * 100 : 0;
    const present = fraction("present"), absent = fraction("absent");
    $("donut").style.background = summary.records ? `conic-gradient(#176c32 0 ${present}%, #e34e58 ${present}% ${present + absent}%, #a8b3a8 ${present + absent}% 100%)` : "#edf1ed";
    $("donut").setAttribute("role", "img"); $("donut").setAttribute("aria-label", `${summary.records} registros: ${summary.present} presenças, ${summary.absent} faltas e ${summary.justified} justificadas.`);
    $("legend").innerHTML = [["present", "Presenças", "#176c32"], ["absent", "Faltas", "#e34e58"], ["justified", "Justificadas", "#a8b3a8"]].map(([key, label, color]) => `<li style="--legend-color:${color}"><strong>${label}</strong>${integer(summary[key])} (${summary.records ? percent(fraction(key)) : "—"})</li>`).join("");
    const day = rows.map(row => row.date).sort().at(-1), daySummary = totals(rows.filter(row => row.date === day));
    $("day-date").textContent = day ? `Último dia com chamada no filtro: ${br(day)}` : "Nenhuma chamada nos filtros aplicados";
    $("day-values").innerHTML = [["users", "Presentes", integer(daySummary.present)], ["close", "Faltas", integer(daySummary.absent)], ["list", "Justificadas", integer(daySummary.justified)], ["check", "Frequência", percent(daySummary.rate)]].map(([icon, label, value]) => `<div class="rp-day-stat">${iconHTML(icon)}<small>${label}</small><strong>${value}</strong></div>`).join("");
  }
  function renderLine(rows) {
    const f = state.applied;
    $("chart-period").textContent = `${br(f.start)} a ${br(f.end)} · dias sem chamada ficam sem percentual`;
    if (!rows.length) { $("line-chart").innerHTML = '<div class="rp-chart-empty">O gráfico aparecerá quando houver chamadas neste período.</div>'; return; }
    const duration = (dateObject(f.end) - dateObject(f.start)) / 86400000;
    const keyFor = date => duration > 62 ? date.slice(0, 7) : duration > 14 ? monday(date) : date;
    const groups = new Map(grouped(rows, row => keyFor(row.date), row => row.date).map(item => [item.key, item]));
    const keys = [];
    for (let date = f.start; date <= f.end; date = addDays(date, 1)) { const key = keyFor(date); if (keys.at(-1) !== key) keys.push(key); }
    const width = 460, height = 190, left = 39, right = 425, top = 20, bottom = 152;
    const points = keys.map((key, index) => ({ key, x: keys.length === 1 ? (left + right) / 2 : left + index / (keys.length - 1) * (right - left), y: groups.has(key) ? bottom - groups.get(key).rate / 100 * (bottom - top) : null, rate: groups.get(key)?.rate }));
    const segments = []; let segment = [];
    points.forEach(point => { if (point.y == null) { if (segment.length) segments.push(segment); segment = []; } else segment.push(point); });
    if (segment.length) segments.push(segment);
    const path = segment => segment.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const grid = [0, 25, 50, 75, 100].map(value => { const y = bottom - value / 100 * (bottom - top); return `<path d="M${left} ${y}H${right}" stroke="#edf1ec" stroke-width="1"/><text x="${left - 7}" y="${y + 4}" fill="#849185" text-anchor="end" font-size="10">${value}%</text>`; }).join("");
    const areas = segments.filter(s => s.length > 1).map(s => `<path d="${path(s)} L${s.at(-1).x},${bottom} L${s[0].x},${bottom}Z" fill="url(#rp-area-fill)"/><path d="${path(s)}" fill="none" stroke="#299347" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
    const dots = points.filter(point => point.y != null).map(point => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#fff" stroke="#299347" stroke-width="2.5"><title>${escapeHTML(point.key)}: ${percent(point.rate)}</title></circle>${keys.length <= 8 ? `<text x="${point.x}" y="${point.y - 10}" text-anchor="middle" fill="#275c35" font-size="10" font-weight="650">${percent(point.rate)}</text>` : ""}`).join("");
    const labels = points.filter((_, index) => index % Math.ceil(keys.length / 7) === 0 || index === keys.length - 1).map(point => `<text x="${point.x}" y="177" text-anchor="middle" fill="#78877b" font-size="10">${escapeHTML(duration > 62 ? new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(dateObject(`${point.key}-01`)) : br(point.key).slice(0, 5))}</text>`).join("");
    const description = points.filter(point => point.y != null).map(point => `${point.key}: ${percent(point.rate)}`).join("; ");
    $("line-chart").innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="rp-chart-title rp-chart-desc"><title id="rp-chart-title">Evolução da frequência</title><desc id="rp-chart-desc">${escapeHTML(description)}</desc><defs><linearGradient id="rp-area-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#8ae59a" stop-opacity=".45"/><stop offset="100%" stop-color="#e9f9eb" stop-opacity=".7"/></linearGradient></defs>${grid}${areas}${dots}${labels}</svg>`;
  }

  /* TABELAS | Todas as visões usam as mesmas linhas filtradas dos indicadores. */
  function makeTable(rows) {
    const headers = ["Turma", "Chamadas", "Alunos", "Presenças", "Faltas", "Justificadas", "Frequência"];
    const f = state.applied;
    let result = { title: "Resumo por turma", headers, rows: [], rateIndex: 6, note: "Alunos são contados por identificador em cada grupo. Um aluno pode aparecer em mais de uma turma; o indicador geral conta cada identificador uma vez." };
    if (state.mode === "absences") {
      const students = grouped(rows, row => row.studentId, row => row.studentName).filter(item => item.absent > 0).sort((a, b) => b.absent - a.absent || compare(a.name, b.name));
      return { title: "Alunos com maior ausência", headers: ["Aluno", "Registros", "Presenças", "Faltas", "Dias com falta", "Justificadas", "Frequência"], rows: students.map(item => [item.name, item.records, item.present, item.absent, new Set(item.rows.filter(row => row.status === "ausente").map(row => row.date)).size, item.justified, percent(item.rate)]), rateIndex: 6, note: "Ordenado por registros de ausência. Dias com falta contam datas distintas; faltas em dois turnos do mesmo dia contam como um dia nessa coluna." };
    }
    if (state.view === "student") {
      const name = $("student").options[$("student").selectedIndex]?.textContent;
      return { title: name ? `Relatório individual · ${name}` : "Relatório individual do aluno", headers: ["Data", "Turma de origem", "Turma da chamada", "Turno", "Situação"], rows: [...rows].sort((a, b) => b.date.localeCompare(a.date) || compare(a.systemName, b.systemName)).map(row => [br(row.date), row.originName, row.systemName, row.shift, { presente: "Presente", ausente: "Falta", justificado: "Justificada" }[row.status]]), rateIndex: -1, note: "O histórico mostra os dados salvos em cada chamada. Remanejamentos atuais não reescrevem a turma das chamadas anteriores." };
    }
    if (state.view === "electives") {
      const groups = new Map(grouped(rows, row => row.systemId, row => row.systemName).map(item => [item.key, item]));
      scopedActiveElectives().forEach(item => { if (!groups.has(item.id)) groups.set(item.id, { key: item.id, name: item.name, ...totals([]) }); });
      return { title: "Acompanhamento das eletivas", headers: ["Eletiva", "Alunos cadastrados", "Chamadas", "Presenças", "Faltas", "Justificadas", "Frequência"], rows: [...groups.values()].sort((a, b) => compare(a.name, b.name)).map(item => [item.name, new Set((state.data.classById.get(item.key)?.students || []).filter(student => student.id != null && student.status !== "Inativo").map(student => String(student.id))).size, item.calls, item.present, item.absent, item.justified, percent(item.rate)]), rateIndex: 6, note: "Eletivas sem chamada aparecem com frequência —. A aba Frequência atual registra chamadas das turmas da Base Comum; cadastros de eletiva, por si só, não geram presença ou falta." };
    }
    if (state.view === "weekly" || ["monthly", "period"].includes(state.mode)) {
      const weekly = state.view === "weekly", monthly = state.mode === "monthly";
      const groups = grouped(rows, row => weekly ? monday(row.date) : monthly ? row.date.slice(0, 7) : row.date, row => row.date).sort((a, b) => a.key.localeCompare(b.key));
      const label = item => weekly ? `${br(item.key)} a ${br(addDays(item.key, 6))}` : monthly ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(dateObject(`${item.key}-01`)) : br(item.key);
      return { ...result, title: weekly ? "Resumo semanal das turmas" : monthly ? "Evolução mensal da frequência" : "Frequência por período", headers: [weekly ? "Semana (seg–dom)" : monthly ? "Mês" : "Data", ...headers.slice(1)], rows: groups.map(item => [label(item), item.calls, item.students, item.present, item.absent, item.justified, percent(item.rate)]), note: "Cada linha considera somente chamadas dentro das datas aplicadas. Semanas podem estar parcialmente cobertas pelo filtro." };
    }
    const room = state.view === "room";
    const groups = grouped(rows, row => room ? row.originId : row.systemId, row => room ? row.originName : row.systemName);
    groups.sort(state.mode === "comparison" ? (a, b) => (b.rate ?? -1) - (a.rate ?? -1) || compare(a.name, b.name) : (a, b) => compare(a.name, b.name));
    result.rows = groups.map(item => [item.name, item.calls, item.students, item.present, item.absent, item.justified, percent(item.rate)]);
    if (room) {
      result.title = "Relatório por turma de sala";
      result.headers = ["Turma de origem", ...headers.slice(1)];
      result.note = "Agrupado pela turma de origem registrada na chamada. Um aluno remanejado permanece associado à sua origem nesta visão. Quando o campo histórico falta, é usado o cadastro/histórico disponível.";
    } else if (state.view === "system") {
      result.title = state.mode === "comparison" ? "Comparativo entre turmas" : "Relatório por turma do sistema";
      result.headers = ["Turma da chamada", ...headers.slice(1)];
      result.note = "Agrupado pela turma onde a chamada foi salva, incluindo alunos remanejados. Os registros não são redistribuídos usando a matrícula atual.";
    } else if (state.mode === "closing") result.title = "Fechamento mensal da escola";
    return result;
  }
  function renderTable(rows) {
    const table = makeTable(rows); state.table = table;
    $("result-title").textContent = table.title;
    $("table-caption").textContent = table.title;
    $("result-eyebrow").textContent = viewLabels[state.view].toLocaleUpperCase("pt-BR");
    $("result-description").textContent = `${br(state.applied.start)} a ${br(state.applied.end)} · ${integer(totals(rows).calls)} chamada(s) · ${integer(rows.length)} registro(s)`;
    $("result-count").textContent = `${integer(table.rows.length)} ${state.view === "student" && state.mode !== "absences" ? "registro(s)" : "resultado(s)"}`;
    $("table-head").innerHTML = `<tr>${table.headers.map(heading => `<th scope="col">${escapeHTML(heading)}</th>`).join("")}</tr>`;
    $("table-body").replaceChildren(...table.rows.map(values => {
      const row = document.createElement("tr");
      values.forEach((value, index) => {
        const cell = document.createElement("td");
        if (index === table.rateIndex && value !== "—") {
          const badge = document.createElement("span"); badge.className = `rp-rate${Number(String(value).replace("%", "").replace(",", ".")) < 75 ? " is-low" : ""}`; badge.textContent = value; cell.append(badge);
        } else cell.textContent = String(value ?? "—");
        row.append(cell);
      });
      return row;
    }));
    $("empty").hidden = table.rows.length > 0;
    $("empty").querySelector("h3").textContent = state.mode === "absences" && rows.length ? "Nenhuma falta registrada no período" : "Nenhuma chamada neste período";
    $("empty").querySelector("p").textContent = state.mode === "absences" && rows.length ? "Não há alunos com registros de ausência nos filtros aplicados." : "Registre a frequência das turmas ou ajuste os filtros para consultar outro período.";
    $("empty").previousElementSibling.hidden = !table.rows.length;
    $("result-note").textContent = table.note;
    const individual = state.view === "student" && state.mode !== "absences";
    $("student-field").hidden = !individual;
    $("student-summary").hidden = !individual;
    if (individual) {
      const total = totals(rows), dates = new Set(rows.filter(row => row.status === "ausente").map(row => row.date));
      $("student-summary").innerHTML = `<div>Frequência<strong>${percent(total.rate)}</strong></div><div>Presenças<strong>${integer(total.present)}</strong></div><div>Faltas<strong>${integer(total.absent)}</strong></div><div>Dias com falta<strong>${integer(dates.size)}</strong></div><div>Justificadas<strong>${integer(total.justified)}</strong></div>`;
    }
    [$("pdf"), $("excel"), $("print-button")].forEach(button => { button.disabled = !table.rows.length; button.title = table.rows.length ? "Exportar relatório aplicado" : "Não há resultados para exportar"; });
  }
  function render() {
    if (!state.applied) return;
    state.rows = currentRows();
    renderMetrics(state.rows); renderLine(state.rows); renderTable(state.rows);
    if (!$("filter-feedback").classList.contains("is-dirty")) $("filter-feedback").textContent = `Aplicado: ${br(state.applied.start)} a ${br(state.applied.end)} · ano letivo ${state.applied.year}.`;
  }

  /* EXPORTAÇÕES DA INTERFACE | Capturam o relatório aplicado, nunca campos pendentes. */
  function metadata() {
    const f = state.applied, summary = totals(state.rows);
    const classItem = state.data.classById.get(f.classId);
    const recordClass = state.data.rows.find(row => row.systemId === f.classId || row.originId === f.classId);
    const classLabel = classItem?.name || (recordClass?.systemId === f.classId ? recordClass?.systemName : recordClass?.originName) || "Todas as turmas";
    return { school: state.institution?.schoolName || "AlunoTec · Central de Relatórios", filters: `Ano letivo ${f.year} | ${br(f.start)} a ${br(f.end)} | Turno: ${f.shift || "Todos"} | Turma: ${classLabel}`, summary: `${summary.calls} chamada(s) | ${summary.students} aluno(s) | Presenças: ${summary.present} | Faltas: ${summary.absent} | Justificadas: ${summary.justified} | Frequência: ${percent(summary.rate)}`, generated: `Gerado em ${new Date().toLocaleString("pt-BR")}` };
  }
  function download(bytes, type, extension) {
    const link = document.createElement("a"), url = URL.createObjectURL(new Blob([bytes], { type }));
    link.href = url; link.download = `alunotec-${state.view}-${state.applied.start}-${state.applied.end}.${extension}`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function buildPrint() {
    const meta = metadata(), table = state.table;
    $("print").innerHTML = `<header><p>${escapeHTML(meta.school)}</p><h1>${escapeHTML(table.title)}</h1><p>${escapeHTML(meta.filters)}</p><p>${escapeHTML(meta.summary)}</p><p>${escapeHTML(meta.generated)}</p></header><table><thead><tr>${table.headers.map(value => `<th>${escapeHTML(value)}</th>`).join("")}</tr></thead><tbody>${table.rows.map(row => `<tr>${row.map(value => `<td>${escapeHTML(value)}</td>`).join("")}</tr>`).join("")}</tbody></table><p>${escapeHTML(table.note)}</p><p>Frequência = presenças ÷ (presenças + faltas + justificadas). Fonte: registros locais do AlunoTec.</p>`;
  }
  $("pdf").addEventListener("click", () => {
    download(pdf(state.table, metadata()), "application/pdf", "pdf");
    $("status").textContent = "PDF do relatório aplicado gerado.";
  });
  $("excel").addEventListener("click", () => {
    const meta = metadata();
    const records = [...state.rows].sort((a, b) => a.date.localeCompare(b.date) || compare(a.studentName, b.studentName)).map(row => [row.date, row.year, row.studentId, row.studentName, row.originName, row.systemName, row.shift, { presente: "Presente", ausente: "Falta", justificado: "Justificada" }[row.status]]);
    const sheets = [
      { name: "Resumo", rows: [state.table.headers, ...state.table.rows] },
      { name: "Registros", rows: [["Data", "Ano letivo", "ID do aluno", "Aluno", "Turma de origem", "Turma da chamada", "Turno", "Situação"], ...records] },
      { name: "Critérios", rows: [["Campo", "Valor"], ["Escola", meta.school], ["Relatório", state.table.title], ["Filtros", meta.filters], ["Resumo", meta.summary], ["Geração", meta.generated], ["Critério", "Presenças / (presenças + faltas + justificadas). Um registro por aluno/chamada."], ["Observação", state.table.note]] },
    ];
    download(xlsx(sheets), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx");
    $("status").textContent = "Excel gerado com resumo, registros e critérios aplicados.";
  });
  $("print-button").addEventListener("click", () => { buildPrint(); window.print(); });
  window.addEventListener("beforeprint", () => { if (state.table) buildPrint(); });

  /* EVENTOS | Sincronização com o ano do topbar e dados de outras abas. */
  $("filters").addEventListener("submit", event => { event.preventDefault(); applyFilters(); });
  $("year").addEventListener("change", () => { fillFilters($("year").value); setRange(); markDirty(); });
  $("period").addEventListener("change", () => { if ($("period").value !== "custom") setRange($("end").value || anchorForYear($("year").value)); markDirty(); });
  $("shift").addEventListener("change", () => { fillClassOptions(); markDirty(); });
  $("class").addEventListener("change", markDirty);
  [$("start"), $("end")].forEach(input => input.addEventListener("input", () => { $("end").setCustomValidity(""); $("period").value = "custom"; refreshSelect($("period")); markDirty(); }));
  $("student").addEventListener("change", () => { state.studentId = $("student").value; render(); });
  root.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
  root.querySelector(".rp-tabs").addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...root.querySelectorAll("[data-view]")], index = tabs.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus(); setView(tabs[next].dataset.view);
  });
  root.querySelectorAll("[data-report]").forEach(button => button.addEventListener("click", () => {
    const action = button.dataset.report;
    if (action === "closing" || action === "monthly") {
      $("year").value = state.applied.year; $("period").value = action === "closing" ? "month" : "year";
      refreshSelect($("period")); setRange(state.applied.end); applyFilters(); setView("overview", action, true); return;
    }
    if (action === "comparison") return setView("system", "comparison", true);
    if (action === "absences") return setView("student", "absences", true);
    if (action === "period") return setView("overview", "period", true);
    setView(action, "default", true);
  }));
  document.addEventListener("click", event => { if (!event.target.closest(".rp-select")) closeSelects(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape") { const opened = [...customSelects.values()].find(custom => custom.wrapper.classList.contains("is-open")); if (opened) { closeSelects(); opened.button.focus(); } } });
  document.addEventListener("alunotec:yearchange", event => {
    if (syncingYear) return;
    loadData(); fillFilters(String(event.detail?.year || window.AlunoTecShell?.getYear?.() || "")); setRange(); applyFilters();
  });
  function refreshFromStorage() {
    const applied = state.applied;
    const pendingYear = $("year").value;
    loadData(); fillFilters(pendingYear || applied?.year);
    if (applied) { state.applied = applied; render(); }
  }
  window.addEventListener("storage", event => {
    if (event.key === KEYS.year) {
      loadData(); fillFilters(event.newValue || window.AlunoTecShell?.getYear?.()); setRange(); applyFilters();
    } else if (!event.key || Object.values(KEYS).includes(event.key)) refreshFromStorage();
  });
  window.addEventListener("alunotec:frequency-updated", refreshFromStorage);
  window.addEventListener("focus", refreshFromStorage);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshFromStorage(); });
  loadData(); fillFilters();
  root.querySelectorAll("[data-rp-select]").forEach(enhanceSelect);
  setRange(); applyFilters();
})();