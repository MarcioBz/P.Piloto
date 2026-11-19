/* ==========================================================
   ALUNOTEC | ESTRUTURA COMPARTILHADA
   Monta uma única navegação para todas as páginas internas e
   conecta os controles globais sem repetir lógica por página.
========================================================== */
(() => {
  "use strict";

  const page = document.body.dataset.appPage;
  if (!page) return;

  const pages = [
    {
      id: "dashboard",
      label: "Início",
      href: "admin/dashboard.html",
      icon: "home",
    },
    {
      id: "frequency",
      label: "Frequência",
      href: "frequencia/frequencia.html",
      icon: "calendar",
    },
    {
      id: "students",
      label: "Alunos",
      href: "aluno/aluno.html",
      icon: "users",
    },
    { id: "classes", label: "Turmas", href: "turmas/index.html", icon: "book" },
    {
      id: "reports",
      label: "Relatórios",
      href: "relat/relat.html",
      icon: "chart",
    },
    {
      id: "electives",
      label: "Eletivas",
      href: "eletivas/eletivas.html",
      icon: "capelo",
      group: "PROFESSORES",
    },
    {
      id: "institution",
      label: "Instituição",
      href: "inst/inst.html",
      icon: "building",
      group: "ADMINISTRAÇÃO",
    },
    {
      id: "settings",
      label: "Configurações",
      href: "config/config.html",
      icon: "settings",
    },
  ];

  const icons = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    calendar:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    users:
      '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 4.5v17M8 6h8M8 10h8"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    capelo: '<path d="m2 9 10-5 10 5-10 5zM6 11v5c3 3 9 3 12 0v-5M22 9v7"/>',
    building:
      '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 21v-4h6v4M8 7h2M14 7h2M8 11h2M14 11h2"/>',
    settings:
      '<path d="M4 6h5m4 0h7M4 12h9m4 0h3M4 18h2m4 0h10"/><circle cx="11" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    chevron: '<path d="m7 10 5 5 5-5"/>',
    calendarSmall:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    wifi: '<path d="M5 9a11 11 0 0 1 14 0M8 12a6.5 6.5 0 0 1 8 0M11 15a2 2 0 0 1 2 0M12 19h.01"/>',
    switch: '<path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4"/>',
    logout: '<path d="M10 17l5-5-5-5M15 12H3M21 3v18"/>',
    support:
      '<path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13h3v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 1-2ZM20 13h-3v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-2ZM17 19a5 5 0 0 1-5 3h-1"/>',
  };

  function icon(name, className = "") {
    const classes = ["at-icon", className].filter(Boolean).join(" ");
    return `<svg class="${classes}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#at-icon-${name}"></use></svg>`;
  }

  /* ==========================================================
     BIBLIOTECA DE ÍCONES COMPARTILHADA
     Registra uma única coleção SVG para o menu, o topbar e os indicadores comuns.
  ========================================================== */
  function installIconLibrary() {
    const namespace = "http://www.w3.org/2000/svg";
    const sprite = document.createElementNS(namespace, "svg");
    sprite.id = "atIconLibrary";
    sprite.classList.add("at-icon-library");
    sprite.setAttribute("aria-hidden", "true");
    sprite.setAttribute("focusable", "false");

    Object.entries(icons).forEach(([name, paths]) => {
      const symbol = document.createElementNS(namespace, "symbol");
      symbol.id = `at-icon-${name}`;
      symbol.setAttribute("viewBox", "0 0 24 24");
      symbol.innerHTML = paths;
      sprite.append(symbol);
    });

    document.body.prepend(sprite);
  }

  installIconLibrary();

  function createSidebar() {
    const sidebar = document.createElement("aside");
    sidebar.className = "sidebar";
    sidebar.id = "sidebar";
    sidebar.setAttribute("aria-label", "Menu principal");

    const links = [];
    let currentGroup = "";
    pages.forEach((item) => {
      if (item.group && item.group !== currentGroup) {
        if (currentGroup)
          links.push('<div class="nav-separator" aria-hidden="true"></div>');
        links.push(`<p class="nav-title">${item.group}</p>`);
        currentGroup = item.group;
      }
      const active = item.id === page;
      links.push(
        `<a class="nav-link${active ? " active" : ""}" href="../${item.href}"${active ? ' aria-current="page"' : ""}>${icon(item.icon)}<span>${item.label}</span></a>`,
      );
    });

    sidebar.innerHTML = `
      <!-- =====================================================
           MARCA E FECHAMENTO
           Mantém o logotipo e o controle de saída do menu móvel.
      ===================================================== -->
      <div class="sidebar-brand">
        <a href="../admin/dashboard.html" class="sidebar-logo-link" aria-label="Ir para o início do AlunoTec">
          <img src="../assets/images/logo-alunotec1.png" alt="AlunoTec">
        </a>
        <button class="sidebar-close" id="sidebarClose" type="button" aria-label="Fechar menu"></button>
      </div>

      <!-- =====================================================
           LINKS DE NAVEGAÇÃO
           Destaca a página atual e aponta para as demais áreas do sistema.
      ===================================================== -->
      <nav class="sidebar-nav" aria-label="Navegação principal">${links.join("")}</nav>

      <!-- =====================================================
           SUPORTE E RODAPÉ
           Mantém suporte, direitos e créditos do projeto em todas as páginas.
      ===================================================== -->
      <div class="sidebar-bottom">
        <button class="support-card" type="button">
          ${icon("support")}
          <span><strong>Suporte</strong><small>Precisa de ajuda?</small></span>
        </button>
        <footer class="sidebar-footer">
          <strong>AlunoTec • <span id="footerYear" data-school-year>2026</span></strong>
          <span>Todos os direitos reservados.</span>
          <div class="sidebar-footer-credits" aria-label="Créditos do projeto">
            <span><strong>Criador:</strong> Márcio Bezerra</span>
            <span><strong>Colaboradores:</strong><br>Estevan Martins<br>Mateus Ferreira</span>
          </div>
        </footer>
      </div>`;

    return sidebar;
  }

  function createTopbar() {
    const header = document.createElement("header");
    header.className = "topbar";
    header.innerHTML = `
      <!-- =====================================================
           LADO ESQUERDO
           Abre o menu no celular e permite escolher o ano letivo global.
      ===================================================== -->
      <div class="topbar-left">
        <button class="menu-button" id="menuButton" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="sidebar">
          ${icon("menu")}
        </button>
        <div class="year-custom-select" id="yearDropdown">
          <button class="custom-select-trigger" id="yearPickerButton" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="yearMenu">
            <span class="custom-select-icon">${icon("calendarSmall")}</span>
            <span class="custom-select-content"><small>Ano letivo</small><strong id="selectedYear">2026</strong></span>
            ${icon("menu", "custom-select-menu-icon")}
          </button>
          <div class="custom-select-menu" id="yearMenu" role="listbox" hidden></div>
          <input type="hidden" id="yearSelect" value="2026">
          ${page === "students" ? '<div class="shell-year-compat" hidden><select id="yearFilter" aria-label="Ano letivo dos alunos"></select></div>' : ""}
        </div>
      </div>

      <!-- =====================================================
           LADO DIREITO
           Reúne avisos, estado da conexão e ações do perfil.
      ===================================================== -->
      <div class="topbar-right">
        <button class="activity-bell" id="activityBell" type="button" aria-label="Notificações" aria-expanded="false">
          ${icon("bell")}
          <span class="activity-bell-count" id="activityBellCount" hidden>0</span>
        </button>
        <button class="connection" id="connectionStatus" type="button" aria-label="Verificar conexão com a internet">
          ${icon("wifi")}
          <span><strong id="connectionTitle">Verificando</strong><small id="connectionSubtitle">Verificando acesso à internet…</small></span>
        </button>
        <div class="profile">
          <button class="profile-button" id="profileButton" type="button" aria-expanded="false" aria-controls="profileDropdown">
            <span class="avatar">MB</span>
            <span class="profile-text"><strong>Márcio Bezerra</strong><small>Super Administrador</small></span>
            ${icon("menu", "profile-menu-icon")}
          </button>
          <div class="profile-dropdown" id="profileDropdown">
            <div class="dropdown-profile">
              <span class="avatar">MB</span>
              <div><strong>Márcio Bezerra</strong><small>Super Administrador</small></div>
            </div>
            <div class="dropdown-divider"></div>
            <button id="switchAccount" type="button">${icon("switch")}<span>Trocar de conta</span></button>
            <div class="dropdown-divider"></div>
            <button class="logout" id="logoutButton" type="button">${icon("logout")}<span>Sair</span></button>
          </div>
        </div>
      </div>`;
    return header;
  }

  /* ==========================================================
     CONTEÚDO DA PÁGINA
     Reaproveita a área existente e a organiza dentro do shell compartilhado.
  ========================================================== */
  document
    .querySelectorAll(
      ".sidebar, .topbar, .sidebar-overlay, header.management-header",
    )
    .forEach((element) => element.remove());

  let content = document.querySelector(
    "main.main, main.main-area, main.management-main, main",
  );
  const body = document.body;

  if (!content) {
    content = document.createElement("main");
    content.className = "main";
    [...body.childNodes].forEach((node) => {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        ["SCRIPT", "STYLE"].includes(node.tagName)
      )
        return;
      content.append(node);
    });
  }

  let main = content;
  if (content.classList.contains("management-main")) {
    main = document.createElement("div");
    main.className = "main management-layout";
    content.replaceWith(main);
    main.append(content);
  } else {
    main.classList.add("main");
  }

  let app = main.closest(".app, .app-shell, .app-layout");
  if (!app) {
    app = document.createElement("div");
    main.before(app);
    app.append(main);
  }
  app.classList.remove("app-shell", "app-layout");
  app.classList.add("app");

  if (main.parentElement !== app) app.append(main);
  if (!app.isConnected) body.append(app);
  app.prepend(createSidebar());
  main.prepend(createTopbar());

  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  overlay.id = "sidebarOverlay";
  overlay.setAttribute("aria-hidden", "true");
  app.append(overlay);

  /* ==========================================================
     MENU LATERAL
     Centraliza abertura, fechamento, foco e atributos acessíveis do menu.
  ========================================================== */
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const menuButton = document.getElementById("menuButton");
  const sidebarClose = document.getElementById("sidebarClose");

  function closeSidebar() {
    const wasOpen = sidebar.classList.contains("open");
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("active");
    menuButton.setAttribute("aria-expanded", "false");
    return wasOpen;
  }

  function openSidebar() {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("active");
    menuButton.setAttribute("aria-expanded", "true");
  }

  menuButton.addEventListener("click", openSidebar);
  sidebarClose.addEventListener("click", closeSidebar);
  sidebarOverlay.addEventListener("click", closeSidebar);
  sidebar
    .querySelectorAll("a")
    .forEach((link) => link.addEventListener("click", closeSidebar));

  /* ==========================================================
     ANO LETIVO COMPARTILHADO
     Mantém as opções, o valor salvo e o evento usado pelas páginas funcionais.
  ========================================================== */
  const yearDropdown = document.getElementById("yearDropdown");
  const yearButton = document.getElementById("yearPickerButton");
  const yearMenu = document.getElementById("yearMenu");
  const yearInput = document.getElementById("yearSelect");
  const studentYearSelect = document.getElementById("yearFilter");
  const schoolYearKey = "alunotecSchoolYear";

  function normalizeClassYear(item) {
    const declaredYear = String(item?.year || "").trim();
    if (/^\d{4}$/.test(declaredYear)) return declaredYear;

    const dateYear = String(item?.date || "").slice(0, 4);
    if (/^\d{4}$/.test(dateYear)) return dateYear;

    return String(new Date().getFullYear());
  }

  function getSavedClasses() {
    try {
      const saved = JSON.parse(
        localStorage.getItem("alunotec_turmas_v2") || "{}",
      );
      return [
        ...(Array.isArray(saved?.base) ? saved.base : []),
        ...(Array.isArray(saved?.electives) ? saved.electives : []),
      ];
    } catch {
      return [];
    }
  }

  function yearsFromSavedClasses() {
    const years = new Set(getSavedClasses().map(normalizeClassYear));
    if (!years.size) years.add(String(new Date().getFullYear()));
    return [...years].sort((a, b) => Number(b) - Number(a));
  }

  function setYears(_values, preferredYear, notify = false) {
    // A lista do topbar sempre vem das turmas salvas, nunca de filtros locais ou chamadas antigas.
    const years = yearsFromSavedClasses();
    const options = years.length ? years : [String(new Date().getFullYear())];
    let savedYear = "";
    try {
      savedYear = localStorage.getItem(schoolYearKey) || "";
    } catch {}
    let selected = String(preferredYear || savedYear || options[0]);
    if (!options.includes(selected)) selected = options[0];

    yearMenu.replaceChildren();
    options.forEach((year) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = `custom-option${year === selected ? " selected" : ""}`;
      option.dataset.value = year;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(year === selected));
      option.innerHTML = `<span>${year}</span>${year === selected ? '<span class="option-check" aria-hidden="true">✓</span>' : ""}`;
      yearMenu.append(option);
    });

    document.getElementById("selectedYear").textContent = selected;
    yearInput.value = selected;
    document.querySelectorAll("[data-school-year]").forEach((element) => {
      element.textContent = selected;
    });

    if (studentYearSelect) {
      const changed = studentYearSelect.value !== selected;
      studentYearSelect.replaceChildren(
        ...options.map((year) => new Option(year, year)),
      );
      studentYearSelect.value = selected;
      if (notify && changed)
        studentYearSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }

    try {
      localStorage.setItem(schoolYearKey, selected);
    } catch {}
    if (notify) {
      document.dispatchEvent(
        new CustomEvent("alunotec:yearchange", { detail: { year: selected } }),
      );
    }
    return selected;
  }

  function closeYearMenu() {
    yearDropdown.classList.remove("open");
    yearButton.setAttribute("aria-expanded", "false");
    yearMenu.hidden = true;
  }

  yearButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = !yearDropdown.classList.contains("open");
    yearDropdown.classList.toggle("open", open);
    yearButton.setAttribute("aria-expanded", String(open));
    yearMenu.hidden = !open;
  });

  yearMenu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-value]");
    if (!option) return;
    event.stopPropagation();
    setYears(
      [...yearMenu.querySelectorAll("[data-value]")].map(
        (item) => item.dataset.value,
      ),
      option.dataset.value,
      true,
    );
    closeYearMenu();
  });

  let initialYear = "";
  try {
    initialYear = localStorage.getItem(schoolYearKey) || "";
  } catch {}
  setYears(yearsFromSavedClasses(), initialYear);

  window.addEventListener("storage", (event) => {
    if (event.key === schoolYearKey) {
      setYears(yearsFromSavedClasses(), event.newValue || "", true);
      return;
    }

    if (event.key === "alunotec_turmas_v2") {
      const availableYears = yearsFromSavedClasses();
      const currentYear = yearInput.value;
      setYears(
        availableYears,
        currentYear,
        !availableYears.includes(currentYear),
      );
    }
  });

  /* ==========================================================
     PERFIL E CONEXÃO
     Compartilha abertura do perfil e estado de rede nas páginas sem monitor próprio.
  ========================================================== */
  const profile = document.querySelector(".profile");
  const profileButton = document.getElementById("profileButton");
  const profileDropdown = document.getElementById("profileDropdown");

  function closeProfile() {
    profile.classList.remove("open");
    profileButton.setAttribute("aria-expanded", "false");
  }

  profileButton.addEventListener("click", (event) => {
    event.stopPropagation();
    closeYearMenu();
    const open = !profile.classList.contains("open");
    profile.classList.toggle("open", open);
    profileButton.setAttribute("aria-expanded", String(open));
  });
  profileDropdown.addEventListener("click", (event) => event.stopPropagation());

  const connection = document.getElementById("connectionStatus");
  const connectionTitle = document.getElementById("connectionTitle");
  const connectionSubtitle = document.getElementById("connectionSubtitle");

  let genericConnectionRequest = 0;

  async function updateGenericConnection() {
    if (["dashboard", "students", "frequency", "classes"].includes(page)) {
      return;
    }

    const request = ++genericConnectionRequest;
    if (!navigator.onLine) {
      connection.disabled = false;
      connection.removeAttribute("aria-busy");
      connection.classList.remove("checking");
      connection.classList.add("offline");
      connectionTitle.textContent = "Offline";
      connectionSubtitle.textContent = "Sem conexão de rede neste dispositivo";
      return;
    }

    connection.disabled = true;
    connection.setAttribute("aria-busy", "true");
    connection.classList.remove("offline");
    connection.classList.add("checking");
    connectionTitle.textContent = "Verificando";
    connectionSubtitle.textContent = "Testando o acesso à internet…";

    const started = Date.now();
    let reachable = false;
    try {
      await fetch("https://www.gstatic.com/generate_204", {
        mode: "no-cors",
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      reachable = true;
    } catch {
      // Uma falha pode ser bloqueio do teste; não comprova falta de internet.
    }

    // Torna o retorno do clique perceptível mesmo em conexões rápidas.
    const remaining = 600 - (Date.now() - started);
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
    if (request !== genericConnectionRequest) return;

    connection.disabled = false;
    connection.removeAttribute("aria-busy");
    connection.classList.remove("checking");
    connection.classList.toggle("offline", !navigator.onLine);
    connectionTitle.textContent = !navigator.onLine
      ? "Offline"
      : reachable ? "Online" : "Não confirmado";
    connectionSubtitle.textContent = !navigator.onLine
      ? "Sem conexão de rede neste dispositivo"
      : reachable
        ? "Acesso externo verificado • clique para testar novamente"
        : "O teste pode ter sido bloqueado • clique para tentar novamente";
  }

  connection.addEventListener("click", updateGenericConnection);
  window.addEventListener("online", updateGenericConnection);
  window.addEventListener("offline", updateGenericConnection);
  updateGenericConnection();

  /* ==========================================================
     NOTIFICAÇÕES DO CABEÇALHO COMPARTILHADO
     Páginas funcionais mantêm seus próprios painéis de avisos.
     As demais usam as mesmas atividades e alertas já salvos.
  ========================================================== */
  if (!["dashboard", "students", "frequency", "classes"].includes(page)) {
    const bell = document.getElementById("activityBell");
    const badge = document.getElementById("activityBellCount");
    const activityKey = "alunotec_turmas_activity_v1";
    const alertsKey = "alunotec_frequencia_alertas_v1";
    let noticesDialog = null;

    function readNotices(key) {
      try {
        const items = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(items)
          ? items.filter(item => item && typeof item === "object")
          : [];
      } catch {
        return [];
      }
    }

    function currentNoticeYear() {
      return String(yearInput.value || new Date().getFullYear());
    }

    function activeHeaderAlerts() {
      const year = currentNoticeYear();
      return readNotices(alertsKey).filter(item =>
        item.active !== false && String(item.year || year) === year
      );
    }

    function updateHeaderBell() {
      const alerts = activeHeaderAlerts();
      const activities = readNotices(activityKey);
      const count = [...alerts, ...activities].filter(item => !item.read).length;

      badge.textContent = count > 99 ? "99+" : String(count);
      badge.hidden = count === 0;
      bell.classList.toggle("has-activity", count > 0);
      bell.classList.toggle("urgent", alerts.length > 0);
      bell.setAttribute("aria-label", alerts.length
        ? `${alerts.length} alerta(s) de frequência; ${count} notificação(ões) não lida(s)`
        : `Notificações: ${count} não lida(s)`);
    }

    function noticeTime(value, dateOnly) {
      const raw = String(value || "");
      const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? `${raw}T12:00:00`
        : raw);

      if (Number.isNaN(date.getTime())) return "";
      return new Intl.DateTimeFormat("pt-BR", dateOnly
        ? { dateStyle: "short" }
        : { dateStyle: "short", timeStyle: "short" }).format(date);
    }

    function renderHeaderNotices() {
      if (!noticesDialog) return;
      const list = noticesDialog.querySelector(".at-header-notices-list");
      list.replaceChildren();
      const alerts = activeHeaderAlerts();
      const activities = readNotices(activityKey);
      const entries = [
        ...alerts.map(item => ({ item, urgent: true })),
        ...activities.map(item => ({ item, urgent: false })),
      ];

      if (!entries.length) {
        const empty = document.createElement("p");
        empty.className = "at-header-notices-empty";
        empty.textContent = "Nenhuma notificação por enquanto.";
        list.append(empty);
      }

      entries.forEach(({ item, urgent }) => {
        const article = document.createElement("article");
        article.className = `at-header-notice${urgent ? " is-urgent" : ""}`;
        const category = document.createElement("strong");
        category.textContent = urgent ? "Alerta de frequência" : "Atividade do sistema";
        const message = document.createElement("p");
        message.textContent = item.message || (urgent
          ? "Aluno com faltas repetidas. Confira a aba Frequência."
          : "Atualização registrada nas turmas.");
        const time = document.createElement("time");
        time.textContent = noticeTime(item.date, urgent);
        article.append(category, message, time);
        list.append(article);
      });

      noticesDialog.querySelector("[data-mark-read]").disabled =
        !entries.some(({ item }) => !item.read);
    }

    function openHeaderNotices() {
      if (noticesDialog) return;
      closeYearMenu();
      closeProfile();
      const dialog = document.createElement("dialog");
      dialog.className = "at-header-notices";
      dialog.id = "at-header-notices";
      dialog.setAttribute("aria-labelledby", "at-header-notices-title");
      dialog.innerHTML = `
        <header class="at-header-notices-heading">
          <div>
            <h2 id="at-header-notices-title">Notificações</h2>
            <p>Alertas de frequência e atividades das turmas</p>
          </div>
          <button type="button" data-close-notices aria-label="Fechar notificações">×</button>
        </header>
        <div class="at-header-notices-list"></div>
        <footer class="at-header-notices-footer">
          <button type="button" data-mark-read>Marcar como lidas</button>
          <a href="../frequencia/frequencia.html">Ver Frequência →</a>
        </footer>
        <p class="at-header-notices-feedback" role="status"></p>`;

      noticesDialog = dialog;
      document.body.append(dialog);
      renderHeaderNotices();
      dialog.querySelector("[data-close-notices]").addEventListener("click", () => dialog.close());
      dialog.querySelector("[data-mark-read]").addEventListener("click", () => {
        try {
          const year = currentNoticeYear();
          localStorage.setItem(activityKey, JSON.stringify(
            readNotices(activityKey).map(item => ({ ...item, read: true }))
          ));
          localStorage.setItem(alertsKey, JSON.stringify(
            readNotices(alertsKey).map(item =>
              String(item.year || year) === year ? { ...item, read: true } : item
            )
          ));
          dialog.querySelector(".at-header-notices-feedback").textContent = "Notificações marcadas como lidas.";
        } catch {
          dialog.querySelector(".at-header-notices-feedback").textContent = "Não foi possível salvar o estado de leitura neste navegador.";
        }
        updateHeaderBell();
        renderHeaderNotices();
      });

      dialog.addEventListener("click", event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
      });
      dialog.addEventListener("close", () => {
        noticesDialog = null;
        dialog.remove();
        bell.setAttribute("aria-expanded", "false");
        bell.focus();
      });
      bell.setAttribute("aria-expanded", "true");
      dialog.showModal();
    }

    bell.dataset.headerNotices = "ready";
    bell.setAttribute("aria-haspopup", "dialog");
    bell.addEventListener("click", openHeaderNotices);
    document.addEventListener("alunotec:yearchange", () => {
      updateHeaderBell();
      renderHeaderNotices();
    });
    window.addEventListener("storage", event => {
      if (!event.key || [activityKey, alertsKey, "alunotecSchoolYear"].includes(event.key)) {
        updateHeaderBell();
        renderHeaderNotices();
      }
    });
    window.addEventListener("focus", updateHeaderBell);
    window.addEventListener("alunotec:frequency-updated", updateHeaderBell);
    updateHeaderBell();
  }

  /* ==========================================================
     FECHAMENTO GLOBAL
     Fecha menus ao clicar fora, pressionar Escape ou ampliar a janela.
  ========================================================== */
  document.addEventListener("click", (event) => {
    if (!yearDropdown.contains(event.target)) closeYearMenu();
    if (!profile.contains(event.target)) closeProfile();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const wasSidebarOpen = closeSidebar();
    closeYearMenu();
    closeProfile();
    if (wasSidebarOpen) menuButton.focus();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1000) closeSidebar();
  });

  document.getElementById("switchAccount").addEventListener("click", () => {
    window.location.href = "../index.html";
  });
  document.getElementById("logoutButton").addEventListener("click", () => {
    try {
      sessionStorage.removeItem("alunotecSession");
      localStorage.removeItem("alunotec_supabase_session_v1");
    } catch {}
    window.location.href = "../index.html";
  });

  window.AlunoTecShell = {
    closeSidebar,
    closeProfile,
    setYears,
    getYears: yearsFromSavedClasses,
    getClassYear(classId, fallback = "") {
      const item = getSavedClasses().find(
        (entry) => String(entry?.id) === String(classId),
      );
      return item ? normalizeClassYear(item) : String(fallback || "");
    },
    getYear: () => yearInput.value,
  };
})();
