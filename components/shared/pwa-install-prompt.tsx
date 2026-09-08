"use client";

import { Download, Share } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const frame = window.requestAnimationFrame(() => {
      setIsInstalled(standalone);
      setIsIos(ios);
    });

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setIsInstalled(false);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (isInstalled || (!installPrompt && !isIos)) return null;

  async function install() {
    if (!installPrompt) {
      setShowIosHelp(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  }

  return (
    <aside className="fixed bottom-4 right-4 z-[100] max-w-[calc(100vw-2rem)] rounded-2xl border border-primary-200 bg-white p-3 text-sm text-ink-900 shadow-xl print:hidden">
      {showIosHelp ? (
        <div className="flex max-w-xs items-start gap-3">
          <Share className="mt-0.5 shrink-0 text-primary-700" size={20} />
          <div>
            <p className="font-semibold">Installer Overseas</p>
            <p className="mt-1 text-neutral-600">Dans Safari, touchez Partager puis « Sur l’écran d’accueil ».</p>
            <button className="mt-2 font-semibold text-primary-700" onClick={() => setShowIosHelp(false)} type="button">Fermer</button>
          </div>
        </div>
      ) : (
        <button className="flex items-center gap-2 font-semibold" onClick={install} type="button">
          <span className="rounded-xl bg-primary-100 p-2 text-primary-700"><Download size={18} /></span>
          Installer l’application
        </button>
      )}
    </aside>
  );
}
