import { requireModuleAccess } from "@/lib/auth/can-edit";

export default async function FacturesLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("factures");
  return children;
}
