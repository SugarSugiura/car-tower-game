// 火花・煙・炎（粒をまとめて1回で描く。スマホでも軽い）
import * as THREE from '../vendor/three.module.min.js';
import { softDotCanvas } from './art.js';

const VERT = `
attribute float size;
attribute vec4 rgba;
varying vec4 vColor;
uniform float scale;
void main() {
  vColor = rgba;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
uniform sampler2D map;
varying vec4 vColor;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
  if (gl_FragColor.a < 0.01) discard;
}`;

let dotTex = null;

class Pool {
  constructor(scene, max, blending) {
    if (!dotTex) dotTex = new THREE.CanvasTexture(softDotCanvas());
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.rgba = new Float32Array(max * 4);
    this.p = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('rgba', new THREE.BufferAttribute(this.rgba, 4));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: dotTex }, scale: { value: 600 } },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.geom = g;
    scene.add(this.points);
  }
  add(p) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push(p);
  }
  update(dt, fn) {
    let n = 0;
    const keep = [];
    for (const p of this.p) {
      p.age += dt;
      if (p.age >= p.life) continue;
      fn(p, dt);
      keep.push(p);
      const k = p.age / p.life;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.size[n] = p.s0 + (p.s1 - p.s0) * k;
      const c = p.color(k);
      this.rgba[n * 4] = c[0]; this.rgba[n * 4 + 1] = c[1]; this.rgba[n * 4 + 2] = c[2]; this.rgba[n * 4 + 3] = c[3];
      n++;
    }
    this.p = keep;
    this.geom.setDrawRange(0, n);
    this.geom.attributes.position.needsUpdate = true;
    this.geom.attributes.size.needsUpdate = true;
    this.geom.attributes.rgba.needsUpdate = true;
  }
  clear() { this.p = []; this.geom.setDrawRange(0, 0); }
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.sparks = new Pool(scene, 400, THREE.AdditiveBlending);
    this.fire = new Pool(scene, 260, THREE.AdditiveBlending);
    this.smoke = new Pool(scene, 260, THREE.NormalBlending);
    this.fireLight = new THREE.PointLight(0xff7a20, 0, 9, 1.6);
    scene.add(this.fireLight);
    this.rand = mulberry(12345);
    this.shake = 0;
  }
  setScale(h) {
    for (const pl of [this.sparks, this.fire, this.smoke]) pl.mat.uniforms.scale.value = h * 0.9;
  }
  reset() {
    this.sparks.clear(); this.fire.clear(); this.smoke.clear();
    this.fireLight.intensity = 0;
    this.shake = 0;
  }
  spark(pos, n = 10, power = 1) {
    const r = this.rand;
    for (let i = 0; i < n; i++) {
      this.sparks.add({
        x: pos.x, y: pos.y, z: pos.z,
        vx: (r() - 0.5) * 6 * power, vy: r() * 4 * power + 1, vz: (r() - 0.5) * 6 * power,
        age: 0, life: 0.25 + r() * 0.45, s0: 0.12, s1: 0.03,
        color: (k) => [1, 0.85 - k * 0.5, 0.35 - k * 0.3, 1 - k],
      });
    }
  }
  puff(pos, dark = 0.5, n = 1, size = 1.2, life = 2.2) {
    const r = this.rand;
    for (let i = 0; i < n; i++) {
      const g = 0.75 - dark * 0.6 + r() * 0.08;
      this.smoke.add({
        x: pos.x + (r() - 0.5) * 0.3, y: pos.y, z: pos.z + (r() - 0.5) * 0.3,
        vx: (r() - 0.5) * 0.5, vy: 0.9 + r() * 0.8, vz: (r() - 0.5) * 0.5,
        age: 0, life: life * (0.7 + r() * 0.6), s0: size * 0.5, s1: size * 2.4,
        color: (k) => [g, g, g * 1.02, 0.55 * (1 - k) * Math.min(1, k * 6)],
      });
    }
  }
  flame(pos, n = 3) {
    const r = this.rand;
    for (let i = 0; i < n; i++) {
      this.fire.add({
        x: pos.x + (r() - 0.5) * 0.9, y: pos.y + r() * 0.2, z: pos.z + (r() - 0.5) * 1.2,
        vx: (r() - 0.5) * 0.6, vy: 1.8 + r() * 1.6, vz: (r() - 0.5) * 0.6,
        age: 0, life: 0.45 + r() * 0.45, s0: 0.9 + r() * 0.5, s1: 0.25,
        color: (k) => [1, 0.75 - k * 0.55, 0.25 - k * 0.25, (1 - k) * 0.9],
      });
    }
  }
  update(dt) {
    this.sparks.update(dt, (p, d) => { p.vy -= 9.8 * d; p.x += p.vx * d; p.y += p.vy * d; p.z += p.vz * d; if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.3; } });
    this.fire.update(dt, (p, d) => { p.x += p.vx * d; p.y += p.vy * d; p.z += p.vz * d; });
    this.smoke.update(dt, (p, d) => { p.vx += 0.25 * d; p.x += p.vx * d; p.y += p.vy * d; p.z += p.vz * d; });
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }
}

// 同じ順番で同じ乱数（録画を毎回同じにするため）
export function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
