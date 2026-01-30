/**
 * Authentication types for SpecTree
 */

export interface ActivateAccountRequest {
  email: string;
  code: string;
  name: string;
  password: string;
}

export interface ActivateAccountResponse {
  user: {
    id: string;
    email: string;
    name: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}
