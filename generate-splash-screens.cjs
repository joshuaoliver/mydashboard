const fs = require('fs');
const path = require('path');

// Splash screen sizes for various iOS devices
const splashSizes = [
  // iPhone 15 Pro Max, 14 Pro Max, 13 Pro Max, 12 Pro Max
  { width: 1290, height: 2796, name: 'apple-splash-2796-1290.png' },
  { width: 2796, height: 1290, name: 'apple-splash-1290-2796.png' },
  
  // iPhone 15 Plus, 14 Plus, 13 Pro Max, 12 Pro Max (landscape)
  { width: 1284, height: 2778, name: 'apple-splash-2778-1284.png' },
  { width: 2778, height: 1284, name: 'apple-splash-1284-2778.png' },
  
  // iPhone 15 Pro, 14 Pro, 13 Pro, 12 Pro
  { width: 1179, height: 2556, name: 'apple-splash-2556-1179.png' },
  { width: 2556, height: 1179, name: 'apple-splash-1179-2556.png' },
  
  // iPhone 15, 14, 13, 12, 11 Pro Max, XS Max
  { width: 1170, height: 2532, name: 'apple-splash-2532-1170.png' },
  { width: 2532, height: 1170, name: 'apple-splash-1170-2532.png' },
  
  // iPhone 11, XR
  { width: 828, height: 1792, name: 'apple-splash-1792-828.png' },
  { width: 1792, height: 828, name: 'apple-splash-828-1792.png' },
  
  // iPhone 11 Pro, X, XS
  { width: 1125, height: 2436, name: 'apple-splash-2436-1125.png' },
  { width: 2436, height: 1125, name: 'apple-splash-1125-2436.png' },
  
  // iPhone 8 Plus, 7 Plus, 6s Plus, 6 Plus
  { width: 1242, height: 2208, name: 'apple-splash-2208-1242.png' },
  { width: 2208, height: 1242, name: 'apple-splash-1242-2208.png' },
  
  // iPhone 8, 7, 6s, 6, SE (2nd & 3rd gen)
  { width: 750, height: 1334, name: 'apple-splash-1334-750.png' },
  { width: 1334, height: 750, name: 'apple-splash-750-1334.png' },
  
  // iPad Pro 12.9"
  { width: 2048, height: 2732, name: 'apple-splash-2732-2048.png' },
  { width: 2732, height: 2048, name: 'apple-splash-2048-2732.png' },
  
  // iPad Pro 11"
  { width: 1668, height: 2388, name: 'apple-splash-2388-1668.png' },
  { width: 2388, height: 1668, name: 'apple-splash-1668-2388.png' },
];

// Generate SVG splash screen content
function generateSplashSVG(width, height) {
  const isPortrait = height > width;
  const size = Math.min(width, height);
  const iconSize = size * 0.25; // 25% of smallest dimension
  const centerX = width / 2;
  const centerY = height / 2;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <!-- Background with gradient -->
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Full background -->
  <rect width="${width}" height="${height}" fill="url(#grad1)"/>
  
  <!-- Centered icon group -->
  <g transform="translate(${centerX - iconSize/2}, ${centerY - iconSize/2})">
    <!-- Dashboard grid (2x2) -->
    <g fill="white" opacity="0.9">
      <rect x="0" y="0" width="${iconSize * 0.17}" height="${iconSize * 0.17}" rx="${iconSize * 0.03}"/>
      <rect x="${iconSize * 0.22}" y="0" width="${iconSize * 0.17}" height="${iconSize * 0.17}" rx="${iconSize * 0.03}"/>
      <rect x="0" y="${iconSize * 0.22}" width="${iconSize * 0.17}" height="${iconSize * 0.17}" rx="${iconSize * 0.03}"/>
      <rect x="${iconSize * 0.22}" y="${iconSize * 0.22}" width="${iconSize * 0.17}" height="${iconSize * 0.17}" rx="${iconSize * 0.03}"/>
    </g>
    
    <!-- Message bubble with dots -->
    <g transform="translate(${iconSize * 0.45}, ${iconSize * 0.45})">
      <!-- Speech bubble -->
      <path d="M 0,0 Q 0,-${iconSize * 0.07} ${iconSize * 0.07},-${iconSize * 0.07} L ${iconSize * 0.36},-${iconSize * 0.07} Q ${iconSize * 0.43},-${iconSize * 0.07} ${iconSize * 0.43},0 L ${iconSize * 0.43},${iconSize * 0.19} Q ${iconSize * 0.43},${iconSize * 0.26} ${iconSize * 0.36},${iconSize * 0.26} L ${iconSize * 0.17},${iconSize * 0.26} L ${iconSize * 0.07},${iconSize * 0.36} L ${iconSize * 0.07},${iconSize * 0.26} Q 0,${iconSize * 0.26} 0,${iconSize * 0.19} Z" 
            fill="white" 
            opacity="0.9"/>
      
      <!-- Three dots -->
      <circle cx="${iconSize * 0.13}" cy="${iconSize * 0.095}" r="${iconSize * 0.028}" fill="#6366f1"/>
      <circle cx="${iconSize * 0.215}" cy="${iconSize * 0.095}" r="${iconSize * 0.028}" fill="#6366f1"/>
      <circle cx="${iconSize * 0.30}" cy="${iconSize * 0.095}" r="${iconSize * 0.028}" fill="#6366f1"/>
    </g>
  </g>
  
  <!-- App name -->
  <text x="${centerX}" y="${centerY + iconSize * 0.75}" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="${size * 0.045}" 
        font-weight="600"
        fill="white" 
        text-anchor="middle" 
        opacity="0.95">Dashboard</text>
</svg>`;
}

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

// Generate splash screen SVGs
console.log('Generating iOS splash screens...');

splashSizes.forEach(({ width, height, name }) => {
  const svgContent = generateSplashSVG(width, height);
  const svgPath = path.join(publicDir, name.replace('.png', '.svg'));
  fs.writeFileSync(svgPath, svgContent);
  console.log(`✓ Generated ${name.replace('.png', '.svg')}`);
});

console.log('\n✅ All splash screens generated!');
console.log('\nNote: SVG files generated. For PNG conversion, you can:');
console.log('1. Use a tool like sharp or imagemagick to convert SVGs to PNGs');
console.log('2. Or use the SVGs directly (modern browsers support SVG splash screens)');
console.log('\nFor now, we\'ll use a single representative splash screen approach.');

