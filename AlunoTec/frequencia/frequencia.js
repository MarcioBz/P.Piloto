(() => {
  "use strict";

  const KEYS = {
    classes: "alunotec_turmas_v2",
    year: "alunotecSchoolYear",
    remaps: "alunotec_alunos_remanejamentos_v1",
    attendance: "alunotec_frequencia_v1",
    alerts: "alunotec_frequencia_alertas_v1",
    activities: "alunotec_turmas_activity_v1",
    dismissedAlerts: "alunotec_frequencia_alertas_ocultos_v1",
  };

  const $ = (id) => document.getElementById(id);
  let classes = [],
    roster = [],
    draft = {},
    toastTimer,
    attachmentUrl = null;
  let calendarMonth = new Date();
  const editingRows = new Set();
  const dirtyRows = new Set();
  const collator = new Intl.Collator("pt-BR", {
    sensitivity: "base",
    numeric: true,
  });

  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const write = (key, value) =>
    localStorage.setItem(key, JSON.stringify(value));
  const uid = () =>
    `freq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const normalize = (value) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const isoDate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const today = () => isoDate(new Date());

  function dateBR(value) {
    if (!value) return "";
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  function toast(message) {
    $("toast").textContent = message;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2800);
  }

  function calls() {
    const data = read(KEYS.attendance, {});
    return data && typeof data === "object" ? data : {};
  }
  function loadClasses() {
    const data = read(KEYS.classes, {});
    return (Array.isArray(data?.base) ? data.base : [])
      .filter((c) => c && c.id != null && c.status !== "Inativo")
      .map((c) => ({
        ...c,
        id: String(c.id),
        students: Array.isArray(c.students) ? c.students : [],
      }));
  }
  function flattenRemaps() {
    const raw = read(KEYS.remaps, []);
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== "object") return [];
    for (const key of [
      "movements",
      "remanejamentos",
      "historico",
      "history",
      "items",
      "data",
    ]) {
      if (Array.isArray(raw[key])) return raw[key];
    }
    return Object.values(raw).flatMap((value) =>
      Array.isArray(value)
        ? value
        : value && typeof value === "object"
          ? [value]
          : [],
    );
  }
  function movementDateKey(value) {
    const raw = String(value ?? "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const part = (type) =>
      parts.find((item) => item.type === type)?.value || "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  }
  function movementFields(item) {
    return {
      studentId: String(
        item.studentId ?? item.alunoId ?? item.idAluno ?? item.student_id ?? "",
      ),
      destinationId: String(
        item.destinationClassId ??
          item.toClassId ??
          item.turmaDestinoId ??
          item.destinoId ??
          item.classToId ??
          "",
      ),
      date: movementDateKey(
        item.date ??
          item.data ??
          item.movedAt ??
          item.createdAt ??
          item.dataRemanejamento ??
          "0000-00-00",
      ),
      cancelled: item.status === "Cancelado",
    };
  }
  function effectiveClassFor(student, source, date) {
    const direct =
      student.frequencyClassId ??
      student.attendanceClassId ??
      student.turmaFrequenciaId;
    if (direct) return String(direct);
    let destination = source.id;
    flattenRemaps()
      .map(movementFields)
      .filter(
        (item) =>
          item.studentId === String(student.id) &&
          item.destinationId &&
          !item.cancelled &&
          item.date <= date,
      )
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((item) => {
        destination = item.destinationId;
      });
    return String(destination);
  }

  function setupCustomSelect(select) {
    if (select.dataset.customReady) return;
    select.dataset.customReady = "true";
    const wrap = document.createElement("div");
    wrap.className = "custom-select native-hidden";
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "custom-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = `<span class="select-label"></span><svg class="select-chevron" aria-hidden="true"><use href="#i-chevron-down"></use></svg>`;

    const menu = document.createElement("div");
    menu.className = "custom-select-menu";
    menu.hidden = true;
    menu.setAttribute("role", "listbox");
    wrap.append(trigger, menu);

    trigger.addEventListener("click", () => {
      const open = wrap.classList.toggle("open");
      menu.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
    });
    menu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-value]");
      if (!option) return;
      select.value = option.dataset.value;
      menu.hidden = true;
      wrap.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      refreshCustomSelect(select);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    select.addEventListener("change", () => refreshCustomSelect(select));
    refreshCustomSelect(select);
  }

  function refreshCustomSelect(select) {
    if (!select?.dataset.customReady) return;
    const wrap = select.parentElement;
    const trigger = wrap.querySelector(".custom-select-trigger");
    const menu = wrap.querySelector(".custom-select-menu");
    trigger.querySelector(".select-label").textContent =
      select.options[select.selectedIndex]?.textContent || "Selecione";
    menu.innerHTML = [...select.options]
      .map(
        (option) =>
          `<button type="button" role="option" aria-selected="${option.selected}" class="custom-select-option ${option.selected ? "selected" : ""}" data-value="${esc(option.value)}">${esc(option.textContent)}</button>`,
      )
      .join("");
  }

  function populateYears() {
    classes = loadClasses();
    const years = [
      ...new Set(
        classes.map((c) => String(c.year || new Date().getFullYear())),
      ),
    ].sort();
    let selected = localStorage.getItem(KEYS.year);
    if (!years.includes(selected))
      selected = years.at(-1) || String(new Date().getFullYear());
    localStorage.setItem(KEYS.year, selected);
    $("selectedYear").textContent = selected;
    $("footerYear").textContent = selected;
    $("yearMenu").innerHTML = (years.length ? years : [selected])
      .map(
        (year) =>
          `<button class="year-option ${year === selected ? "selected" : ""}" type="button" data-year="${esc(year)}">${esc(year)}</button>`,
      )
      .join("");

    const previous = $("classSelect").value;
    const options = classes
      .filter((c) => String(c.year || "") === selected)
      .sort((a, b) => collator.compare(a.name || "", b.name || ""));
    $("classSelect").innerHTML =
      `<option value="">Selecione uma turma</option>` +
      options
        .map(
          (c) =>
            `<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.grade || "")}</option>`,
        )
        .join("");
    if (options.some((c) => c.id === previous))
      $("classSelect").value = previous;
    refreshCustomSelect($("classSelect"));
  }

  function selectedClass() {
    return classes.find((c) => c.id === $("classSelect").value);
  }
  function callId(classId, date, shift) {
    return `${localStorage.getItem(KEYS.year)}|${classId}|${date}|${shift || "Todos"}`;
  }

  function getRoster(classItem, date) {
    if (!classItem) return [];
    const students = [];
    classes.forEach((source) =>
      source.students.forEach((student) => {
        if (!student || student.status === "Inativo") return;
        if (effectiveClassFor(student, source, date) !== classItem.id) return;
        students.push({
          ...student,
          id: String(student.id),
          originClassId: source.id,
          originClassName: source.name,
          remanejado: source.id !== classItem.id,
        });
      }),
    );
    return [
      ...new Map(students.map((student) => [student.id, student])).values(),
    ].sort((a, b) => collator.compare(a.name || "", b.name || ""));
  }

  function monthlyAbsences(studentId, date) {
    const month = date.slice(0, 7);
    let absent = 0,
      justified = 0;
    Object.values(calls()).forEach((call) => {
      if (
        String(call.year) !== localStorage.getItem(KEYS.year) ||
        !call.date?.startsWith(month)
      )
        return;
      const record = call.students?.[studentId];
      if (record?.status === "ausente") absent++;
      if (record?.status === "justificado") justified++;
    });
    return { absent, justified, total: absent + justified };
  }

  function render() {
    classes = loadClasses();
    const classItem = selectedClass();
    const date = $("attendanceDate").value || today();
    const savedCall = classItem
      ? calls()[callId(classItem.id, date, $("shiftSelect").value)]
      : null;
    const previousDraft = draft;

    roster = getRoster(classItem, date);
    draft = {};
    roster.forEach((student) => {
      draft[student.id] = previousDraft[student.id]
        ? { ...previousDraft[student.id] }
        : savedCall?.students?.[student.id]
          ? { ...savedCall.students[student.id] }
          : { status: "" };
    });

    if (!classItem || !roster.length) {
      $("studentsTable").innerHTML =
        `<tr><td colspan="7" class="empty-cell">${classItem ? "Não há alunos ativos nesta turma para a data selecionada." : "Selecione uma turma para iniciar a chamada."}</td></tr>`;
      $("tableSummary").textContent = classItem
        ? "0 alunos encontrados."
        : "Nenhum aluno carregado.";
      $("savedStatus").hidden = true;
      updateStats();
      return;
    }

    $("studentsTable").innerHTML = roster
      .map((student, index) => {
        const record = draft[student.id];
        const month = monthlyAbsences(student.id, date);
        const saved = Boolean(savedCall?.students?.[student.id]);
        const editing = editingRows.has(student.id);
        const dirty = dirtyRows.has(student.id);
        const origin = student.remanejado
          ? `${esc(student.originClassName)}<span class="student-sub">Remanejado de ${esc(student.originClassName)} para ${esc(classItem.name)}</span>`
          : esc(student.originClassName);
        const attachment = record.attachment
          ? `<div class="attachment-cell"><span class="attachment-info" title="${esc(record.attachment.name)}">${esc(record.attachment.name)}</span><button class="row-action view-attachment" type="button" data-view-attachment="${esc(record.attachment.id)}" data-attachment-name="${esc(record.attachment.name)}" data-attachment-type="${esc(record.attachment.type || "")}">Ver anexo</button></div>`
          : record.status === "justificado"
            ? `<span class="attachment-info">Justificada sem anexo</span>`
            : "—";

        let actions = "—";
        if (saved && editing && dirty) {
          actions = `<div class="row-actions"><button class="row-action save" type="button" data-row-action="save" data-student="${esc(student.id)}">Salvar</button><button class="row-action cancel" type="button" data-row-action="cancel" data-student="${esc(student.id)}">Cancelar</button></div>`;
        } else if (saved && editing) {
          actions = `<button class="row-action cancel" type="button" data-row-action="cancel" data-student="${esc(student.id)}">Cancelar</button>`;
        } else if (saved) {
          actions = `<button class="row-action" type="button" data-row-action="edit" data-student="${esc(student.id)}"><svg><use href="#i-edit"></use></svg>Editar</button>`;
        }

        const locked = saved && !editing ? "disabled" : "";
        return `<tr>
        <td>${index + 1}</td>
        <td><span class="student-name">${esc(student.name || "Aluno sem nome")}</span>${student.remanejado ? `<span class="student-sub">Aluno remanejado</span>` : ""}</td>
        <td>${origin}</td>
        <td><div class="status-actions">
          ${statusButton(student.id, "presente", "Presente", record.status, locked)}
          ${statusButton(student.id, "ausente", "Ausente", record.status, locked)}
          ${statusButton(student.id, "justificado", "Justificado", record.status, locked)}
        </div></td>
        <td class="absence-month">${month.total}<small>${month.absent} sem justificativa · ${month.justified} justificadas</small></td>
        <td>${attachment}</td><td>${actions}</td>
      </tr>`;
      })
      .join("");

    $("tableSummary").textContent =
      `${roster.length} aluno(s) · ${dateBR(date)}`;
    $("savedStatus").hidden = !savedCall;
    updateStats();
  }

  function statusButton(studentId, status, label, current, locked = "") {
    const icon =
      status === "presente"
        ? "i-check"
        : status === "ausente"
          ? "i-x"
          : "i-file";
    return `<button type="button" class="status-button ${current === status ? "selected" : ""}" data-status="${status}" data-student="${esc(studentId)}" ${locked}><svg><use href="#${icon}"></use></svg>${label}</button>`;
  }

  function updateStats() {
    const statuses = roster.map((student) => draft[student.id]?.status);
    const total = roster.length;
    const present = statuses.filter((value) => value === "presente").length;
    const absent = statuses.filter((value) => value === "ausente").length;
    const justified = statuses.filter(
      (value) => value === "justificado",
    ).length;
    $("totalCount").textContent = total;
    $("presentCount").textContent = present;
    $("absentCount").textContent = absent;
    $("justifiedCount").textContent = justified;
    $("attendanceRate").textContent = total
      ? `${Math.round((present / total) * 100)}%`
      : "0%";
  }

  function registeredDates() {
    const classItem = selectedClass();
    if (!classItem) return new Map();
    const selectedShift = $("shiftSelect").value || "Todos";
    const statuses = new Map();
    Object.values(calls())
      .filter(
        (call) =>
          String(call.year) === localStorage.getItem(KEYS.year) &&
          String(call.classId) === classItem.id &&
          String(call.shift || "Todos") === selectedShift,
      )
      .forEach((call) => {
        const students = getRoster(classItem, call.date);
        const complete =
          students.length > 0 &&
          students.every((student) =>
            Boolean(call.students?.[student.id]?.status),
          );
        if (complete || !statuses.has(call.date))
          statuses.set(call.date, complete ? "complete" : "partial");
      });

    const selectedDate = $("attendanceDate").value;
    if (selectedDate && selectedClass()?.id === classItem.id) {
      const students = getRoster(classItem, selectedDate);
      const hasDraft = students.some((student) =>
        Boolean(draft[student.id]?.status),
      );
      if (hasDraft && students.length) {
        statuses.set(
          selectedDate,
          students.every((student) => Boolean(draft[student.id]?.status))
            ? "complete"
            : "partial",
        );
      }
    }
    return statuses;
  }

  function drawCalendar() {
    const monthDate = calendarMonth;
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    $("calendarMonth").textContent = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(monthDate);

    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const previousDays = new Date(year, month, 0).getDate();
    const selectedDate = $("attendanceDate").value;
    const todayDate = today();
    const dateStatuses = registeredDates();
    const weekdays = ["S", "T", "Q", "Q", "S", "S", "D"];
    let html = weekdays
      .map((day) => `<span class="calendar-weekday">${day}</span>`)
      .join("");

    for (let i = 0; i < 42; i++) {
      let day,
        date,
        outside = false;
      if (i < offset) {
        day = previousDays - offset + i + 1;
        date = isoDate(new Date(year, month - 1, day));
        outside = true;
      } else if (i >= offset + daysInMonth) {
        day = i - offset - daysInMonth + 1;
        date = isoDate(new Date(year, month + 1, day));
        outside = true;
      } else {
        day = i - offset + 1;
        date = isoDate(new Date(year, month, day));
      }

      const dayClasses = [
        "calendar-day",
        outside ? "outside" : "",
        dateStatuses.get(date) === "complete"
          ? "registered"
          : dateStatuses.get(date) === "partial"
            ? "partial"
            : "",
        date === todayDate ? "today" : "",
        date === selectedDate ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      html += `<button type="button" class="${dayClasses}" data-date="${date}" aria-label="${dateBR(date)}">${day}</button>`;
    }
    $("calendarGrid").innerHTML = html;
  }

  function addActivity(message) {
    const activities = read(KEYS.activities, []);
    activities.unshift({
      id: uid(),
      message,
      date: new Date().toISOString(),
      read: false,
      source: "frequencia",
    });
    write(KEYS.activities, activities.slice(0, 100));
  }

  function weekStart(value) {
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return isoDate(date);
  }

  function calculateAlerts() {
    const grouped = new Map();
    Object.values(calls())
      .filter((call) => String(call.year) === localStorage.getItem(KEYS.year))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .forEach((call) =>
        Object.entries(call.students || {}).forEach(([id, record]) => {
          if (!grouped.has(id)) grouped.set(id, []);
          grouped.get(id).push({
            date: call.date,
            status: record.status,
            name: record.studentName,
            className: record.currentClassName || call.className,
          });
        }),
      );

    const alerts = [];
    grouped.forEach((entries, studentId) => {
      entries.sort((a, b) => a.date.localeCompare(b.date));
      for (let i = 1; i < entries.length; i++) {
        if (
          entries[i - 1].status === "ausente" &&
          entries[i].status === "ausente"
        ) {
          const last = entries[i];
          alerts.push({
            signature: `${studentId}|consecutivas|${last.date}`,
            message: `${last.name || "Aluno"} teve duas faltas consecutivas sem justificativa em ${last.className || "sua turma"}.`,
            date: last.date,
          });
        }
      }

      const weeks = new Map();
      entries
        .filter((item) => item.status === "ausente")
        .forEach((item) => {
          const start = weekStart(item.date);
          if (!weeks.has(start)) weeks.set(start, []);
          weeks.get(start).push(item);
        });
      weeks.forEach((weekEntries, start) => {
        if (weekEntries.length >= 3) {
          const last = weekEntries.at(-1);
          alerts.push({
            signature: `${studentId}|semanal|${start}`,
            message: `${last.name || "Aluno"} teve ${weekEntries.length} faltas sem justificativa na semana em ${last.className || "sua turma"}.`,
            date: last.date,
          });
        }
      });
    });
    return alerts;
  }

  function refreshAlerts() {
    const previous = new Map(
      read(KEYS.alerts, []).map((alert) => [alert.signature, alert]),
    );
    const dismissed = new Set(read(KEYS.dismissedAlerts, []));
    const active = calculateAlerts()
      .filter((alert) => !dismissed.has(alert.signature))
      .map(
        (alert) =>
          previous.get(alert.signature) || {
            id: uid(),
            ...alert,
            read: false,
            active: true,
            createdAt: new Date().toISOString(),
          },
      );
    write(KEYS.alerts, active);
    updateBell();
  }

  function updateBell() {
    const unread = read(KEYS.alerts, []).filter(
      (alert) => alert.active !== false && !alert.read,
    );
    $("bellCount").hidden = !unread.length;
    $("bellCount").textContent = unread.length > 99 ? "99+" : unread.length;
    $("notificationBell").classList.toggle("urgent", unread.length > 0);
  }

  function openNotifications() {
    refreshAlerts();
    const alerts = read(KEYS.alerts, [])
      .filter((alert) => alert.active !== false)
      .sort((a, b) => b.date.localeCompare(a.date));
    const activities = read(KEYS.activities, []).slice(0, 20);
    let html = `<div class="notice-section-title">Alertas de frequência</div>`;
    html += alerts.length
      ? alerts
          .map(
            (alert) =>
              `<article class="notice-item urgent"><span class="notice-dot"></span><div><p>${esc(alert.message)}</p><time>${dateBR(alert.date)}</time></div></article>`,
          )
          .join("")
      : `<div class="notice-empty">Nenhum alerta importante de frequência.</div>`;
    html += `<div class="notice-section-title">Alterações recentes</div>`;
    html += activities.length
      ? activities
          .map(
            (item) =>
              `<article class="notice-item"><span class="notice-dot" style="background:#328344"></span><div><p>${esc(item.message || "Atualização recente.")}</p><time>${new Date(item.date).toLocaleString("pt-BR")}</time></div></article>`,
          )
          .join("")
      : `<div class="notice-empty">Nenhuma alteração recente.</div>`;
    $("notificationList").innerHTML = html;
    write(
      KEYS.alerts,
      read(KEYS.alerts, []).map((alert) => ({ ...alert, read: true })),
    );
    write(
      KEYS.activities,
      activities.map((item) => ({ ...item, read: true })),
    );
    updateBell();
    $("notificationDialog").showModal();
  }

  function clearNotifications() {
    const alerts = read(KEYS.alerts, []);
    const dismissed = new Set(read(KEYS.dismissedAlerts, []));
    alerts.forEach((alert) => {
      if (alert.signature) dismissed.add(alert.signature);
    });
    calculateAlerts().forEach((alert) => dismissed.add(alert.signature));
    write(KEYS.dismissedAlerts, [...dismissed]);
    write(KEYS.alerts, []);
    write(KEYS.activities, []);
    $("notificationList").innerHTML =
      `<div class="notice-empty">Nenhuma notificação por enquanto.</div>`;
    updateBell();
    toast("Notificações limpas.");
  }

  function resetForFilterChange() {
    editingRows.clear();
    dirtyRows.clear();
    draft = {};
    render();
  }

  function storeAttachment(id, file) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("alunotec-anexos-frequencia", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("atestados");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("atestados", "readwrite");
        tx.objectStore("atestados").put(file, id);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  }

  function retrieveAttachment(id) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("alunotec-anexos-frequencia", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("atestados")) {
          db.close();
          return reject(new Error("Armazenamento de anexos não encontrado."));
        }
        const tx = db.transaction("atestados", "readonly");
        const getRequest = tx.objectStore("atestados").get(id);
        getRequest.onsuccess = () => {
          const file = getRequest.result;
          db.close();
          resolve(file);
        };
        getRequest.onerror = () => {
          const error = getRequest.error;
          db.close();
          reject(error);
        };
      };
    });
  }

  async function openAttachment(button) {
    try {
      const file = await retrieveAttachment(button.dataset.viewAttachment);
      if (!file) return toast("O anexo não foi encontrado neste dispositivo.");
      if (attachmentUrl) URL.revokeObjectURL(attachmentUrl);
      attachmentUrl = URL.createObjectURL(file);
      const image = $("attachmentImage"),
        preview = $("attachmentPreview"),
        download = $("downloadAttachment");
      const type =
        file.type ||
        button.dataset.attachmentType ||
        "application/octet-stream";
      image.hidden = true;
      image.removeAttribute("src");
      preview.hidden = true;
      preview.removeAttribute("src");
      if (type.startsWith("image/")) {
        image.src = attachmentUrl;
        image.hidden = false;
      } else if (
        type === "application/pdf" ||
        button.dataset.attachmentName.toLowerCase().endsWith(".pdf")
      ) {
        preview.src = attachmentUrl;
        preview.hidden = false;
      } else {
        return toast(
          "Este tipo de anexo não pode ser visualizado. Baixe o arquivo para abri-lo.",
        );
      }
      download.href = attachmentUrl;
      download.download = button.dataset.attachmentName || "anexo";
      $("attachmentDialog").showModal();
    } catch {
      toast("Não foi possível abrir o anexo neste dispositivo.");
    }
  }

  function fillFutureCertificateDays(
    studentId,
    startDate,
    numberOfDays,
    attachment,
  ) {
    classes = loadClasses();
    const source = classes.find((item) =>
      item.students.some((student) => String(student.id) === String(studentId)),
    );
    if (!source) return 0;

    const student = source.students.find(
      (item) => String(item.id) === String(studentId),
    );
    const callsData = calls();
    const shift = $("shiftSelect").value || "Todos";
    let filled = 0;

    for (let offset = 1; offset < numberOfDays; offset++) {
      const date = new Date(`${startDate}T12:00:00`);
      date.setDate(date.getDate() + offset);
      const dateKey = isoDate(date);
      const effectiveClassId = effectiveClassFor(student, source, dateKey);
      const targetClass = classes.find((item) => item.id === effectiveClassId);
      if (!targetClass) continue;

      const key = callId(targetClass.id, dateKey, shift);
      const call = callsData[key] || {
        id: key,
        year: localStorage.getItem(KEYS.year),
        classId: targetClass.id,
        className: targetClass.name,
        date: dateKey,
        shift,
        updatedAt: new Date().toISOString(),
        students: {},
      };
      if (call.students?.[studentId]?.status) continue;

      call.students ||= {};
      call.students[studentId] = {
        status: "justificado",
        attachment,
        studentId: String(studentId),
        studentName: student.name,
        originClassId: source.id,
        originClassName: source.name,
        currentClassId: targetClass.id,
        currentClassName: targetClass.name,
        certificateStartDate: startDate,
        certificateDays: numberOfDays,
        updatedAt: new Date().toISOString(),
      };
      call.updatedAt = new Date().toISOString();
      callsData[key] = call;
      filled++;
    }

    if (filled) write(KEYS.attendance, callsData);
    return filled;
  }

  async function saveJustification() {
    const studentId = $("justificationDialog").dataset.studentId;
    const days = Number($("certificateDays").value);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return toast("Informe uma quantidade de dias entre 1 e 365.");
    }
    const startDate = $("attendanceDate").value || today();
    const file = $("certificateFile").files?.[0];
    let attachment = null;

    if (file) {
      const fileId = uid();
      try {
        await storeAttachment(fileId, file);
        attachment = {
          id: fileId,
          name: file.name,
          type: file.type,
          size: file.size,
        };
      } catch {
        return toast("Não foi possível guardar o anexo neste dispositivo.");
      }
    }

    draft[studentId] = {
      ...(draft[studentId] || {}),
      status: "justificado",
      attachment,
      certificateStartDate: startDate,
      certificateDays: days,
      updatedAt: new Date().toISOString(),
    };
    if (editingRows.has(studentId)) dirtyRows.add(studentId);
    const filled = fillFutureCertificateDays(
      studentId,
      startDate,
      days,
      attachment,
    );
    if (filled)
      addActivity(
        `Atestado de ${days} dia(s) registrado para ${draft[studentId].studentName || "aluno"}; ${filled} dia(s) futuro(s) preenchido(s).`,
      );
    $("justificationDialog").close();
    render();
    toast(
      filled
        ? `Justificativa aplicada. ${filled} dia(s) futuro(s) preenchido(s) como justificado.`
        : file
          ? "Falta justificada com atestado."
          : "Falta justificada sem anexo.",
    );
  }

  function saveStudentEdit(studentId) {
    const classItem = selectedClass();
    if (!classItem) return;
    const key = callId(
      classItem.id,
      $("attendanceDate").value,
      $("shiftSelect").value,
    );
    const data = calls();
    const call = data[key];
    if (!call?.students?.[studentId]) return;

    call.students[studentId] = {
      ...call.students[studentId],
      ...draft[studentId],
      updatedAt: new Date().toISOString(),
    };
    call.updatedAt = new Date().toISOString();
    data[key] = call;
    write(KEYS.attendance, data);
    addActivity(
      `Frequência de ${call.students[studentId].studentName || "aluno"} corrigida em ${classItem.name}, ${dateBR(call.date)}.`,
    );
    editingRows.delete(studentId);
    dirtyRows.delete(studentId);
    draft = {};
    refreshAlerts();
    render();
    toast("Alteração da frequência salva.");
    window.dispatchEvent(
      new CustomEvent("alunotec:frequency-updated", {
        detail: { date: call.date, classId: classItem.id },
      }),
    );
  }

  function saveCall() {
    const classItem = selectedClass();
    if (!classItem) return toast("Selecione uma turma.");
    if (!roster.length) return toast("Não há alunos para registrar.");
    if (roster.some((student) => !draft[student.id]?.status))
      return toast("Marque a frequência de todos os alunos antes de salvar.");

    const data = calls();
    const key = callId(
      classItem.id,
      $("attendanceDate").value,
      $("shiftSelect").value,
    );
    data[key] = {
      id: key,
      year: localStorage.getItem(KEYS.year),
      classId: classItem.id,
      className: classItem.name,
      date: $("attendanceDate").value,
      shift: $("shiftSelect").value || "Todos",
      updatedAt: new Date().toISOString(),
      students: Object.fromEntries(
        roster.map((student) => [
          student.id,
          {
            ...draft[student.id],
            studentId: student.id,
            studentName: student.name,
            originClassId: student.originClassId,
            originClassName: student.originClassName,
            currentClassId: classItem.id,
            currentClassName: classItem.name,
          },
        ]),
      ),
    };
    write(KEYS.attendance, data);
    editingRows.clear();
    dirtyRows.clear();
    draft = {};
    addActivity(
      `Chamada registrada em ${classItem.name}, ${dateBR($("attendanceDate").value)}.`,
    );
    refreshAlerts();
    render();
    $("savedStatus").hidden = false;
    toast("Chamada salva neste dispositivo.");
    window.dispatchEvent(
      new CustomEvent("alunotec:frequency-updated", {
        detail: { date: $("attendanceDate").value, classId: classItem.id },
      }),
    );
  }

  function populateYears() {
    classes = loadClasses();
    const years = [
      ...new Set(
        classes.map((c) => String(c.year || new Date().getFullYear())),
      ),
    ].sort();
    let selected = localStorage.getItem(KEYS.year);
    if (!years.includes(selected))
      selected = years.at(-1) || String(new Date().getFullYear());
    localStorage.setItem(KEYS.year, selected);
    $("selectedYear").textContent = selected;
    $("footerYear").textContent = selected;
    $("yearMenu").innerHTML = (years.length ? years : [selected])
      .map(
        (year) =>
          `<button class="year-option ${year === selected ? "selected" : ""}" type="button" data-year="${esc(year)}">${esc(year)}</button>`,
      )
      .join("");

    const previous = $("classSelect").value;
    const options = classes
      .filter((c) => String(c.year || "") === selected)
      .sort((a, b) => collator.compare(a.name || "", b.name || ""));
    $("classSelect").innerHTML =
      `<option value="">Selecione uma turma</option>` +
      options
        .map(
          (c) =>
            `<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.grade || "")}</option>`,
        )
        .join("");
    if (options.some((c) => c.id === previous))
      $("classSelect").value = previous;
    refreshCustomSelect($("classSelect"));
  }

  async function checkConnection() {
    const title = $("connectionTitle"),
      text = $("connectionText"),
      status = $("connectionStatus");
    status.classList.add("checking");
    if (!navigator.onLine) {
      title.textContent = "Offline";
      text.textContent = "Dados salvos neste dispositivo";
      status.classList.remove("checking");
      status.classList.add("offline");
      return;
    }
    title.textContent = "Verificando";
    text.textContent = "Acesso à internet…";
    try {
      await fetch("https://www.gstatic.com/generate_204", {
        mode: "no-cors",
        cache: "no-store",
        signal: AbortSignal.timeout(4500),
      });
      title.textContent = "Online";
      text.textContent = "Salvo neste dispositivo • Supabase pendente";
      status.classList.remove("offline", "checking");
    } catch {
      title.textContent = "Offline";
      text.textContent = "Dados salvos neste dispositivo";
      status.classList.remove("checking");
      status.classList.add("offline");
    }
  }

  function drawCalendar() {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    $("calendarMonth").textContent = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(calendarMonth);
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const previousDays = new Date(year, month, 0).getDate();
    const selectedDate = $("attendanceDate").value;
    const todayDate = today();
    const dateStatuses = registeredDates();
    const weekdays = ["S", "T", "Q", "Q", "S", "S", "D"];
    let html = weekdays
      .map((day) => `<span class="calendar-weekday">${day}</span>`)
      .join("");

    for (let i = 0; i < 42; i++) {
      let day,
        date,
        outside = false;
      if (i < offset) {
        day = previousDays - offset + i + 1;
        date = isoDate(new Date(year, month - 1, day));
        outside = true;
      } else if (i >= offset + daysInMonth) {
        day = i - offset - daysInMonth + 1;
        date = isoDate(new Date(year, month + 1, day));
        outside = true;
      } else {
        day = i - offset + 1;
        date = isoDate(new Date(year, month, day));
      }

      const dayClasses = [
        "calendar-day",
        outside ? "outside" : "",
        dateStatuses.get(date) === "complete"
          ? "registered"
          : dateStatuses.get(date) === "partial"
            ? "partial"
            : "",
        date === todayDate ? "today" : "",
        date === selectedDate ? "selected" : "",
      ]
        .filter(Boolean)
        .join(" ");
      html += `<button type="button" class="${dayClasses}" data-date="${date}" aria-label="${dateBR(date)}">${day}</button>`;
    }
    $("calendarGrid").innerHTML = html;
  }

  function initialize() {
    $("attendanceDate").value = today();
    $("dateDisplay").textContent = dateBR(today());
    populateYears();
    setupCustomSelect($("classSelect"));
    setupCustomSelect($("shiftSelect"));

    $("yearPickerButton").addEventListener("click", () => {
      const menu = $("yearMenu");
      menu.hidden = !menu.hidden;
      $("yearPickerButton").setAttribute("aria-expanded", String(!menu.hidden));
    });
    $("yearMenu").addEventListener("click", (event) => {
      const option = event.target.closest("[data-year]");
      if (!option) return;
      localStorage.setItem(KEYS.year, option.dataset.year);
      $("yearMenu").hidden = true;
      $("yearPickerButton").setAttribute("aria-expanded", "false");
      resetForFilterChange();
      populateYears();
      render();
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".year-picker-wrap")) {
        $("yearMenu").hidden = true;
        $("yearPickerButton").setAttribute("aria-expanded", "false");
      }
      if (!event.target.closest(".profile-wrap")) {
        $("profileMenu").hidden = true;
        $("profileButton").setAttribute("aria-expanded", "false");
      }
      document.querySelectorAll(".custom-select.open").forEach((wrap) => {
        if (!wrap.contains(event.target)) {
          wrap.classList.remove("open");
          wrap.querySelector(".custom-select-menu").hidden = true;
          wrap
            .querySelector(".custom-select-trigger")
            .setAttribute("aria-expanded", "false");
        }
      });
    });

    $("classSelect").addEventListener("change", resetForFilterChange);
    $("shiftSelect").addEventListener("change", resetForFilterChange);

    $("datePickerButton").addEventListener("click", () => {
      const current = $("attendanceDate").value
        ? new Date(`${$("attendanceDate").value}T12:00:00`)
        : new Date();
      calendarMonth = new Date(current.getFullYear(), current.getMonth(), 1);
      drawCalendar();
      $("calendarDialog").showModal();
    });
    $("calendarGrid").addEventListener("click", (event) => {
      const button = event.target.closest("[data-date]");
      if (!button) return;
      $("attendanceDate").value = button.dataset.date;
      $("dateDisplay").textContent = dateBR(button.dataset.date);
      $("calendarDialog").close();
      resetForFilterChange();
    });
    $("calendarPrev").addEventListener("click", () => {
      calendarMonth.setMonth(calendarMonth.getMonth() - 1);
      drawCalendar();
    });
    $("calendarNext").addEventListener("click", () => {
      calendarMonth.setMonth(calendarMonth.getMonth() + 1);
      drawCalendar();
    });
    $("calendarToday").addEventListener("click", () => {
      $("attendanceDate").value = today();
      $("dateDisplay").textContent = dateBR(today());
      $("calendarDialog").close();
      resetForFilterChange();
    });
    $("calendarClear").addEventListener("click", () => {
      $("attendanceDate").value = "";
      $("dateDisplay").textContent = "Selecione a data";
      $("calendarDialog").close();
      resetForFilterChange();
    });

    $("studentsTable").addEventListener("click", (event) => {
      const rowAction = event.target.closest("[data-row-action]");
      if (rowAction) {
        const id = rowAction.dataset.student;
        if (rowAction.dataset.rowAction === "edit") {
          editingRows.add(id);
          render();
        } else if (rowAction.dataset.rowAction === "save") {
          saveStudentEdit(id);
        } else if (rowAction.dataset.rowAction === "cancel") {
          const classItem = selectedClass();
          const key = callId(
            classItem.id,
            $("attendanceDate").value,
            $("shiftSelect").value,
          );
          const saved = calls()[key]?.students?.[id];
          if (saved) draft[id] = { ...saved };
          editingRows.delete(id);
          dirtyRows.delete(id);
          render();
        }
        return;
      }

      const button = event.target.closest(".status-button");
      if (!button || button.disabled) return;
      const id = button.dataset.student;
      if (button.dataset.status === "justificado") {
        $("certificateFile").value = "";
        $("certificateDays").value = "1";
        $("selectedFileName").textContent = "Nenhum arquivo selecionado";
        $("justificationDialog").dataset.studentId = id;
        $("justificationDialog").showModal();
        return;
      }
      draft[id] = {
        ...(draft[id] || {}),
        status: button.dataset.status,
        attachment: null,
        updatedAt: new Date().toISOString(),
      };
      if (editingRows.has(id)) dirtyRows.add(id);
      render();
    });

    $("markAllButton").addEventListener("click", () => {
      const remaining = roster.filter((student) => !draft[student.id]?.status);
      if (!remaining.length) return toast("Todos os alunos já estão marcados.");
      remaining.forEach((student) => {
        draft[student.id] = {
          ...(draft[student.id] || {}),
          status: "presente",
          attachment: null,
        };
      });
      render();
      toast(
        `${remaining.length} aluno(s) restante(s) marcado(s) como presente(s).`,
      );
    });

    $("saveButton").addEventListener("click", saveCall);
    $("certificateFile").addEventListener("change", (event) => {
      $("selectedFileName").textContent =
        event.target.files?.[0]?.name || "Nenhum arquivo selecionado";
    });
    $("saveJustificationButton").addEventListener("click", saveJustification);

    $("notificationBell").addEventListener("click", openNotifications);
    $("closeNotificationDialog").addEventListener("click", () =>
      $("notificationDialog").close(),
    );
    $("clearNotificationsButton").addEventListener("click", clearNotifications);
    document
      .querySelectorAll("[data-close-dialog]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          $(button.dataset.closeDialog).close(),
        ),
      );

    $("profileButton").addEventListener("click", () => {
      const menu = $("profileMenu");
      menu.hidden = !menu.hidden;
      $("profileButton").setAttribute("aria-expanded", String(!menu.hidden));
    });
    $("switchAccountButton").addEventListener("click", () => {
      window.location.href = "../index.html";
    });
    $("logoutButton").addEventListener("click", () => {
      try {
        sessionStorage.removeItem("alunotecSession");
      } catch {}
      window.location.href = "../index.html";
    });

    window.addEventListener("online", checkConnection);
    window.addEventListener("offline", checkConnection);
    window.addEventListener("storage", (event) => {
      if (
        [KEYS.classes, KEYS.remaps, KEYS.attendance, KEYS.activities].includes(
          event.key,
        )
      ) {
        editingRows.clear();
        dirtyRows.clear();
        draft = {};
        populateYears();
        render();
        refreshAlerts();
      }
    });

    refreshAlerts();
    render();
    checkConnection();
  }

  function resetForFilterChange() {
    editingRows.clear();
    dirtyRows.clear();
    draft = {};
    render();
  }

  function saveStudentEdit(studentId) {
    const classItem = selectedClass();
    if (!classItem) return;
    const key = callId(
      classItem.id,
      $("attendanceDate").value,
      $("shiftSelect").value,
    );
    const data = calls();
    const call = data[key];
    if (!call?.students?.[studentId]) return;

    call.students[studentId] = {
      ...call.students[studentId],
      ...draft[studentId],
      updatedAt: new Date().toISOString(),
    };
    call.updatedAt = new Date().toISOString();
    data[key] = call;
    write(KEYS.attendance, data);
    addActivity(
      `Frequência de ${call.students[studentId].studentName || "aluno"} corrigida em ${classItem.name}, ${dateBR(call.date)}.`,
    );
    editingRows.delete(studentId);
    dirtyRows.delete(studentId);
    draft = {};
    refreshAlerts();
    render();
    toast("Alteração da frequência salva.");
    window.dispatchEvent(
      new CustomEvent("alunotec:frequency-updated", {
        detail: { date: call.date, classId: classItem.id },
      }),
    );
  }

  function saveCall() {
    const classItem = selectedClass();
    if (!classItem) return toast("Selecione uma turma.");
    if (!roster.length) return toast("Não há alunos para registrar.");
    if (roster.some((student) => !draft[student.id]?.status))
      return toast("Marque a frequência de todos os alunos antes de salvar.");

    const data = calls();
    const key = callId(
      classItem.id,
      $("attendanceDate").value,
      $("shiftSelect").value,
    );
    data[key] = {
      id: key,
      year: localStorage.getItem(KEYS.year),
      classId: classItem.id,
      className: classItem.name,
      date: $("attendanceDate").value,
      shift: $("shiftSelect").value || "Todos",
      updatedAt: new Date().toISOString(),
      students: Object.fromEntries(
        roster.map((student) => [
          student.id,
          {
            ...draft[student.id],
            studentId: student.id,
            studentName: student.name,
            originClassId: student.originClassId,
            originClassName: student.originClassName,
            currentClassId: classItem.id,
            currentClassName: classItem.name,
          },
        ]),
      ),
    };
    write(KEYS.attendance, data);
    editingRows.clear();
    dirtyRows.clear();
    draft = {};
    addActivity(
      `Chamada registrada em ${classItem.name}, ${dateBR($("attendanceDate").value)}.`,
    );
    refreshAlerts();
    render();
    $("savedStatus").hidden = false;
    toast("Chamada salva neste dispositivo.");
    window.dispatchEvent(
      new CustomEvent("alunotec:frequency-updated", {
        detail: { date: $("attendanceDate").value, classId: classItem.id },
      }),
    );
  }

  function addActivity(message) {
    const activities = read(KEYS.activities, []);
    activities.unshift({
      id: uid(),
      message,
      date: new Date().toISOString(),
      read: false,
      source: "frequencia",
    });
    write(KEYS.activities, activities.slice(0, 100));
  }

  function refreshAlerts() {
    const previous = new Map(
      read(KEYS.alerts, []).map((alert) => [alert.signature, alert]),
    );
    const dismissed = new Set(read(KEYS.dismissedAlerts, []));
    const active = calculateAlerts()
      .filter((alert) => !dismissed.has(alert.signature))
      .map(
        (alert) =>
          previous.get(alert.signature) || {
            id: uid(),
            ...alert,
            read: false,
            active: true,
            createdAt: new Date().toISOString(),
          },
      );
    write(KEYS.alerts, active);
    updateBell();
  }

  function calculateAlerts() {
    const grouped = new Map();
    Object.values(calls())
      .filter((call) => String(call.year) === localStorage.getItem(KEYS.year))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .forEach((call) =>
        Object.entries(call.students || {}).forEach(([id, record]) => {
          if (!grouped.has(id)) grouped.set(id, []);
          grouped.get(id).push({
            date: call.date,
            status: record.status,
            name: record.studentName,
            className: record.currentClassName || call.className,
          });
        }),
      );

    const alerts = [];
    grouped.forEach((entries, studentId) => {
      entries.sort((a, b) => a.date.localeCompare(b.date));
      for (let i = 1; i < entries.length; i++) {
        if (
          entries[i - 1].status === "ausente" &&
          entries[i].status === "ausente"
        ) {
          const last = entries[i];
          alerts.push({
            signature: `${studentId}|consecutivas|${last.date}`,
            message: `${last.name || "Aluno"} teve duas faltas consecutivas sem justificativa em ${last.className || "sua turma"}.`,
            date: last.date,
          });
        }
      }
      const weeks = new Map();
      entries
        .filter((item) => item.status === "ausente")
        .forEach((item) => {
          const date = new Date(`${item.date}T12:00:00`);
          date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
          const start = isoDate(date);
          if (!weeks.has(start)) weeks.set(start, []);
          weeks.get(start).push(item);
        });
      weeks.forEach((items, start) => {
        if (items.length >= 3) {
          const last = items.at(-1);
          alerts.push({
            signature: `${studentId}|semanal|${start}`,
            message: `${last.name || "Aluno"} teve ${items.length} faltas sem justificativa na semana em ${last.className || "sua turma"}.`,
            date: last.date,
          });
        }
      });
    });
    return alerts;
  }

  function updateBell() {
    const unread = read(KEYS.alerts, []).filter(
      (alert) => alert.active !== false && !alert.read,
    );
    $("bellCount").hidden = !unread.length;
    $("bellCount").textContent = unread.length > 99 ? "99+" : unread.length;
    $("notificationBell").classList.toggle("urgent", unread.length > 0);
  }

  function openNotifications() {
    refreshAlerts();
    const alerts = read(KEYS.alerts, [])
      .filter((alert) => alert.active !== false)
      .sort((a, b) => b.date.localeCompare(a.date));
    const activities = read(KEYS.activities, []).slice(0, 20);
    let html = `<div class="notice-section-title">Alertas de frequência</div>`;
    html += alerts.length
      ? alerts
          .map(
            (alert) =>
              `<article class="notice-item urgent"><span class="notice-dot"></span><div><p>${esc(alert.message)}</p><time>${dateBR(alert.date)}</time></div></article>`,
          )
          .join("")
      : `<div class="notice-empty">Nenhum alerta importante de frequência.</div>`;
    html += `<div class="notice-section-title">Alterações recentes</div>`;
    html += activities.length
      ? activities
          .map(
            (item) =>
              `<article class="notice-item"><span class="notice-dot" style="background:#328344"></span><div><p>${esc(item.message || "Atualização recente.")}</p><time>${new Date(item.date).toLocaleString("pt-BR")}</time></div></article>`,
          )
          .join("")
      : `<div class="notice-empty">Nenhuma alteração recente.</div>`;
    $("notificationList").innerHTML = html;
    write(
      KEYS.alerts,
      read(KEYS.alerts, []).map((alert) => ({ ...alert, read: true })),
    );
    write(
      KEYS.activities,
      activities.map((item) => ({ ...item, read: true })),
    );
    updateBell();
    $("notificationDialog").showModal();
  }

  function storeAttachment(id, file) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("alunotec-anexos-frequencia", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("atestados");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("atestados", "readwrite");
        tx.objectStore("atestados").put(file, id);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
  }

  async function saveJustification() {
    const studentId = $("justificationDialog").dataset.studentId;
    const days = Number($("certificateDays").value);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return toast("Informe uma quantidade de dias entre 1 e 365.");
    }
    const startDate = $("attendanceDate").value || today();
    const file = $("certificateFile").files?.[0];
    let attachment = null;
    if (file) {
      const fileId = uid();
      try {
        await storeAttachment(fileId, file);
        attachment = {
          id: fileId,
          name: file.name,
          type: file.type,
          size: file.size,
        };
      } catch {
        return toast("Não foi possível guardar o anexo neste dispositivo.");
      }
    }
    draft[studentId] = {
      ...(draft[studentId] || {}),
      status: "justificado",
      attachment,
      certificateStartDate: startDate,
      certificateDays: days,
      updatedAt: new Date().toISOString(),
    };
    if (editingRows.has(studentId)) dirtyRows.add(studentId);
    const filled = fillFutureCertificateDays(
      studentId,
      startDate,
      days,
      attachment,
    );
    if (filled)
      addActivity(
        `Atestado de ${days} dia(s) registrado para ${draft[studentId].studentName || "aluno"}; ${filled} dia(s) futuro(s) preenchido(s).`,
      );
    $("justificationDialog").close();
    render();
    toast(
      filled
        ? `Justificativa aplicada. ${filled} dia(s) futuro(s) preenchido(s) como justificado.`
        : file
          ? "Falta justificada com atestado."
          : "Falta justificada sem anexo.",
    );
  }

  async function checkConnection() {
    const title = $("connectionTitle"),
      text = $("connectionText"),
      status = $("connectionStatus");
    status.classList.add("checking");
    if (!navigator.onLine) {
      title.textContent = "Offline";
      text.textContent = "Dados salvos neste dispositivo";
      status.classList.remove("checking");
      status.classList.add("offline");
      return;
    }
    title.textContent = "Verificando";
    text.textContent = "Acesso à internet…";
    try {
      await fetch("https://www.gstatic.com/generate_204", {
        mode: "no-cors",
        cache: "no-store",
        signal: AbortSignal.timeout(4500),
      });
      title.textContent = "Online";
      text.textContent = "Salvo neste dispositivo • Supabase pendente";
      status.classList.remove("offline", "checking");
    } catch {
      title.textContent = "Offline";
      text.textContent = "Dados salvos neste dispositivo";
      status.classList.remove("checking");
      status.classList.add("offline");
    }
  }

  function initialize() {
    $("attendanceDate").value = today();
    $("dateDisplay").textContent = dateBR(today());
    populateYears();
    setupCustomSelect($("classSelect"));
    setupCustomSelect($("shiftSelect"));

    $("yearPickerButton").addEventListener("click", () => {
      const menu = $("yearMenu");
      menu.hidden = !menu.hidden;
      $("yearPickerButton").setAttribute("aria-expanded", String(!menu.hidden));
    });
    $("yearMenu").addEventListener("click", (event) => {
      const option = event.target.closest("[data-year]");
      if (!option) return;
      localStorage.setItem(KEYS.year, option.dataset.year);
      $("yearMenu").hidden = true;
      $("yearPickerButton").setAttribute("aria-expanded", "false");
      resetForFilterChange();
      populateYears();
      render();
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".year-picker-wrap")) {
        $("yearMenu").hidden = true;
        $("yearPickerButton").setAttribute("aria-expanded", "false");
      }
      if (!event.target.closest(".profile-wrap")) {
        $("profileMenu").hidden = true;
        $("profileButton").setAttribute("aria-expanded", "false");
      }
      document.querySelectorAll(".custom-select.open").forEach((wrap) => {
        if (!wrap.contains(event.target)) {
          wrap.classList.remove("open");
          wrap.querySelector(".custom-select-menu").hidden = true;
          wrap
            .querySelector(".custom-select-trigger")
            .setAttribute("aria-expanded", "false");
        }
      });
    });

    $("classSelect").addEventListener("change", resetForFilterChange);
    $("shiftSelect").addEventListener("change", resetForFilterChange);

    $("datePickerButton").addEventListener("click", () => {
      const current = $("attendanceDate").value
        ? new Date(`${$("attendanceDate").value}T12:00:00`)
        : new Date();
      calendarMonth = new Date(current.getFullYear(), current.getMonth(), 1);
      drawCalendar();
      $("calendarDialog").showModal();
    });
    $("calendarGrid").addEventListener("click", (event) => {
      const button = event.target.closest("[data-date]");
      if (!button) return;
      $("attendanceDate").value = button.dataset.date;
      $("dateDisplay").textContent = dateBR(button.dataset.date);
      $("calendarDialog").close();
      resetForFilterChange();
    });
    $("calendarPrev").addEventListener("click", () => {
      calendarMonth.setMonth(calendarMonth.getMonth() - 1);
      drawCalendar();
    });
    $("calendarNext").addEventListener("click", () => {
      calendarMonth.setMonth(calendarMonth.getMonth() + 1);
      drawCalendar();
    });
    $("calendarToday").addEventListener("click", () => {
      $("attendanceDate").value = today();
      $("dateDisplay").textContent = dateBR(today());
      $("calendarDialog").close();
      resetForFilterChange();
    });
    $("calendarClear").addEventListener("click", () => {
      $("attendanceDate").value = "";
      $("dateDisplay").textContent = "Selecione a data";
      $("calendarDialog").close();
      resetForFilterChange();
    });

    $("studentsTable").addEventListener("click", (event) => {
      const attachmentButton = event.target.closest("[data-view-attachment]");
      if (attachmentButton) {
        openAttachment(attachmentButton);
        return;
      }
      const action = event.target.closest("[data-row-action]");
      if (action) {
        const id = action.dataset.student;
        if (action.dataset.rowAction === "edit") {
          editingRows.add(id);
          render();
        } else if (action.dataset.rowAction === "save") {
          saveStudentEdit(id);
        } else if (action.dataset.rowAction === "cancel") {
          const classItem = selectedClass();
          const key = callId(
            classItem.id,
            $("attendanceDate").value,
            $("shiftSelect").value,
          );
          const saved = calls()[key]?.students?.[id];
          if (saved) draft[id] = { ...saved };
          editingRows.delete(id);
          dirtyRows.delete(id);
          render();
        }
        return;
      }

      const button = event.target.closest(".status-button");
      if (!button || button.disabled) return;
      const id = button.dataset.student;
      if (button.dataset.status === "justificado") {
        $("certificateFile").value = "";
        $("certificateDays").value = "1";
        $("selectedFileName").textContent = "Nenhum arquivo selecionado";
        $("justificationDialog").dataset.studentId = id;
        $("justificationDialog").showModal();
        return;
      }
      draft[id] = {
        ...(draft[id] || {}),
        status: button.dataset.status,
        attachment: null,
        updatedAt: new Date().toISOString(),
      };
      if (editingRows.has(id)) dirtyRows.add(id);
      render();
    });

    $("markAllButton").addEventListener("click", () => {
      const remaining = roster.filter((student) => !draft[student.id]?.status);
      if (!remaining.length) return toast("Todos os alunos já estão marcados.");
      remaining.forEach((student) => {
        draft[student.id] = {
          ...(draft[student.id] || {}),
          status: "presente",
          attachment: null,
        };
      });
      render();
      toast(
        `${remaining.length} aluno(s) restante(s) marcado(s) como presente(s).`,
      );
    });

    $("saveButton").addEventListener("click", saveCall);
    $("certificateFile").addEventListener("change", (event) => {
      $("selectedFileName").textContent =
        event.target.files?.[0]?.name || "Nenhum arquivo selecionado";
    });
    $("saveJustificationButton").addEventListener("click", saveJustification);

    $("notificationBell").addEventListener("click", openNotifications);
    $("closeNotificationDialog").addEventListener("click", () =>
      $("notificationDialog").close(),
    );
    $("closeAttachmentDialog").addEventListener("click", () =>
      $("attachmentDialog").close(),
    );
    $("closeAttachmentButton").addEventListener("click", () =>
      $("attachmentDialog").close(),
    );
    $("attachmentDialog").addEventListener("close", () => {
      if (attachmentUrl) URL.revokeObjectURL(attachmentUrl);
      attachmentUrl = null;
      $("attachmentImage").removeAttribute("src");
      $("attachmentPreview").removeAttribute("src");
    });
    document
      .querySelectorAll("[data-close-dialog]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          $(button.dataset.closeDialog).close(),
        ),
      );

    $("profileButton").addEventListener("click", () => {
      const menu = $("profileMenu");
      menu.hidden = !menu.hidden;
      $("profileButton").setAttribute("aria-expanded", String(!menu.hidden));
    });
    $("switchAccountButton").addEventListener("click", () => {
      window.location.href = "../index.html";
    });
    $("logoutButton").addEventListener("click", () => {
      try {
        sessionStorage.removeItem("alunotecSession");
      } catch {}
      window.location.href = "../index.html";
    });

    window.addEventListener("online", checkConnection);
    window.addEventListener("offline", checkConnection);
    window.addEventListener("storage", (event) => {
      if (
        [KEYS.classes, KEYS.remaps, KEYS.attendance, KEYS.activities].includes(
          event.key,
        )
      ) {
        editingRows.clear();
        dirtyRows.clear();
        draft = {};
        populateYears();
        render();
        refreshAlerts();
      }
    });

    $("clearNotificationsButton").addEventListener("click", clearNotifications);
    $("connectionStatus").addEventListener("click", checkConnection);

    window.AlunoTecFrequencia = {
      storageKey: KEYS.attendance,
      getFrequencyClass(studentId, originClassId, date = today()) {
        const source = classes.find((c) => c.id === String(originClassId));
        const student = source?.students.find(
          (s) => String(s.id) === String(studentId),
        );
        return source && student
          ? effectiveClassFor(student, source, date)
          : String(originClassId);
      },
      getStudentAttendance(studentId) {
        return Object.values(calls()).flatMap((call) => {
          const record = call.students?.[studentId];
          return record
            ? [
                {
                  date: call.date,
                  classId: call.classId,
                  status: record.status,
                },
              ]
            : [];
        });
      },
    };

    refreshAlerts();
    render();
    checkConnection();
  }

  function resetForFilterChange() {
    editingRows.clear();
    dirtyRows.clear();
    draft = {};
    render();
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
