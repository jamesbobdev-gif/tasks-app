/* ── questions, one at a time ──
   When the Agent needs answers (a skill's setup, or a choice), it sends them as t.ask:
   [{q, choices, pick:'one'|'many', default:[...], other}]. Instead of typing a reply, he taps through
   them: one question per step, the usual answer already picked, Back / Next, then Send. The answers
   go back as one reply ("Store: Walmart (EBT)" per line). Where he is in the steps is kept per task
   while the app is open (askDrafts), not synced. One of the page scripts in renderer/js. */
'use strict';
const askDrafts={}; // task id → {i, picks:[[...]], other:[...]}

function askDraft(t){
  let d=askDrafts[t.id];
  if(!d||d.picks.length!==t.ask.length)d=askDrafts[t.id]={i:0,picks:t.ask.map(function(a){ return (a.default||[]).slice(); }),other:t.ask.map(function(){ return ''; }),many:t.ask.map(function(a){ return a.pick==='many'; })};
  return d;
}
function askAnswer(picks,other){
  const parts=picks.slice(); if(other.trim())parts.push(other.trim());
  return parts.join(', ');
}
function askSteps(t){
  const box=el('div','ask-box');
  box.addEventListener('click',function(e){ e.stopPropagation(); });
  const draw=function(){
    box.innerHTML='';
    const d=askDraft(t), n=t.ask.length, a=t.ask[d.i], last=d.i===n-1, many=d.many[d.i];
    box.appendChild(el('div','ask-count',n>1?'Question '+(d.i+1)+' of '+n:'Question'));
    box.appendChild(el('div','ask-q',a.q));
    const next=el('button','btn-accent',last?'Send answers':'Next ›');
    const chips=el('div','ask-chips');
    a.choices.forEach(function(c){
      const on=d.picks[d.i].indexOf(c)!==-1;
      const b=el('button','ask-chip'+(on?' on':''),c); b.setAttribute('aria-pressed',String(on));
      b.addEventListener('click',function(){
        const p=d.picks[d.i], k=p.indexOf(c);
        if(many){ if(k===-1)p.push(c); else p.splice(k,1); }
        else { d.picks[d.i]=[c]; d.other[d.i]=''; if(!last){ buzz('tap'); d.i++; } } // one answer: on to the next question
        draw();
      });
      chips.appendChild(b);
    });
    if(a.choices.length)box.appendChild(chips);
    // asked for one answer, but he isn't sure yet: let him pick several for this question
    if(!many&&a.choices.length>1){
      const several=el('button','ask-several','Pick more than one');
      several.addEventListener('click',function(){ d.many[d.i]=true; draw(); });
      box.appendChild(several);
    }
    if(a.other){
      const inp=el(a.choices.length?'input':'textarea','ask-other');
      inp.placeholder=a.choices.length?'Or type your own…':'Type your answer…';
      inp.value=d.other[d.i];
      inp.addEventListener('input',function(){
        d.other[d.i]=inp.value;
        if(!many&&inp.value.trim()){ d.picks[d.i]=[]; chips.querySelectorAll('.ask-chip.on').forEach(function(x){ x.classList.remove('on'); }); }
      });
      inp.addEventListener('keydown',function(e){ e.stopPropagation(); if(e.key==='Enter'&&!e.shiftKey&&inp.tagName==='INPUT'){ e.preventDefault(); next.click(); } });
      box.appendChild(inp);
    }
    const nav=el('div','ask-nav');
    const back=el('button','ask-back','‹ Back'); back.disabled=d.i===0;
    back.addEventListener('click',function(){ d.i--; draw(); });
    nav.appendChild(back);
    // the rest as they are (the usual answers already picked): straight to the last one
    if(n>2&&d.i<n-1){ const skip=el('button','ask-skip','Use the usual for the rest'); skip.addEventListener('click',function(){ d.i=n-1; draw(); }); nav.appendChild(skip); }
    next.addEventListener('click',function(){
      if(!last){ d.i++; draw(); return; }
      const lines=t.ask.map(function(q,i){ const ans=askAnswer(d.picks[i],d.other[i]); return (n>1?(i+1)+'. ':'')+q.q.replace(/\?\s*$/,'')+': '+(ans||'(no answer)'); });
      const msg=lines.join('\n');
      const lt=liveTask(t);
      lt.reply=msg; agentSay(lt,'you',msg); lt.status='queued'; delete askDrafts[t.id];
      buzz('send'); touch();
    });
    nav.appendChild(next);
    box.appendChild(nav);
    // progress dots: tap one to go back to that question
    if(n>1){
      const dots=el('div','ask-dots');
      t.ask.forEach(function(q,i){
        const dt=el('button','ask-dot'+(i===d.i?' on':'')+(d.picks[i].length||d.other[i].trim()?' done':''));
        dt.setAttribute('aria-label','Question '+(i+1)); dt.title=q.q;
        dt.addEventListener('click',function(){ d.i=i; draw(); });
        dots.appendChild(dt);
      });
      box.appendChild(dots);
    }
  };
  draw();
  return box;
}
