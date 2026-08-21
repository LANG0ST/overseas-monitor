import {
  DocumentList,
  type DocumentListFilters,
} from "@/components/shared/document-list";

export default async function DevisPage({
  searchParams,
}: {
  searchParams: Promise<DocumentListFilters>;
}) {
  return (
    <DocumentList
      filters={await searchParams}
      newLabel="+ Nouveau devis"
      path="/devis"
      subtitle="Propositions commerciales"
      title="Devis"
      type="devis"
    />
  );
}
