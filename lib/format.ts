const num0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const num2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("ar-u-ca-gregory-nu-latn", { year: "numeric", month: "short", day: "numeric" });
const dateTime = new Intl.DateTimeFormat("ar-u-ca-gregory-nu-latn", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export const fmtNumber = (n: number) => num0.format(n);
export const fmtDecimal = (n: number) => num2.format(n);
export const fmtCompact = (n: number) => compact.format(n);
export const fmtPct = (n: number | null) => (n === null || !Number.isFinite(n) ? "—" : `${num2.format(n)}%`);
export const fmtDate = (iso: string) => date.format(new Date(iso));
export const fmtDateTime = (iso: string) => dateTime.format(new Date(iso));
