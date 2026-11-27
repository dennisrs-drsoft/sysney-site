import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../app/tour-sisblink/motion.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { advanceProgress, swanFrame } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('a discrete scroll jump travels through intermediate frames, including after scroll stops', () => {
  let p = .1;
  const samples = [];
  for (let i = 0; i < 60; i++) { p = advanceProgress(p, .7, 1 / 60); samples.push(p); }
  assert.ok(samples[0] > .1 && samples[0] < .2);
  assert.ok(samples[20] > samples[10]);
  assert.ok(samples.every((v, i) => v <= .7 && (!i || v >= samples[i - 1])));
  assert.ok(Math.abs(p - .7) < .003);
});

test('equal elapsed time has the same response at 30, 60 and 120Hz', () => {
  const results = [30, 60, 120].map(hz => {
    let p = 0;
    for (let i = 0; i < hz / 2; i++) p = advanceProgress(p, 1, 1 / hz);
    return p;
  });
  assert.ok(Math.max(...results) - Math.min(...results) < 1e-10);
});

test('an irregular frame interval does not leave the journey running in slow motion', () => {
  const regular = Array.from({ length: 30 }).reduce(p => advanceProgress(p, 1, 1 / 60), 0);
  const irregular = [.016, .034, .2, .1, .15].reduce((p, dt) => advanceProgress(p, 1, dt), 0);
  assert.ok(Math.abs(regular - irregular) < 1e-10);
});

test('reverse scroll decelerates without overshooting and settles exactly at the end', () => {
  let p = .9;
  for (let i = 0; i < 180; i++) { const next = advanceProgress(p, 0, 1 / 60); assert.ok(next >= 0 && next <= p); p = next; }
  assert.equal(p, 0);
  assert.equal(advanceProgress(.5, .8, 0), .5);
});

test('the swan and final handoff are sampled from the common journey progress', () => {
  const initial = swanFrame(0), end = swanFrame(1);
  assert.deepEqual(initial, { progress: 0, dock: 0, handoff: 0 });
  assert.deepEqual(end, { progress: .97, dock: 1, handoff: 1 });
  assert.ok(swanFrame(.93).dock > 0 && swanFrame(.93).dock < 1);
  assert.equal(swanFrame(.93).handoff, 0);
});
