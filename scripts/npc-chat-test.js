(() => { const w=__px.world,n=w.npcs; window.__c={done:false,rows:[]};
 const ask=async(npc,line)=>{const t=performance.now();let r;try{r=await n.reply(npc,'Kai',line)}catch(e){r={text:'ERR '+e}};window.__c.rows.push([npc,line,r?.text??null,r?.source??'',Math.round(performance.now()-t)])};
 (async()=>{
  for(const id of ['pip','mo','ama','elder']) n.setHost(id,null);
  await ask('pip','where is the pond?');
  await ask('pip','where is it again?');
  await ask('pip','is it far?');
  await ask('pip','how do I get there');
  await ask('pip','what are you doing?');
  await ask('pip','where is mo?');
  await ask('pip','what do you like to do?');
  await ask('pip','do you know mo?');
  await ask('pip','why do you like that?');
  await ask('pip','what did I just ask you?');
  await ask('mo','do you catch big fish here?');
  await ask('mo','what bait do you use?');
  await ask('ama','what do you sell?');
  await ask('ama','is anything fresh today?');
  await ask('elder','tell me about this village');
  await ask('elder','who lives here?');
  await ask('elder','how long have you been here?');
  await ask('pip','are you tired?');
  window.__c.done=true })() })();'started'
