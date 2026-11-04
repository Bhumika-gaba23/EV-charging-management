import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Verify the actual selected framebuffer against the asset, including the
// two-sided transparent glass passes and the two-triangle contact shadow.
const expectedTriangles = {};
for (const id of ["car", "scooter", "bike"]) {
  const data = await readFile(
    new URL(`../../frontend/assets/models/${id}.glb`, import.meta.url),
  );
  const length = data.readUInt32LE(12);
  const gltf = JSON.parse(data.subarray(20, 20 + length).toString());
  let total = 2;
  for (const node of gltf.nodes) {
    if (node.mesh === undefined) continue;
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const material = gltf.materials[primitive.material];
      const passes =
        material?.alphaMode === "BLEND" && material.doubleSided ? 2 : 1;
      total += (gltf.accessors[primitive.indices].count / 3) * passes;
    }
  }
  expectedTriangles[id] = total;
}
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || "chrome",
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: [],
  });
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:4173/?demo=1", { waitUntil: "networkidle" });
  await p.waitForFunction(() => window.pluggoPerformance?.().ready);
  assert.match(await p.title(), /^Pluggo/);
  assert.equal(
    (await p.locator("#stageWatermark").textContent()).replace(/\s/g, ""),
    "TESLAMODEL3",
  );
  const layerOrder = await p.evaluate(() => ({
    text: +getComputedStyle(document.querySelector("#stageWatermark")).zIndex,
    model: +getComputedStyle(document.querySelector("#vehicleCanvas")).zIndex,
  }));
  assert.ok(layerOrder.model > layerOrder.text);
  assert.equal(await p.locator("#vehicleStage button").count(), 0);
  assert.doesNotMatch(
    await p.locator("#vehicleStage").textContent(),
    /drag to explore|your garage|demo profile|your selected vehicle/i,
  );
  assert.equal(
    await p.locator(".vehicle-stats,.city-strip,.hero-note").count(),
    0,
  );
  await p.evaluate(() => {
    window.modelLayerChanges = 0;
    window.modelLayerObserver = new MutationObserver(
      () => window.modelLayerChanges++,
    );
    window.modelLayerObserver.observe(
      document.querySelector("#vehicleCanvas"),
      { attributes: true, attributeFilter: ["class"] },
    );
  });
  await p.locator("#vehicleCanvas canvas").click();
  await p.locator("#vehicleStage").hover({ position: { x: 60, y: 80 } });
  await p.waitForTimeout(250);
  assert.match(
    await p.locator("#stageWatermark").getAttribute("style"),
    /translate3d/,
  );
  assert.equal(
    await p.evaluate(() => modelLayerChanges),
    0,
    "Interacting with the clean showroom must not reselect its model",
  );
  await p.evaluate(() => modelLayerObserver.disconnect());
  await p.waitForTimeout(2200);
  const performance = await p.evaluate(() => pluggoPerformance());
  console.log("Measured showroom performance:", performance);
  if (process.env.ENFORCE_60_FPS === "1") {
    assert.ok(performance.fps >= 55);
    assert.ok(performance.frameTimeP95 < 23);
  }
  await p.getByRole("button", { name: "Scooter", exact: true }).click();
  assert.equal(
    await p.locator("#vehicleStage").getAttribute("data-vehicle-kind"),
    "scooter",
  );
  await p.waitForFunction(
    () =>
      pluggoPerformance().ready && pluggoPerformance().vehicle === "scooter",
  );
  // A cached selection is ready only once that model has actually been drawn.
  // Repeated changes plus a resize previously left the old vehicle in the canvas.
  for (const [id, label] of [
    ["bike", "Bike"],
    ["car", "Car"],
    ["bike", "Bike"],
    ["car", "Car"],
    ["scooter", "Scooter"],
  ]) {
    await p.getByRole("button", { name: label, exact: true }).click();
    await p.waitForFunction(
      (id) => pluggoPerformance().ready && pluggoPerformance().vehicle === id,
      id,
    );
    const rendered = await p.evaluate(() => pluggoPerformance());
    assert.equal(rendered.triangles, expectedTriangles[id]);
  }
  // Selecting a cached asset from the garage must replace the framebuffer
  // even though the home showroom's animation loop is intentionally paused.
  await p.getByRole("link", { name: "My garage", exact: true }).click();
  await p.locator("#page-garage").waitFor({ state: "visible" });
  await p.locator('#garageVehicles [data-vehicle="car"]').click();
  await p.waitForFunction(
    () => pluggoPerformance().ready && pluggoPerformance().vehicle === "car",
  );
  assert.equal(
    await p.evaluate(() => pluggoPerformance().triangles),
    expectedTriangles.car,
  );
  assert.equal(await p.evaluate(() => pluggoPerformance().running), false);
  await p.getByRole("switch", { name: "Animate vehicle previews" }).uncheck();
  assert.equal(
    await p.evaluate(() => pluggoPerformance().motionEnabled),
    false,
  );
  await p.getByRole("switch", { name: "Animate vehicle previews" }).check();
  assert.equal(await p.evaluate(() => pluggoPerformance().motionEnabled), true);
  await p.getByRole("link", { name: "Home", exact: true }).click();
  await p.waitForFunction(() => pluggoPerformance().running);
  await p.getByRole("button", { name: "Scooter", exact: true }).click();
  await p.waitForFunction(
    () =>
      pluggoPerformance().ready && pluggoPerformance().vehicle === "scooter",
  );
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => scrollTo(0, 0));
  await p.waitForFunction(() => pluggoPerformance().running);
  await p.setViewportSize({ width: 1440, height: 1000 });
  await p.getByRole("button", { name: "Find a charger" }).click();
  await p.waitForURL("**#stations");
  await p.waitForFunction(() => !pluggoPerformance().running);
  assert.equal(await p.evaluate(() => pluggoPerformance().running), false);
  await p.locator("#stationSearch").fill("missing");
  assert.equal(await p.locator("#mapEmpty").isVisible(), true);
  await p.getByRole("button", { name: "Clear filters" }).click();
  assert.equal(await p.locator("#stationSearch").inputValue(), "");
  assert.match(await p.locator("#resultCount").textContent(), /4 compatible stations/);
  await p
    .locator("#stationSelection")
    .getByRole("button", { name: "View Central Circle", exact: true })
    .click();
  assert.equal(await p.locator('[data-connector="CP-01"]').isDisabled(), true);
  await p.getByRole("button", { name: "Scan or enter code" }).click();
  await p.locator("#chargerCode").fill("not-a-charger");
  await p.getByRole("button", { name: "Verify", exact: true }).click();
  assert.match(await p.locator("#codeError").textContent(), /Unknown code/);
  await p.locator("#chargerCode").fill("PLUGGO:CP-03");
  await p.getByRole("button", { name: "Verify", exact: true }).click();
  assert.equal(await p.locator("#dialogActions button").count(), 1);
  assert.equal(
    await p.locator("#dialogActions button").getAttribute("form"),
    "chargePlan",
  );
  await p.getByRole("button", { name: "Start simulated charging" }).click();
  assert.equal(await p.locator(".charging-metrics > div").count(), 3);
  await p.waitForTimeout(1200);
  assert.equal(
    await p.evaluate(
      () =>
        JSON.parse(localStorage.getItem("chargeflow.web.v1")).sessions.length,
    ),
    1,
  );
  await p.reload({ waitUntil: "networkidle" });
  await p.getByRole("link", { name: "Sessions", exact: true }).click();
  await p.getByRole("button", { name: "View live session" }).click();
  await p.getByRole("button", { name: "Stop demo charging" }).click();
  await p.getByRole("button", { name: "Continue to demo checkout" }).click();
  assert.match(
    await p.locator("#dialogBody").textContent(),
    /Demo checkout · no payment details required/,
  );
  await p.getByRole("button", { name: "Complete demo payment · ₹0" }).click();
  assert.match(
    await p.locator("#dialogBody").textContent(),
    /Demo payment completed/,
  );
  await p.locator("#closeDialog").click();
  await p.reload({ waitUntil: "networkidle" });
  assert.equal(
    await p.evaluate(
      () =>
        JSON.parse(localStorage.getItem("chargeflow.web.v1")).sessions[0]
          .settled,
    ),
    true,
  );
  await p.getByRole("button", { name: "View receipt" }).click();

  await p.locator("#closeDialog").click();
  await p.getByRole("link", { name: "Stations", exact: true }).click();
  await p.getByRole("button", { name: "Use my location" }).click();
  await p.waitForFunction(
    () => document.querySelector("#useLocation").disabled === false,
  );
  assert.match(
    await p.locator("#locationMessage").textContent(),
    /location|permission|denied/i,
  );
  await p.getByRole("button", { name: "Available now", exact: true }).click();
  assert.match(await p.locator("#resultCount").textContent(), /3 compatible stations/);

  for (const width of [320, 390, 768, 1024, 1440]) {
    await p.setViewportSize({ width, height: 900 });
    for (const route of ["home", "stations", "sessions", "garage"]) {
      await p.goto("http://127.0.0.1:4173/?demo=1#" + route, {
        waitUntil: "networkidle",
      });
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${route} overflow at ${width}`,
      );
    }
  }
  const phone = await context.newPage({
    viewport: { width: 390, height: 844 },
  });
  phone.on("pageerror", (e) => errors.push(e.message));
  await phone.goto("http://127.0.0.1:4173/?demo=1", { waitUntil: "networkidle" });
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ]) {
    await phone.setViewportSize(size);
    await phone.waitForTimeout(100);
    await phone.locator('#findStations').evaluate(element=>element.scrollIntoView({block:'center',behavior:'instant'}));
    const placement = await phone.evaluate(() => {
      const action = document
        .querySelector("#findStations")
        .getBoundingClientRect();
      const nav = document
        .querySelector(".nav-position")
        .getBoundingClientRect();
      return { actionBottom: action.bottom, navTop: nav.top };
    });
    assert.ok(
      placement.actionBottom < placement.navTop,
      JSON.stringify({ size, placement }),
    );
    const targets = await phone
      .locator("button:not([disabled]),.glass-nav a")
      .evaluateAll((elements) =>
        elements
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return r.width && r.height && r.top >= 0 && r.bottom <= innerHeight;
          })
          .map((e) => ({
            label: e.getAttribute("aria-label") || e.textContent.trim(),
            width: e.getBoundingClientRect().width,
            height: e.getBoundingClientRect().height,
          })),
      );
    for (const target of targets) {
      assert.ok(
        target.width >= 44 && target.height >= 44,
        JSON.stringify(target),
      );
    }
  }
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.getByRole("button", { name: "Find a charger" }).click();
  await phone.waitForURL("**#stations");
  await phone.locator("#stationMap").waitFor({state:"visible"});
  assert.equal(await phone.locator("#stationMap").isVisible(), true);
  assert.equal(await phone.locator("#stationSelection").isVisible(), true);
  await phone
    .locator("#stationSelection")
    .getByRole("button", { name: "View Central Circle", exact: true })
    .click();
  await phone.locator('[data-connector="CP-03"]').click();
  await phone.getByRole("button", { name: "Select charger" }).click();
  const footer = await phone.locator("#dialogActions").boundingBox();
  const body = await phone.locator("#dialogBody").boundingBox();
  assert.ok(footer.y + footer.height <= 844.5);
  assert.ok(body.y + body.height <= footer.y + 0.5);
  await phone.getByRole("button", { name: "Start simulated charging" }).click();
  await phone.getByRole("button", { name: "Stop demo charging" }).click();
  await phone
    .getByRole("button", { name: "Continue to demo checkout" })
    .click();
  await phone
    .getByRole("button", { name: "Complete demo payment · ₹0" })
    .click();
  assert.match(
    await phone.locator("#dialogBody").textContent(),
    /No real money was charged/,
  );
  console.log(
    "PASS: phone controls are at least 44px, Home station action scrolls clear of navigation, map and selected-station card work, and bottom-sheet action bars submit through to a receipt.",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: vehicle switch, compatibility, filter/search, QR fallback, session restore, stop, ₹0 checkout, receipt, denied location, 20 responsive page checks; no page errors.",
  );
  const fallback = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type.startsWith("webgl")) return null;
      return original.call(this, type, ...args);
    };
  });
  await fallback.goto("http://127.0.0.1:4173/?demo=1", { waitUntil: "networkidle" });
  await fallback.locator("#vehicleFallback").waitFor({ state: "visible" });
  await fallback.getByRole("button", { name: "Bike", exact: true }).click();
  assert.match(
    await fallback.locator("#vehicleFallback").getAttribute("src"),
    /bike/,
  );
  console.log(
    "PASS: unavailable WebGL falls back to the selected vehicle illustration.",
  );
  const reduced = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await reduced.goto("http://127.0.0.1:4173/?demo=1", { waitUntil: "networkidle" });
  await reduced.waitForFunction(() => window.pluggoPerformance?.().ready);
  assert.equal(await reduced.locator("#previewMotion").isChecked(), false);
  assert.equal(
    await reduced.evaluate(() => pluggoPerformance().motionEnabled),
    false,
  );
  await reduced.locator("#vehicleStage").hover({ position: { x: 60, y: 90 } });
  await reduced.waitForTimeout(150);
  assert.equal(
    await reduced
      .locator("#stageWatermark")
      .evaluate((el) => el.style.transform),
    "",
  );
  console.log(
    "PASS: reduced motion disables automatic rotation and text parallax.",
  );
} finally {
  await browser.close();
}
