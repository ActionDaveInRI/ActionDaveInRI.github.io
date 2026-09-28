                                                                              

                          
                                                 
                      
                      
  

const W = 480;
const H = 270;
const CELL = 4;
const COLS = 320;
const ROWS = 68;
const WORLD_W = COLS * CELL;
const GROUND = 59;
const BUILD_X = 130;
const BUILD_W = 96;

const AIR = 0;
const BRICK = 1;
const WOOD = 2;
const STEEL = 3;
const GLASS = 4;

                                  
                                                                                                                                        
                                                                                                                                                                                             
                                                                                                           
                                                                                                               

const palettes = {
  sky: ["#050812", "#081221", "#0e1d31", "#142943"],
  brick: ["#3c2028", "#69302f", "#9b4937", "#d06b45"],
  wood: ["#382a2b", "#76503a", "#b47b49", "#e0a95c"],
  steel: ["#182633", "#35485a", "#6e8292", "#b8c9c8"],
  glass: ["#153c4b", "#1b7480", "#3bc7c4", "#c5fff1"],
  skin: ["#f0ae6f", "#c77457", "#7d3d3f"],
};

const hpFor = (mat        ) => mat === STEEL ? 6 : mat === BRICK ? 3 : mat === WOOD ? 2 : 1;
const idx = (x        , y        ) => y * COLS + x;
const clamp = (n        , a        , b        ) => Math.max(a, Math.min(b, n));

function mulberry32(seed        ) {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hash(x        , y        , seed        ) {
  let h = Math.imul(x ^ seed, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return (h ^ h >>> 16) >>> 0;
}

export function startGame(canvas                   )             {
  const ctx = canvas.getContext("2d", { alpha: false }) ;
  ctx.imageSmoothingEnabled = false;

  let seed = (Date.now() >>> 0) % 99991;
  let random = mulberry32(seed);
  let cells = new Uint8Array(COLS * ROWS);
  let health = new Uint8Array(COLS * ROWS);
  let rooms         = [];
  let people           = [];
  let particles             = [];
  let chunks          = [];
  const keys = new Set           ();
  let started = false;
  let state                             = "playing";
  let time = 0;
  let last = performance.now();
  let raf = 0;
  let shake = 0;
  let hitStop = 0;
  let supportTimer = -1;
  let initialObstacles = 1;
  let truck = { x: 280, speed: 4.2 };
  let player = { x: 470, y: GROUND * CELL - 18, vx: 0, vy: 0, w: 11, h: 18, facing: 1, grounded: true, attack: 0, dash: 0, slam: false, cooldown: 0 };

  const setCell = (x        , y        , mat          ) => {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
    cells[idx(x, y)] = mat;
    health[idx(x, y)] = hpFor(mat);
  };

  function generate() {
    random = mulberry32(seed);
    cells = new Uint8Array(COLS * ROWS);
    health = new Uint8Array(COLS * ROWS);
    rooms = [];
    people = [];
    particles = [];
    chunks = [];
    state = "playing";
    started = false;
    time = 0;
    shake = 0;
    hitStop = 0;
    supportTimer = -1;
    keys.clear();
    last = performance.now();
    truck = { x: 280, speed: 4.2 };
    player = { x: 470, y: GROUND * CELL - 18, vx: 0, vy: 0, w: 11, h: 18, facing: 1, grounded: true, attack: 0, dash: 0, slam: false, cooldown: 0 };

    const floorY = [10, 26, 42, GROUND];
    const bays = [BUILD_X, BUILD_X + 24, BUILD_X + 49, BUILD_X + 73, BUILD_X + BUILD_W];

    for (let x = BUILD_X; x <= BUILD_X + BUILD_W; x++) {
      setCell(x, 10, BRICK);
      setCell(x, 11, BRICK);
      if (x % 7 === 0) setCell(x, 9, BRICK);
    }

    for (const floor of [26, 42]) {
      for (let x = BUILD_X; x <= BUILD_X + BUILD_W; x++) {
        setCell(x, floor, WOOD);
        setCell(x, floor + 1, WOOD);
      }
    }

    for (let y = 10; y < GROUND; y++) {
      setCell(BUILD_X, y, BRICK);
      setCell(BUILD_X + 1, y, BRICK);
      setCell(BUILD_X + BUILD_W - 1, y, BRICK);
      setCell(BUILD_X + BUILD_W, y, BRICK);
    }

    for (const y of [16, 17, 18, 19, 33, 34, 35, 36]) {
      setCell(BUILD_X, y, GLASS);
      setCell(BUILD_X + BUILD_W, y, GLASS);
    }

    for (const column of [BUILD_X + 24, BUILD_X + 49, BUILD_X + 73]) {
      for (let y = 12; y < GROUND; y++) {
        const mat = column === BUILD_X + 49 || (column === BUILD_X + 73 && y > 41) ? STEEL : BRICK;
        setCell(column, y, mat);
        if (mat === BRICK || y > 41) setCell(column + 1, y, mat);
      }
    }

    for (let floor = 0; floor < 3; floor++) {
      for (let bay = 0; bay < 4; bay++) {
        const room       = {
          x: bays[bay] + 2,
          y: floorY[floor] + 2,
          w: bays[bay + 1] - bays[bay] - 3,
          h: floorY[floor + 1] - floorY[floor] - 4,
          type: floor === 2 && bay === 3 ? 4 : Math.floor(random() * 4),
          palette: Math.floor(random() * 4),
          ruined: false,
        };
        rooms.push(room);
        if (random() > .25) {
          const personX = (room.x + 5 + random() * Math.max(4, room.w - 10)) * CELL;
          people.push({
            x: personX,
            y: (room.y + room.h) * CELL - 9,
            homeX: personX,
            room: rooms.length - 1,
            phase: random() * Math.PI * 2,
            panic: 0,
            dir: random() > .5 ? 1 : -1,
          });
        }
      }
    }

    initialObstacles = corridorObstacles();
  }

  function corridorObstacles() {
    let count = 0;
    for (let x = BUILD_X; x <= BUILD_X + BUILD_W; x++) {
      for (let y = GROUND - 8; y < GROUND; y++) if (cells[idx(x, y)] !== AIR) count++;
    }
    return count;
  }

  function solidPixel(x        , y        ) {
    if (y >= GROUND * CELL) return true;
    if (x < 0 || x >= WORLD_W || y < 0) return true;
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    return cells[idx(cx, cy)] !== AIR;
  }

  function playerCollides(x = player.x, y = player.y) {
    const left = x - player.w / 2;
    return solidPixel(left + 1, y + 1) || solidPixel(left + player.w - 1, y + 1) ||
      solidPixel(left + 1, y + player.h - 1) || solidPixel(left + player.w - 1, y + player.h - 1);
  }

  function movePlayer(dx        , dy        ) {
    const sx = Math.ceil(Math.abs(dx));
    for (let i = 0; i < sx; i++) {
      const nx = player.x + Math.sign(dx) * Math.min(1, Math.abs(dx) - i);
      if (playerCollides(nx, player.y)) { player.vx = 0; break; }
      player.x = nx;
    }
    player.grounded = false;
    const sy = Math.ceil(Math.abs(dy));
    for (let i = 0; i < sy; i++) {
      const ny = player.y + Math.sign(dy) * Math.min(1, Math.abs(dy) - i);
      if (playerCollides(player.x, ny)) {
        if (dy > 0) {
          player.grounded = true;
          if (player.slam) {
            damage(player.x, player.y + player.h, 24, 5);
            player.slam = false;
          }
        }
        player.vy = 0;
        break;
      }
      player.y = ny;
    }
  }

  function materialColor(mat        , bright = false) {
    const p = mat === BRICK ? palettes.brick : mat === WOOD ? palettes.wood : mat === STEEL ? palettes.steel : palettes.glass;
    return p[bright ? 3 : 2];
  }

  function burst(x        , y        , mat        , amount        , force        ) {
    for (let i = 0; i < amount; i++) {
      const a = random() * Math.PI * 2;
      const speed = force * (.35 + random() * .8);
      particles.push({
        x, y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - force * .35,
        life: .35 + random() * .7,
        max: 1,
        size: 1 + Math.floor(random() * 3),
        color: materialColor(mat),
        dust: false,
      });
    }
    for (let i = 0; i < Math.max(3, amount / 3); i++) {
      particles.push({ x: x + random() * 12 - 6, y: y + random() * 8 - 4, vx: random() * 20 - 10, vy: -8 - random() * 15, life: .5 + random() * .6, max: 1, size: 4 + random() * 8, color: mat === BRICK ? "#735052" : "#69717a", dust: true });
    }
    if (particles.length > 650) particles.splice(0, particles.length - 650);
  }

  function damage(px        , py        , radius        , power        ) {
    const cx = Math.floor(px / CELL);
    const cy = Math.floor(py / CELL);
    const cr = Math.ceil(radius / CELL);
    let broken = 0;
    let dominant = BRICK;

    for (let y = cy - cr; y <= cy + cr; y++) {
      for (let x = cx - cr; x <= cx + cr; x++) {
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
        const id = idx(x, y);
        const mat = cells[id];
        if (!mat) continue;
        const jag = (hash(x, y, seed) % 7) * .18;
        const dist = Math.abs(x - cx) * .8 + Math.abs(y - cy) + jag;
        if (dist > cr) continue;
        dominant = mat;
        const dealt = mat === STEEL ? Math.max(1, power - 2) : power;
        if (health[id] > dealt) health[id] -= dealt;
        else {
          cells[id] = AIR;
          health[id] = 0;
          broken++;
          if (broken % 2 === 0) burst(x * CELL + 2, y * CELL + 2, mat, 2, 48 + power * 8);
        }
      }
    }

    if (broken > 0) {
      burst(px, py, dominant, Math.min(22, 5 + broken / 2), 60 + power * 8);
      shake = Math.min(10, shake + 2 + broken * .05);
      hitStop = Math.min(.075, .018 + broken * .0008);
      supportTimer = .22;
      for (const person of people) {
        const room = rooms[person.room];
        if (Math.abs(person.x - px) < 150 || room.ruined) person.panic = 1;
      }
    } else {
      burst(px, py, STEEL, 5, 46);
      shake = Math.max(shake, 1.5);
    }
  }

  function checkSupport() {
    const seen = new Uint8Array(COLS * ROWS);
    const queue           = [];
    for (let x = BUILD_X; x <= BUILD_X + BUILD_W; x++) {
      const id = idx(x, GROUND - 1);
      if (cells[id]) { seen[id] = 1; queue.push(id); }
    }
    for (let q = 0; q < queue.length; q++) {
      const id = queue[q];
      const x = id % COLS;
      const y = Math.floor(id / COLS);
      const next = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of next) {
        if (nx < BUILD_X || nx > BUILD_X + BUILD_W || ny < 8 || ny >= GROUND) continue;
        const ni = idx(nx, ny);
        if (!seen[ni] && cells[ni]) { seen[ni] = 1; queue.push(ni); }
      }
    }

    const loose = new Set        ();
    for (let y = 8; y < GROUND; y++) {
      for (let x = BUILD_X; x <= BUILD_X + BUILD_W; x++) {
        const id = idx(x, y);
        if (cells[id] && !seen[id]) loose.add(id);
      }
    }

    while (loose.size) {
      const first = loose.values().next().value          ;
      const group = [first];
      loose.delete(first);
      for (let q = 0; q < group.length; q++) {
        const id = group[q];
        const x = id % COLS;
        const y = Math.floor(id / COLS);
        for (const ni of [idx(x + 1, y), idx(x - 1, y), idx(x, y + 1), idx(x, y - 1)]) {
          if (loose.has(ni)) { loose.delete(ni); group.push(ni); }
        }
      }
      if (group.length < 3) {
        for (const id of group) {
          const x = id % COLS, y = Math.floor(id / COLS), mat = cells[id];
          cells[id] = AIR;
          burst(x * CELL, y * CELL, mat, 2, 35);
        }
        continue;
      }
      const groupMinX = Math.min(...group.map((id) => id % COLS));
      const groupMinY = Math.min(...group.map((id) => Math.floor(id / COLS)));
      const groupMaxX = Math.max(...group.map((id) => id % COLS));
      const groupMaxY = Math.max(...group.map((id) => Math.floor(id / COLS)));
      for (let offset = 0; offset < group.length; offset += 220) {
        const batch = group.slice(offset, offset + 220);
        const minX = Math.min(...batch.map((id) => id % COLS));
        const minY = Math.min(...batch.map((id) => Math.floor(id / COLS)));
        const chunkCells = batch.map((id) => {
          const x = id % COLS, y = Math.floor(id / COLS), mat = cells[id]            ;
          cells[id] = AIR;
          health[id] = 0;
          return { x: (x - minX) * CELL, y: (y - minY) * CELL, mat };
        });
        const bottom = Math.max(...chunkCells.map((cell) => cell.y)) + CELL;
        chunks.push({ x: minX * CELL, y: minY * CELL, vx: random() * 18 - 9, vy: -12 - random() * 12, rot: 0, vr: (random() - .5) * 1.4, bottom, landed: false, life: 4, cells: chunkCells });
      }
      for (const room of rooms) {
        const overlaps = room.x <= groupMaxX && room.x + room.w >= groupMinX && room.y <= groupMaxY && room.y + room.h >= groupMinY;
        if (overlaps) room.ruined = true;
      }
      shake = Math.min(12, shake + group.length * .018);
    }
  }

  function action(key           ) {
    if (state !== "playing") return;
    started = true;
    if (key === "jump" && player.grounded) {
      player.vy = -155;
      player.grounded = false;
    }
    if (key === "smash" && player.cooldown <= 0) {
      player.attack = .2;
      player.cooldown = .28;
      damage(player.x + player.facing * 15, player.y + 9, 14, 3);
    }
    if (key === "dash" && player.cooldown <= 0) {
      player.dash = .22;
      player.cooldown = .34;
      player.vx = player.facing * 185;
      damage(player.x + player.facing * 18, player.y + 10, 17, 4);
    }
    if (key === "slam" && !player.grounded) {
      player.slam = true;
      player.vy = 240;
    }
  }

  function truckCollision() {
    const front = truck.x + 58;
    for (let x = Math.floor((truck.x + 5) / CELL); x <= Math.ceil(front / CELL); x++) {
      for (let y = GROUND - 8; y < GROUND; y++) if (cells[idx(x, y)]) return true;
    }
    return false;
  }

  function update(dt        ) {
    time += dt;
    if (!started) return;
    if (state !== "playing") {
      for (const p of particles) {
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.dust ? -2 : 220) * dt;
      }
      particles = particles.filter((p) => p.life > 0 && p.y < H + 80);
      for (const chunk of chunks) {
        if (!chunk.landed) {
          chunk.vy += 300 * dt; chunk.x += chunk.vx * dt; chunk.y += chunk.vy * dt; chunk.rot += chunk.vr * dt;
        }
        if (!chunk.landed && chunk.y + chunk.bottom > GROUND * CELL) {
          chunk.y = GROUND * CELL - chunk.bottom;
          chunk.vx = 0; chunk.vy = 0; chunk.vr = 0; chunk.landed = true; chunk.life = 1.15;
          burst(chunk.x, GROUND * CELL - 4, BRICK, 8, 38);
        }
        if (chunk.landed) chunk.life -= dt;
      }
      chunks = chunks.filter((chunk) => chunk.life > 0);
      shake = Math.max(0, shake - dt * 16);
      return;
    }
    player.cooldown -= dt;
    player.attack = Math.max(0, player.attack - dt);
    player.dash = Math.max(0, player.dash - dt);

    const axis = (keys.has("right") ? 1 : 0) - (keys.has("left") ? 1 : 0);
    if (axis) player.facing = axis;
    if (player.dash <= 0) {
      const target = axis * 72;
      player.vx += (target - player.vx) * Math.min(1, dt * (player.grounded ? 15 : 7));
    }
    player.vy += 390 * dt;
    player.vy = Math.min(270, player.vy);
    movePlayer(player.vx * dt, player.vy * dt);

    truck.x += truck.speed * dt;
    if (truck.x + 58 >= BUILD_X * CELL && truckCollision()) {
      state = "lost";
      shake = 12;
      burst(truck.x + 58, GROUND * CELL - 14, STEEL, 45, 90);
    } else if (truck.x > (BUILD_X + BUILD_W) * CELL + 34) {
      state = "won";
      shake = 5;
    } else if (truck.x + 58 >= BUILD_X * CELL) {
      truck.speed = Math.max(truck.speed, 48);
    }

    if (supportTimer >= 0) {
      supportTimer -= dt;
      if (supportTimer < 0) checkSupport();
    }

    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.dust ? -2 : 220) * dt;
      p.vx *= Math.pow(p.dust ? .93 : .985, dt * 60);
    }
    particles = particles.filter((p) => p.life > 0 && p.y < H + 80);

    for (const chunk of chunks) {
      if (!chunk.landed) {
        chunk.vy += 300 * dt;
        chunk.x += chunk.vx * dt;
        chunk.y += chunk.vy * dt;
        chunk.rot += chunk.vr * dt;
      }
      if (!chunk.landed && chunk.y + chunk.bottom > GROUND * CELL) {
        chunk.y = GROUND * CELL - chunk.bottom;
        chunk.vx = 0; chunk.vy = 0; chunk.vr = 0; chunk.landed = true; chunk.life = 1.15;
        burst(chunk.x, GROUND * CELL - 4, BRICK, 12, 44);
      }
      if (chunk.landed) chunk.life -= dt;
    }
    chunks = chunks.filter((chunk) => chunk.life > 0);

    for (const person of people) {
      person.phase += dt * (person.panic ? 14 : 2.2);
      if (person.panic) {
        const room = rooms[person.room];
        const center = (room.x + room.w / 2) * CELL;
        person.dir = person.x < center ? -1 : 1;
        person.x += person.dir * 25 * dt;
        if (room.ruined || person.y > GROUND * CELL) {
          person.y = GROUND * CELL - 9;
          person.x += person.dir * 34 * dt;
        }
      } else {
        person.x = person.homeX + Math.sin(person.phase * .35) * 5;
      }
    }
    shake = Math.max(0, shake - dt * 16);
  }

  function drawSky(camera        ) {
    ctx.fillStyle = palettes.sky[0];
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0c1b30";
    for (let i = 0; i < 22; i++) {
      const x = ((hash(i, 2, seed) % 760) - camera * .12 + 760) % 760 - 80;
      const h = 28 + hash(i, 4, seed) % 95;
      const ww = 14 + hash(i, 5, seed) % 35;
      ctx.fillRect(Math.floor(x), GROUND * CELL - h, ww, h);
      ctx.fillStyle = "#17304b";
      for (let wy = GROUND * CELL - h + 8; wy < GROUND * CELL - 5; wy += 9) {
        for (let wx = Math.floor(x) + 5; wx < x + ww - 3; wx += 8) {
          if (hash(wx, wy, seed) % 5 === 0) ctx.fillRect(wx, wy, 2, 3);
        }
      }
      ctx.fillStyle = "#0c1b30";
    }
    ctx.fillStyle = "#1b2a3d";
    for (let x = -((camera * .28) % 48); x < W; x += 48) {
      const h = 26 + (hash(x, 8, seed) % 30);
      ctx.fillRect(Math.floor(x), GROUND * CELL - h, 43, h);
      ctx.fillStyle = "#e6a143";
      for (let wx = x + 7; wx < x + 38; wx += 11) if (hash(wx, h, seed) % 3 === 0) ctx.fillRect(Math.floor(wx), GROUND * CELL - h + 8, 3, 3);
      ctx.fillStyle = "#1b2a3d";
    }
  }

  function drawRoom(room      , index        , camera        ) {
    if (room.ruined) return;
    const x = room.x * CELL - camera;
    const y = room.y * CELL;
    const w = room.w * CELL;
    const h = room.h * CELL;
    const wall = ["#3b2435", "#233c3c", "#413322", "#243245"][room.palette];
    const light = ["#7f4e56", "#416b5e", "#765d36", "#465c72"][room.palette];
    ctx.fillStyle = wall;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = light;
    ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = "#17141a";
    ctx.fillRect(x, y + h - 3, w, 3);
    const blink = Math.sin(time * (1.2 + index * .07) + index) > -.9;
    if (blink) {
      ctx.fillStyle = "#f6c76b";
      ctx.fillRect(x + w / 2 - 1, y + 4, 3, 2);
      ctx.fillStyle = "#b77a3b";
      ctx.fillRect(x + w / 2, y + 6, 1, 4);
    }
    drawProps(room, x, y, w, h);
  }

  function drawProps(room      , x        , y        , w        , h        ) {
    if (room.type === 0) {
      ctx.fillStyle = "#742f3c"; ctx.fillRect(x + 5, y + h - 9, 18, 5);
      ctx.fillStyle = "#d8a870"; ctx.fillRect(x + 6, y + h - 11, 7, 3);
      ctx.fillStyle = "#2b1e24"; ctx.fillRect(x + w - 12, y + h - 14, 8, 11);
      ctx.fillStyle = Math.sin(time * 3 + x) > 0 ? "#55e7d7" : "#c94c72"; ctx.fillRect(x + w - 11, y + h - 13, 6, 6);
    } else if (room.type === 1) {
      ctx.fillStyle = "#45556a"; ctx.fillRect(x + 4, y + h - 14, 10, 11);
      ctx.fillStyle = "#dce8d6"; ctx.fillRect(x + 5, y + h - 12, 8, 8);
      ctx.fillStyle = "#7b4b32"; ctx.fillRect(x + 18, y + h - 7, w - 22, 4);
      ctx.fillStyle = "#eea54e"; ctx.fillRect(x + 22, y + h - 10, 3, 3);
    } else if (room.type === 2) {
      ctx.fillStyle = "#31514d"; ctx.fillRect(x + 5, y + h - 8, 18, 5);
      ctx.fillStyle = "#b28656"; ctx.fillRect(x + w - 13, y + h - 14, 9, 11);
      ctx.fillStyle = "#d6b272"; for (let yy = y + h - 12; yy < y + h - 4; yy += 3) ctx.fillRect(x + w - 11, yy, 5, 1);
    } else if (room.type === 3) {
      ctx.fillStyle = "#68412e"; ctx.fillRect(x + 6, y + h - 7, w - 12, 4);
      ctx.fillStyle = "#a9d0c8"; ctx.fillRect(x + 10, y + h - 13, 8, 6);
      ctx.fillStyle = "#aa4d3b"; ctx.fillRect(x + w - 17, y + h - 11, 6, 4);
    } else {
      ctx.fillStyle = "#385b42"; ctx.fillRect(x, y + h - 14, w, 11);
      ctx.fillStyle = "#d1b279"; ctx.fillRect(x + 8, y + h - 12, w - 16, 3);
      ctx.fillStyle = "#d9503f"; for (let xx = x + 6; xx < x + w; xx += 13) ctx.fillRect(xx, y + 2, 7, 3);
    }
  }

  function drawCell(x        , y        , mat        , camera        , damaged = false) {
    const sx = x * CELL - camera, sy = y * CELL;
    if (sx < -CELL || sx > W) return;
    const p = mat === BRICK ? palettes.brick : mat === WOOD ? palettes.wood : mat === STEEL ? palettes.steel : palettes.glass;
    const v = hash(x, y, seed) % 3;
    ctx.fillStyle = p[1 + (v === 0 ? 0 : 1)];
    ctx.fillRect(Math.floor(sx), sy, CELL, CELL);
    if (mat === BRICK) {
      ctx.fillStyle = p[0]; ctx.fillRect(Math.floor(sx), sy + 3, CELL, 1);
      if ((x + y) % 2) ctx.fillRect(Math.floor(sx), sy, 1, 2);
    } else if (mat === WOOD) {
      ctx.fillStyle = p[3]; ctx.fillRect(Math.floor(sx), sy, CELL, 1);
    } else if (mat === STEEL) {
      ctx.fillStyle = p[3]; ctx.fillRect(Math.floor(sx), sy, 1, CELL);
      ctx.fillStyle = p[0]; ctx.fillRect(Math.floor(sx) + 3, sy, 1, CELL);
    } else {
      ctx.fillStyle = (x + y) % 3 ? p[2] : p[3]; ctx.fillRect(Math.floor(sx) + 1, sy, 1, 3);
    }
    if (damaged) {
      ctx.fillStyle = "#17131a";
      ctx.fillRect(Math.floor(sx) + 1, sy + 1, 1, 2);
      ctx.fillRect(Math.floor(sx) + 2, sy + 2, 1, 1);
    }
  }

  function drawPerson(person        , camera        ) {
    const room = rooms[person.room];
    if (!room || (!person.panic && room.ruined)) return;
    const x = Math.floor(person.x - camera);
    const y = Math.floor(person.y + (Math.sin(person.panic ? person.phase : time * 2.2 + person.phase) > .7 ? -1 : 0));
    if (x < -10 || x > W + 10) return;
    ctx.fillStyle = palettes.skin[(person.room + seed) % palettes.skin.length];
    ctx.fillRect(x - 1, y, 3, 3);
    ctx.fillStyle = ["#e74e4e", "#2de2e6", "#f3b63d", "#8f6dd1"][person.room % 4];
    ctx.fillRect(x - 2, y + 3, 5, 4);
    ctx.fillStyle = "#141824";
    const stride = person.panic ? (Math.sin(person.phase) > 0 ? 2 : -2) : 1;
    ctx.fillRect(x - 1, y + 7, 1, 2);
    ctx.fillRect(x + stride, y + 7, 1, 2);
    if (person.panic) {
      ctx.fillStyle = "#f8e7ba";
      ctx.fillRect(x + person.dir * 3, y + 2, 2, 1);
    }
  }

  function drawBuilding(camera        ) {
    for (let i = 0; i < rooms.length; i++) drawRoom(rooms[i], i, camera);
    for (let y = 8; y < GROUND; y++) {
      for (let x = BUILD_X; x <= BUILD_X + BUILD_W; x++) {
        const id = idx(x, y);
        if (cells[id]) drawCell(x, y, cells[id], camera, health[id] < hpFor(cells[id]));
      }
    }
    for (const person of people) drawPerson(person, camera);

    if (cells[idx(BUILD_X + BUILD_W, 38)]) {
      const signX = (BUILD_X + BUILD_W + 2) * CELL - camera;
      ctx.fillStyle = "#11201d"; ctx.fillRect(signX, 151, 12, 28);
      ctx.fillStyle = Math.sin(time * 5 + seed) > -.75 ? "#7dff68" : "#2c6140";
      ctx.fillRect(signX + 2, 153, 8, 24);
      ctx.fillStyle = "#153b2b";
      ctx.fillRect(signX + 4, 157, 4, 2); ctx.fillRect(signX + 3, 163, 6, 2); ctx.fillRect(signX + 4, 169, 4, 4);
    }

    if (cells[idx(BUILD_X + 65, 10)]) {
      const fanX = (BUILD_X + 65) * CELL - camera;
      ctx.fillStyle = "#243546"; ctx.fillRect(fanX - 7, 30, 15, 10);
      ctx.fillStyle = "#82929b";
      const f = Math.floor(time * 8) % 2;
      ctx.fillRect(fanX + (f ? -5 : -1), 34, f ? 11 : 3, 2);
      ctx.fillRect(fanX - 1, 31 + (f ? 0 : 1), 2, 7);
    }
  }

  function drawTruck(camera        ) {
    const x = Math.floor(truck.x - camera), y = GROUND * CELL - 29;
    ctx.fillStyle = "#101923"; ctx.fillRect(x - 3, y + 22, 65, 5);
    ctx.fillStyle = "#25384a"; ctx.fillRect(x, y + 6, 58, 18);
    ctx.fillStyle = "#465a69"; ctx.fillRect(x + 3, y + 3, 37, 19);
    ctx.fillStyle = "#182532"; ctx.fillRect(x + 7, y + 6, 29, 12);
    ctx.fillStyle = "#607581"; for (let xx = x + 9; xx < x + 35; xx += 6) ctx.fillRect(xx, y + 7, 2, 10);
    ctx.fillStyle = "#d34a3c"; ctx.fillRect(x + 2, y + 1, 4, 3); ctx.fillRect(x + 47, y + 1, 4, 3);
    if (Math.floor(time * 5) % 2 === 0) { ctx.fillStyle = "#ff5945"; ctx.fillRect(x + 2, y, 4, 2); ctx.fillRect(x + 47, y, 4, 2); }
    ctx.fillStyle = "#080b10";
    for (const wx of [x + 9, x + 29, x + 50]) {
      ctx.fillRect(wx - 4, y + 21, 9, 9); ctx.fillStyle = "#6d7880"; ctx.fillRect(wx - 1, y + 24, 3, 3); ctx.fillStyle = "#080b10";
    }
    ctx.fillStyle = "#f6ae32"; ctx.fillRect(x + 56, y + 10, 4, 4);
  }

  function drawPlayer(camera        ) {
    const x = Math.floor(player.x - camera), y = Math.floor(player.y);
    const bob = player.grounded && Math.abs(player.vx) > 8 ? Math.floor(time * 14) % 2 : 0;
    const lean = player.dash > 0 ? player.facing * 3 : 0;
    ctx.save();
    ctx.translate(x + lean, y + bob);
    ctx.fillStyle = "#111723"; ctx.fillRect(-5, 15, 4, 3); ctx.fillRect(2, 15, 4, 3);
    ctx.fillStyle = "#e6a62d"; ctx.fillRect(-5, 6, 10, 10);
    ctx.fillStyle = "#70502c"; ctx.fillRect(-4, 9, 8, 6);
    ctx.fillStyle = "#253443"; ctx.fillRect(-4, 1, 8, 7);
    ctx.fillStyle = "#71e4dc"; ctx.fillRect(player.facing > 0 ? 1 : -3, 3, 2, 2);
    ctx.fillStyle = "#d9e0d2"; ctx.fillRect(-3, 0, 6, 2);
    const reach = player.attack > 0 ? 7 : 4;
    ctx.fillStyle = "#b9782e"; ctx.fillRect(player.facing > 0 ? 4 : -4 - reach, 7, reach, 4);
    ctx.fillStyle = "#31495b"; ctx.fillRect(player.facing > 0 ? 4 + reach : -8 - reach, 6, 5, 6);
    if (player.dash > 0) { ctx.fillStyle = "#2de2e6"; ctx.fillRect(-player.facing * 10, 9, 6, 2); }
    ctx.restore();
  }

  function drawChunks(camera        ) {
    for (const chunk of chunks) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, chunk.life * 2);
      ctx.translate(Math.floor(chunk.x - camera), Math.floor(chunk.y));
      ctx.rotate(chunk.rot);
      for (const c of chunk.cells) {
        ctx.fillStyle = materialColor(c.mat);
        ctx.fillRect(c.x, c.y, CELL, CELL);
      }
      ctx.restore();
    }
  }

  function drawParticles(camera        ) {
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / Math.min(p.max, .3), 0, p.dust ? .42 : 1);
      ctx.fillStyle = p.color;
      if (p.dust) ctx.fillRect(Math.floor(p.x - camera - p.size / 2), Math.floor(p.y - p.size / 2), Math.ceil(p.size), Math.ceil(p.size * .65));
      else ctx.fillRect(Math.floor(p.x - camera), Math.floor(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawGround(camera        ) {
    const y = GROUND * CELL;
    ctx.fillStyle = "#111722"; ctx.fillRect(0, y, W, H - y);
    ctx.fillStyle = "#354151"; ctx.fillRect(0, y, W, 3);
    ctx.fillStyle = "#1c2531"; for (let x = -((camera * .8) % 32); x < W; x += 32) ctx.fillRect(Math.floor(x), y + 8, 20, 2);
    ctx.fillStyle = "#d5a034"; for (let x = -((camera + 9) % 54); x < W; x += 54) ctx.fillRect(Math.floor(x), y + 16, 25, 2);
  }

  function cameraX() {
    return clamp(Math.floor(player.x - W * .38), 170, WORLD_W - W);
  }

  function drawHud() {
    const left = Math.max(0, BUILD_X * CELL - (truck.x + 58));
    const eta = left / truck.speed;
    const progress = Math.round((1 - corridorObstacles() / initialObstacles) * 100);
    ctx.fillStyle = "#060912cc"; ctx.fillRect(6, 6, 150, 29); ctx.fillRect(W - 125, 6, 119, 29);
    ctx.fillStyle = "#f8e7ba"; ctx.font = "bold 8px monospace"; ctx.textBaseline = "top";
    ctx.fillText("CLEAR THE TRANSPORT LANE", 11, 11);
    ctx.fillStyle = progress >= 95 ? "#7dff68" : "#ffb52e"; ctx.fillText(`CLEARANCE ${String(clamp(progress, 0, 100)).padStart(3, "0")}%`, 11, 22);
    ctx.fillStyle = "#ff665c"; ctx.fillText(left > 0 ? `IMPACT  ${eta.toFixed(1)}s` : "CONTACT", W - 118, 11);
    ctx.fillStyle = "#758aa2"; ctx.fillText(`BLOCK   #${seed.toString().padStart(5, "0")}`, W - 118, 22);

    const laneX = BUILD_X * CELL - cameraX();
    ctx.strokeStyle = progress >= 95 ? "#7dff6899" : "#ffb52e88";
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(Math.floor(laneX), (GROUND - 8) * CELL, BUILD_W * CELL, 8 * CELL);
    ctx.setLineDash([]);
  }

  function drawOverlay() {
    if (!started && state === "playing") {
      ctx.fillStyle = "#03060dcc"; ctx.fillRect(111, 88, 258, 74);
      ctx.strokeStyle = "#2de2e6"; ctx.strokeRect(113, 90, 254, 70);
      ctx.fillStyle = "#f8e7ba"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center"; ctx.fillText("BREACH RUN", W / 2, 103);
      ctx.fillStyle = "#9bb0bd"; ctx.font = "8px monospace"; ctx.fillText("SMASH A TRUCK-SIZED ROUTE THROUGH THE BLOCK", W / 2, 124);
      ctx.fillStyle = "#ffb52e"; ctx.fillText("PRESS A CONTROL TO BEGIN", W / 2, 143);
      ctx.textAlign = "left";
    }
    if (state !== "playing") {
      ctx.fillStyle = "#03060ddd"; ctx.fillRect(119, 88, 242, 78);
      ctx.strokeStyle = state === "won" ? "#7dff68" : "#ff4e50"; ctx.strokeRect(121, 90, 238, 74);
      ctx.fillStyle = state === "won" ? "#7dff68" : "#ff665c"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center";
      ctx.fillText(state === "won" ? "ROUTE CLEARED" : "ROUTE BLOCKED", W / 2, 105);
      ctx.fillStyle = "#e8dbc0"; ctx.font = "8px monospace"; ctx.fillText(state === "won" ? "THE TRANSPORT IS THROUGH" : "THE TRANSPORT COULD NOT STOP", W / 2, 127);
      ctx.fillStyle = "#ffb52e"; ctx.fillText("PRESS R TO RUN IT AGAIN", W / 2, 146);
      ctx.textAlign = "left";
    }
  }

  function render() {
    const camera = cameraX();
    const ox = shake > 0 ? Math.floor((random() - .5) * shake) : 0;
    const oy = shake > 0 ? Math.floor((random() - .5) * shake * .55) : 0;
    ctx.save();
    ctx.translate(ox, oy);
    drawSky(camera);
    drawGround(camera);
    drawBuilding(camera);
    drawChunks(camera);
    drawTruck(camera);
    drawPlayer(camera);
    drawParticles(camera);
    ctx.restore();
    drawHud();
    drawOverlay();
  }

  function frame(now        ) {
    let dt = Math.min(.033, (now - last) / 1000);
    last = now;
    if (hitStop > 0) { hitStop -= dt; dt = 0; }
    update(dt);
    render();
    raf = requestAnimationFrame(frame);
  }

  function onKey(event               , down         ) {
    const map                                        = {
      ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
      Space: "jump", KeyW: "jump", ArrowUp: "jump", KeyJ: "smash", KeyZ: "smash",
      KeyK: "dash", KeyX: "dash", KeyS: "slam", ArrowDown: "slam",
    };
    if (event.code === "KeyR" && down) { generate(); return; }
    if (event.code === "KeyN" && down) { seed = (seed + 7919) % 99991; generate(); return; }
    const key = map[event.code];
    if (!key) return;
    event.preventDefault();
    if (down && !keys.has(key)) action(key);
    if (down) keys.add(key); else keys.delete(key);
  }

  const down = (event               ) => onKey(event, true);
  const up = (event               ) => onKey(event, false);
  const releaseInputs = () => keys.clear();
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", releaseInputs);
  generate();
  raf = requestAnimationFrame(frame);

  return {
    input(key, isDown) {
      if (isDown && !keys.has(key)) action(key);
      if (isDown) keys.add(key); else keys.delete(key);
    },
    newSeed() { seed = (seed + 7919) % 99991; generate(); },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", releaseInputs);
    },
  };
}
