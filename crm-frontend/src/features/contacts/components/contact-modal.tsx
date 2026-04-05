'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateContact, useUpdateContact } from '../hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Contact } from '@/types';

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  contact?: Contact | null;
  onClose: () => void;
}

export function ContactModal({ contact, onClose }: Props) {
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: contact
      ? {
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email ?? '',
          phone: contact.phone ?? '',
          jobTitle: contact.jobTitle ?? '',
        }
      : {},
  });

  const onSubmit = async (data: FormData) => {
    if (contact) {
      await updateContact.mutateAsync({ id: contact.id, data });
    } else {
      await createContact.mutateAsync(data);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">{contact ? 'Edit Contact' : 'Add Contact'}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First Name</Label>
              <Input {...register('firstName')} />
              {errors.firstName && <p className="text-xs text-red-500">{errors.firstName.message}</p>}
            </div>
            <div>
              <Label>Last Name</Label>
              <Input {...register('lastName')} />
              {errors.lastName && <p className="text-xs text-red-500">{errors.lastName.message}</p>}
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div>
            <Label>Phone</Label>
            <Input {...register('phone')} />
          </div>
          <div>
            <Label>Job Title</Label>
            <Input {...register('jobTitle')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>
              {contact ? 'Save' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
