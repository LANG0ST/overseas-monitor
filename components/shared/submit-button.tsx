"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

export function SubmitButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={cn(className, "disabled:cursor-not-allowed disabled:opacity-60")} disabled={pending} type="submit">
      {pending ? "Enregistrement…" : children}
    </button>
  );
}
