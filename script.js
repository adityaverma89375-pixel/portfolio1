/* ============================================================
   Metabolic Pathway Simulator
   Two-step Michaelis–Menten chain (S → I → P) with optional
   end-product feedback inhibition on enzyme E1.
   Runs entirely in the browser — no server required.
   ============================================================ */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('metabolicChart');
  const controls = $('metabolic-model');
  if (!canvas || !controls) return;

  /* ---------- Chart setup ---------- */
  const GRID = 'rgba(255,255,255,0.05)';
  const TICK = '#8b93a7';
  const isDark = document.body.classList.contains('light-theme') === false;

  let chart = null;
  if (typeof Chart !== 'undefined') {
    chart = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          { label: 'Substrate (S)',   data: [], borderColor: '#00f2fe', borderWidth: 2, pointRadius: 0, tension: 0.25 },
          { label: 'Intermediate (I)', data: [], borderColor: '#3a7bfd', borderWidth: 2, pointRadius: 0, tension: 0.25 },
          { label: 'Product (P)',      data: [], borderColor: '#e8edf5', borderWidth: 2, pointRadius: 0, tension: 0.25 },
          { label: 'Total mass (S+I+P)', data: [], borderColor: '#8b93a7', borderDash: [4, 4], borderWidth: 1, pointRadius: 0, tension: 0.25 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: {
              color: isDark ? TICK : '#333',
              boxWidth: 14,
              boxHeight: 2,
              font: { family: 'Inter, sans-serif', size: 11 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(14, 21, 36, 0.92)',
            borderColor: 'rgba(0, 242, 254, 0.3)',
            borderWidth: 1,
            titleColor: '#e8edf5',
            bodyColor: '#8b93a7',
            padding: 10
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Time (s)', color: TICK },
            ticks: { color: TICK, maxTicksLimit: 10, font: { size: 10 } },
            grid: { color: GRID }
          },
          y: {
            title: { display: true, text: 'Concentration (mM)', color: TICK },
            ticks: { color: TICK, font: { size: 10 } },
            grid: { color: GRID },
            beginAtZero: true
          }
        }
      }
    });
  }

  /* ---------- Kinetic model ----------
     v1 = Vmax1·S/(Km1+S) · f(P)      (f = feedback inhibition factor)
     v2 = Vmax2·I/(Km2+I)
     dS/dt = −v1   dI/dt = v1−v2   dP/dt = v2
     Feedback: f = 1/(1+(P/Ki)²)  (Ki = 2 mM, cooperative inhibition)
  */
  function simulate(vmax1, km1, vmax2, km2, S0, feedback) {
    const dt = 0.1, steps = 500;
    let S = S0, I = 0, P = 0;
    let lastV1 = 0, lastV2 = 0, pkV1 = 0, pkV2 = 0;
    const t = [], S_ = [], I_ = [], P_ = [], M_ = [];

    for (let i = 0; i <= steps; i++) {
      if (i % 5 === 0) {                 // sample every 0.5 s to keep the chart light
        t.push((i * dt).toFixed(1));
        S_.push(+S.toFixed(4));
        I_.push(+I.toFixed(4));
        P_.push(+P.toFixed(4));
        M_.push(+(S + I + P).toFixed(4));
      }
      const inh = feedback ? 1 / (1 + Math.pow(P / 2.0, 2)) : 1;
      const v1 = ((vmax1 * S) / (km1 + S)) * inh;
      const v2 = (vmax2 * I) / (km2 + I);
      lastV1 = v1; lastV2 = v2;
      if (v1 > pkV1) pkV1 = v1;
      if (v2 > pkV2) pkV2 = v2;

      S += -v1 * dt;
      I += (v1 - v2) * dt;
      P += v2 * dt;

      if (S < 0) S = 0;
      if (I < 0) I = 0;
      if (P < 0) P = 0;
    }
    return { t, S: S_, I: I_, P: P_, M: M_, v1: pkV1, v2: pkV2, Pfinal: P };
  }

  /* ---------- DOM output helpers ---------- */
  const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—');

  function renderOutputs(v) {
    const map = { vmax1: 2, km1: 2, vmax2: 2, km2: 2, s0: 1 };
    for (const id of Object.keys(map)) {
      const input = $(id), out = $(id + '-out');
      if (input && out) out.textContent = fmt(parseFloat(input.value), map[id]);
    }
    const roV1 = $('ro-v1'), roV2 = $('ro-v2'), roAtp = $('ro-atp'), roSs = $('ro-ss');
    if (roV1) roV1.textContent = fmt(v.v1) + ' mM/s';
    if (roV2) roV2.textContent = fmt(v.v2) + ' mM/s';
    // ATP equivalent: each S fully oxidised to P nets ~2 ATP in this toy model
    if (roAtp) roAtp.textContent = fmt(v.Pfinal * 2, 1) + ' mM';
    const mass = v.M.length ? v.M[v.M.length - 1] : NaN;
    const conserved = Math.abs(mass - parseFloat($('s0').value)) < 0.05;
    if (roSs) roSs.textContent = conserved ? 'Mass ✓' : 'Mass ✗';
  }

  function renderChart(v) {
    if (!chart) return;
    chart.data.labels = v.t;
    chart.data.datasets[0].data = v.S;
    chart.data.datasets[1].data = v.I;
    chart.data.datasets[2].data = v.P;
    chart.data.datasets[3].data = v.M;
    chart.update('none'); // 'none' skips animation → snappy slider response
  }

  function renderFallback(v) {
    // Numeric table shown if the Chart.js CDN is blocked
    const wrap = canvas.parentElement;
    if (!wrap.querySelector('.sim-table')) {
      const table = document.createElement('div');
      table.className = 'sim-table';
      table.style.cssText = 'overflow:auto;max-height:280px;font-size:0.8rem;color:#8b93a7;';
      wrap.appendChild(table);
    }
    const rows = v.t.map((t, i) =>
      `<tr><td>${t}</td><td>${v.S[i].toFixed(2)}</td><td>${v.I[i].toFixed(2)}</td><td>${v.P[i].toFixed(2)}</td></tr>`
    ).join('');
    wrap.querySelector('.sim-table').innerHTML =
      '<table style="width:100%;border-collapse:collapse;text-align:right;"><thead><tr>' +
      '<th>t(s)</th><th>S</th><th>I</th><th>P</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  /* ---------- Entry point (exposed for the Reset button) ---------- */
  function run() {
    const num = (id) => parseFloat($(id).value);
    const result = simulate(
      num('vmax1'), num('km1'), num('vmax2'), num('km2'),
      num('s0'), $('feedback').checked
    );
    renderOutputs(result);
    if (chart) renderChart(result); else renderFallback(result);
  }
  window.runMetabolicSimulation = run;

  /* ---------- Events: every control updates the simulation live ---------- */
  controls.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', run);
  });

  run(); // initial render with default values
})();
