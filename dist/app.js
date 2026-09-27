import { analyse, buildPrompt, EXAMPLES, MAX_INPUT } from './engine.js';

const $ = id => document.getElementById(id);
const contextIds=['audience','outcome','constraints','format','tone'];
const state={analysis:null,answers:{},cuts:[],draft:null,edited:false,sourceSignature:'',appliedSignature:''};
let toastTimer;
function element(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function details(){return Object.fromEntries(contextIds.map(id=>[id,$(id).value]));}
function sourceSignature(){return JSON.stringify([$('request').value,details()]);}
function guidanceSignature(){return JSON.stringify([state.answers,state.cuts,$('missing-mode').value]);}
function notify(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3000);}
function announce(message){$('status').textContent=message;}
function updateCount(){$('character-count').textContent=`${$('request').value.length.toLocaleString('en-GB')} / 12,000`;}
function markSourceChange(){updateCount();$('input-error').hidden=true;$('request').removeAttribute('aria-invalid');if(state.analysis)$('stale-notice').hidden=sourceSignature()===state.sourceSignature;}
function mayReplace(){return !state.edited||window.confirm('Replace your manually edited draft with the newly refined prompt?');}
function selectTab(name,focus=false){for(const id of ['prompt','changes']){const active=id===name;$(id+'-tab').classList.toggle('active',active);$(id+'-tab').setAttribute('aria-selected',String(active));$(id+'-tab').tabIndex=active?0:-1;$(id+'-view').hidden=!active;}if(focus)$(name+'-tab').focus();}
function updateGuidanceStatus(){if(!state.analysis)return;const answered=state.analysis.questions.filter(q=>(state.answers[q.id]||'').trim()).length;$('answered-count').textContent=state.analysis.questions.length?`${answered} of ${state.analysis.questions.length} answered`:'No common gaps detected';$('guidance-status').textContent=guidanceSignature()===state.appliedSignature?'Nothing is assumed on your behalf.':'You have new details or choices. Update the prompt to include them.';}
function renderGuidance(){
  const a=state.analysis;$('questions').replaceChildren();$('conflict-list').replaceChildren();$('trim-list').replaceChildren();
  for(const c of a.conflicts){const card=element('div','conflict-card');card.append(element('strong','',c.title),element('span','',c.message));$('conflict-list').append(card);}
  a.questions.forEach((q,i)=>{const card=element('div','question-card');card.append(element('span','question-number',String(i+1).padStart(2,'0')));const label=element('label','',q.label);label.htmlFor=`answer-${q.id}`;const why=element('p','',q.why);why.id=`why-${q.id}`;const input=element('textarea');input.id=`answer-${q.id}`;input.rows=2;input.maxLength=1500;input.placeholder=q.placeholder;input.value=state.answers[q.id]||'';input.setAttribute('aria-describedby',why.id);input.addEventListener('input',()=>{state.answers[q.id]=input.value;updateGuidanceStatus();});card.append(label,why,input);$('questions').append(card);});
  a.cuts.forEach(c=>{const label=element('label','trim-item');const checkbox=element('input');checkbox.type='checkbox';checkbox.checked=state.cuts.includes(c.id);checkbox.addEventListener('change',()=>{state.cuts=checkbox.checked?[...state.cuts,c.id]:state.cuts.filter(id=>id!==c.id);updateGuidanceStatus();});const content=element('span');content.append(element('strong','',`“${c.text.trim()}”`),element('small','',c.reason));label.append(checkbox,content);$('trim-list').append(label);});
  $('trim-section').hidden=!a.cuts.length;
  $('guidance').hidden=false;
  $('guidance-title').textContent=a.questions.length?'Close the gaps.':'Your brief has the essentials.';
  document.querySelector('.guidance-heading p:last-child').textContent=a.questions.length?'Answer what matters. Leave the rest for the AI to ask.':'Review the draft and any optional cuts before using it.';
  updateGuidanceStatus();
}
function renderResult(){
  state.draft=buildPrompt(state.analysis,state.answers,state.cuts,$('missing-mode').value);
  state.edited=false;state.appliedSignature=guidanceSignature();
  $('empty-state').hidden=true;$('result').hidden=false;
  $('output').value=state.draft.prompt;
  $('task-label').textContent=state.analysis.type.label;
  const missing=state.draft.unresolved.length;
  $('gap-count').textContent=missing?`${missing} detail${missing===1?'':'s'} to clarify`:'Common details covered';
  $('change-count').textContent=String(state.draft.changes.length);
  $('change-list').replaceChildren(...state.draft.changes.map(change=>element('li','',change)));
  $('output-meta').textContent='You can edit this draft.';
  $('stale-notice').hidden=sourceSignature()===state.sourceSignature;
  updateGuidanceStatus();selectTab('prompt');
}
function refine({scroll=false,confirmed=false}={}){
  if(!confirmed&&!mayReplace())return false;
  let next;
  try{next=analyse($('request').value,details());}catch(error){$('input-error').textContent=error.message;$('input-error').hidden=false;$('request').setAttribute('aria-invalid','true');$('request').focus();return false;}
  const unchanged=state.analysis?.raw===next.raw;
  state.answers=unchanged?Object.fromEntries(next.questions.filter(q=>state.answers[q.id]!==undefined).map(q=>[q.id,state.answers[q.id]])):{};
  state.cuts=unchanged?state.cuts.filter(id=>next.cuts.some(c=>c.id===id)):[];
  state.analysis=next;state.sourceSignature=sourceSignature();
  $('input-error').hidden=true;$('request').removeAttribute('aria-invalid');
  renderGuidance();renderResult();
  announce(`Prompt refined. ${state.draft.unresolved.length} details to clarify. Review the refined prompt and questions.`);
  if(scroll&&window.matchMedia('(max-width: 800px)').matches)$('result-panel').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  return true;
}
function reset(){
  if(($('request').value||state.analysis)&&!window.confirm('Clear this request, its details and the refined draft?'))return;
  $('prompt-form').reset();$('missing-mode').value='ask';
  Object.assign(state,{analysis:null,answers:{},cuts:[],draft:null,edited:false,sourceSignature:'',appliedSignature:''});
  $('output').value='';$('result').hidden=true;$('empty-state').hidden=false;$('guidance').hidden=true;$('input-error').hidden=true;$('stale-notice').hidden=true;$('request').removeAttribute('aria-invalid');document.querySelector('.context-details').open=false;updateCount();$('request').focus();announce('Request and draft cleared.');
}
$('prompt-form').addEventListener('submit',e=>{e.preventDefault();refine({scroll:true});});
$('request').addEventListener('input',markSourceChange);contextIds.forEach(id=>$(id).addEventListener('input',markSourceChange));
$('request').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();refine({scroll:true});}});
$('reset').addEventListener('click',reset);
document.querySelectorAll('[data-example]').forEach(button=>button.addEventListener('click',()=>{
  if(($('request').value||state.analysis)&&!window.confirm('Replace this request and its details with the example?'))return;
  $('prompt-form').reset();$('request').value=EXAMPLES[button.dataset.example];$('missing-mode').value='ask';
  state.analysis=null;state.answers={};state.cuts=[];state.edited=false;markSourceChange();
  refine({confirmed:true,scroll:true});
}));
$('apply-details').addEventListener('click',()=>{
  if(sourceSignature()!==state.sourceSignature){notify('Your request has changed. Use “Refine my prompt” first.');$('refine').focus();return;}
  if(!mayReplace())return;
  renderResult();notify('Your details are now in the prompt.');announce('Prompt updated with your details and selected cuts.');
});
$('missing-mode').addEventListener('change',updateGuidanceStatus);
$('output').addEventListener('input',()=>{state.edited=$('output').value!==state.draft?.prompt;$('output-meta').textContent=state.edited?'Your edited version.':'You can edit this draft.';});
for(const name of ['prompt','changes']){$(name+'-tab').addEventListener('click',()=>selectTab(name));$(name+'-tab').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();selectTab(e.key==='Home'?'prompt':e.key==='End'?'changes':name==='prompt'?'changes':'prompt',true);}});}
$('copy').addEventListener('click',async()=>{
  const value=$('output').value;if(!value.trim()){notify('The draft is empty. Add some text before copying.');return;}
  try{
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
    else {selectTab('prompt');$('output').focus();$('output').select();if(!document.execCommand('copy'))throw new Error('Clipboard unavailable');}
    notify('Prompt copied. Ready for your AI tool.');
  }catch{selectTab('prompt');$('output').focus();$('output').select();notify('Copy is unavailable here. Your prompt is selected for manual copying.');}
});
document.querySelector('.quiet-link').addEventListener('click',()=>{$('how-it-works').open=true;});

// Optional WebMCP support: the same visible refinement workflow, no hidden services.
const context=document.modelContext;
if(context?.registerTool){
  const lifecycle=new AbortController();
  const tool={name:'refine_prompt',title:'Refine a prompt',description:'Replace the visible request and refine it with local rules. Returns the prompt and unanswered questions. Will not overwrite a manually edited draft.',inputSchema:{type:'object',properties:{request:{type:'string',minLength:1,maxLength:MAX_INPUT},details:{type:'object',properties:Object.fromEntries(contextIds.map(id=>[id,{type:'string',maxLength:600}])),additionalProperties:false}},required:['request'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['request','details'].includes(k))||typeof input.request!=='string'||!input.request.trim()||input.request.length>MAX_INPUT)throw new Error('Provide a non-empty request of at most 12,000 characters.');
    if(input.details!==undefined&&(!input.details||typeof input.details!=='object'||Array.isArray(input.details)||Object.entries(input.details).some(([k,v])=>!contextIds.includes(k)||typeof v!=='string'||v.length>600)))throw new Error('Details must be supported text fields of at most 600 characters.');
    if(state.edited)throw new Error('The user has edited the draft. Ask them to reset it before replacing it.');
    // Select controls must not silently discard an agent-supplied value.
    for(const id of ['format','tone'])if(input.details?.[id]&&!Array.from($(id).options).some(o=>o.value===input.details[id]))throw new Error(`Use a listed ${id} option or put the requirement in the request.`);
    $('request').value=input.request;contextIds.forEach(id=>{$(id).value=input.details?.[id]||'';});state.analysis=null;state.answers={};state.cuts=[];$('missing-mode').value='ask';updateCount();
    refine({confirmed:true});
    return {prompt:state.draft.prompt,mode:'local rules',questions:state.analysis.questions.map(q=>({id:q.id,question:q.label})),suggestedCuts:state.analysis.cuts.map(c=>({id:c.id,text:c.text,reason:c.reason}))};
  }};
  try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* The page remains fully usable in browsers without compatible registration. */}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
updateCount();
