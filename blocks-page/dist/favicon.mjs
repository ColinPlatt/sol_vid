// A tiny neon city block. Swap pre-rendered PNGs in the tab, as on ghoulballs.
// The ICO/PNG links remain usable when scripting or canvas is unavailable.
export function drawIcon(context, frame = 0) {
  const c = context;
  c.save();
  c.scale(c.canvas.width / 32, c.canvas.height / 32);
  c.clearRect(0, 0, 32, 32);
  c.fillStyle = '#070d19'; c.fillRect(0, 0, 32, 32);
  const polygon = (points, colour) => {
    c.fillStyle = colour; c.beginPath();
    points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y));
    c.closePath(); c.fill();
  };
  polygon([[4,10],[16,4],[28,10],[16,16]], '#21414d');
  polygon([[4,10],[16,16],[16,29],[4,23]], '#22203d');
  polygon([[16,16],[28,10],[28,23],[16,29]], '#102e3d');
  c.lineWidth = 1; c.strokeStyle = '#70ffdf'; c.beginPath();
  c.moveTo(4,10); c.lineTo(16,4); c.lineTo(28,10); c.lineTo(28,23); c.lineTo(16,29);
  c.moveTo(16,16); c.lineTo(28,10); c.moveTo(16,16); c.lineTo(16,29); c.stroke();
  c.strokeStyle = '#ff5eae'; c.beginPath(); c.moveTo(4,10); c.lineTo(16,16); c.moveTo(4,10); c.lineTo(4,23); c.lineTo(16,29); c.stroke();
  // A light wave travels through the windows; the geometry stays legible at 16px.
  for (let row=0;row<3;row++) for(let column=0;column<3;column++) {
    const on = (row + column + frame) % 5 < 3;
    c.fillStyle = on ? '#ff78bb' : '#594066';
    c.fillRect(6+column*3,14+row*3+column*1.5,1.5,1.5);
    c.fillStyle = on ? '#8dffe6' : '#2a6273';
    c.fillRect(19+column*3,18+row*3-column*1.5,1.5,1.5);
  }
  c.fillStyle = '#70ffdf'; c.fillRect(15,8,2,4); c.fillRect(13,9,6,2);
  c.fillStyle = '#ff5eae'; c.fillRect(2+(frame*2)%28,30,3,1);
  c.restore();
}

try {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    const frames = Array.from({length: 10}, (_,i) => { drawIcon(context,i); return canvas.toDataURL('image/png'); });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const link = document.createElement('link'); link.id = 'animated-icon'; link.rel = 'icon'; link.type = 'image/png'; link.sizes = '64x64';
    for(const old of document.querySelectorAll('link[rel~="icon"]')) old.remove();
    document.head.append(link);
    let timer, frame = 0;
    const update = () => {
      clearInterval(timer); link.href = frames[0]; frame = 0;
      if (!reduced.matches && !document.hidden) timer = setInterval(() => { frame = (frame+1)%frames.length; link.href = frames[frame]; },125);
    };
    update(); reduced.addEventListener('change',update); document.addEventListener('visibilitychange',update);
    window.addEventListener('pagehide',() => { clearInterval(timer); reduced.removeEventListener('change',update); document.removeEventListener('visibilitychange',update); },{once:true});
  }
} catch { /* Static icon remains available. */ }
