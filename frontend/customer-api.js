export class CustomerApi {
  async request(path, {method = "GET", body, key} = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`/api/customer/${path}`, {
        method, credentials:"same-origin", cache:"no-store", signal:controller.signal,
        headers:{"Content-Type":"application/json","X-Pluggo-Request":"1",...(key ? {"Idempotency-Key":key} : {})},
        ...(body === undefined ? {} : {body:JSON.stringify(body)}),
      });
      const payload = await response.json().catch(() => ({error:"The backend returned an invalid response"}));
      if (!response.ok || payload.ok !== true) {
        const error = new Error(payload.error || `Backend request failed (${response.status})`);
        error.status = response.status;
        throw error;
      }
      return payload;
    } finally { clearTimeout(timeout); }
  }
  bootstrap() { return this.request("bootstrap"); }
  state() { return this.request("state"); }
  preferences(value) { return this.request("preferences",{method:"PUT",body:value}); }
  start(value,key) { return this.request("sessions",{method:"POST",body:value,key}); }
  stop(id) { return this.request(`sessions/${encodeURIComponent(id)}/stop`,{method:"POST",body:{}}); }
  checkout(id) { return this.request(`sessions/${encodeURIComponent(id)}/checkout`,{method:"POST",body:{}}); }
  reset() { return this.request("reset",{method:"POST",body:{}}); }
  verify(value) { return this.request("verify",{method:"POST",body:value}); }
}
