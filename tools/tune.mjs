// Node で8台を走らせて結果を出す（描画なし）。node tools/tune.mjs [車のid] [--steer]
import fs from 'node:fs';
import RAPIER from '../vendor/rapier.mjs';
import { Sim, Judge, AutoDriver, DT } from '../js/sim.js';
await RAPIER.init();
const tower = JSON.parse(fs.readFileSync(new URL('../config/tower.json', import.meta.url)));
const cars = JSON.parse(fs.readFileSync(new URL('../config/cars.json', import.meta.url))).cars;
const only = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const verbose = process.argv.includes('-v');
const sim = new Sim(RAPIER, tower);
for (const def of cars) {
  if (only && def.id !== only) continue;
  const car = sim.spawnCar(def);
  const judge = new Judge(sim); const drv = new AutoDriver();
  let res = null, n = 0, ev = { impact: 0, detach: [], scrape: 0 };
  const t0 = Date.now();
  while (n < 60 * 60) {
    const st = sim.carState();
    const evs = sim.step(drv.drive(st, def));
    for (const e of evs) { if (e.type === 'impact') ev.impact++; if (e.type === 'detach') ev.detach.push(e.part); if (e.type === 'scrape') ev.scrape++; if (e.type==='fire') ev.fire=true; }
    res = judge.update(sim.carState(), car);
    if (verbose && n % 30 === 0) { const s = sim.carState(); console.log(n, s.pos.x.toFixed(2), s.pos.y.toFixed(2), s.pos.z.toFixed(2), 'v', s.speed.toFixed(1), 'blk', s.block, 'up', s.up.y.toFixed(2)); }
    n++;
    if (res && judge.resultT > 2.5) break;
  }
  const ms = Date.now() - t0;
  console.log(`${def.name.padEnd(14)} ${res ? (res.ok ? '✓' : '✗') : '?'} ${res?.reason ?? ''} 段=${(res?.block ?? -1) + 1} t=${res?.time?.toFixed(1)} dmg=${car.damage.toFixed(1)} 衝突=${ev.impact} 擦り=${ev.scrape} 外れ=${ev.detach.join(',')} ${ev.fire ? '炎' : ''} (${ms}ms)`);
}
