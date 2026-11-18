// 画面の文字・アイコン（2D の canvas に描く。画面にも録画にも同じものを使う）
import { drawCarSilhouette, drawEmblem, roundRect, FONT_BIG, FONT_TEXT } from './art.js';

export function isLight(hex) { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) > 170; }

const GREEN = '#22c55e', RED = '#ef4444', YELLOW = '#facc15';

function mark(ctx, ok, cx, cy, r) {
  ctx.save();
  ctx.fillStyle = ok ? GREEN : RED;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = r * 0.16;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = r * 0.3;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (ok) { ctx.moveTo(cx - r * 0.48, cy + r * 0.02); ctx.lineTo(cx - r * 0.12, cy + r * 0.38); ctx.lineTo(cx + r * 0.52, cy - r * 0.36); }
  else { ctx.moveTo(cx - r * 0.4, cy - r * 0.4); ctx.lineTo(cx + r * 0.4, cy + r * 0.4); ctx.moveTo(cx + r * 0.4, cy - r * 0.4); ctx.lineTo(cx - r * 0.4, cy + r * 0.4); }
  ctx.stroke();
  ctx.restore();
}

function outlinedText(ctx, text, x, y, size, font, fill = '#fff', stroke = 'rgba(0,0,0,0.85)', maxW) {
  ctx.font = `${size}px ${font}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  if (maxW) { ctx.strokeText(text, x, y, maxW); ctx.fillText(text, x, y, maxW); }
  else { ctx.strokeText(text, x, y); ctx.fillText(text, x, y); }
}

// 今の車の数字（短く）
export function specLine(def) {
  return `${def.mass.toLocaleString()}kg ・ ${Math.round(def.power * 1.36)}馬力 ・ ${def.drive} ・ 車高${Math.round(def.clearance * 100)}cm`;
}

/**
 * hud = { cars, results[], current, block, total, stamp:{ok,reason,t}, title:t, summary:t, mode, recording }
 * w,h はピクセル。safeBottom は下のボタンの分の高さ（画面のときだけ）
 */
export function drawHud(ctx, w, h, hud, opt = {}) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  const portrait = w / h < 0.9;
  const cw = portrait ? w : Math.min(w * 0.62, h * 1.15);
  const x0 = (w - cw) / 2;
  const u = cw / 100;
  const top = opt.safeTop || 0;
  ctx.textBaseline = 'middle';

  // 上の帯（8台のアイコン）
  const n = hud.cars.length;
  const pad = u * 2.2, gap = u * 1.1;
  const iw = (cw - pad * 2 - gap * (n - 1)) / n;
  const ih = iw * 0.78;
  const iy = top + u * 2.4;
  const barGrad = ctx.createLinearGradient(0, 0, 0, iy + ih + u * 4);
  barGrad.addColorStop(0, 'rgba(0,0,0,0.55)');
  barGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, w, iy + ih + u * 5);
  hud.cars.forEach((def, i) => {
    const x = x0 + pad + i * (iw + gap);
    const cur = i === hud.current;
    ctx.fillStyle = cur ? 'rgba(250,204,21,0.30)' : 'rgba(15,23,42,0.72)';
    roundRect(ctx, x, iy, iw, ih, iw * 0.14); ctx.fill();
    ctx.lineWidth = cur ? Math.max(2, u * 0.7) : Math.max(1, u * 0.25);
    ctx.strokeStyle = cur ? YELLOW : 'rgba(255,255,255,0.35)';
    ctx.stroke();
    const res = hud.results[i];
    ctx.globalAlpha = res && !res.ok ? 0.55 : 1;
    drawCarSilhouette(ctx, def, x + iw * 0.08, iy + ih * 0.14, iw * 0.84, ih * 0.62);
    ctx.globalAlpha = 1;
    // 段の数（結果が出たら）
    if (res) {
      ctx.font = `${Math.round(iw * 0.2)}px ${FONT_TEXT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e5e7eb';
      ctx.fillText(res.ok ? '登頂' : `${res.block + 1}段`, x + iw / 2, iy + ih * 0.86);
      mark(ctx, res.ok, x + iw * 0.8, iy + ih * 0.12, iw * 0.24);
    } else {
      ctx.font = `${Math.round(iw * 0.2)}px ${FONT_TEXT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(229,231,235,0.7)';
      ctx.fillText(`${i + 1}`, x + iw / 2, iy + ih * 0.86);
    }
  });

  // 車の名前（大きく）
  const def = hud.cars[hud.current];
  if (def && !hud.summary) {
    const nameSize = Math.min(u * 10.5, h * 0.085);
    const ny = iy + ih + u * 3 + nameSize * 0.6;
    const er = nameSize * 0.42;
    ctx.font = `${nameSize}px ${FONT_BIG}`;
    const tw = Math.min(ctx.measureText(def.name).width, cw - u * 8 - er * 2.6);
    const total = er * 2.6 + tw;
    const sx = w / 2 - total / 2;
    drawEmblem(ctx, def.maker, sx + er, ny, er, isLight(def.color) ? def.accent : '#ffffff', def.color);
    ctx.textAlign = 'left';
    outlinedText(ctx, def.name, sx + er * 2.6, ny + nameSize * 0.04, nameSize, FONT_BIG, '#ffffff', 'rgba(0,0,0,0.9)', cw - u * 8 - er * 2.6);
    const ky = ny + nameSize * 0.78;
    ctx.textAlign = 'center';
    outlinedText(ctx, `${def.kana}（架空の車）`, w / 2, ky, nameSize * 0.32, FONT_TEXT, '#f1f5f9');
    outlinedText(ctx, specLine(def), w / 2, ky + nameSize * 0.42, nameSize * 0.27, FONT_TEXT, '#cbd5e1');

    // 何段目まで登れたか
    const py = ky + nameSize * 0.95;
    const segW = Math.min(u * 7.2, (cw - u * 30) / hud.total);
    const segH = u * 2.6;
    const label = hud.block >= hud.total - 1 ? '頂上！' : `${Math.max(0, hud.block + 1)} / ${hud.total} 段`;
    ctx.font = `${u * 4.6}px ${FONT_BIG}`;
    const lw = ctx.measureText(label).width;
    const bw = segW * hud.total + u * 0.6 * (hud.total - 1);
    const all = lw + u * 3 + bw;
    let bx = w / 2 - all / 2;
    ctx.fillStyle = 'rgba(15,23,42,0.6)';
    roundRect(ctx, bx - u * 2, py - segH * 1.1, all + u * 4, segH * 2.2, segH * 0.6); ctx.fill();
    ctx.textAlign = 'left';
    outlinedText(ctx, label, bx, py + u * 0.2, u * 4.6, FONT_BIG, hud.block >= hud.total - 1 ? YELLOW : '#ffffff');
    bx += lw + u * 3;
    for (let i = 0; i < hud.total; i++) {
      ctx.fillStyle = i <= hud.block ? (i === hud.total - 1 ? YELLOW : GREEN) : 'rgba(255,255,255,0.25)';
      roundRect(ctx, bx + i * (segW + u * 0.6), py - segH / 2, segW, segH, segH * 0.3); ctx.fill();
    }
  }

  // 2倍速の表示
  if (hud.fast && !hud.stamp) {
    const fs = u * 4.2;
    ctx.textAlign = 'right';
    outlinedText(ctx, '▶▶ 2倍速', x0 + cw - u * 3, h * 0.42, fs, FONT_BIG, '#ffffff');
  }

  // はじめのタイトル
  if (hud.title != null && hud.title < 2.6) {
    const a = Math.min(1, hud.title * 4, (2.6 - hud.title) * 3);
    ctx.globalAlpha = a;
    const s = Math.min(u * 9, h * 0.07);
    const cy = h * 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, cy - s * 1.3, w, s * 2.6);
    ctx.textAlign = 'center';
    outlinedText(ctx, 'コンテナの塔を', w / 2, cy - s * 0.55, s, FONT_BIG, '#ffffff');
    outlinedText(ctx, '登れるか？', w / 2, cy + s * 0.6, s * 1.15, FONT_BIG, YELLOW);
    ctx.globalAlpha = 1;
  }

  // 結果の判定（✓✗）
  if (hud.stamp) {
    const t = hud.stamp.t;
    const pop = t < 0.18 ? 1.6 - (t / 0.18) * 0.6 : 1;
    const r = Math.min(u * 15, h * 0.11) * pop;
    const cy = h * 0.56;
    ctx.globalAlpha = Math.min(1, t * 6);
    mark(ctx, hud.stamp.ok, w / 2, cy, r);
    ctx.textAlign = 'center';
    const msg = hud.stamp.ok ? '登頂成功！' : `${hud.stamp.reason}…`;
    outlinedText(ctx, msg, w / 2, cy + r * 1.55, Math.min(u * 8.5, h * 0.065), FONT_BIG, hud.stamp.ok ? '#bbf7d0' : '#fecaca');
    ctx.globalAlpha = 1;
  }

  // 最後のまとめ
  if (hud.summary != null) {
    const a = Math.min(1, hud.summary * 3);
    ctx.globalAlpha = a;
    const cardW = Math.min(cw * 0.9, u * 90), rowH = Math.min(u * 8.4, h * 0.06);
    const cardH = rowH * (n + 2.4);
    const cx = w / 2 - cardW / 2;
    const cy = Math.max(iy + ih + u * 4, h * 0.52 - cardH / 2);
    ctx.fillStyle = 'rgba(15,23,42,0.86)';
    roundRect(ctx, cx, cy, cardW, cardH, u * 3); ctx.fill();
    ctx.textAlign = 'center';
    const okN = hud.results.filter((r) => r && r.ok).length;
    outlinedText(ctx, `登頂できたのは ${okN} / ${n} 台`, w / 2, cy + rowH * 0.9, rowH * 0.62, FONT_BIG, YELLOW);
    hud.cars.forEach((d, i) => {
      const ry = cy + rowH * (2.1 + i);
      const res = hud.results[i];
      drawCarSilhouette(ctx, d, cx + u * 3, ry - rowH * 0.36, rowH * 1.3, rowH * 0.72);
      ctx.textAlign = 'left';
      outlinedText(ctx, d.name, cx + u * 4 + rowH * 1.45, ry, rowH * 0.46, FONT_BIG, '#ffffff', 'rgba(0,0,0,0.6)', cardW * 0.5);
      ctx.textAlign = 'right';
      if (res) {
        outlinedText(ctx, res.ok ? '登頂' : `${res.block + 1}段・${res.reason}`, cx + cardW - u * 3 - rowH * 1.1, ry, rowH * 0.36, FONT_TEXT, res.ok ? '#bbf7d0' : '#fecaca', 'rgba(0,0,0,0.6)');
        mark(ctx, res.ok, cx + cardW - u * 3 - rowH * 0.4, ry, rowH * 0.36);
      }
    });
    ctx.globalAlpha = 1;
  }

  // 下の注意書き
  ctx.textAlign = 'center';
  const fs = Math.max(10, Math.min(u * 2.5, h * 0.018));
  outlinedText(ctx, '※車名・メーカー・ロゴはすべて架空です', w / 2, h - (opt.safeBottom || 0) - fs * 1.2, fs, FONT_TEXT, 'rgba(255,255,255,0.85)', 'rgba(0,0,0,0.6)');
  ctx.restore();
}
