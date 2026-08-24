"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type ConfirmationOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
};

export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);

  const settle = useCallback((accepted: boolean) => {
    resolver.current?.(accepted);
    resolver.current = null;
    setOptions(null);
  }, []);

  useEffect(() => () => resolver.current?.(false), []);

  const confirm = useCallback((nextOptions: ConfirmationOptions) => {
    resolver.current?.(false);
    setOptions(nextOptions);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const confirmationDialog = (
    <AlertDialog
      open={options !== null}
      onOpenChange={(open) => {
        if (!open && options) settle(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options?.title}</AlertDialogTitle>
          <AlertDialogDescription>{options?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            className={options?.destructive ? "bg-red-700 text-white hover:bg-red-800" : "bg-ink-900 text-white hover:bg-ink-800"}
            onClick={() => settle(true)}
          >
            {options?.confirmLabel ?? "Confirmer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, confirmationDialog };
}
