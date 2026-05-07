'use strict';
/* ═══════════════════════════════════════
   EDITR — editor.js v2
   All tools, blur drag-select, light/dark,
   add media without going back, zoom,
   arrow styles, shape fill/stroke,
   ABC labels, 60+ emoji, keyboard shortcuts
═══════════════════════════════════════ */

// ── DOM ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const mainCanvas    = $('mainCanvas');
const overlayCanvas = $('overlayCanvas');
const ctx  = mainCanvas.getContext('2d');
const octx = overlayCanvas.getContext('2d');

// ── EMOJI DATA ────────────────────────────────────────────
const EMOJIS = {
  reactions: ['👍','👎','❤️','🔥','⭐','✅','❌','⚠️','💡','🎯','🚀','👀','💬','🗣️','💯','🙌','👏','🤔','😮','🤯','💪','🎉','🏆','✨','💎','🔑','📌','📍'],
  symbols:   ['🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🔶','🔷','🔸','🔹','▶️','⏩','⏭️','🔺','🔻','💠','🔘','🔲'],
  arrows:    ['➡️','⬅️','⬆️','⬇️','↗️','↙️','↖️','↘️','↕️','↔️','🔄','🔃','↩️','↪️','⤴️','⤵️','🔙','🔚','🔛','🔜','🔝','➰','➿','🔁','🔂'],
  objects:   ['💡','🔦','🕯️','📸','🎥','🖥️','💻','📱','⌨️','🖱️','🖨️','📡','🔭','🔬','📊','📈','📉','📋','📁','📂','🗂️','📝','✏️','🖊️','🖋️','🗒️','📌','📍','🔗','🔒','🔓','🔑','🗝️'],
  faces:     ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','😐','😑','😶','😏','😒','🙄','😬','😮','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠'],
};

// ── STATE ────────────────────────────────────────────────
const S = {
  tool: 'select',
  color: '#FF3B57',
  strokeSize: 3,
  opacity: 1,
  fontSize: 24,
  fontFamily: 'DM Sans',
  bold: false, italic: false, textBg: false, outlineText: false,
  textAlign: 'left',
  arrowStyle: 'normal',
  fillStyle: 'none',  // none | solid | semi
  strokeStyle: 'solid', // solid | dashed | dotted
  cornerRadius: 0,
  blurIntensity: 12,
  blurMode: 'gaussian',
  selectedEmoji: '👍',
  emojiSize: 4,
  counterNum: 1,
  letterNum: 0, // 0=A,1=B,...
  isVideo: false,

  zoom: 1,
  panX: 0, panY: 0,

  isDrawing: false,
  startX: 0, startY: 0,

  objects: [],
  selectedObj: null,
  dragging: false,
  dragOffX: 0, dragOffY: 0,
  lockedObjs: new Set(),

  history: [],
  historyIndex: -1,

  brightness: 0, contrast: 0, saturation: 0,
  rotation: 0, flipH: false, flipV: false,

  sourceImage: null,
};

let currentPenObj = null;
let cropState = {};

// ── INIT ─────────────────────────────────────────────────
$('uploadZone').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', e => handleFile(e.target.files[0]));
$('addFileInput').addEventListener('change', e => handleFile(e.target.files[0]));
$('addMediaBtn').addEventListener('click', () => $('addFileInput').click());

$('uploadZone').addEventListener('dragover', e => { e.preventDefault(); $('uploadZone').classList.add('drag-over'); });
$('uploadZone').addEventListener('dragleave', () => $('uploadZone').classList.remove('drag-over'));
$('uploadZone').addEventListener('drop', e => {
  e.preventDefault(); $('uploadZone').classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

// Paste from clipboard
document.addEventListener('paste', e => {
  for (const item of e.clipboardData?.items || []) {
    if (item.type.startsWith('image/')) { handleFile(item.getAsFile()); break; }
  }
});

// ── FILE HANDLING ─────────────────────────────────────────
function handleFile(file) {
  if (!file) return;
  $('fileName').textContent = file.name.length > 22 ? file.name.slice(0,19)+'…' : file.name;
  S.isVideo = file.type.startsWith('video/');
  S.objects = []; S.history = []; S.historyIndex = -1;
  S.rotation = 0; S.flipH = false; S.flipV = false;
  S.brightness = S.contrast = S.saturation = 0;
  S.counterNum = 1; S.letterNum = 0;
  ['brightness','contrast','saturation'].forEach(p => $(p).value = 0);

  if (S.isVideo) {
    $('videoSec').classList.remove('hidden');
    $('videoControls').style.display = 'flex';
    loadVideo(file);
  } else {
    $('videoSec').classList.add('hidden');
    $('videoControls').style.display = 'none';
    loadImage(file);
  }

  $('landing').classList.remove('active');
  $('editor').style.display = 'flex';
  updateCounterDisplay();
}

function loadImage(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    S.sourceImage = img;
    resizeCanvases(img.width, img.height);
    fitZoom();
    renderAll();
    saveHistory();
  };
  img.src = url;
}

function loadVideo(file) {
  const vel = $('videoEl');
  vel.src = URL.createObjectURL(file);
  vel.addEventListener('loadedmetadata', () => {
    S.sourceImage = null;
    resizeCanvases(vel.videoWidth, vel.videoHeight);
    fitZoom();
    vel.currentTime = 0;
  }, { once: true });
  vel.addEventListener('seeked', renderVideoFrame);
  vel.addEventListener('timeupdate', onVideoTimeUpdate);
  setupVideoControls();
}

function resizeCanvases(w, h) {
  [mainCanvas, overlayCanvas].forEach(c => { c.width = w; c.height = h; });
  applyZoom();
}

function applyZoom() {
  const w = mainCanvas.width, h = mainCanvas.height;
  const dw = Math.round(w * S.zoom), dh = Math.round(h * S.zoom);
  [mainCanvas, overlayCanvas].forEach(c => { c.style.width = dw+'px'; c.style.height = dh+'px'; });
  $('canvasContainer').style.width = dw+'px';
  $('canvasContainer').style.height = dh+'px';
  $('zoomVal').textContent = Math.round(S.zoom*100)+'%';
}

function fitZoom() {
  const area = $('canvasArea');
  const mw = area.clientWidth - 80, mh = area.clientHeight - 100;
  S.zoom = Math.min(1, mw / mainCanvas.width, mh / mainCanvas.height);
  applyZoom();
}

// ── RENDER ────────────────────────────────────────────────
function renderAll() {
  const w = mainCanvas.width, h = mainCanvas.height;
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // transform for flip/rotate
  ctx.translate(w/2, h/2);
  ctx.rotate(S.rotation * Math.PI / 180);
  ctx.scale(S.flipH ? -1 : 1, S.flipV ? -1 : 1);
  ctx.translate(-w/2, -h/2);

  if (S.sourceImage) {
    ctx.filter = buildFilter();
    ctx.drawImage(S.sourceImage, 0, 0, w, h);
    ctx.filter = 'none';
  }
  ctx.restore();

  S.objects.forEach(obj => drawObject(ctx, obj, false));
}

function buildFilter() {
  const b = 100 + S.brightness;
  const c = ((S.contrast + 100) / 100).toFixed(2);
  const sat = ((S.saturation + 100) / 100).toFixed(2);
  return `brightness(${b}%) contrast(${c}) saturate(${sat})`;
}

function renderVideoFrame() {
  const vel = $('videoEl');
  ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
  ctx.drawImage(vel, 0, 0, mainCanvas.width, mainCanvas.height);
  S.objects.forEach(obj => drawObject(ctx, obj, false));
}

// ── DRAW OBJECT ───────────────────────────────────────────
function drawObject(c, obj, preview) {
  c.save();
  c.globalAlpha = obj.opacity ?? 1;

  switch(obj.type) {
    case 'pen':         drawPath(c, obj); break;
    case 'highlighter': drawHighlight(c, obj); break;
    case 'rect':        drawRect(c, obj); break;
    case 'circle':      drawCircle(c, obj); break;
    case 'line':        drawLine(c, obj); break;
    case 'arrow':       drawArrow(c, obj); break;
    case 'text':        drawText(c, obj); break;
    case 'blur':        drawBlur(c, obj); break;
    case 'callout':     drawCallout(c, obj); break;
    case 'emoji':       drawEmoji(c, obj); break;
    case 'counter':     drawBadge(c, obj, String(obj.num)); break;
    case 'letter':      drawBadge(c, obj, obj.letter); break;
  }

  // selection handles
  if (!preview && obj === S.selectedObj) {
    const b = getBounds(obj);
    if (b) {
      c.globalAlpha = 1;
      c.strokeStyle = '#00C7FF';
      c.lineWidth = 1.5 / S.zoom;
      c.setLineDash([5/S.zoom, 4/S.zoom]);
      c.strokeRect(b.x - 7, b.y - 7, b.w + 14, b.h + 14);
      c.setLineDash([]);
      // corner handles
      [[b.x-7,b.y-7],[b.x+b.w+7,b.y-7],[b.x-7,b.y+b.h+7],[b.x+b.w+7,b.y+b.h+7]].forEach(([hx,hy]) => {
        c.fillStyle = '#fff'; c.strokeStyle = '#00C7FF'; c.lineWidth = 1.5/S.zoom;
        c.beginPath(); c.arc(hx, hy, 4/S.zoom, 0, Math.PI*2); c.fill(); c.stroke();
      });
      if (S.lockedObjs.has(obj)) {
        c.fillStyle = 'rgba(255,59,87,.5)';
        c.font = `${12/S.zoom}px sans-serif`;
        c.fillText('🔒', b.x, b.y - 10);
      }
    }
  }
  c.restore();
}

function applyStroke(c, obj) {
  const dash = obj.strokeStyle === 'dashed' ? [8, 6] : obj.strokeStyle === 'dotted' ? [2, 4] : [];
  c.setLineDash(dash);
  c.strokeStyle = obj.color;
  c.lineWidth = obj.size;
  c.lineCap = 'round';
  c.lineJoin = 'round';
}

function drawPath(c, obj) {
  if (!obj.points?.length) return;
  c.beginPath();
  c.moveTo(obj.points[0].x, obj.points[0].y);
  obj.points.forEach(p => c.lineTo(p.x, p.y));
  c.strokeStyle = obj.color; c.lineWidth = obj.size;
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.stroke();
}

function drawHighlight(c, obj) {
  if (!obj.points?.length) return;
  c.save();
  c.globalAlpha = (obj.opacity ?? 1) * 0.35;
  c.beginPath();
  c.moveTo(obj.points[0].x, obj.points[0].y);
  obj.points.forEach(p => c.lineTo(p.x, p.y));
  c.strokeStyle = obj.color; c.lineWidth = obj.size * 6;
  c.lineCap = 'square'; c.lineJoin = 'round';
  c.stroke();
  c.restore();
}

function drawRect(c, obj) {
  const x = Math.min(obj.x, obj.x+obj.w), y = Math.min(obj.y, obj.y+obj.h);
  const w = Math.abs(obj.w), h = Math.abs(obj.h);
  const r = obj.cornerRadius || 0;
  c.beginPath();
  if (r > 0) {
    c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r);
    c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r);
    c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y); c.closePath();
  } else { c.rect(x, y, w, h); }
  if (obj.fillStyle === 'solid') { c.fillStyle = obj.color; c.fill(); }
  else if (obj.fillStyle === 'semi') { c.fillStyle = obj.color; c.save(); c.globalAlpha *= 0.3; c.fill(); c.restore(); }
  applyStroke(c, obj); c.stroke();
}

function drawCircle(c, obj) {
  const cx = obj.x + obj.w/2, cy = obj.y + obj.h/2;
  const rx = Math.abs(obj.w/2), ry = Math.abs(obj.h/2);
  c.beginPath(); c.ellipse(cx, cy, rx||1, ry||1, 0, 0, Math.PI*2);
  if (obj.fillStyle === 'solid') { c.fillStyle = obj.color; c.fill(); }
  else if (obj.fillStyle === 'semi') { c.fillStyle = obj.color; c.save(); c.globalAlpha *= 0.3; c.fill(); c.restore(); }
  applyStroke(c, obj); c.stroke();
}

function drawLine(c, obj) {
  c.beginPath(); c.moveTo(obj.x1, obj.y1); c.lineTo(obj.x2, obj.y2);
  applyStroke(c, obj); c.stroke();
}

function drawArrow(c, obj) {
  const dx = obj.x2-obj.x1, dy = obj.y2-obj.y1;
  const angle = Math.atan2(dy, dx);
  const headLen = Math.max(14, obj.size * 4);

  c.strokeStyle = obj.color; c.fillStyle = obj.color;
  c.lineWidth = obj.size; c.lineCap = 'round';

  const dash = obj.arrowStyle === 'dashed' ? [10, 6] : [];
  c.setLineDash(dash);

  if (obj.arrowStyle === 'curved') {
    const mx = (obj.x1+obj.x2)/2 - dy*0.3, my = (obj.y1+obj.y2)/2 + dx*0.3;
    c.beginPath(); c.moveTo(obj.x1, obj.y1); c.quadraticCurveTo(mx, my, obj.x2, obj.y2); c.stroke();
    const ta = Math.atan2(obj.y2-my, obj.x2-mx);
    drawArrowHead(c, obj.x2, obj.y2, ta, headLen, obj.arrowStyle);
  } else {
    c.beginPath(); c.moveTo(obj.x1, obj.y1); c.lineTo(obj.x2, obj.y2); c.stroke();
    c.setLineDash([]);
    drawArrowHead(c, obj.x2, obj.y2, angle, headLen, obj.arrowStyle);
    if (obj.arrowStyle === 'double') drawArrowHead(c, obj.x1, obj.y1, angle+Math.PI, headLen, 'normal');
  }
  c.setLineDash([]);
}

function drawArrowHead(c, x, y, angle, len, style) {
  if (style === 'outline') {
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - len*Math.cos(angle-Math.PI/6), y - len*Math.sin(angle-Math.PI/6));
    c.lineTo(x - len*Math.cos(angle+Math.PI/6), y - len*Math.sin(angle+Math.PI/6));
    c.closePath(); c.stroke();
  } else {
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - len*Math.cos(angle-Math.PI/7), y - len*Math.sin(angle-Math.PI/7));
    c.lineTo(x - len*Math.cos(angle+Math.PI/7), y - len*Math.sin(angle+Math.PI/7));
    c.closePath(); c.fill();
  }
}

function drawText(c, obj) {
  const weight = obj.bold ? 'bold' : 'normal';
  const style  = obj.italic ? 'italic' : 'normal';
  c.font = `${style} ${weight} ${obj.fontSize}px ${obj.fontFamily||'DM Sans'}, sans-serif`;
  c.textAlign = obj.textAlign || 'left';
  const lines = (obj.text||'').split('\n');
  const lh = obj.fontSize * 1.3;
  lines.forEach((line, i) => {
    const ly = obj.y + i * lh;
    if (obj.textBg) {
      const m = c.measureText(line);
      const pad = 5;
      const bx = obj.textAlign === 'center' ? obj.x - m.width/2 - pad : obj.textAlign === 'right' ? obj.x - m.width - pad : obj.x - pad;
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(bx, ly - obj.fontSize - 2, m.width + pad*2, obj.fontSize + 8);
    }
    if (obj.outlineText) {
      c.strokeStyle = '#000'; c.lineWidth = obj.fontSize/8; c.lineJoin = 'round';
      c.strokeText(line, obj.x, ly);
    }
    c.fillStyle = obj.color;
    c.fillText(line, obj.x, ly);
  });
  c.textAlign = 'left';
}

function drawBlur(c, obj) {
  if (!obj.w || !obj.h) return;
  const x = Math.min(obj.x, obj.x+obj.w), y = Math.min(obj.y, obj.y+obj.h);
  const w = Math.abs(obj.w), h = Math.abs(obj.h);
  if (w < 2 || h < 2) return;

  if (obj.blurMode === 'pixelate') {
    const px = Math.max(3, obj.blurIntensity);
    const off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(w/px));
    off.height = Math.max(1, Math.round(h/px));
    const oc = off.getContext('2d');
    oc.imageSmoothingEnabled = false;
    oc.drawImage(mainCanvas, x, y, w, h, 0, 0, off.width, off.height);
    c.imageSmoothingEnabled = false;
    c.drawImage(off, 0, 0, off.width, off.height, x, y, w, h);
    c.imageSmoothingEnabled = true;
  } else {
    // Gaussian: grab region, apply CSS filter blur to temp canvas
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const oc = off.getContext('2d');
    oc.filter = `blur(${obj.blurIntensity}px)`;
    oc.drawImage(mainCanvas, x, y, w, h, -obj.blurIntensity*2, -obj.blurIntensity*2, w+obj.blurIntensity*4, h+obj.blurIntensity*4);
    c.save();
    c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.drawImage(off, x, y);
    c.restore();
  }

  // Dashed border preview
  c.save();
  c.strokeStyle = 'rgba(0,199,255,0.6)';
  c.lineWidth = 1.5;
  c.setLineDash([5, 4]);
  c.strokeRect(x, y, w, h);
  c.setLineDash([]);
  c.restore();
}

function drawCallout(c, obj) {
  const x = obj.x, y = obj.y, w = Math.abs(obj.w)||160, h = Math.abs(obj.h)||70;
  const r = 10;
  c.beginPath();
  c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c.lineTo(x+36,y+h); c.lineTo(x+18,y+h+22); c.lineTo(x+28,y+h);
  c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r);
  c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y); c.closePath();
  c.fillStyle = obj.color;
  c.save(); c.globalAlpha = (obj.opacity??1)*0.88; c.fill(); c.restore();
  if (obj.text) {
    c.fillStyle = '#fff'; c.font = `600 14px DM Sans, sans-serif`;
    c.textAlign = 'center'; c.fillText(obj.text, x+w/2, y+h/2+5); c.textAlign = 'left';
  }
}

function drawEmoji(c, obj) {
  c.font = `${(obj.emojiSize||4)*8}px serif`;
  c.textBaseline = 'middle';
  c.fillText(obj.emoji, obj.x, obj.y);
  c.textBaseline = 'alphabetic';
}

function drawBadge(c, obj, label) {
  const r = Math.max(10, (obj.size||3)*4);
  c.beginPath(); c.arc(obj.x, obj.y, r, 0, Math.PI*2);
  c.fillStyle = obj.color; c.fill();
  c.fillStyle = '#fff';
  c.font = `bold ${Math.max(10, r*1.0)}px JetBrains Mono, monospace`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(label, obj.x, obj.y);
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
}

// ── BOUNDS ────────────────────────────────────────────────
function getBounds(obj) {
  switch(obj.type) {
    case 'rect': case 'circle': case 'blur': case 'callout':
      return { x:Math.min(obj.x,obj.x+obj.w), y:Math.min(obj.y,obj.y+obj.h), w:Math.abs(obj.w)||20, h:Math.abs(obj.h)||20 };
    case 'line': case 'arrow':
      return { x:Math.min(obj.x1,obj.x2), y:Math.min(obj.y1,obj.y2), w:Math.abs(obj.x2-obj.x1)||20, h:Math.abs(obj.y2-obj.y1)||20 };
    case 'text': {
      ctx.font = `${obj.fontSize}px ${obj.fontFamily||'DM Sans'}`;
      const lines = (obj.text||'').split('\n');
      const mw = Math.max(...lines.map(l => ctx.measureText(l).width)) || 60;
      return { x:obj.x, y:obj.y-obj.fontSize, w:mw, h:obj.fontSize*1.4*lines.length };
    }
    case 'emoji': { const s = (obj.emojiSize||4)*8; return { x:obj.x, y:obj.y-s, w:s, h:s }; }
    case 'counter': case 'letter': { const r=(obj.size||3)*4; return { x:obj.x-r, y:obj.y-r, w:r*2, h:r*2 }; }
    case 'pen': case 'highlighter':
      if (!obj.points?.length) return null;
      const xs=obj.points.map(p=>p.x), ys=obj.points.map(p=>p.y);
      return { x:Math.min(...xs), y:Math.min(...ys), w:Math.max(...xs)-Math.min(...xs)||20, h:Math.max(...ys)-Math.min(...ys)||20 };
    default: return null;
  }
}

function hitTest(obj, px, py) {
  const b = getBounds(obj);
  if (!b) return false;
  const pad = 10;
  return px>=b.x-pad && px<=b.x+b.w+pad && py>=b.y-pad && py<=b.y+b.h+pad;
}

// ── CANVAS COORDS ─────────────────────────────────────────
function getPos(e) {
  const rect = overlayCanvas.getBoundingClientRect();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  const cy = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (cx - rect.left) * (mainCanvas.width / rect.width),
    y: (cy - rect.top) * (mainCanvas.height / rect.height)
  };
}

// ── POINTER EVENTS ────────────────────────────────────────
overlayCanvas.addEventListener('mousedown',  onDown);
overlayCanvas.addEventListener('mousemove',  onMove);
overlayCanvas.addEventListener('mouseup',    onUp);
overlayCanvas.addEventListener('mouseleave', onUp);
overlayCanvas.addEventListener('touchstart', e => { e.preventDefault(); onDown(e); }, { passive:false });
overlayCanvas.addEventListener('touchmove',  e => { e.preventDefault(); onMove(e); }, { passive:false });
overlayCanvas.addEventListener('touchend',   e => { e.preventDefault(); onUp(e); }, { passive:false });

function onDown(e) {
  const {x,y} = getPos(e);
  S.startX = x; S.startY = y; S.isDrawing = true;
  octx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);
  const tool = S.tool;

  if (tool === 'select') {
    let hit = null;
    for (let i = S.objects.length-1; i>=0; i--) {
      if (!S.lockedObjs.has(S.objects[i]) && hitTest(S.objects[i],x,y)) { hit=S.objects[i]; break; }
    }
    S.selectedObj = hit;
    if (hit) {
      const b = getBounds(hit);
      S.dragging = true;
      S.dragOffX = b ? x-b.x : 0;
      S.dragOffY = b ? y-b.y : 0;
    }
    updateFloatBar(); renderAll(); return;
  }
  if (tool === 'eraser') { eraseAt(x,y); return; }
  if (tool === 'text') {
    const text = prompt('Enter text (Shift+Enter for new line in some browsers):');
    if (!text) { S.isDrawing=false; return; }
    pushObj({ type:'text', x, y, text, color:S.color, fontSize:S.fontSize, fontFamily:S.fontFamily, bold:S.bold, italic:S.italic, textBg:S.textBg, outlineText:S.outlineText, textAlign:S.textAlign, opacity:S.opacity });
    return;
  }
  if (tool === 'emoji') {
    pushObj({ type:'emoji', x, y, emoji:S.selectedEmoji, emojiSize:S.emojiSize, opacity:S.opacity });
    S.isDrawing=false; return;
  }
  if (tool === 'counter') {
    pushObj({ type:'counter', x, y, num:S.counterNum, color:S.color, size:Math.max(3,S.strokeSize), opacity:S.opacity });
    S.counterNum++; updateCounterDisplay(); S.isDrawing=false; return;
  }
  if (tool === 'letter') {
    pushObj({ type:'letter', x, y, letter:getLetter(S.letterNum), color:S.color, size:Math.max(3,S.strokeSize), opacity:S.opacity });
    S.letterNum++; updateCounterDisplay(); S.isDrawing=false; return;
  }
  if (tool === 'callout') {
    const text = prompt('Callout text:');
    pushObj({ type:'callout', x, y, w:180, h:72, text:text||'', color:S.color, opacity:S.opacity });
    S.isDrawing=false; return;
  }
  if (tool === 'crop') { openCropModal(); S.isDrawing=false; return; }
  if (tool === 'pen' || tool === 'highlighter') {
    currentPenObj = { type:tool, points:[{x,y}], color:S.color, size:S.strokeSize, opacity:S.opacity };
    return;
  }
}

function onMove(e) {
  const {x,y} = getPos(e);
  if (S.tool === 'select' && S.dragging && S.selectedObj) {
    moveObj(S.selectedObj, x, y); renderAll(); return;
  }
  if (!S.isDrawing) return;
  octx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);
  const tool = S.tool;
  if (tool === 'eraser') { eraseAt(x,y); return; }
  if (tool === 'pen' || tool === 'highlighter') {
    currentPenObj?.points.push({x,y});
    if (currentPenObj) drawObject(octx, currentPenObj, true);
    return;
  }
  const prev = buildShapeObj(tool, S.startX, S.startY, x, y);
  if (prev) drawObject(octx, prev, true);
}

function onUp(e) {
  const endPos = (e.type==='mouseleave') ? {x:S.startX,y:S.startY} : getPos(e);
  const {x,y} = endPos;

  if (S.tool === 'select') {
    if (S.dragging) { S.dragging=false; saveHistory(); }
    renderAll(); return;
  }
  if (!S.isDrawing) return;
  S.isDrawing = false;

  const tool = S.tool;
  let obj = null;
  if (tool === 'pen' || tool === 'highlighter') { obj = currentPenObj; currentPenObj=null; }
  else { obj = buildShapeObj(tool, S.startX, S.startY, x, y); }

  if (obj) pushObj(obj);
  octx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);
}

function buildShapeObj(tool, sx, sy, ex, ey) {
  const base = { color:S.color, size:S.strokeSize, opacity:S.opacity, fillStyle:S.fillStyle, strokeStyle:S.strokeStyle };
  switch(tool) {
    case 'rect':   return { ...base, type:'rect',   x:sx, y:sy, w:ex-sx, h:ey-sy, cornerRadius:S.cornerRadius };
    case 'circle': return { ...base, type:'circle', x:sx, y:sy, w:ex-sx, h:ey-sy };
    case 'line':   return { ...base, type:'line',   x1:sx,y1:sy,x2:ex,y2:ey };
    case 'arrow':  return { ...base, type:'arrow',  x1:sx,y1:sy,x2:ex,y2:ey, arrowStyle:S.arrowStyle };
    case 'blur':   return { ...base, type:'blur',   x:sx,y:sy,w:ex-sx,h:ey-sy, blurIntensity:S.blurIntensity, blurMode:S.blurMode };
    default: return null;
  }
}

function moveObj(obj, x, y) {
  const b = getBounds(obj);
  if (!b) return;
  const nx = b.x + (x - b.x - S.dragOffX);
  const ny = b.y + (y - b.y - S.dragOffY);
  const dx = nx - b.x, dy = ny - b.y;
  if ('x' in obj) { obj.x += dx; obj.y += dy; }
  if ('x1' in obj) { obj.x1+=dx; obj.x2+=dx; obj.y1+=dy; obj.y2+=dy; }
  if (obj.points) obj.points = obj.points.map(p=>({x:p.x+dx, y:p.y+dy}));
  S.dragOffX = x - (b.x+dx);
  S.dragOffY = y - (b.y+dy);
}

function eraseAt(x, y) {
  const prev = S.objects.length;
  S.objects = S.objects.filter(o => !hitTest(o,x,y));
  if (S.objects.length !== prev) { renderAll(); saveHistory(); }
}

// ── OBJECT MANAGEMENT ─────────────────────────────────────
function pushObj(obj) {
  S.objects.push(obj);
  S.selectedObj = null;
  updateFloatBar();
  renderAll();
  saveHistory();
}

function updateFloatBar() {
  $('floatBar').classList.toggle('hidden', !S.selectedObj);
}

$('deleteSelBtn').onclick = () => {
  if (!S.selectedObj) return;
  S.objects = S.objects.filter(o=>o!==S.selectedObj);
  S.lockedObjs.delete(S.selectedObj);
  S.selectedObj=null; updateFloatBar(); renderAll(); saveHistory();
};
$('dupSelBtn').onclick = () => {
  if (!S.selectedObj) return;
  const copy = JSON.parse(JSON.stringify(S.selectedObj));
  if ('x' in copy) { copy.x+=22; copy.y+=22; }
  if ('x1' in copy) { copy.x1+=22; copy.x2+=22; copy.y1+=22; copy.y2+=22; }
  if (copy.points) copy.points = copy.points.map(p=>({x:p.x+22,y:p.y+22}));
  pushObj(copy);
};
$('fwdSelBtn').onclick = () => {
  const i = S.objects.indexOf(S.selectedObj);
  if (i < S.objects.length-1) { S.objects.splice(i,1); S.objects.push(S.selectedObj); renderAll(); saveHistory(); }
};
$('bckSelBtn').onclick = () => {
  const i = S.objects.indexOf(S.selectedObj);
  if (i > 0) { S.objects.splice(i,1); S.objects.unshift(S.selectedObj); renderAll(); saveHistory(); }
};
$('lockSelBtn').onclick = () => {
  if (!S.selectedObj) return;
  if (S.lockedObjs.has(S.selectedObj)) {
    S.lockedObjs.delete(S.selectedObj); $('lockSelBtn').textContent='🔓 Lock';
  } else {
    S.lockedObjs.add(S.selectedObj); $('lockSelBtn').textContent='🔒 Unlock';
  }
  renderAll();
};
$('clearAllBtn').onclick = () => {
  if (!S.objects.length) return;
  if (confirm('Clear all annotations?')) { S.objects=[]; S.selectedObj=null; S.lockedObjs.clear(); updateFloatBar(); renderAll(); saveHistory(); }
};

// ── HISTORY ───────────────────────────────────────────────
function saveHistory() {
  const snap = JSON.stringify({ objects:S.objects, rotation:S.rotation, flipH:S.flipH, flipV:S.flipV, brightness:S.brightness, contrast:S.contrast, saturation:S.saturation });
  S.history = S.history.slice(0, S.historyIndex+1);
  S.history.push(snap);
  if (S.history.length > 80) S.history.shift();
  else S.historyIndex++;
}
function restoreHistory() {
  const snap = JSON.parse(S.history[S.historyIndex]);
  Object.assign(S, snap);
  ['brightness','contrast','saturation'].forEach(p => $(p).value = S[p]);
  renderAll();
}
$('undoBtn').onclick = () => { if (S.historyIndex>0) { S.historyIndex--; restoreHistory(); } };
$('redoBtn').onclick = () => { if (S.historyIndex<S.history.length-1) { S.historyIndex++; restoreHistory(); } };

// ── TOOL BUTTONS ──────────────────────────────────────────
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    S.tool = btn.dataset.tool;
    S.selectedObj = null; updateFloatBar(); renderAll();
    updateSidePanel();
  });
});

function updateSidePanel() {
  const t = S.tool;
  $('textSec').classList.toggle('hidden',   t !== 'text');
  $('arrowSec').classList.toggle('hidden',  t !== 'arrow');
  $('shapeSec').classList.toggle('hidden',  !['rect','circle'].includes(t));
  $('blurSec').classList.toggle('hidden',   t !== 'blur');
  $('emojiSec').classList.toggle('hidden',  t !== 'emoji');
  $('counterSec').classList.toggle('hidden',!['counter','letter'].includes(t));
}

// ── COLORS ────────────────────────────────────────────────
document.querySelectorAll('.csw').forEach(sw => {
  sw.addEventListener('click', () => {
    document.querySelectorAll('.csw').forEach(s=>s.classList.remove('active'));
    sw.classList.add('active');
    S.color = sw.dataset.color;
    $('customColor').value = S.color.length===7 ? S.color : '#FF3B57';
  });
});
$('customColor').addEventListener('input', e => {
  S.color = e.target.value;
  document.querySelectorAll('.csw').forEach(s=>s.classList.remove('active'));
});

// ── SLIDERS ───────────────────────────────────────────────
$('strokeSize').addEventListener('input', e => { S.strokeSize=+e.target.value; $('strokeSizeVal').textContent=S.strokeSize; });
$('opacitySlider').addEventListener('input', e => { S.opacity=+e.target.value/100; $('opacityVal').textContent=e.target.value+'%'; });
$('fontSize').addEventListener('input', e => { S.fontSize=+e.target.value; $('fontSizeVal').textContent=S.fontSize+'px'; });
$('fontFamily').addEventListener('change', e => { S.fontFamily=e.target.value; });
$('blurIntensity').addEventListener('input', e => { S.blurIntensity=+e.target.value; $('blurVal').textContent=S.blurIntensity; });
$('cornerRadius').addEventListener('input', e => { S.cornerRadius=+e.target.value; $('cornerVal').textContent=S.cornerRadius; });
$('emojiSize').addEventListener('input', e => { S.emojiSize=+e.target.value; $('emojiSizeVal').textContent=S.emojiSize; });

// ── TEXT TOGGLES ──────────────────────────────────────────
$('boldBtn').onclick = () => { S.bold=!S.bold; $('boldBtn').classList.toggle('active',S.bold); };
$('italicBtn').onclick = () => { S.italic=!S.italic; $('italicBtn').classList.toggle('active',S.italic); };
$('bgTextBtn').onclick = () => { S.textBg=!S.textBg; $('bgTextBtn').classList.toggle('active',S.textBg); };
$('outlineTextBtn').onclick = () => { S.outlineText=!S.outlineText; $('outlineTextBtn').classList.toggle('active',S.outlineText); };

// Text align
['alignLeft','alignCenter','alignRight'].forEach((id,i) => {
  $(id).addEventListener('click', () => {
    S.textAlign = ['left','center','right'][i];
    ['alignLeft','alignCenter','alignRight'].forEach(bid=>$(bid).classList.remove('active'));
    $(id).classList.add('active');
  });
});

// ── ARROW STYLES ──────────────────────────────────────────
document.querySelectorAll('.arr-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.arr-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); S.arrowStyle=btn.dataset.arrow;
  });
});

// ── SHAPE FILL/STROKE ─────────────────────────────────────
['fillNone','fillSolid','fillSemi'].forEach((id,i) => {
  $(id).addEventListener('click', () => {
    S.fillStyle = ['none','solid','semi'][i];
    ['fillNone','fillSolid','fillSemi'].forEach(b=>$(b).classList.remove('active'));
    $(id).classList.add('active');
  });
});
['strokeSolid','strokeDashed','strokeDotted'].forEach((id,i) => {
  $(id).addEventListener('click', () => {
    S.strokeStyle = ['solid','dashed','dotted'][i];
    ['strokeSolid','strokeDashed','strokeDotted'].forEach(b=>$(b).classList.remove('active'));
    $(id).classList.add('active');
  });
});

// ── BLUR MODE ─────────────────────────────────────────────
$('blurGaussian').onclick = () => { S.blurMode='gaussian'; $('blurGaussian').classList.add('active'); $('blurPixelate').classList.remove('active'); };
$('blurPixelate').onclick = () => { S.blurMode='pixelate'; $('blurPixelate').classList.add('active'); $('blurGaussian').classList.remove('active'); };

// ── EMOJI PICKER ──────────────────────────────────────────
let currentEmojiCat = 'reactions';
function renderEmojis(cat) {
  currentEmojiCat = cat;
  const grid = $('emojiGrid');
  grid.innerHTML = '';
  (EMOJIS[cat]||EMOJIS.reactions).forEach(em => {
    const btn = document.createElement('button');
    btn.className = 'em-btn' + (em===S.selectedEmoji?' sel':'');
    btn.textContent = em;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.em-btn').forEach(b=>b.classList.remove('sel'));
      btn.classList.add('sel'); S.selectedEmoji=em;
    });
    grid.appendChild(btn);
  });
}
document.querySelectorAll('.etab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.etab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active'); renderEmojis(tab.dataset.cat);
  });
});
renderEmojis('reactions');

// ── COUNTER / LETTER ──────────────────────────────────────
function getLetter(n) { return String.fromCharCode(65 + (n % 26)); }
function updateCounterDisplay() {
  const t = S.tool;
  if (t==='counter') $('counterDisplay').textContent = S.counterNum;
  else if (t==='letter') $('counterDisplay').textContent = getLetter(S.letterNum);
}
$('resetCounterBtn').onclick = () => { S.counterNum=1; S.letterNum=0; updateCounterDisplay(); showToast('Labels reset'); };

// ── ADJUSTMENTS ───────────────────────────────────────────
['brightness','contrast','saturation'].forEach(prop => {
  $(prop).addEventListener('input', e => { S[prop]=+e.target.value; renderAll(); });
});
$('resetAdjBtn').onclick = () => {
  S.brightness=S.contrast=S.saturation=0;
  ['brightness','contrast','saturation'].forEach(p=>$(p).value=0);
  renderAll(); saveHistory();
};

// ── TRANSFORM ─────────────────────────────────────────────
$('rotateLeftBtn').onclick  = () => { S.rotation=(S.rotation-90+360)%360; renderAll(); saveHistory(); };
$('rotateRightBtn').onclick = () => { S.rotation=(S.rotation+90)%360; renderAll(); saveHistory(); };
$('flipHBtn').onclick = () => { S.flipH=!S.flipH; renderAll(); saveHistory(); };
$('flipVBtn').onclick = () => { S.flipV=!S.flipV; renderAll(); saveHistory(); };

// ── ZOOM ──────────────────────────────────────────────────
$('zoomInBtn').onclick  = () => { S.zoom=Math.min(4, parseFloat((S.zoom+0.1).toFixed(2))); applyZoom(); };
$('zoomOutBtn').onclick = () => { S.zoom=Math.max(0.1, parseFloat((S.zoom-0.1).toFixed(2))); applyZoom(); };
$('zoomFitBtn').onclick = fitZoom;
overlayCanvas.addEventListener('wheel', e => {
  e.preventDefault();
  S.zoom = Math.min(4, Math.max(0.1, S.zoom + (e.deltaY < 0 ? 0.1 : -0.1)));
  applyZoom();
}, { passive: false });

// ── DOWNLOAD ──────────────────────────────────────────────
$('dlArrow').onclick = e => {
  e.stopPropagation();
  $('dlMenu').classList.toggle('hidden');
};
document.addEventListener('click', () => $('dlMenu').classList.add('hidden'));

function flatCanvas() {
  const out = document.createElement('canvas');
  out.width = mainCanvas.width; out.height = mainCanvas.height;
  const oc = out.getContext('2d');
  oc.drawImage(mainCanvas, 0, 0);
  return out;
}

function downloadAs(format) {
  const out = flatCanvas();
  const mime = format==='jpg'?'image/jpeg':format==='webp'?'image/webp':'image/png';
  out.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const base = $('fileName').textContent.replace(/\.[^.]+$/,'');
    a.download = `${base}_edited.${format}`;
    a.click();
    showToast(`Downloaded as ${format.toUpperCase()} ✓`);
  }, mime, 0.92);
}

$('downloadBtn').onclick = () => downloadAs('png');
document.querySelectorAll('.dlm-btn[data-format]').forEach(btn => {
  btn.addEventListener('click', () => downloadAs(btn.dataset.format));
});

function copyToClipboard() {
  const out = flatCanvas();
  out.toBlob(blob => {
    try {
      navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
      showToast('Copied to clipboard ✓');
    } catch { showToast('Copy not supported in this browser'); }
  });
}
$('copyBtn').onclick = copyToClipboard;
$('copyMenuBtn').onclick = copyToClipboard;

// ── THEME TOGGLE ──────────────────────────────────────────
$('themeToggle').onclick = () => {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  showToast(isDark ? '☀️ Light mode' : '🌙 Dark mode');
};

// ── CROP ──────────────────────────────────────────────────
function openCropModal() {
  if (!S.sourceImage && !S.isVideo) return;
  const modal = $('cropModal'), cc = $('cropCanvas');
  modal.classList.remove('hidden');
  const maxW = window.innerWidth*0.8, maxH = window.innerHeight*0.65;
  const scale = Math.min(1, maxW/mainCanvas.width, maxH/mainCanvas.height);
  cc.width  = Math.round(mainCanvas.width*scale);
  cc.height = Math.round(mainCanvas.height*scale);
  const cctx = cc.getContext('2d');
  cctx.drawImage(mainCanvas, 0, 0, cc.width, cc.height);
  cropState = { scale, drawing:false, x:0, y:0, w:0, h:0 };

  cc.onmousedown = e => {
    const r = cc.getBoundingClientRect();
    cropState.x = e.clientX-r.left; cropState.y = e.clientY-r.top;
    cropState.w=0; cropState.h=0; cropState.drawing=true;
  };
  cc.onmousemove = e => {
    if (!cropState.drawing) return;
    const r = cc.getBoundingClientRect();
    cropState.w = (e.clientX-r.left)-cropState.x;
    cropState.h = (e.clientY-r.top)-cropState.y;
    cctx.clearRect(0,0,cc.width,cc.height);
    cctx.drawImage(mainCanvas, 0, 0, cc.width, cc.height);
    cctx.save();
    cctx.fillStyle='rgba(0,0,0,0.45)'; cctx.fillRect(0,0,cc.width,cc.height);
    cctx.clearRect(cropState.x,cropState.y,cropState.w,cropState.h);
    cctx.restore();
    cctx.strokeStyle='#00C7FF'; cctx.lineWidth=1.5; cctx.setLineDash([5,4]);
    cctx.strokeRect(cropState.x,cropState.y,cropState.w,cropState.h);
    cctx.setLineDash([]);
  };
  cc.onmouseup = () => { cropState.drawing=false; };
}

[$('cancelCrop'),$('cancelCrop2')].forEach(b => { b.onclick = () => $('cropModal').classList.add('hidden'); });
$('applyCrop').onclick = () => {
  if (!cropState.w||!cropState.h) { $('cropModal').classList.add('hidden'); return; }
  const s=cropState.scale;
  const sx=cropState.x/s, sy=cropState.y/s;
  const sw=cropState.w/s, sh=cropState.h/s;
  const off=document.createElement('canvas');
  off.width=Math.abs(sw); off.height=Math.abs(sh);
  const oc=off.getContext('2d');
  oc.drawImage(mainCanvas, Math.min(sx,sx+sw), Math.min(sy,sy+sh), Math.abs(sw), Math.abs(sh), 0, 0, off.width, off.height);
  const img=new Image();
  img.onload=()=>{ S.sourceImage=img; S.objects=[]; resizeCanvases(img.width,img.height); fitZoom(); renderAll(); saveHistory(); };
  img.src=off.toDataURL();
  $('cropModal').classList.add('hidden');
};

// ── VIDEO CONTROLS ────────────────────────────────────────
function setupVideoControls() {
  const vel=$('videoEl'), pb=$('playPauseBtn');
  pb.onclick=()=>{
    if(vel.paused){vel.play();pb.textContent='⏸';}
    else{vel.pause();pb.textContent='▶';}
  };
  $('timelineBar').onclick=e=>{
    const r=e.currentTarget.getBoundingClientRect();
    vel.currentTime=((e.clientX-r.left)/r.width)*vel.duration;
  };
  $('speedSlider').addEventListener('input',e=>{
    vel.playbackRate=+e.target.value/100;
    $('speedVal').textContent=(+e.target.value/100).toFixed(2).replace(/\.?0+$/,'')+'×';
  });
  $('exportGifBtn').onclick=()=>showToast('Add gif.js library for full GIF export');
  $('exportMp4Btn').onclick=()=>showToast('MediaRecorder API needed for MP4 export');
}
function onVideoTimeUpdate() {
  const vel=$('videoEl');
  const pct=vel.currentTime/vel.duration*100;
  $('timelineFill').style.width=pct+'%';
  $('playhead').style.left=pct+'%';
  $('videoTime').textContent=fmt(vel.currentTime);
  $('videoDuration').textContent=fmt(vel.duration);
  renderVideoFrame();
}
function fmt(t) { const m=Math.floor(t/60),s=Math.floor(t%60); return `${m}:${s.toString().padStart(2,'0')}`; }

// ── SHORTCUTS MODAL ───────────────────────────────────────
$('shortcutsBtn').onclick = () => $('shortcutsModal').classList.toggle('hidden');
$('closeShortcuts').onclick = () => $('shortcutsModal').classList.add('hidden');

// ── KEYBOARD SHORTCUTS ────────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  const ctrl = e.ctrlKey || e.metaKey;

  if (ctrl && e.key==='z') { e.preventDefault(); $('undoBtn').click(); }
  if (ctrl && (e.key==='y'||(e.shiftKey&&e.key==='Z'))) { e.preventDefault(); $('redoBtn').click(); }
  if (ctrl && e.key==='d') { e.preventDefault(); $('dupSelBtn').click(); }
  if (ctrl && e.key==='c' && S.selectedObj===null) { copyToClipboard(); }
  if ((e.key==='Delete'||e.key==='Backspace') && S.selectedObj) $('deleteSelBtn').click();
  if (e.key==='Escape') { S.selectedObj=null; updateFloatBar(); renderAll(); }
  if (e.key==='='||e.key==='+') $('zoomInBtn').click();
  if (e.key==='-') $('zoomOutBtn').click();
  if (e.key==='0') fitZoom();

  // tool shortcuts
  const toolMap = { s:'select', p:'pen', t:'text', b:'blur', a:'arrow', e:'emoji', h:'highlighter', r:'rect', c:'circle' };
  if (!ctrl && toolMap[e.key.toLowerCase()]) {
    const btn = document.querySelector(`[data-tool="${toolMap[e.key.toLowerCase()]}"]`);
    if (btn) btn.click();
  }
});

// ── TOAST ─────────────────────────────────────────────────
function showToast(msg, ms=2400) {
  const t=$('toast');
  t.textContent=msg; t.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t=setTimeout(()=>t.classList.add('hidden'), ms);
}

console.log('%ceditr v2 ready ✓','color:#FF3B57;font-weight:bold;font-size:13px');
