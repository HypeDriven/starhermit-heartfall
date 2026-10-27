// Sound, as the browser build's js/game.js: the authored one-shots
// (sfx/<name>.opus, one per named event, mapped by sfx/manifest.json) and
// the quiet generative pad (110 Hz and 164.81 Hz sines with a 220 Hz
// triangle through a lowpass at 520 Hz that a 0.07 Hz LFO opens and
// closes by 140 Hz), which the browser build ran as live oscillators; here
// it is rendered once into a seamless 1/0.07 s loop (createClip) and played
// looping on the music bus. As in the browser build it starts with the
// first press (the audio unlock).
//
// The browser build's Music and Effects sliders are the runtime's Options
// (music and effects buses, mute, voice limit); the menu clicks play on the
// interface bus. The old music bus ran at half the slider (0.5 × 80 %): the
// pad's gain folds that in. The synthesized stand-ins it played while a
// sample loaded are not ported (the engine's web runtime drops clip loads
// while a synthesis graph changes). Clips load once the mixer runs
// (natively at once, in a browser after the first press), one at a time.
import { files } from "starhermit:engine";
import { context, createClip, loadClip, play as playClip, type AudioClip, type Bus } from "starhermit:audio";

const FIRST = ["ui-click", "card-select", "card-play", "cards-deal", "card-pass", "turn-prompt", "trick-take", "invalid"];
const INTERFACE = new Set(["ui-click", "ui-back", "pause"]);

const eventFile = new Map<string, string>();
const clips = new Map<string, AudioClip>();
const queue: string[] = [];
let loading = false;
let wantClips = false;
function load(name: string): void { if (!queue.includes(name) && !clips.has(name)) queue.push(name); }
function pump(): void {
  if (loading || !queue.length) return;
  const name = queue.shift()!;
  loading = true;
  loadClip(`sfx/${name}.opus`).then((c) => { clips.set(name, c); loading = false; }, (e: unknown) => { console.warn(`sfx ${name}: ${String(e)}`); loading = false; });
}
/** Reads the manifest and asks for the clips; they load once the mixer runs (see update). */
export function loadSfx(): void {
  try {
    const list = files.readJson("sfx/manifest.json") as unknown as { name?: string; event?: string }[];
    for (const e of Array.isArray(list) ? list : []) {
      if (e && typeof e.name === "string" && typeof e.event === "string" && !eventFile.has(e.event)) eventFile.set(e.event, e.name);
    }
  } catch (e) { console.warn(`sfx manifest: ${String(e)}`); }
  wantClips = true;
}

/** Plays a named event's sample (js/game.js playSfx); a still-loading sample is silent. */
export function play(event: string): void {
  const file = eventFile.get(event);
  const clip = file ? clips.get(file) : undefined;
  if (!clip) return;
  const bus: Bus = INTERFACE.has(event) ? "interface" : "effects";
  try { playClip(clip, { bus }); }
  catch { clips.delete(file!); load(file!); } // a clip the mixer lost: load it again
}

/** Rules events as sounds, the same for the player's and the AI seats' plays (js/game.js playEventSfx). */
export function playEvents(events: readonly { type: string; p?: number; winner?: number }[], selfSeat: number): void {
  for (const e of events) {
    if (e.type === "play" && e.p !== selfSeat) play("card-play");
    else if (e.type === "trick") play(e.winner === selfSeat ? "trick-take" : "card-play");
    else if (e.type === "queen") play("queen-taken");
    else if (e.type === "hearts-broken") play("hearts-broken");
    else if (e.type === "eclipse") play("eclipse");
    else if (e.type === "round-end") play("round-end");
  }
}

// -- the pad ----------------------------------------------------------------------------------
const RATE = 11025;
const LOOP_S = 1 / 0.07;
/** The pad's loop, rendered a slice a frame (the native interpreter is slow): each voice rounded
 * to whole cycles in the loop so it joins seamlessly; two passes of a one-pole lowpass, the second
 * starting from the first's end state (no click at the seam). */
const VOICES: [number, boolean, number][] = [[110, true, 0.2], [164.81, true, 0.12], [220, false, 0.05]];
const N = Math.round(LOOP_S * RATE);
const FS = VOICES.map(([f]) => Math.round(f * LOOP_S) / LOOP_S);
const padBuf = new Float32Array(N);
let padPos = 0;
let padY = 0;
function renderPad(count: number): boolean {
  const end = Math.min(2 * N, padPos + count);
  for (; padPos < end; padPos++) {
    const i = padPos % N, t = i / RATE;
    let x = 0;
    for (let v = 0; v < 3; v++) {
      const ph = (FS[v]! * t) % 1;
      x += VOICES[v]![2] * (VOICES[v]![1] ? Math.sin(2 * Math.PI * ph) : 1 - 4 * Math.abs(ph - 0.5));
    }
    const cutoff = 520 + 140 * Math.sin(2 * Math.PI * 0.07 * t);
    padY += ((2 * Math.PI * cutoff) / RATE) * (x - padY);
    if (padPos >= N) padBuf[i] = padY;
  }
  return padPos >= 2 * N;
}
let pad: AudioClip | null = null;
let padStarted = false;
let unlocked = false;
/** The first press (the browser build's audio unlock): the pad may start. */
export function unlock(): void { unlocked = true; }

/** Each frame: the samples once the mixer runs (one at a time), then the pad. */
export function update(): void {
  if (context.state !== "running") return;
  if (wantClips) {
    wantClips = false;
    for (const e of FIRST) { const f = eventFile.get(e); if (f) load(f); }
    for (const name of eventFile.values()) load(name);
  }
  pump();
  if (loading || queue.length) return;
  if (!pad) {
    if (!renderPad(8000)) return;
    try { pad = createClip([padBuf], RATE); } catch (e) { console.warn(`audio: ${String(e)}`); padPos = 0; }
    return;
  }
  if (!padStarted && unlocked) {
    padStarted = true;
    try { playClip(pad, { bus: "music", gain: 0.5, loop: true }); } catch { padStarted = false; }
  }
}
