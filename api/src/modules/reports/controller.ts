import type { Request, Response, NextFunction } from 'express';
import * as reportService from './service.js';

export async function revenueSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getRevenueSummary(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function revenueByDivision(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getRevenueByDivision(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function revenueByCustomer(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getRevenueByCustomer(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function invoiceAging(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getInvoiceAging(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function contractRenewals(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getContractRenewals(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function crewProductivity(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getCrewProductivity(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function timeTrackingSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getTimeTrackingSummary(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function snowProfitability(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getSnowProfitability(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function hardscapePipeline(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getHardscapePipeline(req.tenantId!);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function prospectConversion(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getProspectConversion(req.tenantId!);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function equipmentSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getEquipmentSummary(req.tenantId!);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}

export async function materialUsage(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getMaterialUsage(req.tenantId!, req.query as never);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
}
