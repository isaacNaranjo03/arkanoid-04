// Constants
const CANVAS_W = 480;
const CANVAS_H = 640;
const HUD_H = 32;

const PADDLE_W = 96, PADDLE_H = 14, PADDLE_Y = 600, PADDLE_SPEED = 420; // px/s
const BALL_SIZE = 12, BALL_SPEED = 360;                                  // px/s
const MAX_BOUNCE_ANGLE = Math.PI / 3;                                    // 60° from vertical

const BRICK_W = 40, BRICK_H = 20, BRICK_GAP = 4;
const BRICK_COLS = 10;
const BRICK_TOP = 80;   // y of the first row (below the HUD)
const BRICK_LEFT = 22;  // (480 - (10*40 + 9*4)) / 2
const ROWS = [
  { color: 'red',     points: 60 },
  { color: 'yellow',  points: 50 },
  { color: 'cyan',    points: 40 },
  { color: 'magenta', points: 30 },
  { color: 'hotpink', points: 20 },
  { color: 'green',   points: 10 },
];
const START_LIVES = 3;
const MAX_DT = 1 / 30;  // s, caps long frames so the ball can't tunnel

// Mutable state
const state = {
  mode: 'title',    // 'title' | 'serve' | 'playing' | 'paused' | 'gameover' | 'won'
  pausedFrom: null, // 'serve' | 'playing', the mode to return to when unpaused
  score: 0,
  lives: START_LIVES,
  paddle: { x: (CANVAS_W - PADDLE_W) / 2, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H },
  ball: {                                          // x, y = top-left corner
    x: (CANVAS_W - BALL_SIZE) / 2,
    y: PADDLE_Y - BALL_SIZE,
    vx: 0,
    vy: 0,
    size: BALL_SIZE,
  },
  bricks: [],     // { x, y, w, h, color, points, alive: true }
  explosions: [], // { x, y, w, h, color, start: timestampMs }
};

const keys = { left: false, right: false };

const bounceSound = new Audio('assets/assets/sounds/ball-bounce.mp3');
const breakSound = new Audio('assets/assets/sounds/break-sound.mp3');

function playSound(audio) {
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

document.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Space') {
    e.preventDefault();
  }

  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;

  if (e.code === 'Space') {
    if (state.mode === 'title') {
      newGame();
    } else if (state.mode === 'serve') {
      launchBall();
    }
  }

  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state.mode === 'serve' || state.mode === 'playing') {
      state.pausedFrom = state.mode;
      state.mode = 'paused';
    } else if (state.mode === 'paused') {
      state.mode = state.pausedFrom;
      state.pausedFrom = null;
    }
  }

  if (e.code === 'Enter' && (state.mode === 'gameover' || state.mode === 'won')) {
    newGame();
  }
});

document.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
});

function updatePaddle(dt) {
  const p = state.paddle;
  let dir = 0;
  if (keys.left) dir -= 1;
  if (keys.right) dir += 1;
  p.x += dir * PADDLE_SPEED * dt;
  p.x = Math.max(0, Math.min(CANVAS_W - p.w, p.x));
}

function buildBricks() {
  state.bricks = [];
  ROWS.forEach((row, r) => {
    for (let c = 0; c < BRICK_COLS; c++) {
      state.bricks.push({
        x: BRICK_LEFT + c * (BRICK_W + BRICK_GAP),
        y: BRICK_TOP + r * (BRICK_H + BRICK_GAP),
        w: BRICK_W,
        h: BRICK_H,
        color: row.color,
        points: row.points,
        alive: true,
      });
    }
  });
}

function newGame() {
  state.score = 0;
  state.lives = START_LIVES;
  buildBricks();
  state.explosions = [];
  state.paddle.x = (CANVAS_W - PADDLE_W) / 2;
  state.mode = 'serve';
  placeBallOnPaddle();
}

// In serve, the ball rests centered on top of the paddle.
function placeBallOnPaddle() {
  const b = state.ball;
  const p = state.paddle;
  b.x = p.x + (p.w - b.size) / 2;
  b.y = p.y - b.size;
  b.vx = 0;
  b.vy = 0;
}

function launchBall() {
  state.ball.vx = 0;
  state.ball.vy = -BALL_SPEED;
  state.mode = 'playing';
}

function loseLife() {
  state.lives -= 1;
  if (state.lives > 0) {
    state.mode = 'serve';
    placeBallOnPaddle();
  } else {
    state.mode = 'gameover';
  }
}

function updateBall(dt) {
  const b = state.ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  if (b.x < 0) {
    b.x = 0;
    b.vx = Math.abs(b.vx);
    playSound(bounceSound);
  } else if (b.x + b.size > CANVAS_W) {
    b.x = CANVAS_W - b.size;
    b.vx = -Math.abs(b.vx);
    playSound(bounceSound);
  }
  if (b.y < HUD_H) {
    b.y = HUD_H;
    b.vy = Math.abs(b.vy);
    playSound(bounceSound);
  }

  if (hitBrick()) {
    if (!state.bricks.some((brick) => brick.alive)) {
      state.mode = 'won';
      return;
    }
  }

  const p = state.paddle;
  if (b.vy > 0 && overlaps(b.x, b.y, b.size, b.size, p.x, p.y, p.w, p.h)) {
    const ballCenterX = b.x + b.size / 2;
    const paddleCenterX = p.x + p.w / 2;
    const hit = Math.max(-1, Math.min(1, (ballCenterX - paddleCenterX) / (PADDLE_W / 2)));
    const angle = hit * MAX_BOUNCE_ANGLE;
    b.vx = BALL_SPEED * Math.sin(angle);
    b.vy = -BALL_SPEED * Math.cos(angle);
    b.y = p.y - b.size;
    playSound(bounceSound);
  }

  if (b.y > CANVAS_H) {
    loseLife();
  }
}

// Resolves at most one brick per frame. Returns true if a brick was broken.
function hitBrick() {
  const b = state.ball;
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    if (!overlaps(b.x, b.y, b.size, b.size, brick.x, brick.y, brick.w, brick.h)) continue;

    brick.alive = false;
    state.score += brick.points;
    playSound(breakSound);
    state.explosions.push({
      x: brick.x, y: brick.y, w: brick.w, h: brick.h,
      color: brick.color,
      start: performance.now(),
    });

    const overlapX = Math.min(b.x + b.size, brick.x + brick.w) - Math.max(b.x, brick.x);
    const overlapY = Math.min(b.y + b.size, brick.y + brick.h) - Math.max(b.y, brick.y);
    if (overlapX < overlapY) {
      b.vx = -b.vx;
    } else {
      b.vy = -b.vy;
    }
    return true;
  }
  return false;
}

function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function update(dt) {
  if (state.mode === 'serve') {
    updatePaddle(dt);
    placeBallOnPaddle();
  } else if (state.mode === 'playing') {
    updatePaddle(dt);
    updateBall(dt);
  }
}

function drawHud() {
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, CANVAS_W, HUD_H);

  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('Score: ' + state.score, 10, HUD_H / 2);
  ctx.textAlign = 'right';
  ctx.fillText('Lives: ' + state.lives, CANVAS_W - 10, HUD_H / 2);
}

function drawTitle() {
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 48px monospace';
  ctx.fillText('ARKANOID', CANVAS_W / 2, CANVAS_H / 2 - 40);
  ctx.font = '18px monospace';
  ctx.fillText('Press Space to start', CANVAS_W / 2, CANVAS_H / 2 + 20);
}

function drawEndScreen(heading) {
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 40px monospace';
  ctx.fillText(heading, CANVAS_W / 2, CANVAS_H / 2 - 40);
  ctx.font = '20px monospace';
  ctx.fillText('Score: ' + state.score, CANVAS_W / 2, CANVAS_H / 2 + 10);
  ctx.font = '18px monospace';
  ctx.fillText('Press Enter to restart', CANVAS_W / 2, CANVAS_H / 2 + 50);
}

function drawExplosions() {
  const now = performance.now();
  state.explosions = state.explosions.filter((ex) => now - ex.start < EXPLOSION_DURATION);
  for (const ex of state.explosions) {
    const elapsed = now - ex.start;
    const index = Math.floor(elapsed / (EXPLOSION_DURATION / 4));
    drawFrame(ctx, EXPLOSION_FRAMES[ex.color][index], ex.x, ex.y, ex.w, ex.h);
  }
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 40px monospace';
  ctx.fillText('Paused', CANVAS_W / 2, CANVAS_H / 2);
}

function render() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawHud();

  if (state.mode === 'title') {
    drawTitle();
    return;
  }

  for (const brick of state.bricks) {
    if (brick.alive) {
      drawSprite(ctx, 'block_' + brick.color, brick.x, brick.y, brick.w, brick.h);
    }
  }

  drawExplosions();

  const p = state.paddle;
  drawSprite(ctx, 'paddle', p.x, p.y, p.w, p.h);
  const b = state.ball;
  drawSprite(ctx, 'ball', b.x, b.y, b.size, b.size);

  if (state.mode === 'gameover') {
    drawEndScreen('GAME OVER');
  } else if (state.mode === 'won') {
    drawEndScreen('You win!');
  } else if (state.mode === 'paused') {
    drawPauseOverlay();
  }
}

let lastTime = null;

function frame(now) {
  const dt = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, MAX_DT);
  lastTime = now;

  update(dt);
  render();
  requestAnimationFrame(frame);
}

loadSpritesheet(() => {
  requestAnimationFrame(frame);
});
