'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSendEmail, useSendSms } from '../hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const emailSchema = z.object({
  toAddr: z.string().email('Invalid email'),
  subject: z.string().min(1, 'Required'),
  body: z.string().min(1, 'Required'),
  contactId: z.string().optional(),
});

const smsSchema = z.object({
  toAddr: z.string().min(7, 'Invalid phone'),
  body: z.string().min(1, 'Required'),
  contactId: z.string().optional(),
});

type EmailForm = z.infer<typeof emailSchema>;
type SmsForm = z.infer<typeof smsSchema>;

interface Props {
  defaultChannel?: 'EMAIL' | 'SMS';
  contactId?: string;
  onClose: () => void;
}

export function ComposeModal({ defaultChannel = 'EMAIL', contactId, onClose }: Props) {
  const [channel, setChannel] = useState<'EMAIL' | 'SMS'>(defaultChannel);
  const sendEmail = useSendEmail();
  const sendSms = useSendSms();

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { contactId },
  });

  const smsForm = useForm<SmsForm>({
    resolver: zodResolver(smsSchema),
    defaultValues: { contactId },
  });

  const onSubmitEmail = async (data: EmailForm) => {
    await sendEmail.mutateAsync(data);
    onClose();
  };

  const onSubmitSms = async (data: SmsForm) => {
    await sendSms.mutateAsync(data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold flex-1">Compose</h2>
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {(['EMAIL', 'SMS'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={`px-3 py-1 text-xs font-medium ${
                  channel === ch
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        {channel === 'EMAIL' ? (
          <form onSubmit={emailForm.handleSubmit(onSubmitEmail)} className="space-y-3">
            <div>
              <Label>To</Label>
              <Input type="email" {...emailForm.register('toAddr')} placeholder="recipient@example.com" />
              {emailForm.formState.errors.toAddr && (
                <p className="text-xs text-red-500">{emailForm.formState.errors.toAddr.message}</p>
              )}
            </div>
            <div>
              <Label>Subject</Label>
              <Input {...emailForm.register('subject')} />
              {emailForm.formState.errors.subject && (
                <p className="text-xs text-red-500">{emailForm.formState.errors.subject.message}</p>
              )}
            </div>
            <div>
              <Label>Body</Label>
              <textarea
                {...emailForm.register('body')}
                rows={5}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm resize-none"
              />
              {emailForm.formState.errors.body && (
                <p className="text-xs text-red-500">{emailForm.formState.errors.body.message}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" isLoading={emailForm.formState.isSubmitting}>Send Email</Button>
            </div>
          </form>
        ) : (
          <form onSubmit={smsForm.handleSubmit(onSubmitSms)} className="space-y-3">
            <div>
              <Label>Phone Number</Label>
              <Input {...smsForm.register('toAddr')} placeholder="+1234567890" />
              {smsForm.formState.errors.toAddr && (
                <p className="text-xs text-red-500">{smsForm.formState.errors.toAddr.message}</p>
              )}
            </div>
            <div>
              <Label>Message</Label>
              <textarea
                {...smsForm.register('body')}
                rows={4}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm resize-none"
              />
              {smsForm.formState.errors.body && (
                <p className="text-xs text-red-500">{smsForm.formState.errors.body.message}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" isLoading={smsForm.formState.isSubmitting}>Send SMS</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
