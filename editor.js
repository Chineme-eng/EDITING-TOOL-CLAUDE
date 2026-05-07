/* ============================================
   EDITR — EDITOR ENGINE
   ============================================ */

'use strict';

// ─── STATE ────────────────────────────────────────────────
const state = {
  tool: 'select',
  color: '#FF3B57',
  strokeSize: 3,
  opacity: 1,
  fontSize: 24,
  bold: false,
  italic: false,
  textBg: false,
  blurIntensity: 10,
  blurMode: 'gaussian',
  selectedEmoji: '👍',
  counterNum: 1,
  isVideo: false,

  // drawing state
  isDrawing: false,
  startX: 0, startY: 0,

  // objects list [{type, ...data}]
  objects: [],
  selectedObj: null,
  dragging: false,
  dragOffX: 0, dragOffY: 0,

  // undo/redo
  history: [],
  historyIndex: -1,

  // image adjustments
  brightness: 0, contrast: 0, saturation: 0,
  rotation: 0,
  flipH: false, flipV: false,

  // source image
  sourceImage: null,
  videoEl: null,
};

// ─── DOM REFS ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const landing     = $('landing');
const editorEl    = $('editor');
const fileInput   = $('fileInput');
const uploadZone  = $('uploadZone');
const mainCanvas  = $('mainCanvas');
const overlayCanvas = $('overlayCanvas');
const ctx         = mainCanvas.getContext('2d');
const octx        = overlayCanvas.getContext('2d');
const fileName    = $('fileName');
const toast       = $('toast');
const floatBar    = $('floatToolbar');
const videoEl     = $('videoEl');
const videoControls = $('videoControls');

// ─── INIT ─────────────────────────────────────────────────
uploadZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => handleFile(e.target.files[0]));

uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

// ─── FILE HANDLING ────────────────────────────────────────
function handleFile(file) {
  if (!file) return;
  fileName.textContent = file.name;
  const isVideo = file.type.startsWith('video/');
  state.isVideo = isVideo;

  if (isVideo) loadVideo(file);
  else loadImage(file);

  landing.classList.remove('active');
  editorEl.style.display = 'flex';
  if (isVideo) {
    $('videoExportGroup').classList.remove('hidden');
    videoControls.style.display = 'flex';
  }
}

function loadImage(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.sourceImage = img;
    state.objects = [];
    state.history = [];
    state.historyIndex = -1;
    state.rotation = 0; state.flipH = false; state.flipV = false;
    state.brightness = 0; state.contrast = 0; state.saturation = 0;
    resizeCanvases(img.width, img.height);
    renderAll();
    saveHistory();
  };
  img.src = url;
}

function loadVideo(file) {
  const url = URL.createObjectURL(file);
  videoEl.src = url;
  videoEl.style.display = 'none';
  videoEl.addEventListener('loadedmetadata', () => {
    resizeCanvases(videoEl.videoWidth, videoEl.videoHeight);
    videoEl.currentTime = 0;
  });
  videoEl.addEventListener('seeked', renderVideoFrame);
  videoEl.addEventListener('timeupdate', onVideoTimeUpdate);
  setupVideoControls();
}

function resizeCanvases(w, h) {
  const area = document.querySelector('.canvas-area');
  const maxW = area.clientWidth - 40;
  const maxH = area.clientHeight - 80;
  const scale = Math.min(1, maxW / w, maxH / h);
  const dw = Math.round(w * scale);
  const dh = Math.round(h * scale);

  [mainCanvas, overlayCanvas].forEach(c => {
    c.width = w; c.height = h;
    c.style.width = dw + 'px';
    c.style.height = dh + 'px';
  });
  const container = document.querySelector('.canvas-container');
  container.style.width = dw + 'px';
  container.style.height = dh + 'px';
}

// ─── RENDER ───────────────────────────────────────────────
function renderAll() {
  const w = mainCanvas.width, h = mainCanvas.height;
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // transform
  ctx.translate(w/2, h/2);
  ctx.rotate(state.rotation * Math.PI/180);
  ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
  ctx.translate(-w/2, -h/2);

  // draw source
  if (state.sourceImage) {
    ctx.filter = buildFilter();
    ctx.drawImage(state.sourceImage, 0, 0, w, h);
    ctx.filter = 'none';
  }
  ctx.restore();

  // draw objects
  state.objects.forEach(obj => drawObject(ctx, obj));
}

function buildFilter() {
  const b = 100 + state.brightness;
  const c = ((state.contrast + 100) / 100).toFixed(2);
  const s = ((state.saturation + 100) / 100).toFixed(2);
  return `brightness(${b}%) contrast(${c}) saturate(${s})`;
}

function renderVideoFrame() {
  if (!state.isVideo) return;
  const w = mainCanvas.width, h = mainCanvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(videoEl, 0, 0, w, h);
  state.objects.forEach(obj => drawObject(ctx, obj));
}

// ─── DRAW OBJECT ──────────────────────────────────────────
function drawObject(c, obj) {
  c.save();
  c.globalAlpha = obj.opacity ?? 1;

  switch(obj.type) {
    case 'pen':
    case 'highlighter':
      drawPath(c, obj); break;
    case 'rect': drawRect(c, obj); break;
    case 'circle': drawCircle(c, obj); break;
    case 'line': drawLine(c, obj); break;
    case 'arrow': drawArrow(c, obj); break;
    case 'text': drawText(c, obj); break;
    case 'blur': drawBlur(c, obj); break;
    case 'callout': drawCallout(c, obj); break;
    case 'emoji': drawEmoji(c, obj); break;
    case 'counter': drawCounter(c, obj); break;
  }

  // selection indicator
  if (obj === state.selectedObj) {
    c.globalAlpha = 1;
    const b = getBounds(obj);
    if (b) {
      c.strokeStyle = '#00C7FF';
      c.lineWidth = 1.5;
      c.setLineDash([5,4]);
      c.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
      c.setLineDash([]);
    }
  }

  c.restore();
}

function drawPath(c, obj) {
  if (!obj.points || obj.points.length < 2) return;
  c.beginPath();
  c.moveTo(obj.points[0].x, obj.points[0].y);
  for (let i = 1; i < obj.points.length; i++) {
    c.lineTo(obj.points[i].x, obj.points[i].y);
  }
  c.strokeStyle = obj.color;
  c.lineWidth = obj.size;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  if (obj.type === 'highlighter') {
    c.globalAlpha = 0.35;
    c.lineWidth = obj.size * 5;
  }
  c.stroke();
}

function drawRect(c, obj) {
  c.strokeStyle = obj.color;
  c.lineWidth = obj.size;
  c.strokeRect(obj.x, obj.y, obj.w, obj.h);
}

function drawCircle(c, obj) {
  c.beginPath();
  c.ellipse(obj.x + obj.w/2, obj.y + obj.h/2, Math.abs(obj.w/2), Math.abs(obj.h/2), 0, 0, Math.PI*2);
  c.strokeStyle = obj.color;
  c.lineWidth = obj.size;
  c.stroke();
}

function drawLine(c, obj) {
  c.beginPath();
  c.moveTo(obj.x1, obj.y1);
  c.lineTo(obj.x2, obj.y2);
  c.strokeStyle = obj.color;
  c.lineWidth = obj.size;
  c.lineCap = 'round';
  c.stroke();
}

function drawArrow(c, obj) {
  const dx = obj.x2 - obj.x1, dy = obj.y2 - obj.y1;
  const angle = Math.atan2(dy, dx);
  const headLen = Math.max(14, obj.size * 4);

  c.beginPath();
  c.moveTo(obj.x1, obj.y1);
  c.lineTo(obj.x2, obj.y2);
  c.strokeStyle = obj.color;
  c.lineWidth = obj.size;
  c.lineCap = 'round';
  c.stroke();

  // arrowhead
  c.beginPath();
  c.moveTo(obj.x2, obj.y2);
  c.lineTo(obj.x2 - headLen * Math.cos(angle - Math.PI/6), obj.y2 - headLen * Math.sin(angle - Math.PI/6));
  c.lineTo(obj.x2 - headLen * Math.cos(angle + Math.PI/6), obj.y2 - headLen * Math.sin(angle + Math.PI/6));
  c.closePath();
  c.fillStyle = obj.color;
  c.fill();
}

function drawText(c, obj) {
  const weight = obj.bold ? 'bold' : 'normal';
  const style  = obj.italic ? 'italic' : 'normal';
  c.font = `${style} ${weight} ${obj.fontSize}px Syne, sans-serif`;
  if (obj.textBg) {
    const m = c.measureText(obj.text);
    const pad = 6;
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(obj.x - pad, obj.y - obj.fontSize - pad, m.width + pad*2, obj.fontSize + pad*2);
  }
  c.fillStyle = obj.color;
  c.fillText(obj.text, obj.x, obj.y);
}

function drawBlur(c, obj) {
  if (obj.w === 0 || obj.h === 0) return;
  const x = Math.min(obj.x, obj.x + obj.w);
  const y = Math.min(obj.y, obj.y + obj.h);
  const w = Math.abs(obj.w);
  const h = Math.abs(obj.h);
  if (state.blurMode === 'pixelate') {
    // pixelate by downsampling
    const off = document.createElement('canvas');
    const pxSize = Math.max(4, state.blurIntensity);
    off.width = Math.max(1, Math.round(w / pxSize));
    off.height = Math.max(1, Math.round(h / pxSize));
    const oc = off.getContext('2d');
    oc.imageSmoothingEnabled = false;
    oc.drawImage(mainCanvas, x, y, w, h, 0, 0, off.width, off.height);
    c.imageSmoothingEnabled = false;
    c.drawImage(off, 0, 0, off.width, off.height, x, y, w, h);
    c.imageSmoothingEnabled = true;
  } else {
    c.save();
    c.filter = `blur(${obj.blurIntensity || 10}px)`;
    c.drawImage(mainCanvas, x, y, w, h, x, y, w, h);
    c.restore();
  }
}

function drawCallout(c, obj) {
  const x = obj.x, y = obj.y, w = obj.w || 160, h = obj.h || 80;
  const r = 12;
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + 40, y + h);
  c.lineTo(x + 20, y + h + 20);
  c.lineTo(x + 30, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
  c.fillStyle = obj.color;
  c.globalAlpha = 0.85;
  c.fill();
  c.globalAlpha = 1;
  if (obj.text) {
    c.fillStyle = '#fff';
    c.font = '14px Syne, sans-serif';
    c.fillText(obj.text, x + 12, y + h/2 + 5);
  }
}

function drawEmoji(c, obj) {
  c.font = `${obj.size * 6}px serif`;
  c.fillText(obj.emoji, obj.x, obj.y);
}

function drawCounter(c, obj) {
  const r = obj.size * 4;
  c.beginPath();
  c.arc(obj.x, obj.y, r, 0, Math.PI*2);
  c.fillStyle = obj.color;
  c.fill();
  c.fillStyle = '#fff';
  c.font = `bold ${r * 1.1}px Space Mono, monospace`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(String(obj.num), obj.x, obj.y);
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
}

// ─── BOUNDS (for selection) ───────────────────────────────
function getBounds(obj) {
  switch(obj.type) {
    case 'rect': case 'circle': case 'blur': case 'callout':
      return { x: Math.min(obj.x, obj.x+obj.w), y: Math.min(obj.y, obj.y+obj.h), w: Math.abs(obj.w), h: Math.abs(obj.h) };
    case 'line': case 'arrow':
      return { x: Math.min(obj.x1,obj.x2), y: Math.min(obj.y1,obj.y2), w: Math.abs(obj.x2-obj.x1)||20, h: Math.abs(obj.y2-obj.y1)||20 };
    case 'text': {
      ctx.font = `${obj.fontSize}px Syne, sans-serif`;
      const m = ctx.measureText(obj.text || '');
      return { x: obj.x, y: obj.y - obj.fontSize, w: m.width || 60, h: obj.fontSize + 10 };
    }
    case 'emoji':
      return { x: obj.x - 10, y: obj.y - obj.size*6, w: obj.size*6 + 10, h: obj.size*6 + 10 };
    case 'counter':
      const r = obj.size * 4;
      return { x: obj.x-r, y: obj.y-r, w: r*2, h: r*2 };
    case 'pen': case 'highlighter':
      if (!obj.points?.length) return null;
      const xs = obj.points.map(p=>p.x), ys = obj.points.map(p=>p.y);
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs)-Math.min(...xs)||20, h: Math.max(...ys)-Math.min(...ys)||20 };
    default: return null;
  }
}

function hitTest(obj, px, py) {
  const b = getBounds(obj);
  if (!b) return false;
  return px >= b.x - 8 && px <= b.x + b.w + 8 && py >= b.y - 8 && py <= b.y + b.h + 8;
}

// ─── CANVAS COORDS ────────────────────────────────────────
function getCanvasPos(e) {
  const rect = overlayCanvas.getBoundingClientRect();
  const scaleX = mainCanvas.width / rect.width;
  const scaleY = mainCanvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

// ─── POINTER EVENTS ───────────────────────────────────────
overlayCanvas.addEventListener('mousedown', onPointerDown);
overlayCanvas.addEventListener('mousemove', onPointerMove);
overlayCanvas.addEventListener('mouseup',   onPointerUp);
overlayCanvas.addEventListener('mouseleave', onPointerUp);
overlayCanvas.addEventListener('touchstart', e => { e.preventDefault(); onPointerDown(e); }, { passive: false });
overlayCanvas.addEventListener('touchmove',  e => { e.preventDefault(); onPointerMove(e); }, { passive: false });
overlayCanvas.addEventListener('touchend',   e => { e.preventDefault(); onPointerUp(e); }, { passive: false });

let currentPenObj = null;

function onPointerDown(e) {
  const { x, y } = getCanvasPos(e);
  state.startX = x; state.startY = y;
  state.isDrawing = true;
  octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  const tool = state.tool;

  if (tool === 'select') {
    // hit test in reverse
    let hit = null;
    for (let i = state.objects.length - 1; i >= 0; i--) {
      if (hitTest(state.objects[i], x, y)) { hit = state.objects[i]; break; }
    }
    state.selectedObj = hit;
    if (hit) {
      const b = getBounds(hit);
      state.dragging = true;
      state.dragOffX = b ? x - b.x : x - (hit.x||hit.x1||0);
      state.dragOffY = b ? y - b.y : y - (hit.y||hit.y1||0);
    }
    updateFloatBar();
    renderAll();
    return;
  }

  if (tool === 'eraser') {
    eraseAt(x, y); return;
  }

  if (tool === 'text') {
    const text = prompt('Enter text:');
    if (!text) return;
    pushObj({ type:'text', x, y, text, color: state.color, fontSize: state.fontSize, bold: state.bold, italic: state.italic, textBg: state.textBg, opacity: state.opacity });
    return;
  }

  if (tool === 'emoji') {
    pushObj({ type:'emoji', x, y, emoji: state.selectedEmoji, size: state.strokeSize, opacity: state.opacity });
    return;
  }

  if (tool === 'counter') {
    pushObj({ type:'counter', x, y, num: state.counterNum, color: state.color, size: Math.max(3, state.strokeSize), opacity: state.opacity });
    state.counterNum++;
    return;
  }

  if (tool === 'callout') {
    const text = prompt('Callout text:');
    pushObj({ type:'callout', x, y, w:160, h:70, text: text||'', color: state.color, opacity: state.opacity });
    return;
  }

  if (tool === 'pen' || tool === 'highlighter') {
    currentPenObj = { type: tool, points: [{x,y}], color: state.color, size: state.strokeSize, opacity: state.opacity };
    return;
  }

  if (tool === 'crop') {
    openCropModal(); state.isDrawing = false; return;
  }
}

function onPointerMove(e) {
  const { x, y } = getCanvasPos(e);

  if (state.tool === 'select' && state.dragging && state.selectedObj) {
    moveObject(state.selectedObj, x, y);
    renderAll();
    return;
  }

  if (!state.isDrawing) return;

  const tool = state.tool;
  octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  if (tool === 'eraser') { eraseAt(x, y); return; }

  if (tool === 'pen' || tool === 'highlighter') {
    if (!currentPenObj) return;
    currentPenObj.points.push({x, y});
    drawObject(octx, currentPenObj);
    return;
  }

  // preview shapes
  const sx = state.startX, sy = state.startY;
  const previewObj = buildShapeObj(tool, sx, sy, x, y);
  if (previewObj) drawObject(octx, previewObj);
}

function onPointerUp(e) {
  if (!state.isDrawing && !state.dragging) return;

  const pos = e.type === 'mouseleave' ? null : getCanvasPos(e);
  const { x, y } = pos || { x: state.startX, y: state.startY };

  if (state.tool === 'select') {
    state.dragging = false;
    if (state.selectedObj) saveHistory();
    renderAll();
    return;
  }

  if (state.isDrawing) {
    const tool = state.tool;
    let obj = null;

    if (tool === 'pen' || tool === 'highlighter') {
      obj = currentPenObj;
      currentPenObj = null;
    } else {
      obj = buildShapeObj(tool, state.startX, state.startY, x, y);
    }

    if (obj) pushObj(obj);
    octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }

  state.isDrawing = false;
  state.dragging = false;
}

function buildShapeObj(tool, sx, sy, ex, ey) {
  const base = { color: state.color, size: state.strokeSize, opacity: state.opacity };
  switch(tool) {
    case 'rect':   return { ...base, type:'rect',   x:sx, y:sy, w:ex-sx, h:ey-sy };
    case 'circle': return { ...base, type:'circle', x:sx, y:sy, w:ex-sx, h:ey-sy };
    case 'line':   return { ...base, type:'line',   x1:sx, y1:sy, x2:ex, y2:ey };
    case 'arrow':  return { ...base, type:'arrow',  x1:sx, y1:sy, x2:ex, y2:ey };
    case 'blur':   return { ...base, type:'blur',   x:sx, y:sy, w:ex-sx, h:ey-sy, blurIntensity: state.blurIntensity };
    default: return null;
  }
}

function moveObject(obj, x, y) {
  const b = getBounds(obj);
  if (!b) return;
  const dx = x - b.x - state.dragOffX + (b.x - (obj.x||obj.x1||0));
  const dy = y - b.y - state.dragOffY + (b.y - (obj.y||obj.y1||0));
  if ('x' in obj && 'y' in obj) { obj.x += dx; obj.y += dy; }
  if ('x1' in obj) { obj.x1 += dx; obj.x2 += dx; obj.y1 += dy; obj.y2 += dy; }
  if (obj.points) obj.points = obj.points.map(p => ({x: p.x + dx, y: p.y + dy}));
  state.dragOffX = x - b.x - (b.x - (obj.x||obj.x1||0));
  state.dragOffY = y - b.y - (b.y - (obj.y||obj.y1||0));
}

// ─── OBJECT MANAGEMENT ───────────────────────────────────
function pushObj(obj) {
  state.objects.push(obj);
  state.selectedObj = null;
  renderAll();
  saveHistory();
}

function eraseAt(x, y) {
  state.objects = state.objects.filter(obj => !hitTest(obj, x, y));
  renderAll();
}

function updateFloatBar() {
  if (state.selectedObj) floatBar.classList.remove('hidden');
  else floatBar.classList.add('hidden');
}

$('deleteSelected').onclick = () => {
  if (!state.selectedObj) return;
  state.objects = state.objects.filter(o => o !== state.selectedObj);
  state.selectedObj = null;
  updateFloatBar();
  renderAll();
  saveHistory();
};
$('bringFront').onclick = () => {
  if (!state.selectedObj) return;
  const i = state.objects.indexOf(state.selectedObj);
  if (i < state.objects.length - 1) {
    state.objects.splice(i, 1);
    state.objects.push(state.selectedObj);
    renderAll(); saveHistory();
  }
};
$('sendBack').onclick = () => {
  if (!state.selectedObj) return;
  const i = state.objects.indexOf(state.selectedObj);
  if (i > 0) {
    state.objects.splice(i, 1);
    state.objects.unshift(state.selectedObj);
    renderAll(); saveHistory();
  }
};
$('duplicateSelected').onclick = () => {
  if (!state.selectedObj) return;
  const copy = JSON.parse(JSON.stringify(state.selectedObj));
  if ('x' in copy) { copy.x += 20; copy.y += 20; }
  if ('x1' in copy) { copy.x1 += 20; copy.x2 += 20; copy.y1 += 20; copy.y2 += 20; }
  state.objects.push(copy);
  state.selectedObj = copy;
  renderAll(); saveHistory();
};

// ─── HISTORY ──────────────────────────────────────────────
function saveHistory() {
  const snap = JSON.stringify({
    objects: state.objects,
    rotation: state.rotation,
    flipH: state.flipH, flipV: state.flipV,
    brightness: state.brightness, contrast: state.contrast, saturation: state.saturation,
  });
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snap);
  state.historyIndex = state.history.length - 1;
}

function undo() {
  if (state.historyIndex <= 0) return;
  state.historyIndex--;
  restoreHistory();
}
function redo() {
  if (state.historyIndex >= state.history.length - 1) return;
  state.historyIndex++;
  restoreHistory();
}
function restoreHistory() {
  const snap = JSON.parse(state.history[state.historyIndex]);
  Object.assign(state, snap);
  $('brightness').value = state.brightness;
  $('contrast').value = state.contrast;
  $('saturation').value = state.saturation;
  renderAll();
}

$('undoBtn').onclick = undo;
$('redoBtn').onclick = redo;
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (state.selectedObj && document.activeElement === document.body) {
      $('deleteSelected').click();
    }
  }
});

// ─── TOOL BUTTONS ─────────────────────────────────────────
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.tool = btn.dataset.tool;
    state.selectedObj = null;
    updateFloatBar();
    updateOptionsPanel();
    renderAll();
  });
});

function updateOptionsPanel() {
  const tool = state.tool;
  $('textGroup').classList.toggle('hidden', tool !== 'text');
  $('blurGroup').classList.toggle('hidden', tool !== 'blur');
  $('emojiGroup').classList.toggle('hidden', tool !== 'emoji');
}

// ─── COLOR ────────────────────────────────────────────────
document.querySelectorAll('.color-swatch').forEach(sw => {
  sw.addEventListener('click', () => {
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    state.color = sw.dataset.color;
    $('customColor').value = state.color;
  });
});

$('customColor').addEventListener('input', e => {
  state.color = e.target.value;
  document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
});

// ─── SLIDERS ──────────────────────────────────────────────
$('strokeSize').addEventListener('input', e => {
  state.strokeSize = +e.target.value;
  $('strokeSizeVal').textContent = state.strokeSize + 'px';
});
$('opacitySlider').addEventListener('input', e => {
  state.opacity = +e.target.value / 100;
  $('opacityVal').textContent = e.target.value + '%';
});
$('fontSize').addEventListener('input', e => {
  state.fontSize = +e.target.value;
  $('fontSizeVal').textContent = state.fontSize + 'px';
});
$('blurIntensity').addEventListener('input', e => {
  state.blurIntensity = +e.target.value;
  $('blurVal').textContent = state.blurIntensity;
});

// ─── TEXT OPTIONS ─────────────────────────────────────────
$('boldBtn').onclick   = () => { state.bold = !state.bold; $('boldBtn').classList.toggle('active', state.bold); };
$('italicBtn').onclick = () => { state.italic = !state.italic; $('italicBtn').classList.toggle('active', state.italic); };
$('bgTextBtn').onclick = () => { state.textBg = !state.textBg; $('bgTextBtn').classList.toggle('active', state.textBg); };

// ─── BLUR MODE ────────────────────────────────────────────
$('pixelateBtn').onclick  = () => { state.blurMode = 'pixelate'; };
$('gaussianBtn').onclick  = () => { state.blurMode = 'gaussian'; };

// ─── EMOJI ────────────────────────────────────────────────
document.querySelectorAll('.emoji-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    state.selectedEmoji = btn.dataset.emoji;
  });
});

// ─── IMAGE ADJUSTMENTS ───────────────────────────────────
['brightness','contrast','saturation'].forEach(prop => {
  $(prop).addEventListener('input', e => {
    state[prop] = +e.target.value;
    renderAll();
  });
});
$('resetAdjustBtn').onclick = () => {
  state.brightness = state.contrast = state.saturation = 0;
  ['brightness','contrast','saturation'].forEach(p => $(p).value = 0);
  renderAll();
  saveHistory();
};

// ─── TRANSFORM ───────────────────────────────────────────
$('rotateLeftBtn').onclick  = () => { state.rotation = (state.rotation - 90 + 360) % 360; renderAll(); saveHistory(); };
$('rotateRightBtn').onclick = () => { state.rotation = (state.rotation + 90) % 360; renderAll(); saveHistory(); };
$('flipHBtn').onclick = () => { state.flipH = !state.flipH; renderAll(); saveHistory(); };
$('flipVBtn').onclick = () => { state.flipV = !state.flipV; renderAll(); saveHistory(); };

// ─── DOWNLOAD ─────────────────────────────────────────────
function flattenToCanvas() {
  // Create a final merged canvas
  const out = document.createElement('canvas');
  out.width = mainCanvas.width;
  out.height = mainCanvas.height;
  const oc = out.getContext('2d');
  oc.drawImage(mainCanvas, 0, 0);
  return out;
}

document.querySelectorAll('[data-format]').forEach(btn => {
  btn.addEventListener('click', () => downloadImage(btn.dataset.format));
});

$('downloadBtn').onclick = () => downloadImage('png');

function downloadImage(format) {
  const out = flattenToCanvas();
  const mime = format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const quality = format === 'jpg' ? 0.92 : undefined;
  out.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const base = fileName.textContent.replace(/\.[^.]+$/, '');
    a.download = `${base}_edited.${format}`;
    a.click();
    showToast(`Downloaded as ${format.toUpperCase()} ✓`);
  }, mime, quality);
}

// ─── VIDEO CONTROLS ───────────────────────────────────────
function setupVideoControls() {
  const playBtn = $('playPauseBtn');
  playBtn.onclick = () => {
    if (videoEl.paused) { videoEl.play(); playBtn.textContent = '⏸'; }
    else { videoEl.pause(); playBtn.textContent = '▶'; }
  };
  $('timelineBar').addEventListener('click', e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    videoEl.currentTime = pct * videoEl.duration;
  });
}

function onVideoTimeUpdate() {
  const pct = videoEl.currentTime / videoEl.duration * 100;
  $('timelineFill').style.width = pct + '%';
  $('playhead').style.left = pct + '%';
  $('videoTime').textContent = fmtTime(videoEl.currentTime) + ' / ' + fmtTime(videoEl.duration);
  renderVideoFrame();
}

function fmtTime(t) {
  const m = Math.floor(t/60), s = Math.floor(t%60);
  return `${m}:${s.toString().padStart(2,'0')}`;
}

$('exportGifBtn') && ($('exportGifBtn').onclick = () => showToast('GIF export: use a library like gif.js for full support'));
$('exportMp4Btn') && ($('exportMp4Btn').onclick = () => showToast('MP4 export: use MediaRecorder API for full support'));

// ─── CROP MODAL ───────────────────────────────────────────
let cropState = {};
function openCropModal() {
  if (!state.sourceImage) return;
  const modal = $('cropModal');
  const cc = $('cropCanvas');
  modal.classList.remove('hidden');
  const maxW = window.innerWidth * 0.8;
  const maxH = window.innerHeight * 0.7;
  const scale = Math.min(1, maxW / mainCanvas.width, maxH / mainCanvas.height);
  cc.width = mainCanvas.width * scale;
  cc.height = mainCanvas.height * scale;
  const cctx = cc.getContext('2d');
  cctx.drawImage(mainCanvas, 0, 0, cc.width, cc.height);

  cropState = { scale, startX:0, startY:0, w:cc.width, h:cc.height, drawing:false };

  cc.onmousedown = e => {
    const r = cc.getBoundingClientRect();
    cropState.startX = e.clientX - r.left;
    cropState.startY = e.clientY - r.top;
    cropState.w = 0; cropState.h = 0;
    cropState.drawing = true;
  };
  cc.onmousemove = e => {
    if (!cropState.drawing) return;
    const r = cc.getBoundingClientRect();
    cropState.w = (e.clientX - r.left) - cropState.startX;
    cropState.h = (e.clientY - r.top) - cropState.startY;
    cctx.clearRect(0,0,cc.width,cc.height);
    cctx.drawImage(mainCanvas, 0, 0, cc.width, cc.height);
    cctx.strokeStyle = '#00C7FF'; cctx.lineWidth = 2; cctx.setLineDash([5,4]);
    cctx.strokeRect(cropState.startX, cropState.startY, cropState.w, cropState.h);
    cctx.fillStyle = 'rgba(0,199,255,0.08)';
    cctx.fillRect(cropState.startX, cropState.startY, cropState.w, cropState.h);
    cctx.setLineDash([]);
  };
  cc.onmouseup = () => { cropState.drawing = false; };
}

$('cancelCrop').onclick = () => $('cropModal').classList.add('hidden');
$('applyCrop').onclick = () => {
  if (!cropState.w || !cropState.h) { $('cropModal').classList.add('hidden'); return; }
  const s = cropState.scale;
  const sx = cropState.startX / s, sy = cropState.startY / s;
  const sw = cropState.w / s, sh = cropState.h / s;
  const off = document.createElement('canvas');
  off.width = Math.abs(sw); off.height = Math.abs(sh);
  const oc = off.getContext('2d');
  oc.drawImage(mainCanvas, Math.min(sx,sx+sw), Math.min(sy,sy+sh), Math.abs(sw), Math.abs(sh), 0, 0, off.width, off.height);
  // replace source image
  const newImg = new Image();
  newImg.onload = () => {
    state.sourceImage = newImg;
    state.objects = [];
    resizeCanvases(newImg.width, newImg.height);
    renderAll(); saveHistory();
  };
  newImg.src = off.toDataURL();
  $('cropModal').classList.add('hidden');
};

// ─── BACK BUTTON ─────────────────────────────────────────
$('backBtn').onclick = () => {
  if (!confirm('Go back? Unsaved changes will be lost.')) return;
  editorEl.style.display = 'none';
  landing.classList.add('active');
  state.objects = []; state.history = []; state.historyIndex = -1;
  state.sourceImage = null; state.isVideo = false; state.counterNum = 1;
  videoEl.pause(); videoEl.src = '';
  videoControls.style.display = 'none';
  $('videoExportGroup').classList.add('hidden');
  fileInput.value = '';
};

// ─── TOAST ───────────────────────────────────────────────
function showToast(msg, duration = 2500) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add('hidden'), duration);
}

// ─── PASTE FROM CLIPBOARD ─────────────────────────────────
document.addEventListener('paste', async e => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) { handleFile(file); showToast('Pasted from clipboard ✓'); }
    }
  }
});

console.log('%c editr loaded ✓', 'color:#FF3B57;font-weight:bold;font-size:14px');
