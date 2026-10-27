import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { reviewParts } from '../../shared/review/catalog.js';
import { BOARDS, KINDS, ROLES, SHAPES, normalizeScene } from '../../shared/review/scene.js';
import { FORMS, MOUNTS } from '../../shared/review/assembly.js';

// One model call describes the build for the 3D view: which parts, roughly how big, which
// pins, and what connects to what. Placement, wire routing and wiring checks are done by
// shared/review/scene.js, never by the model.
const sceneSchema = z.object({
  // Names outside the known lists are accepted here and mapped to safe defaults in
  // normalizeScene, so one unexpected word cannot fail the whole 3D view.
  title: z.string().max(60), form: z.string().max(20),
  parts: z.array(z.object({
    id: z.string().max(40), name: z.string().max(60),
    role: z.string().max(20), catalog: z.string().max(40).nullable(), owned: z.boolean(),
    shape: z.string().max(20), size_mm: z.array(z.number()).length(3), color: z.string().max(7),
    pins: z.array(z.string().max(12)).max(16), note: z.string().max(200), mount: z.string().max(20),
  })).max(18),
  connections: z.array(z.object({ from: z.string().max(60), to: z.string().max(60), kind: z.string().max(20), note: z.string().max(200) })).max(40),
  notes: z.array(z.string().max(200)).max(5),
});

export function createSceneAgent(env = process.env) {
  if (!env.GROQ_API_KEY) return null;
  const agent = new Agent({
    id: 'build-scene', name: 'Build scene', model: `groq/${env.GROQ_MODEL || 'openai/gpt-oss-120b'}`,
    instructions: [
      'You describe an electronics build so it can be drawn in 3D and wired. Use the reviewed parts list you are given: include every owned and required part, plus the camera, sensor or module the idea clearly needs even if the catalogue lacks it. Do not invent extra parts.',
      'First decide the finished product: title (a short product name, e.g. "Face-tracking rover") and form: rover (anything that drives on wheels), desk (a desk companion, gadget, lamp, clock, monitor or station that sits on a table), handheld (held in the hand or worn), arm (a robot arm, pan-tilt or anything built from stacked servos), box (anything else). Then give every part a mount, the place it goes in the finished product. rover: deck (top deck, e.g. the main board), under (lower deck, e.g. battery and motor driver), front (camera or distance sensor facing forward), top (LEDs or buttons on the body), back, wheel (drive motors). desk, box: inside (hidden electronics), front (screen, camera, speaker, sensor that must face the user), top (buttons, LEDs), back, side. handheld: inside, top (screen, buttons), side, back. arm: base (electronics in the base), joint (each servo, in order from the base), tip (gripper, camera or laser at the end), top, front.',
      'For each part: a short id (lowercase, no spaces), its name, role, catalog (an id from the supplied catalogue, or null), owned (false if the review lists it as missing), shape from the allowed list, realistic size_mm [width, depth, height] in millimetres, a hex colour like the real part, (use screen for any display, speaker for a speaker, microphone for a mic, buzzer for a buzzer) and the pin labels as printed on the part (e.g. VCC, GND, TRIG, ECHO, SDA, SCL, IN1, OUT1).',
      'Use only these shapes: ' + SHAPES.join(', ') + '. If there is a main board (Raspberry Pi 5 or Arduino Uno), do not list it as a part; it is supplied separately. Any other main board (ESP32, Pico, Nano) is listed as a part with role board. Refer to its pins as board.PIN using its real labels: on a Raspberry Pi 5 use GPIO numbers (board.GPIO18), board.5V, board.3V3 and board.GND; on an Arduino Uno use board.D9, board.A0, board.5V, board.3V3, board.GND.',
      'Connections use "partid.PIN" on both ends and a kind: power, ground, signal or data. Wire a realistic, safe circuit: every powered part shares ground; motors go through the driver, never straight to a board pin; LEDs get a series resistor; 5 V outputs into a Raspberry Pi need a divider (say so in notes).',
      'notes: up to five short assembly cautions. Output only the structured object.',
    ].join(' '),
  });
  return async review => {
    const payload = {
      idea: review.narrative?.idea || review.input?.goal, board: review.input?.board, boardName: BOARDS[review.input?.board]?.name || 'no main board',
      owned: review.narrative?.owned || '', parts: [review.input?.board, ...(review.input?.parts || [])], missing: review.input?.missing || [],
      possibilities: (review.possibilities || []).map(p => ({ name: p.name, relation: p.relation, reason: p.reason })).slice(0, 16),
      catalogue: reviewParts.map(({ id, name }) => ({ id, name })),
    };
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await agent.generate(JSON.stringify(payload), { structuredOutput: { schema: sceneSchema, jsonPromptInjection: true }, maxSteps: 1, modelSettings: { temperature: 0.2, maxOutputTokens: 6000 }, abortSignal: AbortSignal.timeout(45000) });
        return normalizeScene(sceneSchema.parse(response.object), review.input);
      } catch (e) {
        lastError = e;
        // Groq's free tier caps tokens per minute; when it says how long to wait, wait (up to
        // 25 s) and try once more instead of failing straight after a long review.
        const wait = Number(String(e?.message || e?.cause?.message || '').match(/try again in ([\d.]+)s/)?.[1]);
        if (wait && attempt === 0) await new Promise(r => setTimeout(r, Math.min(wait, 25) * 1000 + 500));
      }
    }
    throw Object.assign(Error('The 3D layout could not be generated this time. Try again in a moment.'), { status: 502, cause: lastError });
  };
}
