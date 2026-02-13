const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'src');
const PUBLIC = path.join(ROOT, 'public');

// Ensure dist directories exist
const dirs = [
  DIST,
  path.join(DIST, 'sidepanel'),
  path.join(DIST, 'graph'),
  path.join(DIST, 'popup'),
  path.join(DIST, 'lib'),
  path.join(DIST, 'icons'),
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Copy manifest.json
fs.copyFileSync(
  path.join(ROOT, 'manifest.json'),
  path.join(DIST, 'manifest.json')
);

// Copy source files
const srcFiles = [
  'background.js',
  'content-script.js',
  'mock-data.js',
];

srcFiles.forEach(file => {
  const srcPath = path.join(SRC, file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(DIST, file));
  }
});

// Copy sidepanel files
const sidepanelFiles = ['index.html', 'app.js'];
sidepanelFiles.forEach(file => {
  const srcPath = path.join(SRC, 'sidepanel', file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(DIST, 'sidepanel', file));
  }
});

// Copy graph files
const graphFiles = ['index.html', 'graph.js'];
graphFiles.forEach(file => {
  const srcPath = path.join(SRC, 'graph', file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(DIST, 'graph', file));
  }
});

// Copy popup files
const popupFiles = ['popup.html', 'popup.js'];
popupFiles.forEach(file => {
  const srcPath = path.join(SRC, 'popup', file);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, path.join(DIST, 'popup', file));
  }
});

// Copy lib files (vis-network)
const libDir = path.join(PUBLIC, 'lib');
if (fs.existsSync(libDir)) {
  fs.readdirSync(libDir).forEach(file => {
    fs.copyFileSync(
      path.join(libDir, file),
      path.join(DIST, 'lib', file)
    );
  });
}

// Copy public assets
if (fs.existsSync(PUBLIC)) {
  // Copy icons
  const iconsDir = path.join(PUBLIC, 'icons');
  if (fs.existsSync(iconsDir)) {
    fs.readdirSync(iconsDir).forEach(file => {
      fs.copyFileSync(
        path.join(iconsDir, file),
        path.join(DIST, 'icons', file)
      );
    });
  }
}

// Copy Alpine.js CSP build from node_modules
const alpineCspPath = path.join(ROOT, 'node_modules', '@alpinejs', 'csp', 'dist', 'cdn.min.js');
if (fs.existsSync(alpineCspPath)) {
  fs.copyFileSync(alpineCspPath, path.join(DIST, 'alpine.min.js'));
  console.log('Copied Alpine.js CSP build');
} else {
  // Fallback to public folder
  const alpinePath = path.join(PUBLIC, 'alpine.min.js');
  if (fs.existsSync(alpinePath)) {
    fs.copyFileSync(alpinePath, path.join(DIST, 'alpine.min.js'));
    console.log('Warning: Using non-CSP Alpine.js build');
  }
}

console.log('Build complete! Load the dist/ folder in Chrome.');
