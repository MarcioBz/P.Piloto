/* Seletores compartilhados, extraídos do padrão já usado nos Relatórios.
   O select original continua sendo a fonte dos valores e eventos change. */
(() => {
  "use strict";
  const registry = new Map();
  function close(except = null) {
    registry.forEach(custom => {
      if (custom === except) return;
      custom.wrapper.classList.remove("is-open"); custom.menu.hidden = true;
      custom.button.setAttribute("aria-expanded", "false");
    });
  }
  function refresh(select) {
    const custom = registry.get(select); if (!custom) return;
    const { prefix, value, button, menu, wrapper } = custom;
    value.textContent = select.options[select.selectedIndex]?.textContent || "Selecione";
    wrapper.dataset.value = select.value;
    button.disabled = select.disabled;
    menu.replaceChildren(...[...select.options].map((option, index) => {
      const row = document.createElement("button"); row.type = "button"; row.className = `${prefix}-select-option`;
      row.dataset.optionIndex = String(index); row.setAttribute("role", "option"); row.setAttribute("aria-selected", String(option.selected)); row.disabled = option.disabled;
      const text = document.createElement("span"); text.textContent = option.textContent; row.append(text);
      if (option.selected) { const check = document.createElement("span"); check.className = `${prefix}-option-check`; check.textContent = "✓"; check.setAttribute("aria-hidden", "true"); row.append(check); }
      return row;
    }));
  }
  function enhance(select, { prefix = "at" } = {}) {
    if (!select || registry.has(select)) return registry.get(select);
    const label = document.querySelector(`label[for="${select.id}"]`) || select.closest("label");
    const labelText = select.getAttribute("aria-label") || (label && ([...label.childNodes]
      .filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(" ").trim() || label.querySelector(".teacher-sr")?.textContent)) || "Opções";
    const wrapper = document.createElement("div"); wrapper.className = `${prefix}-select`;
    select.before(wrapper); wrapper.append(select); select.hidden = true;
    const button = document.createElement("button"); button.type = "button"; button.className = `${prefix}-select-button`;
    button.id = `${select.id}-button`; button.setAttribute("role", "combobox"); button.setAttribute("aria-haspopup", "listbox"); button.setAttribute("aria-expanded", "false");
    const value = document.createElement("span"); value.id = `${button.id}-value`; value.className = `${prefix}-select-value`; button.append(value);
    if (label && !label.contains(wrapper)) {
      label.id ||= `${select.id}-label`; label.htmlFor = button.id;
      button.setAttribute("aria-labelledby", `${label.id} ${value.id}`);
    } else {
      if (label) label.htmlFor = button.id;
      button.setAttribute("aria-label", labelText);
    }
    const menu = document.createElement("div"); menu.className = `${prefix}-select-menu`; menu.id = `${select.id}-menu`;
    menu.setAttribute("role", "listbox"); menu.setAttribute("aria-label", labelText); menu.hidden = true;
    button.setAttribute("aria-controls", menu.id); wrapper.append(button, menu);
    const custom = { select, prefix, wrapper, button, value, menu }; registry.set(select, custom);
    function open() { close(custom); refresh(select); menu.hidden = false; wrapper.classList.add("is-open"); button.setAttribute("aria-expanded", "true"); }
    function options() { return [...menu.querySelectorAll("button:not(:disabled)")]; }
    button.addEventListener("click", () => { if (menu.hidden) open(); else close(); });
    button.addEventListener("keydown", event => {
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault(); open(); const rows = options();
        (rows.find(row => row.getAttribute("aria-selected") === "true") || (event.key === "ArrowUp" ? rows.at(-1) : rows[0]))?.focus();
      }
      if (event.key === "Escape" && !menu.hidden) { event.preventDefault(); event.stopPropagation(); close(); }
    });
    menu.addEventListener("click", event => {
      const row = event.target.closest("[data-option-index]"); if (!row || row.disabled) return;
      select.selectedIndex = Number(row.dataset.optionIndex); close(); refresh(select); button.focus();
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    menu.addEventListener("keydown", event => {
      const rows = options(), index = rows.indexOf(document.activeElement);
      const next = { ArrowDown: (index + 1) % rows.length, ArrowUp: (index + rows.length - 1) % rows.length, Home: 0, End: rows.length - 1 }[event.key];
      if (next != null && rows.length) { event.preventDefault(); rows[next].focus(); }
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); button.focus(); }
    });
    wrapper.addEventListener("focusout", event => { if (!wrapper.contains(event.relatedTarget)) { wrapper.classList.remove("is-open"); menu.hidden = true; button.setAttribute("aria-expanded", "false"); } });
    select.addEventListener("change", () => refresh(select));
    select.form?.addEventListener("reset", () => queueMicrotask(() => refresh(select)));
    refresh(select); return custom;
  }
  document.addEventListener("click", event => { if (!event.target.closest(".at-select, .rp-select")) close(); });
  document.addEventListener("close", () => close(), true);
  window.AlunoTecSelect = Object.freeze({ registry, enhance, refresh, close, refreshAll: () => registry.forEach(custom => refresh(custom.select)) });
})();
