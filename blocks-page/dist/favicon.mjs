// A subway train racing through a neon tunnel: pillars, ceiling lights and sleepers stream past.
// Swap pre-rendered PNGs in the tab, as on ghoulballs. The ICO/PNG links remain usable without scripting.
export const FRAMES = 12; // the streaming layers repeat every 3, 4 and 2 frames
export function drawIcon(context, frame = 0) {
  const c = context, f = frame % FRAMES;
  c.save();
  c.scale(c.canvas.width / 32, c.canvas.height / 32);
  c.clearRect(0, 0, 32, 32);
  c.fillStyle = '#070d19'; c.fillRect(0, 0, 32, 32);
  c.fillStyle = '#10162a'; c.fillRect(0, 0, 32, 8);
  // Tunnel pillars and ceiling lights rush past behind the train.
  c.fillStyle = '#26345a';
  for (let x = -(f * 4) % 12; x < 32; x += 12) c.fillRect(x, 2, 3, 27);
  c.fillStyle = '#8dffe6';
  for (let x = -(f * 3) % 12; x < 32; x += 12) c.fillRect(x, 3, 6, 1);
  // The train holds the centre with a slight sway.
  const y = f % 2 ? 0.5 : 0;
  c.fillStyle = '#dfe6ee'; c.beginPath();
  c.moveTo(2, 10 + y); c.lineTo(24, 10 + y); c.lineTo(30, 16 + y); c.lineTo(30, 24 + y); c.lineTo(2, 24 + y); c.closePath(); c.fill();
  c.fillStyle = '#18213a'; c.beginPath();
  c.moveTo(3, 13 + y); c.lineTo(24, 13 + y); c.lineTo(28, 17 + y); c.lineTo(3, 17 + y); c.closePath(); c.fill();
  c.fillStyle = '#8dffe6';
  for (const x of [4, 9, 14, 19]) c.fillRect(x, 14 + y, 3, 2);
  c.fillStyle = '#ff5eae'; c.fillRect(2, 20 + y, 28, 1.5);
  c.fillStyle = '#ffd25e'; c.fillRect(28, 21 + y, 2, 1.5);
  c.fillStyle = '#0b1020'; c.fillRect(4, 24 + y, 24, 1.5);
  // Rail and sleepers.
  c.fillStyle = '#70ffdf'; c.fillRect(0, 27, 32, 1);
  c.fillStyle = '#3a4a6a';
  for (let x = -(f * 2) % 4; x < 32; x += 4) c.fillRect(x, 28.5, 2, 1.5);
  c.restore();
}

try {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    const frames = Array.from({length: FRAMES}, (_,i) => { drawIcon(context,i); return canvas.toDataURL('image/png'); });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const link = document.createElement('link'); link.id = 'animated-icon'; link.rel = 'icon'; link.type = 'image/png'; link.sizes = '64x64';
    for(const old of document.querySelectorAll('link[rel~="icon"]')) old.remove();
    document.head.append(link);
    let timer, frame = 0;
    const update = () => {
      clearInterval(timer); link.href = frames[0]; frame = 0;
      if (!reduced.matches && !document.hidden) timer = setInterval(() => { if(reduced.matches || document.hidden){update();return;} frame = (frame+1)%frames.length; link.href = frames[frame]; },90);
    };
    update(); reduced.addEventListener('change',update); document.addEventListener('visibilitychange',update);
    window.addEventListener('pagehide',() => { clearInterval(timer); reduced.removeEventListener('change',update); document.removeEventListener('visibilitychange',update); },{once:true});
  }
} catch { /* Static icon remains available. */ }
