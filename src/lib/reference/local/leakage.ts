import { readFileSync } from "node:fs";
import { dataPath } from "@/lib/utils/files";
import { loadCsvRows } from "@/lib/utils/csv";
import type { LeakCoreDefinition, LeakCoreState, LeakState } from "@/lib/types/domain";

const METRIC_DEFAULT_MAP: Record<string, string> = {
  "Qualified Lead Volume Leakage": "Qualified Lead Volume Leakage",
  "Qualified Lead-to-Win Conversion Leakage": "Qualified Lead-to-Win Conversion Leakage",
  "Average Deal Size Leakage": "Average Deal Size Leakage",
  "Pricing / Discount Leakage": "Pricing / Discount Leakage tolerance",
  "Unbilled / Uninvoiced Revenue Leakage": "Unbilled / Uninvoiced Revenue Leakage tolerance",
  "Billing Error / Credit Note Leakage": "Billing Error / Credit Note Leakage tolerance",
  "Revenue Churn Leakage": "Revenue Churn Leakage",
  "Expansion Revenue Gap": "Expansion Revenue Gap",
  "Bad Debt / Collections Leakage": "Bad Debt / Collections Leakage tolerance"
};


const PROFILE_ALIASES: Record<string, string> = {
  balanced_growth: 'Professional Services SME',
  professional_services: 'Professional Services SME',
  professional_services_sme: 'Professional Services SME',
  managed_services: 'Managed Services SME',
  managed_services_sme: 'Managed Services SME',
  manufacturing: 'Manufacturing SME',
  manufacturing_sme: 'Manufacturing SME',
  trade_distribution: 'Trade / Distribution SME',
  trade_distribution_sme: 'Trade / Distribution SME',
  wholesale_distribution: 'Trade / Distribution SME',
};

function slugify(value: string | undefined | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function fallbackValueFromUnit(unit: string, name: string) {
  const unitText = slugify(unit);
  const nameText = slugify(name);
  if (nameText.includes('deal_size') || nameText.includes('revenue') || nameText.includes('credit_note') || nameText.includes('unbilled') || nameText.includes('bad_debt')) return 100;
  if (nameText.includes('qualified_lead_volume')) return 50;
  if (unitText.includes('day')) return nameText.includes('dso') ? 45 : 7;
  if (unitText.includes('currency')) return 100;
  if (unitText.includes('count') || unitText.includes('volume')) return 50;
  if (unitText.includes('score')) return 80;
  if (unitText.includes('percent') || unitText.includes('%')) return 80;
  return 80;
}

export function parseDefaultValue(raw: string | undefined | null): number {
  if (raw == null) return 0;
  const value = String(raw).trim();
  if (!value || value.toLowerCase().startsWith("no fixed") || value.toLowerCase().startsWith("no universal")) {
    return 0;
  }
  if (value.includes("-")) {
    const parts = value
      .split("-")
      .map((part) => Number(part.trim().replace(/[%+]/g, "")))
      .filter((part) => Number.isFinite(part));
    if (parts.length) return parts.reduce((sum, part) => sum + part, 0) / parts.length;
  }
  const parsed = Number(value.replace(/[%+]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function loadLeakageModel(): { cores: LeakCoreDefinition[] } {
  return JSON.parse(readFileSync(dataPath("model.json"), "utf8")) as { cores: LeakCoreDefinition[] };
}

export function loadBenchmarkLibrary() {
  return loadCsvRows(dataPath("master_benchmark_library_v1.csv"), ["profile,"]);
}

export function availableProfiles(rows: Record<string, string>[]): string[] {
  return [...new Set(rows.map((row) => row.Profile).filter(Boolean))].sort();
}

export function profileDefaults(rows: Record<string, string>[], profile: string) {
  const selected = rows.filter((row) => row.Profile === profile);
  const metricDefaults: Record<string, Record<string, string | number>> = {};
  const driverDefaults: Record<string, Record<string, string | number>> = {};

  for (const row of selected) {
    const name = row["Metric/Driver"] || "";
    const value = parseDefaultValue(row["Default Value"] || "");
    const payload = {
      value: value || fallbackValueFromUnit(row.Unit || '', name),
      raw_value: row["Default Value"] || '',
      unit: row.Unit || "",
      type: row.Type || "",
      confidence: row.Confidence || "",
      notes: row.Notes || "",
      source: row.Source || ""
    };
    if (Object.values(METRIC_DEFAULT_MAP).includes(name)) metricDefaults[name] = payload;
    else driverDefaults[name] = payload;
  }

  return { metrics: metricDefaults, drivers: driverDefaults };
}


export function resolveBenchmarkProfileName(profileName: string | undefined | null) {
  const requested = String(profileName || '').trim();
  const rows = loadBenchmarkLibrary();
  const profiles = availableProfiles(rows);
  if (!profiles.length) return requested;
  if (!requested) return profiles[0];

  const exact = profiles.find((profile) => profile === requested);
  if (exact) return exact;

  const requestedSlug = slugify(requested);
  const aliasTarget = PROFILE_ALIASES[requestedSlug];
  if (aliasTarget && profiles.includes(aliasTarget)) return aliasTarget;

  const normalized = profiles.find((profile) => slugify(profile) === requestedSlug);
  if (normalized) return normalized;

  return profiles[0];
}

export function createBlankLeakageState(profile: Record<string, string> = {}): LeakState {
  const model = loadLeakageModel();
  const cores: Record<string, LeakCoreState> = {};

  for (const core of model.cores) {
    let support: Record<string, number> = {};
    if (core.name === "Qualified Lead Volume Leakage") {
      support = { "Target Qualified Lead-to-Win %": 0, "Target Average Deal Size": 0 };
    } else if (core.name === "Qualified Lead-to-Win Conversion Leakage") {
      support = { "Actual Qualified Leads": 0, "Target Average Deal Size": 0 };
    } else if (core.name === "Average Deal Size Leakage") {
      support = { "Actual Qualified Leads": 0, "Actual Qualified Lead-to-Win %": 0 };
    }

    cores[core.name] = {
      actual: 0,
      benchmark: 0,
      support,
      drivers: Object.fromEntries(
        core.drivers.map((driver) => [driver.name, { actual: 0, benchmark: 0 }])
      )
    };
  }

  return {
    profile: {
      "Client Name": profile["Client Name"] || "Blank Template",
      Industry: profile.Industry || "",
      "Company Size": profile["Company Size"] || "",
      "Business Model": profile["Business Model"] || "",
      "Revenue Model": profile["Revenue Model"] || "",
      "Assessment Period": profile["Assessment Period"] || "",
      Currency: profile.Currency || "ZAR",
      Notes: profile.Notes || ""
    },
    cores,
    benchmarkProfile: profile["Benchmark Profile"] || ""
  };
}

export function applyBenchmarkProfile(state: LeakState, profileName: string): LeakState {
  const rows = loadBenchmarkLibrary();
  const resolvedProfile = resolveBenchmarkProfileName(profileName);
  const defaults = profileDefaults(rows, resolvedProfile);
  const model = loadLeakageModel();
  const next: LeakState = structuredClone(state);
  next.benchmarkProfile = resolvedProfile;
  next.profile["Benchmark Profile"] = resolvedProfile;

  for (const core of model.cores) {
    const coreName = core.name;
    const metricKey = METRIC_DEFAULT_MAP[coreName];
    const coreState = next.cores[coreName];
    if (!coreState) continue;

    if (metricKey && defaults.metrics[metricKey]) {
      const defaultValue = Number(defaults.metrics[metricKey].value || 0);
      if (coreName === "Qualified Lead-to-Win Conversion Leakage") {
        coreState.benchmark = defaultValue / 100;
      } else if (
        [
          "Pricing / Discount Leakage",
          "Unbilled / Uninvoiced Revenue Leakage",
          "Billing Error / Credit Note Leakage",
          "Bad Debt / Collections Leakage"
        ].includes(coreName)
      ) {
        if (!coreState.benchmark) coreState.benchmark = defaultValue;
      } else {
        coreState.benchmark = defaultValue;
      }
    }

    if (coreName === "Qualified Lead Volume Leakage") {
      if (defaults.metrics["Qualified Lead-to-Win Conversion Leakage"]) {
        coreState.support["Target Qualified Lead-to-Win %"] =
          Number(defaults.metrics["Qualified Lead-to-Win Conversion Leakage"].value || 0) / 100;
      }
      if (defaults.metrics["Average Deal Size Leakage"]) {
        coreState.support["Target Average Deal Size"] = Number(defaults.metrics["Average Deal Size Leakage"].value || 0);
      }
    } else if (coreName === "Qualified Lead-to-Win Conversion Leakage") {
      if (defaults.metrics["Average Deal Size Leakage"]) {
        coreState.support["Target Average Deal Size"] = Number(defaults.metrics["Average Deal Size Leakage"].value || 0);
      }
    }

    for (const driver of core.drivers) {
      const driverState = coreState.drivers[driver.name];
      const defaultDriver = defaults.drivers[driver.name];
      if (driverState && defaultDriver && Number(defaultDriver.value || 0) !== 0) {
        driverState.benchmark = Number(defaultDriver.value || 0);
      }
    }
  }

  return next;
}
