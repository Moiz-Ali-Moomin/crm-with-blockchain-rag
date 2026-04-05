import { Badge } from '@/components/ui/badge';

// Lead
const leadVariant: Record<string, string> = {
  NEW: 'info',
  CONTACTED: 'secondary',
  QUALIFIED: 'success',
  UNQUALIFIED: 'destructive',
  NURTURING: 'warning',
  CONVERTED: 'success',
  LOST: 'outline',
};

export function LeadStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={(leadVariant[status] ?? 'secondary') as any}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}

// Deal
const dealVariant: Record<string, string> = {
  OPEN: 'info',
  WON: 'success',
  LOST: 'destructive',
  ON_HOLD: 'warning',
};

export function DealStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={(dealVariant[status] ?? 'secondary') as any}>
      {status.replace('_', ' ').charAt(0) + status.replace('_', ' ').slice(1).toLowerCase()}
    </Badge>
  );
}

// Ticket
const ticketVariant: Record<string, string> = {
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  WAITING: 'secondary',
  RESOLVED: 'success',
  CLOSED: 'outline',
};

export function TicketStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={(ticketVariant[status] ?? 'secondary') as any}>
      {status.replace(/_/g, ' ').charAt(0) + status.replace(/_/g, ' ').slice(1).toLowerCase()}
    </Badge>
  );
}

// Task
const taskVariant: Record<string, string> = {
  TODO: 'secondary',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'outline',
};

export function TaskStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={(taskVariant[status] ?? 'secondary') as any}>
      {status.replace(/_/g, ' ').charAt(0) + status.replace(/_/g, ' ').slice(1).toLowerCase()}
    </Badge>
  );
}

// Priority
const priorityVariant: Record<string, string> = {
  LOW: 'secondary',
  MEDIUM: 'warning',
  HIGH: 'destructive',
  URGENT: 'destructive',
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge variant={(priorityVariant[priority] ?? 'secondary') as any}>
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </Badge>
  );
}
