/**
 * Offline Chart.js helpers (requires chart.umd.min.js from static/vendor).
 */
(function (global) {
  'use strict';

  function theme() {
    const root = document.documentElement;
    const css = getComputedStyle(root);
    const p = css.getPropertyValue('--c-primary').trim() || '37 99 235';
    const s = css.getPropertyValue('--c-secondary').trim() || '16 185 129';
    const fg = css.getPropertyValue('--c-foreground').trim() || '15 23 42';
    const border = css.getPropertyValue('--c-border').trim() || '226 232 240';
    const dark = root.classList.contains('dark');
    const primary = `rgb(${p})`;
    const secondary = `rgb(${s})`;
    return {
      primary,
      secondary,
      axis: `rgb(${fg} / ${dark ? 0.75 : 0.68})`,
      grid: `rgb(${border} / ${dark ? 0.35 : 0.55})`,
      tipBg: `rgb(${dark ? '15 23 42' : '255 255 255'} / 0.96)`,
      tipText: `rgb(${fg})`,
      tipBorder: `rgb(${border})`,
      primaryAlpha: (a) => `rgb(${p} / ${a})`,
      secondaryAlpha: (a) => `rgb(${s} / ${a})`,
    };
  }

  function money(n) {
    return '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function units(n) {
    return Number(n || 0).toLocaleString() + ' units';
  }

  function seriesStats(values) {
    const vals = (values || []).map((v) => Number(v || 0));
    const total = vals.reduce((a, b) => a + b, 0);
    const peak = vals.length ? Math.max(...vals) : 0;
    const avg = vals.length ? total / vals.length : 0;
    const peakIdx = vals.indexOf(peak);
    return { total, peak, avg, peakIdx, vals, hasData: vals.some((v) => v > 0) };
  }

  function gradient(ctx, rgb, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h || 280);
    const rgba = rgb.replace('rgb(', 'rgba(').replace(')', '');
    g.addColorStop(0, `${rgba}, 0.42)`);
    g.addColorStop(1, `${rgba}, 0.06)`);
    return g;
  }

  function tooltip(t, kind) {
    const base = {
      backgroundColor: t.tipBg,
      titleColor: t.tipText,
      bodyColor: t.tipText,
      borderColor: t.tipBorder,
      borderWidth: 1,
      padding: 12,
      cornerRadius: 10,
    };
    if (kind === 'money') {
      base.callbacks = {
        label: (ctx) => ` ${money(ctx.parsed.y ?? ctx.parsed.x ?? 0)}`,
      };
    } else if (kind === 'units') {
      base.callbacks = {
        label: (ctx) => ` ${units(ctx.parsed.y ?? ctx.parsed.x ?? ctx.raw ?? 0)}`,
      };
    } else if (kind === 'count') {
      base.callbacks = {
        label: (ctx) => ` ${ctx.label}: ${Number(ctx.parsed ?? ctx.raw ?? 0)} product(s)`,
      };
    }
    return base;
  }

  function setKpi(prefix, stats, formatter) {
    const fmt = formatter || money;
    const el = (id) => document.getElementById(prefix + id);
    if (el('Total')) el('Total').textContent = fmt(stats.total);
    if (el('Peak')) el('Peak').textContent = fmt(stats.peak);
    if (el('Avg')) el('Avg').textContent = fmt(stats.avg);
    if (el('PeakLabel') && stats.peakIdx >= 0) {
      /* optional — set from caller with labels */
    }
    const empty = document.getElementById(prefix + 'Empty');
    if (empty) {
      empty.className = `${stats.hasData ? 'hidden' : 'flex'} absolute inset-0 z-10 flex-col items-center justify-center text-center pointer-events-none`;
    }
  }

  function createLineChart(canvas, series, colorKey, registry) {
    if (!canvas || typeof Chart === 'undefined') return null;
    const t = theme();
    const color = colorKey === 'secondary' ? t.secondary : t.primary;
    const ctx = canvas.getContext('2d');
    const fill = gradient(ctx, color);
    const stats = seriesStats(series.values);
    setKpi(canvas.dataset.kpiPrefix || '', stats, money);

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: series.labels || [],
        datasets: [{
          label: 'Revenue',
          data: series.values || [],
          borderColor: color,
          backgroundColor: fill,
          fill: true,
          tension: 0.4,
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: color,
          pointBorderColor: t.tipBg,
          pointBorderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 450 },
        plugins: { legend: { display: false }, tooltip: tooltip(t, 'money') },
        scales: {
          x: {
            ticks: { color: t.axis, maxRotation: 45, font: { size: 11 } },
            grid: { display: false },
            border: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: t.axis,
              maxTicksLimit: 6,
              callback: (v) =>
                v >= 1e6 ? `₦${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `₦${(v / 1e3).toFixed(0)}k` : `₦${v}`,
            },
            grid: { color: t.grid },
            border: { display: false },
          },
        },
      },
    });
    if (registry) registry.push(chart);
    return chart;
  }

  function createBarChart(canvas, labels, values, opts, registry) {
    if (!canvas || typeof Chart === 'undefined') return null;
    const t = theme();
    const o = opts || {};
    const color = o.color || t.primary;
    const ctx = canvas.getContext('2d');
    const horizontal = o.horizontal === true;
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: o.label || 'Value',
          data: values,
          backgroundColor: o.colors || t.primaryAlpha(0.75),
          hoverBackgroundColor: color,
          borderRadius: o.borderRadius ?? 6,
          maxBarThickness: o.maxBarThickness ?? 36,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: horizontal ? 'y' : 'x',
        plugins: { legend: { display: false }, tooltip: tooltip(t, o.tooltipKind || 'units') },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { color: t.axis, font: { size: 10 }, precision: o.precision },
            grid: { color: t.grid, drawBorder: false },
            border: { display: false },
          },
          y: {
            beginAtZero: !horizontal,
            ticks: { color: t.axis, font: { size: 10 } },
            grid: horizontal ? { display: false } : { color: t.grid, drawBorder: false },
            border: { display: false },
          },
        },
      },
    });
    if (registry) registry.push(chart);
    return chart;
  }

  function createDoughnutChart(canvas, labels, values, registry) {
    if (!canvas || typeof Chart === 'undefined') return null;
    const t = theme();
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: [
            t.secondaryAlpha(0.85),
            'rgba(245, 158, 11, 0.85)',
            'rgba(239, 68, 68, 0.85)',
            t.primaryAlpha(0.7),
          ],
          borderColor: t.tipBg,
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: t.axis, boxWidth: 12, padding: 12, font: { size: 11 } },
          },
          tooltip: tooltip(t, 'count'),
        },
      },
    });
    if (registry) registry.push(chart);
    return chart;
  }

  global.ChartKit = {
    theme,
    money,
    units,
    seriesStats,
    gradient,
    setKpi,
    createLineChart,
    createBarChart,
    createDoughnutChart,
  };
})(typeof window !== 'undefined' ? window : global);
