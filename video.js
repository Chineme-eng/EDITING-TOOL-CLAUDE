'use strict';
/* ═══════════════════════════════════════
   EDITR VIDEO v2 — video.js
   Full video editor: timeline, trim, split,
   overlays, audio, filters, export, resize
═══════════════════════════════════════ */

// ── EMOJI DATA ────────────────────────
const EMOJIS = {
  reactions: ['👍','👎','❤️','🔥','⭐','✅','❌','⚠️','💡','🎯','🚀','👀','💬','💯','🙌','👏','🤔','😮','💪','🎉','🏆','✨','💎','📌','📍'],
  symbols:   ['🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🔶','🔷','🔸','🔹','▶️','🔺','🔻','💠','🔘'],
  arrows:    ['➡️','⬅️','⬆️','⬇️','↗️','↙️','↖️','↘️','↕️','↔️','🔄','🔃','↩️','↪️','⤴️','⤵️','🔙','🔚','🔛','🔜','🔝'],
  objects:   ['💡','🔦','📸','🎥','🖥️','💻','📱','⌨️','📊','📈','📋','📝','✏️','🖊️','🔗','🔒','🔓','🔑','🎵','🎶'],
  faces:     ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😋','😛','😜','🤪','🤔','😐','😶','😏','😒','🙄','😬','😮','😲','😳','🥺','😢','😭','😱','😤','😡','😠'],
};
const COLORS = ['#ffffff','#FF3B57','#FF9500','#FFD60A','#34C759','#00C7FF','#0A84FF','#BF5AF2','#000000'];

// ── DOM ───────────────────────────────
const $ = id => document.getElementById(id);
const previewCanvas = $('vPreviewCanvas');
const overlayCanvas = $('vOverlayCanvas');
const pctx = previewCanvas.getContext('2d');
const octx = overlayCanvas.getContext('2d');
const overlayLayer = $('overlayLayer');
const videoTrack   = $('videoTrack');
const audioTrack   = $('audioTrack');
const overlayTrack = $('overlayTrack');
const tlRuler      = $('tlRuler');
const tlPlayhead   = $('tlPlayhead');

// ── STATE ─────────────────────────────
const VS = {
  clips: [], audioTracks: [], overlays: [],
  currentTime: 0, totalDuration: 0,
  playing: false, rafId: null, lastFrameTs: null,
  selectedClip: null, selectedAudio: null, selectedOverlay: null,
  tlZoom: 3,
  globalFilter: 'none',
  aspectRatio: 'source',
  exportQuality: 'medium',
  history: [], historyIndex: -1,
  cancelExport: false,
  selectedEmoji: '👍',
  newOverlayPos: 'center',
  newOverlayColor: '#ffffff',
  newOverlaySize: 32,
  clipIdCounter: 0,
  audioIdCounter: 0,
  overlayIdCounter: 0,
  wmImage: null,
};

// ── UPLOAD / INIT ─────────────────────
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

// Drag-drop onto preview area
$('previewArea').addEventListener('dragover', e => e.preventDefault());
$('previewArea').addEventListener('drop', e => {
  e.preventDefault();
  const f = e.dataTransfer.files[0]; if (!f) return;
  if (f.type.startsWith('video/')) loadVideoFile(f);
  else if (f.type.startsWith('image/')) addOverlay({ type: f.type === 'image/gif' ? 'gif' : 'image', src: URL.createObjectURL(f), name: f.name, pos: 'center' });
  else if (f.type.startsWith('audio/')) loadAudioFile(f);
});

function loadVideoFile(file) {
  const vel = document.createElement('video');
  vel.preload = 'auto'; vel.crossOrigin = 'anonymous';
  vel.muted = false; vel.style.display = 'none';
  document.body.appendChild(vel);
  vel.src = URL.createObjectURL(file);
  vel.addEventListener('loadedmetadata', () => {
    const clip = {
      id: VS.clipIdCounter++, file, videoEl: vel,
      name: file.name.replace(/\.[^.]+$/, ''),
      duration: vel.duration, trimStart: 0, trimEnd: vel.duration,
      startTime: VS.clips.reduce((a, c) => a + (c.trimEnd - c.trimStart) / c.speed, 0),
      speed: 1, volume: 1, filter: 'none', transIn: 'none', transOut: 'none',
    };
    VS.clips.push(clip);
    recalcDuration(); resizePreview(); renderTimeline();
    seekTo(clip.startTime); saveHistory(); showVEditor();
    $('vFileName').textContent = file.name.length > 22 ? file.name.slice(0, 19) + '…' : file.name;
    vToast('Loaded: ' + file.name);
  }, { once: true });
  vel.addEventListener('error', () => vToast('Error loading video'));
}

function showVEditor() {
  $('vLanding').classList.remove('active');
  $('vEditor').style.display = 'flex';
}

function recalcDuration() {
  VS.totalDuration = VS.clips.reduce((a, c) => a + (c.trimEnd - c.trimStart) / c.speed, 0);
  $('vTotalTime').textContent = fmtTime(VS.totalDuration);
}

// ── PREVIEW RESIZE (high quality) ─────
function resizePreview() {
  if (!VS.clips.length) return;
  const vel = VS.clips[0].videoEl;
  const vw = vel.videoWidth || 1280, vh = vel.videoHeight || 720;
  const area = $('previewArea');
  const maxW = area.clientWidth - 16, maxH = area.clientHeight - 16;
  let tw = vw, th = vh;
  if (VS.aspectRatio !== 'source') {
    const [rw, rh] = VS.aspectRatio.split(':').map(Number);
    th = Math.round(tw * rh / rw);
  }
  const scale = Math.min(1, maxW / tw, maxH / th);
  const dw = Math.round(tw * scale), dh = Math.round(th * scale);
  // Canvas internal = full video resolution for sharpness
  previewCanvas.width = tw; previewCanvas.height = th;
  overlayCanvas.width = tw; overlayCanvas.height = th;
  // Display size = scaled to fit
  [previewCanvas, overlayCanvas].forEach(c => {
    c.style.width = dw + 'px'; c.style.height = dh + 'px';
  });
  overlayLayer.style.width = dw + 'px'; overlayLayer.style.height = dh + 'px';
  $('previewWrap').style.width = dw + 'px'; $('previewWrap').style.height = dh + 'px';
}
window.addEventListener('resize', () => { if (VS.clips.length) resizePreview(); });

// ── PLAYBACK ──────────────────────────
$('vPlayBtn').addEventListener('click', togglePlay);
$('skipBackBtn').onclick = () => seekTo(VS.currentTime - 5);
$('skipFwdBtn').onclick  = () => seekTo(VS.currentTime + 5);

function togglePlay() { VS.playing ? pause() : play(); }

function play() {
  if (!VS.clips.length) return;
  VS.playing = true; $('vPlayBtn').textContent = '⏸'; VS.lastFrameTs = null;
  VS.audioTracks.forEach(at => {
    if (VS.currentTime >= at.offset) {
      at.audioEl.currentTime = VS.currentTime - at.offset;
      at.audioEl.volume = Math.min(1, at.volume);
      at.audioEl.loop = at.loop;
      at.audioEl.play().catch(() => {});
    }
  });
  const clip = getClipAt(VS.currentTime);
  if (clip) {
    clip.videoEl.currentTime = getLocalTime(clip, VS.currentTime);
    clip.videoEl.playbackRate = clip.speed;
    clip.videoEl.volume = $('muteVideoAudio').checked ? 0 : Math.min(1, clip.volume);
    clip.videoEl.play().catch(() => {});
  }
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
  if (VS.currentTime >= VS.totalDuration) { VS.currentTime = VS.totalDuration; pause(); renderFrame(); return; }
  renderFrame(); updatePlayhead(); $('vCurrentTime').textContent = fmtTime(VS.currentTime);
  VS.rafId = requestAnimationFrame(playLoop);
}

function seekTo(t) {
  VS.currentTime = Math.max(0, Math.min(VS.totalDuration, t));
  $('vCurrentTime').textContent = fmtTime(VS.currentTime);
  updatePlayhead(); renderFrame();
}

function getClipAt(t) {
  let acc = 0;
  for (const c of VS.clips) {
    const dur = (c.trimEnd - c.trimStart) / c.speed;
    if (t >= acc && t < acc + dur) return c;
    acc += dur;
  }
  return VS.clips.length ? VS.clips[VS.clips.length - 1] : null;
}

function getClipStart(clip) {
  let acc = 0;
  for (const c of VS.clips) { if (c.id === clip.id) return acc; acc += (c.trimEnd - c.trimStart) / c.speed; }
  return 0;
}

function getLocalTime(clip, gt) { return clip.trimStart + (gt - getClipStart(clip)) * clip.speed; }

// ── RENDER FRAME (full resolution, crisp) ──
function renderFrame() {
  const clip = getClipAt(VS.currentTime);
  pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  if (!clip) return;
  if (!VS.playing) {
    const lt = getLocalTime(clip, VS.currentTime);
    if (Math.abs(clip.videoEl.currentTime - lt) > 0.05) clip.videoEl.currentTime = lt;
  }
  pctx.save();
  const f = clip.filter !== 'none' ? clip.filter : VS.globalFilter !== 'none' ? VS.globalFilter : 'none';
  if (f !== 'none') pctx.filter = f;
  const cs = getClipStart(clip), localT = VS.currentTime - cs;
  const clipDur = (clip.trimEnd - clip.trimStart) / clip.speed, fadeDur = 0.5;
  let alpha = 1;
  if (clip.transIn === 'fade' && localT < fadeDur) alpha = localT / fadeDur;
  if (clip.transOut === 'fade' && localT > clipDur - fadeDur) alpha = (clipDur - localT) / fadeDur;
  pctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  pctx.imageSmoothingEnabled = true;
  pctx.imageSmoothingQuality = 'high';
  pctx.drawImage(clip.videoEl, 0, 0, previewCanvas.width, previewCanvas.height);
  pctx.filter = 'none'; pctx.globalAlpha = 1; pctx.restore();
  syncOverlayVisibility();
}

function syncOverlayVisibility() {
  overlayLayer.querySelectorAll('.video-overlay-el').forEach(el => {
    const ov = VS.overlays.find(o => o.id === +el.dataset.id);
    if (ov) el.style.display = (VS.currentTime >= ov.startTime && VS.currentTime < ov.startTime + ov.duration) ? 'flex' : 'none';
  });
}

// ── TIMELINE ──────────────────────────
function pxPerSec() { return VS.tlZoom * 20; }
function renderTimeline() { renderRuler(); renderVideoTrackUI(); renderAudioTrackUI(); renderOverlayTrackUI(); updatePlayhead(); }
function renderRuler() {
  tlRuler.innerHTML = ''; const pps = pxPerSec(), total = Math.max(VS.totalDuration, 10);
  tlRuler.style.minWidth = (total * pps + 40) + 'px';
  const step = pps > 80 ? 0.5 : pps > 40 ? 1 : pps > 20 ? 2 : 5;
  for (let t = 0; t <= total + step; t += step) {
    const m = document.createElement('div'); m.className = 'tl-ruler-mark'; m.style.left = (t * pps) + 'px'; m.textContent = fmtTimeSec(t); tlRuler.appendChild(m);
  }
}
function renderVideoTrackUI() {
  [...videoTrack.children].forEach(el => { if (!el.classList.contains('tl-playhead')) el.remove(); });
  const pps = pxPerSec(); videoTrack.style.minWidth = (VS.totalDuration * pps + 40) + 'px';
  VS.clips.forEach(clip => {
    const cs = getClipStart(clip), dur = (clip.trimEnd - clip.trimStart) / clip.speed;
    const el = document.createElement('div'); el.className = 'tl-clip' + (clip === VS.selectedClip ? ' selected' : ''); el.dataset.id = clip.id;
    el.style.left = (cs * pps) + 'px'; el.style.width = Math.max(6, dur * pps) + 'px';
    const thumb = document.createElement('div'); thumb.className = 'tl-clip-thumb'; captureThumbnail(clip, thumb); el.appendChild(thumb);
    const label = document.createElement('div'); label.className = 'tl-clip-label'; label.textContent = clip.name || ('Clip ' + (clip.id + 1)); el.appendChild(label);
    ['left', 'right'].forEach(side => { const h = document.createElement('div'); h.className = `tl-trim-handle ${side}`; h.textContent = '⋮'; h.addEventListener('mousedown', e => startTrim(e, clip, side)); el.appendChild(h); });
    el.addEventListener('click', e => { if (e.target.classList.contains('tl-trim-handle')) return; selectClip(clip); });
    el.addEventListener('mousedown', e => { if (e.target.classList.contains('tl-trim-handle')) return; startDragClip(e, clip); });
    videoTrack.appendChild(el);
  });
}
function captureThumbnail(clip, thumbEl) {
  const vc = clip.videoEl, tc = document.createElement('canvas'); tc.width = 160; tc.height = 90;
  const tctx = tc.getContext('2d'), oldT = vc.currentTime;
  vc.currentTime = clip.trimStart + (clip.trimEnd - clip.trimStart) * 0.15;
  vc.addEventListener('seeked', () => { tctx.drawImage(vc, 0, 0, tc.width, tc.height); thumbEl.style.backgroundImage = `url(${tc.toDataURL()})`; vc.currentTime = oldT; }, { once: true });
}
function renderAudioTrackUI() {
  audioTrack.innerHTML = ''; const pps = pxPerSec();
  VS.audioTracks.forEach(at => {
    const el = document.createElement('div'); el.className = 'tl-clip tl-audio-clip' + (at === VS.selectedAudio ? ' selected' : '');
    el.style.left = (at.offset * pps) + 'px'; el.style.width = Math.max(6, at.audioEl.duration * pps) + 'px';
    const label = document.createElement('div'); label.className = 'tl-clip-label'; label.textContent = '♪ ' + at.name; el.appendChild(label);
    el.addEventListener('click', () => selectAudio(at)); audioTrack.appendChild(el);
  });
}
function renderOverlayTrackUI() {
  overlayTrack.innerHTML = ''; const pps = pxPerSec();
  VS.overlays.forEach(ov => {
    const el = document.createElement('div'); el.className = 'tl-clip tl-overlay-clip' + (ov === VS.selectedOverlay ? ' selected' : '');
    el.style.left = (ov.startTime * pps) + 'px'; el.style.width = Math.max(6, ov.duration * pps) + 'px';
    const label = document.createElement('div'); label.className = 'tl-clip-label'; label.textContent = (ov.type === 'text' ? 'T ' : ov.type === 'emoji' ? '★ ' : '🖼 ') + (ov.text || ov.emoji || ov.name || 'Overlay'); el.appendChild(label);
    el.addEventListener('click', () => selectOverlay(ov)); overlayTrack.appendChild(el);
  });
}
function updatePlayhead() { const left = VS.currentTime * pxPerSec(); document.querySelectorAll('.tl-playhead').forEach(ph => ph.style.left = left + 'px'); }
[$('tlRuler'), videoTrack, audioTrack, overlayTrack].forEach(el => { el.addEventListener('click', e => { const rect = el.getBoundingClientRect(); seekTo((e.clientX - rect.left) / pxPerSec()); }); });
$('tlZoom').addEventListener('input', e => { VS.tlZoom = +e.target.value; renderTimeline(); });
$('tlZoomIn').onclick  = () => { VS.tlZoom = Math.min(20, VS.tlZoom + 1); $('tlZoom').value = VS.tlZoom; renderTimeline(); };
$('tlZoomOut').onclick = () => { VS.tlZoom = Math.max(1, VS.tlZoom - 1); $('tlZoom').value = VS.tlZoom; renderTimeline(); };

// TRIM
function startTrim(e, clip, side) {
  e.stopPropagation(); const startX = e.clientX, origStart = clip.trimStart, origEnd = clip.trimEnd, pps = pxPerSec();
  const onMove = ev => { const dx = (ev.clientX - startX) / pps * clip.speed; if (side === 'left') clip.trimStart = Math.max(0, Math.min(origStart + dx, clip.trimEnd - 0.1)); else clip.trimEnd = Math.max(clip.trimStart + 0.1, Math.min(origEnd + dx, clip.duration)); recalcDuration(); renderTimeline(); renderFrame(); };
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); saveHistory(); if (VS.selectedClip === clip) updateClipProps(clip); };
  document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
}
function startDragClip(e, clip) {
  const startX = e.clientX, startIdx = VS.clips.indexOf(clip), clipW = ((clip.trimEnd - clip.trimStart) / clip.speed) * pxPerSec();
  const onMove = ev => { const dx = ev.clientX - startX, newIdx = Math.max(0, Math.min(VS.clips.length - 1, startIdx + Math.round(dx / Math.max(clipW, 10)))); if (newIdx !== VS.clips.indexOf(clip)) { VS.clips.splice(VS.clips.indexOf(clip), 1); VS.clips.splice(newIdx, 0, clip); recalcDuration(); renderTimeline(); } };
  const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); saveHistory(); };
  document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
}

// SPLIT
$('splitBtn').onclick = () => {
  const clip = getClipAt(VS.currentTime); if (!clip) return;
  const lt = getLocalTime(clip, VS.currentTime);
  if (lt <= clip.trimStart + 0.05 || lt >= clip.trimEnd - 0.05) { vToast('Too close to clip edge'); return; }
  const nv = document.createElement('video'); nv.src = clip.videoEl.src; nv.preload = 'auto'; nv.crossOrigin = 'anonymous'; nv.muted = false; nv.style.display = 'none'; document.body.appendChild(nv);
  const newClip = { ...clip, id: VS.clipIdCounter++, videoEl: nv, trimStart: lt, name: clip.name + ' (2)' };
  clip.trimEnd = lt; const idx = VS.clips.indexOf(clip); VS.clips.splice(idx + 1, 0, newClip);
  recalcDuration(); renderTimeline(); renderFrame(); saveHistory(); vToast('Split at ' + fmtTime(VS.currentTime));
};

// DELETE CLIP
$('deleteClipBtn').onclick = $('deleteClipPropBtn').onclick = () => {
  if (!VS.selectedClip) return; VS.selectedClip.videoEl.pause(); VS.selectedClip.videoEl.remove();
  VS.clips = VS.clips.filter(c => c !== VS.selectedClip); VS.selectedClip = null;
  recalcDuration(); renderTimeline(); renderFrame(); showProps('none'); saveHistory(); vToast('Clip removed');
};

// SELECTION
function selectClip(clip) { VS.selectedClip = clip; VS.selectedAudio = null; VS.selectedOverlay = null; showProps('clip'); updateClipProps(clip); renderTimeline(); }
function selectAudio(at) { VS.selectedAudio = at; VS.selectedClip = null; VS.selectedOverlay = null; showProps('audio'); updateAudioProps(at); renderTimeline(); }
function selectOverlay(ov) { VS.selectedOverlay = ov; VS.selectedClip = null; VS.selectedAudio = null; showProps('overlay'); if (ov.type === 'text') updateOverlayProps(ov); renderTimeline(); }
function showProps(type) { $('vpEmpty').classList.toggle('hidden', type !== 'none'); $('clipProps').classList.toggle('hidden', type !== 'clip'); $('textOverlayProps').classList.toggle('hidden', type !== 'overlay'); $('audioProps').classList.toggle('hidden', type !== 'audio'); }

function updateClipProps(clip) {
  $('trimStart').max = $('trimEnd').max = clip.duration; $('trimStart').value = clip.trimStart; $('trimEnd').value = clip.trimEnd;
  $('trimStartVal').textContent = clip.trimStart.toFixed(1) + 's'; $('trimEndVal').textContent = clip.trimEnd.toFixed(1) + 's';
  $('clipSpeed').value = clip.speed * 100; $('clipSpeedVal').textContent = clip.speed.toFixed(2).replace(/\.?0+$/, '') + '×';
  $('clipVolume').value = clip.volume * 100; $('clipVolumeVal').textContent = Math.round(clip.volume * 100) + '%';
  $('clipFilter').value = clip.filter; $('transitionIn').value = clip.transIn; $('transitionOut').value = clip.transOut;
}
$('trimStart').addEventListener('input', e => { if (!VS.selectedClip) return; VS.selectedClip.trimStart = Math.min(+e.target.value, VS.selectedClip.trimEnd - 0.1); $('trimStartVal').textContent = VS.selectedClip.trimStart.toFixed(1) + 's'; recalcDuration(); renderTimeline(); renderFrame(); });
$('trimEnd').addEventListener('input', e => { if (!VS.selectedClip) return; VS.selectedClip.trimEnd = Math.max(+e.target.value, VS.selectedClip.trimStart + 0.1); $('trimEndVal').textContent = VS.selectedClip.trimEnd.toFixed(1) + 's'; recalcDuration(); renderTimeline(); renderFrame(); });
$('clipSpeed').addEventListener('input', e => { if (!VS.selectedClip) return; VS.selectedClip.speed = +e.target.value / 100; VS.selectedClip.videoEl.playbackRate = VS.selectedClip.speed; $('clipSpeedVal').textContent = VS.selectedClip.speed.toFixed(2).replace(/\.?0+$/, '') + '×'; recalcDuration(); renderTimeline(); });
$('clipVolume').addEventListener('input', e => { if (!VS.selectedClip) return; VS.selectedClip.volume = +e.target.value / 100; $('clipVolumeVal').textContent = Math.round(VS.selectedClip.volume * 100) + '%'; });
$('clipFilter').addEventListener('change', e => { if (VS.selectedClip) { VS.selectedClip.filter = e.target.value; renderFrame(); } });
$('transitionIn').addEventListener('change', e => { if (VS.selectedClip) VS.selectedClip.transIn = e.target.value; });
$('transitionOut').addEventListener('change', e => { if (VS.selectedClip) VS.selectedClip.transOut = e.target.value; });

// AUDIO
$('addAudioBtn').onclick = () => $('audioFileInput').click();
$('audioFileInput').addEventListener('change', e => { const f = e.target.files[0]; if (f) loadAudioFile(f); e.target.value = ''; });
function loadAudioFile(file) {
  const ael = new Audio(URL.createObjectURL(file)); ael.preload = 'auto';
  ael.addEventListener('loadedmetadata', () => {
    const at = { id: VS.audioIdCounter++, file, audioEl: ael, name: file.name.replace(/\.[^.]+$/, ''), volume: 1, offset: 0, fadeIn: 0, fadeOut: 0, loop: false };
    VS.audioTracks.push(at); renderTimeline(); saveHistory(); selectAudio(at); vToast('Audio: ' + at.name);
  }, { once: true });
}
$('videoVolume').addEventListener('input', e => { VS.clips.forEach(c => c.volume = +e.target.value / 100); $('videoVolVal').textContent = e.target.value + '%'; });
$('muteVideoAudio').addEventListener('change', e => { VS.clips.forEach(c => c.videoEl.muted = e.target.checked); });
function updateAudioProps(at) { $('audioVolume').value = at.volume * 100; $('audioVolVal').textContent = Math.round(at.volume * 100) + '%'; $('audioOffset').max = VS.totalDuration; $('audioOffset').value = at.offset; $('audioOffsetVal').textContent = at.offset.toFixed(1) + 's'; $('audioFadeIn').value = at.fadeIn; $('audioFadeInVal').textContent = at.fadeIn.toFixed(1) + 's'; $('audioFadeOut').value = at.fadeOut; $('audioFadeOutVal').textContent = at.fadeOut.toFixed(1) + 's'; $('audioLoop').checked = at.loop; }
$('audioVolume').addEventListener('input', e => { if (!VS.selectedAudio) return; VS.selectedAudio.volume = +e.target.value / 100; $('audioVolVal').textContent = Math.round(VS.selectedAudio.volume * 100) + '%'; });
$('audioOffset').addEventListener('input', e => { if (!VS.selectedAudio) return; VS.selectedAudio.offset = +e.target.value; $('audioOffsetVal').textContent = VS.selectedAudio.offset.toFixed(1) + 's'; renderTimeline(); });
$('audioFadeIn').addEventListener('input', e => { if (!VS.selectedAudio) return; VS.selectedAudio.fadeIn = +e.target.value; $('audioFadeInVal').textContent = VS.selectedAudio.fadeIn.toFixed(1) + 's'; });
$('audioFadeOut').addEventListener('input', e => { if (!VS.selectedAudio) return; VS.selectedAudio.fadeOut = +e.target.value; $('audioFadeOutVal').textContent = VS.selectedAudio.fadeOut.toFixed(1) + 's'; });
$('audioLoop').addEventListener('change', e => { if (VS.selectedAudio) VS.selectedAudio.loop = e.target.checked; });
$('deleteAudioBtn').onclick = () => { if (!VS.selectedAudio) return; VS.selectedAudio.audioEl.pause(); VS.audioTracks = VS.audioTracks.filter(a => a !== VS.selectedAudio); VS.selectedAudio = null; showProps('none'); renderTimeline(); saveHistory(); vToast('Audio removed'); };

// OVERLAYS
function buildMiniColors(containerId, onSelect) {
  const el = $(containerId); if (!el) return; el.innerHTML = '';
  COLORS.forEach(c => { const sw = document.createElement('button'); sw.className = 'mini-swatch' + (c === VS.newOverlayColor ? ' active' : ''); sw.style.background = c; if (c === '#ffffff') sw.style.outline = '1px solid #888'; sw.addEventListener('click', () => { el.querySelectorAll('.mini-swatch').forEach(s => s.classList.remove('active')); sw.classList.add('active'); VS.newOverlayColor = c; onSelect(c); }); el.appendChild(sw); });
}

$('addTextBtn').onclick = () => {
  $('addTextModal').classList.remove('hidden'); buildMiniColors('newOlColors', c => VS.newOverlayColor = c);
  $('newPosGrid').querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
  $('newPosGrid').querySelector('[data-pos="center"]').classList.add('active'); VS.newOverlayPos = 'center';
};
$('newPosGrid').querySelectorAll('.pos-btn').forEach(b => { b.addEventListener('click', () => { $('newPosGrid').querySelectorAll('.pos-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); VS.newOverlayPos = b.dataset.pos; }); });
$('newOlSize').addEventListener('input', e => { VS.newOverlaySize = +e.target.value; $('newOlSizeVal').textContent = VS.newOverlaySize + 'px'; });
[$('closeTextModal'), $('cancelTextModal')].forEach(b => b.onclick = () => $('addTextModal').classList.add('hidden'));
$('confirmTextModal').onclick = () => { const text = $('newOverlayText').value.trim(); if (!text) return; addOverlay({ type: 'text', text, color: VS.newOverlayColor, fontSize: VS.newOverlaySize, pos: VS.newOverlayPos, bold: false, italic: false, bg: 'none' }); $('addTextModal').classList.add('hidden'); $('newOverlayText').value = ''; };

let vSelEmoji = '👍';
buildVEmojiGrid('reactions');
$('vEmojiTabs').querySelectorAll('.etab').forEach(tab => { tab.addEventListener('click', () => { $('vEmojiTabs').querySelectorAll('.etab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); buildVEmojiGrid(tab.dataset.cat); }); });
function buildVEmojiGrid(cat) { const grid = $('vEmojiGrid'); grid.innerHTML = ''; (EMOJIS[cat] || EMOJIS.reactions).forEach(em => { const btn = document.createElement('button'); btn.className = 'em-btn' + (em === vSelEmoji ? ' sel' : ''); btn.textContent = em; btn.addEventListener('click', () => { grid.querySelectorAll('.em-btn').forEach(b => b.classList.remove('sel')); btn.classList.add('sel'); vSelEmoji = em; }); grid.appendChild(btn); }); }
$('vEmojiSize').addEventListener('input', e => $('vEmojiSizeVal').textContent = e.target.value + 'px');
$('addEmojiBtn').onclick = () => $('addEmojiModal').classList.remove('hidden');
[$('closeEmojiModal'), $('cancelEmojiModal')].forEach(b => b.onclick = () => $('addEmojiModal').classList.add('hidden'));
$('confirmEmojiModal').onclick = () => { addOverlay({ type: 'emoji', emoji: vSelEmoji, fontSize: +$('vEmojiSize').value, pos: VS.newOverlayPos }); $('addEmojiModal').classList.add('hidden'); };

$('addGifBtn').onclick = () => $('gifFileInput').click();
$('gifFileInput').addEventListener('change', e => { const f = e.target.files[0]; if (f) addOverlay({ type: f.type === 'image/gif' ? 'gif' : 'image', src: URL.createObjectURL(f), name: f.name, pos: 'center' }); e.target.value = ''; });

// WATERMARK on video
$('addWatermarkBtn').onclick = () => $('vWatermarkInput').click();
$('vWatermarkInput').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const img = new Image(); img.onload = () => { VS.wmImage = img; addOverlay({ type: 'image', src: img.src, name: 'watermark', pos: 'br', wmOpacity: 0.4, wmScale: 0.2 }); vToast('Watermark added'); }; img.src = URL.createObjectURL(f); e.target.value = '';
});

function addOverlay(data) {
  const ov = { id: VS.overlayIdCounter++, type: data.type, text: data.text || '', emoji: data.emoji || '', src: data.src || '', name: data.name || '', color: data.color || '#ffffff', fontSize: data.fontSize || 32, bold: data.bold || false, italic: data.italic || false, bg: data.bg || 'none', pos: data.pos || 'center', startTime: VS.currentTime, duration: Math.max(1, Math.min(5, VS.totalDuration - VS.currentTime)) };
  VS.overlays.push(ov); createOverlayDOM(ov); renderTimeline(); saveHistory(); selectOverlay(ov); vToast('Overlay added');
}

function posToStyle(pos) {
  const map = { 'top-left': { top: '5%', left: '5%' }, 'top-center': { top: '5%', left: '50%', transform: 'translateX(-50%)' }, 'top-right': { top: '5%', right: '5%' }, 'center': { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }, 'bottom-left': { bottom: '8%', left: '5%' }, 'bottom-center': { bottom: '8%', left: '50%', transform: 'translateX(-50%)' }, 'bottom-right': { bottom: '8%', right: '5%' }, 'br': { bottom: '5%', right: '5%' } };
  return map[pos] || map['center'];
}

function createOverlayDOM(ov) {
  const el = document.createElement('div'); el.className = 'video-overlay-el'; el.dataset.id = ov.id;
  Object.assign(el.style, posToStyle(ov.pos));
  if (ov.type === 'text') { el.style.color = ov.color; el.style.fontSize = ov.fontSize + 'px'; el.style.fontWeight = ov.bold ? 'bold' : 'normal'; el.style.fontStyle = ov.italic ? 'italic' : 'normal'; if (ov.bg === 'dark') el.style.background = 'rgba(0,0,0,0.6)'; el.textContent = ov.text; }
  else if (ov.type === 'emoji') { el.style.fontSize = ov.fontSize + 'px'; el.textContent = ov.emoji; }
  else if (ov.type === 'gif' || ov.type === 'image') { const img = document.createElement('img'); img.src = ov.src; img.style.maxWidth = ov.wmScale ? (previewCanvas.offsetWidth * ov.wmScale) + 'px' : '180px'; img.style.maxHeight = '180px'; img.style.borderRadius = '4px'; if (ov.wmOpacity) img.style.opacity = ov.wmOpacity; el.appendChild(img); }
  const del = document.createElement('button'); del.className = 'ol-delete'; del.textContent = '✕'; del.addEventListener('click', e => { e.stopPropagation(); removeOverlay(ov); }); el.appendChild(del);
  el.addEventListener('click', () => selectOverlay(ov));
  // draggable
  el.addEventListener('mousedown', e => {
    if (e.target === del) return;
    const startX = e.clientX - el.offsetLeft, startY = e.clientY - el.offsetTop;
    el.style.cursor = 'grabbing';
    const onMove = ev => { el.style.left = (ev.clientX - startX) + 'px'; el.style.top = (ev.clientY - startY) + 'px'; el.style.right = ''; el.style.bottom = ''; el.style.transform = ''; };
    const onUp = () => { el.style.cursor = 'move'; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  });
  overlayLayer.appendChild(el);
}

function removeOverlay(ov) { VS.overlays = VS.overlays.filter(o => o !== ov); overlayLayer.querySelector(`[data-id="${ov.id}"]`)?.remove(); if (VS.selectedOverlay === ov) { VS.selectedOverlay = null; showProps('none'); } renderTimeline(); saveHistory(); vToast('Overlay removed'); }

function updateOverlayProps(ov) {
  if (ov.type !== 'text') return;
  $('overlayText').value = ov.text || ''; $('olFontSize').value = ov.fontSize || 32; $('olFontSizeVal').textContent = (ov.fontSize || 32) + 'px';
  $('olStartTime').max = VS.totalDuration; $('olStartTime').value = ov.startTime; $('olStartVal').textContent = ov.startTime.toFixed(1) + 's';
  $('olDuration').value = ov.duration; $('olDurVal').textContent = ov.duration.toFixed(1) + 's';
  buildMiniColors('olColorGrid', c => { if (VS.selectedOverlay) { VS.selectedOverlay.color = c; const el = overlayLayer.querySelector(`[data-id="${ov.id}"]`); if (el) el.style.color = c; } });
}
$('overlayText').addEventListener('input', e => { if (!VS.selectedOverlay) return; VS.selectedOverlay.text = e.target.value; const el = overlayLayer.querySelector(`[data-id="${VS.selectedOverlay.id}"]`); if (el && el.childNodes[0]?.nodeType === 3) el.childNodes[0].textContent = e.target.value; });
$('olFontSize').addEventListener('input', e => { if (!VS.selectedOverlay) return; VS.selectedOverlay.fontSize = +e.target.value; $('olFontSizeVal').textContent = VS.selectedOverlay.fontSize + 'px'; const el = overlayLayer.querySelector(`[data-id="${VS.selectedOverlay.id}"]`); if (el) el.style.fontSize = VS.selectedOverlay.fontSize + 'px'; });
$('olStartTime').addEventListener('input', e => { if (!VS.selectedOverlay) return; VS.selectedOverlay.startTime = +e.target.value; $('olStartVal').textContent = VS.selectedOverlay.startTime.toFixed(1) + 's'; renderTimeline(); });
$('olDuration').addEventListener('input', e => { if (!VS.selectedOverlay) return; VS.selectedOverlay.duration = +e.target.value; $('olDurVal').textContent = VS.selectedOverlay.duration.toFixed(1) + 's'; renderTimeline(); });
['olBgNone', 'olBgDark'].forEach((id, i) => { $(id).addEventListener('click', () => { if (!VS.selectedOverlay) return; VS.selectedOverlay.bg = i === 0 ? 'none' : 'dark'; ['olBgNone', 'olBgDark'].forEach(b => $(b).classList.remove('active')); $(id).classList.add('active'); const el = overlayLayer.querySelector(`[data-id="${VS.selectedOverlay.id}"]`); if (el) el.style.background = i === 1 ? 'rgba(0,0,0,0.6)' : 'transparent'; }); });
['olBold', 'olItalic'].forEach((id, i) => { $(id).addEventListener('click', () => { if (!VS.selectedOverlay) return; const prop = i === 0 ? 'bold' : 'italic'; VS.selectedOverlay[prop] = !VS.selectedOverlay[prop]; $(id).classList.toggle('active', VS.selectedOverlay[prop]); const el = overlayLayer.querySelector(`[data-id="${VS.selectedOverlay.id}"]`); if (el) el.style[i === 0 ? 'fontWeight' : 'fontStyle'] = VS.selectedOverlay[prop] ? (i === 0 ? 'bold' : 'italic') : 'normal'; }); });
document.querySelectorAll('#textOverlayProps .pos-btn').forEach(b => { b.addEventListener('click', () => { document.querySelectorAll('#textOverlayProps .pos-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); if (VS.selectedOverlay) { VS.selectedOverlay.pos = b.dataset.pos; const el = overlayLayer.querySelector(`[data-id="${VS.selectedOverlay.id}"]`); if (el) { Object.assign(el.style, { top: '', left: '', right: '', bottom: '', transform: '' }); Object.assign(el.style, posToStyle(b.dataset.pos)); } } }); });
$('deleteOverlayBtn').onclick = () => { if (VS.selectedOverlay) removeOverlay(VS.selectedOverlay); };

// FILTERS + SPEED
document.querySelectorAll('.filt-btn').forEach(btn => { btn.addEventListener('click', () => { document.querySelectorAll('.filt-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); VS.globalFilter = btn.dataset.filter; renderFrame(); }); });
document.querySelectorAll('.spd-btn').forEach(btn => { btn.addEventListener('click', () => { document.querySelectorAll('.spd-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); const spd = +btn.dataset.speed; VS.clips.forEach(c => { c.speed = spd; c.videoEl.playbackRate = spd; }); recalcDuration(); renderTimeline(); }); });
document.querySelectorAll('.ratio-btn').forEach(btn => { btn.addEventListener('click', () => { document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); VS.aspectRatio = btn.dataset.ratio; resizePreview(); renderFrame(); }); });

// EXPORT
$('vExportArrow').onclick = e => { e.stopPropagation(); $('vExportMenu').classList.toggle('hidden'); };
document.addEventListener('click', () => $('vExportMenu')?.classList.add('hidden'));
document.querySelectorAll('#vExportMenu .dlm-btn').forEach(btn => { btn.addEventListener('click', () => { if (btn.dataset.quality) VS.exportQuality = btn.dataset.quality; if (btn.dataset.format === 'frame') exportFrame(); else startExport($('exportFormat').value); }); });
$('vExportBtn').onclick = $('startExportBtn').onclick = () => startExport($('exportFormat').value);
['qualDraft','qualMed','qualHigh'].forEach((id, i) => { $(id).addEventListener('click', () => { VS.exportQuality = ['draft','medium','high'][i]; ['qualDraft','qualMed','qualHigh'].forEach(b => $(b).classList.remove('active')); $(id).classList.add('active'); }); });

function exportFrame() {
  const out = document.createElement('canvas'); out.width = previewCanvas.width; out.height = previewCanvas.height;
  out.getContext('2d').drawImage(previewCanvas, 0, 0);
  out.toBlob(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `frame_${fmtTimeSec(VS.currentTime).replace(':','_')}.png`; a.click(); vToast('Frame exported ✓'); });
}

function startExport(format) {
  if (!VS.clips.length) { vToast('No clips to export'); return; }
  $('exportModal').classList.remove('hidden');
  $('expStatus').textContent = 'Preparing...'; setExpProgress(0);
  VS.cancelExport = false;
  exportViaMediaRecorder(format);
}
$('cancelExportBtn').onclick = () => { VS.cancelExport = true; $('exportModal').classList.add('hidden'); vToast('Export cancelled'); };

function setExpProgress(pct, msg) { const p = Math.round(pct); $('expBarModal').style.width = p + '%'; $('expPctModal').textContent = p + '%'; if (msg) $('expStatus').textContent = msg; }

async function exportViaMediaRecorder(format) {
  pause(); setExpProgress(2, 'Setting up...');
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = previewCanvas.width; exportCanvas.height = previewCanvas.height;
  const ectx = exportCanvas.getContext('2d');
  const stream = exportCanvas.captureStream(30);
  const mimeType = 'video/webm;codecs=vp8';
  let recorder;
  try { recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: VS.exportQuality === 'high' ? 8000000 : VS.exportQuality === 'draft' ? 1500000 : 4000000 }); }
  catch { recorder = new MediaRecorder(stream); }
  const chunks = []; recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.start(100); seekTo(0);
  await new Promise(r => setTimeout(r, 200));
  const fps = VS.exportQuality === 'draft' ? 15 : 30, frameDur = 1 / fps;
  let t = 0; setExpProgress(3, 'Rendering...');
  while (t < VS.totalDuration && !VS.cancelExport) {
    const clip = getClipAt(t);
    if (clip) {
      const lt = getLocalTime(clip, t);
      if (Math.abs(clip.videoEl.currentTime - lt) > 0.08) { clip.videoEl.currentTime = lt; await new Promise(r => clip.videoEl.addEventListener('seeked', r, { once: true })); }
      ectx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
      const f = clip.filter !== 'none' ? clip.filter : VS.globalFilter !== 'none' ? VS.globalFilter : 'none';
      if (f !== 'none') ectx.filter = f;
      ectx.drawImage(clip.videoEl, 0, 0, exportCanvas.width, exportCanvas.height);
      ectx.filter = 'none';
    }
    t += frameDur; setExpProgress((t / VS.totalDuration) * 92, `Rendering ${Math.round(t)}s / ${Math.round(VS.totalDuration)}s`);
    await new Promise(r => setTimeout(r, 1));
  }
  if (!VS.cancelExport) { setExpProgress(95, 'Finalizing...'); await new Promise(r => setTimeout(r, 300)); recorder.stop(); }
  recorder.onstop = () => {
    if (VS.cancelExport) return;
    const blob = new Blob(chunks, { type: 'video/webm' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `editr_export_${Date.now()}.webm`; a.click();
    $('exportModal').classList.add('hidden'); setExpProgress(100); vToast('Export saved to Downloads ✓');
  };
}

// HISTORY
function saveHistory() {
  const snap = JSON.stringify({ clips: VS.clips.map(c => ({ id: c.id, trimStart: c.trimStart, trimEnd: c.trimEnd, speed: c.speed, volume: c.volume, filter: c.filter, transIn: c.transIn, transOut: c.transOut })), overlays: VS.overlays, audioTracks: VS.audioTracks.map(a => ({ id: a.id, volume: a.volume, offset: a.offset, fadeIn: a.fadeIn, fadeOut: a.fadeOut, loop: a.loop })) });
  VS.history = VS.history.slice(0, VS.historyIndex + 1); VS.history.push(snap);
  if (VS.history.length > 40) VS.history.shift(); else VS.historyIndex++;
}
function applyHistory(snap) { snap.clips.forEach(sc => { const c = VS.clips.find(c => c.id === sc.id); if (c) Object.assign(c, sc); }); VS.overlays = snap.overlays; snap.audioTracks.forEach(sa => { const at = VS.audioTracks.find(a => a.id === sa.id); if (at) Object.assign(at, sa); }); recalcDuration(); renderTimeline(); renderFrame(); }
$('vUndoBtn').onclick = () => { if (VS.historyIndex > 0) { VS.historyIndex--; applyHistory(JSON.parse(VS.history[VS.historyIndex])); } };
$('vRedoBtn').onclick = () => { if (VS.historyIndex < VS.history.length - 1) { VS.historyIndex++; applyHistory(JSON.parse(VS.history[VS.historyIndex])); } };

// RESIZABLE PANELS
function initVResize(handleId, targetId, side) {
  const handle = $(handleId); if (!handle) return;
  handle.addEventListener('mousedown', e => {
    e.preventDefault(); handle.classList.add('dragging');
    const startX = e.clientX, target = $(targetId), startW = target.offsetWidth;
    const onMove = ev => { const dx = ev.clientX - startX; target.style.width = Math.max(120, Math.min(400, startW + (side === 'right' ? -dx : dx))) + 'px'; };
    const onUp = () => { handle.classList.remove('dragging'); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  });
}
initVResize('vtResizeLeft', 'vtoolbar', 'left');
initVResize('vtResizeRight', 'vprops', 'right');

// TIMELINE VERTICAL RESIZE
const tlHandle = $('tlResizeHandle');
if (tlHandle) {
  tlHandle.addEventListener('mousedown', e => {
    e.preventDefault(); tlHandle.classList.add('dragging');
    const startY = e.clientY, panel = $('timelinePanel'), startH = panel.offsetHeight;
    const onMove = ev => { panel.style.height = Math.max(100, Math.min(600, startH - (ev.clientY - startY))) + 'px'; };
    const onUp = () => { tlHandle.classList.remove('dragging'); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
  });
}

// THEME
$('vThemeToggle').onclick = () => { const h = document.documentElement; h.setAttribute('data-theme', h.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); };

// KEYBOARD SHORTCUTS
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  if ((e.key === 's' || e.key === 'S') && !ctrl) { e.preventDefault(); $('splitBtn').click(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && VS.selectedClip) $('deleteClipBtn').click();
  if (ctrl && e.key === 'z') { e.preventDefault(); $('vUndoBtn').click(); }
  if (ctrl && e.key === 'y') { e.preventDefault(); $('vRedoBtn').click(); }
  if (e.key === 'j' || e.key === 'J') seekTo(VS.currentTime - 5);
  if (e.key === 'l' || e.key === 'L') seekTo(VS.currentTime + 5);
  if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo(VS.currentTime - 1/30); }
  if (e.key === 'ArrowRight') { e.preventDefault(); seekTo(VS.currentTime + 1/30); }
  if (e.key === '0') seekTo(0);
  if (e.key === 'm' || e.key === 'M') { $('muteVideoAudio').click(); vToast($('muteVideoAudio').checked ? 'Muted' : 'Unmuted'); }
  if ((e.key === 'e' || e.key === 'E') && !ctrl) $('startExportBtn').click();
  if ((e.key === 'f' || e.key === 'F') && !ctrl) exportFrame();
});

// SHORTCUTS MODAL
$('vShortcutsBtn').onclick = $('vShortcutsBtn2').onclick = () => $('vShortcutsModal').classList.toggle('hidden');
$('closeVShortcuts').onclick = () => $('vShortcutsModal').classList.add('hidden');

// UTILS
function fmtTime(t) { if (isNaN(t) || t < 0) return '0:00.0'; const m = Math.floor(t / 60), s = Math.floor(t % 60), ms = Math.floor((t % 1) * 10); return `${m}:${s.toString().padStart(2,'0')}.${ms}`; }
function fmtTimeSec(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m > 0 ? `${m}:${s.toString().padStart(2,'0')}` : `${s}s`; }
function vToast(msg, ms = 2600) { const t = $('vToast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(vToast._t); vToast._t = setTimeout(() => t.classList.add('hidden'), ms); }

// posToCSS was missing - fixes overlay positioning
function posToCSS(pos) {
  const m = {
    'top-left':      { top:'5%', left:'5%' },
    'top-center':    { top:'5%', left:'50%', transform:'translateX(-50%)' },
    'top-right':     { top:'5%', right:'5%' },
    'center':        { top:'50%', left:'50%', transform:'translate(-50%,-50%)' },
    'bottom-left':   { bottom:'8%', left:'5%' },
    'bottom-center': { bottom:'8%', left:'50%', transform:'translateX(-50%)' },
    'bottom-right':  { bottom:'8%', right:'5%' },
  };
  return m[pos] || m['center'];
}

function exportCurrentFrame() {
  renderFrame();
  const a = document.createElement('a');
  a.href = previewCanvas.toDataURL('image/png');
  a.download = `editr_frame_${Date.now()}.png`;
  a.click();
  vToast('Frame exported as PNG ✓');
}

console.log('%ceditр video v2 ready ✓', 'color:#FF3B57;font-weight:bold;font-size:13px');
