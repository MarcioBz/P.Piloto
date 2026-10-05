(() => {
    "use strict";

    const TURMAS_KEY = "alunotec_turmas_v2";
    const ACTIVITY_KEY = "alunotec_turmas_activity_v1";
    const MOVEMENTS_KEY = "alunotec_alunos_remanejamentos_v1";
    const SESSION_KEY = "alunotec_supabase_session_v1";
    const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

    const $ = selector => document.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

    let activeTab = "Todos";
    let internetReachable = null;
    let toastTimer;

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
        })[char]);
    }

    function normalizeName(value) {
        return String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("pt-BR")
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    }

    function readClasses() {
        try {
            const data = JSON.parse(localStorage.getItem(TURMAS_KEY) || "{}");
            return {
                ...data,
                base: Array.isArray(data.base) ? data.base : [],
                electives: Array.isArray(data.electives) ? data.electives : []
            };
        } catch {
            return { base: [], electives: [] };
        }
    }

    function readMovements() {
        try {
            const data = JSON.parse(localStorage.getItem(MOVEMENTS_KEY) || "[]");
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    function readActivities() {
        try {
            const data = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]");
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    function allClasses() {
        const data = readClasses();
        return [
            ...data.base.map(item => ({ ...item, type: "base" })),
            ...data.electives.map(item => ({ ...item, type: "elective" }))
        ];
    }

    function findClass(id, data = readClasses()) {
        for (const type of ["base", "electives"]) {
            const item = data[type].find(entry => String(entry.id) === String(id));
            if (item) return { item, type };
        }
        return null;
    }

    function getStudentGroups() {
        const groups = new Map();
        const movements = readMovements();

        for (const classItem of allClasses()) {
            for (const student of Array.isArray(classItem.students) ? classItem.students : []) {
                const key = normalizeName(student.name);
                if (!key) continue;

                if (!groups.has(key)) {
                    groups.set(key, {
                        key,
                        name: student.name || "Aluno sem nome",
                        baseRecords: [],
                        electiveRecords: [],
                        movements: []
                    });
                }

                const group = groups.get(key);
                const record = {
                    ...student,
                    classId: classItem.id,
                    className: classItem.name || "Turma sem nome",
                    classYear: classItem.year || "",
                    grade: classItem.grade || "",
                    type: classItem.type
                };

                if (classItem.type === "base") group.baseRecords.push(record);
                else group.electiveRecords.push(record);
            }
        }

        for (const group of groups.values()) {
            const ids = new Set([
                ...group.baseRecords.map(item => String(item.id)),
                ...group.electiveRecords.map(item => String(item.id))
            ]);

            group.movements = movements.filter(item =>
                ids.has(String(item.studentId)) ||
                normalizeName(item.studentName) === group.key
            );
        }

        return [...groups.values()].map(group => {
            group.baseRecords.sort((a, b) => collator.compare(a.className, b.className));
            group.electiveRecords.sort((a, b) => collator.compare(a.className, b.className));
            group.movements.sort((a, b) => new Date(a.date) - new Date(b.date));

            const primary = group.baseRecords[0] || group.electiveRecords[0];
            const latestMovement = group.movements.filter(item => item.active !== false).at(-1) || null;
            const electiveNames = [...new Set(group.electiveRecords.map(item => item.className))];
            const source = group.baseRecords[0] || null;
            const fallback = primary;

            return {
                ...group,
                id: primary?.id || "",
                name: primary?.name || group.name,
                status: primary?.status || "Ativo",
                sourceName: source?.className || "—",
                sourceClassId: source?.classId || fallback?.classId || "",
                classYear: source?.classYear || fallback?.classYear || "",
                grade: source?.grade || fallback?.grade || "",
                electiveNames,
                latestMovement,
                frequencyClassName: latestMovement?.destinationClassName || source?.className || "—",
                frequencyClassId: latestMovement?.destinationClassId || source?.classId || "",
                moved: group.movements.length > 0,
                searchText: [
                    group.name,
                    ...group.baseRecords.map(item => `${item.className} ${item.whatsapp || ""}`),
                    ...group.electiveRecords.map(item => `${item.className} ${item.whatsapp || ""}`)
                ].join(" ").toLocaleLowerCase("pt-BR")
            };
        }).sort((a, b) =>
            collator.compare(a.sourceName, b.sourceName) || collator.compare(a.name, b.name)
        );
    }

    function showToast(message) {
        const toast = $("#toast");
        toast.textContent = message;
        toast.classList.add("visible");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove("visible"), 3000);
    }

    function recordActivity(message) {
        const activities = readActivities();
        activities.unshift({
            id: `aluno-${Date.now()}`,
            message,
            date: new Date().toISOString(),
            read: false
        });
        localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities.slice(0, 100)));
        updateBell();
    }

    function formatDate(value) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
    }

    function localDateKey(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Sao_Paulo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(date);
        const part = type => parts.find(item => item.type === type).value;
        return `${part("year")}-${part("month")}-${part("day")}`;
    }

    function todayKey() {
        return localDateKey(new Date());
    }

    function enhanceSelect(select) {
        if (select.dataset.enhanced === "true") {
            refreshSelect(select);
            return;
        }

        const wrapper = document.createElement("div");
        wrapper.className = "custom-select";
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);
        select.classList.add("custom-select-native");
        select.dataset.enhanced = "true";

        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "select-trigger";
        trigger.setAttribute("role", "combobox");
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");

        const menu = document.createElement("div");
        menu.className = "select-menu";
        menu.setAttribute("role", "listbox");

        wrapper.append(trigger, menu);
        select._customSelect = { wrapper, trigger, menu };

        trigger.addEventListener("click", () => {
            const open = !wrapper.classList.contains("open");
            closeSelectMenus();
            wrapper.classList.toggle("open", open);
            trigger.setAttribute("aria-expanded", String(open));
        });

        menu.addEventListener("click", event => {
            const option = event.target.closest("[data-option-value]");
            if (!option || option.disabled) return;

            select.value = option.dataset.optionValue;
            select.dispatchEvent(new Event("change", { bubbles: true }));
            wrapper.classList.remove("open");
            trigger.setAttribute("aria-expanded", "false");
        });

        select.addEventListener("change", () => refreshSelect(select));
        refreshSelect(select);
    }

    function refreshSelect(select) {
        const custom = select._customSelect;
        if (!custom) return;

        const selected = select.options[select.selectedIndex];
        custom.trigger.textContent = selected?.textContent || "Selecione";

        custom.menu.innerHTML = [...select.options].map(option =>
            `<button class="select-option" type="button" role="option"
                data-option-value="${escapeHtml(option.value)}"
                aria-selected="${option.selected}"
                ${option.disabled ? "disabled" : ""}>
                <span>${escapeHtml(option.textContent)}</span>
                ${option.selected ? '<span class="select-check" aria-hidden="true">✓</span>' : ""}
            </button>`
        ).join("");
    }

    function closeSelectMenus() {
        $$(".custom-select.open").forEach(wrapper => {
            wrapper.classList.remove("open");
            $(".select-trigger", wrapper)?.setAttribute("aria-expanded", "false");
        });
    }

    function enhanceAllSelects(root = document) {
        $$("select", root).forEach(enhanceSelect);
    }

    function fillFilters() {
        const data = readClasses();
        const baseClasses = data.base;
        const oldClass = $("#classFilter").value;
        const oldListYear = $("#listYearFilter").value;
        const oldYear = $("#yearFilter").value;

        $("#classFilter").innerHTML = `<option value="">Todas</option>` +
            baseClasses.map(item =>
                `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
            ).join("");

        const years = [...new Set(
            baseClasses.map(item => String(item.year || "")).filter(Boolean)
        )].sort().reverse();

        const yearOptions = years.map(year =>
            `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`
        ).join("");

        $("#listYearFilter").innerHTML = `<option value="">Todos</option>${yearOptions}`;
        $("#yearFilter").innerHTML = yearOptions ||
            `<option value="${new Date().getFullYear()}">${new Date().getFullYear()}</option>`;

        if (baseClasses.some(item => String(item.id) === oldClass)) $("#classFilter").value = oldClass;
        if (years.includes(oldListYear)) $("#listYearFilter").value = oldListYear;
        if (years.includes(oldYear)) $("#yearFilter").value = oldYear;

        enhanceAllSelects();
    }

    function isActive(student) {
        return student.status !== "Inativo";
    }

    function updateSummary(students) {
        const active = students.filter(isActive).length;
        const inactive = students.length - active;
        const moved = students.filter(student => student.moved).length;
        const percent = value => students.length
            ? `${((value / students.length) * 100).toFixed(1).replace(".", ",")}%`
            : "0%";

        $("#totalCount").textContent = students.length;
        $("#activeCount").textContent = active;
        $("#inactiveCount").textContent = inactive;
        $("#movedCount").textContent = moved;
        $("#activePercent").textContent = percent(active);
        $("#inactivePercent").textContent = percent(inactive);
        $("#movedPercent").textContent = percent(moved);
        $("#tabAll").textContent = students.length;
        $("#tabActive").textContent = active;
        $("#tabInactive").textContent = inactive;
        $("#tabMoved").textContent = moved;
    }

    function render() {
        fillFilters();

        const students = getStudentGroups();
        updateSummary(students);

        const term = $("#searchInput").value.trim().toLocaleLowerCase("pt-BR");
        const classId = $("#classFilter").value;
        const year = $("#listYearFilter").value;
        const status = $("#statusFilter").value;

        const filtered = students.filter(student => {
            const tabMatch = activeTab === "Todos" ||
                (activeTab === "Ativos" && isActive(student)) ||
                (activeTab === "Inativos" && !isActive(student)) ||
                (activeTab === "Remanejados" && student.moved);

            const statusMatch = !status ||
                (status === "Remanejado" ? student.moved : student.status === status);

            const classMatch = !classId ||
                student.baseRecords.some(item => String(item.classId) === classId);

            return tabMatch &&
                statusMatch &&
                classMatch &&
                (!year || String(student.classYear) === year) &&
                (!term || student.searchText.includes(term));
        });

        if (!filtered.length) {
            const message = students.length
                ? "Nenhum aluno corresponde aos filtros selecionados."
                : "Nenhum aluno cadastrado. Cadastre os alunos pela aba Turmas.";
            $("#studentRows").innerHTML = `<tr><td colspan="8" class="empty-state">${message}</td></tr>`;
            $("#storageNote").textContent = students.length
                ? ""
                : "Esta lista é preenchida pelos cadastros feitos na aba Turmas.";
            return;
        }

        $("#studentRows").innerHTML = filtered.map((student, index) => {
            const statusClass = !isActive(student) ? "inactive" : student.moved ? "moved" : "";
            const statusLabel = !isActive(student) ? "Inativo" : student.moved ? "Remanejado" : "Ativo";
            const electives = student.electiveNames.length
                ? student.electiveNames.map(name =>
                    `<span class="elective-tag">${escapeHtml(name)}</span>`
                ).join("")
                : "—";

            const movement = student.latestMovement
                ? `${escapeHtml(student.latestMovement.sourceClassName)} → ${escapeHtml(student.latestMovement.destinationClassName)}<small>${formatDate(student.latestMovement.date)}</small>`
                : escapeHtml(student.sourceName);

            return `<tr>
                <td>${index + 1}</td>
                <td class="student-name">${escapeHtml(student.name)}</td>
                <td>${escapeHtml(student.sourceName)}</td>
                <td><div class="elective-tags">${electives}</div></td>
                <td>${escapeHtml(student.grade || "—")}</td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td class="movement-detail">${movement}</td>
                <td><div class="actions">
                    <button class="icon-button" data-action="view" data-key="${escapeHtml(student.key)}" title="Visualizar aluno" aria-label="Visualizar aluno"><svg><use href="#i-eye"></use></svg></button>
                    <button class="icon-button" data-action="transfer" data-key="${escapeHtml(student.key)}" title="Remanejar aluno" aria-label="Remanejar aluno"><svg><use href="#i-transfer"></use></svg></button>
                </div></td>
            </tr>`;
        }).join("");

        $("#storageNote").textContent = "A turma de origem continua registrada. A frequência considera a turma de destino após o remanejamento.";
    }

    function showDialog(content) {
        $("#dialogBox").innerHTML = content;
        enhanceAllSelects($("#dialogBox"));
        $("#appDialog").showModal();
    }

    function showStudent(student) {
        const electives = student.electiveNames.length
            ? student.electiveNames.map(escapeHtml).join(", ")
            : "Nenhuma eletiva vinculada";

        const history = student.movements.length
            ? student.movements.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).map(item =>
                `<div class="history-item"><strong>${escapeHtml(item.sourceClassName)} → ${escapeHtml(item.destinationClassName)}</strong><small>${new Date(item.date).toLocaleString("pt-BR")}</small></div>`
            ).join("")
            : `<div class="history-item">Nenhum remanejamento registrado.</div>`;

        showDialog(`<button type="button" class="dialog-close" data-close>×</button>
            <h2>${escapeHtml(student.name)}</h2>
            <p>Informações consolidadas do aluno.</p>
            <div class="detail-list">
                <span><strong>Turma de origem:</strong> ${escapeHtml(student.sourceName)}</span>
                <span><strong>Turma considerada na frequência:</strong> ${escapeHtml(student.frequencyClassName)}</span>
                <span><strong>Eletiva(s) vinculada(s):</strong> ${electives}</span>
                <span><strong>Ano letivo:</strong> ${escapeHtml(student.classYear || "—")}</span>
                <span><strong>Ano/série:</strong> ${escapeHtml(student.grade || "—")}</span>
                <span><strong>Status:</strong> ${escapeHtml(student.status)}</span>
            </div>
            <h3>Histórico de remanejamentos</h3>
            <div class="history-list">${history}</div>
            <div class="dialog-actions"><button type="button" class="button primary" data-close>Fechar</button></div>`);
    }

    function showTransfer(student) {
        const data = readClasses();
        const origin = student.baseRecords[0] || student.electiveRecords[0];
        if (!origin) return;

        const collection = student.baseRecords.length ? data.base : data.electives;
        const destinations = collection.filter(item => String(item.id) !== String(origin.classId));

        if (!destinations.length) {
            showToast(student.baseRecords.length
                ? "Cadastre outra turma da Base Comum para remanejar este aluno."
                : "Cadastre outra eletiva para transferir este aluno.");
            return;
        }

        const options = destinations.map(item =>
            `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
        ).join("");

        showDialog(`<button type="button" class="dialog-close" data-close>×</button>
            <h2>Remanejar aluno</h2>
            <p><strong>${escapeHtml(student.name)}</strong><br>Turma de origem: ${escapeHtml(origin.className)}</p>
            <p class="transfer-note">O aluno permanecerá cadastrado na turma de origem. A frequência será considerada na turma de destino.</p>
            <form id="transferForm" class="form-grid">
                <label>Turma de destino
                    <select name="destinationId" required>
                        <option value="">Selecione uma turma</option>${options}
                    </select>
                </label>
                <div class="dialog-actions">
                    <button type="button" class="button secondary" data-close>Cancelar</button>
                    <button class="button primary" type="submit">Confirmar remanejamento</button>
                </div>
                <input type="hidden" name="studentId" value="${escapeHtml(origin.id)}">
                <input type="hidden" name="studentName" value="${escapeHtml(student.name)}">
                <input type="hidden" name="sourceId" value="${escapeHtml(origin.classId)}">
            </form>`);
    }

    function handleTransfer(event) {
        if (event.target.id !== "transferForm") return;
        event.preventDefault();

        const form = new FormData(event.target);
        const data = readClasses();
        const studentId = String(form.get("studentId") || "");
        const sourceId = String(form.get("sourceId") || "");
        const destinationId = String(form.get("destinationId") || "");
        const source = findClass(sourceId, data);
        const destination = findClass(destinationId, data);

        if (!source || !destination || source.type !== destination.type || sourceId === destinationId) {
            showToast("Selecione uma turma de destino válida.");
            return;
        }

        const student = (source.item.students || []).find(item => String(item.id) === studentId);
        if (!student) {
            showToast("Não foi possível localizar o aluno na turma de origem.");
            return;
        }

        const movements = readMovements();
        movements.forEach(item => {
            if (String(item.studentId) === studentId) item.active = false;
        });

        movements.push({
            id: `movement-${Date.now()}`,
            studentId,
            studentName: student.name,
            sourceClassId: sourceId,
            sourceClassName: source.item.name,
            destinationClassId: destinationId,
            destinationClassName: destination.item.name,
            date: new Date().toISOString(),
            active: true
        });

        localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(movements));
        recordActivity(`${student.name} remanejado(a) de ${source.item.name} para ${destination.item.name}.`);
        $("#appDialog").close();
        render();
        showToast("Remanejamento registrado. O aluno continua na turma de origem.");
    }

    function showNotifications() {
        const items = readActivities()
            .filter(item => localDateKey(item.date || item.createdAt) === todayKey())
            .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

        $("#notificationList").innerHTML = items.length
            ? items.map(item => {
                const date = new Date(item.date || item.createdAt);
                const time = Number.isNaN(date.getTime())
                    ? ""
                    : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                return `<article class="notification-item">${escapeHtml(item.message || "Atividade registrada")}<time>${time}</time></article>`;
            }).join("")
            : `<p class="notification-empty">Nenhuma notificação hoje.</p>`;

        $("#notificationDialog").showModal();
    }

    function updateBell() {
        const count = readActivities().filter(item =>
            localDateKey(item.date || item.createdAt) === todayKey()
        ).length;
        $("#bellCount").textContent = count;
        $("#bellCount").hidden = count === 0;
    }

    function localDateKey(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Sao_Paulo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(date);
        const part = type => parts.find(item => item.type === type).value;
        return `${part("year")}-${part("month")}-${part("day")}`;
    }

    function todayKey() {
        return localDateKey(new Date());
    }

    function updateConnectionStatus() {
        const button = $("#connectionButton");
        const checking = navigator.onLine && internetReachable === null;
        const online = navigator.onLine && internetReachable === true;

        button.classList.toggle("offline", !online && !checking);
        button.classList.toggle("checking", checking);
        $("#connectionText").textContent = online ? "Online" : checking ? "Verificando" : "Offline";
        $("#connectionSubtitle").textContent = checking
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
                signal: AbortSignal.timeout(5000)
            });
            internetReachable = true;
        } catch {
            internetReachable = false;
        }

        updateConnectionStatus();
    }

    $("#studentRows").addEventListener("click", event => {
        const button = event.target.closest("[data-action]");
        if (!button) return;

        const student = getStudentGroups().find(item => item.key === button.dataset.key);
        if (!student) return;

        if (button.dataset.action === "view") showStudent(student);
        if (button.dataset.action === "transfer") showTransfer(student);
    });

    $("#dialogBox").addEventListener("click", event => {
        if (event.target.closest("[data-close]")) $("#appDialog").close();
    });

    $("#dialogBox").addEventListener("submit", handleTransfer);

    $("#appDialog").addEventListener("click", event => {
        if (event.target === $("#appDialog")) $("#appDialog").close();
    });

    $("#searchInput").addEventListener("input", render);
    $("#classFilter").addEventListener("change", render);
    $("#listYearFilter").addEventListener("change", render);
    $("#yearFilter").addEventListener("change", render);
    $("#statusFilter").addEventListener("change", render);

    $(".tabs").addEventListener("click", event => {
        const button = event.target.closest("[data-tab]");
        if (!button) return;
        activeTab = button.dataset.tab;
        $$(".tab").forEach(tab => tab.classList.toggle("active", tab === button));
        render();
    });

    $("#bellButton").addEventListener("click", showNotifications);
    $$(".notification-dialog [data-close-notifications]").forEach(button =>
        button.addEventListener("click", () => $("#notificationDialog").close())
    );

    $("#notificationDialog").addEventListener("click", event => {
        if (event.target === $("#notificationDialog")) $("#notificationDialog").close();
    });

    $("#clearNotifications").addEventListener("click", () => {
        localStorage.setItem(ACTIVITY_KEY, "[]");
        $("#notificationList").innerHTML = `<p class="notification-empty">Nenhuma notificação hoje.</p>`;
        updateBell();
        showToast("Notificações limpas.");
    });

    $("#profileButton").addEventListener("click", () => {
        const menu = $("#accountMenu");
        const isOpening = menu.hidden;
        menu.hidden = !isOpening;
        $("#profileButton").setAttribute("aria-expanded", String(isOpening));
    });

    $("#switchAccount").addEventListener("click", () => {
        window.location.href = "../index.html";
    });

    $("#logoutButton").addEventListener("click", () => {
        sessionStorage.removeItem("alunotecSession");
        localStorage.removeItem(SESSION_KEY);
        window.location.href = "../index.html";
    });

    $("#connectionButton").addEventListener("click", checkInternetConnection);

    document.addEventListener("click", event => {
        if (!event.target.closest(".account-wrap")) {
            $("#accountMenu").hidden = true;
            $("#profileButton").setAttribute("aria-expanded", "false");
        }
        if (!event.target.closest(".custom-select")) closeSelectMenus();
    });

    window.addEventListener("online", checkInternetConnection);
    window.addEventListener("offline", () => {
        internetReachable = false;
        updateConnectionStatus();
    });

    window.addEventListener("storage", event => {
        if (!event.key || [TURMAS_KEY, ACTIVITY_KEY, MOVEMENTS_KEY].includes(event.key)) {
            render();
            updateBell();
        }
    });

    window.AlunoTecAlunos = {
        getFrequencyClass(studentId, originalClassId) {
            return readMovements()
                .filter(item => String(item.studentId) === String(studentId) && item.active !== false)
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .at(-1)?.destinationClassId || originalClassId;
        }
    };

    updateConnectionStatus();
    checkInternetConnection();
    render();
    updateBell();
})();