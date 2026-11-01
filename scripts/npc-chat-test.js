// docs/testing/checks/npc.md on the real model. Each dialogue is a fresh talk: [npc, opening line by the villager or "", ...player lines].
(() => { const w=__px.world,n=w.npcs; window.__c={done:false,rows:[]};
 const ask=async(npc,line)=>{const t=performance.now();let r;try{r=await n.reply(npc,'Kai',line)}catch(e){r={text:'ERR '+e}};window.__c.rows.push([npc,line,r?.text??null,r?.source??'',Math.round(performance.now()-t)])};
 const talk=async(npc,open,...lines)=>{window.__c.rows.push(['--',npc,open]);if(open)n.noteOffer(npc,n.hub.minds.get(npc),'Kai',open);for(const l of lines)await ask(npc,l)};
 const D=[
  ['pip','Wanna dance?','yes'],
  ['pip','Wanna play soccer?','sure','where?'],
  ['mo','Want to go fishing?','no thanks','so what now?'],
  ['pip','Want a picnic?','maybe later','ok now'],
  ['mo','Want to run to the pond?','where is it?',"ok let's go"],
  ['pip','Do you want to play later?','yes'],
  ['pip','What is your favourite food?','I love soup','what did I say I love?'],
  ['elder','Wanna dance?','yep!'],['mo','Wanna dance?','lets go'],['ama','Wanna dance?','nah'],
  ['mo','','I caught a big fish today','what do you think of it?'],
  ['ama','','My name is Kai','what is my name?'],
  ['pip','','the sky is green','what did I just say?'],
  ['pip','','do you like Mo?','why?'],
  ['elder','','tell me a story','what happened next?'],
  ['pip','','where is the pond?','is it far?'],
  ['pip','','where is the market?'],['pip','','where is Mo?'],
  ['ama','','what are you doing?'],['elder','','who lives here?'],['elder','','do you know Ama?'],
  ['mo','','what time is it?'],['mo',"","what's your job?"],
  ['pip','','asdf'],['pip','','hello'],['mo','','you are stupid'],['elder','','are you an AI?'],
 ];
 (async()=>{
  for(const id of ['pip','mo','ama','elder']) n.setHost(id,null);
  for(const d of D) await talk(...d);
  window.__c.done=true })() })();'started'
