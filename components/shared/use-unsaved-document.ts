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
    let leaving = false;
    let restoringHistory = false;
    let historyGuardInstalled = false;
    const installHistoryGuard = window.setTimeout(() => {
      if (window.history.state?.unsavedDocumentGuard) return;
      window.history.pushState(
        { ...window.history.state, unsavedDocumentGuard: true },
        "",
        window.location.href,
      );
      historyGuardInstalled = true;
    }, 0);

    const warn = (event: BeforeUnloadEvent) => {
      if (leaving) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const guardLinks = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank" || target.download || event.defaultPrevented) return;
      const destination = new URL(target.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      if (!window.confirm(MESSAGE)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      leaving = true;
      window.location.replace(destination.href);
    };
    const guardHistory = () => {
      if (leaving) return;
      if (restoringHistory) {
        restoringHistory = false;
        return;
      }
      if (window.confirm(MESSAGE)) {
        leaving = true;
        window.history.back();
        return;
      }
      restoringHistory = true;
      window.history.forward();
    };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("popstate", guardHistory);
    document.addEventListener("click", guardLinks, true);
    return () => {
      window.clearTimeout(installHistoryGuard);
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("popstate", guardHistory);
      document.removeEventListener("click", guardLinks, true);
      if (!leaving && historyGuardInstalled && window.history.state?.unsavedDocumentGuard) {
        window.history.back();
      }
    };
  }, [dirty]);
}
