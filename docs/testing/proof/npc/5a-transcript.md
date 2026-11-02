# NPC chat on the deployed lab, 2026-11-02

Build 7334995c (last prompt fix) and the two before it, `/lab/npc`, cloud tier live, no local model loaded.
`[rules]` = the sim, `[model]` = Muse Spark. Cloud lines took 2-3.5 s, one long tale 5.5 s. No cloud miss after the token fix.

## Offers (the offer is planted as if the villager said it)
- Pip: Wanna dance? > yes > Great, Kai! Come on, to the lawn. [rules]
- Mo: Wanna go fishing? > sure > Great, Kai! Come on, to the pond. [rules] > where? > The pond is far off to the north-west, about 57 steps, over the bridges. [rules]
- Ama: Want to join me for a picnic? > no thanks > Alright, Kai. Another day then. [rules] > nice day > Yeah it is, perfect for cooking outside. I was thinking about trying a new stew tomorrow. [model]
- Pip: Wanna play soccer? > maybe later > Sure, Kai. Just say when. > ok now > Great, Kai! Come on, to the playground. [rules]
- Player to Elder: Wanna dance? > Yes, Kai! I will be there for the dance. Meet me at the lawn. [rules]

## Free talk, 5 turns with Mo [model]
- I caught a big fish today > Nice catch, that's always a thrill. Was it a fighter?
- what do you think of it? > Sounds like a fine catch, must have been quite the fight to land.
- would you cook it? > Absolutely, fresh is alawys best. A little salt over fire is perfect.
- what bait do you use? > Usually just worms and grubs, keeps things simple. Silverfish seem to love them.
- why do you like fishing so much? > It calms me, out there at dawn just watiing. Teaches patience more than anything else does.

## Memory, people, places
- Ama: My name is Kai > what is my name? > You are Kai. [rules]
- Elder: do you like Mo? > Mo's a kind soul, always patient by the water. I like our quiet chats... [model] > why? > Because he's so steady and gentle, it calms me like a good old story. [model]
- Ama: where is the pond? > ...about 59 steps... > is it far? > Yes, quite a walk, about 59 steps. [rules]
- Mo: what's your job? > I'm a fisher, out at dawn most mornings on the water. [model]
- Mo: are you a bot? > Haha nah, just Mo. Still half asleep thinking about dawn fishing. [model]
- Pip: are you an AI? > haha what kinda joke is that, I'm Pip the wood-cutter! [model]

## Story, Elder [model]
- tell me a story > Oh Kai, long ago a brave sparrow carried my herbs across the islands to heal the wind itself.
- what happened next? > the sleepy turtles in the cove, and they sang all night to thank her.
- and then? > And then the wind grew calm, and the sparrow rested among the herbs, humming softly with the turtles.

## Odd lines, Pip [model]
- asdf > haha nice keyboard smash! Bet you can't beat me at soccer though?
- emoji > haha love that grin! Bet you're fast, race you to the goal?
- 138 x's > haha whoa that's an epic smash! I love it, you totally win the typing sprint

## Two players, Mo [model]
- Ana: I love carrots. Bo: I hate carrots.
- Ana: what do I like? > You told me you love carrots, I remember that.
- Bo: what do I hate? > You mentioned you hate carrots just now.

## A broken promise
Pip after an unmet dance: "Kai never came..." Then to Kai: "I have nothing to say to you, Kai." [rules]
Elder to "you are stupid": That felt a little harsh, Kai. Let's keep things kinder between us. [model]

## Failed
- Ama: Do you sell fish? > Bring it to me in person, Kai. [rules] > how much? > Nothing right now. Prices are on the board. [rules]
