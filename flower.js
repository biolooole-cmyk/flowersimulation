// Квітка: фенотип, нектар, успіх запилення, еволюція
// Додає світіння пелюсток та емісію частинок пилку для візуального пояснення

let FLOWER_ID_SEQ = 1;

class Flower {
  constructor(cx, cy, params = {}) {
    this.id = FLOWER_ID_SEQ++;
    this.center = createVector(cx, cy);

    // Параметри фенотипу
    this.spurLength = params.spurLength ?? 0.5; // 0..1
    this.hue = params.hue ?? 20; // 0..360
    this.uvIndex = params.uvIndex ?? 0.5; // 0..1
    this.scentIntensity = params.scentIntensity ?? 0.5; // 0..1
    this.petalCount = params.petalCount ?? 6;

    // Фітнес та стани
    this.seedCount = 0;
    this.pollen = params.pollen ?? 0.5;
    this.successes = 0; // кількість успішних контактів
    this.visits = 0;

    // Нектар
    this.nectarCapacity = params.nectarCapacity ?? 1.0; // 0..1
    this.nectar = this.nectarCapacity * 0.8; // стартовий запас
    this.regenRate = params.regenRate ?? 0.002; // регенерація за кадр

    this.noiseSeed = random(10000);
  }

  nectarReach() { return 0.4 + 0.6 * this.spurLength; }

  uvGuidePoint() {
    const r = 18 + 32 * this.uvIndex;
    return p5.Vector.add(this.center, createVector(0, -r));
  }

  attractivenessFor(pollinator, timeOfDay = 0.5) {
    const colorScore = pollinator.preferHue(this.hue);
    const uvScore = this.uvIndex * pollinator.uvAffinity;
    const scentScore = this.scentIntensity * pollinator.scentSensitivity;

    const isNight = timeOfDay < 0.5;
    const wColorBase = 0.45;
    const wScentBase = 0.30;
    const wUV = 0.25;

    const wColor = isNight ? wColorBase * 0.7 : wColorBase * 1.1;
    const wScent = isNight ? wScentBase * 1.4 : wScentBase * 0.9;

    return constrain(wColor * colorScore + wUV * uvScore + wScent * scentScore, 0, 1);
  }

  regenNectar() { this.nectar = constrain(this.nectar + this.regenRate, 0, this.nectarCapacity); }

  provideNectar(maxAmount = 0.2) {
    const take = min(this.nectar, maxAmount);
    this.nectar -= take;
    return take;
  }

  emitParticles(intensity = 1.0) {
    const count = floor(3 * intensity);
    for (let i = 0; i < count; i++) {
      const angle = random(TWO_PI);
      const radius = random(10, 22);
      const pos = p5.Vector.add(this.center, createVector(cos(angle) * radius, sin(angle) * radius));
      const vel = createVector(random(-0.3, 0.3), random(-0.6, -0.1));
      const life = random(40, 90);
      if (window.sim && sim.particles) {
        sim.particles.push(new PollenParticle(pos, vel, life, color(255, 220, 80)));
      }
    }
  }

  draw() {
    this.regenNectar();

    push();
    colorMode(HSL, 360, 100, 100, 1);
    translate(this.center.x, this.center.y);

    // свічення навколо квітки (glow)
    const glowRadius = 70 + 20 * this.uvIndex;
    noStroke();
    for (let i = 0; i < 6; i++) {
      const alpha = 0.08 - i * 0.01;
      fill((this.hue + 40) % 360, 70, 60, alpha);
      ellipse(0, 0, glowRadius + i * 12, glowRadius + i * 12);
    }

    // Чашолистки
    for (let i = 0; i < this.petalCount; i++) {
      const a = (TWO_PI * i) / this.petalCount;
      const r = 36 + 12 * noise(this.noiseSeed + i * 0.3);
      push();
      rotate(a);
      fill((this.hue + 200) % 360, 40, 24, 0.9);
      noStroke();
      beginShape();
      for (let t = 0; t <= 1; t += 0.1) {
        const x = lerp(6, r, t);
        const y = sin(t * PI) * 8;
        vertex(x, y);
      }
      endShape(CLOSE);
      pop();
    }

    // Пелюстки
    for (let i = 0; i < this.petalCount; i++) {
      const a = (TWO_PI * i) / this.petalCount;
      const r = 40 + 18 * noise(this.noiseSeed + i * 1.1);
      push();
      rotate(a);
      const petalHue = this.hue;
      const petalSat = 60 + 20 * sin(frameCount * 0.01 + i);
      const petalLight = 60;
      fill(petalHue, petalSat, petalLight, 0.82);
      noStroke();
      beginShape();
      for (let t = 0; t <= 1; t += 0.08) {
        const x = lerp(12, r, t);
        const wobble = 12 + 8 * noise(i + t * 3);
        const y = sin(t * PI) * wobble;
        vertex(x, y);
      }
      endShape(CLOSE);
      pop();
    }

    // Тичинки
    for (let i = 0; i < 18; i++) {
      const a = (TWO_PI * i) / 18 + 0.05 * sin(frameCount * 0.02 + i);
      const r = 16 + 4 * sin(i + frameCount * 0.03);
      push();
      rotate(a);
      stroke(50, 50, 20, 0.8);
      strokeWeight(2);
      line(8, 0, r, 0);
      noStroke();
      fill(50, 100, 40, 0.9);
      ellipse(r, 0, 4 + 3 * this.pollen, 4 + 3 * this.pollen);
      pop();
    }

    // Маточка
    fill(100, 50, 30, 0.9);
    ellipse(0, 0, 12, 12);

    // UV маркер
    const uv = this.uvIndex;
    const uvRad = 18 + 32 * uv;
    noFill();
    stroke((this.hue + 260) % 360, 80, 70, 0.6 * uv);
    strokeWeight(3);
    ellipse(0, -uvRad, 10 + uv * 6);

    // Шпорець
    const spur = 30 + 80 * this.spurLength;
    stroke((this.hue + 40) % 360, 60, 30, 0.9);
    strokeWeight(4);
    line(0, 4, 0, 4 + spur);

    pop();
    colorMode(RGB, 255);
  }

  tryPollination(pollinator, wind, timeOfDay = 0.5) {
    this.visits++;

    const needReach = this.nectarReach();
    const reach = pollinator.proboscisLength * (0.9 + 0.2 * pollinator.hoverSkill);
    const reachOK = reach >= needReach;

    const windPenalty = wind ? wind.contactPenalty(pollinator.turbulenceTolerance) : 0;
    const attract = this.attractivenessFor(pollinator, timeOfDay);
    const pollenFactor = this.pollen;
    const nectarFactor = this.nectar > 0 ? 1.0 : 0.6;

    const baseContact = 0.25 + 0.6 * attract;
    const contactProb = constrain(
      baseContact * nectarFactor * (1 - windPenalty) * (0.6 + 0.6 * pollenFactor),
      0, 1
    );

    const success = reachOK && random() < contactProb;
    if (success) {
      this.seedCount += floor(1 + 4 * attract);
      this.pollen = max(0, this.pollen - 0.2);
      pollinator.pollenLoad += 0.3;

      const nectarGain = this.provideNectar(0.25);
      pollinator.refuel(nectarGain);
      this.successes++;

      this.emitParticles(2.0);
      if (window.sim) sim.explainEvent('success', this, pollinator, { reachOK, contactProb, windPenalty });
    } else {
      this.pollen = max(0, this.pollen - 0.05 * (0.5 + windPenalty));
      const nectarGain = this.provideNectar(0.08);
      pollinator.refuel(nectarGain * 0.6);
      this.emitParticles(0.8);
      if (window.sim) sim.explainEvent('fail', this, pollinator, { reachOK, contactProb, windPenalty });
    }

    pollinator.rememberFlower(this.id, success);
    return { success, reachOK, contactProb, windPenalty };
  }

  mutate(scale = 0.15) {
    const j = (v, s = scale) => v + random(-s, s);
    this.spurLength = constrain(j(this.spurLength), 0, 1);
    this.hue = (this.hue + random(-30, 30) + 360) % 360;
    this.uvIndex = constrain(j(this.uvIndex), 0, 1);
    this.scentIntensity = constrain(j(this.scentIntensity), 0, 1);
    this.petalCount = constrain(round(this.petalCount + random([-1, 0, 1])), 3, 12);
    this.nectarCapacity = constrain(j(this.nectarCapacity, 0.1), 0.3, 1.2);
    this.regenRate = constrain(j(this.regenRate, 0.001), 0.0005, 0.01);
    this.noiseSeed = random(10000);

    this.seedCount = 0;
    this.successes = 0;
    this.visits = 0;
    this.pollen = 0.5;
    this.nectar = this.nectarCapacity * 0.8;
  }

  static crossover(a, b) {
    const mix = (x, y, w = 0.5) => x * w + y * (1 - w);
    const child = new Flower(a.center.x, a.center.y, {
      spurLength: constrain(mix(a.spurLength, b.spurLength, random(0.3, 0.7)) + random(-0.05, 0.05), 0, 1),
      hue: (a.hue + b.hue) / 2 + random(-20, 20),
      uvIndex: constrain(mix(a.uvIndex, b.uvIndex, random(0.3, 0.7)) + random(-0.05, 0.05), 0, 1),
      scentIntensity: constrain(mix(a.scentIntensity, b.scentIntensity, random(0.3, 0.7)) + random(-0.05, 0.05), 0, 1),
      petalCount: constrain(round(mix(a.petalCount, b.petalCount, 0.5) + random([-1, 0, 1])), 3, 12),
      nectarCapacity: constrain(mix(a.nectarCapacity, b.nectarCapacity, random(0.3, 0.7)) + random(-0.05, 0.05), 0.3, 1.2),
      regenRate: constrain(mix(a.regenRate, b.regenRate, random(0.3, 0.7)) + random(-0.0005, 0.0005), 0.0005, 0.01),
      pollen: 0.5,
    });
    return child;
  }
}
