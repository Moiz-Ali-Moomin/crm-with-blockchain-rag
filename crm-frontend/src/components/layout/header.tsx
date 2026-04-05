'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, ChevronDown, Settings, LogOut, User,
  Search, Command,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { notificationsApi } from '@/lib/api/notifications.api';
import { authApi } from '@/lib/api/auth.api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { queryKeys } from '@/lib/query/query-keys';
import { cn } from '@/lib/utils';

interface NavbarProps {
  onMenuToggle: () => void;
}

const breadcrumbMap: Record<string, string> = {
  '/dashboard':        'Dashboard',
  '/leads':            'Leads',
  '/contacts':         'Contacts',
  '/companies':        'Companies',
  '/deals':            'Deals',
  '/pipeline':         'Pipeline',
  '/tickets':          'Tickets',
  '/activities':       'Activities',
  '/tasks':            'Tasks',
  '/communications':   'Communications',
  '/automation':       'Workflows',
  '/analytics':        'Analytics',
  '/notifications':    'Notifications',
  '/settings':         'Settings',
  '/settings/team':    'Team',
  '/ai':               'AI Copilot',
};

function resolvePageTitle(pathname: string): string {
  for (const [key, title] of Object.entries(breadcrumbMap)) {
    if (pathname === key || (key !== '/dashboard' && pathname.startsWith(key + '/'))) {
      return title;
    }
  }
  return 'CRM Platform';
}

const dropdownVariants = {
  hidden:  { opacity: 0, y: -6, scale: 0.97 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0, y: -4, scale: 0.97,
    transition: { duration: 0.12 },
  },
};

export function Navbar({ onMenuToggle }: NavbarProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const user     = useAuthStore((s) => s.user);
  const logout   = useAuthStore((s) => s.logout);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen,    setNotifOpen]    = useState(false);
  const dropdownRef                     = useRef<HTMLDivElement>(null);

  const { data: unreadData } = useQuery({
    queryKey: queryKeys.notifications.unreadCount(user?.id ?? ''),
    queryFn:  notificationsApi.getUnreadCount,
    refetchInterval: 30_000,
    enabled: !!user?.id,
  });

  const unreadCount = unreadData?.count ?? 0;
  const pageTitle   = resolvePageTitle(pathname);
  const initials    = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : 'U';

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    try { await authApi.logout(); } catch { /* ignored */ } finally {
      logout();
      router.replace('/login');
    }
  };

  return (
    <header className="glass-navbar h-16 flex items-center justify-between px-5 shrink-0 sticky top-0 z-30">
      {/* Left: hamburger + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            'text-white/50 hover:text-white hover:bg-white/8',
            'transition-all duration-150',
          )}
          aria-label="Toggle sidebar"
        >
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <rect y="0"  width="16" height="1.5" rx="0.75" fill="currentColor" />
            <rect y="5"  width="11" height="1.5" rx="0.75" fill="currentColor" />
            <rect y="10" width="7"  height="1.5" rx="0.75" fill="currentColor" />
          </svg>
        </button>

        <div className="h-4 w-px bg-white/10" />

        <h1 className="text-sm font-semibold text-white/80 tracking-tight">
          {pageTitle}
        </h1>
      </div>

      {/* Right: search + bell + user */}
      <div className="flex items-center gap-1.5" ref={dropdownRef}>
        {/* Command search */}
        <button
          className={cn(
            'hidden sm:flex items-center gap-2 px-3 h-8 rounded-lg',
            'bg-white/5 border border-white/8 hover:bg-white/8',
            'text-white/40 hover:text-white/70',
            'transition-all duration-150 text-xs',
          )}
        >
          <Search size={13} />
          <span>Search</span>
          <div className="flex items-center gap-0.5 ml-2 opacity-60">
            <Command size={10} />
            <span>K</span>
          </div>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(false); router.push('/notifications'); }}
            className={cn(
              'relative w-8 h-8 rounded-lg flex items-center justify-center',
              'text-white/50 hover:text-white hover:bg-white/8',
              'transition-all duration-150',
            )}
          >
            <Bell size={16} strokeWidth={1.8} />
            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className={cn(
                    'absolute -top-0.5 -right-0.5',
                    'min-w-[16px] h-4 px-0.5',
                    'bg-gradient-to-br from-violet-500 to-blue-500',
                    'text-white text-[9px] font-bold rounded-full',
                    'flex items-center justify-center',
                    'shadow-purple-glow',
                  )}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-white/10 mx-1" />

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className={cn(
              'flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl',
              'hover:bg-white/6 border border-transparent hover:border-white/10',
              'transition-all duration-150 group',
            )}
          >
            <div className="relative">
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-gradient-to-br from-violet-500 to-blue-600 text-white text-[11px] font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border-2 border-slate-900" />
            </div>
            <span className="text-[13px] font-medium text-white/70 group-hover:text-white/90 hidden sm:block transition-colors">
              {user?.firstName}
            </span>
            <ChevronDown
              size={12}
              strokeWidth={2.5}
              className={cn(
                'text-white/30 transition-transform duration-200',
                dropdownOpen && 'rotate-180',
              )}
            />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                key="user-dropdown"
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(
                  'absolute right-0 top-[calc(100%+8px)] w-56',
                  'glass-elevated rounded-2xl overflow-hidden',
                  'z-50',
                )}
              >
                {/* User info header */}
                <div className="px-4 py-3 border-b border-white/8">
                  <p className="text-sm font-semibold text-white/90 truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-white/40 truncate mt-0.5">{user?.email}</p>
                  <span className="inline-flex items-center mt-1.5 px-1.5 py-0.5 rounded-md bg-violet-500/20 border border-violet-400/20 text-[10px] font-semibold text-violet-300 uppercase tracking-wide">
                    {user?.role.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Menu items */}
                <div className="py-1.5">
                  {[
                    { icon: User,     label: 'Profile',  href: '/settings' },
                    { icon: Settings, label: 'Settings', href: '/settings' },
                  ].map(({ icon: Icon, label, href }) => (
                    <button
                      key={label}
                      onClick={() => { setDropdownOpen(false); router.push(href); }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5',
                        'text-[13px] text-white/60 hover:text-white hover:bg-white/6',
                        'transition-colors duration-100',
                      )}
                    >
                      <Icon size={14} strokeWidth={1.8} />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="border-t border-white/8 py-1.5">
                  <button
                    onClick={handleLogout}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5',
                      'text-[13px] text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/8',
                      'transition-colors duration-100',
                    )}
                  >
                    <LogOut size={14} strokeWidth={1.8} />
                    Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
