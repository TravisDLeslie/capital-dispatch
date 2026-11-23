const path = require("node:path");
const PDFDocument = require("pdfkit");

const BRAND_RED = "#FC2C38";
const INK = "#0F172A";
const SLATE = "#475569";
const MUTED = "#64748B";
const LINE = "#DCE4EE";
const PANEL = "#F8FAFC";
const LOGO_PATH = path.join(__dirname, "assets", "capital-lumber-logo.png");

function clean(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function formatOrderNumber(value) {
  const normalized = clean(value);
  const digits = normalized.replace(/\D/g, "");

  if (digits.length === 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  return normalized || "Pending";
}

function formatDate(value) {
  if (!value) return "To be confirmed";

  const normalizedValue = clean(value);
  const date = value instanceof Date
    ? value
    : new Date(/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue) ? `${normalizedValue}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return clean(value, "To be confirmed");

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatHandoff(order) {
  const handoffType = clean(order.handoffType || order.orderMethod).toLowerCase();
  if (handoffType === "delivery") return "Delivery";
  if (handoffType === "willcall") return "Will Call pickup";
  if (handoffType === "return") return "Customer return";
  if (handoffType === "vendorreturn") return "Vendor return";
  return clean(order.handoffType || order.orderMethod, "Order fulfillment");
}

function drawLabel(doc, label, value, x, y, width) {
  doc
    .fillColor(MUTED)
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .text(clean(label).toUpperCase(), x, y, { width, characterSpacing: 0.8 });
  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .text(clean(value, "—"), x, y + 13, { width, lineGap: 2 });
}

function drawHeader(doc, order, pageNumber) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  doc.image(LOGO_PATH, left, 32, { fit: [168, 48], align: "left", valign: "center" });
  doc
    .fillColor(MUTED)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("3105 W. State St. · Boise, ID 83703", left, 96)
    .text("208-343-5481 · capitallumber.co", left, 109);

  doc
    .fillColor(BRAND_RED)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("CUSTOMER ORDER SUMMARY", right - 210, 41, {
      width: 210,
      align: "right",
      characterSpacing: 1.1,
    });
  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(22)
    .text(`Order ${formatOrderNumber(order.orderNumber)}`, right - 255, 59, {
      width: 255,
      align: "right",
    });
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(8.5)
    .text(`Page ${pageNumber}`, right - 120, 91, { width: 120, align: "right" });

  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(5.1)
    .text(
      "TEXT UPDATES: By opting in, you agree to transactional order and delivery messages from Capital Lumber Co. Msg/data rates may apply. Reply STOP to opt out or HELP for help. Consent not required. 208-343-5481.",
      left,
      119,
      { width: right - left, align: "center", lineBreak: false },
    );

  doc
    .moveTo(left, 134)
    .lineTo(right, 134)
    .lineWidth(2.2)
    .strokeColor(BRAND_RED)
    .stroke();
}

function drawFooter(doc) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const y = doc.page.height - 76;

  doc.moveTo(left, y - 9).lineTo(left + width, y - 9).lineWidth(0.7).strokeColor(LINE).stroke();
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(7.5)
    .text(
      "Thank you for choosing Capital Lumber Co. This summary reflects the order information entered at processing time.",
      left,
      y,
      { width, align: "center" },
    );
}

function drawFirstPageSummary(doc, order) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const customerName = clean(order.contactName || order.customerName, "Customer");
  const businessName = clean(order.businessName || order.customerName, customerName);
  const deliveryAddress = clean(order.deliveryAddress || order.address, "Address to be confirmed");
  const isDelivery = clean(order.handoffType || order.orderMethod).toLowerCase() === "delivery";

  doc.roundedRect(left, 147, width, 92, 10).fillAndStroke(PANEL, LINE);
  drawLabel(doc, "Sold to", businessName, left + 15, 163, 220);
  drawLabel(
    doc,
    "Contact",
    [customerName, clean(order.contactPhone || order.phoneNumber || order.phone)]
      .filter(Boolean)
      .join(" · "),
    left + 15,
    201,
    220,
  );
  drawLabel(
    doc,
    isDelivery ? "Job address" : "Fulfillment",
    isDelivery ? deliveryAddress : formatHandoff(order),
    left + 270,
    163,
    width - 285,
  );
  if (isDelivery) {
    drawLabel(doc, "Delivery timing", formatDate(order.deliveryDate), left + 270, 201, width - 285);
  }

  const cardY = 252;
  const gap = 9;
  const cardWidth = (width - gap * 3) / 4;
  [
    ["Account", clean(order.accountNumber, "—")],
    ["Ordered by", clean(order.orderedBy || order.createdByName, "Capital Lumber")],
    ["Order date", formatDate(order.createdAt || new Date())],
    ["Order type", formatHandoff(order)],
  ].forEach(([label, value], index) => {
    const x = left + index * (cardWidth + gap);
    doc.roundedRect(x, cardY, cardWidth, 52, 8).fillAndStroke("#FFFFFF", LINE);
    drawLabel(doc, label, value, x + 10, cardY + 10, cardWidth - 20);
  });

  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text("Order items", left, 326);
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(8.5)
    .text("Items and quantities from your Capital Lumber order.", left, 346);

  return 369;
}

function drawTableHeader(doc, y) {
  const left = doc.page.margins.left;
  const columns = [
    { label: "QTY", x: left, width: 52 },
    { label: "ITEM #", x: left + 58, width: 108 },
    { label: "DESCRIPTION", x: left + 172, width: 368 },
  ];

  doc.rect(left, y, 540, 24).fill("#EEF2F7");
  columns.forEach((column) => {
    doc
      .fillColor(SLATE)
      .font("Helvetica-Bold")
      .fontSize(7.2)
      .text(column.label, column.x + 6, y + 8, {
        width: column.width - 8,
        characterSpacing: 0.5,
      });
  });

  return y + 24;
}

function getRowHeight(doc, item) {
  const description = clean(item.description, "Order item");
  const descriptionHeight = doc.font("Helvetica-Bold").fontSize(8.3).heightOfString(description, {
    width: 356,
    lineGap: 1.5,
  });
  return Math.max(34, Math.ceil(descriptionHeight + 17));
}

function drawItemRow(doc, item, y, index) {
  const left = doc.page.margins.left;
  const rowHeight = getRowHeight(doc, item);
  if (index % 2 === 1) doc.rect(left, y, 540, rowHeight).fill("#FBFCFE");
  doc.moveTo(left, y + rowHeight).lineTo(left + 540, y + rowHeight).lineWidth(0.45).strokeColor(LINE).stroke();

  const cells = [
    { value: clean(item.quantity, "1"), x: left + 6, width: 44, font: "Helvetica-Bold", size: 8.5 },
    { value: clean(item.itemNumber, "—"), x: left + 64, width: 96, font: "Helvetica", size: 8 },
    { value: clean(item.description, "Order item"), x: left + 178, width: 356, font: "Helvetica-Bold", size: 8.3 },
  ];

  cells.forEach((cell) => {
    doc
      .fillColor(INK)
      .font(cell.font)
      .fontSize(cell.size)
      .text(cell.value, cell.x, y + 9, { width: cell.width, lineGap: 1.5 });
  });

  return y + rowHeight;
}

function drawNotesAndConfirmation(doc, order, startY) {
  const left = doc.page.margins.left;
  const width = 540;
  let y = startY + 18;
  const notes = clean(order.deliveryNotes || order.notes || order.returnNotes);
  const noteHeight = notes
    ? Math.max(
      52,
      doc.font("Helvetica").fontSize(9).heightOfString(notes, { width: width - 30, lineGap: 3 }) + 36,
    )
    : 0;
  const contentHeight = (notes ? noteHeight + 14 : 0) + 86;
  const footerSafeBottom = doc.page.height - 92;

  if (y + contentHeight > footerSafeBottom) {
    doc.addPage();
    drawHeader(doc, order, doc.bufferedPageRange().count);
    y = 151;
  }

  if (notes) {
    doc.roundedRect(left, y, width, noteHeight, 8).fillAndStroke("#FFF8E7", "#F4C95D");
    doc
      .fillColor("#92400E")
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .text("ORDER NOTES", left + 14, y + 12, { characterSpacing: 0.7 });
    doc
      .fillColor(INK)
      .font("Helvetica")
      .fontSize(9)
      .text(notes, left + 14, y + 28, { width: width - 28, lineGap: 3 });
    y += noteHeight + 14;
  }

  doc.roundedRect(left, y, width, 86, 10).fillAndStroke("#FFF5F5", "#FFC8CC");
  doc
    .fillColor(BRAND_RED)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("THANK YOU FOR YOUR ORDER", left + 16, y + 15, { characterSpacing: 0.9 });
  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(12)
    .text("We appreciate your business.", left + 16, y + 34);
  doc
    .fillColor(SLATE)
    .font("Helvetica")
    .fontSize(8.7)
    .text(
      "Capital Lumber will text the selected contact when this order is scheduled for delivery or ready for pickup. Please call 208-343-5481 with any questions.",
      left + 16,
      y + 53,
      { width: width - 32, lineGap: 2 },
    );

  return y + 86;
}

function generateOrderSummaryPdf(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 34, right: 36, bottom: 62, left: 36 },
      bufferPages: true,
      info: {
        Title: `Capital Lumber Order ${formatOrderNumber(order.orderNumber)}`,
        Author: "Capital Lumber Co.",
        Subject: "Customer order summary",
      },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    drawHeader(doc, order, 1);
    let y = drawFirstPageSummary(doc, order);
    y = drawTableHeader(doc, y);
    const items = Array.isArray(order.items) && order.items.length
      ? order.items
      : [{ quantity: "1", description: "Order details on file" }];

    items.forEach((item, index) => {
      const rowHeight = getRowHeight(doc, item);
      if (y + rowHeight > doc.page.height - 82) {
        doc.addPage();
        drawHeader(doc, order, doc.bufferedPageRange().count);
        y = drawTableHeader(doc, 150);
      }
      y = drawItemRow(doc, item, y, index);
    });

    drawNotesAndConfirmation(doc, order, y);

    const pageRange = doc.bufferedPageRange();
    for (let pageIndex = pageRange.start; pageIndex < pageRange.start + pageRange.count; pageIndex += 1) {
      doc.switchToPage(pageIndex);
      drawFooter(doc);
    }

    doc.end();
  });
}

module.exports = {
  generateOrderSummaryPdf,
};
