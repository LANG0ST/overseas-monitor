import { DocumentList, type DocumentListFilters } from "@/components/shared/document-list";

export default async function AvoirsPage({ searchParams }: { searchParams: Promise<DocumentListFilters> }) {
  return <DocumentList filters={await searchParams} newLabel="+ Nouvel avoir" path="/avoirs" subtitle="Corrections de facturation" title="Avoirs" type="avoir" />;
}
