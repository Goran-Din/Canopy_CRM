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

// Error handling (must be last)
app.use(errorHandler);

export default app;
