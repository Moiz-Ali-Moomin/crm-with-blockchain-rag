/**
 * Entity Types
 *
 * Shared enums and interfaces that describe the CRM's core entities.
 * Used across activities, tasks, automation, and audit log modules
 * to reference entities in a type-safe way without coupling to Prisma.
 *
 * No NestJS imports — pure TypeScript.
 */

/** All entity types that can be referenced cross-module (timeline, tasks, activities, audit) */
export type EntityType =
  | 'LEAD'
  | 'CONTACT'
  | 'COMPANY'
  | 'DEAL'
  | 'TICKET'
  | 'TASK';

/** Lightweight reference to any CRM entity — avoids importing full Prisma types */
export interface EntityRef {
  type: EntityType;
  id: string;
}

/** Activity types logged against any entity */
export type ActivityType =
  | 'CALL'
  | 'EMAIL'
  | 'MEETING'
  | 'NOTE'
  | 'TASK'
  | 'SMS'
  | 'WHATSAPP';

/** Task priority levels */
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/** Task status values */
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

/** Ticket priority levels */
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/** Ticket status values */
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
