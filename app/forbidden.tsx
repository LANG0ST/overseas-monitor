import { ShieldX } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="fixed inset-0 z-50 flex overflow-hidden bg-white">
      <section className="m-auto w-full max-w-md px-6 py-10 text-center">
        <Image alt="Overseas Services" className="mx-auto h-auto w-40" height={880} priority src="/logo.png" width={3574} />
        <div className="mx-auto mt-10 flex size-14 items-center justify-center rounded-full bg-red-50 text-red-700">
          <ShieldX size={27} strokeWidth={1.75} />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-red-700">Erreur 403</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">Accès refusé</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-neutral-600">
          Votre compte n’a pas accès à ce module. Contactez un administrateur si vous pensez qu’il s’agit d’une erreur.
        </p>
        <Link className="mt-7 inline-flex min-h-11 items-center rounded-full bg-ink-900 px-5 text-sm font-semibold text-white" href="/dashboard">
          Retour au tableau de bord
        </Link>
      </section>
    </main>
  );
}
