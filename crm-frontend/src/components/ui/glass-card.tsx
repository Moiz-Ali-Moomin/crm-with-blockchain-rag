import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

type Variant = 'default' | 'elevated' | 'accent' | 'flat';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  glow?: 'purple' | 'blue' | 'none';
}

const variantMap: Record<Variant, string> = {
  default:
    'bg-white/5 backdrop-blur-xl border border-white/10 shadow-glass',
  elevated:
    'bg-white/8 backdrop-blur-2xl border border-white/14 shadow-glass-lg',
  accent:
    'bg-violet-500/10 backdrop-blur-xl border border-violet-400/20 shadow-glass',
  flat:
    'bg-white/3 backdrop-blur-lg border border-white/6',
};

const paddingMap = {
  none: '',
  sm:   'p-3',
  md:   'p-5',
  lg:   'p-7',
};

const glowMap = {
  none:   '',
  purple: 'hover:shadow-purple-glow',
  blue:   'hover:shadow-blue-glow',
};

/**
 * GlassCard — the universal surface primitive for the glassmorphism design system.
 *
 * A Server Component by default (no interactivity, no hooks).
 * Compose it with client children for interactive content.
 *
 * @example
 * <GlassCard variant="elevated" padding="lg" hover glow="purple">
 *   <h2>Revenue</h2>
 * </GlassCard>
 */
export function GlassCard({
  variant  = 'default',
  padding  = 'md',
  hover    = false,
  glow     = 'none',
  className,
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl',
        variantMap[variant],
        paddingMap[padding],
        hover && 'transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/8 hover:border-white/16',
        glow !== 'none' && glowMap[glow],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

export function GlassCardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-between mb-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassCardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-sm font-semibold text-white/80 uppercase tracking-wider', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function GlassCardContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
}

export function GlassCardFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mt-4 pt-4 border-t border-white/8 flex items-center justify-between',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function GlassDivider({ className }: { className?: string }) {
  return (
    <div className={cn('h-px bg-gradient-to-r from-transparent via-white/12 to-transparent', className)} />
  );
}
