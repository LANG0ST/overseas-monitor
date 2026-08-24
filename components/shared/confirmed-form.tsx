"use client";

import { useRef, useState, type ComponentProps } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmedFormProps = ComponentProps<"form"> & {
  confirmationTitle: string;
  confirmationDescription: string;
  confirmationLabel?: string;
  destructive?: boolean;
};

export function ConfirmedForm({ children, confirmationDescription, confirmationLabel = "Confirmer", confirmationTitle, destructive = false, onSubmit, ...props }: ConfirmedFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const approved = useRef(false);

  return (
    <>
      <form ref={formRef} onSubmit={(event) => {
        if (approved.current) {
          approved.current = false;
          onSubmit?.(event);
          return;
        }
        event.preventDefault();
        setOpen(true);
      }} {...props}>
        {children}
      </form>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmationDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className={destructive ? "bg-red-700 text-white hover:bg-red-800" : "bg-ink-900 text-white hover:bg-ink-800"} onClick={() => {
              approved.current = true;
              formRef.current?.requestSubmit();
            }}>
              {confirmationLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
