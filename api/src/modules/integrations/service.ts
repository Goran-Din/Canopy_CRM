import { AppError } from '../../middleware/errorHandler.js';
import type { UpdateConfigInput, ConnectInput, SyncLogQuery } from './schema.js';
import * as repo from './repository.js';

// ======== Integration Config Management ========

export async function listIntegrations(tenantId: string) {
  return repo.findAllConfigs(tenantId);
}

export async function getIntegration(tenantId: string, provider: string) {
  const config = await repo.findConfigByProvider(tenantId, provider);
  if (!config) {
    throw new AppError(404, `Integration for ${provider} not found`);
  }
  // Strip sensitive tokens from response
  return {
    ...config,
    access_token_encrypted: config.access_token_encrypted ? '***' : null,
    refresh_token_encrypted: config.refresh_token_encrypted ? '***' : null,
  };
}

export async function updateConfig(tenantId: string, provider: string, input: UpdateConfigInput, userId: string) {
  return repo.upsertConfig(tenantId, provider, input as Record<string, unknown>, userId);
}

export async function connect(tenantId: string, provider: string, input: ConnectInput, userId: string) {
  // Upsert config with provided data
  const config = await repo.upsertConfig(tenantId, provider, {
    config_data: input.config_data || {},
  }, userId);

  // If authorization_code is provided, exchange it for tokens
  // This would be provider-specific — delegate to provider client
  if (input.authorization_code) {
    // For now, mark as active (actual token exchange happens in provider-specific code)
    await repo.updateConfigStatus(tenantId, provider, 'active');
  } else {
    await repo.updateConfigStatus(tenantId, provider, 'pending_setup');
  }

  return repo.findConfigByProvider(tenantId, provider);
}

export async function disconnect(tenantId: string, provider: string) {
  const config = await repo.findConfigByProvider(tenantId, provider);
  if (!config) {
    throw new AppError(404, `Integration for ${provider} not found`);
  }
  await repo.updateConfigStatus(tenantId, provider, 'inactive', {
    access_token_encrypted: null,
    refresh_token_encrypted: null,
    token_expires_at: null,
  });
  return { message: `${provider} disconnected` };
}

// ======== Sync Log ========

export async function getSyncLogs(tenantId: string, query: SyncLogQuery) {
  const { rows, total } = await repo.findSyncLogs(tenantId, query);
  return {
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getSyncLogsByEntity(tenantId: string, entityId: string) {
  return repo.findSyncLogsByEntity(tenantId, entityId);
}

// ======== Helpers for provider services ========

export async function getActiveConfig(tenantId: string, provider: string) {
  const config = await repo.findConfigByProvider(tenantId, provider);
  if (!config) {
    throw new AppError(404, `${provider} integration not configured`);
  }
  if (config.status !== 'active') {
    throw new AppError(400, `${provider} integration is not active (status: ${config.status})`);
  }
  return config;
}
