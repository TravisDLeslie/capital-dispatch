import { describe, expect, it } from "vitest";
import {
  addPickupPhotoToItems,
  areAllPickupItemsComplete,
  getPickupPhotoList,
  hasPickupPhoto,
  isPickupItemComplete,
  markPickupItemPickedUpInItems,
} from "./supplierRunFlow";

describe("supplierRunFlow", () => {
  it("saves a pickup photo without marking the item picked up", () => {
    const items = [
      {
        id: "item-1",
        description: "2x6-16 #2 Doug Fir",
        pickedUp: false,
        pickupPhotos: [],
      },
    ];
    const photo = {
      url: "https://storage.test/pickup.jpg",
      path: "supplierRuns/run-1/items/item-1/pickup.jpg",
    };

    const updatedItems = addPickupPhotoToItems(items, "item-1", photo);

    expect(getPickupPhotoList(updatedItems[0])).toHaveLength(1);
    expect(hasPickupPhoto(updatedItems[0])).toBe(true);
    expect(isPickupItemComplete(updatedItems[0])).toBe(false);
    expect(areAllPickupItemsComplete(updatedItems)).toBe(false);
  });

  it("marks an item picked up without removing saved photos", () => {
    const photo = {
      url: "https://storage.test/pickup.jpg",
      path: "supplierRuns/run-1/items/item-1/pickup.jpg",
    };
    const items = [
      {
        id: "item-1",
        description: "2x6-16 #2 Doug Fir",
        pickupPhotos: [photo],
      },
    ];

    const updatedItems = markPickupItemPickedUpInItems(
      items,
      "item-1",
      "2026-09-17T10:00:00.000Z",
    );

    expect(updatedItems[0].pickedUp).toBe(true);
    expect(updatedItems[0].pickedUpAt).toBe("2026-09-17T10:00:00.000Z");
    expect(getPickupPhotoList(updatedItems[0])).toEqual([photo]);
    expect(areAllPickupItemsComplete(updatedItems)).toBe(true);
  });

  it("does not treat legacy photo-only items as complete", () => {
    const items = [
      {
        id: "item-1",
        pickupPhoto: {
          url: "https://storage.test/legacy.jpg",
        },
      },
    ];

    expect(hasPickupPhoto(items[0])).toBe(true);
    expect(isPickupItemComplete(items[0])).toBe(false);
    expect(areAllPickupItemsComplete(items)).toBe(false);
  });
});
