const canvasElem = document.getElementById('metabolicChart');

if (canvasElem) {
  const ctx = canvasElem.getContext('2d');

  let chart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        x: { 
          title: { display: true, text: 'Time (s)', color: '#8b93a7' }, 
          grid: { color: 'rgba(255,255,255,0.05)' } 
        },
        y: { 
          title: { display: true, text: 'Concentration (mM)', color: '#8b93a7' }, 
          grid: { color: 'rgba(255,255,255,0.05)' } 
        }
      }
    }
  });

  function simulatePathway() {
    const vmax1 = parseFloat(document.getElementById('vmax1').value);
    const km1 = parseFloat(document.getElementById('km1').value);
    const vmax2 = parseFloat(document.getElementById('vmax2').value);
    const km2 = parseFloat(document.getElementById('km2').value);
    const S0 = parseFloat(document.getElementById('s0').value);
    const feedback = document.getElementById('feedback').checked;

    let S = S0, I = 0, P = 0;
    const dt = 0.1, steps = 500;
    let t_arr = [], S_arr = [], I_arr = [], P_arr = [], Mass_arr = [];

    for (let i = 0; i <= steps; i++) {
      let t = i * dt;
      let inh = feedback ? (1 / (1 + Math.pow(P / 2.0, 2))) : 1.0;
      let v1 = ((vmax1 * S) / (km1 + S)) * inh;
      let v2 = (vmax2 * I) / (km2 + I);

      S += -v1 * dt;
      I += (v1 - v2) * dt;
      P += v2 * dt;

      if (S < 0) S = 0; 
      if (I < 0) I = 0; 
      if (P < 0) P = 0;

      t_arr.push(t.toFixed(1));
      S_arr.push(S); 
      I_arr.push(I); 
      P_arr.push(P);
      Mass_arr.push(S + I + P);
    }

    chart.data = {
      labels: t_arr,
      datasets: [
        { label: 'Substrate (S)', data: S_arr, borderColor: '#00f2fe', borderWidth: 2, pointRadius: 0 },
        { label: 'Intermediate (I)', data: I_arr, borderColor: '#3a7bfd', borderWidth: 2, pointRadius: 0 },
        { label: 'Product (P)', data: P_arr, borderColor: '#e8edf5', borderWidth: 2, pointRadius: 0 },
        { label: 'Total Mass', data: Mass_arr, borderColor: '#8b93a7', borderDash: [4, 4], borderWidth: 1, pointRadius: 0 }
      ]
    };
    chart.update();
  }

  document.querySelectorAll('#metabolic-model input').forEach(input => {
    input.addEventListener('input', simulatePathway);
  });

  simulatePathway();
}
