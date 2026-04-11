import { logger } from '../../../config/logger.js';

export class MauticClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: { baseUrl: string; apiKey: string }) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
  }

  async pushContact(payload: {
    email: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    tags?: string[];
    customFields?: Record<string, unknown>;
  }): Promise<{ success: boolean; mautic_contact_id?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/contacts/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Mautic API error: ${response.status}`);
      }

      const data = await response.json() as Record<string, unknown>;
      const contact = data.contact as Record<string, unknown> | undefined;
      return { success: true, mautic_contact_id: contact?.id?.toString() };
    } catch (error) {
      logger.error('Mautic pushContact failed', { error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }
  }

  async addToSegment(contactId: string, segmentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/segments/${segmentId}/contact/${contactId}/add`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      if (!response.ok) throw new Error(`Mautic segment API error: ${response.status}`);
      return { success: true };
    } catch (error) {
      logger.error('Mautic addToSegment failed', { error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }
  }
}
