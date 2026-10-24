const $ = (s) => document.querySelector(s);
const items = [];
let uid = 0, cropper = null, current = null;
const P = { br: 0, co: 0, sa: 0, sh: 0, mode: 'none' };
let rot = 0, sx = 1, sy = 1;

const icons = () => window.lucide && lucide.createIcons();
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); };
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const readFile = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });

/* ---------- Adding images ---------- */
async function addFiles(files) {
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  if (!list.length) return toast('Choose image files (JPG, PNG, WebP).');
  for (const f of list) {
    try {
      const img = await load(await readFile(f));
      const k = Math.min(1, 3200 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      const src = c.toDataURL('image/jpeg', 0.95);
      items.push({ id: ++uid, orig: src, src, w: c.width, h: c.height });
    } catch { toast(`Could not read ${f.name}.`); }
  }
  render();
}

function render() {
  const g = $('#grid'); g.innerHTML = '';
  items.forEach((it, i) => {
    const li = document.createElement('li'); li.className = 'card'; li.dataset.id = it.id;
    li.innerHTML = `<button class="thumb" aria-label="Edit page ${i + 1}" style="background-image:url(${it.src})"><span class="badge">${i + 1}</span></button>
      <div class="bar"><button class="btn icon handle" aria-label="Drag to reorder"><i data-lucide="grip-horizontal"></i></button>
      <button class="btn icon" data-a="edit" aria-label="Edit"><i data-lucide="wand-sparkles"></i></button>
      <button class="btn icon" data-a="rot" aria-label="Rotate 90 degrees"><i data-lucide="rotate-cw"></i></button>
      <button class="btn icon" data-a="del" aria-label="Remove"><i data-lucide="trash-2"></i></button></div>`;
    g.append(li);
  });
  $('#exportBtn').disabled = !items.length;
  $('#count').textContent = items.length ? `${items.length} page${items.length > 1 ? 's' : ''} ready.` : 'No pages yet.';
  icons();
}

$('#grid').addEventListener('click', async (e) => {
  const li = e.target.closest('.card'); if (!li) return;
  const it = items.find((x) => x.id == li.dataset.id);
  const a = e.target.closest('[data-a]')?.dataset.a;
  if (a === 'del') { items.splice(items.indexOf(it), 1); render(); }
  else if (a === 'rot') { await bake(it, (c, x, img) => { c.width = img.height; c.height = img.width; x.translate(c.width, 0); x.rotate(Math.PI / 2); }); render(); }
  else if (e.target.closest('.thumb') || a === 'edit') openStudio(it);
});
async function bake(it, setup) {
  const img = await load(it.src), c = document.createElement('canvas'), x = c.getContext('2d');
  c.width = img.width; c.height = img.height; setup(c, x, img); x.drawImage(img, 0, 0);
  it.src = c.toDataURL('image/jpeg', 0.95); it.w = c.width; it.h = c.height;
}

Sortable.create($('#grid'), {
  handle: '.handle', animation: 180, ghostClass: 'ghost', delay: 120, delayOnTouchOnly: true, touchStartThreshold: 4,
  onEnd: () => { const order = [...$('#grid').children].map((l) => +l.dataset.id); items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)); render(); }
});

const drop = $('#drop');
$('#file').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
['dragenter', 'dragover'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
$('#clearBtn').onclick = () => { if (items.length && confirm('Remove all pages?')) { items.length = 0; render(); } };

/* ---------- Settings panel ---------- */
$('#panelBtn').onclick = () => $('#panel').classList.toggle('open');
$('#margin').oninput = (e) => $('#marginOut').textContent = e.target.value + ' mm';
$('#quality').oninput = (e) => $('#qualOut').textContent = e.target.value + '%';

/* ---------- Image studio ---------- */
const styleTag = document.head.appendChild(document.createElement('style'));
function preview() {
  const f = `brightness(${1 + P.br / 100}) contrast(${1 + P.co / 100}) saturate(${1 + P.sa / 100})` + (P.mode === 'scan' || P.mode === 'bw' ? ' grayscale(1)' : '');
  styleTag.textContent = `.cropper-canvas img,.cropper-view-box img{filter:${f}}`;
}
function setSliders() { $('#fBr').value = P.br; $('#fCo').value = P.co; $('#fSa').value = P.sa; $('#fSh').value = P.sh; preview(); }
function setActive(sel, el) { document.querySelectorAll(sel).forEach((b) => b.classList.toggle('active', b === el)); }

async function openStudio(it) {
  current = it; $('#studio').hidden = false; document.body.style.overflow = 'hidden';
  Object.assign(P, { br: 0, co: 0, sa: 0, sh: 0, mode: 'none' }); rot = 0; sx = sy = 1; $('#fine').value = 0;
  setActive('.presets .chip', document.querySelector('[data-p=none]')); setSliders();
  const img = $('#cropImg'); img.src = it.src; await img.decode().catch(() => {});
  cropper?.destroy();
  cropper = new Cropper(img, { viewMode: 1, autoCropArea: 1, background: false, responsive: true, dragMode: 'move', checkOrientation: false });
  icons();
}
function closeStudio() { cropper?.destroy(); cropper = null; $('#studio').hidden = true; document.body.style.overflow = ''; styleTag.textContent = ''; }
$('#closeStudio').onclick = closeStudio;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#studio').hidden) closeStudio(); });

let locked = false;
function setLock(v) { locked = v; $('#lock').innerHTML = `<i data-lucide="${v ? 'lock' : 'lock-open'}"></i>`; icons(); }
document.querySelectorAll('[data-ar]').forEach((b) => b.onclick = () => {
  setActive('[data-ar]', b); const r = parseFloat(b.dataset.ar);
  cropper.setAspectRatio(r); setLock(!isNaN(r));
});
$('#lock').onclick = () => {
  if (locked) { cropper.setAspectRatio(NaN); setLock(false); setActive('[data-ar]', document.querySelector('[data-ar="NaN"]')); }
  else { const d = cropper.getData(); cropper.setAspectRatio(d.width / d.height); setLock(true); }
};
$('#rotL').onclick = () => { rot -= 90; cropper.rotateTo(rot + +$('#fine').value); };
$('#rotR').onclick = () => { rot += 90; cropper.rotateTo(rot + +$('#fine').value); };
$('#flipH').onclick = () => cropper.scaleX(sx *= -1);
$('#flipV').onclick = () => cropper.scaleY(sy *= -1);
$('#fine').oninput = (e) => cropper.rotateTo(rot + +e.target.value);

[['fBr', 'br'], ['fCo', 'co'], ['fSa', 'sa'], ['fSh', 'sh']].forEach(([id, k]) => $('#' + id).oninput = (e) => { P[k] = +e.target.value; preview(); });
const PRESETS = { none: { br: 0, co: 0, sa: 0, sh: 0 }, scan: { br: 8, co: 35, sa: -100, sh: 40 }, bw: { br: 0, co: 30, sa: -100, sh: 20 }, vivid: { br: 4, co: 15, sa: 40, sh: 10 } };
document.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => { setActive('.presets .chip', b); Object.assign(P, PRESETS[b.dataset.p], { mode: b.dataset.p }); setSliders(); });

$('#resetImg').onclick = async () => { current.src = current.orig; const i = await load(current.orig); current.w = i.width; current.h = i.height; render(); openStudio(current); };
$('#applyImg').onclick = () => {
  const c = cropper.getCroppedCanvas({ maxWidth: 4096, maxHeight: 4096, fillColor: '#fff', imageSmoothingQuality: 'high' });
  if (!c) return toast('Crop area is empty.');
  filterCanvas(c, P);
  current.src = c.toDataURL('image/jpeg', 0.95); current.w = c.width; current.h = c.height;
  closeStudio(); render(); toast('Changes applied.');
};

/* ---------- Pixel pipeline (brightness, contrast, saturation, scan, sharpen) ---------- */
function filterCanvas(c, p) {
  if (!p.br && !p.co && !p.sa && !p.sh && p.mode === 'none') return;
  const w = c.width, h = c.height, x = c.getContext('2d'), id = x.getImageData(0, 0, w, h), d = id.data;
  let bg = null;
  if (p.mode === 'scan') { // estimate paper shading on a small copy, then divide it out
    const s = document.createElement('canvas'), k = 24; s.width = Math.max(8, w / k | 0); s.height = Math.max(8, h / k | 0);
    s.getContext('2d').drawImage(c, 0, 0, s.width, s.height);
    const u = document.createElement('canvas'); u.width = w; u.height = h;
    const ux = u.getContext('2d'); ux.imageSmoothingQuality = 'high'; ux.drawImage(s, 0, 0, w, h);
    bg = ux.getImageData(0, 0, w, h).data;
  }
  const cc = p.co * 2.55, f = (259 * (cc + 255)) / (255 * (259 - cc)), add = p.br * 2.55, sat = 1 + p.sa / 100;
  const gray = p.mode === 'scan' || p.mode === 'bw';
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if (bg) { const bl = Math.max(40, 0.299 * bg[i] + 0.587 * bg[i + 1] + 0.114 * bg[i + 2]); const m = 255 / (bl * 1.04); r *= m; g *= m; b *= m; }
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    if (gray) r = g = b = y; else { r = y + (r - y) * sat; g = y + (g - y) * sat; b = y + (b - y) * sat; }
    r = f * (r + add - 128) + 128; g = f * (g + add - 128) + 128; b = f * (b + add - 128) + 128;
    if (p.mode === 'scan') { // push paper to white, keep ink dark
      const t = Math.min(1, Math.max(0, (r - 70) / 150)), v = 255 * t * t * (3 - 2 * t); r = g = b = v;
    }
    d[i] = r < 0 ? 0 : r > 255 ? 255 : r; d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g; d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  if (p.sh) sharpen(d, w, h, p.sh / 100);
  x.putImageData(id, 0, 0);
}
function sharpen(d, w, h, a) {
  const src = new Uint8ClampedArray(d);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = (y * w + x) * 4;
    for (let k = 0; k < 3; k++) {
      const n = src[i + k - 4] + src[i + k + 4] + src[i + k - w * 4] + src[i + k + w * 4];
      d[i + k] = src[i + k] + a * (4 * src[i + k] - n);
    }
  }
}

/* ---------- PDF export ---------- */
const SIZES = { a4: [210, 297], letter: [215.9, 279.4], legal: [215.9, 355.6], a5: [148, 210] };
$('#exportBtn').onclick = async () => {
  const btn = $('#exportBtn'); btn.disabled = true;
  try {
    const { jsPDF } = window.jspdf, size = $('#pageSize').value, orient = $('#orient').value;
    const m = +$('#margin').value, q = +$('#quality').value / 100;
    let doc = null;
    for (const it of items) {
      const img = await load(it.src), c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0);
      const data = c.toDataURL('image/jpeg', q), ratio = img.width / img.height;
      let pw, ph, iw, ih;
      if (size === 'fit') {
        const k = Math.min(1, 500 / Math.max(img.width, img.height) / 0.2646) * 0.2646; // 96dpi, capped at 500 mm
        iw = img.width * k; ih = img.height * k; pw = iw + 2 * m; ph = ih + 2 * m;
      } else {
        let [a, b] = SIZES[size]; const land = orient === 'l' || (orient === 'auto' && ratio > 1);
        [pw, ph] = land ? [b, a] : [a, b];
        const bw = pw - 2 * m, bh = ph - 2 * m; iw = Math.min(bw, bh * ratio); ih = iw / ratio;
      }
      const o = pw > ph ? 'l' : 'p';
      if (!doc) doc = new jsPDF({ unit: 'mm', format: [pw, ph], orientation: o, compress: true }); else doc.addPage([pw, ph], o);
      doc.addImage(data, 'JPEG', (pw - iw) / 2, (ph - ih) / 2, iw, ih, undefined, 'FAST');
    }
    doc.save(($('#fname').value.trim() || 'studiopdf-document').replace(/[\\/:*?"<>|]/g, '-') + '.pdf');
    toast('PDF saved.');
  } catch (err) { console.error(err); toast('Export failed. Try fewer or smaller images.'); }
  btn.disabled = !items.length;
};
icons();
