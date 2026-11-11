export enum SystemRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export enum BoardType {
  SCRUM = 'SCRUM',
  KANBAN = 'KANBAN',
}

export enum ProjectManagement {
  COMPANY = 'COMPANY',
  TEAM = 'TEAM',
}

export enum InviteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
}

export enum StatusCategory {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
}

export enum SprintState {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

export enum TaskType {
  EPIC = 'EPIC',
  STORY = 'STORY',
  TASK = 'TASK',
  BUG = 'BUG',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum Permission {
  PROJECT_VIEW = 'project.view',
  PROJECT_UPDATE = 'project.update',
  MEMBERS_MANAGE = 'project.members.manage',
  SPRINT_MANAGE = 'sprint.manage',
  TASK_CREATE = 'task.create',
  TASK_UPDATE = 'task.update',
  TASK_TRANSITION = 'task.transition',
  TASK_ASSIGN = 'task.assign',
  TASK_ASSIGNABLE = 'task.assignable',
  TASK_DELETE = 'task.delete',
  COMMENT_CREATE = 'comment.create',
  COMMENT_MANAGE = 'comment.manage',
}

export enum GrantScope {
  ANY = 'ANY',
  ASSIGNEE = 'ASSIGNEE',
  REPORTER = 'REPORTER',
}

export interface PermissionGrant {
  permission: Permission;
  scope?: GrantScope;
  statuses?: string[];
}

export interface PermissionCatalogueEntry {
  key: Permission;
  description: string;
  supportsConditions: boolean;
}

export interface PermissionCatalogue {
  permissions: PermissionCatalogueEntry[];
  scopes: GrantScope[];
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  systemRole: SystemRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  grants: PermissionGrant[];
  isSystem: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  boardType: BoardType;
  management: ProjectManagement;
  taskCounter: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWithAccess extends Project {
  myRole: Role | null;
  myPermissions: Permission[];
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  user: User;
  roleId: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStatus {
  id: string;
  projectId: string;
  key: string;
  name: string;
  category: StatusCategory;
  position: number;
}

export interface WorkflowTransition {
  id: string;
  fromStatusId: string;
  toStatusId: string;
  from: string;
  to: string;
}

export interface Workflow {
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string;
  state: SprintState;
  startDate: string | null;
  endDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EpicRef {
  id: string;
  key: string;
  title: string;
}

export interface Task {
  id: string;
  projectId: string;
  key: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  labels: string[];
  storyPoints: number | null;
  statusId: string;
  status: WorkflowStatus;
  assigneeId: string | null;
  assignee: User | null;
  reporterId: string;
  reporter: User;
  sprintId: string | null;
  sprint: Sprint | null;
  epicId: string | null;
  epic: EpicRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface Epic extends Task {
  taskCount: number;
  doneCount: number;
}

export interface BoardColumn {
  status: WorkflowStatus;
  tasks: Task[];
}

export interface Board {
  project: { id: string; key: string; name: string; boardType: BoardType };
  sprint: Sprint | null;
  columns: BoardColumn[];
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  author: User;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  taskId: string;
  task?: { id: string; key: string; title: string; projectId: string; project?: { id: string; key: string; name: string } };
  actorId: string;
  actorName: string;
  field: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ProjectSummary {
  id: string;
  key: string;
  name: string;
  boardType: BoardType;
}

export enum JoinRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface JoinRequest {
  id: string;
  projectId: string;
  project: ProjectSummary;
  userId: string;
  user: User;
  roleId: string;
  role: Role;
  message: string;
  status: JoinRequestStatus;
  decidedById: string | null;
  decidedBy: User | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invite {
  id: string;
  projectId: string;
  project: ProjectSummary;
  userId: string;
  user: User;
  roleId: string;
  role: Role;
  invitedById: string;
  invitedBy: User;
  status: InviteStatus;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicConfig {
  registrationEnabled: boolean;
  teamProjectsEnabled: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}
