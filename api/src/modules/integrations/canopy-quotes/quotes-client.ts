import { logger } from '../../../config/logger.js';

export class CanopyQuotesClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: { baseUrl: string; apiKey: string }) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }

  async sendStatusWebhook(payload: {
    source_quote_number: string;
    crm_job_id: string;
    job_number: string;
    status: string;
    updated_at: string;
    details?: Record<string, unknown>;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/webhooks/crm-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Canopy Quotes webhook failed: ${response.status}`);
      }

      return { success: true };
    } catch (error) {
      logger.error('Canopy Quotes webhook error', { error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }
  }
}
