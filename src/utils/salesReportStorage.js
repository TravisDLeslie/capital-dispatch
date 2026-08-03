import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const STORAGE_KEY = "dispatch-cl-sales-monthly-reports";
const SALES_REPORT_COLLECTION = "salesMonthlyReports";

function getLocalSalesReports() {
  try {
    const savedReports = localStorage.getItem(STORAGE_KEY);

    if (!savedReports) {
      return [];
    }

    const parsedReports = JSON.parse(savedReports);

    return Array.isArray(parsedReports) ? parsedReports : [];
  } catch (error) {
    console.error("Unable to load sales reports:", error);
    return [];
  }
}

function saveLocalSalesReports(reports) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));

    return true;
  } catch (error) {
    console.error("Unable to save sales reports:", error);
    return false;
  }
}

function sortSalesReports(reports) {
  return [...reports].sort((firstReport, secondReport) =>
    String(secondReport.month || "").localeCompare(
      String(firstReport.month || ""),
    ),
  );
}

export function subscribeToSalesReports(onReports, onError) {
  if (!db) {
    onReports(getLocalSalesReports());
    return () => {};
  }

  const reportsQuery = query(
    collection(db, SALES_REPORT_COLLECTION),
    orderBy("month", "desc"),
  );

  return onSnapshot(
    reportsQuery,
    (reportSnapshot) => {
      const reports = reportSnapshot.docs.map((reportDoc) => ({
        id: reportDoc.id,
        ...reportDoc.data(),
      }));
      const sortedReports = sortSalesReports(reports);

      saveLocalSalesReports(sortedReports);
      onReports(sortedReports);
    },
    onError,
  );
}

export async function saveSalesReport(report) {
  const currentReports = getLocalSalesReports();
  const updatedAt = new Date().toISOString();
  const cleanReport = {
    ...report,
    id: report.month,
    month: String(report.month || "").trim(),
    cashCardSales: Number(report.cashCardSales) || 0,
    chargeSales: Number(report.chargeSales) || 0,
    topSpenders: Array.isArray(report.topSpenders)
      ? report.topSpenders.slice(0, 5).map((spender) => ({
          id: spender.id,
          name: String(spender.name || "").trim(),
          amount: Number(spender.amount) || 0,
        }))
      : [],
    updatedAt,
  };
  const updatedReports = sortSalesReports([
    cleanReport,
    ...currentReports.filter(
      (savedReport) => savedReport.month !== cleanReport.month,
    ),
  ]);

  if (db) {
    await setDoc(
      doc(db, SALES_REPORT_COLLECTION, cleanReport.month),
      cleanReport,
    );
  }

  saveLocalSalesReports(updatedReports);

  return updatedReports;
}
