import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  departmentOptionsApi,
  experienceLevelOptionsApi,
  groupMembersApi,
  groupsApi,
  traineeOptionsApi,
  trainerOptionsApi,
} from '../services';
import type {
  AddGroupMemberPayload,
  AddGroupMembersPayload,
  AssignTrainerPayload,
  CreateGroupPayload,
  DuplicateGroupPayload,
  GroupListParams,
  GroupMemberListParams,
  TransferGroupMemberPayload,
  UpdateGroupPayload,
  UpdateGroupStatusPayload,
} from '../types';

const GROUPS_LIST_QUERY_KEY = 'groups-list';
const GROUP_QUERY_KEY = 'group';
const GROUP_STATS_QUERY_KEY = 'group-stats';
const GROUP_MEMBERS_QUERY_KEY = 'group-members';
const DEPARTMENT_OPTIONS_QUERY_KEY = 'groups-department-options';
const EXPERIENCE_LEVEL_OPTIONS_QUERY_KEY = 'groups-experience-level-options';
const TRAINER_OPTIONS_QUERY_KEY = 'groups-trainer-options';
const TRAINEE_OPTIONS_QUERY_KEY = 'groups-trainee-options';
const MY_GROUPS_QUERY_KEY = 'groups-mine';

export function useGroupsQuery(params: GroupListParams) {
  return useQuery({
    queryKey: [GROUPS_LIST_QUERY_KEY, params],
    queryFn: () => groupsApi.list(params),
    placeholderData: (previous) => previous,
  });
}

export function useGroupQuery(id: string | undefined) {
  return useQuery({
    queryKey: [GROUP_QUERY_KEY, id],
    queryFn: () => groupsApi.getById(id as string),
    enabled: Boolean(id),
  });
}

/** Name kept exactly stable — the dashboard wiring depends on it (see Prompt 4 instructions). */
export function useGroupStatsQuery() {
  return useQuery({ queryKey: [GROUP_STATS_QUERY_KEY], queryFn: groupsApi.stats });
}

export function useGroupMembersQuery(groupId: string | undefined, params: GroupMemberListParams) {
  return useQuery({
    queryKey: [GROUP_MEMBERS_QUERY_KEY, groupId, params],
    queryFn: () => groupMembersApi.list(groupId as string, params),
    enabled: Boolean(groupId),
    placeholderData: (previous) => previous,
  });
}

/** Feature-local dropdown lookups — see services/index.ts for why these duplicate other features. */
export function useActiveDepartmentsOptions() {
  return useQuery({
    queryKey: [DEPARTMENT_OPTIONS_QUERY_KEY],
    queryFn: departmentOptionsApi.list,
    staleTime: 5 * 60_000,
  });
}

export function useActiveExperienceLevelsOptions() {
  return useQuery({
    queryKey: [EXPERIENCE_LEVEL_OPTIONS_QUERY_KEY],
    queryFn: experienceLevelOptionsApi.list,
    staleTime: 5 * 60_000,
  });
}

export function useTrainersOptions() {
  return useQuery({
    queryKey: [TRAINER_OPTIONS_QUERY_KEY],
    queryFn: trainerOptionsApi.list,
    staleTime: 5 * 60_000,
  });
}

/** Powers the "Assign Users" checklist in add-member-dialog.tsx. */
export function useTraineesOptions() {
  return useQuery({
    queryKey: [TRAINEE_OPTIONS_QUERY_KEY],
    queryFn: traineeOptionsApi.list,
    staleTime: 60_000,
  });
}

/**
 * The current user's own group memberships — any role may call this (unlike `useGroupsQuery`,
 * which hits the Trainer/Super-Admin-only `GET /groups`). Powers the Q&A "Ask Question" form's
 * GROUP-visibility group picker for a Trainee (Prompt 7 § GROUP VISIBILITY).
 */
export function useMyGroupsOptions() {
  return useQuery({
    queryKey: [MY_GROUPS_QUERY_KEY],
    queryFn: groupsApi.mine,
    staleTime: 60_000,
  });
}

function useInvalidateGroupsList() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: [GROUPS_LIST_QUERY_KEY] });
    void queryClient.invalidateQueries({ queryKey: [GROUP_STATS_QUERY_KEY] });
  };
}

function useInvalidateGroup() {
  const queryClient = useQueryClient();
  return (id: string) => void queryClient.invalidateQueries({ queryKey: [GROUP_QUERY_KEY, id] });
}

export function useCreateGroupMutation() {
  const invalidateList = useInvalidateGroupsList();
  return useMutation({
    mutationFn: (payload: CreateGroupPayload) => groupsApi.create(payload),
    onSuccess: invalidateList,
  });
}

export function useUpdateGroupMutation() {
  const invalidateList = useInvalidateGroupsList();
  const invalidateGroup = useInvalidateGroup();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateGroupPayload }) => groupsApi.update(id, payload),
    onSuccess: (_data, variables) => {
      invalidateList();
      invalidateGroup(variables.id);
    },
  });
}

export function useUpdateGroupStatusMutation() {
  const invalidateList = useInvalidateGroupsList();
  const invalidateGroup = useInvalidateGroup();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateGroupStatusPayload }) =>
      groupsApi.updateStatus(id, payload),
    onSuccess: (_data, variables) => {
      invalidateList();
      invalidateGroup(variables.id);
    },
  });
}

export function useAssignTrainerMutation() {
  const invalidateList = useInvalidateGroupsList();
  const invalidateGroup = useInvalidateGroup();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AssignTrainerPayload }) =>
      groupsApi.assignTrainer(id, payload),
    onSuccess: (_data, variables) => {
      invalidateList();
      invalidateGroup(variables.id);
    },
  });
}

export function useDuplicateGroupMutation() {
  const invalidateList = useInvalidateGroupsList();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DuplicateGroupPayload }) =>
      groupsApi.duplicate(id, payload),
    onSuccess: invalidateList,
  });
}

export function useDeleteGroupMutation() {
  const invalidateList = useInvalidateGroupsList();
  return useMutation({
    mutationFn: (id: string) => groupsApi.remove(id),
    onSuccess: invalidateList,
  });
}

/**
 * Member mutations invalidate that group's roster and the group detail (its member count
 * changes), plus the groups list/stats (list shows a "members / capacity" count and stats
 * tracks total trainees).
 */
function useInvalidateGroupMembers() {
  const queryClient = useQueryClient();
  const invalidateList = useInvalidateGroupsList();
  return (groupId: string) => {
    void queryClient.invalidateQueries({ queryKey: [GROUP_MEMBERS_QUERY_KEY, groupId] });
    void queryClient.invalidateQueries({ queryKey: [GROUP_QUERY_KEY, groupId] });
    invalidateList();
  };
}

export function useAddGroupMemberMutation() {
  const invalidate = useInvalidateGroupMembers();
  return useMutation({
    mutationFn: ({ groupId, payload }: { groupId: string; payload: AddGroupMemberPayload }) =>
      groupMembersApi.add(groupId, payload),
    onSuccess: (_data, variables) => invalidate(variables.groupId),
  });
}

export function useAddGroupMembersMutation() {
  const invalidate = useInvalidateGroupMembers();
  return useMutation({
    mutationFn: ({ groupId, payload }: { groupId: string; payload: AddGroupMembersPayload }) =>
      groupMembersApi.addMany(groupId, payload),
    onSuccess: (_data, variables) => invalidate(variables.groupId),
  });
}

export function useRemoveGroupMemberMutation() {
  const invalidate = useInvalidateGroupMembers();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      groupMembersApi.remove(groupId, userId),
    onSuccess: (_data, variables) => invalidate(variables.groupId),
  });
}

export function useTransferGroupMemberMutation() {
  const invalidate = useInvalidateGroupMembers();
  return useMutation({
    mutationFn: ({
      groupId,
      userId,
      payload,
    }: {
      groupId: string;
      userId: string;
      payload: TransferGroupMemberPayload;
    }) => groupMembersApi.transfer(groupId, userId, payload),
    onSuccess: (_data, variables) => {
      invalidate(variables.groupId);
      invalidate(variables.payload.toGroupId);
    },
  });
}

export function useBulkImportGroupMembersMutation() {
  const invalidate = useInvalidateGroupMembers();
  return useMutation({
    mutationFn: ({ groupId, file }: { groupId: string; file: File }) =>
      groupMembersApi.bulkImport(groupId, file),
    onSuccess: (_data, variables) => invalidate(variables.groupId),
  });
}
