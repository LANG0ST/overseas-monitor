import Image from "next/image";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      <section className="relative hidden min-h-screen overflow-hidden lg:flex lg:items-center lg:justify-center">
        <Image
          alt="Navire porte-conteneurs Overseas Services"
          className="object-cover"
          fill
          priority
          sizes="50vw"
          src="/loginBG.png"
        />
        <div className="absolute inset-0 bg-ink-950/25" />
        <Image
          alt="Overseas Services"
          className="relative z-10 h-auto w-[70%] max-w-[34rem] brightness-0 invert"
          height={176}
          priority
          src="/logo.png"
          width={720}
        />
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="w-full max-w-md">
          <div className="mb-12 flex justify-center lg:hidden">
            <Image
              alt="Overseas Services"
              className="h-auto w-64 sm:w-72"
              height={148}
              priority
              src="/logo.png"
              width={600}
            />
          </div>
          <h1 className="text-center text-4xl font-semibold tracking-tight text-ink-950">Bienvenue</h1>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
