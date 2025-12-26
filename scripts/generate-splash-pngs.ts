/**
 * Generate iOS PWA splash screen PNGs
 * 
 * This script generates PNG splash screens for iOS PWA "Add to Home Screen" feature.
 * Run with: bunx tsx scripts/generate-splash-pngs.ts
 * 
 * Requires: sharp (install with: bun add -D sharp)
 */

import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

// Splash screen dimensions: [width, height, device description]
const SPLASH_SCREENS = [
  // iPhone 15 Pro Max, 14 Pro Max
  [1290, 2796, 'iPhone 15 Pro Max, 14 Pro Max (portrait)'],
  [2796, 1290, 'iPhone 15 Pro Max, 14 Pro Max (landscape)'],
  
  // iPhone 15 Pro, 14 Pro
  [1179, 2556, 'iPhone 15 Pro, 14 Pro (portrait)'],
  [2556, 1179, 'iPhone 15 Pro, 14 Pro (landscape)'],
  
  // iPhone 15, 15 Plus, 14, 14 Plus, 13, 13 Pro, 12, 12 Pro
  [1170, 2532, 'iPhone 15, 14, 13, 12 (portrait)'],
  [2532, 1170, 'iPhone 15, 14, 13, 12 (landscape)'],
  
  // iPhone 14 Plus, 13 Pro Max, 12 Pro Max
  [1284, 2778, 'iPhone 14 Plus, 13 Pro Max (portrait)'],
  [2778, 1284, 'iPhone 14 Plus, 13 Pro Max (landscape)'],
  
  // iPhone 13 mini, 12 mini, 11 Pro, XS, X
  [1125, 2436, 'iPhone 13 mini, 11 Pro, X (portrait)'],
  [2436, 1125, 'iPhone 13 mini, 11 Pro, X (landscape)'],
  
  // iPhone 11, XR
  [828, 1792, 'iPhone 11, XR (portrait)'],
  [1792, 828, 'iPhone 11, XR (landscape)'],
  
  // iPhone 11 Pro Max, XS Max
  [1242, 2688, 'iPhone 11 Pro Max, XS Max (portrait)'],
  [2688, 1242, 'iPhone 11 Pro Max, XS Max (landscape)'],
  
  // iPhone 8 Plus, 7 Plus, 6s Plus
  [1242, 2208, 'iPhone 8 Plus, 7 Plus (portrait)'],
  [2208, 1242, 'iPhone 8 Plus, 7 Plus (landscape)'],
  
  // iPhone 8, 7, 6s, SE
  [750, 1334, 'iPhone 8, 7, SE (portrait)'],
  [1334, 750, 'iPhone 8, 7, SE (landscape)'],
  
  // iPad Pro 12.9"
  [2048, 2732, 'iPad Pro 12.9" (portrait)'],
  [2732, 2048, 'iPad Pro 12.9" (landscape)'],
  
  // iPad Pro 11"
  [1668, 2388, 'iPad Pro 11" (portrait)'],
  [2388, 1668, 'iPad Pro 11" (landscape)'],
] as const;

// Brand colors
const GRADIENT_START = '#6366f1';
const GRADIENT_END = '#8b5cf6';

async function generateSplashScreen(width: number, height: number): Promise<Buffer> {
  const isPortrait = height > width;
  
  // Icon size scales with the smaller dimension
  const minDim = Math.min(width, height);
  const iconSize = Math.round(minDim * 0.15);
  const gridGap = Math.round(iconSize * 0.15);
  const squareSize = Math.round((iconSize - gridGap) / 2);
  const radius = Math.round(squareSize * 0.18);
  
  // Bubble dimensions
  const bubbleWidth = Math.round(iconSize * 0.7);
  const bubbleHeight = Math.round(iconSize * 0.5);
  const dotRadius = Math.round(bubbleHeight * 0.12);
  
  // Center position
  const centerX = width / 2;
  const centerY = height / 2 - (isPortrait ? height * 0.05 : 0);
  
  // Calculate grid start position
  const gridStartX = centerX - iconSize / 2;
  const gridStartY = centerY - iconSize / 2;
  
  // Text position
  const textY = centerY + iconSize / 2 + (isPortrait ? height * 0.08 : width * 0.05);
  const fontSize = Math.round(minDim * 0.045);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${GRADIENT_START};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${GRADIENT_END};stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#grad1)"/>
  
  <!-- Dashboard grid (2x2) -->
  <g fill="white" opacity="0.9">
    <rect x="${gridStartX}" y="${gridStartY}" width="${squareSize}" height="${squareSize}" rx="${radius}"/>
    <rect x="${gridStartX + squareSize + gridGap}" y="${gridStartY}" width="${squareSize}" height="${squareSize}" rx="${radius}"/>
    <rect x="${gridStartX}" y="${gridStartY + squareSize + gridGap}" width="${squareSize}" height="${squareSize}" rx="${radius}"/>
    <rect x="${gridStartX + squareSize + gridGap}" y="${gridStartY + squareSize + gridGap}" width="${squareSize}" height="${squareSize}" rx="${radius}"/>
  </g>
  
  <!-- Message bubble -->
  <g transform="translate(${gridStartX + iconSize * 0.6}, ${gridStartY + iconSize * 0.6})">
    <path d="M 0,0 
             Q 0,${-bubbleHeight * 0.3} ${bubbleHeight * 0.3},${-bubbleHeight * 0.3} 
             L ${bubbleWidth - bubbleHeight * 0.3},${-bubbleHeight * 0.3} 
             Q ${bubbleWidth},${-bubbleHeight * 0.3} ${bubbleWidth},0 
             L ${bubbleWidth},${bubbleHeight * 0.6} 
             Q ${bubbleWidth},${bubbleHeight * 0.9} ${bubbleWidth - bubbleHeight * 0.3},${bubbleHeight * 0.9} 
             L ${bubbleWidth * 0.4},${bubbleHeight * 0.9} 
             L ${bubbleHeight * 0.3},${bubbleHeight * 1.2} 
             L ${bubbleHeight * 0.3},${bubbleHeight * 0.9} 
             Q 0,${bubbleHeight * 0.9} 0,${bubbleHeight * 0.6} 
             Z" 
          fill="white" 
          opacity="0.9"/>
    
    <!-- Three dots -->
    <circle cx="${bubbleWidth * 0.3}" cy="${bubbleHeight * 0.3}" r="${dotRadius}" fill="${GRADIENT_START}"/>
    <circle cx="${bubbleWidth * 0.5}" cy="${bubbleHeight * 0.3}" r="${dotRadius}" fill="${GRADIENT_START}"/>
    <circle cx="${bubbleWidth * 0.7}" cy="${bubbleHeight * 0.3}" r="${dotRadius}" fill="${GRADIENT_START}"/>
  </g>
  
  <!-- App name -->
  <text x="${centerX}" y="${textY}" 
        font-family="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" 
        font-size="${fontSize}" 
        font-weight="600"
        fill="white" 
        text-anchor="middle" 
        opacity="0.95">Dashboard</text>
</svg>`;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

async function main() {
  console.log('Generating iOS PWA splash screens...\n');
  
  for (const [width, height, description] of SPLASH_SCREENS) {
    const filename = `apple-splash-${width}-${height}.png`;
    const filepath = join(PUBLIC_DIR, filename);
    
    console.log(`Generating ${filename} (${description})...`);
    
    const buffer = await generateSplashScreen(width, height);
    writeFileSync(filepath, buffer);
  }
  
  console.log('\n✅ All splash screens generated!');
  console.log(`\nGenerated ${SPLASH_SCREENS.length} splash screens in public/`);
}

main().catch(console.error);
