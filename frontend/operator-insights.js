// Analytics, charger reports and wallet credit for the operator dashboard.
// A classic script loaded after portal.js: it reuses portal.js's $, api, toast, escapeHTML,
// apiOnline and recentVehicleData.
(() => {
  const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const kwh = (n) => `${Number(n || 0).toFixed(2)} kWh`;
  const KINDS = { "not-working": "Charger not working", blocked: "Bay blocked", damaged: "Cable or plug damaged", payment: "Payment or bill", other: "Something else" };
  const BANDS = { "off-peak": "Off-peak · 22:00–06:00", standard: "Standard · 06:00–18:00", peak: "Peak · 18:00–22:00" };
  const time = (ms) => new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const visible = (id) => document.getElementById(id)?.classList.contains("active-panel") && !document.hidden;
  const offline = (box, message) => { $(box).innerHTML = `<article class="card"><p class="queue-empty">${escapeHTML(message)}</p></article>`; };

  // A bar chart as inline SVG: one series, values labelled on hover/focus through <title>.
  function bars(values, { labels, format, height = 120, highlight = -1 }) {
    const max = Math.max(...values, 0);
    const width = Math.max(240, values.length * 18), step = width / values.length, bar = Math.max(4, step * 0.62);
    const body = values.map((value, i) => {
      const h = max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * (height - 22)) : 0;
      const x = i * step + (step - bar) / 2;
      return `<g class="insight-bar${i === highlight ? " is-peak" : ""}" tabindex="0"><title>${escapeHTML(labels[i])}: ${escapeHTML(format(value))}</title><rect class="insight-hit" x="${i * step}" y="0" width="${step}" height="${height}"/><rect class="insight-base" x="${x}" y="${height - 16}" width="${bar}" height="1.5"/>${h ? `<rect class="insight-fill" x="${x}" y="${height - 16 - h}" width="${bar}" height="${h}" rx="3"/>` : ""}</g>`;
    }).join("");
    const ticks = values.map((_, i) => i % Math.ceil(values.length / 7) === 0 ? `<text class="insight-tick" x="${i * step + step / 2}" y="${height - 3}">${escapeHTML(labels[i].split(" ")[0])}</text>` : "").join("");
    return `<svg viewBox="0 0 ${width} ${height}" role="img" preserveAspectRatio="none" aria-label="${escapeHTML(labels.length)} values">${body}${ticks}</svg><p class="insight-caption">Peak ${escapeHTML(format(max))}</p>`;
  }

  async function loadAnalytics() {
    if (!apiOnline) { offline("#analyticsTotals", "Analytics need the C++ backend."); return; }
    try {
      const data = await api.analytics($("#analyticsDays").value);
      const t = data.totals;
      const metrics = [
        ["REVENUE BILLED", rupees(t.billed), `${t.completedSessions} completed charge${t.completedSessions === 1 ? "" : "s"}`],
        ["COLLECTED", rupees(t.collected - t.refunded), `${rupees(t.refunded)} refunded · ${rupees(t.walletUsed)} from wallets`],
        ["ENERGY", kwh(t.energyKWh), `${Number(t.averageKWh).toFixed(2)} kWh per charge`],
        ["RATING", t.ratings ? `${Number(t.averageRating).toFixed(1)} ★` : "—", `${t.ratings} rating${t.ratings === 1 ? "" : "s"} · ${t.openReports} open report${t.openReports === 1 ? "" : "s"}`],
      ];
      $("#analyticsTotals").innerHTML = metrics.map(([label, value, note]) => `<article class="metric"><p>${label}</p><strong>${escapeHTML(value)}</strong><span>${escapeHTML(note)}</span></article>`).join("");
      const dayLabels = data.daily.map((d) => new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) + ` · ${d.sessions} charge${d.sessions === 1 ? "" : "s"}`);
      $("#analyticsDaily").innerHTML = bars(data.daily.map((d) => d.revenue), { labels: dayLabels, format: rupees });
      const hourly = data.hourly.map((h) => h.utilisation);
      const peak = hourly.indexOf(Math.max(...hourly));
      $("#analyticsHourly").innerHTML = bars(hourly, { labels: data.hourly.map((h) => `${String(h.hour).padStart(2, "0")}:00 hour`), format: (v) => `${v.toFixed(v > 0 && v < 1 ? 2 : 1)}% of charger time`, highlight: hourly[peak] > 0 ? peak : -1 });
      $("#analyticsStations").innerHTML = `<table class="insight-table"><thead><tr><th scope="col">Station</th><th scope="col">Charges</th><th scope="col">Energy</th><th scope="col">Revenue</th><th scope="col">Rating</th></tr></thead><tbody>${data.stations.map((s) => `<tr><th scope="row">${escapeHTML(s.name)}</th><td>${s.sessions}</td><td>${kwh(s.energyKWh)}</td><td>${rupees(s.revenue)}</td><td>${s.ratings ? `${Number(s.averageRating).toFixed(1)} ★ (${s.ratings})` : "—"}</td></tr>`).join("")}</tbody></table>`;
      const b = data.bookings;
      $("#analyticsBands").innerHTML = `<table class="insight-table"><thead><tr><th scope="col">Band</th><th scope="col">Charges</th><th scope="col">Energy</th><th scope="col">Revenue</th></tr></thead><tbody>${data.bands.map((x) => `<tr><th scope="row">${escapeHTML(BANDS[x.band] || x.band)}</th><td>${x.sessions}</td><td>${kwh(x.energyKWh)}</td><td>${rupees(x.revenue)}</td></tr>`).join("")}</tbody></table><p class="insight-caption">${data.tariff.enabled ? `Now: ${escapeHTML(BANDS[data.tariff.band] || data.tariff.band)}. Off-peak is 20% cheaper, peak 20% dearer.` : "Time-of-use pricing is off: every charge uses the station's base rate."}</p><p class="insight-caption">Bookings in this period: ${b.used} used · ${b.booked} upcoming · ${b["no-show"]} no-show · ${b.cancelled} cancelled.</p>`;
      $("#analyticsUpdated").textContent = `Updated ${new Date(data.serverTime).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" })}`;
    } catch (error) { offline("#analyticsTotals", error.message); }
  }

  let reportData = [];
  async function loadReports() {
    if (!apiOnline) { offline("#reportList", "Reports need the C++ backend."); return; }
    try {
      const data = await api.reports();
      reportData = data.reports;
      $("#openReportCount").hidden = !data.open;
      $("#openReportCount").textContent = data.open;
      $("#reportList").innerHTML = reportData.map((r) => `<article class="card report-card ${r.status}"><div class="card-heading"><div><p class="eyebrow">${escapeHTML(r.stationName)}${r.connector ? ` · ${escapeHTML(r.connector)}` : ""}</p><h2>${escapeHTML(KINDS[r.kind] || r.kind)}</h2></div><span class="tag">${r.status === "open" ? "OPEN" : "RESOLVED"}</span></div>${r.note ? `<p class="report-note">“${escapeHTML(r.note)}”</p>` : ""}<p class="session-sync-note">Reported ${escapeHTML(time(r.created))} · ${escapeHTML(r.id)}${r.status === "resolved" ? `<br>Resolved ${escapeHTML(time(r.resolved))}: ${escapeHTML(r.resolution)}${r.credit > 0 ? ` · ${rupees(r.credit)} credit` : ""}` : ""}</p>${r.status === "open" ? `<button type="button" class="refund-button" data-resolve="${escapeHTML(r.id)}">Resolve…</button>` : ""}</article>`).join("")
        || `<article class="card"><p class="queue-empty">No reports yet. Drivers report faults from a station's page in the app.</p></article>`;
    } catch (error) { offline("#reportList", error.message); }
  }

  let resolving = null, crediting = null;
  document.addEventListener("click", (event) => {
    const resolve = event.target.closest("[data-resolve]");
    if (resolve) {
      resolving = reportData.find((r) => r.id === resolve.dataset.resolve);
      if (!resolving) return;
      $("#resolveSummary").textContent = `${resolving.stationName}${resolving.connector ? ` · ${resolving.connector}` : ""}: ${KINDS[resolving.kind] || resolving.kind}. The driver is told when you resolve it.`;
      $("#resolveDialog").showModal();
    }
    const credit = event.target.closest("[data-credit]");
    if (credit) {
      crediting = (recentVehicleData.recentSessions || []).find((s) => s.id === credit.dataset.credit);
      if (!crediting) return;
      $("#creditSummary").textContent = `${crediting.vehicleName || crediting.vehicle} · ${crediting.id}. The credit pays for the driver's next charges automatically.`;
      $("#creditDialog").showModal();
    }
  });
  $("#cancelResolve").addEventListener("click", () => $("#resolveDialog").close());
  $("#cancelCredit").addEventListener("click", () => $("#creditDialog").close());
  $("#resolveForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!resolving) return;
    const button = $("#confirmResolve");
    button.disabled = true;
    try {
      await api.resolveReport(resolving.id, { resolution: $("#resolveNote").value.trim() || "Fixed by the operator", credit: Number($("#resolveCredit").value) });
      $("#resolveDialog").close();
      toast(Number($("#resolveCredit").value) > 0 ? `Resolved. ₹${$("#resolveCredit").value} added to the driver's wallet.` : "Report resolved.");
      loadReports();
    } catch (error) { toast(error.message); }
    finally { button.disabled = false; }
  });
  $("#creditForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!crediting) return;
    const amount = Number($("#creditAmount").value), button = $("#confirmCredit");
    if (!(amount >= 1 && amount <= 500)) { toast("Enter ₹1 to ₹500."); return; }
    button.disabled = true;
    try {
      await api.credit({ sessionId: crediting.id, amount, reason: $("#creditReason").value.trim() || "Credit from Pluggo" });
      $("#creditDialog").close();
      toast(`₹${amount} added to the driver's wallet.`);
    } catch (error) { toast(error.message); }
    finally { button.disabled = false; }
  });
  $("#analyticsDays").addEventListener("change", loadAnalytics);
  document.querySelectorAll('.nav-item[data-target="analytics"], .nav-item[data-target="reports"]').forEach((button) =>
    button.addEventListener("click", () => (button.dataset.target === "analytics" ? loadAnalytics : loadReports)()));
  // Keep the open panel fresh, and the open-report count in the menu.
  setInterval(() => {
    if (visible("analytics")) loadAnalytics();
    if (visible("reports") || (apiOnline && !document.hidden)) loadReports();
  }, 15000);
  setTimeout(() => { if (apiOnline) loadReports(); if (visible("analytics")) loadAnalytics(); }, 1500);
})();
