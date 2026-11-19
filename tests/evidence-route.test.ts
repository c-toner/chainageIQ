import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  sign: vi.fn(),
  query: vi.fn(),
}));
vi.mock("@/lib/http", () => ({
  context: mocks.context,
  dbError: (error: unknown) => {
    if (error) throw error;
  },
  failure: () => new Response("error", { status: 500 }),
  HttpError: class extends Error {},
}));
import { GET } from "@/app/api/evidence/route";
beforeEach(() => {
  vi.clearAllMocks();
});
it("lists evidence by issue without trying to sign quarantined objects", async () => {
  const rows = [
    { id: "evidence", filename: "photo.jpg", scan_status: "quarantined" },
  ];
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
  };
  mocks.context.mockResolvedValue({
    db: {
      from: () => chain,
      storage: { from: () => ({ createSignedUrl: mocks.sign }) },
    },
  });
  const response = await GET(
    new Request(
      "http://localhost/api/evidence?issue=11111111-1111-4111-8111-111111111111",
    ),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(rows);
  expect(mocks.sign).not.toHaveBeenCalled();
  expect(chain.eq).toHaveBeenCalledWith(
    "issue_id",
    "11111111-1111-4111-8111-111111111111",
  );
});
