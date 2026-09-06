import type { LineItem } from "@/lib/db/document-calculations";

function formatPeriodDate(value: string) {
  const [, month, day] = value.split("-");
  return day && month ? `${day}/${month}` : value;
}

export function LineItemDesignation({ line }: { line: LineItem }) {
  return (
    <>
      <p>{line.desc || "Sans désignation"}</p>
      {line.period_start && line.period_end ? (
        <p className="mt-1 text-[10px] font-semibold tracking-wide text-primary-600">
          PÉRIODE : DU {formatPeriodDate(line.period_start)} AU {formatPeriodDate(line.period_end)}
        </p>
      ) : null}
    </>
  );
}
