/**
 * RBAC DTOs
 * Type definitions for role-based access control
 */

export interface Permission {
  resource: string;
  actions: string[];
}

export interface RoleDefinition {
  role: string;
  displayName: string;
  description: string;
  level: number;
  permissions: Permission[];
}

export interface PermissionsResult {
  role: string;
  permissions: Permission[];
  canManage: string[];
}
