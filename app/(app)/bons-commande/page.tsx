import { DocumentList, type DocumentListFilters } from "@/components/shared/document-list";

export default async function BonsCommandePage({ searchParams }: { searchParams: Promise<DocumentListFilters> }) {
  return <DocumentList filters={await searchParams} newLabel="+ Nouveau bon de commande" path="/bons-commande" subtitle="Commandes clients" title="Bons de commande" type="bon_commande" />;
}
