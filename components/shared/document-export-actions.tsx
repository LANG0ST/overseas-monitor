import { Download, Printer } from "lucide-react";

const actionClassName =
  "rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-ink-900 shadow-sm";

export function DocumentExportActions({
  kind,
  documentId,
  onBrowserPrint,
  pdfDisabled = false,
}: {
  kind: "facture" | "devis" | "avoir" | "bon-commande";
  documentId: string;
  onBrowserPrint: () => void;
  pdfDisabled?: boolean;
}) {
  return (
    <>
      {pdfDisabled ? (
        <button
          className={`${actionClassName} cursor-not-allowed opacity-50`}
          disabled
          title="Enregistrez les modifications avant de télécharger le PDF"
          type="button"
        >
          <Download className="mr-2 inline" size={16} />
          Télécharger en PDF
        </button>
      ) : (
        <a
          className={actionClassName}
          href={`/api/documents/${kind}/${documentId}/pdf`}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Download className="mr-2 inline" size={16} />
          Télécharger en PDF
        </a>
      )}
      <button
        className={actionClassName}
        onClick={onBrowserPrint}
        type="button"
      >
        <Printer className="mr-2 inline" size={16} />
        Imprimer
      </button>
    </>
  );
}
