const a = 0.7;

function genData() {
  const n = 20;
  const data = new Float32Array(n + 1);
  data[0] = 1;
  let y1 = 1;
  let y0 = 1;
  let y = 0;
  for (let i = 1; i < n + 1; i++) {
    y0 = y0 * a + y * (1 - a);
    y1 = y1 * a + y0 * (1 - a);
    data[i] = y1;
  }
  return data;
}

function plot() {
  const canvas = document.getElementById('plot');
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  const data = genData();
  ctx.beginPath();
  ctx.moveTo(0, height * (1 - data[0]));
  for (let x = 1; x < data.length; x++) {
    console.log((x * width) / (data.length - 1), height * (1 - data[x]));
    ctx.lineTo((x * width) / (data.length - 1), height * (1 - data[x]));
  }
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.stroke();
}

plot();
