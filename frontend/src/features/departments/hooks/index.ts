import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { departmentsApi } from '../services';
import type {
  CreateDepartmentPayload,
  DepartmentListParams,
  UpdateDepartmentPayload,
  UpdateDepartmentStatusPayload,
} from '../types';

const DEPARTMENTS_LIST_QUERY_KEY = 'departments-list';

export function useDepartmentsQuery(params: DepartmentListParams) {
  return useQuery({
    queryKey: [DEPARTMENTS_LIST_QUERY_KEY, params],
    queryFn: () => departmentsApi.list(params),
    placeholderData: (previous) => previous,
  });
}

function useInvalidateDepartments() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [DEPARTMENTS_LIST_QUERY_KEY] });
  };
}

export function useCreateDepartmentMutation() {
  const invalidate = useInvalidateDepartments();
  return useMutation({
    mutationFn: (payload: CreateDepartmentPayload) => departmentsApi.create(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateDepartmentMutation() {
  const invalidate = useInvalidateDepartments();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDepartmentPayload }) =>
      departmentsApi.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useUpdateDepartmentStatusMutation() {
  const invalidate = useInvalidateDepartments();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDepartmentStatusPayload }) =>
      departmentsApi.updateStatus(id, payload),
    onSuccess: invalidate,
  });
}
