// 車の見た目（少ないポリゴンで作る）。物理の体（chassis・タイヤ・バンパー）に合わせて動かす
import * as THREE from '../vendor/three.module.min.js';
import { nameDecalCanvas, emblemCanvas } from './art.js';

const glassMat = new THREE.MeshStandardMaterial({ color: 0x1b2633, roughness: 0.15, metalness: 0.6 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.9 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.35, metalness: 0.8 });
const blackMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff2c0, emissiveIntensity: 0.9 });
const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff1010, emissiveIntensity: 0.8 });

// 箱をつくり、頂点を動かして形を整える
function shapedBox(w, h, l, segs, fn) {
  const g = new THREE.BoxGeometry(w, h, l, segs[0], segs[1], segs[2]);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = { x: p.getX(i), y: p.getY(i), z: p.getZ(i) };
    fn(v, w / 2, h / 2, l / 2);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export class Car3D {
  constructor(scene, car) {
    this.scene = scene;
    this.car = car;
    const def = car.def;
    this.def = def;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.paint = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.35, metalness: 0.35 });
    this.accent = new THREE.MeshStandardMaterial({ color: def.accent, roughness: 0.4, metalness: 0.2 });
    this.dentables = [];
    this.charred = 0;
    this.buildBody();
    this.wheelMeshes = car.wheels.map((w) => this.buildWheel(w));
    this.bumperMeshes = car.bumpers.map((b) => this.buildBumper(b));
    this.appliedDents = 0;
  }

  buildBody() {
    const d = this.def, s = d.style;
    const W = d.width, BH = d.bodyH, L = d.length;
    const cf = BH * 0.55;
    const cz = Math.max(0.3, L / 2 - d.wheelbase / 2 - 0.05);
    const noseDrop = { super: 0.55, sports: 0.4, muscle: 0.15, kei: 0.2, van: 0.1, suv: 0.12, pickup: 0.08, offroad: 0.15 }[s] ?? 0.2;
    const lower = shapedBox(W, BH, L, [4, 2, 10], (v, hx, hy, hz) => {
      // 下の前後を斜めに削る（物理の形と同じ）
      if (v.y < 0) {
        const over = Math.abs(v.z) - (hz - cz);
        if (over > 0) v.y = Math.max(v.y, -hy + (cf * over) / cz);
      }
      // 鼻先を低く
      if (v.y > 0 && v.z > hz * 0.4) v.y -= ((v.z - hz * 0.4) / (hz * 0.6)) * BH * noseDrop * 0.7;
      // 角を少し丸く
      if (Math.abs(v.x) > hx * 0.99 && v.y > 0) v.x *= 0.95;
    });
    const body = new THREE.Mesh(lower, this.paint);
    body.castShadow = true;
    this.root.add(body);
    this.dentables.push(body);

    // キャビン（窓の部分）と屋根
    const cw = W * 0.84, ch = d.cabinH, cl = d.cabinLen;
    const rake = { super: 0.6, sports: 0.45, muscle: 0.45, kei: 0.25, van: 0.2, suv: 0.25, pickup: 0.25, offroad: 0.15 }[s] ?? 0.4;
    const cab = shapedBox(cw, ch, cl, [2, 1, 4], (v, hx, hy, hz) => {
      if (v.y > 0) {
        v.x *= 0.88;
        if (v.z > 0) v.z -= cl * rake * 0.5;
        else v.z += cl * rake * 0.3;
      }
    });
    const cabin = new THREE.Mesh(cab, glassMat);
    cabin.position.set(0, BH / 2 + ch / 2 - 0.01, d.cabinOffset);
    cabin.castShadow = true;
    this.root.add(cabin);
    this.dentables.push(cabin);
    // 屋根（車体の色）
    const roofL = cl * (1 - rake * 0.8);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(cw * 0.86, 0.06, Math.max(0.3, roofL)), this.paint);
    roof.position.set(0, BH / 2 + ch + 0.0, d.cabinOffset + (cl * rake * -0.1));
    roof.castShadow = true;
    this.root.add(roof);
    this.roof = roof;
    // 柱（窓の枠）
    for (const sx of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.05, ch * 0.9, Math.max(0.2, roofL * 0.8)), this.paint);
      pillar.position.set(sx * cw * 0.45, BH / 2 + ch * 0.5, d.cabinOffset);
      this.root.add(pillar);
    }

    // スタイルごとの部品
    const top = BH / 2;
    const addBox = (w, h, l, x, y, z, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat);
      m.position.set(x, y, z); m.castShadow = true; this.root.add(m); return m;
    };
    if (s === 'sports') { // 大きな羽（リアウイング）・青いライン
      addBox(W * 0.9, 0.05, 0.32, 0, top + 0.32, -L / 2 + 0.25, this.accent);
      for (const sx of [-1, 1]) addBox(0.05, 0.3, 0.12, sx * W * 0.32, top + 0.16, -L / 2 + 0.25, blackMat);
      for (const sx of [-1, 1]) addBox(0.02, 0.1, L * 0.92, sx * (W / 2 + 0.005), 0.0, 0, this.accent);
    }
    if (s === 'super') { // 低い羽・空気取り入れ口
      addBox(W * 0.95, 0.04, 0.3, 0, top + 0.12, -L / 2 + 0.2, blackMat);
      for (const sx of [-1, 1]) addBox(0.04, 0.18, 0.7, sx * (W / 2 + 0.01), 0.02, -0.4, blackMat);
    }
    if (s === 'muscle') { // ボンネットの出っぱり・2本のライン
      addBox(0.6, 0.12, 1.0, 0, top + 0.02, L / 2 - 0.9, this.paint);
      for (const sx of [-1, 1]) addBox(0.18, 0.012, L * 0.98, sx * 0.17, top + 0.005 - 0.02, 0, this.accent);
      for (const sx of [-1, 1]) {
        const st = addBox(0.18, 0.012, d.cabinLen * 0.6, sx * 0.17, top + d.cabinH + 0.04, d.cabinOffset, this.accent);
        st.castShadow = false;
      }
    }
    if (s === 'pickup') { // 荷台
      const bedL = L / 2 - (d.cabinOffset + d.cabinLen / 2) - 0.1;
      const bz = -L / 2 + bedL / 2 + 0.05;
      for (const sx of [-1, 1]) addBox(0.06, 0.35, bedL, sx * (W / 2 - 0.03), top + 0.17, bz, this.paint);
      addBox(W, 0.35, 0.06, 0, top + 0.17, -L / 2 + 0.03, this.paint);
      addBox(W * 0.95, 0.02, bedL, 0, top + 0.01, bz, blackMat);
    }
    if (s === 'suv') { // ルーフレール
      for (const sx of [-1, 1]) addBox(0.04, 0.05, d.cabinLen * 0.7, sx * W * 0.36, top + d.cabinH + 0.06, d.cabinOffset, blackMat);
      addBox(0.5, 0.5, 0.18, 0, 0.05, -L / 2 - 0.08, blackMat); // 背負ったスペアタイヤ風
    }
    if (s === 'offroad') { // ロールバー・ライトバー・オレンジのライン
      for (const sx of [-1, 1]) addBox(0.06, 0.5, 0.06, sx * W * 0.38, top + d.cabinH + 0.1, d.cabinOffset - d.cabinLen * 0.35, this.accent);
      addBox(W * 0.8, 0.06, 0.06, 0, top + d.cabinH + 0.35, d.cabinOffset - d.cabinLen * 0.35, this.accent);
      addBox(W * 0.7, 0.08, 0.1, 0, top + d.cabinH + 0.08, d.cabinOffset + d.cabinLen * 0.3, headMat);
      for (const sx of [-1, 1]) addBox(0.02, 0.12, L * 0.9, sx * (W / 2 + 0.005), -0.05, 0, this.accent);
    }
    if (s === 'van') { // 横の帯
      for (const sx of [-1, 1]) addBox(0.02, 0.12, L * 0.92, sx * (W / 2 + 0.005), top + 0.05, 0, this.accent);
    }
    if (s === 'kei') { // 黒い屋根
      this.roof.material = this.accent;
    }

    // ライト
    const hy = top - BH * noseDrop * 0.7 - 0.08;
    for (const sx of [-1, 1]) {
      addBox(W * 0.22, 0.08, 0.04, sx * W * 0.3, hy, L / 2 + 0.01, headMat).castShadow = false;
      addBox(W * 0.22, 0.08, 0.04, sx * W * 0.3, top - 0.12, -L / 2 - 0.01, tailMat).castShadow = false;
    }

    // ロゴ（前）と名前のデカール（横）
    const emTex = new THREE.CanvasTexture(emblemCanvas(this.def));
    emTex.colorSpace = THREE.SRGBColorSpace;
    const em = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ map: emTex, transparent: true }));
    em.position.set(0, hy + 0.0, L / 2 + 0.035);
    this.root.add(em);
    const em2 = em.clone(); em2.position.set(0, top - 0.05, -L / 2 - 0.035); em2.rotation.y = Math.PI; this.root.add(em2);
    const decTex = new THREE.CanvasTexture(nameDecalCanvas(this.def));
    decTex.colorSpace = THREE.SRGBColorSpace;
    const decMat = new THREE.MeshBasicMaterial({ map: decTex, transparent: true, depthWrite: false });
    const dl = Math.min(L * 0.55, 2.2);
    for (const sx of [-1, 1]) {
      const dec = new THREE.Mesh(new THREE.PlaneGeometry(dl, dl / 4), decMat);
      dec.position.set(sx * (W / 2 + 0.02), -BH * 0.05, -0.1);
      dec.rotation.y = sx * Math.PI / 2;
      this.root.add(dec);
      this.dentables.push(null);
    }
    this.dentables = this.dentables.filter(Boolean);
  }

  buildWheel(w) {
    const r = this.def.wheelR;
    const width = Math.min(0.34, 0.16 + r * 0.38);
    const g = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, width, 16, 1), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    g.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.58, r * 0.58, width + 0.01, 10, 1), rimMat);
    rim.rotation.z = Math.PI / 2;
    g.add(rim);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, r * 1.0, r * 0.12), blackMat);
    g.add(spoke);
    const spoke2 = spoke.clone(); spoke2.rotation.x = Math.PI / 2; g.add(spoke2);
    this.scene.add(g);
    return g;
  }

  buildBumper(b) {
    const W = this.def.width;
    const m = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 0.22, 0.18), blackMat);
    m.castShadow = true;
    this.scene.add(m);
    return m;
  }

  // へこみを頂点に反映する
  applyDents() {
    const dents = this.car.dents;
    if (dents.length === this.appliedDents) return;
    const tmp = new THREE.Vector3();
    for (let k = this.appliedDents; k < dents.length; k++) {
      const dn = dents[k];
      for (const mesh of this.dentables) {
        const g = mesh.geometry;
        const p = g.attributes.position;
        const off = mesh.position;
        for (let i = 0; i < p.count; i++) {
          tmp.set(p.getX(i) + off.x, p.getY(i) + off.y, p.getZ(i) + off.z);
          const dx = tmp.x - dn.local.x, dy = tmp.y - dn.local.y, dz = tmp.z - dn.local.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > dn.radius) continue;
          const f = (1 - dist / dn.radius) ** 2 * dn.depth;
          // 中心に向かって押しこむ（少しゆがみも足す）
          const cl = Math.hypot(tmp.x, tmp.y * 2, tmp.z) || 1;
          p.setXYZ(i,
            p.getX(i) - (tmp.x / cl) * f * 1.2,
            p.getY(i) - (tmp.y * 2 / cl) * f * 0.8 + (Math.sin(i * 12.9898) * 0.5) * f * 0.3,
            p.getZ(i) - (tmp.z / cl) * f);
        }
        p.needsUpdate = true;
        g.computeVertexNormals();
      }
    }
    this.appliedDents = dents.length;
  }

  sync() {
    const c = this.car.chassis;
    const t = c.translation(), q = c.rotation();
    this.root.position.set(t.x, t.y, t.z);
    this.root.quaternion.set(q.x, q.y, q.z, q.w);
    this.car.wheels.forEach((w, i) => {
      const wt = w.body.translation(), wq = w.body.rotation();
      this.wheelMeshes[i].position.set(wt.x, wt.y, wt.z);
      this.wheelMeshes[i].quaternion.set(wq.x, wq.y, wq.z, wq.w);
    });
    this.car.bumpers.forEach((b, i) => {
      const bt = b.body.translation(), bq = b.body.rotation();
      this.bumperMeshes[i].position.set(bt.x, bt.y, bt.z);
      this.bumperMeshes[i].quaternion.set(bq.x, bq.y, bq.z, bq.w);
    });
    this.applyDents();
    // 燃えると黒くこげる
    if (this.car.onFire && this.charred < 1) {
      this.charred = Math.min(1, this.charred + 0.004);
      this.paint.color.set(this.def.color).lerp(new THREE.Color(0x1a1612), this.charred * 0.85);
    }
  }

  dispose() {
    const all = [this.root, ...this.wheelMeshes, ...this.bumperMeshes];
    for (const o of all) {
      this.scene.remove(o);
      o.traverse((m) => { if (m.geometry) m.geometry.dispose(); });
    }
    this.paint.dispose(); this.accent.dispose();
  }
}
