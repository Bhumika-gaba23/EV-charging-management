import * as THREE from 'three';

// Original Pluggo designs built in code: an electric SUV, an electric hatchback and an electric
// scooter. They depict vehicle categories, not any manufacturer's product, and need no download.
// Axes: x is length (front at -x), y is up, z is width. vehicle-scene.js scales each to size.

function kit() {
  const root = new THREE.Group();
  const m = {
    paint: new THREE.MeshPhysicalMaterial({ color: 0xeef0ef, metalness: .25, roughness: .3, clearcoat: .6, clearcoatRoughness: .2 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x101820, metalness: .5, roughness: .12, clearcoat: 1 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x1c1f22, metalness: .4, roughness: .45 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141617, roughness: .9 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xb9c0c4, metalness: .9, roughness: .22 }),
    led: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: .9, roughness: .2 }),
    tail: new THREE.MeshStandardMaterial({ color: 0xb11f24, emissive: 0x8a0d10, emissiveIntensity: .6, roughness: .25 }),
    port: new THREE.MeshStandardMaterial({ color: 0x1fbf6a, emissive: 0x1fbf6a, emissiveIntensity: .9, roughness: .3 }),
    seat: new THREE.MeshStandardMaterial({ color: 0x232527, roughness: .75 }),
  };
  const add = (geometry, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); root.add(mesh); return mesh;
  };
  // A side profile (x, y) extruded across the width, with soft rounded edges.
  const extrude = (shape, width, material, z = 0, bevel = .05) => {
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.max(.001, width - 2 * bevel), bevelEnabled: true,
      bevelSegments: 4, bevelSize: bevel, bevelThickness: bevel, curveSegments: 24 });
    geometry.translate(0, 0, -width / 2 + bevel);
    return add(geometry, material, 0, 0, z);
  };
  const rounded = (w, h, d, r, material, x, y, z) => {
    r = Math.min(r, w / 2.2, h / 2.2);
    const s = new THREE.Shape(); const L = -w / 2, B = -h / 2;
    s.moveTo(L + r, B); s.lineTo(L + w - r, B); s.quadraticCurveTo(L + w, B, L + w, B + r); s.lineTo(L + w, B + h - r);
    s.quadraticCurveTo(L + w, B + h, L + w - r, B + h); s.lineTo(L + r, B + h); s.quadraticCurveTo(L, B + h, L, B + h - r);
    s.lineTo(L, B + r); s.quadraticCurveTo(L, B, L + r, B);
    const mesh = extrude(s, d, material, z, Math.min(r, d / 2.5));
    mesh.position.x = x; mesh.position.y = y; return mesh;
  };
  const cylinder = (r, length, material, x, y, z, axis = 'z', segments = 48) =>
    add(new THREE.CylinderGeometry(r, r, length, segments), material, x, y, z, axis === 'z' ? Math.PI / 2 : 0, 0, axis === 'x' ? Math.PI / 2 : 0);
  // A wheel facing ±z: tyre, rim, five spokes and a centre cap.
  const wheel = (x, y, z, r, width, outward) => {
    const tyre = new THREE.TorusGeometry(r - width * .28, width * .42, 20, 56);
    add(tyre, m.rubber, x, y, z);
    cylinder(r - width * .5, width * .9, m.rubber, x, y, z);
    const face = z + outward * width * .36;
    cylinder(r * .66, width * .16, m.rim, x, y, face);
    for (let i = 0; i < 5; i++) {
      const spoke = add(new THREE.BoxGeometry(r * .12, r * .58, width * .1), m.trim, x, y, face + outward * .006);
      spoke.rotation.z = i * Math.PI * 2 / 5;
      spoke.position.x += Math.sin(spoke.rotation.z) * -r * .24; spoke.position.y += Math.cos(spoke.rotation.z) * r * .24;
    }
    cylinder(r * .14, width * .2, m.trim, x, y, face + outward * .01);
  };
  return { root, m, add, extrude, rounded, cylinder, wheel };
}

/** A car from a few numbers: length, width, wheels, body and cabin profiles. */
function car(spec) {
  const k = kit(); const { m } = k;
  const { L, W, wheelR, axle, arch } = spec;
  const half = L / 2;
  // Body: a side profile with open wheel arches, extruded to the car's width.
  const body = new THREE.Shape();
  const b = spec.body;
  body.moveTo(-half + .04, b.sill);
  body.lineTo(-half - .01, b.nose);
  body.quadraticCurveTo(-half - .02, b.hood + .02, -half + b.hoodRound, b.hood);
  body.lineTo(spec.windshieldBase - .05, b.cowl);
  body.lineTo(half - b.tailRound, b.belt);
  body.quadraticCurveTo(half + .01, b.belt, half + .01, b.belt - b.tailRound);
  body.lineTo(half + .02, b.sill + .04);
  body.quadraticCurveTo(half, b.sill, half - .08, b.sill);
  body.lineTo(axle + arch, b.sill);
  body.absarc(axle, wheelR, arch, 0, Math.PI, false);
  body.lineTo(-axle + arch, b.sill);
  body.absarc(-axle, wheelR, arch, 0, Math.PI, false);
  body.lineTo(-half + .04, b.sill);
  k.extrude(body, W, m.paint, 0, .07);
  // Cabin: tinted glass all round, with a painted roof on top.
  const c = spec.cabin;
  const cabin = new THREE.Shape();
  cabin.moveTo(spec.windshieldBase, b.cowl - .04);
  cabin.quadraticCurveTo(c.frontTop - .18, c.roof - .06, c.frontTop, c.roof);
  cabin.lineTo(c.rearTop, c.roof);
  cabin.quadraticCurveTo(c.rearTop + .12, c.roof - .01, c.rearBase, b.belt + .02);
  cabin.lineTo(spec.windshieldBase, b.cowl - .04);
  k.extrude(cabin, W * .9, m.glass, 0, .06);
  const roof = new THREE.Shape();
  roof.moveTo(c.frontTop - .04, c.roof - .05); roof.lineTo(c.rearTop + .02, c.roof - .05);
  roof.quadraticCurveTo(c.rearTop + .08, c.roof + .02, c.rearTop, c.roof + .035);
  roof.lineTo(c.frontTop, c.roof + .035); roof.quadraticCurveTo(c.frontTop - .07, c.roof + .02, c.frontTop - .04, c.roof - .05);
  k.extrude(roof, W * .86, spec.blackRoof ? m.trim : m.paint, 0, .04);
  // Pillars between the side windows.
  for (const x of spec.pillars) k.rounded(.07, c.roof - b.belt - .04, W * .905, .02, m.trim, x, (c.roof + b.belt) / 2, 0);
  // Light bars front and rear (modern EV style), lower grille, underbody.
  k.rounded(.03, .05, W * .78, .02, m.led, -half - .085, b.nose + .03, 0);
  k.rounded(.03, .055, W * .8, .02, m.tail, half + .1, b.belt - .12, 0);
  k.rounded(.03, .1, W * .5, .03, m.trim, -half - .08, b.sill + .12, 0);
  k.rounded(L * .62, .08, W * .7, .03, m.trim, 0, b.sill - .02, 0);
  // Mirrors, door handles and the Pluggo charge port (glows green).
  for (const side of [-1, 1]) {
    k.rounded(.14, .08, .1, .03, m.trim, spec.windshieldBase + .1, b.cowl + .06, side * (W / 2 + .05));
    for (const x of spec.handles) k.rounded(.14, .025, .02, .01, m.rim, x, b.belt - .1, side * (W / 2 + .075));
    k.wheel(-axle, wheelR, side * (W / 2 - spec.tyreW / 2 + .07), wheelR, spec.tyreW, side);
    k.wheel(axle, wheelR, side * (W / 2 - spec.tyreW / 2 + .07), wheelR, spec.tyreW, side);
  }
  k.cylinder(.04, .015, k.m.port, axle - .05, b.belt - .13, W / 2 + .072, 'z', 24);
  // Roof rails (SUV).
  if (spec.rails) for (const side of [-1, 1]) k.rounded(c.rearTop - c.frontTop + .1, .035, .035, .015, m.trim, (c.rearTop + c.frontTop) / 2, c.roof + .06, side * W * .36);
  return k.root;
}

/** Pluggo SUV: tall, boxy, roof rails. */
export function createSuv() {
  return car({
    L: 4.35, W: 1.82, wheelR: .37, axle: 1.32, arch: .45, tyreW: .24,
    windshieldBase: -.92, pillars: [.42], handles: [-.2, .78], rails: true,
    body: { sill: .3, nose: .66, hood: .9, hoodRound: .3, cowl: 1.06, belt: 1.08, tailRound: .16 },
    cabin: { frontTop: -.22, roof: 1.64, rearTop: 1.74, rearBase: 2.0 },
  });
}

/** Pluggo hatchback: compact, rounded, steep rear. */
export function createHatch() {
  return car({
    L: 3.78, W: 1.72, wheelR: .32, axle: 1.2, arch: .4, tyreW: .2, blackRoof: true,
    windshieldBase: -.72, pillars: [.3], handles: [-.18, .58], rails: false,
    body: { sill: .25, nose: .52, hood: .7, hoodRound: .34, cowl: .9, belt: .94, tailRound: .2 },
    cabin: { frontTop: -.06, roof: 1.44, rearTop: 1.08, rearBase: 1.78 },
  });
}

/** Pluggo e-scooter: step-through frame, leg shield, LED headlamp, wide seat. */
export function createEScooter() {
  const k = kit(); const { m } = k;
  const r = .27, front = -.7, rear = .68;
  k.wheel(front, r, 0, r, .1, 1); k.wheel(rear, r, 0, r, .11, 1);
  // Floorboard and the rear body that carries the battery.
  k.rounded(.78, .07, .34, .03, m.trim, -.08, .33, 0);
  const tail = new THREE.Shape();
  tail.moveTo(.05, .34); tail.lineTo(.86, .36); tail.quadraticCurveTo(1.0, .4, .98, .56);
  tail.quadraticCurveTo(.95, .74, .74, .78); tail.lineTo(.12, .74); tail.quadraticCurveTo(.02, .7, .05, .34);
  k.extrude(tail, .36, m.paint, 0, .06);
  // Rear fender over the back wheel.
  const fender = new THREE.Shape();
  fender.absarc(rear, r, r + .06, Math.PI * .05, Math.PI * .95, false);
  fender.absarc(rear, r, r + .02, Math.PI * .95, Math.PI * .05, true);
  k.extrude(fender, .14, m.trim, 0, .02);
  // Leg shield and front apron.
  const apron = new THREE.Shape();
  apron.moveTo(-.4, .36); apron.lineTo(-.56, .38); apron.quadraticCurveTo(-.74, .7, -.74, 1.02);
  apron.quadraticCurveTo(-.72, 1.12, -.6, 1.12); apron.quadraticCurveTo(-.5, 1.0, -.48, .7); apron.quadraticCurveTo(-.45, .45, -.4, .36);
  k.extrude(apron, .42, m.paint, 0, .06);
  // Front fender, fork and steering column.
  const front_fender = new THREE.Shape();
  front_fender.absarc(front, r, r + .05, Math.PI * .1, Math.PI * .9, false);
  front_fender.absarc(front, r, r + .015, Math.PI * .9, Math.PI * .1, true);
  k.extrude(front_fender, .12, m.paint, 0, .02);
  for (const side of [-1, 1]) {
    const fork = k.cylinder(.022, .72, m.rim, front - .02, .58, side * .07, 'y', 16);
    fork.rotation.z = -.12;
  }
  const column = k.cylinder(.04, .3, m.trim, -.66, 1.1, 0, 'y', 20); column.rotation.z = -.2;
  // Handlebar with grips, mirrors and the LED headlamp.
  k.rounded(.12, .1, .5, .04, m.paint, -.64, 1.22, 0);
  k.cylinder(.018, .7, m.trim, -.62, 1.24, 0, 'z', 16);
  for (const side of [-1, 1]) {
    k.cylinder(.026, .12, m.rubber, -.62, 1.24, side * .33, 'z', 16);
    const stalk = k.cylinder(.008, .2, m.trim, -.6, 1.33, side * .24, 'y', 8); stalk.rotation.x = side * .3;
    k.rounded(.03, .06, .1, .02, m.trim, -.6, 1.43, side * .28);
  }
  k.rounded(.05, .09, .2, .03, m.led, -.75, 1.0, 0);
  // Seat, grab rail, tail lamp and the charge port.
  k.rounded(.66, .09, .3, .04, m.seat, .44, .83, 0);
  k.rounded(.2, .03, .26, .012, m.rim, .86, .8, 0);
  k.rounded(.03, .05, .16, .015, m.tail, .995, .58, 0);
  k.cylinder(.025, .012, m.port, .62, .55, .185, 'z', 20);
  return k.root;
}
