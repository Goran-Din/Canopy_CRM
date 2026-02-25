export interface AuthUser {
  id: string;
  email: string;
  tenant_id: string;
  roles: Array<{ role: string; division_id: string | null }>;
  divisions: string[];
}
