/**
 * Dashboard loading skeleton
 *
 * Next.js streams this immediately while the async Server Component fetches data.
 * Uses the `.glass-skeleton` CSS class from globals.css for the shimmer effect.
 * Mirrors the exact layout of page.tsx to prevent layout shift on hydration.
 */

function SkeletonBlock({
  className,
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={`glass-skeleton rounded-2xl ${className ?? ''}`}
      style={{ animationDelay: `${delay}s` }}
    />
  );
}

function SectionLabelSkeleton() {
  return <div className="glass-skeleton h-3 w-20 rounded-full" />;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* ── KPI stat grid skeleton ─────────────────────────────────────────── */}
      <section>
        <SectionLabelSkeleton />
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="glass-skeleton rounded-2xl p-5"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              {/* Title row */}
              <div className="flex items-start justify-between mb-4">
                <div className="h-2.5 w-20 bg-white/10 rounded-full" />
                <div className="w-9 h-9 rounded-xl bg-white/8" />
              </div>
              {/* Value */}
              <div className="h-8 w-28 bg-white/10 rounded-lg mb-3" />
              {/* Sub */}
              <div className="h-2 w-24 bg-white/6 rounded-full" />
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

      {/* ── Charts + AI Copilot skeleton ───────────────────────────────────── */}
      <section>
        <SectionLabelSkeleton />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-3">
          {/* Charts area */}
          <div className="xl:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue chart */}
            <div className="glass-skeleton rounded-2xl p-5" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/10" />
                  <div className="h-2.5 w-16 bg-white/10 rounded-full" />
                </div>
                <div className="h-2 w-14 bg-white/6 rounded-full" />
              </div>
              {/* Fake chart bars */}
              <div className="h-56 flex items-end gap-1.5">
                {[55, 70, 45, 88, 60, 75, 50, 90, 65, 80, 48, 85].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md bg-gradient-to-t from-violet-500/25 to-violet-500/5"
                    style={{
                      height: `${h}%`,
                      animationDelay: `${i * 0.04}s`,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Pie chart */}
            <div className="glass-skeleton rounded-2xl p-5" style={{ animationDelay: '0.5s' }}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-lg bg-white/10" />
                <div className="h-2.5 w-20 bg-white/10 rounded-full" />
              </div>
              {/* Donut placeholder */}
              <div className="h-56 flex items-center justify-center">
                <div className="relative">
                  <div className="w-28 h-28 rounded-full border-[14px] border-white/10" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-white/5" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Copilot skeleton */}
          <div
            className="min-h-[480px] glass-skeleton rounded-2xl p-5 flex flex-col gap-4"
            style={{ animationDelay: '0.55s' }}
          >
            {/* Widget header */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/20" />
              <div className="space-y-1.5">
                <div className="h-3 w-20 bg-white/12 rounded-full" />
                <div className="h-2 w-16 bg-white/6 rounded-full" />
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                <div className="h-2 w-8 bg-white/8 rounded-full" />
              </div>
            </div>

            <div className="h-px bg-white/6" />

            {/* Op selector */}
            <div className="h-16 rounded-xl bg-white/5 border border-white/8" />

            {/* Input */}
            <div className="h-10 rounded-xl bg-white/5 border border-white/8" />

            <div className="h-px bg-white/6" />

            {/* Response area placeholder */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/6" />
              <div className="h-2.5 w-40 bg-white/8 rounded-full" />
              <div className="h-2 w-28 bg-white/5 rounded-full" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
