'use strict';
/* EDITR — editor.js v3: shapes, watermark, drag-drop, resize panels, blur fix */
const EMOJIS={reactions:['👍','👎','❤️','🔥','⭐','✅','❌','⚠️','💡','🎯','🚀','👀','💬','💯','🙌','👏','🤔','😮','🤯','💪','🎉','🏆','✨','💎','🔑','📌','📍'],symbols:['🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🔶','🔷','🔸','🔹','▶️','⏩','🔺','🔻','💠','🔘','🔲'],arrows:['➡️','⬅️','⬆️','⬇️','↗️','↙️','↖️','↘️','↕️','↔️','🔄','🔃','↩️','↪️','⤴️','⤵️','🔙','🔚','🔛','🔜','🔝','➰','➿','🔁','🔂'],objects:['💡','🔦','📸','🎥','🖥️','💻','📱','⌨️','📊','📈','📉','📋','📁','📝','✏️','🖊️','🔗','🔒','🔓','🔑','🗝️','🎵','🎶','🎸','🎹'],faces:['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😌','😍','🥰','😘','😋','😛','😜','🤪','😝','🤔','😐','😑','😶','😏','😒','🙄','😬','😮','😲','😳','🥺','😦','😢','😭','😱','😤','😡','😠']};
const $=id=>document.getElementById(id);
const mainCanvas=$('mainCanvas'),overlayCanvas=$('overlayCanvas');
const ctx=mainCanvas.getContext('2d'),octx=overlayCanvas.getContext('2d');
const S={tool:'select',color:'#FF3B57',strokeSize:3,opacity:1,fontSize:24,fontFamily:'DM Sans',bold:false,italic:false,textBg:false,outlineText:false,allCaps:false,textShadow:false,textAlign:'left',letterSpacing:0,arrowStyle:'normal',fillStyle:'none',strokeStyle:'solid',cornerRadius:0,blurIntensity:12,blurMode:'gaussian',selectedEmoji:'👍',emojiSize:4,counterNum:1,letterNum:0,isVideo:false,zoom:1,isDrawing:false,startX:0,startY:0,objects:[],selectedObj:null,dragging:false,dragOffX:0,dragOffY:0,lockedObjs:new Set(),history:[],historyIndex:-1,brightness:0,contrast:0,saturation:0,rotation:0,flipH:false,flipV:false,sourceImage:null,sourceFilter:'none',wmImage:null,wmOpacity:0.4,wmScale:0.25,wmPos:'br',fillColor:'#FF3B57',fillTransparent:false};
let currentPenObj=null,cropState={};

// INIT
$('uploadZone').addEventListener('click',()=>$('fileInput').click());
$('fileInput').addEventListener('change',e=>handleFile(e.target.files[0]));
$('addFileInput').addEventListener('change',e=>handleFile(e.target.files[0]));
$('addMediaBtn').addEventListener('click',()=>$('addFileInput').click());
$('uploadZone').addEventListener('dragover',e=>{e.preventDefault();$('uploadZone').classList.add('drag-over');});
$('uploadZone').addEventListener('dragleave',()=>$('uploadZone').classList.remove('drag-over'));
$('uploadZone').addEventListener('drop',e=>{e.preventDefault();$('uploadZone').classList.remove('drag-over');if(e.dataTransfer.files[0])handleFile(e.dataTransfer.files[0]);});
document.addEventListener('paste',e=>{for(const item of e.clipboardData?.items||[])if(item.type.startsWith('image/')){handleFile(item.getAsFile());break;}});

// DRAG & DROP onto canvas area
const canvasArea=$('canvasArea');
canvasArea.addEventListener('dragover',e=>{e.preventDefault();$('dropOverlay').classList.remove('hidden');});
canvasArea.addEventListener('dragleave',e=>{if(!canvasArea.contains(e.relatedTarget))$('dropOverlay').classList.add('hidden');});
canvasArea.addEventListener('drop',e=>{
  e.preventDefault();$('dropOverlay').classList.add('hidden');
  const f=e.dataTransfer.files[0];
  if(!f)return;
  if(f.type.startsWith('image/')){
    if(S.sourceImage){addImageLayer(f);}else{handleFile(f);}
  }
});

function addImageLayer(file){
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{
    const x=(mainCanvas.width-img.width)/2,y=(mainCanvas.height-img.height)/2;
    pushObj({type:'imageLayer',img,x,y,w:img.width,h:img.height,opacity:S.opacity});
    showToast('Image added as layer');
  };
  img.src=url;
}

// IMPORT LAYER
$('importLayerBtn').addEventListener('click',()=>$('importLayerInput').click());
$('importLayerInput').addEventListener('change',e=>{const f=e.target.files[0];if(f)addImageLayer(f);e.target.value='';});

// FILE HANDLING
function handleFile(file){
  if(!file)return;
  $('fileName').textContent=file.name.length>22?file.name.slice(0,19)+'…':file.name;
  S.isVideo=file.type.startsWith('video/');
  S.objects=[];S.history=[];S.historyIndex=-1;
  S.rotation=0;S.flipH=false;S.flipV=false;
  S.brightness=S.contrast=S.saturation=0;
  S.sourceFilter='none';
  S.counterNum=1;S.letterNum=0;
  ['brightness','contrast','saturation'].forEach(p=>$(p).value=0);
  document.querySelectorAll('.filt2-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector('.filt2-btn[data-filter="none"]').classList.add('active');
  if(S.isVideo){loadVideo(file);}else{loadImage(file);}
  $('landing').classList.remove('active');
  $('editor').style.display='flex';
  updateCounterDisplay();
}
function loadImage(file){
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{S.sourceImage=img;resizeCanvases(img.width,img.height);fitZoom();renderAll();saveHistory();};
  img.src=url;
}
function loadVideo(file){
  const vel=$('videoEl')||document.createElement('video');
  vel.id='videoEl';vel.preload='auto';vel.crossOrigin='anonymous';vel.style.display='none';
  if(!document.getElementById('videoEl'))document.body.appendChild(vel);
  vel.src=URL.createObjectURL(file);
  vel.addEventListener('loadedmetadata',()=>{S.sourceImage=null;resizeCanvases(vel.videoWidth,vel.videoHeight);fitZoom();vel.currentTime=0;},{once:true});
  vel.addEventListener('seeked',()=>{ctx.clearRect(0,0,mainCanvas.width,mainCanvas.height);ctx.drawImage(vel,0,0,mainCanvas.width,mainCanvas.height);S.objects.forEach(o=>drawObject(ctx,o,false));});
}
function resizeCanvases(w,h){[mainCanvas,overlayCanvas].forEach(c=>{c.width=w;c.height=h;});applyZoom();}
function applyZoom(){
  const w=mainCanvas.width,h=mainCanvas.height;
  const dw=Math.round(w*S.zoom),dh=Math.round(h*S.zoom);
  [mainCanvas,overlayCanvas].forEach(c=>{c.style.width=dw+'px';c.style.height=dh+'px';});
  $('canvasContainer').style.width=dw+'px';$('canvasContainer').style.height=dh+'px';
  $('zoomVal').textContent=Math.round(S.zoom*100)+'%';
}
function fitZoom(){
  const area=$('canvasArea');
  const mw=area.clientWidth-80,mh=area.clientHeight-100;
  S.zoom=Math.min(1,mw/mainCanvas.width,mh/mainCanvas.height);
  applyZoom();
}

// RENDER
function renderAll(){
  const w=mainCanvas.width,h=mainCanvas.height;
  ctx.save();ctx.clearRect(0,0,w,h);
  ctx.translate(w/2,h/2);ctx.rotate(S.rotation*Math.PI/180);
  ctx.scale(S.flipH?-1:1,S.flipV?-1:1);ctx.translate(-w/2,-h/2);
  if(S.sourceImage){ctx.filter=buildFilter();ctx.drawImage(S.sourceImage,0,0,w,h);ctx.filter='none';}
  ctx.restore();
  S.objects.forEach(o=>drawObject(ctx,o,false));
}
function buildFilter(){
  let f=S.sourceFilter!=='none'?S.sourceFilter:'none';
  const b=100+S.brightness,c=((S.contrast+100)/100).toFixed(2),sat=((S.saturation+100)/100).toFixed(2);
  const adj=`brightness(${b}%) contrast(${c}) saturate(${sat})`;
  return f!=='none'?`${f} ${adj}`:adj;
}

// DRAW OBJECT
function drawObject(c,obj,preview){
  c.save();c.globalAlpha=obj.opacity??1;
  switch(obj.type){
    case 'pen':drawPath(c,obj);break;
    case 'highlighter':drawHighlight(c,obj);break;
    case 'rect':drawRect(c,obj);break;
    case 'circle':drawCircle(c,obj);break;
    case 'triangle':drawTriangle(c,obj);break;
    case 'star':drawStar(c,obj);break;
    case 'hexagon':drawHexagon(c,obj);break;
    case 'line':drawLine(c,obj);break;
    case 'arrow':drawArrow(c,obj);break;
    case 'text':drawText(c,obj);break;
    case 'blur':applyBlur(c,obj);break;
    case 'callout':drawCallout(c,obj);break;
    case 'emoji':drawEmoji(c,obj);break;
    case 'counter':drawBadge(c,obj,String(obj.num));break;
    case 'letter':drawBadge(c,obj,obj.letter);break;
    case 'imageLayer':drawImageLayer(c,obj);break;
  }
  if(!preview&&obj===S.selectedObj){
    const b=getBounds(obj);
    if(b){c.globalAlpha=1;c.strokeStyle='#00C7FF';c.lineWidth=1.5/S.zoom;c.setLineDash([5/S.zoom,4/S.zoom]);c.strokeRect(b.x-7,b.y-7,b.w+14,b.h+14);c.setLineDash([]);
    [[b.x-7,b.y-7],[b.x+b.w+7,b.y-7],[b.x-7,b.y+b.h+7],[b.x+b.w+7,b.y+b.h+7]].forEach(([hx,hy])=>{c.fillStyle='#fff';c.strokeStyle='#00C7FF';c.lineWidth=1.5/S.zoom;c.beginPath();c.arc(hx,hy,4/S.zoom,0,Math.PI*2);c.fill();c.stroke();});}
  }
  c.restore();
}
function applyStrokeDash(c,obj){c.setLineDash(obj.strokeStyle==='dashed'?[8,6]:obj.strokeStyle==='dotted'?[2,4]:[]);}
function applyShapeFill(c,obj){
  if(obj.fillTransparent)return;
  if(obj.fillStyle==='solid'){c.fillStyle=obj.fillColor||obj.color;c.fill();}
  else if(obj.fillStyle==='semi'){c.save();c.globalAlpha*=0.35;c.fillStyle=obj.fillColor||obj.color;c.fill();c.restore();}
}
function drawPath(c,obj){if(!obj.points?.length)return;c.beginPath();c.moveTo(obj.points[0].x,obj.points[0].y);obj.points.forEach(p=>c.lineTo(p.x,p.y));c.strokeStyle=obj.color;c.lineWidth=obj.size;c.lineCap='round';c.lineJoin='round';c.stroke();}
function drawHighlight(c,obj){if(!obj.points?.length)return;c.save();c.globalAlpha=(obj.opacity??1)*0.35;c.beginPath();c.moveTo(obj.points[0].x,obj.points[0].y);obj.points.forEach(p=>c.lineTo(p.x,p.y));c.strokeStyle=obj.color;c.lineWidth=obj.size*6;c.lineCap='square';c.lineJoin='round';c.stroke();c.restore();}
function drawRect(c,obj){
  const x=Math.min(obj.x,obj.x+obj.w),y=Math.min(obj.y,obj.y+obj.h),w=Math.abs(obj.w),h=Math.abs(obj.h),r=obj.cornerRadius||0;
  c.beginPath();
  if(r>0){c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();}
  else{c.rect(x,y,w,h);}
  applyShapeFill(c,obj);applyStrokeDash(c,obj);c.strokeStyle=obj.color;c.lineWidth=obj.size;c.lineCap='round';c.lineJoin='round';c.stroke();c.setLineDash([]);
}
function drawCircle(c,obj){
  c.beginPath();c.ellipse(obj.x+obj.w/2,obj.y+obj.h/2,Math.abs(obj.w/2)||1,Math.abs(obj.h/2)||1,0,0,Math.PI*2);
  applyShapeFill(c,obj);applyStrokeDash(c,obj);c.strokeStyle=obj.color;c.lineWidth=obj.size;c.stroke();c.setLineDash([]);
}
function drawTriangle(c,obj){
  const x=Math.min(obj.x,obj.x+obj.w),y=Math.min(obj.y,obj.y+obj.h),w=Math.abs(obj.w),h=Math.abs(obj.h);
  c.beginPath();c.moveTo(x+w/2,y);c.lineTo(x+w,y+h);c.lineTo(x,y+h);c.closePath();
  applyShapeFill(c,obj);applyStrokeDash(c,obj);c.strokeStyle=obj.color;c.lineWidth=obj.size;c.stroke();c.setLineDash([]);
}
function drawStar(c,obj){
  const cx=obj.x+obj.w/2,cy=obj.y+obj.h/2,r=Math.min(Math.abs(obj.w),Math.abs(obj.h))/2,ir=r*0.4;
  c.beginPath();for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2,ia=a+Math.PI/5;c.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));c.lineTo(cx+ir*Math.cos(ia),cy+ir*Math.sin(ia));}c.closePath();
  applyShapeFill(c,obj);c.strokeStyle=obj.color;c.lineWidth=obj.size;c.stroke();
}
function drawHexagon(c,obj){
  const cx=obj.x+obj.w/2,cy=obj.y+obj.h/2,r=Math.min(Math.abs(obj.w),Math.abs(obj.h))/2;
  c.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/6;c.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));}c.closePath();
  applyShapeFill(c,obj);c.strokeStyle=obj.color;c.lineWidth=obj.size;c.stroke();
}
function drawLine(c,obj){c.beginPath();c.moveTo(obj.x1,obj.y1);c.lineTo(obj.x2,obj.y2);applyStrokeDash(c,obj);c.strokeStyle=obj.color;c.lineWidth=obj.size;c.lineCap='round';c.stroke();c.setLineDash([]);}
function drawArrow(c,obj){
  const dx=obj.x2-obj.x1,dy=obj.y2-obj.y1,angle=Math.atan2(dy,dx),headLen=Math.max(14,obj.size*4);
  c.strokeStyle=obj.color;c.fillStyle=obj.color;c.lineWidth=obj.size;c.lineCap='round';
  c.setLineDash(obj.arrowStyle==='dashed'?[10,6]:[]);
  if(obj.arrowStyle==='curved'){
    const mx=(obj.x1+obj.x2)/2-dy*0.3,my=(obj.y1+obj.y2)/2+dx*0.3;
    c.beginPath();c.moveTo(obj.x1,obj.y1);c.quadraticCurveTo(mx,my,obj.x2,obj.y2);c.stroke();
    const ta=Math.atan2(obj.y2-my,obj.x2-mx);
    c.setLineDash([]);drawArrowHead(c,obj.x2,obj.y2,ta,headLen,obj.arrowStyle);
  }else{c.beginPath();c.moveTo(obj.x1,obj.y1);c.lineTo(obj.x2,obj.y2);c.stroke();c.setLineDash([]);
    drawArrowHead(c,obj.x2,obj.y2,angle,headLen,obj.arrowStyle);
    if(obj.arrowStyle==='double')drawArrowHead(c,obj.x1,obj.y1,angle+Math.PI,headLen,'normal');}
  c.setLineDash([]);
}
function drawArrowHead(c,x,y,angle,len,style){
  if(style==='outline'){c.beginPath();c.moveTo(x,y);c.lineTo(x-len*Math.cos(angle-Math.PI/6),y-len*Math.sin(angle-Math.PI/6));c.lineTo(x-len*Math.cos(angle+Math.PI/6),y-len*Math.sin(angle+Math.PI/6));c.closePath();c.stroke();}
  else{c.beginPath();c.moveTo(x,y);c.lineTo(x-len*Math.cos(angle-Math.PI/7),y-len*Math.sin(angle-Math.PI/7));c.lineTo(x-len*Math.cos(angle+Math.PI/7),y-len*Math.sin(angle+Math.PI/7));c.closePath();c.fill();}
}
function drawText(c,obj){
  let text=obj.text||'';if(obj.allCaps)text=text.toUpperCase();
  const weight=obj.bold?'bold':'normal',style=obj.italic?'italic':'normal';
  c.font=`${style} ${weight} ${obj.fontSize}px ${obj.fontFamily||'DM Sans'},sans-serif`;
  c.letterSpacing=(obj.letterSpacing||0)+'px';
  c.textAlign=obj.textAlign||'left';
  const lines=text.split('\n'),lh=obj.fontSize*1.35;
  lines.forEach((line,i)=>{
    const ly=obj.y+i*lh;
    if(obj.textBg){const m=c.measureText(line),pad=5,bx=obj.textAlign==='center'?obj.x-m.width/2-pad:obj.textAlign==='right'?obj.x-m.width-pad:obj.x-pad;c.fillStyle='rgba(0,0,0,0.6)';c.fillRect(bx,ly-obj.fontSize-2,m.width+pad*2,obj.fontSize+8);}
    if(obj.outlineText){c.strokeStyle='#000';c.lineWidth=obj.fontSize/8;c.lineJoin='round';c.strokeText(line,obj.x,ly);}
    if(obj.textShadow){c.save();c.shadowColor='rgba(0,0,0,0.7)';c.shadowBlur=6;c.shadowOffsetX=2;c.shadowOffsetY=2;}
    c.fillStyle=obj.color;c.fillText(line,obj.x,ly);
    if(obj.textShadow)c.restore();
  });
  c.textAlign='left';c.letterSpacing='0px';
}
function applyBlur(c,obj){
  if(!obj.w||!obj.h)return;
  const x=Math.min(obj.x,obj.x+obj.w),y=Math.min(obj.y,obj.y+obj.h),w=Math.abs(obj.w),h=Math.abs(obj.h);
  if(w<2||h<2)return;
  if(obj.blurMode==='pixelate'){
    const px=Math.max(3,obj.blurIntensity);
    const off=document.createElement('canvas');off.width=Math.max(1,Math.round(w/px));off.height=Math.max(1,Math.round(h/px));
    const oc=off.getContext('2d');oc.imageSmoothingEnabled=false;
    oc.drawImage(mainCanvas,x,y,w,h,0,0,off.width,off.height);
    c.imageSmoothingEnabled=false;c.drawImage(off,0,0,off.width,off.height,x,y,w,h);c.imageSmoothingEnabled=true;
  }else{
    const off=document.createElement('canvas');off.width=w+obj.blurIntensity*4;off.height=h+obj.blurIntensity*4;
    const oc=off.getContext('2d');oc.filter=`blur(${obj.blurIntensity}px)`;
    oc.drawImage(mainCanvas,x,y,w,h,-obj.blurIntensity*2,-obj.blurIntensity*2,w+obj.blurIntensity*4,h+obj.blurIntensity*4);
    c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.drawImage(off,x-obj.blurIntensity*2,y-obj.blurIntensity*2);c.restore();
  }
  c.save();c.strokeStyle='rgba(0,199,255,0.5)';c.lineWidth=1.5;c.setLineDash([5,4]);c.strokeRect(x,y,w,h);c.setLineDash([]);c.restore();
}
function drawCallout(c,obj){
  const x=obj.x,y=obj.y,w=Math.abs(obj.w)||160,h=Math.abs(obj.h)||70,r=10;
  c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+36,y+h);c.lineTo(x+18,y+h+22);c.lineTo(x+28,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
  c.fillStyle=obj.color;c.save();c.globalAlpha=(obj.opacity??1)*0.88;c.fill();c.restore();
  if(obj.text){c.fillStyle='#fff';c.font='600 14px DM Sans,sans-serif';c.textAlign='center';c.fillText(obj.text,x+w/2,y+h/2+5);c.textAlign='left';}
}
function drawEmoji(c,obj){c.font=`${(obj.emojiSize||4)*8}px serif`;c.textBaseline='middle';c.fillText(obj.emoji,obj.x,obj.y);c.textBaseline='alphabetic';}
function drawBadge(c,obj,label){
  const r=Math.max(10,(obj.size||3)*4);
  c.beginPath();c.arc(obj.x,obj.y,r,0,Math.PI*2);c.fillStyle=obj.color;c.fill();
  c.fillStyle='#fff';c.font=`bold ${Math.max(10,r*1.0)}px JetBrains Mono,monospace`;
  c.textAlign='center';c.textBaseline='middle';c.fillText(label,obj.x,obj.y);
  c.textAlign='left';c.textBaseline='alphabetic';
}
function drawImageLayer(c,obj){if(obj.img)c.drawImage(obj.img,obj.x,obj.y,obj.w,obj.h);}

// BOUNDS
function getBounds(obj){
  switch(obj.type){
    case 'rect':case 'circle':case 'triangle':case 'star':case 'hexagon':case 'blur':case 'callout':
      return{x:Math.min(obj.x,obj.x+obj.w),y:Math.min(obj.y,obj.y+obj.h),w:Math.abs(obj.w)||20,h:Math.abs(obj.h)||20};
    case 'line':case 'arrow':return{x:Math.min(obj.x1,obj.x2),y:Math.min(obj.y1,obj.y2),w:Math.abs(obj.x2-obj.x1)||20,h:Math.abs(obj.y2-obj.y1)||20};
    case 'text':{ctx.font=`${obj.fontSize}px ${obj.fontFamily||'DM Sans'}`;const lines=(obj.text||'').split('\n');const mw=Math.max(...lines.map(l=>ctx.measureText(l).width))||60;return{x:obj.x,y:obj.y-obj.fontSize,w:mw,h:obj.fontSize*1.4*lines.length};}
    case 'emoji':{const s=(obj.emojiSize||4)*8;return{x:obj.x,y:obj.y-s,w:s,h:s};}
    case 'counter':case 'letter':{const r=(obj.size||3)*4;return{x:obj.x-r,y:obj.y-r,w:r*2,h:r*2};}
    case 'imageLayer':return{x:obj.x,y:obj.y,w:obj.w,h:obj.h};
    case 'pen':case 'highlighter':if(!obj.points?.length)return null;const xs=obj.points.map(p=>p.x),ys=obj.points.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs)||20,h:Math.max(...ys)-Math.min(...ys)||20};
    default:return null;
  }
}
function hitTest(obj,px,py){const b=getBounds(obj);if(!b)return false;return px>=b.x-10&&px<=b.x+b.w+10&&py>=b.y-10&&py<=b.y+b.h+10;}
function getPos(e){
  const rect=overlayCanvas.getBoundingClientRect();
  const cx=e.touches?e.touches[0].clientX:e.clientX,cy=e.touches?e.touches[0].clientY:e.clientY;
  return{x:(cx-rect.left)*(mainCanvas.width/rect.width),y:(cy-rect.top)*(mainCanvas.height/rect.height)};
}

// POINTER EVENTS
overlayCanvas.addEventListener('mousedown',onDown);overlayCanvas.addEventListener('mousemove',onMove);overlayCanvas.addEventListener('mouseup',onUp);overlayCanvas.addEventListener('mouseleave',onUp);
overlayCanvas.addEventListener('touchstart',e=>{e.preventDefault();onDown(e);},{passive:false});overlayCanvas.addEventListener('touchmove',e=>{e.preventDefault();onMove(e);},{passive:false});overlayCanvas.addEventListener('touchend',e=>{e.preventDefault();onUp(e);},{passive:false});
overlayCanvas.addEventListener('wheel',e=>{e.preventDefault();S.zoom=Math.min(4,Math.max(0.1,S.zoom+(e.deltaY<0?0.1:-0.1)));applyZoom();},{passive:false});

function onDown(e){
  const{x,y}=getPos(e);S.startX=x;S.startY=y;S.isDrawing=true;
  octx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);
  const tool=S.tool;
  if(tool==='select'){
    let hit=null;for(let i=S.objects.length-1;i>=0;i--)if(!S.lockedObjs.has(S.objects[i])&&hitTest(S.objects[i],x,y)){hit=S.objects[i];break;}
    S.selectedObj=hit;
    if(hit){const b=getBounds(hit);S.dragging=true;S.dragOffX=b?x-b.x:0;S.dragOffY=b?y-b.y:0;}
    updateFloatBar();renderAll();return;
  }
  if(tool==='eraser'){eraseAt(x,y);return;}
  if(tool==='text'){const text=prompt('Enter text:');if(!text){S.isDrawing=false;return;}pushObj({type:'text',x,y,text,color:S.color,fontSize:S.fontSize,fontFamily:S.fontFamily,bold:S.bold,italic:S.italic,textBg:S.textBg,outlineText:S.outlineText,allCaps:S.allCaps,textShadow:S.textShadow,textAlign:S.textAlign,letterSpacing:S.letterSpacing,opacity:S.opacity});return;}
  if(tool==='emoji'){pushObj({type:'emoji',x,y,emoji:S.selectedEmoji,emojiSize:S.emojiSize,opacity:S.opacity});S.isDrawing=false;return;}
  if(tool==='counter'){pushObj({type:'counter',x,y,num:S.counterNum,color:S.color,size:Math.max(3,S.strokeSize),opacity:S.opacity});S.counterNum++;updateCounterDisplay();S.isDrawing=false;return;}
  if(tool==='letter'){pushObj({type:'letter',x,y,letter:getLetter(S.letterNum),color:S.color,size:Math.max(3,S.strokeSize),opacity:S.opacity});S.letterNum++;updateCounterDisplay();S.isDrawing=false;return;}
  if(tool==='callout'){const text=prompt('Callout text:');pushObj({type:'callout',x,y,w:180,h:72,text:text||'',color:S.color,opacity:S.opacity});S.isDrawing=false;return;}
  if(tool==='crop'){openCropModal();S.isDrawing=false;return;}
  if(tool==='watermark'){if(S.wmImage){placeWatermarkAt(x,y);}else{showToast('Upload a watermark image first');}S.isDrawing=false;return;}
  if(tool==='pen'||tool==='highlighter'){currentPenObj={type:tool,points:[{x,y}],color:S.color,size:S.strokeSize,opacity:S.opacity};return;}
}
function onMove(e){
  const{x,y}=getPos(e);
  if(S.tool==='select'&&S.dragging&&S.selectedObj){moveObj(S.selectedObj,x,y);renderAll();return;}
  if(!S.isDrawing)return;
  octx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);
  if(S.tool==='eraser'){eraseAt(x,y);return;}
  if(S.tool==='pen'||S.tool==='highlighter'){currentPenObj?.points.push({x,y});if(currentPenObj)drawObject(octx,currentPenObj,true);return;}
  const prev=buildShapeObj(S.tool,S.startX,S.startY,x,y);if(prev)drawObject(octx,prev,true);
}
function onUp(e){
  const endPos=e.type==='mouseleave'?{x:S.startX,y:S.startY}:getPos(e);
  const{x,y}=endPos;
  if(S.tool==='select'){if(S.dragging){S.dragging=false;saveHistory();}renderAll();return;}
  if(!S.isDrawing){return;}S.isDrawing=false;
  let obj=null;
  if(S.tool==='pen'||S.tool==='highlighter'){obj=currentPenObj;currentPenObj=null;}
  else{obj=buildShapeObj(S.tool,S.startX,S.startY,x,y);}
  if(obj)pushObj(obj);
  octx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);
}
function buildShapeObj(tool,sx,sy,ex,ey){
  const base={color:S.color,size:S.strokeSize,opacity:S.opacity,fillStyle:S.fillStyle,fillColor:S.fillColor,fillTransparent:S.fillTransparent,strokeStyle:S.strokeStyle};
  switch(tool){
    case 'rect':return{...base,type:'rect',x:sx,y:sy,w:ex-sx,h:ey-sy,cornerRadius:S.cornerRadius};
    case 'circle':return{...base,type:'circle',x:sx,y:sy,w:ex-sx,h:ey-sy};
    case 'triangle':return{...base,type:'triangle',x:sx,y:sy,w:ex-sx,h:ey-sy};
    case 'star':return{...base,type:'star',x:sx,y:sy,w:ex-sx,h:ey-sy};
    case 'hexagon':return{...base,type:'hexagon',x:sx,y:sy,w:ex-sx,h:ey-sy};
    case 'line':return{...base,type:'line',x1:sx,y1:sy,x2:ex,y2:ey};
    case 'arrow':return{...base,type:'arrow',x1:sx,y1:sy,x2:ex,y2:ey,arrowStyle:S.arrowStyle};
    case 'blur':return{...base,type:'blur',x:sx,y:sy,w:ex-sx,h:ey-sy,blurIntensity:S.blurIntensity,blurMode:S.blurMode};
    default:return null;
  }
}
function moveObj(obj,x,y){
  const b=getBounds(obj);if(!b)return;
  const dx=(x-b.x-S.dragOffX),dy=(y-b.y-S.dragOffY);
  if('x'in obj&&'y'in obj){obj.x+=dx;obj.y+=dy;}
  if('x1'in obj){obj.x1+=dx;obj.x2+=dx;obj.y1+=dy;obj.y2+=dy;}
  if(obj.points)obj.points=obj.points.map(p=>({x:p.x+dx,y:p.y+dy}));
  S.dragOffX=x-b.x-dx;S.dragOffY=y-b.y-dy;
}
function eraseAt(x,y){const prev=S.objects.length;S.objects=S.objects.filter(o=>!hitTest(o,x,y));if(S.objects.length!==prev){renderAll();saveHistory();}}
function pushObj(obj){S.objects.push(obj);S.selectedObj=null;updateFloatBar();renderAll();saveHistory();}
function updateFloatBar(){$('floatBar').classList.toggle('hidden',!S.selectedObj);}

// FLOAT BAR
$('deleteSelBtn').onclick=()=>{if(!S.selectedObj)return;S.objects=S.objects.filter(o=>o!==S.selectedObj);S.lockedObjs.delete(S.selectedObj);S.selectedObj=null;updateFloatBar();renderAll();saveHistory();};
$('dupSelBtn').onclick=()=>{if(!S.selectedObj)return;const copy=JSON.parse(JSON.stringify(S.selectedObj));if(copy.img)copy.img=S.selectedObj.img;if('x'in copy){copy.x+=22;copy.y+=22;}if('x1'in copy){copy.x1+=22;copy.x2+=22;copy.y1+=22;copy.y2+=22;}if(copy.points)copy.points=copy.points.map(p=>({x:p.x+22,y:p.y+22}));pushObj(copy);};
$('fwdSelBtn').onclick=()=>{const i=S.objects.indexOf(S.selectedObj);if(i<S.objects.length-1){S.objects.splice(i,1);S.objects.push(S.selectedObj);renderAll();saveHistory();}};
$('bckSelBtn').onclick=()=>{const i=S.objects.indexOf(S.selectedObj);if(i>0){S.objects.splice(i,1);S.objects.unshift(S.selectedObj);renderAll();saveHistory();}};
$('lockSelBtn').onclick=()=>{if(!S.selectedObj)return;if(S.lockedObjs.has(S.selectedObj)){S.lockedObjs.delete(S.selectedObj);$('lockSelBtn').textContent='🔓 Lock';}else{S.lockedObjs.add(S.selectedObj);$('lockSelBtn').textContent='🔒 Unlock';}renderAll();};
$('clearAllBtn').onclick=()=>{if(!S.objects.length)return;if(confirm('Clear all annotations?')){S.objects=[];S.selectedObj=null;S.lockedObjs.clear();updateFloatBar();renderAll();saveHistory();}};

// HISTORY
function saveHistory(){const snap=JSON.stringify({objects:S.objects.map(o=>o.type==='imageLayer'?{...o,img:null,_imgSrc:o.img?.src}:o),rotation:S.rotation,flipH:S.flipH,flipV:S.flipV,brightness:S.brightness,contrast:S.contrast,saturation:S.saturation,sourceFilter:S.sourceFilter});S.history=S.history.slice(0,S.historyIndex+1);S.history.push(snap);if(S.history.length>80)S.history.shift();else S.historyIndex++;}
function restoreHistory(){
  const snap=JSON.parse(S.history[S.historyIndex]);
  const objs=snap.objects.map(o=>{if(o.type==='imageLayer'&&o._imgSrc){const img=new Image();img.src=o._imgSrc;return{...o,img};}return o;});
  Object.assign(S,{...snap,objects:objs});
  ['brightness','contrast','saturation'].forEach(p=>$(p).value=S[p]);
  renderAll();
}
$('undoBtn').onclick=()=>{if(S.historyIndex>0){S.historyIndex--;restoreHistory();}};
$('redoBtn').onclick=()=>{if(S.historyIndex<S.history.length-1){S.historyIndex++;restoreHistory();}};

// TOOL BUTTONS
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');S.tool=btn.dataset.tool;S.selectedObj=null;updateFloatBar();renderAll();updateSidePanel();
  });
});
function updateSidePanel(){
  const t=S.tool;
  $('textSec').classList.toggle('hidden',t!=='text');
  $('arrowSec').classList.toggle('hidden',t!=='arrow');
  $('shapeSec').classList.toggle('hidden',!['rect','circle','triangle','star','hexagon'].includes(t));
  $('blurSec').classList.toggle('hidden',t!=='blur');
  $('emojiSec').classList.toggle('hidden',t!=='emoji');
  $('counterSec').classList.toggle('hidden',!['counter','letter'].includes(t));
  $('watermarkSec').classList.toggle('hidden',t!=='watermark');
}

// COLORS
document.querySelectorAll('.csw').forEach(sw=>{sw.addEventListener('click',()=>{document.querySelectorAll('.csw').forEach(s=>s.classList.remove('active'));sw.classList.add('active');S.color=sw.dataset.color;$('customColor').value=S.color.length===7?S.color:'#FF3B57';});});
$('customColor').addEventListener('input',e=>{S.color=e.target.value;document.querySelectorAll('.csw').forEach(s=>s.classList.remove('active'));});

// SLIDERS
$('strokeSize').addEventListener('input',e=>{S.strokeSize=+e.target.value;$('strokeSizeVal').textContent=S.strokeSize;});
$('opacitySlider').addEventListener('input',e=>{S.opacity=+e.target.value/100;$('opacityVal').textContent=e.target.value+'%';});
$('fontSize').addEventListener('input',e=>{S.fontSize=+e.target.value;$('fontSizeVal').textContent=S.fontSize+'px';});
$('fontFamily').addEventListener('change',e=>{S.fontFamily=e.target.value;});
$('blurIntensity').addEventListener('input',e=>{S.blurIntensity=+e.target.value;$('blurVal').textContent=S.blurIntensity;});
$('cornerRadius').addEventListener('input',e=>{S.cornerRadius=+e.target.value;$('cornerVal').textContent=S.cornerRadius;});
$('emojiSize').addEventListener('input',e=>{S.emojiSize=+e.target.value;$('emojiSizeVal').textContent=S.emojiSize;});
$('letterSpacing').addEventListener('input',e=>{S.letterSpacing=+e.target.value;$('letterSpacingVal').textContent=S.letterSpacing;});

// TEXT TOGGLES
$('boldBtn').onclick=()=>{S.bold=!S.bold;$('boldBtn').classList.toggle('active',S.bold);};
$('italicBtn').onclick=()=>{S.italic=!S.italic;$('italicBtn').classList.toggle('active',S.italic);};
$('bgTextBtn').onclick=()=>{S.textBg=!S.textBg;$('bgTextBtn').classList.toggle('active',S.textBg);};
$('outlineTextBtn').onclick=()=>{S.outlineText=!S.outlineText;$('outlineTextBtn').classList.toggle('active',S.outlineText);};
$('allCapsBtn').onclick=()=>{S.allCaps=!S.allCaps;$('allCapsBtn').classList.toggle('active',S.allCaps);};
$('textShadowBtn').addEventListener('change',e=>{S.textShadow=e.target.checked;});
['alignLeft','alignCenter','alignRight'].forEach((id,i)=>{$(id).addEventListener('click',()=>{S.textAlign=['left','center','right'][i];['alignLeft','alignCenter','alignRight'].forEach(b=>$(b).classList.remove('active'));$(id).classList.add('active');});});

// ARROW
document.querySelectorAll('.arr-btn').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.arr-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');S.arrowStyle=btn.dataset.arrow;});});

// SHAPE FILL/STROKE
['fillNone','fillSolid','fillSemi'].forEach((id,i)=>{$(id).addEventListener('click',()=>{S.fillStyle=['none','solid','semi'][i];['fillNone','fillSolid','fillSemi'].forEach(b=>$(b).classList.remove('active'));$(id).classList.add('active');});});
['strokeSolid','strokeDashed','strokeDotted'].forEach((id,i)=>{$(id).addEventListener('click',()=>{S.strokeStyle=['solid','dashed','dotted'][i];['strokeSolid','strokeDashed','strokeDotted'].forEach(b=>$(b).classList.remove('active'));$(id).classList.add('active');});});
$('fillColor').addEventListener('input',e=>{S.fillColor=e.target.value;S.fillTransparent=false;});
$('fillTransparentBtn').onclick=()=>{S.fillTransparent=!S.fillTransparent;$('fillTransparentBtn').classList.toggle('active',S.fillTransparent);};

// BLUR MODE
$('blurGaussian').onclick=()=>{S.blurMode='gaussian';$('blurGaussian').classList.add('active');$('blurPixelate').classList.remove('active');};
$('blurPixelate').onclick=()=>{S.blurMode='pixelate';$('blurPixelate').classList.add('active');$('blurGaussian').classList.remove('active');};

// EMOJI
let currentEmojiCat='reactions';
function renderEmojis(cat){currentEmojiCat=cat;const grid=$('emojiGrid');grid.innerHTML='';(EMOJIS[cat]||EMOJIS.reactions).forEach(em=>{const btn=document.createElement('button');btn.className='em-btn'+(em===S.selectedEmoji?' sel':'');btn.textContent=em;btn.addEventListener('click',()=>{document.querySelectorAll('.em-btn').forEach(b=>b.classList.remove('sel'));btn.classList.add('sel');S.selectedEmoji=em;});grid.appendChild(btn);});}
document.querySelectorAll('.etab').forEach(tab=>{tab.addEventListener('click',()=>{document.querySelectorAll('.etab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');renderEmojis(tab.dataset.cat);});});
renderEmojis('reactions');

// COUNTER/LETTER
function getLetter(n){return String.fromCharCode(65+(n%26));}
function updateCounterDisplay(){if(S.tool==='counter')$('counterDisplay').textContent=S.counterNum;else if(S.tool==='letter')$('counterDisplay').textContent=getLetter(S.letterNum);}
$('resetCounterBtn').onclick=()=>{S.counterNum=1;S.letterNum=0;updateCounterDisplay();showToast('Labels reset');};

// ADJUSTMENTS
['brightness','contrast','saturation'].forEach(prop=>{$(prop).addEventListener('input',e=>{S[prop]=+e.target.value;renderAll();});});
$('resetAdjBtn').onclick=()=>{S.brightness=S.contrast=S.saturation=0;['brightness','contrast','saturation'].forEach(p=>$(p).value=0);renderAll();saveHistory();};

// FILTERS
document.querySelectorAll('.filt2-btn').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.filt2-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');S.sourceFilter=btn.dataset.filter;renderAll();saveHistory();});});

// TRANSFORM
$('rotateLeftBtn').onclick=()=>{S.rotation=(S.rotation-90+360)%360;renderAll();saveHistory();};
$('rotateRightBtn').onclick=()=>{S.rotation=(S.rotation+90)%360;renderAll();saveHistory();};
$('flipHBtn').onclick=()=>{S.flipH=!S.flipH;renderAll();saveHistory();};
$('flipVBtn').onclick=()=>{S.flipV=!S.flipV;renderAll();saveHistory();};

// ZOOM
$('zoomInBtn').onclick=()=>{S.zoom=Math.min(4,parseFloat((S.zoom+0.1).toFixed(2)));applyZoom();};
$('zoomOutBtn').onclick=()=>{S.zoom=Math.max(0.1,parseFloat((S.zoom-0.1).toFixed(2)));applyZoom();};
$('zoomFitBtn').onclick=fitZoom;

// WATERMARK
$('uploadWatermarkBtn').addEventListener('click',()=>$('watermarkInput').click());
$('watermarkInput').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const url=URL.createObjectURL(f);
  const img=new Image();img.onload=()=>{S.wmImage=img;showToast('Watermark loaded. Click canvas to place or use Apply button.');
    const prev=$('wmPreview');if(prev){prev.src=url;prev.parentElement.classList.remove('hidden');}
  };img.src=url;e.target.value='';
});
$('wmOpacity').addEventListener('input',e=>{S.wmOpacity=+e.target.value/100;$('wmOpacityVal').textContent=e.target.value+'%';});
$('wmScale').addEventListener('input',e=>{S.wmScale=+e.target.value/100;$('wmScaleVal').textContent=e.target.value+'%';});
document.querySelectorAll('.pos-btn').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.pos-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');S.wmPos=btn.dataset.pos;});});
$('applyWatermarkBtn').addEventListener('click',()=>{if(!S.wmImage){showToast('Upload a watermark first');return;}applyWatermarkToCanvas();});

function placeWatermarkAt(x,y){
  if(!S.wmImage)return;
  const w=mainCanvas.width*S.wmScale,h=S.wmImage.height*(w/S.wmImage.width);
  ctx.save();ctx.globalAlpha=S.wmOpacity;ctx.drawImage(S.wmImage,x-w/2,y-h/2,w,h);ctx.restore();
  showToast('Watermark placed!');saveHistory();
}
function applyWatermarkToCanvas(){
  if(!S.wmImage)return;
  const W=mainCanvas.width,H=mainCanvas.height;
  const w=W*S.wmScale,h=S.wmImage.height*(w/S.wmImage.width);
  const pad=20;
  const posMap={tl:[pad,pad],tc:[W/2-w/2,pad],tr:[W-w-pad,pad],c:[W/2-w/2,H/2-h/2],bl:[pad,H-h-pad],bc:[W/2-w/2,H-h-pad],br:[W-w-pad,H-h-pad]};
  const[wx,wy]=posMap[S.wmPos]||posMap.br;
  ctx.save();ctx.globalAlpha=S.wmOpacity;ctx.drawImage(S.wmImage,wx,wy,w,h);ctx.restore();
  showToast('Watermark applied ✓');saveHistory();
}

// CANVAS OPTIONS
$('addBgColorBtn').addEventListener('click',()=>{
  const color=$('bgColorPick').value;
  const off=document.createElement('canvas');off.width=mainCanvas.width;off.height=mainCanvas.height;
  const oc=off.getContext('2d');oc.fillStyle=color;oc.fillRect(0,0,off.width,off.height);
  oc.drawImage(mainCanvas,0,0);
  const img=new Image();img.onload=()=>{S.sourceImage=img;renderAll();saveHistory();showToast('Background applied');};img.src=off.toDataURL();
});
$('bgColorPick').addEventListener('input',()=>{});
$('paddingSize').addEventListener('input',e=>{$('paddingVal').textContent=e.target.value+'px';});
$('applyPaddingBtn').addEventListener('click',()=>{
  const pad=+$('paddingSize').value,color=$('paddingColor').value;
  if(!S.sourceImage&&!mainCanvas.width)return;
  const nw=mainCanvas.width+pad*2,nh=mainCanvas.height+pad*2;
  const off=document.createElement('canvas');off.width=nw;off.height=nh;
  const oc=off.getContext('2d');oc.fillStyle=color;oc.fillRect(0,0,nw,nh);oc.drawImage(mainCanvas,pad,pad);
  const img=new Image();img.onload=()=>{S.sourceImage=img;S.objects=S.objects.map(o=>{const no={...o};if('x'in no)no.x+=pad;if('y'in no)no.y+=pad;if('x1'in no){no.x1+=pad;no.x2+=pad;no.y1+=pad;no.y2+=pad;}if(no.points)no.points=no.points.map(p=>({x:p.x+pad,y:p.y+pad}));return no;});resizeCanvases(nw,nh);fitZoom();renderAll();saveHistory();showToast('Padding applied ✓');};img.src=off.toDataURL();
});

// DOWNLOAD
$('dlArrow').onclick=e=>{e.stopPropagation();$('dlMenu').classList.toggle('hidden');};
document.addEventListener('click',()=>$('dlMenu').classList.add('hidden'));
function flatCanvas(){const out=document.createElement('canvas');out.width=mainCanvas.width;out.height=mainCanvas.height;out.getContext('2d').drawImage(mainCanvas,0,0);return out;}
function downloadAs(format){const out=flatCanvas();const mime=format==='jpg'?'image/jpeg':format==='webp'?'image/webp':'image/png';out.toBlob(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${$('fileName').textContent.replace(/\.[^.]+$/,'')}_edited.${format}`;a.click();showToast(`Downloaded as ${format.toUpperCase()} ✓`);},mime,0.93);}
$('downloadBtn').onclick=()=>downloadAs('png');
document.querySelectorAll('.dlm-btn[data-format]').forEach(btn=>btn.addEventListener('click',()=>downloadAs(btn.dataset.format)));
function copyToClipboard(){const out=flatCanvas();out.toBlob(blob=>{try{navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);showToast('Copied ✓');}catch{showToast('Copy not supported in this browser');}});}
$('copyBtn').onclick=copyToClipboard;$('copyMenuBtn').onclick=copyToClipboard;

// THEME
$('themeToggle').onclick=()=>{const h=document.documentElement;h.setAttribute('data-theme',h.getAttribute('data-theme')==='dark'?'light':'dark');};

// CROP
function openCropModal(){
  if(!S.sourceImage)return;const modal=$('cropModal'),cc=$('cropCanvas');modal.classList.remove('hidden');
  const maxW=window.innerWidth*0.8,maxH=window.innerHeight*0.65,scale=Math.min(1,maxW/mainCanvas.width,maxH/mainCanvas.height);
  cc.width=Math.round(mainCanvas.width*scale);cc.height=Math.round(mainCanvas.height*scale);
  const cctx=cc.getContext('2d');cctx.drawImage(mainCanvas,0,0,cc.width,cc.height);
  cropState={scale,drawing:false,x:0,y:0,w:0,h:0};
  cc.onmousedown=e=>{const r=cc.getBoundingClientRect();cropState.x=e.clientX-r.left;cropState.y=e.clientY-r.top;cropState.w=0;cropState.h=0;cropState.drawing=true;};
  cc.onmousemove=e=>{if(!cropState.drawing)return;const r=cc.getBoundingClientRect();cropState.w=(e.clientX-r.left)-cropState.x;cropState.h=(e.clientY-r.top)-cropState.y;cctx.clearRect(0,0,cc.width,cc.height);cctx.drawImage(mainCanvas,0,0,cc.width,cc.height);cctx.save();cctx.fillStyle='rgba(0,0,0,0.45)';cctx.fillRect(0,0,cc.width,cc.height);cctx.clearRect(cropState.x,cropState.y,cropState.w,cropState.h);cctx.restore();cctx.strokeStyle='#00C7FF';cctx.lineWidth=1.5;cctx.setLineDash([5,4]);cctx.strokeRect(cropState.x,cropState.y,cropState.w,cropState.h);cctx.setLineDash([]);};
  cc.onmouseup=()=>{cropState.drawing=false;};
}
[$('cancelCrop'),$('cancelCrop2')].forEach(b=>{b.onclick=()=>$('cropModal').classList.add('hidden');});
$('applyCrop').onclick=()=>{
  if(!cropState.w||!cropState.h){$('cropModal').classList.add('hidden');return;}
  const s=cropState.scale,sx=cropState.x/s,sy=cropState.y/s,sw=cropState.w/s,sh=cropState.h/s;
  const off=document.createElement('canvas');off.width=Math.abs(sw);off.height=Math.abs(sh);
  off.getContext('2d').drawImage(mainCanvas,Math.min(sx,sx+sw),Math.min(sy,sy+sh),Math.abs(sw),Math.abs(sh),0,0,off.width,off.height);
  const img=new Image();img.onload=()=>{S.sourceImage=img;S.objects=[];resizeCanvases(img.width,img.height);fitZoom();renderAll();saveHistory();};img.src=off.toDataURL();
  $('cropModal').classList.add('hidden');
};

// RESIZABLE PANELS
function initResize(handleId,targetId,side){
  const handle=$(handleId);if(!handle)return;
  handle.addEventListener('mousedown',e=>{
    e.preventDefault();handle.classList.add('dragging');
    const startX=e.clientX,target=$(targetId);
    const startW=target.offsetWidth;
    const onMove=ev=>{
      const dx=ev.clientX-startX;
      const newW=Math.max(100,Math.min(400,startW+(side==='right'?-dx:dx)));
      target.style.width=newW+'px';
    };
    const onUp=()=>{handle.classList.remove('dragging');document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);};
    document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
  });
}
initResize('resizeLeft','toolbar','left');
initResize('resizeRight','optionsPanel','right');

// KEYBOARD SHORTCUTS
document.addEventListener('keydown',e=>{
  const tag=document.activeElement.tagName;
  if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA')return;
  const ctrl=e.ctrlKey||e.metaKey;
  if(ctrl&&e.key==='z'){e.preventDefault();$('undoBtn').click();}
  if(ctrl&&(e.key==='y'||(e.shiftKey&&e.key==='Z'))){e.preventDefault();$('redoBtn').click();}
  if(ctrl&&e.key==='d'){e.preventDefault();$('dupSelBtn').click();}
  if((e.key==='Delete'||e.key==='Backspace')&&S.selectedObj)$('deleteSelBtn').click();
  if(e.key==='Escape'){S.selectedObj=null;updateFloatBar();renderAll();}
  if(e.key==='='||e.key==='+')$('zoomInBtn').click();
  if(e.key==='-')$('zoomOutBtn').click();
  if(e.key==='0')fitZoom();
  const toolMap={s:'select',p:'pen',t:'text',b:'blur',a:'arrow',e:'emoji',h:'highlighter',r:'rect',c:'circle'};
  if(!ctrl&&toolMap[e.key.toLowerCase()]){const btn=document.querySelector(`[data-tool="${toolMap[e.key.toLowerCase()]}"]`);if(btn)btn.click();}
});

// SHORTCUTS MODALS
$('shortcutsBtn').onclick=$('shortcutsBtn2').onclick=()=>$('shortcutsModal').classList.toggle('hidden');
$('closeShortcuts').onclick=()=>$('shortcutsModal').classList.add('hidden');

// TOAST
function showToast(msg,ms=2400){const t=$('toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(showToast._t);showToast._t=setTimeout(()=>t.classList.add('hidden'),ms);}
console.log('%ceditр v3 ready','color:#FF3B57;font-weight:bold');
