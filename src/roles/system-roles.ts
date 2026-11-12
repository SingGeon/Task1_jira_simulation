import { GrantScope, Permission, PermissionGrant } from '../access/permission.enum';

export const SYSTEM_ROLE_NAMES = {
  PROJECT_MANAGER: 'Project Manager',
  DEVELOPER: 'Developer',
  QA: 'QA',
  VIEWER: 'Viewer',
} as const;

const all = (...p: Permission[]): PermissionGrant[] => p.map((permission) => ({ permission }));

export interface RoleSeed {
  name: string;
  description: string;
  isDefault: boolean;
  grants: PermissionGrant[];
}

export const SYSTEM_ROLES: RoleSeed[] = [
  {
    name: SYSTEM_ROLE_NAMES.PROJECT_MANAGER,
    description: 'Full control over the project',
    isDefault: false,
    grants: all(...Object.values(Permission)),
  },
  {
    name: SYSTEM_ROLE_NAMES.DEVELOPER,
    description: 'Works on tasks; can change only tasks assigned to them',
    isDefault: false,
    grants: [
      ...all(Permission.PROJECT_VIEW, Permission.TASK_CREATE, Permission.TASK_ASSIGNABLE, Permission.COMMENT_CREATE),
      { permission: Permission.TASK_UPDATE, scope: GrantScope.ASSIGNEE },
      { permission: Permission.TASK_UPDATE, scope: GrantScope.REPORTER },
      { permission: Permission.TASK_TRANSITION, scope: GrantScope.ASSIGNEE },
      { permission: Permission.TASK_ASSIGN, scope: GrantScope.ASSIGNEE }, // hand over own task
      { permission: Permission.TASK_DELETE, scope: GrantScope.ASSIGNEE }, // delete your own task, like Jira's "assignee can delete"
    ],
  },
  {
    name: SYSTEM_ROLE_NAMES.QA,
    description: 'Tests tasks; can change only tasks that are in QA and assigned to them',
    isDefault: false,
    grants: [
      ...all(Permission.PROJECT_VIEW, Permission.TASK_CREATE, Permission.TASK_ASSIGNABLE, Permission.COMMENT_CREATE),
      { permission: Permission.TASK_UPDATE, scope: GrantScope.ASSIGNEE, statuses: ['IN_QA'] },
      { permission: Permission.TASK_TRANSITION, scope: GrantScope.ASSIGNEE, statuses: ['IN_QA'] },
      { permission: Permission.TASK_ASSIGN, scope: GrantScope.ASSIGNEE, statuses: ['IN_QA'] },
    ],
  },
  {
    name: SYSTEM_ROLE_NAMES.VIEWER,
    description: 'Read-only access (default role for new members)',
    isDefault: true,
    grants: all(Permission.PROJECT_VIEW),
  },
];
