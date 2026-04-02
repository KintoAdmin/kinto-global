// @ts-nocheck
export const BR_BUSINESS_TYPES = [
  { code: 'retail_shop', label: 'Retail / Shop' },
  { code: 'professional_services', label: 'Professional Services / Consulting' },
  { code: 'field_services', label: 'Field Services / Trades' },
  { code: 'software_saas', label: 'Software / SaaS' },
];

export const BR_REGIONS = [
  { code: 'south_africa', label: 'South Africa' },
  { code: 'uae', label: 'UAE' },
  { code: 'usa', label: 'United States' },
  { code: 'europe', label: 'Europe (EU-first)' },
];

export const BR_PHASES = [
  { code: 'phase_0_define', name: 'Define the business', order: 0 },
  { code: 'phase_1_formal', name: 'Formal setup', order: 1 },
  { code: 'phase_2_financial', name: 'Financial setup', order: 2 },
  { code: 'phase_3_operating', name: 'Operating setup', order: 3 },
  { code: 'phase_4_control', name: 'Control setup', order: 4 },
  { code: 'phase_5_launch', name: 'Launch readiness', order: 5 },
];

export const BR_DOMAINS = [
  { code: 'd01_business_definition', phase_code: 'phase_0_define', name: 'Business Definition', launch_critical: true },
  { code: 'd02_offer_pricing', phase_code: 'phase_0_define', name: 'Offer, Pricing, and Commercial Basics', launch_critical: true },
  { code: 'd03_ownership_structure', phase_code: 'phase_1_formal', name: 'Ownership and Structure', launch_critical: true },
  { code: 'd04_registration_formal', phase_code: 'phase_1_formal', name: 'Registration and Formal Establishment', launch_critical: true },
  { code: 'd05_banking_payments', phase_code: 'phase_2_financial', name: 'Banking, Payments, and Money Separation', launch_critical: true },
  { code: 'd06_bookkeeping', phase_code: 'phase_2_financial', name: 'Bookkeeping and Financial Discipline', launch_critical: true },
  { code: 'd07_suppliers_inputs', phase_code: 'phase_3_operating', name: 'Suppliers, Inputs, and Fulfilment Readiness', launch_critical: false },
  { code: 'd08_customer_sales', phase_code: 'phase_3_operating', name: 'Customer and Sales Process', launch_critical: true },
  { code: 'd09_core_operations', phase_code: 'phase_3_operating', name: 'Core Operations and Service Delivery', launch_critical: true },
  { code: 'd10_quality_consistency', phase_code: 'phase_4_control', name: 'Quality and Consistency', launch_critical: false },
  { code: 'd11_people_roles', phase_code: 'phase_4_control', name: 'People, Roles, and Accountability', launch_critical: false },
  { code: 'd12_management_control', phase_code: 'phase_4_control', name: 'Management Control and Visibility', launch_critical: false },
  { code: 'd13_risk_compliance', phase_code: 'phase_4_control', name: 'Risk, Compliance, and Basic Protection', launch_critical: true },
  { code: 'd14_launch_readiness', phase_code: 'phase_5_launch', name: 'Launch Readiness', launch_critical: false },
];

export const BR_LAUNCH_DOMAIN_CODES = BR_DOMAINS.filter((row) => row.launch_critical).map((row) => row.code);

export const BR_READINESS_PERCENT: Record<string, number> = {
  not_started: 0,
  started: 25,
  set_up: 50,
  operational: 80,
  controlled: 100,
};

export function readinessLabel(state?: string | null) {
  const value = String(state || 'not_started').toLowerCase();
  if (value === 'set_up') return 'Set up';
  return value.replaceAll('_', ' ').replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}

export function bandFromReadinessPercent(pct: number) {
  if (pct <= 0) return 'NOT_STARTED';
  if (pct < 40) return 'CRITICAL_WEAK';
  if (pct < 65) return 'DEVELOPING';
  if (pct < 80) return 'MANAGED';
  return 'STRONG_MANAGED';
}
