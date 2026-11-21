// One renderer per stats section, in page order (emotional → technical).
// Each declares the JSON files it needs; main.js fetches them lazily.
// Numbers come from the data; only the explanatory sentences are written here.
import { num, pct, esc, stem, dayLabel, stamp, localMs, fillDays, monthName, DAY_MS } from "./format.js";
import { histogram, lines, heatmap, strip, figure, hbars, stats, table, notes, p } from "./charts.js";

const QUANTILES = ["p0", "p5", "p25", "p50", "p75", "p95", "p100"];
const DRAW_LABELS = {
	samples_per_track: "Samples per track",
	bpm: "Generated BPM",
	seed: "Seed",
	loops1: "Loops 1",
	loops2: "Loops 2",
	chop1_steps: "Chop 1 steps",
	chop2_steps: "Chop 2 steps",
	srate: "Sample rate",
	tempo: "Tempo",
	pan_left: "Pan",
};
// SMPLR's log has no broadcast IDs before this date, so 0 means "unknown" there.
const BROADCAST_IDS_FROM = "2026-03-14";

const sum = (a) => a.reduce((x, y) => x + y, 0);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const signed = (v, d = 1) => `${v > 0 ? "+" : ""}${num(v, d)}`;
const plain = (v) => Number.isInteger(v) ? num(v) : String(v);
const palClass = (name) => `pal pal-${String(name).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
/** Drop empty [lo, hi, n] bins from both ends so a histogram spans only its data. */
const trimEmpty = (hist) => {
	const first = hist.findIndex((b) => b[2] > 0);
	const last = hist.findLastIndex((b) => b[2] > 0);
	return first < 0 ? hist : hist.slice(first, last + 1);
};
const quantRow =(label, q, d = 0) => [label, ...QUANTILES.map((k) => num(q[k], d))];

export const SECTIONS = {
	stream: {
		title: "The stream so far",
		files: ["summary"],
		render({ summary: s }) {
			const { work: w, library: lib } = s;
			const heard = Math.round(lib.unique_sounds * lib.coverage_played_pct / 100);
			return stats([
				[num(w.on_air_hours), "hours on air"],
				[num(w.tracks_streamed), "tracks streamed"],
				[num(heard), "unique sounds heard"],
				[pct(w.uptime_pct), "uptime"],
			])
			+ p(`Since ${dayLabel(s.period.from)}: ${num(w.on_air_hours / 24)} days of continuous music, a new track roughly every ${num(w.on_air_hours * 60 / w.tracks_streamed, 1)} minutes.`)
			+ p(`The longest unbroken run lasted ${num(w.longest_run_hours / 24, 1)} days. ${num(w.sessions_crashed)} of ${num(w.sessions)} sessions ended in a power cut; the rest restarted on schedule, about every 12 hours.`)
			+ p(`${num(w.tracks_generated - w.tracks_streamed)} tracks were composed but never aired: the pre-buffer is discarded at every restart.`, "techinfo");
		},
	},

	tempo: {
		title: "Generated vs broadcast",
		files: ["distributions"],
		render({ distributions: d }) {
			const o = d.on_air;
			const onAir = o.bpm_on_air.histogram;
			const generated = d.draws.bpm;
			const genAxis = [num(generated.range[0]), "BPM", num(generated.range[1])];
			const bpmAxis = [num(onAir[0][0]), "BPM", num(onAir.at(-1)[1])];

			const pr = o.pitch_semitones_recipe, pa = o.pitch_semitones_on_air;
			const genPitch = trimEmpty(pr.histogram), airPitch = trimEmpty(pa.histogram);
			const pitchAxis = (h) => [signed(h[0][0], 0), "semitones", signed(h.at(-1)[1], 0)];
			const aboveOriginal = sum(pa.histogram.filter(([lo]) => lo >= 0).map((b) => b[2])) / pa.n * 100;
			const semis = 12 * Math.log2(o.speed_factor.p50);

			return stats([
				[num(o.bpm_recipe.p50), "median generated BPM"],
				[num(o.bpm_on_air.p50), "median broadcast BPM"],
				[`×${num(o.speed_factor.p50, 2)}`, "median speed-up"],
				[signed(semis), "semitones"],
			])
			+ p(`SMPLR composes each track at a tempo drawn evenly between ${num(o.bpm_recipe.p0)} and ${num(o.bpm_recipe.p100)} BPM. On air, the whole track plays 48000 ÷ R faster and higher, where R is the sample rate of its first sample, so broadcast tempo stretches out to ${num(o.bpm_on_air.p100)} BPM.`)
			+ figure(histogram(generated.bins.map((b) => b[2]), { label: `Generated BPM, flat from ${o.bpm_recipe.p0} to ${o.bpm_recipe.p100}`, cls: "bar dim", h: 40 }), genAxis, "Generated BPM")
			+ figure(histogram(onAir.map((b) => b[2]), { label: `Broadcast BPM, median ${o.bpm_on_air.p50}, tail to ${o.bpm_on_air.p100}`, h: 40 }), bpmAxis, "Broadcast BPM")
			+ notes([
				["Generated BPM", `The tempo SMPLR picks for each track (${num(o.bpm_recipe.p0)}–${num(o.bpm_recipe.p100)}) sets the length of the smallest rhythmic step: in musical terms, the speed of one 64th note. SMPLR's recipe files call this 64th step a '16th note', a naming quirk inherited from the original shell scripts to mean 1/16th of a beat.`],
				["Broadcast BPM", `Generated BPM × the playback speed-up resampling (${num(o.speed_factor.p0)}–${num(o.speed_factor.p100)}×) before streaming. A measure of how fast the audio runs, not a tempo you can tap along to.`],
			], "What BPM means here")
			+ p(`In the recipe every sample is pitched down (median ${signed(pr.p50)} semitones). After the speed-up, ${pct(aboveOriginal, 0)} of them sound above their original pitch.`)
			+ figure(histogram(genPitch.map((b) => b[2]), { label: `Recipe pitch, median ${pr.p50} semitones`, cls: "bar dim", h: 40 }), pitchAxis(genPitch), "Generated pitch")
			+ figure(histogram(airPitch.map((b) => b[2]), { label: `Broadcast pitch, median ${pa.p50} semitones`, h: 40 }), pitchAxis(airPitch), "Broadcast pitch")
			+ table(["", ...QUANTILES], [
				quantRow("Generated BPM", o.bpm_recipe),
				quantRow("Broadcast BPM", o.bpm_on_air),
				quantRow("Speed-up ×", o.speed_factor, 2),
				quantRow("Generated pitch", pr, 1),
				quantRow("Broadcast pitch", pa, 1),
			], "Quantiles");
		},
	},

	random: {
		title: "Is it really random?",
		files: ["distributions", "samples"],
		render({ distributions: d, samples: s }) {
			const draws = Object.entries(d.draws);
			const ps = draws.map(([, v]) => v.p);
			const by = s.duplication.by_copies;
			const maxPerSound = Math.max(...Object.values(by).map((c) => c.picks_per_sound));
			const ratios = Object.values(by).map((c) => num(c.ratio_to_single, c.ratio_to_single === 1 ? 0 : 3)).join(" : ");
			const sel = s.selection_by_path;
			const maxR = Math.max(...Object.values(d.bpm_dependence).map(Math.abs));
			const label = (k) => DRAW_LABELS[k] ?? k;

			const grid = draws.map(([k, v]) => figure(
				histogram(v.bins.map((b) => b[2]), { label: `${label(k)}: observed against expected, p = ${num(v.p, 2)}`, h: 36, cls: "bar dim", expected: v.bins.map((b) => b[3]) }),
				[plain(v.range[0]), plain(v.range[1])],
				`${esc(label(k))} <i class="techinfo">p = ${num(v.p, 2)}</i>`,
			)).join("");

			return stats([
				[`${num(Math.min(...ps), 2)}–${num(Math.max(...ps), 2)}`, "p-value range"],
				[ratios, "picks per sound, stored 1× : 2× : 3×"],
				[num(sel.min), "fewest picks for any file"],
			])
			+ p(`${draws.length} random draws shape every track. Each chart sets the observed counts (bars) against a perfectly even spread (line). A p-value above 0.05 means the draw is indistinguishable from fair dice.`)
			+ `<div class="nlysr-grid">${grid}</div>`
			+ p(`No draw depends on the tempo: the strongest correlation with BPM is r = ${num(maxR, 4)}.`, "techinfo")
			+ table(["Draw", "n", "Range", "χ²", "dof", "p"],
				draws.map(([k, v]) => [label(k), num(v.n), `${plain(v.range[0])}–${plain(v.range[1])}`, num(v.chi2, 2), v.dof, num(v.p, 4)]), "Test results")
			+ p(`Some sounds live in the library twice, a few three times. Selection is fair per file, so a sound stored twice is picked twice as often, and the statistics show it: ${ratios}. The duplicates are deliberate curation: the Blu Mar Ten jungle collection was re-added to push the sound towards 1990s breakbeat.`)
			+ hbars(Object.entries(by).map(([copies, c]) => ({
				label: `Stored ${copies}× · ${num(c.sounds)} sounds · ${num(c.picks_per_sound, 1)} picks each`,
				value: `×${num(c.ratio_to_single, 3)}`,
				bars: [{ pct: c.picks_per_sound / maxPerSound * 100 }],
			})))
			+ p(`Every one of ${num(sel.files)} files has been picked at least ${num(sel.min)} times (most ${num(sel.max)}, expected ${num(sel.expected_per_file, 1)}; p = ${num(sel.p, 2)}).`);
		},
	},

	silence: {
		title: "The silence",
		files: ["summary", "samples"],
		render({ summary, samples: s }) {
			const c = summary.creation;
			const folders = [...s.folders].sort((a, b) => b.silent_pct - a.silent_pct);
			const max = folders[0]?.silent_pct || 1;
			const quiet = s.never_played.map(stem);

			return stats([
				[pct(c.silent_pct, 2), "of chosen samples never heard"],
				[num(c.played_samples_per_track_p50), "samples heard in a median track"],
			])
			+ p(`Each slot plays a random chop window of its sample. When that window starts after the sample has already ended, the slot is silent: chosen, mixed, and never heard.`)
			+ (quiet.length
				? p(`${quiet.length} sounds have been picked, sometimes many times, and have never once made a noise:`)
					+ `<div class="nlysr-poem">${quiet.map(esc).join("<br>")}</div>`
				: p(`Every chosen sound has been heard at least once.`))
			+ p(`Short drum one-shots go silent most often: they leave the most room for the window to miss.`)
			+ hbars(folders.slice(0, 8).map((f) => ({
				label: f.folder,
				value: pct(f.silent_pct),
				bars: [{ pct: f.silent_pct / max * 100 }],
			})))
			+ table(["Folder", "Silent"], folders.map((f) => [f.folder, pct(f.silent_pct, 2)]), "All folders");
		},
	},

	library: {
		title: "The library",
		files: ["samples", "daily"],
		render({ samples: s, daily }) {
			const lib = s.library;
			const days = fillDays(daily.days);
			const first = days[0].date, last = days.at(-1).date;
			const full = daily.days.find((d) => d.coverage_chosen_pct >= 100);
			const folders = s.folders.filter((f) => f.unique_sounds > 0)
				.sort((a, b) => b.sound_picks_pct - a.sound_picks_pct);
			const max = Math.max(...folders.flatMap((f) => [f.sounds_pct, f.sound_picks_pct]));

			return stats([
				[num(lib.files), "files"],
				[num(lib.unique_sounds), "unique sounds"],
				[num(lib.duplicate_groups), "duplicate groups"],
				[pct(lib.coverage_played_pct, 2), "heard at least once"],
			])
			+ p(full
				? `Every sound in the library had been chosen at least once by ${dayLabel(full.date)}.`
				: `${pct(daily.days.at(-1).coverage_chosen_pct)} of sounds have been chosen so far.`)
			+ figure(lines([
				{ values: days.map((d) => d.row?.coverage_chosen_pct ?? null), cls: "dim" },
				{ values: days.map((d) => d.row?.coverage_played_pct ?? null), cls: "" },
			], { label: `Cumulative library coverage, ${first} to ${last}`, h: 40 }),
			[dayLabel(first), dayLabel(last)], "Share of sounds chosen (grey) and heard (white), 0–100%")
			+ p(`Grey: each folder's share of the unique sounds. White: its share of what listeners hear. Where white outruns grey, the folder's sounds are stored twice.`)
			+ hbars(folders.map((f) => ({
				label: f.folder,
				value: `${pct(f.sounds_pct)} → ${pct(f.sound_picks_pct)}`,
				bars: [{ pct: f.sounds_pct / max * 100, cls: "dim" }, { pct: f.sound_picks_pct / max * 100 }],
			})))
			+ `<h3>Most picked</h3>`
			+ table(["#", "Sound", "Copies", "Picks", "Heard"],
				s.top_chosen.slice(0, 10).map((t, i) => [i + 1, stem(t.home), `${t.copies}×`, num(t.picks), num(t.played)]),
				"Top 10 sounds", true);
		},
	},

	machine: {
		title: "The machine at work",
		files: ["daily", "summary", "distributions"],
		render({ daily, summary, distributions: d }) {
			const w = summary.work, yt = w.youtube, r = d.work;
			const days = fillDays(daily.days);
			const first = days[0].date, last = days.at(-1).date;
			const ratio = r.track_on_air_s.p50 / r.render_s.p50;
			const months = Object.entries(Object.groupBy(daily.days, (x) => x.date.slice(0, 7)));
			const palettes = Object.entries(w.palettes).sort((a, b) => b[1] - a[1]);

			return stats([
				[pct(w.uptime_pct), "uptime"],
				[`${num(r.render_s.p50, 1)} s`, "median render"],
				[`${num(ratio)}×`, "faster than real time"],
				[num(w.rtmp_restarts), "RTMP restarts"],
			])
			+ figure(heatmap(days.map((x) => x.row ? x.row.uptime_min_by_hour.map((m) => m / 60) : null),
				{ label: `Uptime per clock hour, ${first} to ${last}` }),
			[dayLabel(first), dayLabel(last)], "One column per day, midnight at the top. Restarts, crashes and the June gap show as dark marks.")
			+ table(["Month", "Days logged", "Hours up", "Tracks streamed", "Sessions"], months.map(([m, rows]) =>
				[m, rows.length, num(sum(rows.map((x) => x.uptime_min)) / 60), num(sum(rows.map((x) => x.tracks_streamed))), sum(rows.map((x) => x.sessions_started))]),
			"Monthly totals")
			+ p(`A ${num(r.track_on_air_s.p50 / 60, 1)}-minute track renders in about ${num(r.render_s.p50, 1)} seconds, roughly ${num(ratio)}× faster than it plays, so the next track is always ready long before it's needed.`)
			+ stats([
				[num(w.broadcasts), "YouTube broadcasts"],
				[num(yt.lost), "dropped by YouTube"],
				[num(yt.recovered), "recovered automatically"],
				[num(yt.token_refreshed), "auth token refreshes"],
			])
			+ p(`YouTube regularly drops a live broadcast. SMPLR notices, creates a replacement and carries on: ${pct(yt.recovered / yt.lost * 100, 0)} of drops were recovered this way. Broadcasts over 12 hours aren't archived; ${num(w.broadcasts_archived)} of ${num(w.broadcasts)} were.`)
			+ p(`Each session paints its spectrum with one of ${palettes.length} palettes:`)
			+ `<div class="nlysr-swatches">${palettes.map(([name, n]) =>
				`<div class="swatch ${palClass(name)}"><i></i><small>${esc(name)} · ${num(n)}</small></div>`).join("")}</div>`;
		},
	},

	sessions: {
		title: "Sessions",
		files: ["sessions"],
		render({ sessions: { sessions: ss } }) {
			const live = ss.find((x) => x.status === "live");
			const crashed = ss.filter((x) => x.status === "crashed").length;
			const t0 = localMs(ss[0].start), t1 = localMs(ss.at(-1).end);
			const rows = [];

			for (let m = new Date(t0); m.getTime() <= t1; m.setUTCMonth(m.getUTCMonth() + 1, 1)) {
				const Y = m.getUTCFullYear(), M = m.getUTCMonth();
				const from = Date.UTC(Y, M, 1), to = Date.UTC(Y, M + 1, 1);
				const span = (to - from) / DAY_MS;
				const day = (t) => (Math.min(Math.max(t, from), to) - from) / DAY_MS;
				const inMonth = ss.filter((x) => localMs(x.start) < to && localMs(x.end) > from);
				const segs = inMonth.map((x) => [day(localMs(x.start)), day(localMs(x.end)),
					`${palClass(x.palette)}${x.status === "live" ? " live" : ""}`]);
				inMonth.filter((x) => x.status === "crashed" && localMs(x.end) < to)
					.forEach((x) => { const e = day(localMs(x.end)); segs.push([e - 0.25, e + 0.25, "crash"]); });
				rows.push(`<div class="tl-row"><i>${monthName(M)}</i>${strip(segs, { span, label: `${monthName(M)} ${Y}: ${inMonth.length} sessions` })}</div>`);
			}

			return stats([
				[num(ss.length), "sessions"],
				[num(median(ss.filter((x) => x.status !== "live").map((x) => x.hours)), 1), "median hours"],
				[num(crashed), "power cuts"],
			])
			+ p(`Each bar is one session, coloured by its spectrum palette. Crashes are marked in red${live ? `; the current session (${esc(live.palette)}, since ${stamp(live.start)}) is still in progress` : ""}.`)
			+ `<div class="nlysr-timeline">${rows.join("")}<div class="tl-row"><i></i><div class="nlysr-axis"><i>1st</i><i>day of month</i><i>end</i></div></div></div>`
			+ table(["Start", "Hours", "Tracks", "Broadcasts", "Palette", "Status"],
				ss.slice(-12).reverse().map((x) => [
					stamp(x.start), num(x.hours, 1), num(x.tracks_streamed),
					x.start < BROADCAST_IDS_FROM ? "—" : num(x.broadcasts),
					x.palette, x.status === "live" ? "in progress" : x.status,
				]), "Recent sessions");
		},
	},
};
