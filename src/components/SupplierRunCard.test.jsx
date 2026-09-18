import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SupplierRunCard from "./SupplierRunCard";
import { uploadSupplierRunPickupPhoto } from "../utils/photoStorage";

vi.mock("../utils/photoStorage", () => ({
  uploadSupplierRunPickupPhoto: vi.fn(async () => ({
    url: "https://storage.test/supplierRuns/run-1/items/item-1/pickup.jpg",
    path: "supplierRuns/run-1/items/item-1/pickup.jpg",
    name: "pickup.jpg",
    type: "image/jpeg",
    size: 1234,
    width: 800,
    height: 600,
    capturedAt: "2026-09-17T12:00:00.000Z",
  })),
}));

const supplierRun = {
  id: "run-1",
  poNumber: "441-552",
  vendor: "Intermountain Wood Products",
  driver: "Travis L.",
  pickupDate: "2026-08-28",
  items: [
    {
      id: "item-1",
      quantity: "5",
      description: '3/4" 4X8 CLASSIC LAM RAW',
      materialUse: "order",
      pickedUp: false,
      pickedUpAt: "",
      pickupPhotos: [],
    },
  ],
};

describe("SupplierRunCard", () => {
  it("saves a pickup photo without completing the material or closing the PO", async () => {
    const onSavePickupPhoto = vi.fn(async () => {});
    const user = userEvent.setup();
    const { container } = render(
      <SupplierRunCard
        supplierRun={supplierRun}
        onSavePickupPhoto={onSavePickupPhoto}
        onUpdateItemDescription={vi.fn()}
        defaultItemsOpen
      />,
    );

    const fileInput = container.querySelector('input[type="file"]');
    const photo = new File(["pickup-photo"], "pickup.png", {
      type: "image/png",
    });

    expect(fileInput).toBeInTheDocument();
    await user.upload(fileInput, photo);

    await waitFor(() => {
      expect(uploadSupplierRunPickupPhoto).toHaveBeenCalledWith({
        supplierRunId: "run-1",
        itemId: "item-1",
        file: photo,
      });
    });

    expect(onSavePickupPhoto).toHaveBeenCalledWith(
      "run-1",
      "item-1",
      expect.objectContaining({
        url: "https://storage.test/supplierRuns/run-1/items/item-1/pickup.jpg",
      }),
      { markPickedUp: false },
    );
    expect(screen.getByText("441-552")).toBeInTheDocument();
    expect(screen.queryByText(/Are you done/i)).not.toBeInTheDocument();
  });
});
