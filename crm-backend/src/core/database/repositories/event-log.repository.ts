/**
 * EventLogRepository — MongoDB repository for system event logs
 *
 * Registered in CoreModule and exported globally so any feature module
 * (automation, webhooks, activities) can inject it without extra imports.
 *
 * Multi-tenancy: tenantId is REQUIRED on every create() call.
 * Unlike Prisma, there is no automatic middleware — TypeScript enforces it via types.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EventLog,
  EventLogDocument,
  EventCategory,
  EventLogStatus,
} from '../schemas/event-log.schema';

export interface CreateEventLogDto {
  tenantId: string;                         // REQUIRED
  category: EventCategory;
  eventType: string;
  status: EventLogStatus;
  entityId?: string;
  entityType?: string;
  triggeredBy?: string;
  payload?: Record<string, unknown>;
  errorMessage?: string;
  requestId?: string;
  durationMs?: number;
}

export interface FindEventLogsFilter {
  tenantId: string;                         // REQUIRED
  category?: EventCategory;
  eventType?: string;
  entityType?: string;
  entityId?: string;
  status?: EventLogStatus;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  skip?: number;
}

@Injectable()
export class EventLogRepository {
  private readonly logger = new Logger(EventLogRepository.name);

  constructor(
    @InjectModel(EventLog.name)
    private readonly eventLogModel: Model<EventLogDocument>,
  ) {}

  /**
   * Write a single event log entry.
   * Called fire-and-forget from services — errors are swallowed and logged.
   */
  async create(dto: CreateEventLogDto): Promise<EventLogDocument | null> {
    try {
      const doc = new this.eventLogModel({
        ...dto,
        payload:      dto.payload ?? {},
        errorMessage: dto.errorMessage
          ? dto.errorMessage.slice(0, 2000)   // Hard cap — prevent unbounded storage
          : undefined,
      });
      return await doc.save();
    } catch (err) {
      this.logger.error('Failed to write event log to MongoDB', {
        error: (err as Error).message,
        tenantId: dto.tenantId,
        eventType: dto.eventType,
      });
      return null;
    }
  }

  /**
   * Bulk-insert multiple events in one round-trip.
   * Useful for automation workers that emit many events per workflow run.
   */
  async createMany(dtos: CreateEventLogDto[]): Promise<void> {
    try {
      const docs = dtos.map((dto) => ({
        ...dto,
        payload:      dto.payload ?? {},
        errorMessage: dto.errorMessage?.slice(0, 2000),
      }));
      await this.eventLogModel.insertMany(docs, { ordered: false });
    } catch (err) {
      this.logger.error('Failed to bulk-insert event logs', {
        error: (err as Error).message,
        count: dtos.length,
      });
    }
  }

  /**
   * Find event logs for a tenant with optional filters.
   */
  async findMany(filter: FindEventLogsFilter): Promise<EventLog[]> {
    const query: Record<string, unknown> = { tenantId: filter.tenantId };

    if (filter.category)   query.category   = filter.category;
    if (filter.eventType)  query.eventType  = filter.eventType;
    if (filter.entityType) query.entityType = filter.entityType;
    if (filter.entityId)   query.entityId   = filter.entityId;
    if (filter.status)     query.status     = filter.status;

    if (filter.fromDate || filter.toDate) {
      query.createdAt = {
        ...(filter.fromDate && { $gte: filter.fromDate }),
        ...(filter.toDate   && { $lte: filter.toDate }),
      };
    }

    return this.eventLogModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(filter.skip ?? 0)
      .limit(filter.limit ?? 100)
      .lean()
      .exec() as Promise<EventLog[]>;
  }

  /**
   * Get failure rate stats per category for a tenant.
   * Used in health dashboards and alerting.
   */
  async getFailureStats(
    tenantId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<Array<{ category: string; total: number; failed: number; failureRate: number }>> {
    const result = await this.eventLogModel.aggregate([
      {
        $match: {
          tenantId,
          createdAt: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id:    '$category',
          total:  { $sum: 1 },
          failed: { $sum: { $cond: [{ $eq: ['$status', 'failure'] }, 1, 0] } },
        },
      },
      {
        $project: {
          _id:         0,
          category:    '$_id',
          total:       1,
          failed:      1,
          failureRate: {
            $round: [
              { $multiply: [{ $divide: ['$failed', '$total'] }, 100] },
              2,
            ],
          },
        },
      },
    ]).exec();

    return result;
  }

  /**
   * Get all events for a specific entity (e.g. all events for deal X).
   * Used in entity detail pages for an "event timeline" view.
   */
  async findByEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
    limit = 50,
  ): Promise<EventLog[]> {
    return this.eventLogModel
      .find({ tenantId, entityType, entityId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec() as Promise<EventLog[]>;
  }
}
