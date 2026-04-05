'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateCompany, useUpdateCompany } from '../hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Company } from '@/types';

const INDUSTRIES = ['TECHNOLOGY', 'FINANCE', 'HEALTHCARE', 'RETAIL', 'MANUFACTURING', 'EDUCATION', 'OTHER'];

const schema = z.object({
  name: z.string().min(1, 'Required'),
  industry: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  phone: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  employeeCount: z.coerce.number().positive().optional(),
  annualRevenue: z.coerce.number().positive().optional(),
  description: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  company?: Company | null;
  onClose: () => void;
}

export function CompanyModal({ company, onClose }: Props) {
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: company
      ? {
          name: company.name,
          industry: company.industry ?? '',
          website: company.website ?? '',
          phone: company.phone ?? '',
          city: company.city ?? '',
          country: company.country ?? '',
          employeeCount: company.employeeCount,
          annualRevenue: company.annualRevenue,
          description: company.description ?? '',
        }
      : {},
  });

  const onSubmit = async (data: FormData) => {
    if (company) {
      await updateCompany.mutateAsync({ id: company.id, data });
    } else {
      await createCompany.mutateAsync(data);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold mb-4">{company ? 'Edit Company' : 'Add Company'}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <Label>Company Name</Label>
            <Input {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Industry</Label>
              <select
                {...register('industry')}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="">Select industry</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <Label>Phone</Label>
              <Input {...register('phone')} />
            </div>
          </div>
          <div>
            <Label>Website</Label>
            <Input {...register('website')} placeholder="https://" />
            {errors.website && <p className="text-xs text-red-500">{errors.website.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>City</Label>
              <Input {...register('city')} />
            </div>
            <div>
              <Label>Country</Label>
              <Input {...register('country')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Employees</Label>
              <Input type="number" {...register('employeeCount')} />
            </div>
            <div>
              <Label>Annual Revenue ($)</Label>
              <Input type="number" {...register('annualRevenue')} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <textarea
              {...register('description')}
              rows={2}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isSubmitting}>
              {company ? 'Save Changes' : 'Create Company'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
