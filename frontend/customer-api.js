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
  deleteAccount() { return this.request("account/delete",{method:"POST",body:{}}); }
  publicStations(params) { return this.request(`public-stations?${new URLSearchParams(params)}`); }
  state() { return this.request("state"); }
  preferences(value) { return this.request("preferences",{method:"PUT",body:value}); }
  start(value,key) { return this.request("sessions",{method:"POST",body:value,key}); }
  carBattery(id, soc) { return this.request(`sessions/${encodeURIComponent(id)}/battery`,{method:"POST",body:{soc}}); }
  pause(id) { return this.request(`sessions/${encodeURIComponent(id)}/pause`,{method:"POST",body:{}}); }
  resume(id) { return this.request(`sessions/${encodeURIComponent(id)}/resume`,{method:"POST",body:{}}); }
  stop(id) { return this.request(`sessions/${encodeURIComponent(id)}/stop`,{method:"POST",body:{}}); }
  checkout(id,payment = {}) { return this.request(`sessions/${encodeURIComponent(id)}/checkout`,{method:"POST",body:payment}); }
  paymentOrder(id) { return this.request(`sessions/${encodeURIComponent(id)}/payment`,{method:"POST",body:{}}); }
  signIn(idToken) { return this.request("auth/firebase",{method:"POST",body:{idToken}}); }
  signOut() { return this.request("auth/logout",{method:"POST",body:{}}); }
  reset() { return this.request("reset",{method:"POST",body:{}}); }
  verify(value) { return this.request("verify",{method:"POST",body:value}); }
  book(value) { return this.request("bookings",{method:"POST",body:value}); }
  cancelBooking(id) { return this.request(`bookings/${encodeURIComponent(id)}/cancel`,{method:"POST",body:{}}); }
  review(station,value) { return this.request(`stations/${encodeURIComponent(station)}/review`,{method:"POST",body:value}); }
  report(value) { return this.request("reports",{method:"POST",body:value}); }
  trip(params) { return this.request(`trip?${new URLSearchParams(params)}`); }
}
