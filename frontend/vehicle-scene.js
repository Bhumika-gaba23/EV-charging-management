import { performanceProfile } from "./performance-profile.js?v=20261104-summary1";
import * as THREE from "three";
import { OrbitControls } from "./vendor/OrbitControls.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { RoomEnvironment } from "./vendor/RoomEnvironment.js";

// Licensed, optimized GLB assets. See assets/models/CREDITS.md for provenance.
const files = {
  car: { url: "assets/models/car.glb?v=white-polish-4", length: 4.8 },
  scooter: { url: "assets/models/scooter.glb?v=white-polish-4", length: 3.4 },
  cargo: { url: null, length: 3.6 },
  bike: { url: "assets/models/bike.glb?v=white-polish-4", length: 3.9 },
};

export function createShowroom(container, onFailure, onStatus = () => {}) {
  const lite = performanceProfile !== "full";
  const targetFps = 60; // Quality-adaptation goal, never a frame limiter.
  const frameBudget = 1000 / targetFps;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  const stage = container.closest(".vehicle-stage");
  const depthText = stage.querySelector(".stage-watermark");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let motionEnabled = !reducedMotion.matches;
  let interacting = false;
  const pointer = { x: 0, y: 0 };
  const depthOffset = { x: 0, y: 0 };
  let stageRect = stage.getBoundingClientRect();
  let baseAzimuth = 0,
    basePolar = 0;
  const maximumRatio = Math.min(devicePixelRatio || 1, 2);
  let pixelRatio = maximumRatio;
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  // Baked AO in the GLBs plus a contact shadow avoid an extra shadow-map pass
  // every frame. Canvas resolution can adapt without blurring the HTML UI.
  renderer.shadowMap.enabled = false;
  container.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute(
    "aria-label",
    "Interactive vehicle. Arrow keys rotate; plus and minus zoom.",
  );
  const scene = new THREE.Scene();
  const environment = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  const environmentMap = generator.fromScene(environment, 0.045, 0.1, 100, {size:256});
  scene.environment = environmentMap.texture;
  scene.environmentIntensity = 1.2;
  environment.dispose();
  generator.dispose();
  scene.add(new THREE.HemisphereLight(0xe5edff, 0x15171d, 1.8));
  const key = new THREE.DirectionalLight(0xffffff, 2.5);
  key.position.set(4, 7, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb9cae8, 1.8);
  rim.position.set(-4, 3, -3);
  scene.add(rim);
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const context = shadowCanvas.getContext("2d");
  const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, "rgba(0,0,0,.9)");
  gradient.addColorStop(0.55, "rgba(0,0,0,.55)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 4),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.015;
  scene.add(shadow);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 80);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.8;
  controls.minPolarAngle = Math.PI * 0.22;
  controls.maxPolarAngle = Math.PI * 0.49;
  // Wheel scrolling keeps the page usable; pinch and keyboard zoom the model.
  controls.zoomSpeed = 0.65;
  const loader = new GLTFLoader();
  const cache = new Map();
  let selected = "car",
    generation = 0,
    vehicle = null;
  let manualVisible = true,
    intersecting = true,
    lost = false;
  let raf = 0,
    lastTime = 0,
    dirty = true,
    resetDistance = 7;
  let targetHeight = 0.7,
    resizePending = false;
  let frameDeltas = [],
    sampleCount = 0,
    qualityCooldown = 0;
  const stats = {
    targetFps,
    fpsCap: null,
    antialias: true,
    maximumPixelRatio: maximumRatio,
    profile: performanceProfile,
    renderedFrames: 0,
    cachedModels: 0,
    fps: 0,
    frameTimeP95: 0,
    drawCalls: 0,
    triangles: 0,
    pixelRatio,
    vehicle: "car",
    ready: false,
    running: false,
  };

  function fitCamera() {
    if (!vehicle) return;
    const size = new THREE.Vector3().fromArray(vehicle.userData.dimensions);
    stats.bounds = size.toArray();
    targetHeight = size.y * 0.48;
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Cover the widest rotation angle, including the diagonal footprint.
    const projectedWidth = Math.hypot(size.x, size.z);
    resetDistance = Math.max(
      (size.y * 1.6) / (2 * tangent),
      (projectedWidth * 1.08) /
        (2 * tangent * camera.aspect),
      5.4,
    );
    resetDistance *= 1.12;
    stats.cameraDistance = resetDistance;
    reset();
  }
  function reset() {
    const direction = new THREE.Vector3(1, 0.38, 1.35).normalize();
    controls.target.set(0, targetHeight, 0);
    camera.position
      .copy(controls.target)
      .addScaledVector(direction, resetDistance);
    controls.minDistance = resetDistance * 0.65;
    controls.maxDistance = resetDistance * 1.9;
    controls.update();
    baseAzimuth = controls.getAzimuthalAngle();
    basePolar = controls.getPolarAngle();
    dirty = true;
  }
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    stageRect = stage.getBoundingClientRect();
    const nextAspect = width / height;
    const changed = Math.abs(camera.aspect - nextAspect) > 0.01;
    renderer.setSize(width, height, false);
    camera.aspect = nextAspect;
    camera.updateProjectionMatrix();
    if (changed) fitCamera();
    dirty = true;
  }
  function visible() {
    return manualVisible && intersecting && !document.hidden && !lost;
  }
  function syncAnimation() {
    if (visible() && stats.ready && !raf) {
      lastTime = 0;
      stats.running = true;
      raf = requestAnimationFrame(animate);
    } else if ((!visible() || !stats.ready) && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
      stats.running = false;
      frameDeltas = [];
    }
  }
  function updateDepth(delta) {
    if (lite || !motionEnabled || reducedMotion.matches) {
      if (depthText.style.transform) depthText.style.transform = "";
      depthOffset.x = depthOffset.y = 0;
      return;
    }
    const orbit = controls.getAzimuthalAngle() - baseAzimuth;
    const pitch = controls.getPolarAngle() - basePolar;
    const x = pointer.x * -11 + Math.sin(orbit) * -13;
    const y = pointer.y * -7 + pitch * 10;
    const easing = 1 - Math.exp(-delta * 8);
    const nextX = THREE.MathUtils.lerp(depthOffset.x, x, easing);
    const nextY = THREE.MathUtils.lerp(depthOffset.y, y, easing);
    if (
      Math.abs(nextX - depthOffset.x) + Math.abs(nextY - depthOffset.y) <
      0.015
    )
      return;
    depthOffset.x = nextX;
    depthOffset.y = nextY;
    depthText.style.transform = `translate(-50%, -50%) translate3d(${nextX.toFixed(2)}px, ${nextY.toFixed(2)}px, 0)`;
  }
  stage.addEventListener("pointerenter", () => {
    stageRect = stage.getBoundingClientRect();
  });
  stage.addEventListener(
    "pointermove",
    (event) => {
      if (
        event.pointerType !== "mouse" ||
        !motionEnabled ||
        reducedMotion.matches
      )
        return;
      pointer.x = THREE.MathUtils.clamp(
        ((event.clientX - stageRect.left) / stageRect.width) * 2 - 1,
        -1,
        1,
      );
      pointer.y = THREE.MathUtils.clamp(
        ((event.clientY - stageRect.top) / stageRect.height) * 2 - 1,
        -1,
        1,
      );
    },
    { passive: true },
  );
  stage.addEventListener("pointerleave", () => {
    pointer.x = pointer.y = 0;
  });
  function animate(time) {
    if (!visible()) {
      raf = 0;
      stats.running = false;
      return;
    }
    raf = requestAnimationFrame(animate);
    const rawDelta = lastTime ? time - lastTime : frameBudget;
    const delta = Math.min(rawDelta / 1000, 0.05);
    lastTime = time;
    if (resizePending) {
      resizePending = false;
      resize();
    }
    const changed = controls.update(delta);
    updateDepth(delta);
    if (stats.ready && (dirty || changed || controls.autoRotate)) {
      renderer.render(scene, camera);
      stats.renderedFrames++;
      dirty = false;
      stats.drawCalls = renderer.info.render.calls;
      stats.triangles = renderer.info.render.triangles;
    }
    // Draw on every display callback. Adapt resolution toward 60 FPS without throttling.
    if (stats.ready && rawDelta < 100) {
      frameDeltas.push(rawDelta);
      if (frameDeltas.length > 120) frameDeltas.shift();
      sampleCount++;
      if (sampleCount % 60 === 0 && frameDeltas.length >= 60) {
        const sorted = [...frameDeltas].sort((a, b) => a - b);
        const mean =
          frameDeltas.reduce((sum, value) => sum + value, 0) /
          frameDeltas.length;
        stats.fps = Math.round(1000 / mean);
        stats.frameTimeP95 =
          +sorted[Math.floor(sorted.length * 0.95)].toFixed(2);
        if (time > qualityCooldown && mean > frameBudget * 1.3 && pixelRatio > (lite ? 1.2 : 1.35)) {
          pixelRatio = Math.max(lite ? 1.2 : 1.35, +(pixelRatio - 0.15).toFixed(2));
          renderer.setPixelRatio(pixelRatio);
          resizePending = true;
          stats.pixelRatio = pixelRatio;
          qualityCooldown = time + 4000;
          frameDeltas = [];
        }
      }
    }
    // Static previews sleep completely after controls/damping settle.
    if (!controls.autoRotate && !changed && !dirty && !interacting && !resizePending) {
      cancelAnimationFrame(raf); raf = 0; stats.running = false;
    }
  }
  function disposeModel(root) {
    const resources = new Set();
    root.traverse(object => {
      if (!object.isMesh) return;
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
        resources.add(material);
      }
    });
    for (const resource of resources) resource.dispose();
  }
  function pruneCache() {
    for (const [id,pending] of cache) {
      if (cache.size <= (lite ? 2 : 3)) break;
      if (id === selected) continue;
      cache.delete(id);
      pending.then(root => { if (root !== vehicle) disposeModel(root); }).catch(() => {});
    }
    stats.cachedModels = cache.size;
  }
  function normalize(root, id) {
    root.updateMatrixWorld(true);
    let bounds = new THREE.Box3().setFromObject(root, true);
    let size = bounds.getSize(new THREE.Vector3());
    if (size.z > size.x) root.rotation.y += Math.PI / 2;
    root.updateMatrixWorld(true);
    bounds.setFromObject(root, true);
    size = bounds.getSize(new THREE.Vector3());
    const scale = files[id].length / size.x;
    root.scale.multiplyScalar(scale);
    root.updateMatrixWorld(true);
    bounds.setFromObject(root, true);
    const center = bounds.getCenter(new THREE.Vector3());
    const wrapper = new THREE.Group();
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= bounds.min.y;
    root.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = object.receiveShadow = false;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) {
        material.envMapIntensity = 1;
        if (id === "car" && ["Geohoodsub00021Mtl", "Geohoodsub00031Mtl"].includes(material.name)) {
          material.color.set(0xffffff);
          material.metalness = 0.02;
          material.roughness = 0.34;
          material.emissive.set(0xffffff);
          material.emissiveIntensity = 0;
        }
        for (const name of [
          "map",
          "normalMap",
          "roughnessMap",
          "metalnessMap",
          "aoMap",
        ]) {
          if (material[name])
            material[name].anisotropy = Math.min(
              renderer.capabilities.getMaxAnisotropy(),
              4,
            );
        }
        if (material.isMeshPhysicalMaterial) {
          material.transmission = 0;
          material.thickness = 0;
          material.clearcoat = Math.min(material.clearcoat, 0.55);
        }
      }
    });
    wrapper.add(root);
    wrapper.updateMatrixWorld(true);
    wrapper.userData.dimensions = new THREE.Box3()
      .setFromObject(wrapper, true)
      .getSize(new THREE.Vector3())
      .toArray();
    return wrapper;
  }
  async function setVehicle(id) {
    selected = Object.hasOwn(files, id) ? id : "car";
    const requested = selected;
    if (lost) {
      onFailure();
      return;
    }
    const token = ++generation;
    stats.ready = false;
    syncAnimation();
    stats.fps = 0;
    stats.frameTimeP95 = 0;
    frameDeltas = [];
    onStatus("loading", requested);
    try {
      if (!cache.has(requested)) {
        const source = requested === "cargo"
          ? import("./cargo-model.js?v=20261104-summary1").then(({createCargoVehicle}) => createCargoVehicle())
          : loader.loadAsync(files[requested].url).then(gltf => gltf.scene);
        const pending = source
          .then(root => normalize(root, requested))
          .catch((error) => {
            cache.delete(requested);
            throw error;
          });
        cache.set(requested, pending);
      }
      const pending = cache.get(requested);
      cache.delete(requested); cache.set(requested,pending);
      const next = await pending;
      if (token !== generation || lost) return;
      if (vehicle) scene.remove(vehicle);
      vehicle = next;
      scene.add(vehicle);
      stats.vehicle = requested;
      pruneCache();
      depthOffset.x = depthOffset.y = 0;
      depthText.style.transform = "";
      sampleCount = 0;
      resize();
      fitCamera();
      await renderer.compileAsync(scene, camera);
      if (token !== generation || lost) return;
      // Publish readiness only after the selected asset has actually been drawn,
      // including cached switches while the animation loop is temporarily asleep.
      renderer.render(scene, camera);
      stats.drawCalls = renderer.info.render.calls;
      stats.triangles = renderer.info.render.triangles;
      stats.ready = true;
      dirty = true;
      onStatus("ready", requested);
      syncAnimation();
    } catch {
      if (token === generation) onFailure();
    }
  }
  function updateIntersection() {
    // Read current geometry rather than a possibly queued observer entry from
    // before a viewport/layout change. No layout reads occur in the frame loop.
    const rect = container.getBoundingClientRect();
    intersecting =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.top < innerHeight &&
      rect.right > 0 &&
      rect.left < innerWidth;
  }
  const resizeObserver = new ResizeObserver(() => {
    updateIntersection();
    resizePending = true;
    syncAnimation();
  });
  resizeObserver.observe(container);
  const intersectionObserver = new IntersectionObserver(
    () => {
      updateIntersection();
      syncAnimation();
    },
    { threshold: 0.02 },
  );
  intersectionObserver.observe(container);
  window.addEventListener("resize", () => {
    updateIntersection();
    resizePending = true;
    syncAnimation();
  });
  document.addEventListener("visibilitychange", () => {
    updateIntersection();
    syncAnimation();
  });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
    syncAnimation();
    onFailure();
  });
  canvas.addEventListener("keydown", (event) => {
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "+",
        "-",
        "=",
      ].includes(event.key)
    )
      return;
    event.preventDefault();
    const offset = camera.position.clone().sub(controls.target);
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      offset.applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        event.key === "ArrowLeft" ? -0.12 : 0.12,
      );
    } else if (["+", "-", "="].includes(event.key)) {
      offset.setLength(
        THREE.MathUtils.clamp(
          offset.length() * (event.key === "-" ? 1.1 : 0.9),
          controls.minDistance,
          controls.maxDistance,
        ),
      );
    } else {
      offset.y += event.key === "ArrowUp" ? 0.3 : -0.3;
    }
    camera.position.copy(controls.target).add(offset);
    controls.update();
    dirty = true;
  });
  controls.addEventListener("change", () => {
    dirty = true;
    syncAnimation();
  });
  controls.addEventListener("start", () => { interacting = true; syncAnimation(); });
  controls.addEventListener("end", () => { interacting = false; dirty = true; syncAnimation(); });
  window.addEventListener("pluggo:memorypressure", () => {
    lost = true; stats.ready = false;
    syncAnimation(); controls.dispose();
    for (const pending of cache.values()) pending.then(disposeModel).catch(() => {});
    cache.clear(); stats.cachedModels = 0;
    shadow.geometry.dispose(); shadow.material.dispose(); shadowTexture.dispose();
    environmentMap.dispose(); renderer.dispose(); renderer.forceContextLoss();
    onFailure();
  });
  resize();
  syncAnimation();
  return {
    setVehicle,
    setMotion(value) {
      motionEnabled = value;
      controls.autoRotate = value;
      dirty = true;
      syncAnimation();
    },
    reset,
    setVisible(value) {
      manualVisible = value;
      syncAnimation();
    },
    getStats() {
      return {
        ...stats,
        motionEnabled,
        azimuth: controls.getAzimuthalAngle(),
        autoRotate: controls.autoRotate,
        manualVisible,
        intersecting,
        documentHidden: document.hidden,
      };
    },
  };
}
