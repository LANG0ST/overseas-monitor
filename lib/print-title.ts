export function safePrintName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function printWithTitle(title: string, temporaryStyle?: string) {
  const previousTitle = window.document.title;
  const style = temporaryStyle ? document.createElement("style") : null;
  window.document.title = safePrintName(title) || "Overseas-Services";
  if (style && temporaryStyle) {
    style.textContent = temporaryStyle;
    document.head.append(style);
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    style?.remove();
    window.document.title = previousTitle;
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);
  window.print();
}
