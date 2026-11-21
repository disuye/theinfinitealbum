// Inline-SVG and HTML chart primitives. Colours live in nlysr.css as classes.
// Text stays in HTML (not SVG) so it never scales with the chart.
import { esc } from "./format.js";

const W = 300;
const f = (n) => +n.toFixed(2);

function svg(h, body, label, { stretch = false, cls = "" } = {}) {
	const par = stretch ? ' preserveAspectRatio="none"' : "";
	return `<svg class="nlysr-svg ${cls}" viewBox="0 0 ${W} ${h}"${par} role="img" aria-label="${esc(label)}">${body}</svg>`;
}

/** Bars for values (null = gap), optional expected step line on the same scale. */
export function histogram(values, { label, h = 60, expected = null, cls = "bar" }) {
	const max = Math.max(...values.filter((v) => v != null), ...(expected ?? [])) || 1;
	const bw = W / values.length;
	const gap = bw > 3 ? bw * 0.15 : 0;
	const y = (v) => h - (v / max) * h;

	let body = values.map((v, i) => v == null || v === 0 ? "" :
		`<rect class="${cls}" x="${f(i * bw)}" y="${f(y(v))}" width="${f(Math.max(bw - gap, 0.4))}" height="${f(h - y(v))}"/>`
	).join("");

	if (expected) {
		const d = expected.reduce((acc, v, i) => `${acc}${i ? "V" : "M0 "}${f(y(v))}H${f((i + 1) * bw)}`, "");
		body += `<path class="expected" d="${d}"/>`;
	}
	return svg(h, body, label);
}

/** One or more 0–max lines over evenly spaced points; null breaks the line. */
export function lines(series, { label, h = 80, max = 100 }) {
	const n = Math.max(...series.map((s) => s.values.length));
	const x = (i) => f((i / Math.max(n - 1, 1)) * W);
	const y = (v) => f(h - (v / max) * h);
	const body = series.map(({ values, cls }) => {
		let d = "", pen = false;
		values.forEach((v, i) => {
			if (v == null) { pen = false; return; }
			d += `${pen ? "L" : "M"}${x(i)} ${y(v)}`;
			pen = true;
		});
		return `<path class="line ${cls}" d="${d}"/>`;
	}).join("");
	return svg(h, `<line class="grid" x1="0" x2="${W}" y1="0.5" y2="0.5"/>` + body, label);
}

/**
 * Columns × rows of 0–1 cells; null column = gap. Stretches to CSS height.
 * Mostly-full data, so each column is one "on" bar with "off" cells punched over it.
 */
export function heatmap(columns, { label, rows = 24 }) {
	const cw = W / columns.length;
	const body = columns.map((col, i) => {
		if (col == null) return "";
		const x = `x="${f(i * cw)}" width="${f(cw + 0.05)}"`;
		return `<rect class="on" ${x} y="0" height="${rows}"/>` + col.map((v, r) => v < 1
			? `<rect class="off" ${x} y="${r}" height="1" fill-opacity="${f(1 - v)}"/>` : ""
		).join("");
	}).join("");
	return `<svg class="nlysr-svg heatmap" shape-rendering="crispEdges" viewBox="0 0 ${W} ${rows}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}">${body}</svg>`;
}

/** A single 0..span strip of [from, to, cls] segments (e.g. one month of sessions). */
export function strip(segments, { label, span }) {
	const sx = W / span;
	const body = segments.map(([a, b, cls]) =>
		`<rect class="${cls}" x="${f(a * sx)}" y="0" width="${f(Math.max((b - a) * sx, 0.6))}" height="10"/>`
	).join("");
	return svg(10, body, label, { stretch: true, cls: "strip" });
}

/** Wrap a chart with an axis line of HTML labels and an optional caption. */
export const figure = (chart, axis = [], caption = "") => `<figure class="nlysr-fig">${chart}${
	axis.length ? `<div class="nlysr-axis">${axis.map((a) => `<i>${esc(a)}</i>`).join("")}</div>` : ""}${
	caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;

/** HTML horizontal bars: rows of { label, value, bars: [{ pct, cls }] }. */
export const hbars = (rows) => `<div class="nlysr-hbars">${rows.map((r) =>
	`<div class="hbar"><div class="hbar-label">${esc(r.label)}<b>${esc(r.value)}</b></div>${
		r.bars.map((b) => `<div class="hbar-track"><div class="hbar-fill ${b.cls ?? ""}" style="width:${f(b.pct)}%"></div></div>`).join("")
	}</div>`).join("")}</div>`;

/** Headline strip: [[value, label], …] */
export const stats = (items) => `<div class="nlysr-stats">${items.map(([v, l]) =>
	`<div class="stat"><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join("")}</div>`;

/** Collapsible table fallback for a chart. Cells are escaped; numeric columns right-align. */
const NUMERIC = /^[-+×—]?[\d.,]*\d[\d.,]*[%×s]?$|^—$/;
export function table(head, rows, summary = "Data", open = false) {
	const numCol = head.map((_, i) => rows.length > 0 && rows.every((r) => NUMERIC.test(String(r[i]))));
	const cell = (tag, c, i) => `<${tag}${numCol[i] ? ' class="num"' : ""}>${esc(c)}</${tag}>`;
	return `<details class="nlysr-data"${open ? " open" : ""}><summary>${esc(summary)}</summary><table>
<thead><tr>${head.map((h, i) => cell("th", h, i)).join("")}</tr></thead>
<tbody>${rows.map((r) => `<tr>${r.map((c, i) => cell("td", c, i)).join("")}</tr>`).join("")}</tbody></table></details>`;
}

/** Collapsible glossary footnote: [[term, html], …]. Caller escapes any data strings. */
export const notes = (items, summary = "Notes") => `<details class="nlysr-data"><summary>${esc(summary)}</summary><dl>${
	items.map(([term, html]) => `<dt>${esc(term)}</dt><dd>${html}</dd>`).join("")}</dl></details>`;

/** A site paragraph (.show-text span). Caller escapes any data strings. */
export const p = (html, cls = "") => `<span${cls ? ` class="${cls}"` : ""}>${html}</span>`;
