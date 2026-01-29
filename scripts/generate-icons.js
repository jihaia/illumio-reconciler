// Generate simple PNG icons for the Chrome extension
// These are minimal placeholder icons for the PoC

const fs = require('fs');
const path = require('path');

// Simple PNG generator using raw bytes
// Creates a solid color square with the extension's primary color

function createPNG(size) {
  // PNG file structure:
  // - 8 byte signature
  // - IHDR chunk (image header)
  // - IDAT chunk (image data)
  // - IEND chunk (end)

  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);  // width
  ihdrData.writeUInt32BE(size, 4);  // height
  ihdrData.writeUInt8(8, 8);        // bit depth
  ihdrData.writeUInt8(2, 9);        // color type (RGB)
  ihdrData.writeUInt8(0, 10);       // compression
  ihdrData.writeUInt8(0, 11);       // filter
  ihdrData.writeUInt8(0, 12);       // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Create image data (uncompressed for simplicity)
  // Primary color: #6366f1 (RGB: 99, 102, 241)
  // We'll create a gradient effect

  const rawData = [];

  for (let y = 0; y < size; y++) {
    rawData.push(0); // filter byte for each row

    for (let x = 0; x < size; x++) {
      // Create a simple gradient/pattern
      const centerX = size / 2;
      const centerY = size / 2;
      const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      const maxDist = size / 2;

      // Inner circle with sync icon pattern
      if (dist < maxDist * 0.8) {
        // Primary indigo color with slight variation
        const factor = 1 - (dist / maxDist) * 0.2;
        rawData.push(Math.floor(99 * factor));   // R
        rawData.push(Math.floor(102 * factor));  // G
        rawData.push(Math.floor(241 * factor));  // B
      } else {
        // Outer area - slightly darker
        rawData.push(79);   // R
        rawData.push(70);   // G
        rawData.push(229);  // B
      }
    }
  }

  // Compress using zlib
  const zlib = require('zlib');
  const compressedData = zlib.deflateSync(Buffer.from(rawData));

  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type);
  const crcData = Buffer.concat([typeBuffer, data]);

  // CRC32 calculation
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = makeCRCTable();

  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeCRCTable() {
  const table = new Array(256);

  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c;
  }

  return table;
}

// Generate icons
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [16, 48, 128];

sizes.forEach(size => {
  const png = createPNG(size);
  const filePath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Created ${filePath}`);
});

console.log('Icons generated successfully!');
