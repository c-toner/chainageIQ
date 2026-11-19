import { NextResponse } from "next/server";
import { supabase } from "./supabase/server";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function context(request: Request, write = false) {
  if (write && request.headers.get("origin") !== new URL(request.url).origin)
    throw new HttpError(403, "Same-origin request required.");
  const db = await supabase();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new HttpError(401, "Please sign in.");
  if (write) {
    const { data, error } = await db.rpc("consume_rate_limit");
    if (error || !data)
      throw new HttpError(429, "Too many requests. Try again in a minute.");
  }
  return { db, user };
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  console.error(
    JSON.stringify({
      event: "api_error",
      message: error instanceof Error ? error.message : "unknown",
    }),
  );
  return NextResponse.json(
    {
      error:
        "Request could not be completed. Please retry or contact your administrator.",
    },
    { status: 500 },
  );
}
export function dbError(error: { message: string; code?: string } | null) {
  if (error) {
    const status =
      error.code === "40001" ? 409 : error.code === "42501" ? 403 : 400;
    throw new HttpError(
      status,
      error.code === "40001"
        ? "This record changed. Reload before applying your changes."
        : error.code === "42501"
          ? "You do not have permission for this action."
          : error.message,
    );
  }
}
