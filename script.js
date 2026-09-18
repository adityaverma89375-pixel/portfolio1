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

/* ============================================================
   In Silico Variant Triage Simulator
   Synthetic p53 DNA-binding-domain cohort, scored on a
   Grantham-style physicochemical distance, a ΔΔG folding-stability
   proxy, and DNA-contact-interface proximity. Fully client-side.
   ============================================================ */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const controls = $('triage-model');
  const tableWrap = $('triageTable');
  if (!controls || !tableWrap) return;

  /* ---------- Deterministic PRNG (mulberry32) ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- p53 DNA-binding domain residues (94–312) ---------- */
  const DBD_START = 94, DBD_END = 312;

  // DNA-contact interface clusters (residue ranges known to touch DNA)
  const CONTACT_ZONES = [
    [120, 141], [163, 195], [236, 251], [273, 287]
  ];
  const isContact = (r) => CONTACT_ZONES.some(([a, b]) => r >= a && r <= b);

  // Hydropathy index (Kyte–Doolittle) — polarity/volume/hydrophobicity proxy
  const HYDRO = { A: 1.8, R: -4.5, N: -3.5, D: -3.5, C: 2.5, Q: -3.5, E: -3.5, G: -0.4, H: -3.2, I: 4.5, L: 3.8, K: -3.9, M: 1.9, F: 2.8, P: -1.6, S: -0.8, T: -0.7, W: -0.9, Y: -1.3, V: 4.2 };
  const AMINO = Object.keys(HYDRO);
  const pickAA = (rng) => AMINO[Math.floor(rng() * AMINO.length)];

  /* ---------- Cohort generation ---------- */
  function generateCohort(N, driverRate, rng) {
    const nDrivers = Math.round((driverRate / 100) * N);
    const variants = [];
    const used = new Set();
    for (let i = 0; i < N; i++) {
      let pos, wt, mut, key;
      do {
        pos = DBD_START + Math.floor(rng() * (DBD_END - DBD_START + 1));
        wt = pickAA(rng);
        mut = pickAA(rng);
        key = pos + wt + mut;
      } while (mut === wt || used.has(key));
      used.add(key);
      variants.push({ pos, wt, mut, trueDriver: i < nDrivers, contact: isContact(pos) });
    }
    return variants;
  }

  /* ---------- Scoring model ----------
     grantham : normalized physicochemical distance |Δhydropathy|/8 + volume term (toy)
     ddg      : folding-stability loss proxy, larger when hydropathy shifts
                and the variant sits in a structured (contact) region
     interface: 1 inside DNA-contact zones, decaying with distance outside
     score    = w_g·grantham + w_s·ddg + w_i·interface  (+ Gaussian assay noise)
  */
  function scoreCohort(cohort, noise, useStruct, rng) {
    return cohort.map((v) => {
      const dh = Math.abs(HYDRO[v.mut] - HYDRO[v.wt]);      // 0..8.4
      const grantham = Math.min(dh / 6, 1);                  // normalized 0..1
      const iface = v.contact ? 1 : Math.max(0, 1 - (Math.min(
        Math.abs(v.pos - 130), Math.abs(v.pos - 179),
        Math.abs(v.pos - 243), Math.abs(v.pos - 280)
      ) - 10) / 60);
      const ddg = useStruct
        ? Math.min(1, 0.35 * grantham + (v.contact ? 0.45 : 0.1) * (0.5 + dh / 8.4))
        : 0.5 * grantham;
      const score = Math.min(1, Math.max(0,
        0.35 * grantham + 0.4 * ddg + 0.25 * iface + (rng() - 0.5) * 2 * noise
      ));
      return { ...v, grantham, ddg, interface: iface, score };
    });
  }

  function classify(v, threshold) {
    if (v.score >= threshold) {
      return v.interface >= 0.9 ? 'Driver' : 'Loss-of-function';
    }
    if (v.score >= threshold - 0.15) return 'VUS';
    return 'Passenger';
  }

  /* ---------- Chart setup ---------- */
  const GRID = 'rgba(255,255,255,0.05)';
  const TICK = '#8b93a7';
  const CLASS_COLORS = { 'Driver': '#ff6b6b', 'Loss-of-function': '#ffb86b', 'VUS': '#3a7bfd', 'Passenger': '#8b93a7' };

  let chart = null;
  const sortedCache = [];
  if (typeof Chart !== 'undefined') {
    chart = new Chart($('triageChart').getContext('2d'), {
      type: 'bar',
      data: { labels: [], datasets: [{ label: 'Composite score', data: [], borderWidth: 0, borderRadius: 4 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(14, 21, 36, 0.92)',
            borderColor: 'rgba(0, 242, 254, 0.3)', borderWidth: 1,
            titleColor: '#e8edf5', bodyColor: '#8b93a7', padding: 10,
            callbacks: {
              label: (ctx) => {
                const v = sortedCache[ctx.dataIndex];
                if (!v) return '';
                return [`score ${v.score.toFixed(3)}`, `${v.wt}→${v.mut} · Grantham ${v.grantham.toFixed(2)} · ΔΔG ${v.ddg.toFixed(2)} · interface ${v.interface.toFixed(2)}`];
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: TICK, font: { size: 10 }, maxRotation: 60, minRotation: 45, autoSkip: false }, grid: { display: false } },
          y: { title: { display: true, text: 'Composite score', color: TICK }, ticks: { color: TICK, font: { size: 10 } }, grid: { color: GRID }, beginAtZero: true, max: 1 }
        }
      }
    });
  }

  /* ---------- Renderers ---------- */
  const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—');

  function renderOutputs(scored, threshold) {
    const map = { nVariants: 0, driverRate: 0, noise: 2, threshold: 2 };
    for (const id of Object.keys(map)) {
      const input = $(id), out = $(id + '-out');
      if (input && out) out.textContent = fmt(parseFloat(input.value), map[id]);
    }
    const drivers = scored.filter((v) => classify(v, threshold) === 'Driver');
    const lof = scored.filter((v) => classify(v, threshold) === 'Loss-of-function');
    const tp = drivers.filter((v) => v.trueDriver).length;
    const truth = scored.filter((v) => v.trueDriver).length;
    const trD = $('tr-drivers'), trL = $('tr-lof'), trP = $('tr-precision'), trR = $('tr-recall');
    if (trD) trD.textContent = `${drivers.length} / ${scored.length}`;
    if (trL) trL.textContent = `${lof.length} / ${scored.length}`;
    if (trP) trP.textContent = drivers.length ? fmt(tp / drivers.length) : '—';
    if (trR) trR.textContent = truth ? fmt(tp / truth) : '—';
  }

  function renderChart(scored, threshold) {
    if (!chart) return;
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    sortedCache.length = 0;
    sortedCache.push(...sorted);
    chart.data.labels = sorted.map((v) => `${v.pos}${v.wt}>${v.mut}`);
    chart.data.datasets[0].data = sorted.map((v) => +v.score.toFixed(3));
    chart.data.datasets[0].backgroundColor = sorted.map((v) => CLASS_COLORS[classify(v, threshold)]);
    chart.update('none');
  }

  function renderTable(scored, threshold) {
    const badge = (cls) => {
      const key = cls === 'Driver' ? 'driver' : cls === 'Loss-of-function' ? 'lof' : cls === 'VUS' ? 'vus' : 'passenger';
      return `<span class="class-badge class-${key}">${cls}</span>`;
    };
    const rows = [...scored].sort((a, b) => b.score - a.score).map((v, i) =>
      `<tr><td>#${i + 1} · ${v.pos}${v.wt}&gt;${v.mut}</td><td>${v.grantham.toFixed(2)}</td><td>${v.ddg.toFixed(2)}</td><td>${v.interface.toFixed(2)}</td><td>${v.score.toFixed(3)}</td><td>${badge(classify(v, threshold))}</td></tr>`
    ).join('');
    tableWrap.innerHTML =
      '<table><thead><tr><th>Variant</th><th>Grantham</th><th>ΔΔG</th><th>Interface</th><th>Score</th><th>Call</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  /* ---------- Entry point (exposed for open/reset wiring) ---------- */
  function run() {
    const num = (id) => parseFloat($(id).value);
    const N = Math.round(num('nVariants'));
    const rng = mulberry32(0xC0FFEE);           // deterministic seed → stable cohort per run
    const cohort = generateCohort(N, num('driverRate'), rng);
    const scored = scoreCohort(cohort, num('noise'), $('structWeight').checked, rng);
    const threshold = num('threshold');
    renderOutputs(scored, threshold);
    renderChart(scored, threshold);
    renderTable(scored, threshold);
  }
  window.runTriageSimulation = run;

  /* ---------- Events: every control updates the triage live ---------- */
  controls.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', run);
  });
})();
