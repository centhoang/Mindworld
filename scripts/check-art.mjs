// New-art limits, in logical pixels. Native samples: .scratch/art/gen/pack-metrics.json.
// These production envelopes include explicitly chosen commissions in STYLE.md.
// visible = [minW,maxW,minH,maxH]; padding = [min,max] per L/T/R/B (or shared).
// noise = [isolated alpha pixels (8-connected), single-colour pixels (4-connected)].
const LIMITS = {
  human: { canvas: [[96,64]], visible: [11,14,15,16], padding: [[43,43],[23,24],[39,42],[25,25]], colours: [3,20], noise: [0,35] },
  'small-animal': { canvas: [[16,16]], visible: [14,15,10,14], padding: [[0,2],[0,3],[0,2],[2,3]], colours: [3,10], noise: [0,18], shadows: ['bird','duck'] },
  'large-animal': { canvas: [[32,32]], visible: [16,23,16,20], padding: [[4,7],[3,7],[5,9],[8,10]], colours: [3,9], noise: [0,20], shadows: ['animal'] },
  tree: { canvas: [[32,34],[28,43]], visible: [18,26,30,33], padding: [[3,5],[0,5],[3,5],[3,5]], colours: [3,12], noise: [0,35], shadows: ['broadleaf','conifer'] },
  crop: { canvas: [[12,14],[16,13],[10,13],[13,19],[16,16],[16,24]], visible: [10,16,13,19], padding: [0,5], colours: [3,11], noise: [2,25] },
  'building-prop': { canvas: [[16,16],[16,24],[16,32],[32,16],[32,32],[48,32]], visible: [10,48,8,32], padding: [0,11], colours: [3,12], noise: [2,36], shadows: ['prop','table'] },
  'floor-or-terrain-tile': { canvas: [[16,16]], visible: [16,16,16,16], padding: [0,0], colours: [1,12], noise: [0,18] },
  'carried-item-or-food': { canvas: [[10,11],[11,11],[12,11],[10,12],[16,16]], visible: [8,12,8,15], padding: [0,7], colours: [3,11], noise: [1,18] },
  'UI-icon': { canvas: [[11,12],[15,13],[12,12],[12,11],[13,13],[16,16]], visible: [11,15,11,14], padding: [0,3], colours: [3,9], noise: [0,16] },
  'UI-panel': { canvasRange: [9,384,9,216], visible: [9,384,9,216], padding: [0,0], colours: [2,4], noise: [0,8] },
  'speech-or-emotion-icon': { canvas: [[9,9],[4,9],[7,10],[9,8],[7,7],[16,16]], visible: [4,9,7,10], padding: [0,9], colours: [3,4], noise: [1,10] },
  'pet-16': { canvas: [[16,16]], visible: [10,14,9,13], padding: [[1,3],[1,5],[1,3],[2,2]], colours: [3,8], noise: [0,12] },
  'pet-32': { canvas: [[32,32]], visible: [16,26,16,26], padding: [[1,8],[4,14],[1,8],[2,2]], colours: [3,10], noise: [0,20] },
  'pet-48': { canvas: [[48,48]], visible: [26,40,26,40], padding: [[1,11],[5,19],[1,11],[3,3]], colours: [3,12], noise: [0,28] },
  'wild-pet': { variants: ['pet-16','pet-32','pet-48'] },
  'market-stall': { canvas: [[48,48],[64,48]], visible: [40,60,32,44], padding: [1,8], colours: [3,12], noise: [0,35] },
  'bubble-container': { canvas: [[24,16],[32,24]], visible: [24,32,16,21], padding: [[0,0],[0,0],[0,0],[0,3]], colours: [3,4], noise: [0,14] },
};

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import assert from 'node:assert/strict';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
// Only an explicit manifest shadow name permits these native hard-edged shadows.
const SHADOWS = {
  bird: ['#000000',63], duck: ['#181425',65], animal: ['#262B44',74],
  broadleaf: ['#142F30',49], conifer: ['#193C3E',135], prop: ['#181425',135], table: ['#000000',81],
};
const signature = Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable = Array.from({length:256},(_,i)=>{let c=i;for(let n=0;n<8;n++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(buf) {let c=0xFFFFFFFF;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function decode(buf) {
  assert(buf.subarray(0,8).equals(signature),'not a PNG');
  let header,table,alpha,ended=false;const compressed=[];
  for(let offset=8;offset<buf.length;) {
    assert(offset+12<=buf.length,'truncated PNG chunk');
    const len=buf.readUInt32BE(offset),type=buf.toString('ascii',offset+4,offset+8);
    assert(offset+12+len<=buf.length,'truncated PNG data');
    const data=buf.subarray(offset+8,offset+8+len);
    assert.equal(crc32(buf.subarray(offset+4,offset+8+len)),buf.readUInt32BE(offset+8+len),`PNG CRC ${type}`);
    if(type==='IHDR'){assert(!header,'duplicate PNG header');header=data;}
    if(type==='PLTE')table=data;
    if(type==='tRNS')alpha=data;
    if(type==='IDAT')compressed.push(data);
    if(type==='IEND'){ended=true;break;}
    offset+=len+12;
  }
  assert(header?.length===13&&ended,'missing PNG header/end');
  const w=header.readUInt32BE(0),h=header.readUInt32BE(4),depth=header[8],type=header[9];
  assert(w>0&&h>0&&w<=4096&&h<=4096,'invalid/oversized PNG');
  assert.equal(header[10],0,'PNG compression');assert.equal(header[11],0,'PNG filter method');assert.equal(header[12],0,'interlaced PNG unsupported');
  assert([2,3,6].includes(type),'expected RGB/RGBA/indexed PNG');
  assert(type===3?[1,2,4,8].includes(depth):depth===8,'unsupported PNG bit depth');
  const channels=type===6?4:type===2?3:1,stride=Math.ceil(w*channels*depth/8),bpp=Math.max(1,Math.ceil(channels*depth/8));
  const raw=inflateSync(Buffer.concat(compressed),{maxOutputLength:(stride+1)*h});
  assert.equal(raw.length,(stride+1)*h,'PNG scanline length');
  const pixels=Buffer.alloc(stride*h),data=Buffer.alloc(w*h*4);
  const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
  for(let y=0;y<h;y++) {
    const filter=raw[y*(stride+1)];assert(filter<=4,'PNG row filter');
    for(let x=0;x<stride;x++) {
      const i=y*stride+x,a=x>=bpp?pixels[i-bpp]:0,b=y?pixels[i-stride]:0,c=y&&x>=bpp?pixels[i-stride-bpp]:0;
      pixels[i]=raw[y*(stride+1)+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];
    }
    for(let x=0;x<w;x++) {
      const p=(y*w+x)*4;
      if(type===3) {
        const bit=x*depth,index=(pixels[y*stride+(bit>>3)]>>(8-depth-bit%8))&((1<<depth)-1);
        assert(table&&index*3+2<table.length,'invalid PNG palette index');
        data.set([table[index*3],table[index*3+1],table[index*3+2],alpha?.[index]??255],p);
      } else {
        const i=y*stride+x*channels,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
        const transparent=type===2&&alpha?.length===6&&r===alpha.readUInt16BE(0)&&g===alpha.readUInt16BE(2)&&b===alpha.readUInt16BE(4);
        data.set([r,g,b,channels===4?pixels[i+3]:transparent?0:255],p);
      }
    }
  }
  return {w,h,data};
}
const hexAt=(data,p)=>'#'+[data[p],data[p+1],data[p+2]].map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
const oneLine=error=>String(error.message??error).replace(/\s+/g,' ').trim();
const within=(n,range)=>n>=range[0]&&n<=range[1];
const dimensions=(w,h,r)=>within(w,r.slice(0,2))&&within(h,r.slice(2));
function inspect(im,row,rule,palette) {
  const failures=[];const fail=s=>failures.push(s);
  if(rule.canvas?!rule.canvas.some(([w,h])=>w===im.w&&h===im.h):!dimensions(im.w,im.h,rule.canvasRange))fail(`canvas ${im.w}x${im.h} outside type limits`);
  if(row.size&&(!Array.isArray(row.size)||row.size[0]!==im.w||row.size[1]!==im.h))fail('manifest size disagrees with PNG');
  let left=im.w,top=im.h,right=-1,bottom=-1,partial=0;
  const colors=new Set(),extra=new Set(),body=new Uint8Array(im.w*im.h);const ids=[];
  const shadow=row.shadow&&row.shadow!=='none'?SHADOWS[row.shadow]:null;
  if(row.shadow&&row.shadow!=='none'&&(!shadow||!rule.shadows?.includes(row.shadow)))fail(`shadow ${String(row.shadow)} is not permitted for type`);
  for(let p=0;p<body.length;p++) {
    const i=p*4,a=im.data[i+3];if(!a)continue;
    const hex=hexAt(im.data,i),x=p%im.w,y=Math.floor(p/im.w);
    if(a!==255) {
      partial++;
      if(!shadow||!rule.shadows?.includes(row.shadow)||a!==shadow[1]||hex!==shadow[0]||y<Math.floor(im.h*0.6))failures.includes('nonbinary alpha outside permitted bottom shadow')||fail('nonbinary alpha outside permitted bottom shadow');
      // Shadow RGB is an explicit exception to the daytime opaque palette.
      continue;
    }
    if(!palette.has(hex))extra.add(hex);
    colors.add(hex);ids[p]=hex;body[p]=1;
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  if(partial>im.w*im.h*0.3)fail('shadow exceeds 30% of canvas');
  if(extra.size)fail(`nonpalette colours ${[...extra].join(',')}`);
  if(right<0){fail('empty body');return failures;}
  const w=right-left+1,h=bottom-top+1;
  if(!dimensions(w,h,rule.visible))fail(`visible ${w}x${h} outside ${rule.visible[0]}..${rule.visible[1]} x ${rule.visible[2]}..${rule.visible[3]}`);
  const pads=[left,top,im.w-right-1,im.h-bottom-1];
  const limits=Array.isArray(rule.padding[0])?rule.padding:Array(4).fill(rule.padding);
  pads.forEach((n,i)=>{if(!within(n,limits[i]))fail(`padding ${['left','top','right','bottom'][i]} ${n} outside ${limits[i].join('..')}`);});
  if(!within(colors.size,rule.colours))fail(`colour count ${colors.size} outside ${rule.colours.join('..')}`);
  let isolated=0,singleColour=0;
  for(let p=0;p<body.length;p++)if(body[p]) {
    const x=p%im.w,y=Math.floor(p/im.w);let any=false,same=false;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&x+dx>=0&&x+dx<im.w&&y+dy>=0&&y+dy<im.h) {
      const q=(y+dy)*im.w+x+dx;
      if(body[q])any=true;
      if(Math.abs(dx)+Math.abs(dy)===1&&body[q]&&ids[p]===ids[q])same=true;
    }
    if(!any)isolated++;if(!same)singleColour++;
  }
  if(isolated>rule.noise[0])fail(`isolated single-pixel noise ${isolated} > ${rule.noise[0]}`);
  if(singleColour>rule.noise[1])fail(`single-colour pixel clusters ${singleColour} > ${rule.noise[1]}`);
  return failures;
}

try {
  assert(process.argv.length===3,'usage: node scripts/check-art.mjs <manifest.json>');
  const style=await readFile(path.join(ROOT,'docs/visual/style.md'),'utf8');
  const block=style.split('<!-- moodboard:palette:start -->')[1]?.split('<!-- moodboard:palette:end -->')[0];
  assert(block,'STYLE.md palette block missing');const palette=new Set(block.match(/#[0-9a-fA-F]{6}/g)?.map(c=>c.toUpperCase()));
  assert(palette.size,'STYLE.md palette empty');
  const manifest=JSON.parse(await readFile(path.resolve(process.argv[2]),'utf8'));
  const rows=Array.isArray(manifest)?manifest:manifest.assets;
  assert(Array.isArray(rows)&&rows.length,'manifest needs a nonempty array or assets array');
  let failures=0;const files=new Set();
  for(const row of rows) {
    const label=row?.file??'<missing file>';
    try {
      assert(row&&typeof row.file==='string'&&typeof row.type==='string','row needs file and type');
      assert(!files.has(row.file),'duplicate manifest file');files.add(row.file);
      let rule=LIMITS[row.type];assert(rule,`unknown type ${row.type}`);
      // Manifest file paths are repository-relative, independent of shell cwd.
      const file=path.resolve(ROOT,row.file),rel=path.relative(ROOT,file);
      assert(!rel.startsWith('..')&&!path.isAbsolute(rel),'file must be inside repository');
      const im=decode(await readFile(file));
      if(rule.variants) {rule=rule.variants.map(t=>LIMITS[t]).find(r=>r.canvas.some(([w,h])=>im.w===w&&im.h===h));assert(rule,'wild-pet canvas must be 16, 32 or 48 square');}
      for(const reason of inspect(im,row,rule,palette)){console.log(`FAIL ${label}: ${reason}`);failures++;}
    } catch(error) {console.log(`FAIL ${label}: ${oneLine(error)}`);failures++;}
  }
  console.log(`${failures?'FAIL':'PASS'}: ${rows.length} assets, ${failures} failures`);
  if(failures)process.exitCode=1;
} catch(error) {console.error(`FAIL: ${oneLine(error)}`);process.exitCode=1;}
