import Link from "next/link";
import { redirect } from "next/navigation";
import { EnginForm } from "../form";
import { createEngin } from "../actions";
import { canEdit } from "@/lib/auth/can-edit";

export default async function NewEnginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!(await canEdit("engins"))) redirect("/engins");
  const { error } = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <Link className="text-sm text-primary-600" href="/engins">
          ← Parc d’engins
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Nouvel engin</h1>
      </div>
      <EnginForm
        action={createEngin}
        error={error}
        submitLabel="Créer l’engin"
      />
    </div>
  );
}
