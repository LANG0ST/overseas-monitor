"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <label className="block text-sm font-medium">
        Adresse e-mail
        <input
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </label>
      <label className="block text-sm font-medium">
        Mot de passe
        <input
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <button
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
