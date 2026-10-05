/* =========================================================
   ALUNOTEC - TURMAS
   script.js
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       CONFIGURAÇÕES
    ===================================================== */

    const STORAGE_KEY = "alunotec_turmas_v2";
    const PENDING_SYNC_KEY = "alunotec_turmas_pending_sync_v1";
    const SYNC_STATE_KEY = "alunotec_turmas_sync_state_v1";
    const SUPABASE_URL = "";
    const SUPABASE_ANON_KEY = "";
    const SUPABASE_TABLE = "alunotec_turmas";
    const SUPABASE_SESSION_KEY = "alunotec_supabase_session_v1";
    let syncInProgress = false;
    const ACTIVITY_KEY = "alunotec_turmas_activity_v1";

    let internetClock = null;
    const internetTimeReady = (async () => {
        try {
            const response = await fetch("https://worldtimeapi.org/api/timezone/America/Sao_Paulo", {cache: "no-store", signal: AbortSignal.timeout(5000)});
            if (!response.ok) throw new Error("Horário indisponível");
            const result = await response.json();
            const timestamp = Date.parse(result.datetime);
            if (!Number.isFinite(timestamp)) throw new Error("Horário inválido");
            internetClock = {timestamp, elapsed: performance.now()};
        } catch (error) {
            console.info("Não foi possível consultar o horário da internet.");
        }
    })();

    async function automaticCreationDate() {
        await internetTimeReady;
        const current = internetClock
            ? new Date(internetClock.timestamp + performance.now() - internetClock.elapsed)
            : new Date();
        if (!internetClock) showToast("Sem acesso ao horário da internet: usada a data do dispositivo.", "warning");
        const parts = new Intl.DateTimeFormat("en-US", {timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(current);
        const value = (type) => parts.find(part => part.type === type).value;
        return value("year") + "-" + value("month") + "-" + value("day");
    }

    const CURRENT_YEAR = String(new Date().getFullYear());

    const state = {
        activeTab: "base",
        openedClassId: null,
        openedClassType: null,
        editingStudentId: null,

        data: {
            base: [],
            electives: []
        },

        calendars: {
            base: new Date(),
            elective: new Date()
        }
    };


    /* =====================================================
       HELPERS
    ===================================================== */

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => [...document.querySelectorAll(selector)];

    const byId = (id) => document.getElementById(id);

    let internetReachable = null;
    function getSupabaseSession(){try{return JSON.parse(localStorage.getItem(SUPABASE_SESSION_KEY)||"null")}catch{return null}}
    function supabaseIsConfigured(){try{const url=new URL(SUPABASE_URL);return url.protocol==="https:"&&url.hostname.endsWith(".supabase.co")&&!!SUPABASE_ANON_KEY}catch{return false}}
    function updateConnectionStatus(){
        const title=byId("connectionTitle"),text=byId("connectionText"),badge=byId("connection");
        if(!title||!text)return;
        const online=navigator.onLine&&internetReachable===true;
        const checking=navigator.onLine&&internetReachable===null;
        const pending=!!localStorage.getItem(PENDING_SYNC_KEY);
        const session=getSupabaseSession();
        title.textContent=online?"Online":checking?"Verificando":"Offline";
        if(checking)text.textContent="Verificando acesso à internet…";
        else if(!online)text.textContent=pending?"Alterações guardadas neste dispositivo":"Trabalhando offline";
        else if(!supabaseIsConfigured())text.textContent=pending?"Salvo neste dispositivo • Supabase pendente":"Servidor de sincronização não configurado";
        else if(!session)text.textContent="Conecte a conta para sincronizar";
        else if(localStorage.getItem(SYNC_STATE_KEY)==="error")text.textContent="Sincronização com erro • clique para tentar";
        else if(pending)text.textContent="Sincronização pendente";
        else text.textContent=localStorage.getItem(SYNC_STATE_KEY)==="synced"?"Sincronizado com Supabase":"Conectado • preparando sincronização";
        badge?.classList.toggle("offline",!online&&!checking);
        badge?.classList.toggle("checking",checking);
    }
    async function checkInternetConnection(){
        if(!navigator.onLine){internetReachable=false;updateConnectionStatus();return;}
        internetReachable=null;updateConnectionStatus();
        try{await fetch("https://www.gstatic.com/generate_204",{mode:"no-cors",cache:"no-store",signal:AbortSignal.timeout(5000)});internetReachable=true;}catch{internetReachable=false;}
        updateConnectionStatus();
        if(internetReachable)syncWithSupabase();
    }
    window.addEventListener("online",checkInternetConnection);
    window.addEventListener("offline",()=>{internetReachable=false;updateConnectionStatus();});
    checkInternetConnection();
    if("serviceWorker" in navigator && (location.protocol==="https:" || location.hostname==="localhost"))navigator.serviceWorker.register("./service-worker.js").catch(error=>console.warn("Cache offline indisponível.",error));

    function generateId(prefix = "id") {
        return `${prefix}_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 9)}`;
    }

    function escapeHTML(value = "") {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function normalizeText(value = "") {
        return String(value)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    }

    function formatDateBR(dateString) {
        if (!dateString) return "—";

        const [year, month, day] = dateString.split("-");

        if (!year || !month || !day) return dateString;

        return `${day}/${month}/${year}`;
    }

    function dateToInputValue(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function formatWhatsapp(value = "") {
        const digits = String(value).replace(/\D/g, "").slice(0, 11);

        if (digits.length <= 2) {
            return digits;
        }

        if (digits.length <= 7) {
            return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        }

        if (digits.length <= 10) {
            return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
        }

        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }

    function whatsappURL(value = "") {
        const digits = String(value).replace(/\D/g, "");

        if (!digits) return "#";

        const number = digits.startsWith("55")
            ? digits
            : `55${digits}`;

        return `https://wa.me/${number}`;
    }

    function getActiveStudents(item) {
        if (!item || !Array.isArray(item.students)) return [];

        return item.students.filter(
            (student) => student.status !== "Inativo"
        );
    }


    /* =====================================================
       LOCAL STORAGE
    ===================================================== */

    function loadData() {

        try {

            const saved = localStorage.getItem(STORAGE_KEY);

            /*
             * IMPORTANTE:
             * Não existem mais turmas/eletivas padrão.
             *
             * Se não existir armazenamento do AlunoTec v2,
             * o sistema começa vazio.
             */

            if (!saved) {

                state.data = {
                    base: [],
                    electives: []
                };

                saveData();

                return;
            }

            const parsed = JSON.parse(saved);

            state.data.base = Array.isArray(parsed?.base)
                ? parsed.base
                : [];

            state.data.electives = Array.isArray(parsed?.electives)
                ? parsed.electives
                : [];

            normalizeSavedData();

        } catch (error) {

            console.error(
                "Erro ao carregar dados:",
                error
            );

            state.data = {
                base: [],
                electives: []
            };
        }
    }

    function normalizeSavedData() {

        ["base", "electives"].forEach((type) => {

            state.data[type] = state.data[type].map((item) => ({
                ...item,

                id:
                    item.id ||
                    generateId(type),

                students:
                    Array.isArray(item.students)
                        ? item.students.map((student) => ({
                            ...student,

                            id:
                                student.id ||
                                generateId("student"),

                            status:
                                student.status ||
                                "Ativo"
                        }))
                        : []
            }));

        });

        saveData();
    }

    let activityDialog=null;
    const activityBell=byId("activityBell");
    function readActivities(){try{const x=JSON.parse(localStorage.getItem(ACTIVITY_KEY)||"[]");return Array.isArray(x)?x:[]}catch{return []}}
    function updateActivityBell(){if(!activityBell)return;const count=byId("activityBellCount");const unread=readActivities().filter(x=>!x.read).length;if(count){count.textContent=unread>99?"99+":String(unread);count.hidden=!unread}activityBell.classList.toggle("has-activity",unread>0);activityBell.setAttribute("aria-label",unread?"Notificações das turmas: "+unread+" não lidas":"Notificações das turmas")}
    function recordActivity(message){const items=readActivities();items.unshift({id:generateId("notice"),message,date:new Date().toISOString(),read:false});localStorage.setItem(ACTIVITY_KEY,JSON.stringify(items.slice(0,100)));updateActivityBell()}
    function describeChanges(before,after){
        const messages=[],classes=new Map(),students=new Map();
        const collect=data=>{const c=new Map(),s=new Map();["base","electives"].forEach(type=>(data?.[type]||[]).forEach(item=>{c.set(item.id,{...item,_type:type});(item.students||[]).forEach(st=>s.set(st.id,{student:st,classId:item.id,className:item.name}))}));return{classes:c,students:s}};
        const old=collect(before),now=collect(after),label=type=>type==="base"?"turma da Base Comum":"Eletiva";
        for(const [id,item] of now.classes){const prev=old.classes.get(id);if(!prev)messages.push(label(item._type)+" criada: "+item.name+".");else{const clean=x=>{x={...x};delete x.students;delete x._type;return JSON.stringify(x)};if(clean(prev)!==clean(item))messages.push(label(item._type)+" alterada: "+item.name+".")}}
        for(const [id,item] of old.classes)if(!now.classes.has(id))messages.push(label(item._type)+" excluída: "+item.name+".");
        for(const [id,entry] of old.students){const current=now.students.get(id);if(!current)continue;if(entry.classId!==current.classId)messages.push(entry.student.name+" transferido(a) de "+entry.className+" para "+current.className+".");else if(JSON.stringify(entry.student)!==JSON.stringify(current.student))messages.push(entry.student.name+": "+(entry.student.status!==current.student.status?"status alterado para "+current.student.status:"dados atualizados")+" em "+current.className+".")}
        for(const [id,entry] of now.students)if(!old.students.has(id)){const wasCopied=[...old.students.values()].some(x=>normalizeText(x.student.name)===normalizeText(entry.student.name));messages.push(entry.student.name+(wasCopied?" copiado(a) para ":" cadastrado(a) em ")+entry.className+".")}
        for(const [id,entry] of old.students)if(!now.students.has(id))messages.push(entry.student.name+" excluído(a) de "+entry.className+".");
        return messages;
    }

    function openSupabaseLogin(){
        if(!supabaseIsConfigured()){appDialog({title:"Supabase ainda não configurado",type:"warning",message:"O modo offline já guarda as alterações neste dispositivo. Para ativar a sincronização, crie o projeto Supabase, execute o arquivo supabase-schema.sql e informe aqui a URL e a chave pública do projeto no início do script.js."});return}
        const dialog=document.createElement("dialog");dialog.className="alunotec-notice sync-login-dialog";
        dialog.innerHTML='<div class="notice-symbol">↻</div><h2>Conectar sincronização</h2><p>Entre com a conta administradora do Supabase.</p><form><label>E-mail<input name="email" type="email" autocomplete="username" required></label><label>Senha<input name="password" type="password" autocomplete="current-password" required></label><p class="sync-error" aria-live="polite"></p><div class="notice-actions"><button type="button" class="notice-cancel">Cancelar</button><button type="submit" class="notice-confirm">Conectar</button></div></form>';
        const form=dialog.querySelector("form"),error=dialog.querySelector(".sync-error");
        dialog.querySelector(".notice-cancel").onclick=()=>{dialog.close();dialog.remove()};
        dialog.addEventListener("cancel",event=>{event.preventDefault();dialog.close();dialog.remove()});
        form.addEventListener("submit",async event=>{
            event.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent="Conectando…";error.textContent="";
            try{
                const response=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"apikey":SUPABASE_ANON_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:form.elements.email.value.trim(),password:form.elements.password.value})});
                const result=await response.json();if(!response.ok)throw new Error(result.msg||result.message||"Confira o e-mail e a senha.");
                localStorage.setItem(SUPABASE_SESSION_KEY,JSON.stringify({access_token:result.access_token,refresh_token:result.refresh_token,user:result.user,expires_at:Date.now()+result.expires_in*1000}));
                dialog.close();dialog.remove();await syncWithSupabase();
            }catch(e){error.textContent=e.message||"Não foi possível conectar.";button.disabled=false;button.textContent="Conectar"}
        });
        document.body.append(dialog);dialog.showModal();form.elements.email.focus();
    }

    async function refreshSupabaseSession(){
        let session=getSupabaseSession();if(!session)return null;
        if(session.expires_at>Date.now()+60000)return session;
        if(!session.refresh_token)return null;
        const response=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{"apikey":SUPABASE_ANON_KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:session.refresh_token})});
        const next=await response.json();if(!response.ok)throw new Error("A sessão expirou. Conecte novamente.");
        session={access_token:next.access_token,refresh_token:next.refresh_token,user:next.user,expires_at:Date.now()+next.expires_in*1000};
        localStorage.setItem(SUPABASE_SESSION_KEY,JSON.stringify(session));return session;
    }

    async function syncWithSupabase(){
        if(syncInProgress||!navigator.onLine||internetReachable!==true||!supabaseIsConfigured())return;
        syncInProgress=true;updateConnectionStatus();
        try{
            const session=await refreshSupabaseSession();if(!session){updateConnectionStatus();return}
            const headers={"apikey":SUPABASE_ANON_KEY,"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"};
            const endpoint=SUPABASE_URL+"/rest/v1/"+SUPABASE_TABLE+"?owner_id=eq."+encodeURIComponent(session.user.id)+"&select=payload,updated_at";
            const response=await fetch(endpoint,{headers,cache:"no-store"});const rows=await response.json();
            if(!response.ok)throw new Error(rows.message||"Falha ao consultar os dados online.");
            const pending=JSON.parse(localStorage.getItem(PENDING_SYNC_KEY)||"null");
            if(pending&&rows[0]&&Date.parse(rows[0].updated_at)>Date.parse(pending.savedAt)){
                localStorage.setItem("alunotec_turmas_remote_conflict_v1",JSON.stringify({remote:rows[0],local:pending}));
                appDialog({title:"Alterações online mais recentes",type:"warning",message:"Há alterações feitas por outro dispositivo depois destas alterações offline. Seus dados locais foram preservados e a sincronização foi pausada para evitar apagar informações. Quando houver uma versão mais nova do aplicativo, você poderá comparar as versões."});
                return;
            }
            if(pending){
                const upload=await fetch(SUPABASE_URL+"/rest/v1/"+SUPABASE_TABLE+"?on_conflict=owner_id",{method:"POST",headers:{...headers,"Prefer":"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({owner_id:session.user.id,payload:pending.data,updated_at:new Date().toISOString()})});
                if(!upload.ok){const error=await upload.json();throw new Error(error.message||"Não foi possível enviar os dados.");}
                localStorage.removeItem(PENDING_SYNC_KEY);localStorage.removeItem("alunotec_turmas_remote_conflict_v1");
            }else if(rows[0]?.payload){
                state.data={base:Array.isArray(rows[0].payload.base)?rows[0].payload.base:[],electives:Array.isArray(rows[0].payload.electives)?rows[0].payload.electives:[]};
                localStorage.setItem(STORAGE_KEY,JSON.stringify(state.data));normalizeSavedData();renderTables();updateSummary();
            }else{
                const seed=await fetch(SUPABASE_URL+"/rest/v1/"+SUPABASE_TABLE+"?on_conflict=owner_id",{method:"POST",headers:{...headers,"Prefer":"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({owner_id:session.user.id,payload:state.data,updated_at:new Date().toISOString()})});
                if(!seed.ok)throw new Error("Não foi possível criar os dados iniciais no Supabase.");
            }
            localStorage.setItem(SYNC_STATE_KEY,"synced");
        }catch(error){localStorage.setItem(SYNC_STATE_KEY,"error");console.warn("Sincronização AlunoTec:",error);if(navigator.onLine)showToast("Os dados continuam salvos neste dispositivo. A sincronização será tentada novamente quando a conexão voltar.","warning")}
        finally{syncInProgress=false;updateConnectionStatus()}
    }

    function saveData(){
        let before=null;try{before=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null")}catch{}
        const serialized=JSON.stringify(state.data);
        if(before&&JSON.stringify(before)!==serialized){describeChanges(before,state.data).forEach(recordActivity);localStorage.setItem(PENDING_SYNC_KEY,JSON.stringify({savedAt:new Date().toISOString(),data:state.data}));}
        localStorage.setItem(STORAGE_KEY,serialized);
        updateConnectionStatus();
        if(internetReachable===true&&navigator.onLine)queueMicrotask(syncWithSupabase);
    }


    /* =====================================================
       ELEMENTOS PRINCIPAIS
    ===================================================== */

    const classesView = byId("managementView");
    const classDetailsView = byId("classDetailsView");

    const basePanel = byId("basePanel");
    const electivesPanel = byId("electivesPanel");

    const baseTableBody = byId("baseTableBody");
    const electivesTableBody = byId("electivesTableBody");

    const baseCount = byId("baseCount");
    const electiveCount = byId("electiveCount");

    const totalClasses = byId("totalClasses");
    const totalBaseStudents = byId("totalBaseStudents");
    const totalElectives = byId("totalElectives");
    const totalElectiveStudents = byId("totalElectiveStudents");

    const newButton = byId("newButton");
    const newButtonText = byId("newButtonText");

    const managementDescription =
        byId("managementDescription");

    const searchInput = byId("searchInput");

    const filterYear = byId("filterYear");
    const filterShift = byId("filterShift");
    const filterGrade = byId("filterGrade");
    const filterStatus = byId("filterStatus");

    const filterYearOptions =
        byId("filterYearOptions");

    const shiftFilterContainer =
        byId("shiftFilterContainer");

    const gradeFilterContainer =
        byId("gradeFilterContainer");


    /* =====================================================
       MODAL TURMA / ELETIVA
    ===================================================== */

    const modalOverlay = byId("modalOverlay");
    const modalClose = byId("modalClose");

    const modalTag = byId("modalTag");
    const modalTitle = byId("modalTitle");
    const modalSubtitle = byId("modalSubtitle");

    const baseForm = byId("baseForm");
    const electiveForm = byId("electiveForm");

    const baseEditId = byId("baseEditId");
    const electiveEditId = byId("electiveEditId");


    /* =====================================================
       BASE COMUM - CAMPOS
    ===================================================== */

    const className = byId("className");
    const classGrade = byId("classGrade");
    const classShift = byId("classShift");
    const classYear = byId("classYear");
    const classStatus = byId("classStatus");
    const classTeacher = byId("classTeacher");
    const classDate = byId("classDate");
    const classDateLabel = byId("classDateLabel");


    /* =====================================================
       ELETIVA - CAMPOS
    ===================================================== */

    const electiveName = byId("electiveName");
    const electiveShift = byId("electiveShift");
    const electiveYear = byId("electiveYear");
    const electiveStatus = byId("electiveStatus");
    const electiveTeacher = byId("electiveTeacher");
    const electiveDate = byId("electiveDate");
    const electiveDateLabel =
        byId("electiveDateLabel");


    /* =====================================================
       DETALHES DA TURMA
    ===================================================== */

    const backToClasses = byId("backToClasses");

    const openedClassType =
        byId("openedClassType");

    const openedClassName =
        byId("openedClassName");

    const openedClassInformation =
        byId("openedClassInformation");

    const openedClassStatus =
        byId("openedClassStatus");

    const openedClassStudents =
        byId("openedClassStudents");

    const openedClassYear =
        byId("openedClassYear");

    const studentsDescription =
        byId("studentsDescription");

    const studentsTableBody =
        byId("studentsTableBody");

    const studentSearch =
        byId("studentSearch");


    /* =====================================================
       MODAL ALUNO
    ===================================================== */

    const studentModalOverlay =
        byId("studentModalOverlay");

    const studentModalClose =
        byId("studentModalClose");

    const cancelStudentButton =
        byId("cancelStudentButton");

    const studentForm =
        byId("studentForm");

    const studentName =
        byId("studentName");

    const studentWhatsapp =
        byId("studentWhatsapp");

    const addStudentButton =
        byId("addStudentButton");


    /* =====================================================
       TRANSFERÊNCIA
    ===================================================== */

    const transferModalOverlay =
        byId("transferModalOverlay");

    const transferModalClose =
        byId("transferModalClose");

    const cancelTransferButton =
        byId("cancelTransferButton");

    const transferForm =
        byId("transferForm");

    const transferStudentId =
        byId("transferStudentId");

    const transferClassId =
        byId("transferClassId");

    const transferClassOptions =
        byId("transferClassOptions");

    const transferStudentText =
        byId("transferStudentText");


    /* =====================================================
       IMPORTAÇÃO / EXPORTAÇÃO
    ===================================================== */

    const importStudentsButton =
        byId("importStudentsButton");

    const exportStudentsButton =
        byId("exportStudentsButton");

    const studentImportInput =
        byId("studentImportInput");


    /* =====================================================
       TOAST
    ===================================================== */

    const toast = byId("toast");

    let toastTimer = null;

    function appDialog({title,message,type="success",confirmation=false,confirmText="Entendi",icon=""}){
        return new Promise(resolve=>{
            const dialog=document.createElement("dialog");dialog.className="alunotec-notice "+type;
            const fallback=type==="success"?"✓":"!";
            dialog.innerHTML='<div class="notice-symbol">'+(icon||fallback)+'</div><h2></h2><p></p><div class="notice-actions"></div>';
            dialog.querySelector("h2").textContent=title||"AlunoTec";dialog.querySelector("p").textContent=message;
            const actions=dialog.querySelector(".notice-actions");let closed=false,timer;
            const finish=value=>{if(closed)return;closed=true;clearTimeout(timer);dialog.close();dialog.remove();resolve(value)};
            if(confirmation){const cancel=document.createElement("button");cancel.type="button";cancel.className="notice-cancel";cancel.textContent="Cancelar";cancel.onclick=()=>finish(false);actions.append(cancel)}
            const ok=document.createElement("button");ok.type="button";ok.className="notice-confirm";ok.textContent=confirmText;ok.onclick=()=>finish(true);actions.append(ok);
            dialog.addEventListener("cancel",e=>{e.preventDefault();finish(false)});document.body.append(dialog);dialog.showModal();ok.focus();
            if(!confirmation)timer=setTimeout(()=>finish(true),type==="success"?3200:5500);
        });
    }
    function showToast(message,type="success"){appDialog({title:type==="success"?"Tudo certo!":type==="error"?"Não foi possível concluir":"Atenção",message,type})}



    /* =====================================================
       SELECT PERSONALIZADO
    ===================================================== */

    function setCustomSelectValue(
        selectId,
        value,
        fallback = "Selecione"
    ) {

        const container = byId(selectId);

        if (!container) return;

        const hidden =
            container.querySelector(
                'input[type="hidden"]'
            );

        const label =
            container.querySelector(
                "[data-select-label]"
            );

        const options =
            container.querySelectorAll(
                ".custom-select-option"
            );

        if (hidden) {
            hidden.value = value || "";
        }

        let selectedText = fallback;

        options.forEach((option) => {

            const selected =
                option.dataset.value === value;

            option.classList.toggle(
                "selected",
                selected
            );

            if (selected) {

                selectedText =
                    option
                        .querySelector("span")
                        ?.textContent
                        ?.trim() ||
                    option.dataset.value;

            }

        });

        if (label) {
            label.textContent = selectedText;
        }
    }

    function initializeCustomSelects() {

        $$(".custom-select").forEach((select) => {

            const trigger =
                select.querySelector(
                    ".custom-select-trigger"
                );

            if (!trigger) return;

            trigger.addEventListener(
                "click",
                (event) => {

                    event.stopPropagation();

                    $$(".custom-select.open")
                        .filter(
                            (item) =>
                                item !== select
                        )
                        .forEach(
                            (item) =>
                                item.classList.remove(
                                    "open"
                                )
                        );

                    select.classList.toggle(
                        "open"
                    );

                }
            );

            select.addEventListener(
                "click",
                (event) => {

                    const option =
                        event.target.closest(
                            ".custom-select-option"
                        );

                    if (!option) return;

                    const value =
                        option.dataset.value;

                    const hidden =
                        select.querySelector(
                            'input[type="hidden"]'
                        );

                    const label =
                        select.querySelector(
                            "[data-select-label]"
                        );

                    if (hidden) {
                        hidden.value = value;
                    }

                    select
                        .querySelectorAll(
                            ".custom-select-option"
                        )
                        .forEach((item) =>
                            item.classList.remove(
                                "selected"
                            )
                        );

                    option.classList.add(
                        "selected"
                    );

                    if (label) {

                        label.textContent =
                            option
                                .querySelector("span")
                                ?.textContent
                                ?.trim() ||
                            value;

                    }

                    select.classList.remove(
                        "open"
                    );

                    if (
                        [
                            "filterYearSelect",
                            "filterShiftSelect",
                            "filterGradeSelect",
                            "filterStatusSelect"
                        ].includes(select.id)
                    ) {
                        renderTables();
                    }

                }
            );

        });

        document.addEventListener(
            "click",
            () => {

                $$(".custom-select.open")
                    .forEach(
                        (select) =>
                            select.classList.remove(
                                "open"
                            )
                    );

            }
        );
    }


    /* =====================================================
       FILTRO DE ANOS
    ===================================================== */

    function updateYearFilter() {

        if (!filterYearOptions) return;

        const years = [
            ...state.data.base,
            ...state.data.electives
        ]
            .map((item) => String(item.year || ""))
            .filter(Boolean);

        years.push(CURRENT_YEAR);

        const uniqueYears =
            [...new Set(years)]
                .sort(
                    (a, b) =>
                        Number(b) - Number(a)
                );

        const selected =
            filterYear?.value || "all";

        filterYearOptions.innerHTML = `
            <button
                type="button"
                class="custom-select-option ${
                    selected === "all"
                        ? "selected"
                        : ""
                }"
                data-value="all"
            >
                <span>Todos</span>

                <svg class="option-check">
                    <use href="#icon-check"></use>
                </svg>
            </button>

            ${uniqueYears
                .map(
                    (year) => `
                        <button
                            type="button"
                            class="custom-select-option ${
                                selected === year
                                    ? "selected"
                                    : ""
                            }"
                            data-value="${escapeHTML(year)}"
                        >
                            <span>${escapeHTML(year)}</span>

                            <svg class="option-check">
                                <use href="#icon-check"></use>
                            </svg>
                        </button>
                    `
                )
                .join("")}
        `;

        setCustomSelectValue(
            "filterYearSelect",
            selected,
            "Todos"
        );
    }


    /* =====================================================
       CONTADORES
    ===================================================== */

    function updateSummary() {

        const baseStudents =
            state.data.base.reduce(
                (total, item) =>
                    total +
                    getActiveStudents(item).length,
                0
            );

        const electiveStudents =
            state.data.electives.reduce(
                (total, item) =>
                    total +
                    getActiveStudents(item).length,
                0
            );

        if (totalClasses) {
            totalClasses.textContent =
                state.data.base.length;
        }

        if (totalBaseStudents) {
            totalBaseStudents.textContent =
                baseStudents;
        }

        if (totalElectives) {
            totalElectives.textContent =
                state.data.electives.length;
        }

        if (totalElectiveStudents) {
            totalElectiveStudents.textContent =
                electiveStudents;
        }

        if (baseCount) {
            baseCount.textContent =
                state.data.base.length;
        }

        if (electiveCount) {
            electiveCount.textContent =
                state.data.electives.length;
        }
    }


    /* =====================================================
       FILTROS
    ===================================================== */

    function getFilteredItems(type) {

        const source =
            type === "base"
                ? state.data.base
                : state.data.electives;

        const year =
            filterYear?.value || "all";

        const shift =
            filterShift?.value || "all";

        const grade =
            filterGrade?.value || "all";

        const status =
            filterStatus?.value || "all";

        const search =
            normalizeText(
                searchInput?.value || ""
            );

        return source.filter((item) => {

            const matchesYear =
                year === "all" ||
                String(item.year) === year;

            const matchesShift =
                shift === "all" ||
                item.shift === shift;

            const matchesStatus =
                status === "all" ||
                item.status === status;

            const matchesGrade =
                type !== "base" ||
                grade === "all" ||
                item.grade === grade;

            const searchable = normalizeText(
                [
                    item.name,
                    item.grade,
                    item.shift,
                    item.year,
                    item.teacher,
                    item.status
                ]
                    .filter(Boolean)
                    .join(" ")
            );

            const matchesSearch =
                !search ||
                searchable.includes(search);

            return (
                matchesYear &&
                matchesShift &&
                matchesStatus &&
                matchesGrade &&
                matchesSearch
            );
        });
    }


    /* =====================================================
       ÍCONES DE AÇÕES
    ===================================================== */

    function actionButtons(type, id) {

        return `
            <div class="table-actions">

                <button
                    type="button"
                    class="action-button"
                    data-action="view"
                    data-type="${type}"
                    data-id="${id}"
                    title="Visualizar"
                    aria-label="Visualizar"
                >
                    <svg>
                        <use href="#icon-eye"></use>
                    </svg>
                </button>

                <button
                    type="button"
                    class="action-button edit"
                    data-action="edit"
                    data-type="${type}"
                    data-id="${id}"
                    title="Editar"
                    aria-label="Editar"
                >
                    <svg>
                        <use href="#icon-edit"></use>
                    </svg>
                </button>

                <button
                    type="button"
                    class="action-button danger"
                    data-action="delete"
                    data-type="${type}"
                    data-id="${id}"
                    title="Excluir"
                    aria-label="Excluir"
                >
                    <svg>
                        <use href="#icon-trash"></use>
                    </svg>
                </button>

            </div>
        `;
    }


    /* =====================================================
       BASE COMUM
    ===================================================== */

    function renderBaseTable() {

        if (!baseTableBody) return;

        const items =
            getFilteredItems("base");

        if (!items.length) {

            baseTableBody.innerHTML = `
                <tr>
                    <td
                        colspan="8"
                        class="empty-state"
                    >
                        <div class="empty-state-content">

                            <svg>
                                <use href="#icon-users"></use>
                            </svg>

                            <strong>
                                Nenhuma turma cadastrada
                            </strong>

                            <span>
                                Clique em “Nova turma” para cadastrar a primeira turma da Base Comum.
                            </span>

                        </div>
                    </td>
                </tr>
            `;

            return;
        }

        baseTableBody.innerHTML =
            items
                .map((item, index) => {

                    const activeStudents =
                        getActiveStudents(item).length;

                    return `
                        <tr class="class-clickable-row" data-class-id="${escapeHTML(item.id)}" data-type="base">

                            <td>
                                ${index + 1}
                            </td>

                            <td>
                                <button type="button" class="class-name-button" data-action="view" data-type="base" data-id="${escapeHTML(item.id)}">
                                    ${escapeHTML(item.name)}
                                </button>
                            </td>

                            <td>
                                ${escapeHTML(item.grade || "—")}
                            </td>

                            <td>
                                ${escapeHTML(item.shift || "—")}
                            </td>

                            <td>
                                ${escapeHTML(item.year || "—")}
                            </td>

                            <td>
                                ${activeStudents}
                            </td>

                            <td>
                                <span class="status ${
                                    item.status === "Ativa"
                                        ? "active"
                                        : "inactive"
                                }">
                                    ${escapeHTML(item.status || "Ativa")}
                                </span>
                            </td>

                            <td>
                                ${actionButtons(
                                    "base",
                                    item.id
                                )}
                            </td>

                        </tr>
                    `;
                })
                .join("");
    }


    /* =====================================================
       ELETIVAS
    ===================================================== */

    function renderElectivesTable() {

        if (!electivesTableBody) return;

        const items =
            getFilteredItems("electives");

        if (!items.length) {

            electivesTableBody.innerHTML = `
                <tr>
                    <td
                        colspan="8"
                        class="empty-state"
                    >
                        <div class="empty-state-content">

                            <svg>
                                <use href="#icon-book"></use>
                            </svg>

                            <strong>
                                Nenhuma eletiva cadastrada
                            </strong>

                            <span>
                                Clique em “Nova eletiva” para cadastrar a primeira eletiva.
                            </span>

                        </div>
                    </td>
                </tr>
            `;

            return;
        }

        electivesTableBody.innerHTML =
            items
                .map((item, index) => {

                    const activeStudents =
                        getActiveStudents(item).length;

                    return `
                        <tr class="class-clickable-row" data-class-id="${escapeHTML(item.id)}" data-type="electives">

                            <td>
                                ${index + 1}
                            </td>

                            <td>
                                <button type="button" class="class-name-button" data-action="view" data-type="electives" data-id="${escapeHTML(item.id)}">
                                    ${escapeHTML(item.name)}
                                </button>
                            </td>

                            <td>
                                ${escapeHTML(item.shift || "—")}
                            </td>

                            <td>
                                ${escapeHTML(item.teacher || "—")}
                            </td>

                            <td>
                                ${escapeHTML(item.year || "—")}
                            </td>

                            <td>
                                ${activeStudents}
                            </td>

                            <td>
                                <span class="status ${
                                    item.status === "Ativa"
                                        ? "active"
                                        : "inactive"
                                }">
                                    ${escapeHTML(item.status || "Ativa")}
                                </span>
                            </td>

                            <td>
                                ${actionButtons(
                                    "electives",
                                    item.id
                                )}
                            </td>

                        </tr>
                    `;
                })
                .join("");
    }


    /* =====================================================
       RENDER GERAL
    ===================================================== */

    function renderTables() {

        updateSummary();
        updateYearFilter();

        renderBaseTable();
        renderElectivesTable();

        if (state.openedClassId) {
            renderOpenedClass();
        }
    }


    /* =====================================================
       ABAS
    ===================================================== */

    function changeTab(tab) {

        state.activeTab = tab;

        $$(".tab").forEach((button) => {

            button.classList.toggle(
                "active",
                button.dataset.tab === tab
            );

        });

        const baseActive =
            tab === "base";

        basePanel?.classList.toggle(
            "hidden",
            !baseActive
        );

        electivesPanel?.classList.toggle(
            "hidden",
            baseActive
        );

        gradeFilterContainer?.classList.toggle(
            "hidden",
            !baseActive
        );

        if (newButtonText) {

            newButtonText.textContent =
                baseActive
                    ? "Nova turma"
                    : "Nova eletiva";

        }

        if (managementDescription) {

            managementDescription.textContent =
                baseActive
                    ? "Visualize, cadastre e gerencie as turmas da Base Comum."
                    : "Visualize, cadastre e gerencie as Eletivas.";

        }

        if (!baseActive) {

            setCustomSelectValue(
                "filterGradeSelect",
                "all",
                "Todos"
            );

        }

        renderTables();
    }

    $$(".tab").forEach((button) => {

        button.addEventListener(
            "click",
            () => changeTab(
                button.dataset.tab
            )
        );

    });


    /* =====================================================
       ABRIR MODAL NOVO
    ===================================================== */

    function resetBaseForm() {

        baseForm?.reset();

        if (baseEditId) {
            baseEditId.value = "";
        }

        if (classYear) {
            classYear.value =
                CURRENT_YEAR;
        }

        if (classDate) {
            classDate.value = "";
        }

        if (classDateLabel) {
            classDateLabel.textContent =
                "Selecione uma data";
        }

        setCustomSelectValue(
            "classGradeSelect",
            "",
            "Selecione"
        );

        setCustomSelectValue(
            "classShiftSelect",
            "",
            "Selecione"
        );

        setCustomSelectValue(
            "classStatusSelect",
            "Ativa",
            "Ativa"
        );
    }

    function resetElectiveForm() {

        electiveForm?.reset();

        if (electiveEditId) {
            electiveEditId.value = "";
        }

        if (electiveYear) {
            electiveYear.value =
                CURRENT_YEAR;
        }

        if (electiveDate) {
            electiveDate.value = "";
        }

        if (electiveDateLabel) {
            electiveDateLabel.textContent =
                "Selecione uma data";
        }

        setCustomSelectValue(
            "electiveShiftSelect",
            "",
            "Selecione"
        );

        setCustomSelectValue(
            "electiveStatusSelect",
            "Ativa",
            "Ativa"
        );
    }

    function openCreateModal(type) {

        closeAllDropdowns();

        if (type === "base") {

            resetBaseForm();

            baseForm?.classList.remove(
                "hidden"
            );

            electiveForm?.classList.add(
                "hidden"
            );

            if (modalTag) {
                modalTag.textContent =
                    "BASE COMUM";
            }

            if (modalTitle) {
                modalTitle.textContent =
                    "Nova turma";
            }

            if (modalSubtitle) {
                modalSubtitle.textContent =
                    "Cadastre uma nova turma.";
            }

            const button =
                baseForm?.querySelector(
                    ".save-button"
                );

            if (button) {
                button.textContent =
                    "Cadastrar turma";
            }

        } else {

            resetElectiveForm();

            electiveForm?.classList.remove(
                "hidden"
            );

            baseForm?.classList.add(
                "hidden"
            );

            if (modalTag) {
                modalTag.textContent =
                    "ELETIVA";
            }

            if (modalTitle) {
                modalTitle.textContent =
                    "Nova eletiva";
            }

            if (modalSubtitle) {
                modalSubtitle.textContent =
                    "Cadastre uma nova eletiva.";
            }

            const button =
                electiveForm?.querySelector(
                    ".save-button"
                );

            if (button) {
                button.textContent =
                    "Cadastrar eletiva";
            }
        }

        modalOverlay?.classList.add(
            "open"
        );
    }

    newButton?.addEventListener(
        "click",
        () => openCreateModal(
            state.activeTab
        )
    );


    /* =====================================================
       EDITAR BASE COMUM
    ===================================================== */

    function editBase(id) {

        const item =
            state.data.base.find(
                (classItem) =>
                    classItem.id === id
            );

        if (!item) return;

        resetBaseForm();

        baseForm?.classList.remove(
            "hidden"
        );

        electiveForm?.classList.add(
            "hidden"
        );

        baseEditId.value = item.id;

        className.value =
            item.name || "";

        classYear.value =
            item.year || CURRENT_YEAR;

        classTeacher.value =
            item.teacher || "";

        classDate.value =
            item.date || "";

        classDateLabel.textContent =
            item.date
                ? formatDateBR(item.date)
                : "Selecione uma data";

        setCustomSelectValue(
            "classGradeSelect",
            item.grade || "",
            "Selecione"
        );

        setCustomSelectValue(
            "classShiftSelect",
            item.shift || "",
            "Selecione"
        );

        setCustomSelectValue(
            "classStatusSelect",
            item.status || "Ativa",
            "Ativa"
        );

        modalTag.textContent =
            "BASE COMUM";

        modalTitle.textContent =
            "Editar turma";

        modalSubtitle.textContent =
            "Atualize as informações da turma.";

        const button =
            baseForm.querySelector(
                ".save-button"
            );

        if (button) {
            button.textContent =
                "Salvar alterações";
        }

        modalOverlay.classList.add(
            "open"
        );
    }


    /* =====================================================
       EDITAR ELETIVA
    ===================================================== */

    function editElective(id) {

        const item =
            state.data.electives.find(
                (elective) =>
                    elective.id === id
            );

        if (!item) return;

        resetElectiveForm();

        electiveForm?.classList.remove(
            "hidden"
        );

        baseForm?.classList.add(
            "hidden"
        );

        electiveEditId.value =
            item.id;

        electiveName.value =
            item.name || "";

        electiveYear.value =
            item.year || CURRENT_YEAR;

        electiveTeacher.value =
            item.teacher || "";

        electiveDate.value =
            item.date || "";

        electiveDateLabel.textContent =
            item.date
                ? formatDateBR(item.date)
                : "Selecione uma data";

        setCustomSelectValue(
            "electiveShiftSelect",
            item.shift || "",
            "Selecione"
        );

        setCustomSelectValue(
            "electiveStatusSelect",
            item.status || "Ativa",
            "Ativa"
        );

        modalTag.textContent =
            "ELETIVA";

        modalTitle.textContent =
            "Editar eletiva";

        modalSubtitle.textContent =
            "Atualize as informações da eletiva.";

        const button =
            electiveForm.querySelector(
                ".save-button"
            );

        if (button) {
            button.textContent =
                "Salvar alterações";
        }

        modalOverlay.classList.add(
            "open"
        );
    }


    /* =====================================================
       CADASTRAR / SALVAR BASE
    ===================================================== */

    baseForm?.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const name =
                className.value.trim();

            const grade =
                classGrade.value;

            const shift =
                classShift.value;

            const year =
                classYear.value.trim();

            const status =
                classStatus.value || "Ativa";

            const teacher =
                classTeacher.value.trim();

            const date =
                classDate.value || await automaticCreationDate();

            if (!name) {

                showToast(
                    "Informe o nome da turma.",
                    "warning"
                );

                className.focus();

                return;
            }

            if (!grade) {

                showToast(
                    "Selecione a série/ano.",
                    "warning"
                );

                return;
            }

            if (!shift) {

                showToast(
                    "Selecione o turno.",
                    "warning"
                );

                return;
            }

            if (
                !/^\d{4}$/.test(year)
            ) {

                showToast(
                    "Informe um ano letivo válido.",
                    "warning"
                );

                classYear.focus();

                return;
            }

            const editId =
                baseEditId.value;

            if (editId) {

                const index =
                    state.data.base.findIndex(
                        (item) =>
                            item.id === editId
                    );

                if (index !== -1) {

                    const old =
                        state.data.base[index];

                    state.data.base[index] = {
                        ...old,
                        name,
                        grade,
                        shift,
                        year,
                        status,
                        teacher,
                        date
                    };

                    showToast(
                        "Turma atualizada com sucesso."
                    );
                }

            } else {

                state.data.base.push({
                    id:
                        generateId("base"),

                    name,
                    grade,
                    shift,
                    year,
                    status,
                    teacher,
                    date,

                    students: []
                });

                showToast(
                    "Turma cadastrada com sucesso."
                );
            }

            saveData();
            closeMainModal();
            renderTables();

        }
    );


    /* =====================================================
       CADASTRAR / SALVAR ELETIVA
    ===================================================== */

    electiveForm?.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const name =
                electiveName.value.trim();

            const shift =
                electiveShift.value;

            const year =
                electiveYear.value.trim();

            const status =
                electiveStatus.value || "Ativa";

            const teacher =
                electiveTeacher.value.trim();

            const date =
                electiveDate.value || await automaticCreationDate();

            if (!name) {

                showToast(
                    "Informe o nome da eletiva.",
                    "warning"
                );

                electiveName.focus();

                return;
            }

            if (!shift) {

                showToast(
                    "Selecione o turno.",
                    "warning"
                );

                return;
            }

            if (
                !/^\d{4}$/.test(year)
            ) {

                showToast(
                    "Informe um ano letivo válido.",
                    "warning"
                );

                electiveYear.focus();

                return;
            }

            const editId =
                electiveEditId.value;

            if (editId) {

                const index =
                    state.data.electives.findIndex(
                        (item) =>
                            item.id === editId
                    );

                if (index !== -1) {

                    const old =
                        state.data.electives[index];

                    state.data.electives[index] = {
                        ...old,
                        name,
                        shift,
                        year,
                        status,
                        teacher,
                        date
                    };

                    showToast(
                        "Eletiva atualizada com sucesso."
                    );
                }

            } else {

                state.data.electives.push({
                    id:
                        generateId("elective"),

                    name,
                    shift,
                    year,
                    status,
                    teacher,
                    date,

                    students: []
                });

                showToast(
                    "Eletiva cadastrada com sucesso."
                );
            }

            saveData();
            closeMainModal();
            renderTables();

        }
    );


    /* =====================================================
       EXCLUIR TURMA / ELETIVA
    ===================================================== */

    async function deleteItem(type, id) {

        const collection =
            type === "base"
                ? state.data.base
                : state.data.electives;

        const item =
            collection.find(
                (entry) =>
                    entry.id === id
            );

        if (!item) return;

        const label =
            type === "base"
                ? "turma"
                : "eletiva";

        const trash='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6"/></svg>';
        const confirmed=await appDialog({title:"Excluir "+label,type:"warning",confirmation:true,confirmText:"Excluir",message:"Deseja realmente excluir a "+label+" \""+item.name+"\"?\\n\\nOs alunos vinculados a ela também serão removidos desta "+label+".",icon:trash});

        if (!confirmed) return;

        if (type === "base") {

            state.data.base =
                state.data.base.filter(
                    (entry) =>
                        entry.id !== id
                );

        } else {

            state.data.electives =
                state.data.electives.filter(
                    (entry) =>
                        entry.id !== id
                );
        }

        if (
            state.openedClassId === id &&
            state.openedClassType === type
        ) {

            state.openedClassId = null;
            state.openedClassType = null;

            showClassesView();
        }

        saveData();
        renderTables();

        showToast(
            type === "base"
                ? "Turma excluída."
                : "Eletiva excluída."
        );
    }


    /* =====================================================
       AÇÕES DAS TABELAS
    ===================================================== */

    function handleTableAction(event) {

        const button =
            event.target.closest(
                "[data-action], tr[data-class-id]"
            );

        if (!button) return;

        const action =
            button.dataset.action || "view";

        const type =
            button.dataset.type;

        const id =
            button.dataset.id || button.dataset.classId;

        if (action === "view") {

            openClassDetails(
                type,
                id
            );

            return;
        }

        if (action === "edit") {

            if (type === "base") {
                editBase(id);
            } else {
                editElective(id);
            }

            return;
        }

        if (action === "delete") {

            deleteItem(
                type,
                id
            );
        }
    }

    baseTableBody?.addEventListener(
        "click",
        handleTableAction
    );

    electivesTableBody?.addEventListener(
        "click",
        handleTableAction
    );


    /* =====================================================
       MODAL PRINCIPAL
    ===================================================== */

    function closeMainModal() {

        modalOverlay?.classList.remove(
            "open"
        );

        closeAllDropdowns();
    }

    modalClose?.addEventListener(
        "click",
        closeMainModal
    );

    $$("[data-close-modal]")
        .forEach((button) => {

            button.addEventListener(
                "click",
                closeMainModal
            );

        });

    modalOverlay?.addEventListener(
        "click",
        (event) => {

            if (
                event.target === modalOverlay
            ) {
                closeMainModal();
            }

        }
    );


    /* =====================================================
       LOCALIZAR TURMA ABERTA
    ===================================================== */

    function getOpenedClass() {

        if (
            !state.openedClassId ||
            !state.openedClassType
        ) {
            return null;
        }

        const collection =
            state.openedClassType === "base"
                ? state.data.base
                : state.data.electives;

        return collection.find(
            (item) =>
                item.id ===
                state.openedClassId
        ) || null;
    }


    /* =====================================================
       VISUALIZAR TURMA
    ===================================================== */

    function openClassDetails(type,id){const url=new URL(location.href);url.searchParams.set("turma",id);url.searchParams.set("tipo",type);history.pushState({turmas:true},"",url.href);showClassInCurrentTab(type,id)}

    function showClassInCurrentTab(type, id) {
        state.openedClassType = type;
        state.openedClassId = id;
        if (!getOpenedClass()) {
            state.openedClassType = null;
            state.openedClassId = null;
            showClassesView();
            showToast("Esta turma não está mais disponível.", "warning");
            return;
        }
        if (studentSearch) studentSearch.value = "";
        classesView?.classList.add("hidden");
        classDetailsView?.classList.remove("hidden");
        renderOpenedClass();
        document.title = getOpenedClass().name + " — AlunoTec";
        window.scrollTo({top: 0, behavior: "smooth"});
    }

    function showClassesView() {
        state.openedClassId=null;state.openedClassType=null;const url=new URL(location.href);url.searchParams.delete("turma");url.searchParams.delete("tipo");history.replaceState(null,"",url.href);document.title="Turmas | AlunoTec";

        classDetailsView?.classList.add(
            "hidden"
        );

        classesView?.classList.remove(
            "hidden"
        );

        renderTables();
    }

    backToClasses?.addEventListener(
        "click",
        showClassesView
    );


    /* =====================================================
       DETALHES DA TURMA
    ===================================================== */

    function renderOpenedClass() {

        const item =
            getOpenedClass();

        if (!item) return;

        const isBase =
            state.openedClassType === "base";

        const activeStudents =
            getActiveStudents(item).length;

        openedClassType.textContent =
            isBase
                ? "BASE COMUM"
                : "ELETIVA";

        openedClassName.textContent =
            item.name;

        openedClassInformation.textContent =
            isBase
                ? [
                    item.grade,
                    item.shift,
                    item.teacher
                        ? `Professor: ${item.teacher}`
                        : null
                ]
                    .filter(Boolean)
                    .join(" • ")
                : [
                    item.shift,
                    item.teacher
                        ? `Professor: ${item.teacher}`
                        : null
                ]
                    .filter(Boolean)
                    .join(" • ");

        openedClassStatus.textContent =
            item.status || "Ativa";

        openedClassStatus.className =
            `status ${
                item.status === "Ativa"
                    ? "active"
                    : "inactive"
            }`;

        openedClassStudents.textContent =
            activeStudents;

        openedClassYear.textContent =
            item.year || "—";

        if (studentsDescription) studentsDescription.textContent =
            `Gerencie os alunos cadastrados em ${item.name}.`;

        renderStudents();
    }


    /* =====================================================
       ALUNOS
    ===================================================== */

    function renderStudents() {

        const item =
            getOpenedClass();

        if (!item || !studentsTableBody) {
            return;
        }

        const search =
            normalizeText(
                studentSearch?.value || ""
            );

        const students =
            (item.students || [])
                .filter((student) => {

                    if (!search) return true;

                    return normalizeText(
                        [
                            student.name,
                            student.whatsapp
                        ].join(" ")
                    ).includes(search);

                });

        if (!students.length) {

            studentsTableBody.innerHTML = `
                <tr>
                    <td
                        colspan="4"
                        class="empty-state"
                    >
                        <div class="empty-state-content">

                            <svg>
                                <use href="#icon-users"></use>
                            </svg>

                            <strong>
                                Nenhum aluno encontrado
                            </strong>

                            <span>
                                ${
                                    search
                                        ? "Nenhum aluno corresponde à pesquisa."
                                        : "Cadastre o primeiro aluno desta turma."
                                }
                            </span>

                        </div>
                    </td>
                </tr>
            `;

            return;
        }

        studentsTableBody.innerHTML =
            students
                .map((student, index) => {

                    const inactive =
                        student.status === "Inativo";

                    return `
                        <tr class="${
                            inactive
                                ? "student-inactive"
                                : ""
                        }">

                            <td>
                                ${index + 1}
                            </td>

                            <td>
                                <strong>
                                    ${escapeHTML(student.name)}
                                </strong>
                            </td>

                            <td>
                                ${
                                    student.whatsapp
                                        ? `
                                            <a
                                                class="whatsapp-link"
                                                href="${whatsappURL(student.whatsapp)}"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                ${escapeHTML(student.whatsapp)}
                                            </a>
                                        `
                                        : `
                                            <span class="no-whatsapp">
                                                Não informado
                                            </span>
                                        `
                                }
                            </td>

                            <td>

                                <div class="student-actions">


                                    <button
                                        type="button"
                                        class="student-action-button edit"
                                        data-student-action="edit"
                                        data-student-id="${student.id}"
                                    >
                                        <svg>
                                            <use href="#icon-edit"></use>
                                        </svg>

                                        Editar
                                    </button>

                                    ${
                                        state.openedClassType === "base"
                                            ? `
                                                <button
                                                    type="button"
                                                    class="student-action-button transfer"
                                                    data-student-action="transfer"
                                                    data-student-id="${student.id}"
                                                >
                                                    Transferir
                                                </button>

                                                <button
                                                    type="button"
                                                    class="student-action-button copy"
                                                    data-student-action="copy"
                                                    data-student-id="${student.id}"
                                                >
                                                    Eletiva
                                                </button>
                                            `
                                            : `
                                                <button type="button" class="student-action-button transfer" data-student-action="transfer" data-student-id="${student.id}">Transferir</button>
                                            `
                                    }

                                    <button
                                        type="button"
                                        class="student-action-button remove"
                                        data-student-action="remove"
                                        data-student-id="${student.id}"
                                    >
                                        Excluir
                                    </button>

                                    <div
                                        class="student-status-select ${
                                            inactive
                                                ? "inactive"
                                                : ""
                                        }"
                                        data-student-status="${student.id}"
                                    >

                                        <button
                                            type="button"
                                            class="student-status-trigger ${
                                                inactive
                                                    ? "inactive"
                                                    : ""
                                            }"
                                        >
                                            ${inactive
                                                ? "Inativo"
                                                : "Ativo"}

                                            <svg>
                                                <use href="#icon-chevron-down"></use>
                                            </svg>
                                        </button>

                                        <div class="student-status-menu">

                                            <button
                                                type="button"
                                                class="student-status-option"
                                                data-student-action="status"
                                                data-student-id="${student.id}"
                                                data-status="Ativo"
                                            >
                                                Ativo
                                            </button>

                                            <button
                                                type="button"
                                                class="student-status-option"
                                                data-student-action="status"
                                                data-student-id="${student.id}"
                                                data-status="Inativo"
                                            >
                                                Inativo
                                            </button>

                                        </div>

                                    </div>


                                </div>

                            </td>

                        </tr>
                    `;
                })
                .join("");
    }


    /* =====================================================
       MODAL ALUNO
    ===================================================== */

    function openStudentModal(studentId = null) {

        const item =
            getOpenedClass();

        if (!item) return;

        state.editingStudentId =
            studentId;

        studentForm.reset();

        const title =
            studentModalOverlay
                ?.querySelector(
                    ".modal-header h2"
                );

        const subtitle =
            studentModalOverlay
                ?.querySelector(
                    ".modal-header p"
                );

        const submit =
            studentForm
                ?.querySelector(
                    'button[type="submit"]'
                );

        if (studentId) {

            const student =
                item.students.find(
                    (entry) =>
                        entry.id === studentId
                );

            if (!student) return;

            studentName.value =
                student.name || "";

            studentWhatsapp.value =
                student.whatsapp || "";

            if (title) {
                title.textContent =
                    "Editar aluno";
            }

            if (subtitle) {
                subtitle.textContent =
                    "Atualize os dados do aluno.";
            }

            if (submit) {
                submit.textContent =
                    "Salvar alterações";
            }

        } else {

            if (title) {
                title.textContent =
                    "Cadastrar aluno";
            }

            if (subtitle) {
                subtitle.textContent =
                    "Adicione um aluno à turma selecionada.";
            }

            if (submit) {
                submit.textContent =
                    "Cadastrar aluno";
            }
        }

        studentModalOverlay
            ?.classList.add("open");

        setTimeout(
            () => studentName?.focus(),
            100
        );
    }

    function closeStudentModal() {

        studentModalOverlay
            ?.classList.remove("open");

        state.editingStudentId =
            null;
    }

    addStudentButton?.addEventListener(
        "click",
        () => openStudentModal()
    );

    studentModalClose?.addEventListener(
        "click",
        closeStudentModal
    );

    cancelStudentButton?.addEventListener(
        "click",
        closeStudentModal
    );

    studentModalOverlay?.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                studentModalOverlay
            ) {
                closeStudentModal();
            }

        }
    );

    studentWhatsapp?.addEventListener(
        "input",
        () => {

            studentWhatsapp.value =
                formatWhatsapp(
                    studentWhatsapp.value
                );

        }
    );

    studentForm?.addEventListener(
        "submit",
        (event) => {

            event.preventDefault();

            const item =
                getOpenedClass();

            if (!item) return;

            const name =
                studentName.value.trim();

            const whatsapp =
                formatWhatsapp(
                    studentWhatsapp.value
                );

            if (!name) {

                showToast(
                    "Informe o nome do aluno.",
                    "warning"
                );

                studentName.focus();

                return;
            }

            if (
                state.editingStudentId
            ) {

                const index =
                    item.students.findIndex(
                        (student) =>
                            student.id ===
                            state.editingStudentId
                    );

                if (index !== -1) {

                    item.students[index] = {
                        ...item.students[index],
                        name,
                        whatsapp
                    };

                    showToast(
                        "Aluno atualizado com sucesso."
                    );
                }

            } else {

                item.students.push({
                    id:
                        generateId("student"),

                    name,
                    whatsapp,
                    status: "Ativo"
                });

                showToast(
                    "Aluno cadastrado com sucesso."
                );
            }

            saveData();
            if (studentSearch) studentSearch.value = "";
            closeStudentModal();
            renderOpenedClass();
            updateSummary();

        }
    );


    /* =====================================================
       AÇÕES DO ALUNO
    ===================================================== */

    studentsTableBody?.addEventListener(
        "click",
        (event) => {

            const statusTrigger =
                event.target.closest(
                    ".student-status-trigger"
                );

            if (statusTrigger) {

                event.stopPropagation();

                const wrapper =
                    statusTrigger.closest(
                        ".student-status-select"
                    );

                $$(".student-status-select.open")
                    .filter(
                        (item) =>
                            item !== wrapper
                    )
                    .forEach(
                        (item) =>
                            item.classList.remove(
                                "open"
                            )
                    );

                wrapper?.classList.toggle(
                    "open"
                );

                return;
            }

            const button =
                event.target.closest(
                    "[data-student-action]"
                );

            if (!button) return;

            const action =
                button.dataset.studentAction;

            const studentId =
                button.dataset.studentId;

            if (action === "edit") {

                openStudentModal(
                    studentId
                );

                return;
            }

            if (action === "remove") {

                removeStudent(
                    studentId
                );

                return;
            }

            if (action === "status") {

                updateStudentStatus(
                    studentId,
                    button.dataset.status
                );

                return;
            }

            if (action === "transfer") {

                openTransferModal(
                    studentId
                );

                return;
            }

            if (action === "copy") {

                copyStudentToElective(
                    studentId
                );
            }

        }
    );

    document.addEventListener(
        "click",
        () => {

            $$(".student-status-select.open")
                .forEach(
                    (item) =>
                        item.classList.remove(
                            "open"
                        )
                );

        }
    );

    function updateStudentStatus(
        studentId,
        status
    ) {

        const item =
            getOpenedClass();

        if (!item) return;

        const student =
            item.students.find(
                (entry) =>
                    entry.id === studentId
            );

        if (!student) return;

        student.status = status;

        saveData();

        renderOpenedClass();
        updateSummary();

        showToast(
            `Aluno marcado como ${status.toLowerCase()}.`
        );
    }

    async function removeStudent(studentId) {

        const item =
            getOpenedClass();

        if (!item) return;

        const student =
            item.students.find(
                (entry) =>
                    entry.id === studentId
            );

        if (!student) return;

        const confirmed =
            await appDialog({title:"Excluir aluno",type:"warning",confirmation:true,confirmText:"Excluir",message:"Deseja remover \""+student.name+"\" desta turma?",icon:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6"/></svg>'});

        if (!confirmed) return;

        item.students =
            item.students.filter(
                (entry) =>
                    entry.id !== studentId
            );

        saveData();

        renderOpenedClass();
        updateSummary();

        showToast(
            "Aluno removido da turma."
        );
    }


    /* =====================================================
       TRANSFERÊNCIA
    ===================================================== */

    function openTransferModal(
        studentId
    ) {

        const source =
            getOpenedClass();

        if (!source) return;

        const student =
            source.students.find(
                (entry) =>
                    entry.id === studentId
            );

        if (!student) return;

        const destinations =
            state.data[state.openedClassType].filter(
                (item) =>
                    item.id !== source.id
            );

        if (!destinations.length) {

            showToast(
                state.openedClassType === "base" ? "Cadastre outra turma da Base Comum para realizar a transferência." : "Cadastre outra Eletiva para realizar a transferência.",
                "warning"
            );

            return;
        }

        transferStudentId.value =
            studentId;

        transferClassId.value = "";

        transferStudentText.textContent =
            `Selecione a turma de destino para ${student.name}.`;

        transferClassOptions.innerHTML =
            destinations
                .map(
                    (item) => `
                        <button
                            type="button"
                            class="custom-select-option"
                            data-value="${item.id}"
                        >
                            <span>
                                ${escapeHTML(item.name)}
                            </span>

                            <svg class="option-check">
                                <use href="#icon-check"></use>
                            </svg>
                        </button>
                    `
                )
                .join("");

        setCustomSelectValue(
            "transferClassSelect",
            "",
            "Selecione a turma"
        );

        transferModalOverlay
            ?.classList.add("open");
    }

    function closeTransferModal() {

        transferModalOverlay
            ?.classList.remove("open");

        transferStudentId.value = "";
        transferClassId.value = "";
    }

    transferModalClose?.addEventListener(
        "click",
        closeTransferModal
    );

    cancelTransferButton?.addEventListener(
        "click",
        closeTransferModal
    );

    transferModalOverlay?.addEventListener(
        "click",
        (event) => {

            if (
                event.target ===
                transferModalOverlay
            ) {
                closeTransferModal();
            }

        }
    );

    transferForm?.addEventListener(
        "submit",
        (event) => {

            event.preventDefault();

            const source =
                getOpenedClass();

            if (!source) return;

            const studentId =
                transferStudentId.value;

            const destinationId =
                transferClassId.value;

            if (!destinationId) {

                showToast(
                    "Selecione a turma de destino.",
                    "warning"
                );

                return;
            }

            const student =
                source.students.find(
                    (entry) =>
                        entry.id === studentId
                );

            const destination =
                state.data[state.openedClassType].find(
                    (item) =>
                        item.id ===
                        destinationId
                );

            if (
                !student ||
                !destination ||
                destination.id === source.id
            ) {
                return;
            }

            destination.students.push(
                student
            );

            source.students =
                source.students.filter(
                    (entry) =>
                        entry.id !== studentId
                );

            saveData();

            closeTransferModal();
            renderOpenedClass();
            updateSummary();

            showToast(
                `Aluno transferido para ${destination.name}.`
            );
        }
    );


    /* =====================================================
       COPIAR ALUNO PARA ELETIVA
    ===================================================== */

    async function chooseElective(electives){
        return new Promise(resolve=>{
            const dialog=document.createElement("dialog");dialog.className="alunotec-notice selector-dialog";
            dialog.innerHTML='<div class="notice-symbol">↗</div><h2>Escolha a Eletiva</h2><div class="selector-list"></div><div class="notice-actions"><button type="button" class="notice-cancel">Cancelar</button></div>';
            const list=dialog.querySelector(".selector-list");let closed=false;
            const finish=value=>{if(closed)return;closed=true;dialog.close();dialog.remove();resolve(value)};
            electives.forEach(item=>{const button=document.createElement("button");button.type="button";button.className="select-option";button.textContent=item.name;button.onclick=()=>finish(item);list.append(button)});
            dialog.querySelector(".notice-cancel").onclick=()=>finish(null);dialog.addEventListener("cancel",e=>{e.preventDefault();finish(null)});document.body.append(dialog);dialog.showModal();
        });
    }
    async function copyStudentToElective(
        studentId
    ) {

        const source =
            getOpenedClass();

        if (!source) return;

        const student =
            source.students.find(
                (entry) =>
                    entry.id === studentId
            );

        if (!student) return;

        const electives = state.data.electives;

        if (!electives.length) {

            showToast(
                "Cadastre uma eletiva primeiro.",
                "warning"
            );

            return;
        }

        const elective=await chooseElective(electives);
        if(!elective)return;

        const alreadyExists =
            elective.students.some(
                (entry) =>
                    normalizeText(entry.name) ===
                    normalizeText(student.name)
            );

        if (alreadyExists) {

            showToast(
                "Este aluno já está cadastrado nessa eletiva.",
                "warning"
            );

            return;
        }

        elective.students.push({
            ...student,
            id:
                generateId("student")
        });

        saveData();
        updateSummary();

        showToast(
            `${student.name} foi adicionado à eletiva ${elective.name}.`
        );
    }


    /* =====================================================
       PESQUISA
    ===================================================== */

    searchInput?.addEventListener(
        "input",
        renderTables
    );

    studentSearch?.addEventListener(
        "input",
        renderStudents
    );


    /* =====================================================
       IMPORTAR ALUNOS CSV
    ===================================================== */

    importStudentsButton?.addEventListener(
        "click",
        () => {

            studentImportInput?.click();

        }
    );

    studentImportInput?.addEventListener(
        "change",
        (event) => {

            const file =
                event.target.files?.[0];

            if (!file) return;

            const reader =
                new FileReader();

            reader.onload = () => {

                const item =
                    getOpenedClass();

                if (!item) return;

                const content =
                    String(reader.result || "");

                const lines =
                    content
                        .split(/\r?\n/)
                        .map(
                            (line) =>
                                line.trim()
                        )
                        .filter(Boolean);

                if (!lines.length) {

                    showToast(
                        "O arquivo CSV está vazio.",
                        "warning"
                    );

                    return;
                }

                let imported = 0;

                lines.forEach(
                    (line, index) => {

                        const separator =
                            line.includes(";")
                                ? ";"
                                : ",";

                        const columns =
                            line
                                .split(separator)
                                .map(
                                    (value) =>
                                        value
                                            .replace(/^"|"$/g, "")
                                            .trim()
                                );

                        const name =
                            columns[0];

                        const whatsapp =
                            columns[1] || "";

                        if (!name) return;

                        if (
                            index === 0 &&
                            normalizeText(name).includes(
                                "nome"
                            )
                        ) {
                            return;
                        }

                        item.students.push({
                            id:
                                generateId(
                                    "student"
                                ),

                            name,

                            whatsapp:
                                formatWhatsapp(
                                    whatsapp
                                ),

                            status: "Ativo"
                        });

                        imported++;
                    }
                );

                saveData();
                renderOpenedClass();
                updateSummary();

                showToast(
                    `${imported} aluno(s) importado(s).`
                );

                event.target.value = "";
            };

            reader.readAsText(
                file,
                "UTF-8"
            );

        }
    );


    /* =====================================================
       EXPORTAR CSV
    ===================================================== */

    exportStudentsButton?.addEventListener(
        "click",
        () => {

            const item =
                getOpenedClass();

            if (!item) return;

            if (!item.students.length) {

                showToast(
                    "Não há alunos para exportar.",
                    "warning"
                );

                return;
            }

            const rows = [
                [
                    "Nome do aluno",
                    "WhatsApp do responsável",
                    "Status"
                ],

                ...item.students.map(
                    (student) => [
                        student.name,
                        student.whatsapp || "",
                        student.status || "Ativo"
                    ]
                )
            ];

            const csv =
                rows
                    .map(
                        (row) =>
                            row
                                .map(
                                    (value) =>
                                        `"${String(value)
                                            .replaceAll(
                                                '"',
                                                '""'
                                            )}"`
                                )
                                .join(";")
                    )
                    .join("\r\n");

            const blob =
                new Blob(
                    [
                        "\uFEFF" + csv
                    ],
                    {
                        type:
                            "text/csv;charset=utf-8;"
                    }
                );

            const url =
                URL.createObjectURL(
                    blob
                );

            const link =
                document.createElement(
                    "a"
                );

            link.href = url;

            link.download =
                `${item.name
                    .replace(
                        /[^a-z0-9áàâãéèêíïóôõöúçñ _-]/gi,
                        ""
                    )
                    .replace(/\s+/g, "_")
                    .toLowerCase()}_alunos.csv`;

            document.body.appendChild(
                link
            );

            link.click();
            link.remove();

            URL.revokeObjectURL(url);

            showToast(
                "Lista de alunos exportada."
            );

        }
    );


    /* =====================================================
       CALENDÁRIO
    ===================================================== */

    const MONTHS = [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro"
    ];

    function initializeCalendar(config) {

        const button =
            byId(config.button);

        const picker =
            byId(config.picker);

        const monthLabel =
            byId(config.month);

        const daysContainer =
            byId(config.days);

        const previous =
            byId(config.previous);

        const next =
            byId(config.next);

        const todayButton =
            byId(config.today);

        const input =
            byId(config.input);

        const dateLabel =
            byId(config.label);

        if (
            !button ||
            !picker ||
            !monthLabel ||
            !daysContainer
        ) {
            return;
        }

        let viewDate =
            new Date();

        function renderCalendar() {

            const year =
                viewDate.getFullYear();

            const month =
                viewDate.getMonth();

            monthLabel.textContent =
                `${MONTHS[month]} ${year}`;

            const firstDay =
                new Date(
                    year,
                    month,
                    1
                );

            const start =
                new Date(
                    year,
                    month,
                    1 - firstDay.getDay()
                );

            const today =
                new Date();

            const selected =
                input.value;

            let html = "";

            for (
                let index = 0;
                index < 42;
                index++
            ) {

                const date =
                    new Date(start);

                date.setDate(
                    start.getDate() +
                    index
                );

                const value =
                    dateToInputValue(date);

                const otherMonth =
                    date.getMonth() !== month;

                const isToday =
                    date.toDateString() ===
                    today.toDateString();

                const isSelected =
                    selected === value;

                html += `
                    <button
                        type="button"
                        class="calendar-day
                            ${
                                otherMonth
                                    ? "other-month"
                                    : ""
                            }
                            ${
                                isToday
                                    ? "today"
                                    : ""
                            }
                            ${
                                isSelected
                                    ? "selected"
                                    : ""
                            }
                        "
                        data-date="${value}"
                    >
                        ${date.getDate()}
                    </button>
                `;
            }

            daysContainer.innerHTML =
                html;
        }

        button.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                $$(".date-picker.open")
                    .filter(
                        (item) =>
                            item !== picker
                    )
                    .forEach(
                        (item) =>
                            item.classList.remove(
                                "open"
                            )
                    );

                picker.classList.toggle(
                    "open"
                );

                renderCalendar();
            }
        );

        previous?.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                viewDate =
                    new Date(
                        viewDate.getFullYear(),
                        viewDate.getMonth() - 1,
                        1
                    );

                renderCalendar();
            }
        );

        next?.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                viewDate =
                    new Date(
                        viewDate.getFullYear(),
                        viewDate.getMonth() + 1,
                        1
                    );

                renderCalendar();
            }
        );

        daysContainer.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                const day =
                    event.target.closest(
                        ".calendar-day"
                    );

                if (!day) return;

                input.value =
                    day.dataset.date;

                dateLabel.textContent =
                    formatDateBR(
                        day.dataset.date
                    );

                picker.classList.remove(
                    "open"
                );

                renderCalendar();
            }
        );

        todayButton?.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                const today =
                    new Date();

                input.value =
                    dateToInputValue(
                        today
                    );

                dateLabel.textContent =
                    formatDateBR(
                        input.value
                    );

                viewDate =
                    new Date(today);

                picker.classList.remove(
                    "open"
                );

                renderCalendar();
            }
        );

        picker.addEventListener(
            "click",
            (event) =>
                event.stopPropagation()
        );

        renderCalendar();
    }

    initializeCalendar({
        button:
            "classDateButton",

        picker:
            "classDatePicker",

        month:
            "calendarMonth",

        days:
            "calendarDays",

        previous:
            "calendarPrevious",

        next:
            "calendarNext",

        today:
            "calendarToday",

        input:
            "classDate",

        label:
            "classDateLabel"
    });

    initializeCalendar({
        button:
            "electiveDateButton",

        picker:
            "electiveDatePicker",

        month:
            "electiveCalendarMonth",

        days:
            "electiveCalendarDays",

        previous:
            "electiveCalendarPrevious",

        next:
            "electiveCalendarNext",

        today:
            "electiveCalendarToday",

        input:
            "electiveDate",

        label:
            "electiveDateLabel"
    });


    /* =====================================================
       FECHAR DROPDOWNS
    ===================================================== */

    function closeAllDropdowns() {

        $$(".custom-select.open")
            .forEach(
                (item) =>
                    item.classList.remove(
                        "open"
                    )
            );

        $$(".date-picker.open")
            .forEach(
                (item) =>
                    item.classList.remove(
                        "open"
                    )
            );

        $$(".student-status-select.open")
            .forEach(
                (item) =>
                    item.classList.remove(
                        "open"
                    )
            );
    }

    document.addEventListener(
        "click",
        () => {

            $$(".date-picker.open")
                .forEach(
                    (item) =>
                        item.classList.remove(
                            "open"
                        )
                );

        }
    );


    /* =====================================================
       ANO LETIVO - APENAS NÚMEROS
    ===================================================== */

    [
        classYear,
        electiveYear
    ].forEach((input) => {

        input?.addEventListener(
            "input",
            () => {

                input.value =
                    input.value
                        .replace(/\D/g, "")
                        .slice(0, 4);

            }
        );

    });


    /* =====================================================
       PERFIL
    ===================================================== */

    const profileButton =
        byId("profileButton");

    const profileMenu =
        byId("profileMenu");

    profileButton?.addEventListener(
        "click",
        (event) => {

            event.stopPropagation();

            profileMenu?.classList.toggle(
                "open"
            );

        }
    );

    profileMenu?.addEventListener(
        "click",
        (event) =>
            event.stopPropagation()
    );

    document.addEventListener(
        "click",
        () => {

            profileMenu?.classList.remove(
                "open"
            );

        }
    );


    /* =====================================================
       ESC
    ===================================================== */

    document.addEventListener(
        "keydown",
        (event) => {

            if (event.key !== "Escape") {
                return;
            }

            closeAllDropdowns();

            profileMenu?.classList.remove(
                "open"
            );

            if (
                transferModalOverlay
                    ?.classList.contains(
                        "open"
                    )
            ) {

                closeTransferModal();

                return;
            }

            if (
                studentModalOverlay
                    ?.classList.contains(
                        "open"
                    )
            ) {

                closeStudentModal();

                return;
            }

            if (
                modalOverlay
                    ?.classList.contains(
                        "open"
                    )
            ) {

                closeMainModal();
            }

        }
    );


    /* =====================================================
       INICIALIZAÇÃO
    ===================================================== */

    window.addEventListener("popstate",()=>{
        const q=new URLSearchParams(location.search),id=q.get("turma"),type=q.get("tipo");
        if(id&&["base","electives"].includes(type))showClassInCurrentTab(type,id);else showClassesView();
    });
    loadData();
    const startParams=new URLSearchParams(location.search);
    if(startParams.get("turma")&&["base","electives"].includes(startParams.get("tipo")))showClassInCurrentTab(startParams.get("tipo"),startParams.get("turma"));


    initializeCustomSelects();

    /*
     * Nenhuma turma ou eletiva é criada aqui.
     * Tudo é cadastrado pelo usuário.
     */

    changeTab("base");

    updateSummary();
    updateYearFilter();
    renderTables();

    byId("connection")?.addEventListener("click",()=>{if(!navigator.onLine){showToast("Sem internet. As alterações ficam guardadas neste dispositivo.","warning");return}if(!supabaseIsConfigured()||!getSupabaseSession())openSupabaseLogin();else syncWithSupabase()});
    byId("connection")?.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();byId("connection").click()}});
    activityBell?.addEventListener("click",()=>{
        if(activityDialog){activityDialog.close();activityDialog.remove();activityDialog=null;activityBell.setAttribute("aria-expanded","false");return}
        const items=readActivities().map(item=>({...item,read:true}));localStorage.setItem(ACTIVITY_KEY,JSON.stringify(items));updateActivityBell();
        activityDialog=document.createElement("dialog");activityDialog.className="alunotec-notice activity-dialog";activityDialog.innerHTML='<div class="activity-heading"><div class="notice-symbol"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg></div><div><h2>Atividades das turmas</h2><p>Alterações recentes</p></div></div><div class="activity-list"></div><div class="notice-actions"><button type="button" class="notice-clear">Limpar notificações</button></div>';
        const list=activityDialog.querySelector(".activity-list");
        const render=()=>{const data=readActivities();list.innerHTML=data.length?data.map(item=>'<article class="activity-item"><span class="activity-dot"></span><div><p>'+escapeHTML(item.message)+'</p><time>'+new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(item.date))+'</time></div></article>').join(""):'<p class="activity-empty">Nenhuma notificação por enquanto.</p>'};
        render();activityDialog.querySelector(".notice-clear").onclick=()=>{localStorage.setItem(ACTIVITY_KEY,"[]");render();updateActivityBell()};
        activityDialog.addEventListener("cancel",e=>e.preventDefault());
        activityDialog.addEventListener("click",e=>{if(e.target!==activityDialog)return;const r=activityDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){activityDialog.close();activityDialog.remove();activityDialog=null;activityBell.setAttribute("aria-expanded","false")}});
        document.body.append(activityDialog);activityDialog.showModal();activityBell.setAttribute("aria-expanded","true");
    });
    window.addEventListener("storage",event=>{if(event.key===ACTIVITY_KEY)updateActivityBell();if(event.key!==STORAGE_KEY)return;const previous=JSON.parse(JSON.stringify(state.data));loadData();describeChanges(previous,state.data).forEach(recordActivity);renderTables()});
    updateActivityBell();
    updateConnectionStatus();
    if(internetReachable===true)syncWithSupabase();

});
