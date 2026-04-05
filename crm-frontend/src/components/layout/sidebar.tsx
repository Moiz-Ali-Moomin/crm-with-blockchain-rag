'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, UserCircle, Building2, TrendingUp,
  GitBranch, Ticket, Activity, CheckSquare, MessageSquare,
  Zap, BarChart2, Settings, UsersRound, ChevronLeft, ChevronRight,
  Brain,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

const navGroups = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'CRM',
    items: [
      { label: 'Leads',     href: '/leads',     icon: Users },
      { label: 'Contacts',  href: '/contacts',  icon: UserCircle },
      { label: 'Companies', href: '/companies', icon: Building2 },
      { label: 'Deals',     href: '/deals',     icon: TrendingUp },
      { label: 'Pipeline',  href: '/pipeline',  icon: GitBranch },
    ],
  },
  {
    label: 'Support',
    items: [
      { label: 'Tickets',         href: '/tickets',        icon: Ticket },
      { label: 'Activities',      href: '/activities',     icon: Activity },
      { label: 'Tasks',           href: '/tasks',          icon: CheckSquare },
      { label: 'Communications',  href: '/communications', icon: MessageSquare },
    ],
  },
  {
    label: 'Automation',
    items: [
      { label: 'Workflows', href: '/automation', icon: Zap },
      { label: 'Analytics', href: '/analytics',  icon: BarChart2 },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'AI Copilot', href: '/ai', icon: Brain },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Settings', href: '/settings',      icon: Settings },
      { label: 'Team',     href: '/settings/team', icon: UsersRound },
    ],
  },
];

const sidebarVariants = {
  open:   { width: 240, transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] } },
  closed: { width: 64,  transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const labelVariants = {
  open:   { opacity: 1, x: 0,   transition: { delay: 0.08, duration: 0.22 } },
  closed: { opacity: 0, x: -6,  transition: { duration: 0.12 } },
};

const groupLabelVariants = {
  open:   { opacity: 1, height: 'auto', transition: { delay: 0.06, duration: 0.2 } },
  closed: { opacity: 0, height: 0,      transition: { duration: 0.12 } },
};

export function Sidebar({ open, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const user     = useAuthStore((s) => s.user);

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : 'U';

  return (
    <motion.aside
      variants={sidebarVariants}
      animate={open ? 'open' : 'closed'}
      initial={false}
      className="relative flex flex-col glass-sidebar shrink-0 overflow-hidden"
      style={{ willChange: 'width' }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Logomark */}
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0 shadow-purple-glow">
            <span className="text-white text-xs font-black">C</span>
          </div>
          <AnimatePresence mode="wait">
            {open && (
              <motion.span
                key="logo-text"
                variants={labelVariants}
                initial="closed"
                animate="open"
                exit="closed"
                className="text-white font-bold text-base tracking-tight whitespace-nowrap"
              >
                CRM Platform
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className={cn(
          'absolute -right-3 top-[72px] z-20 w-6 h-6 rounded-full',
          'bg-slate-800/90 backdrop-blur-sm border border-white/12',
          'flex items-center justify-center',
          'text-white/60 hover:text-white hover:bg-slate-700/90',
          'transition-colors duration-150 shadow-glass-sm',
        )}
      >
        {open
          ? <ChevronLeft size={11} strokeWidth={2.5} />
          : <ChevronRight size={11} strokeWidth={2.5} />
        }
      </button>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-none">
        {navGroups.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && 'mt-5')}>
            {/* Group label */}
            <AnimatePresence>
              {open && (
                <motion.p
                  variants={groupLabelVariants}
                  initial="closed"
                  animate="open"
                  exit="closed"
                  className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30 overflow-hidden"
                >
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>

            <ul className="space-y-0.5 px-2">
              {group.items.map((item) => {
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={!open ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm font-medium',
                        'transition-all duration-150 relative group',
                        isActive
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-400/20'
                          : 'text-white/45 hover:bg-white/6 hover:text-white/90 border border-transparent',
                        !open && 'justify-center',
                      )}
                    >
                      {/* Active indicator dot */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-violet-400 rounded-r-full" />
                      )}

                      <Icon
                        size={16}
                        strokeWidth={isActive ? 2.5 : 1.8}
                        className="shrink-0"
                      />

                      <AnimatePresence mode="wait">
                        {open && (
                          <motion.span
                            key={`label-${item.href}`}
                            variants={labelVariants}
                            initial="closed"
                            animate="open"
                            exit="closed"
                            className="whitespace-nowrap overflow-hidden"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User profile */}
      <div className="shrink-0 px-3 py-3 border-t border-white/8">
        <div
          className={cn(
            'flex items-center gap-3 px-2 py-2 rounded-xl',
            'hover:bg-white/5 transition-colors duration-150 cursor-pointer',
            !open && 'justify-center',
          )}
        >
          <div className="relative shrink-0">
            <Avatar className="w-7 h-7">
              <AvatarFallback className="bg-gradient-to-br from-violet-500 to-blue-600 text-white text-[11px] font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {/* Online indicator */}
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border-2 border-slate-900" />
          </div>

          <AnimatePresence mode="wait">
            {open && user && (
              <motion.div
                key="user-info"
                variants={labelVariants}
                initial="closed"
                animate="open"
                exit="closed"
                className="min-w-0 overflow-hidden"
              >
                <p className="text-[13px] font-semibold text-white/85 truncate leading-tight">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-[11px] text-white/35 truncate leading-tight mt-0.5">
                  {user.role.replace(/_/g, ' ')}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
}
