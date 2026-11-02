# Game design: Mindworld

**Pitch:** a small cozy village where the villagers and pets think for themselves, on your own machine. You cannot tell a villager from another player.

**Track:** Build for Your World. **Audience:** a stranger who opens a link and plays with no setup.

## What the player does
1. Hatch a pet. Spawn on your own plot on the village street, with a house and a farm.
2. Walk to the village. Talk to Mo, Ama, Pip and the Elder in plain words.
3. Make plans with them: invite, trade, ask for help. They remember, keep or break promises, and tell each other.
4. Earn coins from the farm, fishing and the market. Spend them on your house and pets.
5. Teach your pet in words, and see in Prove whether the lesson really worked. Duel others or befriend wild pets.
6. Meet other players: everyone shares the same village. Past 12 plots, extra players are guests.

## The star moment
"My birthday is tonight at the dance floor, come?" The villager accepts, bends its day around it, tells a friend, turns up, and is hurt if you do not.

## Rules of the world
- The sim decides what is true and possible. The model picks among valid options and speaks.
- NPCs have every verb a player has, and can say no with a reason.
- One game day is 12 real minutes. Needs drive every mind's day.
- The world keeps working with no AI: rules and cached lines.
- After the event it runs free, on players' machines.

## Scope (decided by the user, 2026-11-02)
- **Keep:** villagers, chat, promises, memory, bonds, jobs, economy; market stall; pet hatch, follow, moods, Teach, Prove; wild pets with varieties, taming; player duel; farm, fishing, coins; dance, soccer, picnic activities; a minimal house (outside, one room, bed); 2+ players.
- **Backlog, removed from play at step 6:** boss, ghosts and the ghost stone, furniture editing, windmills, decorative fields, sea life, terraces, streams, beaches, cliffs, clouds, in-between grounds, ghost grounds, themes, voice teaching, babble, soccer as a mini-game. Git keeps them.

**Compact world:** one hand-authored village, about 64 x 44 tiles: plaza, stall, dance floor, pond, wild meadow, board. Player plots line a street, 12 slots. Every place fits a screen or two, with no long empty walks. Plan: `../RESTRUCTURE.md`.

## Compliance
Runtime models are Meta models. No banned project types. Full rules: `../ops/event.md`.
