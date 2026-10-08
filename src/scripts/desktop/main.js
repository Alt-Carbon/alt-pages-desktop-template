
// The desktop: windows (WinBox.js), wallpapers, the journal, the shelf, notifications, the owner's
// time and weather, and the easter eggs. Everything a visitor changes is kept in their own browser
// under "desk:" keys in localStorage; nothing is sent anywhere except the two Open-Meteo lookups.
// The page is complete without this script: each address carries its window's content as HTML.
import WinBox from "winbox/src/js/winbox.js";
import { load as loadShelf, loadAll } from "../shelf/shared";

const DATA = JSON.parse(document.getElementById("desk-data").textContent);
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const small = () => innerWidth < 720;
// Window title bars: taller on touch screens, so the buttons are big enough for a finger.
const TASK_H = 36, HEAD_H = matchMedia("(pointer: coarse)").matches ? 40 : 28;
document.documentElement.style.setProperty("--head-h", HEAD_H + "px");
const root = document.documentElement;
const T0 = Date.now();
const store = {
  get(k, d) { try { const v = localStorage.getItem("desk:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("desk:" + k, JSON.stringify(v)); } catch {} },
};
$("#mark-date").textContent = fmtDay(DATA.updated);
function fmtDay(d) { const [y, m, dd] = d.split("-"); return `${+dd} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m - 1]} ${y}`; }

/* ---------------------------------------------------------------- wallpapers
   Each wallpaper is drawn on a canvas by a small function from a fixed seed, so it looks the same
   on every visit and at every window size. Drawing works in "design pixels" (CSS pixels on the real
   screen) scaled by s, so a thumbnail is the same picture, smaller. The choice is kept in
   localStorage as desk:wall; a picture of your own is downscaled and kept as desk:wallimg. */
function rng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function noise2(seed) {
  const r = rng(seed), P = new Uint16Array(512), G = new Float32Array(256);
  for (let i = 0; i < 256; i++) { P[i] = i; G[i] = r(); }
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = P[i]; P[i] = P[j]; P[j] = t; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const v = (x, y) => G[P[P[x & 255] + (y & 255)]];
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), u0 = x - xi, w0 = y - yi, u = u0 * u0 * (3 - 2 * u0), w = w0 * w0 * (3 - 2 * w0);
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
  return (x, y, oct = 4) => { let s = 0, amp = .5, f = 1, norm = 0; for (let o = 0; o < oct; o++) { s += n(x * f, y * f) * amp; norm += amp; amp *= .5; f *= 2; } return s / norm; };
}
// Per-pixel wallpapers render into a smaller buffer (q × design size) and are scaled up smoothly.
function pixels(c, W, H, s, fn) {
  const q = Math.min(.5, s), w = Math.max(1, Math.ceil(W / s * q)), h = Math.max(1, Math.ceil(H / s * q));
  const off = document.createElement("canvas"); off.width = w; off.height = h;
  const ox = off.getContext("2d"), img = ox.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const col = fn(x / q, y / q), i = (y * w + x) * 4;
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  }
  ox.putImageData(img, 0, 0);
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = "high"; c.drawImage(off, 0, 0, W, H);
}
function grainOver(c, W, H, s, alpha) {
  const t = document.createElement("canvas"); t.width = t.height = 160;
  const x = t.getContext("2d"), img = x.createImageData(160, 160), d = img.data, r = rng(99);
  for (let i = 0; i < d.length; i += 4) { const g = r() * 255; d[i] = d[i + 1] = d[i + 2] = g; d[i + 3] = 255 * alpha; }
  x.putImageData(img, 0, 0);
  c.save(); c.scale(Math.max(s, .5), Math.max(s, .5)); c.fillStyle = c.createPattern(t, "repeat"); c.fillRect(0, 0, W / Math.max(s, .5), H / Math.max(s, .5)); c.restore();
}
const MS = { 1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[0, 1]], 5: [[0, 3], [2, 1]], 6: [[0, 2]], 7: [[0, 3]], 8: [[0, 3]], 9: [[0, 2]], 10: [[0, 1], [3, 2]], 11: [[0, 1]], 12: [[3, 1]], 13: [[2, 1]], 14: [[3, 2]] };
const WALLS = {
  contours: { accent: "#3F6B4F", label: "Contours", base: "#BFC4B6", draw(c, W, H, s) {
    c.fillStyle = "#C3C8BA"; c.fillRect(0, 0, W, H);
    const nz = noise2(7), st = Math.max(2, Math.round(8 * s)), cols = Math.ceil(W / st) + 1, rows = Math.ceil(H / st) + 1, F = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) F[j * cols + i] = nz(i * st / s / 560 + 3, j * st / s / 560 + 1, 4);
    const N = 34, minor = new Path2D(), major = new Path2D();
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = F[j * cols + i], b = F[j * cols + i + 1], cc = F[(j + 1) * cols + i + 1], d = F[(j + 1) * cols + i];
      const lo = Math.min(a, b, cc, d), hi = Math.max(a, b, cc, d), x0 = i * st, y0 = j * st;
      for (let l = Math.ceil(lo * N); l <= Math.floor(hi * N); l++) {
        const L = l / N, k = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (cc > L ? 2 : 0) | (d > L ? 1 : 0), segs = MS[k]; if (!segs) continue;
        const P = [[x0 + st * (L - a) / (b - a), y0], [x0 + st, y0 + st * (L - b) / (cc - b)], [x0 + st * (L - d) / (cc - d), y0 + st], [x0, y0 + st * (L - a) / (d - a)]];
        const path = l % 5 === 0 ? major : minor;
        for (const [e1, e2] of segs) { path.moveTo(P[e1][0], P[e1][1]); path.lineTo(P[e2][0], P[e2][1]); }
      }
    }
    c.lineCap = "round"; c.strokeStyle = "rgba(44,62,50,.28)"; c.lineWidth = Math.max(.6, s); c.stroke(minor);
    c.strokeStyle = "rgba(44,62,50,.5)"; c.lineWidth = Math.max(.8, 1.6 * s); c.stroke(major);
  } },
  paddy: { accent: "#6E9A2F", label: "Paddy", base: "#5D7A3F", draw(c, W, H, s) {
    const nz = noise2(11), r = rng(5), shade = Array.from({ length: 512 }, () => r());
    const pal = [[93, 122, 63], [112, 141, 71], [80, 107, 54], [131, 152, 80], [70, 95, 49], [104, 129, 61], [146, 160, 92]];
    pixels(c, W, H, s, (X, Y) => {
      const v = (Y + nz(X / 760, Y / 760, 3) * 300 + nz(X / 170 + 9, Y / 170, 2) * 26 + X * .06) / 44;
      const band = Math.floor(v), fr = v - band, sh = shade[(band + 4096) & 511];
      let col;
      if (sh > .86) { const t = fr * .5; col = [118 + 30 * t, 139 + 26 * t, 136 + 22 * t]; }   // a flooded terrace
      else { const p = pal[(band * 5 + 7000) % 7], k = .9 + sh * .18 - fr * .1; col = [p[0] * k, p[1] * k, p[2] * k]; }
      // the bund between two terraces: a 2px pale line with soft edges, so it stays smooth when scaled up
      const dist = Math.min(fr, 1 - fr) * 44, a = Math.max(0, Math.min(1, 1.6 - dist));
      return a ? [col[0] + (206 - col[0]) * a, col[1] + (214 - col[1]) * a, col[2] + (176 - col[2]) * a] : col;
    });
    grainOver(c, W, H, s, .05);
  } },
  monsoon: { accent: "#4C7BD9", label: "Monsoon", base: "#26354C", draw(c, W, H, s) {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#1A2333"); g.addColorStop(.6, "#2B3D55"); g.addColorStop(1, "#5A6E84");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const r = rng(21), n = Math.round((W / s) * (H / s) / 650);
    c.lineCap = "round"; c.lineWidth = Math.max(.5, s);
    for (let i = 0; i < n; i++) {
      const x = r() * W * 1.1, y = r() * H, len = (16 + r() * r() * 70) * s, a = .04 + r() * .16;
      c.strokeStyle = `rgba(214,226,236,${a})`; c.beginPath(); c.moveTo(x, y); c.lineTo(x - len * .26, y + len); c.stroke();
    }
    const f = c.createLinearGradient(0, H * .55, 0, H); f.addColorStop(0, "rgba(196,210,220,0)"); f.addColorStop(1, "rgba(196,210,220,.22)");
    c.fillStyle = f; c.fillRect(0, 0, W, H);
  } },
  dusk: { accent: "#FF6A2A", label: "Dusk", base: "#3A2440", draw(c, W, H, s) {
    c.fillStyle = "#2A1E36"; c.fillRect(0, 0, W, H);
    const blobs = [[.12, .1, .75, "255,106,42", .85], [.88, .08, .6, "178,58,110", .8], [.75, .95, .8, "45,110,115", .85], [.12, .95, .6, "91,58,140", .8], [.5, .35, .45, "242,166,90", .55]];
    for (const [x, y, rr, col, a] of blobs) {
      const R = rr * Math.max(W, H), g = c.createRadialGradient(x * W, y * H, 0, x * W, y * H, R);
      g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    grainOver(c, W, H, s, .07);
  } },
  basalt: { accent: "#8AA04E", label: "Crushed basalt", base: "#2F3332", draw(c, W, H, s) {
    c.fillStyle = "#262A29"; c.fillRect(0, 0, W, H);
    const r = rng(3), n = Math.round((W / s) * (H / s) / 70);
    for (let i = 0; i < n; i++) {
      const cx = r() * W, cy = r() * H, rad = (2.5 + r() * r() * 9) * s, k = 5 + ((r() * 4) | 0), rot = r() * 6.28, pts = [];
      for (let j = 0; j < k; j++) { const a = rot + j / k * 6.283 + (r() - .5) * .7, d = rad * (.62 + r() * .38); pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * .82]); }
      const path = new Path2D(); pts.forEach(([x, y], j) => j ? path.lineTo(x, y) : path.moveTo(x, y)); path.closePath();
      c.save(); c.translate(1.3 * s, 1.6 * s); c.fillStyle = "rgba(0,0,0,.38)"; c.fill(path); c.restore();
      const t = r(), olivine = r() < .02, g = 50 + t * 42;
      c.fillStyle = olivine ? `rgb(${76 + t * 20},${88 + t * 20},${62 + t * 12})` : `rgb(${g},${g + 2},${g + 2})`; c.fill(path);
      c.strokeStyle = `rgba(255,255,255,${.04 + t * .06})`; c.lineWidth = Math.max(.5, .8 * s); c.stroke(path);
    }
  } },
  grain: { accent: "#557F72", label: "Sage grain", base: "#26302F", draw(c, W, H) {
    const A = [125, 140, 134], B = [38, 48, 47], BAY = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
    const img = c.createImageData(W, H), d = img.data;
    for (let y = 0; y < H; y++) { const g = Math.pow(y / Math.max(1, H - 1), 1.3); for (let x = 0; x < W; x++) { const col = g > (BAY[(y & 7) * 8 + (x & 7)] + .5) / 64 ? B : A, i = (y * W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255; } }
    c.putImageData(img, 0, 0);
  } },
  plain: { accent: DATA.accent || "#FF4F00", label: "Plain", base: "#27302F", draw(c, W, H) { c.fillStyle = "#27302F"; c.fillRect(0, 0, W, H); } },
  custom: { accent: "#FF4F00", label: "Your picture", base: "#222", draw(c, W, H) {
    const im = customImg; if (!im) { c.fillStyle = "#27302F"; c.fillRect(0, 0, W, H); return; }
    const k = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
    c.imageSmoothingQuality = "high"; c.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  } },
};
// The owner's own wallpaper (Site settings, Desktop), when they set one.
let ownerImg = null, ownerAccent = "#FF4F00";
if (DATA.picture) WALLS.picture = { accent: "#FF4F00", label: `${DATA.first}'s picture`, base: "#222", draw(c, W, H) {
  const im = ownerImg; if (!im) { c.fillStyle = "#27302F"; c.fillRect(0, 0, W, H); return; }
  const k = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
  c.imageSmoothingQuality = "high"; c.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
} };
const DEFAULT_WALL = DATA.picture ? "picture" : WALLS[DATA.wallpaper] ? DATA.wallpaper : "contours";
let customImg = null, customAccent = "#FF4F00";

/* Accent: each wallpaper names one colour from its own palette; a picture of your own gives up its
   most common vivid hue. Text on the accent is ink or white, whichever reads better. At night a dark
   accent is lifted so it still shows on dark paper. */
const toRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
function lum(c) { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); }
function rgbHsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx === mn) return [0, 0, l]; const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h / 6, s, l]; }
function hslRgb([h, s, l]) { if (!s) return [l * 255, l * 255, l * 255]; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]; }
function pickAccent(im) {
  const n = 48, cv = document.createElement("canvas"); cv.width = cv.height = n; const x = cv.getContext("2d"); x.drawImage(im, 0, 0, n, n);
  const d = x.getImageData(0, 0, n, n).data, bins = Array.from({ length: 24 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  for (let i = 0; i < d.length; i += 4) {
    const c = [d[i], d[i + 1], d[i + 2]], mx = Math.max(...c), mn = Math.min(...c), sat = mx ? (mx - mn) / mx : 0, val = mx / 255;
    if (sat < .25 || val < .2) continue;
    const [h] = rgbHsl(c), bin = bins[Math.floor(h * 24) % 24], w = sat * val;
    bin.w += w; bin.r += c[0] * w; bin.g += c[1] * w; bin.b += c[2] * w;
  }
  const top = bins.reduce((a, b) => (b.w > a.w ? b : a));
  if (!top.w) return "#FF4F00";
  const [h, sat, l] = rgbHsl([top.r / top.w, top.g / top.w, top.b / top.w]);
  return toHex(hslRgb([h, Math.max(sat, .5), Math.min(.58, Math.max(.38, l))]));
}
function setAccent(hex) {
  let c = toRgb(hex);
  if (root.dataset.theme === "night" && lum(c) < .18) c = c.map((v) => v + (255 - v) * .35);
  root.style.setProperty("--accent", toHex(c));
  root.style.setProperty("--accent-ink", lum(c) > .179 ? "#141414" : "#FFFFFF");
}
function loadCustom(src) {
  return new Promise((res) => { if (!src) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
}
function wallKey() { const k = store.get("wall", DEFAULT_WALL); return WALLS[k] && (k !== "custom" || customImg) ? k : DEFAULT_WALL; }
const wall = $("#wall"), wctx = wall.getContext("2d");
let wallCache = { id: "", canvas: null };
function paintWall() {
  const classic = root.dataset.classic !== undefined, key = classic ? "classic" : wallKey();
  const s = Math.min(devicePixelRatio || 1, 2), W = Math.ceil(innerWidth * s), H = Math.ceil((innerHeight - TASK_H) * s);
  if (wall.width !== W || wall.height !== H) { wall.width = W; wall.height = H; }
  if (classic) { wctx.fillStyle = "#008080"; wctx.fillRect(0, 0, W, H); root.style.setProperty("--desk-b", "#008080"); root.style.removeProperty("--accent"); root.style.removeProperty("--accent-ink"); dispatchEvent(new Event("desk:wall")); return; }
  const id = `${key}|${W}x${H}|${key === "custom" ? (customImg?.src.length || 0) : key === "picture" ? (ownerImg ? 1 : 0) : ""}`;
  if (wallCache.id !== id) {
    const off = document.createElement("canvas"); off.width = W; off.height = H;
    WALLS[key].draw(off.getContext("2d"), W, H, s);
    wallCache = { id, canvas: off };
  }
  wctx.drawImage(wallCache.canvas, 0, 0);
  if (root.dataset.theme === "night") { wctx.fillStyle = "rgba(8,10,12,.45)"; wctx.fillRect(0, 0, W, H); }
  root.style.setProperty("--desk-b", WALLS[key].base);
  setAccent(key === "custom" ? customAccent : key === "picture" ? ownerAccent : WALLS[key].accent);
  dispatchEvent(new Event("desk:wall"));
}
function thumb(key, cw = 120, ch = 76) {
  const cv = document.createElement("canvas"), d = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.round(cw * d); cv.height = Math.round(ch * d); cv.style.width = cw + "px"; cv.style.height = ch + "px";
  if ((key === "custom" && !customImg) || (key === "picture" && !ownerImg)) return cv;
  WALLS[key].draw(cv.getContext("2d"), cv.width, cv.height, cv.width / innerWidth);
  return cv;
}
let resizeT;
addEventListener("resize", () => { layoutIcons(); clearTimeout(resizeT); resizeT = setTimeout(paintWall, 120); });
loadCustom(store.get("wallimg", null)).then((im) => { customImg = im; if (im) customAccent = pickAccent(im); if (store.get("wall", DEFAULT_WALL) === "custom") paintWall(); });
if (DATA.picture) loadCustom(DATA.picture).then((im) => { ownerImg = im; if (im) ownerAccent = pickAccent(im); if (wallKey() === "picture") paintWall(); });

/* ---------------------------------------------------------------- theme */
function applyTheme() {
  const t = store.get("theme", "day");
  if (t === "night") root.dataset.theme = "night"; else delete root.dataset.theme;
  if (store.get("classic", false)) root.dataset.classic = ""; else delete root.dataset.classic;
  paintWall();
}
applyTheme();

/* ---------------------------------------------------------------- icons */
const desktop = $("#desktop"), icons = $$(".icon");
const iconId = (el) => (el.dataset.doc ? "doc:" + el.dataset.doc : el.dataset.open);   // pinned pieces share data-open
function layoutIcons() {
  if (small()) { icons.forEach((el) => { el.style.left = el.style.top = ""; }); return; }
  const pos = store.get("icons", {});
  const perCol = Math.max(1, Math.floor((innerHeight - TASK_H - 24) / 96));
  icons.forEach((el, i) => {
    const p = pos[iconId(el)];
    const x = p ? p[0] : 14 + Math.floor(i / perCol) * 96, y = p ? p[1] : 14 + (i % perCol) * 96;
    el.style.left = Math.min(x, innerWidth - 100) + "px"; el.style.top = Math.min(y, innerHeight - TASK_H - 90) + "px";
  });
}
layoutIcons();
let selIcon = null;
function select(el) { selIcon?.classList.remove("sel"); selIcon = el; el?.classList.add("sel"); }
const coarse = matchMedia("(pointer: coarse)").matches;
icons.forEach((el) => {
  let sx, sy, ox, oy, moved, pid;
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    select(el); moved = false; pid = e.pointerId;
    sx = e.clientX; sy = e.clientY; ox = el.offsetLeft; oy = el.offsetTop;
    if (!small()) el.setPointerCapture(pid);
  });
  el.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pid || small()) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    moved = true; el.classList.add("drag");
    el.style.left = Math.max(0, Math.min(innerWidth - 96, ox + dx)) + "px";
    el.style.top = Math.max(0, Math.min(innerHeight - TASK_H - 70, oy + dy)) + "px";
  });
  el.addEventListener("pointerup", (e) => {
    if (e.pointerId !== pid) return;
    pid = null; el.classList.remove("drag");
    el._moved = moved;
    if (moved) { const pos = store.get("icons", {}); pos[iconId(el)] = [el.offsetLeft, el.offsetTop]; store.set("icons", pos); }
  });
  // The address is for pages without JavaScript. On touch screens one tap opens, on the click that
  // follows the tap: opening on the finger's lift would let that click land inside the new window.
  el.addEventListener("click", (e) => { e.preventDefault(); if ((coarse || small()) && !el._moved && e.detail) openIcon(el); });
  el.addEventListener("dblclick", () => openIcon(el));
  el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openIcon(el); } });
});
desktop.addEventListener("pointerdown", (e) => { if (e.target === desktop) select(null); });
function openIcon(el) { if (el.dataset.doc) openWriting(el.dataset.doc); else open(el.dataset.open); }

/* ---------------------------------------------------------------- windows */
const wins = {}; let cascade = 0;
const SIZES = { notepad: [560, 520], explorer: [660, 420], journal: [940, 620], reading: [1080, 720], sys: [460, 400], dlg: [380, 200] };
const ICON_OF = { about: "txt", now: "txt", writing: "journal", research: "folder", reading: "books", computer: "pc", bin: "bin" };
function open(key, opts = {}) {
  if (wins[key]) { const w = wins[key]; if (w.min) w.restore(); w.focus(); return w; }
  const el = $("#body-" + key); if (!el) return;
  const app = el.dataset.app, [W, H] = SIZES[app] || SIZES.explorer;
  const maxW = innerWidth - 24, maxH = innerHeight - TASK_H - 24;
  const w = Math.min(W, maxW), h = Math.min(H, maxH);
  const n = cascade++ % 7;
  const x = Math.min(opts.x ?? (small() ? 0 : 120 + n * 28), Math.max(0, innerWidth - w - 12));
  const y = Math.min(opts.y ?? (small() ? 0 : 36 + n * 24), Math.max(0, innerHeight - TASK_H - h - 12));
  el.hidden = false;
  if (app === "notepad" && !el.dataset.ready) { el.dataset.ready = "1"; el.prepend(notepadMenu(el, key)); }
  $(`.icon[data-open="${key}"]`)?.classList.remove("new");
  if (app === "journal" && !el.journal) el.journal = initJournal(el);
  if (app === "reading" && !el.ready) el.ready = initReading(el);
  const wb = new WinBox({
    // On phones every window is full-screen, so there is nothing to maximise.
    title: el.dataset.title, mount: el, class: ["no-full", "app-" + app, ...(small() ? ["no-max"] : [])], x, y, width: w, height: h, bottom: TASK_H, header: HEAD_H, border: 0,
    max: small(), minwidth: 260, minheight: 120,
    onclose() { delete wins[key]; setTimeout(() => { el.hidden = true; }, 0); taskbar(); route(); },
    onfocus() { taskbar(); route(); }, onblur() { taskbar(); }, onminimize() { taskbar(); }, onrestore() { taskbar(); },
  });
  wb.key = key; wb.app = app; wins[key] = wb;
  if (app === "journal") el.journal.ready.then(() => { const cur = $(".jr-item[aria-current=true]", el), d = cur && $(`.jr-doc[data-doc="${CSS.escape(cur.dataset.note || "")}"]`, el); if (d && wins.writing === wb) { wb.sub = cur.dataset.note; wb.setTitle(d.dataset.title + " — Writing"); taskbar(); route(); } });
  taskbar(); route();
  return wb;
}
// Each window has a page of its own (/about, /now, /writing/<slug>, /research, /reading). The address
// bar follows the window in front, so a link copied from it opens the same window. My Computer, the
// Recycle Bin and dialogs have no page and leave the address alone.
const TITLES = { about: "About", now: "Now", writing: "Writing", research: "Research", reading: "Reading" };
function route() {
  const top = Object.values(wins).filter((w) => w.focused && !w.min && w.app !== "dlg")[0];
  if (!top || !TITLES[top.key]) return;
  if (top.key === "reading" && /^#book-/.test(location.hash)) return;   // a book's address, set by the shelf
  let path = $("#body-" + top.key)?.dataset.path || "/";
  if (top.key === "writing" && top.sub) path += "/" + top.sub;
  if (top.key === "about" && location.pathname === "/") path = "/";
  const sub = top.key === "writing" && top.sub ? $(`.jr-doc[data-doc="${CSS.escape(top.sub)}"]`)?.dataset.title : "";
  document.title = path === "/" ? DATA.name : `${sub || TITLES[top.key]} · ${DATA.name}`;
  if (location.pathname !== path || location.hash) { try { history.replaceState(null, "", path + location.search); } catch {} }
}
document.addEventListener("click", (e) => {
  const o = e.target.closest("[data-open]"); if (!o || o.classList.contains("icon") || o.closest(".explorer")) return;
  e.preventDefault();
  open(o.dataset.open); closeMenus();
});
/* explorer rows: click selects, double-click opens, Enter opens */
document.addEventListener("dblclick", (e) => { const r = e.target.closest(".explorer .row"); if (r) openRow(r); });
document.addEventListener("click", (e) => {
  const r = e.target.closest(".explorer .row");
  if (r) { $$(".row.sel", r.closest("table")).forEach((x) => x.classList.remove("sel")); r.classList.add("sel"); if (coarse) openRow(r); }
});
document.addEventListener("keydown", (e) => { const r = e.target.closest?.(".explorer .row"); if (r && e.key === "Enter") openRow(r); });
$$(".explorer .row").forEach((r) => r.tabIndex = 0);
function openRow(r) { if (r.dataset.open) open(r.dataset.open); else if (r.dataset.href) window.open(r.dataset.href, "_blank", "noopener"); }
/* reading tabs */
document.addEventListener("click", (e) => {
  const t = e.target.closest(".tabs [data-tab]"); if (!t) return;
  const box = t.closest(".reading");
  $$("[role=tab]", box).forEach((b) => b.setAttribute("aria-selected", b === t));
  $$(".pane", box).forEach((p) => p.hidden = p.dataset.pane !== t.dataset.tab);
});

/* ---------------------------------------------------------------- Writing: a journal
   The owner's pieces are locked: anyone can read them, nobody here can change them. Visitors can
   write notes of their own, kept in this browser's localStorage (desk:notes) and nowhere else. */
const escH = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/* ---------------------------------------------------------------- margin notes
   On a locked piece, a visitor can select a passage and keep a private note beside it. The piece never
   changes. Notes live in this browser (desk:margins), anchored by character offset into the piece's
   text, with the quoted words kept so a note can find its passage again if the offset drifts. */
const clip = (x, n) => (x.length > n ? x.slice(0, n - 1).trimEnd() + "…" : x);
const MN = {
  all() { const m = store.get("margins", {}); return m && typeof m === "object" && !Array.isArray(m) ? m : {}; },
  save(m) { try { localStorage.setItem("desk:margins", JSON.stringify(m)); return true; } catch { return false; } },
  of(slug) { return this.all()[slug] || []; },
};
function textNodes(root) { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), out = []; let n; while ((n = w.nextNode())) out.push(n); return out; }
function wrapRange(root, start, end, id) {
  let pos = 0;
  for (const t of textNodes(root)) {
    const a = pos, b = pos + t.length; pos = b;
    if (b <= start || a >= end) continue;
    let node = t;
    const e = Math.min(t.length, end - a), st = Math.max(0, start - a);
    if (e < node.length) node.splitText(e);
    if (st > 0) node = node.splitText(st);
    if (!node.data.trim()) continue;
    const m = document.createElement("mark"); m.className = "mn"; m.dataset.n = id;
    node.replaceWith(m); m.append(node);
  }
}
function unwrapMarks(root) { root.querySelectorAll("mark.mn").forEach((m) => m.replaceWith(...m.childNodes)); root.normalize(); }
function initMargins(el, pane, when) {
  const addBtn = document.createElement("button"), pop = document.createElement("div");
  addBtn.type = "button"; addBtn.className = "mn-add"; addBtn.textContent = "Add note"; addBtn.hidden = true;
  pop.className = "mn-pop"; pop.hidden = true; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Margin note");
  pane.append(addBtn, pop);
  let pending = null, selT;
  const place = (box, rect, below = true) => {
    const pr = pane.getBoundingClientRect();
    box.style.top = (below ? rect.bottom - pr.top + 8 : rect.top - pr.top) + pane.scrollTop + "px";
    box.style.left = Math.max(12, Math.min(rect.left - pr.left, pane.clientWidth - box.offsetWidth - 12)) + "px";
  };
  const hide = () => { addBtn.hidden = true; pop.hidden = true; $$("mark.mn.on", el).forEach((m) => m.classList.remove("on")); };
  function render(doc) {
    const slug = doc.dataset.doc, root = $(".jr-text", doc), list = $(".mn-list", doc); if (!root || !list) return;   // pieces published elsewhere take no notes
    unwrapMarks(root);
    const notes = MN.of(slug), text = root.textContent;
    for (const n of [...notes].sort((a, b) => a.start - b.start)) {
      let at = n.start; if (text.slice(at, at + n.quote.length) !== n.quote) at = text.indexOf(n.quote);
      n.lost = at < 0; if (!n.lost) wrapRange(root, at, at + n.quote.length, n.id);
    }
    list.hidden = !notes.length;
    list.innerHTML = notes.length ? `<h2>Your notes on this piece</h2><ol>${[...notes].sort((a, b) => a.start - b.start).map((n) =>
      `<li data-n="${n.id}"><button class="mn-q" type="button">${escH(clip(n.quote, 140))}</button><p>${escH(n.note)}</p><span class="m">${when(n.at)}${n.lost ? ". The passage has changed since." : ""}</span></li>`).join("")}</ol>
      <p class="mn-foot">Only you can see these. They stay in this browser.</p>` : "";
    const item = $(`.jr-item[data-note="${CSS.escape(slug)}"] .m`, el);
    if (item) { item.querySelector(".mc")?.remove(); if (notes.length) item.insertAdjacentHTML("beforeend", `<span class="mc"> · ${notes.length} ${notes.length === 1 ? "note" : "notes"}</span>`); }
  }
  // Offer "Add note" when the selection sits inside one locked piece's text.
  function check() {
    if (pop.contains(document.activeElement)) return;
    const sel = getSelection(); if (!sel.rangeCount || sel.isCollapsed) { addBtn.hidden = true; return; }
    const r = sel.getRangeAt(0), c = r.commonAncestorContainer, root = (c.nodeType === 1 ? c : c.parentElement)?.closest(".jr-text");
    if (!root || !el.contains(root) || root.closest(".jr-doc").hidden) { addBtn.hidden = true; return; }
    const raw = r.toString(), quote = raw.trim(); if (quote.length < 2) { addBtn.hidden = true; return; }
    const pre = document.createRange(); pre.setStart(root, 0); pre.setEnd(r.startContainer, r.startOffset);
    pending = { doc: root.closest(".jr-doc"), start: pre.toString().length + (raw.length - raw.trimStart().length), quote };
    addBtn.hidden = false; place(addBtn, r.getBoundingClientRect());
  }
  document.addEventListener("selectionchange", () => { clearTimeout(selT); selT = setTimeout(check, 120); });
  addBtn.addEventListener("pointerdown", (e) => e.preventDefault());   // keep the selection
  function compose(p, existing, rect) {
    addBtn.hidden = true;
    pop.innerHTML = `<blockquote>${escH(clip(p.quote, 220))}</blockquote><textarea aria-label="Your note" placeholder="Your note">${escH(existing?.note || "")}</textarea>
      <div class="row"><span>Only you will see this</span><div><button class="btn" type="button" data-mn="cancel">Cancel</button><button class="btn primary" type="button" data-mn="save">Save note</button></div></div>`;
    pop.hidden = false; pop._p = p; pop._id = existing?.id || null; place(pop, rect);
    const ta = $("textarea", pop); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  }
  function view(id, mark) {
    const n = MN.of(mark.closest(".jr-doc").dataset.doc).find((x) => x.id === id); if (!n) return;
    $$("mark.mn.on", el).forEach((m) => m.classList.remove("on")); $$(`mark.mn[data-n="${id}"]`, el).forEach((m) => m.classList.add("on"));
    pop.innerHTML = `<p class="note">${escH(n.note)}</p><div class="row"><span>${when(n.at)}</span><div><button class="btn" type="button" data-mn="delete">Delete</button><button class="btn primary" type="button" data-mn="edit">Edit</button></div></div>`;
    pop.hidden = false; pop._p = { doc: mark.closest(".jr-doc"), start: n.start, quote: n.quote }; pop._id = id; place(pop, mark.getBoundingClientRect());
  }
  addBtn.addEventListener("click", () => { if (pending) compose(pending, null, addBtn.getBoundingClientRect()); });
  pop.addEventListener("click", (e) => {
    const act = e.target.closest("[data-mn]")?.dataset.mn; if (!act) return;
    const p = pop._p, slug = p.doc.dataset.doc, all = MN.all(), list = (all[slug] ||= []);
    if (act === "cancel") { hide(); return; }
    if (act === "edit") { compose(p, list.find((x) => x.id === pop._id), pop.getBoundingClientRect()); return; }
    if (act === "delete") { all[slug] = list.filter((x) => x.id !== pop._id); if (!all[slug].length) delete all[slug]; MN.save(all); hide(); render(p.doc); return; }
    if (act === "save") {
      const note = $("textarea", pop).value.trim(); if (!note) { $("textarea", pop).focus(); return; }
      const n = pop._id && list.find((x) => x.id === pop._id);
      if (n) { n.note = note; n.at = Date.now(); } else list.push({ id: Date.now().toString(36), start: p.start, quote: p.quote, note, at: Date.now() });
      MN.save(all); hide(); getSelection().removeAllRanges(); render(p.doc);
    }
  });
  pop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); hide(); }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) $('[data-mn="save"]', pop)?.click();
  });
  el.addEventListener("click", (e) => {
    const m = e.target.closest("mark.mn"); if (m && getSelection().isCollapsed) { view(m.dataset.n, m); return; }
    const q = e.target.closest(".mn-q"); if (q) { const id = q.closest("li").dataset.n, mk = $(`mark.mn[data-n="${id}"]`, el); if (mk) { mk.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" }); setTimeout(() => view(id, mk), reduced ? 0 : 350); } }
  });
  document.addEventListener("pointerdown", (e) => { if (!pop.hidden && !e.target.closest(".mn-pop, mark.mn, .mn-q")) hide(); });
  return { render, hide };
}
function initJournal(el) {
  const jr = $(".jr", el), first = jr.dataset.first, mine = $("[data-mine-list]", el), mineH = $(".jr-mine-h", el), ed = $(".jr-edit", el), pane = $(".jr-pane", el);
  const notesOn = "notes" in jr.dataset;
  const title = ed && $(".jr-title", ed), body = ed && $(".jr-body", ed), status = ed && $(".jr-status", ed);
  let notes = store.get("notes", []); if (!Array.isArray(notes)) notes = [];
  let current = null, saveT;
  const save = () => { try { localStorage.setItem("desk:notes", JSON.stringify(notes)); return true; } catch { return false; } };
  const when = (t) => { const d = new Date(t); return d.toDateString() === new Date().toDateString() ? "Today, " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : fmtDay(d.toISOString().slice(0, 10)); };
  function renderMine() {
    if (!mine) return;
    mine.innerHTML = [...notes].sort((a, b) => b.updated - a.updated).map((n) => `<li><button class="jr-item" data-mine="${n.id}" aria-current="${current === "m:" + n.id}"><span class="t">${escH(n.title.trim() || "Untitled")}</span><span class="m">${when(n.updated)}</span></button></li>`).join("");
    mineH.hidden = !notes.length;   // the heading appears with the first note
  }
  const margins = notesOn ? initMargins(el, pane, when) : { render() {}, hide() {} };
  $$(".jr-doc", el).forEach((d) => margins.render(d));   // marks and note counts for every piece
  // New since the visitor's last visit: a dot beside the piece.
  for (const p of NEWS?.pieces || []) $(`.jr-item[data-note="${CSS.escape(p.slug)}"]`, el)?.classList.add("new");
  // A piece that isn't on this page is read from its own page, once.
  const fetching = {};
  function ensureDoc(slug) {
    const have = $(`.jr-doc[data-doc="${CSS.escape(slug)}"]`, el); if (have) return Promise.resolve(have);
    if (!DATA.writing.some((p) => p.slug === slug && !p.link)) return Promise.resolve(null);
    return (fetching[slug] ??= fetch(`/writing/${slug}`).then((r) => (r.ok ? r.text() : "")).then((html) => {
      const got = new DOMParser().parseFromString(html, "text/html").querySelector(`.jr-doc[data-doc="${CSS.escape(slug)}"]`);
      if (!got) return null;
      const doc = document.importNode(got, true); doc.hidden = true;
      pane.insertBefore(doc, ed || null); margins.render(doc);
      return doc;
    }).catch(() => null));
  }
  async function show(id, reveal = true) {
    const n = id.startsWith("m:") ? notes.find((x) => x.id === id.slice(2)) : null;
    if (!n) { pane.setAttribute("aria-busy", "true"); }
    const doc = n ? null : await ensureDoc(id);
    pane.removeAttribute("aria-busy");
    if (!n && !doc) { if (reveal) window.location.href = `/writing/${id}`; return false; }
    current = id;
    $$(".jr-doc", el).forEach((d) => d.hidden = d !== doc);
    margins.hide();
    if (ed) ed.hidden = !n;
    if (n) { title.value = n.title; body.value = n.body; status.textContent = "Saved in this browser"; }
    $$(".jr-item", el).forEach((b) => b.setAttribute("aria-current", String((b.dataset.note || "m:" + b.dataset.mine) === id)));
    if (reveal) jr.classList.add("open-note");
    pane.scrollTop = 0;
    const w = wins.writing;
    if (w) { w.sub = n ? "" : id; w.setTitle((n ? (n.title.trim() || "Untitled") : doc.dataset.title) + " — Writing"); taskbar(); route(); }
    return true;
  }
  function newNote() {
    const n = { id: Date.now().toString(36), title: "", body: "", created: Date.now(), updated: Date.now() };
    notes.push(n); save(); renderMine(); show("m:" + n.id).then(() => title.focus());
  }
  function edited() {
    const n = notes.find((x) => "m:" + x.id === current); if (!n) return;
    n.title = title.value; n.body = body.value; n.updated = Date.now();
    status.textContent = "Saving…";
    clearTimeout(saveT); saveT = setTimeout(() => {
      status.textContent = save() ? "Saved in this browser" : "Not saved: this browser's storage is full";
      renderMine();
      wins.writing?.setTitle((n.title.trim() || "Untitled") + " — Writing"); taskbar();
    }, 350);
  }
  if (ed) {
    title.addEventListener("input", edited); body.addEventListener("input", edited);
    title.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); body.focus(); } });
  }
  function nudge(lock) {
    lock.textContent = `Locked. Only ${first} can change this.`; lock.classList.remove("nudge"); void lock.offsetWidth; lock.classList.add("nudge");
    clearTimeout(lock._t); lock._t = setTimeout(() => { lock.textContent = "Locked"; lock.classList.remove("nudge"); }, 2200);
  }
  el.addEventListener("click", (e) => {
    const it = e.target.closest(".jr-item"); if (it) { e.preventDefault(); show(it.dataset.note || "m:" + it.dataset.mine); return; }
    if (e.target.closest(".jr-new")) { newNote(); return; }
    if (e.target.closest(".jr-back")) { jr.classList.remove("open-note"); return; }
    const lock = e.target.closest(".lock"); if (lock) { nudge(lock); return; }
    if (e.target.closest(".jr-del")) {
      const n = notes.find((x) => "m:" + x.id === current); if (!n) return;
      dialog("Delete note", `<p>Delete “${escH(n.title.trim() || "Untitled")}”?</p><p>It is only in this browser, so it can't be brought back.</p>`, "!",
        [{ label: "Cancel" }, { label: "Delete", primary: true, act() { notes = notes.filter((x) => x !== n); save(); renderMine(); show(start, false); jr.classList.remove("open-note"); } }]);
    }
  });
  // Typing into a locked piece, or trying to cut or paste over it, is answered by the lock.
  el.addEventListener("keydown", (e) => {
    const doc = e.target.closest?.(".jr-doc"); if (!doc || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); nudge($(".lock", doc)); }
  });
  ["cut", "paste"].forEach((ev) => el.addEventListener(ev, (e) => { const doc = e.target.closest?.(".jr-doc"); if (doc) { e.preventDefault(); nudge($(".lock", doc)); } }));
  renderMine();
  // Open on the piece this page is for, else the newest piece on this site.
  const start = document.body.dataset.piece || DATA.writing.find((p) => !p.link)?.slug || DATA.writing[0]?.slug;
  const ready = start ? show(start, false) : Promise.resolve(false);
  return { show, ready };
}
function openWriting(slug) {
  const w = open("writing"); const el = $("#body-writing");
  if (slug && el?.journal) el.journal.ready.then(() => el.journal.show(slug, small()));
  return w;
}

/* ---------------------------------------------------------------- Reading: the shelf
   The Sidebar template's four shelf styles (src/scripts/shelf), loaded only when Reading opens. They read
   /reading/view.json from this site's Worker. Switching style sends the event the styles listen for when
   a page is left, so the old one lets go of its listeners. */
const SHELF_STYLES = {
  journal: () => import("../shelf/journal"), gallery: () => import("../shelf/gallery"),
  stacks: () => import("../shelf/stacks"), turn: () => import("../shelf/turn"),
};
async function drawShelf(el, style) {
  const host = $(".shelf-host", el);
  dispatchEvent(new Event("astro:before-swap"));
  $$(".shelf-journal-tip").forEach((x) => x.remove());
  const draw = SHELF_STYLES[style] ? style : "stacks";
  host.className = "shelf-host shelf-" + draw; host.id = "shelf"; host.dataset.style = draw; host.innerHTML = "";
  $$(".shelfpick button", el).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.shelf === draw)));
  const view = await loadShelf();
  if (!view || (!view.read.length && !view.reading.length)) {
    host.innerHTML = `<p class="src">${view?.syncing || host.dataset.goodreads ? "Reading the shelf from Goodreads for the first time. This takes under a minute; close and reopen Reading to see it." : "No Goodreads profile connected yet. Add one in the editor under Site settings."}</p>`;
    return;
  }
  try { (await SHELF_STYLES[draw]()).render(await loadAll(view), host); }
  catch { host.innerHTML = '<p class="src">The shelf could not be drawn. Reload the page to try again.</p>'; }
}
/* Stacks' book drawer is a modal dialog on the Sidebar site. Here it opens as a plain dialog inside the
   Reading window, so the rest of the desktop stays usable. Escape and a click on the dimmed shelf send
   the drawer the same "cancel" it gets on the site, so it closes with its own animation. */
const nativeShowModal = HTMLDialogElement.prototype.showModal;
HTMLDialogElement.prototype.showModal = function () {
  if (this.matches(".app-reading .shelf-stacks-drawer")) return this.show();
  return nativeShowModal.call(this);
};
const cancelDrawer = (dlg) => dlg?.open && dlg.dispatchEvent(new Event("cancel", { cancelable: true }));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") cancelDrawer($(".app-reading .shelf-stacks-drawer[open]")); });
document.addEventListener("click", (e) => { const b = e.target.closest?.(".app-reading .wb-body"); if (b && e.target === b) cancelDrawer($(".shelf-stacks-drawer[open]", b)); });
function initReading(el) {
  const pick = store.get("shelf", $(".shelf-host", el).dataset.default || "stacks");
  drawShelf(el, pick);
  el.addEventListener("click", (e) => { const b = e.target.closest(".shelfpick button"); if (b) { store.set("shelf", b.dataset.shelf); drawShelf(el, b.dataset.shelf); } });
  return true;
}

/* ---------------------------------------------------------------- taskbar */
const tasks = $("#tasks");
function taskbar() {
  tasks.innerHTML = "";
  for (const w of Object.values(wins)) {
    if (w.app === "dlg") continue;
    const b = document.createElement("button");
    b.className = "task" + (w.focused && !w.min ? " active" : "") + (w.min ? " minned" : "");
    b.setAttribute("role", "listitem");
    b.innerHTML = `<span class="pic ${ICON_OF[w.key] || "txt"}"></span><span class="t">${w.title}</span>`;
    b.onclick = () => { if (w.min) { w.restore(); w.focus(); } else if (w.focused) w.minimize(); else w.focus(); };
    tasks.append(b);
  }
}
const clock = $("#clock");
function tick() {
  const d = new Date();
  clock.textContent = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const up = Math.max(1, Math.round((Date.now() - T0) / 60000));
  $$("[data-uptime]").forEach((el) => el.textContent = up === 1 ? "1 min" : `${up} min`);
}
tick(); setInterval(tick, 10000);
clock.onclick = () => {
  const d = new Date(), up = Math.round((Date.now() - T0) / 60000);
  dialog("Date and time", `<p>${d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p><p>${d.toLocaleTimeString()}</p><p>You have been here ${up < 1 ? "under a minute" : up + " min"}. The site was last updated ${fmtDay(DATA.updated)}.</p>`, "i");
};

/* ---------------------------------------------------------------- start menu + context menu */
const start = $("#start"), menu = $("#startmenu"), ctx = $("#ctx");
function closeMenus() { menu.hidden = true; start.setAttribute("aria-expanded", "false"); ctx.hidden = true; $$(".menubar .dd").forEach((d) => d.remove()); $$(".menubar [aria-expanded]").forEach((b) => b.setAttribute("aria-expanded", "false")); }
start.onclick = (e) => { e.stopPropagation(); const show = menu.hidden; closeMenus(); menu.hidden = !show; start.setAttribute("aria-expanded", String(show)); if (show) $(".mi", menu).focus(); };
document.addEventListener("pointerdown", (e) => { if (!e.target.closest("#startmenu,#start,#ctx,.menubar")) closeMenus(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenus(); });
desktop.addEventListener("contextmenu", (e) => {
  if (e.target.closest(".icon")) return;
  e.preventDefault(); closeMenus();
  ctx.hidden = false; ctx.style.left = Math.min(e.clientX, innerWidth - 190) + "px"; ctx.style.top = Math.min(e.clientY, innerHeight - TASK_H - 110) + "px";
});
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-act]"); if (!a) return;
  const act = a.dataset.act; closeMenus();
  if (act === "run") runDialog();
  if (act === "display") displayDialog();
  if (act === "off") shutdown();
  if (act === "arrange") { store.set("icons", {}); layoutIcons(); }
  if (act === "refresh") { desktop.style.visibility = "hidden"; setTimeout(() => { paintWall(); desktop.style.visibility = ""; }, 90); }
  if (act === "restore") dialog("Recycle Bin", "<p>Restore is not available.</p><p>These were set down on purpose. See now.txt, under “Not doing”.</p>", "!");
});
addEventListener("keydown", (e) => { if (e.altKey && e.code === "KeyR") { e.preventDefault(); runDialog(); } });

/* ---------------------------------------------------------------- dialogs */
let dlgN = 0;
function dialog(title, html, glyph = "i", buttons = [{ label: "OK", primary: true }], width = 400) {
  const key = "dlg" + dlgN++;
  const el = document.createElement("div"); el.className = "winbody dlgbody"; el.id = "body-" + key; el.dataset.app = "dlg"; el.dataset.title = title;
  el.innerHTML = `<div class="msg">${glyph ? `<span class="glyph ${glyph === "!" ? "err" : ""}">${glyph}</span>` : ""}<div>${html}</div></div>
    <div class="btns">${buttons.map((b, i) => `<button class="btn ${b.primary ? "primary" : ""}" data-i="${i}">${b.label}</button>`).join("")}</div>`;
  $("#store").append(el);
  const wb = new WinBox({ title, mount: el, class: ["dlg", "no-min", "no-max", "no-full", "no-resize"], width: Math.min(width, innerWidth - 24), height: 200, x: "center", y: "center", bottom: TASK_H, header: HEAD_H, border: 0,
    onclose() { delete wins[key]; setTimeout(() => el.remove(), 0); } });
  wb.key = key; wb.app = "dlg"; wins[key] = wb;
  wb.fit = () => wb.resize(wb.width, Math.min(innerHeight - TASK_H - 24, el.scrollHeight + HEAD_H + 2)).move("center", "center");
  requestAnimationFrame(() => { wb.fit(); ($(".field", el) || $(".btn.primary", el) || $(".btn", el))?.focus(); });
  document.fonts?.ready.then(() => wins[key] && wb.fit());
  $$(".btn", el).forEach((b) => b.onclick = () => { const r = buttons[+b.dataset.i].act?.(el, wb); if (r !== false) wb.close(); });
  el.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.target.closest("textarea")) { e.preventDefault(); $(".btn.primary", el)?.click(); } });
  return wb;
}

/* Run… : a tiny command line over the site */
function runDialog() {
  const names = { about: "about", now: "now", writing: "writing", research: "research", reading: "reading", computer: "computer", bin: "bin", "about.txt": "about", "now.txt": "now", "my computer": "computer", "recycle bin": "bin" };
  dialog("Run", `<p>Type the name of a file, folder or command, and ${DATA.first} OS will open it for you.</p>
    <input class="field" id="run-in" autocomplete="off" spellcheck="false" placeholder="help">
    <pre class="runout" id="run-out"></pre>`, "", [{ label: "Cancel" }, { label: "OK", primary: true, act(el, wb) {
      const inp = $("#run-in", el), out = $("#run-out", el), cmd = inp.value.trim().toLowerCase(); inp.value = "";
      const say = (s) => { out.textContent = s; requestAnimationFrame(() => wb.fit()); return false; };
      if (!cmd) return say("Nothing to run. Try help.");
      if (cmd === "help") return say("Open: about, now, writing, research, reading, computer, bin.\nAsk: whoami, uptime, date, weather.\nChange: wallpaper <name>, theme day or night, classic.\nAlso: cls, exit.");
      if (names[cmd]) { if (!open(names[cmd])) return say(`${DATA.first} hasn't put anything in ${cmd} yet.`); return; }
      if (cmd.startsWith("essay ") || cmd.startsWith("open ")) { const q = cmd.split(" ").slice(1).join(" "); const hit = DATA.writing.find((p) => p.title.toLowerCase().includes(q)); if (hit) { openWriting(hit.slug); return; } return say(`No piece called “${q}”.`); }
      if (cmd === "whoami") return say(`${DATA.name}. ${DATA.oneLiner}`);
      if (cmd === "weather" || cmd === "time") { if (!place) return say("Can't tell where " + DATA.first + " is right now."); return say(`${ownerTime({ weekday: "long" })} in ${place.name}${wx ? `, ${raining() ? "raining" : WX(wx.code)[0]}, ${wx.t}°C` : ""}.`); }
      if (cmd === "uptime") return say(`${Math.max(1, Math.round((Date.now() - T0) / 60000))} min, no reboots.`);
      if (cmd === "date") return say(new Date().toString());
      if (cmd === "wallpaper" || cmd.startsWith("wallpaper ")) { const k = cmd.split(" ")[1]; const names = Object.keys(WALLS).filter((x) => x !== "custom" && x !== "picture"); if (!WALLS[k] || (k === "custom" && !customImg)) return say("Wallpapers: " + names.join(", ") + (customImg ? ", custom" : "") + "."); store.set("wall", k); paintWall(); return say(`Wallpaper: ${WALLS[k].label}.`); }
      if (cmd.startsWith("theme ")) { const k = cmd.split(" ")[1]; if (k !== "day" && k !== "night") return say("theme day | theme night"); store.set("theme", k); applyTheme(); return say(`Theme: ${k}.`); }
      if (cmd === "classic") { toggleClassic(); return say(root.dataset.classic !== undefined ? "Classic mode on. You asked for it." : "Classic mode off."); }
      if (cmd === "cls" || cmd === "clear") return say("");
      if (cmd === "exit" || cmd === "shutdown") { shutdown(); return; }
      if (/^(rm|del|format|sudo)\b/.test(cmd)) return say("Access is denied. This is " + DATA.first + "'s computer.");
      if (cmd === "xyzzy") return say("Nothing happens.");
      if (cmd === "hello" || cmd === "hi") return say(DATA.greeting + ".");
      return say(`Cannot find “${cmd}”. Make sure you typed the name correctly, or try help.`);
    } }]);
  requestAnimationFrame(() => $("#run-in")?.focus());
}

/* Display properties: wallpaper (saved in localStorage), theme, classic */
function displayDialog() {
  const theme = store.get("theme", "day"), cur = wallKey();
  const sw = Object.entries(WALLS).map(([k, w]) => `<button class="sw" data-wall="${k}" aria-pressed="${cur === k}"><span class="th${k === "custom" && !customImg ? " add" : ""}" data-th="${k}"></span>${w.label}</button>`).join("");
  dialog("Display properties", `<div><p class="lab">Wallpaper</p><div class="swatches">${sw}</div>
      <p class="wallnote" id="wallnote">${customImg ? '<button class="lnkbtn" data-pick>Choose a different picture…</button>' : ""}</p>
      <input type="file" accept="image/*" id="wallfile" hidden></div>
    <div><p class="lab">Theme</p><div class="seg" data-theme-seg><button data-t="day" aria-pressed="${theme === "day"}">Day</button><button data-t="night" aria-pressed="${theme === "night"}">Night</button></div></div>
    <div><p class="lab">Appearance</p><div class="seg" data-cls-seg><button data-c="0" aria-pressed="${!store.get("classic", false)}">Paper and ink</button><button data-c="1" aria-pressed="${store.get("classic", false)}">Classic</button></div></div>`, "",
    [{ label: "OK", primary: true }], 560);
  const el = $("#body-dlg" + (dlgN - 1)), file = $("#wallfile", el), note = $("#wallnote", el);
  const fill = (k) => { const box = $(`[data-th="${k}"]`, el); box.textContent = ""; box.classList.toggle("add", k === "custom" && !customImg); box.append(thumb(k)); };
  // Draw previews one per frame so the dialog opens at once.
  const keys = Object.keys(WALLS), dlgWin = wins["dlg" + (dlgN - 1)];
  keys.forEach((k, i) => setTimeout(() => { fill(k); if (i === keys.length - 1) dlgWin?.fit(); }, 16 * (i + 1)));
  const choose = (k) => { store.set("wall", k); $$(".sw", el).forEach((x) => x.setAttribute("aria-pressed", x.dataset.wall === k)); paintWall(); };
  file.addEventListener("change", async () => {
    const f = file.files?.[0]; if (!f) return;
    const im = await loadCustom(URL.createObjectURL(f)); if (!im) { note.textContent = "That file isn't a picture this browser can open."; return; }
    // Keep it small enough for localStorage: longest side 2400px, JPEG.
    const k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement("canvas");
    cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
    let data = cv.toDataURL("image/jpeg", .85), saved = false;
    for (const qq of [.85, .7, .55]) { data = cv.toDataURL("image/jpeg", qq); try { localStorage.setItem("desk:wallimg", JSON.stringify(data)); saved = true; break; } catch {} }
    customImg = await loadCustom(data); customAccent = pickAccent(customImg); fill("custom"); choose("custom");
    requestAnimationFrame(() => dlgWin?.fit());
    note.innerHTML = saved ? 'Saved in this browser. <button class="lnkbtn" data-pick>Choose a different picture…</button>' : "This picture is too large to remember, so it stays until you reload.";
  });
  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-pick]")) { file.click(); return; }
    const s = e.target.closest(".sw"); if (s) { if (s.dataset.wall === "custom" && !customImg) file.click(); else choose(s.dataset.wall); }
    const t = e.target.closest("[data-t]"); if (t) { store.set("theme", t.dataset.t); $$("[data-t]", el).forEach((x) => x.setAttribute("aria-pressed", x === t)); applyTheme(); }
    const c = e.target.closest("[data-c]"); if (c) { store.set("classic", c.dataset.c === "1"); $$("[data-c]", el).forEach((x) => x.setAttribute("aria-pressed", x === c)); applyTheme(); }
  });
}
function toggleClassic() { store.set("classic", !store.get("classic", false)); applyTheme(); }

/* ---------------------------------------------------------------- notepad menus */
function notepadMenu(body, key) {
  const bar = document.createElement("div"); bar.className = "menubar"; bar.setAttribute("role", "menubar");
  const pre = () => $(".np", body);
  const menus = {
    File: [["New", "", () => newNote()], ["Open about.txt", "", () => open("about")], ["Open now.txt", "", () => open("now")], null,
      ["Save", "⌘S", () => denySave()], ["Save as…", "", () => denySave()], null, ["Exit", "", () => wins[key]?.close()]],
    Edit: [["Select all", "⌘A", () => { const r = document.createRange(); r.selectNodeContents(pre()); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }],
      ["Copy all", "", () => navigator.clipboard?.writeText(pre().textContent)], null, ["Time/Date", "F5", () => insert(pre(), new Date().toLocaleString())]],
    Format: [["Word wrap", "", () => pre().classList.toggle("nowrap")], ["Larger text", "⌘+", () => zoom(pre(), 1)], ["Smaller text", "⌘-", () => zoom(pre(), -1)]],
    Help: [["View help", "", () => dialog("Help", "<p>Double-click an icon to open it. Drag the title bars. Right-click the desktop for its properties.</p><p>Start → Run… takes a few commands. Type help there.</p>")],
      null, ["About Notepad", "", () => dialog("About Notepad", `<p><b>Notepad</b><br>${DATA.first} OS 1.0</p><p>A text editor that cannot save. The text here is ${DATA.first}'s; the edits are yours, until you close the window.</p><p>Windows by WinBox.js. Content shared with the Sidebar template.</p>`)]],
  };
  for (const [name, items] of Object.entries(menus)) {
    const b = document.createElement("button"); b.textContent = name; b.setAttribute("aria-haspopup", "true"); b.setAttribute("aria-expanded", "false");
    b.onclick = (e) => {
      e.stopPropagation(); const wasOpen = b.getAttribute("aria-expanded") === "true"; closeMenus(); if (wasOpen) return;
      b.setAttribute("aria-expanded", "true");
      const dd = document.createElement("div"); dd.className = "dd"; dd.style.left = b.offsetLeft + "px";
      for (const it of items) {
        if (!it) { dd.append(document.createElement("hr")); continue; }
        const x = document.createElement("button"); x.innerHTML = `<span>${it[0]}</span>${it[1] ? `<kbd>${it[1]}</kbd>` : ""}`;
        x.onclick = (ev) => { ev.stopPropagation(); closeMenus(); it[2](); }; dd.append(x);
      }
      bar.append(dd);
    };
    bar.append(b);
  }
  body.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); denySave(); }
    if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) { e.preventDefault(); zoom(pre(), 1); }
    if ((e.metaKey || e.ctrlKey) && e.key === "-") { e.preventDefault(); zoom(pre(), -1); }
    if (e.key === "F5") { e.preventDefault(); insert(pre(), new Date().toLocaleString()); }
  });
  return bar;
}
function zoom(pre, d) { const s = parseFloat(getComputedStyle(pre).fontSize); pre.style.fontSize = Math.max(10, Math.min(24, s + d)) + "px"; }
function insert(pre, text) { pre.focus(); document.execCommand?.("insertText", false, text); }
function denySave() { dialog("Save As", `<p><b>Access is denied.</b></p><p>This is ${DATA.first}'s computer. Your edits stay in this window until you close it, and nowhere else.</p>`, "!"); }
let untitled = 0;
function newNote() {
  const key = "untitled" + ++untitled;
  const el = document.createElement("div"); el.className = "winbody app-notepad"; el.id = "body-" + key; el.dataset.app = "notepad"; el.dataset.title = "Untitled — Notepad";
  el.innerHTML = `<pre class="np" contenteditable="true" spellcheck="false"></pre>`; el.hidden = true; $("#store").append(el);
  const w = open(key); requestAnimationFrame(() => $(".np", el).focus());
  return w;
}

/* ---------------------------------------------------------------- shut down, boot */
function shutdown() {
  Object.values(wins).forEach((w) => w.close(true));
  const off = $("#off"); off.hidden = false;
  off.onclick = () => { sessionStorage.removeItem("desk:booted"); location.reload(); };
}
function boot() {
  let skip = reduced || !DATA.boot; try { skip ||= !!sessionStorage.getItem("desk:booted"); } catch {}
  if (skip) return Promise.resolve();
  const b = $("#boot"); b.hidden = false;
  return new Promise((res) => setTimeout(() => { b.hidden = true; try { sessionStorage.setItem("desk:booted", "1"); } catch {} res(); }, 1700));
}

/* ---------------------------------------------------------------- screensaver: the writing drifts by */
const saver = $("#saver"); let idleT;
function armSaver() { clearTimeout(idleT); if (!saver.hidden) { saver.hidden = true; saver.innerHTML = ""; } if (!reduced) idleT = setTimeout(startSaver, 120000); }
function startSaver() {
  if (document.hidden) return armSaver();
  saver.innerHTML = DATA.titles.slice(0, 8).map((t, i) => `<span style="top:${8 + (i * 11) % 84}%;animation-duration:${22 + (i * 7) % 18}s;animation-delay:-${(i * 5) % 20}s">${t}</span>`).join("");
  saver.hidden = false;
}
["pointermove", "pointerdown", "keydown", "wheel", "touchstart"].forEach((ev) => addEventListener(ev, armSaver, { passive: true }));
armSaver();

/* ---------------------------------------------------------------- the cheat code */
const KONAMI = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"]; let kpos = 0;
addEventListener("keydown", (e) => {
  if (e.target.closest?.("[contenteditable],input,textarea")) return;
  kpos = e.key === KONAMI[kpos] ? kpos + 1 : (e.key === KONAMI[0] ? 1 : 0);
  if (kpos === KONAMI.length) { kpos = 0; toggleClassic(); dialog(root.dataset.classic !== undefined ? "Classic mode" : "Back to normal", root.dataset.classic !== undefined ? "<p>There it is. The one everyone expects.</p><p>Display properties, or the same code, turns it off.</p>" : "<p>Paper and ink again.</p>"); }
});

/* ---------------------------------------------------------------- notifications */
function toast({ title, lines = [], actions = [], ttl = 0 }) {
  const box = document.createElement("div"); box.className = "toast"; box.setAttribute("role", "status");
  box.innerHTML = `<div class="th"><span>${escH(title)}</span><button type="button" aria-label="Dismiss">×</button></div>`
    + (lines.length ? `<ul>${lines.map((l) => `<li>${l}</li>`).join("")}</ul>` : "")
    + (actions.length ? `<div class="acts">${actions.map((a, i) => `<button class="btn${a.primary ? " primary" : ""}" type="button" data-i="${i}">${escH(a.label)}</button>`).join("")}</div>` : "");
  const close = () => { box.classList.add("out"); setTimeout(() => box.remove(), 320); };
  box.addEventListener("click", (e) => {
    if (e.target.closest(".th button")) return close();
    const b = e.target.closest("[data-i]"); if (b) { actions[+b.dataset.i].fn?.(); close(); }
  });
  $("#toasts").append(box);
  if (ttl) setTimeout(close, ttl);
  return box;
}

/* ---------------------------------------------------------------- since you were here
   The last visit is kept in this browser (desk:lastVisit). A session keeps the visit it started from, so
   a reload doesn't clear the news. ?since=2026-08-01 shows the news as of that day, for demos. */
const SINCE = (() => {
  const q = new URLSearchParams(location.search).get("since");
  if (q && !isNaN(Date.parse(q))) return Date.parse(q);
  let s = null; try { s = sessionStorage.getItem("desk:since"); } catch {}
  if (s !== null) return s === "" ? null : Number(s);
  const last = store.get("lastVisit", null);
  try { sessionStorage.setItem("desk:since", last == null ? "" : String(last)); } catch {}
  store.set("lastVisit", Date.now());
  return last;
})();
const NEWS = SINCE == null ? null : {
  pieces: DATA.writing.filter((p) => Date.parse(p.date) > SINCE),
  finished: [], started: [],                 // filled from the shelf, see showNews()
  now: !!$("#body-now") && Date.parse(DATA.updated) > SINCE,
};
async function showNews() {
  if (NEWS) {
    const v = await loadShelf().catch(() => null);
    if (v && !v.sample) {
      NEWS.started = v.reading.filter((b) => b.addedAt && Date.parse(b.addedAt) > SINCE);
      NEWS.finished = v.read.filter((b) => b.readAt && Date.parse(b.readAt) > SINCE);
    }
  }
  // Once per visit: a reload keeps the dots but doesn't repeat the notification (?since= always shows it).
  const demo = new URLSearchParams(location.search).has("since");
  let told = false; try { told = !demo && sessionStorage.getItem("desk:told") === "1"; sessionStorage.setItem("desk:told", "1"); } catch {}
  if (told) { markNew(); return; }
  if (!NEWS) {
    toast({ title: `Welcome to ${DATA.first}'s desktop`, lines: [coarse || small() ? "Tap an icon to open it." : "Double-click an icon to open it. Start, then Run, takes a few commands."], ttl: 14000 });
    return;
  }
  const n = NEWS, lines = [], books = (k) => (k === 1 ? "1 book" : `${k} books`);
  if (n.pieces.length) lines.push(n.pieces.length === 1 ? `A new piece: <b>${escH(n.pieces[0].title)}</b>` : `${n.pieces.length} new pieces, the latest <b>${escH(n.pieces[0].title)}</b>`);
  if (n.finished.length) lines.push(`Finished ${books(n.finished.length)}, the latest <b>${escH(short(n.finished[0].title))}</b>`);
  if (n.started.length) lines.push(`Started ${books(n.started.length)}`);
  if (n.now) lines.push("The Now page is updated");
  if (!lines.length) return;
  markNew();
  const go = n.pieces.length ? ["Read it", () => (n.pieces[0].link ? window.open(n.pieces[0].link, "_blank", "noopener") : openWriting(n.pieces[0].slug))] : (n.finished.length || n.started.length) ? ["See the shelf", () => open("reading")] : ["Open now.txt", () => open("now")];
  toast({ title: `Since your last visit, ${fmtDay(new Date(SINCE).toISOString().slice(0, 10))}`, lines, actions: [{ label: go[0], primary: true, fn: go[1] }] });
}
const short = (t) => t.split(/[:(]/)[0].trim();
function markNew() {
  if (!NEWS) return;
  for (const [k, on] of [["writing", NEWS.pieces.length], ["reading", NEWS.finished.length + NEWS.started.length], ["now", NEWS.now]]) if (on && !wins[k]) $(`.icon[data-open="${k}"]`)?.classList.add("new");
}

/* ---------------------------------------------------------------- the owner's time and weather
   The owner's city (the "Based in" fact) is looked up once with Open-Meteo's free geocoder, which also
   gives its time zone; the weather is fetched at most every 20 minutes. No keys, no cookies. When it is
   raining there, the Monsoon wallpaper rains too. ?weather=rain pretends it is, for demos. */
const ownerBtn = $("#owner"), rainCv = $("#rain");
const WX = (c) => (c === 0 ? ["clear", "sun"] : c <= 2 ? ["partly cloudy", "cloud"] : c === 3 ? ["overcast", "cloud"] : c <= 48 ? ["foggy", "cloud"]
  : c <= 57 ? ["drizzling", "rain"] : c <= 67 ? ["raining", "rain"] : c <= 77 ? ["snowing", "snow"] : c <= 82 ? ["raining", "rain"] : c <= 86 ? ["snowing", "snow"] : ["stormy", "rain"]);
const forceRain = new URLSearchParams(location.search).get("weather") === "rain";
let place = null, wx = null;
async function ownerPlace() {
  const city = (DATA.city || "").split(",")[0].trim(); if (!city) return null;
  const key = "place:" + city, hit = store.get(key, null); if (hit) return hit;
  try {
    const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city)}`)).json();
    const g = j.results?.[0]; if (!g) return null;
    const p = { name: g.name, lat: g.latitude, lon: g.longitude, tz: g.timezone }; store.set(key, p); return p;
  } catch { return null; }
}
async function ownerWeather(p) {
  const hit = store.get("weather", null); if (hit && hit.name === p.name && Date.now() - hit.at < 20 * 60e3) return hit;
  try {
    const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,weather_code,precipitation,is_day`)).json();
    const c = j.current, w = { name: p.name, at: Date.now(), t: Math.round(c.temperature_2m), code: c.weather_code, rain: c.precipitation, day: c.is_day };
    store.set("weather", w); return w;
  } catch { return null; }
}
const raining = () => forceRain || (wx && (WX(wx.code)[1] === "rain" || wx.rain > 0));
const glyph = () => (raining() ? "rain" : !wx ? "" : WX(wx.code)[1] === "sun" && !wx.day ? "moon" : WX(wx.code)[1]);
const sameZone = () => place && zoneDiff() === 0;   // by offset: browsers name some zones differently (Asia/Calcutta, Asia/Kolkata)
const ownerTime = (opts = {}) => new Date().toLocaleString([], { hour: "2-digit", minute: "2-digit", timeZone: place.tz, ...opts });
function zoneDiff() { const d = new Date(), a = new Date(d.toLocaleString("en-US", { timeZone: place.tz })), b = new Date(d.toLocaleString("en-US")); return Math.round((a - b) / 60000); }
function paintOwner() {
  if (!place) return;
  const bits = [place.name]; if (wx) bits.push(`${wx.t}°`); if (!sameZone()) bits.push(ownerTime());
  ownerBtn.innerHTML = `${glyph() ? `<span class="wx ${glyph()}" aria-hidden="true"></span>` : ""}<span>${escH(bits.join(" · "))}</span>`;
  ownerBtn.title = `${DATA.first}'s time and weather`; ownerBtn.hidden = false;
}
ownerBtn.onclick = () => {
  const d = zoneDiff(), h = Math.floor(Math.abs(d) / 60), m = Math.abs(d) % 60, gap = [h && `${h} hour${h > 1 ? "s" : ""}`, m && `${m} minutes`].filter(Boolean).join(" ");
  const sky = raining() ? "raining" : wx ? WX(wx.code)[0] : "";
  dialog(`${DATA.first}'s time`, `<p>It's ${escH(ownerTime({ weekday: "long" }))} in ${escH(place.name)}${d ? `, ${gap} ${d > 0 ? "ahead of" : "behind"} you` : ", the same time as you"}.</p>`
    + (wx || forceRain ? `<p>${escH(sky[0].toUpperCase() + sky.slice(1))}${wx ? `, ${wx.t}°C` : ""}.</p>` : "")
    + `<p class="hint" style="margin:0">Weather from Open-Meteo.</p>`, "i");
};
// Rain over the Monsoon wallpaper while it rains where the owner is.
let rainRAF = 0;
function updateRain() {
  cancelAnimationFrame(rainRAF);
  const on = raining() && wallKey() === "monsoon" && root.dataset.classic === undefined && !reduced && !document.hidden;
  rainCv.hidden = !on; if (!on) return;
  const k = Math.min(devicePixelRatio || 1, 2), W = (rainCv.width = Math.ceil(innerWidth * k)), H = (rainCv.height = Math.ceil((innerHeight - TASK_H) * k));
  const c = rainCv.getContext("2d"), drops = Array.from({ length: Math.round(innerWidth * innerHeight / 2400) }, () =>
    ({ x: Math.random() * W * 1.3, y: Math.random() * H, l: (12 + Math.random() * 34) * k, v: (10 + Math.random() * 10) * k, a: .1 + Math.random() * .25 }));
  c.lineCap = "round"; c.lineWidth = k;
  const frame = () => {
    c.clearRect(0, 0, W, H);
    for (const p of drops) {
      c.strokeStyle = `rgba(222,232,242,${p.a})`; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.l * .26, p.y + p.l); c.stroke();
      p.y += p.v; p.x -= p.v * .26; if (p.y > H) { p.y = -p.l; p.x = Math.random() * W * 1.3; }
    }
    rainRAF = requestAnimationFrame(frame);
  };
  frame();
}
addEventListener("desk:wall", updateRain);
document.addEventListener("visibilitychange", updateRain);
addEventListener("resize", () => { if (!rainCv.hidden) updateRain(); });
async function initOwner() {
  place = await ownerPlace(); if (!place) return;
  paintOwner(); setInterval(paintOwner, 30000);
  wx = await ownerWeather(place); paintOwner(); updateRain();
  if (raining() && wallKey() !== "monsoon" && !sessionStorage.getItem?.("desk:rainTold")) {
    try { sessionStorage.setItem("desk:rainTold", "1"); } catch {}
    toast({ title: `It's raining in ${place.name}`, lines: [`Right now, where ${escH(DATA.first)} is.`], actions: [{ label: "Show me", primary: true, fn: () => { store.set("wall", "monsoon"); paintWall(); } }], ttl: 16000 });
  }
}

/* ---------------------------------------------------------------- go */
// System Properties: books read, from the shelf.
loadShelf().then((v) => { const n = v?.counts?.read ?? v?.read?.length; $$("[data-books]").forEach((el) => el.textContent = n ? n.toLocaleString("en") : "None yet"); }).catch(() => {});

boot().then(() => {
  const want = document.body.dataset.window;
  if (want === "writing") openWriting(document.body.dataset.piece);
  else if (want) open(want, want === "about" && !small() ? { x: 132, y: 40 } : {});
  else dialog("Not found", `<p>There is no file at ${escH(location.pathname)}.</p>`, "!", [{ label: "Open about.txt", primary: true, act() { open("about"); } }]);
  setTimeout(showNews, 700);
  initOwner();
});
