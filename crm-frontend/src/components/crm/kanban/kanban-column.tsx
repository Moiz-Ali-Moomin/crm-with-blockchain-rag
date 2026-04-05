'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { KanbanColumn as KanbanColumnType } from '@/types';
import { KanbanCard } from './kanban-card';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  column: KanbanColumnType;
}

export function KanbanColumn({ column }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stage.id });

  const stageColor = column.stage.color ?? '#6366f1';

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: stageColor }}
          />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {column.stage.name}
          </span>
          <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full px-1.5 py-0.5">
            {column.count}
          </span>
        </div>
        <span className="text-xs font-medium text-slate-500">
          {formatCurrency(column.totalValue)}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2 min-h-[200px] rounded-lg p-2 border-2 transition-colors',
          isOver
            ? 'bg-primary/10 border-primary/30'
            : 'bg-slate-100/60 dark:bg-slate-800/40 border-transparent'
        )}
      >
        <SortableContext
          items={column.deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.deals.map((deal) => (
            <KanbanCard key={deal.id} deal={deal} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
