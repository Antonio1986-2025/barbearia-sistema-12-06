import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

try {
  const sharpPath = new URL('../node_modules/sharp', import.meta.url);
  const sharp = await import(sharpPath);
  const svg = readFileSync('public/icon.svg');

  await sharp.default(svg).resize(192, 192).png().toFile('public/icon-192.png');
  await sharp.default(svg).resize(512, 512).png().toFile('public/icon-512.png');
  console.log('✅ Ícones PWA gerados: icon-192.png, icon-512.png');
} catch {
  console.log('⚠️  sharp não disponível. Instale com: npm install sharp');
  console.log('Depois rode: node scripts/generate-pwa-icons.mjs');
}
