// 物理の中身（描画なし）。ブラウザでも Node でも動く。
// 座標：x=右、y=上、z=前（塔の方向）。単位はメートル・キログラム・秒。

export const DT = 1 / 60;
export let STEER_SIGN = 1;
export function setSteerSign(v) { STEER_SIGN = v; }

const G_ENV = 0x0001, G_CAR = 0x0002, G_DEBRIS = 0x0004;
const groups = (member, filter) => ((member & 0xffff) << 16) | (filter & 0xffff);
const GROUP_ENV = groups(G_ENV, G_CAR | G_DEBRIS);
const GROUP_CAR = groups(G_CAR, G_ENV);
const GROUP_DEBRIS = groups(G_DEBRIS, G_ENV | G_DEBRIS);

// クォータニオンでベクトルを回す
export function qrot(q, v) {
  const { x, y, z, w } = q;
  const ix = w * v.x + y * v.z - z * v.y;
  const iy = w * v.y + z * v.x - x * v.z;
  const iz = w * v.z + x * v.y - y * v.x;
  const iw = -x * v.x - y * v.y - z * v.z;
  return {
    x: ix * w + iw * -x + iy * -z - iz * -y,
    y: iy * w + iw * -y + iz * -x - ix * -z,
    z: iz * w + iw * -z + ix * -y - iy * -x,
  };
}
export function qinvrot(q, v) { return qrot({ x: -q.x, y: -q.y, z: -q.z, w: q.w }, v); }

export function towerLayout(tower) {
  const blocks = [];
  let h = 0;
  const n = tower.steps.length;
  for (let i = 0; i < n; i++) {
    h += tower.steps[i];
    const depth = i === n - 1 ? tower.topDepth : tower.stepDepth;
    const z0 = i * tower.stepDepth;
    blocks.push({ index: i, z0, z1: z0 + depth, top: h, rise: tower.steps[i] });
  }
  return blocks;
}

export class Sim {
  constructor(R, tower) {
    this.R = R;
    this.tower = tower;
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = DT;
    this.world.integrationParameters.numSolverIterations = 8;
    this.events = new R.EventQueue(true);
    this.blocks = towerLayout(tower);
    this.parts = new Map(); // collider handle -> { kind, ... }
    this.car = null;
    this.frame = 0;
    this.buildWorld();
  }

  buildWorld() {
    const R = this.R, w = this.world;
    const ground = w.createRigidBody(R.RigidBodyDesc.fixed());
    w.createCollider(
      R.ColliderDesc.cuboid(80, 0.5, 120).setTranslation(0, -0.5, 0).setFriction(1.0).setCollisionGroups(GROUP_ENV),
      ground
    );
    const hw = this.tower.width / 2;
    for (const b of this.blocks) {
      const hd = (b.z1 - b.z0) / 2;
      w.createCollider(
        R.ColliderDesc.cuboid(hw, b.top / 2, hd)
          .setTranslation(0, b.top / 2, b.z0 + hd)
          .setFriction(1.0)
          .setCollisionGroups(GROUP_ENV),
        ground
      );
    }
    this.groundBody = ground;
  }

  // 車を出す
  spawnCar(def, startZ = -this.tower.runUp) {
    if (this.car) this.removeCar();
    const R = this.R, w = this.world;
    const L = def.length, W = def.width, BH = def.bodyH;
    const wheelMass = 15 + 60 * def.wheelR;
    const hubMass = 10, knuckleMass = 8, bumperMass = 18;
    const chassisMass = def.mass - 4 * (wheelMass + hubMass) - 2 * knuckleMass - 2 * bumperMass;
    const travel = 0.12;
    const quarter = def.mass / 4;
    const springK = (quarter * 9.81) / 0.07; // 7cm 沈む
    const springC = 2 * 0.55 * Math.sqrt(springK * quarter);
    const sag = (quarter * 9.81) / springK;

    const cy = def.clearance + BH / 2; // 地面から車体の中心
    const chassis = w.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(0, cy + 0.05, startZ)
        .setCanSleep(false)
        .setAngularDamping(0.15)
        .setLinearDamping(0.02)
    );
    // 車体：下の箱（前後の下側を斜めに削る）
    const hx = W / 2, hy = BH / 2, hz = L / 2;
    // 前後の張り出し（タイヤより前・後ろ）は下を斜めに削る＝乗り上げやすさ
    const cf = BH * 0.55;
    const czF = Math.max(0.3, hz - def.wheelbase / 2 - 0.05);
    const czR = czF;
    const pts = [];
    for (const sx of [-hx, hx]) {
      pts.push(sx, hy, hz, sx, hy, -hz);
      pts.push(sx, -hy + cf, hz, sx, -hy + cf, -hz);
      pts.push(sx, -hy, hz - czF, sx, -hy, -hz + czR);
    }
    const hull = R.ColliderDesc.convexHull(new Float32Array(pts));
    const H = BH + def.cabinH * 0.6;
    const body = w.createCollider(
      hull
        .setFriction(0.35)
        .setRestitution(0.05)
        .setCollisionGroups(GROUP_CAR)
        .setMassProperties(
          chassisMass,
          { x: 0, y: -BH * 0.2 + def.cabinH * 0.22, z: def.comZ || 0.05 },
          { x: (chassisMass / 12) * (H * H + L * L), y: (chassisMass / 12) * (W * W + L * L), z: (chassisMass / 12) * (W * W + H * H) },
          { x: 0, y: 0, z: 0, w: 1 }
        )
        .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(chassisMass * 9.81 * 1.2),
      chassis
    );
    // 屋根（キャビン）
    const cab = w.createCollider(
      R.ColliderDesc.cuboid(hx * 0.86, def.cabinH / 2, def.cabinLen / 2)
        .setTranslation(0, hy + def.cabinH / 2, def.cabinOffset)
        .setFriction(0.4)
        .setDensity(0)
        .setCollisionGroups(GROUP_CAR)
        .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(chassisMass * 9.81 * 1.2),
      chassis
    );

    const car = {
      def, chassis, colliders: [body, cab], wheels: [], bumpers: [], bodies: [chassis], joints: [],
      wheelMass, steer: 0, damage: 0, heat: 0, slip: 0, onFire: false, smoking: false, dents: [],
      fallStartY: null, maxFallY: 0,
    };
    this.parts.set(body.handle, { kind: 'body', car });
    this.parts.set(cab.handle, { kind: 'cabin', car });

    const wy = def.wheelR - cy; // 車体の中心から見たタイヤの中心
    const wz = def.wheelbase / 2, wx = def.track / 2;
    const corners = [
      { name: 'FL', x: -wx, z: wz, front: true },
      { name: 'FR', x: wx, z: wz, front: true },
      { name: 'RL', x: -wx, z: -wz, front: false },
      { name: 'RR', x: wx, z: -wz, front: false },
    ];
    const smallInertia = (m) => ({ x: m * 0.02, y: m * 0.02, z: m * 0.02 });
    for (const c of corners) {
      const pos = { x: c.x, y: wy + 0.05 + cy, z: startZ + c.z };
      let parent = chassis, anchor = { x: c.x, y: wy, z: c.z };
      let steerJoint = null;
      if (c.front) {
        const kn = w.createRigidBody(
          R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setCanSleep(false)
            .setAdditionalMassProperties(knuckleMass, { x: 0, y: 0, z: 0 }, smallInertia(knuckleMass), { x: 0, y: 0, z: 0, w: 1 })
        );
        const jd = R.JointData.revolute(anchor, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
        jd.limitsEnabled = true; jd.limits = [-0.65, 0.65];
        steerJoint = w.createImpulseJoint(jd, chassis, kn, true);
        steerJoint.configureMotorModel(R.MotorModel.ForceBased);
        steerJoint.configureMotorPosition(0, 60000, 4000);
        car.bodies.push(kn); car.joints.push(steerJoint);
        parent = kn; anchor = { x: 0, y: 0, z: 0 };
      }
      const hub = w.createRigidBody(
        R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setCanSleep(false)
          .setAdditionalMassProperties(hubMass, { x: 0, y: 0, z: 0 }, smallInertia(hubMass), { x: 0, y: 0, z: 0, w: 1 })
      );
      const pj = R.JointData.prismatic(anchor, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
      pj.limitsEnabled = true; pj.limits = [-travel, travel];
      const susp = w.createImpulseJoint(pj, parent, hub, true);
      susp.configureMotorModel(R.MotorModel.ForceBased);
      susp.configureMotorPosition(-sag, springK, springC);
      car.bodies.push(hub); car.joints.push(susp);

      const wheel = w.createRigidBody(
        R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setCanSleep(false).setAngularDamping(0.05)
      );
      const wc = w.createCollider(
        R.ColliderDesc.ball(def.wheelR)
          .setFriction(def.grip)
          .setFrictionCombineRule(R.CoefficientCombineRule.Multiply)
          .setRestitution(0.0)
          .setCollisionGroups(GROUP_CAR)
          .setMass(wheelMass)
          .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS)
          .setContactForceEventThreshold(def.mass * 9.81 * 1.5),
        wheel
      );
      const rj = R.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
      const axle = w.createImpulseJoint(rj, hub, wheel, true);
      car.bodies.push(wheel); car.joints.push(axle);
      const driven = def.drive === '4WD' || (def.drive === 'FF' && c.front) || (def.drive === 'FR' && !c.front);
      const wobj = { ...c, body: wheel, hub, collider: wc, axleJoint: axle, steerJoint, susp, driven, attached: true, local: { x: c.x, y: wy, z: c.z } };
      car.wheels.push(wobj);
      this.parts.set(wc.handle, { kind: 'wheel', car, wheel: wobj });
    }

    // バンパー（前・後）。強くぶつかると外れる
    for (const front of [true, false]) {
      const bz = (front ? 1 : -1) * (hz + 0.07);
      const by = -hy + cf + 0.06;
      const bb = w.createRigidBody(
        R.RigidBodyDesc.dynamic().setTranslation(0, cy + 0.05 + by, startZ + bz).setCanSleep(false)
      );
      const bc = w.createCollider(
        R.ColliderDesc.cuboid(hx * 0.98, 0.11, 0.09)
          .setFriction(0.4)
          .setMass(bumperMass)
          .setCollisionGroups(GROUP_CAR)
          .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS)
          .setContactForceEventThreshold(def.mass * 9.81 * 0.6),
        bb
      );
      const fj = R.JointData.fixed({ x: 0, y: by, z: bz }, { x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 });
      const joint = w.createImpulseJoint(fj, chassis, bb, true);
      const bobj = { front, body: bb, collider: bc, joint, attached: true, hits: 0, local: { x: 0, y: by, z: bz } };
      car.bumpers.push(bobj);
      car.bodies.push(bb);
      this.parts.set(bc.handle, { kind: 'bumper', car, bumper: bobj });
    }

    this.car = car;
    this.frame = 0;
    return car;
  }

  removeCar() {
    const car = this.car;
    if (!car) return;
    for (const b of car.bodies) this.world.removeRigidBody(b);
    for (const [h, p] of this.parts) if (p.car === car) this.parts.delete(h);
    this.car = null;
  }

  detachWheel(wobj, out) {
    if (!wobj.attached) return;
    wobj.attached = false;
    this.world.removeImpulseJoint(wobj.axleJoint, true);
    wobj.collider.setCollisionGroups(GROUP_DEBRIS);
    const t = wobj.body.translation();
    out.push({ type: 'detach', part: 'wheel', name: wobj.name, pos: { x: t.x, y: t.y, z: t.z } });
  }

  detachBumper(bobj, out) {
    if (!bobj.attached) return;
    bobj.attached = false;
    this.world.removeImpulseJoint(bobj.joint, true);
    bobj.collider.setCollisionGroups(GROUP_DEBRIS);
    const t = bobj.body.translation();
    out.push({ type: 'detach', part: 'bumper', front: bobj.front, pos: { x: t.x, y: t.y, z: t.z } });
  }

  // 1コマ進める。input = { throttle(-1..1), steer(-1..1：右が+), brake(0..1) }
  step(input) {
    const car = this.car;
    const out = [];
    if (car) this.applyControls(car, input);
    this.world.step(this.events);
    this.frame++;
    if (!car) return out;

    const R = this.R;
    // 衝突の強さ
    this.events.drainContactForceEvents((e) => {
      const h1 = e.collider1(), h2 = e.collider2();
      const p = this.parts.get(h1) || this.parts.get(h2);
      if (!p || p.car !== car) return;
      const mine = this.parts.get(h1) ? h1 : h2;
      const other = mine === h1 ? h2 : h1;
      const F = e.totalForceMagnitude();
      const dv = (F * DT) / car.def.mass; // ぶつかった瞬間の速さの変化(m/s)
      if (dv < 0.9) return;
      let point = null, normal = null;
      const c1 = this.world.getCollider(mine), c2 = this.world.getCollider(other);
      if (c1 && c2) {
        this.world.contactPair(c1, c2, (m, flipped) => {
          if (point || m.numSolverContacts() === 0) return;
          const sp = m.solverContactPoint(0);
          point = { x: sp.x, y: sp.y, z: sp.z };
          const n = m.normal();
          normal = flipped ? { x: -n.x, y: -n.y, z: -n.z } : { x: n.x, y: n.y, z: n.z };
        });
      }
      if (!point) {
        const t = this.world.getCollider(mine).translation();
        point = { x: t.x, y: t.y, z: t.z };
      }
      this.handleImpact(car, p, dv, point, normal, out);
    });

    // 車体を擦っている所（火花）
    if (this.frame % 2 === 0) {
      const lv = car.chassis.linvel();
      const speed = Math.hypot(lv.x, lv.y, lv.z);
      if (speed > 1.2) {
        for (const col of car.colliders) {
          this.world.contactPairsWith(col, (other) => {
            if (this.parts.has(other.handle)) return;
            this.world.contactPair(col, other, (m) => {
              if (m.numSolverContacts() === 0) return;
              const sp = m.solverContactPoint(0);
              out.push({ type: 'scrape', pos: { x: sp.x, y: sp.y, z: sp.z }, speed });
            });
          });
        }
      }
    }

    // 落下の高さ（大きな落下は炎）
    const t = car.chassis.translation();
    const v = car.chassis.linvel();
    if (v.y < -2.5) {
      if (car.fallStartY === null) car.fallStartY = t.y;
    } else if (car.fallStartY !== null && v.y > -0.5) {
      const drop = car.fallStartY - t.y;
      if (drop > car.maxFallY) car.maxFallY = drop;
      car.fallStartY = null;
    }

    if (!car.smoking && (car.damage > 8 || car.heat > 9)) { car.smoking = true; out.push({ type: 'smoke' }); }
    if (!car.onFire && (car.damage > 26 || car.heat > 18 || (car.maxFallY > 2.6 && car.damage > 12))) {
      car.onFire = true; out.push({ type: 'fire' });
    }
    return out;
  }

  handleImpact(car, p, dv, point, normal, out) {
    const q = car.chassis.rotation();
    const ct = car.chassis.translation();
    const local = qinvrot(q, { x: point.x - ct.x, y: point.y - ct.y, z: point.z - ct.z });
    let sev = dv;
    if (p.kind === 'wheel') sev *= 0.5; // タイヤはクッションになる
    car.damage += Math.max(0, sev - 1.2) * 1.4;
    out.push({ type: 'impact', kind: p.kind, severity: sev, pos: point, normal, local });
    if (p.kind === 'body' || p.kind === 'cabin') {
      if (sev > 1.6) car.dents.push({ local, depth: Math.min(0.22, 0.03 * sev), radius: 0.35 + 0.05 * sev });
      // 角に強く当たるとタイヤが外れる
      if (sev > 6.5) {
        let best = null, bd = 1e9;
        for (const wo of car.wheels) {
          if (!wo.attached) continue;
          const d = Math.hypot(wo.local.x - local.x, wo.local.z - local.z);
          if (d < bd) { bd = d; best = wo; }
        }
        if (best && bd < 1.3) this.detachWheel(best, out);
      }
      // 前後の端に当たるとバンパーが傷む
      for (const bo of car.bumpers) {
        if (!bo.attached) continue;
        if ((bo.front && local.z > car.def.length / 2 - 0.6) || (!bo.front && local.z < -car.def.length / 2 + 0.6)) {
          bo.hits += sev;
          if (bo.hits > 7) this.detachBumper(bo, out);
        }
      }
    } else if (p.kind === 'bumper') {
      p.bumper.hits += sev * 1.3;
      if (p.bumper.hits > 7) this.detachBumper(p.bumper, out);
    } else if (p.kind === 'wheel') {
      if (dv > 9) this.detachWheel(p.wheel, out);
    }
  }

  applyControls(car, input) {
    const def = car.def;
    const thr = Math.max(-1, Math.min(1, input.throttle || 0));
    const brake = Math.max(0, Math.min(1, input.brake || 0));
    const steerTarget = Math.max(-1, Math.min(1, input.steer || 0)) * 0.55;
    // ハンドルはゆっくり切る
    car.steer += Math.max(-0.05, Math.min(0.05, steerTarget - car.steer));
    for (const wo of car.wheels) {
      if (wo.steerJoint) wo.steerJoint.configureMotorPosition(car.steer * STEER_SIGN, 60000, 4000);
    }
    const driven = car.wheels.filter((w) => w.driven && w.attached);
    // 駆動輪の回転の速さ
    let omegaSum = 0;
    const axles = [];
    for (const wo of car.wheels) {
      const q = wo.hub.rotation();
      const ax = qrot(q, { x: 1, y: 0, z: 0 });
      const av = wo.body.angvel();
      const om = ax.x * av.x + ax.y * av.y + ax.z * av.z;
      axles.push({ wo, ax, om });
      if (wo.driven && wo.attached) omegaSum += om;
    }
    const omega = driven.length ? omegaSum / driven.length : 0;
    // 空回り（その場でタイヤが回り続ける）とエンジンが熱くなる。熱くなりすぎると煙→炎
    const lv = car.chassis.linvel();
    const fq = car.chassis.rotation();
    const f = qrot(fq, { x: 0, y: 0, z: 1 });
    const vf = lv.x * f.x + lv.y * f.y + lv.z * f.z;
    car.slip = Math.abs(omega * def.wheelR - vf);
    if (car.slip > 4 && Math.abs(vf) < 0.6 && Math.abs(thr) > 0.5) car.heat += Math.abs(thr) * (def.power / 150) * DT;
    else car.heat = Math.max(0, car.heat - DT * 0.8);
    const vmax = 26; // m/s
    let Ttotal = 0;
    if (thr !== 0) {
      const wr = def.wheelR;
      const fromPower = (def.power * 1000) / Math.max(Math.abs(omega) * wr, 1.5) * wr;
      Ttotal = thr * Math.min(def.torque, fromPower);
      if (thr < 0) Ttotal *= 0.5;
      if (Math.abs(omega * wr) > vmax && Math.sign(omega) === Math.sign(thr)) Ttotal = 0;
    }
    const brakeT = brake * def.mass * 4.0;
    for (const { wo, ax, om } of axles) {
      if (!wo.attached) continue;
      // 前に進む向き＝x軸のまわりの「プラス」回転
      let T = 0;
      if (wo.driven && driven.length) T += Ttotal / driven.length;
      if (brake > 0) {
        const I = 0.4 * car.wheelMass * def.wheelR * def.wheelR;
        const stop = Math.abs(om) * I / DT;
        T += -Math.sign(om) * Math.min(brakeT / 4, stop);
      }
      if (T !== 0) {
        const imp = T * DT;
        wo.body.applyTorqueImpulse({ x: ax.x * imp, y: ax.y * imp, z: ax.z * imp }, true);
        wo.hub.applyTorqueImpulse({ x: -ax.x * imp, y: -ax.y * imp, z: -ax.z * imp }, true);
      }
    }
  }

  // いまの状態（判定に使う）
  carState() {
    const car = this.car;
    if (!car) return null;
    const t = car.chassis.translation();
    const q = car.chassis.rotation();
    const up = qrot(q, { x: 0, y: 1, z: 0 });
    const fwd = qrot(q, { x: 0, y: 0, z: 1 });
    const v = car.chassis.linvel();
    // 今いる段
    let block = -1;
    for (const b of this.blocks) {
      if (t.z > b.z0 + 0.3 && t.y > b.top - 0.1 && Math.abs(t.x) < this.tower.width / 2 + 0.3) block = b.index;
    }
    return { pos: { x: t.x, y: t.y, z: t.z }, rot: q, up, fwd, vel: v, speed: Math.hypot(v.x, v.y, v.z), block };
  }
}

// 「見る」モードの自動運転：まっすぐ進む。止まったら少し下がって勢いをつけ直す（2回まで）
export class AutoDriver {
  constructor() { this.reset(); }
  reset() { this.t = 0; this.stuckT = 0; this.mode = 'go'; this.modeT = 0; this.retries = 0; }
  drive(state, def = {}) {
    if (!state) return { throttle: 0, steer: 0, brake: 0 };
    this.t += DT; this.modeT += DT;
    const heading = Math.atan2(state.fwd.x, state.fwd.z);
    let steer = -(state.pos.x * 0.5) - heading * 1.6;
    const fwdSpeed = state.vel.x * state.fwd.x + state.vel.y * state.fwd.y + state.vel.z * state.fwd.z;
    if (this.mode === 'go') {
      if (state.pos.z > -2 && Math.abs(fwdSpeed) < 0.4) this.stuckT += DT; else this.stuckT = Math.max(0, this.stuckT - DT * 2);
      if (this.stuckT > 2.2 && this.retries < 1) { this.mode = 'back'; this.modeT = 0; this.stuckT = 0; this.retries++; this.backFrom = state.pos.z; }
      const vt = state.pos.z < -4 ? (def.approach || 7) : 4.5;
      const throttle = Math.max(0.15, Math.min(1, (vt - fwdSpeed) * 0.6 + 0.3));
      return { throttle, steer: clamp1(steer), brake: 0 };
    }
    if (this.mode === 'back') {
      if (this.modeT > 1.6 || this.backFrom - state.pos.z > 1.0 + this.retries * 0.4) { this.mode = 'charge'; this.modeT = 0; }
      return { throttle: -1, steer: clamp1(-steer), brake: 0 };
    }
    // charge：全開で突っ込む
    if (this.modeT > 3) { this.mode = 'go'; this.modeT = 0; }
    return { throttle: 1, steer: clamp1(steer), brake: 0 };
  }
}
const clamp1 = (v) => Math.max(-1, Math.min(1, v));

// 1台の挑戦の判定をする係
export class Judge {
  constructor(sim) {
    this.sim = sim;
    this.reset();
  }
  reset() {
    this.t = 0;
    this.best = -1;
    this.bestY = 0;
    this.bestZ = -1e9;
    this.lastProgressT = 0;
    this.flipT = 0;
    this.topT = 0;
    this.result = null; // { ok, reason, block }
    this.resultT = 0;
  }
  update(state, car) {
    if (this.result) { this.resultT += DT; return this.result; }
    this.t += DT;
    const tw = this.sim.tower;
    const n = this.sim.blocks.length;
    if (state.block > this.best) { this.best = state.block; }
    if (state.pos.y > this.bestY) this.bestY = state.pos.y;
    if (state.pos.z > this.bestZ + 0.25) { this.bestZ = state.pos.z; this.lastProgressT = this.t; }
    const last = this.sim.blocks[n - 1];
    if (state.block === n - 1 && state.pos.z > last.z0 + 1.2) this.topT += DT; else this.topT = 0;
    if (state.up.y < 0.35) this.flipT += DT; else this.flipT = 0;

    let res = null;
    if (this.topT > 0.6 && state.up.y > 0.6) res = { ok: true, reason: '登頂' };
    else if (car.onFire) res = { ok: false, reason: '炎上' };
    else if (this.best >= 0 && state.pos.y < this.sim.blocks[this.best].top - 0.9) res = { ok: false, reason: '転落' };
    else if (this.flipT > 1.5) res = { ok: false, reason: 'ひっくり返った' };
    else if (this.t - this.lastProgressT > 8) res = { ok: false, reason: '登れない' };
    else if (this.t > tw.timeLimit) res = { ok: false, reason: '時間切れ' };
    if (res) {
      res.block = this.best;
      res.time = this.t;
      this.result = res;
      this.resultT = 0;
    }
    return res;
  }
}
