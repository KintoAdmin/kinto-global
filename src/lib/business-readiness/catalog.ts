// @ts-nocheck
export const BR_TEMPLATE_VERSION = 'br-v10-playbook-overlays';

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

const COMMON_STRUCTURE = [
  {
    phase_code: 'phase_0_define',
    phase_name: 'Define the business',
    sections: [
      {
        section_code: 'd01_business_definition',
        section_name: 'Business Definition',
        actions: [
          {
            action_code: 'a01_define_offer',
            action_title: 'Define the business offer',
            objective: 'Make the business clear enough to price, register, market, and deliver properly.',
            launch_critical: true,
            tasks: [
              {
                task_code: 't01_write_offer',
                task_title: 'Write the core business offer',
                instructions: 'Write one clear sentence that explains what the business sells. Keep it specific enough that another person can understand it immediately.',
                requirements: ['business idea', 'product or service description', 'target customer'],
                where_to_do_this: ['notes document', 'Business Readiness workspace', 'business plan document if available'],
                record_and_save: ['final offer statement', 'simple business description', 'save in the Business Setup folder'],
              },
              {
                task_code: 't02_define_target_customer',
                task_title: 'Define the target customer',
                instructions: 'State exactly who the business is trying to sell to first. Be specific enough to guide pricing, marketing, and service delivery.',
                requirements: ['chosen offer', 'customer type', 'industry or buyer type if relevant'],
                where_to_do_this: ['notes document', 'customer profile worksheet'],
                record_and_save: ['target customer definition', 'primary customer type', 'save in the Business Setup folder'],
              },
              {
                task_code: 't03_set_revenue_model',
                task_title: 'Define how the business will make money',
                instructions: 'Set the revenue model the business will use at launch. This should explain how the business gets paid.',
                requirements: ['offer', 'target customer', 'expected sales method'],
                where_to_do_this: ['notes document', 'pricing worksheet'],
                record_and_save: ['revenue model', 'launch sales model', 'save in the Business Setup folder'],
              },
            ],
          },
        ],
      },
      {
        section_code: 'd02_offer_pricing',
        section_name: 'Offer, Pricing, and Commercial Basics',
        actions: [
          {
            action_code: 'a02_set_launch_pricing',
            action_title: 'Set the launch offer and pricing',
            objective: 'Make the launch offer, price, and payment terms clear before the business starts selling.',
            launch_critical: true,
            tasks: [
              {
                task_code: 't01_finalize_launch_offer',
                task_title: 'Finalise the launch offer',
                instructions: 'Decide exactly what the business will sell at launch. Keep the offer narrow enough to explain clearly and deliver properly.',
                requirements: ['core business offer', 'target customer', 'revenue model'],
                where_to_do_this: ['notes document', 'service or product sheet', 'offer worksheet'],
                record_and_save: ['launch offer', 'offer description', 'exclusions if relevant', 'save in the Sales Setup folder'],
              },
              {
                task_code: 't02_set_launch_pricing',
                task_title: 'Set the launch pricing',
                instructions: 'Set the pricing the business will use when it starts selling. The price should match the offer and be easy to explain to customers.',
                requirements: ['launch offer', 'price basis', 'expected payment timing'],
                where_to_do_this: ['pricing worksheet', 'quote template or rate card'],
                record_and_save: ['final launch pricing', 'pricing notes', 'quote or rate card', 'save in the Sales Setup folder'],
              },
              {
                task_code: 't03_set_payment_terms',
                task_title: 'Set the payment terms',
                instructions: 'Decide when payment is due, how it should be made, and what rule will apply if the customer pays late.',
                requirements: ['launch pricing', 'payment method', 'business sales model'],
                where_to_do_this: ['invoice template', 'quote template', 'terms note or proposal template'],
                record_and_save: ['payment terms', 'late payment rule', 'customer payment instructions', 'save in the Sales Setup folder'],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    phase_code: 'phase_1_formal',
    phase_name: 'Formal setup',
    sections: [
      {
        section_code: 'd03_ownership_structure',
        section_name: 'Ownership and Structure',
        actions: [
          {
            action_code: 'a03_choose_setup_path',
            action_title: 'Choose the business setup path',
            objective: 'Set the structure and ownership position clearly before registration begins.',
            launch_critical: true,
            tasks: [
              {
                task_code: 't01_confirm_legal_structure',
                task_title: 'Confirm the legal structure',
                instructions: 'Decide the legal structure you will use before registration begins. This determines the registration route, tax path, banking setup, and later admin requirements.',
                requirements: ['owner or founder details', 'ownership position', 'country or region selected'],
                where_to_do_this: ['business setup notes', 'registration authority guidance', 'accountant or business advisor if needed'],
                record_and_save: ['chosen legal structure', 'notes on why it was chosen', 'save in the Business Setup folder'],
              },
              {
                task_code: 't02_confirm_ownership_authority',
                task_title: 'Confirm ownership and decision authority',
                instructions: 'Record who owns the business and who can make important decisions before moving into formal setup.',
                requirements: ['founder or owner names', 'ownership split if more than one person is involved', 'decision-maker list'],
                where_to_do_this: ['notes document', 'founder agreement or ownership note if relevant'],
                record_and_save: ['owner list', 'ownership split', 'decision authority note', 'save in the Business Setup folder'],
              },
            ],
          },
        ],
      },
      {
        section_code: 'd04_registration_formal',
        section_name: 'Registration and Formal Establishment',
        actions: [
          {
            action_code: 'a04_complete_registration',
            action_title: 'Complete registration',
            objective: 'Put the business on the correct formal path so banking, invoicing, and launch activity can continue properly.',
            launch_critical: true,
            tasks: [
              {
                task_code: 't01_confirm_registration_route',
                task_title: 'Confirm the correct registration route',
                instructions: 'Confirm the legal structure you are using for the business and match it to the correct registration route before completing any forms. Do not start submissions until this is clear.',
                requirements: ['chosen business structure', 'founder or owner details', 'ID or passport details', 'confirmation of operating region'],
                where_to_do_this: ['registration authority portal', 'tax authority guidance', 'setup notes or checklist'],
                record_and_save: ['confirmed registration route', 'supporting notes', 'save in the Business Setup folder'],
              },
              {
                task_code: 't02_complete_registration_process',
                task_title: 'Complete the registration process',
                instructions: 'Complete the registration using the correct business and owner details. Before submitting anything, check that the business name, owner details, and contact details are correct and consistent.',
                requirements: ['business name', 'owner or director details', 'ID or passport', 'contact details', 'business address', 'payment method if fees apply'],
                where_to_do_this: ['registration portal', 'internet access', 'scanned documents or clear copies if needed'],
                record_and_save: ['registration confirmation', 'registration number if applicable', 'proof of submission', 'save in the Business Setup folder and cloud backup'],
              },
              {
                task_code: 't03_save_registration_tax_details',
                task_title: 'Save the registration and tax details',
                instructions: 'Once registration is complete, save all official details together in one place. These details will be needed later for banking, tax, bookkeeping, contracts, and compliance.',
                requirements: ['official business name', 'registration number if applicable', 'registration date', 'tax reference number where relevant', 'tax account access details'],
                where_to_do_this: ['secure cloud storage', 'password manager', 'tax portal account'],
                record_and_save: ['registration certificate', 'registration number', 'tax number or reference', 'portal login reference', 'save in the Business Setup and Tax folders'],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    phase_code: 'phase_2_financial',
    phase_name: 'Financial setup',
    sections: [
      {
        section_code: 'd05_banking_payments',
        section_name: 'Banking, Payments, and Money Separation',
        actions: [
          {
            action_code: 'a05_set_up_banking',
            action_title: 'Set up business banking',
            objective: 'Create a clean business money setup before the business starts trading.',
            launch_critical: true,
            tasks: [
              {
                task_code: 't01_open_business_account',
                task_title: 'Open the business bank account',
                instructions: 'Open the bank account the business will use for all business income and business expenses. This should be done before the business starts trading. Use the official business details from registration when applying.',
                requirements: ['ID or passport', 'cellphone number', 'email address', 'registration number if applicable', 'registration documents if applicable', 'proof of address if required by the bank'],
                where_to_do_this: ['bank business account application portal or branch', 'scanned or photographed documents', 'phone and email for verification'],
                record_and_save: ['bank name', 'account type', 'account opening confirmation', 'account details for invoices', 'save in the Banking or Finance Setup folder'],
              },
              {
                task_code: 't02_set_payment_method_launch',
                task_title: 'Set the payment method for launch',
                instructions: 'Decide how customers will pay the business when trading begins. Keep this simple. Only add extra payment methods if they are needed for launch.',
                requirements: ['active business bank account', 'clear customer payment method', 'invoice template', 'payment terms'],
                where_to_do_this: ['invoicing template or invoicing software', 'business bank account', 'optional payment platform if needed'],
                record_and_save: ['chosen payment method', 'invoice template', 'payment terms', 'customer payment instructions', 'save in the Sales Admin or Finance folder'],
              },
              {
                task_code: 't03_separate_business_money',
                task_title: 'Separate business money from personal money',
                instructions: 'Use the business bank account for all business income and business expenses from the first day of trading. Do not run customer payments or business costs through a personal account once the business is operating.',
                requirements: ['active business bank account', 'bookkeeping method', 'clear rule for owner contributions and withdrawals'],
                where_to_do_this: ['business bank account', 'bookkeeping spreadsheet or bookkeeping software'],
                record_and_save: ['rule for owner money paid into the business', 'rule for owner money taken from the business', 'first business transaction date', 'save in the Finance Policy or Bookkeeping Setup file'],
              },
            ],
          },
        ],
      },
      {
        section_code: 'd06_bookkeeping',
        section_name: 'Bookkeeping and Financial Discipline',
        actions: [
          {
            action_code: 'a06_put_bookkeeping_in_place',
            action_title: 'Put bookkeeping in place',
            objective: 'Make sure the business can record income, expenses, and financial documents properly from the beginning.',
            launch_critical: true,
            tasks: [
              {
                task_code: 't01_choose_bookkeeping_method',
                task_title: 'Choose the bookkeeping method',
                instructions: 'Choose how the business will record sales, expenses, and financial documents from the start. Use a method that is simple enough to keep updated every week.',
                requirements: ['person responsible for keeping records', 'chosen bookkeeping method', 'routine for updating records', 'storage location for documents'],
                where_to_do_this: ['spreadsheet, Google Sheets, Excel, or bookkeeping software'],
                record_and_save: ['chosen bookkeeping method', 'person responsible', 'update routine', 'save in the Finance Setup file'],
              },
              {
                task_code: 't02_set_income_expense_categories',
                task_title: 'Set the income and expense categories',
                instructions: 'Create the main categories the business will use to record money coming in and money going out. Keep the list simple and practical so it matches how the business actually operates.',
                requirements: ['list of income types', 'list of expense types', 'understanding of main business activities'],
                where_to_do_this: ['spreadsheet or bookkeeping software'],
                record_and_save: ['final category list', 'notes on how each category should be used', 'save in the Bookkeeping folder'],
              },
              {
                task_code: 't03_set_document_storage_method',
                task_title: 'Set the document storage method',
                instructions: 'Choose one safe place to store invoices, receipts, bank statements, registration documents, and tax documents. Use the same folder structure every time so records stay organised and easy to find.',
                requirements: ['storage location', 'folder structure', 'file naming rule', 'routine for saving documents'],
                where_to_do_this: ['Google Drive, OneDrive, Dropbox, or secure local folder'],
                record_and_save: ['folder structure', 'file naming convention', 'storage location used', 'save in the Business Setup Guide or Finance Setup file'],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    phase_code: 'phase_3_operating',
    phase_name: 'Operating setup',
    sections: [
      {
        section_code: 'd08_customer_sales',
        section_name: 'Customer and Sales Process',
        actions: [
          {
            action_code: 'a07_define_customer_process',
            action_title: 'Define the customer enquiry-to-payment process',
            objective: 'Create a repeatable path from first customer interest to payment.',
            launch_critical: true,
            tasks: [
              {
                task_code: 't01_set_enquiry_channel',
                task_title: 'Set the enquiry channel',
                instructions: 'Choose how new customers will contact the business at launch. Use only the channels the business can monitor and respond to properly.',
                requirements: ['target customer', 'communication channels', 'owner or sales contact'],
                where_to_do_this: ['business email', 'phone number', 'WhatsApp Business or website form if relevant'],
                record_and_save: ['enquiry channels', 'response contact details', 'save in the Sales Admin folder'],
              },
              {
                task_code: 't02_set_offer_presentation_method',
                task_title: 'Set the offer presentation method',
                instructions: 'Decide how the offer will be presented to customers. This could be through a quote, proposal, service sheet, or product list.',
                requirements: ['launch offer', 'launch pricing', 'customer contact process'],
                where_to_do_this: ['quote template', 'proposal template', 'product or service sheet'],
                record_and_save: ['final presentation format', 'template used', 'save in the Sales Admin folder'],
              },
              {
                task_code: 't03_set_customer_acceptance_step',
                task_title: 'Set the customer acceptance step',
                instructions: 'Define what counts as a customer saying yes before work starts or goods are prepared. This should be clear enough that the business knows when the sale is real.',
                requirements: ['offer presentation method', 'payment terms', 'chosen sales process'],
                where_to_do_this: ['quote approval', 'proposal acceptance', 'signed confirmation or written instruction'],
                record_and_save: ['acceptance method', 'acceptance rule', 'template or process used', 'save in the Sales Admin folder'],
              },
              {
                task_code: 't04_set_payment_trigger',
                task_title: 'Set the payment trigger',
                instructions: 'Define when the customer must pay in the sales process. Do this before launch so the business does not improvise payment timing case by case.',
                requirements: ['payment terms', 'customer acceptance step', 'launch pricing'],
                where_to_do_this: ['invoice template', 'quote template', 'sales process note'],
                record_and_save: ['payment trigger point', 'related invoice or sales note', 'save in the Sales Admin folder'],
              },
            ],
          },
        ],
      },
      {
        section_code: 'd09_core_operations',
        section_name: 'Core Operations and Service Delivery',
        actions: [
          {
            action_code: 'a08_build_delivery_workflow',
            action_title: 'Build the delivery workflow',
            objective: 'Create the repeatable steps the business will follow from accepted sale to completed delivery.',
            launch_critical: true,
            tasks: [
              {
                task_code: 't01_list_delivery_steps',
                task_title: 'List the delivery steps',
                instructions: 'Write down the steps the business will follow from accepted sale to completed delivery. Keep the sequence practical and specific.',
                requirements: ['launch offer', 'customer acceptance method', 'business operating model'],
                where_to_do_this: ['process note', 'workflow checklist', 'operations document'],
                record_and_save: ['delivery step list', 'workflow draft', 'save in the Operations Setup folder'],
              },
              {
                task_code: 't02_set_completion_point',
                task_title: 'Set the completion point',
                instructions: 'Define exactly when the work, job, or service is considered complete. This must be clear before launch.',
                requirements: ['delivery workflow', 'offer scope', 'customer expectation'],
                where_to_do_this: ['workflow checklist', 'service completion note', 'closeout checklist if relevant'],
                record_and_save: ['completion standard', 'signoff rule if applicable', 'save in the Operations Setup folder'],
              },
              {
                task_code: 't03_set_issue_handling_rule',
                task_title: 'Set the issue handling rule',
                instructions: 'Decide what the business will do when something goes wrong, a complaint is raised, or delivery needs to be corrected.',
                requirements: ['delivery workflow', 'completion point', 'customer contact process'],
                where_to_do_this: ['complaint handling note', 'issue log', 'support email or contact channel'],
                record_and_save: ['issue handling rule', 'escalation contact if relevant', 'save in the Operations Setup folder'],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    phase_code: 'phase_4_control',
    phase_name: 'Control setup',
    sections: [
      {
        section_code: 'd13_risk_compliance',
        section_name: 'Risk, Compliance, and Basic Protection',
        actions: [
          {
            action_code: 'a09_launch_compliance_basics',
            action_title: 'Put the launch compliance basics in place',
            objective: 'Make sure the business has the minimum tax, privacy, and compliance basics checked before launch.',
            launch_critical: true,
            tasks: [
              {
                task_code: 't01_confirm_tax_admin_path',
                task_title: 'Confirm the tax administration path',
                instructions: 'Make sure the business can access the correct tax administration path before launch. Ensure the right tax reference, access, and account details are in place for the chosen setup.',
                requirements: ['legal structure', 'registration details if applicable', 'tax access details'],
                where_to_do_this: ['tax portal', 'accountant or tax practitioner if needed'],
                record_and_save: ['tax number or reference', 'portal access details', 'tax setup note', 'save in the Tax folder'],
              },
              {
                task_code: 't02_confirm_privacy_basics',
                task_title: 'Confirm privacy and data handling basics',
                instructions: 'If the business will collect customer, employee, or supplier personal information, set the basic rule for how that information will be stored and handled.',
                requirements: ['customer or admin process', 'types of personal information collected', 'storage method used'],
                where_to_do_this: ['privacy note', 'internal admin process', 'advisor if needed'],
                record_and_save: ['data handling note', 'storage rule', 'save in the Compliance folder'],
              },
              {
                task_code: 't03_confirm_licence_requirements',
                task_title: 'Confirm any licence, permit, or regulated activity requirements',
                instructions: 'Check whether the business activity needs any licence, permit, or extra compliance step before launch. If it does, do not ignore it or assume it can wait.',
                requirements: ['business activity', 'operating location', 'setup route', 'delivery model'],
                where_to_do_this: ['relevant regulator or authority', 'municipality if relevant', 'advisor if activity is regulated'],
                record_and_save: ['compliance check result', 'licence or permit requirement note', 'follow-up actions if applicable', 'save in the Compliance folder'],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    phase_code: 'phase_5_launch',
    phase_name: 'Launch readiness',
    sections: [
      {
        section_code: 'd14_launch_readiness',
        section_name: 'Launch Readiness',
        actions: [
          {
            action_code: 'a10_confirm_launch_readiness',
            action_title: 'Confirm the business is ready to launch',
            objective: 'Check that the setup, records, and first trading flow are ready before launch.',
            launch_critical: false,
            tasks: [
              {
                task_code: 't01_check_critical_setup_actions',
                task_title: 'Check that the critical setup actions are complete',
                instructions: 'Review the critical actions in business definition, registration, banking, bookkeeping, customer process, and delivery workflow. Do not launch if any of these are still incomplete.',
                requirements: ['completed setup actions', 'saved setup records', 'launch checklist'],
                where_to_do_this: ['Business Readiness module', 'launch checklist', 'internal review document'],
                record_and_save: ['launch readiness review', 'incomplete action list if any', 'save in the Launch folder'],
              },
              {
                task_code: 't02_check_saved_business_records',
                task_title: 'Check that the saved business records are complete',
                instructions: 'Make sure the business setup records are complete and easy to find before launch. This includes registration, banking, tax, bookkeeping, pricing, and customer process records.',
                requirements: ['Business Setup folder', 'Finance folder', 'Tax folder', 'Sales and Operations folders'],
                where_to_do_this: ['cloud storage', 'shared folder structure', 'launch checklist'],
                record_and_save: ['launch document check result', 'missing records list if any', 'save in the Launch folder'],
              },
              {
                task_code: 't03_confirm_first_trading_setup',
                task_title: 'Confirm the first trading setup',
                instructions: 'Confirm that the business can take an enquiry, issue a quote or invoice if needed, receive payment, record the transaction, and deliver the work or service using the setup already created.',
                requirements: ['customer process', 'payment method', 'bookkeeping method', 'delivery workflow'],
                where_to_do_this: ['invoice template', 'bookkeeping method', 'customer response method', 'workflow checklist'],
                record_and_save: ['first trading readiness note', 'issues to fix before launch if any', 'save in the Launch folder'],
              },
            ],
          },
        ],
      },
    ],
  },
];

export const BR_DOMAINS = COMMON_STRUCTURE.flatMap((phase) =>
  phase.sections.map((section) => ({
    code: section.section_code,
    phase_code: phase.phase_code,
    name: section.section_name,
    launch_critical: section.actions.some((action) => action.launch_critical),
  })),
);

export const BR_LAUNCH_DOMAIN_CODES = BR_DOMAINS.filter((row) => row.launch_critical).map((row) => row.code);

export const BR_READINESS_PERCENT = {
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

function applyRegionText(task, regionCode) {
  if (regionCode === 'uae') {
    if (task.task_code === 't01_confirm_legal_structure') {
      return {
        ...task,
        instructions: 'Decide the legal structure and operating path before registration begins. In the UAE, first confirm whether the business will operate on the mainland or in a free zone, because that changes the registration and licensing route.',
        requirements: ['owner or founder details', 'chosen business activity', 'mainland or free zone decision', 'UAE passport or ID details where applicable'],
        where_to_do_this: ['UAE official business setup guidance', 'relevant free zone authority if applicable', 'setup notes document'],
        record_and_save: ['chosen legal structure', 'mainland or free zone decision', 'save in the Business Setup folder'],
      };
    }
    if (task.task_code === 't01_confirm_registration_route') {
      return {
        ...task,
        instructions: 'First confirm whether the business will operate on the mainland or in a free zone. Then match the chosen business activity and legal structure to the correct registration and licensing route. Do not start the application until this is clear.',
        requirements: ['chosen business structure', 'chosen business activity', 'owner details', 'mainland or free zone decision', 'confirmation that the business will operate in the UAE'],
        where_to_do_this: ['UAE official business guidance', 'relevant mainland or free zone authority', 'setup notes or checklist'],
        record_and_save: ['confirmed registration route', 'licensing route note', 'save in the Business Setup folder'],
      };
    }
    if (task.task_code === 't02_complete_registration_process') {
      return {
        ...task,
        instructions: 'Complete the licence and registration process using the correct trade name, business activity, owner details, and contact information. Make sure the same details are used consistently throughout the application.',
        requirements: ['trade name', 'business activity', 'owner or shareholder details', 'contact details', 'office or address details where required', 'payment method if fees apply'],
        where_to_do_this: ['relevant mainland authority or free zone authority', 'internet access', 'scanned documents or clear copies if needed'],
        record_and_save: ['licence or registration confirmation', 'trade licence details', 'proof of submission', 'save in the Business Setup folder and cloud backup'],
      };
    }
    if (task.task_code === 't03_save_registration_tax_details') {
      return {
        ...task,
        instructions: 'Once registration is complete, save the licence, registration details, and tax administration details together in one place. These details will be needed later for banking, invoicing, tax, and compliance.',
        requirements: ['official business name', 'licence or registration number', 'registration date', 'FTA access details if applicable'],
        where_to_do_this: ['secure cloud storage', 'password manager', 'FTA / EmaraTax account if applicable'],
        record_and_save: ['licence or registration proof', 'registration number', 'corporate tax registration details if applicable', 'VAT registration details if applicable', 'save in the Business Setup and Tax folders'],
      };
    }
    if (task.task_code === 't01_open_business_account') {
      return {
        ...task,
        instructions: 'Open the business bank account the company will use for all business income and business expenses before trading begins. Use the official licence and registration details when applying and confirm the account is active before launch.',
        requirements: ['passport or Emirates ID where applicable', 'phone number', 'email address', 'licence or registration number', 'registration or licence documents', 'proof of address if required by the bank', 'owner or authorised signatory details'],
        where_to_do_this: ['bank business account application portal or branch', 'scanned or photographed documents', 'phone and email for verification'],
        record_and_save: ['bank name', 'account type', 'account opening confirmation', 'account details for invoices', 'save in the Banking or Finance Setup folder'],
      };
    }
    if (task.task_code === 't02_set_payment_method_launch') {
      return {
        ...task,
        instructions: 'Decide how customers will pay the business when trading begins. Keep this simple. For many UAE service businesses, invoice and bank transfer are enough at launch. Only add a payment gateway or card collection if it is needed immediately.',
        requirements: ['active business bank account', 'clear customer payment method', 'invoice template', 'payment terms'],
        where_to_do_this: ['invoicing template or invoicing software', 'business bank account', 'optional payment platform if needed'],
        record_and_save: ['chosen payment method', 'invoice template', 'payment terms', 'customer payment instructions', 'save in the Sales Admin or Finance folder'],
      };
    }
    if (task.task_code === 't03_separate_business_money') {
      return {
        ...task,
        instructions: 'Use the business bank account for all business income and business expenses from the first day of trading. Do not run customer payments or business costs through a personal account once the business is operating.',
        requirements: ['active business bank account', 'bookkeeping method', 'clear rule for owner contributions and withdrawals'],
        where_to_do_this: ['business bank account', 'bookkeeping spreadsheet or bookkeeping software'],
        record_and_save: ['rule for owner money paid into the business', 'rule for owner money taken from the business', 'first business transaction date', 'save in the Finance Policy or Bookkeeping Setup file'],
      };
    }
    if (task.task_code === 't01_choose_bookkeeping_method') {
      return {
        ...task,
        instructions: 'Choose how the business will record sales, expenses, invoices, and tax-related documents from the start. Use a method that is simple enough to keep updated every week.',
        requirements: ['person responsible for keeping records', 'chosen bookkeeping method', 'routine for updating records', 'storage location for documents'],
        where_to_do_this: ['spreadsheet, Google Sheets, Excel, or bookkeeping software'],
        record_and_save: ['chosen bookkeeping method', 'person responsible', 'update routine', 'save in the Finance Setup file'],
      };
    }
    if (task.task_code === 't02_set_income_expense_categories') {
      return {
        ...task,
        instructions: 'Create the main categories the business will use to record income and expenses. Keep the list simple and practical so it supports invoicing, expense tracking, and tax administration.',
        requirements: ['list of income types', 'list of expense types', 'understanding of main business activities'],
        where_to_do_this: ['spreadsheet or bookkeeping software'],
        record_and_save: ['final category list', 'notes on how each category should be used', 'save in the Bookkeeping folder'],
      };
    }
    if (task.task_code === 't03_set_document_storage_method') {
      return {
        ...task,
        instructions: 'Choose one safe place to store invoices, receipts, bank statements, licence documents, and tax documents. Use the same folder structure every time so records stay organised and easy to find.',
        requirements: ['storage location', 'folder structure', 'file naming rule', 'routine for saving documents'],
        where_to_do_this: ['Google Drive, OneDrive, Dropbox, or secure local folder'],
        record_and_save: ['folder structure', 'file naming convention', 'storage location used', 'save in the Business Setup Guide or Finance Setup file'],
      };
    }
    if (task.task_code === 't01_confirm_tax_admin_path') {
      return {
        ...task,
        instructions: 'Make sure the business can access the correct tax administration path before launch. In the UAE, this means confirming whether Corporate Tax registration and VAT registration apply and making sure the relevant FTA access path is in place.',
        requirements: ['legal structure', 'licence or registration details', 'FTA access details if applicable', 'turnover expectation'],
        where_to_do_this: ['Federal Tax Authority / EmaraTax', 'accountant or tax advisor if needed'],
        record_and_save: ['corporate tax registration details if applicable', 'VAT registration details if applicable', 'FTA access details', 'save in the Tax folder'],
      };
    }
    if (task.task_code === 't02_confirm_privacy_basics') {
      return {
        ...task,
        instructions: 'If the business will collect customer, employee, or supplier personal information, set the basic rule for how that information will be stored and handled. Keep it simple, but do not ignore it.',
        requirements: ['customer or admin process', 'types of personal information collected', 'storage method used'],
        where_to_do_this: ['internal admin process', 'privacy note', 'advisor if needed'],
        record_and_save: ['data handling note', 'storage rule', 'save in the Compliance folder'],
      };
    }
    if (task.task_code === 't03_confirm_licence_requirements') {
      return {
        ...task,
        instructions: 'Check whether the business activity needs any licence, permit, or extra compliance step before launch. In the UAE, do not assume the licence already covers everything the business wants to do.',
        requirements: ['business activity', 'operating location', 'setup route', 'delivery model'],
        where_to_do_this: ['relevant mainland authority or free zone authority', 'regulator if the activity is regulated', 'advisor if the activity is unclear'],
        record_and_save: ['compliance check result', 'licence or permit requirement note', 'follow-up actions if applicable', 'save in the Compliance folder'],
      };
    }
  }
  if (regionCode === 'south_africa') {
    if (task.task_code === 't01_confirm_legal_structure') {
      return {
        ...task,
        instructions: 'Decide the legal structure you will use before registration begins. In South Africa, this usually means deciding whether you will operate as a sole proprietor or register a company.',
        requirements: ['owner or founder details', 'ownership position', 'South African ID or passport details', 'confirmation that the business will operate in South Africa'],
        where_to_do_this: ['CIPC BizPortal or CIPC eServices', 'notes document', 'accountant or business advisor if needed'],
        record_and_save: ['chosen legal structure', 'notes on why it was chosen', 'save in the Business Setup folder'],
      };
    }
    if (task.task_code === 't01_confirm_registration_route') {
      return {
        ...task,
        instructions: 'First confirm the legal structure you are using for the business. In South Africa, this usually means deciding whether you will operate as a sole proprietor or register a company. This matters because the registration and tax process is different for each one. Do not complete any forms until this is clear.',
        requirements: ['chosen business structure', 'founder or owner details', 'South African ID or passport details', 'confirmation that the business will operate in South Africa'],
        where_to_do_this: ['CIPC BizPortal or CIPC eServices', 'SARS eFiling', 'notes document or checklist'],
        record_and_save: ['chosen legal structure', 'confirmed registration route', 'save in the Business Setup folder'],
      };
    }
    if (task.task_code === 't02_complete_registration_process') {
      return {
        ...task,
        instructions: 'If you are registering a company, complete the company registration through CIPC using the correct business and owner details. If you are operating as a sole proprietor, make sure your personal tax setup is in order because the business income will be linked to you personally. Before submitting anything, check that the business name, owner details, and contact details are correct and consistent.',
        requirements: ['business name', 'owner or director details', 'South African ID or passport', 'contact details', 'business address', 'payment method if fees apply'],
        where_to_do_this: ['CIPC BizPortal or CIPC eServices', 'internet access', 'scanned documents or clear copies if needed'],
        record_and_save: ['registration confirmation', 'company registration number if applicable', 'proof of submission', 'save in the Business Setup folder and cloud backup'],
      };
    }
    if (task.task_code === 't03_save_registration_tax_details') {
      return {
        ...task,
        instructions: 'Once registration is complete, save all official details together in one place. These details will be needed later for banking, tax, bookkeeping, contracts, and compliance. Make sure they are easy to find and stored safely.',
        requirements: ['official business name', 'registration number if applicable', 'registration date', 'SARS income tax reference number', 'eFiling access details'],
        where_to_do_this: ['secure cloud storage', 'password manager', 'SARS eFiling account'],
        record_and_save: ['registration certificate', 'CIPC number', 'SARS tax number', 'eFiling login reference', 'save in the Business Setup and Tax folders'],
      };
    }
    if (task.task_code === 't01_open_business_account') {
      return {
        ...task,
        instructions: 'Open the bank account the business will use for all business income and business expenses. This should be done before the business starts trading. Use the official business details from registration when applying. Make sure the account is active and ready to receive payments before launch.',
        requirements: ['South African ID or passport', 'cellphone number', 'email address', 'CIPC registration number if registered company', 'registration documents if applicable', 'proof of address if required by the bank', 'director mandate or resolution if applicable'],
        where_to_do_this: ['bank business account application portal or branch', 'scanned or photographed documents', 'phone and email for verification'],
        record_and_save: ['bank name', 'account type', 'account opening confirmation', 'account details for invoices', 'save in the Banking or Finance Setup folder'],
      };
    }
    if (task.task_code === 't02_set_payment_method_launch') {
      return {
        ...task,
        instructions: 'Decide how customers will pay the business when trading begins. Keep this simple. For many South African service businesses, starting with invoice and EFT or bank transfer is enough. Only add extra payment methods if they are needed for launch.',
        requirements: ['active business bank account', 'clear customer payment method', 'invoice template', 'payment terms'],
        where_to_do_this: ['invoicing template or invoicing software', 'business bank account', 'optional payment platform if needed'],
        record_and_save: ['chosen payment method', 'invoice template', 'payment terms', 'customer payment instructions', 'save in the Sales Admin or Finance folder'],
      };
    }
    if (task.task_code === 't03_separate_business_money') {
      return {
        ...task,
        instructions: 'Use the business bank account for all business income and business expenses from the first day of trading. Do not run customer payments or business costs through your personal account once the business is operating. This keeps the records clean and makes bookkeeping and tax easier.',
        requirements: ['active business bank account', 'bookkeeping method', 'clear rule for owner contributions and withdrawals'],
        where_to_do_this: ['business bank account', 'bookkeeping spreadsheet or bookkeeping software'],
        record_and_save: ['rule for owner money paid into the business', 'rule for owner money taken from the business', 'first business transaction date', 'save in the Finance Policy or Bookkeeping Setup file'],
      };
    }
    if (task.task_code === 't01_choose_bookkeeping_method') {
      return {
        ...task,
        instructions: 'Choose how the business will record sales, expenses, and financial documents from the start. Use a method that is simple enough to keep updated every week. A basic system that is used consistently is better than a complicated system that is ignored.',
        requirements: ['person responsible for keeping records', 'chosen bookkeeping method', 'routine for updating records', 'storage location for documents'],
        where_to_do_this: ['spreadsheet, Google Sheets, Excel, or bookkeeping software'],
        record_and_save: ['chosen bookkeeping method', 'person responsible', 'update routine', 'save in the Finance Setup file'],
      };
    }
    if (task.task_code === 't02_set_income_expense_categories') {
      return {
        ...task,
        instructions: 'Create the main categories the business will use to record money coming in and money going out. Keep the list simple and practical so it matches how the business actually operates. Do not create too many categories at the start.',
        requirements: ['list of income types', 'list of expense types', 'understanding of main business activities'],
        where_to_do_this: ['spreadsheet or bookkeeping software'],
        record_and_save: ['final category list', 'notes on how each category should be used', 'save in the Bookkeeping folder'],
      };
    }
    if (task.task_code === 't03_set_document_storage_method') {
      return {
        ...task,
        instructions: 'Choose one safe place to store invoices, receipts, bank statements, registration documents, and tax documents. Use the same folder structure every time so records stay organised and easy to find.',
        requirements: ['storage location', 'folder structure', 'file naming rule', 'routine for saving documents'],
        where_to_do_this: ['Google Drive, OneDrive, Dropbox, or secure local folder'],
        record_and_save: ['folder structure', 'file naming convention', 'storage location used', 'save in the Business Setup Guide or Finance Setup file'],
      };
    }
    if (task.task_code === 't01_confirm_tax_admin_path') {
      return {
        ...task,
        instructions: 'Make sure the business can access the correct tax administration path before launch. In South Africa, this means ensuring the correct SARS reference and eFiling access are in place for the chosen setup.',
        requirements: ['legal structure', 'registration details if applicable', 'SARS access details'],
        where_to_do_this: ['SARS eFiling', 'accountant or tax practitioner if needed'],
        record_and_save: ['SARS tax number', 'eFiling access details', 'tax setup note', 'save in the Tax folder'],
      };
    }
    if (task.task_code === 't02_confirm_privacy_basics') {
      return {
        ...task,
        instructions: 'If the business will collect customer, employee, or supplier personal information, set the basic rule for how that information will be stored and handled. Keep it simple, but do not ignore it.',
        requirements: ['customer or admin process', 'types of personal information collected', 'storage method used'],
        where_to_do_this: ['internal admin process', 'privacy note', 'advisor if needed'],
        record_and_save: ['data handling note', 'storage rule', 'save in the Compliance folder'],
      };
    }
    if (task.task_code === 't03_confirm_licence_requirements') {
      return {
        ...task,
        instructions: 'Check whether the business activity needs any licence, permit, or extra compliance step before launch. If it does, do not ignore it or assume it can wait.',
        requirements: ['business activity', 'operating location', 'setup route', 'delivery model'],
        where_to_do_this: ['relevant regulator or authority', 'municipality if relevant', 'advisor if the activity is regulated'],
        record_and_save: ['compliance check result', 'licence or permit requirement note', 'follow-up actions if applicable', 'save in the Compliance folder'],
      };
    }
  }
  return task;
}

function applyBusinessTypeText(task, businessTypeCode) {
  if (businessTypeCode === 'professional_services') {
    if (task.task_code === 't02_set_launch_pricing') {
      return {
        ...task,
        instructions: 'Set the pricing the business will use for consulting or service work at launch. Make sure the price is clear enough to use in a quote, proposal, or rate card and simple enough to explain to a client without reworking it every time.',
        requirements: ['launch offer', 'price basis', 'expected payment timing', 'whether the work is project-based, retainer-based, hourly, or package-based'],
        where_to_do_this: ['pricing worksheet', 'proposal template', 'quote template or rate card'],
        record_and_save: ['final launch pricing', 'consulting rate card or package sheet', 'pricing notes', 'save in the Sales Setup folder'],
      };
    }
    if (task.task_code === 't03_set_payment_terms') {
      return {
        ...task,
        instructions: 'Set the payment terms the business will use when dealing with clients. Be clear on whether you require a deposit, when invoices are issued, when payment is due, and what happens if work changes or payment is late.',
        requirements: ['launch pricing', 'payment method', 'sales model', 'decision on deposit or milestone billing if relevant'],
        where_to_do_this: ['invoice template', 'proposal template', 'engagement letter or terms note'],
        record_and_save: ['payment terms', 'deposit rule if applicable', 'late payment rule', 'client payment instructions', 'save in the Sales Setup folder'],
      };
    }
    if (task.task_code === 't01_set_enquiry_channel') {
      return {
        ...task,
        instructions: 'Choose the channels clients will use to contact the business at launch. For consulting or service work, keep this tight and make sure someone is clearly responsible for responding to enquiries quickly and professionally.',
        requirements: ['target customer', 'communication channels', 'owner or sales contact'],
        where_to_do_this: ['business email', 'business phone number', 'LinkedIn, website form, or WhatsApp Business if relevant'],
        record_and_save: ['enquiry channels', 'response contact details', 'response owner', 'save in the Sales Admin folder'],
      };
    }
    if (task.task_code === 't02_set_offer_presentation_method') {
      return {
        ...task,
        instructions: 'Decide how the service offer will be presented to clients. For consulting or professional services, this should usually be through a proposal, quote, service sheet, or rate card that can be used consistently.',
        requirements: ['launch offer', 'launch pricing', 'customer contact process'],
        where_to_do_this: ['proposal template', 'quote template', 'service sheet or rate card'],
        record_and_save: ['final offer presentation method', 'template used', 'save in the Sales Admin folder'],
      };
    }
    if (task.task_code === 't03_set_customer_acceptance_step') {
      return {
        ...task,
        instructions: 'Define what counts as a client saying yes before work starts. For consulting or service work, this should usually be a signed proposal, approved quote, engagement email, or other clear written acceptance.',
        requirements: ['offer presentation method', 'payment terms', 'chosen sales process'],
        where_to_do_this: ['proposal approval process', 'quote acceptance step', 'engagement email or signed instruction'],
        record_and_save: ['acceptance method', 'client acceptance rule', 'template or process used', 'save in the Sales Admin folder'],
      };
    }
    if (task.task_code === 't04_set_payment_trigger') {
      return {
        ...task,
        instructions: 'Define exactly when the client is invoiced or asked for payment. Set this before launch so the business does not improvise payment timing client by client.',
        requirements: ['payment terms', 'customer acceptance step', 'launch pricing'],
        where_to_do_this: ['invoice template', 'proposal template', 'sales process note'],
        record_and_save: ['payment trigger point', 'invoice timing rule', 'save in the Sales Admin folder'],
      };
    }
    if (task.task_code === 't01_list_delivery_steps') {
      return {
        ...task,
        instructions: 'Write down the steps the business will follow from accepted client work to completed delivery. For consulting or service work, this usually includes onboarding, discovery, delivery, review, signoff, and closeout.',
        requirements: ['launch offer', 'customer acceptance method', 'service delivery model'],
        where_to_do_this: ['process note', 'workflow checklist', 'operations document'],
        record_and_save: ['delivery step list', 'service workflow draft', 'save in the Operations Setup folder'],
      };
    }
    if (task.task_code === 't02_set_completion_point') {
      return {
        ...task,
        instructions: 'Define when the client work is considered complete. For consulting or professional services, this should be linked to a clear delivery outcome, review point, or signoff step so there is no confusion later.',
        requirements: ['delivery workflow', 'offer scope', 'client expectation'],
        where_to_do_this: ['workflow checklist', 'closeout note', 'signoff template if relevant'],
        record_and_save: ['completion standard', 'signoff rule if applicable', 'save in the Operations Setup folder'],
      };
    }
    if (task.task_code === 't03_set_issue_handling_rule') {
      return {
        ...task,
        instructions: 'Decide how the business will handle client issues, complaints, rework, or changes in scope. For consulting or service work, this should be clear before launch so delivery problems do not turn into commercial problems later.',
        requirements: ['delivery workflow', 'completion point', 'customer contact process'],
        where_to_do_this: ['issue handling note', 'revision or scope-change rule', 'client support or escalation channel'],
        record_and_save: ['issue handling rule', 'scope-change rule if applicable', 'save in the Operations Setup folder'],
      };
    }
  }
  if (businessTypeCode === 'retail_shop') {
    if (task.task_code === 't02_set_payment_method_launch') {
      return {
        ...task,
        instructions: 'Decide how customers will pay the shop when trading begins. Keep this practical for retail trading. At launch, this usually means cash, card, EFT, or a simple POS route only if needed.',
        requirements: ['active business bank account', 'customer payment method', 'POS decision if relevant', 'refund rule if relevant'],
        where_to_do_this: ['business bank account', 'card/POS provider if needed', 'cash-handling note'],
        record_and_save: ['chosen payment methods', 'POS details if applicable', 'customer payment instructions', 'save in the Sales Admin or Finance folder'],
      };
    }
    if (task.task_code === 't01_list_delivery_steps') {
      return {
        ...task,
        instructions: 'Write down the basic operating flow for the shop from opening to sale to closing. Include how stock is received, how sales happen, and what must be checked at the end of the day.',
        requirements: ['launch offer', 'payment method', 'shop operating model'],
        where_to_do_this: ['shop operations checklist', 'opening and closing note', 'store process document'],
        record_and_save: ['shop workflow', 'opening routine', 'closing routine', 'save in the Operations Setup folder'],
      };
    }
  }
  if (businessTypeCode === 'software_saas') {
    if (task.task_code === 't02_set_offer_presentation_method') {
      return {
        ...task,
        instructions: 'Decide how the product or service will be presented to users at launch. For software or SaaS, this may be a pricing page, demo deck, onboarding email, or short product sheet that explains the offer clearly.',
        requirements: ['launch offer', 'launch pricing', 'customer contact process'],
        where_to_do_this: ['pricing page draft', 'product sheet', 'demo or onboarding material'],
        record_and_save: ['final presentation method', 'pricing page or product sheet', 'save in the Sales Admin folder'],
      };
    }
    if (task.task_code === 't01_list_delivery_steps') {
      return {
        ...task,
        instructions: 'Write down the steps from sign-up or sale to first value for the user. For software or SaaS, this should include onboarding, activation, support handoff, and what happens if the user gets stuck.',
        requirements: ['launch offer', 'customer acceptance method', 'software delivery model'],
        where_to_do_this: ['onboarding checklist', 'activation workflow', 'operations document'],
        record_and_save: ['delivery step list', 'onboarding workflow', 'save in the Operations Setup folder'],
      };
    }
  }
  return task;
}


export function getBrImplementationBlueprint(input?: { businessTypeCode?: string | null; regionCode?: string | null }) {
  const regionCode = input?.regionCode || '';
  const businessTypeCode = input?.businessTypeCode || '';
  return COMMON_STRUCTURE.map((phase) => ({
    ...phase,
    sections: phase.sections.map((section) => ({
      ...section,
      actions: section.actions.map((action) => ({
        ...action,
        tasks: action.tasks.map((task) => applyBusinessTypeText(applyRegionText(task, regionCode), businessTypeCode)),
      })),
    })),
  }));
}

export function getBrActionBlueprints(input?: { businessTypeCode?: string | null; regionCode?: string | null }) {
  return getBrImplementationBlueprint(input).flatMap((phase) =>
    phase.sections.flatMap((section) =>
      section.actions.map((action) => ({
        ...action,
        phase_code: phase.phase_code,
        phase_name: phase.phase_name,
        section_code: section.section_code,
        section_name: section.section_name,
      })),
    ),
  );
}

export function buildBrTaskTemplates(input?: { businessTypeCode?: string | null; regionCode?: string | null }) {
  return getBrActionBlueprints(input).flatMap((action) =>
    action.tasks.map((task, index) => ({
      code: task.task_code,
      domain_code: action.section_code,
      phase_code: action.phase_code,
      role: 'setup',
      title: task.task_title,
      description: task.instructions,
      required: !task.optional,
      launch_critical: Boolean(action.launch_critical),
      evidence_required: false,
      sort_order: Number(index + 1),
      action_code: action.action_code,
      action_title: action.action_title,
      section_name: action.section_name,
      instructions: task.instructions,
      requirements: task.requirements || [],
      where_to_do_this: task.where_to_do_this || [],
      record_and_save: task.record_and_save || [],
      optional: Boolean(task.optional),
    })),
  );
}
