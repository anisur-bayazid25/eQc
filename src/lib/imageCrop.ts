export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function cropRegionToPng(
  dataUrl: string,
  region: { x: number; y: number; width: number; height: number }
): Promise<{ base64: string; width: number; height: number }> {
  const img = await loadImage(dataUrl);
  const sx = region.x * img.naturalWidth;
  const sy = region.y * img.naturalHeight;
  const sw = region.width * img.naturalWidth;
  const sh = region.height * img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const out = canvas.toDataURL('image/png');
  return { base64: out.split(',')[1], width: canvas.width, height: canvas.height };
}

export async function renderCodedImagePng(
  dataUrl: string,
  regions: Array<{ x: number; y: number; width: number; height: number; color: string; label: string }>
): Promise<string> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  for (const r of regions) {
    const x = r.x * canvas.width;
    const y = r.y * canvas.height;
    const w = r.width * canvas.width;
    const h = r.height * canvas.height;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = Math.max(2, canvas.width * 0.003);
    ctx.strokeRect(x, y, w, h);

    ctx.font = `${Math.max(14, Math.round(canvas.width * 0.015))}px sans-serif`;
    const metrics = ctx.measureText(r.label);
    const padding = 4;
    const labelY = Math.max(0, y - 20);
    ctx.fillStyle = r.color;
    ctx.fillRect(x, labelY, metrics.width + padding * 2, 20);
    ctx.fillStyle = '#000';
    ctx.fillText(r.label, x + padding, labelY + 14);
  }
  return canvas.toDataURL('image/png');
}