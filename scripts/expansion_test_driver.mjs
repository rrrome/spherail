// Test-only navigation helper: adds ordinary erasable strokes; never changes ball state.
function pathFor(w,level,ball){
 const start=[Math.floor((ball.x+ball.size/2)/32),Math.floor((ball.y+ball.size/2-64)/32)];
 const holes=level.holes.filter(h=>!h.disabled&&(h.colorIndex===0||ball.colorIndex===0||h.colorIndex===ball.colorIndex));
 const bad=level.holes.filter(h=>!h.disabled&&!holes.includes(h));
 const seen=new Set([start.join(',')]), queue=[{x:start[0],y:start[1],path:[]}];
 for(let n=0;n<queue.length;n++){
   const q=queue[n],cx=q.x*32+16,cy=q.y*32+80;
   const goal=holes.find(h=>Math.hypot(cx-h.getCenter().x,cy-h.getCenter().y)<24);
   if(goal)return q.path.length?[...q.path,goal.getCenter()]:[goal.getCenter()];
   for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
    const current=level.getTile(q.x,q.y);
    if(current instanceof w.Inkball.AccelTile && ((current.dir==='D'&&dy<0)||(current.dir==='U'&&dy>0)||(current.dir==='R'&&dx<0)||(current.dir==='L'&&dx>0)))continue;
    const x=q.x+dx,y=q.y+dy,key=x+','+y;
    if(x<1||y<1||x>16||y>16||seen.has(key))continue;
    const tile=level.getTile(x,y);if(tile?.solidFor({colorIndex:ball.colorIndex,vx:dx,vy:dy}))continue;
    const point={x:x*32+16,y:y*32+80};
    if(bad.some(h=>Math.hypot(point.x-h.getCenter().x,point.y-h.getCenter().y)<43))continue;
    seen.add(key);queue.push({x,y,path:[...q.path,point]});
   }
 }
 return null;
}
export function guide(w,level,ball){
 if(ball.isCaptured||ball._inHolePull)return false;
 const cx=ball.x+ball.size/2,cy=ball.y+ball.size/2;
 const hazard=level.holes.find(h=>!h.disabled&&h.colorIndex!==0&&ball.colorIndex!==0&&h.colorIndex!==ball.colorIndex&&Math.hypot(cx-h.getCenter().x,cy-h.getCenter().y)<58);
 const path=pathFor(w,level,ball);
 let target=path?.[0];
 if(hazard) {const hc=hazard.getCenter();target={x:cx+(cx-hc.x),y:cy+(cy-hc.y)};}
 if(!target)return false;
 const dx=target.x-cx,dy=target.y-cy,d=Math.hypot(dx,dy);if(d<1)return false;
 const speed=Math.hypot(ball.vx,ball.vy),wx=dx/d*speed,wy=dy/d*speed;
 const nx=ball.vx-wx,ny=ball.vy-wy,mag=Math.hypot(nx,ny);
 if(mag<speed*.22)return false;
 const tx=-ny/mag,ty=nx/mag;
 const mx=cx+nx/mag*5,my=cy+ny/mag*5;
 const endpoints=[{x:mx+tx*5,y:my+ty*5},{x:mx-tx*5,y:my-ty*5}];
 if(endpoints.some(p=>p.x<32||p.x>544||p.y<96||p.y>608))return false;
 const line=new w.Inkball.Line();endpoints.forEach(p=>line.addPoint(p.x,p.y));level.lines.push(line);return true;
}
