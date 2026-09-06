// Same cubic paths as mobile-demo/index.html. Upper/lower gap endpoints share X.
const FRAME = { width: 280, height: 222, leftGap: 132, rightGap: 148, top: 27, bottom: 195 };
function path(ctx, right) {
  const x = value => right ? FRAME.width - value : value;
  ctx.beginPath();
  ctx.moveTo(x(FRAME.leftGap), FRAME.top);
  ctx.lineTo(x(72), FRAME.top);
  ctx.bezierCurveTo(x(49), 27, x(34), 43, x(34), 65);
  ctx.lineTo(x(34), 157);
  ctx.bezierCurveTo(x(34), 179, x(49), 195, x(72), FRAME.bottom);
  ctx.lineTo(x(FRAME.leftGap), FRAME.bottom);
}
function curveLength(points) {
  let length = 0, previous = points[0];
  for (let i = 1; i <= 100; i += 1) {
    const t = i / 100, u = 1 - t;
    const current = [0, 1].map(axis => u*u*u*points[0][axis] + 3*u*u*t*points[1][axis] + 3*u*t*t*points[2][axis] + t*t*t*points[3][axis]);
    length += Math.hypot(current[0] - previous[0], current[1] - previous[1]);
    previous = current;
  }
  return length;
}
const PATH_LENGTH = 60 + curveLength([[72,27],[49,27],[34,43],[34,65]]) + 92
  + curveLength([[34,157],[34,179],[49,195],[72,195]]) + 60;
function ease(value) {
  // CSS cubic-bezier(.45, 0, .2, 1): solve X, then evaluate Y.
  let low = 0, high = 1;
  for (let i = 0; i < 20; i += 1) {
    const t = (low + high) / 2, u = 1 - t;
    const x = 3*u*u*t*.45 + 3*u*t*t*.2 + t*t*t;
    if (x < value) low = t; else high = t;
  }
  const t = (low + high) / 2;
  return 3*(1-t)*t*t + t*t*t;
}
function drawFrame(ctx, progress) {
  ctx.clearRect(0, 0, FRAME.width, FRAME.height);
  if (progress <= 0) return;
  ctx.strokeStyle = "#347cf8";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash(progress >= 1 ? [] : [PATH_LENGTH, PATH_LENGTH]);
  ctx.lineDashOffset = PATH_LENGTH * (1 - Math.min(1, progress));
  path(ctx, false); ctx.stroke();
  path(ctx, true); ctx.stroke();
}
function animateFrame(canvas, width, height, pixelRatio, startedAt) {
  const ctx = canvas.getContext("2d");
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  ctx.scale(canvas.width / FRAME.width, canvas.height / FRAME.height);
  let requestId, stopped = false;
  function tick() {
    if (stopped) return;
    const time = Math.max(0, Math.min(1, (Date.now() - startedAt - 580) / 840));
    drawFrame(ctx, time === 1 ? 1 : ease(time));
    if (time < 1) requestId = canvas.requestAnimationFrame(tick);
  }
  tick();
  return () => { stopped = true; if (requestId !== undefined) canvas.cancelAnimationFrame(requestId); };
}
module.exports = { FRAME, PATH_LENGTH, drawFrame, animateFrame };
