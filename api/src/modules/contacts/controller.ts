import type { Request, Response, NextFunction } from 'express';
import * as contactService from './service.js';

export async function listContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await contactService.listContacts(req.tenantId!, req.query as never);
    res.json({ status: 'success', ...result });
  } catch (err) {
    next(err);
  }
}

export async function getContact(req: Request, res: Response, next: NextFunction) {
  try {
    const contact = await contactService.getContact(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: contact });
  } catch (err) {
    next(err);
  }
}

export async function getContactsByCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const contacts = await contactService.getContactsByCustomer(
      req.tenantId!,
      req.params.customerId,
    );
    res.json({ status: 'success', data: contacts });
  } catch (err) {
    next(err);
  }
}

export async function getContactsByProperty(req: Request, res: Response, next: NextFunction) {
  try {
    const contacts = await contactService.getContactsByProperty(
      req.tenantId!,
      req.params.propertyId,
    );
    res.json({ status: 'success', data: contacts });
  } catch (err) {
    next(err);
  }
}

export async function createContact(req: Request, res: Response, next: NextFunction) {
  try {
    const contact = await contactService.createContact(req.tenantId!, req.body, req.user!.id);
    res.status(201).json({ status: 'success', data: contact });
  } catch (err) {
    next(err);
  }
}

export async function updateContact(req: Request, res: Response, next: NextFunction) {
  try {
    const contact = await contactService.updateContact(
      req.tenantId!,
      req.params.id,
      req.body,
      req.user!.id,
    );
    res.json({ status: 'success', data: contact });
  } catch (err) {
    next(err);
  }
}

export async function deleteContact(req: Request, res: Response, next: NextFunction) {
  try {
    await contactService.deleteContact(req.tenantId!, req.params.id);
    res.json({ status: 'success', message: 'Contact deleted' });
  } catch (err) {
    next(err);
  }
}

export async function setPrimary(req: Request, res: Response, next: NextFunction) {
  try {
    const contact = await contactService.setPrimaryContact(req.tenantId!, req.params.id);
    res.json({ status: 'success', data: contact });
  } catch (err) {
    next(err);
  }
}
