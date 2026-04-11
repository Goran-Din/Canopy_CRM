import crypto from 'node:crypto';
import { AppError } from '../../middleware/errorHandler.js';
import { logger } from '../../config/logger.js';
import * as repo from './repository.js';
import type {
  SubmitFeedbackInput,
  ListFeedbackInput,
  AddStaffNoteInput,
} from './schema.js';

// Google Place ID for Sunset Services (configurable per tenant in future)
function getGooglePlaceId(): string {
  return process.env.GOOGLE_PLACE_ID || '';
}

// === Feedback Request Creation (called by Automation Engine D-31) ===

export async function createAndSendFeedbackRequest(
  tenantId: string,
  customerId: string,
  invoiceId: string | null,
  jobId: string | null,
  sentVia = 'email',
) {
  const token = crypto.randomBytes(32).toString('hex');

  const feedback = await repo.create({
    tenant_id: tenantId,
    customer_id: customerId,
    invoice_id: invoiceId,
    job_id: jobId,
    feedback_token: token,
    sent_via: sentVia,
  });

  const feedbackUrl = `https://app.sunsetapp.us/feedback/${token}`;

  logger.info('Feedback request created', {
    feedback_id: feedback.id,
    customer_id: customerId,
    url: feedbackUrl,
  });

  return feedback;
}

// === Submit Feedback (Public) ===

export async function submitFeedback(
  input: SubmitFeedbackInput,
  respondentIp?: string,
) {
  const feedback = await repo.findByToken(input.feedback_token);
  if (!feedback) {
    throw new AppError(401, 'Invalid or expired feedback link');
  }

  if (feedback.status === 'expired') {
    throw new AppError(401, 'This feedback link has expired');
  }

  if (feedback.status === 'responded') {
    throw new AppError(409, 'Feedback has already been submitted');
  }

  const updated = await repo.submitFeedback(input.feedback_token, {
    rating: input.rating,
    comment: input.comment,
    respondentIp,
  });

  // Low rating (1-2): create complaint note on customer
  if (input.rating <= 2) {
    try {
      const { queryDb } = await import('../../config/database.js');
      await queryDb(
        `INSERT INTO customer_notes (tenant_id, customer_id, note_type, body, created_by)
         VALUES ($1, $2, 'complaint', $3, NULL)`,
        [
          feedback.tenant_id,
          feedback.customer_id,
          `Low satisfaction feedback (rating: ${input.rating}/5): ${input.comment ?? 'No comment'}`,
        ],
      );
    } catch (err) {
      logger.error('Failed to create complaint note', { error: (err as Error).message });
    }
  }

  // High rating with comment: notification (logged for now)
  if (input.rating >= 4 && input.comment) {
    logger.info('Positive feedback received', {
      customer_id: feedback.customer_id,
      rating: input.rating,
      comment: input.comment,
    });
  }

  // Google Review CTA
  const showGoogleReview = input.rating >= 4 && !!getGooglePlaceId();
  const googleReviewUrl = showGoogleReview
    ? `https://g.page/r/${getGooglePlaceId()}/review`
    : null;

  return {
    success: true,
    show_google_review: showGoogleReview,
    google_review_url: googleReviewUrl,
    feedback: updated,
  };
}

// === Record Google Review Click (Public) ===

export async function recordReviewClick(token: string) {
  const feedback = await repo.markReviewClicked(token);
  if (!feedback) {
    throw new AppError(404, 'Feedback not found');
  }
  return feedback;
}

// === Get Feedback Page Data (Public) ===

export async function getFeedbackPageData(token: string) {
  const feedback = await repo.findByToken(token);
  if (!feedback) {
    return { state: 'invalid' as const };
  }

  if (feedback.status === 'expired') {
    return { state: 'expired' as const };
  }

  if (feedback.status === 'responded') {
    return {
      state: 'responded' as const,
      rating: feedback.rating,
      show_google_review: feedback.google_review_prompted && !feedback.google_review_clicked,
      google_review_url: getGooglePlaceId()
        ? `https://g.page/r/${getGooglePlaceId()}/review`
        : null,
    };
  }

  return {
    state: 'rating' as const,
    customer_first_name: feedback.customer_first_name ?? '',
    customer_name: feedback.customer_name ?? '',
    property_address: feedback.property_address ?? '',
    job_number: feedback.job_number ?? '',
  };
}

// === Nightly Expiry Cron ===

export async function runExpiryNightlyCron() {
  logger.info('Running feedback expiry cron');
  try {
    const expired = await repo.expireOldFeedback();
    logger.info('Feedback expiry cron complete', { expired });
    return expired;
  } catch (err) {
    logger.error('Feedback expiry cron failed', { error: (err as Error).message });
    return 0;
  }
}

// === Staff Operations ===

export async function listFeedback(tenantId: string, input: ListFeedbackInput) {
  return repo.findAll(tenantId, {
    status: input.status,
    rating: input.rating,
    date_from: input.date_from,
    date_to: input.date_to,
    customer_id: input.customer_id,
    page: input.page,
    limit: input.limit,
  });
}

export async function getFeedbackSummary(tenantId: string) {
  const [summary, recent] = await Promise.all([
    repo.getSummary(tenantId),
    repo.getRecentFeedback(tenantId, 5),
  ]);

  return {
    avg_rating: summary.avg_rating ? parseFloat(summary.avg_rating) : null,
    total_sent: parseInt(summary.total_sent, 10),
    total_responded: parseInt(summary.total_responded, 10),
    response_rate: parseFloat(summary.response_rate),
    by_rating: {
      '1': parseInt(summary.rating_1, 10),
      '2': parseInt(summary.rating_2, 10),
      '3': parseInt(summary.rating_3, 10),
      '4': parseInt(summary.rating_4, 10),
      '5': parseInt(summary.rating_5, 10),
    },
    google_review_clicked: parseInt(summary.google_review_clicked, 10),
    recent: recent.map(f => ({
      id: f.id,
      customer_name: f.customer_name,
      rating: f.rating,
      comment: f.comment,
      responded_at: f.responded_at,
      job_number: f.job_number,
      google_review_clicked: f.google_review_clicked,
    })),
  };
}

export async function addStaffNote(
  feedbackId: string,
  tenantId: string,
  input: AddStaffNoteInput,
  userId: string,
) {
  const feedback = await repo.findById(feedbackId, tenantId);
  if (!feedback) {
    throw new AppError(404, 'Feedback not found');
  }
  return repo.addStaffNote(feedbackId, tenantId, input.note, userId);
}
