import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { signOut } from "@/app/(auth)/login/actions";
import { DesktopNavigation, MobileNavigation } from "@/components/shared/app-navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role")
    .eq("id", claimsData.claims.sub)
    .maybeSingle();

  const name = profile?.name || "Utilisateur";
  const isAdmin = profile?.role === "admin";

  return (
    <div className="app-canvas p-4 md:p-8 print:bg-white print:p-0">
      <div className="mx-auto flex max-w-[1600px] gap-6">
        <DesktopNavigation isAdmin={isAdmin} />
        <div className="glass-card min-h-[calc(100dvh-2rem)] flex-1 rounded-3xl p-3 md:min-h-[calc(100dvh-4rem)] md:p-5 print:contents">
          <header className="glass-card flex min-h-14 items-center justify-between rounded-full px-4 py-2 md:px-6 print:hidden">
            <div>
              <p className="text-sm font-semibold text-neutral-900">Overseas Services</p>
              <p className="text-xs text-neutral-500">Gestion interne</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-neutral-900">{name}</p>
                <p className="text-xs capitalize text-neutral-500">{profile?.role ?? "staff"}</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700">
                {name.slice(0, 1).toUpperCase()}
              </div>
              <form action={signOut}>
                <button
                  aria-label="Se déconnecter"
                  className="flex size-9 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-white"
                  type="submit"
                >
                  <LogOut size={18} strokeWidth={1.75} />
                </button>
              </form>
            </div>
          </header>
          <div className="px-1 py-6 pb-24 md:px-4 md:pb-6 print:p-0">{children}</div>
        </div>
      </div>
      <MobileNavigation isAdmin={isAdmin} />
    </div>
  );
}
