class ChargeFlowApi {
  constructor(baseUrl = "") { this.baseUrl = baseUrl; }

  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({ error: "Invalid server response" }));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
  }

  health() { return this.request("/api/health"); }
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
