// Shared player: decode the embedded file B once, then loop its frames on a pixelated canvas at the file's own rate.
const video = decode(Uint8Array.from(atob(B), c => c.charCodeAt(0)));
const canvas = document.querySelector("canvas"), context = canvas.getContext("2d");
canvas.width = video.width; canvas.height = video.height;
const images = video.frames.map(f => new ImageData(f, video.width, video.height));
const start = performance.now();
(function draw(now) {
  context.putImageData(images[Math.floor((now - start) * video.fps / 1000) % images.length], 0, 0);
  requestAnimationFrame(draw);
})(start);
