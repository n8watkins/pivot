// Renders Pivot's PNG and ICO icons from the SVG sources in brand/ with headless Chromium.
// Run with `npm run icons` after changing a source; the outputs are committed.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = path.resolve(import.meta.dirname, "..");
const source = (name) => readFile(path.join(root, "brand", name), "utf8");

const outputs = [
  { file: "public/icons/pivot-192.png", svg: "pivot-tile.svg", size: 192 },
  { file: "public/icons/pivot-512.png", svg: "pivot-tile.svg", size: 512 },
  { file: "public/icons/pivot-maskable-192.png", svg: "pivot-tile-maskable.svg", size: 192 },
  { file: "public/icons/pivot-maskable-512.png", svg: "pivot-tile-maskable.svg", size: 512 },
  { file: "public/apple-icon.png", svg: "pivot-tile-square.svg", size: 180 },
];
const faviconSizes = [16, 32, 48];

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(svg, size) {
  await page.setViewportSize({ width: size, height: size });
  const markup = svg.replace("<svg ", `<svg width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" `);
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  return page.locator("svg").screenshot({ omitBackground: true });
}

for (const output of outputs) {
  await writeFile(path.join(root, output.file), await render(await source(output.svg), output.size));
  console.log(`wrote ${output.file}`);
}

// favicon.ico: the sage p on transparent, for tabs that do not use the SVG favicon.
const sage = await source("pivot-p-sage.svg");
const images = [];
for (const size of faviconSizes) images.push({ size, png: await render(sage, size) });
const header = Buffer.alloc(6 + images.length * 16);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach(({ size, png }, index) => {
  const entry = 6 + index * 16;
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(path.join(root, "public/favicon.ico"), Buffer.concat([header, ...images.map((image) => image.png)]));
console.log("wrote public/favicon.ico");
await browser.close();
