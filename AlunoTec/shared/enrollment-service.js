/* Adaptador preparado para o banco compartilhado.
 * Conflitos, falta de sessão e falhas mantêm a cópia local e a fila pendente. */
(() => {
  "use strict";
  const root = typeof window === "undefined" ? globalThis : window;

  function createService(options) {
    const config = options.config;
    const enabled = config.enabled === true;
    let message = "Matrículas salvas neste navegador. O serviço compartilhado ainda não está configurado.";
    let busy = false;
    let timer;
    const managers = new Set(["ADMIN", "ADMINISTRADOR", "SUPER_ADMIN", "SECRETARIA", "ADMINISTRATIVO"]);

    function status(value) {
      if (value) {
        message = value;
        options.onStatus?.(message);
      }
      return message;
    }

    async function request(path, csrf = "", body = null) {
      const base = new URL(config.basePath || "/api/alunotec", options.origin);
      if (base.origin !== options.origin || !["https:", "http:"].includes(base.protocol)) throw new Error("Configure uma API da mesma origem do AlunoTec.");
      if (base.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("A sincronização exige HTTPS.");
      const response = await options.fetch(base.href.replace(/\/$/, "") + path, {
        method: body ? "PUT" : "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-Token": csrf } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(response.status === 409 ? "Há alterações mais recentes no servidor. Os dados locais foram preservados para conciliação." : result?.message || "O serviço não confirmou a sincronização.");
        error.status = response.status;
        throw error;
      }
      if (!result || typeof result !== "object") throw new Error("O serviço retornou uma resposta inválida.");
      return result;
    }

    async function sync() {
      if (!enabled || busy || !options.canUse()) return false;
      if (!options.online()) {
        status("Salvo neste dispositivo. Aguardando conexão para sincronizar as matrículas.");
        return false;
      }
      busy = true;
      try {
        status("Verificando a sessão e as matrículas no servidor...");
        const session = await request("/session");
        const role = String(session.role || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        if (session.authenticated !== true || !managers.has(role) || !session.csrfToken) throw new Error("Entre no serviço da escola com um perfil administrativo autorizado.");
        const local = options.repository.read();
        const classes = options.repository.readClasses();
        const remote = await request("/enrollment");
        const syncState = JSON.parse(options.storage.getItem("alunotec_matriculas_sync_v1") || "{}");
        const remoteRevision = remote.remoteRevision;
        if (remoteRevision !== null && (!Number.isInteger(remoteRevision) || remoteRevision < 0)) throw new Error("A revisão do servidor é inválida.");
        if (syncState.pending || (remoteRevision === null && local.revision > 0)) {
          if (remoteRevision !== null && syncState.remoteRevision !== remoteRevision) throw new Error("O servidor já possui dados diferentes. Faça a conciliação inicial antes de sincronizar; nenhum registro foi substituído.");
          const result = await request("/enrollment", session.csrfToken, {
            expectedRemoteRevision: remoteRevision,
            document: local,
            classes,
          });
          if (!Number.isInteger(result.remoteRevision)) throw new Error("O servidor não confirmou a revisão gravada.");
          options.repository.acknowledgeSync(
            local.revision,
            result.remoteRevision,
            JSON.stringify(options.repository.readClasses()) === JSON.stringify(classes)
          );
          const pendingClasses = JSON.parse(options.storage.getItem("alunotec_turmas_pending_sync_v1") || "null");
          if (pendingClasses && JSON.stringify(pendingClasses.data) === JSON.stringify(classes)) {
            options.storage.removeItem("alunotec_turmas_pending_sync_v1");
          }
        } else if (remoteRevision !== null && remoteRevision !== syncState.remoteRevision) {
          const hasLocalClasses = [...classes.base, ...classes.electives].length > 0;
          if (!Number.isInteger(syncState.remoteRevision) && (local.revision > 0 || hasLocalClasses)) throw new Error("Há cadastros locais e remotos. A importação inicial precisa de conciliação para preservar ambos.");
          if (options.storage.getItem("alunotec_turmas_pending_sync_v1")) throw new Error("Há alterações locais de turmas pendentes. Resolva essa fila antes de receber dados remotos.");
          await options.repository.acceptRemote(remote, local.revision);
        }
        const current = JSON.parse(options.storage.getItem("alunotec_matriculas_sync_v1") || "{}");
        status(current.pending ? "Servidor atualizado; há novas alterações locais aguardando envio." : "Matrículas sincronizadas com o serviço da escola.");
        return true;
      } catch (error) {
        status(`Os dados locais foram preservados. ${error.message}`);
        return false;
      } finally {
        busy = false;
      }
    }

    function schedule() {
      if (!enabled) return;
      clearTimeout(timer);
      timer = setTimeout(sync, 300);
    }

    return Object.freeze({ enabled, sync, schedule, status: () => status() });
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { createService };
  if (typeof window !== "undefined") {
    root.AlunoTecEnrollmentService = createService({
      config: root.AlunoTecEnrollmentServiceConfig || {},
      origin: location.origin,
      repository: root.AlunoTecEnrollment,
      storage: localStorage,
      fetch: (...args) => fetch(...args),
      online: () => navigator.onLine,
      canUse: () => root.AlunoTecAccess?.session()?.role === "LOCAL" && root.AlunoTecAccess.session().mode === "local",
      onStatus: () => root.dispatchEvent(new Event("alunotec:enrollmentsync")),
    });
    root.addEventListener("alunotec:classeschange", () => root.AlunoTecEnrollmentService.schedule());
    root.addEventListener("online", root.AlunoTecEnrollmentService.schedule);
    root.addEventListener("alunotec:enrollmentchange", root.AlunoTecEnrollmentService.schedule);
  }
})();
