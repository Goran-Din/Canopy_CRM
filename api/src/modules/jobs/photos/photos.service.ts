import { AppError } from '../../../middleware/errorHandler.js';
import * as photosRepo from './photos.repository.js';
import * as jobRepo from '../repository.js';
import * as diaryRepo from '../diary/diary.repository.js';
import type { AddPhotoInput, UpdatePhotoInput } from './photos.schema.js';

export async function addPhoto(
  tenantId: string,
  jobId: string,
  input: AddPhotoInput,
  userId: string,
) {
  const job = await jobRepo.findById(tenantId, jobId);
  if (!job) {
    throw new AppError(404, 'Job not found');
  }

  // Business rule: after_work defaults portal_visible to true, all others default to false
  const portalVisible = input.portal_visible !== undefined
    ? input.portal_visible
    : input.photo_tag === 'after_work';

  const photo = await photosRepo.insertStandalone({
    tenant_id: tenantId,
    job_id: jobId,
    file_id: input.file_id,
    property_id: job.property_id,
    photo_tag: input.photo_tag,
    caption: input.caption,
    uploaded_by: userId,
    upload_source: input.upload_source,
    portal_visible: portalVisible,
  });

  // Create diary entry for photo upload
  await diaryRepo.insertStandalone({
    tenant_id: tenantId,
    job_id: jobId,
    entry_type: 'photo_uploaded',
    title: `Photo uploaded: ${input.photo_tag}`,
    metadata: { photo_id: photo.id, photo_tag: input.photo_tag, uploaded_by: userId },
    created_by_user_id: userId,
    is_system_entry: true,
  });

  return photo;
}

export async function listPhotos(
  tenantId: string,
  jobId: string,
  tag?: string,
) {
  const job = await jobRepo.findById(tenantId, jobId);
  if (!job) {
    throw new AppError(404, 'Job not found');
  }
  return photosRepo.findByJobId(tenantId, jobId, tag);
}

export async function updatePhoto(
  tenantId: string,
  jobId: string,
  photoId: string,
  input: UpdatePhotoInput,
) {
  const job = await jobRepo.findById(tenantId, jobId);
  if (!job) {
    throw new AppError(404, 'Job not found');
  }

  const existing = await photosRepo.findById(tenantId, photoId);
  if (!existing || existing.job_id !== jobId) {
    throw new AppError(404, 'Photo not found');
  }

  const updated = await photosRepo.update(tenantId, photoId, input);
  if (!updated) {
    throw new AppError(500, 'Failed to update photo');
  }
  return updated;
}

export async function deletePhoto(
  tenantId: string,
  jobId: string,
  photoId: string,
) {
  const job = await jobRepo.findById(tenantId, jobId);
  if (!job) {
    throw new AppError(404, 'Job not found');
  }

  const existing = await photosRepo.findById(tenantId, photoId);
  if (!existing || existing.job_id !== jobId) {
    throw new AppError(404, 'Photo not found');
  }

  return photosRepo.softDelete(tenantId, photoId);
}
