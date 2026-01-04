// Запилювачі з пам'яттю, енергією та вибором цілей у полі квітів

class Pollinator {
  constructor(type) {
    this.setType(type || "Bee");
    this.pos = createVector(random(80, 200), random(80, 300));
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.maxSpeed = 2.6;
    this.size = 14;
    this.energy = 1.0; // 0..1
    this.state = "search"; // search -> approach -> probe -> depart
    this.target = null; // p5.Vector
    this.targetFlower = null; // Flower
    this.pollenLoad = 0;
    this.memory = new Map(); // flowerId -> affinityBoost (0..1)
  }

  setType(type) {
    this.type = type;
    switch (type) {
      case "Butterfly":
        this.proboscisLength = 0.65;
        this.colorPref = [20, 60, 120, 300];
        this.uvAffinity = 0.4;
        this.scentSensitivity = 0.6;
        this.hoverSkill = 0.4;
        this.turbulenceTolerance = 0.4;
        break;
      case "Bee":
        this.proboscisLength = 0.35;
        this.colorPref = [60, 90, 120];
        this.uvAffinity = 0.8;
        this.scentSensitivity = 0.7;
        this.hoverSkill = 0.2;
        this.turbulenceTolerance = 0.6;
        break;
      case "Hummingbird":
        this.proboscisLength = 0.85;
        this.colorPref = [0, 10, 350];
        this.uvAffinity = 0.2;
        this.scentSensitivity = 0.3;
        this.hoverSkill = 0.9;
        this.turbulenceTolerance = 0.7;
        break;
      case "HawkMoth":
        this.proboscisLength = 0.95;
        this.colorPref = [280, 320];
        this.uvAffinity = 0.6;
        this.scentSensitivity = 0.9;
        this.hoverSkill = 0.8;
        this.turbulenceTolerance = 0.8;
        break;
      default:
        this.proboscisLength = 0.5;
        this.colorPref = [60, 120, 240];
        this.uvAffinity = 0.5;
        this.scentSensitivity = 0.5;
        this.hoverSkill = 0.5;
        this.turbulenceTolerance = 0.5;
    }
  }

  preferHue(h) {
    let minDist = 180;
    for (const pref of this.colorPref) {
      const d = Math.min(Math.abs(h - pref), 360 - Math.abs(h - pref));
      if (d < minDist) minDist = d;
    }
    return 1.0 - (minDist / 180);
  }

  pickTarget(flowers, env) {
    let best = null;
    let bestScore = -1;
    for (const f of flowers) {
      const baseAttr = f.attractivenessFor(this, env.timeOfDay);
      const memBoost = this.memory.get(f.id) || 0;
      const nectarFactor = f.nectar > 0 ? 1.0 : 0.5;
      const distance = p5.Vector.dist(this.pos, f.center);
      const distancePenalty = map(distance, 0, width, 1.0, 0.3);
      const score = baseAttr * nectarFactor * distancePenalty + memBoost * 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
    if (best) {
      this.target = best.uvGuidePoint().copy();
      this.targetFlower = best;
    }
  }

  update(wind) {
    // витрати енергії за швидкість та маневрування
    const speedCost = this.vel.mag() * 0.0008;
    const hoverCost = this.state === "probe" ? 0.0015 * (1.0 - this.hoverSkill) : 0.0004;
    this.energy = max(0, this.energy - speedCost - hoverCost);

    const energyFactor = 0.6 + 0.4 * this.energy;

    if (this.target) {
      const desired = p5.Vector.sub(this.target, this.pos);
      desired.setMag(this.maxSpeed * energyFactor);
      const steer = p5.Vector.sub(desired, this.vel);
      steer.limit(0.12 + 0.25 * this.hoverSkill);
      this.acc.add(steer);
    }

    if (wind) {
      this.acc.add(wind.getGust(this.turbulenceTolerance));
    }

    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);
  }

  rememberFlower(flowerId, success) {
    const prev = this.memory.get(flowerId) || 0;
    const delta = success ? 0.2 : 0.05;
    const newVal = constrain(prev + delta, 0, 1);
    this.memory.set(flowerId, newVal);
  }

  refuel(amount) {
    this.energy = constrain(this.energy + amount, 0, 1);
  }

  draw() {
    push();
    translate(this.pos.x, this.pos.y);
    noStroke();

    // тінь
    fill(0, 0, 0, 40);
    ellipse(4, 6, this.size * 0.9, this.size * 0.5);

    if (this.type === "Hummingbird") {
      fill(220, 80, 60);
      ellipse(0, 0, this.size * 1.3, this.size * 0.8);
      fill(50, 20, 10);
      rect(this.size * 0.6, -2, this.size * 1.1, 4, 2);
      fill(180, 40, 40);
      triangle(-this.size * 0.4, -8, -this.size, 0, -this.size * 0.4, 8);
    } else if (this.type === "HawkMoth") {
      fill(150, 120, 150);
      ellipse(0, 0, this.size * 1.2, this.size * 0.9);
      fill(120, 90, 120);
      triangle(-this.size * 0.2, -8, -this.size * 1.1, 0, -this.size * 0.2, 8);
      stroke(100);
      line(this.size * 0.6, 0, this.size * 1.2, 0);
    } else if (this.type === "Butterfly") {
      fill(240, 150, 60);
      ellipse(0, 0, this.size * 0.6, this.size * 0.9);
      fill(250, 190, 90);
      ellipse(-8, -3, 16, 12);
      ellipse(-8, 3, 16, 12);
    } else {
      fill(240, 210, 30);
      ellipse(0, 0, this.size, this.size * 0.8);
      stroke(40);
      line(-6, -2, 6, -2);
      line(-6, 2, 6, 2);
    }

    // легке світіння крил
    noStroke();
    fill(255, 255, 255, 30);
    ellipse(-8, 0, this.size * 0.6, this.size * 0.4);

    pop();
  }
}
