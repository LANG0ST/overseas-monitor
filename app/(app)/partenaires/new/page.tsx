import Link from "next/link";
import { redirect } from "next/navigation";
import { PartenaireForm } from "../form";
import { createPartenaire } from "../actions";
import { canEdit } from "@/lib/auth/can-edit";

export default async function NewPartenairePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!(await canEdit("partenaires"))) redirect("/partenaires");
  const { error } = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <Link className="text-sm text-primary-600" href="/partenaires">
          ← Partenaires
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Nouveau partenaire</h1>
      </div>
      <PartenaireForm
        action={createPartenaire}
        error={error}
        submitLabel="Créer le partenaire"
      />
    </div>
  );
}
