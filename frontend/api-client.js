class ChargeFlowApi {
  constructor(baseUrl = "") { this.baseUrl = baseUrl; this.token = ""; }

  async request(path, options = {}) {
    // The operator's Firebase ID token, set by operator-auth.js after phone sign-in.
    const auth = this.token ? { Authorization: `Bearer ${this.token}` } : {};
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...auth, ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => ({ error: "Invalid server response" }));
    if (response.status === 401 || response.status === 403) {
      window.dispatchEvent(new CustomEvent("operator-auth-required", { detail: payload }));
    }
    if (!response.ok || payload.ok === false) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }

  health() { return this.request("/api/health"); }
  operatorAuth() { return this.request("/api/operator/auth"); }
  station() { return this.request("/api/station"); }
  charger(id) { return this.request(`/api/chargers/${encodeURIComponent(id)}`); }
  plan(data) { return this.request("/api/plan", { method: "POST", body: JSON.stringify(data) }); }
  budget(data) { return this.request("/api/budget", { method: "POST", body: JSON.stringify(data) }); }
  queue() { return this.request("/api/queue"); }
  addToQueue(data) { return this.request("/api/queue", { method: "POST", body: JSON.stringify(data) }); }
  serveNext() { return this.request("/api/queue/serve", { method: "POST", body: "{}" }); }
  simulateSolar(data) { return this.request("/api/solar/simulate", { method: "POST", body: JSON.stringify(data) }); }
  emergency(data) { return this.request("/api/emergency", { method: "POST", body: JSON.stringify(data) }); }
}

window.chargeFlowApi = new ChargeFlowApi();
