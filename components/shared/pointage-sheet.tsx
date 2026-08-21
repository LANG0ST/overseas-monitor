"use client";

import { Fragment } from "react";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import {
  daysInMonth,
  entryTotals,
  isSunday,
  type PointageEntryDraft,
} from "@/lib/pointage";

function formatAmount(value: number) {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 2,
  }).format(value);
}

type PointageSheetProps = {
  clientName: string;
  entries: PointageEntryDraft[];
  editable: boolean;
  overtimeDrafts: Record<string, string>;
  onOvertimeBlur: (entryIndex: number, day: number) => void;
  onOvertimeChange: (entryIndex: number, day: number, value: string) => void;
  onPresenceCycle: (entryIndex: number, day: number) => void;
  onPriceChange: (entryIndex: number, value: string) => void;
  onRemove: (entryIndex: number) => void;
  otReferenceHours: number;
  project: string;
  hasCachet: boolean;
  onCachetChange: (value: boolean) => void;
  ym: string;
};

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

function PointagePrintDocument({
  activeEntries,
  clientName,
  hasCachet,
  otReferenceHours,
  project,
  ym,
}: {
  activeEntries: PointageEntryDraft[];
  clientName: string;
  hasCachet: boolean;
  otReferenceHours: number;
  project: string;
  ym: string;
}) {
  const days = Array.from({ length: daysInMonth(ym) }, (_, index) => index + 1);
  const entryGroups = chunks(activeEntries, 6);
  const pages = entryGroups.length ? entryGroups : [[]];

  return (
    <section className="pointage-print-document hidden">
      {pages.map((pageEntries, pageIndex) => {
        const isLastPage = pageIndex === pages.length - 1;
        const entryStart = pageIndex * 6;
        return (
          <article className="pointage-print-page" key={pageIndex}>
            <header className="pointage-print-header">
              <div>
                <h2>POINTAGE DES ENGINS</h2>
                <p>Mois complet · Page {pageIndex + 1}/{pages.length}</p>
              </div>
              <dl>
                <div><dt>Client</dt><dd>{clientName || "—"}</dd></div>
                <div><dt>Chantier</dt><dd>{project || "—"}</dd></div>
                <div><dt>Mois</dt><dd>{ym}</dd></div>
              </dl>
            </header>

            <table className="pointage-print-grid">
              <thead>
                <tr>
                  <th className="pointage-print-number">N°</th>
                  <th className="pointage-print-name">Engin</th>
                  {days.map((day) => <th className={isSunday(ym, day) ? "pointage-print-sunday-head" : ""} key={day}>{day}</th>)}
                  <th className="pointage-print-total">Total mois</th>
                  <th className="pointage-print-money">P.U. / Total HT</th>
                </tr>
              </thead>
              <tbody>
                {pageEntries.map((entry, entryIndex) => {
                  const totals = entryTotals(entry, otReferenceHours);
                  return (
                    <Fragment key={`${entry.id ?? entry.engin_id ?? entry.engin_name}-${entryIndex}`}>
                      <tr>
                        <td rowSpan={2}>{entryStart + entryIndex + 1}</td>
                        <td className="pointage-print-entry-name" rowSpan={2}>{entry.engin_name}</td>
                        {days.map((day) => <td className={isSunday(ym, day) ? "pointage-print-sunday" : ""} key={day}>{entry.days[String(day)] ?? ""}</td>)}
                        <td>{totals.days} j</td>
                        <td rowSpan={2}><strong>{formatAmount(entry.unit_price)}</strong><br /><span>{formatAmount(totals.totalHt)}</span></td>
                      </tr>
                      <tr className="pointage-print-overtime">
                        {days.map((day) => <td className={isSunday(ym, day) ? "pointage-print-sunday" : ""} key={day}>{entry.overtime_hours[String(day)] ?? ""}</td>)}
                        <td>{totals.overtimeHours} h</td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            <p className="pointage-print-legend">Présence : 1 = journée complète, 0,5 = demi-journée, 0 = présent sans activité. Heures supplémentaires par tranches de 0,5 h.</p>
            {isLastPage ? (
              <footer className="pointage-print-signatures">
                <p>Signature du client</p>
                <div><p>OVERSEAS SERVICES</p>{hasCachet ? <Image alt="Cachet Overseas Services" height={200} src="/cachet.png" width={200} /> : null}</div>
              </footer>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

export function PointageSheet({
  clientName,
  entries,
  editable,
  overtimeDrafts,
  onOvertimeBlur,
  onOvertimeChange,
  onPresenceCycle,
  onPriceChange,
  onRemove,
  otReferenceHours,
  project,
  hasCachet,
  onCachetChange,
  ym,
}: PointageSheetProps) {
  const dayCount = daysInMonth(ym);
  const activeEntries = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.is_active);

  return (
    <>
    <article className="pointage-sheet pointage-screen-sheet min-w-0 max-w-full bg-white text-primary-900" data-pointage-sheet>
      <header className="border-b border-primary-200 px-5 py-5 sm:px-7">
        <h2 className="text-center text-lg font-bold tracking-wide text-primary-900">
          Pointage des engins
        </h2>
        <div className="mt-4 grid gap-1 text-sm text-right">
            <p>
              <span className="font-medium text-neutral-600">Client :</span>{" "}
              <span className="font-bold">{clientName || "—"}</span>
            </p>
            <p>
              <span className="font-medium text-neutral-600">Mois :</span>{" "}
              <span className="font-bold">{ym}</span>
            </p>
        </div>
      </header>

      <div className="pointage-grid-wrap max-w-full overflow-x-auto">
        <table className="pointage-grid w-max border-collapse text-center text-xs">
          <thead className="bg-primary-900 text-white">
            <tr>
              <th className="pointage-sticky-left z-20 w-10 border border-primary-700 bg-primary-900 px-2 py-3">N°</th>
              <th className="pointage-sticky-name z-20 w-44 border border-primary-700 bg-primary-900 px-3 py-3 text-left">Désignation<br />Nom de l&apos;engin</th>
              <th className="w-20 border border-primary-700 px-2 py-3">Type</th>
              {Array.from({ length: dayCount }, (_, index) => {
                const day = index + 1;
                return (
                  <th
                    className={`w-11 border border-primary-700 px-1 py-3 ${isSunday(ym, day) ? "bg-[#7A2F2F]" : ""}`}
                    key={day}
                  >
                    {day}
                  </th>
                );
              })}
              <th className="min-w-16 border border-primary-700 px-2 py-3">Total</th>
              <th className="min-w-40 border border-primary-700 px-3 py-3">P.U. / Total HT</th>
              <th className="pointage-action-cell border border-primary-700 px-2 py-3 print:hidden" />
            </tr>
          </thead>
          <tbody>
            {activeEntries.map(({ entry, index }, rowIndex) => {
              const totals = entryTotals(entry, otReferenceHours);
              return (
                <Fragment key={`${entry.id ?? entry.engin_id ?? entry.engin_name}-${index}`}>
                  <tr className="border-b border-primary-100" key={`${entry.id ?? entry.engin_id ?? entry.engin_name}-presence`}>
                    <td className="pointage-sticky-left z-10 border border-primary-100 bg-white px-2 py-2" rowSpan={2}>{rowIndex + 1}</td>
                    <td className="pointage-sticky-name z-10 border border-primary-100 bg-white px-3 py-2 text-left font-semibold" rowSpan={2}>{entry.engin_name}</td>
                    <td className="border border-primary-100 px-2 py-2 text-neutral-600" rowSpan={2}>P.U. jour</td>
                    {Array.from({ length: dayCount }, (_, dayIndex) => {
                      const day = dayIndex + 1;
                      const value = entry.days[String(day)];
                      return (
                        <td className={`border border-primary-100 p-0 ${isSunday(ym, day) ? "bg-[#FBF1F1]" : ""}`} key={day}>
                          <button
                            aria-label={`${entry.engin_name}, présence du ${day}`}
                            className="min-h-11 w-full px-1 font-semibold text-primary-900 hover:bg-primary-50 disabled:cursor-default disabled:hover:bg-transparent"
                            disabled={!editable}
                            onClick={() => onPresenceCycle(index, day)}
                            type="button"
                          >
                            {value ?? ""}
                          </button>
                        </td>
                      );
                    })}
                    <td className="border border-primary-100 px-2 py-2 font-bold text-primary-900">{totals.days}</td>
                    <td className="border border-primary-100 px-2 py-2" rowSpan={2}>
                      <label className="sr-only" htmlFor={`pointage-price-${index}`}>P.U. journalier de {entry.engin_name}</label>
                      <input
                        className="w-28 rounded-md border border-primary-200 px-2 py-1.5 text-right font-semibold text-primary-900 disabled:border-transparent disabled:bg-transparent"
                        disabled={!editable}
                        id={`pointage-price-${index}`}
                        min="0"
                        onChange={(event) => onPriceChange(index, event.target.value)}
                        step="0.01"
                        type="number"
                        value={Number.isFinite(entry.unit_price) ? entry.unit_price : ""}
                      />
                      <p className="mt-1 text-[11px] text-neutral-500">/ jour</p>
                      <p className="mt-2 border-t border-primary-100 pt-2 text-sm font-bold text-primary-900">{formatAmount(totals.totalHt)}</p>
                    </td>
                    <td className="pointage-action-cell border border-primary-100 p-1 print:hidden" rowSpan={2}>
                      {editable ? (
                        <button
                          aria-label={`Supprimer ${entry.engin_name}`}
                          className="rounded-md p-2 text-danger-500 hover:bg-red-50"
                          onClick={() => onRemove(index)}
                          type="button"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  <tr className="bg-[#FFFDF5] text-[#8A5A00]" key={`${entry.id ?? entry.engin_id ?? entry.engin_name}-overtime`}>
                    {Array.from({ length: dayCount }, (_, dayIndex) => {
                      const day = dayIndex + 1;
                      const value = entry.overtime_hours[String(day)];
                      return (
                        <td className={`border border-primary-100 p-0 ${isSunday(ym, day) ? "bg-[#FBF1F1]" : ""}`} key={day}>
                          <label className="sr-only" htmlFor={`pointage-overtime-${index}-${day}`}>Heures supplémentaires de {entry.engin_name} le {day}</label>
                          <input
                            className="pointage-overtime-input min-h-11 w-full bg-transparent px-1 text-center text-xs outline-none disabled:cursor-default"
                            disabled={!editable}
                            id={`pointage-overtime-${index}-${day}`}
                            onBlur={() => onOvertimeBlur(index, day)}
                            onChange={(event) => onOvertimeChange(index, day, event.target.value)}
                            inputMode="decimal"
                            type="text"
                            value={overtimeDrafts[`${index}-${day}`] ?? value ?? ""}
                          />
                        </td>
                      );
                    })}
                    <td className="border border-primary-100 px-2 py-2 font-bold">{totals.overtimeHours}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {activeEntries.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-neutral-500">
            Aucun engin — utilisez « Ajouter un engin » pour commencer.
          </p>
        ) : null}
      </div>

      <footer className="space-y-5 border-t border-primary-200 px-5 py-5 text-xs leading-relaxed text-neutral-700 sm:px-7">
        <p>
          Présence : 1 = journée complète, 0,5 = demi-journée, 0 = présent sans activité. La ligne « heures supp. » compte les heures du jour ; elles sont facturées au P.U. journalier divisé par la journée de référence (9 h par défaut, réglable sur le portail).
        </p>
        <div className="grid grid-cols-2 gap-8 pt-6 text-center text-sm font-medium text-primary-900">
          <p className="border-t border-primary-300 pt-3">Signature du client</p>
          <div className="border-t border-primary-300 pt-3">
            <p>OVERSEAS SERVICES</p>
            {hasCachet ? <Image alt="Cachet Overseas Services" className="mx-auto mt-2 h-auto w-20 object-contain" height={200} src="/cachet.png" width={200} /> : null}
            {editable ? <label className="mt-2 inline-flex items-center gap-2 text-xs font-normal text-neutral-600 print:hidden"><input checked={hasCachet} onChange={(event) => onCachetChange(event.target.checked)} type="checkbox" />Inclure le cachet</label> : null}
          </div>
        </div>
      </footer>
    </article>
    <PointagePrintDocument
      activeEntries={activeEntries.map(({ entry }) => entry)}
      clientName={clientName}
      hasCachet={hasCachet}
      otReferenceHours={otReferenceHours}
      project={project}
      ym={ym}
    />
    </>
  );
}
