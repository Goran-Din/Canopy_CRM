import type { Request, Response, NextFunction } from 'express';
import * as quoteService from './service.js';

// === Quotes ===

export async function createQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const quote = await quoteService.createQuote(
      req.tenantId!,
      req.params.jobId,
      req.body,
      req.user!.id,
    );
    res.status(201).json({ status: 'success', data: quote });
  } catch (err) {
    next(err);
  }
}

export async function getQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const quote = await quoteService.getQuote(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: quote });
  } catch (err) {
    next(err);
  }
}

export async function listQuoteVersions(req: Request, res: Response, next: NextFunction) {
  try {
    const quotes = await quoteService.listQuoteVersions(req.tenantId!, req.params.jobId);
    res.json({ status: 'success', data: quotes });
  } catch (err) {
    next(err);
  }
}

export async function updateQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const quote = await quoteService.updateQuote(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: quote });
  } catch (err) {
    next(err);
  }
}

// === Sections ===

export async function addSection(req: Request, res: Response, next: NextFunction) {
  try {
    const section = await quoteService.addSection(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.status(201).json({ status: 'success', data: section });
  } catch (err) {
    next(err);
  }
}

export async function updateSection(req: Request, res: Response, next: NextFunction) {
  try {
    const section = await quoteService.updateSection(
      req.tenantId!,
      req.params.quoteId,
      req.params.sectionId,
      req.body,
    );
    res.json({ status: 'success', data: section });
  } catch (err) {
    next(err);
  }
}

export async function deleteSection(req: Request, res: Response, next: NextFunction) {
  try {
    await quoteService.deleteSection(
      req.tenantId!,
      req.params.quoteId,
      req.params.sectionId,
    );
    res.json({ status: 'success', message: 'Section deleted' });
  } catch (err) {
    next(err);
  }
}

// === Line Items ===

export async function addLineItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await quoteService.addLineItem(
      req.tenantId!,
      req.params.quoteId,
      req.params.sectionId,
      req.body,
      req.user!.id,
    );
    res.status(201).json({ status: 'success', data: item });
  } catch (err) {
    next(err);
  }
}

export async function updateLineItem(req: Request, res: Response, next: NextFunction) {
  try {
    const item = await quoteService.updateLineItem(
      req.tenantId!,
      req.params.quoteId,
      req.params.sectionId,
      req.params.itemId,
      req.body,
    );
    res.json({ status: 'success', data: item });
  } catch (err) {
    next(err);
  }
}

export async function deleteLineItem(req: Request, res: Response, next: NextFunction) {
  try {
    await quoteService.deleteLineItem(
      req.tenantId!,
      req.params.quoteId,
      req.params.sectionId,
      req.params.itemId,
    );
    res.json({ status: 'success', message: 'Line item deleted' });
  } catch (err) {
    next(err);
  }
}

// === PDF & Send ===

export async function generatePdf(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await quoteService.generatePdf(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function sendQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await quoteService.sendQuote(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function sendQuoteV2(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await quoteService.sendQuoteV2(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function resendQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await quoteService.resendQuote(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function getSignedPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await quoteService.getSignedPdf(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function convertToInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await quoteService.convertToInvoice(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.status(201).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function loadTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await quoteService.loadTemplate(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

export async function saveAsTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await quoteService.saveAsTemplate(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.status(201).json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
}

// === Decline Quote ===

export async function declineQuote(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await quoteService.declineQuote(
      req.tenantId!, req.params.id, req.body, req.user!.id,
    );
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
}

// === Xero Items ===

export async function searchXeroItems(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await quoteService.searchXeroItems(
      req.tenantId!,
      req.query.search as string,
    );
    res.json({ status: 'success', data: items });
  } catch (err) {
    next(err);
  }
}

export async function searchXeroItemsGet(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await quoteService.searchXeroItems(
      req.tenantId!,
      req.query.search as string,
    );
    res.json({ status: 'success', data: items });
  } catch (err) {
    next(err);
  }
}
