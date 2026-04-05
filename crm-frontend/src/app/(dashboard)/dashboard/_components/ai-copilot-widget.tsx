'use client';

import { useState, useRef, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Send, Loader2, Sparkles, ChevronDown } from 'lucide-react';
import { apiPost } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth.store';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassDivider } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';

type OperationType = 'summarize_contact' | 'suggest_follow_up' | 'summarize_activity' | 'generate_email_reply';

interface Op {
  key:         OperationType;
  label:       string;
  placeholder: string;
  description: string;
}

const OPERATIONS: Op[] = [
  {
    key:         'summarize_contact',
    label:       'Summarize Contact',
    placeholder: 'Enter contact ID…',
    description: 'Generate a structured summary of all interactions with a contact.',
  },
  {
    key:         'suggest_follow_up',
    label:       'Suggest Follow-up',
    placeholder: 'lead | contact | deal  +  ID, e.g. "deal abc123"',
    description: 'Get the best next action for a CRM entity based on history.',
  },
  {
    key:         'summarize_activity',
    label:       'Activity Timeline',
    placeholder: 'entityType + entityId, e.g. "deal abc123"',
    description: "Compact narrative of an entity's activity timeline.",
  },
  {
    key:         'generate_email_reply',
    label:       'Draft Email Reply',
    placeholder: 'Enter communication ID…',
    description: 'AI-drafted reply to an inbound email communication.',
  },
];

const opEndpoints: Record<OperationType, string> = {
  summarize_contact:  '/ai/summarize-contact',
  suggest_follow_up:  '/ai/suggest-follow-up',
  summarize_activity: '/ai/summarize-activity',
  generate_email_reply: '/ai/generate-email-reply',
};

interface AiResponse {
  summary?: string;
  keyPoints?: string[];
  sentiment?: string;
  action?: string;
  reasoning?: string;
  urgency?: string;
  suggestedChannel?: string;
  lastActivity?: string;
  nextStep?: string;
  subject?: string;
  body?: string;
  tone?: string;
}

function ResponseBlock({ data, op }: { data: AiResponse; op: OperationType }) {
  if (op === 'summarize_contact') {
    return (
      <div className="space-y-3">
        {data.summary && (
          <p className="text-sm text-white/80 leading-relaxed">{data.summary}</p>
        )}
        {data.keyPoints?.length ? (
          <ul className="space-y-1">
            {data.keyPoints.map((pt, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/65">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-violet-400 shrink-0" />
                {pt}
              </li>
            ))}
          </ul>
        ) : null}
        {data.sentiment && (
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide',
            data.sentiment === 'positive' ? 'bg-emerald-500/20 text-emerald-300' :
            data.sentiment === 'negative' ? 'bg-rose-500/20 text-rose-300' :
            'bg-slate-500/20 text-slate-300',
          )}>
            {data.sentiment}
          </span>
        )}
      </div>
    );
  }

  if (op === 'suggest_follow_up') {
    return (
      <div className="space-y-2">
        {data.action && <p className="text-sm font-semibold text-white/90">{data.action}</p>}
        {data.reasoning && <p className="text-sm text-white/60 leading-relaxed">{data.reasoning}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          {data.urgency && (
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide',
              data.urgency === 'high'   ? 'bg-rose-500/20 text-rose-300' :
              data.urgency === 'medium' ? 'bg-amber-500/20 text-amber-300' :
              'bg-slate-500/20 text-slate-300',
            )}>
              {data.urgency} urgency
            </span>
          )}
          {data.suggestedChannel && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide bg-blue-500/20 text-blue-300">
              {data.suggestedChannel}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (op === 'summarize_activity') {
    return (
      <div className="space-y-2">
        {data.summary      && <p className="text-sm text-white/80 leading-relaxed">{data.summary}</p>}
        {data.lastActivity && <p className="text-xs text-white/45">Last: {data.lastActivity}</p>}
        {data.nextStep     && (
          <div className="glass rounded-xl px-3 py-2 border-violet-400/20">
            <p className="text-xs font-semibold text-violet-300 mb-0.5">Recommended next step</p>
            <p className="text-sm text-white/75">{data.nextStep}</p>
          </div>
        )}
      </div>
    );
  }

  if (op === 'generate_email_reply') {
    return (
      <div className="space-y-3">
        {data.subject && (
          <div>
            <p className="text-[11px] text-white/35 uppercase tracking-wide mb-0.5">Subject</p>
            <p className="text-sm font-semibold text-white/90">{data.subject}</p>
          </div>
        )}
        {data.body && (
          <div>
            <p className="text-[11px] text-white/35 uppercase tracking-wide mb-0.5">Body</p>
            <p className="text-sm text-white/75 leading-relaxed whitespace-pre-line">{data.body}</p>
          </div>
        )}
        {data.tone && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide bg-emerald-500/20 text-emerald-300">
            {data.tone}
          </span>
        )}
      </div>
    );
  }

  return <pre className="text-xs text-white/50 whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>;
}

export function AiCopilotWidget() {
  const user                    = useAuthStore((s) => s.user);
  const [activeOp, setActiveOp] = useState<OperationType>('summarize_contact');
  const [input, setInput]       = useState('');
  const [result, setResult]     = useState<AiResponse | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [opOpen, setOpOpen]     = useState(false);
  const inputRef                = useRef<HTMLInputElement>(null);

  const currentOp = OPERATIONS.find((o) => o.key === activeOp)!;

  function buildPayload(op: OperationType, raw: string) {
    const trimmed = raw.trim();
    if (op === 'summarize_contact')    return { contactId: trimmed };
    if (op === 'generate_email_reply') return { communicationId: trimmed };
    // suggest_follow_up and summarize_activity: "entityType entityId"
    const [entityType, entityId] = trimmed.split(/\s+/);
    if (op === 'suggest_follow_up')  return { entityType: entityType ?? 'lead', entityId: entityId ?? trimmed };
    if (op === 'summarize_activity') return { entityType: entityType ?? 'lead', entityId: entityId ?? trimmed };
    return {};
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isPending) return;

    setResult(null);
    setError(null);

    startTransition(async () => {
      try {
        const tenantId = user?.tenantId ?? '';
        const payload  = { tenantId, ...buildPayload(activeOp, input) };
        const res      = await apiPost<AiResponse>(opEndpoints[activeOp], payload);
        setResult(res);
      } catch (err) {
        setError((err as Error).message ?? 'AI request failed');
      }
    });
  }

  return (
    <GlassCard variant="accent" padding="none" className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <div className="p-2 rounded-xl bg-violet-500/25 text-violet-300 animate-pulse-glow">
          <Brain size={16} strokeWidth={2} />
        </div>
        <div>
          <GlassCardTitle className="text-white/90 normal-case text-sm font-semibold tracking-normal">
            AI Copilot
          </GlassCardTitle>
          <p className="text-[11px] text-white/35 mt-0.5">Powered by GPT-4o</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-white/35">Ready</span>
        </div>
      </div>

      <GlassDivider />

      {/* Operation selector */}
      <div className="px-5 py-3">
        <div className="relative">
          <button
            onClick={() => setOpOpen((o) => !o)}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2.5 rounded-xl',
              'bg-white/5 border border-white/10 hover:bg-white/8',
              'transition-all duration-150 text-left',
            )}
          >
            <div>
              <p className="text-[13px] font-medium text-white/85">{currentOp.label}</p>
              <p className="text-[11px] text-white/35 mt-0.5">{currentOp.description}</p>
            </div>
            <ChevronDown
              size={14}
              className={cn('text-white/30 transition-transform duration-200 shrink-0 ml-3', opOpen && 'rotate-180')}
            />
          </button>

          <AnimatePresence>
            {opOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.10 } }}
                className="absolute left-0 right-0 top-[calc(100%+4px)] glass-elevated rounded-xl overflow-hidden z-20"
              >
                {OPERATIONS.map((op) => (
                  <button
                    key={op.key}
                    onClick={() => { setActiveOp(op.key); setOpOpen(false); setResult(null); setInput(''); }}
                    className={cn(
                      'w-full flex items-start gap-3 px-3 py-2.5 text-left',
                      'hover:bg-white/6 transition-colors duration-100',
                      op.key === activeOp && 'bg-violet-500/12',
                    )}
                  >
                    {op.key === activeOp && (
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-violet-400 shrink-0" />
                    )}
                    <div>
                      <p className="text-[13px] font-medium text-white/80">{op.label}</p>
                      <p className="text-[11px] text-white/35 mt-0.5">{op.description}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-5 pb-3">
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl',
          'bg-white/5 border border-white/10',
          'focus-within:border-violet-400/40 focus-within:bg-white/7',
          'transition-all duration-150',
        )}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={currentOp.placeholder}
            disabled={isPending}
            className={cn(
              'flex-1 bg-transparent text-[13px] text-white/80 placeholder:text-white/25',
              'outline-none disabled:opacity-50',
            )}
          />
          <button
            type="submit"
            disabled={!input.trim() || isPending}
            className={cn(
              'p-1.5 rounded-lg transition-all duration-150',
              'bg-violet-500/30 text-violet-300 border border-violet-400/20',
              'hover:bg-violet-500/50 hover:text-violet-200',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            {isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <Send size={14} />
            }
          </button>
        </div>
      </form>

      <GlassDivider />

      {/* Response area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 min-h-[180px] scrollbar-none">
        <AnimatePresence mode="wait">
          {isPending ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full gap-3 py-8"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-400/30 flex items-center justify-center">
                  <Loader2 size={16} className="text-violet-400 animate-spin" />
                </div>
                <div className="absolute inset-0 rounded-full bg-violet-500/10 animate-ping" />
              </div>
              <p className="text-xs text-white/35">Generating response…</p>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-400/20"
            >
              <span className="text-rose-400 mt-0.5">⚠</span>
              <p className="text-sm text-rose-300/80">{error}</p>
            </motion.div>
          ) : result ? (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center gap-1.5 mb-3">
                <Sparkles size={12} className="text-violet-400" />
                <span className="text-[11px] font-semibold text-violet-300/70 uppercase tracking-wider">
                  AI Response
                </span>
              </div>
              <ResponseBlock data={result} op={activeOp} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full gap-2 py-8 text-center"
            >
              <Brain size={28} className="text-white/15" strokeWidth={1} />
              <p className="text-sm text-white/25">
                Select an operation and enter an ID
              </p>
              <p className="text-[11px] text-white/15">
                The AI will analyze your CRM data
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassCard>
  );
}
