'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealsApi } from '@/lib/api/deals.api';
import { queryKeys } from '@/lib/query/query-keys';
import type { Deal } from '@/types';
import { KanbanColumn } from './kanban-column';
import { KanbanCard } from './kanban-card';
import { toast } from 'sonner';

interface KanbanBoardProps {
  pipelineId: string;
}

export function KanbanBoard({ pipelineId }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const { data: board, isLoading } = useQuery({
    queryKey: queryKeys.deals.kanban(pipelineId),
    queryFn: () => dealsApi.getKanban(pipelineId),
    enabled: !!pipelineId,
  });

  const moveStageMutation = useMutation({
    mutationFn: ({ dealId, stageId }: { dealId: string; stageId: string }) =>
      dealsApi.moveStage(dealId, stageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.kanban(pipelineId) });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to move deal'),
  });

  const handleDragStart = (event: DragStartEvent) => {
    if (!board) return;
    const dealId = String(event.active.id);
    for (const col of board.stages) {
      const found = col.deals.find((d) => d.id === dealId);
      if (found) {
        setActiveDeal(found);
        break;
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDeal(null);
    if (!board) return;

    const { active, over } = event;
    if (!over) return;

    const dealId = String(active.id);
    const overId = String(over.id);

    // Determine target stage: over.id could be a stageId or a dealId
    let targetStageId: string | null = null;

    // Check if overId is a stage column id
    const isStage = board.stages.some((col) => col.stage.id === overId);
    if (isStage) {
      targetStageId = overId;
    } else {
      // overId is a deal id — find its column
      for (const col of board.stages) {
        if (col.deals.some((d) => d.id === overId)) {
          targetStageId = col.stage.id;
          break;
        }
      }
    }

    if (!targetStageId) return;

    // Find current stage
    let currentStageId: string | null = null;
    for (const col of board.stages) {
      if (col.deals.some((d) => d.id === dealId)) {
        currentStageId = col.stage.id;
        break;
      }
    }

    if (currentStageId === targetStageId) return;

    moveStageMutation.mutate({ dealId, stageId: targetStageId });
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="w-72 shrink-0 h-64 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!board) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {board.stages.map((col) => (
          <KanbanColumn key={col.stage.id} column={col} />
        ))}
      </div>
      <DragOverlay>
        {activeDeal ? <KanbanCard deal={activeDeal} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
