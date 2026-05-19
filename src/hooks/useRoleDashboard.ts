import { useAuth } from "@/contexts/AuthContext";

export type DashboardKind = "owner" | "stylist" | "manager" | "accountant";

export function useRoleDashboard(): DashboardKind {
  const { userRoles } = useAuth();
  if (userRoles.includes("owner") || userRoles.includes("manager")) return "owner";
  if (userRoles.includes("accountant")) return "accountant";
  if (userRoles.includes("stylist")) return "stylist";
  if (userRoles.includes("inventory_clerk")) return "manager";
  return "owner";
}
