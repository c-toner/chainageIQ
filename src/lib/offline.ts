import { openDB } from "idb";
export type Draft = {
  id: string;
  userId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  error?: string;
};
const database = () =>
  openDB("chainageiq-field", 1, {
    upgrade(db) {
      db.createObjectStore("drafts", { keyPath: "id" });
    },
  });
export async function saveDraft(draft: Draft) {
  const db = await database();
  await db.put("drafts", draft);
}
export async function listDrafts(userId: string): Promise<Draft[]> {
  const db = await database();
  return (await db.getAll("drafts")).filter((d: Draft) => d.userId === userId);
}
export async function deleteDraft(id: string) {
  const db = await database();
  await db.delete("drafts", id);
}
export async function syncDrafts(userId: string) {
  const drafts = await listDrafts(userId);
  for (const draft of drafts) {
    try {
      const response = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft.payload, id: draft.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Sync failed");
      await deleteDraft(draft.id);
    } catch (error) {
      await saveDraft({
        ...draft,
        error: error instanceof Error ? error.message : "Sync failed",
      });
    }
  }
  return listDrafts(userId);
}
