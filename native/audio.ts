// Sound, as the browser build's js/game.js: the authored one-shots
// (sfx/<name>.opus, one per named event, mapped by sfx/manifest.json) and
// the quiet generative pad (110 Hz and 164.81 Hz sines with a 220 Hz
// triangle through a lowpass at 520 Hz that a 0.07 Hz LFO opens and
// closes by 140 Hz), which the browser build ran as live oscillators; here
// it is rendered once offline (OfflineAudioContext) into a seamless 1/0.07 s
// loop and played looping on the music bus. As in the browser build it starts with the
// first press (the audio unlock).
//
// The browser build's Music and Effects sliders are the runtime's Options
// (music and effects buses, mute, voice limit); the menu clicks play on the
// interface bus. The old music bus ran at half the slider (0.5 × 80 %): the
// pad's gain folds that in. The synthesized stand-ins it played while a
// sample loaded are not ported. The clips all load at once in onStart
// (every loaded clip reaches the mixer, natively and on the web), the pad
// renders there too and starts once the mixer runs.
import { files } from "starhermit:engine";
import { context, createClip, loadClip, OfflineAudioContext, play as playClip, type AudioClip, type Bus } from "starhermit:audio";

const INTERFACE = new Set(["ui-click", "ui-back", "pause"]);

const eventFile = new Map<string, string>();
const clips = new Map<string, AudioClip>();
/** Reads the manifest and loads every clip at once (onStart); a cue whose clip is still loading is skipped. */
export function loadSfx(): void {
  try {
    const list = files.readJson("sfx/manifest.json") as unknown as { name?: string; event?: string }[];
    for (const e of Array.isArray(list) ? list : []) {
      if (e && typeof e.name === "string" && typeof e.event === "string" && !eventFile.has(e.event)) eventFile.set(e.event, e.name);
    }
  } catch (e) { console.warn(`sfx manifest: ${String(e)}`); }
  for (const name of new Set(eventFile.values())) {
    loadClip(`sfx/${name}.opus`).then((c) => { clips.set(name, c); }, (e: unknown) => console.warn(`sfx ${name}: ${String(e)}`));
  }
  renderPad().then((c) => { pad = c; }, (e: unknown) => console.warn(`audio: ${String(e)}`));
}

/** Plays a named event's sample (js/game.js playSfx); a still-loading sample is silent. */
export function play(event: string): void {
  const file = eventFile.get(event);
  const clip = file ? clips.get(file) : undefined;
  if (!clip) return;
  const bus: Bus = INTERFACE.has(event) ? "interface" : "effects";
  try { playClip(clip, { bus }); }
  catch { /* the mixer is full this frame: skip it */ }
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
/** Each voice rounded to whole cycles in the loop so it joins seamlessly; the first of two passes
 * settles the filter, the second is the loop (no click at the seam). */
const VOICES: [number, "sine" | "triangle", number][] = [[110, "sine", 0.2], [164.81, "sine", 0.12], [220, "triangle", 0.05]];
const N = Math.round(LOOP_S * RATE);
async function renderPad(): Promise<AudioClip> {
  const off = new OfflineAudioContext(1, 2 * N, RATE);
  const lp = off.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 520;
  const lfo = off.createOscillator();
  lfo.frequency.value = 0.07;
  const depth = off.createGain();
  depth.gain.value = 140;
  lfo.connect(depth).connect(lp.frequency);
  lfo.start();
  for (const [f, type, level] of VOICES) {
    const osc = off.createOscillator();
    osc.type = type;
    osc.frequency.value = Math.round(f * LOOP_S) / LOOP_S;
    const g = off.createGain();
    g.gain.value = level;
    osc.connect(g).connect(lp);
    osc.start();
  }
  lp.connect(off.destination);
  const r = await off.startRendering();
  return createClip([r.getChannelData(0).slice(N)], RATE);
}
let pad: AudioClip | null = null;
let padStarted = false;
let unlocked = false;
/** The first press (the browser build's audio unlock): the pad may start. */
export function unlock(): void { unlocked = true; }

/** Each frame: the pad starts once it is rendered, the mixer runs and a press came. */
export function update(): void {
  if (context.state !== "running" || !pad || padStarted || !unlocked) return;
  padStarted = true;
  try { playClip(pad, { bus: "music", gain: 0.5, loop: true }); } catch { padStarted = false; }
}
