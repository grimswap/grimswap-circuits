#!/usr/bin/env node
/**
 * Copy GrimSwap circuit files to your project's public directory.
 *
 * Usage:
 *   npx grimswap-copy-circuits [output-dir]
 *   npx grimswap-copy-circuits public/circuits
 *   npx grimswap-copy-circuits src/assets/circuits
 *
 * Default output: ./public/circuits
 */

const fs = require("fs");
const path = require("path");

const outputDir = process.argv[2] || "public/circuits";
const pkgRoot = path.resolve(__dirname, "..");

const files = [
  {
    src: path.join(pkgRoot, "build/privateSwap_js/privateSwap.wasm"),
    dest: "privateSwap.wasm",
  },
  {
    src: path.join(pkgRoot, "build/privateSwap.zkey"),
    dest: "privateSwap.zkey",
  },
];

// Create output directory
const absOutput = path.resolve(process.cwd(), outputDir);
fs.mkdirSync(absOutput, { recursive: true });

console.log(`Copying GrimSwap circuit files to ${absOutput}...\n`);

for (const file of files) {
  const destPath = path.join(absOutput, file.dest);

  if (!fs.existsSync(file.src)) {
    console.error(`  SKIP ${file.dest} (source not found: ${file.src})`);
    continue;
  }

  fs.copyFileSync(file.src, destPath);
  const size = (fs.statSync(destPath).size / 1024 / 1024).toFixed(1);
  console.log(`  ${file.dest} (${size} MB)`);
}

console.log("\nDone! Load these in your app:");
console.log(`  const wasm = await fetch("/${outputDir}/privateSwap.wasm").then(r => r.arrayBuffer());`);
console.log(`  const zkey = await fetch("/${outputDir}/privateSwap.zkey").then(r => r.arrayBuffer());`);
