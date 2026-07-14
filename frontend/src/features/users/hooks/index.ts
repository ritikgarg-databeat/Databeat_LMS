import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { departmentsApi, experienceLevelsApi, usersApi } from '../services';
import type { CreateUserPayload, ResetPasswordPayload, UpdateUserPayload, UserListParams } from '../types';

const USERS_QUERY_KEY = 'users';
const DEPARTMENTS_QUERY_KEY = 'departments';
const EXPERIENCE_LEVELS_QUERY_KEY = 'experience-levels';

export function useUsersQuery(params: UserListParams) {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, params],
    queryFn: () => usersApi.list(params),
    placeholderData: (previous) => previous,
  });
}

export function useDepartmentsQuery() {
  return useQuery({ queryKey: [DEPARTMENTS_QUERY_KEY], queryFn: departmentsApi.list, staleTime: 5 * 60_000 });
}

export function useExperienceLevelsQuery() {
  return useQuery({
    queryKey: [EXPERIENCE_LEVELS_QUERY_KEY],
    queryFn: experienceLevelsApi.list,
    staleTime: 5 * 60_000,
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
}

export function useCreateUserMutation() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => usersApi.create(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateUserMutation() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) => usersApi.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeactivateUserMutation() {
  const invalidate = useInvalidateUsers();
  return useMutation({ mutationFn: (id: string) => usersApi.deactivate(id), onSuccess: invalidate });
}

export function useReactivateUserMutation() {
  const invalidate = useInvalidateUsers();
  return useMutation({ mutationFn: (id: string) => usersApi.reactivate(id), onSuccess: invalidate });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ResetPasswordPayload }) =>
      usersApi.resetPassword(id, payload),
  });
}
