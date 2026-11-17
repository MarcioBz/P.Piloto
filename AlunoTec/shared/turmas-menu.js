/* ==========================================================
   ALUNOTEC | MAPA DE EDIÇÃO — MENU RESPONSIVO DE TURMAS
   Controla abertura/fechamento do menu lateral, clique fora e tecla
   Escape. Usa #turmasMenuButton e .sidebar, presentes em turmas/index.html.
   Mantenha os atributos de acessibilidade sincronizados com o estado.
========================================================== */

document.addEventListener("DOMContentLoaded", () => {
  /* ELEMENTOS: o menu só é iniciado nas páginas que possuem os dois itens. */
  const button = document.getElementById("turmasMenuButton");
  const sidebar = document.querySelector(".sidebar");
  if (!button || !sidebar) return;
  /* ESTADO ACESSÍVEL: classe visual e rótulos refletem abertura/fechamento. */
  const setOpen = (open) => {
    document.body.classList.toggle("alunotec-menu-open", open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  };
  /* EVENTOS: botão, clique externo, Escape, navegação e mudança de largura. */
  button.addEventListener("click", () =>
    setOpen(!document.body.classList.contains("alunotec-menu-open")),
  );
  document.addEventListener("click", (event) => {
    if (
      document.body.classList.contains("alunotec-menu-open") &&
      !sidebar.contains(event.target) &&
      !button.contains(event.target)
    )
      setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
  sidebar.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 850) setOpen(false);
  });
});
