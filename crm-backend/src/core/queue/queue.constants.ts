/**
 * BullMQ Queue Name Constants
 * Single source of truth for all queue names in the application
 */

export const QUEUE_NAMES = {
  EMAIL: 'email',
  SMS: 'sms',
  WHATSAPP: 'whatsapp',
  NOTIFICATION: 'notification',
  AUTOMATION: 'automation-engine',
  WEBHOOK_OUTBOUND: 'webhook-outbound',
  REPORT: 'report-generation',
  TASK_REMINDER: 'task-reminder',
  AI_EMBEDDING: 'ai-embedding',
  BLOCKCHAIN: 'blockchain',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Default job options for each queue type
export const QUEUE_JOB_OPTIONS = {
  email: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
  sms: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 1000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
  notification: {
    attempts: 2,
    backoff: { type: 'fixed' as const, delay: 1000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 100 },
  },
  automation: {
    attempts: 2,
    backoff: { type: 'exponential' as const, delay: 3000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
  webhook: {
    attempts: 5,  // More retries for webhook delivery
    backoff: { type: 'exponential' as const, delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 1000 }, // Keep failed webhooks longer for debugging
  },
  // AI embedding: low priority, high retry (OpenAI can throttle)
  aiEmbedding: {
    attempts: 4,
    backoff: { type: 'exponential' as const, delay: 5000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
    priority: 10, // Lower number = higher priority in BullMQ; embedding is non-urgent
  },
  // Blockchain: critical path — must eventually confirm on-chain
  blockchain: {
    attempts: 6,
    backoff: { type: 'exponential' as const, delay: 10000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 1000 }, // Keep failed for manual recovery
  },
} as const;

/**
 * Returns aiEmbedding job options with a deterministic jobId so BullMQ
 * deduplicates rapid re-enqueues for the same entity (e.g. burst of updates).
 * A queued job with the same jobId is kept; the duplicate is dropped.
 */
export const embeddingJobOptions = (entityType: string, entityId: string) => ({
  ...QUEUE_JOB_OPTIONS.aiEmbedding,
  jobId: `embed:${entityType}:${entityId}`,
});
