// ============================================================
// QUADRE DE COMANDAMENT — Lògica principal
// ============================================================

// ---------- Estat global ----------
let entitatActual = null;
let tipusActual = null;
let dades = null;
let columnes = [];
let vistaActual = 'barres';
let filtres = [];
let metriquesSel = [];   // array de mètriques seleccionades (multi)
let chartActual = null;

// ---------- Utilitats ----------
let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

function actualitzarTitolPissarra() {
  const titol = document.getElementById('pissarraTitol');
  const sub = document.getElementById('pissarraSub');
  if (entitatActual && tipusActual) {
    titol.textContent = NOMS_ENTITAT[entitatActual] + ' · ' + NOMS_TIPUS[tipusActual];
    sub.textContent = dades ? (dades.files.length + ' registres carregats') : 'Carregant…';
  } else if (entitatActual) {
    titol.textContent = NOMS_ENTITAT[entitatActual];
    sub.textContent = 'Tria un conjunt de dades';
  } else {
    titol.textContent = 'Quadre de comandament';
    sub.textContent = 'Tria un espai i un conjunt de dades per començar';
  }
}

// ---------- Corbes de nivell decoratives (signatura visual) ----------
function dibuixarCorbes() {
  const svg = document.getElementById('corbes');
  const w = 1200, h = 200;
  svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
  let paths = '';
  for (let i = 0; i < 6; i++) {
    const y = 20 + i * 34;
    let d = 'M -20 ' + y;
    for (let x = 0; x <= w + 40; x += 60) {
      const oy = y + Math.sin((x / 160) + i * 1.3) * (10 + i * 3);
      d += ' L ' + x + ' ' + oy.toFixed(1);
    }
    const col = i % 3 === 0 ? 'rgba(226,87,10,0.28)' : 'rgba(45,90,61,0.22)';
    paths += '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="1"/>';
  }
  svg.innerHTML = paths;
}

// ---------- Navegació (segments) ----------
document.querySelectorAll('#segEntitat .segment').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#segEntitat .segment').forEach(b => {
      b.classList.remove('actiu', 'ceinr');
    });
    btn.classList.add('actiu');
    if (btn.dataset.entitat === 'ceinr') btn.classList.add('ceinr');
    entitatActual = btn.dataset.entitat;
    dades = null; columnes = [];
    document.getElementById('controlsDinamics').style.display = 'none';
    document.getElementById('btnGenerar').disabled = true;
    // si ja hi ha tipus triat, recarrega
    if (tipusActual) carregarFull();
    actualitzarTitolPissarra();
  });
});

document.querySelectorAll('#segTipus .segment').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#segTipus .segment').forEach(b => b.classList.remove('actiu'));
    btn.classList.add('actiu');
    tipusActual = btn.dataset.tipus;
    dades = null; columnes = [];
    if (entitatActual) carregarFull();
    actualitzarTitolPissarra();
  });
});

// ---------- Vista ----------
document.querySelectorAll('#vistaGrid .vista-op').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#vistaGrid .vista-op').forEach(b => b.classList.remove('actiu'));
    btn.classList.add('actiu');
    vistaActual = btn.dataset.vista;
  });
});

// ---------- Menú mòbil ----------
const sidebar = document.getElementById('sidebar');
const rerefons = document.getElementById('rerefons');
document.getElementById('mobilToggle').addEventListener('click', () => {
  sidebar.classList.add('obert'); rerefons.classList.add('visible');
});
rerefons.addEventListener('click', () => {
  sidebar.classList.remove('obert'); rerefons.classList.remove('visible');
});
function tancarSidebarMobil() {
  sidebar.classList.remove('obert'); rerefons.classList.remove('visible');
}

// ---------- Càrrega de dades (JSONP) ----------
function carregarDadesURL(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const cbName = 'cb_dash_' + Math.random().toString(36).slice(2, 9);
    let fet = false;
    const netejar = () => {
      if (script && script.parentNode) script.parentNode.removeChild(script);
      try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
      if (timer) clearTimeout(timer);
    };
    window[cbName] = (resp) => { if (fet) return; fet = true; netejar(); resolve(resp); };
    const sep = url.indexOf('?') === -1 ? '?' : '&';
    const script = document.createElement('script');
    script.src = url + sep + 'llegir=1&callback=' + cbName;
    script.onerror = () => { if (fet) return; fet = true; netejar(); reject(new Error('No s\'ha pogut connectar amb el full de càlcul.')); };
    const timer = setTimeout(() => { if (fet) return; fet = true; netejar(); reject(new Error('El full ha trigat massa a respondre.')); }, timeoutMs || 20000);
    document.body.appendChild(script);
  });
}

async function carregarFull() {
  const cos = document.getElementById('pissarraCos');
  document.getElementById('controlsDinamics').style.display = 'none';
  document.getElementById('btnGenerar').disabled = true;
  cos.innerHTML = '<div class="estat-buit"><div class="spinner"></div><p>Carregant dades…</p></div>';
  actualitzarTitolPissarra();

  const url = FONTS[entitatActual] && FONTS[entitatActual][tipusActual];
  if (!url || url.indexOf('ENGANXA') === 0) {
    cos.innerHTML = '<div class="estat-buit"><div class="icona-gran">⚠️</div><h3>Falta configuració</h3><p class="error-msg">La URL d\'aquest full no està posada a config.js.</p></div>';
    return;
  }

  try {
    const resp = await carregarDadesURL(url);
    if (!resp || !resp.ok) throw new Error(resp && resp.error ? resp.error : 'Resposta no vàlida');
    dades = resp;
    prepararColumnes();
    muntarControls();
    document.getElementById('controlsDinamics').style.display = '';
    document.getElementById('btnGenerar').disabled = false;
    document.getElementById('capAccions').style.display = 'flex';
    mostrarBenvinguda();
    actualitzarTitolPissarra();
  } catch (e) {
    cos.innerHTML = '<div class="estat-buit"><div class="icona-gran">⚠️</div><h3>No s\'han pogut carregar les dades</h3><p class="error-msg">' + e.message + '</p></div>';
  }
}

function mostrarBenvinguda() {
  document.getElementById('pissarraCos').innerHTML =
    '<div class="estat-buit"><div class="icona-gran">📊</div><h3>Tot a punt</h3>' +
    '<p>Tria una o més mètriques i com agrupar-les a l\'esquerra, i prem <strong>Generar informe</strong>.</p></div>';
}

// ---------- Anàlisi de columnes ----------
function prepararColumnes() {
  columnes = dades.capçaleres.map((nom, index) => ({ nom, index, tipus: detectarTipus(nom, index) }));
}
function esColumnaData(nom) {
  const n = nom.toLowerCase().trim();
  return n === 'data i hora' || n === 'data' || n === 'mes';
}
function detectarTipus(nom, index) {
  const n = nom.toLowerCase().trim();
  if (esColumnaData(nom)) return 'data';
  const textFixes = ['id', 'núm', 'num', 'número', 'numero', 'setmana', 'zona', 'àrea', 'area', 'punt', 'tipus', 'estat', 'resposta', 'observacions'];
  if (textFixes.indexOf(n) !== -1) return 'text';
  let nNum = 0, nData = 0, nTotal = 0;
  for (let i = 0; i < dades.files.length; i++) {
    let v = dades.files[i][index];
    if (v === '' || v === null || v === undefined) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    nTotal++;
    if (esData(v)) nData++;
    else if (esNumero(v)) nNum++;
  }
  if (nTotal === 0) return semblaRecompte(nom) ? 'number' : 'text';
  if (nData === nTotal) return 'data';
  if (nNum === nTotal) return 'number';
  if (nNum / nTotal >= 0.8) return 'number';
  if (nData / nTotal >= 0.8) return 'data';
  return 'text';
}
function semblaRecompte(nom) {
  const n = nom.toLowerCase();
  return ['vehicles', 'tendes', 'autocaravana', 'càmping', 'camping', 'deixalles', 'escaladors', 'bicicletes', 'persones', 'nombre', 'quantitat', 'total', 'impedeixen', 'pernocta'].some(p => n.indexOf(p) !== -1);
}
function esNumero(v) {
  if (typeof v === 'number') return true;
  if (typeof v !== 'string') return false;
  let s = v.trim(); if (s === '') return false;
  s = s.replace(',', '.');
  return !isNaN(Number(s)) && isFinite(Number(s));
}
function aNumero(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  let s = v.trim().replace(',', '.'); if (s === '') return NaN;
  return Number(s);
}
function esData(v) {
  if (typeof v !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}T/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v);
}

// La resta (controls, filtres, càlcul, gràfics) continua a sota

// ============================================================
// CONTROLS (mètriques multi, agrupar, filtres)
// ============================================================

function muntarControls() {
  metriquesSel = [];
  filtres = [];
  muntarMetriques();
  muntarAgrupar();
  renderFiltres();
}

// ---------- Mètriques (multi-selecció amb chips) ----------
function muntarMetriques() {
  const cont = document.getElementById('metriquesChips');
  cont.innerHTML = '';

  const opcions = construirOpcionsMetriques();

  opcions.forEach(op => {
    const chip = document.createElement('div');
    chip.className = 'chip-metrica';
    chip.dataset.id = op.id;
    chip.innerHTML = '<span class="chip-check">✓</span><span>' + op.nom + '</span>';
    chip.addEventListener('click', () => {
      const i = metriquesSel.indexOf(op.id);
      if (i === -1) { metriquesSel.push(op.id); chip.classList.add('sel'); }
      else { metriquesSel.splice(i, 1); chip.classList.remove('sel'); }
    });
    cont.appendChild(chip);
  });

  // Per defecte, seleccionem la primera mètrica
  const primer = cont.querySelector('.chip-metrica');
  if (primer) { primer.classList.add('sel'); metriquesSel.push(primer.dataset.id); }
}

// Construeix la llista de mètriques disponibles segons el tipus de full.
// - Sempre: Total (nombre de registres) i % sobre el total.
// - Gossos: recompte per cada valor de les columnes clau (Estat, Resposta):
//   Lligats, Deslligats, Acceptats, No acceptats, No avisats...
// - Itinerància: suma i mitjana de cada columna numèrica.
function construirOpcionsMetriques() {
  const opcions = [];
  opcions.push({ id: '__count__', nom: tipusActual === 'gossos' ? 'Total gossos' : 'Nombre de registres' });

  // Mètriques de recompte condicional (comptar registres amb cert valor)
  // Les generem per a columnes de text amb pocs valors únics (Estat, Resposta...)
  const colsCondicio = columnes.filter(c =>
    c.tipus === 'text' &&
    ['estat', 'resposta'].indexOf(c.nom.toLowerCase().trim()) !== -1
  );
  colsCondicio.forEach(col => {
    valorsUnics(col.index).forEach(val => {
      if (val === '' || val === '(buit)') return;
      opcions.push({
        id: 'cond:' + col.index + ':' + val,
        nom: val   // p. ex. "Deslligat", "Acceptat"
      });
    });
  });

  // Sumes i mitjanes de columnes numèriques (itinerància)
  columnes.filter(c => c.tipus === 'number').forEach(c => {
    opcions.push({ id: 'sum:' + c.index, nom: 'Suma de ' + c.nom });
    opcions.push({ id: 'avg:' + c.index, nom: 'Mitjana de ' + c.nom });
  });

  // % sobre el total sempre disponible
  opcions.push({ id: '__pct__', nom: '% sobre el total' });

  return opcions;
}

// ---------- Agrupar ----------
function muntarAgrupar() {
  const sel = document.getElementById('selAgrupar');
  sel.innerHTML = '';
  const noAgrupables = ['observacions'];
  columnes.filter(c => (c.tipus === 'text' || c.tipus === 'data') &&
                       noAgrupables.indexOf(c.nom.toLowerCase().trim()) === -1).forEach(c => {
    const o = document.createElement('option');
    o.value = String(c.index);
    o.textContent = c.nom;
    sel.appendChild(o);
    if (c.tipus === 'data') {
      ['dia', 'mes', 'any'].forEach(gran => {
        const od = document.createElement('option');
        od.value = c.index + ':' + gran;
        od.textContent = c.nom + ' (per ' + gran + ')';
        sel.appendChild(od);
      });
    }
  });
}

// ---------- Filtres ----------
function renderFiltres() {
  const cont = document.getElementById('filtresContenidor');
  cont.innerHTML = '';
  if (filtres.length === 0) {
    cont.innerHTML = '<p class="cap-filtre">Sense condicions: es mostren totes les dades.</p>';
    return;
  }
  filtres.forEach((filtre, i) => cont.appendChild(crearFilaFiltre(filtre, i)));
}

function crearFilaFiltre(filtre, i) {
  const fila = document.createElement('div');
  fila.className = 'filtre-fila';

  const controls = document.createElement('div');
  controls.className = 'filtre-fila-controls';

  // columna
  const selCol = document.createElement('select');
  selCol.className = 'filtre-select';
  columnes.forEach(c => {
    const o = document.createElement('option');
    o.value = c.index; o.textContent = c.nom;
    if (c.index === filtre.colIndex) o.selected = true;
    selCol.appendChild(o);
  });
  selCol.addEventListener('change', () => { filtre.colIndex = Number(selCol.value); filtre.valor = ''; renderFiltres(); });

  const col = columnes.find(c => c.index === filtre.colIndex);

  // operador
  const selOp = document.createElement('select');
  selOp.className = 'filtre-select';
  const operadors = (col && col.tipus === 'number')
    ? [['=', 'igual a'], ['>', 'major que'], ['<', 'menor que'], ['>=', 'major o igual'], ['<=', 'menor o igual']]
    : [['=', 'és'], ['conte', 'conté'], ['!=', 'no és']];
  operadors.forEach(([val, txt]) => {
    const o = document.createElement('option');
    o.value = val; o.textContent = txt;
    if (val === filtre.operador) o.selected = true;
    selOp.appendChild(o);
  });
  selOp.addEventListener('change', () => { filtre.operador = selOp.value; });

  // valor
  let inputValor;
  if (col && col.tipus === 'text') {
    inputValor = document.createElement('select');
    inputValor.className = 'filtre-select';
    const buit = document.createElement('option');
    buit.value = ''; buit.textContent = '— tria valor —';
    inputValor.appendChild(buit);
    valorsUnics(col.index).forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v || '(buit)';
      if (v === filtre.valor) o.selected = true;
      inputValor.appendChild(o);
    });
  } else {
    inputValor = document.createElement('input');
    inputValor.className = 'filtre-input';
    inputValor.type = (col && col.tipus === 'number') ? 'number' : 'text';
    inputValor.value = filtre.valor || '';
    inputValor.placeholder = 'valor';
  }
  inputValor.addEventListener('change', () => { filtre.valor = inputValor.value; });
  inputValor.addEventListener('input', () => { filtre.valor = inputValor.value; });

  controls.appendChild(selCol);
  controls.appendChild(selOp);
  controls.appendChild(inputValor);

  const btnX = document.createElement('button');
  btnX.className = 'filtre-x';
  btnX.textContent = '✕';
  btnX.addEventListener('click', () => { filtres.splice(i, 1); renderFiltres(); });

  fila.appendChild(controls);
  fila.appendChild(btnX);
  return fila;
}

function valorsUnics(colIndex) {
  const set = new Set();
  dades.files.forEach(f => {
    const v = f[colIndex];
    if (v !== null && v !== undefined) set.add(String(v));
  });
  return Array.from(set).sort();
}

document.getElementById('btnAfegirFiltre').addEventListener('click', () => {
  const colDefecte = columnes.find(c => c.tipus === 'text') || columnes[0];
  filtres.push({ colIndex: colDefecte.index, operador: '=', valor: '' });
  renderFiltres();
});

document.getElementById('btnGenerar').addEventListener('click', () => {
  generarInforme();
  if (window.innerWidth <= 860) tancarSidebarMobil();
});

document.getElementById('btnNetejarMetriques').addEventListener('click', () => {
  metriquesSel = [];
  document.querySelectorAll('#metriquesChips .chip-metrica').forEach(c => c.classList.remove('sel'));
});

// ============================================================
// GENERAR INFORME
// ============================================================

function generarInforme() {
  if (metriquesSel.length === 0) { toast('Tria almenys una mètrica.'); return; }

  const files = aplicarFiltres();
  if (files.length === 0) { toast('Cap registre compleix les condicions.'); return; }

  const agrupar = document.getElementById('selAgrupar').value;

  // Calculem cada mètrica seleccionada sobre els mateixos grups
  const series = metriquesSel.map(m => ({
    id: m,
    nom: nomMetrica(m),
    dades: agregar(files, m, agrupar, files.length)
  }));

  // Unifiquem les claus (categories) de totes les sèries, en ordre
  const claus = unificarClaus(series);

  renderitzarPissarra(files, series, claus, agrupar);
  if (window.innerWidth > 860) {
    document.getElementById('pissarraCos').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function unificarClaus(series) {
  const totes = [];
  const vist = {};
  series.forEach(s => s.dades.forEach(d => {
    if (!vist[d.clau]) { vist[d.clau] = true; totes.push(d.clau); }
  }));
  return totes;
}

// ---------- Filtres ----------
function aplicarFiltres() {
  if (filtres.length === 0) return dades.files.slice();
  return dades.files.filter(fila => filtres.every(f => {
    if (f.valor === '' || f.valor === null || f.valor === undefined) return true;
    const cel = fila[f.colIndex];
    const col = columnes.find(c => c.index === f.colIndex);
    if (col && col.tipus === 'number') {
      const a = aNumero(cel), b = aNumero(f.valor);
      if (isNaN(a)) return false;
      switch (f.operador) {
        case '=': return a === b; case '>': return a > b; case '<': return a < b;
        case '>=': return a >= b; case '<=': return a <= b;
      }
      return true;
    } else {
      const a = String(cel).toLowerCase(), b = String(f.valor).toLowerCase();
      switch (f.operador) {
        case '=': return a === b; case '!=': return a !== b; case 'conte': return a.indexOf(b) !== -1;
      }
      return true;
    }
  }));
}

// ---------- Agregació ----------
function agregar(files, metrica, agrupar, totalFiltrat) {
  let colAgrup, gran = null;
  if (String(agrupar).indexOf(':') !== -1) {
    const p = String(agrupar).split(':'); colAgrup = Number(p[0]); gran = p[1];
  } else colAgrup = Number(agrupar);

  const grups = {};
  files.forEach(fila => {
    let clau = fila[colAgrup];
    if (gran) clau = formatarData(clau, gran);
    else clau = (clau === '' || clau === null || clau === undefined) ? '(buit)' : String(clau);
    if (!grups[clau]) grups[clau] = { suma: 0, count: 0, comptats: 0 };
    grups[clau].count++;
    if (metrica === '__count__' || metrica === '__pct__') {
      grups[clau].suma += 1;
    } else if (metrica.indexOf('cond:') === 0) {
      // cond:colIndex:valor  -> compta les files on la columna val "valor"
      const p = metrica.split(':');
      const ci = Number(p[1]);
      const valorCond = p.slice(2).join(':'); // per si el valor conté ':'
      if (String(fila[ci]) === valorCond) grups[clau].suma += 1;
    } else {
      const p = metrica.split(':'); const ci = Number(p[1]);
      const v = aNumero(fila[ci]);
      if (!isNaN(v)) { grups[clau].suma += v; grups[clau].comptats++; }
    }
  });

  let entrades = Object.keys(grups).map(clau => {
    const g = grups[clau];
    let valor;
    if (metrica === '__count__') valor = g.suma;
    else if (metrica === '__pct__') valor = Math.round((g.suma / totalFiltrat) * 1000) / 10;
    else if (metrica.indexOf('avg:') === 0) valor = g.comptats > 0 ? g.suma / g.comptats : 0;
    else valor = g.suma;
    return { clau, valor: Math.round(valor * 100) / 100 };
  });

  if (gran || semblaData(entrades)) entrades.sort((a, b) => a.clau < b.clau ? -1 : (a.clau > b.clau ? 1 : 0));
  else entrades.sort((a, b) => b.valor - a.valor);
  return entrades;
}

function semblaData(entrades) {
  if (!entrades.length) return false;
  return entrades.slice(0, 5).every(e => /^\d{4}-\d{2}/.test(e.clau));
}
function formatarData(v, gran) {
  if (!v) return '(sense data)';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(v);
  if (gran === 'any') return m[1];
  if (gran === 'mes') return m[1] + '-' + m[2];
  return m[1] + '-' + m[2] + '-' + m[3];
}

// ============================================================
// RENDERITZAT A LA PISSARRA
// ============================================================

function renderitzarPissarra(files, series, claus, agrupar) {
  const cos = document.getElementById('pissarraCos');
  cos.innerHTML = '';

  // ---- KPIs (totals globals) ----
  const kpis = document.createElement('div');
  kpis.className = 'kpis';
  const targetes = calcularKPIs(files, series);
  targetes.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'kpi ' + (i % 3 === 1 ? 'verd' : (i % 3 === 2 ? 'blau' : ''));
    div.innerHTML = '<div class="kpi-num">' + t.valor + '</div><div class="kpi-lab">' + t.etiqueta + '</div>';
    kpis.appendChild(div);
  });
  cos.appendChild(kpis);

  // ---- Gràfic o taula ----
  if (vistaActual === 'taula') {
    cos.appendChild(crearTaula(series, claus, agrupar));
  } else {
    const card = document.createElement('div');
    card.className = 'card-grafic';
    card.innerHTML =
      '<div class="card-grafic-titol">' + series.map(s => s.nom).join(' · ') + '</div>' +
      '<div class="card-grafic-sub">per ' + nomAgrupar(agrupar) + ' · ' + files.length + ' registres</div>' +
      '<div class="grafic-caixa"><canvas id="grafic"></canvas></div>';
    cos.appendChild(card);
    crearGrafic(series, claus, agrupar);

    // A més del gràfic, sempre una taula sota per detall
    cos.appendChild(crearTaula(series, claus, agrupar));
  }
}

function calcularKPIs(files, series) {
  const t = [];
  t.push({ etiqueta: 'Registres filtrats', valor: formatarNum(files.length) });
  // Per cada mètrica de suma, el total
  series.forEach(s => {
    if (s.id === '__count__' || s.id === '__pct__') return;
    if (s.id.indexOf('sum:') === 0) {
      const ci = Number(s.id.split(':')[1]);
      let suma = 0;
      files.forEach(f => { const v = aNumero(f[ci]); if (!isNaN(v)) suma += v; });
      t.push({ etiqueta: 'Total ' + columnes.find(c => c.index === ci).nom, valor: formatarNum(Math.round(suma * 100) / 100) });
    } else if (s.id.indexOf('avg:') === 0) {
      const ci = Number(s.id.split(':')[1]);
      let suma = 0, n = 0;
      files.forEach(f => { const v = aNumero(f[ci]); if (!isNaN(v)) { suma += v; n++; } });
      t.push({ etiqueta: 'Mitjana ' + columnes.find(c => c.index === ci).nom, valor: n ? (Math.round((suma / n) * 100) / 100) : 0 });
    }
  });
  return t.slice(0, 4);
}

function formatarNum(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ---------- Gràfic (Chart.js) ----------
function crearGrafic(series, claus, agrupar) {
  const ctx = document.getElementById('grafic').getContext('2d');
  if (chartActual) { chartActual.destroy(); chartActual = null; }

  const paleta = ['#e2570a', '#2d5a3d', '#0097b2', '#c9a227', '#7a4eab', '#3fa34d', '#d1495b'];
  let tipus = 'bar';
  if (vistaActual === 'linia') tipus = 'line';
  if (vistaActual === 'pastis') tipus = 'pie';

  let datasets;
  if (vistaActual === 'pastis') {
    // El pastís només representa la primera mètrica
    const s = series[0];
    const valorsPerClau = clauMap(s);
    datasets = [{
      label: s.nom,
      data: claus.map(c => valorsPerClau[c] || 0),
      backgroundColor: claus.map((_, i) => paleta[i % paleta.length]),
      borderColor: '#fff', borderWidth: 2
    }];
  } else {
    datasets = series.map((s, i) => {
      const valorsPerClau = clauMap(s);
      const color = paleta[i % paleta.length];
      return {
        label: s.nom,
        data: claus.map(c => valorsPerClau[c] || 0),
        backgroundColor: vistaActual === 'linia' ? 'transparent' : color + 'cc',
        borderColor: color,
        borderWidth: vistaActual === 'linia' ? 3 : 1,
        borderRadius: vistaActual === 'barres' ? 6 : 0,
        tension: 0.3,
        pointBackgroundColor: color,
        pointRadius: vistaActual === 'linia' ? 4 : 0,
        fill: false
      };
    });
  }

  chartActual = new Chart(ctx, {
    type: tipus,
    data: { labels: claus, datasets: datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: series.length > 1 || vistaActual === 'pastis', labels: { font: { family: 'Inter', size: 12 }, color: '#16261d', padding: 14, usePointStyle: true } },
        tooltip: { backgroundColor: '#16261d', padding: 12, cornerRadius: 8, titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' } }
      },
      scales: vistaActual === 'pastis' ? {} : {
        x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: '#8a9a8f', maxRotation: 45, minRotation: 0 } },
        y: { beginAtZero: true, grid: { color: 'rgba(22,38,29,0.06)' }, ticks: { font: { family: 'Inter', size: 11 }, color: '#8a9a8f' } }
      }
    }
  });
}

function clauMap(serie) {
  const m = {};
  serie.dades.forEach(d => { m[d.clau] = d.valor; });
  return m;
}

// ---------- Taula ----------
function crearTaula(series, claus, agrupar) {
  const card = document.createElement('div');
  card.className = 'card-taula';
  let html = '<div class="taula-scroll"><table class="dades"><thead><tr><th>' + nomAgrupar(agrupar) + '</th>';
  series.forEach(s => { html += '<th style="text-align:right">' + escapar(s.nom) + '</th>'; });
  html += '</tr></thead><tbody>';
  const maps = series.map(s => clauMap(s));
  claus.forEach(clau => {
    html += '<tr><td>' + escapar(clau) + '</td>';
    maps.forEach((m, i) => {
      let v = m[clau] !== undefined ? m[clau] : 0;
      if (series[i].id === '__pct__') v = v + '%';
      html += '<td class="num">' + v + '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  card.innerHTML = html;
  return card;
}

// ---------- Noms ----------
function nomMetrica(m) {
  if (m === '__count__') return tipusActual === 'gossos' ? 'Total gossos' : 'Nombre de registres';
  if (m === '__pct__') return '% sobre el total';
  if (m.indexOf('cond:') === 0) {
    const p = m.split(':');
    return p.slice(2).join(':');   // el valor (p.ex. "Deslligat")
  }
  const parts = m.split(':');
  const col = columnes.find(c => c.index === Number(parts[1]));
  return (parts[0] === 'avg' ? 'Mitjana de ' : 'Suma de ') + (col ? col.nom : '');
}
function nomAgrupar(agrupar) {
  if (String(agrupar).indexOf(':') !== -1) {
    const parts = String(agrupar).split(':');
    const col = columnes.find(c => c.index === Number(parts[0]));
    return (col ? col.nom : '') + ' (per ' + parts[1] + ')';
  }
  const col = columnes.find(c => c.index === Number(agrupar));
  return col ? col.nom : '';
}
function escapar(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ============================================================
// RÈCORDS I RECOMPTE TOTAL (popups)
// ============================================================

// Defineix les "mètriques d'ítem" segons el tipus de dades.
// Cada mètrica té: nom i una funció que, donada una fila, retorna
// quant suma aquella fila a la mètrica (1/0 per comptar, o el valor numèric).
function metriquesItem() {
  const items = [];

  if (tipusActual === 'gossos') {
    items.push({ nom: 'Total gossos', fn: () => 1 });
    const colEstat = columnes.find(c => c.nom.toLowerCase().trim() === 'estat');
    const colResp = columnes.find(c => c.nom.toLowerCase().trim() === 'resposta');
    if (colEstat) {
      items.push({ nom: 'Lligats', fn: f => String(f[colEstat.index]) === 'Lligat' ? 1 : 0 });
      items.push({ nom: 'Deslligats', fn: f => String(f[colEstat.index]) === 'Deslligat' ? 1 : 0 });
    }
    if (colResp) {
      items.push({ nom: 'Acceptats', fn: f => String(f[colResp.index]) === 'Acceptat' ? 1 : 0 });
      items.push({ nom: 'No acceptats', fn: f => String(f[colResp.index]) === 'No acceptat' ? 1 : 0 });
      items.push({ nom: 'No avisats', fn: f => String(f[colResp.index]) === 'No avisat' ? 1 : 0 });
    }
  } else {
    // Itinerància: totes les columnes numèriques
    columnes.filter(c => c.tipus === 'number').forEach(c => {
      items.push({ nom: c.nom, fn: f => { const v = aNumero(f[c.index]); return isNaN(v) ? 0 : v; } });
    });
  }
  return items;
}

// Troba la columna de data i la de zona/àrea per als rècords
function colData() {
  return columnes.find(c => c.nom.toLowerCase().trim() === 'data') ||
         columnes.find(c => c.nom.toLowerCase().trim() === 'data i hora');
}
function colZona() {
  return columnes.find(c => c.nom.toLowerCase().trim() === 'zona') ||
         columnes.find(c => c.nom.toLowerCase().trim() === 'àrea') ||
         columnes.find(c => c.nom.toLowerCase().trim() === 'area');
}

// ---------- RECOMPTE TOTAL ----------
function obrirRecompte() {
  const items = metriquesItem();
  const cos = document.getElementById('modalCos');

  if (!dades || dades.files.length === 0) {
    cos.innerHTML = '<p class="modal-buit">Encara no hi ha dades registrades.</p>';
  } else {
    let html = '<div class="recompte-grid">';
    items.forEach(it => {
      let total = 0;
      dades.files.forEach(f => { total += it.fn(f); });
      total = Math.round(total * 100) / 100;
      html += '<div class="recompte-item"><div class="recompte-num">' + formatarNum(total) +
              '</div><div class="recompte-lab">' + escapar(it.nom) + '</div></div>';
    });
    html += '</div>';
    cos.innerHTML = html;
  }

  document.getElementById('modalTitol').textContent =
    'Recompte total · ' + NOMS_ENTITAT[entitatActual] + ' ' + NOMS_TIPUS[tipusActual];
  obrirModal();
}

// ---------- RÈCORDS ----------
// Per a cada mètrica i cada període (Dia, Setmana, Mes), troba el valor
// màxim assolit i quan/on va passar.
function obrirRecords() {
  const cos = document.getElementById('modalCos');
  const cData = colData();
  const cZona = colZona();

  if (!dades || dades.files.length === 0) {
    cos.innerHTML = '<p class="modal-buit">Encara no hi ha dades registrades.</p>';
  } else if (!cData) {
    cos.innerHTML = '<p class="modal-buit">No es poden calcular rècords sense una columna de data.</p>';
  } else {
    const items = metriquesItem();
    const periodes = [
      { nom: 'Dia', clau: f => diaDe(f[cData.index]) },
      { nom: 'Setmana', clau: f => setmanaDe(f[cData.index]) },
      { nom: 'Mes', clau: f => mesDe(f[cData.index]) }
    ];

    let html = '';
    periodes.forEach(per => {
      html += '<div class="records-seccio">Per ' + per.nom.toLowerCase() + '</div>';
      html += '<table class="taula-records"><thead><tr><th>Mètrica</th><th>Rècord</th><th>Quan</th>';
      if (cZona) html += '<th>On</th>';
      html += '</tr></thead><tbody>';

      items.forEach(it => {
        const rec = recordDe(dades.files, per.clau, it.fn, cZona);
        html += '<tr><td class="metrica">' + escapar(it.nom) + '</td>' +
                '<td class="valor">' + formatarNum(rec.valor) + '</td>' +
                '<td class="quan">' + escapar(rec.quan) + '</td>';
        if (cZona) html += '<td class="quan">' + escapar(rec.on || '—') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
    });
    cos.innerHTML = html;
  }

  document.getElementById('modalTitol').textContent =
    'Rècords · ' + NOMS_ENTITAT[entitatActual] + ' ' + NOMS_TIPUS[tipusActual];
  obrirModal();
}

// Calcula el rècord (valor màxim) d'una mètrica agrupant per període
function recordDe(files, fnClau, fnValor, cZona) {
  const acc = {}; // clauPeriode -> { valor, zones: {zona: valor} }
  files.forEach(f => {
    const clau = fnClau(f);
    if (!clau) return;
    if (!acc[clau]) acc[clau] = { valor: 0, zones: {} };
    const v = fnValor(f);
    acc[clau].valor += v;
    if (cZona) {
      const z = String(f[cZona.index] || '—');
      acc[clau].zones[z] = (acc[clau].zones[z] || 0) + v;
    }
  });

  let millor = { valor: -Infinity, quan: '—', on: '—' };
  Object.keys(acc).forEach(clau => {
    if (acc[clau].valor > millor.valor) {
      millor.valor = acc[clau].valor;
      millor.quan = clau;
      // zona amb més valor en aquell període
      if (cZona) {
        let zMillor = '—', zVal = -Infinity;
        Object.keys(acc[clau].zones).forEach(z => {
          if (acc[clau].zones[z] > zVal) { zVal = acc[clau].zones[z]; zMillor = z; }
        });
        millor.on = zMillor;
      }
    }
  });
  if (millor.valor === -Infinity) millor.valor = 0;
  millor.valor = Math.round(millor.valor * 100) / 100;
  return millor;
}

// ---------- Formatació de períodes ----------
function diaDe(v) {
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return m[3] + '/' + m[2] + '/' + m[1];
}
function mesDe(v) {
  const m = String(v).match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const mesos = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
  return mesos[Number(m[2]) - 1] + ' ' + m[1];
}
function setmanaDe(v) {
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  // número de setmana ISO
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dia = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dia);
  const inici = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const setmana = Math.ceil((((dt - inici) / 86400000) + 1) / 7);
  return 'Setmana ' + setmana + ' · ' + dt.getUTCFullYear();
}

// ---------- Control del modal ----------
function obrirModal() { document.getElementById('modalFons').classList.add('obert'); }
function tancarModal() { document.getElementById('modalFons').classList.remove('obert'); }

document.getElementById('btnRecords').addEventListener('click', obrirRecords);
document.getElementById('btnRecompte').addEventListener('click', obrirRecompte);
document.getElementById('modalTancar').addEventListener('click', tancarModal);
document.getElementById('modalFons').addEventListener('click', (e) => {
  if (e.target.id === 'modalFons') tancarModal();
});

// ---------- Inicialització ----------
dibuixarCorbes();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(() => {});
}
