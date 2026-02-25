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
