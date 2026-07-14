import type { Permission } from '@/constants/permissions';

/**
 * Pure permission-check helper. Takes the current user's permission list (once the Auth
 * feature populates it) and the permission(s) required to render/enable something.
 * The frontend check is a UX convenience only — the backend re-checks on every request.
 */
export function hasPermission(userPermissions: Permission[], required: Permission | Permission[]): boolean {
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.every((permission) => userPermissions.includes(permission));
}

export function hasAnyPermission(userPermissions: Permission[], required: Permission[]): boolean {
  return required.some((permission) => userPermissions.includes(permission));
}
