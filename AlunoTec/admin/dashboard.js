/* ==========================================================
   ALUNOTEC | MAPA DE EDIÇÃO — LÓGICA DO PAINEL
   Áreas abaixo: atividades/notificações; utilitários e data; conexão e
   sincronização; menus/perfil; ano letivo e filtros; dados dos cartões,
   chamadas recentes e inicialização. Ctrl+F pelo nome da função ajuda
   a localizar uma ação. As chaves de armazenamento são contratos com
   os demais módulos: altere-as apenas junto com os módulos relacionados.
========================================================== */

"use strict";

/* ==========================================================
   ALUNOTEC | DASHBOARD ADMINISTRATIVO
   Controla dados, indicadores, navegação e menus da página inicial administrativa.
========================================================== */

document.addEventListener("DOMContentLoaded", () => {
  /* ==========================================================
     CONFIGURAÇÕES
     Define chaves de armazenamento, valores padrão e opções usadas pelo painel.
  ========================================================== */

  const LOGIN_PAGE = "../index.html";

  /* ==========================================================
     ELEMENTOS
     Reúne referências aos componentes HTML para atualizar a interface sem repetir buscas no documento.
  ========================================================== */

  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const menuButton = document.getElementById("menuButton");
  const sidebarClose = document.getElementById("sidebarClose");

  const profile = document.querySelector(".profile");
  const profileButton = document.getElementById("profileButton");
  const profileDropdown = document.getElementById("profileDropdown");

  const logoutButton = document.getElementById("logoutButton");
  const switchAccountButton = document.getElementById("switchAccount");

  const connectionStatus = document.getElementById("connectionStatus");

  const connectionTitle = document.getElementById("connectionTitle");

  const connectionSubtitle = document.getElementById("connectionSubtitle");

  const todayDate = document.getElementById("todayDate");
  const ACTIVITY_KEY = "alunotec_turmas_activity_v1";
  const activityBell = document.getElementById("activityBell");
  const todayActivitiesList = document.getElementById("todayActivitiesList");
  let activityDialog = null;

  function readClassActivities() {
    try {
      const items = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]");
      return Array.isArray(items) ? items : [];
    } catch (error) {
      return [];
    }
  }

  function updateActivityBell() {
    if (!activityBell) return;
    const badge = document.getElementById("activityBellCount");
    const unread = readClassActivities().filter((item) => !item.read).length;
    if (badge) {
      badge.textContent = unread > 99 ? "99+" : String(unread);
      badge.hidden = unread === 0;
    }
    activityBell.classList.toggle("has-activity", unread > 0);
    activityBell.setAttribute(
      "aria-label",
      unread
        ? `Notificações das turmas: ${unread} não lidas`
        : "Notificações das turmas",
    );
  }

  function closeActivityDialog() {
    if (!activityDialog) return;
    const dialog = activityDialog;
    activityDialog = null;
    dialog.close();
    dialog.remove();
    activityBell?.setAttribute("aria-expanded", "false");
  }

  function renderClassActivities(list) {
    if (!list) return;
    const activities = readClassActivities();
    list.replaceChildren();
    if (!activities.length) {
      const empty = document.createElement("p");
      empty.className = "activity-empty";
      empty.textContent = "Nenhuma notificação por enquanto.";
      list.append(empty);
      return;
    }
    activities.forEach((item) => {
      const row = document.createElement("article");
      row.className = "activity-item";
      const dot = document.createElement("span");
      dot.className = "activity-dot";
      const content = document.createElement("div");
      const message = document.createElement("p");
      message.textContent = item.message || "Alteração nas turmas.";
      const date = document.createElement("time");
      const parsedDate = new Date(item.date || Date.now());
      date.textContent = Number.isNaN(parsedDate.getTime())
        ? ""
        : new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          }).format(parsedDate);
      content.append(message, date);
      row.append(dot, content);
      list.append(row);
    });
  }

  function renderTodayActivities() {
    if (!todayActivitiesList) return;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const activities = readClassActivities().filter((item) => {
      const date = new Date(item.date || "");
      if (Number.isNaN(date.getTime())) return false;
      const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return localDate === today;
    });

    todayActivitiesList.replaceChildren();
    if (!activities.length) {
      const empty = document.createElement("p");
      empty.className = "activity-empty today-activity-empty";
      empty.textContent = "Nenhuma notificação hoje.";
      todayActivitiesList.append(empty);
      return;
    }

    activities.slice(0, 12).forEach((item) => {
      const row = document.createElement("article");
      row.className = "activity-item";
      const dot = document.createElement("span");
      dot.className = "activity-dot";
      const content = document.createElement("div");
      const message = document.createElement("p");
      message.textContent = item.message || "Alteração nas turmas.";
      const time = document.createElement("time");
      const date = new Date(item.date);
      time.textContent = new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
      content.append(message, time);
      row.append(dot, content);
      todayActivitiesList.append(row);
    });
  }
  function openActivityDialog() {
    if (activityDialog) {
      closeActivityDialog();
      return;
    }
    const activities = readClassActivities().map((item) => ({
      ...item,
      read: true,
    }));
    try {
      localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities));
    } catch (error) {}
    updateActivityBell();

    const dialog = document.createElement("dialog");
    dialog.className = "activity-dialog";
    dialog.innerHTML = `<header class="activity-heading">
            <span class="activity-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></span>
            <span><strong>Atividades das turmas</strong><small>Atualizações compartilhadas com a aba Turmas</small></span>
        </header>
        <div class="activity-list"></div>
        <footer class="activity-footer"><button type="button" class="activity-clear">Limpar notificações</button></footer>`;
    const list = dialog.querySelector(".activity-list");
    renderClassActivities(list);
    dialog.querySelector(".activity-clear").addEventListener("click", () => {
      try {
        localStorage.setItem(ACTIVITY_KEY, "[]");
      } catch (error) {}
      renderClassActivities(list);
      updateActivityBell();
      renderTodayActivities();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        closeActivityDialog();
    });
    dialog.addEventListener("close", () => {
      if (activityDialog === dialog) {
        activityDialog = null;
        dialog.remove();
      }
      activityBell?.setAttribute("aria-expanded", "false");
    });
    document.body.append(dialog);
    activityDialog = dialog;
    dialog.showModal();
    activityBell?.setAttribute("aria-expanded", "true");
  }

  activityBell?.addEventListener("click", openActivityDialog);
  updateActivityBell();
  renderTodayActivities();
  window.addEventListener("storage", (event) => {
    if (event.key === ACTIVITY_KEY) {
      updateActivityBell();
      renderTodayActivities();
      if (activityDialog)
        renderClassActivities(activityDialog.querySelector(".activity-list"));
    }
    if (event.key === "alunotec_turmas_v2") {
      renderSchoolYearOptions();
      populateDashboardClassOptions();
      updateDashboard();
    }
    if (event.key === "alunotec_frequencia_v1") {
      populateDashboardClassOptions();
      updateDashboard();
    }
    if (event.key === "alunotecSchoolYear") {
      renderSchoolYearOptions(event.newValue);
      populateDashboardClassOptions();
      updateDashboard();
    }
  });

  /* ==========================================================
     FUNÇÕES AUXILIARES
     Agrupa conversões, formatações e utilitários compartilhados pelas seções do painel.
  ========================================================== */

  function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR").format(value);
  }

  function escapeDashboardHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  }

  function calculatePercent(value, total) {
    if (!total) {
      return 0;
    }

    return Math.round((value / total) * 100);
  }

  function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  }

  /* ==========================================================
     DATA ATUAL
     Calcula e apresenta a data usada nos cartões e no resumo do dia.
  ========================================================== */

  function updateCurrentDate() {
    if (!todayDate) {
      return;
    }

    const now = new Date();

    const formatted = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(now);

    todayDate.textContent =
      formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  updateCurrentDate();

  /* ==========================================================
     STATUS DA INTERNET
     Monitora eventos de rede e mantém o indicador de conexão atualizado.
  ========================================================== */

  let internetReachable = null;

  function updateConnectionStatus() {
    if (!connectionStatus || !connectionTitle || !connectionSubtitle) return;
    const checking = navigator.onLine && internetReachable === null;
    const online = navigator.onLine && internetReachable === true;
    connectionStatus.classList.toggle("offline", !online && !checking);
    connectionStatus.classList.toggle("checking", checking);
    connectionTitle.textContent = online
      ? "Online"
      : checking
        ? "Verificando"
        : "Offline";
    connectionSubtitle.textContent = checking
      ? "Verificando acesso à internet…"
      : online
        ? "Salvo neste dispositivo • Supabase pendente"
        : "Alterações salvas neste dispositivo";
  }

  async function checkInternetConnection() {
    if (!navigator.onLine) {
      internetReachable = false;
      updateConnectionStatus();
      return;
    }
    internetReachable = null;
    updateConnectionStatus();
    try {
      await fetch("https://www.gstatic.com/generate_204", {
        mode: "no-cors",
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      internetReachable = true;
    } catch (error) {
      internetReachable = false;
    }
    updateConnectionStatus();
  }

  window.addEventListener("online", checkInternetConnection);
  connectionStatus?.addEventListener("click", checkInternetConnection);
  window.addEventListener("offline", () => {
    internetReachable = false;
    updateConnectionStatus();
  });
  checkInternetConnection();

  /* ==========================================================
     ÚLTIMA SINCRONIZAÇÃO
     Exibe o horário da última sincronização registrada pelo sistema.
  ========================================================== */

  function updateLastSync() {
    const now = new Date();

    const date = now.toLocaleDateString("pt-BR");

    const time = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    setText("lastSync", `Hoje, ${date} às ${time}`);
  }

  updateLastSync();

  /* ==========================================================
     SIDEBAR MOBILE
     Abre e fecha a navegação lateral em telas estreitas e mantém o estado acessível.
  ========================================================== */

  function openSidebar() {
    if (!sidebar) {
      return;
    }

    sidebar.classList.add("open");

    if (sidebarOverlay) {
      sidebarOverlay.classList.add("active");
    }
  }

  function closeSidebar() {
    if (!sidebar) {
      return;
    }

    sidebar.classList.remove("open");

    if (sidebarOverlay) {
      sidebarOverlay.classList.remove("active");
    }
  }

  if (menuButton) {
    menuButton.addEventListener("click", openSidebar);
  }

  if (sidebarClose) {
    sidebarClose.addEventListener("click", closeSidebar);
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", closeSidebar);
  }

  /* ==========================================================
     MENU DO PERFIL
     Controla abertura, fechamento e ações do menu da conta administrativa.
  ========================================================== */

  function closeProfileMenu() {
    if (!profile) {
      return;
    }

    profile.classList.remove("open");

    if (profileButton) {
      profileButton.setAttribute("aria-expanded", "false");
    }
  }

  if (profileButton && profile) {
    profileButton.addEventListener("click", (event) => {
      event.stopPropagation();

      closeAllDropdowns();

      const isOpen = profile.classList.toggle("open");

      profileButton.setAttribute("aria-expanded", String(isOpen));
    });
  }

  if (profileDropdown) {
    profileDropdown.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  }

  /* ==========================================================
     TROCAR CONTA
     Prepara a troca de conta preservando as demais contas salvas no navegador.
  ========================================================== */

  if (switchAccountButton) {
    switchAccountButton.addEventListener("click", () => {
      /*
       * Ao integrar a autenticação real, encerrar somente a sessão ativa
       * e preservar as demais contas salvas no navegador.
       */

      window.location.href = LOGIN_PAGE;
    });
  }

  /* ==========================================================
     SAIR
     Encerra a sessão ativa e direciona para a entrada do sistema.
  ========================================================== */

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      /*
       * O fluxo atual limpa a sessão local; a integração real também deverá
       * invalidar a sessão no serviço de autenticação, se houver.
       */

      try {
        sessionStorage.removeItem("alunotecSession");
      } catch (error) {
        console.warn("Não foi possível limpar a sessão.", error);
      }

      window.location.href = LOGIN_PAGE;
    });
  }

  /* ==========================================================
     DROPDOWNS PERSONALIZADOS
     Sincroniza campos nativos ocultos com menus visuais, opções e valor selecionado.
  ========================================================== */

  function closeAllDropdowns(exception = null) {
    document.querySelectorAll(".custom-select.open").forEach((dropdown) => {
      if (dropdown === exception) {
        return;
      }

      dropdown.classList.remove("open");

      const trigger = dropdown.querySelector(".custom-select-trigger");

      if (trigger) {
        trigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  function initializeCustomDropdown({
    containerId,
    hiddenInputId,
    displayId,
    onChange,
  }) {
    const dropdown = document.getElementById(containerId);

    const hiddenInput = document.getElementById(hiddenInputId);

    const display = document.getElementById(displayId);

    if (!dropdown) {
      return;
    }

    const trigger = dropdown.querySelector(".custom-select-trigger");

    if (!trigger) {
      return;
    }

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();

      closeProfileMenu();

      const wasOpen = dropdown.classList.contains("open");

      closeAllDropdowns(dropdown);

      if (wasOpen) {
        dropdown.classList.remove("open");

        trigger.setAttribute("aria-expanded", "false");
      } else {
        dropdown.classList.add("open");

        trigger.setAttribute("aria-expanded", "true");
      }
    });

    dropdown.addEventListener("click", (event) => {
      const option = event.target.closest(".custom-option");
      if (!option || !dropdown.contains(option)) return;
      const options = dropdown.querySelectorAll(".custom-option");
      event.stopPropagation();

      const value = option.dataset.value;

      const firstSpan = option.querySelector("span");

      const text = firstSpan
        ? firstSpan.textContent.trim()
        : option.textContent.trim();

      /*
       * Remove a marcação visual das opções anteriores e seus ícones
       * de seleção antes de aplicar a nova escolha.
       */

      options.forEach((item) => {
        item.classList.remove("selected");

        const oldCheck = item.querySelector(".option-check");

        if (oldCheck) {
          oldCheck.remove();
        }
      });

      /*
       * Marca a opção clicada e adiciona o indicador visual de seleção.
       */

      option.classList.add("selected");

      const check = document.createElement("span");

      check.className = "option-check";

      check.textContent = "✓";

      option.appendChild(check);

      /*
       * Atualiza o rótulo visível do seletor para mostrar a opção escolhida.
       */

      if (display) {
        display.textContent = text;
      }

      /*
       * Sincroniza o campo nativo oculto e dispara `change` para avisar
       * os demais controles que dependem desse valor.
       */

      if (hiddenInput) {
        hiddenInput.value = value;

        hiddenInput.dispatchEvent(
          new Event("change", {
            bubbles: true,
          }),
        );
      }

      /*
       * Fecha a lista de opções e atualiza `aria-expanded` no botão.
       */

      dropdown.classList.remove("open");

      trigger.setAttribute("aria-expanded", "false");

      /*
       * Notifica o componente que criou o seletor, quando ele forneceu
       * uma função de alteração.
       */

      if (typeof onChange === "function") {
        onChange(value, text);
      }
    });
  }

  /* ==========================================================
     ANO LETIVO
     Carrega, salva e propaga o ano escolhido para os componentes e páginas do sistema.
  ========================================================== */

  function changeSchoolYear(year, text) {
    /*
     * Persiste a seleção no navegador para as páginas atuais.
     * Quando a configuração administrativa for a fonte oficial, o valor
     * poderá ser carregado de lá.
     */

    try {
      localStorage.setItem("alunotecSchoolYear", year);
    } catch (error) {
      console.warn("Não foi possível salvar o ano letivo.", error);
    }

    console.log(`Ano letivo selecionado: ${text}`);

    /*
     * Ponto de integração para carregar dados separados por ano letivo,
     * quando essa divisão estiver disponível na fonte de dados.
     */

    populateDashboardClassOptions();
    updateDashboard();
  }

  function getRegisteredSchoolYears() {
    try {
      const saved = JSON.parse(
        localStorage.getItem("alunotec_turmas_v2") || "null",
      );
      const years = new Set([String(new Date().getFullYear())]);
      const selected = localStorage.getItem("alunotecSchoolYear");
      if (/^\d{4}$/.test(selected || "")) years.add(selected);
      ["base", "electives"].forEach((type) => {
        (Array.isArray(saved?.[type]) ? saved[type] : []).forEach((item) => {
          const year = String(item?.year || "").trim();
          if (/^\d{4}$/.test(year)) years.add(year);
        });
      });
      return [...years].sort((a, b) => Number(b) - Number(a));
    } catch (error) {
      return [];
    }
  }

  function renderSchoolYearOptions(preferredYear = null) {
    const dropdown = document.getElementById("yearDropdown");
    const menu = dropdown?.querySelector(".custom-select-menu");
    const hiddenInput = document.getElementById("yearSelect");
    const display = document.getElementById("selectedYear");
    if (!dropdown || !menu) return;

    let years = getRegisteredSchoolYears();
    if (!years.length) years = [String(new Date().getFullYear())];
    let savedYear = preferredYear;
    if (!savedYear) {
      try {
        savedYear = localStorage.getItem("alunotecSchoolYear");
      } catch (error) {}
    }
    const selectedYear = years.includes(String(savedYear))
      ? String(savedYear)
      : years[0];

    menu.replaceChildren();
    years.forEach((year) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className =
        "custom-option" + (year === selectedYear ? " selected" : "");
      option.dataset.value = year;
      option.setAttribute("role", "option");
      option.setAttribute(
        "aria-selected",
        year === selectedYear ? "true" : "false",
      );
      const label = document.createElement("span");
      label.textContent = year;
      option.append(label);
      if (year === selectedYear) {
        const check = document.createElement("span");
        check.className = "option-check";
        check.textContent = "✓";
        option.append(check);
      }
      menu.append(option);
    });

    if (display) display.textContent = selectedYear;
    if (hiddenInput) hiddenInput.value = selectedYear;
    try {
      localStorage.setItem("alunotecSchoolYear", selectedYear);
    } catch (error) {}
  }

  function initializeSchoolYearDropdown() {
    const dropdown = document.getElementById("yearDropdown");
    const trigger = dropdown?.querySelector(".custom-select-trigger");
    const menu = dropdown?.querySelector(".custom-select-menu");
    const hiddenInput = document.getElementById("yearSelect");
    const display = document.getElementById("selectedYear");
    if (!dropdown || !trigger || !menu) return;

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      closeProfileMenu();
      const wasOpen = dropdown.classList.contains("open");
      closeAllDropdowns(dropdown);
      dropdown.classList.toggle("open", !wasOpen);
      trigger.setAttribute("aria-expanded", String(!wasOpen));
    });

    menu.addEventListener("click", (event) => {
      const option = event.target.closest(".custom-option");
      if (!option || !menu.contains(option)) return;
      event.stopPropagation();
      const year = option.dataset.value;
      menu.querySelectorAll(".custom-option").forEach((item) => {
        item.classList.remove("selected");
        item.setAttribute("aria-selected", "false");
        item.querySelector(".option-check")?.remove();
      });
      option.classList.add("selected");
      option.setAttribute("aria-selected", "true");
      const check = document.createElement("span");
      check.className = "option-check";
      check.textContent = "✓";
      option.append(check);
      if (display) display.textContent = year;
      if (hiddenInput) {
        hiddenInput.value = year;
        hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
      dropdown.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      changeSchoolYear(year, year);
    });
  }

  renderSchoolYearOptions();
  initializeSchoolYearDropdown();

  /* ==========================================================
     FREQUÊNCIA DE HOJE
     Seleciona e conta os registros de presença correspondentes à data atual.
  ========================================================== */

  let attendanceFilter = "all";

  function changeAttendanceFilter(value, text) {
    attendanceFilter = value;

    setText(
      "attendanceFilterLabel",
      value === "all" ? "Visualizando todas as turmas" : `Visualizando ${text}`,
    );

    updateAttendancePanel();
  }

  initializeCustomDropdown({
    containerId: "attendanceDropdown",
    hiddenInputId: "attendanceClassSelect",
    displayId: "selectedAttendanceClass",
    onChange: changeAttendanceFilter,
  });

  /* ==========================================================
     SITUAÇÃO DAS TURMAS
     Classifica as turmas pelos dados disponíveis para alimentar os indicadores do painel.
  ========================================================== */

  let statusFilter = "all";

  function changeStatusFilter(value, text) {
    statusFilter = value;

    setText(
      "statusFilterLabel",
      value === "all" ? "Visualizando todas as turmas" : `Visualizando ${text}`,
    );

    updateClassesPanel();
  }

  initializeCustomDropdown({
    containerId: "statusDropdown",
    hiddenInputId: "statusClassSelect",
    displayId: "selectedStatusClass",
    onChange: changeStatusFilter,
  });

  /* ==========================================================
     SOMAR DADOS
     Calcula totais e percentuais a partir dos registros de chamada e das turmas.
  ========================================================== */

  function getAllClasses() {
    let savedClasses = {};
    let attendance = {};
    try {
      savedClasses = JSON.parse(
        localStorage.getItem("alunotec_turmas_v2") || "{}",
      );
      attendance = JSON.parse(
        localStorage.getItem("alunotec_frequencia_v1") || "{}",
      );
    } catch (error) {
      console.warn("Não foi possível ler os dados locais do painel.", error);
    }
    const year =
      localStorage.getItem("alunotecSchoolYear") ||
      String(new Date().getFullYear());
    const calls = Object.values(
      attendance && typeof attendance === "object" ? attendance : {},
    ).filter(
      (call) => call && String(call.year || call.date?.slice?.(0, 4)) === year,
    );
    const classes = Array.isArray(savedClasses?.base) ? savedClasses.base : [];
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    return classes
      .filter(
        (item) => item && item.id != null && String(item.year || year) === year,
      )
      .map((item) => {
        const records = calls.filter(
          (call) => String(call.classId) === String(item.id),
        );
        const latest = records
          .slice()
          .sort((a, b) =>
            String(b.date || "").localeCompare(String(a.date || "")),
          )[0];
        const studentRecords = Object.values(latest?.students || {}).filter(
          (record) => record && typeof record === "object" && record.status,
        );
        const present = studentRecords.filter(
          (record) => record.status === "presente",
        ).length;
        const absent = studentRecords.filter(
          (record) => record.status === "ausente",
        ).length;
        const justified = studentRecords.filter(
          (record) => record.status === "justificado",
        ).length;
        return {
          id: String(item.id),
          name: String(item.name || "Turma sem nome"),
          total: studentRecords.length,
          present,
          absent,
          justified,
          status:
            latest?.date === today
              ? "completed"
              : records.length
                ? "pending"
                : "not-started",
          shift: latest?.shift || item.shift || "Não informado",
          date: latest?.date || "",
        };
      });
  }

  function populateDashboardClassOptions() {
    const classes = getAllClasses();
    [
      {
        id: "attendanceDropdown",
        filter: "attendanceFilter",
        labelId: "selectedAttendanceClass",
        inputId: "attendanceClassSelect",
      },
      {
        id: "statusDropdown",
        filter: "statusFilter",
        labelId: "selectedStatusClass",
        inputId: "statusClassSelect",
      },
    ].forEach((config) => {
      const menu = document.querySelector(`#${config.id} .custom-select-menu`);
      if (!menu) return;
      const state =
        config.filter === "attendanceFilter" ? attendanceFilter : statusFilter;
      const selected = classes.some((item) => item.id === state)
        ? state
        : "all";
      if (config.filter === "attendanceFilter") attendanceFilter = selected;
      else statusFilter = selected;
      const options = [
        { id: "all", name: "Todas as turmas" },
        ...classes.map((item) => ({ id: item.id, name: item.name })),
      ];
      menu.replaceChildren();
      options.forEach((item) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = `custom-option${item.id === selected ? " selected" : ""}`;
        option.dataset.value = item.id;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(item.id === selected));
        const label = document.createElement("span");
        label.textContent = item.name;
        option.append(label);
        if (item.id === selected) {
          const check = document.createElement("span");
          check.className = "option-check";
          check.textContent = "✓";
          option.append(check);
        }
        menu.append(option);
      });
      const current = options.find((item) => item.id === selected);
      const display = document.getElementById(config.labelId);
      const input = document.getElementById(config.inputId);
      if (display) display.textContent = current.name;
      if (input) input.value = selected;
    });
  }

  function getAttendanceData(filter) {
    const classes = getAllClasses().filter(
      (item) => filter === "all" || item.id === filter,
    );

    return classes.reduce(
      (total, current) => {
        total.total += current.total;

        total.present += current.present;

        total.absent += current.absent;

        total.justified += current.justified;

        return total;
      },
      {
        total: 0,
        present: 0,
        absent: 0,
        justified: 0,
      },
    );
  }

  /* ==========================================================
     RESUMO GERAL
     Atualiza os números principais apresentados nos cartões do Dashboard.
  ========================================================== */

  function updateSummary() {
    const data = getAttendanceData("all");

    const frequency = calculatePercent(data.present, data.total);

    const absentPercent = calculatePercent(data.absent, data.total);

    setText("totalStudents", formatNumber(data.total));

    setText("presentStudents", formatNumber(data.present));

    setText("absentStudents", formatNumber(data.absent));

    setText("presentPercent", `${frequency}%`);

    setText("absentPercent", `${absentPercent}%`);

    setText("generalFrequency", `${frequency}%`);
  }

  /* ==========================================================
     GRÁFICO FREQUÊNCIA
     Converte os dados de presença em segmentos e rótulos para o gráfico.
  ========================================================== */

  function updateAttendancePanel() {
    const data = getAttendanceData(attendanceFilter);

    const presentPercent = calculatePercent(data.present, data.total);

    const absentPercent = calculatePercent(data.absent, data.total);

    const justifiedPercent = calculatePercent(data.justified, data.total);

    setText("attendancePresent", formatNumber(data.present));

    setText("attendanceAbsent", formatNumber(data.absent));

    setText("attendanceJustified", formatNumber(data.justified));

    setText("attendanceTotal", formatNumber(data.total));

    setText("attendancePresentPercent", `${presentPercent}%`);

    setText("attendanceAbsentPercent", `${absentPercent}%`);

    setText("attendanceJustifiedPercent", `${justifiedPercent}%`);

    setText("attendanceDonutPercent", `${presentPercent}%`);

    const donut = document.getElementById("attendanceDonut");

    if (!donut) {
      return;
    }

    /* ==========================================================
       Converte porcentagem para graus.
       Transforma uma porcentagem em ângulo para desenhar corretamente o gráfico circular.
    ========================================================== */

    const presentDegrees = presentPercent * 3.6;

    const absentDegrees = absentPercent * 3.6;

    const justifiedDegrees = justifiedPercent * 3.6;

    const absentEnd = presentDegrees + absentDegrees;

    const justifiedEnd = absentEnd + justifiedDegrees;

    donut.style.background = `
            conic-gradient(
                #00a663 0deg ${presentDegrees}deg,
                #ef4e4e ${presentDegrees}deg ${absentEnd}deg,
                #9eb2bc ${absentEnd}deg ${justifiedEnd}deg,
                #d5e1e6 ${justifiedEnd}deg 360deg
            )
            `;
  }

  /* ==========================================================
     SITUAÇÃO DAS TURMAS
     Classifica as turmas pelos dados disponíveis para alimentar os indicadores do painel.
  ========================================================== */

  function updateClassesPanel() {
    let classes;

    classes = getAllClasses().filter(
      (item) => statusFilter === "all" || item.id === statusFilter,
    );

    const total = classes.length;

    const completed = classes.filter(
      (item) => item.status === "completed",
    ).length;

    const pending = classes.filter((item) => item.status === "pending").length;

    const notStarted = classes.filter(
      (item) => item.status === "not-started",
    ).length;

    setText("classesTotal", total);

    setText("completedClasses", completed);

    setText("pendingClasses", pending);

    setText("notStartedClasses", notStarted);

    const donut = document.getElementById("classesDonut");

    if (!donut) {
      return;
    }

    if (!total) {
      donut.style.background = "#d5e1e6";

      return;
    }

    const completedDegrees = (completed / total) * 360;

    const pendingDegrees = (pending / total) * 360;

    const pendingEnd = completedDegrees + pendingDegrees;

    donut.style.background = `
            conic-gradient(
                #00a663 0deg ${completedDegrees}deg,
                #f7bc45 ${completedDegrees}deg ${pendingEnd}deg,
                #a8bbc5 ${pendingEnd}deg 360deg
            )
            `;
  }

  /* ==========================================================
     ÚLTIMAS CHAMADAS
     Monta as linhas das chamadas recentes e seus estados de processamento.
  ========================================================== */

  function getStatusLabel(status) {
    switch (status) {
      case "completed":
        return {
          text: "Concluída",
          className: "completed",
        };

      case "pending":
        return {
          text: "Pendente",
          className: "pending",
        };

      default:
        return {
          text: "Não iniciada",
          className: "not-started",
        };
    }
  }

  function updateRecentCalls() {
    const body = document.getElementById("recentCallsBody");

    if (!body) {
      return;
    }

    const classes = getAllClasses()
      .filter((item) => item.date)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 4);

    if (!classes.length) {
      body.innerHTML = `
                <tr>
                    <td colspan="6">
                        Nenhuma chamada registrada.
                    </td>
                </tr>
                `;

      return;
    }

    body.innerHTML = classes
      .map((item) => {
        const status = getStatusLabel(item.status);

        return `
                    <tr>

                        <td>
                            ${escapeDashboardHTML(item.name)}
                        </td>

                        <td>
                            ${escapeDashboardHTML(item.shift)}
                        </td>

                        <td>
                            ${new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR")}
                        </td>

                        <td>
                            ${item.present}
                        </td>

                        <td
                            style="
                                color:
                                ${item.absent > 0 ? "#ef4e4e" : "#31586c"};
                            "
                        >
                            ${item.absent}
                        </td>

                        <td>

                            <span
                                class="
                                    table-status
                                    ${status.className}
                                "
                            >

                                ${
                                  status.className === "completed"
                                    ? "✓"
                                    : status.className === "pending"
                                      ? "•"
                                      : "—"
                                }

                                ${status.text}

                            </span>

                        </td>

                    </tr>
                `;
      })
      .join("");
  }

  /* ==========================================================
     ESTILO DOS STATUS DA TABELA
     Adiciona estilos de contingência para os estados da tabela quando a folha complementar não está disponível.
  ========================================================== */

  function createTableStatusStyles() {
    if (document.getElementById("alunotec-table-status-style")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "alunotec-table-status-style";

    style.textContent = `

            .table-status {
                display: inline-flex;
                align-items: center;
                justify-content: center;

                min-width: 78px;

                padding: 4px 9px;

                border-radius: 999px;

                font-size: 8px;
                font-weight: 600;
            }

            .table-status.completed {
                color: #007c49;
                background: #ddf8ec;
                border: 1px solid #a9e7ca;
            }

            .table-status.pending {
                color: #9b6a00;
                background: #fff4d5;
                border: 1px solid #f3d37b;
            }

            .table-status.not-started {
                color: #607986;
                background: #edf2f4;
                border: 1px solid #d6e0e4;
            }

            `;

    document.head.appendChild(style);
  }

  createTableStatusStyles();

  /* ==========================================================
     ATUALIZAR DASHBOARD
     Recalcula os dados e redesenha os cartões, o gráfico e a tabela após mudanças no armazenamento.
  ========================================================== */

  function updateDashboard() {
    updateSummary();

    updateAttendancePanel();

    updateClassesPanel();

    updateRecentCalls();
  }

  populateDashboardClassOptions();
  updateDashboard();

  /* ==========================================================
     CLIQUE FORA DOS MENUS
     Fecha dropdowns abertos quando o usuário clica fora de seus limites.
  ========================================================== */

  document.addEventListener("click", (event) => {
    closeAllDropdowns();

    if (profile && !profile.contains(event.target)) {
      closeProfileMenu();
    }
  });

  /* ==========================================================
     ESC
     Fecha menus e diálogos abertos quando a tecla Escape é pressionada.
  ========================================================== */

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    closeAllDropdowns();

    closeProfileMenu();

    closeSidebar();
  });

  /* ==========================================================
     RESPONSIVIDADE
     Atualiza o comportamento dos menus quando a largura da tela muda.
  ========================================================== */

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1000) {
      closeSidebar();
    }
  });
});
