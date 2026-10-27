import test from "node:test";
import {buildAction,communityDraft} from "../shared/review/actions.js";
import assert from "node:assert/strict";
import { inspectBuild, ledResistance } from "../shared/review/catalog.js";
import { practiceQuestions, gradePractice } from "../server/review/practice.js";
import { createApplication } from "../server/app.js";
import { renderViva,vivaSnippets,answerSchema,buildInput } from "../server/review/service.js";
import {resolvePossibilityOwnership,applyStatedInventory,inventoryPossibilities,statedOwnership} from "../shared/review/ownership.js";
import {withReviewRepair} from "../server/review/response.js";
import {z} from "zod";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
test('PDF viva selects electronics facts rather than licensing boilerplate',()=>{
 const snippets=vivaSnippets([{id:'p1',text:'This hardware is licensed under the Creative Commons License. Digital input pins operate at the specified logic voltage.'}]);
 assert.equal(snippets.length,1);assert.match(snippets[0].text,/Digital input/);assert.equal(snippets[0].sourceId,'p1');
 assert.deepEqual(vivaSnippets([{id:'diagram',text:'GND 100n 3x2 M +5V GND 1K 22R ADC5 PC5 28 ADC4 PC4 27 LED 10K'}]),[]);
});
test("viva electrical content must be a literal source quote, including feedback", () => {
  const evidence = [
    { id: "pi", text: "GPIO uses 3.3 V logic and is not 5 V tolerant." },
  ];
  const result = {
    focusId: "pi",
    quote: evidence[0].text,
    prompt: "explain",
    covered: [{ id: "pi", quote: evidence[0].text }],
    revisit: [],
  };
  assert.ok(renderViva(result, evidence, true).question.includes("3.3 V"));
  assert.throws(() =>
    renderViva(
      { ...result, quote: "Connect the sensor directly to five volts." },
      evidence,
      true,
    ),
  );
  assert.throws(() =>
    renderViva(
      {
        ...result,
        revisit: [
          {
            id: "pi",
            quote: "The ADC reference determines its digital output voltage.",
          },
        ],
      },
      evidence,
      true,
    ),
  );
});

test("missing ADC blocks Pi analogue recipe but not Uno ADC; restoring resolves only supported blocker", () => {
  const p = {
    board: "raspberry-pi-5",
    parts: ["tmp36", "mcp3008"],
    missing: ["mcp3008"],
  };
  assert.ok(
    inspectBuild(p).findings.some(
      (f) => f.id === "tmp36-mcp3008" && f.status === "blocked",
    ),
  );
  assert.ok(
    inspectBuild({ ...p, missing: [] }).findings.every(
      (f) => f.status !== "blocked",
    ),
  );
  assert.ok(
    inspectBuild({ ...p, board: "arduino-uno-r3" }).findings.every(
      (f) => f.id !== "tmp36-mcp3008",
    ),
  );
  assert.ok(
    inspectBuild({ ...p, missing: [] }).findings.some(
      (f) => f.status === "unknown",
    ),
  );
});
test("external LED and motor dependencies remain explicit; unavailable loads do not create false blockers", () => {
  const r = inspectBuild({ board: "arduino-uno-r3", parts: ["motor", "led"] });
  assert.deepEqual(
    r.findings
      .filter((f) => f.status === "blocked")
      .map((f) => f.id)
      .sort(),
    ["led-resistor", "motor-driver", "motor-supply"],
  );
  assert.equal(
    inspectBuild({
      board: "arduino-uno-r3",
      parts: ["motor"],
      missing: ["motor"],
    }).findings.filter((f) => f.status === "blocked").length,
    0,
  );
});
test("5 V echo does not pass as directly compatible with Pi", () =>
  assert.ok(
    inspectBuild({ board: "raspberry-pi-5", parts: ["hcsr04"] }).findings.some(
      (f) => f.id === "echo-level" && f.status === "blocked",
    ),
  ));
test("LED calculation uses amperes, rejects invalid parameters and calculates power", () => {
  const r = ledResistance(3.3, 2, 5);
  assert.ok(Math.abs(r.ohms - 260) < 0.001);
  assert.ok(Math.abs(r.watts - 0.0065) < 0.000001);
  for (const args of [
    [2, 3, 5],
    [3.3, 2, 0],
    [3.3, 2, 30],
    [NaN, 2, 5],
  ])
    assert.throws(() => ledResistance(...args));
});
test("practice has real images and published answers; evaluation set cannot be graded via public route", async () => {
  const rows = await practiceQuestions();
  assert.equal(rows.length, 24);
  assert.ok(
    rows.every((q) => q.split === "practice" && q.image.endsWith(".jpg")),
  );
  assert.equal((await gradePractice("eee-0", "option b.")).correct, true);
  await assert.rejects(() => gradePractice("eee-24", "A"), { status: 404 });
});
test("guest API exposes questions without answers, rejects saving and protects community writes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pinlight-review-")),
    app = createApplication({
      databasePath: join(dir, "test.sqlite"),
      documentsDir: join(dir, "docs"),
    });
  try {
    await new Promise((resolve) => app.server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${app.server.address().port}/api/review`;
    const rows = await (await fetch(`${base}/practice`)).json();
    assert.equal(rows.length, 24);
    assert.ok(rows.every((q) => !("solution" in q)));
    for (const path of ["records", "posts", "replies"]) {
      const r = await fetch(`${base}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      assert.equal(r.status, 401);
    }
    const bad = await fetch(`${base}/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal: "Build a sensor",
        board: "invented",
        parts: [],
      }),
    });
    assert.equal(bad.status, 400);
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
    await app.processing.close();
    app.store.close();
    assert.ok(resolve(dir).startsWith(resolve(tmpdir()) + sep));
    await rm(dir, { recursive: true, force: true });
  }
});

test('build dictation distinguishes drafting, sending and cancelled commands',()=>{
 assert.equal(buildAction('Practice explaining this build please'),'practice');
 assert.equal(buildAction('Ask in community'),'draft');
 assert.equal(buildAction('Please post about it'),'draft');
 assert.equal(buildAction('Send post'),'send');
 assert.equal(buildAction("Do not send post"),null);
 assert.equal(buildAction("Don't post"),null);
 assert.equal(buildAction('Preview post'),'draft');
 assert.equal(buildAction('What if I post this?'),'draft');
});
test('community draft includes design intent and missing parts without publishing',()=>{
 const draft=communityDraft({input:{goal:'A warning light',board:'arduino-uno-r3',parts:['led']},narrative:{idea:'A warning light',owned:'Uno and LED',suggested:'LED and resistor'},summary:'Current limiting is still needed.',questions:['Which resistor is appropriate?'],possibilities:[{name:'Resistor',relation:'required'}]});
 assert.match(draft.question,/Parts I have: Uno and LED/);assert.match(draft.question,/Still needed: Resistor/);assert.match(draft.question,/Which resistor/);assert.equal(draft.project.narrative.idea,'A warning light');
});

test('planner accepts optional alternative verification metadata without a nullable graph schema',()=>{
 const parsed=answerSchema.parse({summary:'Review',considerations:[],questions:[],evidenceIds:['ne555'],possibilities:[{name:'NE555',relation:'required',relatedTo:'Flasher',reason:'Timing',without:'No blinking',verified:true,alternatives:[{name:'Other timer',tradeoff:'Check the exact variant',checks:'Verify the datasheet',verified:false}]}]});
 assert.equal(parsed.possibilities[0].alternatives[0].verified,false);
 const schema=z.toJSONSchema(answerSchema);
 assert.equal(schema.properties.possibilities.type,'array');
 assert.ok(schema.required.includes('possibilities'));
 assert.equal(buildInput.parse({goal:'Standalone 555 flasher',board:'standalone',parts:['ne555','led','resistor']}).board,'standalone');
 assert.equal(inspectBuild({board:'standalone',parts:['ne555']}).nodes.some(n=>n.id==='arduino-uno-r3'),false);
});
test('malformed review responses get one retry and useful errors; unrelated failures are not retried',async()=>{
 let calls=0;
 assert.equal(await withReviewRepair(async attempt=>{calls++;if(!attempt)throw Error('Tool call validation failed');return 'review';}),'review');assert.equal(calls,2);
 calls=0;await assert.rejects(()=>withReviewRepair(async()=>{calls++;throw Error('Failed to parse tool call arguments as JSON');}),{status:502});assert.equal(calls,2);
 calls=0;await assert.rejects(()=>withReviewRepair(async()=>{calls++;throw Object.assign(Error('rate limit'),{statusCode:429});}),{status:429});assert.equal(calls,1);
});

test('owned timer and LED do not become missing merely because they are required by the circuit',()=>{
 const parts=resolvePossibilityOwnership([{name:'NE555 timer IC',relation:'required'},{name:'LED',relation:'required'},{name:'Current-limiting resistor (LED)',relation:'required'}],{board:'standalone',parts:['ne555','led','resistor'],missing:['resistor']});
 assert.deepEqual(parts.map(p=>p.relation),['have','have','required']);
});

test('AI shopping lists never count as owned inventory, even if intake omitted missing IDs',()=>{
 const input=applyStatedInventory({board:'standalone',parts:['ne555','led','resistor','supply'],missing:[]},'Breadboard and jumper wires');
 assert.deepEqual(input.missing,['ne555','led','resistor','supply']);
 const graph=inventoryPossibilities([{name:'NE555 timer IC',relation:'have'},{name:'LED',relation:'have'}],{owned:'Breadboard and jumper wires'});
 assert.equal(graph.find(p=>p.name==='LED').relation,'required');assert.equal(graph.find(p=>p.name==='Breadboard').relation,'have');assert.equal(graph.find(p=>p.name==='jumper wires').relation,'have');
 assert.equal(statedOwnership('LED',"I do not have LEDs"),false);assert.equal(statedOwnership('LED','Breadboard and jumper wires'),false);
 assert.equal(statedOwnership('LED','2 LEDs'),true);assert.equal(statedOwnership('NE555 timer IC','555 timer'),true);
});
test('build endpoint streams actual stage messages before the final result',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pinlight-stream-'));
 const app=createApplication({databasePath:join(dir,'test.sqlite'),documentsDir:join(dir,'docs'),reviewFactory:()=>({review:async(raw,{onProgress})=>{onProgress('Reading inventory');onProgress('Checking references');return {input:{goal:raw.idea},summary:'Complete'};}})});
 try{
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const response=await fetch(`http://127.0.0.1:${app.server.address().port}/api/review/build?stream=1`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idea:'A test circuit'})});
  assert.match(response.headers.get('content-type'),/ndjson/);
  const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));
  assert.deepEqual(events.slice(0,2).map(e=>e.text),['Reading inventory','Checking references']);assert.equal(events.at(-1).type,'result');assert.equal(events.at(-1).result.summary,'Complete');
 }finally{await new Promise(resolve=>app.server.close(resolve));await app.processing.close();app.store.close();await rm(dir,{recursive:true,force:true});}
});
