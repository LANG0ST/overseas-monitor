import { requireModuleAccess } from "@/lib/auth/can-edit";

export default async function AvoirsLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("avoirs");
  return children;
}
