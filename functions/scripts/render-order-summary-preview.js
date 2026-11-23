const fs = require("node:fs");
const path = require("node:path");
const { generateOrderSummaryPdf } = require("../orderSummaryPdf");

async function main() {
  const outputPath = path.resolve(__dirname, "../../output/pdf/order-summary-preview.pdf");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const pdfBuffer = await generateOrderSummaryPdf({
    orderNumber: "739-001",
    customerName: "Jordan Smith",
    businessName: "Smith Construction",
    accountNumber: "100045",
    contactPhone: "(208) 555-0142",
    deliveryAddress: "1234 W Pine Ridge Dr, Boise, ID 83703",
    deliveryDate: "2026-11-27",
    handoffType: "delivery",
    orderedBy: "Travis L.",
    createdAt: "2026-11-21T10:30:00-07:00",
    deliveryNotes: "Please call the jobsite contact before arrival. Deliver material on the west side of the garage.",
    items: [
      {
        quantity: "24",
        itemNumber: "DF2416",
        description: "2x4-16' Douglas Fir #2 & Better",
        path: "inStock",
      },
      {
        quantity: "12",
        itemNumber: "OSB716",
        description: "7/16 OSB 4x8 sheathing",
        path: "wePickup",
        poNumber: "445-128",
        vendor: "Boise Cascade",
      },
      {
        quantity: "3",
        itemNumber: "EXTDOOR",
        description: "3/0 x 6/8 fiberglass exterior door unit, primed white",
        path: "supplierDelivery",
        poNumber: "445-129",
        vendor: "BMC Millwork",
      },
      {
        quantity: "1",
        itemNumber: "HARDWARE",
        description: "Door hardware and installation package",
        path: "pod",
        poNumber: "445-130",
        vendor: "Idaho Hardware",
      },
    ],
  });

  fs.writeFileSync(outputPath, pdfBuffer);
  process.stdout.write(`${outputPath}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
