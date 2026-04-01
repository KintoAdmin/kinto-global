// @ts-nocheck
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonOk(data: unknown, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

function normalizeErrorPayload(error: unknown) {
  if (error instanceof Error) {
    return { error: error.message };
  }

  if (error && typeof error === "object") {
    const anyErr = error as Record<string, unknown>;
    const message = typeof anyErr.message === "string" && anyErr.message.trim()
      ? anyErr.message
      : typeof anyErr.error === "string" && anyErr.error.trim()
        ? anyErr.error
        : "Unexpected server error";

    return {
      error: message,
      code: typeof anyErr.code === "string" ? anyErr.code : undefined,
      details: typeof anyErr.details === "string" ? anyErr.details : undefined,
      hint: typeof anyErr.hint === "string" ? anyErr.hint : undefined,
    };
  }

  return { error: "Unexpected server error" };
}

export function jsonError(error: unknown, status = 500) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: "Validation failed",
        details: error.flatten()
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: false, ...normalizeErrorPayload(error) }, { status });
}

export async function parseJson<T = unknown>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Request content-type must be application/json");
  }
  return (await request.json()) as T;
}
