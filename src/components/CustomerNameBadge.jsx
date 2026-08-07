import { formatCustomerName } from "../utils/textFormatters";

export default function CustomerNameBadge({
  name,
  prefix = "Customer",
  className = "",
  truncate = true,
}) {
  const formattedName = formatCustomerName(name);

  if (!formattedName) {
    return null;
  }

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black uppercase tracking-[0.08em] text-blue-700 ring-1 ring-blue-100 ${className}`}
    >
      <span className={truncate ? "truncate" : "whitespace-normal break-words"}>
        {prefix ? `${prefix}: ` : ""}
        {formattedName}
      </span>
    </span>
  );
}
