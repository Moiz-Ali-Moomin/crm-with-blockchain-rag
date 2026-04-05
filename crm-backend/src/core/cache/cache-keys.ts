/**
 * Cache key constants - prevents magic strings across the codebase
 * Pattern: {resource}:{tenantId}:{identifier}
 */

export const CACHE_KEYS = {
  // Analytics (expensive queries, cache for 5 minutes)
  dashboardMetrics: (tenantId: string) => `analytics:dashboard:${tenantId}`,
  revenueChart: (tenantId: string, period: string) => `analytics:revenue:${tenantId}:${period}`,
  pipelineForecast: (tenantId: string, pipelineId: string) => `analytics:forecast:${tenantId}:${pipelineId}`,

  // CRM lists (cache for 30 seconds - active data changes frequently)
  leadsList: (tenantId: string, page: number, filters: string) => `leads:list:${tenantId}:${page}:${filters}`,
  contactsList: (tenantId: string, page: number) => `contacts:list:${tenantId}:${page}`,
  dealKanban: (tenantId: string, pipelineId: string) => `deals:kanban:${tenantId}:${pipelineId}`,

  // Pipeline config (rarely changes, cache for 10 minutes)
  pipelines: (tenantId: string) => `pipelines:${tenantId}`,
  pipeline: (tenantId: string, pipelineId: string) => `pipeline:${tenantId}:${pipelineId}`,

  // User/tenant info (cache for 5 minutes)
  tenantConfig: (tenantId: string) => `tenant:config:${tenantId}`,
  userProfile: (userId: string) => `user:profile:${userId}`,

  // RBAC permissions (cache per user, invalidate on role change)
  userPermissions: (userId: string) => `rbac:permissions:${userId}`,

  // Token blacklist
  tokenBlacklist: (jti: string) => `auth:blacklist:${jti}`,

  // Notification unread count
  unreadNotifications: (userId: string) => `notifications:unread:${userId}`,

  // Email templates
  emailTemplates: (tenantId: string) => `email-templates:${tenantId}`,

  // AI / RAG
  aiSearchResults: (tenantId: string, queryHash: string) => `ai:search:${tenantId}:${queryHash}`,
  aiSummary: (tenantId: string, entityType: string, entityId: string) =>
    `ai:summary:${tenantId}:${entityType}:${entityId}`,

  // Lead scoring
  leadScore: (tenantId: string, leadId: string) => `lead:score:${tenantId}:${leadId}`,
} as const;

// TTL constants in seconds
export const CACHE_TTL = {
  ANALYTICS: 300,      // 5 minutes
  LIST: 30,            // 30 seconds
  CONFIG: 600,         // 10 minutes
  USER: 300,           // 5 minutes
  PERMISSIONS: 300,    // 5 minutes
  TOKEN_BLACKLIST: 900, // 15 minutes (matches JWT expiry)
  AI_SEARCH: 120,        // 2 minutes — search results can be stale briefly
  AI_SUMMARY: 600,       // 10 minutes — summaries are expensive to generate
  LEAD_SCORE: 300,       // 5 minutes — scoring recalculated via queue
} as const;
