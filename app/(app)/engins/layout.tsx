import { requireModuleAccess } from "@/lib/auth/can-edit";

export default async function EnginsLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("engins");
  return children;
}
