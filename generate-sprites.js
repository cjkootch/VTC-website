#!/usr/bin/env node
// generate-sprites.js — Generate top-down vessel sprites using OpenAI DALL-E API
// Usage: OPENAI_API_KEY=sk-... node generate-sprites.js

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('Error: Set OPENAI_API_KEY environment variable.');
  console.error('Usage: OPENAI_API_KEY=sk-... node generate-sprites.js');
  process.exit(1);
}

const OUTPUT_DIR = path.join(__dirname, 'images', 'games');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const vesselSprites = [
  { name: 'cargo-ship', type: 'cargo', prompt: 'Top-down view of a cargo ship carrying containers, game sprite, clean flat art style, Caribbean sea colors, transparent background, 2D top-down perspective, no shadow' },
  { name: 'fuel-tanker', type: 'tanker', prompt: 'Top-down view of an oil fuel tanker ship, game sprite, clean flat art style, Caribbean sea colors, transparent background, 2D top-down perspective, no shadow' },
  { name: 'speedboat', type: 'speedboat', prompt: 'Top-down view of a small fast speedboat, game sprite, clean flat art style, Caribbean sea colors, transparent background, 2D top-down perspective, no shadow' },
  { name: 'container-barge', type: 'barge', prompt: 'Top-down view of a large flat container barge ship, game sprite, clean flat art style, Caribbean sea colors, transparent background, 2D top-down perspective, no shadow' },
  { name: 'lng-carrier', type: 'lng', prompt: 'Top-down view of an LNG liquefied natural gas carrier ship with spherical tanks, game sprite, clean flat art style, Caribbean sea colors, transparent background, 2D top-down perspective, no shadow' },
];

const islandSprites = [
  { name: 'island-cargo', type: 'cargo', prompt: 'Top-down view of a tropical Caribbean island with a cargo port and crescent shape, game sprite, clean flat art style, green land with sandy beach, transparent background, 2D top-down perspective, no shadow' },
  { name: 'island-tanker', type: 'tanker', prompt: 'Top-down view of an elongated tropical island with fuel storage depot tanks, game sprite, clean flat art style, green land with sandy beach, transparent background, 2D top-down perspective, no shadow' },
  { name: 'island-speedboat', type: 'speedboat', prompt: 'Top-down view of a small rocky tropical island with a marina, game sprite, clean flat art style, green land with sandy beach, transparent background, 2D top-down perspective, no shadow' },
  { name: 'island-barge', type: 'barge', prompt: 'Top-down view of a large flat tropical island with cargo warehouses, game sprite, clean flat art style, green land with sandy beach, transparent background, 2D top-down perspective, no shadow' },
  { name: 'island-lng', type: 'lng', prompt: 'Top-down view of a volcanic tropical island with spherical LNG gas storage tanks, game sprite, clean flat art style, green land with sandy beach, transparent background, 2D top-down perspective, no shadow' },
];

function generateImage(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          resolve(json.data[0].url);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const get = (u) => {
      https.get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed with status ${res.statusCode}`));
        }
        const stream = fs.createWriteStream(filepath);
        res.pipe(stream);
        stream.on('finish', () => { stream.close(); resolve(); });
        stream.on('error', reject);
      }).on('error', reject);
    };
    get(url);
  });
}

async function main() {
  const allSprites = [...vesselSprites, ...islandSprites];
  console.log('Generating vessel and island sprites with DALL-E 3...\n');

  for (const sprite of allSprites) {
    const filepath = path.join(OUTPUT_DIR, `${sprite.name}.png`);
    console.log(`Generating ${sprite.name}...`);
    try {
      const url = await generateImage(sprite.prompt);
      console.log(`  Downloading to ${filepath}...`);
      await downloadFile(url, filepath);
      console.log(`  Done: ${sprite.name}.png`);
    } catch (err) {
      console.error(`  Error generating ${sprite.name}: ${err.message}`);
    }
  }

  // Write sprite manifest
  const manifest = {
    basePath: 'images/games/',
    vessels: {},
    islands: {},
  };
  vesselSprites.forEach(s => { manifest.vessels[s.type] = { file: s.name + '.png' }; });
  islandSprites.forEach(s => { manifest.islands[s.type] = { file: s.name + '.png' }; });
  const manifestPath = path.join(OUTPUT_DIR, 'sprite-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nManifest written: ${manifestPath}`);

  console.log('\nSprite generation complete.');
  console.log(`Output directory: ${OUTPUT_DIR}`);
}

main();
