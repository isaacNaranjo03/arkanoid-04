# SPEC 01 — Playable Arkanoid MVP

> **Status:** Approved
> **Depends on:** none
> **Date:** 2026-10-19
> **Objective:** Build a single-level, keyboard-controlled Arkanoid clone on a `<canvas>` that can be played start to finish in the browser, with score, lives, sounds, brick explosions and pause.

## Scope

**In:**

- `index.html`, `style.css` and `game.js` at the repo root.
- A 480×640 canvas with a 32px HUD strip at the top showing score (left) and lives (right).
- One level: 6 rows × 10 columns of bricks, one color per row.
- A paddle moved with the keyboard (Arrow keys or A/D).
- A ball that bounces off the walls, the paddle and the bricks.
- The paddle bounce angle depends on where the ball hits the paddle.
- Per-row scoring (60/50/40/30/20/10, top row first).
- 3 lives. Losing the ball costs one life.
- Screens: title, serve (ball resting on the paddle), playing, paused, game over and "You win".
- Sounds: `ball-bounce.mp3` on paddle and wall hits, and `break-sound.mp3` on brick hits.
- A four-frame brick explosion animation using `EXPLOSION_FRAMES` and `EXPLOSION_DURATION`.
- Pause and resume with `P` or `Esc`.
- A one-line change to the image path in `assets/assets/spritesheet.js`, so it loads from a root-level `index.html`.

**Out of scope (for future specs):**

- Mouse or touch controls.
- More than one level, and level progression.
- Power-ups (capsules, laser, multiball, etc.).
- High scores or any persistence (no localStorage).
- Bricks that take more than one hit, and indestructible (gray) bricks.
- Ball speed-up over time.
- Background music, a mute toggle and volume settings.
- Responsive or fullscreen canvas scaling, and mobile support.
- Any tooling: npm, bundlers, frameworks, linters or tests.

## Data model

All state lives in `game.js` as plain globals. There are no modules.

```js
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

// Mutable state
const state = {
  mode: 'title',    // 'title' | 'serve' | 'playing' | 'paused' | 'gameover' | 'won'
  pausedFrom: null, // 'serve' | 'playing', the mode to return to when unpaused
  score: 0,
  lives: START_LIVES,
  paddle: { x, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H },
  ball: { x, y, vx, vy, size: BALL_SIZE },     // x, y = top-left corner
  bricks: [ /* { x, y, w, h, color, points, alive: true } */ ],
  explosions: [ /* { x, y, w, h, color, start: timestampMs } */ ],
};

const keys = { left: false, right: false };
```

Conventions:

- Coordinates: origin top-left of the canvas, in pixels.
- Velocities are in pixels per second. Movement is multiplied by the frame delta `dt` in seconds.
- `dt` is capped at `1/30` s so a background tab doesn't make the ball tunnel through objects.
- Sprites are drawn with `drawSprite(ctx, 'paddle' | 'ball' | 'block_<color>', x, y, w, h)` and scaled to the sizes above.
- Asset paths, relative to `index.html`:
  - `assets/assets/spritesheet-breakout.png`
  - `assets/assets/sounds/ball-bounce.mp3`
  - `assets/assets/sounds/break-sound.mp3`

### Input mapping

| Key | Effect |
| --- | --- |
| `ArrowLeft` / `A` | Move paddle left (in `serve` and `playing`) |
| `ArrowRight` / `D` | Move paddle right (in `serve` and `playing`) |
| `Space` | `title` → `serve`. In `serve`, launch the ball. |
| `P` / `Esc` | Toggle pause from `serve` or `playing` |
| `Enter` | In `gameover` or `won`, start a new game (straight to `serve`) |

`preventDefault()` is called for the arrow keys and Space so the page does not scroll.

### Mode transitions

- `title` → Space → `serve`.
- `serve` → Space → `playing`. The ball launches straight up at `BALL_SPEED`.
- `playing` → ball falls below the canvas → `lives -= 1`, then `serve` if `lives > 0`, otherwise `gameover`.
- `playing` → last brick destroyed → `won`.
- `serve` / `playing` → P/Esc → `paused` → P/Esc → back to `pausedFrom`.
- `gameover` / `won` → Enter → new game in `serve` (score 0, 3 lives, all bricks restored).

In `serve`, the ball follows the paddle, centered on top of it.

## Implementation plan

1. **Page skeleton.** Create `index.html` (a `<canvas id="game" width="480" height="640">`, then `<script>` tags for `assets/assets/spritesheet.js` and then `game.js`). Create `style.css` (dark page background, canvas centered, canvas background black). Create `game.js`, which calls `loadSpritesheet` and, once loaded, draws one test sprite. Change the image path in `assets/assets/spritesheet.js` to `'assets/assets/spritesheet-breakout.png'`. *Manual test:* serve over HTTP, open the page, see the sprite and no console errors.
2. **Loop, state and HUD.** Add the constants and `state` from the data model. Add a `requestAnimationFrame` loop with capped `dt`, split into `update(dt)` and `render()`. Draw the HUD strip (score left, `Lives: N` right) and the title screen text ("ARKANOID" and "Press Space to start"). *Manual test:* the title screen is visible.
3. **Paddle and keyboard.** Add `keydown`/`keyup` listeners filling `keys`. Space on `title` switches to `serve`. Move the paddle with `PADDLE_SPEED * dt`, clamped to the canvas edges. Draw it with `drawSprite`. *Manual test:* after Space, the paddle moves and stops at the walls.
4. **Ball, walls and lives.** In `serve`, the ball sits on the paddle. Space launches it. In `playing`, move the ball and bounce it off the left, right and top walls (the top wall is the bottom edge of the HUD, `y = HUD_H`). A ball below the canvas costs a life and leads to `serve` or `gameover`. Draw the game-over screen (final score and "Press Enter to restart"). Enter resets the game. *Manual test:* the ball bounces off walls, falls through the bottom (the paddle doesn't collide yet), lives drop, game over at 0, and Enter restarts.
5. **Paddle collision.** On AABB overlap with the paddle while `vy > 0`, compute `hit = (ballCenterX - paddleCenterX) / (PADDLE_W / 2)`, clamped to [-1, 1], and set `angle = hit * MAX_BOUNCE_ANGLE`. Then set `vx = BALL_SPEED * sin(angle)`, `vy = -BALL_SPEED * cos(angle)`, and place the ball on top of the paddle. *Manual test:* the ball can be kept alive, and edge hits go out at steeper angles.
6. **Bricks: build and draw.** Add `buildBricks()`, which creates the 6×10 grid from `ROWS` and the layout constants. Call it on every new game. Draw the alive bricks with `drawSprite(ctx, 'block_' + color, ...)`. *Manual test:* six colored rows appear (red at top, green at bottom).
7. **Brick collisions, scoring and win.** Check the ball against alive bricks and handle at most one brick per frame. On overlap, mark the brick `alive = false`, add its `points` to `score`, and reflect the ball on the axis of smallest overlap (horizontal → invert `vx`, vertical → invert `vy`). When no bricks are alive, switch to `won`. Draw the win screen ("You win!", final score, "Press Enter to restart"). *Manual test:* bricks disappear, the score rises by the row value, and clearing all bricks shows the win screen.
8. **Explosions.** When a brick dies, push an explosion with `start = performance.now()`. In `render`, pick the frame index `floor(elapsed / (EXPLOSION_DURATION / 4))` from `EXPLOSION_FRAMES[color]` and draw it with `drawFrame`. Remove the explosion once `elapsed >= EXPLOSION_DURATION`. *Manual test:* each broken brick shows a short four-frame burst.
9. **Sounds.** Create two `Audio` objects for the mp3 files. Add a `playSound(audio)` helper that resets `currentTime = 0` and calls `play()`, swallowing the rejected promise. Play the bounce sound on paddle and wall hits, and the break sound on brick hits. *Manual test:* both sounds are audible after the first key press.
10. **Pause.** P or Esc in `serve` or `playing` stores `pausedFrom` and switches to `paused`. Pressing either key again restores it. `update` does nothing while paused, and `render` draws the frozen scene with a semi-transparent overlay and "Paused". *Manual test:* the ball freezes and resumes in the same position and direction.

## Acceptance criteria

- [ ] Opening `index.html` over a local HTTP server loads the game with no errors in the console.
- [ ] The canvas is 480×640 and shows a title screen with "Press Space to start".
- [ ] The HUD shows the score at the top-left and the lives (starting at 3) at the top-right.
- [ ] 60 bricks are drawn in 6 rows of 10, colored red, yellow, cyan, magenta, hotpink and green from top to bottom.
- [ ] Arrow keys and A/D move the paddle, and it cannot leave the canvas.
- [ ] Arrow keys and Space do not scroll the page.
- [ ] Before launch, the ball rests on the paddle and moves with it. Space launches it.
- [ ] The ball bounces off the left, right and top walls, and does not enter the HUD strip.
- [ ] Hitting the paddle near an edge sends the ball out at a visibly steeper angle than hitting the center.
- [ ] The ball's speed stays the same after every bounce.
- [ ] Breaking a brick removes it and adds exactly its row value (red 60 … green 10) to the score.
- [ ] Each broken brick plays a four-frame explosion lasting about 150 ms.
- [ ] Paddle and wall hits play `ball-bounce.mp3`. Brick hits play `break-sound.mp3`.
- [ ] Losing the ball takes one life and puts the ball back on the paddle.
- [ ] Losing the third life shows a game-over screen with the final score.
- [ ] Breaking all 60 bricks shows a "You win!" screen with a score of 2100.
- [ ] Pressing Enter on the game-over or win screen starts a new game with score 0, 3 lives and all bricks.
- [ ] Pressing P or Esc during play freezes the game and shows "Paused". Pressing it again resumes from the same state.
- [ ] No files other than `index.html`, `style.css`, `game.js` and `assets/assets/spritesheet.js` are created or modified.

## Decisions

- **Yes:** keyboard-only controls. The user chose this. Mouse and touch input can come in a later spec.
- **No:** mouse control. Discarded to keep input handling minimal.
- **Yes:** `index.html` at the root, with the spritesheet path fixed to `assets/assets/spritesheet-breakout.png`. It is a one-line edit and keeps the project root clean.
- **No:** moving `assets/assets/*` up a level, or placing `index.html` inside `assets/`. The first churns the asset folder. The second puts the page in an odd location.
- **Yes:** a single `game.js` loaded as a plain script. The MVP is small, and `spritesheet.js` already uses globals.
- **No:** ES modules or multiple scripts. They are overhead at this size and can be revisited when features grow.
- **Yes:** a 480×640 portrait board with a 6×10 grid. This matches the arcade original's proportions.
- **Yes:** per-row points (60 → 10), so higher rows are worth more.
- **No:** a flat 10 points per brick. The user preferred per-row values.
- **No:** saving any score. High scores get their own spec.
- **Yes:** paddle bounce angle by hit position, up to 60° from vertical, at constant speed. This gives the player aim without making the game harder.
- **No:** ball speed-up. It is a difficulty tuning for later.
- **Yes:** time-based movement (px/s with `dt` capped at 1/30 s). This keeps the speed consistent across monitor refresh rates.
- **Yes:** the HUD is drawn on the canvas. All rendering stays in one place.
- **No:** HTML elements for the HUD.
- **Yes:** a title screen, with Space to start and launch, and Enter to restart after an end screen.
- **Yes:** at most one brick collision resolved per frame. This avoids double reflections when the ball touches two bricks at once. It is acceptable at these speeds and sizes.
- **No:** gray bricks. The gray sprite exists, but it implies indestructible or multi-hit bricks, which are out of scope.

## Risks

| Risk | Mitigation |
| --- | --- |
| Browsers block audio until the user interacts with the page | The first sound only plays after a key press (Space), which counts as a user gesture. `play()` rejections are caught so they never throw. |
| Opening the page via `file://` blocks the spritesheet or sounds | Serve over HTTP (`npx serve` or `python -m http.server`), as `CLAUDE.md` documents. |
| The ball tunnels through a brick or the paddle on a long frame | `dt` is capped at 1/30 s. At 360 px/s that is 12 px per frame, which is not more than the ball size or the brick height. |
| The ball gets stuck bouncing nearly horizontally | The paddle angle is capped at 60° from vertical, so every paddle bounce has a strong vertical component. |
| `/spec-impl` needs git, but the repo is not a git repository | Run `git init` (and an initial commit) before running `/spec-impl 01-playable-mvp`. |

## What is **not** in this spec

- Mouse or touch controls.
- Multiple levels.
- Power-ups.
- High scores or any persistence.
- Multi-hit or indestructible bricks.
- Ball speed-up.
- Music or audio settings.
- Responsive scaling or a mobile version.
- Build tooling of any kind.

Each one of those, if it lands, goes in its own spec.
