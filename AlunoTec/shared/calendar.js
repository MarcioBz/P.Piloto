/* Calendário compartilhado: datas e meses, sem abrir o seletor nativo. */
(() => {
  "use strict";
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const dateObject = value => new Date(`${value}T12:00:00`);
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value)) && !Number.isNaN(dateObject(value).getTime()) && iso(dateObject(value)) === value;
  const today = () => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = key => parts.find(item => item.type === key).value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  const br = value => validDate(value) ? value.split("-").reverse().join("/") : "Selecione uma data";
  const months = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2024, index, 1, 12)));
  const within = (value, min, max) => (!min || value >= min) && (!max || value <= max);
  function monthDays(month, min = "", max = "") {
    const first = dateObject(`${month}-01`);
    const offset = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(first); date.setDate(1 - offset + index);
      const value = iso(date);
      return { value, day: date.getDate(), outside: value.slice(0, 7) !== month, disabled: !within(value, min, max) };
    });
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { validDate, monthDays, within }; return;
  }
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${name === "calendar" ? '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>' : name === "close" ? '<path d="m6 6 12 12M18 6 6 18"/>' : '<path d="m9 6 6 6-6 6"/>'}</svg>`;
  let dialog, current = null;
  const bindings = new Map();
  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement("dialog");
    dialog.id = "at-calendar-dialog"; dialog.className = "at-calendar-dialog";
    dialog.setAttribute("aria-labelledby", "at-calendar-title");
    dialog.innerHTML = `<button class="at-calendar-close" type="button" aria-label="Fechar calendário">${icon("close")}</button>
      <h2 id="at-calendar-title"></h2><div class="at-calendar-controls">
      <button type="button" data-at-month="-1" aria-label="Mês anterior">${icon("chevron")}</button>
      <strong id="at-calendar-month" aria-live="polite"></strong>
      <button type="button" data-at-month="1" aria-label="Próximo mês">${icon("chevron")}</button></div>
      <div class="at-calendar-grid" role="group" aria-labelledby="at-calendar-month"></div>
      <div class="at-calendar-legend"></div><div class="at-calendar-footer">
      <button type="button" data-at-today>Hoje</button><button type="button" data-at-clear>Limpar</button></div>`;
    document.body.append(dialog);
    dialog.querySelector(".at-calendar-close").addEventListener("click", close);
    // Escape fecha apenas o calendário, preservando formulários abertos atrás dele.
    dialog.addEventListener("keydown", event => { if (event.key === "Escape") event.stopPropagation(); });
    dialog.addEventListener("close", () => {
      if (dialog.open) return;
      const trigger = current?.trigger; current = null;
      trigger?.setAttribute("aria-expanded", "false");
      if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus();
    });
    dialog.addEventListener("click", event => {
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
      }
      const step = event.target.closest("[data-at-month]");
      if (step && !step.disabled) move(Number(step.dataset.atMonth));
      const day = event.target.closest("[data-at-date]");
      if (day && !day.disabled) select(day.dataset.atDate);
      if (event.target.closest("[data-at-today]") && !dialog.querySelector("[data-at-today]").disabled) select(current.mode === "month" ? today().slice(0, 7) : today());
      if (event.target.closest("[data-at-clear]")) select("");
    });
    dialog.querySelector(".at-calendar-grid").addEventListener("keydown", keyboard);
  }
  function close() { if (dialog?.open) dialog.close(); }
  function limits(config) {
    const mode = config.mode || "date";
    const adapt = (value, end) => mode !== "month" || !value ? value || "" : value.length === 7 ? value : value.slice(0, 7);
    return { min: adapt(config.min), max: adapt(config.max, true) };
  }
  function open(config) {
    ensureDialog();
    if (dialog.open) close();
    const mode = config.mode || "date", bounds = limits(config);
    let anchor = config.value || (mode === "month" ? today().slice(0, 7) : today());
    if (bounds.min && anchor < bounds.min) anchor = bounds.min;
    if (bounds.max && anchor > bounds.max) anchor = bounds.max;
    current = { ...config, ...bounds, mode, month: anchor.slice(0, 7), focus: anchor, value: config.value || "" };
    current.trigger ||= document.activeElement;
    current.trigger?.setAttribute("aria-expanded", "true");
    dialog.querySelector("h2").textContent = config.title || (mode === "month" ? "Escolha o mês" : "Escolha a data");
    render(); dialog.showModal(); focusDay();
  }
  function focusDay() {
    const buttons = [...dialog.querySelectorAll("[data-at-date]:not(:disabled)")];
    (buttons.find(item => item.dataset.atDate === current.focus) || buttons.find(item => item.getAttribute("aria-pressed") === "true") || buttons[0])?.focus();
  }
  function move(amount, focus = false) {
    const date = dateObject(`${current.month}-01`);
    date.setMonth(date.getMonth() + amount * (current.mode === "month" ? 12 : 1));
    const month = iso(date).slice(0, 7);
    if (current.mode === "month") {
      if ((current.min && month.slice(0, 4) < current.min.slice(0, 4)) || (current.max && month.slice(0, 4) > current.max.slice(0, 4))) return;
    } else if ((current.min && month < current.min.slice(0, 7)) || (current.max && month > current.max.slice(0, 7))) return;
    current.month = month; current.focus = current.mode === "month" ? month : `${month}-01`;
    render(); if (focus) focusDay();
  }
  function select(value) {
    if (!current || (value && !within(value, current.min, current.max))) return;
    const callback = current.onSelect; close(); callback?.(value);
  }
  function render() {
    const c = current, isMonth = c.mode === "month", currentDate = today(), marks = typeof c.marks === "function" ? c.marks() : c.marks;
    const dateMarks = marks instanceof Map ? marks : new Map([...(marks || [])].map(value => [value, "complete"]));
    const grid = dialog.querySelector(".at-calendar-grid");
    grid.classList.toggle("is-months", isMonth);
    dialog.querySelector("#at-calendar-month").textContent = isMonth ? c.month.slice(0, 4) : `${months[Number(c.month.slice(5)) - 1]} de ${c.month.slice(0, 4)}`;
    for (const step of [-1, 1]) {
      const button = dialog.querySelector(`[data-at-month="${step}"]`);
      button.setAttribute("aria-label", isMonth ? step < 0 ? "Ano anterior" : "Próximo ano" : step < 0 ? "Mês anterior" : "Próximo mês");
      const boundary = step < 0 ? c.min : c.max;
      button.disabled = Boolean(boundary && (isMonth ? c.month.slice(0, 4) === boundary.slice(0, 4) : c.month === boundary.slice(0, 7)));
    }
    const cells = isMonth ? months.map((label, index) => {
      const value = `${c.month.slice(0, 4)}-${String(index + 1).padStart(2, "0")}`;
      return { value, label, disabled: !within(value, c.min, c.max) };
    }) : monthDays(c.month, c.min, c.max);
    grid.replaceChildren();
    if (!isMonth) for (const name of ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"]) {
      const label = document.createElement("span"); label.className = "at-calendar-weekday"; label.textContent = name[0]; label.title = name; label.setAttribute("aria-hidden", "true"); grid.append(label);
    }
    for (const cell of cells) {
      const button = document.createElement("button"); button.type = "button";
      const mark = isMonth ? [...dateMarks.keys()].some(date => date.startsWith(cell.value)) ? "complete" : "" : dateMarks.get(cell.value);
      button.className = ["at-calendar-day", cell.outside ? "is-outside" : "", mark ? "has-call" : "", mark === "partial" ? "is-partial" : "", cell.value === c.value ? "is-selected" : "", cell.value === (isMonth ? currentDate.slice(0, 7) : currentDate) ? "is-today" : ""].filter(Boolean).join(" ");
      button.textContent = cell.label || cell.day; button.dataset.atDate = cell.value; button.disabled = cell.disabled;
      button.setAttribute("aria-label", `${cell.label ? `${cell.label} de ${c.month.slice(0, 4)}` : br(cell.value)}${mark ? mark === "partial" ? ", chamada pendente" : ", com chamada" : ""}`);
      button.setAttribute("aria-pressed", String(cell.value === c.value));
      if (button.classList.contains("is-today")) button.setAttribute("aria-current", "date");
      button.tabIndex = cell.value === c.focus && !cell.disabled ? 0 : -1; grid.append(button);
    }
    const legend = dialog.querySelector(".at-calendar-legend"); legend.replaceChildren();
    for (const [className, label] of [...(c.marks ? [["call", c.callLabel || "Com chamada"]] : []), ...(c.partialLabel ? [["partial", c.partialLabel]] : []), ["today", "Hoje"]]) {
      const span = document.createElement("span"), key = document.createElement("i"); key.className = `at-calendar-key-${className}`; span.append(key, document.createTextNode(label)); legend.append(span);
    }
    dialog.querySelector("[data-at-today]").disabled = !within(isMonth ? currentDate.slice(0, 7) : currentDate, c.min, c.max);
  }
  function keyboard(event) {
    const button = event.target.closest("[data-at-date]"); if (!button || !current) return;
    const monthMode = current.mode === "month", value = button.dataset.atDate;
    if (["PageUp", "PageDown"].includes(event.key)) { event.preventDefault(); move(event.key === "PageUp" ? -1 : 1, true); return; }
    const date = dateObject(monthMode ? `${value}-01` : value), offset = monthMode ? date.getMonth() % 3 : (date.getDay() + 6) % 7;
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: monthMode ? -3 : -7, ArrowDown: monthMode ? 3 : 7, Home: -offset, End: (monthMode ? 2 : 6) - offset };
    if (!(event.key in steps)) return;
    event.preventDefault();
    if (monthMode) date.setMonth(date.getMonth() + steps[event.key]); else date.setDate(date.getDate() + steps[event.key]);
    const next = iso(date).slice(0, monthMode ? 7 : 10);
    if (!within(next, current.min, current.max)) return;
    current.month = next.slice(0, 7); current.focus = next; render(); focusDay();
  }
  function bind(config) {
    const input = config.input;
    if (!input || bindings.has(input)) return bindings.get(input);
    const mode = config.mode || (input.type === "month" ? "month" : "date");
    let button = config.button, value = config.label;
    if (!button) {
      button = document.createElement("button"); button.type = "button"; button.id = `${input.id}-button`;
      input.after(button);
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) { label.htmlFor = button.id; config.title ||= label.textContent.trim(); }
    }
    button.classList.add("at-date-button");
    if (!value) { value = document.createElement("span"); value.id = `${input.id}-display`; }
    button.innerHTML = icon("calendar"); button.append(value);
    button.setAttribute("aria-haspopup", "dialog"); button.setAttribute("aria-expanded", "false"); button.setAttribute("aria-controls", "at-calendar-dialog");
    input.hidden = true; input.tabIndex = -1;
    const update = () => {
      value.textContent = mode === "month" ? /^\d{4}-\d{2}$/.test(input.value) ? `${months[Number(input.value.slice(5)) - 1]} de ${input.value.slice(0, 4)}` : "Selecione o mês" : br(input.value);
      button.disabled = input.disabled;
    };
    const show = () => open({ ...config, mode, trigger: button, value: input.value, min: input.min || config.min, max: input.max || config.max,
      onSelect: selected => { input.value = selected; input.setCustomValidity(""); update(); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); config.onSelect?.(selected); } });
    button.addEventListener("click", show);
    input.addEventListener("change", update);
    input.addEventListener("invalid", event => { event.preventDefault(); show(); });
    input.form?.addEventListener("reset", () => queueMicrotask(update));
    const binding = { update, show, input, button }; bindings.set(input, binding); update(); return binding;
  }
  const refresh = () => bindings.forEach(binding => binding.update());
  window.AlunoTecCalendar = { open, close, bind, refresh, monthDays };
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('input[type="date"], input[type="month"]').forEach(input => bind({ input }));
  });
})();
