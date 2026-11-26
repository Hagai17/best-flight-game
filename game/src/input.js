// Keyboard and mouse, gathered into one control object the flight model reads, plus a
// queue of one-shot actions (drop the crate, change camera, pause) that fire once per
// press. The mouse steers when it has moved lately and no arrow key is down: push it
// up to climb, lean it sideways to bank. The wheel works the throttle like a quadrant.

const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyB', 'KeyC', 'KeyX',
  'KeyP', 'KeyR', 'KeyM', 'Enter', 'Digit1', 'Digit2',
]);

/** Creates the input state bound to a canvas. Call update(dt) once per frame. */
export function createInput(canvas) {
  const held = new Set();
  const actions = [];
  const mouse = { x: 0.5, y: 0.5, lastMove: -10, down: false };
  let now = 0;
  let flaps = false;

  const control = {
    elevator: 0,
    aileron: 0,
    rudder: 0,
    throttle: 0,
    flaps: false,
    brakes: false,
  };

  window.addEventListener('keydown', (event) => {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'KeyF') {
      flaps = !flaps;
      actions.push('flaps');
    }
    if (event.code === 'KeyX') actions.push('drop');
    if (event.code === 'KeyC') actions.push('camera');
    if (event.code === 'KeyP' || event.code === 'Escape') actions.push('pause');
    if (event.code === 'KeyR') actions.push('restart');
    if (event.code === 'KeyM') actions.push('mute');
    if (event.code === 'Enter') actions.push('confirm');
    if (event.code === 'Digit1') actions.push('mode1');
    if (event.code === 'Digit2') actions.push('mode2');
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('mousemove', (event) => {
    mouse.x = event.clientX / Math.max(1, window.innerWidth);
    mouse.y = event.clientY / Math.max(1, window.innerHeight);
    mouse.lastMove = now;
  });
  canvas.addEventListener('mousedown', () => {
    mouse.down = true;
    actions.push('confirm');
    actions.push('pointer');
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    control.throttle = clamp01(control.throttle - Math.sign(event.deltaY) * 0.07);
  }, { passive: false });

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  return {
    control,

    /** One-shot actions since the last call; the caller drains and acts on them. */
    drainActions() {
      return actions.splice(0, actions.length);
    },

    /** Recomputes the continuous controls from what is held and where the mouse sits. */
    update(dt) {
      now += dt;
      let elevator = 0;
      let aileron = 0;
      let rudder = 0;
      if (held.has('ArrowUp')) elevator += 1;
      if (held.has('ArrowDown')) elevator -= 1;
      if (held.has('ArrowLeft')) aileron -= 1;
      if (held.has('ArrowRight')) aileron += 1;
      if (held.has('KeyA')) { rudder -= 1; aileron -= 0.75; }
      if (held.has('KeyD')) { rudder += 1; aileron += 0.75; }
      if (elevator === 0 && aileron === 0 && now - mouse.lastMove < 4) {
        // Mouse steering: offset from screen centre becomes a gentle demand.
        aileron = (mouse.x - 0.5) * 1.7;
        elevator = (0.5 - mouse.y) * 1.5;
      }
      if (held.has('KeyW')) control.throttle = clamp01(control.throttle + 0.55 * dt);
      if (held.has('KeyS')) control.throttle = clamp01(control.throttle - 0.55 * dt);
      control.elevator = clamp1(elevator);
      control.aileron = clamp1(aileron);
      control.rudder = clamp1(rudder);
      control.flaps = flaps;
      control.brakes = held.has('KeyB') || held.has('Space');
    },

    /** Sets the flap lever directly (the screenshot staging uses this). */
    setFlaps(value) {
      flaps = value;
      control.flaps = value;
    },
  };
}

function clamp1(v) {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}
