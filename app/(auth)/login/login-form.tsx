"use client";

import { LockKeyhole, Mail } from "lucide-react";
import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <label className="relative block">
        <span className="sr-only">Adresse e-mail</span>
        <Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={19} />
        <input
          className="h-13 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-12 pr-4 text-base outline-none transition placeholder:text-neutral-400 focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100"
          name="email"
          type="email"
          placeholder="Adresse e-mail"
          autoComplete="email"
          required
        />
      </label>
      <label className="relative block">
        <span className="sr-only">Mot de passe</span>
        <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={19} />
        <input
          className="h-13 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-12 pr-4 text-base outline-none transition placeholder:text-neutral-400 focus:border-primary-500 focus:bg-white focus:ring-4 focus:ring-primary-100"
          name="password"
          type="password"
          placeholder="Mot de passe"
          autoComplete="current-password"
          required
        />
      </label>
      {state.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-destructive">{state.error}</p> : null}
      <button
        className="mt-2 h-13 w-full rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
