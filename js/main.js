// ゲームの進行：「見る」モード・「挑戦」モード・縦動画の書き出し
import RAPIER from '../vendor/rapier.mjs';
import { Sim, Judge, AutoDriver, DT, qrot } from './sim.js';
import { World3D, CameraRig } from './scene.js';
import { Car3D } from './car3d.js';
import { Effects } from './effects.js';
import { drawHud } from './hud.js';
import { FONT_BIG, FONT_TEXT } from './art.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
const isTouch = matchMedia('(pointer: coarse)').matches;
const quality = params.get('q') || (isTouch ? 'mid' : 'high');
const REC_W = 1080, REC_H = 1920;
const RESULT_HOLD = 2.6, TITLE_TIME = 2.6, SUMMARY_TIME = 6;

const app = {
  mode: 'watch', time: 0, acc: 0,
  watch: { index: 0, phase: 'title', phaseT: 0, results: [], done: false },
  challenge: { index: 0, phase: 'ready', phaseT: 0, results: [] },
  keys: {}, touch: {},
  recording: null, recLayout: false,
};

async function loadJSON(url) { const r = await fetch(url, { cache: 'no-cache' }); return r.json(); }

async function boot() {
  const [tower, carsCfg] = await Promise.all([loadJSON('config/tower.json'), loadJSON('config/cars.json')]);
  app.tower = tower;
  app.cars = carsCfg.cars;
  await RAPIER.init();
  // 文字（ゲーム用のフォント）を先に読む
  const sample = app.cars.map((c) => c.name + c.kana).join('') + 'コンテナの塔を登れるか？登頂成功！炎上転落ひっくり返った登れない時間切れ段頂上架空の車メーカーロゴすべて台できたのは馬力車高kg0123456789/・（）※…';
  try {
    await Promise.race([
      Promise.all([document.fonts.load(`40px ${FONT_BIG}`, sample), document.fonts.load(`40px ${FONT_TEXT}`, sample)]),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
  } catch (e) { console.warn('フォント', e); }

  app.sim = new Sim(RAPIER, tower);
  app.judge = new Judge(app.sim);
  app.driver = new AutoDriver();
  app.world = new World3D($('gl'), tower, app.sim.blocks, quality);
  app.rig = new CameraRig(app.world.camera);
  app.effects = new Effects(app.world.scene);
  app.hudCtx = $('hud').getContext('2d');
  app.rec = $('rec');
  app.recCtx = app.rec.getContext('2d');
  app.rec.width = REC_W; app.rec.height = REC_H;

  setupUI();
  onResize();
  addEventListener('resize', onResize);
  startWatch();
  $('loading').hidden = true;
  if (!CAPTURE) requestAnimationFrame(loop);
  window.__ready = true;
}

// ───────── 車を出す・片付ける
function spawn(index) {
  if (app.car3d) { app.car3d.dispose(); app.car3d = null; }
  app.effects.reset();
  const def = app.cars[index];
  const car = app.sim.spawnCar(def);
  app.car3d = new Car3D(app.world.scene, car);
  app.judge.reset();
  app.driver.reset();
  app.car3d.sync();
  app.rig.snap(app.sim.carState());
}

function startWatch() {
  app.mode = 'watch';
  app.rig.mode = 'watch';
  app.watch = { index: 0, phase: 'title', phaseT: 0, results: [], done: false };
  spawn(0);
  updateUI();
}

function startChallenge(index = app.challenge.index) {
  app.mode = 'challenge';
  app.rig.mode = 'chase';
  app.challenge.index = index;
  app.challenge.phase = 'run';
  app.challenge.phaseT = 0;
  spawn(index);
  updateUI();
}

// ───────── 1コマ（1/60秒）進める
function playerInput() {
  const k = app.keys, t = app.touch;
  const gas = k.ArrowUp || k.KeyW || t.gas;
  const back = k.ArrowDown || k.KeyS || t.back;
  const left = k.ArrowLeft || k.KeyA || t.left;
  const right = k.ArrowRight || k.KeyD || t.right;
  return { throttle: gas ? 1 : back ? -1 : 0, steer: (right ? 1 : 0) - (left ? 1 : 0), brake: k.Space ? 1 : 0 };
}

function stepOnce() {
  app.time += DT;
  const sim = app.sim, car = sim.car;
  const st = sim.carState();
  let input = { throttle: 0, steer: 0, brake: 0 };
  let running = false;
  if (app.mode === 'watch') {
    const w = app.watch;
    w.phaseT += DT;
    if (w.phase === 'title') {
      input.brake = 1;
      if (w.phaseT > TITLE_TIME) { w.phase = 'run'; w.phaseT = 0; }
    } else if (w.phase === 'run') {
      running = true;
      input = app.driver.drive(st, car.def);
    } else if (w.phase === 'result') {
      if (app.judge.result?.ok) input.brake = 1;
      if (w.phaseT > RESULT_HOLD) {
        if (w.index < app.cars.length - 1) { w.index++; w.phase = 'run'; w.phaseT = 0; spawn(w.index); return; }
        w.phase = 'summary'; w.phaseT = 0;
      }
    } else if (w.phase === 'summary') {
      if (w.phaseT > SUMMARY_TIME && !w.done) { w.done = true; onWatchDone(); }
    }
  } else {
    const c = app.challenge;
    c.phaseT += DT;
    if (c.phase === 'run') { running = true; input = playerInput(); }
    else if (app.judge.result?.ok) input.brake = 1;
  }

  const events = sim.step(input);
  handleEvents(events, car);
  continuousEffects(car);
  if (running && car) {
    const res = app.judge.update(sim.carState(), car);
    if (res) onResult(res);
  } else if (car && app.judge.result) app.judge.resultT += DT;
}

function onResult(res) {
  if (app.mode === 'watch') {
    const w = app.watch;
    w.results[w.index] = res;
    w.phase = 'result'; w.phaseT = 0;
  } else {
    const c = app.challenge;
    c.results[c.index] = res;
    c.phase = 'result'; c.phaseT = 0;
    updateUI();
  }
  if (!res.ok) app.effects.shake = Math.max(app.effects.shake, 0.4);
}

function worldPoint(car, local) {
  const t = car.chassis.translation(), q = car.chassis.rotation();
  const v = qrot(q, local);
  return { x: t.x + v.x, y: t.y + v.y, z: t.z + v.z };
}

function handleEvents(events, car) {
  const fx = app.effects;
  for (const e of events) {
    if (e.type === 'impact') {
      if (e.kind !== 'wheel' || e.severity > 3) fx.spark(e.pos, Math.min(40, Math.round(e.severity * 6)), Math.min(2, 0.5 + e.severity * 0.2));
      if (e.severity > 2.5) fx.shake = Math.min(1, fx.shake + e.severity * 0.08);
      if (e.severity > 3) fx.puff(e.pos, 0.2, 2, 0.6, 1.0);
    } else if (e.type === 'scrape') {
      fx.spark(e.pos, 3, 0.6);
    } else if (e.type === 'detach') {
      fx.spark(e.pos, 30, 1.6);
      fx.puff(e.pos, 0.3, 4, 0.8, 1.4);
      fx.shake = Math.min(1, fx.shake + 0.4);
    }
  }
}

function continuousEffects(car) {
  if (!car) return;
  const fx = app.effects, def = car.def, f = app.sim.frame;
  const engine = worldPoint(car, { x: 0, y: def.bodyH / 2 + 0.05, z: def.length / 2 - 0.9 });
  if (car.onFire) {
    fx.flame(engine, 3);
    if (f % 2 === 0) fx.puff({ x: engine.x, y: engine.y + 0.8, z: engine.z }, 0.95, 1, 1.4, 3.2);
    fx.fireLight.position.set(engine.x, engine.y + 0.8, engine.z);
    fx.fireLight.intensity = 22 + Math.sin(app.time * 31) * 6 + Math.sin(app.time * 17) * 4;
  } else if (car.smoking && f % 3 === 0) {
    fx.puff(engine, 0.55, 1, 0.9, 2.4);
  }
  // 空回りの白い煙
  if (car.slip > 6 && f % 4 === 0) {
    for (const w of car.wheels) {
      if (!w.driven || !w.attached) continue;
      const p = w.body.translation();
      fx.puff({ x: p.x, y: p.y - def.wheelR * 0.6, z: p.z }, 0.05, 1, 0.7, 1.6);
    }
  }
}

function onWatchDone() {
  if (app.recording) stopRecording();
  else if (!CAPTURE) setTimeout(() => { if (app.mode === 'watch' && !app.recording) startWatch(); }, 600);
}

// ───────── 描画
function hudState() {
  if (app.mode === 'watch') {
    const w = app.watch;
    return {
      cars: app.cars, results: w.results, current: w.index,
      block: app.judge.best, total: app.sim.blocks.length,
      stamp: w.phase === 'result' ? { ...w.results[w.index], t: w.phaseT } : null,
      title: w.phase === 'title' ? w.phaseT : null,
      summary: w.phase === 'summary' ? w.phaseT : null,
    };
  }
  const c = app.challenge;
  return {
    cars: app.cars, results: c.results, current: c.index,
    block: app.judge.best, total: app.sim.blocks.length,
    stamp: c.phase === 'result' ? { ...c.results[c.index], t: c.phaseT } : null,
    title: null, summary: null,
  };
}

function renderFrame(dt) {
  const st = app.sim.carState();
  if (app.car3d) app.car3d.sync();
  app.effects.update(dt);
  const portrait = app.recLayout || innerWidth / innerHeight < 0.9;
  app.rig.update(st, dt, false, app.effects.shake, portrait, app.time);
  if (st) app.world.followSun(st.pos);
  app.world.render();
  const hud = hudState();
  if (app.recLayout) {
    const g = app.recCtx;
    g.drawImage($('gl'), 0, 0, REC_W, REC_H);
    drawHudOver(g, REC_W, REC_H, hud);
  } else {
    const c = $('hud');
    drawHud(app.hudCtx, c.width, c.height, hud, { safeBottom: app.safeBottom * app.dpr });
  }
}

// 録画の canvas は背景（3D）の上に HUD を重ねる
const hudLayer = document.createElement('canvas');
function drawHudOver(g, w, h, hud) {
  if (hudLayer.width !== w) { hudLayer.width = w; hudLayer.height = h; }
  const hc = hudLayer.getContext('2d');
  drawHud(hc, w, h, hud, {});
  g.drawImage(hudLayer, 0, 0);
}

let last = 0;
function loop(ts) {
  const dt = Math.min(0.1, last ? (ts - last) / 1000 : DT);
  last = ts;
  app.acc += dt;
  let n = 0;
  while (app.acc >= DT && n < 6) { stepOnce(); app.acc -= DT; n++; }
  if (n === 6) app.acc = 0;
  renderFrame(dt);
  requestAnimationFrame(loop);
}

// ───────── 画面の大きさ
function onResize() {
  const dpr = Math.min(devicePixelRatio || 1, quality === 'high' ? 2 : 1.5);
  app.dpr = dpr;
  const W = innerWidth, H = innerHeight;
  const hud = $('hud');
  hud.width = Math.round(W * dpr); hud.height = Math.round(H * dpr);
  // 下のボタン類の一番上より上に文字を出す
  let minTop = H;
  for (const id of ['bar', 'pick', 'help', 'controls']) {
    const el = $(id);
    if (el.hidden) continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0) minTop = Math.min(minTop, r.top);
  }
  app.safeBottom = H - minTop + 4;
  if (app.recLayout) {
    app.world.setSize(REC_W, REC_H, 1);
    fitRecCanvas();
  } else {
    app.world.setSize(W, H, dpr);
  }
  app.effects.setScale(app.recLayout ? REC_H : H * dpr);
}

function fitRecCanvas() {
  const W = innerWidth, H = innerHeight - ($('bar').offsetHeight || 0);
  const s = Math.min(W / REC_W, H / REC_H);
  app.rec.style.width = `${REC_W * s}px`;
  app.rec.style.height = `${REC_H * s}px`;
}

function isTouchUI() { return isTouch || params.has('touch'); }

// ───────── 縦動画の書き出し
function pickMime() {
  const list = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const m of list) if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m;
  return '';
}

function setRecLayout(on) {
  app.recLayout = on;
  document.body.classList.toggle('rec', on);
  onResize();
}

function startRecording() {
  if (!window.MediaRecorder || !app.rec.captureStream) { alert('このブラウザは録画に対応していません。PC の Chrome か Edge で開いてください。'); return; }
  setRecLayout(true);
  startWatch();
  const mime = pickMime();
  const stream = app.rec.captureStream(30);
  const mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 12_000_000 } : { videoBitsPerSecond: 12_000_000 });
  const chunks = [];
  mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  mr.onstop = () => {
    const type = mr.mimeType || mime || 'video/webm';
    const blob = new Blob(chunks, { type });
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    const d = new Date();
    const name = `car-tower-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}.${ext}`;
    const url = URL.createObjectURL(blob);
    const a = $('saveLink');
    a.href = url; a.download = name;
    a.textContent = `動画を保存（${(blob.size / 1e6).toFixed(1)}MB・${ext.toUpperCase()}）`;
    $('saved').hidden = false;
    a.click();
  };
  mr.start(1000);
  app.recording = mr;
  updateUI();
}

function stopRecording() {
  const mr = app.recording;
  app.recording = null;
  if (mr && mr.state !== 'inactive') mr.stop();
  setRecLayout(false);
  updateUI();
}

// ───────── ボタン・キー
function setupUI() {
  $('btnWatch').onclick = () => { if (app.recording) return; $('saved').hidden = true; startWatch(); };
  $('btnChallenge').onclick = () => { if (app.recording) return; $('saved').hidden = true; startChallenge(app.challenge.index); };
  $('btnRec').onclick = () => { if (app.recording) stopRecording(); else startRecording(); };
  $('prevCar').onclick = () => startChallenge((app.challenge.index + app.cars.length - 1) % app.cars.length);
  $('nextCar').onclick = () => startChallenge((app.challenge.index + 1) % app.cars.length);
  $('retry').onclick = () => startChallenge(app.challenge.index);
  $('closeSaved').onclick = () => { $('saved').hidden = true; };
  addEventListener('keydown', (e) => {
    app.keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyR' && app.mode === 'challenge') startChallenge(app.challenge.index);
  });
  addEventListener('keyup', (e) => { app.keys[e.code] = false; });
  addEventListener('blur', () => { app.keys = {}; app.touch = {}; });
  for (const b of document.querySelectorAll('[data-k]')) {
    const k = b.dataset.k;
    const on = (e) => { e.preventDefault(); app.touch[k] = true; b.classList.add('on'); };
    const off = (e) => { e.preventDefault(); app.touch[k] = false; b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  // 上のアイコンを押すと、その車で挑戦
  $('hud').addEventListener('pointerdown', (e) => {
    if (app.recording) return;
    const W = innerWidth, H = innerHeight;
    const portrait = W / H < 0.9;
    const cw = portrait ? W : Math.min(W * 0.62, H * 1.15);
    const u = cw / 100, pad = u * 2.2, gap = u * 1.1, n = app.cars.length;
    const iw = (cw - pad * 2 - gap * (n - 1)) / n, ih = iw * 0.78, iy = u * 2.4, x0 = (W - cw) / 2;
    if (e.clientY < iy || e.clientY > iy + ih) return;
    const i = Math.floor((e.clientX - x0 - pad) / (iw + gap));
    if (i >= 0 && i < n) startChallenge(i);
  });
}

function updateUI() {
  const ch = app.mode === 'challenge';
  $('btnWatch').classList.toggle('active', !ch);
  $('btnChallenge').classList.toggle('active', ch);
  $('controls').hidden = !(ch && isTouchUI()) || !!app.recording;
  $('pick').hidden = !ch || !!app.recording;
  $('retry').hidden = !(ch && app.challenge.phase === 'result');
  $('help').hidden = !ch || isTouchUI();
  $('btnRec').textContent = app.recording ? '■ 録画を止める' : '● 縦動画を書き出す';
  $('btnRec').classList.toggle('recording', !!app.recording);
  $('btnWatch').disabled = $('btnChallenge').disabled = !!app.recording;
  requestAnimationFrame(onResize);
}

// ───────── 動画づくり用（Playwright から1コマずつ進める）
window.__cap = {
  start() { setRecLayout(true); startWatch(); this.n = 0; return true; },
  frame(steps = 2) {
    for (let i = 0; i < steps; i++) stepOnce();
    renderFrame(DT * steps);
    this.n++;
    return app.rec.toDataURL('image/jpeg', 0.92);
  },
  done() { return app.watch.done; },
  results() { return app.watch.results.map((r, i) => ({ car: app.cars[i].name, ok: r?.ok, block: r?.block, reason: r?.reason })); },
  // 画面確認用：指定の秒数だけ進める
  advance(seconds) {
    const n = Math.round(seconds / DT);
    const portrait = innerWidth / innerHeight < 0.9;
    for (let i = 0; i < n; i++) {
      stepOnce();
      app.effects.update(DT);
      app.rig.update(app.sim.carState(), DT, false, 0, portrait, app.time);
    }
    renderFrame(0);
  },
  challenge(i) { startChallenge(i); },
};

boot().catch((e) => {
  console.error(e);
  $('loading').textContent = '読み込みに失敗しました：' + e.message;
});
