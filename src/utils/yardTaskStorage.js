import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const STORAGE_KEY = "dispatch-cl-yard-tasks";
const YARD_TASKS_COLLECTION = "yardTasks";

function getLocalYardTasks() {
  try {
    const savedTasks = localStorage.getItem(STORAGE_KEY);

    if (!savedTasks) {
      return [];
    }

    const parsedTasks = JSON.parse(savedTasks);

    return Array.isArray(parsedTasks) ? parsedTasks : [];
  } catch (error) {
    console.error("Unable to load yard tasks:", error);
    return [];
  }
}

function saveLocalYardTasks(yardTasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(yardTasks));
    return true;
  } catch (error) {
    console.error("Unable to save yard tasks:", error);
    return false;
  }
}

function sortYardTasks(yardTasks) {
  return [...yardTasks].sort((firstTask, secondTask) => {
    const firstDone = firstTask.status === "complete";
    const secondDone = secondTask.status === "complete";

    if (firstDone !== secondDone) {
      return firstDone ? 1 : -1;
    }

    const priorityDiff =
      Number(secondTask.priority || 0) - Number(firstTask.priority || 0);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return (
      new Date(secondTask.createdAt || 0).getTime() -
      new Date(firstTask.createdAt || 0).getTime()
    );
  });
}

export function subscribeToYardTasks(onYardTasks, onError) {
  if (!db) {
    onYardTasks(getLocalYardTasks());
    return () => {};
  }

  const yardTasksQuery = query(
    collection(db, YARD_TASKS_COLLECTION),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    yardTasksQuery,
    (yardTaskSnapshot) => {
      const yardTasks = yardTaskSnapshot.docs.map((yardTaskDoc) => ({
        id: yardTaskDoc.id,
        ...yardTaskDoc.data(),
      }));
      const sortedYardTasks = sortYardTasks(yardTasks);

      saveLocalYardTasks(sortedYardTasks);
      onYardTasks(sortedYardTasks);
    },
    onError,
  );
}

export async function saveYardTask(yardTask) {
  const currentYardTasks = getLocalYardTasks();
  const updatedAt = new Date().toISOString();
  const taskToSave = {
    ...yardTask,
    updatedAt,
  };
  const taskExists = currentYardTasks.some((task) => task.id === taskToSave.id);
  const updatedYardTasks = sortYardTasks(
    taskExists
      ? currentYardTasks.map((task) =>
          task.id === taskToSave.id ? { ...task, ...taskToSave } : task,
        )
      : [taskToSave, ...currentYardTasks],
  );

  if (db) {
    await setDoc(doc(db, YARD_TASKS_COLLECTION, taskToSave.id), taskToSave);
  }

  saveLocalYardTasks(updatedYardTasks);
  return updatedYardTasks;
}

export async function updateYardTask(yardTaskId, yardTaskUpdates) {
  const currentYardTasks = getLocalYardTasks();
  const updates = {
    ...yardTaskUpdates,
    updatedAt: new Date().toISOString(),
  };
  const updatedYardTasks = sortYardTasks(
    currentYardTasks.map((yardTask) =>
      yardTask.id === yardTaskId ? { ...yardTask, ...updates } : yardTask,
    ),
  );

  if (db) {
    await updateDoc(doc(db, YARD_TASKS_COLLECTION, yardTaskId), updates);
  }

  saveLocalYardTasks(updatedYardTasks);
  return updatedYardTasks;
}

export async function deleteYardTask(yardTaskId) {
  const currentYardTasks = getLocalYardTasks();
  const updatedYardTasks = currentYardTasks.filter(
    (yardTask) => yardTask.id !== yardTaskId,
  );

  if (db) {
    await deleteDoc(doc(db, YARD_TASKS_COLLECTION, yardTaskId));
  }

  saveLocalYardTasks(updatedYardTasks);
  return updatedYardTasks;
}
