/* medAIte's deterministic, local refinement engine. No network requests. */
export const MAX_INPUT = 12000;
export const EXAMPLES = {
  writing: "I was wondering if you could help me write an email to my team about a project delay. It needs to be professional but not cold, and I don't want it to sound like I'm blaming anyone.",
  coding: "Build me a webpage where people can track their daily habits. Make it simple and easy to use on a phone. I want something I can actually run, not just a description.",
  image: "Edit the attached image to open the existing gate. Keep the walkway, wall, camera angle and everything else exactly the same. Don't add a new gate. Make it better.",
  research: "Compare three free online courses for learning data analysis. I know some SQL, but I'm new to Python. Find the best option and explain why. Use up-to-date information."
};
const TYPES = [
  {id:"image", label:"Image & visual work", test:/\b(?:image|photo|picture|illustration|portrait|render|photograph|logo)\b/i},
  {id:"coding", label:"Code & building", test:/\b(?:code|coding|debug|bug|function|javascript|typescript|python|sql|api|webpage|website|web app|app|script|repository|react|html|css|software)\b/i},
  {id:"research", label:"Research & comparison", test:/\b(?:research|compare|comparison|sources|citations|investigate|find the best|evidence|study|studies|look up)\b/i},
  {id:"writing", label:"Writing & editing", test:/\b(?:write|rewrite|draft|email|message|letter|essay|blog|post|story|copy|cv|resume|résumé|proofread)\b/i},
  {id:"analysis", label:"Data & analysis", test:/\b(?:analyse|analyze|analysis|dataset|spreadsheet|csv|calculate|statistics|chart)\b/i},
  {id:"planning", label:"Planning", test:/\b(?:plan|schedule|itinerary|roadmap|strategy|organise|organize)\b/i},
  {id:"learning", label:"Learning & explanation", test:/\b(?:explain|teach|understand|learn|lesson|how does|what is)\b/i}
];
const question = (id, label, why, placeholder, promptLabel) => ({id,label,why,placeholder,promptLabel:promptLabel||label});
const Q = {
  goal: question("goal","What should a good result achieve?","A concrete outcome is easier to meet than “make it better”.","e.g. Help the team agree a revised delivery date","Desired result"),
  audience: question("audience","Who is the result for?","The audience changes the language, depth and examples.","e.g. A busy manager with no technical background","Audience"),
  format: question("format","What should the answer look like?","Specify the deliverable so you receive something usable.","e.g. A 150-word email, a table, or ready-to-run code","Output format"),
  facts: question("facts","Which facts must be included?","The AI needs your real details instead of filling them in.","e.g. A two-week delay; revised launch date; next steps","Required facts"),
  length: question("length","How long or detailed should it be?","A size limit helps avoid both missing detail and unnecessary text.","e.g. About 200 words, with three practical examples","Length and depth"),
  tone: question("tone","How should it sound?","A tone or short example helps the result sound appropriate.","e.g. Warm and direct, without sales language","Tone"),
  environment: question("environment","Where does this need to run?","Languages, tools and versions can change the whole solution.","e.g. A static GitHub Pages site; plain HTML, CSS and JavaScript","Technical environment"),
  features: question("features","What must the first version do?","Name the essential behaviour so the AI can keep the scope focused.","e.g. Add a habit, mark it complete, and retain it on this device","Required behaviour"),
  boundaries: question("boundaries","What must stay unchanged?","Existing behaviour, files and interfaces can be easy to overlook.","e.g. Keep the existing map layout and navigation","Boundaries"),
  verification: question("verification","How will you know it works?","An observable check makes “done” less ambiguous.","e.g. A saved habit is still there after reloading","Acceptance checks"),
  visualChange: question("visualChange","Exactly what should change?","Name the element, location and requested change.","e.g. Open the existing gate in the left-hand wall","Requested visual change"),
  reference: question("reference","What source or reference will you supply?","Include it with the final prompt; this page cannot inspect attachments.","e.g. Attach the original image and use it as the only reference","Source material"),
  style: question("style","What visual style should guide the result?","Specify the look, or say to keep the source image's style.","e.g. Preserve the original lighting, colours and perspective","Visual style"),
  scope: question("scope","What should the research cover?","A location, time period or clear set of options narrows the task.","e.g. UK options available this year; free courses only","Research scope"),
  criteria: question("criteria","What makes an option a good fit?","“Best” needs criteria that reflect your priorities.","e.g. Practical projects, beginner-friendly, under five hours a week","Comparison criteria"),
  evidence: question("evidence","What sources or dates are required?","Say whether current information and supporting links are essential.","e.g. Current official sources, with links and publication dates","Evidence requirements"),
  data: question("data","What data or material will the AI use?","The source and field meanings matter as much as the question.","e.g. Attach a CSV with order date, product and net value","Source data"),
  metric: question("metric","Which measure or question matters?","Name the calculation or decision you want the analysis to support.","e.g. Monthly return rate, defined as returned units / shipped units","Analysis objective"),
  limits: question("limits","What limits must the plan respect?","Time, money and available resources keep a plan realistic.","e.g. £100 budget; two hours each weekend; no car","Practical limits"),
  background: question("background","What do you already know?","The explanation can start at the right level.","e.g. Comfortable with basic algebra; new to quantum mechanics","Starting knowledge"),
  success: question("success","What do you want to be able to do afterwards?","A learning goal makes the explanation useful beyond definitions.","e.g. Work through one example without assistance","Learning outcome")
};
function protectedRanges(text) {
  // Never suggest removing content inside code or explicit quotations.
  const ranges=[];
  const re=/```[\s\S]*?```|`[^`\n]*`|"[^"\n]*"|“[^”]*”|‘[^’]*’|'[^'\n]*'/g;
  for(const match of text.matchAll(re)) ranges.push([match.index,match.index+match[0].length]);
  return ranges;
}
export function findCuts(text) {
  const cuts=[];const protectedText=protectedRanges(text);
  const add=(start,end,reason)=>{
    if(protectedText.some(([a,b])=>start<b&&end>a)||cuts.some(c=>start<c.end&&end>c.start))return;
    cuts.push({id:`cut-${start}-${end}`,start,end,text:text.slice(start,end),reason});
  };
  const intro=text.match(/^(?:I was (?:just )?wondering if you could(?: maybe)?(?: please)?\s+|I (?:really )?(?:need|want) you to\s+|Can you (?:please )?(?:help me to )?\s*)/i);
  if(intro)add(0,intro[0].length,"This opening can be shortened to make the requested action more direct.");
  const hyperbole=text.match(/^(?:You are (?:the world's|the worlds|an? extremely|an? incredibly) (?:best|greatest|brilliant|talented|expert)[^.!?\n]*[.!?]\s*)/i);
  if(hyperbole)add(0,hyperbole[0].length,"Broad praise does not define the task. Keep a specific role if it matters.");
  const sentences=[...text.matchAll(/[^.!?\n]+[.!?](?:\s+|$)/g)];const seen=new Set();
  for(const m of sentences){const key=m[0].trim().toLowerCase();if(key.length<20)continue;if(seen.has(key))add(m.index,m.index+m[0].length,"This repeats an earlier sentence. Remove it only if the repetition is unintentional.");else seen.add(key);}
  return cuts.slice(0,6);
}
export function applyCuts(text,cuts,selectedIds=[]) {
  const selected=new Set(selectedIds);
  const chosen=cuts.filter(c=>selected.has(c.id)).sort((a,b)=>b.start-a.start);
  for(const cut of chosen)text=text.slice(0,cut.start)+text.slice(cut.end);
  return text.trim();
}
function detectConflicts(text) {
  const result=[];
  if(/\b(?:one|single) sentence\b/i.test(text)&&/\b(?:detailed|comprehensive)\b.{0,35}\b(?:step.by.step|guide|explanation)\b/i.test(text))result.push({id:"depth",title:"Brevity and depth may compete",message:"You asked for one sentence and a detailed explanation. Decide which matters more, or request a short summary followed by details.",question:"If brevity and detail conflict, which should take priority?"});
  const lower=[...text.matchAll(/\b(?:at least|minimum(?: of)?|more than|over)\s+(\d+)\s+words\b/gi)].map(m=>Number(m[1]));
  const upper=[...text.matchAll(/\b(?:at most|maximum(?: of)?|under|less than|no more than)\s+(\d+)\s+words\b/gi)].map(m=>Number(m[1]));
  if(lower.length&&upper.length&&Math.max(...lower)>Math.min(...upper))result.push({id:"word-limit",title:"The word limits disagree",message:"The requested minimum is higher than the maximum. Choose a single range before using the prompt.",question:"Which word limit should the AI follow?"});
  if(/\b(?:change nothing|do not change anything|don't change anything)\b/i.test(text)&&/\b(?:replace|remove|recolour|recolor|redesign)\b/i.test(text))result.push({id:"preserve",title:"The boundary could be clearer",message:"The request both asks for a change and says to change nothing. Name the allowed exception explicitly.",question:"What is the permitted change, and what must stay untouched?"});
  return result;
}
function has(text,re){return re.test(text);}
export function analyse(request,details={}) {
  if(typeof request!=="string"||!request.trim())throw new Error("Add a request first — even a rough sentence is enough.");
  if(request.length>MAX_INPUT)throw new Error("Keep the request to 12,000 characters or fewer.");
  const raw=request.trim();
  const normalised={};for(const k of ["audience","outcome","constraints","format","tone"])normalised[k]=typeof details[k]==="string"?details[k].trim():"";
  const combined=[raw,...Object.values(normalised)].join("\n");
  // A comparison about programming is research; editing website code is building.
  let type=TYPES.find(t=>t.test.test(raw))||{id:"general",label:"General request"};
  if(/\b(?:compare|research|find|recommend)\b/i.test(raw)&&/\b(?:courses?|tools?|options?|products?|providers?)\b/i.test(raw))type=TYPES.find(t=>t.id==="research");
  if(/\b(?:build|debug|fix|code)\b/i.test(raw)&&/\b(?:website|webpage|app|script|function|code)\b/i.test(raw))type=TYPES.find(t=>t.id==="coding");
  const present={
    audience:!!normalised.audience||has(combined,/\b(?:my|our|the) (?:team|manager|boss|client|customer|students?|children|audience)\b|\bfor (?:a |an )?(?:beginner|expert|student|child|non.technical|technical audience)|\b(?:aged?|years? old)\b/i),
    goal:!!normalised.outcome||has(combined,/\b(?:so that|in order to|the goal is|the aim is|success means)\b/i),
    format:!!normalised.format||has(combined,/\b(?:email|table|bullet(?:s| points)?|json|csv|paragraph|essay|checklist|working code|ready.to.run|step.by.step|image|photo|webpage|website|app|script|letter|report|poem)\b/i),
    tone:!!normalised.tone||has(combined,/\b(?:friendly|professional|formal|informal|warm|direct|casual|technical|funny|empathetic|polite|not cold|conversational)\b/i),
    length:has(combined,/\b(?:\d+|one|two|three|four|five|six|ten)[\s-]+(?:words?|sentences?|paragraphs?|pages?|bullets?|minutes?)\b|\b(?:concise|brief|short|detailed|comprehensive)\b/i),
    environment:has(combined,/\b(?:javascript|typescript|python|react|vue|angular|html|css|node|postgres|mysql|sqlite|excel|windows|android|ios|github pages|browser.only|static site|no framework)\b/i),
    boundaries:!!normalised.constraints||has(combined,/\b(?:keep|preserve|unchanged|don't|do not|must not|without|avoid|only change|same)\b/i),
    reference:has(combined,/\b(?:attached|attachment|pasted below|provided (?:image|data|file|text)|this (?:image|photo)|https?:\/\/)\b/i),
    visualChange:has(combined,/\b(?:open|close|remove|add|replace|change|recolour|recolor|crop|brighten|darken)\b/i),
    style:has(combined,/\b(?:realistic|photorealistic|watercolour|watercolor|anime|cartoon|oil painting|minimalist|same style|original style|keep.{0,30}style|preserve.{0,30}style)\b/i),
    evidence:has(combined,/\b(?:sources?|citations?|links?|up.to.date|current|latest|official|published|publication)\b/i),
    scope:has(combined,/\b(?:uk|united kingdom|england|us|usa|europe|within|between \d|20\d\d|free|under £|under \$)\b/i),
    criteria:has(combined,/\b(?:prioriti[sz]e|criteria|most important|rank by|judged by|based on (?:cost|time|quality))\b/i),
    data:has(combined,/\b(?:attached|csv|spreadsheet|dataset|pasted|columns?|provided data)\b/i),
    metric:has(combined,/\b(?:average|sum|median|ratio|rate|percentage|correlation|trend|forecast)\b/i),
    limits:!!normalised.constraints||has(combined,/\b(?:budget|deadline|hours? per|hours? a|minutes? a|by (?:monday|tuesday|wednesday|thursday|friday)|free)\b|[£$€]\s*\d/i),
    background:has(combined,/\b(?:beginner|new to|already know|I know|familiar with|experience with|studied)\b/i),
    features:has(combined,/\b(?:allow|able to|where (?:people|users)|users? can|add.{0,20}(?:habit|task|item)|track)\b/i),
    verification:has(combined,/\b(?:test|verify|check that|acceptance|works when|done when|after reload)\b/i),
    facts:has(combined,/\b(?:include these|key facts|revised date|new deadline|20\d\d)\b/i)
  };
  const lists={writing:["audience","facts","tone","length"],coding:["features","environment","boundaries","verification"],image:["visualChange","boundaries","reference","style"],research:["scope","criteria","evidence","format"],analysis:["data","metric","format","audience"],planning:["goal","limits","format","audience"],learning:["background","success","format","length"],general:["goal","audience","format","boundaries"]};
  const ids=lists[type.id].filter(id=>!present[id]);
  if(/\b(?:better|best|amazing|perfect|nice|good|simple|professional looking)\b/i.test(raw)&&!present.goal&&!ids.includes("goal")&&type.id!=="research")ids.unshift("goal");
  const conflicts=detectConflicts(raw);
  const conflictQuestions=conflicts.map(c=>question(`conflict-${c.id}`,c.question,"This resolves the possible conflict highlighted above.","Specify which requirement takes priority","Priority / resolved requirement"));
  const questions=[...conflictQuestions,...ids.slice(0,5).map(id=>Q[id])];
  return {raw,details:normalised,type:{id:type.id,label:type.label},questions,cuts:findCuts(raw),conflicts,present};
}
export function buildPrompt(analysis,answers={},selectedCuts=[],missingMode="ask") {
  const cleaned=applyCuts(analysis.raw,analysis.cuts,selectedCuts);
  const parts=[`Task\n${cleaned}`];
  const detailLabels={audience:"Audience",outcome:"Desired result",constraints:"Boundaries and constraints",format:"Output format",tone:"Tone"};
  const supplied=Object.entries(analysis.details).filter(([,v])=>v).map(([k,v])=>`${detailLabels[k]}: ${v}`);
  for(const q of analysis.questions){const answer=typeof answers[q.id]==="string"?answers[q.id].trim():"";if(answer)supplied.push(`${q.promptLabel}: ${answer}`);}
  if(supplied.length)parts.push(`Additional details from me\n${supplied.join("\n")}`);
  const unresolved=analysis.questions.filter(q=>!String(answers[q.id]||"").trim());
  if(unresolved.length&&missingMode==="ask")parts.push(`Clarify only if needed\nIf any of these missing details would materially change the result, ask me before proceeding. Otherwise, keep assumptions minimal and state them.\n${unresolved.map(q=>`- ${q.label}`).join("\n")}`);
  if(missingMode==="omit")parts.push("Working instruction\nFollow the requirements above. Do not invent missing facts, source material or constraints.");
  else if(!unresolved.length)parts.push("Completion check\nFollow the requirements and format above. Preserve all stated constraints. If any requirements conflict, point out the conflict instead of silently choosing one.");
  const applied=analysis.cuts.filter(c=>selectedCuts.includes(c.id));
  const changes=[applied.length?`Removed ${applied.length} piece${applied.length===1?"":"s"} of wording you selected. All other wording in your original request is preserved.`:"Preserved your original request, including its facts, restrictions and specific wording.","Separated the task from any extra details so the AI can identify the deliverable."];
  if(supplied.length)changes.push(`Included ${supplied.length} detail${supplied.length===1?"":"s"} you supplied, without treating suggestions as facts.`);
  if(unresolved.length)changes.push(missingMode==="ask"?`Kept ${unresolved.length} unanswered detail${unresolved.length===1?"":"s"} as conditional questions. The AI is asked to clarify only when the answer matters.`:`Left ${unresolved.length} unanswered question${unresolved.length===1?"":"s"} out of the prompt at your request.`);
  if(analysis.conflicts.length)changes.push("Flagged potentially competing instructions for you to resolve.");
  if(analysis.present.reference)changes.push("The request refers to source material. Include that material when you send the prompt to an AI; medAIte has not inspected it.");
  return {prompt:parts.join("\n\n"),changes,unresolved,applied,suppliedCount:supplied.length};
}
