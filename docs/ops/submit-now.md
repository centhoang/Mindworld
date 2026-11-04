# Submit now: the checklist (2026-11-05, deadline 09:00 VN = Nov 4 9 PM ET)

User (2026-11-05 02:30 VN): submit now, no play-test. Steps in order. **[YOU]** = the user (posts, making things
public, Access, terms, the Submit button). **[CLAUDE]** = Claude. Form answers: `submission.md`.

## 0. Done already (Claude, 02:30-03:00 VN)
- [x] P8 deployed (worker `13dd4574`, client `main-CpuGb6wS`): `/api/chatlog` is 404 on live, `CLIENT_DAILY_USD` 2,
  pets.uryto.dev route gone. Postcards now painted from the game's own frames (live check: 30 s, game-styled).
- [x] Tests: worker 289, client 711, tsc clean. Local commit `25e81c8`.
- [x] Video: `.scratch/video/mindworld-demo.mp4` (2:59.3, YouTube check passed), `mindworld.srt`, `mindworld-thumb.png`,
  X teaser `mindworld-x.mp4` (64 s, captions burned in, hook line).

## 1. GitHub (the repo is far behind: do this first)
- [ ] **[CLAUDE, needs your OK]** GitHub `origin/main` is 246 commits behind this machine (local `main` is 134 ahead
  of it, `rework/fresh-look` 112 more). Fast-forward `main` to `rework/fresh-look` and push `main`. GitHub has almost
  none of the game yet.
- [ ] **[YOU]** github.com/centhoang/MetaGlobalAIDeveloperHackathonProject_PetMind > Settings > General > Danger Zone >
  Change visibility > Public. Then open the repo logged out: README shows, default branch is `main`.

## 2. Hugging Face: 4 model repos to public **[YOU]**
Each: huggingface.co/kysupo/<repo> > Settings > Change model visibility > Public.
- [ ] `Llama-3.2-1B-Mindworld-q4f16_1-MLC`  - [ ] `Llama-3.2-1B-Mindworld-q4f32_1-MLC`
- [ ] `Llama-3.2-1B-Mindworld-GGUF`  - [ ] `Llama-3.2-3B-Mindworld-GGUF`
(Claude can flip them with the `.env` token if you say "make the HF repos public".)

## 3. Remove Access **[YOU]**
- [ ] Cloudflare dashboard > Zero Trust > Access > Applications > the Mindworld app (mindworld.uryto.dev) > Delete.
- [ ] Phone on **mobile data**: open https://mindworld.uryto.dev, walk, talk to a villager. (It was "Forbidden" from
  mobile data before; it must work now.)
- [ ] **[CLAUDE]** right after: outside join check (`node scripts/room-probe.mjs check`, a 30-bot burst for 2 minutes)
  and `/api/spend`. Say "Access is off" and Claude runs it.

## 4. YouTube **[YOU]** (signed in in the TEMP Chrome)
1. studio.youtube.com > **Create > Upload videos** > pick
   `C:\Users\ky124\Datas\StudyAndWork\Repos\MetaGlobalAIDeveloperHackathonProject\.scratch\video\mindworld-demo.mp4`
   (the full-quality one, not `-preview`).
2. **Title:** `Mindworld: AI villagers who keep promises, and remember when you don't (Meta AI Hackathon)`
3. **Description** (paste):
   ```
   Mindworld is a free browser village where the villagers think for themselves. Built solo for the Meta Global AI
   Developer Hackathon, Oct 27 - Nov 4, 2026.

   Play free, no install: https://mindworld.uryto.dev
   Code: https://github.com/centhoang/MetaGlobalAIDeveloperHackathonProject_PetMind

   Meta models: Llama 3.2 1B fine-tuned on Muse Spark Open's answers (runs in the players' own browsers, WebGPU),
   Muse Spark Open, Muse Spark 1.3, Muse Image 1.0, Muse Voice Transcribe.
   Built during the event. Pre-existing: open-source libraries, the licensed Sunnyside World pixel-art pack, Meta's
   models. Music and sounds: original, made for this video. Scenes are staged on our own build with our own lines.

   0:00 What was built this week
   0:12 A village anyone joins, minds on the players' GPUs
   0:43 The birthday promise
   1:22 Stood up, and the village hears about it
   1:51 A rival that adapts, and a coach that proves it
   2:20 The village lives without you
   2:39 Hand-over: the minds move when a host leaves
   ```
4. **Thumbnail:** upload `.scratch\video\mindworld-thumb.png` (needs a phone-verified channel; skip if greyed out).
5. **Audience:** "No, it's not made for kids". **Show more > Category:** Gaming. Language: English.
6. **Subtitles** (on the Video elements step, or later in Studio > Subtitles): Add > **Upload file** > **With timing** >
   `.scratch\video\mindworld.srt` > Publish. Language English.
7. **Visibility: Public** (Unlisted also works for the form, but Public can pick up views and votes). Publish.
8. Wait until it says HD is processed (a few minutes), open the link in a private window, play 10 s with sound.
- [ ] YouTube link: ____________ (goes in form field 8 and the X thread)

## 5. X post for Most Viral ($20k: most likes, reposts and comments by Nov 8 11:59 PM ET) **[YOU]**
Post now, before submitting: the form needs the post's link. Native video, not a YouTube link (X plays native video
inline and muted; that is why the teaser has captions). Free X accounts upload up to 2:20, so use the 64 s teaser.
**Post 1** (attach `.scratch\video\mindworld-x.mp4`):
```
I stood up an AI villager at their own birthday party.

Pip skipped a work shift to come. I forgot. By morning the whole village knew, and Ama wouldn't sell to me until I said sorry.

Nobody scripted this. Built for the Meta AI Developer Hackathon with @AIatMeta Llama + Muse 🧵
```
**Reply 1:**
```
Every villager thinks with a Llama 3.2 1B we fine-tuned on Muse Spark, running in the players' own browser tabs.

The room shares it: the fastest machines think for everyone. No GPU? A friend's tab answers for you.
```
**Reply 2:**
```
The game reasons, the model chooses: the sim only offers moves the world allows, so a villager can't promise what it can't do.

Rivals plan duels with Muse Spark, Muse Spark 1.3 writes the daily paper, Muse Image paints postcards of your moments.
```
**Reply 3:**
```
Play free, no install: https://mindworld.uryto.dev
Full 3-min demo: <YouTube link>

What would you promise a villager? 👇
```
Links go in the replies, not the first post (X shows posts with outside links to fewer people).
Getting engagement (fair play only, never bought likes or bots, which can disqualify):
- [ ] Pin the post to your profile. Reply to every comment in the first 1-2 hours (replies count, and they boost reach).
- [ ] Send the **X post link** (not the game link) to friends and groups: ask for a like, a repost and a one-line comment.
- [ ] Share the X link where people like this: Discord (the event's showcase channel if there is one; your post,
  Claude stays read-only there), LinkedIn, Reddit (r/LocalLLaMA likes "1B in the browser"; r/WebGames, r/IndieDev),
  with the X post as the link.
- [ ] Nov 6 or 7: quote-post the hand-over moment (the minds moving to the next tab) as a second short clip to
  resurface the thread. Claude can cut it on request.
- [ ] X post link: ____________ (form field 5)

## 6. The form **[YOU]** (cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit)
- [ ] Text answers: `submission.md` Drafts A-D (Claude can type them in if you ask; never the Submit button).
- [ ] Track: Indie Developer. Problem statement: Build for Your World. Repo link, YouTube link, X link.
- [ ] Your fields: team name (suggestion "Mindworld"), the opinion questions (12, 13, 15-21), the consent box.
- [ ] Submit. Screenshot the confirmation.

## 7. Low priority
- [ ] **Hide the unrelated pages** (uryto.dev/urytolice/, uryto.dev/corners/): they are the Cloudflare Pages project
  `urytolice` (custom domain uryto.dev, last changed 3 weeks ago); the game is a separate Worker on mindworld.uryto.dev,
  so this does not touch it. Simplest: Workers & Pages > urytolice > Custom domains > remove `uryto.dev` (uryto.dev then
  shows nothing; `urytolice.pages.dev` still exists, so also Settings > Access policy, or delete the project if you
  never need it). Or keep it and add an Access app for `uryto.dev/*`. **[YOU]** (security settings).
- [ ] DNS: the leftover `pets` record (pets.uryto.dev no longer has a route) can be deleted. **[YOU]**
- [ ] Old play-test chat rows (`chat:` keys in KV, private, nothing can read them now). Delete if you like, from
  `worker/` in PowerShell:
  `npx wrangler kv key list --binding GHOSTS --prefix "chat:" --remote > ..\.scratch\chat-keys.json`, then
  `node -e "const k=require('../.scratch/chat-keys.json').map(x=>x.name);require('fs').writeFileSync('../.scratch/chat-del.json',JSON.stringify(k))"`,
  then `npx wrangler kv bulk delete --binding GHOSTS --remote ..\.scratch\chat-del.json`. **[YOU]** (permanent delete)

## Suggested timing (VN)
03:15 push + repos public · 03:30 Access off + join checks · 03:45 YouTube · 04:15 X post · after 04:30 submit
(the plan wanted an hour between Access going and Submit; the deadline is 09:00).
