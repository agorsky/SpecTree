/**
 * User types for SpecTree
 */

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  isActive: boolean;
  isGlobalAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}
