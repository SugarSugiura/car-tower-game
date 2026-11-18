// 自作のロゴ（エンブレム）・車のアイコン・コンテナの模様。すべてプログラムで描く（画像ファイルなし）

export const FONT_BIG = '"Dela Gothic One", "Hiragino Sans", "Noto Sans JP", "WenQuanYi Zen Hei", sans-serif';
export const FONT_TEXT = '"M PLUS 1p", "Hiragino Sans", "Noto Sans JP", "WenQuanYi Zen Hei", sans-serif';

function makeCanvas(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined' && false ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// メーカーのロゴ（架空）。ctx の (cx,cy) を中心に半径 r で描く
export function drawEmblem(ctx, maker, cx, cy, r, color = '#ffffff', bg = '#1a1a1a') {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const fillBadge = (shape) => {
    ctx.fillStyle = bg; ctx.strokeStyle = color; ctx.lineWidth = r * 0.12;
    shape(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.strokeStyle = color;
  };
  ctx.fillStyle = color; ctx.strokeStyle = color;
  switch (maker) {
    case 'MAMEKO': { // 豆の形
      fillBadge(() => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); });
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(-r * 0.25, 0, r * 0.32, r * 0.45, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.28, 0, r * 0.32, r * 0.45, 0.4, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'VELOCE': { // 盾と V
      fillBadge(() => {
        ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.85); ctx.lineTo(r * 0.8, -r * 0.85);
        ctx.quadraticCurveTo(r * 0.85, r * 0.35, 0, r); ctx.quadraticCurveTo(-r * 0.85, r * 0.35, -r * 0.8, -r * 0.85); ctx.closePath();
      });
      ctx.lineWidth = r * 0.2; ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 0.45); ctx.lineTo(0, r * 0.45); ctx.lineTo(r * 0.45, -r * 0.45); ctx.stroke();
      break;
    }
    case 'KAIZEN': { // 丸と右上がりの矢印
      fillBadge(() => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); });
      ctx.lineWidth = r * 0.2;
      ctx.beginPath(); ctx.moveTo(-r * 0.55, r * 0.45); ctx.lineTo(-r * 0.1, 0); ctx.lineTo(r * 0.1, r * 0.2); ctx.lineTo(r * 0.5, -r * 0.35); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.55, -r * 0.55); ctx.lineTo(r * 0.6, -r * 0.05); ctx.lineTo(r * 0.12, -r * 0.5); ctx.closePath(); ctx.fill();
      break;
    }
    case 'THUNDER': { // 六角形と稲妻
      fillBadge(() => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath();
      });
      ctx.beginPath();
      ctx.moveTo(r * 0.15, -r * 0.7); ctx.lineTo(-r * 0.35, r * 0.1); ctx.lineTo(0, r * 0.1);
      ctx.lineTo(-r * 0.15, r * 0.7); ctx.lineTo(r * 0.35, -r * 0.1); ctx.lineTo(0, -r * 0.1); ctx.closePath(); ctx.fill();
      break;
    }
    case 'HAKOBUNE': { // 角丸の四角と舟・波
      fillBadge(() => { roundRect(ctx, -r, -r * 0.8, r * 2, r * 1.6, r * 0.3); });
      ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.05); ctx.lineTo(r * 0.6, -r * 0.05); ctx.lineTo(r * 0.35, r * 0.3); ctx.lineTo(-r * 0.35, r * 0.3); ctx.closePath(); ctx.fill();
      ctx.fillRect(-r * 0.25, -r * 0.45, r * 0.5, r * 0.32);
      ctx.lineWidth = r * 0.09; ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.5);
      for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(-r * 0.7 + (i + 0.5) * r * 0.35, r * 0.38, -r * 0.7 + (i + 1) * r * 0.35, r * 0.5);
      ctx.stroke();
      break;
    }
    case 'BERGWERK': { // 丸と山
      fillBadge(() => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); });
      ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.45); ctx.lineTo(-r * 0.2, -r * 0.45); ctx.lineTo(0, -r * 0.1); ctx.lineTo(r * 0.25, -r * 0.55); ctx.lineTo(r * 0.72, r * 0.45); ctx.closePath(); ctx.fill();
      ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.45); ctx.lineTo(-r * 0.32, -r * 0.2); ctx.lineTo(-r * 0.08, -r * 0.2); ctx.closePath(); ctx.fill();
      break;
    }
    case 'MESA': { // 台地と太陽
      fillBadge(() => { roundRect(ctx, -r, -r * 0.75, r * 2, r * 1.5, r * 0.15); });
      ctx.beginPath(); ctx.arc(r * 0.35, -r * 0.2, r * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-r * 0.8, r * 0.5); ctx.lineTo(-r * 0.55, -r * 0.05); ctx.lineTo(r * 0.05, -r * 0.05); ctx.lineTo(r * 0.3, r * 0.2); ctx.lineTo(r * 0.8, r * 0.2); ctx.lineTo(r * 0.8, r * 0.5); ctx.closePath(); ctx.fill();
      break;
    }
    case 'GORILLA': { // 三本の爪あと
      fillBadge(() => {
        ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, -r * 0.2); ctx.lineTo(r * 0.6, r); ctx.lineTo(-r * 0.6, r); ctx.lineTo(-r, -r * 0.2); ctx.closePath();
      });
      ctx.lineWidth = r * 0.16;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.32 + r * 0.15, -r * 0.5); ctx.quadraticCurveTo(i * r * 0.32 + r * 0.05, 0, i * r * 0.32 - r * 0.15, r * 0.55); ctx.stroke(); }
      break;
    }
    default: {
      fillBadge(() => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); });
    }
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// 横から見た車の形（アイコン用）。幅 w・高さ h の枠に収める。前は右
export function drawCarSilhouette(ctx, def, x, y, w, h) {
  const shapes = {
    kei:     [[0, .62], [.04, .38], [.2, .32], [.28, .06], [.86, .06], [.95, .3], [1, .38], [1, .62]],
    super:   [[0, .6], [.02, .42], [.25, .36], [.42, .2], [.62, .2], [.88, .38], [1, .44], [1, .6]],
    sports:  [[0, .6], [.02, .36], [.08, .3], [.28, .3], [.38, .14], [.62, .14], [.76, .32], [1, .4], [1, .6]],
    muscle:  [[0, .6], [0, .34], [.22, .3], [.33, .14], [.58, .14], [.7, .3], [1, .34], [1, .6]],
    van:     [[0, .62], [0, .06], [.72, .06], [.9, .3], [1, .4], [1, .62]],
    suv:     [[0, .62], [0, .2], [.08, .06], [.66, .06], [.8, .3], [1, .36], [1, .62]],
    pickup:  [[0, .62], [0, .32], [.46, .32], [.5, .08], [.7, .08], [.8, .32], [1, .36], [1, .62]],
    offroad: [[0, .55], [.02, .25], [.12, .08], [.62, .08], [.74, .28], [1, .3], [1, .55]],
  };
  const pts = shapes[def.style] || shapes.sports;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = def.color;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = Math.max(1, w * 0.025);
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px * w, py * h) : ctx.moveTo(px * w, py * h)));
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 窓
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  const win = { kei: [.3, .12, .5, .2], super: [.44, .25, .2, .1], sports: [.4, .19, .22, .11], muscle: [.35, .19, .23, .1], van: [.05, .12, .7, .18], suv: [.1, .12, .56, .18], pickup: [.51, .13, .2, .16], offroad: [.14, .13, .48, .14] }[def.style] || [.4, .2, .2, .1];
  ctx.fillRect(win[0] * w, win[1] * h, win[2] * w, win[3] * h);
  // タイヤ
  const rr = Math.min(h * (0.17 + def.wheelR * 0.28), w * 0.14);
  const by = h * 0.62;
  ctx.fillStyle = '#151515';
  for (const fx of [0.2, 0.8]) { ctx.beginPath(); ctx.arc(fx * w, by, rr, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#9aa0a6';
  for (const fx of [0.2, 0.8]) { ctx.beginPath(); ctx.arc(fx * w, by, rr * 0.45, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// コンテナの側面の模様（波板）
export function containerCanvas(color) {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 16; i++) {
    const x = i * 16;
    const grad = g.createLinearGradient(x, 0, x + 16, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0.22)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = grad; g.fillRect(x, 0, 16, 256);
  }
  // 錆と汚れ
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(${90 + Math.random() * 40},${50 + Math.random() * 20},20,${Math.random() * 0.12})`;
    g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 10, 0, Math.PI * 2); g.fill();
  }
  // 枠
  g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 10; g.strokeRect(0, 0, 256, 256);
  return c;
}

// 地面（アスファルト）
export function asphaltCanvas() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#5a5d61'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) {
    const v = 70 + Math.random() * 50;
    g.fillStyle = `rgba(${v},${v},${v + 4},0.35)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  return c;
}

// 車の横に貼る名前（ドアのデカール）
export function nameDecalCanvas(def) {
  const c = makeCanvas(512, 128);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 128);
  drawEmblem(g, def.maker, 64, 64, 44, def.accent === '#111111' ? '#ffffff' : def.accent, def.color);
  g.font = `64px ${FONT_BIG}`;
  g.fillStyle = def.accent;
  g.textBaseline = 'middle';
  g.fillText(def.name, 124, 68, 380);
  return c;
}

export function emblemCanvas(def) {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  drawEmblem(g, def.maker, 64, 64, 56, '#e8e8e8', '#202020');
  return c;
}

// チェッカーの旗
export function checkerCanvas() {
  const c = makeCanvas(128, 64);
  const g = c.getContext('2d');
  for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 16, y * 16, 16, 16); }
  return c;
}

export function softDotCanvas() {
  const c = makeCanvas(64, 64);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return c;
}
