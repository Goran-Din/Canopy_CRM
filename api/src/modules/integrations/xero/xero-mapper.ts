// ============================================
// Xero Data Mapper — CRM ↔ Xero transformations
// ============================================

export interface XeroContact {
  Name: string;
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  Phones?: Array<{ PhoneType: string; PhoneNumber: string }>;
  Addresses?: Array<{
    AddressType: string;
    AddressLine1?: string;
    City?: string;
    Region?: string;
    PostalCode?: string;
    Country?: string;
  }>;
  ContactStatus?: string;
  IsCustomer?: boolean;
}

export interface XeroLineItem {
  Description: string;
  Quantity: number;
  UnitAmount: number;
  AccountCode: string;
  TaxType?: string;
}

export interface XeroInvoice {
  Type: string;
  Contact: { ContactID: string };
  Date: string;
  DueDate: string;
  LineAmountTypes: string;
  LineItems: XeroLineItem[];
  Reference?: string;
  Status: string;
  CurrencyCode: string;
}

export interface XeroPayment {
  Invoice: { InvoiceID: string };
  Account: { Code: string };
  Date: string;
  Amount: number;
  Reference?: string;
}

export interface XeroCreditNote {
  Type: string;
  Contact: { ContactID: string };
  Date: string;
  LineAmountTypes: string;
  LineItems: XeroLineItem[];
  Reference?: string;
  Status: string;
  CurrencyCode: string;
}

export function mapCustomerToXeroContact(customer: Record<string, unknown>): XeroContact {
  const phones: XeroContact['Phones'] = [];
  if (customer.phone) phones.push({ PhoneType: 'DEFAULT', PhoneNumber: customer.phone as string });
  if (customer.mobile) phones.push({ PhoneType: 'MOBILE', PhoneNumber: customer.mobile as string });

  const addresses: XeroContact['Addresses'] = [];
  if (customer.address_line1 || customer.city) {
    addresses.push({
      AddressType: 'STREET',
      AddressLine1: (customer.address_line1 as string) || undefined,
      City: (customer.city as string) || undefined,
      Region: (customer.state as string) || undefined,
      PostalCode: (customer.zip as string) || undefined,
      Country: 'CA',
    });
  }

  return {
    Name: (customer.display_name as string) || (customer.company_name as string) || 'Unknown',
    FirstName: (customer.first_name as string) || undefined,
    LastName: (customer.last_name as string) || undefined,
    EmailAddress: (customer.email as string) || undefined,
    Phones: phones.length > 0 ? phones : undefined,
    Addresses: addresses.length > 0 ? addresses : undefined,
    ContactStatus: 'ACTIVE',
    IsCustomer: true,
  };
}

export function mapInvoiceToXeroInvoice(
  invoice: Record<string, unknown>,
  lineItems: Array<Record<string, unknown>>,
  xeroContactId: string,
): XeroInvoice {
  return {
    Type: 'ACCREC',
    Contact: { ContactID: xeroContactId },
    Date: (invoice.invoice_date as string) || new Date().toISOString().split('T')[0],
    DueDate: (invoice.due_date as string) || '',
    LineAmountTypes: 'Exclusive',
    LineItems: lineItems.map(item => ({
      Description: (item.description as string) || '',
      Quantity: (item.quantity as number) || 1,
      UnitAmount: (item.unit_price as number) || 0,
      AccountCode: '200',
      TaxType: 'OUTPUT',
    })),
    Reference: (invoice.invoice_number as string) || undefined,
    Status: 'AUTHORISED',
    CurrencyCode: 'CAD',
  };
}

export function mapPaymentToXeroPayment(
  payment: Record<string, unknown>,
  xeroInvoiceId: string,
): XeroPayment {
  return {
    Invoice: { InvoiceID: xeroInvoiceId },
    Account: { Code: '090' },
    Date: (payment.payment_date as string) || new Date().toISOString().split('T')[0],
    Amount: (payment.amount as number) || 0,
    Reference: (payment.reference as string) || undefined,
  };
}

export function mapCreditNoteToXeroCreditNote(
  creditNote: Record<string, unknown>,
  xeroContactId: string,
): XeroCreditNote {
  return {
    Type: 'ACCRECCREDIT',
    Contact: { ContactID: xeroContactId },
    Date: (creditNote.issued_date as string) || new Date().toISOString().split('T')[0],
    LineAmountTypes: 'Exclusive',
    LineItems: [{
      Description: (creditNote.reason as string) || 'Credit Note',
      Quantity: 1,
      UnitAmount: (creditNote.amount as number) || 0,
      AccountCode: '200',
    }],
    Reference: (creditNote.credit_note_number as string) || undefined,
    Status: 'AUTHORISED',
    CurrencyCode: 'CAD',
  };
}

// === V2: Recurring Invoice Item Code Mapping ===

const ITEM_CODE_MAP: Record<string, string> = {
  gold: '4210-COMM-001',
  silver: '4210-COMM-001',
  bronze_per_cut: '4210-MAINT-001',
  bronze_flat_monthly: '4210-MAINT-001',
  snow_seasonal: '4350-SNOW-002',
  snow_per_event_plow: '4350-SNOW-002',
  snow_per_event_salt: '4350-SNOW-005',
  snow_calcium: '4260-MAT-006',
};

export function mapInvoiceToXeroLineItem(
  lineItem: Record<string, unknown>,
  invoiceType: string,
): { ItemCode: string; Description: string; Quantity: number; UnitAmount: number; AccountCode: string; TaxType: string } {
  const itemCode = ITEM_CODE_MAP[invoiceType]
    ?? (lineItem.xero_item_code as string)
    ?? '4210-MAINT-001';

  return {
    ItemCode: itemCode,
    Description: (lineItem.description as string) || '',
    Quantity: Number(lineItem.quantity) || 1,
    UnitAmount: Number(lineItem.unit_price) || 0,
    AccountCode: '200',
    TaxType: 'OUTPUT',
  };
}

export function buildXeroReference(
  invoiceType: string,
  meta: Record<string, unknown>,
): string {
  const jobNumber = meta.job_number ? `Job #${meta.job_number}` : '';

  switch (invoiceType) {
    case 'gold':
    case 'silver':
      return `Canopy CRM — Invoice ${meta.invoice_number_in_season ?? ''} of ${meta.total_invoices ?? 8} — Season ${meta.year ?? ''}`;
    case 'bronze_per_cut':
      return `Canopy CRM — Weekly Mowing — ${meta.month ?? ''}`;
    case 'bronze_flat_monthly':
      return `Canopy CRM — Monthly Lawn Mowing — ${meta.month ?? ''}`;
    case 'snow_seasonal':
      return `Canopy CRM — Snow Service — ${meta.month ?? ''}`;
    case 'landscape_project':
      return `Canopy CRM — ${jobNumber}`;
    case 'hardscape_milestone':
      return `Canopy CRM — ${meta.milestone_name ?? ''} — ${jobNumber}`;
    default:
      return `Canopy CRM — ${jobNumber || meta.description || ''}`;
  }
}
