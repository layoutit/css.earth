export interface PreparedPlaybackSelection { readonly speed?: number; readonly [key: string]: unknown; }
export type PreparedAnimationMode = "motion" | "pose";
export type PreparedAnimation = Pick<Animation, "play" | "pause" | "cancel" | "playbackRate" | "currentTime" | "playState">;
export interface PreparedAnimationOptions { mode?: PreparedAnimationMode; rate?: number; enabledWhen?: Readonly<Record<string, unknown>>; initialTime?: number; }
interface PlaybackEntry { animation: PreparedAnimation; mode: PreparedAnimationMode; rate: number; enabledWhen: Readonly<Record<string, unknown>>; running: boolean | null; appliedRate: number | null; }

// The router grants permission. This owner applies it to retained native
// animations; it creates no timer, frame loop, visibility or media observer.
export function createPreparedPlayback() {
  const handles = new Map<PreparedAnimation, PlaybackEntry>();
  let allowed = false, ready = false, destroyed = false, selection: PreparedPlaybackSelection = Object.freeze({ speed: 1 });
  const enabled = (rules: Readonly<Record<string, unknown>>) => Object.entries(rules).every(([name, expected]) =>
    Array.isArray(expected) ? expected.includes(selection[name]) : Object.is(selection[name], expected));
  function apply(entry: PlaybackEntry) {
    const { animation, mode, rate, enabledWhen } = entry;
    const speed = speedOf(selection);
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
    register(animation: PreparedAnimation, { mode = "motion", rate = 1, enabledWhen = {}, initialTime }: PreparedAnimationOptions = {}) {
      if (!animation || (["play", "pause", "cancel"] as const).some(name => typeof animation[name] !== "function") ||
          !["motion", "pose"].includes(mode) || !Number.isFinite(rate) ||
          (initialTime !== undefined && !Number.isFinite(initialTime)) ||
          !enabledWhen || typeof enabledWhen !== "object" || Array.isArray(enabledWhen)) {
        throw new TypeError("Prepared playback requires a native animation and valid prepared role.");
      }
      if (destroyed) { animation.cancel(); return animation; }
      if (handles.has(animation)) return animation;
      const entry: PlaybackEntry = { animation, mode, rate, enabledWhen: Object.freeze({ ...enabledWhen }), running: null, appliedRate: null };
      handles.set(animation, entry);
      // Pose-addressed WAAPI is never reset as if it were rotation playback.
      if (initialTime !== undefined) animation.currentTime = initialTime;
      apply(entry);
      return animation;
    },
    seek(animation: PreparedAnimation, time: number) {
      if (destroyed) return;
      const entry = handles.get(animation);
      if (entry?.mode !== "pose" || !Number.isFinite(time)) throw new TypeError("Prepared pose seek requires a registered pose animation and finite time.");
      animation.currentTime = time;
    },
    resetMotion() {
      if (destroyed) return;
      for (const { animation, mode } of handles.values()) if (mode === "motion") animation.currentTime = 0;
    },
    /** Whether every motion animation is paused at its prepared start, the pose preparation measured. */
    motionAtRest() {
      return [...handles.values()].every(({ animation, mode, running }) => mode !== "motion" || !running && Number(animation.currentTime ?? 0) === 0);
    },
    captureMotion() {
      return [...handles.values()].filter(entry => entry.mode === "motion")
        .map(({ animation }) => Number(animation.currentTime ?? 0));
    },
    validateMotion(times: readonly number[]) {
      if (!Array.isArray(times) || times.length !== [...handles.values()].filter(entry => entry.mode === "motion").length ||
          times.some(time => !Number.isFinite(time) || time < 0)) {
        throw new TypeError("Saved playback does not match this prepared scene.");
      }
    },
    restoreMotion(times: readonly number[]) {
      if (destroyed) return;
      this.validateMotion(times);
      let index = 0;
      for (const { animation, mode } of handles.values()) if (mode === "motion") animation.currentTime = times[index++];
    },
    setAllowed(value: boolean) { if (destroyed) return; allowed = value === true; applyAll(); },
    setReady(value = true) { if (destroyed) return; ready = value === true; applyAll(); },
    setSelection(next: PreparedPlaybackSelection) {
      if (destroyed) return;
      speedOf(next);
      selection = Object.freeze({ ...next });
      applyAll();
    },
    stats() {
      return Object.freeze({ allowed, ready, destroyed, speed: speedOf(selection), registeredCount: handles.size,
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

function speedOf(selection: PreparedPlaybackSelection): number {
  const speed = selection?.speed ?? 1;
  if (!selection || typeof speed !== "number" || !Number.isFinite(speed) || speed < 0) throw new TypeError("Prepared speed must be a finite nonnegative rate.");
  return speed;
}
