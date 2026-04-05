/**
 * WebSocket Service
 * Used by other services to emit events without directly depending on the gateway
 */

import { Injectable } from '@nestjs/common';
import { WsGateway } from './ws.gateway';

export interface WsEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export const WS_EVENTS = {
  // Notifications
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',

  // Leads
  LEAD_CREATED: 'lead:created',
  LEAD_UPDATED: 'lead:updated',
  LEAD_ASSIGNED: 'lead:assigned',

  // Deals
  DEAL_CREATED: 'deal:created',
  DEAL_STAGE_CHANGED: 'deal:stage_changed',
  DEAL_WON: 'deal:won',
  DEAL_LOST: 'deal:lost',

  // Tasks
  TASK_ASSIGNED: 'task:assigned',
  TASK_OVERDUE: 'task:overdue',
  TASK_COMPLETED: 'task:completed',

  // Tickets
  TICKET_CREATED: 'ticket:created',
  TICKET_UPDATED: 'ticket:updated',
  TICKET_ASSIGNED: 'ticket:assigned',
  TICKET_REPLY: 'ticket:reply',

  // Activities
  ACTIVITY_LOGGED: 'activity:logged',
} as const;

@Injectable()
export class WsService {
  constructor(private readonly gateway: WsGateway) {}

  /** Emit to a single user (all their connected sockets) */
  emitToUser(userId: string, event: string, data: Record<string, unknown>): void {
    this.gateway.server.to(`user:${userId}`).emit(event, this.buildEvent(event, data));
  }

  /** Emit to ALL connected users in a tenant */
  emitToTenant(tenantId: string, event: string, data: Record<string, unknown>): void {
    this.gateway.server.to(`tenant:${tenantId}`).emit(event, this.buildEvent(event, data));
  }

  /** Emit to all users EXCEPT the sender */
  emitToTenantExcept(
    tenantId: string,
    excludeUserId: string,
    event: string,
    data: Record<string, unknown>,
  ): void {
    this.gateway.server
      .to(`tenant:${tenantId}`)
      .except(`user:${excludeUserId}`)
      .emit(event, this.buildEvent(event, data));
  }

  /** Check if user is currently connected */
  isUserOnline(userId: string): boolean {
    return this.gateway.isUserOnline(userId);
  }

  private buildEvent(type: string, data: Record<string, unknown>): WsEvent {
    return {
      type,
      data,
      timestamp: new Date().toISOString(),
    };
  }
}
