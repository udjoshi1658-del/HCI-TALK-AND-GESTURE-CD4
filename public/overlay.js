const CONNECTIONS = [
 [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
 [5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],
 [13,17],[17,18],[18,19],[19,20],[0,17]
];
export function drawHands(canvas,hands=[]) {
 const ctx=canvas.getContext('2d');
 const w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);
 for (const hand of hands) {
  const lm=hand.landmarks;
  if (!lm || lm.length!==21) continue;
  const color=hand.handedness==='left'?'#a78bfa':'#22c55e';
  ctx.lineWidth=3;ctx.strokeStyle=color;
  for(const [a,b] of CONNECTIONS){
   ctx.beginPath();ctx.moveTo(lm[a].x*w,lm[a].y*h);
   ctx.lineTo(lm[b].x*w,lm[b].y*h);ctx.stroke();
  }
  for(let i=0;i<lm.length;i++){
   ctx.beginPath();ctx.arc(lm[i].x*w,lm[i].y*h,i===4||i===8?6:3.5,0,Math.PI*2);
   ctx.fillStyle=i===4||i===8?'#f59e0b':color;ctx.fill();
  }
  ctx.save();
  // Canvas is mirrored by CSS with video; make printed hand labels mirror-correct.
  ctx.translate(w,0);ctx.scale(-1,1);
  ctx.fillStyle=color;ctx.font='bold 19px sans-serif';
  ctx.fillText(hand.handedness.toUpperCase(), (1-lm[9].x)*w+10, lm[9].y*h-20);
  ctx.restore();
 }
}
export const clearOverlay=canvas=>canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
