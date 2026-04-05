import { cn } from '@/lib/utils';

interface ScoreBadgeProps {
  score: number;
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  const color =
    score <= 40
      ? 'bg-red-100 text-red-700'
      : score <= 70
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-green-100 text-green-700';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold',
        color
      )}
    >
      {score}
    </span>
  );
}
