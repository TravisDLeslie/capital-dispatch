import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { formatCustomerName } from "./textFormatters";

const STORAGE_KEY = "dispatch-cl-customer-statements";
const CUSTOMER_STATEMENTS_COLLECTION = "customerStatements";

function getLocalStatements() {
  try {
    const savedStatements = localStorage.getItem(STORAGE_KEY);

    if (!savedStatements) {
      return [];
    }

    const parsedStatements = JSON.parse(savedStatements);

    return Array.isArray(parsedStatements) ? parsedStatements : [];
  } catch (error) {
    console.error("Unable to load customer statements:", error);
    return [];
  }
}

function saveLocalStatements(statements) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statements));

    return true;
  } catch (error) {
    console.error("Unable to save customer statements:", error);
    return false;
  }
}

function sortStatements(statements) {
  return [...statements].sort((firstStatement, secondStatement) => {
    const monthCompare = String(secondStatement.statementMonth || "").localeCompare(
      String(firstStatement.statementMonth || ""),
    );

    if (monthCompare !== 0) {
      return monthCompare;
    }

    return String(firstStatement.customerName || "").localeCompare(
      String(secondStatement.customerName || ""),
    );
  });
}

function getStatementRecordId(customerId, statementMonth) {
  return `${statementMonth}_${customerId}`.replace(/[/?#[\]]/g, "-");
}

function normalizeStatement(statement) {
  const now = new Date().toISOString();
  const customerId = String(statement.customerId || "").trim();
  const statementMonth = String(statement.statementMonth || "").trim();
  const id =
    statement.id || getStatementRecordId(customerId || "customer", statementMonth);

  return {
    id,
    customerId,
    customerName:
      formatCustomerName(statement.customerName) || "UNNAMED CUSTOMER",
    accountNumber: String(statement.accountNumber || "").trim(),
    statementMonth,
    balanceDueCents: Math.max(0, Math.round(Number(statement.balanceDueCents) || 0)),
    dueDate: String(statement.dueDate || "").trim(),
    status: statement.status || "unpaid",
    notes: String(statement.notes || "").trim(),
    createdAt: statement.createdAt || now,
    updatedAt: now,
  };
}

export function subscribeToCustomerStatements(onStatements, onError) {
  if (!db) {
    onStatements(getLocalStatements());
    return () => {};
  }

  const statementsQuery = query(
    collection(db, CUSTOMER_STATEMENTS_COLLECTION),
    orderBy("statementMonth", "desc"),
  );

  return onSnapshot(
    statementsQuery,
    (statementSnapshot) => {
      const statements = statementSnapshot.docs.map((statementDoc) => ({
        id: statementDoc.id,
        ...statementDoc.data(),
      }));
      const sortedStatements = sortStatements(statements);

      saveLocalStatements(sortedStatements);
      onStatements(sortedStatements);
    },
    onError,
  );
}

export async function saveCustomerStatement(statement) {
  const currentStatements = getLocalStatements();
  const cleanStatement = normalizeStatement(statement);
  const updatedStatements = sortStatements([
    cleanStatement,
    ...currentStatements.filter(
      (savedStatement) => savedStatement.id !== cleanStatement.id,
    ),
  ]);

  if (db) {
    await setDoc(
      doc(db, CUSTOMER_STATEMENTS_COLLECTION, cleanStatement.id),
      cleanStatement,
    );
  }

  saveLocalStatements(updatedStatements);

  return updatedStatements;
}
