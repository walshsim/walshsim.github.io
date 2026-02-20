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

// Simulation Constants
const LUNAR_MONTH_DAYS = 27.32;
const DIST_EARTH_RAD = 60.27;
const EARTH_RAD = 1.0;
const MOON_RAD = 0.273;
const ORBIT_TILT = 5.14 * (Math.PI / 180); // 5.14 degrees to radians

// State Variables
let paused = false;
let angle = 0;
let trailPoints = [];
let stars = [];

// Initialize Stars
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

// Resize Handler
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initStars();
}

window.addEventListener('resize', resize);

// Stats update loop helpers
function updateUI(angle) {
    // Normalize angle to 0 - 2PI range for display if needed, but linear accumulation is fine for days
    const totalRotations = angle / (Math.PI * 2);
    const daysElapsed = totalRotations * LUNAR_MONTH_DAYS;
    
    // Format days
    statDays.textContent = daysElapsed.toFixed(2).padStart(6, '0') + '_DAYS';

    // Update Speed Display
    const speed = parseFloat(speedInput.value);
    speedVal.textContent = (speed / 0.01).toFixed(1) + 'x';
    
    const zoom = parseFloat(zoomInput.value);
    zoomVal.textContent = zoom.toFixed(1) + 'x';
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
    trailPoints = [];
    // Reset indicators if needed
};

function draw() {
    const w = canvas.width, h = canvas.height;

    // Clear background
    ctx.fillStyle = '#020408';
    ctx.fillRect(0, 0, w, h);

    // Draw stars
    stars.forEach(s => {
        ctx.fillStyle = `rgba(0, 242, 255, ${s.opacity * 0.4})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    });

    const zoom = parseFloat(zoomInput.value);
    const speed = parseFloat(speedInput.value);
    
    if (!paused) {
        angle = (angle + speed) % (Math.PI * 20000); // Keep angle from growing indefinitely large, but allow cycles
    }

    // Pass the raw angle for cumulative calculation
    updateUI(angle);
    
    // Use modulo for orbital position
    const orbitAngle = angle % (Math.PI * 2);

    // Layout centers
    const leftX = w * 0.4;
    const topY = h * 0.35;
    const sideY = h * 0.75;
    const phaseX = w * 0.78;
    const phaseY = h * 0.5;

    // Pixels per Earth Radius
    const pxPerER = 6 * zoom;
    
    const moonX = Math.cos(orbitAngle) * DIST_EARTH_RAD * pxPerER;
    const moonY = Math.sin(orbitAngle) * DIST_EARTH_RAD * pxPerER;
    // Z coordinate (height relative to ecliptic) due to tilt
    // For side view: vertical displacement is Z
    const moonZ = Math.sin(orbitAngle) * Math.sin(ORBIT_TILT) * DIST_EARTH_RAD * pxPerER;

    // Draw views
    drawOrbitView(leftX, topY, moonX, moonY, pxPerER, 'COORD_SYSTEM::ECLIPTIC_TOP', true);
    drawOrbitView(leftX, sideY, moonX, moonZ, pxPerER, 'COORD_SYSTEM::ORBITAL_TILT', false);
    drawPhaseView(phaseX, phaseY, orbitAngle);

    requestAnimationFrame(draw);
}

function drawOrbitView(cx, cy, mx, my, pxPerER, label, isTopDown) {
    ctx.save();
    ctx.translate(cx, cy);

    // Label
    ctx.fillStyle = 'rgba(0, 242, 255, 0.4)';
    ctx.font = '700 10px Syncopate';
    ctx.textAlign = 'left';
    ctx.fillText(label, -DIST_EARTH_RAD * pxPerER, -DIST_EARTH_RAD * pxPerER - 20);

    // Crosshair/Grid reference
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.05)';
    ctx.beginPath();
    ctx.moveTo(-canvas.width, 0); ctx.lineTo(canvas.width, 0);
    ctx.moveTo(0, -canvas.height); ctx.lineTo(0, canvas.height);
    ctx.stroke();

    // Orbit path
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.15)';
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    // For top-down view, the orbit is a circle
    // For side view (tilt), the orbit looks like a line or very thin ellipse if we account for perspective, 
    // but here we are projecting 2D coordinates directly (mx, mz).
    // Let's keep it simple: circle for top, line for side if we want strict projection, 
    // but the original code drew an arc for both which implies a specific visualization style.
    // Given the original code: ctx.arc(0, 0, DIST_EARTH_RAD * pxPerER, 0, Math.PI * 2);
    // This draws a circle guide in both views. We'll keep that as a reference ring.
    ctx.arc(0, 0, DIST_EARTH_RAD * pxPerER, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Earth
    // Outer Glow
    const earthGlow = ctx.createRadialGradient(0, 0, EARTH_RAD * pxPerER, 0, 0, EARTH_RAD * pxPerER * 2);
    earthGlow.addColorStop(0, 'rgba(0, 242, 255, 0.2)');
    earthGlow.addColorStop(1, 'rgba(0, 242, 255, 0)');
    ctx.fillStyle = earthGlow;
    ctx.beginPath();
    ctx.arc(0, 0, EARTH_RAD * pxPerER * 2, 0, Math.PI * 2);
    ctx.fill();

    // Earth Body
    ctx.fillStyle = '#0a1a2f';
    ctx.beginPath();
    ctx.arc(0, 0, EARTH_RAD * pxPerER, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'var(--accent-cyan)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Earth Day/Night line
    // Assuming sun is to the RIGHT (angle 0)
    ctx.fillStyle = 'rgba(0, 242, 255, 0.1)';
    ctx.beginPath();
    // Shadow side is the left half
    ctx.arc(0, 0, EARTH_RAD * pxPerER, Math.PI/2, 3*Math.PI/2, false);
    ctx.fill();

    // Moon
    // Trail (Simplified)
    if (trailsChk.checked) {
        // Simple trail logic could be added here if we were storing points per view
        // For now, let's leave it as a placeholder as in the original code
    }

    // Moon Body
    ctx.fillStyle = '#020408';
    ctx.strokeStyle = 'var(--accent-cyan)';
    ctx.beginPath();
    ctx.arc(mx, my, MOON_RAD * pxPerER, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Moon pointer line
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(mx, my);
    ctx.stroke();

    ctx.restore();
}

function drawPhaseView(cx, cy, angle) {
    const r = 100;
    
    // UI Rings
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.1)';
    ctx.beginPath(); ctx.arc(cx, cy, r + 10, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r + 20, 0, Math.PI * 2); ctx.stroke();

    // Dark Moon Body (Base)
    ctx.fillStyle = '#050a10';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // We need to calculate phase based on angle.
    // Angle 0 = Full Moon (Opposite to Sun? No, usually Angle 0 is towards Sun in math, but let's check standard).
    // Standard: Sun is at infinity to the right (0 radians).
    // Earth at center.
    // Moon at 0 radians = Between Earth and Sun = New Moon.
    // Moon at PI radians = Earth between Moon and Sun = Full Moon.
    
    const phaseAngle = angle % (Math.PI * 2);
    
    // Illumination calc:
    // New Moon (0): 0% illuminated.
    // Full Moon (PI): 100% illuminated.
    // The visualization code in original file used: const illumination = Math.cos(phaseAngle);
    // cos(0) = 1 (Full?), cos(PI) = -1.
    // If cos > 0, draw one way.
    
    // Let's trust the visual logic from the original file for now, but ensure the labels match.
    // Original: 
    // if deg < 10 (0) -> Full Moon
    // if deg ~ 180 -> New Moon
    // This implies Angle 0 is Full Moon in this code's logic.
    // That means Sun is behind Earth (relative to Moon at 0).
    
    // Let's stick to the original rendering logic to maintain visual consistency
    const illumination = Math.cos(phaseAngle);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Light part
    ctx.fillStyle = '#e2e8f0'; // Moon color
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#e2e8f0';
    
    // Visual logic from original file...
    // It was using 'var(--accent-cyan)' for light. Let's keep that style or make it moon-white?
    // Original used 'var(--accent-cyan)'.
    ctx.fillStyle = 'var(--accent-cyan)';
    ctx.shadowColor = 'var(--accent-cyan)';

    // Drawing the phase
    // This logic approximates the crescent/gibbous shapes
    if (illumination >= 0) {
        // "Fullish" side
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI/2, Math.PI/2, false); // Right half
        ctx.fill();
        ctx.beginPath();
        // Ellipse to cover/add
        ctx.ellipse(cx, cy, r * illumination, r, 0, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // "Newish" side
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI/2, Math.PI/2, false); // Right half
        ctx.fill();
        
        ctx.fillStyle = '#050a10'; // Shadow color
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
        
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * Math.abs(illumination), r, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();

    // Determine Phase Name
    // deg 0 = Full Moon (per logic above)
    // deg 180 = New Moon
    const deg = (phaseAngle * 180 / Math.PI) % 360;
    let name = "";
    
    // Adjusting ranges to be more precise
    if (deg < 10 || deg > 350) name = "FULL_MOON";
    else if (deg < 80) name = "WANING_GIBBOUS";
    else if (deg < 100) name = "LAST_QUARTER";
    else if (deg < 170) name = "WANING_CRESCENT";
    else if (deg < 190) name = "NEW_MOON";
    else if (deg < 260) name = "WAXING_CRESCENT";
    else if (deg < 280) name = "FIRST_QUARTER";
    else name = "WAXING_GIBBOUS";
    
    statPhase.textContent = name;
}

// Initialize
resize();
draw();
