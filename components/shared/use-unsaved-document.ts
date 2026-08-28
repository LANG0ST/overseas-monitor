"use client";

import { useEffect } from "react";

const MESSAGE = "Des modifications ne sont pas enregistrées. Quitter ce document ?";

export function documentDraftSignature(
  document: Record<string, unknown>,
  lineItems: unknown[],
  tvaRate: number,
  city: string,
  hasCachet: boolean,
) {
  return JSON.stringify({
    ...document,
    line_items: lineItems,
    tva_rate: tvaRate,
    city,
    has_cachet: hasCachet,
  });
}

export function useUnsavedDocument(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const guardLinks = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank" || target.download || event.defaultPrevented) return;
      const destination = new URL(target.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      if (!window.confirm(MESSAGE)) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardLinks, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardLinks, true);
    };
  }, [dirty]);
}
