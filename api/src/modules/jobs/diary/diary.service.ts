import { AppError } from '../../../middleware/errorHandler.js';
import * as diaryRepo from './diary.repository.js';
import * as jobRepo from '../repository.js';
import type { DiaryQuery, AddDiaryNoteInput } from './diary.schema.js';

export async function listDiaryEntries(
  tenantId: string,
  jobId: string,
  query: DiaryQuery,
) {
  const job = await jobRepo.findById(tenantId, jobId);
  if (!job) {
    throw new AppError(404, 'Job not found');
  }

  const { rows, total } = await diaryRepo.findByJobId(
    tenantId,
    jobId,
    query.page,
    query.limit,
    query.entry_type,
  );

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

export async function addDiaryNote(
  tenantId: string,
  jobId: string,
  input: AddDiaryNoteInput,
  userId: string,
) {
  const job = await jobRepo.findById(tenantId, jobId);
  if (!job) {
    throw new AppError(404, 'Job not found');
  }

  const title = `Note: ${input.body.substring(0, 50)}${input.body.length > 50 ? '...' : ''}`;

  return diaryRepo.insertStandalone({
    tenant_id: tenantId,
    job_id: jobId,
    entry_type: 'note_added',
    title,
    body: input.body,
    metadata: { added_by: userId },
    created_by_user_id: userId,
    is_system_entry: false,
  });
}
