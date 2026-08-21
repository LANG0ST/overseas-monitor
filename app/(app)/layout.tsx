import { LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
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
  const userMetadata = claimsData.claims.user_metadata as Record<string, unknown> | undefined;
  const avatarUrl = typeof userMetadata?.avatar_url === "string"
    ? userMetadata.avatar_url
    : typeof userMetadata?.picture === "string"
      ? userMetadata.picture
      : undefined;

  return (
    <div className="app-canvas p-4 md:p-8 print:bg-white print:p-0">
      <div className="mx-auto flex w-full max-w-[1600px] gap-6">
        <DesktopNavigation avatarUrl={avatarUrl} isAdmin={isAdmin} userName={name} />
        <div className="glass-card min-h-[calc(100dvh-2rem)] min-w-0 flex-1 rounded-3xl p-3 md:min-h-[calc(100dvh-4rem)] md:p-5 print:contents">
          <header className="glass-card flex min-h-14 items-center justify-between rounded-full px-4 py-2 md:px-6 print:hidden">
            <Link aria-label="Accueil Overseas Services" className="flex h-10 items-center" href="/dashboard">
              <Image alt="Overseas Services" className="h-auto w-36" height={880} priority src="/logo.png" width={3574} />
            </Link>
            <div>
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
          <div className="min-w-0 px-1 py-6 pb-24 md:px-4 md:pb-6 print:p-0">{children}</div>
        </div>
      </div>
      <MobileNavigation avatarUrl={avatarUrl} isAdmin={isAdmin} userName={name} />
    </div>
  );
}
