const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// DOM Elements
const speedInput = document.getElementById('speed');
const zoomInput = document.getElementById('zoom');
const pauseBtn = document.getElementById('pause');
const resetBtn = document.getElementById('reset');
const trailsChk = document.getElementById('trails');

const statDays = document.getElementById('stat-days');
const statStatus = document.getElementById('stat-status');
const statPhase = document.getElementById('stat-phase');
const speedVal = document.getElementById('speed-val');
const zoomVal = document.getElementById('zoom-val');

// Simulation Constants (Earth radii units)
const LUNAR_MONTH_DAYS = 27.32;
const DIST_EARTH_RAD = 60.27;
const EARTH_RAD = 1.0;
const MOON_RAD = 0.273;
const ORBIT_TILT = 5.14 * (Math.PI / 180);

// State Variables
let paused = false;
let angle = 0;
let stars = [];
let topTrail = [];
let sideTrail = [];

function initStars() {
  stars = [];
  const numStars = 200;
  for (let i = 0; i < numStars; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 1.5,
      opacity: Math.random()
    });
  }
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  initStars();
}

window.addEventListener('resize', resize);

function updateUI(currentAngle) {
  const totalRotations = currentAngle / (Math.PI * 2);
  const daysElapsed = totalRotations * LUNAR_MONTH_DAYS;

  statDays.textContent = `${daysElapsed.toFixed(2).padStart(6, '0')}_DAYS`;
  speedVal.textContent = `${(parseFloat(speedInput.value) / 0.01).toFixed(1)}x`;
  zoomVal.textContent = `${parseFloat(zoomInput.value).toFixed(1)}x`;
}

pauseBtn.onclick = () => {
  paused = !paused;
  pauseBtn.textContent = paused ? 'EXEC::RESUME' : 'EXEC::PAUSE';

  const statusBadge = document.querySelector('.terminal-badge.status-active');
  if (paused) {
    statStatus.textContent = 'PAUSED';
    if (statusBadge) statusBadge.style.borderColor = 'var(--accent-red)';
    statStatus.style.color = 'var(--accent-red)';
  } else {
    statStatus.textContent = 'NOMINAL';
    if (statusBadge) statusBadge.style.borderColor = '#00ff88';
    statStatus.style.color = '#00ff88';
  }
};

resetBtn.onclick = () => {
  angle = 0;
  topTrail = [];
  sideTrail = [];
};

function drawBackground(w, h) {
  ctx.fillStyle = '#020408';
  ctx.fillRect(0, 0, w, h);

  for (const s of stars) {
    ctx.fillStyle = `rgba(0, 242, 255, ${s.opacity * 0.35})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawViewport(cx, cy, width, height, label) {
  ctx.save();
  ctx.translate(cx - width / 2, cy - height / 2);

  ctx.fillStyle = 'rgba(0, 8, 14, 0.42)';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(0, 242, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(0, 242, 255, 0.5)';
  ctx.font = '700 10px Syncopate';
  ctx.textAlign = 'left';
  ctx.fillText(label, 10, 18);

  ctx.restore();
}

function drawShadowCone(occluderX, occluderY, radiusPx, directionX = -1) {
  const shadowLen = radiusPx * 45;
  const spread = radiusPx * 1.6;

  const grad = ctx.createLinearGradient(occluderX, occluderY, occluderX + directionX * shadowLen, occluderY);
  grad.addColorStop(0, 'rgba(12, 18, 38, 0.65)');
  grad.addColorStop(1, 'rgba(12, 18, 38, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(occluderX, occluderY - radiusPx * 0.9);
  ctx.lineTo(occluderX + directionX * shadowLen, occluderY - spread);
  ctx.lineTo(occluderX + directionX * shadowLen, occluderY + spread);
  ctx.lineTo(occluderX, occluderY + radiusPx * 0.9);
  ctx.closePath();
  ctx.fill();
}

function drawBody(x, y, radius, litRight) {
  ctx.fillStyle = '#0a1a2f';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(0, 242, 255, 0.12)';
  ctx.beginPath();
  if (litRight) {
    ctx.arc(x, y, radius, -Math.PI / 2, Math.PI / 2);
  } else {
    ctx.arc(x, y, radius, Math.PI / 2, -Math.PI / 2);
  }
  ctx.fill();

  ctx.strokeStyle = '#00f2ff';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawTrail(points) {
  if (points.length < 2) return;
  ctx.strokeStyle = 'rgba(0, 242, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}

function drawScaleBar(viewLeft, viewBottom, pxPerER) {
  const barER = 10;
  const barPx = barER * pxPerER;
  const x = viewLeft + 14;
  const y = viewBottom - 14;

  ctx.strokeStyle = 'rgba(0, 242, 255, 0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + barPx, y);
  ctx.stroke();

  ctx.fillStyle = 'rgba(0, 242, 255, 0.7)';
  ctx.font = '11px JetBrains Mono';
  ctx.textAlign = 'left';
  ctx.fillText('10 R⊕', x, y - 6);
}

function drawOrbitView(config) {
  const { cx, cy, width, height, moonX, moonY, pxPerER, label, trail, sideView } = config;

  drawViewport(cx, cy, width, height, label);

  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - width / 2, cy - height / 2, width, height);
  ctx.clip();

  const earthX = cx;
  const earthY = cy;
  const earthR = EARTH_RAD * pxPerER;
  const moonR = MOON_RAD * pxPerER;

  ctx.strokeStyle = 'rgba(0, 242, 255, 0.12)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  if (sideView) {
    ctx.ellipse(earthX, earthY, DIST_EARTH_RAD * pxPerER, DIST_EARTH_RAD * Math.sin(ORBIT_TILT) * pxPerER, 0, 0, Math.PI * 2);
  } else {
    ctx.arc(earthX, earthY, DIST_EARTH_RAD * pxPerER, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  drawShadowCone(earthX, earthY, earthR, -1);
  drawShadowCone(earthX + moonX, earthY + moonY, moonR, -1);

  if (trailsChk.checked) drawTrail(trail);

  drawBody(earthX, earthY, earthR, true);

  ctx.fillStyle = '#111925';
  ctx.beginPath();
  ctx.arc(earthX + moonX, earthY + moonY, moonR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#00f2ff';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(earthX, earthY);
  ctx.lineTo(earthX + moonX, earthY + moonY);
  ctx.strokeStyle = 'rgba(0, 242, 255, 0.22)';
  ctx.stroke();

  ctx.restore();

  drawScaleBar(cx - width / 2, cy + height / 2, pxPerER);
}

function drawPhaseView(cx, cy, orbitAngle) {
  const r = 96;
  const phaseAngle = ((orbitAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const litFraction = (1 - Math.cos(phaseAngle)) / 2;
  const litOnRight = phaseAngle < Math.PI;
  const terminatorX = Math.abs(Math.cos(phaseAngle)) * r;
  const isGibbous = litFraction > 0.5;

  ctx.strokeStyle = 'rgba(0, 242, 255, 0.15)';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 12, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#050a10';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  if (litOnRight) ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
  else ctx.arc(cx, cy, r, Math.PI / 2, -Math.PI / 2);
  ctx.fill();

  ctx.fillStyle = isGibbous ? '#e2e8f0' : '#050a10';
  ctx.beginPath();
  ctx.ellipse(cx, cy, terminatorX, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const deg = (phaseAngle * 180) / Math.PI;
  if (deg < 12 || deg >= 348) statPhase.textContent = 'NEW_MOON';
  else if (deg < 78) statPhase.textContent = 'WAXING_CRESCENT';
  else if (deg < 102) statPhase.textContent = 'FIRST_QUARTER';
  else if (deg < 168) statPhase.textContent = 'WAXING_GIBBOUS';
  else if (deg < 192) statPhase.textContent = 'FULL_MOON';
  else if (deg < 258) statPhase.textContent = 'WANING_GIBBOUS';
  else if (deg < 282) statPhase.textContent = 'LAST_QUARTER';
  else statPhase.textContent = 'WANING_CRESCENT';
}

function drawSunArrow(x, y) {
  ctx.strokeStyle = 'rgba(255, 200, 120, 0.65)';
  ctx.fillStyle = 'rgba(255, 200, 120, 0.85)';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 90, y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - 90, y);
  ctx.lineTo(x - 78, y - 8);
  ctx.lineTo(x - 78, y + 8);
  ctx.closePath();
  ctx.fill();

  ctx.font = '10px Syncopate';
  ctx.fillText('SUNLIGHT', x - 175, y - 10);
}

function draw() {
  const w = canvas.width;
  const h = canvas.height;

  drawBackground(w, h);

  const zoom = parseFloat(zoomInput.value);
  const speed = parseFloat(speedInput.value);
  if (!paused) angle = (angle + speed) % (Math.PI * 20000);
  updateUI(angle);

  const orbitAngle = angle % (Math.PI * 2);

  const pxPerER = 2.8 * zoom;

  const layoutLeft = w * 0.42;
  const topY = h * 0.31;
  const sideY = h * 0.71;
  const viewW = Math.min(w * 0.62, DIST_EARTH_RAD * pxPerER * 2.3);
  const viewH = Math.max(180, h * 0.26);

  const moonX = Math.cos(orbitAngle) * DIST_EARTH_RAD * pxPerER;
  const moonYTop = Math.sin(orbitAngle) * DIST_EARTH_RAD * pxPerER;
  const moonYSide = Math.sin(orbitAngle) * Math.sin(ORBIT_TILT) * DIST_EARTH_RAD * pxPerER;

  topTrail.push({ x: layoutLeft + moonX, y: topY + moonYTop });
  sideTrail.push({ x: layoutLeft + moonX, y: sideY + moonYSide });
  if (topTrail.length > 260) topTrail.shift();
  if (sideTrail.length > 260) sideTrail.shift();

  drawOrbitView({
    cx: layoutLeft,
    cy: topY,
    width: viewW,
    height: viewH,
    moonX,
    moonY: moonYTop,
    pxPerER,
    label: 'TOP VIEW (ECLIPTIC)',
    trail: topTrail,
    sideView: false
  });

  drawOrbitView({
    cx: layoutLeft,
    cy: sideY,
    width: viewW,
    height: viewH,
    moonX,
    moonY: moonYSide,
    pxPerER,
    label: 'SIDE VIEW (5.14° INCLINATION)',
    trail: sideTrail,
    sideView: true
  });

  drawSunArrow(layoutLeft + viewW / 2 - 18, topY - viewH / 2 + 24);
  drawPhaseView(w * 0.79, h * 0.5, orbitAngle);

  requestAnimationFrame(draw);
}

resize();
draw();
