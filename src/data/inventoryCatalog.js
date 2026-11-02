import inventoryItems from "./inventoryItems.json";
import { timberTechCollections } from "./timberTechPriceBook";
import { trexPriceBookItems } from "./trexPriceBook";
import { woodgrainPriceBookItems } from "./woodgrainPriceBook";

const cleanPart = (value) => String(value || "").trim();

const joinDescription = (...parts) =>
  parts
    .map(cleanPart)
    .filter(Boolean)
    .join(" · ");

const catalogItem = ({
  itemNumber,
  description,
  brand,
  groupSection,
  sourcePage,
  defaultVendor,
}) => ({
  itemNumber,
  description,
  brand,
  groupSection,
  sourcePage,
  defaultVendor,
  onHand: null,
  nonStocked: true,
});

export const woodgrainInventoryItems = woodgrainPriceBookItems.map((item, index) =>
  catalogItem({
    itemNumber: `WG${String(index + 1).padStart(3, "0")}`,
    description: joinDescription(
      "Woodgrain",
      item.pattern,
      item.description,
      item.size,
      item.length,
    ),
    brand: "Woodgrain",
    groupSection: `Woodgrain · ${cleanPart(item.category) || "Products"}`,
    sourcePage: item.sourcePage,
    defaultVendor: "Woodgrain",
  }),
);

export const trexInventoryItems = trexPriceBookItems.map((item, index) =>
  catalogItem({
    itemNumber: `TX${String(index + 1).padStart(3, "0")}`,
    description: joinDescription(
      "Trex",
      item.collection,
      item.color,
      item.description,
      item.type,
    ),
    brand: "Trex",
    groupSection: `Trex · ${cleanPart(item.category) || "Products"}`,
    sourcePage: item.sourcePage,
    defaultVendor: "Orepac",
  }),
);

const timberTechProfiles = [
  { id: "DB", label: 'Deck board 1x6' },
  { id: "RS", label: 'Riser 1x8' },
  { id: "FA", label: 'Fascia 1x12' },
];

export const timberTechInventoryItems = timberTechCollections.flatMap(
  (collection, collectionIndex) =>
    collection.colors.flatMap((color, colorIndex) =>
      timberTechProfiles.map((profile, profileIndex) => {
        const sequence =
          timberTechCollections
            .slice(0, collectionIndex)
            .reduce(
              (total, previousCollection) =>
                total + previousCollection.colors.length * timberTechProfiles.length,
              0,
            ) +
          colorIndex * timberTechProfiles.length +
          profileIndex +
          1;

        return catalogItem({
          itemNumber: `TT${String(sequence).padStart(3, "0")}`,
          description: joinDescription(
            "TimberTech",
            collection.collection,
            color,
            profile.label,
          ),
          brand: "TimberTech",
          groupSection: `TimberTech · ${cleanPart(collection.material) || "Decking"}`,
          defaultVendor: "Boise Cascade",
        });
      }),
    ),
);

export const nonStockedCatalogItems = [
  ...woodgrainInventoryItems,
  ...trexInventoryItems,
  ...timberTechInventoryItems,
];

export const inventoryCatalogItems = [
  ...inventoryItems,
  ...nonStockedCatalogItems,
];
