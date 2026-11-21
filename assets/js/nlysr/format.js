const LOCALE = "en-GB";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const DAY_MS = 864e5;

export const num = (v, digits = 0) =>
	v == null || Number.isNaN(v) ? "—"
	: Number(v).toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const pct = (v, digits = 1) => `${num(v, digits)}%`;

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
	({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** "Pack/Folder/Kick 01.wav" -> "Kick 01" */
export const stem = (path) => path.split("/").pop().replace(/\.[^.]+$/, "");

/**
 * NLYSR times are the streaming Mac's local time with no zone.
 * Treat them as UTC so the browser's own zone/DST never shifts them.
 */
export function localMs(s) {
	const [d, t = "00:00:00"] = s.split("T");
	const [Y, M, D] = d.split("-").map(Number);
	const [h, m, sec] = t.split(":").map(Number);
	return Date.UTC(Y, M - 1, D, h, m, Math.floor(sec || 0));
}

export const dateKey = (ms) => new Date(ms).toISOString().slice(0, 10);
export const monthName = (m) => MONTHS[m];

export function dayLabel(s) {
	const [Y, M, D] = s.slice(0, 10).split("-").map(Number);
	return `${D} ${MONTHS[M - 1]} ${Y}`;
}

/** Local timestamp shown as-is: "2026-03-03 22:00" */
export const stamp = (s) => s.slice(0, 16).replace("T", " ");

/** generated_at keeps its offset: "2026-11-21 18:09 UTC+00:00" */
export const stampZoned = (s) => `${stamp(s)} UTC${s.slice(19) || ""}`;

/** Every date from first to last, mapped to its row or null, so gaps stay gaps. */
export function fillDays(days) {
	const byDate = new Map(days.map((d) => [d.date, d]));
	const out = [];
	const end = localMs(days[days.length - 1].date);
	for (let t = localMs(days[0].date); t <= end; t += DAY_MS) {
		const key = dateKey(t);
		out.push({ date: key, row: byDate.get(key) ?? null });
	}
	return out;
}
