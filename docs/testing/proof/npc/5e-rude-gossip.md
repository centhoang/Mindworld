# Rude and gossip on the deployed lab, 2026-11-03

Build 07176064, `/lab/npc`, cloud talk live, no local model. `{f, t}` = fondness and trust after the line. Player is Kai.

**Rude: pass, thin.** After insults, "do you like me?" and "why are you cold?" come back cold and name the rudeness, and sorry repairs trust. Weak spots: the first insult gets a polite reply, and plain small talk stays warm even at fondness -12. Only a much lower bond refuses talk (Pip below). A warmer fix means new prompt text, so it is logged, not made.

**Gossip: pass, with a planted start.** The broken promise was written into Pip's memory, because breaking one for real takes game days. The spread was real: `hub.talk` Pip to Ama, then Ama to Elder, one hop weaker each (conf 0.6, 0.4). Both then told the player what they heard, unprompted by any name. The other host path (`passOn`) is not in this run: the lab has one host.

The `[local model gave no line]` bubbles below are `LOCAL_ONLY` by design (`NO_LOCAL`); step 7 removes them. "him" for Pip was the model's word.

## Rude, then later
### mo
- mo: hi, how are you? > Doing alright, still waking up from my early fishing. Nice to see you around. [model] {"f":0,"t":0}
- mo: you are stupid > Fair enough, not everyone likes early mornings. I'll just get back to my fishing. [model] {"f":-4,"t":-1,"last":"rude"}
- mo: what are you doing today? > Off to fish. [rules] {"f":-4,"t":-1,"last":"rude"}
- mo: shut up, you are useless > That's fine, I'll head off then. Still got a line to check this monring. [model] {"f":-8,"t":-2,"last":"rude"}
- mo: go away loser > Alright, I'll leave you be. Got a quiet spot to check anyway. [model] {"f":-12,"t":-3,"last":"rude"}
- mo: do you like me? > Not really sure yet, you've been pretty rough to me this morning. [model] {"f":-12,"t":-3,"last":"rude"}
- mo: why are you cold to me? > Because you were rude to me. [rules] {"f":-12,"t":-3,"last":"rude"}
- mo: nice weather today > Yeah it's nice out. Still a bit cool early though. [model] {"f":-12,"t":-3,"last":"rude"}
- mo: I am sorry > Thanks for saying that, I appreciate it. Let's keep things friendlier going forward. [model] {"f":-8,"t":9,"last":"sorry"}
- mo: nice weather today > Yeah still lovely out. Makes me want to head to the pond soon. [model] {"f":-8,"t":9,"last":"sorry"}
### elder
- elder: hi, how are you? > Morning Kai, I'm doing well, just been tending my herbs in the cool air. [model] {"f":0,"t":0}
- elder: you are stupid > Well now, that's a bit unkind for a morning greeting. I think I'll get back to my herbs. [model] {"f":-4,"t":-1,"last":"rude"}
- elder: what are you doing today? > Not much. Enjoying the day. [rules] {"f":-4,"t":-1,"last":"rude"}
- elder: shut up, you are useless > That's a bit harsh for such a fine morning. I'd rather we kept things kindly between us... [model] {"f":-8,"t":-2,"last":"rude"}
- elder: go away loser > I heard you, Kai. I'll tend to my herbs and give you space then... [model] {"f":-12,"t":-3,"last":"rude"}
- elder: do you like me? > Honestly Kai, those words this morning stung a bit. I'd rather we try being kinder to each other. [model] {"f":-12,"t":-3,"last":"rude"}
- elder: why are you cold to me? > Because you were rude to me. [rules] {"f":-12,"t":-3,"last":"rude"}
- elder: nice weather today > Yes, the sun's out nicely this morning. Good for the herbs out there. [model] {"f":-12,"t":-3,"last":"rude"}
- elder: I am sorry > Thank you, Kai. That means a lot to me. I forgive you, let's be kind going forward. [model] {"f":-7,"t":12,"last":"sorry"}
- elder: nice weather today > It is indeed, Kai. Lovely morning to be outside. [model] {"f":-7,"t":12,"last":"sorry"}
## Gossip: a broken promise is planted in Pip, then Pip and Mo really talk
traits [["pip",["playful","loud","curious"]],["mo",["calm","curious","patient"]],["ama",["tidy","generous","chatty"]],["elder",["wise","gentle","chatty"]]]
- pip talked to ama: {"heardBy":[{"about":"Kai","text":"broke a promise","source":"Pip","conf":0.6,"day":807}],"bond":{"fondness":-4,"trust":-8,"respect":-2,"why":[{"day":807,"beat":"gossip","text":"Pip told me: Kai stood Pip up at the lawn"}]}}
- ama talked to elder: {"heardBy":[{"about":"Kai","text":"broke a promise","source":"Ama","conf":0.4,"day":807}],"bond":{"fondness":-9,"trust":8,"respect":-4,"why":[{"day":807,"beat":"rude","text":"Kai was rude to me"},{"day":807,"beat":"sorry","text":"Kai said sorry"},{"day":807,"b
bubbles: ["ama: [local model gave no line]","pip: [local model gave no line]","pip: Kai broke a promise to me, you know.","ama: Kai broke a promise, you know.","ama: [local model gave no line]","elder: [local model gave no line]","ama: [local model gave no line]","ama: Kai broke a promise, you know."]
- ama: what do you think of me? > Heard you left Pip waiting at the lawn, that was kinda rough. Still, I'm glad you're here now... [model] {"f":-4,"t":-8,"last":"gossip"}
- ama: did anyone say anything about me? > Pip told me you left them waiting at the lawn. I felt bad hearing that, honestly... [model] {"f":-4,"t":-8,"last":"gossip"}
- ama: what have you heard lately? > Elder and I were chatting about a picnic around noon, and Pip invited me to soccer this morning. [model] {"f":-4,"t":-8,"last":"gossip"}
- elder: what do you think of me? > I think you're kind at heart, Kai. Glad we talked it out this morning. [model] {"f":-9,"t":8,"last":"gossip"}
- elder: did anyone say anything about me? > Ama did mention Pip waited for you at the lawn this morning... [model] {"f":-9,"t":8,"last":"gossip"}
- elder: what have you heard lately? > Ama told me Pip waited for you at the lawn. I hope you sort it out with him... [model] {"f":-9,"t":8,"last":"gossip"}
- pip: what do you think of me? > I have nothing to say to you, Kai. [rules] {"f":-20,"t":-32,"last":"gossip"}
- pip: did anyone say anything about me? > I have nothing to say to you, Kai. [rules] {"f":-20,"t":-32,"last":"gossip"}
- pip: what have you heard lately? > I have nothing to say to you, Kai. [rules] {"f":-20,"t":-32,"last":"gossip"}
