import { AppError } from '../../middleware/errorHandler.js';
import * as repo from './repository.js';
import * as quoteRepo from '../quotes/repository.js';
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  ListTemplatesInput,
  LoadTemplateInput,
  SaveFromQuoteInput,
  UpdateAutomationConfigInput,
} from './schema.js';

// === Templates CRUD ===

export async function listTemplates(
  tenantId: string,
  input: ListTemplatesInput,
) {
  const tags = input.tags ? input.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined;
  return repo.findAll(tenantId, {
    template_category: input.template_category,
    is_active: input.is_active,
    automation_type: input.automation_type,
    tags,
    page: input.page,
    limit: input.limit,
  });
}

export async function getTemplate(tenantId: string, templateId: string) {
  const template = await repo.findById(templateId, tenantId);
  if (!template) {
    throw new AppError(404, 'Template not found');
  }
  return template;
}

export async function createTemplate(
  tenantId: string,
  input: CreateTemplateInput,
  userId: string,
) {
  return repo.create({
    tenant_id: tenantId,
    template_category: input.template_category,
    template_name: input.template_name,
    description: input.description,
    is_active: input.is_active,
    is_system: input.is_system,
    content: input.content,
    channel: input.channel,
    automation_type: input.automation_type,
    tags: input.tags,
    created_by: userId,
  });
}

export async function updateTemplate(
  tenantId: string,
  templateId: string,
  input: UpdateTemplateInput,
  userId: string,
) {
  const existing = await repo.findById(templateId, tenantId);
  if (!existing) {
    throw new AppError(404, 'Template not found');
  }

  // Save version snapshot before updating
  const versionNum = await repo.getLatestVersionNumber(templateId);
  await repo.createVersion({
    template_id: templateId,
    version_number: versionNum + 1,
    content: existing.content,
    created_by: userId,
  });

  return repo.update(templateId, tenantId, {
    ...input,
    updated_by: userId,
  });
}

export async function deleteTemplate(tenantId: string, templateId: string) {
  const existing = await repo.findById(templateId, tenantId);
  if (!existing) {
    throw new AppError(404, 'Template not found');
  }

  if (existing.is_system) {
    throw new AppError(422, 'System templates cannot be deleted — deactivate instead');
  }

  await repo.softDelete(templateId, tenantId);
}

// === Quote Integration ===

export async function loadTemplateIntoQuote(
  quoteId: string,
  input: LoadTemplateInput,
  tenantId: string,
  _userId: string,
) {
  const template = await repo.findById(input.template_id, tenantId);
  if (!template) {
    throw new AppError(404, 'Template not found');
  }
  if (template.template_category !== 'quote') {
    throw new AppError(400, 'Only quote templates can be loaded into quotes');
  }

  const quote = await quoteRepo.getById(tenantId, quoteId);
  if (!quote) {
    throw new AppError(404, 'Quote not found');
  }

  const content = template.content as {
    sections?: Array<{
      section_title: string;
      section_body?: string;
      sort_order?: number;
      line_items?: Array<{
        item_name: string;
        description?: string;
        xero_item_code?: string;
        unit?: string;
        sort_order?: number;
      }>;
    }>;
  };

  if (!content.sections?.length) {
    throw new AppError(400, 'Template has no sections');
  }

  const client = await quoteRepo.acquireClient();
  try {
    await client.query('BEGIN');

    // Determine starting sort_order to APPEND after existing sections
    const existingSections = quote.sections ?? [];
    let sectionSort = existingSections.length;

    for (const tplSection of content.sections) {
      const section = await quoteRepo.insertSection(client, {
        tenant_id: tenantId,
        quote_id: quoteId,
        title: tplSection.section_title,
        body: tplSection.section_body ?? null,
        sort_order: tplSection.sort_order ?? sectionSort,
      });
      sectionSort++;

      if (tplSection.line_items?.length) {
        let itemSort = 0;
        for (const tplItem of tplSection.line_items) {
          await quoteRepo.insertLineItem(client, {
            tenant_id: tenantId,
            quote_id: quoteId,
            section_id: section.id,
            item_name: tplItem.item_name,
            description: tplItem.description ?? null,
            xero_item_code: tplItem.xero_item_code ?? null,
            quantity: null,
            unit: tplItem.unit ?? null,
            unit_price: null,
            line_total: 0,
            is_taxable: false,
            sort_order: tplItem.sort_order ?? itemSort,
          });
          itemSort++;
        }
      }
    }

    await client.query('COMMIT');
    return quoteRepo.getById(tenantId, quoteId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function saveQuoteAsTemplate(
  tenantId: string,
  input: SaveFromQuoteInput,
  userId: string,
) {
  const quote = await quoteRepo.getById(tenantId, input.quote_id);
  if (!quote) {
    throw new AppError(404, 'Quote not found');
  }

  // Extract structure, strip prices and quantities
  const sections = (quote.sections ?? []).map(s => ({
    section_title: s.section_title,
    section_body: s.section_body,
    sort_order: s.sort_order,
    line_items: (s.line_items ?? []).map(item => ({
      item_name: item.item_name,
      description: item.description,
      xero_item_code: item.xero_item_code ?? null,
      quantity: null,
      unit_price: null,
      unit: item.unit,
      sort_order: item.sort_order,
    })),
  }));

  return repo.saveFromQuote(tenantId, {
    template_name: input.template_name,
    content: { sections },
    tags: input.tags,
    created_by: userId,
  });
}

// === Automation Templates ===

export async function listAutomationTemplates(tenantId: string) {
  return repo.findAutomationTemplates(tenantId);
}

export async function updateAutomationConfig(
  tenantId: string,
  automationType: string,
  input: UpdateAutomationConfigInput,
  userId: string,
) {
  // Find existing automation template for this type
  const templates = await repo.findAutomationTemplates(tenantId);
  const existing = templates.find(t => t.automation_type === automationType);

  if (existing) {
    return repo.update(existing.id, tenantId, {
      content: input.content,
      channel: input.channel,
      is_active: input.is_active,
      updated_by: userId,
    });
  }

  // Create new automation template
  return repo.create({
    tenant_id: tenantId,
    template_category: 'automation',
    template_name: `${automationType} template`,
    content: input.content,
    channel: input.channel ?? 'email',
    automation_type: automationType,
    is_active: input.is_active ?? false,
    created_by: userId,
  });
}
