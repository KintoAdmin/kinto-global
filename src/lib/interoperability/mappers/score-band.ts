// @ts-nocheck
import type { Band, DirectionType, ExecutionStatus, Priority, Timeline, UnitType } from "@/lib/interoperability/enums";

export function normalizeBand(value: unknown): Band | null {
  const input = String(value ?? "").trim().toLowerCase();
  if (!input) return null;
  if (input.includes("strong")) return "strong";
  if (input.includes("managed")) return "managed";
  if (input.includes("developing")) return "developing";
  if (input.includes("weak")) return "weak";
  if (input.includes("critical / weak")) return "weak";
  return null;
}

export function bandFromPercent(percent: number | null | undefined): Band | null {
  if (percent == null || !Number.isFinite(percent)) return null;
  if (percent >= 80) return "strong";
  if (percent >= 60) return "managed";
  if (percent >= 40) return "developing";
  return "weak";
}

export function normalizePriority(value: unknown): Priority {
  const input = String(value ?? "").trim().toLowerCase();
  if (input.includes("critical") || input == "p1") return "critical";
  if (input.includes("high")) return "high";
  if (input.includes("low")) return "low";
  return "medium";
}

export function normalizeTimeline(value: unknown): Timeline | null {
  const input = String(value ?? "").trim().toLowerCase();
  if (!input) return null;
  if (input.includes("immediate") || input == "p1" || input.includes("stabilise")) return "immediate";
  if (input.includes("0-30") || input.includes("0_30") || input.includes("30 days")) return "0_30_days";
  if (input.includes("30-60") || input.includes("30_60")) return "30_60_days";
  if (input.includes("60-90") || input.includes("60_90")) return "60_90_days";
  if (input.includes("90+") || input.includes("later") || input.includes("backlog") || input.includes("optimize") || input.includes("phase 3") || input == "p3") return "90_plus_days";
  if (input.includes("phase 2") || input == "p2" || input.includes("standardise")) return "30_60_days";
  return "90_plus_days";
}

export function normalizeExecutionStatus(value: unknown): ExecutionStatus {
  const input = String(value ?? "").trim().toLowerCase();
  if (input.includes("complete")) return "complete";
  if (input.includes("hold")) return "on_hold";
  if (input.includes("block")) return "blocked";
  if (input.includes("progress") || input.includes("ready")) return "in_progress";
  return "not_started";
}

export function normalizeUnit(value: unknown): UnitType {
  const input = String(value ?? "").trim().toLowerCase();
  if (!input) return "text";
  if (input === "%" || input.includes("percent")) return "percent";
  if (input.includes("day")) return "days";
  if (input.includes("hour")) return "hours";
  if (input.includes("ratio")) return "ratio";
  if (input.includes("score")) return "score";
  if (input.includes("count") || input.includes("volume") || input.includes("number")) return "count";
  if (input.includes("r") || input.includes("zar") || input.includes("currency") || input.includes("revenue") || input.includes("price") || input.includes("deal")) return "currency";
  return "text";
}

export function normalizeDirection(value: unknown): DirectionType {
  const input = String(value ?? "").trim().toLowerCase();
  if (!input) return "informational";
  if (input.includes("higher")) return "higher_is_better";
  if (input.includes("lower")) return "lower_is_better";
  if (input.includes("range")) return "target_range";
  return "informational";
}
