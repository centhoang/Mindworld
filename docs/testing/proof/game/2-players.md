# Two players, driven, on the deployed build (2026-11-03)

Two tabs in the test Chrome on pets.uryto.dev, room connected. Builds 07176064 to 84964532. Each tab has its own save (`?p=`).
The driver moved the avatar by script between stops and cut the crop's real wait by clearing `wetUntil`. Keys, menus, farm rules, coins and the room were the real ones. Wild fights were held off so they could not end a run.

## Same day
- clock A 581276.1, B 581275.7, gap 0.33 game s; peers 1/1
- clock A 581280.4, B 581279.7, gap 0.65 game s; peers 1/1
- clock A 581281.9, B 581280.7, gap 1.15 game s; peers 1/1
- clock A 581286.2, B 581285.7, gap 0.42 game s; peers 1/1
Gap under 1.2 game seconds; both tabs read the same shared clock.

## Solid things
- tile kind 0: start -26,-17 key w > ended -26.00,-17.68, samples inside solid 0
- tile kind 1: start -25.5,-17 key a > ended -25.98,-17.00, samples inside solid 0
- tile kind 2: start 19,-7.5 key w > ended 19.00,-7.97, samples inside solid 0
- tile kind 3: start 20.5,-12.5 key a > ended 19.55,-12.50, samples inside solid 0
- tile kind 6: start -26.5,-16 key a > ended -26.98,-16.00, samples inside solid 0
- tile kind 7: start 17,-17 key s > ended 17.00,-16.11, samples inside solid 0
Tile kinds under the block: 0 water, 1 grass, 2 path, 3 bridge, 6 tall grass, 7 pool. On land the block is a thing standing there, such as a tree or house. Holding 1 s would walk 1.7 tiles in the open; each run stopped short, and no sample was inside a solid.

## Fishing needs water
- dry land {"x":-18,"z":-16}: gather null, work null
- shore {"x":-26.5,"z":-17.5}: work "fish"
- fish 0 > 1

## Farm, sell, buy
- start {"seeds":{"wheat":3},"basket":{},"plot0":{"crop":null,"stage":0,"wetUntil":0}}
- hint at bed 0
- planted {"seeds":{"wheat":2},"basket":{},"plot0":{"crop":"wheat","stage":0,"wetUntil":0}}
- watered, wait cut {"seeds":{"wheat":2},"basket":{},"plot0":{"crop":"wheat","stage":1,"wetUntil":0}}
- watered, wait cut {"seeds":{"wheat":2},"basket":{},"plot0":{"crop":"wheat","stage":2,"wetUntil":0}}
- watered, wait cut {"seeds":{"wheat":2},"basket":{},"plot0":{"crop":"wheat","stage":3,"wetUntil":0}}
- harvested {"seeds":{"wheat":2},"basket":{"wheat":1},"plot0":{"crop":null,"stage":0,"wetUntil":0}}

## Sell and buy
- start {"coins":3,"seeds":{"wheat":2},"basket":{"wheat":1},"pack":{"fish":1}}
- stall open true
- shipped {"coins":6,"seeds":{"wheat":2},"basket":{},"pack":{"fish":1}}
- bought seed {"coins":5,"seeds":{"wheat":3},"basket":{},"pack":{"fish":1}}
- to mo: do you want to buy my fish? > {"coins":5,"seeds":{"wheat":3},"basket":{},"pack":{"fish":1}}
- to mo: yes > {"coins":5,"seeds":{"wheat":3},"basket":{},"pack":{"fish":1}}
- ama: I want to sell you a fish for 3 coins > [["n:ama","..."]] {"coins":8,"pack":{"fish":1}}
- pip: buy my fish for 2 coins? > [["n:ama","Hello Mochi, you rest there pretty, I'll keep an eye on you."],["n:pip","I have no use for fish, Brave Biscuit."]] {"coins":8,"pack":{"fish":1}}
- elder: sell fish 2 coins > [["n:elder","Deal. 2 coins for 1 fish."]] {"coins":10,"pack":{"fish":0}}

Elder's deal moved the coins and the fish. Pip and Mo passed; Ama's first line gave only "..." within the 4 s wait, then small talk, so her side is unclear. One buyer is enough for this line.

## Duel
A pressed E by B, picked Duel; B got "wants a duel!" and accepted. Both tabs opened the fight and mirrored it: each sees the other's pet as the foe, both back in the village after. Coins went 5 > 8. Images: `duel-both-tabs.jpg`, `market-chat-duel.jpg`. The intro line for a friend is new in this run ("is ready to duel!"); that line itself has a unit test only, the shot missed it.
