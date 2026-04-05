import { apiGet, apiPost, apiPatch } from './client';
import type { User, PaginatedData } from '@/types';

export const usersApi = {
  getAll: (params?: object) => apiGet<PaginatedData<User>>('/users', params),

  getById: (id: string) => apiGet<User>(`/users/${id}`),

  getMe: () => apiGet<User>('/users/me'),

  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
    phone?: string;
    avatar?: string;
    timezone?: string;
  }) => apiPatch<User>('/users/me', data),

  invite: (data: {
    email: string;
    firstName: string;
    lastName: string;
    role?: string;
    jobTitle?: string;
  }) => apiPost<User>('/users/invite', data),

  updateRole: (id: string, role: string) =>
    apiPatch<User>(`/users/${id}/role`, { role }),

  deactivate: (id: string) => apiPatch<User>(`/users/${id}/deactivate`, {}),

  activate: (id: string) => apiPatch<User>(`/users/${id}/activate`, {}),

  changePassword: (data: {
    currentPassword: string;
    newPassword: string;
  }) => apiPatch<{ message: string }>('/users/me/change-password', data),
};
