import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("tmp/pdfs/trex-price-book.txt");
const outputPath = path.resolve("src/data/trexPriceBook.js");

const pageMetadata = {
  2: ["Decking - Composite", "Enhance Basics"],
  3: ["Decking - Composite", "Enhance Naturals"],
  4: ["Decking - Composite", "Select"],
  5: ["Decking - Composite", "Select Earth Tone"],
  6: ["Decking - Composite", "Signature"],
  7: ["Decking - Composite", "Transcend Earth Tone"],
  8: ["Decking - Composite", "Transcend Lineage - Decking"],
  9: ["Decking - Composite", "Transcend Lineage - Fascia & Riser"],
  10: ["Decking - Composite", "Transcend Tropical - Decking"],
  11: ["Decking - Composite", "Transcend Tropical - Fascia & Riser"],
  12: ["Decking - PVC & Universal", "Refuge - PVC Decking"],
  13: ["Hidden Fasteners", "Trex Hideaway"],
  14: ["Deck Screws", "Color Match Deck Screws"],
  15: ["Deck Plugs", "Deck Plugs"],
  16: ["Fascia Screws", "Fascia Screws"],
  17: ["Fascia Plugs", "Fascia Plugs"],
  18: ["Decking Accessories", "Accessories"],
  19: ["Railing", "Enhance Steel"],
  20: ["Railing", "Select Aluminum"],
  21: ["Railing", "Select Aluminum"],
  22: ["Railing", "Select Classic"],
  23: ["Railing", "Select T-Rail"],
  24: ["Railing", "Signature"],
  25: ["Railing", "Signature"],
  26: ["Railing", "Transcend"],
  27: ["Railing", "Transcend"],
  28: ["Railing", "Transcend & Select"],
};

const pages = fs.readFileSync(sourcePath, "utf8").split("\f");
const items = [];

for (let pageIndex = 1; pageIndex < pages.length; pageIndex += 1) {
  const pdfPage = pageIndex + 1;
  const [category, collection] = pageMetadata[pdfPage] || [];

  if (!category) continue;

  for (const rawLine of pages[pageIndex].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("TX")) continue;

    const match = line.match(
      /^(\S+)\s+(.+?)\s+(\d+)\s+(\S+)\s+(\d+\.\d+)\s+(\d+\.\d+)\s+([A-Za-z][A-Za-z -]+)$/,
    );

    if (!match) {
      throw new Error(`Unable to parse page ${pdfPage}: ${line}`);
    }

    const [, productCode, details, piecesPerUnit, uom, unitCost, jobPackCost, status] = match;
    const detailParts = details.split(/\s{2,}/).map((value) => value.trim());
    const isDecking = pdfPage >= 2 && pdfPage <= 12;
    const description = detailParts[0] || "";
    const color = isDecking ? detailParts[1] || "" : detailParts[1] || "";
    const type = isDecking ? detailParts[2] || "" : "";

    items.push([
      category,
      collection,
      productCode,
      description,
      color,
      type,
      Number(piecesPerUnit),
      uom,
      Number(unitCost),
      Number(jobPackCost),
      status.trim(),
      pdfPage,
      pdfPage <= 12 ? "Job Pack" : "Piece",
    ]);
  }
}

if (items.length !== 686) {
  throw new Error(`Expected 686 price-book rows, found ${items.length}.`);
}

const serializedRows = items.map((row) => `  ${JSON.stringify(row)}`).join(",\n");
const output = `// Generated from Boise - Trex Price Book - Stocking.pdf (OrePac Boise, August 2026).\n// Re-run scripts/generate-trex-price-book-data.mjs after extracting the PDF to tmp/pdfs/trex-price-book.txt.\nconst rows = [\n${serializedRows}\n];\n\nexport const trexPriceBookItems = rows.map(\n  ([category, collection, productCode, description, color, type, piecesPerUnit, uom, unitCost, jobPackCost, status, sourcePage, costLabel]) => ({\n    category,\n    collection,\n    productCode,\n    description,\n    color,\n    type,\n    piecesPerUnit,\n    uom,\n    unitCost,\n    jobPackCost,\n    status,\n    sourcePage,\n    costLabel,\n  }),\n);\n\nexport const TREX_PRICE_BOOK_ITEM_COUNT = rows.length;\n`;

fs.writeFileSync(outputPath, output);
console.log(`Wrote ${items.length} Trex price-book rows to ${outputPath}`);
