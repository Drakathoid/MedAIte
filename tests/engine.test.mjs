import test from 'node:test';
import assert from 'node:assert/strict';
import { analyse, buildPrompt, EXAMPLES, findCuts, applyCuts } from '../dist/engine.js';

test('preserves exact requirements, negations, amounts and quoted instructions',()=>{
  const raw='Edit the attached image: open the EXISTING gate. Do not move the walkway. Keep exactly 3 posts. Budget £12.50. Text must say "do not enter".';
  assert.ok(buildPrompt(analyse(raw)).prompt.includes(raw));
});
test('does not silently remove suggested filler',()=>{
  const a=analyse('I was wondering if you could write an email to my team.');
  assert.equal(a.cuts.length,1);assert.ok(buildPrompt(a).prompt.includes(a.raw));
  const changed=buildPrompt(a,{},[a.cuts[0].id]);assert.ok(!changed.prompt.includes('I was wondering'));assert.ok(changed.prompt.includes('write an email to my team.'));
});
test('protects code, quotes and negative instructions from cuts',()=>{
  const code='Use exactly this text: "I need you to follow this."\n```js\nconsole.log("Keep this unchanged.");\nconsole.log("Keep this unchanged.");\n```\nDo not add a gate.';
  assert.equal(findCuts(code).length,0);assert.ok(buildPrompt(analyse(code)).prompt.includes(code));
});
test('only explicit selections remove repeated sentences, preserving other text',()=>{
  const raw='Keep the original walkway unchanged. Keep the original walkway unchanged. Open only the gate.';
  const cuts=findCuts(raw);assert.equal(cuts.length,1);assert.equal(applyCuts(raw,cuts,[cuts[0].id]),'Keep the original walkway unchanged. Open only the gate.');
});
test('user-supplied answers replace open questions, not the original task',()=>{
  const a=analyse('Write an email about a delay.');const b=buildPrompt(a,{audience:'The engineering team',facts:'Launch moves from 1 June to 8 June'});
  assert.ok(b.prompt.includes('Audience: The engineering team'));assert.ok(b.prompt.includes('Launch moves from 1 June to 8 June'));assert.ok(!b.unresolved.some(q=>q.id==='audience'));assert.ok(b.prompt.includes(a.raw));
});
test('fully specified details are not repeatedly asked',()=>{
  const a=analyse('Write a professional 150-word email to my team. Key facts: launch 8 June 2026; testing complete.');
  assert.equal(a.questions.length,0);assert.equal(buildPrompt(a).unresolved.length,0);
});
test('topic words do not misclassify research about programming',()=>{
  assert.equal(analyse(EXAMPLES.research).type.id,'research');
  assert.equal(analyse('Build a website for comparing image editing apps.').type.id,'coding');
});
test('image workflow recognises preservation constraints and source references',()=>{
  const a=analyse(EXAMPLES.image);assert.equal(a.type.id,'image');assert.ok(!a.questions.some(q=>q.id==='boundaries'));assert.ok(!a.questions.some(q=>q.id==='reference'));assert.ok(a.questions.some(q=>q.id==='goal'));
});
test('flags contradictory word limits but not professional and friendly tone',()=>{
  assert.ok(analyse('Write an essay of at least 500 words and at most 100 words.').conflicts.length);
  assert.equal(analyse('Write a professional but friendly email.').conflicts.length,0);
});
test('conflict resolution is recorded explicitly without silently replacing requirements',()=>{
  const a=analyse('Write at least 500 words and under 100 words.');
  const b=buildPrompt(a,{'conflict-word-limit':'Use 80 to 100 words; ignore the 500-word minimum.'});
  assert.ok(b.prompt.includes('Priority / resolved requirement: Use 80 to 100 words'));assert.ok(!b.unresolved.some(q=>q.id==='conflict-word-limit'));
});
test('unanswered questions can be omitted without fabricating their answers',()=>{
  const a=analyse('Help me plan something.');const b=buildPrompt(a,{},[],'omit');
  assert.ok(!b.prompt.includes('Clarify only if needed'));assert.ok(b.prompt.includes('Do not invent'));assert.ok(!b.prompt.includes('£100'));
});
test('rejects empty and over-limit input while preserving multilingual content',()=>{
  assert.throws(()=>analyse('   '));assert.throws(()=>analyse('x'.repeat(12001)));
  const raw='Écris un email en français. Ne change pas les noms. 你好 🌱';assert.ok(buildPrompt(analyse(raw)).prompt.includes(raw));
});
test('input resembling HTML remains literal prompt text',()=>{
  const raw='<img src=x onerror=alert(1)> Explain why this is unsafe.';
  assert.ok(buildPrompt(analyse(raw)).prompt.includes(raw));
});
test('each example produces useful questions and a complete non-placeholder result',()=>{
  for(const input of Object.values(EXAMPLES)){const a=analyse(input);const b=buildPrompt(a);assert.ok(a.questions.length>0);assert.ok(b.prompt.includes(input));assert.ok(!b.prompt.includes('undefined'));assert.ok(!b.prompt.includes('[insert'));}
});
