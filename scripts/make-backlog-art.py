"""Original static backlog art; Pillow only, integer pixels, no network or randomness.

Run from any directory with Python + Pillow. Only the paths in the B3 brief are
written. RECIPE is deliberately plain JSON so the pixel drawings are reviewable
independently of Pillow; dots leave transparent ink pixels untouched.
"""

import hashlib
import json
import re
from collections import Counter
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "client/public/art"
OUT = ART / "backlog"
CONTACT = ROOT / ".scratch/v3/b3-contact.png"
NOTE = ROOT / ".scratch/v3/b3-codex-note.md"
INK = "#39463F"

RECIPE = json.loads(r"""
{
  "symbols": {
    "k":"#39463F", "d":"#537D59", "g":"#78A05D", "G":"#9FC66A", "L":"#BFDA82", "l":"#DDE8A3",
    "t":"#43847C", "T":"#519F95", "w":"#6CBAB2", "W":"#9ED7CA", "v":"#D4EADD",
    "b":"#795849", "B":"#A57954", "o":"#C69A67", "h":"#E0BC85", "c":"#F4DEC6",
    "s":"#7A8F89", "S":"#9CAC9B", "r":"#BFC7AF", "i":"#DDE1C6",
    "u":"#B88163", "U":"#D8A67A", "f":"#EBC796", "F":"#F7E5BA", "n":"#FFF3D8",
    "p":"#BC756B", "P":"#E69B86", "y":"#EDC76A"
  },
  "mask_symbols": {"K":"#000000","R":"#FF0000","A":"#00FF00","B":"#0000FF","E":"#FFFFFF"},
  "parts": [
    {"kind":"ear","name":"round","x":0,"y":0,"anchor":[8,15],"at":[4,6],"rows":["..KKKKK..",".KRRRRRK.","KRRRRRRRK","KRAAAAARK","KRAAAAARK","KRRAAARRK","KRRRRRRRK",".KRRRRRK.","..KRRRK..","...RRR..."]},
    {"kind":"ear","name":"pointy","x":16,"y":0,"anchor":[8,15],"at":[3,3],"rows":[".....K.....","....KRK....","....KRK....","...KRRRK...","...KRRRK...","..KRRAARK..","..KRRAARK..",".KRRRAARRK.",".KRRAAAARK.","KRRRAAAARRK","KRRRRRRRRRK",".KRRRRRRRK.","...RRRRR..."]},
    {"kind":"ear","name":"floppy","x":32,"y":0,"anchor":[8,15],"at":[4,4],"rows":["..KKKK...",".KRRRRK..","KRRRRRRK.","KRRAAARRK","KRAAAARRK","KRAAARRRK","KRRAARRRK",".KRARRRK.","..KRRRK..","..KRRK...","...RRR...","...RRR..."]},
    {"kind":"ear","name":"bunny-long","x":48,"y":0,"anchor":[8,15],"at":[5,1],"rows":["..KKK..",".KRRRK.","KRRRRRK","KRRAARK","KRAAARK","KRAAARK","KRAAARK","KRAAARK","KRAAARK","KRAAARK","KRRAARK","KRRRRRK",".KRRRK.",".KRRRK.","..RRR.."]},
    {"kind":"ear","name":"fin","x":64,"y":0,"anchor":[8,15],"at":[2,4],"rows":["......K......",".....KRK.....",".K..KRARK..K.",".RKKRRAARKKR.",".KRRRAAARRRK.","KRRRAAAAARRRK",".KRRAAAAARRK.","..KRAAAARRK..","..KRRARRRRK..","...KRRRRRK...","....KRRRK....",".....RRR....."]},
    {"kind":"ear","name":"tufted","x":80,"y":0,"anchor":[8,15],"at":[3,3],"rows":[".....K.....","....KRK....",".K.KRRRK.K.",".RKRRAARKR.","KRRRAAARRRK",".KRRAAARRK.","KRRRAAAARRK",".KRRRAARRK.","..KRRARRK..","..KRRRRRK..","...KRRRK...","...KRRRK...","....RRR...."]},
    {"kind":"horn","name":"nub","x":0,"y":16,"anchor":[8,15],"at":[4,7],"rows":["...KKK...","..KAAAK..",".KAAAAAK.","KAAAAAAAK","KAAAAAAAK","KAAAAAAAK",".KAAAAAK.","..KAAAK..","...AAA..."]},
    {"kind":"horn","name":"curl","x":16,"y":16,"anchor":[8,15],"at":[3,3],"rows":["...KKKKK...","..KAAAAAK..",".KAAAAAAAK.","KAAAKKKAAAK","KAAK...KAAK","KAAK..KAAAK","KAAAKKKAAAK",".KAAAAAAAK.","..KKKAAAK..","....KAAK...","....KAAK...","....KAAK...","....AAA...."]},
    {"kind":"horn","name":"antler","x":32,"y":16,"anchor":[8,15],"at":[2,2],"rows":[".KK...K...KK.",".AAK.KAK.KAA.",".KAAKKAKKAAK.","..KAAAAAAAK..","...KKAAAKK...","....KAAAK....",".KK.KAAAK.KK.",".AAKKAAAKKAA.","..KAAAAAAAK..","...KKAAAKK...","....KAAAK....","....KAAAK....","....KAAAK....",".....AAA....."]},
    {"kind":"horn","name":"single","x":48,"y":16,"anchor":[8,15],"at":[4,1],"rows":["....K....","...KAK...","...KAK...","...KAK...","..KAAAK..","..KAAAK..","..KAAAK..",".KAAAAAK.",".KAAAAAK.",".KAAAAAK.","KAAAAAAAK","KAAAAAAAK","KAAAAAAAK",".KAAAAAK.","..AAAAA.."]},
    {"kind":"tail","name":"round-puff","x":0,"y":32,"anchor":[8,15],"at":[2,3],"rows":["....KKKKK....","..KKAAAAAKK..",".KAAAAAAAAAK.","KAAAAAAAAAAAK","KAAAAAAAAAAAK","KAAAAAAAAAAAK","KAAAAAAAAAAAK",".KAAAAAAAAAK.","..KKAAAAAKK..","....KRRRK....","....KRRRK....",".....RRR.....",".....RRR....."]},
    {"kind":"tail","name":"fox-brush","x":16,"y":32,"anchor":[8,15],"at":[3,2],"rows":[".........K..",".......KKAK.","......KAAAK.",".....KAAAAK.","....KAAAAAK.","...KRRRAAAK.","..KRRRRRAAK.",".KRRRRRRRK..","KRRRRRRRK...","KRRRRRRK....","KRRRRRK.....",".KRRRK......","..KRRRK.....","....RRR....."]},
    {"kind":"tail","name":"curly","x":32,"y":32,"anchor":[8,15],"at":[2,3],"rows":["....KKKKK....","...KRRRRRK...","..KRRRRRRRK..",".KRRKKKKRRRK.","KRRK....KRRK.","KRRK..KKRRRK.","KRRK..KRRRK..","KRRK...KKK...","KRRRK........",".KRRRK.......","..KRRRK......","...KRRRK.....",".....RRR....."]},
    {"kind":"tail","name":"lizard","x":48,"y":32,"anchor":[8,15],"at":[2,2],"rows":["K...........","KRK.........","KRK.........","KRRK........",".KRRK.......",".KRRRK......","..KRRRK.....","..KRRRAK....","...KRRAAK...","...KRRRAAK..","....KRRRAAK.","....KRRRRRK.",".....KRRRK..",".....RRR...."]},
    {"kind":"tail","name":"fin","x":64,"y":32,"anchor":[8,15],"at":[2,3],"rows":[".KK.......KK.",".AAK.....KAA.",".KAAK...KAAK.",".KAAAK.KAAAK.","..KAAAKAAAK..","...KAAAAAK...","..KAAAAAAAK..",".KAAAKKKAAAK.",".KAAKRRRKAAK.","..KKKRRRKKK..","....KRRRK....",".....RRR.....",".....RRR....."]},
    {"kind":"tail","name":"leaf","x":80,"y":32,"anchor":[8,15],"at":[2,2],"rows":["......K......",".....KAK.....","....KAAAK....","...KAAAAAK...","..KAAAAAAAK..",".KAAAAKAAAAK.","KAAAAAKAAAAAK","KAAAAAKAAAAAK",".KAAAAKAAAAK.","..KAAAKAAAK..","...KKAKKK....",".....R.......",".....R.......",".....RRR....."]},
    {"kind":"foot","name":"paws","x":0,"y":48,"anchor":[8,0],"at":[3,0],"rows":["....RRR....","...KRRRK...","..KRRRRRK..",".KRRRRRRRK.","KRRRRRRRRRK","KRRRRRRRRRK","KRRBBBBBRRK","KRRBBBBBRRK",".KRRRRRRRK.","..KKKKKKK.."]},
    {"kind":"foot","name":"stubby","x":16,"y":48,"anchor":[8,0],"at":[4,0],"rows":["...RRR...","..KRRRK..",".KRRRRRK.",".KRRRRRK.","KRRRRRRRK","KRRRRRRRK",".KKKKKKK."]},
    {"kind":"foot","name":"claws","x":32,"y":48,"anchor":[8,0],"at":[2,0],"rows":[".....RRR.....","....KRRRK....","...KRRRRRK...","..KRRRRRRRK..",".KRRRRRRRRRK.","KRRRRRRRRRRRK","KAAARRAAARRAK","KAAAKKAAAKKAK",".KKK..KKK.KK."]},
    {"kind":"eye","name":"dot","x":0,"y":64,"anchor":[8,8],"at":[8,8],"rows":["K"]},
    {"kind":"eye","name":"big-shiny","x":16,"y":64,"anchor":[8,8],"at":[5,4],"rows":["..KKK..",".KKKKK.","KKEKKKK","KKKKKKK","KKKKKKK","KKKKKKK",".KKKKK.","..KKK.."]},
    {"kind":"eye","name":"sleepy-line","x":32,"y":64,"anchor":[8,8],"at":[4,7],"rows":["K.......K",".KKKKKKK."]},
    {"kind":"eye","name":"happy-arc","x":48,"y":64,"anchor":[8,8],"at":[4,6],"rows":["...KKK...","..K...K..",".K.....K.","K.......K"]},
    {"kind":"eye","name":"star","x":64,"y":64,"anchor":[8,8],"at":[4,4],"rows":["....K....","...KKK...","...KKK...",".KKKKKKK.","KKKKKKKKK",".KKKKKKK.","...KKK...","...KKK...","....K...."]},
    {"kind":"eye","name":"wide","x":80,"y":64,"anchor":[8,8],"at":[3,5],"rows":["..KKKKKKK..",".KEEEEEEEK.","KEEEEKEEEEK","KEEEEKEEEEK",".KEEEEEEEK.","..KKKKKKK.."]},
    {"kind":"mouth","name":"smile","x":0,"y":80,"anchor":[8,8],"at":[4,6],"rows":["K.......K","K.......K",".K.....K.","..KKKKK.."]},
    {"kind":"mouth","name":"open","x":16,"y":80,"anchor":[8,8],"at":[5,5],"rows":["..KKK..",".KKKKK.","KKKKKKK","KKKKKKK","KKKBBKK",".KBBBK.","..KKK.."]},
    {"kind":"mouth","name":"fang","x":32,"y":80,"anchor":[8,8],"at":[4,6],"rows":["KKKKKKKKK","KBBBBBBBK",".KBABABK.","..KAKAK..","...K.K..."]},
    {"kind":"mouth","name":"cat-w","x":48,"y":80,"anchor":[8,8],"at":[3,6],"rows":[".....K.....",".....K.....","K....K....K",".K..K.K..K.","..KK...KK.."]},
    {"kind":"pattern","name":"spots","x":0,"y":96,"anchor":[8,8],"at":[0,0],"rows":["................","................","...AA...........","..AAAA..........","...AA.....AAA...","..........AAA...","................",".....AAA........",".....AAA........","................","..AA.......AA...","..AA......AAAA..","...........AA...","......AA........","......AA........","................"]},
    {"kind":"pattern","name":"stripes","x":16,"y":96,"anchor":[8,8],"at":[0,0],"rows":["................","...AA.....AA....","...AA.....AA....","...AAA....AAA...","....AA.....AA...","....AA.....AA...","....AAA....AAA..",".....AA.....AA..",".....AA.....AA..","....AAA....AAA..","....AA.....AA...","....AA.....AA...","...AAA....AAA...","...AA.....AA....","...AA.....AA....","................"]},
    {"kind":"pattern","name":"patch","x":32,"y":96,"anchor":[8,8],"at":[0,0],"rows":["................","................","......AAAA......","....AAAAAAA.....","...AAAAAAAAA....","...AAAAAAAAAA...","..AAAAAAAAAAA...","..AAAAAAAAAAAA..","...AAAAAAAAAAA..","...AAAAAAAAAA...","....AAAAAAAAA...",".....AAAAAAA....","......AAAA......","................","................","................"]},
    {"kind":"pattern","name":"belly-heart","x":48,"y":96,"anchor":[8,8],"at":[0,0],"rows":["................","................","................","...AAA....AAA...","..AAAAA..AAAAA..","..AAAAAAAAAAAA..","..AAAAAAAAAAAA..","...AAAAAAAAAA...","....AAAAAAAA....",".....AAAAAA.....","......AAAA......",".......AA.......","................","................","................","................"]}
  ],
  "houses": [
    {"name":"chimney","ops":[
      ["rect",32,10,36,22,"b"],["rect",33,11,35,20,"p"],
      ["rect",33,11,33,19,"P"],["rect",30,9,37,11,"b"],["rect",31,9,36,9,"h"],
      ["rect",31,10,36,10,"u"],["rect",34,14,36,14,"b"],["rect",32,18,34,18,"b"],
      ["stamp",10,28,["bbbbbb","bhhhhb","bvwwwb","bvwwwb","bwwttb","bbbbbb"]]
    ]},
    {"name":"porch","ops":[
      ["poly","b",[[11,28],[15,24],[32,24],[36,28],[36,29],[11,29]]],
      ["poly","W",[[15,25],[31,25],[33,27],[13,27]]],
      ["rect",12,28,35,28,"T"],["rect",12,29,13,39,"b"],["rect",13,30,13,38,"h"],
      ["rect",34,29,35,39,"b"],["rect",34,30,34,38,"o"],
      ["rect",15,42,32,44,"b"],["rect",15,42,32,42,"c"],["rect",16,43,31,44,"h"],
      ["restore",17,29,30,39]
    ]},
    {"name":"round","ops":[
      ["rect",17,29,30,39,"o"],
      ["stamp",17,29,[".....bbbb.....","...bbhhhhbb...","..bhhhoohhhb..",".bhhoooooohhb.","bhhoooooooohhb","bhoooooooooohb","bhoooooooooohb","bhooooooBooohb","bhooooooByoohb","bhoooooooooohb","bhoooooooooohb"]],
      ["stamp",31,28,["..P..P..",".PyPPyP.","..PggP..",".gGggGg.","bbbbbbbb","bohhhBob",".bBBBbb.","..bbbb.."]]
    ]},
    {"name":"tall","ops":[
      ["clear",0,0,47,39],
      ["poly","b",[[23,1],[24,1],[46,39],[1,39]]],
      ["poly","o",[[23,9],[40,39],[7,39]]],
      ["poly","W",[[23,3],[23,8],[6,37],[4,37]]],
      ["poly","t",[[23,8],[24,10],[8,38],[6,38]]],
      ["poly","T",[[24,3],[44,37],[40,37],[24,9]]],
      ["poly","h",[[23,11],[24,13],[10,38],[8,38]]],
      ["line","B",[[15,28],[32,28]]],["line","B",[[11,35],[36,35]]],
      ["stamp",19,14,["...bb....","..bhhb...",".bhvwhb..","bhvvwwhb.","bwvwwwtb.","bwwhwwtb.","bwwhwwtb.",".bhhhhb..","..bbbb..."]],
      ["rect",6,39,41,39,"b"],["restore",17,29,30,39]
    ]}
  ],
  "small": [
    {"name":"held-fish","at":[1,6],"rows":[".......kkk....",".....kkWwwkk..",".k..kWwwwwwwk.","kTk.kwwwwwwkwk","kTTkkwwwwwwwwk","kTTTwwwwwwwwk.","kTTkkwFFFFwk..","kTk..kkFFkk...",".k.....kk.....",".......k......"]},
    {"name":"held-sandwich","at":[2,5],"rows":[".....kk.....","....khck....","...khccck...","..khccccck..",".khccccccck.","khccccccccck","kGGGGGGGGGgk",".kPPPPPPPPk.","..khfffffk..","...kkhkkk...",".....kk....."]},
    {"name":"held-broom","at":[2,1],"rows":[".........kk.","........khk.",".......khk..",".......kbk..","......khk...",".....khk....",".....kbk....","....khk.....","....kk......","..kkBBkk....",".khyhyhyk...","khhyhyhyyk..","khhyhyhyyk..","khhyhyhyyk..",".kkkkkkkk..."]},
    {"name":"held-ball","at":[2,4],"rows":["....kkkk....","..kkPPPPkk..",".kPPPPPPPPk.","kPPccPPPPPPk","kPPccPPPPPPk","kPPPPPPPPPpk","kPPPPPPPPppk","kPPPPPPPpppk","kPPPPPPppppk",".kPPPPppppk.","..kkppppkk..","....kkkk...."]},
    {"name":"held-book","at":[3,3],"rows":[".kkkkkkkkk","kWWWWWWWTk","kWwwwwwwTk","kWwcccwwTk","kWwcwwwwTk","kWwwwwwwTk","kWwwwwwwTk","kWwwwwwwTk","kWwwwwwwTk","kTkkkkkkTk","kvccccccck","kvcicicick",".kkkkkkkkk"]},
    {"name":"held-cup","at":[3,6],"rows":[".kkkkkkkk...","kvvvvvvvk...","kvuuuuuukkk.","kvFFFFFwkwwk","kvFFFFFwkw.k","kvFFFFFwkw.k","kwwFFFwwkwwk",".kwwwwwtkkk.",".kwwwwtk....","..kkkkk....."]},
    {"name":"held-flower","at":[3,1],"rows":["...kkk....","..kPPPkk..",".kPPPPPPk.","kPPPPPPPk.","kPPyyPPPk.",".kPyyPPk..","..kPPPk...","...kdk....","...kdk....","kk.kdk....","kGkkdk.kk.",".kGGdkGGk.","..kkdGGk..","...kdkk...","...kdk...."]},
    {"name":"food-bowl","at":[1,8],"rows":["..kkkkkkkkkk..",".kWWhhBBhhWWk.","kWWBoBBhoBWWWk","kvvvvvvvvvvwwk","kwwwwwwwwwwttk",".kwwwwwwwwttk.","..kttttttttk..","...kkkkkkkk..."]},
    {"name":"poop","at":[2,5],"rows":["......kk....",".....khk....","....khoBk...","...khoooBk..","....kBBBk...","..kkhoooBk..",".khhhooooBk.","..kBBBBBBk..",".khooooooBBk","khhooooooBBk",".kkkkkkkkkk."]},
    {"name":"trash-bag","at":[2,2],"rows":["...kk..kk...","...kTkktk...","....kttk....","....kkkk....","...kWwwtk...","..kWWwwttk..",".kWWwwwtttk.","kWWwwwwwtttk","kWwwwwwwtttk","kwwwwwwwtttk","kwwwwwwttttk",".kwwwwttttk.","..kttttttk..","...kkkkkk..."]},
    {"name":"party-cake","at":[1,1],"rows":["....y....y....","...yyy..yyy...","....y....y....","....P....P....","....P....P....","..kkkkkkkkkk..",".kFFFFnnnnFFk.","kFnnnnnnnnFFFk","kFFnFFnnFFnFFk","kPFFFFFFFFFFPk","kPPPPPPPPPPppk","kFccFccFccFcck","kccccccccccFck",".kPPPPPPPPppk.","..kkkkkkkkkk.."]},
    {"name":"balloon-bunch","at":[1,1],"rows":["......kkk.....","..kk.kWWwk....",".kPPkWWwwwk...","kPPPPkwwwwk...","kPPPPkwwwtk...",".kPPk.kkk.kk..","..kk.khhykWWk.","...bkhyhyykwwk","...bkhyhyykwwk","....bkhyhkwwk.","....b.kkk.kk..",".....b.b.b....","......bbb.....",".......b......",".......b......"]},
    {"name":"speaker","at":[4,2],"rows":["kkkkkkkkk","kSrrrrrsk","krkkkkkrk","krkWwTkrk","krkwwtkrk","krkkkkkrk","krsssssSk","krkkkkkrk","krksssksk","krksTtksk","krksttksk","krkkkkksk","ksssssssk","kkkkkkkkk"]},
    {"name":"lantern","at":[3,1],"rows":["...kkkk...","..k....k..","..k....k..","..k....k..",".kkkkkkkk.","kchhhhhBBk",".knyyyyBk.",".knFyyyBk.",".knFyyyBk.",".knyyyyBk.",".kyyyyyBk.",".kBBBBBBk.","kchhhhhBBk",".kBBBBBBk.","..kkkkkk.."]}
  ],
  "sand": [
    [["stamp",3,3,["ff",".f"]],["stamp",10,10,["nn","n."]],["stamp",10,4,["ff",".f"]]],
    [["stamp",7,2,["nn",".n"]],["stamp",3,10,["ff","f."]],["stamp",11,8,["ff",".f"]]],
    [["stamp",2,7,["ff",".f"]],["stamp",11,3,["nn","n."]],["stamp",8,11,["ff","f."]]]
  ],
  "night": [
    [["stamp",3,3,["gg","g."]],["stamp",11,10,["tt",".t"]],["stamp",7,7,["gg",".g"]]],
    [["stamp",8,2,["gg",".g"]],["stamp",3,11,["tt","t."]],["stamp",11,8,["gg",".g"]]],
    [["stamp",2,8,["gg","g."]],["stamp",11,3,["tt",".t"]],["stamp",7,11,["gg",".g"]]]
  ],
  "scenery": [
    {"name":"prop-palm","size":[32,48],"ops":[
      ["poly","b",[[18,15],[22,15],[21,28],[19,39],[18,44],[21,46],[21,47],[12,47],[13,44],[15,34],[17,24]]],
      ["poly","B",[[19,17],[21,17],[20,28],[18,39],[16,44],[18,46],[14,46],[16,35]]],
      ["poly","h",[[19,21],[20,21],[18,33],[17,36],[17,30]]],
      ["line","b",[[17,28],[20,29]]],["line","b",[[15,36],[18,37]]],["line","b",[[14,43],[17,44]]],
      ["poly","d",[[18,15],[12,10],[10,5],[11,2],[14,2],[17,5],[20,10],[20,15]]],
      ["poly","G",[[12,3],[14,4],[17,8],[18,13],[14,9],[12,6]]],
      ["poly","L",[[12,3],[13,3],[15,5],[15,7],[13,6]]],
      ["poly","d",[[18,14],[20,8],[24,4],[27,3],[29,5],[26,8],[24,11],[22,16]]],
      ["poly","G",[[21,11],[22,8],[25,5],[27,5],[24,9],[22,13]]],
      ["poly","d",[[18,13],[11,8],[5,8],[2,11],[1,16],[4,14],[10,13],[17,17]]],
      ["poly","G",[[4,11],[6,9],[10,9],[15,12],[11,11],[7,11],[3,13]]],
      ["rect",6,9,10,10,"L"],
      ["poly","d",[[19,14],[24,9],[28,9],[30,12],[30,17],[27,14],[24,14],[21,18]]],
      ["poly","g",[[22,13],[25,10],[27,10],[28,12],[26,12],[23,14]]],
      ["poly","G",[[24,10],[27,10],[27,11],[24,12]]],
      ["poly","d",[[18,14],[12,13],[7,16],[4,21],[4,25],[5,27],[8,22],[12,19],[18,18]]],
      ["poly","G",[[15,14],[12,14],[8,17],[6,21],[6,23],[9,19],[13,17],[17,16]]],
      ["poly","L",[[11,15],[13,14],[15,14],[12,16],[10,17],[9,17]]],
      ["poly","d",[[19,14],[24,16],[27,20],[28,24],[26,27],[24,22],[21,20],[17,18]]],
      ["poly","g",[[20,16],[23,17],[25,20],[26,24],[24,21],[21,19],[18,18]]],
      ["stamp",14,15,[".bbb.bbb.","bhhbbhBBb","bhBbbBBBb",".bb..bbb."]]
    ]},
    {"name":"decor-shell","size":[16,16],"ops":[
      ["stamp",1,5,[".....bbbb.....","...bbccccbb...","..bccccccccb..",".bcchchchcccb.","bcchhchchhcccb","bcchhchchhcccb","bchhchchchhccb",".bhhchchchhhb.","..bhhchchhhb..","...bbccccbb...",".....bbbb....."]]
    ]},
    {"name":"decor-starfish","size":[16,16],"ops":[
      ["stamp",1,2,["......bb......",".....bPPb.....",".....bPPb.....",".....bPPb.....","bb..bPPPPb..bb","bPbbPPPPPPbbPb",".bPPPPyyPPPPb.","..bbPPyyPPbb..","...bPPPPPPb...","...bPPbbPPb...","..bPPb..bPPb..","..bPPb..bPPb..","..bPPb..bPPb..","...bb....bb..."]]
    ]}
  ],
  "night_remap": {"#537D59":"#43847C","#78A05D":"#43847C","#9FC66A":"#537D59","#BFDA82":"#519F95","#DDE8A3":"#6CBAB2"},
  "plaza": [
    {"name":"tile-dancefloor-0","size":[16,16],"ops":[["checker","o","h"]]},
    {"name":"tile-dancefloor-1","size":[16,16],"ops":[["checker","r","i"]]},
    {"name":"prop-stage","size":[48,32],"ops":[
      ["poly","b",[[4,9],[43,9],[46,14],[46,26],[31,26],[31,31],[16,31],[16,26],[1,26],[1,14]]],
      ["poly","h",[[5,10],[42,10],[44,14],[3,14]]],["rect",3,15,44,19,"o"],
      ["rect",2,20,45,25,"B"],["rect",3,20,44,20,"h"],
      ["rect",5,22,6,25,"b"],["rect",40,22,41,25,"b"],
      ["line","B",[[5,12],[42,12]]],["line","B",[[3,16],[44,16]]],
      ["line","B",[[11,10],[10,12]]],["line","B",[[29,10],[29,12]]],
      ["line","B",[[20,13],[20,15]]],["line","B",[[37,13],[38,15]]],
      ["rect",16,25,31,27,"b"],["rect",17,25,30,25,"c"],["rect",17,26,30,27,"h"],
      ["rect",16,28,31,28,"b"],["rect",16,29,31,30,"o"],["rect",16,29,31,29,"h"],
      ["rect",16,31,31,31,"b"]
    ]},
    {"name":"prop-bunting","size":[48,16],"ops":[
      ["line","b",[[1,1],[7,3],[15,5],[23,6],[31,5],[39,3],[46,1]]],
      ["poly","b",[[4,3],[12,5],[8,12]]],["poly","P",[[5,4],[10,5],[8,10]]],
      ["poly","b",[[15,6],[22,7],[19,15]]],["poly","y",[[16,7],[21,8],[19,13]]],
      ["poly","b",[[25,7],[32,6],[28,15]]],["poly","w",[[26,8],[31,7],[28,13]]],
      ["poly","b",[[35,5],[43,3],[39,12]]],["poly","G",[[36,5],[42,4],[39,10]]]
    ]},
    {"name":"prop-snack-table","size":[32,32],"ops":[
      ["rect",6,16,8,28,"b"],["rect",7,19,8,27,"h"],
      ["rect",23,16,25,28,"b"],["rect",23,19,24,27,"o"],
      ["rect",5,28,9,29,"b"],["rect",22,28,26,29,"b"],
      ["poly","b",[[5,10],[26,10],[29,15],[29,19],[2,19],[2,15]]],
      ["poly","h",[[6,11],[25,11],[27,15],[4,15]]],
      ["rect",3,16,28,18,"o"],["rect",3,16,28,16,"c"],
      ["poly","P",[[12,11],[19,11],[21,15],[21,22],[10,22],[10,15]]],
      ["rect",11,16,20,21,"p"],["rect",12,16,13,21,"P"],
      ["stamp",5,8,[".bbbbbb.","bccccccb","bcyyyccb",".bbbbbb."]],
      ["stamp",21,5,["..bbbb..",".bWwwwb.",".bvyywb.",".bvyywb.",".bwwttb.","..bbbb.."]],
      ["rect",23,3,24,5,"b"],["rect",23,3,23,4,"h"],
      ["stamp",14,7,[".bbb.","bcycb",".bbb."]],
      ["rect",14,22,17,30,"b"],["rect",15,23,16,30,"o"],
      ["rect",13,31,18,31,"b"]
    ]}
  ]
}
""")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def rgba(color, alpha=255):
    return (*bytes.fromhex(color.lstrip("#")), alpha)


SYMBOLS = {key: rgba(value) for key, value in RECIPE["symbols"].items()}
MASKS = {key: rgba(value) for key, value in RECIPE["mask_symbols"].items()}
CLEAR = rgba(INK, 0)


def blank(size, fill=None):
    return Image.new("RGBA", tuple(size), SYMBOLS[fill] if fill else CLEAR)


def pixel(image, x, y, color):
    require(0 <= x < image.width and 0 <= y < image.height,
            f"Drawing outside {image.size}: {(x, y)}")
    image.putpixel((x, y), color)


def stamp(image, x, y, rows, symbols=SYMBOLS):
    for dy, row in enumerate(rows):
        require(0 <= y + dy < image.height and x + len(row) <= image.width,
                f"Stamp outside {image.size}: {(x, y + dy, len(row))}")
        for dx, mark in enumerate(row):
            if mark != ".":
                pixel(image, x + dx, y + dy, symbols[mark])


def line(image, points, color):
    """Integer Bresenham, including both endpoints."""
    for start, end in zip(points, points[1:]):
        x, y = start
        bx, by = end
        dx, dy = abs(bx - x), -abs(by - y)
        sx, sy = (1 if x < bx else -1), (1 if y < by else -1)
        error = dx + dy
        while True:
            pixel(image, x, y, color)
            if (x, y) == (bx, by):
                break
            twice = 2 * error
            if twice >= dy:
                error += dy
                x += sx
            if twice <= dx:
                error += dx
                y += sy


def polygon(image, points, color):
    """Connected flat fill at pixel centers, then a one-pixel stepped border."""
    for y in range(min(p[1] for p in points), max(p[1] for p in points) + 1):
        for x in range(min(p[0] for p in points), max(p[0] for p in points) + 1):
            inside = False
            px, py = x + 0.5, y + 0.5
            for a, b in zip(points, points[1:] + points[:1]):
                if (a[1] > py) != (b[1] > py):
                    cross = (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0]
                    if px < cross:
                        inside = not inside
            if inside:
                pixel(image, x, y, color)
    line(image, points + points[:1], color)


def draw(image, ops):
    for op in ops:
        kind = op[0]
        if kind == "stamp":
            stamp(image, *op[1:])
        elif kind in ("rect", "clear", "restore"):
            x0, y0, x1, y1 = op[1:5]
            for y in range(y0, y1 + 1):
                for x in range(x0, x1 + 1):
                    color = (CLEAR if kind == "clear" else
                             HOUSE.getpixel((x, y)) if kind == "restore" else SYMBOLS[op[5]])
                    pixel(image, x, y, color)
        elif kind == "line":
            line(image, op[2], SYMBOLS[op[1]])
        elif kind == "poly":
            polygon(image, op[2], SYMBOLS[op[1]])
        elif kind == "checker":
            # A 2px phase makes matching edge columns/rows AND 4px runs at joins.
            for y in range(image.height):
                for x in range(image.width):
                    slot = (((x + 2) // 4) + ((y + 2) // 4)) % 2
                    pixel(image, x, y, SYMBOLS[op[1 + slot]])
        else:
            raise ValueError(f"Unknown operation: {kind}")
    return image


def snow_roof(image):
    roof = {SYMBOLS[key] for key in ("b", "W", "T", "t")}
    # Snow lies inside the original silhouette, including the chimney cap.
    for x in range(3, 45):
        top = next((y for y in range(36) if image.getpixel((x, y)) in roof), None)
        if top is None:
            continue
        depth = 2 + (x // 8) % 3
        for dy in range(depth):
            y = top + dy
            if image.getpixel((x, y)) in roof:
                pixel(image, x, y, SYMBOLS["n" if dy < depth - 1 else "i"])
    return image


def autumn_roof(image):
    warmer = {SYMBOLS["W"]: SYMBOLS["f"], SYMBOLS["T"]: SYMBOLS["u"],
              SYMBOLS["t"]: SYMBOLS["b"]}
    for y in range(40):
        for x in range(48):
            color = image.getpixel((x, y))
            if color in warmer:
                pixel(image, x, y, warmer[color])
    draw(image, [["stamp", 6, 42, ["PP.", ".P."]],
                 ["stamp", 37, 43, [".yy", "yy."]],
                 ["stamp", 10, 43, ["uu", ".u"]]])
    return image


HOUSE = Image.open(ART / "prop-house-aframe.png").convert("RGBA")
TREE = Image.open(ART / "prop-tree.png").convert("RGBA")


def normalize(image):
    for y in range(image.height):
        for x in range(image.width):
            if image.getpixel((x, y))[3] == 0:
                image.putpixel((x, y), CLEAR)
    return image


def save(name, image, batch, batches):
    normalize(image).save(OUT / f"{name}.png")
    batches[batch].append(name)


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    batches = {i: [] for i in range(1, 6)}
    atlas = blank((96, 112))
    metadata = []
    for part in RECIPE["parts"]:
        cell = blank((16, 16))
        stamp(cell, *part["at"], part["rows"], MASKS)
        atlas.paste(cell, (part["x"], part["y"]))
        metadata.append({key: part[key] for key in ("kind", "name", "x", "y", "anchor")})
    save("pet-parts", atlas, 1, batches)
    (OUT / "pet-parts.json").write_text(
        json.dumps({"cell": 16, "parts": metadata}, indent=2) + "\n", encoding="utf-8")
    verify_batch(1, batches[1])

    for spec in RECIPE["houses"]:
        name = f"house-aframe-{spec['name']}"
        house = draw(HOUSE.copy(), spec["ops"])
        save(name, house, 2, batches)
        save(name + "-snow", snow_roof(house.copy()), 2, batches)
        save(name + "-autumn", autumn_roof(house.copy()), 2, batches)
    verify_batch(2, batches[2])

    for spec in RECIPE["small"]:
        image = blank((16, 16))
        stamp(image, *spec["at"], spec["rows"])
        save(spec["name"], image, 3, batches)
    verify_batch(3, batches[3])

    for theme, fill, prefix in (("sand", "F", "tile-sand"),
                                ("night", "d", "tile-grass-night")):
        for index, ops in enumerate(RECIPE[theme]):
            save(f"{prefix}-{index}", draw(blank((16, 16), fill), ops), 4, batches)
    for spec in RECIPE["scenery"]:
        save(spec["name"], draw(blank(spec["size"]), spec["ops"]), 4, batches)
    night = TREE.copy()
    remap = {rgba(key): rgba(value) for key, value in RECIPE["night_remap"].items()}
    for y in range(night.height):
        for x in range(night.width):
            color = night.getpixel((x, y))
            if color[3] and color in remap:
                pixel(night, x, y, remap[color])
    save("prop-tree-night", night, 4, batches)
    verify_batch(4, batches[4])

    for spec in RECIPE["plaza"]:
        save(spec["name"], draw(blank(spec["size"]), spec["ops"]), 5, batches)
    verify_batch(5, batches[5])
    return batches


def palette():
    text = (ROOT / "docs/STYLE.md").read_text(encoding="utf-8")
    marked = text.split("<!-- moodboard:palette:start -->", 1)[1].split(
        "<!-- moodboard:palette:end -->", 1)[0]
    colors = {rgba(value)[:3] for value in re.findall(r"#[0-9A-Fa-f]{6}", marked)}
    require(len(colors) == 28, "Expected the canonical 28-color palette")
    require({color[:3] for color in SYMBOLS.values()} == colors, "Symbol palette drift")
    return colors


PALETTE = palette()
REPORTS = []
EXPECTED_COUNTS = {1: 1, 2: 12, 3: 14, 4: 10, 5: 5}


def expected_size(name):
    if name == "pet-parts":
        return (96, 112)
    if name.startswith("house-"):
        return (48, 48)
    return {"prop-palm": (32, 48), "prop-tree-night": (32, 48),
            "prop-stage": (48, 32), "prop-bunting": (48, 16),
            "prop-snack-table": (32, 32)}.get(name, (16, 16))


def verify_parts():
    data = json.loads((OUT / "pet-parts.json").read_text(encoding="utf-8"))
    atlas = Image.open(OUT / "pet-parts.png").convert("RGBA")
    counts = Counter(part["kind"] for part in data["parts"])
    require(data["cell"] == 16 and counts == {
        "ear": 6, "horn": 4, "tail": 6, "foot": 3,
        "eye": 6, "mouth": 4, "pattern": 4}, "Wrong part inventory")
    require(len({(p["kind"], p["name"]) for p in data["parts"]}) == 33,
            "Duplicate part names")
    occupied = set()
    for part in data["parts"]:
        x, y = part["x"], part["y"]
        require(x % 16 == y % 16 == 0 and 0 <= x <= atlas.width - 16
                and 0 <= y <= atlas.height - 16, f"Bad cell: {part}")
        require((x, y) not in occupied, "Overlapping part cells")
        occupied.add((x, y))
        ax, ay = part["anchor"]
        require(0 <= ax < 16 and 0 <= ay < 16, "Anchor outside cell")
        if part["kind"] in ("ear", "horn"):
            require([ax, ay] == [8, 15], "Ears/horns attach at bottom middle")
        if part["kind"] == "foot":
            require([ax, ay] == [8, 0], "Feet attach at top middle")
        if part["kind"] in ("eye", "mouth"):
            require([ax, ay] == [8, 8], "Face parts attach at center")
        crop = atlas.crop((x, y, x + 16, y + 16))
        visible = [p for p in crop.getdata() if p[3]]
        require(visible, f"Empty part: {part['name']}")
        if part["kind"] in ("ear", "horn", "tail", "foot"):
            require(crop.getpixel((ax, ay))[3] == 255,
                    f"Floating attachment: {part['kind']}/{part['name']}")
        if part["kind"] == "pattern":
            require(set(visible) == {MASKS["A"]}, "Patterns must be accent-only")
        if part["name"] == "big-shiny":
            require(visible.count(MASKS["E"]) == 1, "Big eye needs one white highlight")


def edges(image):
    return ([image.getpixel((0, y)) for y in range(image.height)],
            [image.getpixel((image.width - 1, y)) for y in range(image.height)],
            [image.getpixel((x, 0)) for x in range(image.width)],
            [image.getpixel((x, image.height - 1)) for x in range(image.width)])


def verify_batch(batch, names):
    require(len(names) == EXPECTED_COUNTS[batch], f"Incomplete batch {batch}")
    for name in names:
        with Image.open(OUT / f"{name}.png") as image:
            require(image.format == "PNG" and image.mode == "RGBA", f"Not RGBA PNG: {name}")
            require(image.size == expected_size(name), f"Wrong size: {name}")
            pixels = list(image.getdata())
            require({p[3] for p in pixels} <= {0, 255}, f"Partial alpha: {name}")
            allowed = {p[:3] for p in MASKS.values()} if name == "pet-parts" else PALETTE
            require(all(p[:3] in allowed for p in pixels if p[3]), f"Off-palette: {name}")
            require(all(p == CLEAR for p in pixels if not p[3]), f"Invisible RGB: {name}")
            if name.startswith("tile-"):
                require(all(p[3] == 255 for p in pixels), f"Transparent tile: {name}")
                left, right, top, bottom = edges(image)
                require(left == right and top == bottom, f"Tile seam: {name}")
                if not name.startswith("tile-dancefloor"):
                    base, coverage = Counter(pixels).most_common(1)[0]
                    require(coverage / 256 >= 0.95, f"Noisy ground: {name}")
                    require(all(image.getpixel((x, y)) == base
                                for y in range(16) for x in range(16)
                                if x < 2 or y < 2 or x > 13 or y > 13),
                            f"Detail in 2px seam margin: {name}")
                else:
                    require(len(set(pixels)) == 2, f"Checker must use two colors: {name}")
            else:
                require(any(p[3] == 0 for p in pixels), f"Prop lacks transparency: {name}")
            if name.startswith("house-"):
                require(image.crop((0, 45, 48, 48)).tobytes() ==
                        normalize(HOUSE.copy()).crop((0, 45, 48, 48)).tobytes(),
                        f"House ground/step moved: {name}")
                require(image.getpixel((24, 39))[3] == 255, f"Door contact moved: {name}")
    extra = ""
    if batch == 1:
        verify_parts()
        extra = "; all 33 named, nonempty cells + attachment anchors PASS"
    elif batch == 2:
        extra = "; all 12 ground rows/door contacts PASS"
    elif batch == 4:
        night = Image.open(OUT / "prop-tree-night.png").convert("RGBA")
        require(night.getchannel("A").tobytes() == TREE.getchannel("A").tobytes(),
                "Night tree alpha changed")
        for old, new in zip(TREE.getdata(), night.getdata()):
            if old[3] and f"#{old[0]:02X}{old[1]:02X}{old[2]:02X}" not in RECIPE["night_remap"]:
                require(old == new, "Night tree changed non-canopy pixels")
        for prefix in ("tile-sand", "tile-grass-night"):
            variants = [Image.open(OUT / f"{prefix}-{i}.png").convert("RGBA") for i in range(3)]
            require(all(edges(im) == edges(variants[0]) for im in variants),
                    f"Mixed-variant seam: {prefix}")
        extra = "; ground >=95% base, 2px margins + all variant joins PASS; tree alpha/wood PASS"
    elif batch == 5:
        extra = "; opaque two-color periodic checkers + matching opposite edges PASS"
    report = (f"Batch {batch}: {len(names)} PNGs; exact sizes, canonical RGB, "
              f"binary alpha, transparent ink PASS{extra}")
    REPORTS.append(report)
    print(report)


# An unaliased 3x5 bitmap alphabet keeps the review sheet itself crisp and on-palette.
FONT = json.loads(r"""
{
    "A":"010101111101101", "B":"110101110101110", "C":"011100100100011",
    "D":"110101101101110", "E":"111100110100111", "F":"111100110100100",
    "G":"011100101101011", "H":"101101111101101", "I":"111010010010111",
    "J":"001001001101010", "K":"101101110101101", "L":"100100100100111",
    "M":"101111111101101", "N":"101111111111101", "O":"010101101101010",
    "P":"110101110100100", "Q":"010101101111011", "R":"110101110101101",
    "S":"011100010001110", "T":"111010010010010", "U":"101101101101111",
    "V":"101101101101010", "W":"101101111111101", "X":"101101010101101",
    "Y":"101101010010010", "Z":"111001010100111", "0":"111101101101111",
    "1":"010110010010111", "2":"110001010100111", "3":"110001010001110",
    "4":"101101111001001", "5":"111100110001110", "6":"011100111101111",
    "7":"111001010010010", "8":"111101111101111", "9":"111101111001110",
    "-":"000000111000000", "/":"001001010100100", ":":"000010000010000",
    ".":"000000000000010", "+":"000010111010000", " ":"000000000000000"
}
""")


def text(image, x, y, label, color="k"):
    for index, char in enumerate(label.upper()):
        glyph = FONT.get(char, FONT[" "])
        for i, bit in enumerate(glyph):
            if bit == "1":
                pixel(image, x + index * 4 + i % 3, y + i // 3, SYMBOLS[color])


def panel(image, x, y, width, height, fill="F"):
    draw(image, [["rect", x, y, x + width - 1, y + height - 1, fill]])


def paste(image, name, x, y):
    with Image.open(OUT / f"{name}.png") as sprite:
        image.alpha_composite(sprite.convert("RGBA"), (x, y))


def mask_preview(image):
    """Only pet-parts.png uses label RGB; the review sheet stays on-palette."""
    preview = image.copy()
    paint = {MASKS[label]: SYMBOLS[color] for label, color in
             (("R", "U"), ("A", "P"), ("B", "F"), ("E", "n"), ("K", "k"))}
    for y in range(preview.height):
        for x in range(preview.width):
            color = preview.getpixel((x, y))
            if color[3]:
                pixel(preview, x, y, paint[color])
    return preview


def contact_sheet(batches):
    sheet = blank((608, 704), "c")
    text(sheet, 12, 10, "MINDWORLD / STATIC BACKLOG / 2X NEAREST")
    text(sheet, 12, 22, "1 PET MASKS / PALETTE PREVIEW - RAW PNG USES LABEL RGB")
    atlas = mask_preview(Image.open(OUT / "pet-parts.png").convert("RGBA"))
    panel(sheet, 12, 34, 104, 120, "i")
    sheet.alpha_composite(atlas, (16, 38))
    # Every atlas cell is also shown separately with a name, so tiny face masks
    # and metadata correspondences can be assessed without guessing cell order.
    for row, kind in enumerate(("ear", "horn", "tail", "foot", "eye", "mouth", "pattern")):
        members = [p for p in RECIPE["parts"] if p["kind"] == kind]
        yy = 34 + row * 25
        for col, part in enumerate(members):
            xx = 128 + col * 78
            panel(sheet, xx, yy, 72, 23, "i")
            crop = atlas.crop((part["x"], part["y"], part["x"] + 16, part["y"] + 16))
            sheet.alpha_composite(crop, (xx + 2, yy + 1))
            # Split long names across two crisp text lines.
            words = part["name"].upper().split("-")
            label = "-".join(words)
            if len(label) > 12:
                text(sheet, xx + 20, yy + 3, words[0])
                text(sheet, xx + 20, yy + 11, "-".join(words[1:]))
            else:
                text(sheet, xx + 20, yy + 7, label)
    text(sheet, 12, 154, "REFERENCES")
    panel(sheet, 12, 160, 104, 50, "G")
    sheet.alpha_composite(HOUSE, (12, 162))
    sheet.alpha_composite(TREE, (80, 162))
    with Image.open(ART / "npc-mo.png") as villager:
        sheet.alpha_composite(villager.convert("RGBA").crop((0, 0, 16, 24)), (62, 186))
    text(sheet, 12, 215, "2 A-FRAMES / ORIGINAL DOOR AND GROUND CONTACT")
    for col, spec in enumerate(RECIPE["houses"]):
        for row, suffix in enumerate(("", "-snow", "-autumn")):
            xx, yy = 12 + col * 148, 228 + row * 66
            panel(sheet, xx, yy, 140, 62, "G" if not suffix else "n" if suffix == "-snow" else "f")
            paste(sheet, "house-aframe-" + spec["name"] + suffix, xx + 46, yy + 2)
            text(sheet, xx + 4, yy + 54, spec["name"] + suffix)
    text(sheet, 12, 432, "3 HELD ITEMS AND SMALL PROPS / 16X16")
    for index, name in enumerate(batches[3]):
        xx, yy = 12 + (index % 7) * 84, 444 + (index // 7) * 35
        panel(sheet, xx, yy, 78, 32)
        paste(sheet, name, xx + 30, yy + 1)
        label = name.replace("held-", "")
        text(sheet, xx + 2, yy + 23, label)
    text(sheet, 12, 520, "4 BEACH AND MOONLIT MEADOW / 3X3 MIXED TILE JOINS")
    for col, prefix in enumerate(("tile-sand", "tile-grass-night")):
        xx = 12 + col * 300
        for ty in range(3):
            for tx in range(3):
                paste(sheet, f"{prefix}-{(ty + tx) % 3}", xx + tx * 16, 532 + ty * 16)
        panel(sheet, xx + 58, 532, 234, 48, "F" if col == 0 else "d")
        if col == 0:
            paste(sheet, "prop-palm", xx + 62, 532)
            paste(sheet, "decor-shell", xx + 110, 564)
            paste(sheet, "decor-starfish", xx + 142, 564)
            text(sheet, xx + 102, 536, "PALM / SHELL / STARFISH")
        else:
            paste(sheet, "prop-tree-night", xx + 70, 532)
            text(sheet, xx + 112, 536, "TREE NIGHT", "i")
            text(sheet, xx + 112, 546, "ORIGINAL ALPHA", "i")
    text(sheet, 12, 590, "5 PARTY PLAZA / PERIODIC FLOORS / STATIC PROPS")
    for col in range(2):
        for ty in range(3):
            for tx in range(3):
                paste(sheet, f"tile-dancefloor-{col}", 12 + col * 64 + tx * 16, 604 + ty * 16)
    panel(sheet, 152, 604, 440, 48, "G")
    paste(sheet, "prop-stage", 176, 620)
    paste(sheet, "prop-bunting", 284, 604)
    paste(sheet, "prop-snack-table", 404, 620)
    text(sheet, 166, 662, "STAGE 48X32")
    text(sheet, 278, 662, "BUNTING 48X16")
    text(sheet, 392, 662, "SNACK TABLE 32X32")
    text(sheet, 12, 686, "42 PNGS + 33 PART RECORDS / PALETTE AND BINARY ALPHA CHECKED")
    require(all(p[:3] in PALETTE and p[3] == 255 for p in sheet.getdata()),
            "Contact sheet must be opaque and canonical; masks use preview colors")
    sheet = sheet.resize((1216, 1408), Image.Resampling.NEAREST)
    CONTACT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT)
    # Prove the final sheet is an exact 2x replication, not a smoothed export.
    with Image.open(CONTACT) as check:
        require(check.mode == "RGBA" and check.size == (1216, 1408), "Contact sheet format")
        require(all(check.getpixel((x, y)) == check.getpixel((x + dx, y + dy))
                    for y in range(0, check.height, 2) for x in range(0, check.width, 2)
                    for dx, dy in ((1, 0), (0, 1), (1, 1))), "Contact is not exact 2x")


def write_note():
    lines = [
        "# B3 static backlog art", "",
        "- Batch 1: 96x112 label atlas, 33 parts in independent 16x16 cells; JSON with local attachment anchors.",
        "- Batch 2: four 48x48 A-frame variants, each with snow and autumn versions (12 PNGs).",
        "- Batch 3: all 14 requested 16x16 held items and props.",
        "- Batch 4: sand x3, palm, shell, starfish; night meadow x3 and matching-mask night tree (10 PNGs).",
        "- Batch 5: two periodic checker floors, wooden stage, bunting and snack table (5 PNGs).", "",
        *["- " + report for report in REPORTS],
        "- Contact sheet: 1216x1408, exactly 2x nearest-neighbor; includes every PNG, named part crops, and mixed 3x3 terrain repeats.",
        "- Contact-only pet preview maps labels to canonical fur/coral/cream/ink; pet-parts.png retains the exact five mask RGBs. Original house/tree/Mo references are shown alongside.",
        "- No assets skipped. No animation, runtime integration, paid calls, installs or reference-file edits.",
        "- Houses retain the original bottom three stair rows and central door contact; the round door changes only its upper outline.",
        "- Night tree retains every original opaque non-canopy pixel. Ground variants have identical clean 2px borders and 96.48% base coverage.",
        "- Static visual review is separate from in-game/CRT approval; these are backlog assets awaiting integration.",
    ]
    NOTE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    references = [ART / name for name in (
        "prop-house-aframe.png", "props-grounds.png", "props-decor.png",
        "prop-tree.png", "tile-grass-0.png", "npc-mo.png")]
    before = {path: hashlib.sha256(path.read_bytes()).hexdigest() for path in references}
    batches = build()
    require(sum(map(len, batches.values())) == 42, "Expected 42 PNGs")
    contact_sheet(batches)
    require(all(hashlib.sha256(path.read_bytes()).hexdigest() == digest
                for path, digest in before.items()), "Reference file changed")
    write_note()
    print("PASS: 42 PNGs + pet-parts.json; contact sheet exact 2x; all six references unchanged.")


if __name__ == "__main__":
    main()
