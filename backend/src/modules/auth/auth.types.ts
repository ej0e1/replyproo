export type AuthenticatedUser = {
  sub: string;
  email: string;
  activeTenantId?: string | null;
};
