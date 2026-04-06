'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, X, Pencil, Trash2, Mail, Phone,
  Building2, Clock, TrendingUp, ExternalLink, UserCircle,
  ChevronRight, Users,
} from 'lucide-react';
import { contactsApi } from '@/lib/api/contacts.api';
import { queryKeys } from '@/lib/query/query-keys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/shared/pagination';
import { formatRelativeTime, formatCurrency, getInitials, cn } from '@/lib/utils';
import type { Contact } from '@/types';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName:  z.string().min(1, 'Required'),
  email:     z.string().email('Invalid email').optional().or(z.literal('')),
  phone:     z.string().optional(),
  jobTitle:  z.string().optional(),
});
type FormData = z.infer<typeof schema>;

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-700',
  'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-700',
  'from-rose-500 to-pink-700',
  'from-amber-500 to-orange-600',
  'from-indigo-500 to-violet-700',
];

function ContactAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const idx = name.charCodeAt(0) % AVATAR_GRADIENTS.length;
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-[11px]' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-9 h-9 text-xs';
  const parts    = name.trim().split(' ');
  const initials = parts.length >= 2
    ? getInitials(parts[0], parts[parts.length - 1])
    : (parts[0]?.[0] ?? '?').toUpperCase();
  return (
    <div className={cn(
      'rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-white shrink-0',
      AVATAR_GRADIENTS[idx],
      sizeClass,
    )}>
      {initials}
    </div>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function ContactModal({ contact, onClose }: { contact?: Contact | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: contact
      ? { firstName: contact.firstName, lastName: contact.lastName, email: contact.email ?? '', phone: contact.phone ?? '', jobTitle: contact.jobTitle ?? '' }
      : {},
  });

  const onSubmit = async (data: FormData) => {
    try {
      if (contact) {
        await contactsApi.update(contact.id, data);
        toast.success('Contact updated');
      } else {
        await contactsApi.create(data as any);
        toast.success('Contact created');
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="glass-elevated rounded-2xl w-full max-w-md p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white/90">
            {contact ? 'Edit Contact' : 'New Contact'}
          </h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-colors">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-white/50 mb-1.5 block">First Name</Label>
              <Input {...register('firstName')} className="h-9" />
              {errors.firstName && <p className="text-[11px] text-rose-400 mt-1">{errors.firstName.message}</p>}
            </div>
            <div>
              <Label className="text-xs text-white/50 mb-1.5 block">Last Name</Label>
              <Input {...register('lastName')} className="h-9" />
              {errors.lastName && <p className="text-[11px] text-rose-400 mt-1">{errors.lastName.message}</p>}
            </div>
          </div>
          <div>
            <Label className="text-xs text-white/50 mb-1.5 block">Email</Label>
            <Input type="email" {...register('email')} className="h-9" />
            {errors.email && <p className="text-[11px] text-rose-400 mt-1">{errors.email.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-white/50 mb-1.5 block">Phone</Label>
              <Input {...register('phone')} className="h-9" />
            </div>
            <div>
              <Label className="text-xs text-white/50 mb-1.5 block">Job Title</Label>
              <Input {...register('jobTitle')} className="h-9" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              {contact ? 'Save changes' : 'Create contact'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Detail Side Panel ────────────────────────────────────────────────────────

function ContactPanel({
  contact,
  onClose,
  onEdit,
}: {
  contact: Contact;
  onClose: () => void;
  onEdit: () => void;
}) {
  const router = useRouter();
  const fullName = `${contact.firstName} ${contact.lastName}`;

  return (
    <motion.aside
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="fixed right-0 top-0 h-full w-[360px] glass-elevated border-l border-white/8 z-40 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="relative px-5 pt-5 pb-4 border-b border-white/6">
        {/* Top-edge highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />
        <div className="flex items-start justify-between mb-4">
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-colors">
            <X size={15} />
          </button>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/8 border border-transparent hover:border-white/10 transition-all"
            >
              <Pencil size={12} /> Edit
            </button>
            <button
              onClick={() => router.push(`/contacts/${contact.id}`)}
              className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs text-violet-300 hover:text-violet-200 hover:bg-violet-500/12 border border-violet-400/20 transition-all"
            >
              Open <ExternalLink size={11} />
            </button>
          </div>
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <ContactAvatar name={fullName} size="lg" />
          <div>
            <h3 className="text-base font-semibold text-white/95">{fullName}</h3>
            {contact.jobTitle && (
              <p className="text-xs text-white/45 mt-0.5">{contact.jobTitle}</p>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto py-4 px-5 space-y-4 scrollbar-none">
        {/* Contact info */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Contact info</p>
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-3 group">
              <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                <Mail size={13} className="text-violet-300" />
              </div>
              <span className="text-sm text-white/65 group-hover:text-white/90 transition-colors truncate">{contact.email}</span>
            </a>
          )}
          {contact.phone && (
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/15 flex items-center justify-center shrink-0">
                <Phone size={13} className="text-cyan-300" />
              </div>
              <span className="text-sm text-white/65">{contact.phone}</span>
            </div>
          )}
          {contact.company && (
            <button
              onClick={() => router.push(`/companies/${contact.companyId}`)}
              className="flex items-center gap-3 group w-full text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                <Building2 size={13} className="text-blue-300" />
              </div>
              <span className="text-sm text-white/65 group-hover:text-white/90 transition-colors">{contact.company.name}</span>
              <ChevronRight size={12} className="text-white/20 group-hover:text-white/50 ml-auto transition-colors" />
            </button>
          )}
          {contact.lastContactedAt && (
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                <Clock size={13} className="text-emerald-300" />
              </div>
              <span className="text-sm text-white/65">Last contacted {formatRelativeTime(contact.lastContactedAt)}</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Stats</p>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-gradient-to-br from-violet-500/12 to-transparent border border-violet-400/15 p-3">
              <p className="text-[10px] text-white/35 uppercase tracking-wide mb-1">Total Spent</p>
              <p className="text-base font-bold text-violet-300">{formatCurrency(contact.totalSpent ?? 0)}</p>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-cyan-500/12 to-transparent border border-cyan-400/15 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp size={10} className="text-cyan-300" />
                <p className="text-[10px] text-white/35 uppercase tracking-wide">Deals</p>
              </div>
              <p className="text-base font-bold text-cyan-300">—</p>
            </div>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ hasSearch, onAdd }: { hasSearch: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/10 border border-white/8 flex items-center justify-center mb-2"
        style={{ boxShadow: '0 0 40px rgba(139,92,246,0.15)' }}>
        <Users size={28} strokeWidth={1.2} className="text-violet-300" />
      </div>
      <p className="text-sm font-medium text-white/70">
        {hasSearch ? 'No contacts match your search' : 'No contacts yet'}
      </p>
      <p className="text-xs text-white/30 text-center max-w-[220px]">
        {hasSearch ? 'Try a different name or email.' : 'Add your first contact to start building relationships.'}
      </p>
      {!hasSearch && (
        <Button size="sm" onClick={onAdd} className="mt-2">
          <Plus size={14} className="mr-1.5" /> Add Contact
        </Button>
      )}
    </div>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function ContactRow({
  contact,
  isSelected,
  onClick,
  onEdit,
  onDelete,
}: {
  contact: Contact;
  isSelected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const fullName = `${contact.firstName} ${contact.lastName}`;

  return (
    <tr
      onClick={onClick}
      className={cn(
        'border-b border-white/4 cursor-pointer transition-all duration-150 group',
        isSelected
          ? 'bg-violet-500/10 border-b-violet-400/20'
          : 'hover:bg-white/[0.03]',
      )}
    >
      {/* Name + avatar */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <ContactAvatar name={fullName} size="sm" />
          <div>
            <p className="text-sm font-medium text-white/90 leading-tight">{fullName}</p>
            {contact.jobTitle && (
              <p className="text-[11px] text-white/35 leading-tight mt-0.5">{contact.jobTitle}</p>
            )}
          </div>
        </div>
      </td>

      {/* Email */}
      <td className="px-4 py-3">
        <span className="text-sm text-white/50">{contact.email ?? '—'}</span>
      </td>

      {/* Company */}
      <td className="px-4 py-3">
        {contact.company ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-white/55 bg-white/5 px-2 py-0.5 rounded-full border border-white/8">
            <Building2 size={10} />
            {contact.company.name}
          </span>
        ) : <span className="text-white/25 text-sm">—</span>}
      </td>

      {/* Total spent */}
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-emerald-400">{formatCurrency(contact.totalSpent ?? 0)}</span>
      </td>

      {/* Last contacted */}
      <td className="px-4 py-3">
        <span className="text-xs text-white/35">
          {contact.lastContactedAt ? formatRelativeTime(contact.lastContactedAt) : '—'}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/8 transition-all"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ page: 1, limit: 20, search: '' });
  const [modalOpen, setModalOpen]         = useState(false);
  const [editContact, setEditContact]     = useState<Contact | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.contacts.list(filters),
    queryFn:  () => contactsApi.getAll(filters),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contactsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      toast.success('Contact deleted');
      setSelectedContact(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Delete failed'),
  });

  const openAdd  = () => { setEditContact(null); setModalOpen(true); };
  const openEdit = (c: Contact) => { setEditContact(c); setModalOpen(true); setSelectedContact(null); };

  const contacts = data?.data ?? [];
  const hasSearch = !!filters.search;

  return (
    <div className="flex gap-5 min-h-0">
      {/* ── Main panel ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              <input
                type="text"
                placeholder="Search contacts…"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))}
                className={cn(
                  'h-9 pl-8 pr-3 text-sm rounded-xl w-52',
                  'bg-white/5 border border-white/10 text-white/80 placeholder:text-white/25',
                  'focus:outline-none focus:border-violet-400/50 focus:bg-white/8',
                  'transition-all duration-150',
                )}
              />
            </div>

            {data && (
              <span className="text-xs text-white/30 font-medium">
                {data.meta.total.toLocaleString()} contact{data.meta.total !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <Button size="sm" onClick={openAdd}>
            <Plus size={14} className="mr-1.5" /> Add Contact
          </Button>
        </div>

        {/* Table */}
        <div className="glass rounded-2xl overflow-hidden">
          {/* Top edge highlight */}
          <div className="h-px bg-gradient-to-r from-transparent via-violet-400/20 to-transparent" />

          {isLoading ? (
            <div className="space-y-0">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/4">
                  <div className="w-9 h-9 rounded-full glass-skeleton shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 glass-skeleton rounded-full" />
                    <div className="h-2.5 w-20 glass-skeleton rounded-full" />
                  </div>
                  <div className="h-3 w-40 glass-skeleton rounded-full" />
                  <div className="h-5 w-24 glass-skeleton rounded-full" />
                  <div className="h-3 w-16 glass-skeleton rounded-full" />
                  <div className="h-3 w-14 glass-skeleton rounded-full" />
                </div>
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <EmptyState hasSearch={hasSearch} onAdd={openAdd} />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/6">
                  {['Name', 'Email', 'Company', 'Total Spent', 'Last Contacted', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-white/25">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    isSelected={selectedContact?.id === contact.id}
                    onClick={() => setSelectedContact(selectedContact?.id === contact.id ? null : contact)}
                    onEdit={() => openEdit(contact)}
                    onDelete={() => { if (confirm('Delete this contact?')) deleteMutation.mutate(contact.id); }}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {data && data.meta.totalPages > 1 && (
          <Pagination
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
            limit={data.meta.limit}
            onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          />
        )}
      </div>

      {/* ── Detail side panel ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedContact && (
          <ContactPanel
            key={selectedContact.id}
            contact={selectedContact}
            onClose={() => setSelectedContact(null)}
            onEdit={() => openEdit(selectedContact)}
          />
        )}
      </AnimatePresence>

      {/* ── Modal ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalOpen && (
          <ContactModal
            key="modal"
            contact={editContact}
            onClose={() => { setModalOpen(false); setEditContact(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
