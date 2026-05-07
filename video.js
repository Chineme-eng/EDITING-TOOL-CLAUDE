'use strict';
/* ═══════════════════════════════════════════
   EDITR VIDEO — video.js
   Timeline, clips, trim, overlays, audio,
   filters, export via MediaRecorder
═══════════════════════════════════════════ */

// ── EMOJI DATA ────────────────────────────────────────────
const EMOJIS = {
  reactions: ['👍','👎','❤️','🔥','⭐','✅','❌','⚠️','💡','🎯','🚀','👀','💬','🗣️','💯','🙌','👏','🤔','😮','🤯','💪','🎉','🏆','✨','💎','🔑','📌','📍'],
  symbols:   ['🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🔶','🔷','🔸','🔹','▶️','⏩','⏭️','🔺','🔻','💠','🔘','🔲'],
  arrows:    ['➡️','⬅️','⬆️','⬇️','↗️','↙️','↖️','↘️','↕️','↔️','🔄','🔃','↩️','↪️','⤴️','⤵️','🔙','🔚','🔛','🔜','🔝','➰','➿','🔁','🔂'],
  objects:   ['💡','🔦','🕯️','📸','🎥','🖥️','💻','📱','⌨️','🖱️','📊','📈','📉','📋','📁','📝','✏️','🖊️','🔗','🔒','🔓','🔑','🗝️','🎵','🎶','🎸','🎹'],
  faces:     ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😌','😍','🥰','😘','😋','😛','😜','🤪','😝','🤑','🤗','🤔','😐','😑','😶','😏','😒','🙄','😬','😮','😲','😳','🥺','😦','😧','😨','😢','😭','😱','😤','😡','😠'],
};

const COLORS = ['#ffffff','#FF3B57','#FF9500','#FFD60A','#34C759','#00C7FF','#0A84FF','#BF5AF2','#000000'];

// ── DOM ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const previewCanvas = $('previewCanvas');
const overlayCanvas = $('overlayCanvas');
const pctx = previewCanvas.getContext('2d');
const octx = overlayCanvas.getContext('2d');
const overlayLayer = $('overlayLayer');
const videoTrack   = $('videoTrack');
const audioTrack   = $('audioTrack');
const overlayTrack = $('overlayTrack');
const tlRuler      = $('tlRuler');
const tlPlayhead   = $('tlPlayhead');

// ── STATE ─────────────────────────────────────────────────
const VS = {
  clips: [],          // {id, file, videoEl, duration, trimStart, trimEnd, startTime, speed, volume, filter, transIn, transOut, color}
  audioTracks: [],    // {id, file, audioEl, name, volume, offset, fadeIn, fadeOut, loop}
  overlays: [],       // {id, type, text/emoji/src, x, y, w, h, startTime, duration, fontSize, color, bold, italic, bg, pos}

  currentTime: 0,
  totalDuration: 0,
  playing: false,
  playInterval: null,
  lastFrameTime: null,

  selectedClip: null,
  selectedAudio: null,
  selectedOverlay: null,

  tlZoom: 3,         // pixels per second
  globalFilter: 'none',
  globalSpeed: 1,
  aspectRatio: 'source',
  exportQuality: 'medium',

  history: [],
  historyIndex: -1,

  cancelExport: false,
  selectedEmoji: '👍',
  newOverlayPos: 'center',
  newOverlayColor: '#ffffff',
  newOverlaySize: 32,

  clipIdCounter: 0,
  audioIdCounter: 0,
  overlayIdCounter: 0,
};

// ── INIT ─────────────────────────────────────────────────
$('vUploadZone').addEventListener('click', () => $('vFileInput').click());
$('vFileInput').addEventListener('change', e => {
  if (e.target.files[0]) loadVideoFile(e.target.files[0]);
});
$('vAddInput').addEventListener('change', e => {
  if (e.target.files[0]) loadVideoFile(e.target.files[0]);
});
$('vAddBtn').addEventListener('click', () => $('vAddInput').click());

$('vUploadZone').addEventListener('dragover', e => { e.preventDefault(); $('vUploadZone').classList.add('drag-over'); });
$('vUploadZone').addEventListener('dragleave', () => $('vUploadZone').classList.remove('drag-over'));
$('vUploadZone').addEventListener('drop', e => {
  e.preventDefault(); $('vUploadZone').classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('video/')) loadVideoFile(f);
});

// ── LOAD VIDEO ────────────────────────────────────────────
function loadVideoFile(file) {
  const vel = document.createElement('video');
  vel.preload = 'auto';
  vel.crossOrigin = 'anonymous';
  vel.muted = false;
  vel.style.display = 'none';
  document.body.appendChild(vel);

  const url = URL.createObjectURL(file);
  vel.src = url;

  vel.addEventListener('loadedmetadata', () => {
    const clip = {
      id: VS.clipIdCounter++,
      file, videoEl: vel,
      name: file.name.replace(/\.[^.]+$/, ''),
      duration: vel.duration,
      trimStart: 0,
      trimEnd: vel.duration,
      startTime: VS.clips.reduce((acc, c) => acc + (c.trimEnd - c.trimStart) / c.speed, 0),
      speed: 1,
      volume: 1,
      filter: 'none',
      transIn: 'none',
      transOut: 'none',
    };
    VS.clips.push(clip);
    recalcDuration();
    resizePreview();
    renderTimeline();
    seekTo(clip.startTime);
    saveHistory();
    showVEditor();
    $('vFileName').textContent = file.name.length > 22 ? file.name.slice(0,19)+'…' : file.name;
    vToast(`Loaded: ${file.name}`);
  }, { once: true });

  vel.addEventListener('error', () => vToast('Error loading video file'));
}

function showVEditor() {
  $('vLanding').classList.remove('active');
  $('vEditor').style.display = 'flex';
}

function recalcDuration() {
  VS.totalDuration = VS.clips.reduce((acc, c) => acc + (c.trimEnd - c.trimStart) / c.speed, 0);
  $('vTotalTime').textContent = fmtTime(VS.totalDuration);
  // update all audio/overlay sliders max
  updateSliderMaxes();
}

// ── PREVIEW RESIZE ────────────────────────────────────────
function resizePreview() {
  if (!VS.clips.length) return;
  const vel = VS.clips[0].videoEl;
  const vw = vel.videoWidth || 1280, vh = vel.videoHeight || 720;
  const area = $('previewArea');
  const maxW = area.clientWidth - 20, maxH = area.clientHeight - 20;
  let scale = Math.min(1, maxW / vw, maxH / vh);
  // aspect ratio override
  let tw = vw, th = vh;
  if (VS.aspectRatio !== 'source') {
    const [rw, rh] = VS.aspectRatio.split(':').map(Number);
    th = Math.round(tw * rh / rw);
    scale = Math.min(1, maxW / tw, maxH / th);
  }
  const dw = Math.round(tw * scale), dh = Math.round(th * scale);
  [previewCanvas, overlayCanvas].forEach(c => {
    c.width = tw; c.height = th;
    c.style.width = dw+'px'; c.style.height = dh+'px';
  });
  overlayLayer.style.width = dw+'px'; overlayLayer.style.height = dh+'px';
  $('previewWrap').style.width = dw+'px'; $('previewWrap').style.height = dh+'px';
}

// ── PLAYBACK ─────────────────────────────────────────────
$('vPlayBtn').addEventListener('click', togglePlay);

function togglePlay() {
  VS.playing ? pause() : play();
}

function play() {
  if (!VS.clips.length) return;
  VS.playing = true;
  $('vPlayBtn').textContent = '⏸';
  VS.lastFrameTime = performance.now();
  VS.playInterval = requestAnimationFrame(playLoop);
  // start audio tracks
  VS.audioTracks.forEach(at => {
    if (VS.currentTime >= at.offset) {
      at.audioEl.currentTime = VS.currentTime - at.offset;
      at.audioEl.volume = at.volume;
      at.audioEl.loop = at.loop;
      at.audioEl.play().catch(()=>{});
    }
  });
  // start current clip audio
  const clipAt = getClipAt(VS.currentTime);
  if (clipAt) {
    const localTime = getLocalTime(clipAt, VS.currentTime);
    clipAt.videoEl.currentTime = localTime;
    clipAt.videoEl.playbackRate = clipAt.speed;
    clipAt.videoEl.volume = $('muteVideoAudio').checked ? 0 : clipAt.volume;
    clipAt.videoEl.play().catch(()=>{});
  }
}

function pause() {
  VS.playing = false;
  $('vPlayBtn').textContent = '▶';
  cancelAnimationFrame(VS.playInterval);
  VS.clips.forEach(c => c.videoEl.pause());
  VS.audioTracks.forEach(at => at.audioEl.pause());
}

function playLoop(ts) {
  if (!VS.playing) return;
  const elapsed = (ts - VS.lastFrameTime) / 1000;
  VS.lastFrameTime = ts;
  VS.currentTime = Math.min(VS.totalDuration, VS.currentTime + elapsed);
  if (VS.currentTime >= VS.totalDuration) {
    VS.currentTime = VS.totalDuration;
    pause();
    renderFrame();
    return;
  }
  renderFrame();
  updatePlayhead();
  $('vCurrentTime').textContent = fmtTime(VS.currentTime);
  VS.playInterval = requestAnimationFrame(playLoop);
}

function seekTo(t) {
  VS.currentTime = Math.max(0, Math.min(VS.totalDuration, t));
  $('vCurrentTime').textContent = fmtTime(VS.currentTime);
  updatePlayhead();
  renderFrame();
}

function getClipAt(t) {
  let acc = 0;
  for (const c of VS.clips) {
    const dur = (c.trimEnd - c.trimStart) / c.speed;
    if (t >= acc && t < acc + dur) return c;
    acc += dur;
  }
  return VS.clips.length ? VS.clips[VS.clips.length-1] : null;
}

function getClipStart(clip) {
  let acc = 0;
  for (const c of VS.clips) {
    if (c.id === clip.id) return acc;
    acc += (c.trimEnd - c.trimStart) / c.speed;
  }
  return 0;
}

function getLocalTime(clip, globalT) {
  const cs = getClipStart(clip);
  return clip.trimStart + (globalT - cs) * clip.speed;
}

// ── RENDER FRAME ─────────────────────────────────────────
function renderFrame() {
  const clip = getClipAt(VS.currentTime);
  if (!clip) { pctx.clearRect(0,0,previewCanvas.width,previewCanvas.height); return; }

  // sync video element if not playing
  if (!VS.playing) {
    const lt = getLocalTime(clip, VS.currentTime);
    if (Math.abs(clip.videoEl.currentTime - lt) > 0.08) clip.videoEl.currentTime = lt;
  }

  pctx.save();
  pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

  // filter
  const f = clip.filter !== 'none' ? clip.filter : VS.globalFilter !== 'none' ? VS.globalFilter : 'none';
  pctx.filter = f;

  // transitions
  const cs = getClipStart(clip);
  const localT = VS.currentTime - cs;
  const clipDur = (clip.trimEnd - clip.trimStart) / clip.speed;
  let alpha = 1;
  const fadeDur = 0.5;
  if (clip.transIn === 'fade' && localT < fadeDur) alpha = localT / fadeDur;
  if (clip.transOut === 'fade' && localT > clipDur - fadeDur) alpha = (clipDur - localT) / fadeDur;
  pctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  // zoom transition
  let sx = 0, sy = 0, sw = previewCanvas.width, sh = previewCanvas.height;
  if (clip.transIn === 'zoom' && localT < fadeDur) {
    const zf = 1 + (1-localT/fadeDur)*0.15;
    sx = sw*(zf-1)/2; sy = sh*(zf-1)/2; sw = previewCanvas.width/zf; sh = previewCanvas.height/zf;
  }

  pctx.drawImage(clip.videoEl, 0, 0, previewCanvas.width, previewCanvas.height);
  pctx.filter = 'none'; pctx.globalAlpha = 1;
  pctx.restore();

  // render overlays
  renderOverlays();
}

function renderOverlays() {
  octx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  // update DOM overlay visibility
  document.querySelectorAll('.video-overlay-el').forEach(el => {
    const ov = VS.overlays.find(o => o.id === +el.dataset.id);
    if (!ov) return;
    const visible = VS.currentTime >= ov.startTime && VS.currentTime < ov.startTime + ov.duration;
    el.style.display = visible ? 'flex' : 'none';
  });
}

// ── TIMELINE ─────────────────────────────────────────────
function pxPerSec() { return VS.tlZoom * 20; }

function renderTimeline() {
  renderRuler();
  renderVideoTrack();
  renderAudioTrackUI();
  renderOverlayTrack();
  updatePlayhead();
}

function renderRuler() {
  tlRuler.innerHTML = '';
  const pps = pxPerSec();
  const total = Math.max(VS.totalDuration, 10);
  tlRuler.style.width = (total * pps + 20) + 'px';
  const step = pps > 60 ? 1 : pps > 20 ? 2 : 5;
  for (let t = 0; t <= total + step; t += step) {
    const mark = document.createElement('div');
    mark.className = 'tl-ruler-mark';
    mark.style.left = (t * pps) + 'px';
    mark.textContent = fmtTimeSec(t);
    tlRuler.appendChild(mark);
  }
}

function renderVideoTrack() {
  // Remove old clips (keep playhead)
  [...videoTrack.children].forEach(el => { if (!el.classList.contains('tl-playhead')) el.remove(); });
  const pps = pxPerSec();
  videoTrack.style.width = (VS.totalDuration * pps + 20) + 'px';

  VS.clips.forEach(clip => {
    const cs = getClipStart(clip);
    const dur = (clip.trimEnd - clip.trimStart) / clip.speed;
    const el = document.createElement('div');
    el.className = 'tl-clip' + (clip === VS.selectedClip ? ' selected' : '');
    el.dataset.id = clip.id;
    el.style.left = (cs * pps) + 'px';
    el.style.width = Math.max(4, dur * pps) + 'px';

    // thumbnail bg
    const thumb = document.createElement('div');
    thumb.className = 'tl-clip-thumb';
    captureThumbnail(clip, thumb);
    el.appendChild(thumb);

    const label = document.createElement('div');
    label.className = 'tl-clip-label';
    label.textContent = clip.name || `Clip ${clip.id+1}`;
    el.appendChild(label);

    // trim handles
    ['left','right'].forEach(side => {
      const h = document.createElement('div');
      h.className = `tl-trim-handle ${side}`;
      h.textContent = '⋮';
      h.addEventListener('mousedown', e => startTrim(e, clip, side));
      el.appendChild(h);
    });

    el.addEventListener('click', e => {
      if (e.target.classList.contains('tl-trim-handle')) return;
      selectClip(clip);
    });
    el.addEventListener('mousedown', e => {
      if (e.target.classList.contains('tl-trim-handle')) return;
      startDragClip(e, clip);
    });

    videoTrack.appendChild(el);
  });
}

function captureThumbnail(clip, thumbEl) {
  const vc = clip.videoEl;
  const old = vc.currentTime;
  const tc = document.createElement('canvas');
  tc.width = 120; tc.height = 68;
  const tctx = tc.getContext('2d');
  const snap = () => {
    tctx.drawImage(vc, 0, 0, tc.width, tc.height);
    thumbEl.style.backgroundImage = `url(${tc.toDataURL()})`;
    vc.currentTime = old;
  };
  vc.currentTime = clip.trimStart + (clip.trimEnd - clip.trimStart) * 0.1;
  vc.addEventListener('seeked', snap, { once: true });
}

function renderAudioTrackUI() {
  audioTrack.innerHTML = '';
  const pps = pxPerSec();
  VS.audioTracks.forEach(at => {
    const el = document.createElement('div');
    el.className = 'tl-clip tl-audio-clip' + (at === VS.selectedAudio ? ' selected' : '');
    el.dataset.audioId = at.id;
    el.style.left = (at.offset * pps) + 'px';
    el.style.width = Math.max(4, at.audioEl.duration * pps) + 'px';
    const label = document.createElement('div');
    label.className = 'tl-clip-label';
    label.textContent = '♪ ' + at.name;
    el.appendChild(label);
    el.addEventListener('click', () => selectAudio(at));
    audioTrack.appendChild(el);
  });
}

function renderOverlayTrack() {
  overlayTrack.innerHTML = '';
  const pps = pxPerSec();
  VS.overlays.forEach(ov => {
    const el = document.createElement('div');
    el.className = 'tl-clip tl-overlay-clip' + (ov === VS.selectedOverlay ? ' selected' : '');
    el.style.left = (ov.startTime * pps) + 'px';
    el.style.width = Math.max(4, ov.duration * pps) + 'px';
    const label = document.createElement('div');
    label.className = 'tl-clip-label';
    label.textContent = (ov.type === 'text' ? 'T ' : ov.type === 'emoji' ? '★ ' : '🖼 ') + (ov.text || ov.emoji || 'Overlay');
    el.appendChild(label);
    el.addEventListener('click', () => selectOverlay(ov));
    overlayTrack.appendChild(el);
  });
}

function updatePlayhead() {
  const pps = pxPerSec();
  const left = VS.currentTime * pps;
  // update all playheads
  document.querySelectorAll('.tl-playhead').forEach(ph => ph.style.left = left + 'px');
  // also draw on ruler
  tlRuler.style.setProperty('--ph', left + 'px');
}

// ── TIMELINE CLICK TO SEEK ────────────────────────────────
[$('tlRuler'), videoTrack, audioTrack, overlayTrack].forEach(el => {
  el.addEventListener('click', e => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    seekTo(x / pxPerSec());
  });
});

// ── TRIM HANDLES ─────────────────────────────────────────
function startTrim(e, clip, side) {
  e.stopPropagation();
  const startX = e.clientX;
  const origStart = clip.trimStart, origEnd = clip.trimEnd;
  const pps = pxPerSec();
  const onMove = ev => {
    const dx = (ev.clientX - startX) / pps * clip.speed;
    if (side === 'left') {
      clip.trimStart = Math.max(0, Math.min(origStart + dx, clip.trimEnd - 0.1));
    } else {
      clip.trimEnd = Math.max(clip.trimStart + 0.1, Math.min(origEnd + dx, clip.duration));
    }
    recalcDuration(); renderTimeline(); renderFrame();
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    saveHistory();
    if (VS.selectedClip === clip) updateClipProps(clip);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ── DRAG CLIP ─────────────────────────────────────────────
function startDragClip(e, clip) {
  const startX = e.clientX;
  const origIndex = VS.clips.indexOf(clip);
  const pps = pxPerSec();
  const onMove = ev => {
    const dx = ev.clientX - startX;
    const newIndex = Math.max(0, Math.min(VS.clips.length-1, origIndex + Math.round(dx / (((clip.trimEnd-clip.trimStart)/clip.speed)*pps))));
    if (newIndex !== VS.clips.indexOf(clip)) {
      VS.clips.splice(VS.clips.indexOf(clip), 1);
      VS.clips.splice(newIndex, 0, clip);
      recalcDuration(); renderTimeline();
    }
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    saveHistory();
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ── ZOOM ─────────────────────────────────────────────────
$('tlZoom').addEventListener('input', e => { VS.tlZoom = +e.target.value; renderTimeline(); });
$('tlZoomIn').onclick  = () => { VS.tlZoom = Math.min(20, VS.tlZoom + 1); $('tlZoom').value = VS.tlZoom; renderTimeline(); };
$('tlZoomOut').onclick = () => { VS.tlZoom = Math.max(1, VS.tlZoom - 1); $('tlZoom').value = VS.tlZoom; renderTimeline(); };

// ── SELECTION ─────────────────────────────────────────────
function selectClip(clip) {
  VS.selectedClip = clip; VS.selectedAudio = null; VS.selectedOverlay = null;
  showProps('clip');
  updateClipProps(clip);
  renderTimeline();
}
function selectAudio(at) {
  VS.selectedAudio = at; VS.selectedClip = null; VS.selectedOverlay = null;
  showProps('audio');
  updateAudioProps(at);
  renderTimeline();
}
function selectOverlay(ov) {
  VS.selectedOverlay = ov; VS.selectedClip = null; VS.selectedAudio = null;
  showProps('overlay');
  updateOverlayProps(ov);
  renderTimeline();
}
function deselect() {
  VS.selectedClip = null; VS.selectedAudio = null; VS.selectedOverlay = null;
  showProps('none');
  renderTimeline();
}

function showProps(type) {
  $('vpEmpty').classList.toggle('hidden', type !== 'none');
  $('clipProps').classList.toggle('hidden', type !== 'clip');
  $('textOverlayProps').classList.toggle('hidden', type !== 'overlay');
  $('audioProps').classList.toggle('hidden', type !== 'audio');
}

// ── CLIP PROPS ────────────────────────────────────────────
function updateClipProps(clip) {
  $('trimStart').max = clip.duration;
  $('trimEnd').max = clip.duration;
  $('trimStart').value = clip.trimStart;
  $('trimEnd').value = clip.trimEnd;
  $('trimStartVal').textContent = clip.trimStart.toFixed(1)+'s';
  $('trimEndVal').textContent = clip.trimEnd.toFixed(1)+'s';
  $('clipSpeed').value = clip.speed * 100;
  $('clipSpeedVal').textContent = clip.speed.toFixed(2).replace(/\.?0+$/,'')+'×';
  $('clipVolume').value = clip.volume * 100;
  $('clipVolumeVal').textContent = Math.round(clip.volume*100)+'%';
  $('clipFilter').value = clip.filter;
  $('transitionIn').value = clip.transIn;
  $('transitionOut').value = clip.transOut;
}

$('trimStart').addEventListener('input', e => {
  if (!VS.selectedClip) return;
  VS.selectedClip.trimStart = Math.min(+e.target.value, VS.selectedClip.trimEnd - 0.1);
  $('trimStartVal').textContent = VS.selectedClip.trimStart.toFixed(1)+'s';
  recalcDuration(); renderTimeline(); renderFrame();
});
$('trimEnd').addEventListener('input', e => {
  if (!VS.selectedClip) return;
  VS.selectedClip.trimEnd = Math.max(+e.target.value, VS.selectedClip.trimStart + 0.1);
  $('trimEndVal').textContent = VS.selectedClip.trimEnd.toFixed(1)+'s';
  recalcDuration(); renderTimeline(); renderFrame();
});
$('clipSpeed').addEventListener('input', e => {
  if (!VS.selectedClip) return;
  VS.selectedClip.speed = +e.target.value / 100;
  VS.selectedClip.videoEl.playbackRate = VS.selectedClip.speed;
  $('clipSpeedVal').textContent = VS.selectedClip.speed.toFixed(2).replace(/\.?0+$/,'')+'×';
  recalcDuration(); renderTimeline();
});
$('clipVolume').addEventListener('input', e => {
  if (!VS.selectedClip) return;
  VS.selectedClip.volume = +e.target.value / 100;
  $('clipVolumeVal').textContent = Math.round(VS.selectedClip.volume*100)+'%';
});
$('clipFilter').addEventListener('change', e => {
  if (!VS.selectedClip) return;
  VS.selectedClip.filter = e.target.value; renderFrame();
});
$('transitionIn').addEventListener('change', e => { if (VS.selectedClip) VS.selectedClip.transIn = e.target.value; });
$('transitionOut').addEventListener('change', e => { if (VS.selectedClip) VS.selectedClip.transOut = e.target.value; });

$('deleteClipBtn').onclick = $('deleteClipPropBtn').onclick = () => {
  if (!VS.selectedClip) return;
  VS.selectedClip.videoEl.pause();
  VS.selectedClip.videoEl.remove();
  VS.clips = VS.clips.filter(c => c !== VS.selectedClip);
  VS.selectedClip = null;
  recalcDuration(); renderTimeline(); renderFrame();
  showProps('none'); saveHistory();
  vToast('Clip removed');
};

// ── SPLIT CLIP ────────────────────────────────────────────
$('splitBtn').onclick = () => {
  const clip = getClipAt(VS.currentTime);
  if (!clip) return;
  const localT = getLocalTime(clip, VS.currentTime);
  if (localT <= clip.trimStart + 0.05 || localT >= clip.trimEnd - 0.05) { vToast('Playhead too close to clip edge'); return; }

  const newVel = document.createElement('video');
  newVel.src = clip.videoEl.src; newVel.preload='auto'; newVel.crossOrigin='anonymous'; newVel.muted=false;
  newVel.style.display='none'; document.body.appendChild(newVel);

  const newClip = { ...clip, id: VS.clipIdCounter++, videoEl: newVel, trimStart: localT, name: clip.name+' (2)' };
  clip.trimEnd = localT;

  const idx = VS.clips.indexOf(clip);
  VS.clips.splice(idx+1, 0, newClip);
  recalcDuration(); renderTimeline(); renderFrame(); saveHistory();
  vToast('Clip split at ' + fmtTime(VS.currentTime));
};

// ── AUDIO ─────────────────────────────────────────────────
$('addAudioBtn').onclick = () => $('audioFileInput').click();
$('audioFileInput').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const ael = new Audio(URL.createObjectURL(file));
  ael.preload = 'auto';
  ael.addEventListener('loadedmetadata', () => {
    const at = {
      id: VS.audioIdCounter++, file, audioEl: ael,
      name: file.name.replace(/\.[^.]+$/,''),
      volume: 1, offset: 0, fadeIn: 0, fadeOut: 0, loop: false,
    };
    VS.audioTracks.push(at);
    renderTimeline(); saveHistory(); selectAudio(at);
    vToast('Audio added: ' + at.name);
    updateSliderMaxes();
  }, { once: true });
});

$('videoVolume').addEventListener('input', e => {
  VS.clips.forEach(c => c.volume = +e.target.value/100);
  $('videoVolVal').textContent = e.target.value+'%';
});
$('muteVideoAudio').addEventListener('change', e => {
  VS.clips.forEach(c => c.videoEl.muted = e.target.checked);
});

function updateAudioProps(at) {
  $('audioVolume').value = at.volume * 100;
  $('audioVolVal').textContent = Math.round(at.volume*100)+'%';
  $('audioOffset').max = VS.totalDuration;
  $('audioOffset').value = at.offset;
  $('audioOffsetVal').textContent = at.offset.toFixed(1)+'s';
  $('audioFadeIn').value = at.fadeIn;
  $('audioFadeInVal').textContent = at.fadeIn.toFixed(1)+'s';
  $('audioFadeOut').value = at.fadeOut;
  $('audioFadeOutVal').textContent = at.fadeOut.toFixed(1)+'s';
  $('audioLoop').checked = at.loop;
}

$('audioVolume').addEventListener('input', e => {
  if (!VS.selectedAudio) return;
  VS.selectedAudio.volume = +e.target.value/100; VS.selectedAudio.audioEl.volume = VS.selectedAudio.volume;
  $('audioVolVal').textContent = Math.round(VS.selectedAudio.volume*100)+'%';
});
$('audioOffset').addEventListener('input', e => {
  if (!VS.selectedAudio) return;
  VS.selectedAudio.offset = +e.target.value;
  $('audioOffsetVal').textContent = VS.selectedAudio.offset.toFixed(1)+'s';
  renderTimeline();
});
$('audioFadeIn').addEventListener('input', e => {
  if (!VS.selectedAudio) return;
  VS.selectedAudio.fadeIn = +e.target.value;
  $('audioFadeInVal').textContent = VS.selectedAudio.fadeIn.toFixed(1)+'s';
});
$('audioFadeOut').addEventListener('input', e => {
  if (!VS.selectedAudio) return;
  VS.selectedAudio.fadeOut = +e.target.value;
  $('audioFadeOutVal').textContent = VS.selectedAudio.fadeOut.toFixed(1)+'s';
});
$('audioLoop').addEventListener('change', e => { if (VS.selectedAudio) VS.selectedAudio.loop = e.target.checked; });
$('deleteAudioBtn').onclick = () => {
  if (!VS.selectedAudio) return;
  VS.selectedAudio.audioEl.pause();
  VS.audioTracks = VS.audioTracks.filter(a => a !== VS.selectedAudio);
  VS.selectedAudio = null; showProps('none');
  renderTimeline(); saveHistory(); vToast('Audio removed');
};

// ── OVERLAYS ──────────────────────────────────────────────
function buildMiniColors(containerId, onSelect) {
  const el = $(containerId);
  if (!el) return;
  el.innerHTML = '';
  COLORS.forEach(c => {
    const sw = document.createElement('button');
    sw.className = 'mini-swatch' + (c === VS.newOverlayColor ? ' active' : '');
    sw.style.background = c;
    if (c === '#ffffff') sw.style.border = '2px solid #888';
    sw.addEventListener('click', () => {
      el.querySelectorAll('.mini-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      onSelect(c);
    });
    el.appendChild(sw);
  });
}

// TEXT OVERLAY
$('addTextBtn').onclick = () => {
  $('addTextModal').classList.remove('hidden');
  buildMiniColors('newOlColors', c => { VS.newOverlayColor = c; });
  // reset pos buttons
  $('addTextModal').querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
  $('addTextModal').querySelector('[data-pos="center"]').classList.add('active');
  VS.newOverlayPos = 'center';
};
$('addTextModal').querySelectorAll('.pos-btn').forEach(b => {
  b.addEventListener('click', () => {
    $('addTextModal').querySelectorAll('.pos-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); VS.newOverlayPos = b.dataset.pos;
  });
});
$('newOlSize').addEventListener('input', e => { VS.newOverlaySize=+e.target.value; $('newOlSizeVal').textContent=VS.newOverlaySize+'px'; });
[$('closeTextModal'),$('cancelTextModal')].forEach(b=>b.onclick=()=>$('addTextModal').classList.add('hidden'));
$('confirmTextModal').onclick = () => {
  const text = $('newOverlayText').value.trim(); if (!text) return;
  addOverlay({ type:'text', text, color:VS.newOverlayColor, fontSize:VS.newOverlaySize, pos:VS.newOverlayPos, bold:false, italic:false, bg:'none' });
  $('addTextModal').classList.add('hidden');
  $('newOverlayText').value = '';
};

// EMOJI OVERLAY
let vSelectedEmoji = '👍';
buildVEmojiGrid('reactions');
$('vEmojiTabs').querySelectorAll('.etab').forEach(tab => {
  tab.addEventListener('click', () => {
    $('vEmojiTabs').querySelectorAll('.etab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active'); buildVEmojiGrid(tab.dataset.cat);
  });
});
function buildVEmojiGrid(cat) {
  const grid = $('vEmojiGrid'); grid.innerHTML='';
  (EMOJIS[cat]||EMOJIS.reactions).forEach(em => {
    const btn=document.createElement('button'); btn.className='em-btn'+(em===vSelectedEmoji?' sel':'');
    btn.textContent=em;
    btn.addEventListener('click',()=>{ grid.querySelectorAll('.em-btn').forEach(b=>b.classList.remove('sel')); btn.classList.add('sel'); vSelectedEmoji=em; });
    grid.appendChild(btn);
  });
}
$('vEmojiSize').addEventListener('input', e=>$('vEmojiSizeVal').textContent=e.target.value+'px');
$('addEmojiBtn').onclick=()=>$('addEmojiModal').classList.remove('hidden');
[$('closeEmojiModal'),$('cancelEmojiModal')].forEach(b=>b.onclick=()=>$('addEmojiModal').classList.add('hidden'));
$('confirmEmojiModal').onclick=()=>{
  addOverlay({ type:'emoji', emoji:vSelectedEmoji, fontSize:+$('vEmojiSize').value, pos:VS.newOverlayPos });
  $('addEmojiModal').classList.add('hidden');
};

// GIF + IMAGE
$('addGifBtn').onclick=()=>$('gifFileInput').click();
$('gifFileInput').addEventListener('change',e=>{ const f=e.target.files[0]; if(f) addOverlay({type:'gif', src:URL.createObjectURL(f), name:f.name, pos:'center'}); });
$('addImageBtn').onclick=()=>$('overlayImageInput').click();
$('overlayImageInput').addEventListener('change',e=>{ const f=e.target.files[0]; if(f) addOverlay({type:'image', src:URL.createObjectURL(f), name:f.name, pos:'center'}); });

function addOverlay(data) {
  const ov = {
    id: VS.overlayIdCounter++,
    type: data.type,
    text: data.text||'',
    emoji: data.emoji||'',
    src: data.src||'',
    name: data.name||'',
    color: data.color||'#ffffff',
    fontSize: data.fontSize||32,
    bold: data.bold||false,
    italic: data.italic||false,
    bg: data.bg||'none',
    pos: data.pos||'center',
    startTime: VS.currentTime,
    duration: Math.min(5, VS.totalDuration - VS.currentTime),
  };
  VS.overlays.push(ov);
  createOverlayDOM(ov);
  renderTimeline(); saveHistory(); selectOverlay(ov);
  vToast('Overlay added');
}

function posToCSS(pos, pw, ph) {
  const map = {
    'top-left':      { top:'5%', left:'5%' },
    'top-center':    { top:'5%', left:'50%', transform:'translateX(-50%)' },
    'top-right':     { top:'5%', right:'5%' },
    'center':        { top:'50%', left:'50%', transform:'translate(-50%,-50%)' },
    'bottom-left':   { bottom:'8%', left:'5%' },
    'bottom-center': { bottom:'8%', left:'50%', transform:'translateX(-50%)' },
    'bottom-right':  { bottom:'8%', right:'5%' },
  };
  return map[pos] || map['center'];
}

function createOverlayDOM(ov) {
  const el = document.createElement('div');
  el.className = 'video-overlay-el';
  el.dataset.id = ov.id;

  // position
  const pos = posToCSS(ov.pos);
  Object.assign(el.style, pos);

  // content
  if (ov.type === 'text') {
    el.style.color = ov.color;
    el.style.fontSize = ov.fontSize + 'px';
    el.style.fontWeight = ov.bold ? 'bold' : 'normal';
    el.style.fontStyle = ov.italic ? 'italic' : 'normal';
    if (ov.bg === 'dark') el.style.background = 'rgba(0,0,0,0.6)';
    el.textContent = ov.text;
  } else if (ov.type === 'emoji') {
    el.style.fontSize = ov.fontSize + 'px';
    el.textContent = ov.emoji;
  } else if (ov.type === 'gif' || ov.type === 'image') {
    const img = document.createElement('img');
    img.src = ov.src; img.style.maxWidth = '200px'; img.style.maxHeight = '200px';
    img.style.borderRadius = '4px'; el.appendChild(img);
  }

  // delete button
  const del = document.createElement('button');
  del.className = 'ol-delete'; del.textContent = '✕';
  del.addEventListener('click', e => { e.stopPropagation(); removeOverlay(ov); });
  el.appendChild(del);

  // select on click
  el.addEventListener('click', () => selectOverlay(ov));

  // drag
  let ox, oy;
  el.addEventListener('mousedown', e => {
    ox = e.clientX - el.offsetLeft; oy = e.clientY - el.offsetTop;
    el.style.cursor = 'grabbing';
    const onMove = ev => {
      el.style.left = (ev.clientX - ox) + 'px'; el.style.top = (ev.clientY - oy) + 'px';
      el.style.transform = ''; el.style.right = ''; el.style.bottom = '';
    };
    const onUp = () => {
      el.style.cursor = 'move';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  overlayLayer.appendChild(el);
}

function removeOverlay(ov) {
  VS.overlays = VS.overlays.filter(o => o !== ov);
  overlayLayer.querySelector(`[data-id="${ov.id}"]`)?.remove();
  if (VS.selectedOverlay === ov) { VS.selectedOverlay=null; showProps('none'); }
  renderTimeline(); saveHistory(); vToast('Overlay removed');
}

// OVERLAY PROPS
function updateOverlayProps(ov) {
  if (ov.type !== 'text') return;
  $('overlayText').value = ov.text||'';
  $('olFontSize').value = ov.fontSize||32;
  $('olFontSizeVal').textContent = (ov.fontSize||32)+'px';
  $('olStartTime').max = VS.totalDuration;
  $('olStartTime').value = ov.startTime;
  $('olStartVal').textContent = ov.startTime.toFixed(1)+'s';
  $('olDuration').value = ov.duration;
  $('olDurVal').textContent = ov.duration.toFixed(1)+'s';
  buildMiniColors('olColorGrid', c => {
    if (!VS.selectedOverlay) return;
    VS.selectedOverlay.color = c;
    const el = overlayLayer.querySelector(`[data-id="${ov.id}"]`);
    if (el) el.style.color = c;
  });
}

$('overlayText').addEventListener('input', e => {
  if (!VS.selectedOverlay) return;
  VS.selectedOverlay.text = e.target.value;
  const el = overlayLayer.querySelector(`[data-id="${VS.selectedOverlay.id}"]`);
  if (el) el.childNodes[0].textContent = e.target.value;
});
$('olFontSize').addEventListener('input', e => {
  if (!VS.selectedOverlay) return;
  VS.selectedOverlay.fontSize = +e.target.value;
  $('olFontSizeVal').textContent = VS.selectedOverlay.fontSize+'px';
  const el = overlayLayer.querySelector(`[data-id="${VS.selectedOverlay.id}"]`);
  if (el) el.style.fontSize = VS.selectedOverlay.fontSize+'px';
});
$('olStartTime').addEventListener('input', e => {
  if (!VS.selectedOverlay) return;
  VS.selectedOverlay.startTime = +e.target.value;
  $('olStartVal').textContent = VS.selectedOverlay.startTime.toFixed(1)+'s';
  renderTimeline();
});
$('olDuration').addEventListener('input', e => {
  if (!VS.selectedOverlay) return;
  VS.selectedOverlay.duration = +e.target.value;
  $('olDurVal').textContent = VS.selectedOverlay.duration.toFixed(1)+'s';
  renderTimeline();
});
['olBgNone','olBgDark','olBgColor'].forEach((id,i) => {
  $(id).addEventListener('click', () => {
    if (!VS.selectedOverlay) return;
    const bgs=['none','dark','color'];
    VS.selectedOverlay.bg = bgs[i];
    ['olBgNone','olBgDark','olBgColor'].forEach(b=>$(b).classList.remove('active'));
    $(id).classList.add('active');
    const el = overlayLayer.querySelector(`[data-id="${VS.selectedOverlay.id}"]`);
    if (el) el.style.background = i===1?'rgba(0,0,0,0.6)':i===2?VS.selectedOverlay.color:'transparent';
  });
});
['olBold','olItalic'].forEach((id,i) => {
  $(id).addEventListener('click',()=>{
    if (!VS.selectedOverlay) return;
    const prop = i===0?'bold':'italic';
    VS.selectedOverlay[prop]=!VS.selectedOverlay[prop];
    $(id).classList.toggle('active',VS.selectedOverlay[prop]);
    const el=overlayLayer.querySelector(`[data-id="${VS.selectedOverlay.id}"]`);
    if (el) el.style[i===0?'fontWeight':'fontStyle']=VS.selectedOverlay[prop]?(i===0?'bold':'italic'):'normal';
  });
});
$('deleteOverlayBtn').onclick = () => { if (VS.selectedOverlay) removeOverlay(VS.selectedOverlay); };

// POSITION BUTTONS
document.querySelectorAll('#textOverlayProps .pos-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#textOverlayProps .pos-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    if (VS.selectedOverlay) {
      VS.selectedOverlay.pos = b.dataset.pos;
      const el = overlayLayer.querySelector(`[data-id="${VS.selectedOverlay.id}"]`);
      if (el) { Object.assign(el.style, {top:'',left:'',right:'',bottom:'',transform:''}); Object.assign(el.style, posToCSS(b.dataset.pos)); }
    }
  });
});

// ── FILTERS + SPEED (global) ───────────────────────────────
document.querySelectorAll('.filt-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filt-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); VS.globalFilter = btn.dataset.filter;
    renderFrame();
  });
});
document.querySelectorAll('.spd-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.spd-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    VS.globalSpeed = +btn.dataset.speed;
    VS.clips.forEach(c => { c.speed = VS.globalSpeed; c.videoEl.playbackRate = VS.globalSpeed; });
    recalcDuration(); renderTimeline();
  });
});

// ── ASPECT RATIO ──────────────────────────────────────────
document.querySelectorAll('.ratio-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ratio-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); VS.aspectRatio = btn.dataset.ratio;
    resizePreview(); renderFrame();
  });
});

// ── EXPORT ────────────────────────────────────────────────
$('vExportArrow').onclick = e => { e.stopPropagation(); $('vExportMenu').classList.toggle('hidden'); };
document.addEventListener('click', () => $('vExportMenu').classList.add('hidden'));

document.querySelectorAll('#vExportMenu .dlm-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.quality) VS.exportQuality = btn.dataset.quality;
    if (btn.dataset.format === 'gif') startExport('gif');
    else if (btn.dataset.format === 'webm') startExport('webm');
    else startExport('mp4');
  });
});

$('vExportBtn').onclick = $('startExportBtn').onclick = () => startExport($('exportFormat').value);

['qualDraft','qualMed','qualHigh'].forEach((id,i) => {
  $(id).addEventListener('click', () => {
    VS.exportQuality = ['draft','medium','high'][i];
    ['qualDraft','qualMed','qualHigh'].forEach(b=>$(b).classList.remove('active'));
    $(id).classList.add('active');
  });
});

function startExport(format) {
  if (!VS.clips.length) { vToast('No video clips to export'); return; }
  $('exportModal').classList.remove('hidden');
  $('expStatus').textContent = 'Preparing...';
  setExpProgress(0);
  VS.cancelExport = false;
  if (format === 'mp4' || format === 'webm') exportMediaRecorder(format);
  else if (format === 'gif') exportGif();
}

$('cancelExportBtn').onclick = () => { VS.cancelExport = true; $('exportModal').classList.add('hidden'); vToast('Export cancelled'); };

function setExpProgress(pct, msg) {
  const p = Math.round(pct);
  $('expBarModal').style.width = p+'%';
  $('expPctModal').textContent = p+'%';
  if (msg) $('expStatus').textContent = msg;
}

async function exportMediaRecorder(format) {
  pause();
  setExpProgress(0, 'Setting up export...');

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = previewCanvas.width;
  exportCanvas.height = previewCanvas.height;
  const ectx = exportCanvas.getContext('2d');

  const stream = exportCanvas.captureStream(30);

  // Add audio if present
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();

  // Connect video audio
  VS.clips.forEach(c => {
    try {
      const src = audioCtx.createMediaElementSource(c.videoEl);
      const gain = audioCtx.createGain();
      gain.gain.value = c.volume;
      src.connect(gain); gain.connect(dest);
    } catch(e){}
  });
  VS.audioTracks.forEach(at => {
    try {
      const src = audioCtx.createMediaElementSource(at.audioEl);
      const gain = audioCtx.createGain();
      gain.gain.value = at.volume;
      src.connect(gain); gain.connect(dest);
    } catch(e){}
  });

  dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));

  const mimeType = format === 'webm' ? 'video/webm;codecs=vp9' : 'video/webm;codecs=vp8';
  let recorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VS.exportQuality==='high'?8000000:VS.exportQuality==='draft'?2000000:4000000 });
  } catch {
    recorder = new MediaRecorder(stream, { videoBitsPerSecond: 4000000 });
  }

  const chunks = [];
  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.start(100);

  // Seek to start and play
  seekTo(0); await sleep(100);
  VS.clips.forEach(c => { c.videoEl.currentTime = c.trimStart; c.videoEl.playbackRate = c.speed; });
  VS.clips[0].videoEl.play().catch(()=>{});

  const fps = 30;
  const frameDur = 1/fps;
  let t = 0;

  setExpProgress(1, 'Rendering frames...');

  const renderLoop = async () => {
    if (VS.cancelExport) { recorder.stop(); return; }
    if (t >= VS.totalDuration) {
      setExpProgress(99, 'Finalizing...');
      await sleep(200);
      recorder.stop();
      return;
    }

    const clip = getClipAt(t);
    if (clip) {
      const lt = getLocalTime(clip, t);
      if (Math.abs(clip.videoEl.currentTime - lt) > 0.12) clip.videoEl.currentTime = lt;
      ectx.clearRect(0,0,exportCanvas.width,exportCanvas.height);
      const f = clip.filter !== 'none' ? clip.filter : VS.globalFilter !== 'none' ? VS.globalFilter : 'none';
      ectx.filter = f;
      ectx.drawImage(clip.videoEl, 0, 0, exportCanvas.width, exportCanvas.height);
      ectx.filter = 'none';
    }

    t += frameDur;
    setExpProgress((t / VS.totalDuration) * 95, `Rendering... ${Math.round(t)}s / ${Math.round(VS.totalDuration)}s`);
    await sleep(frameDur * 1000 * 0.8);
    requestAnimationFrame(renderLoop);
  };

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `editr_export_${Date.now()}.webm`;
    a.click();
    $('exportModal').classList.add('hidden');
    vToast('Export complete! File saved to your Downloads ✓');
    audioCtx.close();
  };

  renderLoop();
}

async function exportGif() {
  setExpProgress(0, 'Capturing frames for GIF...');
  // Simple frame capture approach
  const frames = [];
  const fps = 10; // GIF fps
  const frameDur = 1/fps;
  let t = 0;

  while (t < VS.totalDuration && !VS.cancelExport) {
    const clip = getClipAt(t);
    if (clip) {
      clip.videoEl.currentTime = getLocalTime(clip, t);
      await new Promise(r => clip.videoEl.addEventListener('seeked', r, {once:true}));
      const fc = document.createElement('canvas');
      fc.width = previewCanvas.width; fc.height = previewCanvas.height;
      const fctx = fc.getContext('2d');
      fctx.drawImage(clip.videoEl, 0, 0, fc.width, fc.height);
      frames.push(fc.toDataURL('image/png'));
    }
    t += frameDur;
    setExpProgress((t/VS.totalDuration)*80, `Capturing frame ${Math.round(t*fps)}...`);
  }

  if (VS.cancelExport) { $('exportModal').classList.add('hidden'); return; }

  setExpProgress(85, 'Building GIF... (this may take a moment)');
  // Create a simple animated webp/gif via canvas frames download
  // For now download the first frame and notify user
  setExpProgress(100, 'Done!');

  // Provide frames as a zip-like approach - download first frame
  if (frames.length) {
    const a = document.createElement('a');
    a.href = frames[0];
    a.download = `editr_frame_${Date.now()}.png`;
    a.click();
    vToast('GIF export: For full animated GIF, add gif.js library. First frame saved!');
  }
  $('exportModal').classList.add('hidden');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── HISTORY ───────────────────────────────────────────────
function saveHistory() {
  const snap = JSON.stringify({
    clips: VS.clips.map(c=>({id:c.id,trimStart:c.trimStart,trimEnd:c.trimEnd,speed:c.speed,volume:c.volume,filter:c.filter,transIn:c.transIn,transOut:c.transOut})),
    overlays: VS.overlays,
    audioTracks: VS.audioTracks.map(a=>({id:a.id,volume:a.volume,offset:a.offset,fadeIn:a.fadeIn,fadeOut:a.fadeOut,loop:a.loop})),
  });
  VS.history = VS.history.slice(0, VS.historyIndex+1);
  VS.history.push(snap);
  if (VS.history.length > 40) VS.history.shift(); else VS.historyIndex++;
}
function undo() {
  if (VS.historyIndex <= 0) return;
  VS.historyIndex--;
  applyHistory(JSON.parse(VS.history[VS.historyIndex]));
}
function redo() {
  if (VS.historyIndex >= VS.history.length-1) return;
  VS.historyIndex++;
  applyHistory(JSON.parse(VS.history[VS.historyIndex]));
}
function applyHistory(snap) {
  snap.clips.forEach(sc => {
    const c = VS.clips.find(c=>c.id===sc.id);
    if (c) Object.assign(c, sc);
  });
  VS.overlays = snap.overlays;
  snap.audioTracks.forEach(sa => {
    const at = VS.audioTracks.find(a=>a.id===sa.id);
    if (at) Object.assign(at, sa);
  });
  recalcDuration(); renderTimeline(); renderFrame();
}

$('vUndoBtn').onclick = undo;
$('vRedoBtn').onclick = redo;

// ── KEYBOARD SHORTCUTS ────────────────────────────────────
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  const ctrl = e.ctrlKey || e.metaKey;

  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  if (e.key === 's' || e.key === 'S') { if (!ctrl) { e.preventDefault(); $('splitBtn').click(); } }
  if ((e.key === 'Delete' || e.key === 'Backspace') && VS.selectedClip) $('deleteClipBtn').click();
  if (ctrl && e.key === 'z') { e.preventDefault(); undo(); }
  if (ctrl && e.key === 'y') { e.preventDefault(); redo(); }
  if (e.key === 'j' || e.key === 'J') seekTo(VS.currentTime - 5);
  if (e.key === 'l' || e.key === 'L') seekTo(VS.currentTime + 5);
  if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo(VS.currentTime - 1/30); }
  if (e.key === 'ArrowRight') { e.preventDefault(); seekTo(VS.currentTime + 1/30); }
  if (e.key === '0') seekTo(0);
  if (e.key === 'm' || e.key === 'M') { $('muteVideoAudio').click(); vToast($('muteVideoAudio').checked ? 'Muted' : 'Unmuted'); }
  if (e.key === 'e' || e.key === 'E') $('startExportBtn').click();
});

// ── SHORTCUTS MODAL ───────────────────────────────────────
$('vShortcutsBtn').onclick = () => $('vShortcutsModal').classList.toggle('hidden');
$('closeVShortcuts').onclick = () => $('vShortcutsModal').classList.add('hidden');

// ── THEME TOGGLE ──────────────────────────────────────────
$('vThemeToggle').onclick = () => {
  const html = document.documentElement;
  html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
};

// ── SKIP BUTTONS ──────────────────────────────────────────
$('skipBackBtn').onclick = () => seekTo(VS.currentTime - 5);
$('skipFwdBtn').onclick  = () => seekTo(VS.currentTime + 5);

// ── UTILS ─────────────────────────────────────────────────
function updateSliderMaxes() {
  const d = VS.totalDuration;
  ['audioOffset','olStartTime'].forEach(id => { const el=$(id); if(el) { el.max=d; } });
}

function fmtTime(t) {
  if (isNaN(t)) return '0:00.0';
  const m=Math.floor(t/60), s=Math.floor(t%60), ms=Math.floor((t%1)*10);
  return `${m}:${s.toString().padStart(2,'0')}.${ms}`;
}
function fmtTimeSec(t) {
  const m=Math.floor(t/60), s=Math.floor(t%60);
  return m>0?`${m}:${s.toString().padStart(2,'0')}`:`${s}s`;
}

function vToast(msg, ms=2600) {
  const t=$('vToast'); t.textContent=msg; t.classList.remove('hidden');
  clearTimeout(vToast._t); vToast._t=setTimeout(()=>t.classList.add('hidden'),ms);
}

// ── DRAW + BLUR OVERLAYS (basic) ──────────────────────────
$('addDrawBtn').onclick = () => vToast('Draw mode: use the Image Editor tab for detailed annotation, then import the frame');
$('addBlurBtn').onclick = () => vToast('Blur: select a clip, then use the Image Editor to blur specific frames');

console.log('%ceditр video v1 ready ✓','color:#FF3B57;font-weight:bold;font-size:13px');
