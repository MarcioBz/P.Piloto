/* Adaptador HTTP. A sessão e a autorização pertencem ao servidor, nunca ao localStorage. */
(() => {
  "use strict";
  const config = window.AlunoTecTeacherServiceConfig || {};
  const enabled = config.enabled === true;
  let csrf = "";
  const managerRoles = new Set(["ADMINISTRADOR", "ADMIN", "SUPER_ADMIN", "SECRETARIA", "ADMINISTRATIVO"]);
  const normalizeRole = role => String(role || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const canManage = session => session?.authenticated === true && managerRoles.has(normalizeRole(session.role));
  async function request(path, options = {}) {
    if (!enabled) throw new Error("O acesso dos professores ainda depende da configuração do serviço de autenticação da escola.");
    const base = new URL(config.basePath || "/api/alunotec", location.origin);
    if (base.origin !== location.origin || !["https:", "http:"].includes(base.protocol)) throw new Error("Configure uma API da mesma origem do AlunoTec.");
    if (location.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) throw new Error("A autenticação de professores exige HTTPS.");
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(base.href.replace(/\/$/, "") + path, { ...options, credentials: "same-origin", cache: "no-store", signal: controller.signal,
        headers: { "Content-Type": "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}), ...options.headers } });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || (response.status === 401 ? "Sua sessão expirou. Entre novamente." : response.status === 403 ? "Seu perfil não tem permissão para esta operação." : "O serviço de professores não está disponível."));
      if (!payload || typeof payload !== "object") throw new Error("Resposta inválida do serviço de professores.");
      return payload;
    } finally { clearTimeout(timeout); }
  }
  async function session() {
    const result = await request("/session");
    csrf = typeof result.csrfToken === "string" ? result.csrfToken : "";
    return result;
  }
  const api = {
    enabled, canManage, session,
    async login(code) {
      if (!/^\d{5}$/.test(String(code))) throw new Error("Informe o código individual com exatamente 5 dígitos.");
      await request("/teacher/login", { method: "POST", body: JSON.stringify({ code }) });
      const verified = await session();
      if (verified.authenticated !== true || normalizeRole(verified.role) !== "PROFESSOR") throw new Error("Não foi possível confirmar a sessão do professor no servidor.");
      return verified;
    },
    logout: () => request("/logout", { method: "POST", body: "{}" }),
    list: () => request("/teachers"),
    save: payload => request("/teachers" + (payload.id ? "/" + encodeURIComponent(payload.id) : ""), { method: payload.id ? "PATCH" : "POST", body: JSON.stringify(payload) }),
    status: (id, status) => request(`/teachers/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    remove: id => request(`/teachers/${encodeURIComponent(id)}`, { method: "DELETE", body: "{}" }),
    classes: (year, semester) => request(`/teacher/classes?year=${encodeURIComponent(year)}&semester=${encodeURIComponent(semester)}`),
    roster: (id, year, semester) => request(`/teacher/classes/${encodeURIComponent(id)}?year=${encodeURIComponent(year)}&semester=${encodeURIComponent(semester)}`)
  };
  window.AlunoTecTeacherService = Object.freeze(api);
  window.AlunoTecAuth = Object.freeze({ ...window.AlunoTecAuth, teacherLogin: api.login });
})();
