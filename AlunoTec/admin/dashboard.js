"use strict";

/* ==========================================================
   ALUNOTEC
   DASHBOARD ADMINISTRATIVO
   dashboard.js
========================================================== */

document.addEventListener("DOMContentLoaded", () => {
  /* ======================================================
       CONFIGURAÇÕES
    ====================================================== */

  const LOGIN_PAGE = "../index.html";

  const CURRENT_YEAR = 2026;

  /* ======================================================
       ELEMENTOS
    ====================================================== */

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
      updateDashboard();
    }
  });

  /* ======================================================
       DADOS DEMONSTRATIVOS DAS TURMAS

       Posteriormente estes dados poderão vir do banco
       de dados do AlunoTec.
    ====================================================== */

  const dashboardData = {
    turma01: {
      name: "Turma 01",
      total: 30,
      present: 28,
      absent: 2,
      justified: 0,
      status: "completed",
      shift: "Manhã",
    },

    turma02: {
      name: "Turma 02",
      total: 30,
      present: 26,
      absent: 4,
      justified: 0,
      status: "completed",
      shift: "Manhã",
    },

    turma03: {
      name: "Turma 03",
      total: 30,
      present: 24,
      absent: 6,
      justified: 0,
      status: "pending",
      shift: "Tarde",
    },

    turma04: {
      name: "Turma 04",
      total: 30,
      present: 27,
      absent: 3,
      justified: 0,
      status: "completed",
      shift: "Tarde",
    },

    turma05: {
      name: "Turma 05",
      total: 30,
      present: 29,
      absent: 1,
      justified: 0,
      status: "completed",
      shift: "Integral",
    },

    turma06: {
      name: "Turma 06",
      total: 30,
      present: 28,
      absent: 2,
      justified: 0,
      status: "completed",
      shift: "Integral",
    },

    turma07: {
      name: "Turma 07",
      total: 30,
      present: 27,
      absent: 3,
      justified: 0,
      status: "completed",
      shift: "Manhã",
    },

    turma08: {
      name: "Turma 08",
      total: 30,
      present: 26,
      absent: 4,
      justified: 0,
      status: "completed",
      shift: "Manhã",
    },

    turma09: {
      name: "Turma 09",
      total: 30,
      present: 0,
      absent: 0,
      justified: 0,
      status: "not-started",
      shift: "Tarde",
    },

    turma10: {
      name: "Turma 10",
      total: 30,
      present: 0,
      absent: 0,
      justified: 0,
      status: "not-started",
      shift: "Tarde",
    },
  };

  /* ======================================================
       FUNÇÕES AUXILIARES
    ====================================================== */

  function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR").format(value);
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

  /* ======================================================
       DATA ATUAL
    ====================================================== */

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

  /* ======================================================
       STATUS DA INTERNET
    ====================================================== */

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

  /* ======================================================
       ÚLTIMA SINCRONIZAÇÃO
    ====================================================== */

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

  /* ======================================================
       SIDEBAR MOBILE
    ====================================================== */

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

  /* ======================================================
       MENU DO PERFIL
    ====================================================== */

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

  /* ======================================================
       TROCAR CONTA
    ====================================================== */

  if (switchAccountButton) {
    switchAccountButton.addEventListener("click", () => {
      /*
       * Posteriormente podemos limpar apenas
       * a sessão ativa e manter as contas salvas.
       */

      window.location.href = LOGIN_PAGE;
    });
  }

  /* ======================================================
       SAIR
    ====================================================== */

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      /*
       * Quando conectarmos a autenticação real,
       * a limpeza da sessão será feita aqui.
       */

      try {
        sessionStorage.removeItem("alunotecSession");
      } catch (error) {
        console.warn("Não foi possível limpar a sessão.", error);
      }

      window.location.href = LOGIN_PAGE;
    });
  }

  /* ======================================================
       DROPDOWNS PERSONALIZADOS
    ====================================================== */

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

    const options = dropdown.querySelectorAll(".custom-option");

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

    options.forEach((option) => {
      option.addEventListener("click", (event) => {
        event.stopPropagation();

        const value = option.dataset.value;

        const firstSpan = option.querySelector("span");

        const text = firstSpan
          ? firstSpan.textContent.trim()
          : option.textContent.trim();

        /*
         * Remove seleção anterior.
         */

        options.forEach((item) => {
          item.classList.remove("selected");

          const oldCheck = item.querySelector(".option-check");

          if (oldCheck) {
            oldCheck.remove();
          }
        });

        /*
         * Nova seleção.
         */

        option.classList.add("selected");

        const check = document.createElement("span");

        check.className = "option-check";

        check.textContent = "✓";

        option.appendChild(check);

        /*
         * Atualiza texto.
         */

        if (display) {
          display.textContent = text;
        }

        /*
         * Atualiza input escondido.
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
         * Fecha menu.
         */

        dropdown.classList.remove("open");

        trigger.setAttribute("aria-expanded", "false");

        /*
         * Executa função específica.
         */

        if (typeof onChange === "function") {
          onChange(value, text);
        }
      });
    });
  }

  /* ======================================================
       ANO LETIVO
    ====================================================== */

  function changeSchoolYear(year, text) {
    /*
     * Salva localmente o ano selecionado.
     * Quando houver banco de dados, esta informação
     * poderá vir da configuração do administrador.
     */

    try {
      localStorage.setItem("alunotecSchoolYear", year);
    } catch (error) {
      console.warn("Não foi possível salvar o ano letivo.", error);
    }

    console.log(`Ano letivo selecionado: ${text}`);

    /*
     * Aqui futuramente carregaremos os dados
     * específicos do ano selecionado.
     */

    updateDashboard();
  }

  function getRegisteredSchoolYears() {
    try {
      const saved = JSON.parse(
        localStorage.getItem("alunotec_turmas_v2") || "null",
      );
      const years = new Set();
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
    if (!years.length) years = [String(CURRENT_YEAR)];
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

  /* ======================================================
       FREQUÊNCIA DE HOJE
    ====================================================== */

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

  /* ======================================================
       SITUAÇÃO DAS TURMAS
    ====================================================== */

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

  /* ======================================================
       SOMAR DADOS
    ====================================================== */

  function getAllClasses() {
    return Object.values(dashboardData);
  }

  function getAttendanceData(filter) {
    if (filter !== "all" && dashboardData[filter]) {
      return {
        ...dashboardData[filter],
      };
    }

    const classes = getAllClasses();

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

  /* ======================================================
       RESUMO GERAL
    ====================================================== */

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

  /* ======================================================
       GRÁFICO FREQUÊNCIA
    ====================================================== */

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

    /*
     * Converte porcentagem para graus.
     */

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

  /* ======================================================
       SITUAÇÃO DAS TURMAS
    ====================================================== */

  function updateClassesPanel() {
    let classes;

    if (statusFilter !== "all" && dashboardData[statusFilter]) {
      classes = [dashboardData[statusFilter]];
    } else {
      classes = getAllClasses();
    }

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

  /* ======================================================
       ÚLTIMAS CHAMADAS
    ====================================================== */

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
      .filter((item) => item.status !== "not-started")
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

    const date = new Date().toLocaleDateString("pt-BR");

    body.innerHTML = classes
      .map((item) => {
        const status = getStatusLabel(item.status);

        return `
                    <tr>

                        <td>
                            ${item.name}
                        </td>

                        <td>
                            ${item.shift}
                        </td>

                        <td>
                            ${date}
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

  /* ======================================================
       ESTILO DOS STATUS DA TABELA
       INSERIDO PELO JS PARA FUNCIONAR MESMO SEM CSS EXTRA
    ====================================================== */

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

  /* ======================================================
       ATUALIZAR DASHBOARD
    ====================================================== */

  function updateDashboard() {
    updateSummary();

    updateAttendancePanel();

    updateClassesPanel();

    updateRecentCalls();
  }

  updateDashboard();

  /* ======================================================
       CLIQUE FORA DOS MENUS
    ====================================================== */

  document.addEventListener("click", (event) => {
    closeAllDropdowns();

    if (profile && !profile.contains(event.target)) {
      closeProfileMenu();
    }
  });

  /* ======================================================
       ESC
    ====================================================== */

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    closeAllDropdowns();

    closeProfileMenu();

    closeSidebar();
  });

  /* ======================================================
       RESPONSIVIDADE
    ====================================================== */

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1000) {
      closeSidebar();
    }
  });
});
