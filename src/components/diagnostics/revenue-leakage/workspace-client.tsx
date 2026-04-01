// @ts-nocheck
'use client';
import { ModuleIntro } from '@/components/onboarding/module-intro';

import { useEffect, useMemo, useState, useTransition } from 'react';

const SUPPORT_DESCRIPTIONS: Record<string, string> = {
  'Benchmark Qualified Lead-to-Win %': 'The target percentage of qualified leads that should become won deals.',
  'Benchmark Average Deal Size': 'The target average value you expect each won deal to achieve.',
  'Actual Qualified Leads': 'The actual number of sales-ready leads the business generated.',
  'Actual Qualified Lead-to-Win %': 'The actual percentage of qualified leads that turned into won deals.',
  'Lead-to-Opportunity Conversion': 'Share of leads that become qualified opportunities.',
  'Win Rate': 'Share of pipeline or opportunities that convert into won revenue.',
  'Average Deal Size': 'Average revenue value per closed-won deal.',
  Leads: 'Total lead volume feeding the conversion calculation.',
  'Pipeline Value': 'Revenue value currently sitting in qualified pipeline.',
  'Closed Deals': 'Number of won deals used to monetize deal size gaps.',
  'Recognized Revenue': 'Revenue base used to quantify velocity drag.',
  'New Customers': 'Number of new customers acquired in the period.',
  'Average Revenue per Customer': 'Average revenue value per retained or lost customer.',
  'Existing Customer Revenue Base': 'Installed-base revenue used to quantify expansion gaps.',
  'New Customers Acquired': 'Newly won customers used in LTV monetization.',
};

const DRIVER_DESCRIPTIONS: Record<string, string> = {
  'Channel Reach': 'Audience exposure across active marketing channels.',
  'Inquiry-to-Lead Rate': 'Share of inbound inquiries converted into usable leads.',
  'Campaign Response Rate': 'Response yield from campaigns and outbound activity.',
  'Lead Source Mix': 'Quality balance of lead sources contributing to the funnel.',
  'Marketing Spend Efficiency': 'Commercial yield achieved from marketing spend.',
  'Lead Quality': 'How well incoming leads match the target buyer profile.',
  'Qualification Discipline': 'Consistency of qualification against agreed criteria.',
  'Speed-to-Lead': 'Response time from inbound signal to first follow-up.',
  'SDR Follow-Up Compliance': 'Adherence to required outreach and follow-up cadence.',
  'Lead Routing Accuracy': 'How accurately leads are assigned to the right owner.',
  'New Opportunity Creation Rate': 'Rate at which fresh pipeline is being created.',
  'Opportunity Aging': 'How long opportunities remain open before progressing.',
  'Stage Progression Quality': 'Whether stage movement reflects real buyer progression.',
  'Lead-to-Opportunity Conversion': 'Share of leads turning into opportunities.',
  'Opportunity Reactivation Rate': 'Recovery rate on stalled but salvageable opportunities.',
  'Proposal Acceptance': 'Share of proposals accepted or progressed.',
  'Opportunity Qualification Quality': 'Strength of deal qualification before pursuit.',
  'Competitive Loss Rate': 'Share of deals lost to competitors.',
  'Sales Cycle Control': 'How well the team keeps deals moving to close.',
  'Decision-Maker Access': 'Access to the economic buyer and key stakeholders.',
  'Pricing Discipline': 'Consistency of pricing against intended standards.',
  'Packaging Quality': 'How well offers are bundled and positioned for value.',
  'Cross-Sell / Upsell Attach Rate': 'Rate of add-on value attached to deals.',
  'Discount Control': 'Discipline in approving and controlling discounts.',
  'Contract Term Length': 'Commercial term length supporting larger contract value.',
  'Stage Aging': 'Time spent by deals in each stage.',
  'Approval Turnaround Time': 'Internal approval speed affecting cycle time.',
  'Proposal Turnaround Time': 'Speed from request to proposal delivery.',
  'Follow-Up Compliance': 'Consistency of required sales follow-up actions.',
  'Decision Latency': 'Delay on customer-side decisions within active deals.',
  'Cost per Lead': 'Average cost to generate one lead.',
  'Cost per Qualified Lead': 'Average cost to generate one qualified lead.',
  'Lead-to-Customer Conversion': 'Share of leads that convert into customers.',
  'Channel Mix Efficiency': 'Relative efficiency of channels driving acquisition.',
  'Sales Productivity': 'Revenue output or close efficiency per seller.',
  'Customer Health Score': 'Overall health and risk score of the customer base.',
  'Product / Service Adoption': 'Depth of usage and value realization post-sale.',
  'Save Rate': 'Share of at-risk customers successfully retained.',
  'Support Resolution Performance': 'Effectiveness and speed of support resolution.',
  'Renewal Engagement': 'Quality and timeliness of renewal conversations.',
  'Account Penetration Rate': 'Degree of product or service penetration within accounts.',
  'Cross-Sell / Upsell Conversion': 'Share of expansion opportunities converted.',
  'Customer Value Realization': 'Whether customers are achieving intended business value.',
  'Success Plan Coverage': 'Extent of accounts with active success plans.',
  'Renewal-to-Expansion Handoff': 'Quality of handoff from renewal into growth motion.',
  'Customer Retention': 'Ability to retain customers over time.',
  'Gross Margin / Delivery Efficiency': 'Value captured after cost to serve or deliver.',
  'Expansion Rate': 'Rate at which existing customer value grows.',
  'Payback Period': 'Time required to recover acquisition cost.',
  'Average Revenue per Customer': 'Average revenue generated per customer.',
  'Lead Source Quality': 'How good the lead sources are at bringing in the right kind of buyers.',
  'Qualified Lead Rate': 'How many incoming enquiries are genuinely good enough to be treated as qualified leads.',
  'Response Speed': 'How quickly your team replies after a potential customer asks about your product or service.',
  'Follow-Up Discipline': 'How consistently your team follows up with potential customers until a clear outcome is reached.',
  'Marketing Reach': 'How many relevant potential buyers your marketing is actually reaching.',
  'Sales Follow-Up Quality': 'How well sales follow-up is done after a lead becomes worth pursuing.',
  'Pricing Competitiveness': 'How attractive and commercially sensible your prices are compared with alternatives in the market.',
  'Pipeline Coverage': 'Pipeline available relative to target needs.',
  'Retention / Churn': 'Existing customer revenue protection performance.',
  'Expansion / NRR': 'Growth performance across the installed base.',
};

type DriverRow = {
  name: string;
  direction: string;
  actual: number;
  benchmark: number;
  within: boolean;
};

type CoreRow = {
  name: string;
  category: string;
  actual_label: string;
  benchmark_label: string;
  actual: number;
  benchmark: number;
  leakage: number;
  severity: string;
  status: string;
  driver_score: number;
  drivers_within: number;
  drivers_total: number;
  driver_rows: DriverRow[];
  formula: string;
  advisory: Record<string, string>;
  support: Record<string, number>;
};

type LeakState = {
  profile: Record<string, string>;
  cores: Record<string, { actual: number; benchmark: number; support: Record<string, number>; drivers: Record<string, { actual: number; benchmark: number }> }>;
  benchmarkProfile?: string;
};

type Payload = {
  assessmentId: string;
  model: { cores: Array<{ name: string; drivers: Array<{ name: string; direction: string }> }> };
  benchmarkProfiles: string[];
  state: LeakState;
  summary: {
    total_leakage: number;
    core_rows: CoreRow[];
    headline: {
      total_revenue_leakage: number;
      revenue_gap: number;
      driver_target_achievement_pct: number;
      top_3_leakage_areas: string[];
    };
    commercial: Record<string, number>;
    operational: Record<string, number>;
  };
  moduleScore: Record<string, unknown> | null;
  findings: Array<Record<string, any>>;
  roadmap: Array<Record<string, any>>;
};

function formatGeneratedAt(value?: string | null) {
  if (!value) return 'Not generated yet';
  try { return new Date(value).toLocaleString(); } catch { return String(value); }
}

function artifactDownloadLink(artifact: any) {
  return `/api/reports/artifacts/${encodeURIComponent(artifact.artifact_id)}`;
}

function artifactByType(artifacts: any[], fileType: string) {
  return (artifacts || []).find((a: any) => a.file_type === fileType);
}

// ── Currency formatting ──────────────────────────────────────────────────────
const CURRENCY_LOCALES: Record<string, string> = {
  ZAR: 'en-ZA', USD: 'en-US', AED: 'en-AE', GBP: 'en-GB', EUR: 'de-DE',
};
const CURRENCY_SYMBOLS: Record<string, string> = {
  ZAR: 'R\u00a0', USD: '$', AED: 'AED\u00a0', GBP: '£', EUR: '€',
};
function currency(value: number, currencyCode = 'ZAR') {
  const locale = CURRENCY_LOCALES[currencyCode] ?? 'en-ZA';
  const abs = Math.abs(Number(value || 0));
  const formatted = new Intl.NumberFormat(locale, {
    style: 'decimal', maximumFractionDigits: 0, minimumFractionDigits: 0,
  }).format(abs);
  const sym = CURRENCY_SYMBOLS[currencyCode] ?? (currencyCode + '\u00a0');
  return (Number(value) < 0 ? '-' : '') + sym + formatted;
}

// ── SmartLeakField — intelligent number input for LEAK ───────────────────────
// Detects field type (% vs currency/count) from the field name.
// % fields: user types "30" → stored as 30, displayed "30  %"
// Currency fields: user types "1250000" → displayed "1 250 000"
function fieldIsPercent(fieldName: string): boolean {
  const n = (fieldName || '').toLowerCase();
  return n.includes('%') || n.includes(' rate') || n.includes('ratio')
    || n.includes('conversion') || n.includes('compliance')
    || n.includes('win rate') || n.includes('churn') || n.includes('retention')
    || n.includes('penetration') || n.includes('efficiency') || n.includes('adoption');
}
function fmtDisplay(value: number, isPercent: boolean): string {
  if (!value && value !== 0) return '';
  if (value === 0) return '';
  if (isPercent) return String(value % 1 === 0 ? value : +value.toFixed(4));
  return value.toLocaleString('en-ZA', { maximumFractionDigits: 0 });
}
function parseRaw(raw: string): number {
  const cleaned = raw.replace(/[\s,\u00a0R$£€]/g, '').replace('%', '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function SmartLeakField({
  value, fieldName, onCommit,
}: { value: number; fieldName?: string; onCommit: (v: number) => void }) {
  const isPercent = fieldIsPercent(fieldName ?? '');
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  useEffect(() => {
    if (!focused) setDraft(fmtDisplay(value, isPercent));
  }, [value, focused, isPercent]);
  const display = focused ? draft : fmtDisplay(value, isPercent);
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        type="text" inputMode="decimal"
        className="kinto-input"
        value={display}
        placeholder={isPercent ? '0' : '0'}
        style={{ textAlign: 'right', paddingRight: isPercent ? '1.75rem' : '0.6rem', width: '100%', minWidth: 90 }}
        onChange={e => setDraft(e.target.value)}
        onFocus={() => { setFocused(true); setDraft(value ? String(value % 1 === 0 ? value : +value.toFixed(4)) : ''); }}
        onBlur={() => { setFocused(false); const p = parseRaw(draft); setDraft(fmtDisplay(p, isPercent)); onCommit(p); }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      />
      {isPercent && (
        <span style={{ position: 'absolute', right: '0.5rem', fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600, pointerEvents: 'none' }}>%</span>
      )}
    </div>
  );
}

function num(value: number) {
  return Number(value || 0).toLocaleString('en-ZA', { maximumFractionDigits: 2 });
}

function severityClass(value: string) {
  const upper = String(value || '').toUpperCase();
  if (upper === 'HIGH' || upper === 'CRITICAL') return 'danger';
  if (upper === 'MEDIUM' || upper === 'LOW' || upper === 'DEVELOPING') return 'warn';
  return 'success';
}

function colorSeverity(value: string) {
  const upper = String(value || '').toUpperCase();
  if (upper === 'HIGH' || upper === 'MEDIUM' || upper === 'CRITICAL') return 'var(--danger)';
  if (upper === 'LOW' || upper === 'DEVELOPING') return 'var(--warn)';
  return 'var(--success)';
}

function supportDesc(name: string) {
  return SUPPORT_DESCRIPTIONS[name] || 'Supporting input used in the leakage calculation.';
}

function driverDesc(name: string) {
  return DRIVER_DESCRIPTIONS[name] || 'Key revenue driver influencing the core metric.';
}

function explainLeakage(core: CoreRow) {
  switch (core.name) {
    case 'Qualified Lead Volume Leakage':
      return 'This shows the revenue effect of having fewer qualified leads than needed. The gap in qualified leads is valued using the target conversion rate and the target average deal size.';
    case 'Qualified Lead-to-Win Conversion Leakage':
      return 'This shows the revenue effect of too few qualified leads turning into won deals. It compares actual conversion against the target conversion rate and values that gap using the target average deal size.';
    case 'Average Deal Size Leakage':
      return 'This shows the revenue effect of winning deals at a lower average value than planned.';
    case 'Pricing / Discount Leakage':
      return 'This shows revenue given away through discounting or pricing below the allowed level.';
    case 'Unbilled / Uninvoiced Revenue Leakage':
      return 'This shows revenue already earned but not yet invoiced.';
    case 'Billing Error / Credit Note Leakage':
      return 'This shows revenue lost through invoice errors, disputes, reversals, or credit notes.';
    case 'Revenue Churn Leakage':
      return 'This shows revenue lost because existing customers stopped buying or reduced spend.';
    case 'Expansion Revenue Gap':
      return 'This shows how much expected revenue growth from existing customers did not happen.';
    case 'Bad Debt / Collections Leakage':
      return 'This shows billed revenue that is now unlikely to be collected.';
    default:
      return 'This explains how the current revenue leakage figure is being produced.';
  }
}

function explainInputs(core: CoreRow) {
  const support = core.support || {};
  switch (core.name) {
    case 'Qualified Lead Volume Leakage':
      return [
        `Actual Qualified Leads: ${num(core.actual)}`,
        `Target Qualified Leads: ${num(core.benchmark)}`,
        `Target Qualified Lead-to-Win %: ${num(support['Target Qualified Lead-to-Win %'] || 0)}`,
        `Target Average Deal Size: ${num(support['Target Average Deal Size'] || 0)}`,
      ];
    case 'Qualified Lead-to-Win Conversion Leakage':
      return [
        `Actual Qualified Lead-to-Win %: ${num(core.actual)}`,
        `Target Qualified Lead-to-Win %: ${num(core.benchmark)}`,
        `Actual Qualified Leads: ${num(support['Actual Qualified Leads'] || 0)}`,
        `Target Average Deal Size: ${num(support['Target Average Deal Size'] || 0)}`,
      ];
    case 'Average Deal Size Leakage':
      return [
        `Actual Average Deal Size: ${num(core.actual)}`,
        `Target Average Deal Size: ${num(core.benchmark)}`,
        `Actual Qualified Leads: ${num(support['Actual Qualified Leads'] || 0)}`,
        `Actual Qualified Lead-to-Win %: ${num(support['Actual Qualified Lead-to-Win %'] || 0)}`,
      ];
    default:
      return [
        `${core.actual_label}: ${num(core.actual)}`,
        `${core.benchmark_label}: ${num(core.benchmark)}`,
      ];
  }
}

// InlineNumberField kept as thin alias so call sites below don't need renaming
function InlineNumberField({ value, fieldName, onCommit }: { value: number; fieldName?: string; onCommit: (v: number) => void }) {
  return <SmartLeakField value={value} fieldName={fieldName} onCommit={onCommit} />;
}

type Props = {
  assessmentId?: string;
  view?: 'assessment' | 'executive' | 'metrics' | 'report' | 'advisory';
};

function withAssessment(routePath: string, assessmentId?: string) {
  if (!assessmentId) return routePath;
  const join = routePath.includes('?') ? "&" : "?";
  return `${routePath}${join}assessmentId=${encodeURIComponent(assessmentId)}`;
}

export function RevenueLeakageWorkspaceClient({ assessmentId, view }: Props) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'assessment' | 'executive' | 'metrics' | 'report' | 'advisory'>('assessment');
  const [error, setError] = useState<string | null>(null);
  const [savingLabel, setSavingLabel] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState<string | null>(null);
  const [standaloneReport, setStandaloneReport] = useState<any | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function load() {
    setLoading(true);
    setError(null);
    setReportError(null);
    try {
      const [response, reportResponse] = await Promise.all([
        fetch(withAssessment('/api/revenue-leakage', assessmentId), { cache: 'no-store' }),
        assessmentId ? fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/report/revenue_leakage`, { cache: 'no-store' }).catch(() => null) : Promise.resolve(null)
      ]);
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || 'Failed to load Revenue Leakage workspace.');
      }
      setData(payload.data || payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Revenue Leakage workspace.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [assessmentId]);

  function applyOptimistic(current: Payload, body: Record<string, unknown>): Payload {
    const action = String(body.action || '');
    const next = JSON.parse(JSON.stringify(current)) as Payload;
    if (!next.state?.cores) return current;
    if (action === 'update-core') {
      const core = next.state.cores[String(body.coreName || '')];
      if (core) (core as any)[String(body.field || 'actual')] = Number(body.value || 0);
      return next;
    }
    if (action === 'update-support') {
      const core = next.state.cores[String(body.coreName || '')];
      if (core) {
        core.support = { ...(core.support || {}), [String(body.supportKey || '')]: Number(body.value || 0) };
      }
      return next;
    }
    if (action === 'update-driver') {
      const core = next.state.cores[String(body.coreName || '')];
      if (core) {
        const driverName = String(body.driverName || '');
        const field = String(body.field || 'actual');
        const existing = (core.drivers || {})[driverName] || { actual: 0, benchmark: 0 };
        core.drivers = { ...(core.drivers || {}), [driverName]: { ...existing, [field]: Number(body.value || 0) } };
      }
      return next;
    }
    if (action === 'update-profile' && body.profile && typeof body.profile === 'object') {
      next.state.profile = { ...(next.state.profile || {}), ...(body.profile as Record<string, string>) };
      return next;
    }
    return current;
  }


  async function generateStandaloneReport() {
    try {
      if (!assessmentId) {
        setReportError('Select or create an assessment first.');
        return;
      }
      setReportBusy('Generating Revenue Leakage report');
      setReportError(null);
      const response = await fetch(`/api/assessments/${encodeURIComponent(assessmentId)}/report/revenue_leakage`, { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || (payload as any)?.ok === false || (payload as any)?.error) {
        throw new Error((payload as any)?.error || 'Failed to generate Revenue Leakage report.');
      }
      setStandaloneReport((payload as any)?.data || payload || null);
      await load();
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to generate Revenue Leakage report.');
    } finally {
      setReportBusy(null);
    }
  }

  async function commit(body: Record<string, unknown>, label: string) {
    const previous = data;
    setSavingLabel(label);
    setError(null);
    if (previous) setData(applyOptimistic(previous, body));
    try {
      const response = await fetch(withAssessment('/api/revenue-leakage', assessmentId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentId, ...body }),
      });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || 'Failed to save Revenue Leakage change.');
      }
      setData(payload.data || payload);
    } catch (err) {
      if (previous) setData(previous);
      setError(err instanceof Error ? err.message : 'Failed to save Revenue Leakage change.');
    } finally {
      startTransition(() => {
        setSavingLabel(null);
      });
    }
  }

  const activeView = view || activeTab;

  const totalDrivers = useMemo(
    () => (data?.summary.core_rows || []).reduce((sum, core) => sum + Number(core.drivers_total || 0), 0),
    [data],
  );
  const totalWithin = useMemo(
    () => (data?.summary.core_rows || []).reduce((sum, core) => sum + Number(core.drivers_within || 0), 0),
    [data],
  );

  if (loading) {
    return (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--muted)', padding: '1rem 0' }}>
          <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--brand)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
          Loading Revenue Leakage workspace…
          <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="card">
        <p style={{ color: 'var(--danger)', marginBottom: '0.75rem' }}>{error}</p>
        <button className="btn btn-secondary" onClick={() => void load()}>Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const standaloneArtifacts = standaloneReport?.artifacts || [];
  const standaloneDocx = standaloneArtifacts.find((a: any) => a.file_type === 'docx');
  const standalonePptx = standaloneArtifacts.find((a: any) => a.file_type === 'pptx');

  const currencyCode = data.state.profile.Currency || 'ZAR';
  const groupedRoadmap = data.roadmap.reduce<Record<string, Array<Record<string, any>>>>((acc, item) => {
    (acc[String(item.phase_code || 'P2')] ||= []).push(item);
    return acc;
  }, {});
  const groupedRoadmapEntries = Object.entries(groupedRoadmap) as Array<[string, Array<Record<string, any>>]>;
  const weakCores = [...data.summary.core_rows]
    .filter((core) => core.leakage > 0 || core.driver_score < 80)
    .sort((a, b) => b.leakage - a.leakage || a.driver_score - b.driver_score);

  const metricCards = [
    { title: 'Overall Leakage Protection Score', value: `${Math.round(Number(data.moduleScore?.score_pct || 0))}%`, note: 'Shared-runtime module score aligned to the current leakage engine.' },
    { title: 'Estimated Leakage Exposure', value: currency(data.summary.total_leakage, currencyCode), note: 'Current engine estimate across all leakage cores.' },
    { title: 'Priority Findings', value: String(data.findings.filter((item) => item.is_priority).length), note: 'Critical or medium/high urgency leakage exposures.' },
    { title: 'Domains Complete', value: `${Number(data.moduleScore?.domains_completed || 0)}/${Number(data.moduleScore?.domains_total || 0)}`, note: 'Completion is driven from the shared runtime domain rows.' },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div className="view-tabs" style={{ flex: 1, borderBottom: 'none', marginBottom: 0 }}>
          {['assessment','executive','metrics','report','advisory'].map(t => (
            <button key={t} type="button" className={`view-tab${activeView === t ? ' active' : ''}`} onClick={() => setActiveTab(t as any)}>
              {t === 'assessment' ? 'Assessment' : t === 'executive' ? 'Executive Dashboard' : t === 'metrics' ? 'Metrics' : t === 'report' ? 'Report Preview' : 'Advisory Dashboard'}
            </button>
          ))}
        </div>
        {savingLabel && (
          <span className="saving-indicator">
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--brand)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
            {savingLabel}…
          </span>
        )}
        {error && <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{error}</span>}
      </div>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>

      {activeView === 'assessment' ? (
        <>
          <ModuleIntro moduleCode="LEAK" moduleName="Revenue Leakage" hasScores={Boolean(data?.state?.benchmarkProfile || Object.values(data?.state?.cores || {}).some((c: any) => Number(c.actual || 0) > 0))} />
          <div className="card">
            <div className="grid-3">
              {metricCards.map((card) => (
                <div key={card.title} className="metric-panel">
                  <span className="muted tiny">{card.title}</span>
                  <strong>{card.value}</strong>
                  <span className="muted small">{card.note}</span>
                </div>
              ))}
            </div>
          </div>

          {!data.state.benchmarkProfile && (
            <div style={{ padding: '0.85rem 1rem', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 'var(--radius)', marginBottom: '0' }}>
              <div style={{ fontWeight: 700, color: 'var(--warn)', marginBottom: '0.25rem' }}>⚠ Select a benchmark profile to activate the leakage engine</div>
              <p style={{ fontSize: '0.82rem', color: 'var(--warn)', margin: 0 }}>
                The revenue leakage calculation requires a benchmark profile. Choose one from the dropdown below — this sets the target benchmarks for all 9 leakage cores.
              </p>
            </div>
          )}
          <div className="card">
            <h3>Benchmark and profile</h3>
            <div className="grid-3">
              <label className="field-block">
                <span className="muted small">Benchmark Profile</span>
                <select
                  className="kinto-select"
                  value={data.state.benchmarkProfile || ''}
                  onChange={(event) => void commit({ action: 'set-benchmark-profile', profileName: event.target.value }, 'Benchmark profile')}
                >
                  <option value="">Select a benchmark profile</option>
                  {data.benchmarkProfiles.map((profile) => (
                    <option key={profile} value={profile}>{profile}</option>
                  ))}
                </select>
              </label>
              {(['Client Name', 'Industry', 'Company Size', 'Business Model', 'Revenue Model', 'Assessment Period', 'Notes'] as const).map((key) => (
                <label key={key} className="field-block">
                  <span className="muted small">{key}</span>
                  <input
                    className="kinto-input"
                    defaultValue={data.state.profile[key] || ''}
                    key={`${key}-${data.state.profile[key] || ''}`}
                    onBlur={(event) => {
                      const value = event.currentTarget.value;
                      if (value !== (data.state.profile[key] || '')) {
                        void commit({ action: 'update-profile', profile: { [key]: value } }, `Profile ${key}`);
                      }
                    }}
                  />
                </label>
              ))}
              <label className="field-block">
                <span className="muted small">Currency</span>
                <select
                  className="kinto-select"
                  value={data.state.profile['Currency'] || 'ZAR'}
                  onChange={(e) => void commit({ action: 'update-profile', profile: { Currency: e.target.value } }, 'Currency')}
                >
                  <option value="ZAR">ZAR — South African Rand (R)</option>
                  <option value="USD">USD — US Dollar ($)</option>
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="GBP">GBP — British Pound (£)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                </select>
              </label>
            </div>
          </div>

          <div className="card">
            <h3>Core Metrics Dashboard</h3>
            <div className="grid-3">
              <div className="metric-panel">
                <span className="muted tiny">Total Leakage</span>
                <strong style={{ color: 'var(--danger)' }}>{currency(data.summary.total_leakage, currencyCode)}</strong>
              </div>
              <div className="metric-panel">
                <span className="muted tiny">Driver Target Achievement</span>
                <strong>{Math.round(Number(data.summary.headline.driver_target_achievement_pct || 0))}%</strong>
              </div>
              <div className="metric-panel">
                <span className="muted tiny">Drivers Within Benchmark</span>
                <strong>{totalWithin}/{totalDrivers}</strong>
              </div>
            </div>
          </div>

          {(data.summary.core_rows || []).map((core) => {
            const failed = core.driver_rows.filter((driver) => !driver.within).slice(0, 3);
            return (
              <details key={core.name} className="card leakage-core" open>
                <summary className="leakage-core-summary">
                  <div>
                    <div className="core-title-row">
                      <h3>{core.name}</h3>
                      <span className={`module-chip ${severityClass(core.severity)}`}>{core.severity}</span>
                    </div>
                    <p className="muted small">
                      {core.drivers_within}/{core.drivers_total} drivers in benchmark · <strong>{Math.round(core.driver_score)}%</strong> driver target achievement
                    </p>
                  </div>
                  <div className="core-summary-grid">
                    <div>
                      <span className="muted tiny">Leakage</span>
                      <strong style={{ color: core.leakage > 0 ? 'var(--danger)' : 'var(--success)' }}>{currency(core.leakage, currencyCode)}</strong>
                    </div>
                    <div>
                      <span className="muted tiny">Status</span>
                      <strong>{core.status}</strong>
                    </div>
                    <div>
                      <span className="muted tiny">Actual / Benchmark</span>
                      <strong>{num(core.actual)} / {num(core.benchmark)}</strong>
                    </div>
                  </div>
                </summary>

                <div className="leakage-core-body">
                  <div className="grid-2">
                    <div>
                      <h4>What this result means</h4>
                      <p className="muted small">{explainLeakage(core)}</p>
                    </div>
                    <div>
                      <h4>Top drivers needing attention</h4>
                      {failed.length ? (
                        <ul className="compact-list">
                          {failed.map((driver) => (
                            <li key={driver.name}>{driver.name} ({num(driver.actual)} vs {num(driver.benchmark)})</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted small">All current drivers are within target.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4>Inputs used in this calculation</h4>
                    <ul className="compact-list">
                      {explainInputs(core).map((line) => <li key={line}>{line}</li>)}
                    </ul>
                  </div>

                  <div className="table-grid-header">
                    <span>Main Input</span>
                    <span>Actual</span>
                    <span>Benchmark</span>
                  </div>
                  <div className="table-grid-row">
                    <div>
                      <strong>{core.actual_label}</strong>
                      <p className="muted small">{core.benchmark_label}</p>
                    </div>
                    <InlineNumberField value={core.actual} fieldName={core.actual_label} onCommit={(value) => commit({ action: 'update-core', coreName: core.name, field: 'actual', value }, `${core.name} actual`)} />
                    <InlineNumberField value={core.benchmark} fieldName={core.benchmark_label} onCommit={(value) => commit({ action: 'update-core', coreName: core.name, field: 'benchmark', value }, `${core.name} benchmark`)} />
                  </div>

                  {Object.entries(core.support || {}).length ? (
                    <>
                      <div className="section-tag">Supporting Inputs</div>
                      <div className="table-grid-header table-grid-header-support">
                        <span>Supporting Input</span>
                        <span>Value</span>
                      </div>
                      {(Object.entries(core.support || {}) as Array<[string, number]>).map(([supportKey, supportValue]) => (
                        <div key={supportKey} className="table-grid-row table-grid-row-support">
                          <div>
                            <strong>{supportKey}</strong>
                            <p className="muted small">{supportDesc(supportKey)}</p>
                          </div>
                          <InlineNumberField value={supportValue} fieldName={supportKey} onCommit={(value) => commit({ action: 'update-support', coreName: core.name, supportKey, value }, `${core.name} ${supportKey}`)} />
                        </div>
                      ))}
                    </>
                  ) : null}

                  <div className="section-tag">Revenue Drivers</div>
                  <div className="table-grid-header drivers-grid">
                    <span>Revenue Driver</span>
                    <span>Actual</span>
                    <span>Benchmark</span>
                    <span>In Range</span>
                  </div>
                  {core.driver_rows.map((driver) => (
                    <div key={driver.name} className="table-grid-row drivers-grid">
                      <div>
                        <strong>{driver.name}</strong>
                        <p className="muted small">{driverDesc(driver.name)}</p>
                      </div>
                      <InlineNumberField value={driver.actual} fieldName={driver.name} onCommit={(value) => commit({ action: 'update-driver', coreName: core.name, driverName: driver.name, field: 'actual', value }, `${core.name} ${driver.name} actual`)} />
                      <InlineNumberField value={driver.benchmark} fieldName={driver.name} onCommit={(value) => commit({ action: 'update-driver', coreName: core.name, driverName: driver.name, field: 'benchmark', value }, `${core.name} ${driver.name} benchmark`)} />
                      <div className="driver-range" style={{ color: driver.within ? 'var(--success)' : 'var(--danger)' }}>
                        {driver.within ? 'Yes' : 'No'}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </>
      ) : null}


      {(activeView === 'executive' || activeView === 'advisory') ? (
        <div className="card">
          <div className="core-title-row">
            <div>
              <h3>Saved Revenue Leakage Report Status</h3>
              <p className="muted small">Track the persisted standalone leakage deliverable separately from the live assessment state.</p>
            </div>
            <button className="btn btn-secondary" type="button" onClick={() => void generateStandaloneReport()} disabled={!!reportBusy || !assessmentId}>
              {reportBusy ? 'Generating…' : 'Refresh Saved Report'}
            </button>
          </div>
          {standaloneReport?.report ? (
            <div className="grid-4">
              <div className="stat-card"><div className="stat-card-label">Status</div><strong>{standaloneReport.report.report_status}</strong></div>
              <div className="metric-panel compact"><span className="muted tiny">Generated</span><strong>{formatGeneratedAt(standaloneReport.report.generated_at)}</strong></div>
              <div className="metric-panel compact"><span className="muted tiny">Artifacts</span><strong>{standaloneArtifacts.length}</strong></div>
              <div className="metric-panel compact"><span className="muted tiny">Latest headline</span><strong>{standaloneReport?.payload?.executive_summary?.financial_impact || 'Saved'}</strong></div>
            </div>
          ) : <p className="muted">No standalone Revenue Leakage report has been generated yet.</p>}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
            {standaloneDocx ? <a className="btn btn-secondary btn-sm" href={artifactDownloadLink(standaloneDocx)}>Download DOCX</a> : <span className="muted">DOCX not generated yet</span>}
            {standalonePptx ? <a className="btn btn-secondary btn-sm" href={artifactDownloadLink(standalonePptx)}>Download PPTX</a> : <span className="muted">PPTX not generated yet</span>}
          </div>
          {standaloneReport?.report?.summary_text ? <p className="muted small" style={{ marginTop: '0.75rem' }}>{standaloneReport.report.summary_text}</p> : null}
        </div>
      ) : null}

      {activeView === 'executive' ? (
        <>
          <div className="card">
            <h3>Executive Dashboard</h3>
            <div className="grid-3">
              <div className="metric-panel">
                <span className="muted tiny">Leakage Protection Score</span>
                <strong>{Math.round(Number(data.moduleScore?.score_pct || 0))}%</strong>
                <span className="muted small">Control maturity protecting revenue, margin, and cash.</span>
              </div>
              <div className="metric-panel">
                <span className="muted tiny">Estimated Exposure</span>
                <strong>{currency(data.summary.total_leakage, currencyCode)}</strong>
                <span className="muted small">Engine-estimated leakage exposure from current inputs.</span>
              </div>
              <div className="metric-panel">
                <span className="muted tiny">Critical Findings</span>
                <strong>{data.findings.filter((item) => String(item.severity_band).toUpperCase() === 'CRITICAL').length}</strong>
                <span className="muted small">Priority issues currently pushed into the recovery roadmap.</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Commercial Leakage View</h3>
            <div className="grid-3">
              <div className="metric-panel"><span className="muted tiny">Total Revenue Leakage</span><strong>{currency(data.summary.headline.total_revenue_leakage, currencyCode)}</strong></div>
              <div className="metric-panel"><span className="muted tiny">Revenue Gap</span><strong>{currency(data.summary.headline.revenue_gap, currencyCode)}</strong></div>
              <div className="metric-panel"><span className="muted tiny">Driver Target Achievement</span><strong>{Math.round(data.summary.headline.driver_target_achievement_pct)}%</strong></div>
              <div className="metric-panel"><span className="muted tiny">Qualified Leads</span><strong>{num(data.summary.commercial.qualified_leads || 0)}</strong><span className="muted small">Target {num(data.summary.commercial.qualified_leads_target || 0)}</span></div>
              <div className="metric-panel"><span className="muted tiny">Lead-to-Win %</span><strong>{num(data.summary.commercial.qualified_lead_to_win_pct || 0)}</strong><span className="muted small">Target {num(data.summary.commercial.qualified_lead_to_win_pct_target || 0)}</span></div>
              <div className="metric-panel"><span className="muted tiny">Average Deal Size</span><strong>{currency(data.summary.commercial.average_deal_size || 0, currencyCode)}</strong><span className="muted small">Target {currency(data.summary.commercial.average_deal_size_target || 0, currencyCode)}</span></div>
            </div>
          </div>

          <div className="card">
            <h3>Core Leakage Ranking</h3>
            <div className="rank-list">
              {[...data.summary.core_rows].sort((a, b) => b.leakage - a.leakage).map((core) => (
                <div key={core.name} className="rank-row">
                  <div>
                    <strong>{core.name}</strong>
                    <p className="muted small">{currency(core.leakage, currencyCode)}</p>
                  </div>
                  <div className="rank-bar-shell"><div className="rank-bar" style={{ width: `${Math.max(4, (core.leakage / Math.max(1, data.summary.total_leakage)) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>Driver Performance Ranking</h3>
            <div className="rank-list">
              {[...data.summary.core_rows].sort((a, b) => b.driver_score - a.driver_score).map((core) => (
                <div key={core.name} className="rank-row">
                  <div>
                    <strong>{core.name}</strong>
                    <p className="muted small">{Math.round(core.driver_score)}% target achievement</p>
                  </div>
                  <div className="rank-bar-shell"><div className="rank-bar success" style={{ width: `${Math.max(4, core.driver_score)}%` }} /></div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>Priority Leakage Findings</h3>
            {data.findings.length ? (
              <div className="list">
                {data.findings.slice(0, 6).map((finding) => (
                  <div key={finding.finding_instance_id} className="finding-card">
                    <div className="core-title-row">
                      <strong>{finding.finding_title}</strong>
                      <span className={`module-chip ${severityClass(finding.severity_band)}`}>{finding.severity_band}</span>
                    </div>
                    <p className="muted small"><strong>Impact:</strong> {finding.business_impact}</p>
                    <p className="muted small"><strong>Likely root cause:</strong> {finding.likely_root_cause}</p>
                    <p className="muted small"><strong>Evidence strength:</strong> {finding.evidence_strength}</p>
                  </div>
                ))}
              </div>
            ) : <p className="muted">No leakage findings are currently instantiated in the shared runtime.</p>}
          </div>

          <div className="card">
            <h3>Leakage Recovery Priorities</h3>
            {groupedRoadmapEntries.length ? (
              <>
                {groupedRoadmapEntries.map(([phaseCode, items]) => (
                  <div key={phaseCode} className="roadmap-phase-block">
                    <h4>{phaseCode} — {String(items[0]?.phase_name || '')}</h4>
                    <div className="list">
                      {items.slice(0, 5).map((item) => (
                        <div key={item.roadmap_instance_id} className="finding-card">
                          <strong>{item.initiative_title}</strong>
                          <p className="muted small"><strong>Owner:</strong> {item.owner_role} · <strong>Target:</strong> {item.target_value} · <strong>Outcome:</strong> {item.business_outcome}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : <p className="muted">No leakage recovery roadmap items are currently instantiated.</p>}
          </div>
        </>
      ) : null}

      {activeView === 'advisory' ? (
        <>
          <div className="card">
            <h3>Priority Advisory Overview</h3>
            <div className="grid-3">
              <div className="metric-panel">
                <span className="muted tiny">Total leakage</span>
                <strong>{currency(data.summary.total_leakage, currencyCode)}</strong>
              </div>
              <div className="metric-panel">
                <span className="muted tiny">Overall driver target achievement</span>
                <strong>{Math.round(data.summary.headline.driver_target_achievement_pct)}%</strong>
              </div>
              <div className="metric-panel">
                <span className="muted tiny">Priority cores</span>
                <strong>{weakCores.length}</strong>
              </div>
            </div>
          </div>

          {weakCores.slice(0, 3).length ? (
            <div className="card">
              <h3>Priority Cores</h3>
              <div className="grid-3">
                {weakCores.slice(0, 3).map((core) => {
                  const weakDrivers = core.driver_rows.filter((driver) => !driver.within).map((driver) => driver.name);
                  return (
                    <div key={core.name} className="finding-card">
                      <span className="muted tiny">Priority Core</span>
                      <strong>{core.name}</strong>
                      <p className="muted small">Leakage: {currency(core.leakage, currencyCode)}</p>
                      <p className="muted small">Driver Target Achievement: {Math.round(core.driver_score)}%</p>
                      <p className="muted small">Weak drivers: {weakDrivers.slice(0, 2).join(', ') || 'None'}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {weakCores.map((core) => {
            const weakDrivers = core.driver_rows.filter((driver) => !driver.within).map((driver) => driver.name);
            return (
              <div key={core.name} className="card">
                <div className="core-title-row">
                  <div>
                    <span className="muted tiny">{core.category}</span>
                    <h3>{core.name}</h3>
                  </div>
                  <div className="metric-panel compact">
                    <span className="muted tiny">Leakage</span>
                    <strong style={{ color: core.leakage > 0 ? 'var(--danger)' : 'var(--success)' }}>{currency(core.leakage, currencyCode)}</strong>
                  </div>
                </div>
                <p className="muted small">
                  Driver Target Achievement: <strong>{Math.round(core.driver_score)}%</strong> · Drivers Within Benchmark: <strong>{core.drivers_within}/{core.drivers_total}</strong>
                </p>
                <p className="muted small">{explainLeakage(core)}</p>
                <div className="grid-2">
                  <div>
                    <h4>Best-Practice Process Improvements</h4>
                    <p className="muted small">{core.advisory.process}</p>
                    <h4>Best-Practice Actions</h4>
                    <p className="muted small">{core.advisory.actions}</p>
                  </div>
                  <div>
                    <h4>Best-Practice Automations</h4>
                    <p className="muted small">{core.advisory.automation}</p>
                    <h4>Weak Drivers Triggering Attention</h4>
                    {weakDrivers.length ? <ul className="compact-list">{weakDrivers.map((driver) => <li key={driver}>{driver}</li>)}</ul> : <p className="muted small">No weak drivers flagged.</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      ) : null}

      {activeView === 'metrics' ? (
        <>
          <div className="card">
            <h3>Revenue Leakage metrics view</h3>
            <div className="grid-4">
              <div className="metric-panel compact"><span className="muted tiny">Total leakage</span><strong>{currency(data.summary.total_leakage, currencyCode)}</strong></div>
              <div className="metric-panel compact"><span className="muted tiny">Revenue gap</span><strong>{currency(data.summary.headline.revenue_gap, currencyCode)}</strong></div>
              <div className="metric-panel compact"><span className="muted tiny">Driver target achievement</span><strong>{Math.round(data.summary.headline.driver_target_achievement_pct)}%</strong></div>
              <div className="metric-panel compact"><span className="muted tiny">Drivers within target</span><strong>{totalWithin}/{totalDrivers}</strong></div>
            </div>
          </div>

          <div className="card">
            <h3>Core metric matrix</h3>
            <div className="table-scroll">
              <table className="kinto-table">
                <thead><tr><th>Core</th><th>Actual</th><th>Benchmark</th><th>Leakage</th><th>Driver achievement</th><th>Status</th></tr></thead>
                <tbody>
                  {data.summary.core_rows.map((core) => (
                    <tr key={core.name}>
                      <td>{core.name}</td>
                      <td>{num(core.actual)}</td>
                      <td>{num(core.benchmark)}</td>
                      <td>{currency(core.leakage, currencyCode)}</td>
                      <td>{Math.round(core.driver_score)}%</td>
                      <td>{core.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3>Driver score tracker</h3>
            <div className="table-scroll">
              <table className="kinto-table">
                <thead><tr><th>Core</th><th>Driver</th><th>Actual</th><th>Benchmark</th><th>Within target</th></tr></thead>
                <tbody>
                  {data.summary.core_rows.flatMap((core) => core.driver_rows.map((driver) => (
                    <tr key={`${core.name}-${driver.name}`}>
                      <td>{core.name}</td>
                      <td>{driver.name}</td>
                      <td>{num(driver.actual)}</td>
                      <td>{num(driver.benchmark)}</td>
                      <td>{driver.within ? 'Yes' : 'No'}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {activeView === 'report' ? (
        <>
          <div className="card">
            <div className="core-title-row">
              <div>
                <h3>Revenue Leakage report preview</h3>
                <p className="muted small">Standalone-first leakage reporting: generate and validate the saved revenue leakage deliverable here before relying on integrated reporting.</p>
              </div>
              <button className="btn btn-primary" type="button" onClick={() => void generateStandaloneReport()} disabled={!!reportBusy || !assessmentId}>
                {reportBusy ? 'Generating…' : 'Generate Revenue Leakage Report'}
              </button>
            </div>
            <div className="list small">
              <span>Total estimated leakage exposure: <strong>{currency(data.summary.total_leakage, currencyCode)}</strong>.</span>
              <span>Current protection score: <strong>{Math.round(Number(data.moduleScore?.score_pct || 0))}%</strong>.</span>
              <span>Top leakage areas: <strong>{(data.summary.headline.top_3_leakage_areas || []).join(', ') || 'No areas ranked yet'}</strong>.</span>
              <span>Driver target achievement currently sits at <strong>{Math.round(data.summary.headline.driver_target_achievement_pct)}%</strong> across the leakage engine.</span>
            </div>
            {reportError ? <p className="error-text" role="alert">{reportError}</p> : null}
          </div>

          <div className="grid-2">
            <div className="card">
              <h3>Saved standalone report</h3>
              {standaloneReport?.report ? (
                <div className="list small">
                  <span>Status: <strong>{standaloneReport.report.report_status}</strong></span>
                  <span>Generated: <strong>{formatGeneratedAt(standaloneReport.report.generated_at)}</strong></span>
                  <span>Artifacts: <strong>{standaloneReport.artifacts?.length || 0}</strong></span>
                  <span>{standaloneReport.report.summary_text || 'No summary stored yet.'}</span>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
                    {artifactByType(standaloneReport.artifacts, 'docx') ? <a className="btn btn-secondary btn-sm" href={artifactDownloadLink(artifactByType(standaloneReport.artifacts, 'docx'))}>Download DOCX</a> : <span className="muted">DOCX not generated yet</span>}
                    {artifactByType(standaloneReport.artifacts, 'pptx') ? <a className="btn btn-secondary btn-sm" href={artifactDownloadLink(artifactByType(standaloneReport.artifacts, 'pptx'))}>Download PPTX</a> : <span className="muted">PPTX not generated yet</span>}
                  </div>
                </div>
              ) : (
                <p className="muted">No standalone Revenue Leakage report has been generated yet.</p>
              )}
            </div>
            <div className="card">
              <h3>Findings summary</h3>
              <div className="list small">
                {data.findings.slice(0, 10).map((finding) => (
                  <span key={finding.finding_instance_id}>[{finding.severity_band}] {finding.finding_title}</span>
                ))}
                {!data.findings.length ? <span className="muted">No leakage findings are available yet.</span> : null}
              </div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <h3>Roadmap preview</h3>
              <div className="list small">
                {data.roadmap.slice(0, 10).map((item) => (
                  <span key={item.roadmap_instance_id}>{item.phase_name || item.phase_code} · {item.initiative_title}</span>
                ))}
                {!data.roadmap.length ? <span className="muted">No roadmap items are available yet.</span> : null}
              </div>
            </div>
            <div className="card">
              <h3>Saved report headline</h3>
              <p className="muted small">{standaloneReport?.payload?.executive_summary?.headline || 'No saved standalone report headline is available yet.'}</p>
              <p className="muted small">{standaloneReport?.payload?.executive_summary?.key_message || ''}</p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
