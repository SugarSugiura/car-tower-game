// 景色：港の地面・コンテナの階段の塔・空・光・カメラ
import * as THREE from '../vendor/three.module.min.js';
import { containerCanvas, asphaltCanvas, checkerCanvas } from './art.js';
import { mulberry } from './effects.js';

const CONTAINER_COLORS = ['#b8322a', '#1f5fa8', '#2f7d4a', '#d27b1f', '#6d6f73', '#7a2f6b', '#c9a227', '#2a7f8f', '#9b3d1f', '#3b4a8a'];

export class World3D {
  constructor(canvas, tower, blocks, quality) {
    this.tower = tower;
    this.blocks = blocks;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance', preserveDrawingBuffer: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = quality !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9cc7ea);
    scene.fog = new THREE.Fog(0xb9d6ee, 45, 140);
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300);

    const hemi = new THREE.HemisphereLight(0xdcecff, 0x5b5148, 1.1);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.3);
    sun.position.set(-14, 26, -10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera;
    sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 70;
    sun.shadow.bias = -0.0006;
    scene.add(sun); scene.add(sun.target);
    this.sun = sun;

    this.buildGround();
    this.buildTower();
    this.buildScenery();
  }

  buildGround() {
    const tex = new THREE.CanvasTexture(asphaltCanvas());
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 60);
    tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(160, 240), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    g.rotation.x = -Math.PI / 2;
    g.receiveShadow = true;
    this.scene.add(g);
    // 走る線（白い点線）
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8e2c8 });
    for (let z = -this.tower.runUp - 6; z < -1; z += 3) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 1.4), lineMat);
      m.rotation.x = -Math.PI / 2; m.position.set(0, 0.01, z);
      this.scene.add(m);
    }
    // スタートの線
    const st = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    st.rotation.x = -Math.PI / 2; st.position.set(0, 0.012, -this.tower.runUp + 1.6);
    this.scene.add(st);
  }

  buildTower() {
    const W = this.tower.width;
    const hazard = this.hazardTexture();
    this.blocks.forEach((b, i) => {
      const color = CONTAINER_COLORS[i % CONTAINER_COLORS.length];
      const base = new THREE.CanvasTexture(containerCanvas(color));
      base.colorSpace = THREE.SRGBColorSpace;
      base.wrapS = base.wrapT = THREE.RepeatWrapping;
      const D = b.z1 - b.z0;
      const mk = (rx, ry) => { const t = base.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0.25 }); };
      const side = mk(D / 2.4, Math.max(1, b.top / 2.4));
      const front = mk(W / 2.4, Math.max(1, b.top / 2.4));
      const topM = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.8), roughness: 0.85, metalness: 0.2 });
      const mats = [side, side, topM, topM, front, front];
      const m = new THREE.Mesh(new THREE.BoxGeometry(W, b.top, D), mats);
      m.position.set(0, b.top / 2, b.z0 + D / 2);
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
      // 段の縁（黄色と黒のしま）
      const edge = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, 0.07, 0.12), new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.6 }));
      edge.position.set(0, b.top - 0.03, b.z0 + 0.06);
      this.scene.add(edge);
      // 段の番号
      const num = this.numberSprite(String(i + 1));
      num.position.set(-W / 2 - 0.02, b.top - Math.min(0.45, b.rise * 0.5), b.z0 + 0.6);
      num.rotation.y = -Math.PI / 2;
      this.scene.add(num);
      const num2 = num.clone(); num2.position.x = W / 2 + 0.02; num2.rotation.y = Math.PI / 2; this.scene.add(num2);
    });
    // 頂上の旗
    const last = this.blocks[this.blocks.length - 1];
    const tex = new THREE.CanvasTexture(checkerCanvas());
    tex.colorSpace = THREE.SRGBColorSpace;
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.6, roughness: 0.3 });
    for (const sx of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), poleMat);
      pole.position.set(sx * (W / 2 - 0.1), last.top + 1.6, last.z0 + 3.2);
      this.scene.add(pole);
    }
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, 0.7), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    banner.position.set(0, last.top + 2.85, last.z0 + 3.2);
    this.scene.add(banner);
    this.goalZ = last.z0 + 3.2;
  }

  hazardTexture() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 16;
    const g = c.getContext('2d');
    g.fillStyle = '#f2c200'; g.fillRect(0, 0, 128, 16);
    g.fillStyle = '#151515';
    for (let x = -16; x < 128; x += 16) { g.beginPath(); g.moveTo(x, 16); g.lineTo(x + 8, 0); g.lineTo(x + 16, 0); g.lineTo(x + 8, 16); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(4, 1); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  numberSprite(txt) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.92)'; g.font = 'bold 96px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
  }

  // まわりのコンテナの山（雰囲気）。数は少なく
  buildScenery() {
    const rnd = mulberry(77);
    const geo = new THREE.BoxGeometry(2.44, 2.59, 6.06);
    const mats = CONTAINER_COLORS.map((c) => {
      const t = new THREE.CanvasTexture(containerCanvas(c)); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2.5, 1);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, metalness: 0.2 });
    });
    const place = (x, z, rows, rot) => {
      for (let k = 0; k < rows; k++) {
        const m = new THREE.Mesh(geo, mats[Math.floor(rnd() * mats.length)]);
        m.position.set(x + (rnd() - 0.5) * 0.3, 1.3 + k * 2.59, z);
        m.rotation.y = rot;
        this.scene.add(m);
      }
    };
    for (let i = 0; i < 7; i++) place(-16 - rnd() * 3, -20 + i * 7.5, 1 + Math.floor(rnd() * 3), 0);
    for (let i = 0; i < 7; i++) place(17 + rnd() * 3, -18 + i * 7.5, 1 + Math.floor(rnd() * 3), 0);
    for (let i = 0; i < 6; i++) place(-10 + i * 3.2, 48 + rnd() * 2, 1 + Math.floor(rnd() * 4), Math.PI / 2);
    // クレーン（港らしさ）
    const craneMat = new THREE.MeshStandardMaterial({ color: 0xd84a1b, roughness: 0.6 });
    const crane = new THREE.Group();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 22, 0.5), craneMat);
      leg.position.set(sx * 4, 11, sz * 3); crane.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 30), craneMat); beam.position.set(0, 22, 6); crane.add(beam);
    crane.position.set(-26, 0, 20);
    this.scene.add(crane);
  }

  setSize(w, h, pixelRatio) {
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // 縦長のときは広く見せる
    this.camera.fov = w / h < 0.8 ? 62 : 48;
    this.camera.updateProjectionMatrix();
  }

  followSun(target) {
    this.sun.position.set(target.x - 14, target.y + 26, target.z - 10);
    this.sun.target.position.set(target.x, target.y, target.z);
  }

  render() { this.renderer.render(this.scene, this.camera); }
}

// カメラ：「見る」は斜め横から、「挑戦」は後ろから
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(8, 4, -24);
    this.look = new THREE.Vector3(0, 1, 0);
    this.mode = 'watch';
  }
  snap(state) { this.update(state, 1, true); }
  update(state, dt, snap = false, shake = 0, portrait = false, time = 0) {
    if (!state) return;
    const p = state.pos;
    let want, look;
    if (this.mode === 'watch') {
      // 車を下寄せに、その先の塔が上に見えるように、斜め後ろの低い位置から
      want = portrait
        ? new THREE.Vector3(p.x + 5.4, p.y + 2.7, p.z - 8.6)
        : new THREE.Vector3(p.x + 7.0, p.y + 2.4, p.z - 5.6);
      look = new THREE.Vector3(p.x * 0.4, p.y + (portrait ? 1.6 : 0.9), p.z + (portrait ? 4.5 : 3.2));
    } else {
      const fx = state.fwd.x, fz = state.fwd.z;
      const n = Math.hypot(fx, fz) || 1;
      const back = portrait ? 10 : 7.5;
      want = new THREE.Vector3(p.x - (fx / n) * back, p.y + (portrait ? 3.8 : 3.2), p.z - (fz / n) * back);
      look = new THREE.Vector3(p.x + (fx / n) * 3, p.y + 0.8, p.z + (fz / n) * 3);
    }
    const k = snap ? 1 : 1 - Math.exp(-dt * 3.2);
    this.pos.lerp(want, k);
    this.look.lerp(look, snap ? 1 : 1 - Math.exp(-dt * 5));
    this.camera.position.copy(this.pos);
    if (shake > 0) {
      this.camera.position.x += (Math.sin(time * 70) * 0.12) * shake;
      this.camera.position.y += (Math.cos(time * 90) * 0.12) * shake;
    }
    this.camera.lookAt(this.look);
  }
}
