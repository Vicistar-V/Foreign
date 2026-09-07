import logo from '@/assets/logo.png';

/**
 * Generates a portrait flyer image (1080x1350, 4:5 — perfect for WhatsApp
 * Status and Instagram) celebrating a withdrawal that just landed.
 *
 * Pure Canvas2D — no external libraries, no AI. Loads instantly.
 */
export const generateWithdrawalFlyer = async (amount: number): Promise<Blob> => {
  const W = 1080;
  const H = 1350;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background — premium dark gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0A0F1E');
  bg.addColorStop(0.55, '#0F1A2E');
  bg.addColorStop(1, '#06210F');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft green glow lower-right
  const glow = ctx.createRadialGradient(W * 0.75, H * 0.78, 60, W * 0.75, H * 0.78, 700);
  glow.addColorStop(0, 'rgba(34,197,94,0.35)');
  glow.addColorStop(1, 'rgba(34,197,94,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid dots
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y = 0; y < H; y += 40) {
    for (let x = 0; x < W; x += 40) {
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // Load logo
  const logoImg = await loadImage(logo);
  const logoSize = 110;
  ctx.drawImage(logoImg, 80, 80, logoSize, logoSize);

  // Brand wordmark
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 56px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('Viketa', 210, 80 + logoSize / 2 - 8);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '500 26px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Ad shares that pay', 210, 80 + logoSize / 2 + 30);

  // "JUST LANDED" pill
  const pillText = 'JUST LANDED';
  ctx.font = '800 32px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const pillTextWidth = ctx.measureText(pillText).width;
  const pillW = pillTextWidth + 60;
  const pillH = 62;
  const pillX = (W - pillW) / 2;
  const pillY = 430;
  ctx.fillStyle = 'rgba(34,197,94,0.18)';
  roundRect(ctx, pillX, pillY, pillW, pillH, 999);
  ctx.fill();
  ctx.strokeStyle = 'rgba(34,197,94,0.55)';
  ctx.lineWidth = 2;
  roundRect(ctx, pillX, pillY, pillW, pillH, 999);
  ctx.stroke();
  ctx.fillStyle = '#4ADE80';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pillText, W / 2, pillY + pillH / 2 + 2);

  // Headline
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '500 38px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('My Viketa withdrawal of', W / 2, 560);

  // Amount — huge
  const amountText = `₦${amount.toLocaleString()}`;
  ctx.fillStyle = '#FFFFFF';
  // Auto-fit font size
  let amountSize = 220;
  ctx.font = `900 ${amountSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  while (ctx.measureText(amountText).width > W - 160 && amountSize > 100) {
    amountSize -= 10;
    ctx.font = `900 ${amountSize}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  }
  // Gold-green gradient on amount
  const amtGrad = ctx.createLinearGradient(0, 600, 0, 800);
  amtGrad.addColorStop(0, '#FFFFFF');
  amtGrad.addColorStop(1, '#4ADE80');
  ctx.fillStyle = amtGrad;
  ctx.fillText(amountText, W / 2, 720);

  // Tagline
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '500 38px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('just landed in my bank account', W / 2, 870);

  // Receipt-style line
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.setLineDash([8, 12]);
  ctx.beginPath();
  ctx.moveTo(120, 970);
  ctx.lineTo(W - 120, 970);
  ctx.stroke();
  ctx.setLineDash([]);

  // CTA card
  const cardY = 1020;
  const cardH = 180;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, 80, cardY, W - 160, cardH, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  roundRect(ctx, 80, cardY, W - 160, cardH, 28);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 40px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Activate your own ad share today', W / 2, cardY + 65);
  ctx.fillStyle = '#4ADE80';
  ctx.font = '600 32px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('viketa.xyz', W / 2, cardY + 125);

  // Date footer
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '500 24px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const dateStr = new Date().toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  ctx.fillText(dateStr, W / 2, H - 50);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Flyer render failed'))),
      'image/jpeg',
      0.92,
    );
  });
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

/** Caption that accompanies the flyer when sharing. */
export const buildWithdrawalCaption = (amount: number): string => {
  return `My ₦${amount.toLocaleString()} Viketa withdrawal just landed in my account 🟢\n\nViketa is paying. Activate your own ad share today 👉 https://viketa.xyz`;
};
