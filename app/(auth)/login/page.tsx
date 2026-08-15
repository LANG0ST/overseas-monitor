import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">Overseas Services</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Connexion</h1>
        <p className="mt-2 text-sm text-muted-foreground">Accédez à votre espace de travail.</p>
        <LoginForm />
      </section>
    </main>
  );
}
