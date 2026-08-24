# Overseas Monitor

Overseas Monitor is the internal management application for Overseas Services. It centralises commercial documents, equipment records, monthly equipment time sheets, and staff access in one workspace.

## Modules

- **Dashboard** — current billing figures and shortcuts to authorised modules.
- **Factures** — invoice drafts, numbering, locking, payment status, printing and credit-note creation.
- **Devis** — quotation drafts, numbering, locking and printing.
- **Bons de commande** — purchase-order drafts, numbering, locking and printing.
- **Avoirs** — credit notes linked to locked invoices.
- **Pointage** — monthly equipment attendance, overtime, Excel export and invoice-draft hand-off.
- **Partenaires** — customer and supplier records, including contact details and logos.
- **Parc d’engins** — equipment records, units, rates, notes and photos.
- **Permissions** — administrator-managed module access for staff.

## Architecture

- **Next.js App Router** provides the application shell, routes and server actions.
- **Supabase** provides authentication, PostgreSQL, Row Level Security and private object storage for logos and equipment photos.
- **PostgreSQL migrations** in `supabase/migrations` define the schema, business constraints, document numbering, pointage persistence and access policies.
- **React client components** handle document editors, Pointage entry, exports and confirmation dialogs; server components load data and enforce route access.
- **Role and module permissions** control navigation, page access and mutations. Administrators manage all modules; staff receive only the modules assigned to them.
