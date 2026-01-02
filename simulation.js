// Головна сцена: поле квітів, вітер, доба, еволюція поколінь, пам’ять запилювача, автоселекція
// Додано: сучасний HUD, розміщення canvas у .canvas-wrap, створення UI в .control-panel,
// та система частинок пилку з м'яким світінням.

let sim;

class PollenParticle {
  constructor(pos, vel, life, col) {
    this.pos = pos.copy();
    this.vel = vel.copy();
    this.life = life; // кадри
    this.color = col || color(255, 220, 120);
    this.size = random(2, 4);
  }
  update(wind) {
    if (wind) {
      const gust = wind.getGust(0.7);
      this.vel.add(createVector(gust.x * 0.02, gust.y * 0.02));
    }
    this.pos.add(this.vel);
    this.vel.mult(0.98);
    this.life -= 1;
  }
  draw() {
    push();
    noStroke();
    const alpha = map(this.life, 0, 90, 0, 180);
    fill(red(this.color), green(this.color), blue(this.color), alpha);
    ellipse(this.pos.x, this.pos.y, this.size, this.size);
    // легке світіння
    fill(red(this.color), green(this.color), blue(this.color), alpha * 0.3);
    ellipse(this.pos.x, this.pos.y, this.size * 2.2, this.size * 2.2);
    pop();
  }
  isDead() { return this.life <= 0; }
}

class Wind {
  constructor() {
    this.baseDir = createVector(0.3, -0.1);
    this.strength = 0.2; // 0..1
    this.noiseSeed = random(10000);
  }
  setStrength(v) { this.strength = constrain(v, 0, 1); }
  setDirection(angleDeg) {
    const a = radians(angleDeg);
    this.baseDir = createVector(cos(a), sin(a));
  }
  getGust(tolerance = 0.5) {
    const n = noise(this.noiseSeed + frameCount * 0.01);
    const mag = this.strength * (0.6 + 0.4 * n) * (1 - 0.5 * tolerance);
    const angle = n * TWO_PI;
    const gust = p5.Vector.fromAngle(angle).mult(mag * 0.2);
    const steady = this.baseDir.copy().mult(this.strength * 0.03);
    return gust.add(steady);
  }
  contactPenalty(tolerance = 0.5) {
    return constrain(this.strength * (0.6 - 0.4 * tolerance), 0, 0.7);
  }
  draw() {
    push();
    stroke(150, 180, 255, 80);
    strokeWeight(2);
    for (let i = 0; i < 6; i++) {
      const x = 40 + i * 80;
      const y = height - 40;
      const v = this.getGust(1.0);
      bezier(
        x, y,
        x + v.x * 20, y + v.y * 20,
        x + v.x * 40, y + v.y * 40,
        x + v.x * 80, y + v.y * 80
      );
    }
    pop();
  }
}

class Simulation {
  constructor() {
    const wrap = document.querySelector('.canvas-wrap');
    this.canvas = createCanvas(1000, 650);
    this.canvas.parent(wrap);

    angleMode(RADIANS);
    colorMode(RGB, 255);

    this.wind = new Wind();
    this.flowers = [];
    this.populationSize = 12;
    this.layoutField();

    this.pollinator = new Pollinator("Bee");

    this.phase = "idle";
    this.resultMsg = "";

    // Доба: 0..1 (0 — ніч, 1 — день)
    this.timeOfDay = 0.7;
    this.timeSpeed = 0.0008; // швидкість добового циклу
    this.autoselectionOn = false;
    this.generation = 1;

    // Система частинок
    this.particles = [];

    this.buildUI();
    window.sim = this; // для доступу з Flower.emitParticles
  }

  layoutField() {
    this.flowers = [];
    const cols = ceil(Math.sqrt(this.populationSize));
    const rows = ceil(this.populationSize / cols);
    const padX = 80, padY = 80;
    const gridW = width - 2 * padX;
    const gridH = height - 2 * padY - 120;
    const stepX = gridW / (cols + 1);
    const stepY = gridH / (rows + 1);

    let idx = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (idx >= this.populationSize) break;
        const x = padX + (c + 1) * stepX + random(-20, 20);
        const y = padY + (r + 1) * stepY + random(-20, 20);
        const params = {
          spurLength: random(0.2, 0.9),
          hue: random(0, 360),
          uvIndex: random(0.2, 0.9),
          scentIntensity: random(0.2, 0.9),
          petalCount: floor(random(5, 9)),
          nectarCapacity: random(0.5, 1.1),
          regenRate: random(0.001, 0.006),
          pollen: random(0.3, 0.7),
        };
        this.flowers.push(new Flower(x, y, params));
        idx++;
      }
    }
  }

  buildUI() {
    const panel = document.querySelector('.control-panel');

    const group = (title) => {
      const g = document.createElement('div');
      const t = document.createElement('div');
      t.className = 'group-title';
      t.textContent = title;
      g.appendChild(t);
      panel.appendChild(g);
      return g;
    };
    const slider = (parent, labelText, min, max, val, step = 1) => {
      const wrap = document.createElement('div');
      wrap.className = 'slider-wrap';
      const lab = document.createElement('label');
      lab.textContent = labelText;
      const input = createSlider(min, max, val, step);
      input.parent(wrap);
      parent.appendChild(wrap);
      wrap.appendChild(lab);
      return input;
    };
    const select = (parent, labelText, options) => {
      const wrap = document.createElement('div');
      wrap.className = 'slider-wrap';
      const lab = document.createElement('label');
      lab.textContent = labelText;
      const sel = createSelect();
      sel.parent(wrap);
      for (const [text, value] of options) sel.option(text, value);
      parent.appendChild(wrap);
      wrap.appendChild(lab);
      return sel;
    };
    const buttons = (parent, defs) => {
      const cont = document.createElement('div');
      cont.style.display = 'grid';
      cont.style.gridTemplateColumns = '1fr 1fr';
      cont.style.gap = '8px';
      parent.appendChild(cont);
      const created = [];
      for (const d of defs) {
        const btn = createButton(d.text);
        btn.parent(cont);
        if (d.className) btn.addClass(d.className);
        created.push(btn);
      }
      return created;
    };

    // Групи
    const gEnv = group('Середовище');
    this.windSlider = slider(gEnv, 'Сила вітру', 0, 100, 20);
    this.windDirSlider = slider(gEnv, 'Напрямок вітру (градуси)', 0, 360, 330);
    this.timeSlider = slider(gEnv, 'Час доби (0=ніч, 100=день)', 0, 100, 70);
    this.speedSlider = slider(gEnv, 'Швидкість добового циклу', 0, 100, 8);

    const gPop = group('Популяція та запилювач');
    this.pollinatorSelect = select(gPop, 'Вид запилювача', [
      ['Bee', 'Bee'], ['Butterfly', 'Butterfly'], ['Hummingbird', 'Hummingbird'], ['HawkMoth', 'HawkMoth']
    ]);
    this.popSlider = slider(gPop, 'Розмір популяції квітів', 4, 25, 12);

    const gActions = group('Дії');
    const [btnApproach, btnEpoch, btnToggleAuto, btnReset] = buttons(gActions, [
      { text: 'Запуск підльоту', className: 'success' },
      { text: 'Покоління +1', className: 'secondary' },
      { text: 'Автоселекція: OFF', className: 'secondary' },
      { text: 'Скинути поле', className: 'danger' },
    ]);
    this.btnApproach = btnApproach;
    this.btnEpoch = btnEpoch;
    this.btnToggleAuto = btnToggleAuto;
    this.btnReset = btnReset;

    // Події
    this.pollinatorSelect.changed(() => {
      const type = this.pollinatorSelect.value();
      this.pollinator = new Pollinator(type);
      this.resultMsg = "";
      this.phase = "idle";
    });
    this.popSlider.changed(() => {
      this.populationSize = this.popSlider.value();
      this.layoutField();
      this.resultMsg = "";
      this.phase = "idle";
    });
    this.btnApproach.mousePressed(() => this.startApproach());
    this.btnEpoch.mousePressed(() => this.nextGeneration());
    this.btnToggleAuto.mousePressed(() => {
      this.autoselectionOn = !this.autoselectionOn;
      this.btnToggleAuto.html(`Автоселекція: ${this.autoselectionOn ? "ON" : "OFF"}`);
    });
    this.btnReset.mousePressed(() => {
      this.generation = 1;
      FLOWER_ID_SEQ = 1;
      this.layoutField();
      this.pollinator.memory.clear();
      this.resultMsg = "";
      this.phase = "idle";
    });
  }

  startApproach() {
    this.phase = "approach";
    this.resultMsg = "";

    // Запилювач обирає найкращу квітку у полі
    this.pollinator.pickTarget(this.flowers, { timeOfDay: this.timeOfDay });
    if (this.pollinator.targetFlower) {
      this.pollinator.pos = createVector(random(40, 180), random(60, 300));
      this.pollinator.vel = createVector(0, 0);
      const guide = this.pollinator.targetFlower.uvGuidePoint();
      this.pollinator.target = guide.copy();
    }
    this.pollinator.energy = max(this.pollinator.energy, 0.4); // мінімальна енергія для підльоту
  }

  updateEnvFromUI() {
    this.wind.setStrength(this.windSlider.value() / 100);
    this.wind.setDirection(this.windDirSlider.value());
    this.timeOfDay = this.timeSlider.value() / 100;
    this.timeSpeed = this.speedSlider.value() / 10000;
  }

  drawBackground() {
    const t = this.timeOfDay; // 0..1
    const nightColor = { r: 9, g: 15, b: 19 };
    const dayColor = { r: 120, g: 170, b: 220 };
    for (let y = 0; y < height; y++) {
      const k = y / height;
      const r = lerp(nightColor.r, dayColor.r, t) + 10 * (1 - k);
      const g = lerp(nightColor.g, dayColor.g, t) + 20 * (1 - k);
      const b = lerp(nightColor.b, dayColor.b, t) + 30 * (1 - k);
      stroke(r, g, b);
      line(0, y, width, y);
    }
  }

  drawFieldGrass() {
    noFill();
    const swayBase = 8 * this.wind.strength;
    stroke(40, 90, 60, 100);
    for (let x = 0; x < width; x += 18) {
      const sway = sin(frameCount * 0.02 + x * 0.03) * swayBase;
      bezier(x, height, x, height - 20, x + sway, height - 40, x + sway, height - 60);
    }
  }

  nextGeneration() {
    // Відбір: беремо топ 40% за успіхами (або насіння)
    const fitnessMetric = (f) => f.successes * 2 + f.seedCount;
    const sorted = [...this.flowers].sort((a, b) => fitnessMetric(b) - fitnessMetric(a));
    const eliteCount = max(2, floor(this.flowers.length * 0.4));
    const elites = sorted.slice(0, eliteCount);

    // Створюємо нову популяцію через кросовер еліт і мутації
    const newFlowers = [];
    while (newFlowers.length < this.populationSize) {
      const a = random(elites);
      const b = random(elites);
      const child = Flower.crossover(a, b);
      child.center = this.randomNearbyPosition(child.center); // невелике зміщення
      child.mutate(0.12);
      newFlowers.push(child);
    }
    this.flowers = newFlowers;
    this.generation += 1;

    // Скидаємо пам'ять запилювача частково, щоб уникнути залипання на старих ід
    this.pollinator.memory = new Map();
    this.resultMsg = `Покоління ${this.generation}: еліти=${eliteCount}`;
    this.phase = "idle";
  }

  randomNearbyPosition(base) {
    const x = constrain(base.x + random(-40, 40), 60, width - 60);
    const y = constrain(base.y + random(-40, 40), 60, height - 160);
    return createVector(x, y);
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(this.wind);
      if (p.isDead()) this.particles.splice(i, 1);
    }
  }

  drawParticles() {
    for (const p of this.particles) p.draw();
  }

  drawHUD() {
    push();
    // напівпрозорий блок HUD
    fill(20, 24, 32, 140);
    noStroke();
    rect(10, height - 110, 480, 100, 10);

    fill(235);
    textAlign(LEFT, TOP);
    textSize(13);

    const tf = this.pollinator.targetFlower;
    const attr = tf ? tf.attractivenessFor(this.pollinator, this.timeOfDay) : 0;

    text(
      `Покоління: ${this.generation} | Квітів: ${this.flowers.length} | Автоселекція: ${this.autoselectionOn ? "ON" : "OFF"}`,
      18, height - 100
    );
    text(
      `Час доби: ${nf(this.timeOfDay, 1, 2)} | Вітер: ${nf(this.wind.strength, 1, 2)} dir=${this.windDirSlider.value()}°`,
      18, height - 82
    );
    text(
      `Запилювач: ${this.pollinator.type} | Енергія: ${nf(this.pollinator.energy, 1, 2)} | Пилок: ${nf(this.pollinator.pollenLoad, 1, 2)}`,
      18, height - 64
    );
    if (tf) {
      text(
        `Ціль (id=${tf.id}): привабл.=${nf(attr, 1, 2)} | нектар=${nf(tf.nectar, 1, 2)} | успіхи=${tf.successes} | насіння=${tf.seedCount}`,
        18, height - 46
      );
    }
    if (this.resultMsg) {
      fill(255, 230, 200);
      text(this.resultMsg, 18, height - 28);
    } else {
      fill(200, 240, 255);
      text(`Натисни "Запуск підльоту" або вмикай автоселекцію.`, 18, height - 28);
    }
    pop();
  }

  draw() {
    this.updateEnvFromUI();

    // Добовий цикл
    this.timeOfDay = constrain(this.timeOfDay + this.timeSpeed, 0, 1);
    if (this.timeOfDay >= 1 || this.timeOfDay <= 0) {
      this.timeSpeed *= -1; // реверс день↔ніч
    }

    this.drawBackground();
    this.drawFieldGrass();

    for (const f of this.flowers) f.draw();
    this.wind.draw();

    // Фази
    if (this.phase === "approach" && this.pollinator.targetFlower) {
      const guide = this.pollinator.targetFlower.uvGuidePoint();
      this.pollinator.target = guide.copy();
      const d = p5.Vector.dist(this.pollinator.pos, guide);
      if (d < 22) {
        this.phase = "probe";
      }
    } else if (this.phase === "probe" && this.pollinator.targetFlower) {
      const res = this.pollinator.targetFlower.tryPollination(this.pollinator, this.wind, this.timeOfDay);
      if (res.success) {
        this.resultMsg = `УСПІХ: контакт=${nf(res.contactProb, 1, 2)}, вітер штраф=${nf(res.windPenalty, 1, 2)} (квітка id=${this.pollinator.targetFlower.id})`;
      } else {
        const reason = res.reachOK ? "низький контакт" : "короткий хоботок/дзьоб";
        this.resultMsg = `НЕВДАЧА: ${reason}, контакт=${nf(res.contactProb, 1, 2)}, вітер штраф=${nf(res.windPenalty, 1, 2)} (квітка id=${this.pollinator.targetFlower.id})`;
      }
      this.phase = "result";
    } else if (this.phase === "result") {
      // невелике очікування і повернення до пошуку
      if (frameCount % 120 === 0) {
        this.phase = "idle";
        this.pollinator.target = null;
        this.pollinator.targetFlower = null;
      }
    }

    // Автоселекція: періодично робимо покоління, якщо включено
    if (this.autoselectionOn && frameCount % 1800 === 0) {
      this.nextGeneration();
    }

    // Частинки пилку (оновлення після квітів, щоб знати нові емісії)
    this.updateParticles();
    this.drawParticles();

    // Оновлення запилювача
    if (this.phase !== "idle") {
      this.pollinator.update(this.wind);
    }
    this.pollinator.draw();

    this.drawHUD();
  }
}

function setup() {
  sim = new Simulation();
}

function draw() {
  sim.draw();
}
