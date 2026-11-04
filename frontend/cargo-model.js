import * as THREE from 'three';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';

// Original Pluggo design: a compact enclosed electric delivery three-wheeler.
// Geometry depicts a vehicle category, not a specific manufacturer's product.
export function createCargoVehicle() {
 const root=new THREE.Group();
 const white=new THREE.MeshPhysicalMaterial({color:0xe9eceb,metalness:.2,roughness:.28,clearcoat:.55});
 const silver=new THREE.MeshStandardMaterial({color:0x8e969a,metalness:.85,roughness:.24});
 const frame=new THREE.MeshStandardMaterial({color:0x24282b,metalness:.65,roughness:.4});
 const rubber=new THREE.MeshStandardMaterial({color:0x17191b,roughness:.88});
 const glass=new THREE.MeshPhysicalMaterial({color:0x172730,metalness:.4,roughness:.13,clearcoat:1});
 const light=new THREE.MeshStandardMaterial({color:0xfff4db,emissive:0xffe7bc,emissiveIntensity:.5,roughness:.22});
 const red=new THREE.MeshStandardMaterial({color:0x9f2626,emissive:0x5b0808,emissiveIntensity:.25,roughness:.22});
 const amber=new THREE.MeshStandardMaterial({color:0xc17620,roughness:.3});
 function add(g,m,x,y,z,rx=0,ry=0,rz=0) {
  const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,rz);root.add(mesh);return mesh;
 }
 function rounded(w,h,d,r=.035) {
  r=Math.min(r,w/3,h/3,d/3);
  const shape=new THREE.Shape();const x=-w/2,y=-h/2;
  shape.moveTo(x+r,y);shape.lineTo(x+w-r,y);shape.quadraticCurveTo(x+w,y,x+w,y+r);
  shape.lineTo(x+w,y+h-r);shape.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  shape.lineTo(x+r,y+h);shape.quadraticCurveTo(x,y+h,x,y+h-r);
  shape.lineTo(x,y+r);shape.quadraticCurveTo(x,y,x+r,y);
  const g=new THREE.ExtrudeGeometry(shape,{depth:d-2*r,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:r,bevelThickness:r,curveSegments:6});
  g.translate(0,0,-d/2+r);return g;
 }
 function box(w,h,d,m,x,y,z,r=.025) {return add(rounded(w,h,d,r),m,x,y,z);}
 function cyl(r,h,m,x,y,z,axis='z') {return add(new THREE.CylinderGeometry(r,r,h,40),m,x,y,z,axis==='z'?Math.PI/2:0,0,axis==='x'?Math.PI/2:0);}
 function label(text,sub,w,h,m,x,y,z,ry=0) {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const c=canvas.getContext('2d');c.fillStyle='#eef0ef';c.fillRect(0,0,1024,256);
  c.fillStyle='#24292c';c.font='600 120px sans-serif';c.fillText(text,45,140);
  c.font='500 35px sans-serif';c.fillStyle='#687277';c.fillText(sub,50,205);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshStandardMaterial({map:texture,roughness:.36,metalness:.08});
  return add(new THREE.PlaneGeometry(w,h),material,x,y,z,0,ry,0);
 }
 // Chassis, battery enclosure and visible underbody hardware.
 box(2.65,.13,.98,frame,-.15,.52,0);
 box(1.08,.20,.88,silver,-.42,.44,0);
 for(const z of [-.49,.49])box(2.8,.09,.07,frame,-.05,.59,z);
 cyl(.065,1.46,frame,-1.01,.35,0);
 function wheel(x,z) {
  const y=.35;
  add(new THREE.TorusGeometry(.265,.085,12,64),rubber,x,y,z);
  cyl(.23,.16,frame,x,y,z);
  for(const side of [-1,1]) {
   add(new THREE.TorusGeometry(.215,.016,8,48),silver,x,y,z+side*.088);
   cyl(.071,.025,silver,x,y,z+side*.105);
   for(let i=0;i<6;i++) {
    const a=i*Math.PI/3;
    add(rounded(.043,.17,.025,.009),silver,x+Math.sin(a)*.12,y+Math.cos(a)*.12,z+side*.099,0,0,-a);
   }
   for(let i=0;i<12;i++) {
    const a=i*Math.PI/6;
    add(new THREE.BoxGeometry(.014,.035,.016),rubber,x+Math.sin(a)*.313,y+Math.cos(a)*.313,z+side*.047,0,0,-a);
   }
  }
 }
 wheel(1.30,0);wheel(-1.01,-.64);wheel(-1.01,.64);
 for(const z of [-.69,.69]) {
  add(new THREE.TorusGeometry(.365,.038,8,48,Math.PI),white,-1.01,.35,z);
  box(.12,.25,.025,rubber,-1.37,.23,z);
 }
 add(new THREE.TorusGeometry(.37,.065,10,48,Math.PI),white,1.30,.35,0);
 // Tall enclosed cargo box, rounded corners, seams and corrugated side panels.
 box(2.06,1.42,1.43,white,-.66,1.38,0,.055);
 box(2.16,.095,1.49,silver,-.66,.69,0,.024);
 for(const z of [-.724,.724]) {
  for(let i=0;i<15;i++)box(.017,1.22,.009,white,-1.60+i*.132,1.4,z,.004);
  box(1.93,.018,.012,silver,-.66,.81,z,.005);
  box(1.93,.018,.012,silver,-.66,1.98,z,.005);
 }
 // Rear twin doors: center seam, hinges, handles, reflectors and bumper.
 box(.015,1.25,.012,frame,-1.702,1.38,0,.004).rotation.y=Math.PI/2;
 for(const z of [-.63,.63]) for(const y of [1.0,1.74])box(.035,.10,.10,silver,-1.706,y,z,.012);
 for(const z of [-.07,.07])cyl(.013,.5,silver,-1.715,1.3,z,'y');
 box(.13,.09,.22,red,-1.74,.79,-.53);box(.13,.09,.22,red,-1.74,.79,.53);
 box(.13,.12,1.37,frame,-1.77,.58,0);
 label('pluggo.','ELECTRIC DELIVERY',1.25,.31,white,-.65,1.44,.733);
 label('pluggo.','ELECTRIC DELIVERY',1.25,.31,white,-.65,1.44,-.733,Math.PI);
 // Cab is an extruded, sloping body profile, with inset dark glass and trim.
 const cab=new THREE.Shape();cab.moveTo(.30,.65);cab.lineTo(1.53,.65);cab.quadraticCurveTo(1.68,.68,1.65,.95);
 cab.lineTo(1.47,1.35);cab.lineTo(1.14,1.98);cab.quadraticCurveTo(1.08,2.04,.96,2.04);
 cab.lineTo(.39,2.04);cab.quadraticCurveTo(.28,2.01,.28,1.90);cab.lineTo(.30,.65);
 const body=new THREE.ExtrudeGeometry(cab,{depth:1.05,bevelEnabled:true,bevelSegments:4,bevelSize:.035,bevelThickness:.035,curveSegments:10});body.translate(0,0,-.525);add(body,white,0,0,0);
 const sideWindow=new THREE.Shape();sideWindow.moveTo(.38,1.32);sideWindow.lineTo(1.35,1.32);sideWindow.lineTo(1.04,1.91);sideWindow.lineTo(.39,1.91);sideWindow.closePath();
 for(const z of [-.565,.565]) {
  const pane=add(new THREE.ShapeGeometry(sideWindow),glass,0,0,z);
  if(z<0)pane.material=glass.clone(),pane.material.side=THREE.DoubleSide;
  box(.70,.018,.02,frame,.78,1.30,z,.005);
  box(.09,.028,.035,frame,.44,1.20,z,.009);
  box(.045,.47,.025,white,.58,1.65,z,.009);
  // Mirror stalk and rounded housing.
  box(.035,.045,.23,frame,1.20,1.52,z+Math.sign(z)*.09);
  box(.13,.20,.07,frame,1.20,1.55,z+Math.sign(z)*.22,.03);
  box(.008,.15,.052,silver,1.126,1.55,z+Math.sign(z)*.22,.006);
  box(.62,.065,.10,frame,.78,.67,z+Math.sign(z)*.035);
 }
 const windshield=add(new THREE.PlaneGeometry(.91,.67),glass,1.38,1.655,0);
 const normal=new THREE.Vector3(.89,.45,0).normalize();
 windshield.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,-1),new THREE.Vector3(-normal.y,normal.x,0),normal));
 box(.04,.019,.66,frame,1.55,1.37,0,.007);
 box(.025,.30,.018,frame,1.49,1.52,-.13,.005).rotation.z=-.37;
 box(.18,.15,.99,white,1.56,1.08,0,.045);
 for(const z of [-.34,.34]) {
  box(.07,.12,.22,frame,1.664,1.04,z,.025);
  box(.075,.085,.16,light,1.673,1.045,z,.025);
  box(.075,.045,.08,amber,1.665,.90,z,.012);
 }
 for(let i=0;i<4;i++)box(.025,.018,.34,frame,1.673,.92+i*.04,0,.005);
 box(.11,.10,1.0,frame,1.65,.69,0,.025);
 box(.08,.10,.23,silver,1.72,.73,0,.012);
 box(.73,.055,1.12,white,.73,2.085,0,.023);
 label('P G','CARGO',.26,.08,white,1.70,.82,0,Math.PI/2);
 // Merge static meshes by material: retain details with a small draw-call count.
 root.updateMatrixWorld(true);const batches=new Map();
 for(const mesh of [...root.children]) {
  const geometry=(mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone());
  geometry.applyMatrix4(mesh.matrixWorld);
  for(const key of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(key))geometry.deleteAttribute(key);
  const list=batches.get(mesh.material)||[];list.push(geometry);batches.set(mesh.material,list);
  mesh.geometry.dispose();root.remove(mesh);
 }
 for(const [material,geometries]of batches) {
  const merged=mergeGeometries(geometries,false);for(const g of geometries)g.dispose();
  root.add(new THREE.Mesh(merged,material));
 }
 root.name='Pluggo Cargo — enclosed electric three-wheeler';
 return root;
}
