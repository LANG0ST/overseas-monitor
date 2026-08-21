import Image from "next/image";
import Link from "next/link";
import { setPartenaireActive } from "./actions";
import { SubmitButton } from "@/components/shared/submit-button";
import { canEdit } from "@/lib/auth/can-edit";
import { createClient } from "@/lib/supabase/server";
import { signedImageUrl } from "@/lib/supabase/storage";

export default async function PartenairesPage({
  searchParams,
}: {
  searchParams: Promise<{ inactive?: string; error?: string }>;
}) {
  const params = await searchParams;
  const showInactive = params.inactive === "1";
  const supabase = await createClient();
  const editable = await canEdit("partenaires");
  const { data } = await supabase
    .from("partenaires")
    .select("id, name, ice, address, logo_url")
    .eq("is_active", !showInactive)
    .order("name");
  const partenaires = await Promise.all(
    (data ?? []).map(async (partenaire) => ({
      ...partenaire,
      imageUrl: await signedImageUrl(
        supabase,
        "partenaire-logos",
        partenaire.logo_url,
      ),
    })),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Clients et fournisseurs</p>
          <h1 className="mt-1 text-3xl font-semibold">Partenaires</h1>
        </div>
        <div className="flex gap-2">
          <Link
            className="rounded-full border bg-white px-4 py-2 text-sm text-ink-900 shadow-sm"
            href={showInactive ? "/partenaires" : "/partenaires?inactive=1"}
          >
            {showInactive ? "Actifs" : "Inactifs"}
          </Link>
          {editable ? (
            <Link
              className="rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white"
              href="/partenaires/new"
            >
              + Nouveau
            </Link>
          ) : null}
        </div>
      </div>
      {params.error === "soft-delete" ? (
        <p className="rounded-xl border border-destructive/30 bg-white px-4 py-3 text-sm text-destructive">
          La modification n’a pas été appliquée. Vérifiez votre permission
          d’édition et réessayez.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {partenaires.map((partenaire) => (
          <article
            className="glass-card overflow-hidden rounded-2xl"
            key={partenaire.id}
          >
            <div className="flex h-36 items-center justify-center bg-primary-50">
              {partenaire.imageUrl ? (
                <Image
                  alt=""
                  className="h-full w-full object-cover"
                  height={240}
                  src={partenaire.imageUrl}
                  unoptimized
                  width={360}
                />
              ) : (
                <span className="text-3xl font-semibold text-primary-300">
                  {partenaire.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="space-y-3 p-5">
              <div>
                <h2 className="font-semibold">{partenaire.name}</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  ICE : {partenaire.ice || "Non renseigné"}
                </p>
              </div>
              <p className="line-clamp-2 text-sm text-neutral-600">
                {partenaire.address || "Adresse non renseignée"}
              </p>
              {editable ? (
                <div className="flex gap-2">
                  <Link
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-900 shadow-sm"
                    href={`/partenaires/${partenaire.id}/edit`}
                  >
                    Modifier
                  </Link>
                  <form
                    action={setPartenaireActive.bind(
                      null,
                      partenaire.id,
                      showInactive,
                      showInactive ? "/partenaires?inactive=1" : "/partenaires",
                    )}
                  >
                    <SubmitButton className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-900 shadow-sm">
                      {showInactive ? "Restaurer" : "Désactiver"}
                    </SubmitButton>
                  </form>
                </div>
              ) : (
                <p className="text-xs text-neutral-500">Lecture seule</p>
              )}
            </div>
          </article>
        ))}
      </div>
      {partenaires.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-neutral-500">
          Aucun partenaire dans cette vue.
        </p>
      ) : null}
    </div>
  );
}
