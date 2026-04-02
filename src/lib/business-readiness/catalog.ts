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

export const BR_TASK_TEMPLATES = [
  { code: 'd01_define_offer', domain_code: 'd01_business_definition', phase_code: 'phase_0_define', role: 'setup', title: 'Define the main offer', description: 'Write clearly what the business will sell.', required: true, launch_critical: true, evidence_required: false, sort_order: 1 },
  { code: 'd01_define_customer', domain_code: 'd01_business_definition', phase_code: 'phase_0_define', role: 'setup', title: 'Define the target customer', description: 'State who the business is mainly for.', required: true, launch_critical: true, evidence_required: false, sort_order: 2 },
  { code: 'd01_revenue_model', domain_code: 'd01_business_definition', phase_code: 'phase_0_define', role: 'setup', title: 'Define the revenue model', description: 'Explain how the business makes money.', required: true, launch_critical: true, evidence_required: false, sort_order: 3 },
  { code: 'd02_offer_list', domain_code: 'd02_offer_pricing', phase_code: 'phase_0_define', role: 'setup', title: 'List the products or services', description: 'Create a usable list of what the business will sell.', required: true, launch_critical: true, evidence_required: false, sort_order: 1 },
  { code: 'd02_price_logic', domain_code: 'd02_offer_pricing', phase_code: 'phase_0_define', role: 'setup', title: 'Set the price or package logic', description: 'Define the price list, rate card, or package structure.', required: true, launch_critical: true, evidence_required: true, sort_order: 2 },
  { code: 'd02_payment_expectation', domain_code: 'd02_offer_pricing', phase_code: 'phase_0_define', role: 'operate', title: 'Define how customers will pay', description: 'Set the payment expectation clearly before work starts.', required: true, launch_critical: true, evidence_required: false, sort_order: 3 },
  { code: 'd03_choose_structure', domain_code: 'd03_ownership_structure', phase_code: 'phase_1_formal', role: 'setup', title: 'Choose the basic business structure', description: 'Set the ownership or structure path for the business.', required: true, launch_critical: true, evidence_required: false, sort_order: 1 },
  { code: 'd03_define_authority', domain_code: 'd03_ownership_structure', phase_code: 'phase_1_formal', role: 'setup', title: 'Define who can approve key decisions', description: 'Set who can approve spend, important actions, or signoff.', required: true, launch_critical: false, evidence_required: false, sort_order: 2 },
  { code: 'd04_registration_path', domain_code: 'd04_registration_formal', phase_code: 'phase_1_formal', role: 'setup', title: 'Identify the registration path', description: 'Confirm what registration or formal setup path applies.', required: true, launch_critical: true, evidence_required: false, sort_order: 1 },
  { code: 'd04_complete_registration', domain_code: 'd04_registration_formal', phase_code: 'phase_1_formal', role: 'operate', title: 'Complete the main registration step', description: 'Complete the main formal setup step and keep proof.', required: true, launch_critical: true, evidence_required: true, sort_order: 2 },
  { code: 'd04_recurring_obligations', domain_code: 'd04_registration_formal', phase_code: 'phase_1_formal', role: 'control', title: 'Record recurring obligations', description: 'List annual returns, renewals, or recurring filing items.', required: false, launch_critical: false, evidence_required: false, sort_order: 3 },
  { code: 'd05_account_path', domain_code: 'd05_banking_payments', phase_code: 'phase_2_financial', role: 'setup', title: 'Choose the business banking path', description: 'Set how the business will receive and hold money.', required: true, launch_critical: true, evidence_required: false, sort_order: 1 },
  { code: 'd05_payment_methods', domain_code: 'd05_banking_payments', phase_code: 'phase_2_financial', role: 'setup', title: 'Choose payment methods', description: 'Set which payment methods the business will accept.', required: true, launch_critical: true, evidence_required: false, sort_order: 2 },
  { code: 'd05_use_separate_money', domain_code: 'd05_banking_payments', phase_code: 'phase_2_financial', role: 'operate', title: 'Use separate business money flows', description: 'Start using the chosen business payment path consistently.', required: true, launch_critical: true, evidence_required: false, sort_order: 3 },
  { code: 'd06_bookkeeping_method', domain_code: 'd06_bookkeeping', phase_code: 'phase_2_financial', role: 'setup', title: 'Choose a bookkeeping method', description: 'Pick the system or method for recording money.', required: true, launch_critical: true, evidence_required: false, sort_order: 1 },
  { code: 'd06_categories', domain_code: 'd06_bookkeeping', phase_code: 'phase_2_financial', role: 'setup', title: 'Create income and expense categories', description: 'Set practical categories for business records.', required: true, launch_critical: false, evidence_required: false, sort_order: 2 },
  { code: 'd06_store_documents', domain_code: 'd06_bookkeeping', phase_code: 'phase_2_financial', role: 'operate', title: 'Store receipts and invoices properly', description: 'Keep supporting documents in one place.', required: true, launch_critical: true, evidence_required: true, sort_order: 3 },
  { code: 'd06_monthly_review', domain_code: 'd06_bookkeeping', phase_code: 'phase_2_financial', role: 'control', title: 'Run a monthly review', description: 'Review sales, expenses, and bank activity at least monthly.', required: false, launch_critical: false, evidence_required: false, sort_order: 4 },
  { code: 'd07_supplier_list', domain_code: 'd07_suppliers_inputs', phase_code: 'phase_3_operating', role: 'setup', title: 'List your core suppliers or inputs', description: 'Identify what the business needs to deliver consistently.', required: false, launch_critical: false, evidence_required: false, sort_order: 1 },
  { code: 'd07_reorder_rules', domain_code: 'd07_suppliers_inputs', phase_code: 'phase_3_operating', role: 'operate', title: 'Set reorder or replenishment rules', description: 'Decide how shortages or stockouts will be avoided.', required: false, launch_critical: false, evidence_required: false, sort_order: 2 },
  { code: 'd08_lead_flow', domain_code: 'd08_customer_sales', phase_code: 'phase_3_operating', role: 'setup', title: 'Define how enquiries come in', description: 'Set the starting point for a customer or lead.', required: true, launch_critical: true, evidence_required: false, sort_order: 1 },
  { code: 'd08_acceptance_step', domain_code: 'd08_customer_sales', phase_code: 'phase_3_operating', role: 'setup', title: 'Define how a customer says yes', description: 'Set how quotes, proposals, orders, or signoffs are accepted.', required: true, launch_critical: true, evidence_required: false, sort_order: 2 },
  { code: 'd08_payment_trigger', domain_code: 'd08_customer_sales', phase_code: 'phase_3_operating', role: 'operate', title: 'Define the payment trigger', description: 'Set when payment is requested or collected.', required: true, launch_critical: true, evidence_required: false, sort_order: 3 },
  { code: 'd09_delivery_workflow', domain_code: 'd09_core_operations', phase_code: 'phase_3_operating', role: 'setup', title: 'Define the delivery workflow', description: 'List the steps from accepted sale to completed delivery.', required: true, launch_critical: true, evidence_required: false, sort_order: 1 },
  { code: 'd09_completion_standard', domain_code: 'd09_core_operations', phase_code: 'phase_3_operating', role: 'setup', title: 'Define what completed delivery looks like', description: 'Set the completion point or handover standard.', required: true, launch_critical: true, evidence_required: false, sort_order: 2 },
  { code: 'd09_use_workflow', domain_code: 'd09_core_operations', phase_code: 'phase_3_operating', role: 'operate', title: 'Use the workflow consistently', description: 'Start following the same delivery path in practice.', required: true, launch_critical: true, evidence_required: false, sort_order: 3 },
  { code: 'd10_quality_checks', domain_code: 'd10_quality_consistency', phase_code: 'phase_4_control', role: 'setup', title: 'Define simple quality checks', description: 'Set what good looks like and how you will check it.', required: false, launch_critical: false, evidence_required: false, sort_order: 1 },
  { code: 'd10_problem_handling', domain_code: 'd10_quality_consistency', phase_code: 'phase_4_control', role: 'operate', title: 'Define complaint, rework, or returns handling', description: 'Set what will happen if something goes wrong.', required: false, launch_critical: false, evidence_required: false, sort_order: 2 },
  { code: 'd11_role_owner', domain_code: 'd11_people_roles', phase_code: 'phase_4_control', role: 'setup', title: 'Define who owns key responsibilities', description: 'Make it clear who owns sales, delivery, money, and compliance tasks.', required: false, launch_critical: false, evidence_required: false, sort_order: 1 },
  { code: 'd11_role_review', domain_code: 'd11_people_roles', phase_code: 'phase_4_control', role: 'control', title: 'Review whether responsibilities are clear', description: 'Check that work is not being dropped through confusion.', required: false, launch_critical: false, evidence_required: false, sort_order: 2 },
  { code: 'd12_review_rhythm', domain_code: 'd12_management_control', phase_code: 'phase_4_control', role: 'setup', title: 'Set a weekly and monthly review rhythm', description: 'Decide when the owner will review the business.', required: false, launch_critical: false, evidence_required: false, sort_order: 1 },
  { code: 'd12_track_key_checks', domain_code: 'd12_management_control', phase_code: 'phase_4_control', role: 'control', title: 'Track the key numbers or checks', description: 'Review a small set of owner control checks consistently.', required: false, launch_critical: false, evidence_required: false, sort_order: 2 },
  { code: 'd13_risk_map', domain_code: 'd13_risk_compliance', phase_code: 'phase_4_control', role: 'setup', title: 'Identify the major risk and compliance areas', description: 'Check whether tax, privacy, licences, insurance, or legal escalation may apply.', required: true, launch_critical: true, evidence_required: false, sort_order: 1 },
  { code: 'd13_keep_proof', domain_code: 'd13_risk_compliance', phase_code: 'phase_4_control', role: 'operate', title: 'Keep key proof and responsibilities visible', description: 'Store important registrations, permits, and ownership notes in one place.', required: true, launch_critical: true, evidence_required: false, sort_order: 2 },
  { code: 'd13_recurring_compliance', domain_code: 'd13_risk_compliance', phase_code: 'phase_4_control', role: 'control', title: 'Track recurring compliance items', description: 'List follow-up dates and who owns them.', required: false, launch_critical: false, evidence_required: false, sort_order: 3 },
  { code: 'd14_launch_check', domain_code: 'd14_launch_readiness', phase_code: 'phase_5_launch', role: 'setup', title: 'Run the launch check', description: 'Review whether the minimum launch threshold has been met.', required: true, launch_critical: false, evidence_required: false, sort_order: 1 },
  { code: 'd14_real_world_check', domain_code: 'd14_launch_readiness', phase_code: 'phase_5_launch', role: 'operate', title: 'Confirm the business can actually operate', description: 'Check that the business can take an enquiry, receive money, and deliver.', required: true, launch_critical: false, evidence_required: false, sort_order: 2 },
  { code: 'd14_306090_plan', domain_code: 'd14_launch_readiness', phase_code: 'phase_5_launch', role: 'control', title: 'Set the first 30/60/90 day plan', description: 'Define what will be watched closely after launch.', required: false, launch_critical: false, evidence_required: false, sort_order: 3 },
  { code: 'retail_pos_cashup', domain_code: 'd05_banking_payments', phase_code: 'phase_2_financial', role: 'setup', title: 'Choose POS, card, cash, and daily cash-up methods', description: 'Retail setups need payment handling and end-of-day cash-up logic.', required: true, launch_critical: true, evidence_required: false, sort_order: 4, business_types: ['retail_shop'] },
  { code: 'retail_opening_closing', domain_code: 'd09_core_operations', phase_code: 'phase_3_operating', role: 'operate', title: 'Create opening and closing routines', description: 'Retail setups should have a simple opening and closing checklist.', required: true, launch_critical: true, evidence_required: false, sort_order: 4, business_types: ['retail_shop'] },
  { code: 'ps_quote_acceptance', domain_code: 'd08_customer_sales', phase_code: 'phase_3_operating', role: 'setup', title: 'Create a proposal or quote acceptance process', description: 'Professional services need a clear commercial acceptance path.', required: true, launch_critical: true, evidence_required: false, sort_order: 4, business_types: ['professional_services'] },
  { code: 'ps_collections', domain_code: 'd05_banking_payments', phase_code: 'phase_2_financial', role: 'operate', title: 'Define invoicing and collections follow-up', description: 'Set who invoices and how unpaid invoices are followed up.', required: true, launch_critical: true, evidence_required: false, sort_order: 4, business_types: ['professional_services'] },
  { code: 'fs_quote_process', domain_code: 'd08_customer_sales', phase_code: 'phase_3_operating', role: 'setup', title: 'Create a quote and job acceptance process', description: 'Field services need a quote to approval path before work begins.', required: true, launch_critical: true, evidence_required: false, sort_order: 4, business_types: ['field_services'] },
  { code: 'fs_completion_signoff', domain_code: 'd09_core_operations', phase_code: 'phase_3_operating', role: 'operate', title: 'Create a completion and signoff method', description: 'Set proof of work or customer signoff before closeout.', required: true, launch_critical: true, evidence_required: false, sort_order: 4, business_types: ['field_services'] },
  { code: 'saas_billing', domain_code: 'd05_banking_payments', phase_code: 'phase_2_financial', role: 'setup', title: 'Choose billing or subscription collection method', description: 'Software businesses need billing logic before launch.', required: true, launch_critical: true, evidence_required: false, sort_order: 4, business_types: ['software_saas'] },
  { code: 'saas_support_process', domain_code: 'd09_core_operations', phase_code: 'phase_3_operating', role: 'operate', title: 'Define support and issue handling', description: 'Software businesses should define support and issue handling before launch.', required: true, launch_critical: true, evidence_required: false, sort_order: 4, business_types: ['software_saas'] },
  { code: 'za_registration_path', domain_code: 'd04_registration_formal', phase_code: 'phase_1_formal', role: 'setup', title: 'Confirm the South Africa registration path', description: 'Identify whether the business is using a sole proprietor path or a company path with CIPC/SARS implications.', required: true, launch_critical: true, evidence_required: false, sort_order: 4, regions: ['south_africa'] },
  { code: 'za_popia_awareness', domain_code: 'd13_risk_compliance', phase_code: 'phase_4_control', role: 'setup', title: 'Review POPIA and Information Officer awareness', description: 'If the business handles personal information, check POPIA awareness and escalation needs.', required: true, launch_critical: false, evidence_required: false, sort_order: 4, regions: ['south_africa'] },
  { code: 'uae_setup_mode', domain_code: 'd03_ownership_structure', phase_code: 'phase_1_formal', role: 'setup', title: 'Choose mainland or free zone path', description: 'The UAE setup path changes depending on whether the business will operate on the mainland or in a free zone.', required: true, launch_critical: true, evidence_required: false, sort_order: 3, regions: ['uae'] },
  { code: 'uae_tax_awareness', domain_code: 'd13_risk_compliance', phase_code: 'phase_4_control', role: 'setup', title: 'Review VAT and corporate tax awareness', description: 'Check whether VAT or corporate tax awareness and escalation are needed.', required: true, launch_critical: false, evidence_required: false, sort_order: 4, regions: ['uae'] },
  { code: 'usa_structure_before_state', domain_code: 'd03_ownership_structure', phase_code: 'phase_1_formal', role: 'setup', title: 'Choose structure before state registration', description: 'In the USA, the structure choice should be clear before completing state registration.', required: true, launch_critical: true, evidence_required: false, sort_order: 3, regions: ['usa'] },
  { code: 'usa_state_permit_check', domain_code: 'd04_registration_formal', phase_code: 'phase_1_formal', role: 'setup', title: 'Check state and local permits', description: 'Confirm the licensing and permit path for the selected state or locality.', required: true, launch_critical: true, evidence_required: false, sort_order: 4, regions: ['usa'] },
  { code: 'eu_country_path', domain_code: 'd04_registration_formal', phase_code: 'phase_1_formal', role: 'setup', title: 'Identify the country-specific registration path', description: 'Europe must be handled country first, then registration and permits.', required: true, launch_critical: true, evidence_required: false, sort_order: 4, regions: ['europe'] },
  { code: 'eu_vat_gdpr_awareness', domain_code: 'd13_risk_compliance', phase_code: 'phase_4_control', role: 'setup', title: 'Review VAT and GDPR awareness', description: 'Check whether EU VAT, OSS, or GDPR awareness applies before launch.', required: true, launch_critical: false, evidence_required: false, sort_order: 4, regions: ['europe'] },
];

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

export function getBrBusinessTypeLabel(code?: string | null) {
  return BR_BUSINESS_TYPES.find((row) => row.code === code)?.label || code || 'Unknown';
}

export function getBrRegionLabel(code?: string | null) {
  return BR_REGIONS.find((row) => row.code === code)?.label || code || 'Unknown';
}

export function getBrPhase(code?: string | null) {
  return BR_PHASES.find((row) => row.code === code) || null;
}

export function getBrDomain(code?: string | null) {
  return BR_DOMAINS.find((row) => row.code === code) || null;
}

export function buildBrTaskTemplates(input?: { businessTypeCode?: string | null; regionCode?: string | null }) {
  const businessTypeCode = input?.businessTypeCode || '';
  const regionCode = input?.regionCode || '';
  return BR_TASK_TEMPLATES.filter((row) => {
    if (Array.isArray(row.business_types) && row.business_types.length && !row.business_types.includes(businessTypeCode)) return false;
    if (Array.isArray(row.regions) && row.regions.length && !row.regions.includes(regionCode)) return false;
    return true;
  }).map((row) => ({ ...row }));
}
