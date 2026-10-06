// Deterministic playthroughs use the shipped physics, normal spawns and captures.
// No ball positions, velocities, scores or completion flags are modified.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { guide } from './expansion_test_driver.mjs';
const root = new URL('../', import.meta.url);
const world = { Math: Object.create(Math), console }; world.window = world;
vm.createContext(world);
for (const file of ['official-data.js','js/ball-collision.js','js/inkball/constants.js','js/inkball/tiles.js','js/inkball/line.js','js/inkball/hole.js','js/inkball/ball.js','js/inkball/level.js'])
  vm.runInContext(fs.readFileSync(new URL('Web/'+file,root),'utf8'),world);
const maps=world.INKBALL_OFFICIAL.maps.slice(5);
assert.equal(maps.length,5);
const fixtureURL=new URL('Tests/Fixtures/expansion-playthroughs.json',root);
const search=process.argv.includes('--discover');
const fixtures=search?{}:JSON.parse(fs.readFileSync(fixtureURL,'utf8'));
let seen=new Set();
for (const map of maps) for(const [tier,difficulty] of ['easy','hard','master'].entries()) {
  const config=map.difficulties[difficulty], key=map.id+'|'+difficulty;
  assert.equal(config.achievements.length,tier+1);
  const rows=config.layout_content.split('\n');assert.equal(rows.length,18);
  const occupied=new Set();
  rows.forEach((row,y)=>{
    assert.equal(row.length,36);
    for(let x=0;x<18;x++) {
      const token=row[x*2]; if(token===' ')continue;
      seen.add(token);
      for(const [dx,dy] of token==='H'?[[0,0],[1,0],[0,1],[1,1]]:[[0,0]]) {
        const cell=(y+dy)*18+x+dx; assert(!occupied.has(cell),`${key}: overlap at ${x+dx},${y+dy}`); occupied.add(cell);
      }
    }
  });
  let found=null,best=Infinity;
  const guided = search ? !['spectrum-gates','chromatic-locks'].includes(map.id) : fixtures[key].guided===1;
  const first=search?1:fixtures[key].seed, last=search?30:first;
  for(let seed=first;seed<=last;seed++) {
    let state=seed;
    world.Math.random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    const app={score:0,isLevelEnded:false,isGameEnded:false,holeImages:[],ballImages:[],config:world.INKBALL_OFFICIAL,
      dashboard:{onBallSpawned(){},onBallsYetToSpawnChanged(){}},correctCaptures:0,wrongCaptures:0};
    const level=new world.Inkball.Level(app,config,config.layout_content);
    let frame=0, lines=0;
    while(!app.isLevelEnded && frame<config.time*60+1) {
      if (guided && frame % 12 === 0) {
        // Erase previous strokes, then draw within the normal drawing bounds.
        level.lines = [];
        for (const ball of level.ballsInGame) if (guide(world,level,ball)) lines++;
      }
      level.update(1/60);frame++;
    }
    const duration=Math.ceil(frame/60);
    best=Math.min(best,level.ballsInGame.length+level.ballsYetToSpawn.length);
    const earned=config.achievements.every(a=> a.criterion==='clear' || a.criterion==='no_wrong_captures' && !app.wrongCaptures || a.criterion==='max_duration_seconds' && duration<=a.target || a.criterion==='max_lines_drawn' && lines<=a.target);
    if(!level.timeUp && app.isLevelEnded && earned) {found={seed,duration,score:app.score,correct:app.correctCaptures,wrong:app.wrongCaptures,lines,guided:guided?1:0};break;}
  }
  assert(found,`${key}: no complete all-achievement playthrough (minimum remaining ${best})`);
  if (!search) assert.deepEqual(found,fixtures[key],key+': replay changed');
  fixtures[key]=found;console.log(key,JSON.stringify(found));
}
// These layouts intentionally use the mechanics supplied in New_Level.md.
for(const token of 'X1234SHBKUDLRCYVGTdlr') assert(seen.has(token),'Missing source mechanic '+token);
if(search) fs.writeFileSync(fixtureURL,JSON.stringify(fixtures,null,2)+'\n');
console.log('15 source levels: valid footprints, real-physics clears and attainable achievements.');
