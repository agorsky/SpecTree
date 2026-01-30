export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  teamId: string;
  isActive: boolean;
  isGlobalAdmin: boolean;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  role: string;
  user: User;
}

export interface Team {
  id: string;
  name: string;
  key?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Status {
  id: string;
  name: string;
  category: "backlog" | "unstarted" | "started" | "completed" | "canceled";
  color: string;
  position: number;
  teamId: string;
}

export interface Feature {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  statusId: string;
  status?: Status;
  assigneeId?: string;
  assignee?: User;
  projectId: string;
  project?: Project;
  priority?: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    tasks: number;
  };
  completedTaskCount?: number;
}

export interface Task {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  statusId: string;
  status?: Status;
  assigneeId?: string;
  assignee?: User;
  featureId: string;
  feature?: {
    id: string;
    identifier: string;
    title: string;
  };
  priority?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
