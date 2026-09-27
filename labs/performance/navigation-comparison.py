"""Compare synchronized native presentation intervals without aligning different input times."""
import json, sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

before, after, output = map(Path, sys.argv[1:4])
output.mkdir(parents=True, exist_ok=True)
captures = [json.loads((root / 'analysis.json').read_text()) for root in [before, after]]
assert all(data['sync']['valid'] for data in captures), 'Both captures must be synchronized.'
assert captures[0]['browser'] == captures[1]['browser'], 'Compare the same browser build.'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 11})
fig, axes = plt.subplots(2, 2, figsize=(15, 8), layout='constrained', sharey=True)
fig.suptitle('Sun → Mars → Earth → Sun\nMeasured presentation intervals · lower is better', fontsize=19, fontweight='bold')
colors = ['#b8683f', '#27778d']
ceiling = max(frame['ms'] for data in captures for p in data['passes'] for frame in data['frames']
              if p['start'] <= frame['time'] <= p['end']) * 1.22
results = []
for column, (data, label, color) in enumerate(zip(captures, ['Before', 'After'], colors)):
    for row, p in enumerate(data['passes']):
        ax = axes[row, column]
        selected = [f for f in data['frames'] if p['start'] <= f['time'] <= p['end']]
        ax.vlines([f['time'] - p['start'] for f in selected], 0, [f['ms'] for f in selected], color=color, lw=.7)
        ax.axhline(16.667, color='#555', ls='--', lw=.8)
        for phase in p['phases']:
            if phase['kind'] != 'flight-to': continue
            a, b = phase['start'] - p['start'], phase['end'] - p['start']
            ax.axvspan(a, b, color=color, alpha=.10)
            ax.text((a + b)/2, ceiling*.95, phase['body'].title(), ha='center', va='top', fontsize=9)
        worst = max(selected, key=lambda f: f['ms'])
        ax.annotate(f"{worst['ms']:.0f} ms", (worst['time'] - p['start'], worst['ms']),
                    xytext=(4, 7), textcoords='offset points', fontsize=10)
        stats = p['summary']
        pass_label = 'First destination visits' if row == 0 else 'Cached return visits'
        ax.set_title(f"{label} · {pass_label}\np95 {stats['p95']:.1f} ms · {stats['over25']}/{stats['count']} intervals >25 ms", loc='left', fontsize=12)
        ax.set(xlim=(0, p['end'] - p['start']), ylim=(0, ceiling), xlabel='Journey time (seconds)')
        if column == 0: ax.set_ylabel('Presentation interval (ms)')
        ax.grid(axis='y', alpha=.2); ax.spines[['top', 'right']].set_visible(False)
        results.append({'variant': label.lower(), 'pass': p['name'], **stats})
fig.supxlabel('Dashed line: 60 Hz / 16.7 ms. Shading: fly-to. Same journey, adaptive native input; phase times differ.\nOne capture per build. Recorder + trace + video add overhead; intervals are not physical dropped-frame counts.', fontsize=10)
fig.savefig(output / 'before-after.png', dpi=150)
fig.savefig(output / 'before-after.svg')
(output / 'comparison.json').write_text(json.dumps({'before': str(before), 'after': str(after), 'results': results}, indent=2))
print(json.dumps(results, indent=2))
