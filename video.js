'use strict';
/* EDITR VIDEO v3 — drag clips, blur regions, clip snapping, gap indicators,
   freeze frame, sound effects, text animations, animated GIF, trash zone,
   auto subtitles, waveform visualizer */

// ── EMOJI DATA ─────────────────────────────────────────────
const EMOJIS = {
  reactions: ['👍','👎','❤️','🔥','⭐','✅','❌','⚠️','💡','🎯','🚀','👀','💬','💯','🙌','👏','🤔','😮','💪','🎉','🏆','✨','💎','📌','📍'],
  symbols:   ['🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🔶','🔷','🔸','🔹','▶️','🔺','🔻','💠','🔘'],
  arrows:    ['➡️','⬅️','⬆️','⬇️','↗️','↙️','↖️','↘️','↕️','↔️','🔄','🔃','↩️','↪️','⤴️','⤵️','🔙','🔚','🔛','🔜','🔝'],
  objects:   ['💡','🔦','📸','🎥','🖥️','💻','📱','⌨️','📊','📈','📋','📝','✏️','🖊️','🔗','🔒','🔓','🔑','🎵','🎶'],
  faces:     ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😋','😛','😜','🤪','🤔','😐','😶','😏','😒','🙄','😬','😮','😲','😳','🥺','😢','😭','😱','😤','😡'],
};
const COLORS = ['#ffffff','#FF3B57','#FF9500','#FFD60A','#34C759','#00C7FF','#0A84FF','#BF5AF2','#000000'];
const CLIP_COLORS = ['#0A84FF','#34C759','#FF9500','#BF5AF2','#FF3B57','#00C7BE','#FFD60A'];

// ── SOUND EFFECTS (generated via Web Audio API) ────────────
const SFX = [
  { name:'Whoosh',    fn: ctx => { const o=ctx.createOscillator(),g=ctx.createGain(); o.type='sawtooth'; o.frequency.setValueAtTime(800,ctx.currentTime); o.frequency.exponentialRampToValueAtTime(200,ctx.currentTime+0.3); g.gain.setValueAtTime(0.3,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3); o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime+0.3); } },
  { name:'Ding',      fn: ctx => { const o=ctx.createOscillator(),g=ctx.createGain(); o.type='sine'; o.frequency.value=880; g.gain.setValueAtTime(0.4,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.8); o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime+0.8); } },
  { name:'Pop',       fn: ctx => { const o=ctx.createOscillator(),g=ctx.createGain(); o.type='sine'; o.frequency.setValueAtTime(400,ctx.currentTime); o.frequency.exponentialRampToValueAtTime(100,ctx.currentTime+0.1); g.gain.setValueAtTime(0.5,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.1); o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime+0.1); } },
  { name:'Click',     fn: ctx => { const b=ctx.createOscillator(),g=ctx.createGain(); b.type='square'; b.frequency.value=1200; g.gain.setValueAtTime(0.3,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.05); b.connect(g); g.connect(ctx.destination); b.start(); b.stop(ctx.currentTime+0.05); } },
  { name:'Swoosh',    fn: ctx => { const b=ctx.createBufferSource(),g=ctx.createGain(),buf=ctx.createBuffer(1,ctx.sampleRate*0.4,ctx.sampleRate),d=buf.getChannelData(0); for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length); b.buffer=buf; const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=2000; g.gain.setValueAtTime(0.3,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.4); b.connect(f); f.connect(g); g.connect(ctx.destination); b.start(); } },
  { name:'Applause',  fn: ctx => { for(let i=0;i<8;i++){const b=ctx.createBufferSource(),g=ctx.createGain(),buf=ctx.createBuffer(1,ctx.sampleRate*0.1,ctx.sampleRate),d=buf.getChannelData(0); for(let j=0;j<d.length;j++)d[j]=Math.random()*2-1; b.buffer=buf; g.gain.setValueAtTime(0.15,ctx.currentTime+i*0.06); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+i*0.06+0.1); b.connect(g); g.connect(ctx.destination); b.start(ctx.currentTime+i*0.06);} } },
  { name:'Beep',      fn: ctx => { const o=ctx.createOscillator(),g=ctx.createGain(); o.type='square'; o.frequency.value=440; g.gain.setValueAtTime(0.2,ctx.currentTime); g.gain.setValueAtTime(0.2,ctx.currentTime+0.1); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.15); o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime+0.15); } },
  { name:'Boom',      fn: ctx => { const o=ctx.createOscillator(),g=ctx.createGain(); o.type='sine'; o.frequency.setValueAtTime(150,ctx.currentTime); o.frequency.exponentialRampToValueAtTime(40,ctx.currentTime+0.4); g.gain.setValueAtTime(0.6,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.4); o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime+0.4); } },
  { name:'Chime',     fn: ctx => { [523,659,784].forEach((f,i)=>{const o=ctx.createOscillator(),g=ctx.createGain(); o.type='sine'; o.frequency.value=f; g.gain.setValueAtTime(0.25,ctx.currentTime+i*0.15); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+i*0.15+0.6); o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime+i*0.15); o.stop(ctx.currentTime+i*0.15+0.6);}); } },
  { name:'Glitch',    fn: ctx => { for(let i=0;i<5;i++){const o=ctx.createOscillator(),g=ctx.createGain(); o.type='sawtooth'; o.frequency.value=Math.random()*800+200; g.gain.setValueAtTime(0.2,ctx.currentTime+i*0.04); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+i*0.04+0.04); o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime+i*0.04); o.stop(ctx.currentTime+i*0.04+0.04);} } },
];

// ── DOM ────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const previewCanvas = $('vPreviewCanvas');
const overlayCanvas = $('vOverlayCanvas');
const blurCanvas    = $('vBlurCanvas');
const pctx = previewCanvas.getContext('2d');
const octx = overlayCanvas.getContext('2d');
const bctx = blurCanvas.getContext('2d');
const overlayLayer = $('overlayLayer');
const videoTrack   = $('videoTrack');
const audioTrack   = $('audioTrack');
const overlayTrack = $('overlayTrack');
const tlRuler      = $('tlRuler');
const tlPlayhead   = $('tlPlayhead');
const trashZone    = $('trashZone');

// ── STATE ──────────────────────────────────────────────────
const VS = {
  clips: [], audioTracks: [], overlays: [],
  currentTime: 0, totalDuration: 0,
  playing: false, rafId: null, lastFrameTs: null,
  loopPreview: false,
  selectedClip: null, selectedAudio: null, selectedOverlay: null,
  tlZoom: 3, globalFilter: 'none', aspectRatio: 'source',
  exportQuality: 'medium',
  history: [], historyIndex: -1,
  cancelExport: false,
  selectedEmoji: '👍', newOverlayPos: 'center',
  newOverlayColor: '#ffffff', newOverlaySize: 32, newOverlayAnim: 'none',
  clipIdCounter: 0, audioIdCounter: 0, overlayIdCounter: 0,
  wmImage: null,
  blurRegionActive: false, blurDrawing: false,
  blurStart: {x:0,y:0},
  draggedItem: null, // for trash drop
  sfxAudioCtx: null,
  gifFrameTimers: [],
};

// ── UPLOAD ─────────────────────────────────────────────────
$('vUploadZone').addEventListener('click', () => $('vFileInput').click());
$('vFileInput').addEventListener('change', e => { if (e.target.files[0]) loadVideoFile(e.target.files[0]); });
$('vAddInput').addEventListener('change', e => { if (e.target.files[0]) loadVideoFile(e.target.files[0]); });
$('vAddBtn').addEventListener('click', () => $('vAddInput').click());
$('vUploadZone').addEventListener('dragover', e => { e.preventDefault(); $('vUploadZone').classList.add('drag-over'); });
$('vUploadZone').addEventListener('dragleave', () => $('vUploadZone').classList.remove('drag-over'));
$('vUploadZone').addEventListener('drop', e => {
  e.preventDefault(); $('vUploadZone').classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('video/')) loadVideoFile(f);
});

$('previewArea').addEventListener('dragover', e => e.preventDefault());
$('previewArea').addEventListener('drop', e => {
  e.preventDefault();
  const f = e.dataTransfer.files[0]; if (!f) return;
  if (f.type.startsWith('video/')) loadVideoFile(f);
  else if (f.type.startsWith('image/')) addOverlay({ type: f.type === 'image/gif' ? 'gif' : 'image', src: URL.createObjectURL(f), name: f.name, pos: 'center' });
  else if (f.type.startsWith('audio/')) loadAudioFile(f);
});

// ── TRASH ZONE ─────────────────────────────────────────────
trashZone.addEventListener('dragover', e => { e.preventDefault(); trashZone.classList.add('drag-over'); });
trashZone.addEventListener('dragleave', () => trashZone.classList.remove('drag-over'));
trashZone.addEventListener('drop', e => {
  e.preventDefault(); trashZone.classList.remove('drag-over');
  if (!VS.draggedItem) return;
  const { type, id } = VS.draggedItem;
  if (type === 'clip') {
    const clip = VS.clips.find(c => c.id === id);
    if (clip) { clip.videoEl.pause(); clip.videoEl.remove(); VS.clips = VS.clips.filter(c => c.id !== id); if (VS.selectedClip?.id === id) { VS.selectedClip = null; showProps('none'); } recalcDuration(); renderTimeline(); renderFrame(); saveHistory(); vToast('Clip deleted'); }
  } else if (type === 'overlay') {
    const ov = VS.overlays.find(o => o.id === id);
    if (ov) removeOverlay(ov);
  } else if (type === 'audio') {
    const at = VS.audioTracks.find(a => a.id === id);
    if (at) { at.audioEl.pause(); VS.audioTracks = VS.audioTracks.filter(a => a.id !== id); if (VS.selectedAudio?.id === id) { VS.selectedAudio = null; showProps('none'); } renderTimeline(); saveHistory(); vToast('Audio deleted'); }
  }
  VS.draggedItem = null;
});

// ── LOAD VIDEO ─────────────────────────────────────────────
function loadVideoFile(file) {
  const vel = document.createElement('video');
  vel.preload = 'auto'; vel.crossOrigin = 'anonymous'; vel.muted = false; vel.style.display = 'none';
  document.body.appendChild(vel);
  vel.src = URL.createObjectURL(file);
  vel.addEventListener('loadedmetadata', () => {
    const clip = {
      id: VS.clipIdCounter++, file, videoEl: vel,
      name: file.name.replace(/\.[^.]+$/, ''),
      duration: vel.duration,
      trimStart: 0, trimEnd: vel.duration,
      startTime: VS.clips.reduce((a, c) => a + (c.trimEnd - c.trimStart) / c.speed, 0),
      speed: 1, volume: 1, filter: 'none', transIn: 'none', transOut: 'none',
      color: CLIP_COLORS[VS.clips.length % CLIP_COLORS.length],
    };
    VS.clips.push(clip);
    recalcDuration(); resizePreview(); renderTimeline();
    seekTo(clip.startTime); saveHistory(); showVEditor();
    $('vFileName').textContent = file.name.length > 22 ? file.name.slice(0,19)+'…' : file.name;
    vToast('Loaded: ' + file.name);
  }, { once: true });
  vel.addEventListener('error', () => vToast('Error loading video'));
}

function showVEditor() {
  $('vLanding').classList.remove('active');
  $('vEditor').style.display = 'flex';
  renderSFXPanel();
}

function recalcDuration() {
  VS.totalDuration = VS.clips.reduce((a, c) => a + (c.trimEnd - c.trimStart) / c.speed, 0);
  $('vTotalTime').textContent = fmtTime(VS.totalDuration);
  detectGaps();
}

// ── PREVIEW RESIZE ──────────────────────────────────────────
function resizePreview() {
  if (!VS.clips.length) return;
  const vel = VS.clips[0].videoEl;
  const vw = vel.videoWidth || 1280, vh = vel.videoHeight || 720;
  const area = $('previewArea'), maxW = area.clientWidth - 16, maxH = area.clientHeight - 16;
  let tw = vw, th = vh;
  if (VS.aspectRatio !== 'source') { const [rw,rh] = VS.aspectRatio.split(':').map(Number); th = Math.round(tw*rh/rw); }
  const scale = Math.min(1, maxW/tw, maxH/th);
  const dw = Math.round(tw*scale), dh = Math.round(th*scale);
  [previewCanvas, overlayCanvas, blurCanvas].forEach(c => { c.width = tw; c.height = th; c.style.width = dw+'px'; c.style.height = dh+'px'; });
  overlayLayer.style.width = dw+'px'; overlayLayer.style.height = dh+'px';
  $('previewWrap').style.width = dw+'px'; $('previewWrap').style.height = dh+'px';
}
window.addEventListener('resize', () => { if (VS.clips.length) resizePreview(); });

// ── PLAYBACK ───────────────────────────────────────────────
$('vPlayBtn').addEventListener('click', togglePlay);
function togglePlay() { VS.playing ? pause() : play(); }
function play() {
  if (!VS.clips.length) return;
  VS.playing = true; $('vPlayBtn').textContent = '⏸'; VS.lastFrameTs = null;
  VS.audioTracks.forEach(at => {
    if (VS.currentTime >= at.offset) { at.audioEl.currentTime = VS.currentTime - at.offset; at.audioEl.volume = Math.min(1, at.volume); at.audioEl.loop = at.loop; at.audioEl.play().catch(()=>{}); }
  });
  const clip = getClipAt(VS.currentTime);
  if (clip) { clip.videoEl.currentTime = getLocalTime(clip, VS.currentTime); clip.videoEl.playbackRate = clip.speed; clip.videoEl.volume = $('muteVideoAudio').checked ? 0 : Math.min(1, clip.volume); clip.videoEl.play().catch(()=>{}); }
  VS.rafId = requestAnimationFrame(playLoop);
}
function pause() {
  VS.playing = false; $('vPlayBtn').textContent = '▶';
  if (VS.rafId) cancelAnimationFrame(VS.rafId);
  VS.clips.forEach(c => c.videoEl.pause());
  VS.audioTracks.forEach(at => at.audioEl.pause());
}
function playLoop(ts) {
  if (!VS.playing) return;
  if (VS.lastFrameTs === null) VS.lastFrameTs = ts;
  const elapsed = (ts - VS.lastFrameTs) / 1000; VS.lastFrameTs = ts;
  VS.currentTime = Math.min(VS.totalDuration, VS.currentTime + elapsed);
  if (VS.currentTime >= VS.totalDuration) {
    if (VS.loopPreview) { VS.currentTime = 0; VS.lastFrameTs = null; VS.rafId = requestAnimationFrame(playLoop); return; }
    pause(); renderFrame(); return;
  }
  renderFrame(); updatePlayhead(); $('vCurrentTime').textContent = fmtTime(VS.currentTime);
  VS.rafId = requestAnimationFrame(playLoop);
}
function seekTo(t) {
  VS.currentTime = Math.max(0, Math.min(VS.totalDuration, t));
  $('vCurrentTime').textContent = fmtTime(VS.currentTime);
  updatePlayhead(); renderFrame();
}
function getClipAt(t) { let acc=0; for(const c of VS.clips){const dur=(c.trimEnd-c.trimStart)/c.speed;if(t>=acc&&t<acc+dur)return c;acc+=dur;} return VS.clips.length?VS.clips[VS.clips.length-1]:null; }
function getClipStart(clip) { let acc=0; for(const c of VS.clips){if(c.id===clip.id)return acc;acc+=(c.trimEnd-c.trimStart)/c.speed;} return 0; }
function getLocalTime(clip, gt) { return clip.trimStart+(gt-getClipStart(clip))*clip.speed; }

// ── RENDER FRAME ───────────────────────────────────────────
function renderFrame() {
  const clip = getClipAt(VS.currentTime);
  pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  if (!clip) return;
  if (!VS.playing) { const lt = getLocalTime(clip, VS.currentTime); if (Math.abs(clip.videoEl.currentTime - lt) > 0.08) clip.videoEl.currentTime = lt; }
  pctx.save();
  const f = clip.filter !== 'none' ? clip.filter : VS.globalFilter !== 'none' ? VS.globalFilter : 'none';
  if (f !== 'none') pctx.filter = f;
  // freeze frame: draw from stored imageData
  if (clip.type === 'freeze') {
    if (clip.imageData) { const tmp = document.createElement('canvas'); tmp.width = previewCanvas.width; tmp.height = previewCanvas.height; tmp.getContext('2d').putImageData(clip.imageData, 0, 0); pctx.drawImage(tmp, 0, 0); }
  } else {
    const cs = getClipStart(clip), localT = VS.currentTime - cs, clipDur = (clip.trimEnd - clip.trimStart) / clip.speed, fd = 0.5;
    let alpha = 1;
    if (clip.transIn === 'fade' && localT < fd) alpha = localT / fd;
    if (clip.transOut === 'fade' && localT > clipDur - fd) alpha = (clipDur - localT) / fd;
    pctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    pctx.imageSmoothingEnabled = true; pctx.imageSmoothingQuality = 'high';
    pctx.drawImage(clip.videoEl, 0, 0, previewCanvas.width, previewCanvas.height);
  }
  pctx.filter = 'none'; pctx.globalAlpha = 1; pctx.restore();

  // draw blur regions that are active at this time
  VS.overlays.filter(o => o.type === 'blur' && VS.currentTime >= o.startTime && VS.currentTime < o.startTime + o.duration).forEach(o => applyBlurRegion(o));

  renderOverlayVisibility();
}

function applyBlurRegion(ov) {
  const x = ov.x, y = ov.y, w = ov.w, h = ov.h;
  if (w < 2 || h < 2) return;
  const off = document.createElement('canvas'); off.width = w + 30; off.height = h + 30;
  const oc = off.getContext('2d'); oc.filter = `blur(${ov.blurIntensity || 10}px)`;
  oc.drawImage(previewCanvas, x, y, w, h, -15, -15, w+30, h+30);
  pctx.save(); pctx.beginPath(); pctx.rect(x, y, w, h); pctx.clip();
  pctx.drawImage(off, x-15, y-15); pctx.restore();
}

function renderOverlayVisibility() {
  overlayLayer.querySelectorAll('.video-overlay-el').forEach(el => {
    const ov = VS.overlays.find(o => o.id === +el.dataset.id); if (!ov) return;
    const visible = VS.currentTime >= ov.startTime && VS.currentTime < ov.startTime + ov.duration;
    el.style.display = visible ? 'flex' : 'none';
    if (visible && ov.animation && ov.animation !== 'none') applyOverlayAnimation(el, ov);
  });
}

// ── TEXT ANIMATIONS ────────────────────────────────────────
function applyOverlayAnimation(el, ov) {
  const localT = VS.currentTime - ov.startTime;
  const dur = Math.min(0.6, ov.duration * 0.4);
  const progress = Math.min(1, localT / dur);
  const ease = 1 - Math.pow(1 - progress, 3); // ease out cubic

  switch (ov.animation) {
    case 'fadeIn':
      el.style.opacity = ease; break;
    case 'slideLeft':
      el.style.opacity = ease;
      el.style.transform = (el.dataset.baseTransform || '') + ` translateX(${(1-ease)*-80}px)`; break;
    case 'slideRight':
      el.style.opacity = ease;
      el.style.transform = (el.dataset.baseTransform || '') + ` translateX(${(1-ease)*80}px)`; break;
    case 'slideUp':
      el.style.opacity = ease;
      el.style.transform = (el.dataset.baseTransform || '') + ` translateY(${(1-ease)*60}px)`; break;
    case 'zoomIn':
      el.style.opacity = ease;
      el.style.transform = (el.dataset.baseTransform || '') + ` scale(${0.3 + ease*0.7})`; break;
    case 'bounce': {
      const bounce = progress < 0.6 ? Math.sin(progress * Math.PI / 0.6) : 0;
      el.style.opacity = Math.min(1, progress * 3);
      el.style.transform = (el.dataset.baseTransform || '') + ` translateY(${-bounce*20}px)`; break;
    }
    case 'typewriter': {
      if (el.dataset.fullText === undefined) el.dataset.fullText = el.querySelector('span')?.textContent || '';
      const chars = Math.floor(ease * el.dataset.fullText.length);
      const span = el.querySelector('span'); if (span) span.textContent = el.dataset.fullText.slice(0, chars); break;
    }
    default: el.style.opacity = 1;
  }
}

// ── TIMELINE ───────────────────────────────────────────────
function pxPerSec() { return VS.tlZoom * 20; }
function renderTimeline() { renderRuler(); renderVideoTrackUI(); renderAudioTrackUI(); renderOverlayTrackUI(); updatePlayhead(); }

function renderRuler() {
  tlRuler.innerHTML = '';
  const pps = pxPerSec(), total = Math.max(VS.totalDuration, 10);
  tlRuler.style.minWidth = (total * pps + 40) + 'px';
  const step = pps > 80 ? 0.5 : pps > 40 ? 1 : pps > 20 ? 2 : 5;
  for (let t = 0; t <= total + step; t += step) {
    const m = document.createElement('div'); m.className = 'tl-ruler-mark';
    m.style.left = (t * pps) + 'px'; m.textContent = fmtTimeSec(t); tlRuler.appendChild(m);
  }
}

function renderVideoTrackUI() {
  [...videoTrack.children].forEach(el => { if (!el.classList.contains('tl-playhead')) el.remove(); });
  const pps = pxPerSec(); videoTrack.style.minWidth = (VS.totalDuration * pps + 40) + 'px';
  VS.clips.forEach(clip => {
    const cs = getClipStart(clip), dur = (clip.trimEnd - clip.trimStart) / clip.speed;
    const el = document.createElement('div');
    el.className = 'tl-clip' + (clip === VS.selectedClip ? ' selected' : '');
    el.dataset.id = clip.id;
    el.style.left = (cs * pps) + 'px'; el.style.width = Math.max(6, dur * pps) + 'px';
    el.style.background = clip.color || 'var(--clip-color)';
    el.draggable = true;

    // thumbnail strip
    const thumb = document.createElement('div'); thumb.className = 'tl-clip-thumb';
    captureThumbnail(clip, thumb); el.appendChild(thumb);

    const label = document.createElement('div'); label.className = 'tl-clip-label';
    label.textContent = clip.type === 'freeze' ? '❄ Freeze' : (clip.name || 'Clip '+(clip.id+1)); el.appendChild(label);

    // trim handles
    ['left','right'].forEach(side => {
      const h = document.createElement('div'); h.className = `tl-trim-handle ${side}`; h.textContent = '⋮';
      h.addEventListener('mousedown', e => startTrim(e, clip, side)); el.appendChild(h);
    });

    el.addEventListener('click', e => { if (e.target.classList.contains('tl-trim-handle')) return; selectClip(clip); });

    // drag to reorder/reposition
    el.addEventListener('mousedown', e => { if (e.target.classList.contains('tl-trim-handle')) return; startDragClip(e, clip, el); });

    // trash drag
    el.addEventListener('dragstart', e => { VS.draggedItem = { type: 'clip', id: clip.id }; e.dataTransfer.effectAllowed = 'move'; });

    videoTrack.appendChild(el);
  });
}

function captureThumbnail(clip, thumbEl) {
  if (clip.type === 'freeze') { if (clip.imageData) { const tc = document.createElement('canvas'); tc.width = 160; tc.height = 90; tc.getContext('2d').putImageData(clip.imageData, 0, 0, 0, 0, 160, 90); thumbEl.style.backgroundImage = `url(${tc.toDataURL()})`; } return; }
  const vc = clip.videoEl; const tc = document.createElement('canvas'); tc.width = 160; tc.height = 90; const tctx = tc.getContext('2d');
  const oldT = vc.currentTime; vc.currentTime = clip.trimStart + (clip.trimEnd - clip.trimStart) * 0.15;
  vc.addEventListener('seeked', () => { tctx.drawImage(vc, 0, 0, tc.width, tc.height); thumbEl.style.backgroundImage = `url(${tc.toDataURL()})`; vc.currentTime = oldT; }, { once: true });
}

function renderAudioTrackUI() {
  audioTrack.innerHTML = '';
  const pps = pxPerSec();
  VS.audioTracks.forEach(at => {
    const el = document.createElement('div');
    el.className = 'tl-clip tl-audio-clip' + (at === VS.selectedAudio ? ' selected' : '');
    el.style.left = (at.offset * pps) + 'px';
    el.style.width = Math.max(6, (at.audioEl.duration || 10) * pps) + 'px';
    el.draggable = true;
    el.addEventListener('dragstart', e => { VS.draggedItem = { type: 'audio', id: at.id }; });

    // waveform canvas
    const wc = document.createElement('canvas'); wc.className = 'tl-waveform';
    wc.width = Math.max(6, (at.audioEl.duration || 10) * pps); wc.height = 50;
    el.appendChild(wc);
    drawWaveform(at, wc);

    const label = document.createElement('div'); label.className = 'tl-clip-label'; label.textContent = '♪ '+at.name; el.appendChild(label);
    el.addEventListener('click', () => selectAudio(at));
    el.addEventListener('mousedown', e => startDragAudio(e, at));
    audioTrack.appendChild(el);
  });
}

function drawWaveform(at, canvas) {
  const actx = new (window.AudioContext || window.webkitAudioContext)();
  fetch(at.audioEl.src).then(r => r.arrayBuffer()).then(buf => actx.decodeAudioData(buf)).then(decoded => {
    const data = decoded.getChannelData(0);
    const w = canvas.width, h = canvas.height;
    const wctx = canvas.getContext('2d');
    wctx.clearRect(0, 0, w, h);
    wctx.strokeStyle = 'rgba(255,255,255,0.6)'; wctx.lineWidth = 1;
    const step = Math.ceil(data.length / w);
    wctx.beginPath();
    for (let i = 0; i < w; i++) {
      let max = 0; for (let j = 0; j < step; j++) { const v = Math.abs(data[i*step+j]||0); if (v > max) max = v; }
      const y = (1 - max) * h/2; if (i === 0) wctx.moveTo(i, y); else wctx.lineTo(i, y);
    }
    wctx.stroke(); actx.close();
  }).catch(() => {});
}

function renderOverlayTrackUI() {
  overlayTrack.innerHTML = '';
  const pps = pxPerSec();
  VS.overlays.forEach(ov => {
    const el = document.createElement('div');
    el.className = 'tl-clip tl-overlay-clip' + (ov === VS.selectedOverlay ? ' selected' : '');
    el.style.left = (ov.startTime * pps) + 'px'; el.style.width = Math.max(6, ov.duration * pps) + 'px';
    el.draggable = true;
    el.addEventListener('dragstart', e => { VS.draggedItem = { type: 'overlay', id: ov.id }; });
    const label = document.createElement('div'); label.className = 'tl-clip-label';
    label.textContent = (ov.type==='text'?'T ':ov.type==='emoji'?'★ ':ov.type==='blur'?'⬡ ':'🖼 ')+(ov.text||ov.emoji||ov.name||'Overlay'); el.appendChild(label);
    el.addEventListener('click', () => selectOverlay(ov));
    overlayTrack.appendChild(el);
  });
}

function updatePlayhead() { const left = VS.currentTime * pxPerSec(); document.querySelectorAll('.tl-playhead').forEach(ph => ph.style.left = left+'px'); }

// ── GAP DETECTION ──────────────────────────────────────────
function detectGaps() {
  const gi = $('gapIndicator'); if (!gi) return;
  const pps = pxPerSec(); let prevEnd = 0; let gapFound = false;
  for (const c of VS.clips) {
    const cs = getClipStart(c);
    if (cs > prevEnd + 0.05) {
      gi.classList.remove('hidden');
      gi.style.left = (prevEnd * pps + 65) + 'px';
      gi.style.width = ((cs - prevEnd) * pps) + 'px';
      gi.style.top = '22px'; // below ruler
      gapFound = true; break;
    }
    prevEnd = cs + (c.trimEnd - c.trimStart) / c.speed;
  }
  if (!gapFound) gi.classList.add('hidden');
}

// ── CLIP DRAG (reorder/reposition) ────────────────────────
function startDragClip(e, clip, el) {
  e.preventDefault();
  const startX = e.clientX, origStart = getClipStart(clip), pps = pxPerSec();
  el.classList.add('dragging-clip');
  const origIdx = VS.clips.indexOf(clip);

  const onMove = ev => {
    const dx = (ev.clientX - startX) / pps;
    const newStart = Math.max(0, origStart + dx);
    // find where to insert based on newStart
    const newIdx = VS.clips.filter(c => c.id !== clip.id).findIndex(c => getClipStart(c) > newStart);
    const insertIdx = newIdx === -1 ? VS.clips.length - 1 : newIdx;
    if (insertIdx !== VS.clips.indexOf(clip)) {
      VS.clips.splice(VS.clips.indexOf(clip), 1);
      VS.clips.splice(insertIdx, 0, clip);
    }
    recalcDuration(); renderTimeline(); detectGaps();
    // show snap line if near another clip edge
    showSnapLine(newStart);
  };
  const onUp = () => {
    el.classList.remove('dragging-clip'); removeSnapLines();
    document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
    saveHistory(); recalcDuration(); renderTimeline();
  };
  document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
}

function showSnapLine(t) {
  removeSnapLines();
  const pps = pxPerSec(); const snapThresh = 0.1;
  VS.clips.forEach(c => {
    const cs = getClipStart(c), ce = cs + (c.trimEnd - c.trimStart) / c.speed;
    [cs, ce].forEach(edge => {
      if (Math.abs(t - edge) < snapThresh) {
        const sl = document.createElement('div'); sl.className = 'snap-line';
        sl.style.left = (edge * pps) + 'px'; videoTrack.appendChild(sl);
      }
    });
  });
}
function removeSnapLines() { videoTrack.querySelectorAll('.snap-line').forEach(el => el.remove()); }

// ── AUDIO DRAG ─────────────────────────────────────────────
function startDragAudio(e, at) {
  const startX = e.clientX, origOffset = at.offset, pps = pxPerSec();
  const onMove = ev => { at.offset = Math.max(0, origOffset + (ev.clientX - startX) / pps); renderTimeline(); };
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); saveHistory(); };
  document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
}

// ── TIMELINE CLICK TO SEEK ─────────────────────────────────
[$('tlRuler'), videoTrack, audioTrack, overlayTrack].forEach(el => {
  el.addEventListener('click', e => { const rect = el.getBoundingClientRect(); seekTo((e.clientX - rect.left) / pxPerSec()); });
});
$('tlZoom').addEventListener('input', e => { VS.tlZoom = +e.target.value; renderTimeline(); });
$('tlZoomIn').onclick  = () => { VS.tlZoom = Math.min(20, VS.tlZoom+1); $('tlZoom').value=VS.tlZoom; renderTimeline(); };
$('tlZoomOut').onclick = () => { VS.tlZoom = Math.max(1, VS.tlZoom-1); $('tlZoom').value=VS.tlZoom; renderTimeline(); };

// ── TRIM ───────────────────────────────────────────────────
function startTrim(e, clip, side) {
  e.stopPropagation();
  const startX = e.clientX, origStart = clip.trimStart, origEnd = clip.trimEnd, pps = pxPerSec();
  const onMove = ev => {
    const dx = (ev.clientX - startX) / pps * clip.speed;
    if (side === 'left') clip.trimStart = Math.max(0, Math.min(origStart+dx, clip.trimEnd-0.1));
    else clip.trimEnd = Math.max(clip.trimStart+0.1, Math.min(origEnd+dx, clip.duration));
    recalcDuration(); renderTimeline(); renderFrame(); detectGaps();
  };
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); saveHistory(); if (VS.selectedClip===clip) updateClipProps(clip); };
  document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
}

// ── SELECTION & PROPS ──────────────────────────────────────
function selectClip(clip) { VS.selectedClip=clip; VS.selectedAudio=null; VS.selectedOverlay=null; showProps('clip'); updateClipProps(clip); renderTimeline(); }
function selectAudio(at)   { VS.selectedAudio=at;  VS.selectedClip=null;  VS.selectedOverlay=null; showProps('audio'); updateAudioProps(at); renderTimeline(); }
function selectOverlay(ov) { VS.selectedOverlay=ov;VS.selectedClip=null;  VS.selectedAudio=null;   showProps('overlay'); updateOverlayProps(ov); renderTimeline(); }
function showProps(type) {
  $('vpEmpty').classList.toggle('hidden', type!=='none');
  $('clipProps').classList.toggle('hidden', type!=='clip');
  $('textOverlayProps').classList.toggle('hidden', type!=='overlay');
  $('audioProps').classList.toggle('hidden', type!=='audio');
}

function updateClipProps(clip) {
  $('trimStart').max = $('trimEnd').max = clip.duration;
  $('trimStart').value = clip.trimStart; $('trimStartVal').textContent = clip.trimStart.toFixed(1)+'s';
  $('trimEnd').value = clip.trimEnd; $('trimEndVal').textContent = clip.trimEnd.toFixed(1)+'s';
  $('clipSpeed').value = clip.speed*100; $('clipSpeedVal').textContent = clip.speed.toFixed(2).replace(/\.?0+$/,'')+'×';
  $('clipVolume').value = clip.volume*100; $('clipVolumeVal').textContent = Math.round(clip.volume*100)+'%';
  $('clipFilter').value = clip.filter; $('transitionIn').value = clip.transIn; $('transitionOut').value = clip.transOut;
  // clip color swatches
  const sw = $('clipColorSwatches'); sw.innerHTML = '';
  CLIP_COLORS.forEach(col => { const b=document.createElement('button');b.className='clip-csw'+(col===clip.color?' active':'');b.style.background=col;b.addEventListener('click',()=>{clip.color=col;updateClipProps(clip);renderTimeline();});sw.appendChild(b); });
}
$('trimStart').addEventListener('input',e=>{if(!VS.selectedClip)return;VS.selectedClip.trimStart=Math.min(+e.target.value,VS.selectedClip.trimEnd-0.1);$('trimStartVal').textContent=VS.selectedClip.trimStart.toFixed(1)+'s';recalcDuration();renderTimeline();renderFrame();});
$('trimEnd').addEventListener('input',e=>{if(!VS.selectedClip)return;VS.selectedClip.trimEnd=Math.max(+e.target.value,VS.selectedClip.trimStart+0.1);$('trimEndVal').textContent=VS.selectedClip.trimEnd.toFixed(1)+'s';recalcDuration();renderTimeline();renderFrame();});
$('clipSpeed').addEventListener('input',e=>{if(!VS.selectedClip)return;VS.selectedClip.speed=+e.target.value/100;VS.selectedClip.videoEl.playbackRate=VS.selectedClip.speed;$('clipSpeedVal').textContent=VS.selectedClip.speed.toFixed(2).replace(/\.?0+$/,'')+'×';recalcDuration();renderTimeline();});
$('clipVolume').addEventListener('input',e=>{if(!VS.selectedClip)return;VS.selectedClip.volume=+e.target.value/100;$('clipVolumeVal').textContent=Math.round(VS.selectedClip.volume*100)+'%';});
$('clipFilter').addEventListener('change',e=>{if(VS.selectedClip){VS.selectedClip.filter=e.target.value;renderFrame();}});
$('transitionIn').addEventListener('change',e=>{if(VS.selectedClip)VS.selectedClip.transIn=e.target.value;});
$('transitionOut').addEventListener('change',e=>{if(VS.selectedClip)VS.selectedClip.transOut=e.target.value;});
$('deleteClipBtn').onclick=$('deleteClipPropBtn').onclick=()=>{
  if(!VS.selectedClip)return; VS.selectedClip.videoEl.pause(); VS.selectedClip.videoEl.remove();
  VS.clips=VS.clips.filter(c=>c!==VS.selectedClip); VS.selectedClip=null;
  recalcDuration();renderTimeline();renderFrame();showProps('none');saveHistory();vToast('Clip removed');
};

// ── SPLIT ──────────────────────────────────────────────────
$('splitBtn').onclick = () => {
  const clip = getClipAt(VS.currentTime); if (!clip) return;
  const lt = getLocalTime(clip, VS.currentTime);
  if (lt <= clip.trimStart+0.05 || lt >= clip.trimEnd-0.05) { vToast('Too close to clip edge'); return; }
  const nv = document.createElement('video'); nv.src=clip.videoEl.src; nv.preload='auto'; nv.crossOrigin='anonymous'; nv.muted=false; nv.style.display='none'; document.body.appendChild(nv);
  const newClip = {...clip, id:VS.clipIdCounter++, videoEl:nv, trimStart:lt, name:clip.name+' (2)'};
  clip.trimEnd = lt; const idx = VS.clips.indexOf(clip); VS.clips.splice(idx+1, 0, newClip);
  recalcDuration(); renderTimeline(); renderFrame(); saveHistory(); vToast('Split at '+fmtTime(VS.currentTime));
};

// ── FREEZE FRAME ───────────────────────────────────────────
$('freezeFrameBtn').onclick = () => {
  if (!VS.clips.length) return;
  renderFrame(); // make sure canvas is up to date
  const imageData = pctx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
  const freezeClip = {
    id: VS.clipIdCounter++, type: 'freeze',
    name: 'Freeze', duration: 2, trimStart: 0, trimEnd: 2,
    startTime: VS.currentTime, speed: 1, volume: 0,
    filter: 'none', transIn: 'none', transOut: 'none',
    color: '#34C759', imageData,
  };
  // insert at playhead position
  const idx = VS.clips.findIndex(c => getClipStart(c) >= VS.currentTime);
  if (idx === -1) VS.clips.push(freezeClip); else VS.clips.splice(idx, 0, freezeClip);
  recalcDuration(); renderTimeline(); saveHistory(); vToast('Freeze frame added (2s)');
};

// ── AUDIO ──────────────────────────────────────────────────
$('addAudioBtn').onclick = () => $('audioFileInput').click();
$('audioFileInput').addEventListener('change', e => { const f=e.target.files[0]; if(f)loadAudioFile(f); e.target.value=''; });
function loadAudioFile(file) {
  const ael = new Audio(URL.createObjectURL(file)); ael.preload = 'auto';
  ael.addEventListener('loadedmetadata', () => {
    const at = { id:VS.audioIdCounter++, file, audioEl:ael, name:file.name.replace(/\.[^.]+$/,''), volume:1, offset:0, fadeIn:0, fadeOut:0, loop:false };
    VS.audioTracks.push(at); renderTimeline(); saveHistory(); selectAudio(at); vToast('Audio: '+at.name);
  }, { once: true });
}
$('videoVolume').addEventListener('input',e=>{VS.clips.forEach(c=>c.volume=+e.target.value/100);$('videoVolVal').textContent=e.target.value+'%';});
$('muteVideoAudio').addEventListener('change',e=>{VS.clips.forEach(c=>c.videoEl.muted=e.target.checked);});
function updateAudioProps(at){$('audioVolume').value=at.volume*100;$('audioVolVal').textContent=Math.round(at.volume*100)+'%';$('audioOffset').max=VS.totalDuration;$('audioOffset').value=at.offset;$('audioOffsetVal').textContent=at.offset.toFixed(1)+'s';$('audioFadeIn').value=at.fadeIn;$('audioFadeInVal').textContent=at.fadeIn.toFixed(1)+'s';$('audioFadeOut').value=at.fadeOut;$('audioFadeOutVal').textContent=at.fadeOut.toFixed(1)+'s';$('audioLoop').checked=at.loop;}
$('audioVolume').addEventListener('input',e=>{if(!VS.selectedAudio)return;VS.selectedAudio.volume=+e.target.value/100;$('audioVolVal').textContent=Math.round(VS.selectedAudio.volume*100)+'%';});
$('audioOffset').addEventListener('input',e=>{if(!VS.selectedAudio)return;VS.selectedAudio.offset=+e.target.value;$('audioOffsetVal').textContent=VS.selectedAudio.offset.toFixed(1)+'s';renderTimeline();});
$('audioFadeIn').addEventListener('input',e=>{if(!VS.selectedAudio)return;VS.selectedAudio.fadeIn=+e.target.value;$('audioFadeInVal').textContent=VS.selectedAudio.fadeIn.toFixed(1)+'s';});
$('audioFadeOut').addEventListener('input',e=>{if(!VS.selectedAudio)return;VS.selectedAudio.fadeOut=+e.target.value;$('audioFadeOutVal').textContent=VS.selectedAudio.fadeOut.toFixed(1)+'s';});
$('audioLoop').addEventListener('change',e=>{if(VS.selectedAudio)VS.selectedAudio.loop=e.target.checked;});
$('deleteAudioBtn').onclick=()=>{if(!VS.selectedAudio)return;VS.selectedAudio.audioEl.pause();VS.audioTracks=VS.audioTracks.filter(a=>a!==VS.selectedAudio);VS.selectedAudio=null;showProps('none');renderTimeline();saveHistory();vToast('Audio removed');};

// ── SOUND EFFECTS ──────────────────────────────────────────
function renderSFXPanel() {
  const list = $('sfxList'); if (!list) return; list.innerHTML = '';
  SFX.forEach(sfx => {
    const item = document.createElement('div'); item.className = 'sfx-item';
    const name = document.createElement('span'); name.className = 'sfx-name'; name.textContent = sfx.name;
    const playBtn = document.createElement('button'); playBtn.className = 'sfx-play'; playBtn.textContent = '▶';
    playBtn.addEventListener('click', () => {
      if (!VS.sfxAudioCtx) VS.sfxAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      sfx.fn(VS.sfxAudioCtx);
    });
    const addBtn = document.createElement('button'); addBtn.className = 'sfx-add'; addBtn.textContent = '+ Add';
    addBtn.addEventListener('click', () => {
      // create a tiny audio element by encoding the sfx via OfflineAudioContext
      playSFXAndAdd(sfx);
    });
    item.appendChild(playBtn); item.appendChild(name); item.appendChild(addBtn);
    list.appendChild(item);
  });
}
$('sfxPanelBtn').onclick = () => {
  const panel = $('sfxPanel'); panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) { showProps('none'); $('vpEmpty').classList.add('hidden'); }
};

async function playSFXAndAdd(sfx) {
  const dur = 1.0;
  const offCtx = new OfflineAudioContext(1, 44100*dur, 44100);
  sfx.fn(offCtx);
  const rendered = await offCtx.startRendering();
  const wav = audioBufferToWav(rendered);
  const blob = new Blob([wav], { type:'audio/wav' });
  const url = URL.createObjectURL(blob);
  const ael = new Audio(url); ael.preload = 'auto';
  ael.addEventListener('loadedmetadata', () => {
    const at = { id:VS.audioIdCounter++, audioEl:ael, name:sfx.name, volume:1, offset:VS.currentTime, fadeIn:0, fadeOut:0, loop:false };
    VS.audioTracks.push(at); renderTimeline(); saveHistory(); vToast(sfx.name+' added to timeline');
  }, { once: true });
}

function audioBufferToWav(buffer) {
  const numCh = buffer.numberOfChannels, sr = buffer.sampleRate, len = buffer.length;
  const ab = new ArrayBuffer(44 + len*2), view = new DataView(ab);
  const writeStr = (o,s) => { for(let i=0;i<s.length;i++) view.setUint8(o+i, s.charCodeAt(i)); };
  writeStr(0,'RIFF'); view.setUint32(4,36+len*2,true); writeStr(8,'WAVE'); writeStr(12,'fmt ');
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,numCh,true);
  view.setUint32(24,sr,true); view.setUint32(28,sr*numCh*2,true); view.setUint16(32,numCh*2,true);
  view.setUint16(34,16,true); writeStr(36,'data'); view.setUint32(40,len*2,true);
  const ch = buffer.getChannelData(0);
  for(let i=0;i<len;i++){const s=Math.max(-1,Math.min(1,ch[i]));view.setInt16(44+i*2,s<0?s*0x8000:s*0x7FFF,true);}
  return ab;
}

// ── OVERLAYS ───────────────────────────────────────────────
function buildMiniColors(containerId, onSelect) {
  const el = $(containerId); if (!el) return; el.innerHTML = '';
  COLORS.forEach(c => {
    const sw = document.createElement('button'); sw.className='mini-swatch'+(c===VS.newOverlayColor?' active':'');
    sw.style.background = c; if(c==='#ffffff')sw.style.outline='1px solid #888';
    sw.addEventListener('click', () => { el.querySelectorAll('.mini-swatch').forEach(s=>s.classList.remove('active')); sw.classList.add('active'); VS.newOverlayColor=c; onSelect(c); });
    el.appendChild(sw);
  });
}

// TEXT
$('addTextBtn').onclick = () => {
  $('addTextModal').classList.remove('hidden');
  buildMiniColors('newOlColors', c => VS.newOverlayColor = c);
  $('newPosGrid').querySelectorAll('.pos-btn').forEach(b=>b.classList.remove('active'));
  $('newPosGrid').querySelector('[data-pos="center"]').classList.add('active');
  VS.newOverlayPos = 'center';
};
$('newPosGrid').querySelectorAll('.pos-btn').forEach(b => { b.addEventListener('click',()=>{ $('newPosGrid').querySelectorAll('.pos-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); VS.newOverlayPos=b.dataset.pos; }); });
$('newOlSize').addEventListener('input', e => { VS.newOverlaySize=+e.target.value; $('newOlSizeVal').textContent=VS.newOverlaySize+'px'; });
[$('closeTextModal'),$('cancelTextModal')].forEach(b => b.onclick=()=>$('addTextModal').classList.add('hidden'));
$('confirmTextModal').onclick = () => {
  const text = $('newOverlayText').value.trim(); if(!text)return;
  const anim = $('newOlAnimation').value;
  addOverlay({ type:'text', text, color:VS.newOverlayColor, fontSize:VS.newOverlaySize, pos:VS.newOverlayPos, bold:false, italic:false, bg:'none', animation:anim });
  $('addTextModal').classList.add('hidden'); $('newOverlayText').value='';
};

// EMOJI
let vSelEmoji = '👍';
buildVEmojiGrid('reactions');
$('vEmojiTabs').querySelectorAll('.etab').forEach(tab => { tab.addEventListener('click',()=>{ $('vEmojiTabs').querySelectorAll('.etab').forEach(t=>t.classList.remove('active')); tab.classList.add('active'); buildVEmojiGrid(tab.dataset.cat); }); });
function buildVEmojiGrid(cat) { const grid=$('vEmojiGrid');grid.innerHTML='';(EMOJIS[cat]||EMOJIS.reactions).forEach(em=>{const btn=document.createElement('button');btn.className='em-btn'+(em===vSelEmoji?' sel':'');btn.textContent=em;btn.addEventListener('click',()=>{grid.querySelectorAll('.em-btn').forEach(b=>b.classList.remove('sel'));btn.classList.add('sel');vSelEmoji=em;});grid.appendChild(btn);}); }
$('vEmojiSize').addEventListener('input', e => $('vEmojiSizeVal').textContent=e.target.value+'px');
$('addEmojiBtn').onclick=()=>$('addEmojiModal').classList.remove('hidden');
[$('closeEmojiModal'),$('cancelEmojiModal')].forEach(b=>b.onclick=()=>$('addEmojiModal').classList.add('hidden'));
$('confirmEmojiModal').onclick=()=>{ addOverlay({type:'emoji',emoji:vSelEmoji,fontSize:+$('vEmojiSize').value,pos:VS.newOverlayPos}); $('addEmojiModal').classList.add('hidden'); };

// GIF / IMAGE
$('addGifBtn').onclick=()=>$('gifFileInput').click();
$('gifFileInput').addEventListener('change',e=>{ const f=e.target.files[0];if(f)addOverlay({type:f.type==='image/gif'?'gif':'image',src:URL.createObjectURL(f),name:f.name,pos:'center'}); e.target.value=''; });

// WATERMARK
$('addWatermarkBtn').onclick=()=>$('vWatermarkInput').click();
$('vWatermarkInput').addEventListener('change',e=>{ const f=e.target.files[0];if(!f)return; const url=URL.createObjectURL(f); const img=new Image(); img.onload=()=>{VS.wmImage=img;addOverlay({type:'image',src:url,name:'watermark',pos:'bottom-right'});vToast('Watermark added');}; img.src=url; e.target.value=''; });

// BLUR REGION
$('addBlurRegionBtn').onclick = () => {
  if (!VS.clips.length) { vToast('Load a video first'); return; }
  VS.blurRegionActive = true;
  blurCanvas.style.display = 'block';
  vToast('Drag on the video to select blur area');
};
blurCanvas.addEventListener('mousedown', e => {
  if (!VS.blurRegionActive) return;
  const rect = blurCanvas.getBoundingClientRect();
  const scaleX = previewCanvas.width / rect.width, scaleY = previewCanvas.height / rect.height;
  VS.blurDrawing = true;
  VS.blurStart = { x:(e.clientX-rect.left)*scaleX, y:(e.clientY-rect.top)*scaleY };
});
blurCanvas.addEventListener('mousemove', e => {
  if (!VS.blurDrawing) return;
  const rect = blurCanvas.getBoundingClientRect();
  const scaleX = previewCanvas.width / rect.width, scaleY = previewCanvas.height / rect.height;
  const cx = (e.clientX-rect.left)*scaleX, cy = (e.clientY-rect.top)*scaleY;
  bctx.clearRect(0, 0, blurCanvas.width, blurCanvas.height);
  bctx.strokeStyle = 'rgba(0,199,255,0.8)'; bctx.lineWidth = 2; bctx.setLineDash([5,4]);
  bctx.strokeRect(VS.blurStart.x, VS.blurStart.y, cx-VS.blurStart.x, cy-VS.blurStart.y);
  bctx.setLineDash([]);
  bctx.fillStyle = 'rgba(0,199,255,0.1)';
  bctx.fillRect(VS.blurStart.x, VS.blurStart.y, cx-VS.blurStart.x, cy-VS.blurStart.y);
});
blurCanvas.addEventListener('mouseup', e => {
  if (!VS.blurDrawing) return; VS.blurDrawing = false;
  const rect = blurCanvas.getBoundingClientRect();
  const scaleX = previewCanvas.width / rect.width, scaleY = previewCanvas.height / rect.height;
  const ex=(e.clientX-rect.left)*scaleX, ey=(e.clientY-rect.top)*scaleY;
  const x=Math.min(VS.blurStart.x,ex), y=Math.min(VS.blurStart.y,ey);
  const w=Math.abs(ex-VS.blurStart.x), h=Math.abs(ey-VS.blurStart.y);
  if (w < 5 || h < 5) { bctx.clearRect(0,0,blurCanvas.width,blurCanvas.height); return; }
  addOverlay({ type:'blur', x, y, w, h, blurIntensity:12, startTime:VS.currentTime, duration:Math.max(1,VS.totalDuration-VS.currentTime) });
  VS.blurRegionActive = false; blurCanvas.style.display = 'none';
  bctx.clearRect(0,0,blurCanvas.width,blurCanvas.height);
  vToast('Blur region added');
});

// ADD OVERLAY CORE
function addOverlay(data) {
  const ov = {
    id: VS.overlayIdCounter++, type:data.type,
    text:data.text||'', emoji:data.emoji||'', src:data.src||'', name:data.name||'',
    color:data.color||'#ffffff', fontSize:data.fontSize||32,
    bold:data.bold||false, italic:data.italic||false, bg:data.bg||'none',
    pos:data.pos||'center', animation:data.animation||'none',
    startTime:data.startTime??VS.currentTime,
    duration:data.duration??Math.max(1,Math.min(5,VS.totalDuration-VS.currentTime)),
    // blur specific
    x:data.x||0, y:data.y||0, w:data.w||0, h:data.h||0, blurIntensity:data.blurIntensity||12,
  };
  VS.overlays.push(ov);
  if (ov.type !== 'blur') createOverlayDOM(ov);
  renderTimeline(); saveHistory(); selectOverlay(ov); vToast('Overlay added');
}

function posToCSS(pos) {
  const m = { 'top-left':{top:'5%',left:'5%'}, 'top-center':{top:'5%',left:'50%',transform:'translateX(-50%)'}, 'top-right':{top:'5%',right:'5%'}, 'center':{top:'50%',left:'50%',transform:'translate(-50%,-50%)'}, 'bottom-left':{bottom:'8%',left:'5%'}, 'bottom-center':{bottom:'8%',left:'50%',transform:'translateX(-50%)'}, 'bottom-right':{bottom:'8%',right:'5%'} };
  return m[pos] || m['center'];
}

function createOverlayDOM(ov) {
  const el = document.createElement('div'); el.className='video-overlay-el'; el.dataset.id=ov.id;
  const css = posToCSS(ov.pos); Object.assign(el.style, css);
  // store base transform for animations
  el.dataset.baseTransform = css.transform || '';

  if (ov.type==='text') {
    el.style.color=ov.color; el.style.fontSize=ov.fontSize+'px';
    el.style.fontWeight=ov.bold?'bold':'normal'; el.style.fontStyle=ov.italic?'italic':'normal';
    if(ov.bg==='dark')el.style.background='rgba(0,0,0,0.6)'; el.style.borderRadius='6px'; el.style.padding='4px 10px';
    const span=document.createElement('span'); span.textContent=ov.text; el.appendChild(span);
  } else if (ov.type==='emoji') {
    el.style.fontSize=ov.fontSize+'px'; el.textContent=ov.emoji;
  } else if (ov.type==='gif' || ov.type==='image') {
    if (ov.type==='gif') {
      // animated GIF: use img tag which handles animation natively
      const img=document.createElement('img'); img.src=ov.src; img.style.maxWidth='200px'; img.style.maxHeight='200px'; img.style.borderRadius='4px';
      el.appendChild(img);
    } else {
      const img=document.createElement('img'); img.src=ov.src; img.style.maxWidth='200px'; img.style.maxHeight='200px'; img.style.borderRadius='4px';
      el.appendChild(img);
    }
  }

  // delete button (always visible on hover/select)
  const del=document.createElement('button'); del.className='ol-delete'; del.textContent='✕';
  del.addEventListener('click', e => { e.stopPropagation(); removeOverlay(ov); }); el.appendChild(del);
  el.addEventListener('click', () => selectOverlay(ov));

  // draggable reposition
  el.draggable = true;
  el.addEventListener('dragstart', e => { VS.draggedItem={type:'overlay',id:ov.id}; });
  el.addEventListener('mousedown', e => {
    if (e.target===del) return;
    const ox=e.clientX-el.offsetLeft, oy=e.clientY-el.offsetTop; el.style.cursor='grabbing';
    const onMove=ev=>{ el.style.left=(ev.clientX-ox)+'px'; el.style.top=(ev.clientY-oy)+'px'; el.style.transform=''; el.style.right=''; el.style.bottom=''; };
    const onUp=()=>{ el.style.cursor='move'; document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); };
    document.addEventListener('mousemove',onMove); document.addEventListener('mouseup',onUp);
  });

  el.style.display='none'; overlayLayer.appendChild(el);
}

function removeOverlay(ov) {
  VS.overlays=VS.overlays.filter(o=>o!==ov);
  overlayLayer.querySelector(`[data-id="${ov.id}"]`)?.remove();
  if(VS.selectedOverlay===ov){VS.selectedOverlay=null;showProps('none');}
  renderTimeline(); saveHistory(); vToast('Overlay removed');
}

// OVERLAY PROPS
function updateOverlayProps(ov) {
  if (ov.type!=='text') return;
  $('overlayText').value=ov.text||''; $('olFontSize').value=ov.fontSize||32; $('olFontSizeVal').textContent=(ov.fontSize||32)+'px';
  $('olStartTime').max=VS.totalDuration; $('olStartTime').value=ov.startTime; $('olStartVal').textContent=ov.startTime.toFixed(1)+'s';
  $('olDuration').value=ov.duration; $('olDurVal').textContent=ov.duration.toFixed(1)+'s';
  $('olAnimation').value=ov.animation||'none';
  buildMiniColors('olColorGrid', c => { if(!VS.selectedOverlay)return; VS.selectedOverlay.color=c; const el=overlayLayer.querySelector(`[data-id="${ov.id}"]`); if(el)el.style.color=c; });
}
$('overlayText').addEventListener('input',e=>{if(!VS.selectedOverlay)return;VS.selectedOverlay.text=e.target.value;const el=overlayLayer.querySelector(`[data-id="${VS.selectedOverlay.id}"]`);if(el){const s=el.querySelector('span');if(s)s.textContent=e.target.value;}});
$('olFontSize').addEventListener('input',e=>{if(!VS.selectedOverlay)return;VS.selectedOverlay.fontSize=+e.target.value;$('olFontSizeVal').textContent=VS.selectedOverlay.fontSize+'px';const el=overlayLayer.querySelector(`[data-id="${VS.selectedOverlay.id}"]`);if(el)el.style.fontSize=VS.selectedOverlay.fontSize+'px';});
$('olAnimation').addEventListener('change',e=>{if(VS.selectedOverlay){VS.selectedOverlay.animation=e.target.value;}});
$('olStartTime').addEventListener('input',e=>{if(!VS.selectedOverlay)return;VS.selectedOverlay.startTime=+e.target.value;$('olStartVal').textContent=VS.selectedOverlay.startTime.toFixed(1)+'s';renderTimeline();});
$('olDuration').addEventListener('input',e=>{if(!VS.selectedOverlay)return;VS.selectedOverlay.duration=+e.target.value;$('olDurVal').textContent=VS.selectedOverlay.duration.toFixed(1)+'s';renderTimeline();});
$('olCustomColor').addEventListener('input',e=>{if(!VS.selectedOverlay)return;VS.selectedOverlay.color=e.target.value;const el=overlayLayer.querySelector(`[data-id="${VS.selectedOverlay.id}"]`);if(el)el.style.color=e.target.value;});
['olBgNone','olBgDark'].forEach((id,i)=>{$(id)?.addEventListener('click',()=>{if(!VS.selectedOverlay)return;VS.selectedOverlay.bg=['none','dark'][i];['olBgNone','olBgDark'].forEach(b=>$(b)?.classList.remove('active'));$(id).classList.add('active');const el=overlayLayer.querySelector(`[data-id="${VS.selectedOverlay.id}"]`);if(el)el.style.background=i===1?'rgba(0,0,0,0.6)':'transparent';});});
['olBold','olItalic'].forEach((id,i)=>{$(id)?.addEventListener('click',()=>{if(!VS.selectedOverlay)return;const p=i===0?'bold':'italic';VS.selectedOverlay[p]=!VS.selectedOverlay[p];$(id).classList.toggle('active',VS.selectedOverlay[p]);const el=overlayLayer.querySelector(`[data-id="${VS.selectedOverlay.id}"]`);if(el)el.style[i===0?'fontWeight':'fontStyle']=VS.selectedOverlay[p]?(i===0?'bold':'italic'):'normal';});});
document.querySelectorAll('#textOverlayProps .pos-btn').forEach(b=>{b.addEventListener('click',()=>{document.querySelectorAll('#textOverlayProps .pos-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');if(VS.selectedOverlay){VS.selectedOverlay.pos=b.dataset.pos;const el=overlayLayer.querySelector(`[data-id="${VS.selectedOverlay.id}"]`);if(el){Object.assign(el.style,{top:'',left:'',right:'',bottom:'',transform:''});Object.assign(el.style,posToCSS(b.dataset.pos));}}});});
$('deleteOverlayBtn').onclick=()=>{if(VS.selectedOverlay)removeOverlay(VS.selectedOverlay);};

// ── FILTERS & SPEED ────────────────────────────────────────
document.querySelectorAll('.filt-btn').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.filt-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');VS.globalFilter=btn.dataset.filter;renderFrame();});});
document.querySelectorAll('.spd-btn').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.spd-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const sp=+btn.dataset.speed;VS.clips.forEach(c=>{c.speed=sp;c.videoEl.playbackRate=sp;});recalcDuration();renderTimeline();});});
document.querySelectorAll('.ratio-btn').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.ratio-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');VS.aspectRatio=btn.dataset.ratio;resizePreview();renderFrame();});});
$('loopPreview').addEventListener('change', e => VS.loopPreview = e.target.checked);

// ── AUTO SUBTITLES ─────────────────────────────────────────
$('autoSubBtn').onclick = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { vToast('Speech recognition not supported in this browser'); return; }
  if (!VS.clips.length) { vToast('Load a video first'); return; }
  vToast('Starting auto subtitles — playing video and listening...');
  const rec = new SR(); rec.continuous = true; rec.interimResults = false; rec.lang = 'en-US';
  const startTime = VS.currentTime;
  rec.addEventListener('result', ev => {
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      if (ev.results[i].isFinal) {
        const text = ev.results[i][0].transcript.trim();
        const t = VS.currentTime;
        addOverlay({ type:'text', text, color:'#ffffff', fontSize:28, pos:'bottom-center', bg:'dark', animation:'fadeIn', startTime:t, duration:3 });
      }
    }
  });
  rec.addEventListener('error', e => vToast('Speech error: ' + e.error));
  rec.start();
  play();
  // stop after video ends
  setTimeout(() => { rec.stop(); pause(); vToast('Auto subtitles done'); }, (VS.totalDuration - VS.currentTime) * 1000 + 500);
};

// ── EXPORT ─────────────────────────────────────────────────
$('vExportArrow').onclick=e=>{e.stopPropagation();$('vExportMenu').classList.toggle('hidden');};
document.addEventListener('click',()=>$('vExportMenu')?.classList.add('hidden'));
document.querySelectorAll('#vExportMenu .dlm-btn').forEach(btn=>{btn.addEventListener('click',()=>{if(btn.dataset.quality)VS.exportQuality=btn.dataset.quality;if(btn.dataset.format==='frame')exportCurrentFrame();else startExport(btn.dataset.format||'webm');});});
$('vExportBtn').onclick=$('startExportBtn').onclick=()=>startExport($('exportFormat').value);
['qualDraft','qualMed','qualHigh'].forEach((id,i)=>{$(id)?.addEventListener('click',()=>{VS.exportQuality=['draft','medium','high'][i];['qualDraft','qualMed','qualHigh'].forEach(b=>$(b)?.classList.remove('active'));$(id)?.classList.add('active');});});

function exportCurrentFrame(){renderFrame();const a=document.createElement('a');a.href=previewCanvas.toDataURL('image/png');a.download=`editr_frame_${Date.now()}.png`;a.click();vToast('Frame exported ✓');}

async function startExport(format) {
  if(!VS.clips.length){vToast('No clips to export');return;}
  pause(); $('exportModal').classList.remove('hidden'); setExpProgress(0,'Setting up...'); VS.cancelExport=false;
  await sleep(100);
  const res=$('exportRes').value; let ew=previewCanvas.width,eh=previewCanvas.height;
  if(res!=='source'){const scale=+res/Math.max(ew,eh);ew=Math.round(ew*scale);eh=Math.round(eh*scale);}
  const exportCanvas=document.createElement('canvas');exportCanvas.width=ew;exportCanvas.height=eh;
  const ectx=exportCanvas.getContext('2d');ectx.imageSmoothingEnabled=true;ectx.imageSmoothingQuality='high';
  const stream=exportCanvas.captureStream(30);
  let audioCtx;
  try{audioCtx=new AudioContext();const dest=audioCtx.createMediaStreamDestination();VS.clips.forEach(c=>{try{const src=audioCtx.createMediaElementSource(c.videoEl);const g=audioCtx.createGain();g.gain.value=Math.min(1,c.volume);src.connect(g);g.connect(dest);}catch(e){}});VS.audioTracks.forEach(at=>{try{const src=audioCtx.createMediaElementSource(at.audioEl);const g=audioCtx.createGain();g.gain.value=Math.min(1,at.volume);src.connect(g);g.connect(dest);}catch(e){}});dest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));}catch(e){}
  const bps=VS.exportQuality==='high'?8000000:VS.exportQuality==='draft'?1500000:4000000;
  let recorder;try{recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:bps});}catch{try{recorder=new MediaRecorder(stream,{videoBitsPerSecond:bps});}catch{vToast('MediaRecorder not supported');$('exportModal').classList.add('hidden');return;}}
  const chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);recorder.start(200);
  setExpProgress(2,'Rendering...'); let t=0;const fps=30,fd=1/fps;const startTs=Date.now();
  const loop=async()=>{
    if(VS.cancelExport){recorder.stop();return;}
    if(t>=VS.totalDuration){setExpProgress(98,'Finalizing...');await sleep(300);recorder.stop();return;}
    const clip=getClipAt(t);
    if(clip&&clip.type!=='freeze'){const lt=getLocalTime(clip,t);if(Math.abs(clip.videoEl.currentTime-lt)>0.1){clip.videoEl.currentTime=lt;await new Promise(r=>{clip.videoEl.addEventListener('seeked',r,{once:true});setTimeout(r,200);});}ectx.clearRect(0,0,ew,eh);const f=clip.filter!=='none'?clip.filter:VS.globalFilter!=='none'?VS.globalFilter:'none';if(f!=='none')ectx.filter=f;ectx.drawImage(clip.videoEl,0,0,ew,eh);ectx.filter='none';}
    else if(clip&&clip.type==='freeze'&&clip.imageData){const tmp=document.createElement('canvas');tmp.width=previewCanvas.width;tmp.height=previewCanvas.height;tmp.getContext('2d').putImageData(clip.imageData,0,0);ectx.drawImage(tmp,0,0,ew,eh);}
    t+=fd;
    const pct=(t/VS.totalDuration)*95;const elapsed=(Date.now()-startTs)/1000;const eta=elapsed/Math.max(0.01,t/VS.totalDuration)-elapsed;
    setExpProgress(pct,`Rendering ${Math.round(t)}s / ${Math.round(VS.totalDuration)}s — ETA ${Math.round(eta)}s`);
    await sleep(10);requestAnimationFrame(loop);
  };
  recorder.onstop=()=>{const blob=new Blob(chunks,{type:'video/webm'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`editr_export_${Date.now()}.webm`;a.click();$('exportModal').classList.add('hidden');vToast('Export complete! Saved to Downloads ✓');try{if(audioCtx)audioCtx.close();}catch(e){}};
  loop();
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function setExpProgress(pct,msg){const p=Math.round(pct);$('expBarModal').style.width=p+'%';$('expPctModal').textContent=p+'%';if(msg){$('expStatus').textContent=msg;}}
$('cancelExportBtn').onclick=()=>{VS.cancelExport=true;$('exportModal').classList.add('hidden');vToast('Export cancelled');};

// ── RESIZABLE PANELS ───────────────────────────────────────
function initVResize(handleId,targetId,side){const handle=$(handleId);if(!handle)return;handle.addEventListener('mousedown',e=>{e.preventDefault();handle.classList.add('dragging');const startX=e.clientX,target=$(targetId),startW=target.offsetWidth;const onMove=ev=>{const dx=ev.clientX-startX;target.style.width=Math.max(120,Math.min(500,startW+(side==='right'?-dx:dx)))+'px';resizePreview();};const onUp=()=>{handle.classList.remove('dragging');document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);};document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);});}
initVResize('vtResizeLeft','vtoolbar','left');initVResize('vtResizeRight','vprops','right');
const tlHandle=$('tlResizeHandle');if(tlHandle){tlHandle.addEventListener('mousedown',e=>{e.preventDefault();tlHandle.classList.add('dragging');const startY=e.clientY,panel=$('timelinePanel'),startH=panel.offsetHeight;const onMove=ev=>{panel.style.height=Math.max(80,Math.min(600,startH+(startY-ev.clientY)))+'px';};const onUp=()=>{tlHandle.classList.remove('dragging');document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);};document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);});}

// ── HISTORY ────────────────────────────────────────────────
function saveHistory(){const snap=JSON.stringify({clips:VS.clips.map(c=>({id:c.id,trimStart:c.trimStart,trimEnd:c.trimEnd,speed:c.speed,volume:c.volume,filter:c.filter,transIn:c.transIn,transOut:c.transOut,color:c.color,type:c.type})),overlays:VS.overlays.map(o=>({...o,img:null})),audioTracks:VS.audioTracks.map(a=>({id:a.id,volume:a.volume,offset:a.offset,fadeIn:a.fadeIn,fadeOut:a.fadeOut,loop:a.loop}))});VS.history=VS.history.slice(0,VS.historyIndex+1);VS.history.push(snap);if(VS.history.length>40)VS.history.shift();else VS.historyIndex++;}
function applyHistory(snap){snap.clips.forEach(sc=>{const c=VS.clips.find(c=>c.id===sc.id);if(c)Object.assign(c,sc);});VS.overlays=snap.overlays.filter(o=>o.type!=='blur');snap.overlays.filter(o=>o.type==='blur').forEach(o=>VS.overlays.push(o));snap.audioTracks.forEach(sa=>{const at=VS.audioTracks.find(a=>a.id===sa.id);if(at)Object.assign(at,sa);});recalcDuration();renderTimeline();renderFrame();}
$('vUndoBtn').onclick=()=>{if(VS.historyIndex>0){VS.historyIndex--;applyHistory(JSON.parse(VS.history[VS.historyIndex]));}};
$('vRedoBtn').onclick=()=>{if(VS.historyIndex<VS.history.length-1){VS.historyIndex++;applyHistory(JSON.parse(VS.history[VS.historyIndex]));}};

// ── KEYBOARD ───────────────────────────────────────────────
document.addEventListener('keydown',e=>{
  const tag=document.activeElement.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
  const ctrl=e.ctrlKey||e.metaKey;
  if(e.key===' '){e.preventDefault();togglePlay();}
  if(e.key==='s'&&!ctrl){e.preventDefault();$('splitBtn').click();}
  if((e.key==='Delete'||e.key==='Backspace')&&VS.selectedClip)$('deleteClipBtn').click();
  if(ctrl&&e.key==='z'){e.preventDefault();$('vUndoBtn').click();}
  if(ctrl&&e.key=='y'){e.preventDefault();$('vRedoBtn').click();}
  if(e.key==='j'||e.key==='J')seekTo(VS.currentTime-5);
  if(e.key==='l'||e.key==='L')seekTo(VS.currentTime+5);
  if(e.key==='ArrowLeft'){e.preventDefault();seekTo(VS.currentTime-1/30);}
  if(e.key==='ArrowRight'){e.preventDefault();seekTo(VS.currentTime+1/30);}
  if(e.key==='0')seekTo(0);
  if(e.key==='m'||e.key==='M'){$('muteVideoAudio').checked=!$('muteVideoAudio').checked;$('muteVideoAudio').dispatchEvent(new Event('change'));vToast($('muteVideoAudio').checked?'Muted':'Unmuted');}
  if(e.key==='f'||e.key==='F')exportCurrentFrame();
  if(e.key==='b'||e.key==='B')$('addBlurRegionBtn').click();
});

$('vShortcutsBtn').onclick=$('vShortcutsBtn2').onclick=()=>$('vShortcutsModal').classList.toggle('hidden');
$('closeVShortcuts').onclick=()=>$('vShortcutsModal').classList.add('hidden');
$('vThemeToggle').onclick=()=>{const h=document.documentElement;h.setAttribute('data-theme',h.getAttribute('data-theme')==='dark'?'light':'dark');};
$('skipBackBtn').onclick=()=>seekTo(VS.currentTime-5);
$('skipFwdBtn').onclick=()=>seekTo(VS.currentTime+5);

function fmtTime(t){if(isNaN(t)||t<0)return'0:00.0';const m=Math.floor(t/60),s=Math.floor(t%60),ms=Math.floor((t%1)*10);return`${m}:${s.toString().padStart(2,'0')}.${ms}`;}
function fmtTimeSec(t){const m=Math.floor(t/60),s=Math.floor(t%60);return m>0?`${m}:${s.toString().padStart(2,'0')}`:`${s}s`;}
function vToast(msg,ms=2600){const t=$('vToast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(vToast._t);vToast._t=setTimeout(()=>t.classList.add('hidden'),ms);}
console.log('%ceditр video v3 ready','color:#FF3B57;font-weight:bold');
