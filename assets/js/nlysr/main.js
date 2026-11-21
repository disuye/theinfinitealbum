// NLYSR stats for the #stats-show panel.
// Nothing loads until the panel opens; each section then fetches its JSON
// only when scrolled near, so graph/sessions-sized files stay off the wire.
import { SECTIONS } from "./sections.js";
import { stampZoned, esc } from "./format.js";
import { p } from "./charts.js";

const DATA_BASE = location.hostname === "theinfinitealbum.com" ? "/NLYSR/" : "https://theinfinitealbum.com/NLYSR/";
const SCHEMA = 1;
const PANEL_HASH = "#stats-show";
const UNAVAILABLE = p("Stats temporarily unavailable.", "techinfo");
const ORDER = ["stream", "machine", "sessions", "tempo", "silence", "library", "random"];

const cache = new Map();

function load(name) {
	if (!cache.has(name)) {
		const req = fetch(`${DATA_BASE}${name}.json`, { cache: "no-cache" })
			.then((r) => { if (!r.ok) throw new Error(`${name}.json: HTTP ${r.status}`); return r.json(); })
			.then((j) => { if (j.schema !== SCHEMA) throw new Error(`${name}.json: schema ${j.schema}`); return j; });
		req.catch(() => cache.delete(name)); // allow a retry next time the panel opens
		cache.set(name, req);
	}
	return cache.get(name);
}

async function fill(section) {
	const { files, render } = SECTIONS[section.dataset.section];
	const body = section.querySelector(".nlysr-body");
	try {
		const data = await Promise.all(files.map(load));
		body.innerHTML = render(Object.fromEntries(files.map((f, i) => [f, data[i]])));
	} catch (err) {
		console.warn("NLYSR:", err);
		body.innerHTML = UNAVAILABLE;
	}
	section.classList.add("ready");
}

const skeleton = (key) => `<section class="nlysr-section" data-section="${key}">
	<h2>${esc(SECTIONS[key].title)}</h2>
	<div class="nlysr-body">${p("Loading…", "techinfo")}</div>
	<div class="spacer"></div>
</section>`;

async function init(root, panel) {
	let summary;
	try {
		summary = await load("summary");
	} catch (err) {
		console.warn("NLYSR:", err);
		root.innerHTML = UNAVAILABLE;
		return false;
	}

	root.innerHTML = p(esc(summary.scope_note))
		+ p(`Updated ${esc(stampZoned(summary.generated_at))}. ${esc(summary.time_note ?? "")}`, "techinfo")
		+ `<div class="spacer"></div>`
		+ ORDER.filter((k) => k in SECTIONS).map(skeleton).join("");

	const io = new IntersectionObserver((entries) => entries.forEach((e) => {
		if (!e.isIntersecting) return;
		io.unobserve(e.target);
		fill(e.target);
	}), { root: panel, rootMargin: "0px 0px 400px 0px" });
	root.querySelectorAll(".nlysr-section").forEach((s) => io.observe(s));
	return true;
}

let started = false;
async function onHash() {
	if (started || location.hash !== PANEL_HASH) return;
	const panel = document.querySelector(PANEL_HASH);
	const root = document.getElementById("nlysr");
	if (!panel || !root) return;
	started = true;
	started = await init(root, panel);
}

addEventListener("hashchange", onHash);
onHash();
