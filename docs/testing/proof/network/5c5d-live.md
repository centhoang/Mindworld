# Villagers with two tabs (deployed build, 2026-11-03)

Tabs `?p=21` and `?p=22` on pets.uryto.dev with the room connected, sampled every 3 s, then the host tab closed.
- Each tab saw 1 peer. Gap between the tabs per villager, tiles: first sample 0.61, 0.61, 3.73, 0; last two samples 0 for all four. Gaps above 0 were a villager walking between 5 Hz updates.
- All four villagers moved to one host during the run, while both tabs stayed up (2 + 2 became 4 + 0). No break seen.
- Host closed: the other tab hosted all four by the first sample, 5 s later. The two villagers it took last were moving by 10 s, and all four kept moving through 60 s.
- Not explained: that tab logged two 502 responses in the run. A solo tab showed none. Which URL is not known.
