import { requireModuleAccess } from "@/lib/auth/can-edit";

export default async function PointageLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("pointage");
  return children;
}
