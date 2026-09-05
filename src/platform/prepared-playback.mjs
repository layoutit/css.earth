// The router grants permission. This owner applies it to retained native
// animations; it creates no timer, frame loop, visibility or media observer.
export function createPreparedPlayback() {
  const handles = new Map();
  let allowed = false, ready = false, destroyed = false, selection = Object.freeze({ speed: 1 });
  const enabled = rules => Object.entries(rules).every(([name, expected]) =>
    Array.isArray(expected) ? expected.includes(selection[name]) : Object.is(selection[name], expected));
  function apply(entry) {
    const { animation, mode, rate, enabledWhen } = entry;
    const speed = selection.speed ?? 1;
    const nextRate = mode === "pose" ? rate : rate * speed;
    const running = mode === "motion" && ready && allowed && speed !== 0 && enabled(enabledWhen);
    if (entry.appliedRate !== nextRate) {
      animation.playbackRate = nextRate;
      entry.appliedRate = nextRate;
    }
    if (entry.running !== running) {
      if (running) animation.play(); else animation.pause();
      entry.running = running;
    }
  }
  function applyAll() {
    if (destroyed) return;
    const errors = [];
    for (const entry of handles.values()) {
      try { apply(entry); } catch (error) { errors.push(error); }
    }
    if (errors.length) throw new AggregateError(errors, "Prepared native playback publication failed.");
  }
  return Object.freeze({
    register(animation, { mode = "motion", rate = 1, enabledWhen = {}, initialTime } = {}) {
      if (!animation || ["play", "pause", "cancel"].some(name => typeof animation[name] !== "function") ||
          !["motion", "pose"].includes(mode) || !Number.isFinite(rate) ||
          (initialTime !== undefined && !Number.isFinite(initialTime)) ||
          !enabledWhen || typeof enabledWhen !== "object" || Array.isArray(enabledWhen)) {
        throw new TypeError("Prepared playback requires a native animation and valid prepared role.");
      }
      if (destroyed) { animation.cancel(); return animation; }
      if (handles.has(animation)) return animation;
      const entry = { animation, mode, rate, enabledWhen: Object.freeze({ ...enabledWhen }), running: null, appliedRate: null };
      handles.set(animation, entry);
      // Pose-addressed WAAPI is never reset as if it were rotation playback.
      if (initialTime !== undefined) animation.currentTime = initialTime;
      apply(entry);
      return animation;
    },
    seek(animation, time) {
      if (destroyed) return;
      const entry = handles.get(animation);
      if (entry?.mode !== "pose" || !Number.isFinite(time)) throw new TypeError("Prepared pose seek requires a registered pose animation and finite time.");
      animation.currentTime = time;
    },
    resetMotion() {
      if (destroyed) return;
      for (const { animation, mode } of handles.values()) if (mode === "motion") animation.currentTime = 0;
    },
    setAllowed(value) { if (destroyed) return; allowed = value === true; applyAll(); },
    setReady(value = true) { if (destroyed) return; ready = value === true; applyAll(); },
    setSelection(next) {
      if (destroyed) return;
      if (!next || !Number.isFinite(next.speed ?? 1) || (next.speed ?? 1) < 0) throw new TypeError("Prepared speed must be a finite nonnegative rate.");
      selection = Object.freeze({ ...next });
      applyAll();
    },
    stats() {
      return Object.freeze({ allowed, ready, destroyed, speed: selection.speed ?? 1, registeredCount: handles.size,
        animations: Object.freeze([...handles.values()].map(({ animation, mode, running, appliedRate }) => Object.freeze({
          mode, running, rate: appliedRate, currentTime: animation.currentTime, playState: animation.playState,
        }))) });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; allowed = false; ready = false;
      const owned = [...handles.keys()]; handles.clear();
      const errors = [];
      for (const animation of owned) { try { animation.cancel(); } catch (error) { errors.push(error); } }
      if (errors.length) throw new AggregateError(errors, "Prepared native animation cleanup failed.");
    },
  });
}
