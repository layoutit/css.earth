import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const percentile = (values, fraction) => values.length ? [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)] : 0;
const rounded = number => Math.round(number * 100) / 100;
export async function summarizeEntityTrace(events, metrics, { output, prefix, network = [] }) {
  const marks = events.filter(event => event.cat?.includes("blink.user_timing") && event.name?.startsWith("entity:"));
  const startMark = marks.find(event => event.name.endsWith(":start"));
  const thread = startMark ? { pid: startMark.pid, tid: startMark.tid } : null;
  const main = events.filter(event => event.pid === thread?.pid && event.tid === thread?.tid && event.ph === "X" && event.dur > 0);
  const phases = (metrics?.phases ?? []).map(phase => {
    const mark = marks.find(event => event.name === `entity:${phase.name}:start`), end = marks.find(event => event.name === `entity:${phase.name}:end`);
    const matching = main.filter(event => event.ts >= mark?.ts && event.ts < end?.ts);
    const totals = new Map();
    for (const event of matching) totals.set(event.name, (totals.get(event.name) ?? 0) + event.dur / 1000);
    const frames = metrics.frames.filter(frame => frame.at >= phase.start && frame.at <= phase.end).map(frame => frame.duration);
    const longTasks = metrics.longTasks.filter(task => task.at >= phase.start && task.at < phase.end).map(task => task.duration);
    const overlapping = network.filter(row => row.start * 1e6 < end?.ts && (row.end ?? Infinity) * 1e6 >= mark?.ts);
    return { name: phase.name, inputToFrameMs: (metrics.queryPaints ?? []).filter(query => query.inputAt >= phase.start && query.frameAt <= phase.end).map(query => rounded(query.inputToFrameMs)), wallMs: rounded(phase.duration), frameP95: rounded(percentile(frames, .95)), frameMax: rounded(Math.max(0, ...frames)), longTaskMax: rounded(Math.max(0, ...longTasks)),
      events: [...totals].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, inclusiveMs]) => ({ name, inclusiveMs: rounded(inclusiveMs) })),
      overlappingRequests: overlapping.map(row => ({ url: row.url, status: row.status, cached: row.cached, transferBytes: row.transferBytes, requestMs: row.end === undefined ? null : rounded((row.end - row.start) * 1000) })),
      longest: matching.sort((a, b) => b.dur - a.dur).slice(0, 12).map(event => ({ name: event.name, milliseconds: rounded(event.dur / 1000), data: event.args?.data })) };
  });
  const nodes = new Map(), samples = new Map();
  for (const event of events.filter(event => event.name === "ProfileChunk")) {
    const data = event.args?.data;
    for (const node of data?.cpuProfile?.nodes ?? []) nodes.set(`${event.pid}:${event.id}:${node.id}`, node.callFrame);
    (data?.cpuProfile?.samples ?? []).forEach((id, index) => {
      const key = `${event.pid}:${event.id}:${id}`;
      samples.set(key, (samples.get(key) ?? 0) + (data.timeDeltas?.[index] ?? 0) / 1000);
    });
  }
  const cpu = [...samples].map(([key, milliseconds]) => ({ frame: nodes.get(key), milliseconds: rounded(milliseconds) })).filter(row => row.frame).sort((a, b) => b.milliseconds - a.milliseconds).slice(0, 30);
  const shots = events.filter(event => event.name === "Screenshot" && event.args?.snapshot);
  const worst = main.filter(event => event.name === "RunTask").sort((a, b) => b.dur - a.dur).slice(0, 3), frames = [];
  for (const [index, event] of worst.entries()) {
    const before = shots.findLast(shot => shot.ts <= event.ts), after = shots.find(shot => shot.ts >= event.ts + event.dur);
    const pair = { taskMs: event.dur / 1000, before: null, after: null };
    for (const [side, shot] of [["before", before], ["after", after]]) if (shot) {
      const name = `${prefix}-pause-${index + 1}-${side}.jpg`;
      await writeFile(resolve(output, name), Buffer.from(shot.args.snapshot, "base64")); pair[side] = name;
    }
    frames.push(pair);
  }
  const markedPhase = metrics?.phases.find(phase => `entity:${phase.name}:start` === startMark?.name);
  const worstPresentationFrames = [];
  if (markedPhase) {
    const clockOffset = startMark.ts - markedPhase.start * 1000;
    const slowest = metrics.frames.filter(frame => frame.phase && frame.phase !== "document")
      .sort((a, b) => b.duration - a.duration).slice(0, 3);
    for (const [index, frame] of slowest.entries()) {
      const start = clockOffset + (frame.at - frame.duration) * 1000, end = clockOffset + frame.at * 1000;
      const pair = { phase: frame.phase, intervalMs: frame.duration, before: null, after: null };
      for (const [side, shot] of [["before", shots.findLast(shot => shot.ts <= start)], ["after", shots.find(shot => shot.ts >= end)]]) if (shot) {
        const name = `${prefix}-frame-${index + 1}-${side}.jpg`;
        await writeFile(resolve(output, name), Buffer.from(shot.args.snapshot, "base64")); pair[side] = name;
      }
      worstPresentationFrames.push(pair);
    }
  }
  const summary = { phases, cpu, worstFrames: frames, worstPresentationFrames, qualification: "Trace event times are inclusive and must not be summed across parent/child events. Videos and unfiltered frame intervals remain the presentation evidence." };
  await writeFile(resolve(output, `${prefix}-summary.json`), JSON.stringify(summary, null, 2));
  return summary;
}

export async function writeEntityPerformanceReview(report) {
  const escape = value => String(value).replace(/[&<>"']/gu, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const row = phase => `<tr><td>${escape(phase.name)}</td><td>${phase.wallMs}</td><td>${phase.inputToFrameMs?.join(", ") ?? ""}</td><td>${phase.frameP95}</td><td class="${phase.frameMax > 100 ? "bad" : ""}">${phase.frameMax}</td><td>${phase.longTaskMax}</td><td>${phase.overlappingRequests.length}</td></tr>`;
  const runs = report.runs.filter(run => run.summary).map(run => `<section><h2>${escape(run.label)}</h2><table><thead><tr><th>Scenario</th><th>Total ms</th><th>Input → next frame</th><th>Frame p95</th><th>Worst frame</th><th>Longest task</th><th>Requests overlapping</th></tr></thead><tbody>${run.summary.phases.map(row).join("")}</tbody></table>
    ${run.video ? `<video controls preload="none" src="${escape(run.video.split("/").at(-1))}"></video>` : ""}
    <h3>Frames surrounding the longest main-thread tasks</h3>${run.summary.worstFrames.map(pair => `<p>${rounded(pair.taskMs)} ms task</p><div class="pair">${[pair.before, pair.after].map(path => path ? `<img loading="lazy" src="${escape(path)}">` : "<p>No frame available</p>").join("")}</div>`).join("")}
    <h3>Frames surrounding the longest presentation intervals</h3>${(run.summary.worstPresentationFrames ?? []).map(pair => `<p>${escape(pair.phase)} · ${rounded(pair.intervalMs)} ms interval</p><div class="pair">${[pair.before, pair.after].map(path => path ? `<img loading="lazy" src="${escape(path)}">` : "<p>No frame available</p>").join("")}</div>`).join("")}
    <details><summary>CPU samples and event attribution</summary><pre>${escape(JSON.stringify({ cpu: run.summary.cpu, phases: run.summary.phases.map(({name,events,longest}) => ({name,events,longest})) }, null, 2))}</pre></details></section>`).join("");
  await writeFile(resolve(report.output, "review.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Entity exploration performance</title><style>body{font:16px system-ui;background:#16191d;color:#e7edf4;margin:32px auto;max-width:1200px;padding:0 20px}table{border-collapse:collapse;width:100%}td,th{padding:9px;border-bottom:1px solid #445;text-align:left}.bad{color:#ff948a;font-weight:bold}section{margin:40px 0;border-top:2px solid #556;padding-top:12px}video{width:100%;max-height:600px;margin:20px 0}.pair{display:flex;gap:12px}.pair img{width:48%;object-fit:contain}pre{overflow:auto;max-height:500px;font-size:12px}</style><h1>Entity exploration · ${escape(report.mode)}</h1><p>${escape(report.commit)} · Chrome ${escape(report.browser)} · DPR ${report.dpr} · ${report.viewport.width}×${report.viewport.height}</p><p>Each video contains a cold/warm pair. Frame intervals include browser rendering; input-to-frame times begin at the browser input event and end at the next animation frame with ready result rows. Total scenario times also include automation, two settling frames, network waits and the accepted 4.5 s flight. Red marks a frame interval above 100 ms. Trace event durations are inclusive.</p>${runs}</html>`);
}
