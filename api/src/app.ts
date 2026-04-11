import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import healthRoutes from './modules/health/routes.js';
import authRoutes from './modules/auth/routes.js';
import customerRoutes from './modules/customers/routes.js';
import propertyRoutes from './modules/properties/routes.js';
import contactRoutes from './modules/contacts/routes.js';
import contractRoutes from './modules/contracts/routes.js';
import jobRoutes from './modules/jobs/routes.js';
import crewRoutes from './modules/crews/routes.js';
import timeTrackingRoutes from './modules/time-tracking/routes.js';
import invoicingRoutes from './modules/invoicing/routes.js';
import disputeRoutes from './modules/disputes/routes.js';
import snowRoutes from './modules/snow/routes.js';
import hardscapeRoutes from './modules/hardscape/routes.js';
import prospectRoutes from './modules/prospects/routes.js';
import equipmentRoutes from './modules/equipment/routes.js';
import materialRoutes from './modules/materials/routes.js';
import subcontractorRoutes from './modules/subcontractors/routes.js';
import sopRoutes from './modules/sops/routes.js';
import integrationRoutes from './modules/integrations/routes.js';
import reportRoutes from './modules/reports/routes.js';
import notificationRoutes from './modules/notifications/routes.js';
import seasonalRoutes from './modules/seasonal/routes.js';
import userRoutes from './modules/users/routes.js';
import dispatchRoutes from './modules/dispatch/routes.js';
import fileRoutes from './modules/files/routes.js';
import quoteRoutes from './modules/quotes/routes.js';
import signatureRoutes from './modules/signatures/routes.js';
import serviceOccurrenceRoutes from './modules/service-occurrences/routes.js';
import billingRoutes from './modules/billing/routes.js';
import templateRoutes from './modules/templates/routes.js';
import automationRoutes from './modules/automations/routes.js';
import feedbackRoutes from './modules/feedback/routes.js';
import geofenceRoutes from './modules/geofence/routes.js';
import commandCenterRoutes from './modules/command-center/routes.js';

const app = express();

// Security
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use(healthRoutes);
app.use(authRoutes);
app.use(customerRoutes);
app.use(propertyRoutes);
app.use(contactRoutes);
app.use(contractRoutes);
app.use(jobRoutes);
app.use(crewRoutes);
app.use(timeTrackingRoutes);
app.use(invoicingRoutes);
app.use(disputeRoutes);
app.use(snowRoutes);
app.use(hardscapeRoutes);
app.use(prospectRoutes);
app.use(equipmentRoutes);
app.use(materialRoutes);
app.use(subcontractorRoutes);
app.use(sopRoutes);
app.use(integrationRoutes);
app.use(reportRoutes);
app.use(notificationRoutes);
app.use(seasonalRoutes);
app.use(userRoutes);
app.use(dispatchRoutes);
app.use(fileRoutes);
app.use(signatureRoutes);
app.use(quoteRoutes);
app.use(serviceOccurrenceRoutes);
app.use(billingRoutes);
app.use(templateRoutes);
app.use(automationRoutes);
app.use(feedbackRoutes);
app.use(geofenceRoutes);
app.use(commandCenterRoutes);

// Error handling (must be last)
app.use(errorHandler);

export default app;
