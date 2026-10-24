/* The lists: each task row, its subtask panel, and rendering a list (Human, Agent, School, Work).
   One of the page scripts in renderer/js: they share one global scope and load in the order index.html lists them. */
'use strict';

/* ── main task row ── */
function buildRow(t,canDrag){
  const li=el('li','task'+(t.done?' done':'')+(t.id===state.selectedId?' selected':''));
  li.dataset.id=t.id;
  const row=el('div','row');
  if(canDrag){
    const grip=el('div','grip'); grip.innerHTML=I.grip; grip.title='Drag to reorder'; grip.setAttribute('aria-hidden','true');
    grip.addEventListener('mousedown',function(){ li.draggable=true; });
    grip.addEventListener('mouseup',function(){ li.draggable=false; });
    row.appendChild(grip); makeDraggable(li,t);
  }
  const check=el('button','check'+(t.done?' on':'')); check.innerHTML=I.check;
  check.setAttribute('aria-label',t.done?'Mark as not done':'Mark as done');
  check.addEventListener('click',function(e){ e.stopPropagation(); toggleDone(t,li,check); });
  const title=el('span','title',t.title);
  const meta=el('div','meta');

  // subtask progress — turn red if any sub is overdue
  if(t.subs.length){
    const doneCount=t.subs.filter(function(s){ return s.done; }).length;
    const subLate=t.subs.filter(function(s){ return !s.done&&s.due&&dateInfo(s.due).diff<0; }).length;
    meta.appendChild(el('span','progress'+(subLate?' sub-late':''),doneCount+'/'+t.subs.length));
  }
  let dueDiff=null;
  if(t.due){
    const info=dateInfo(t.due,t.dueTime);
    dueDiff=info.diff;
    const dateBtn=el('button','chip date'+(info.cls?' '+info.cls:''),info.text);
    dateBtn.title='View in calendar';
    dateBtn.addEventListener('click',function(e){
      e.stopPropagation();
      const p=t.due.split('-').map(Number);
      state.calYear=p[0]; state.calMonth=p[1]-1;
      switchTab('calendar');
    });
    meta.appendChild(dateBtn);
  }
  if(t.tag){
    const tagChip=el('button','chip tag',t.tag); tagChip.setAttribute('aria-label','Filter by tag '+t.tag);
    tagChip.addEventListener('click',function(e){ e.stopPropagation(); state.filter=(state.filter===t.tag)?null:t.tag; render(); });
    meta.appendChild(tagChip);
  }
  if(workConfigured()&&taskWs(t)==='work'&&state.wsFilter!=='work'&&state.activeTab!=='work'){
    meta.appendChild(el('span','chip ws','work'));
  }
  // what the morning swipe decided: picked for today, or pushed to tomorrow's deck
  if(!t.done&&t.plan){
    const today=formatDate(new Date());
    // worded as a decision, not a date, so it can't read as a second due date; and nothing when
    // it would just repeat the due chip ("today · today")
    if(t.plan===today&&t.planSet===today&&t.due!==today){ const c=el('span','chip plan','doing today'); c.title='You picked this for today'; meta.appendChild(c); }
    else if(t.plan>today){ const c=el('span','chip plan later','↪ moved to tomorrow'); c.title='You swiped this to tomorrow — it comes back in tomorrow’s deck'; meta.appendChild(c); }
  }
  if(taskWs(t)==='school'){
    if(state.activeTab!=='school')meta.appendChild(el('span','chip school','school'));
    else {
      const k=schoolKind(t); if(k!=='regular')meta.appendChild(el('span','chip school',k));
      const f=schoolShowFrom(t);
      if(!t.done&&f&&todayStart()<f){ const c=el('span','chip later','in list '+f.toLocaleDateString('en-US',{month:'short',day:'numeric'})); c.title='Joins your Human list on this day'; meta.appendChild(c); }
    }
  }
  const isAgentTask=taskWs(t)==='agent';
  if(!isAgentTask&&t.recur&&!t.done&&RECUR_CHIPS[t.recur.every]){ const rc=el('span','chip recur','↻ '+RECUR_CHIPS[t.recur.every]); rc.title='Repeats: tick it off and the next one appears'; meta.appendChild(rc); }
  if(isAgentTask&&t.repeat){ const rc=el('span','chip st','↻ '+(t.repeat.every==='day'?'daily':t.repeat.every==='weekday'?'weekdays':'weekly')); rc.title=repeatText(t.repeat); meta.appendChild(rc); }
  if(isAgentTask&&!t.done){
    const st=t.status==='working'?['working','working']:t.status==='needs-you'?(t.parked?['','stalled']:['needs','needs you']):t.status==='done'?['ready','finished']:(t.waitUntil&&t.waitUntil>Date.now())?['','after reset']:['','waiting'];
    const sc=el('span','chip st'+(st[0]?' '+st[0]:''),st[1]);
    if(t.status==='working')sc.insertBefore(el('span','spin'),sc.firstChild); // a spinner so you can see it's going
    sc.title=t.status==='needs-you'&&t.parked?'You parked this — the Agent’s answer is still in it, it just doesn’t count as needing you':t.status==='needs-you'?'The Agent got as far as it could — expand for what it needs from you':t.status==='working'?'Claude is on it':t.status==='done'?'Claude finished — check it off when you’re happy with it':'Queued for Claude’s next run';
    // "needs you" ⇄ "stalled": tap the chip to set it aside (still here, no longer counted as needing you) or bring it back
    if(t.status==='needs-you'){
      sc.classList.add('tap'); sc.setAttribute('role','button'); sc.tabIndex=0;
      sc.title=t.parked?'Stalled — tap to mark it as needing you again':'Needs you — tap to mark it stalled (set aside for now)';
      const flip=function(e){ e.stopPropagation(); if(t.parked)delete t.parked; else t.parked=true; touch(); };
      sc.addEventListener('click',flip);
      sc.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); flip(e); } });
    }
    meta.appendChild(sc);
    // which worker it's assigned to (Claude on this computer, or your own model on the mini PC)
    if(t.lane==='local'){ const lc=el('span','chip st','The local model'); lc.title='Your own model on the local model handles this task'; meta.appendChild(lc); } // Claude is the usual case: no chip
  }
  // snooze: overdue → today, due today → tomorrow
  if(!t.done&&dueDiff!==null&&dueDiff<=0){
    const snz=iconBtn(I.snooze,dueDiff<0?'Snooze to today':'Snooze to tomorrow');
    snz.title=dueDiff<0?'Snooze to today':'Snooze to tomorrow';
    snz.addEventListener('click',function(e){
      e.stopPropagation();
      const base=new Date(); if(dueDiff===0)base.setDate(base.getDate()+1);
      t.due=formatDate(base); touch();
    });
    meta.appendChild(snz);
  }
  const pen=iconBtn(I.pen,'Edit task');
  pen.addEventListener('click',function(e){ e.stopPropagation(); startEdit(t,li.querySelector('.title')); });
  const isExp=state.expanded.has(t.id);
  const chev=iconBtn(I.chev,isExp?'Hide subtasks':'Show subtasks','expand'+(isExp?' open':''));
  chev.addEventListener('click',function(e){ e.stopPropagation(); toggleExpand(t); });
  const del=iconBtn(I.x,'Delete task');
  del.addEventListener('click',function(e){ e.stopPropagation(); deleteTask(t); });
  meta.appendChild(pen);
  if(agentAvailable()){
    const back=t.fromWs==='school'&&schoolConfigured()?'school':t.fromWs==='work'&&workConfigured()?'work':'personal';
    const mvLabel=isAgentTask?(back==='school'?'Move back to School (I\u2019ll do it)':back==='work'?'Move back to Work (I\u2019ll do it)':'Move to Human (I\u2019ll do it)'):'Hand to the Agent (it does it for you)';
    const mv=iconBtn(isAgentTask?I.human:I.bot,mvLabel); mv.title=mvLabel;
    mv.addEventListener('click',function(e){ e.stopPropagation(); moveTask(t,isAgentTask?back:'agent'); });
    meta.appendChild(mv);
  }
  meta.appendChild(chev); meta.appendChild(del);
  row.appendChild(check); row.appendChild(title); row.appendChild(meta);
  row.addEventListener('click',function(){ state.selectedId=t.id; toggleExpand(t); });
  li.appendChild(row);
  if(isExp) li.appendChild(buildPanel(t));
  return li;
}
function toggleExpand(t){ if(state.expanded.has(t.id))state.expanded.delete(t.id); else state.expanded.add(t.id); render(); }

/* ── subtask panel ── */
function buildPanel(t){
  const panel=el('div','panel');
  panel.addEventListener('click',function(e){ e.stopPropagation(); });
  panel.addEventListener('pointerdown',function(){ lastPanelId=t.id; });
  panel.addEventListener('focusin',function(){ lastPanelId=t.id; });

  // a model is answering right now (or it's being handed to one): spinners on the toggle, the pill and the conversation
  const spinning=taskWs(t)==='agent'&&!t.done&&(t.status==='working'||(t.status==='queued'&&!(t.waitUntil&&t.waitUntil>Date.now())))
    &&!(t.lane==='local'&&localStat&&localStat.configured&&!localStat.online);
  // the whole back-and-forth on this task, collapsed until tapped
  if(taskWs(t)==='agent'&&Array.isArray(t.history)&&t.history.length){
    const hist=t.history, open=convOpen.has(t.id);
    const tg=el('button','conv-toggle',(open?'\u25BE':'\u25B8')+' Conversation ('+hist.length+')');
    tg.setAttribute('aria-expanded',String(open));
    if(spinning)tg.appendChild(el('span','spin conv-spin'));
    tg.addEventListener('click',function(){ if(convOpen.has(t.id))convOpen.delete(t.id); else convOpen.add(t.id); render(); });
    panel.appendChild(tg);
    if(open){
      const th=el('div','conv');
      hist.forEach(function(h){
        const who=h.who==='you'?'you':h.who==='claude'?'claude':'sys';
        const b=el('div','conv-msg '+who);
        const seen=who==='you'&&(h.heard||(liveHeard[t.id]||[]).indexOf(h.at)!==-1); // Claude took it mid-run
        if(who!=='sys')b.appendChild(el('div','conv-who',(who==='you'?'You':h.lane==='local'?'Local model':CLOUD_NAMES[h.via]||'Claude')+(who==='claude'&&h.model?' ('+String(h.model).replace(/^models\//,'')+')':'')+' \u00B7 '+fmtWhen(h.at)+(seen?' \u00B7 \u2713 seen while working':'')));
        b.appendChild(el('div',null,who==='sys'?h.text+' \u00B7 '+fmtWhen(h.at):h.text));
        if(Array.isArray(h.images)&&h.images.length)b.appendChild(photoStrip(h.images));
        if(Array.isArray(h.options)&&h.options.length)b.appendChild(el('div','conv-opts','Showed: '+h.options.join(' \u00B7 ')));
        if(who==='claude'&&isDocAnswer(h.text))b.appendChild(docButton(t.title,h.text));
        if(h.thoughts)b.appendChild(thoughtsBox(t,h));
        th.appendChild(b);
      });
      if(spinning){ // a "typing" line at the bottom while the answer is coming
        const w=el('div','conv-msg claude conv-typing');
        w.appendChild(el('span','spin'));
        w.appendChild(document.createTextNode((t.lane==='local'?'The local model':cloudNameOf(t))+(t.status==='working'?' is working on it…':' is starting…')));
        th.appendChild(w);
      }
      panel.appendChild(th);
      requestAnimationFrame(function(){ th.scrollTop=th.scrollHeight; }); // newest at the bottom, like a chat
    }
  }

  // what Claude did / what it needs from you
  const agentBusy=taskWs(t)==='agent'&&!t.done&&(t.status==='working'||t.status==='queued');
  if(agentBusy){
    const sb=el('div','agent-note agent-busy');
    const outOfUsage=t.status==='queued'&&t.waitUntil&&t.waitUntil>Date.now();
    const local=t.lane==='local';
    const offline=local&&localStat&&localStat.configured&&!localStat.online;
    const cloudName=cloudNameOf(t);
    if(t.status==='working')sb.classList.add('running');
    // queued: it's being handed to a model (no lane yet = routing hasn't picked one)
    const routing=t.status==='queued'&&!outOfUsage&&!offline;
    const hd=sb.appendChild(el('b',null,local?(offline?'The local model isn’t reachable':t.status==='working'?'The local model is on it':'Routing to the local model'):t.status==='working'?cloudName+' is on it':outOfUsage?cloudName+' is out of usage':t.lane?'Routing to '+cloudName:'Routing to a model'));
    if((t.status==='working'||routing)&&!offline)hd.insertBefore(el('span','spin'),hd.firstChild);
    sb.appendChild(document.createTextNode(local
      ?(offline?'It doesn’t answer at '+(localStat.address||'its address')+'. Is it on and on Wi-Fi? Or switch this task to Claude below.'
        :t.status==='working'?'Your own model'+(localStat&&localStat.model?' ('+localStat.model+')':'')+' is slower than Claude: usually a few minutes. Watch it work below.'
        :'It starts within a few seconds while your computer has Tasks running.')
      :t.status==='working'
      ?(cloudName==='Claude'?'Write below to steer it: it reads your message after its next step.':'Usually under a minute. You can still add to your answer below.')
      :outOfUsage?'Picks this up automatically '+fmtWhen(t.waitUntil)+', when your usage resets. Nothing for you to do.'
      :'It starts within a few seconds while your computer has Tasks running.'));
    if(!outOfUsage&&window.desktop&&window.desktop.agentRetry)sb.appendChild(retryButton(t));
    panel.appendChild(sb);
    // Claude's checklist while it works (agent/run-live.js), filled live without a re-render
    if(!local&&t.status==='working'){
      const pl=el('ul','agent-plan'); pl.setAttribute('data-id',t.id); pl.setAttribute('aria-label','Plan');
      fillPlan(pl,livePlan[t.id]);
      panel.appendChild(pl);
    }
    // the agent browser, live, right in the card (agent-live-view.js): shows once it has a page up
    if(!local&&t.status==='working'&&liveViewAvailable()){
      const slot=el('div','live-slot'); panel.appendChild(slot);
      liveEmbed(slot,t.id);
    }
    // working: what it's searching, reading and clicking, live (the mini PC always; Claude once it has started)
    if(t.status==='working'&&(local||liveText[t.id])){
      const lv=el('pre','agent-live',liveText[t.id]||'Starting…');
      lv.setAttribute('data-id',t.id); lv.setAttribute('aria-live','polite');
      panel.appendChild(lv);
      setTimeout(function(){ lv.scrollTop=lv.scrollHeight; },0);
    }
  }
  // who does it: a two-part pill, [cloud AI ▾ | mini PC model], with a highlight that slides between them.
  // The cloud half is a menu of every cloud AI, so the pill stays the same size however many there are.
  // Switching asks first; a first pick (no rule matched) doesn't.
  if(taskWs(t)==='agent'&&!t.done&&agentAvailable()){
    const now=laneNow(t), onCloud=!!now&&now!=='local';
    const tg=el('div','lane-slider '+(now||'none')); tg.setAttribute('role','radiogroup'); tg.setAttribute('aria-label','Who does this task');
    tg.style.setProperty('--n',2); tg.style.setProperty('--i',now==='local'?1:0);
    const cw=el('label','lane-word lane-cloud'+(onCloud?' on':''));
    const pick=document.createElement('select'); pick.className='lane-pick';
    pick.setAttribute('aria-label','Cloud AI');
    if(!onCloud){ const ph=el('option',null,'Cloud AI'); ph.value=''; ph.disabled=true; ph.hidden=true; pick.appendChild(ph); }
    Object.keys(LANE_NAMES).filter(function(id){ return id!=='local'; }).forEach(function(id){
      const op=el('option',null,LANE_NAMES[id]); op.value=id; pick.appendChild(op);
    });
    pick.value=onCloud?now:'';
    cw.title=onCloud?LANE_NAMES[now]+' has this task. Pick another cloud AI to switch (asks first)':(now?'Switch this task to a cloud AI (asks first)':'Send this task to a cloud AI');
    pick.addEventListener('click',function(e){ e.stopPropagation(); });
    pick.addEventListener('change',function(e){ e.stopPropagation(); if(pick.value&&pick.value!==now)setLane(t,pick.value); });
    if(spinning&&onCloud)cw.appendChild(el('span','spin'));
    cw.appendChild(pick); cw.appendChild(el('span','lane-caret','▾'));
    tg.appendChild(cw);
    const lw=el('button','lane-word'+(now==='local'?' on':''),localModelName());
    if(spinning&&now==='local')lw.insertBefore(el('span','spin'),lw.firstChild);
    lw.setAttribute('role','radio'); lw.setAttribute('aria-checked',String(now==='local'));
    lw.title=now==='local'?'The local model ('+localModelName()+') has this task':(now?'Switch this task to the local model (asks first)':'Send this task to the local model');
    lw.addEventListener('click',function(e){ e.stopPropagation(); if(now!=='local')setLane(t,'local'); });
    tg.appendChild(lw);
    panel.appendChild(tg);
    const ask=laneAsks[t.id];
    if(ask&&ask!==now){
      const name=LANE_NAMES[ask];
      const ar=el('div','lane-ask');
      ar.appendChild(el('span',null,ask==='local'?'Send this task to the local model? It takes over with the whole conversation.'
        :'Send this task to '+name+'? '+name+' will see the whole conversation, including anything the others wrote.'));
      const yes=el('button','btn-accent','Switch'), no=el('button','btn-ghost','Cancel');
      yes.addEventListener('click',function(e){ e.stopPropagation(); setLane(t,ask,true); });
      no.addEventListener('click',function(e){ e.stopPropagation(); delete laneAsks[t.id]; render(); });
      ar.appendChild(yes); ar.appendChild(no);
      panel.appendChild(ar);
    } else if(ask)delete laneAsks[t.id];
  }
  // a stale failure message isn't worth showing once the task is being retried
  const failed=/couldn’t finish/i.test(t.note||'');
  const staleFail=agentBusy&&failed;
  if(taskWs(t)==='agent'&&t.note&&!staleFail){
    const nb=el('div','agent-note');
    const who=t.lane==='local'?'The local model':cloudNameOf(t);
    const stuck=t.status==='needs-you'&&!agentBusy&&t.stuck;
    if(agentBusy||stuck||t.status!=='needs-you')nb.appendChild(el('b',null,agentBusy?who+'’s last message':stuck?'Stopped':'From '+who)); // who it was is on the task's badge
    if(stuck){
      // why, then what to do: plain lines, the fix quieter
      const sk=el('div','stuck');
      if(t.stuck.reason)sk.appendChild(el('div',null,t.stuck.reason));
      if(t.stuck.fix)sk.appendChild(el('div','stuck-fix',t.stuck.fix));
      nb.appendChild(sk);
      // the model's own note, when it says more than the reason above
      if(t.note&&t.note.indexOf(t.stuck.reason)===-1)nb.appendChild(el('div','stuck-note',t.note));
      if(t.shot){ const ps=photoStrip([t.shot],'stuck-shot'); const im=ps.querySelector('img'); if(im){ im.alt='What the browser showed'; im.title='What the browser showed when it stopped. Click to enlarge'; } nb.appendChild(ps); }
    } else if(wantsYes(t)&&Array.isArray(t.cart)&&t.cart.length)nb.appendChild(noteFold(t)); // the cards do the talking: just its first line, the rest on a tap
    else nb.appendChild(document.createTextNode(t.note));
    if(!stuck&&isDocAnswer(t.note))nb.appendChild(docButton(t.title,t.note)); // an essay or a letter: save it as a Word file
    // the latest answer's "What it did", right under it (older ones are in the conversation)
    const lastAns=(t.history||[]).filter(function(h){ return h.who==='claude'; }).slice(-1)[0];
    // "What it did" and Retry share one line
    const foot=el('div','note-foot');
    if(lastAns&&lastAns.thoughts&&t.status!=='working')foot.appendChild(thoughtsBox(t,lastAns));
    if(!agentBusy&&!t.done&&t.status==='needs-you'&&(stuck||failed)&&window.desktop&&window.desktop.agentRetry)foot.appendChild(retryButton(t));
    if(foot.firstChild)nb.appendChild(foot);
    if(!t.done&&t.status==='needs-you'&&t.lane!=='local'&&liveViewAvailable())nb.appendChild(watchButton(t)); // e.g. to log in, or check a cart (its own tabs: fine while another task runs)
    panel.appendChild(nb);
  }
  // questions to tap through, one at a time (agent-ask.js)
  if(taskWs(t)==='agent'&&!t.done&&t.status==='needs-you'&&Array.isArray(t.ask)&&t.ask.length)panel.appendChild(askSteps(t));
  // options Claude found (e.g. products): photo, blurb, link, and one-tap choose
  if(taskWs(t)==='agent'&&Array.isArray(t.options)&&t.options.length){
    const grid=el('div','agent-opts');
    const canPick=!t.done;
    const opts=t.options.slice(0,10);
    opts.forEach(function(o,i){
      const label=String(o.label||('Option '+(i+1)));
      const card=el('div','agent-opt'+(t.reply&&t.reply.indexOf(label)!==-1?' picked':''));
      // no picture (or one that won't load): a tile with the site's name, so every card's text lines up
      const noPic=function(){ return el('div','opt-nopic',o.url?siteName(o.url):label.charAt(0)); };
      if(o.image&&/^https:\/\//i.test(String(o.image))){ const im=document.createElement('img'); im.src=o.image; im.alt=label; im.loading='lazy'; im.referrerPolicy='no-referrer'; im.addEventListener('error',function(){ im.replaceWith(noPic()); });
        // a wide page banner fills the frame; a product shot stays whole on white
        im.addEventListener('load',function(){ if(im.naturalWidth>im.naturalHeight*1.25)im.classList.add('wide'); });
        im.title='Click to enlarge'; im.addEventListener('click',function(e){ e.stopPropagation(); openLightbox(opts,i); }); card.appendChild(im); }
      else card.appendChild(noPic());
      card.appendChild(el('div','opt-label',(i+1)+'. '+label));
      if(o.desc)card.appendChild(el('div','opt-desc',String(o.desc)));
      const metaBits=[o.price,o.rating].filter(Boolean);
      if(metaBits.length)card.appendChild(el('div','opt-meta',metaBits.join(' · ')));
      const btns=el('div','opt-btns');
      const kind=isAmazon(o.url)?'amazon':isTicketSite(o.url)?'tickets':optionKind(o.url);
      if(o.url){ const ob=el('button','opt-open',siteName(o.url)+' ↗'); ob.addEventListener('click',function(){ openExternal(String(o.url)); }); btns.appendChild(ob);
        const sb=el('button','opt-share'); sb.innerHTML=SHARE_ICON; sb.title='Send this link to someone'; sb.setAttribute('aria-label','Share link'); sb.addEventListener('click',function(e){ e.stopPropagation(); shareLink(o.url,sb); }); btns.appendChild(sb);
        // email the link to yourself (the desktop sends it; nothing is picked or bought);
        // not when "Send me link" below already does exactly that
        if(!(canPick&&kind==='link')){ const mb=el('button','opt-share'); mb.innerHTML=MAIL_ICON; mb.title='Email this link to yourself'; mb.setAttribute('aria-label','Email to myself');
        mb.addEventListener('click',function(e){ e.stopPropagation(); t.buyEmail={label:label,url:String(o.url),price:o.price||null,rating:o.rating||null,image:(o.image&&/^https:\/\//i.test(String(o.image)))?String(o.image):null,kind:'link',at:Date.now()}; agentSay(t,'sys','📧 Emailing you the link to '+label+'.'); buzz('send'); touch(); });
        btns.appendChild(mb); } }
      if(canPick){
        const pb=el('button','opt-pick',kind==='print'?'Print this':kind==='link'?'Send me link':(kind==='amazon'||kind==='tickets')?'Buy this':'Choose this');
        pb.title=kind==='print'?'Picks this model and emails it to you to print':kind==='link'?'Picks this and emails you the link':kind==='buy'?'Picks this and emails you the link to buy it':kind==='amazon'?'The Agent gets the Amazon order ready and shows it to you; it’s only placed after you reply yes':kind==='tickets'?'The Agent gets the booking ready and shows you the total; it’s only bought after you reply yes':'Picks this option';
        pb.addEventListener('click',function(){ const pick=(kind==='print'?'I’ll print option ':'I choose option ')+(i+1)+': '+label+(kind==='amazon'?'. Buy it on Amazon.':kind==='tickets'?'. Book it.':''); t.reply=(agentBusy&&t.reply)?t.reply+'\n'+pick:pick; agentSay(t,'you',pick); buzz('send'); if(t.status!=='working')t.status='queued'; delete replyDrafts[t.id]; saveDrafts();
          // Amazon and ticket sites: The Agent builds the order and asks for a yes before placing it
          if(kind==='amazon')agentSay(t,'sys','🛒 Getting the Amazon order ready. You’ll see it before anything is bought.');
          else if(kind==='tickets')agentSay(t,'sys','🎟 Getting the booking ready. You’ll see the total before anything is bought.');
          // other links: stage an email with it — the desktop sends it (never orders anything)
          else if(o.url){ t.buyEmail={label:label,url:String(o.url),price:o.price||null,rating:o.rating||null,image:(o.image&&/^https:\/\//i.test(String(o.image)))?String(o.image):null,at:Date.now()}; if(kind!=='buy')t.buyEmail.kind=kind; agentSay(t,'sys',kind==='print'?'📧 Emailing you the model to print.':kind==='link'?'📧 Emailing you the link.':'📧 Emailing you the link to buy this.'); }
          touch(); });
        btns.appendChild(pb);
      }
      card.appendChild(btns);
      grid.appendChild(card);
    });
    const wrap=el('div','opts-wrap');
    wrap.appendChild(grid);
    if(opts.length>3){
      // arrows + "1–3 of N": one click pages by the three visible cards
      const prev=el('button','opts-arrow prev','‹'), next=el('button','opts-arrow next','›');
      prev.setAttribute('aria-label','Previous options'); next.setAttribute('aria-label','More options');
      const count=el('div','opts-count');
      const page=function(dir){ return function(e){ e.stopPropagation(); grid.scrollBy({left:dir*grid.clientWidth,behavior:'smooth'}); }; };
      prev.addEventListener('click',page(-1)); next.addEventListener('click',page(1));
      const sync=function(){
        const card=grid.firstChild; if(!card)return;
        const step=card.getBoundingClientRect().width+10;
        const first=Math.round(grid.scrollLeft/step);
        const shown=Math.max(1,Math.round((grid.clientWidth+10)/step));
        prev.disabled=grid.scrollLeft<=2;
        next.disabled=grid.scrollLeft+grid.clientWidth>=grid.scrollWidth-2;
        count.textContent=(first+1)+'–'+Math.min(opts.length,first+shown)+' of '+opts.length;
      };
      grid.addEventListener('scroll',sync,{passive:true});
      // a plain mouse wheel over the cards scrolls them sideways
      grid.addEventListener('wheel',function(e){
        if(Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
        const atEnd=e.deltaY>0?grid.scrollLeft+grid.clientWidth>=grid.scrollWidth-2:grid.scrollLeft<=2;
        if(atEnd)return; // let the page scroll once the row is at its end
        e.preventDefault(); grid.scrollBy({left:e.deltaY>0?grid.clientWidth:-grid.clientWidth,behavior:'smooth'});
      },{passive:false});
      const nav=el('div','opts-nav');
      nav.appendChild(prev); nav.appendChild(count); nav.appendChild(next);
      wrap.appendChild(nav);
      // runs once the row is laid out (and again if the window is resized)
      if(window.ResizeObserver)new ResizeObserver(sync).observe(grid); else setTimeout(sync,0);
    }
    panel.appendChild(wrap);
  }
  // answer Claude's question: the reply goes back with the task, which re-queues it;
  // you can always talk to Claude on an open agent task — even mid-run (it re-runs with your addition)
  if(agentBusy&&(t.reply||(Array.isArray(t.replyImages)&&t.replyImages.length))){
    const yb=el('div','agent-note');
    yb.appendChild(el('b',null,'Your answer'));
    yb.appendChild(document.createTextNode(t.reply));
    if(Array.isArray(t.replyImages)&&t.replyImages.length)yb.appendChild(photoStrip(t.replyImages));
    panel.appendChild(yb);
  }
  if(taskWs(t)==='agent'&&Array.isArray(t.cards)&&t.cards.length)panel.appendChild(cardsStrip(t)); // grocery-list.js: his list, as small pictures
  if(taskWs(t)==='agent'&&!t.done&&t.status==='needs-you'&&t.seats&&Array.isArray(t.seats.rows))panel.appendChild(seatMap(t)); // seat-map.js: its pick, tap others
  if(taskWs(t)==='agent'&&!t.done&&t.status==='needs-you'&&t.showtimes&&Array.isArray(t.showtimes.days))panel.appendChild(showtimesCard(t)); // seat-map.js: tap a day, then a time
  if(taskWs(t)==='agent'&&!t.done&&t.status==='needs-you'&&t.theaters&&Array.isArray(t.theaters.theaters))panel.appendChild(theatersCard(t)); // seat-map.js: the theaters on a map, tap one
  if(wantsYes(t))panel.appendChild(Array.isArray(t.cart)&&t.cart.length?cartStrip(t):yesButton(t)); // grocery-list.js: one tap answers "Reply yes to…"; an order shows its items, all selected
  if(taskWs(t)==='agent'&&!t.done){
    const rb=el('div','agent-reply');
    const ta=el('textarea','settings-inp'); ta.rows=2; ta.setAttribute('aria-label','Reply to the Agent');
    ta.placeholder=agentBusy?'Add something…':'Your answer…';
    ta.value=replyDrafts[t.id]||''; // survives a re-render from a background sync
    ta.dataset.replyFor=t.id;
    ta.addEventListener('input',function(){ if(ta.value)replyDrafts[t.id]=ta.value; else delete replyDrafts[t.id]; saveDrafts(); });
    const send=el('button','btn-accent','Send');
    // photos: pick (phone: camera or gallery), preview, remove; uploaded when you send
    const atts=pendingAtts[t.id]||(pendingAtts[t.id]=[]);
    const arow=el('div','att-row');
    const pick=el('button','att-btn','+ Photo'); pick.type='button'; pick.title='Add photos \u2014 or just paste a screenshot';
    const fileIn=document.createElement('input'); fileIn.type='file'; fileIn.accept='image/*'; fileIn.multiple=true; fileIn.hidden=true;
    const thumbs=el('div','att-thumbs'), status=el('span','att-status');
    function drawThumbs(){
      thumbs.innerHTML='';
      atts.forEach(function(a,i){
        const th=el('div','att-thumb'); const im=document.createElement('img'); im.src=a.preview; im.alt='Photo to send';
        im.addEventListener('click',function(e){ e.stopPropagation(); openLightbox(atts.map(function(x,j){ return {image:x.preview,label:'Photo '+(j+1)+' (not sent yet)'}; }),i); });
        const x=el('button',null,'\u2715'); x.setAttribute('aria-label','Remove photo');
        x.addEventListener('click',function(e){ e.stopPropagation(); URL.revokeObjectURL(a.preview); atts.splice(i,1); drawThumbs(); });
        th.appendChild(im); th.appendChild(x); thumbs.appendChild(th);
      });
    }
    pick.addEventListener('click',function(e){ e.stopPropagation(); fileIn.click(); });
    async function addFiles(list){
      const files=Array.from(list||[]).filter(function(f){ return /^image\//.test(f.type); }).slice(0,Math.max(0,6-atts.length));
      if(!files.length)return;
      status.className='att-status'; status.textContent=files.length?'preparing\u2026':'';
      for(const f of files){
        try{ const blob=await shrinkImage(f); atts.push({blob:blob,preview:URL.createObjectURL(blob)}); }
        catch(err){ status.className='att-status err'; status.textContent=f.name+': '+err.message; }
      }
      if(status.textContent==='preparing\u2026')status.textContent=atts.length>=6?'6 photos max':'';
      drawThumbs();
    }
    fileIn.addEventListener('change',function(){ const f=Array.from(fileIn.files||[]); fileIn.value=''; addFiles(f); });
    attachTargets[t.id]={add:addFiles,el:rb}; // lets a pasted screenshot land here even when the box isn't focused
    // drag image files onto the reply box
    rb.addEventListener('dragover',function(e){ if(e.dataTransfer&&Array.from(e.dataTransfer.types||[]).indexOf('Files')!==-1){ e.preventDefault(); e.stopPropagation(); } });
    rb.addEventListener('drop',function(e){ if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length){ e.preventDefault(); e.stopPropagation(); addFiles(e.dataTransfer.files); } });
    drawThumbs();
    arow.appendChild(pick); arow.appendChild(fileIn); arow.appendChild(thumbs); arow.appendChild(status);
    let sending=false;
    async function doSend(){
      if(sending)return;
      const v=ta.value.trim(); if(!v&&!atts.length){ ta.focus(); return; }
      sending=true; send.disabled=true; send.textContent=atts.length?'Uploading\u2026':'Sending\u2026';
      let urls=[];
      try{ for(const a of atts)urls.push(await uploadAttachment(a.blob)); }
      catch(err){ sending=false; send.disabled=false; send.textContent='Send'; status.className='att-status err'; status.textContent='Couldn\u2019t send the photos: '+err.message; return; }
      atts.forEach(function(a){ URL.revokeObjectURL(a.preview); }); atts.length=0;
      delete replyDrafts[t.id]; saveDrafts();
      const lt=liveTask(t); // a sync during the upload may have swapped the task object
      const busy=!lt.done&&(lt.status==='working'||lt.status==='queued');
      const text=v||(urls.length===1?'(photo)':'('+urls.length+' photos)');
      lt.reply=(busy&&lt.reply)?lt.reply+'\n'+text:text; // mid-run additions stack onto what you already sent
      if(urls.length)lt.replyImages=((busy&&Array.isArray(lt.replyImages))?lt.replyImages:[]).concat(urls);
      agentSay(lt,'you',text,urls.length?{images:urls}:null);
      buzz('send'); if(lt.status!=='working')lt.status='queued'; touch(); // mid-run: it goes next, after this run answers (agent-results.js)
    }
    send.addEventListener('click',doSend);
    ta.addEventListener('keydown',function(e){ if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); doSend(); } });
    arow.appendChild(send); // + Photo on the left, Send on the right, one row
    rb.appendChild(ta); rb.appendChild(arow);
    panel.appendChild(rb);
  }

  // school: the assignment's type decides when it joins the Human list
  if(taskWs(t)==='school'){
    const kr=el('div','panel-meta repeat-row');
    kr.appendChild(el('span','lbl','Type'));
    const ks=document.createElement('select'); ks.className='sm'; ks.setAttribute('aria-label','Assignment type');
    [['regular','Regular \u2014 in list 2 weeks before'],['exam','Exam \u2014 in list 3 weeks before'],['project','Project \u2014 in list now']].forEach(function(p){ const o=document.createElement('option'); o.value=p[0]; o.textContent=p[1]; ks.appendChild(o); });
    ks.value=schoolKind(t);
    ks.addEventListener('change',function(){ t.kind=ks.value; touch(); });
    kr.appendChild(ks);
    panel.appendChild(kr);
    const hl=el('span','subs-label','How to do it');
    const ht=el('textarea','settings-inp how-to'); ht.rows=Math.min(14,Math.max(2,String(t.notes||'').split('\n').length+1));
    ht.value=t.notes||''; ht.placeholder='Instructions, rules, what it covers\u2026'; ht.setAttribute('aria-label','How to do it');
    ht.addEventListener('change',function(){ t.notes=ht.value.trim()||null; touch(); });
    panel.appendChild(hl); panel.appendChild(ht);
  }
  // grocery tasks: when the next 2-week order opens (grocery-list.js); the order itself shows as picture cards
  if(isGroceryTask(t)&&!t.done)panel.appendChild(groceryNextLine());
  // repeat: Claude re-runs this task on a schedule (desktop app does the timing)
  if(taskWs(t)==='agent'){
    const rr=el('div','panel-meta repeat-row');
    rr.appendChild(el('span','lbl','Repeat'));
    const sel=document.createElement('select'); sel.className='sm'; sel.setAttribute('aria-label','Repeat');
    [['','Off'],['day','Every day'],['weekday','Weekdays'],['week','Every week']].forEach(function(p){ const o=document.createElement('option'); o.value=p[0]; o.textContent=p[1]; sel.appendChild(o); });
    sel.value=t.repeat?t.repeat.every:'';
    const tm=el('input','sm'); tm.type='time'; tm.value=t.repeat&&t.repeat.at?t.repeat.at:'08:00'; tm.disabled=!t.repeat; tm.setAttribute('aria-label','Repeat time');
    function applyRepeat(){
      if(!sel.value){ t.repeat=null; t.nextRun=null; }
      else {
        const day=sel.value==='week'?(t.repeat&&t.repeat.day!=null?t.repeat.day:new Date().getDay()):null;
        t.repeat={every:sel.value,at:tm.value||'08:00',day:day};
        t.nextRun=nextRepeatAt(t.repeat,Date.now());
      }
      touch();
    }
    sel.addEventListener('change',applyRepeat); tm.addEventListener('change',applyRepeat);
    rr.appendChild(sel); rr.appendChild(tm);
    if(t.repeat&&t.nextRun)rr.appendChild(el('span','next','next: '+fmtWhen(t.nextRun)));
    panel.appendChild(rr);
  }

  // Task-level date + tag
  const pm=el('div','panel-meta');
  const dueIn=el('input','sm'); dueIn.type='date'; dueIn.value=t.due||''; dueIn.setAttribute('aria-label','Task due date');
  const timeIn=el('input','sm'); timeIn.type='time'; timeIn.value=t.dueTime||''; timeIn.setAttribute('aria-label','Task due time');
  function syncTimeState(){ timeIn.disabled=!dueIn.value; }
  dueIn.addEventListener('change',function(){
    t.due=dueIn.value||null; if(!t.due){ t.dueTime=null; timeIn.value=''; }
    if(t.recur){ if(t.due)t.recur.dom=Number(t.due.slice(8)); else t.recur=null; } // a repeat needs a date to count from
    syncTimeState(); touch();
  });
  timeIn.addEventListener('change',function(){ t.dueTime=timeIn.value||null; touch(); });
  syncTimeState();
  const tagIn=el('input','sm'); tagIn.value=t.tag||''; tagIn.placeholder='tag'; tagIn.setAttribute('list','tagOptions'); tagIn.setAttribute('aria-label','Tag');
  tagIn.addEventListener('change',function(){ t.tag=tagIn.value.trim()||null; touch(); });
  tagIn.addEventListener('keydown',function(e){ if(e.key==='Enter')tagIn.blur(); });
  pm.appendChild(dueIn); pm.appendChild(timeIn); pm.appendChild(tagIn); panel.appendChild(pm);

  // repeat: ticking it off makes the next one (recur.js); agent tasks use their own schedule above
  if(taskWs(t)!=='agent'&&!t.done){
    const rr=el('div','panel-meta repeat-row');
    rr.appendChild(el('span','lbl','Repeat'));
    const rs=document.createElement('select'); rs.className='sm'; rs.setAttribute('aria-label','Repeat');
    RECUR_OPTIONS.forEach(function(p){ const o=document.createElement('option'); o.value=p[0]; o.textContent=p[1]; rs.appendChild(o); });
    rs.value=t.recur&&RECUR_CHIPS[t.recur.every]?t.recur.every:'';
    rs.addEventListener('change',function(){
      if(!rs.value){ t.recur=null; touch(); return; }
      if(!t.due)t.due=formatDate(new Date()); // counts from its due date: an undated one starts today
      t.recur={every:rs.value,dom:Number(t.due.slice(8)),series:(t.recur&&t.recur.series)||t.id};
      touch();
    });
    rr.appendChild(rs);
    panel.appendChild(rr);
  }

  // Screenshots: attach context photos to any (non-agent) task. Reuses the
  // agent-attachments bucket; carried to Claude if the task is handed to Agent.
  if(taskWs(t)!=='agent'&&attachProfile()){
    // no label or button: paste (Ctrl+V) or drag an image anywhere on the open task;
    // the strip only shows once there's something in it
    const strip=el('div','att-thumbs'); strip.style.margin='2px 0 8px';
    // phones can't paste images, so there you get a small + tile to pick one
    const touchOnly=!!window.Capacitor||matchMedia('(pointer:coarse)').matches;
    let fileIn=null;
    if(touchOnly){ fileIn=document.createElement('input'); fileIn.type='file'; fileIn.accept='image/*'; fileIn.multiple=true; fileIn.hidden=true; fileIn.addEventListener('change',function(){ addPics(fileIn.files); fileIn.value=''; }); panel.appendChild(fileIn); }
    const uploading=[]; // in-flight {blob, preview, failed}
    function badge(th,text){ const b=el('div',null,text); b.style.cssText='position:absolute;left:0;right:0;bottom:0;font-family:var(--mono);font-size:8px;text-align:center;background:rgba(20,20,20,.62);color:#fff;padding:1px 0'; th.appendChild(b); }
    function drawPics(){
      strip.innerHTML=''; strip.hidden=!fileIn&&!(t.images||[]).length&&!uploading.length;
      (t.images||[]).forEach(function(u,i){
        const th=el('div','att-thumb'); const im=document.createElement('img'); im.src=u; im.alt='Screenshot'; im.referrerPolicy='no-referrer';
        im.addEventListener('click',function(){ openLightbox((t.images||[]).map(function(x,j){ return {image:x,label:'Screenshot '+(j+1)}; }),i); });
        const x=el('button',null,'✕'); x.setAttribute('aria-label','Remove screenshot');
        x.addEventListener('click',function(e){ e.stopPropagation(); t.images=(t.images||[]).filter(function(y){ return y!==u; }); if(!t.images.length)delete t.images; drawPics(); touch(); });
        th.appendChild(im); th.appendChild(x); strip.appendChild(th);
      });
      uploading.forEach(function(u){
        const th=el('div','att-thumb'); th.style.opacity=u.failed?'1':'.55';
        const im=document.createElement('img'); im.src=u.preview; im.alt=u.failed?'Upload failed':'Uploading'; th.appendChild(im);
        badge(th,u.failed?'retry':'…');
        if(u.failed){ th.style.cursor='pointer'; th.title='Upload failed — click to retry'; th.addEventListener('click',function(){ u.failed=false; drawPics(); doUpload(u); }); }
        strip.appendChild(th);
      });
      if(fileIn){
        const plus=el('button','att-thumb','+'); plus.type='button'; plus.setAttribute('aria-label','Add a photo');
        plus.style.cssText='padding:0;display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--muted);background:var(--chip);border:1px dashed var(--hairline);cursor:pointer';
        plus.addEventListener('click',function(){ fileIn.click(); });
        strip.appendChild(plus);
      }
    }
    async function doUpload(u){
      try{ const url=await uploadAttachment(u.blob); const k=uploading.indexOf(u); if(k!==-1)uploading.splice(k,1); try{URL.revokeObjectURL(u.preview);}catch(_e){} const lt=liveTask(t); lt.images=(lt.images||[]).concat([url]); t.images=lt.images; drawPics(); touch(); }
      catch(e){ u.failed=true; drawPics(); }
    }
    drawPics(); panel.appendChild(strip);
    async function addPics(list){
      const room=Math.max(0,8-((t.images||[]).length)-uploading.length);
      const files=Array.from(list||[]).filter(function(f){ return /^image\//.test(f.type); }).slice(0,room);
      for(const f of files){
        let blob; try{ blob=await shrinkImage(f); }catch(e){ continue; }
        const u={blob:blob,preview:URL.createObjectURL(blob),failed:false};
        uploading.push(u); drawPics(); // show it instantly, then upload in the background
        doUpload(u);
      }
    }
    picTargets[t.id]={add:addPics,el:panel}; // lets a pasted screenshot land here
    panel.addEventListener('dragover',function(e){ if(e.dataTransfer&&Array.from(e.dataTransfer.types||[]).indexOf('Files')!==-1){ e.preventDefault(); } });
    panel.addEventListener('drop',function(e){ if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length){ e.preventDefault(); addPics(e.dataTransfer.files); } });
  }

  // Subtasks section
  panel.appendChild(el('span','subs-label','Subtasks'));
  const ul=el('ul','subs');

  t.subs.forEach(function(s){
    const li=el('li','sub'+(s.done?' done':''));
    const c=el('button','subcheck'+(s.done?' on':'')); c.innerHTML=I.check;
    c.setAttribute('aria-label',s.done?'Mark subtask as not done':'Mark subtask as done');
    c.addEventListener('click',function(){ s.done=!s.done; touch(); });
    const sp=el('span','subtitle',s.title);

    // right-side: date widget + delete
    const smeta=el('div','sub-meta');
    const dateArea=el('div','sub-date-area');

    function showChip(){
      dateArea.innerHTML='';
      if(s.due){
        const info=dateInfo(s.due);
        const chip=el('button','chip date'+(info.cls?' '+info.cls:''),info.text);
        chip.title='Click to change date'; chip.style.cursor='pointer';
        chip.addEventListener('click',function(e){ e.stopPropagation(); openPicker(); });
        dateArea.appendChild(chip);
      } else {
        const calBtn=el('button','icon'); calBtn.innerHTML=I.cal; calBtn.setAttribute('aria-label','Add due date');
        calBtn.addEventListener('click',function(e){ e.stopPropagation(); openPicker(); });
        dateArea.appendChild(calBtn);
      }
    }

    function openPicker(){
      dateArea.innerHTML='';
      const inp=el('input','sm sub-date-inp'); inp.type='date'; inp.value=s.due||'';
      let saved=false;
      function commit(){ if(saved)return; saved=true; s.due=inp.value||null; touch(); }
      inp.addEventListener('change',commit);
      inp.addEventListener('blur',commit);
      inp.addEventListener('keydown',function(ke){ if(ke.key==='Enter'||ke.key==='Escape')inp.blur(); });
      dateArea.appendChild(inp);
      requestAnimationFrame(function(){ inp.focus(); try{inp.showPicker();}catch(_){} });
    }

    showChip();
    const dx=iconBtn(I.x,'Delete subtask');
    dx.addEventListener('click',function(){ t.subs=t.subs.filter(function(x){ return x.id!==s.id; }); touch(); });
    smeta.appendChild(dateArea); smeta.appendChild(dx);
    li.appendChild(c); li.appendChild(sp); li.appendChild(smeta);
    ul.appendChild(li);
  });

  panel.appendChild(ul);

  // Add-subtask row: title + optional due date, Enter to add
  const addRow=el('div','subadd-row');
  const add=el('input','subadd'); add.placeholder='Add a subtask…'; add.setAttribute('data-id',t.id);
  const newDue=el('input','sm sub-new-date'); newDue.type='date'; newDue.setAttribute('aria-label','Subtask due date');

  function doAddSub(){
    const v=add.value.trim(); if(!v){ add.focus(); return; }
    t.subs.push({id:uid(),title:v,done:false,due:newDue.value||null});
    add.value=''; newDue.value='';
    persist(); render();
    requestAnimationFrame(function(){ const next=document.querySelector('input.subadd[data-id="'+t.id+'"]'); if(next)next.focus(); });
  }
  add.addEventListener('keydown',function(e){ if(e.key==='Enter')doAddSub(); });
  newDue.addEventListener('keydown',function(e){ if(e.key==='Enter')doAddSub(); });
  addRow.appendChild(add); addRow.appendChild(newDue);
  panel.appendChild(addRow);
  return panel;
}

/* ── render ── */
function render(){
  updatePlanBtn();
  // a background sync or Claude's answer re-renders the list; if you were typing an
  // answer, put the cursor back so your next keystrokes don't hit list shortcuts
  const ae=document.activeElement;
  if(ae&&ae.dataset&&ae.dataset.replyFor){
    const id=ae.dataset.replyFor, s=ae.selectionStart, e=ae.selectionEnd;
    queueMicrotask(function(){
      const ta=document.querySelector('textarea[data-reply-for="'+id+'"]');
      if(ta&&document.activeElement!==ta){ ta.focus(); try{ ta.setSelectionRange(s,e); }catch(err){} }
    });
  }
  // a pulsing dot on the Agent tab while any task is running, so you see it from other tabs
  const anyWorking=state.tasks.some(function(t){ return taskWs(t)==='agent'&&!t.done&&t.status==='working'; });
  const ta=$('tabAgent'); if(ta){ ta.classList.toggle('busy',anyWorking); ta.title=anyWorking?'The Agent is working on a task':''; }
  const onAgent=state.activeTab==='agent', onSchool=state.activeTab==='school', onWork=state.activeTab==='work';
  const tab=onAgent?'agent':onSchool?'school':onWork?'work':'list';
  // every tab shows from the start; one whose list isn't connected yet says how to connect it
  const unconnected=onAgent?!agentAvailable():onSchool?!schoolConfigured():onWork?!workConfigured():false;
  document.querySelector('.composer').hidden=unconnected;
  $('searchBox').hidden=unconnected;
  $('connectCard').hidden=!unconnected;
  if(unconnected){
    const what=onAgent?['Agent','agent','Hand tasks to the Agent — on this computer or the local model: they work on them and come back when they need you.']
      :onSchool?['School','school','Your assignments, with due dates pulled in from your course calendars.']
      :['Work','work','A second list that syncs with your work project.'];
    $('connectTitle').textContent='Connect your '+what[0]+' list';
    $('connectText').textContent=what[2]+' It’s shared online between your computer'+(onAgent?', phone and mini PC':' and phone')+', so it needs connecting once.';
    $('connectBtn').setAttribute('data-ws',what[1]);
  }
  const tasks=state.tasks.filter(function(t){ return inTab(t,tab); });
  // a tag named like a list ("work") would repeat the Personal/Work chips above,
  // so it gets no chip of its own; the tasks keep their tag
  const listNamed=function(tg){ return workConfigured()&&['personal','work'].indexOf(tg.toLowerCase())!==-1; };
  const tags=[]; tasks.forEach(function(t){ if(t.tag&&!listNamed(t.tag)&&tags.indexOf(t.tag)===-1)tags.push(t.tag); }); tags.sort(function(a,b){ return a.localeCompare(b); });
  if(state.filter&&tags.indexOf(state.filter)===-1)state.filter=null;
  const dl=$('tagOptions'); dl.innerHTML='';
  tags.forEach(function(tg){ const o=document.createElement('option'); o.value=tg; dl.appendChild(o); });

  const open=tasks.filter(function(t){ return !t.done; });
  let overdue=0,dueToday=0;
  open.forEach(function(t){ if(!t.due)return; const d=dateInfo(t.due).diff; if(d<0)overdue++; else if(d===0)dueToday++; });
  let cHtml=open.length+' open';
  if(overdue)cHtml+=' &middot; <span class="warn">'+overdue+' overdue</span>';
  else if(dueToday)cHtml+=' &middot; '+dueToday+' due today';
  // parked = you've seen it and set it aside: still there, but no longer counted as needing you
  const needing=state.tasks.filter(function(t){ return taskWs(t)==='agent'&&!t.done&&t.status==='needs-you'&&!t.parked; })
    .sort(function(a,b){ return getSortKey(a)-getSortKey(b); }); // same order as the Agent tab
  $('counts').innerHTML=cHtml;
  // one chip per task that needs you; tapping it opens that task on the Agent tab
  const nb=$('needsBar'); nb.innerHTML=''; nb.hidden=!needing.length;
  if(needing.length)nb.appendChild(el('span','needs-label','needs you:'));
  const shortNames=uniqueShortNames(needing.map(function(t){ return t.title; }));
  needing.forEach(function(t,i){
    const c=el('button','needs-chip'+(state.activeTab==='agent'&&state.selectedId===t.id?' on':''));
    c.textContent=shortNames[i];
    c.title=t.title+(t.note?'\n\n'+t.note.replace(/\s+/g,' ').slice(0,200):''); // the name lives in the hover
    c.addEventListener('click',function(){ openTaskById(t.id); });
    nb.appendChild(c);
  });
  fitNeedsBar();
  $('newAttBtn').hidden=!onAgent||!attachProfile(); drawComposerAtts();
  $('newTitle').placeholder=onAgent?'Add a task for the Agent…':onSchool?'Add an assignment… (tag = class)':onWork?'Add a work task…':'Add a task…';

  // workspace filter chips (only when a work list is connected; not on the Agent tab)
  const wsf=$('wsFilters'); wsf.innerHTML='';
  if(workConfigured()&&tab==='list'){
    wsf.hidden=false;
    [['All',null],['Personal','personal'],['Work','work']].forEach(function(pair){
      const b=el('button','fchip'+(state.wsFilter===pair[1]?' active':''),pair[0]);
      b.addEventListener('click',function(){ state.wsFilter=pair[1]; render(); });
      wsf.appendChild(b);
    });
  } else { wsf.hidden=true; if(!workConfigured()&&state.wsFilter)state.wsFilter=null; }

  const fl=$('filters'); fl.innerHTML='';
  if(tags.length){
    fl.hidden=false;
    const all=el('button','fchip'+(state.filter===null?' active':''),'All');
    all.addEventListener('click',function(){ state.filter=null; render(); }); fl.appendChild(all);
    tags.forEach(function(tg){
      const b=el('button','fchip'+(state.filter===tg?' active':''),tg);
      b.addEventListener('click',function(){ state.filter=(state.filter===tg)?null:tg; render(); }); fl.appendChild(b);
    });
  } else { fl.hidden=true; }

  const q=state.search;
  const visible=function(t){
    if(tab==='list'&&state.wsFilter){ const w=taskWs(t); if(state.wsFilter==='work'?w!=='work':w==='work')return false; } // Personal includes school
    if(state.filter!==null&&t.tag!==state.filter)return false;
    if(!q)return true;
    if(t.title.toLowerCase().indexOf(q)!==-1)return true;
    if(t.tag&&t.tag.toLowerCase().indexOf(q)!==-1)return true;
    return t.subs.some(function(s){ return s.title.toLowerCase().indexOf(q)!==-1; });
  };
  const openVis=open.filter(visible).slice().sort(function(a,b){ return getSortKey(a)-getSortKey(b); });
  navOrder=openVis.map(function(t){ return t.id; });
  if(state.selectedId&&navOrder.indexOf(state.selectedId)===-1)state.selectedId=null;
  drawLupaFiles(onAgent); // agent-chat.js: what the mini PC's browser downloaded
  drawYesPrompts(tab==='list'?needing:[]);
  const ol=$('openList'); ol.innerHTML='';
  openVis.forEach(function(t){ ol.appendChild(buildRow(t,true)); });

  const es=$('emptyState');
  if(unconnected){ es.hidden=true; }
  else if(tasks.length===0){ es.hidden=false; es.textContent=onAgent?'No tasks for the Agent yet — add one above, or hand one over from the Human tab.':onSchool?'No assignments yet — add one above (put the class in the tag).':onWork?'No work tasks yet — add one above.':'Nothing here yet — add your first task above.'; }
  else if(openVis.length===0){
    es.hidden=false;
    es.textContent=q?'No matches for "'+$('searchBox').value.trim()+'".':(state.filter?'Nothing open under "'+state.filter+'".':'All clear.');
  }
  else { es.hidden=true; }
  if(typeof drawAgentSetup==='function')drawAgentSetup(onAgent,tasks,es); // welcome.js: no AI connected yet → say so here

  const doneVis=tasks.filter(function(t){ return t.done; }).filter(visible).sort(function(a,b){ return b.created-a.created; });
  const ds=$('doneSection');
  if(doneVis.length){
    ds.hidden=false;
    $('doneToggle').textContent=(state.showDone?'\u25BE':'\u25B8')+' done \u00B7 '+doneVis.length;
    $('clearDone').textContent=state.confirmClear?'sure?':'clear';
    const dlst=$('doneList'); dlst.hidden=!state.showDone; dlst.innerHTML='';
    if(state.showDone)doneVis.forEach(function(t){ dlst.appendChild(buildRow(t,false)); });
  } else { ds.hidden=true; state.confirmClear=false; }
}

/* On the Human tab: one card per Agent task waiting on a yes ("Reply yes to submit it"), with a line
   of what it's about and Yes / No. Tap the card itself to open the task on the Agent tab. An order
   with its cart shows no Yes here: items can be left out there, so it opens the order instead. */
function yesContext(t){
  const last=(Array.isArray(t.history)?t.history:[]).filter(function(h){ return h.who==='claude'; }).slice(-1)[0];
  let s=String((last&&last.text)||t.note||'');
  s=s.replace(/!?\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/[*_`#>]+/g,'').replace(/\s+/g,' ').trim();
  s=s.replace(/[^.!?]*\breply\s*yes\b[^.!?]*[.!?]?/ig,'').trim(); // the ask itself is the buttons
  return s.length>220?s.slice(0,217).replace(/\s+\S*$/,'')+'…':s;
}
function drawYesPrompts(needing){
  const box=$('yesPrompts'); box.innerHTML='';
  const asks=needing.filter(wantsYes);
  box.hidden=!asks.length;
  asks.forEach(function(t){
    const c=el('div','yes-card'); c.tabIndex=0; c.title='Open this task on the Agent tab';
    const head=el('div','yes-head');
    head.appendChild(el('span','yes-who','The Agent asks'));
    head.appendChild(el('b','yes-title',t.title));
    c.appendChild(head);
    const ctx=yesContext(t); if(ctx)c.appendChild(el('p','yes-ctx',ctx));
    const row=el('div','yes-btns');
    const cart=Array.isArray(t.cart)&&t.cart.length;
    if(cart){
      const r=el('button','btn-accent','Review the order');
      r.addEventListener('click',function(e){ e.stopPropagation(); openTaskById(t.id); });
      row.appendChild(r);
    } else {
      const y=yesButton(t); y.classList.remove('agent-yes'); row.appendChild(y);
      const n=el('button','btn-ghost','No');
      n.title='Tell the Agent no: it won’t go ahead';
      n.addEventListener('click',function(e){
        e.stopPropagation();
        const lt=liveTask(t);
        lt.reply='no'; agentSay(lt,'you','no'); lt.status='queued';
        buzz('send'); touch();
      });
      row.appendChild(n);
    }
    c.appendChild(row);
    c.addEventListener('click',function(){ openTaskById(t.id); });
    c.addEventListener('keydown',function(e){ if(e.key==='Enter'&&e.target===c)openTaskById(t.id); });
    box.appendChild(c);
  });
}
