import { DocumentList, type DocumentListFilters } from "@/components/shared/document-list";

export default async function FacturesPage({ searchParams }: { searchParams: Promise<DocumentListFilters> }) {
  return <DocumentList filters={await searchParams} newLabel="+ Nouvelle facture" path="/factures" subtitle="Documents commerciaux" title="Factures" type="facture" />;
}
