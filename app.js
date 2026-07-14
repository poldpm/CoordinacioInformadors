// ============================================================
// PANELL DE CONTROL — Lògica principal
// ============================================================

// ---------- Estat global ----------
let entitatActual = null;   // 'ceinr' | 'pn'
let tipusActual = null;     // 'gossos' | 'itinerancia'
let dades = null;           // { capçaleres: [], files: [[...]] }
let columnes = [];          // metadades de columnes: { nom, index, tipus }
let vistaActual = 'barres';
let filtres = [];           // [{ colIndex, operador, valor }]
let chartActual = null;

// ---------- Elements ----------
const screens = {
  entitat: document.getElementById('screen-entitat'),
  tipus: document.getElementById('screen-tipus'),
  panell: document.getElementById('screen-panell')
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  window.scrollTo(0, 0);

  // Botó enrere visible excepte a la primera pantalla
  document.getElementById('btnEnrere').style.visibility =
    (name === 'entitat') ? 'hidden' : 'visible';

  // Títol de la capçalera
  const titol = document.getElementById('titolCap');
  if (name === 'entitat') titol.textContent = 'Panell de control';
  else if (name === 'tipus') titol.textContent = NOMS_ENTITAT[entitatActual];
  else titol.textContent = NOMS_ENTITAT[entitatActual] + ' · ' + NOMS_TIPUS[tipusActual];
}

let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ---------- Navegació ----------
document.querySelectorAll('[data-entitat]').forEach(btn => {
  btn.addEventListener('click', () => {
    entitatActual = btn.dataset.entitat;
    dades = null;        // descartem dades anteriors
    columnes = [];
    document.getElementById('tipusSubtitol').textContent =
      NOMS_ENTITAT[entitatActual] + ' — què vols veure?';
    showScreen('tipus');
  });
});

document.querySelectorAll('[data-tipus]').forEach(btn => {
  btn.addEventListener('click', () => {
    tipusActual = btn.dataset.tipus;
    dades = null;        // <-- IMPORTANT: descartem dades anteriors
    columnes = [];       //     perquè carregui SEMPRE el full correcte
    obrirPanell(true);
  });
});

document.getElementById('btnEnrere').addEventListener('click', () => {
  const actual = document.querySelector('.screen.active').id;
  if (actual === 'screen-tipus') showScreen('entitat');
  else if (actual === 'screen-panell') showScreen('tipus');
});

document.getElementById('btnRecarregar').addEventListener('click', () => {
  if (tipusActual) { dades = null; obrirPanell(true); }
});

// ---------- Càrrega de dades (JSONP) ----------
function carregarDades(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const cbName = 'cb_dash_' + Math.random().toString(36).slice(2, 9);
    let fet = false;

    const netejar = () => {
      if (script && script.parentNode) script.parentNode.removeChild(script);
      try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
      if (timer) clearTimeout(timer);
    };

    window[cbName] = (resp) => {
      if (fet) return;
      fet = true; netejar();
      resolve(resp);
    };

    const sep = url.indexOf('?') === -1 ? '?' : '&';
    const script = document.createElement('script');
    script.src = url + sep + 'llegir=1&callback=' + cbName;
    script.onerror = () => {
      if (fet) return;
      fet = true; netejar();
      reject(new Error('No s\'ha pogut connectar amb el full de càlcul.'));
    };
    const timer = setTimeout(() => {
      if (fet) return;
      fet = true; netejar();
      reject(new Error('El full de càlcul ha trigat massa a respondre.'));
    }, timeoutMs || 20000);

    document.body.appendChild(script);
  });
}

async function obrirPanell(forcar) {
  showScreen('panell');
  document.getElementById('estatCarrega').style.display = '';
  document.getElementById('panellContingut').style.display = 'none';
  document.getElementById('resultats').style.display = 'none';

  const url = FONTS[entitatActual] && FONTS[entitatActual][tipusActual];
  if (!url || url.indexOf('ENGANXA') === 0) {
    document.getElementById('estatCarrega').innerHTML =
      '<p class="error">⚠️ Falta configurar la URL d\'aquest full a config.js.</p>';
    return;
  }

  if (dades && !forcar) {
    mostrarPanell();
    return;
  }

  try {
    const resp = await carregarDades(url);
    if (!resp || !resp.ok) {
      throw new Error(resp && resp.error ? resp.error : 'Resposta no vàlida');
    }
    dades = resp;
    prepararColumnes();
    mostrarPanell();
  } catch (e) {
    document.getElementById('estatCarrega').innerHTML =
      '<p class="error">⚠️ ' + e.message + '</p>' +
      '<button class="btn-veure" onclick="obrirPanell(true)">Tornar a provar</button>';
  }
}

// ---------- Anàlisi de columnes ----------
function prepararColumnes() {
  columnes = dades.capçaleres.map((nom, index) => {
    return { nom: nom, index: index, tipus: detectarTipus(nom, index) };
  });
}

// Columnes que són dates (per nom)
function esColumnaData(nom) {
  const n = nom.toLowerCase().trim();
  return n === 'data i hora' || n === 'data' || n === 'mes';
}

// Detecta el tipus d'una columna combinant el NOM i el CONTINGUT.
// Prioritat: primer el nom (fiable amb la vostra estructura), després
// el contingut. Això evita que columnes numèriques amb molts buits es
// classifiquin malament, i que identificadors (ID, Núm) es sumin.
function detectarTipus(nom, index) {
  const n = nom.toLowerCase().trim();

  // 1) Dates conegudes pel nom
  if (esColumnaData(nom)) return 'data';

  // 2) Columnes de text/identificador o d'agrupació (mai mètrica numèrica),
  //    encara que continguin xifres.
  const textFixes = ['id', 'núm', 'num', 'número', 'numero', 'setmana',
    'zona', 'àrea', 'area', 'punt', 'tipus', 'estat', 'resposta', 'observacions'];
  if (textFixes.indexOf(n) !== -1) return 'text';

  // 3) Per la resta, mirem el contingut.
  let nNum = 0, nData = 0, nTotal = 0;
  for (let i = 0; i < dades.files.length; i++) {
    let v = dades.files[i][index];
    if (v === '' || v === null || v === undefined) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    nTotal++;
    if (esData(v)) nData++;
    else if (esNumero(v)) nNum++;
  }

  if (nTotal === 0) {
    // Full buit o columna sense dades: deduïm pel nom.
    return semblaRecompte(nom) ? 'number' : 'text';
  }
  if (nData === nTotal) return 'data';
  // Si TOTS els valors no buits són números -> numèrica (robust amb buits)
  if (nNum === nTotal) return 'number';
  if (nNum / nTotal >= 0.8) return 'number';
  if (nData / nTotal >= 0.8) return 'data';
  return 'text';
}

// Heurística: noms de columna que indiquen un recompte (per a fulls buits)
function semblaRecompte(nom) {
  const n = nom.toLowerCase();
  const paraules = ['vehicles', 'tendes', 'autocaravana', 'càmping', 'camping',
    'deixalles', 'escaladors', 'bicicletes', 'persones', 'nombre', 'quantitat',
    'total', 'impedeixen', 'pernocta'];
  return paraules.some(p => n.indexOf(p) !== -1);
}

// Comprova si un valor és un número (accepta coma o punt decimal)
function esNumero(v) {
  if (typeof v === 'number') return true;
  if (typeof v !== 'string') return false;
  let s = v.trim();
  if (s === '') return false;
  // acceptem coma decimal catalana: "3,5" -> "3.5"
  s = s.replace(',', '.');
  return !isNaN(Number(s)) && isFinite(Number(s));
}

// Converteix un valor a número de manera robusta (coma o punt)
function aNumero(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  let s = v.trim().replace(',', '.');
  if (s === '') return NaN;
  return Number(s);
}

function esData(v) {
  if (typeof v !== 'string') return false;
  // format ISO tipus 2026-06-10T...
  return /^\d{4}-\d{2}-\d{2}T/.test(v) || /^\d{4}-\d{2}-\d{2}$/.test(v);
}

// La resta de la lògica (filtres, agrupació, gràfics) és a app2.js

// ============================================================
// CONSTRUCCIÓ DEL PANELL
// ============================================================

function mostrarPanell() {
  document.getElementById('estatCarrega').style.display = 'none';
  document.getElementById('panellContingut').style.display = '';

  document.getElementById('fontDades').textContent =
    '📄 ' + NOMS_ENTITAT[entitatActual] + ' · ' + NOMS_TIPUS[tipusActual];
  document.getElementById('totalRegistres').textContent =
    dades.files.length + ' registres en total';

  // reiniciem filtres i selectors
  filtres = [];
  renderFiltres();
  omplirSelectors();
}

// ---------- Selectors de mètrica i agrupació ----------
function omplirSelectors() {
  const selMetrica = document.getElementById('selMetrica');
  const selAgrupar = document.getElementById('selAgrupar');
  selMetrica.innerHTML = '';
  selAgrupar.innerHTML = '';

  // Mètrica: "Nombre de registres" + totes les columnes numèriques (suma)
  const optCompta = document.createElement('option');
  optCompta.value = '__count__';
  optCompta.textContent = 'Nombre de registres';
  selMetrica.appendChild(optCompta);

  columnes.filter(c => c.tipus === 'number').forEach(c => {
    const o = document.createElement('option');
    o.value = 'sum:' + c.index;
    o.textContent = 'Suma de ' + c.nom;
    selMetrica.appendChild(o);
    const o2 = document.createElement('option');
    o2.value = 'avg:' + c.index;
    o2.textContent = 'Mitjana de ' + c.nom;
    selMetrica.appendChild(o2);
  });

  // Agrupar per: columnes de text o de data (les que tenen sentit per agrupar).
  // N'excloem "Observacions" perquè és text lliure i no té sentit agrupar-hi.
  const noAgrupables = ['observacions'];
  columnes.filter(c => (c.tipus === 'text' || c.tipus === 'data') &&
                       noAgrupables.indexOf(c.nom.toLowerCase().trim()) === -1).forEach(c => {
    const o = document.createElement('option');
    o.value = String(c.index);
    o.textContent = c.nom;
    selAgrupar.appendChild(o);
    // si és data, afegim opcions per agrupar per dia/mes/any
    if (c.tipus === 'data') {
      ['dia', 'mes', 'any'].forEach(gran => {
        const od = document.createElement('option');
        od.value = c.index + ':' + gran;
        od.textContent = c.nom + ' (per ' + gran + ')';
        selAgrupar.appendChild(od);
      });
    }
  });
}

// ---------- Filtres dinàmics ----------
function renderFiltres() {
  const cont = document.getElementById('filtresContenidor');
  cont.innerHTML = '';
  if (filtres.length === 0) {
    cont.innerHTML = '<p class="cap-filtre">Sense condicions: es mostren totes les dades. Afegeix condicions per acotar.</p>';
    return;
  }
  filtres.forEach((filtre, i) => {
    cont.appendChild(crearFilaFiltre(filtre, i));
  });
}

function crearFilaFiltre(filtre, i) {
  const fila = document.createElement('div');
  fila.className = 'filtre-fila';

  // selector de columna
  const selCol = document.createElement('select');
  selCol.className = 'filtre-select';
  columnes.forEach(c => {
    const o = document.createElement('option');
    o.value = c.index; o.textContent = c.nom;
    if (c.index === filtre.colIndex) o.selected = true;
    selCol.appendChild(o);
  });
  selCol.addEventListener('change', () => {
    filtre.colIndex = Number(selCol.value);
    filtre.valor = '';
    renderFiltres();
  });

  // selector d'operador (depèn del tipus de columna)
  const col = columnes.find(c => c.index === filtre.colIndex);
  const selOp = document.createElement('select');
  selOp.className = 'filtre-select filtre-op';
  const operadors = (col && col.tipus === 'number')
    ? [['=', '='], ['>', '>'], ['<', '<'], ['>=', '≥'], ['<=', '≤']]
    : [['=', 'és'], ['conte', 'conté'], ['!=', 'no és']];
  operadors.forEach(([val, txt]) => {
    const o = document.createElement('option');
    o.value = val; o.textContent = txt;
    if (val === filtre.operador) o.selected = true;
    selOp.appendChild(o);
  });
  selOp.addEventListener('change', () => { filtre.operador = selOp.value; });

  // camp de valor: si la columna és de text, oferim els valors existents
  let inputValor;
  if (col && col.tipus === 'text') {
    inputValor = document.createElement('select');
    inputValor.className = 'filtre-select filtre-valor';
    const buit = document.createElement('option');
    buit.value = ''; buit.textContent = '— tria —';
    inputValor.appendChild(buit);
    valorsUnics(col.index).forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      if (v === filtre.valor) o.selected = true;
      inputValor.appendChild(o);
    });
  } else {
    inputValor = document.createElement('input');
    inputValor.className = 'filtre-input filtre-valor';
    inputValor.type = (col && col.tipus === 'number') ? 'number' : 'text';
    inputValor.value = filtre.valor || '';
    inputValor.placeholder = 'valor';
  }
  inputValor.addEventListener('change', () => { filtre.valor = inputValor.value; });
  inputValor.addEventListener('input', () => { filtre.valor = inputValor.value; });

  // botó eliminar
  const btnX = document.createElement('button');
  btnX.className = 'filtre-x';
  btnX.textContent = '✕';
  btnX.addEventListener('click', () => {
    filtres.splice(i, 1);
    renderFiltres();
  });

  fila.appendChild(selCol);
  fila.appendChild(selOp);
  fila.appendChild(inputValor);
  fila.appendChild(btnX);
  return fila;
}

function valorsUnics(colIndex) {
  const set = new Set();
  dades.files.forEach(f => {
    const v = f[colIndex];
    if (v !== '' && v !== null && v !== undefined) set.add(String(v));
  });
  return Array.from(set).sort();
}

document.getElementById('btnAfegirFiltre').addEventListener('click', () => {
  // primera columna de text per defecte, si n'hi ha
  const colDefecte = columnes.find(c => c.tipus === 'text') || columnes[0];
  filtres.push({
    colIndex: colDefecte.index,
    operador: colDefecte.tipus === 'number' ? '=' : '=',
    valor: ''
  });
  renderFiltres();
});

document.getElementById('btnNetejarFiltres').addEventListener('click', () => {
  filtres = [];
  renderFiltres();
});

// ---------- Selecció de vista ----------
document.querySelectorAll('.vista-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.vista-btn').forEach(b => b.classList.remove('actiu'));
    btn.classList.add('actiu');
    vistaActual = btn.dataset.vista;
  });
});

document.getElementById('btnVeureDades').addEventListener('click', veureDades);

// ============================================================
// CÀLCUL I VISUALITZACIÓ
// ============================================================

function veureDades() {
  const filesFiltrades = aplicarFiltres();

  if (filesFiltrades.length === 0) {
    toast('Cap registre compleix aquestes condicions.');
    document.getElementById('resultats').style.display = 'none';
    return;
  }

  const metrica = document.getElementById('selMetrica').value;
  const agrupar = document.getElementById('selAgrupar').value;

  const resultat = agregar(filesFiltrades, metrica, agrupar);

  document.getElementById('resultats').style.display = '';
  mostrarTotals(filesFiltrades, metrica, resultat);

  if (vistaActual === 'taula') {
    document.getElementById('graficWrap').style.display = 'none';
    mostrarTaula(resultat, agrupar, metrica);
  } else {
    document.getElementById('graficWrap').style.display = '';
    document.getElementById('taulaWrap').innerHTML = '';
    mostrarGrafic(resultat, agrupar, metrica);
  }

  document.getElementById('resultats').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Aplicar filtres ----------
function aplicarFiltres() {
  if (filtres.length === 0) return dades.files.slice();
  return dades.files.filter(fila => {
    return filtres.every(f => {
      if (f.valor === '' || f.valor === null || f.valor === undefined) return true;
      const cel = fila[f.colIndex];
      const col = columnes.find(c => c.index === f.colIndex);
      if (col && col.tipus === 'number') {
        const a = aNumero(cel), b = aNumero(f.valor);
        if (isNaN(a)) return false;
        switch (f.operador) {
          case '=': return a === b;
          case '>': return a > b;
          case '<': return a < b;
          case '>=': return a >= b;
          case '<=': return a <= b;
        }
        return true;
      } else {
        const a = String(cel).toLowerCase();
        const b = String(f.valor).toLowerCase();
        switch (f.operador) {
          case '=': return a === b;
          case '!=': return a !== b;
          case 'conte': return a.indexOf(b) !== -1;
        }
        return true;
      }
    });
  });
}

// ---------- Agregació ----------
function agregar(files, metrica, agrupar) {
  // determinar com s'agrupa
  let colAgrup, granularitat = null;
  if (agrupar.indexOf(':') !== -1) {
    const parts = agrupar.split(':');
    colAgrup = Number(parts[0]);
    granularitat = parts[1];
  } else {
    colAgrup = Number(agrupar);
  }

  const grups = {}; // clau -> { suma, count }

  files.forEach(fila => {
    let clau = fila[colAgrup];
    if (granularitat) clau = formatarData(clau, granularitat);
    else clau = (clau === '' || clau === null || clau === undefined) ? '(buit)' : String(clau);

    if (!grups[clau]) grups[clau] = { suma: 0, count: 0, comptats: 0 };
    grups[clau].count++;

    if (metrica === '__count__') {
      grups[clau].suma += 1;
    } else {
      const parts = metrica.split(':');
      const tipus = parts[0];        // 'sum' o 'avg'
      const colIndex = Number(parts[1]);
      const v = aNumero(fila[colIndex]);
      if (!isNaN(v) && fila[colIndex] !== '' && fila[colIndex] !== null) {
        grups[clau].suma += v;
        grups[clau].comptats++;
      }
    }
  });

  // convertir a array ordenat
  let entrades = Object.keys(grups).map(clau => {
    const g = grups[clau];
    let valor;
    if (metrica === '__count__') valor = g.suma;
    else if (metrica.indexOf('avg:') === 0) valor = g.comptats > 0 ? g.suma / g.comptats : 0;
    else valor = g.suma;
    return { clau: clau, valor: Math.round(valor * 100) / 100 };
  });

  // ordenar: si les claus semblen dates/mesos, per ordre natural; si no, per valor desc
  if (granularitat || semblaData(entrades)) {
    entrades.sort((a, b) => a.clau < b.clau ? -1 : (a.clau > b.clau ? 1 : 0));
  } else {
    entrades.sort((a, b) => b.valor - a.valor);
  }

  return entrades;
}

function semblaData(entrades) {
  if (!entrades.length) return false;
  return entrades.slice(0, 5).every(e => /^\d{4}-\d{2}/.test(e.clau));
}

function formatarData(v, granularitat) {
  if (!v) return '(sense data)';
  const s = String(v);
  // esperem ISO: 2026-06-10T...
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  const any = m[1], mes = m[2], dia = m[3];
  if (granularitat === 'any') return any;
  if (granularitat === 'mes') return any + '-' + mes;
  return any + '-' + mes + '-' + dia;
}

// ---------- Totals ----------
function mostrarTotals(files, metrica, resultat) {
  const cont = document.getElementById('resultatsTotals');
  cont.innerHTML = '';

  const targetes = [];
  targetes.push({ etiqueta: 'Registres (filtrats)', valor: files.length });

  if (metrica === '__count__') {
    targetes.push({ etiqueta: 'Grups', valor: resultat.length });
  } else {
    const parts = metrica.split(':');
    const colIndex = Number(parts[1]);
    const col = columnes.find(c => c.index === colIndex);
    let suma = 0, comptats = 0;
    files.forEach(f => {
      const v = aNumero(f[colIndex]);
      if (!isNaN(v) && f[colIndex] !== '' && f[colIndex] !== null) { suma += v; comptats++; }
    });
    targetes.push({ etiqueta: 'Total ' + (col ? col.nom : ''), valor: Math.round(suma * 100) / 100 });
    if (comptats > 0) {
      targetes.push({ etiqueta: 'Mitjana ' + (col ? col.nom : ''), valor: Math.round((suma / comptats) * 100) / 100 });
    }
  }

  targetes.forEach(t => {
    const div = document.createElement('div');
    div.className = 'total-card';
    div.innerHTML = '<span class="total-num">' + t.valor + '</span><span class="total-lab">' + t.etiqueta + '</span>';
    cont.appendChild(div);
  });
}

// ---------- Gràfic ----------
function mostrarGrafic(resultat, agrupar, metrica) {
  const ctx = document.getElementById('grafic').getContext('2d');
  if (chartActual) { chartActual.destroy(); chartActual = null; }

  const etiquetes = resultat.map(r => r.clau);
  const valors = resultat.map(r => r.valor);

  const colorBase = entitatActual === 'pn' ? '46, 125, 50' : '0, 151, 178';

  let tipusChart = 'bar';
  if (vistaActual === 'linia') tipusChart = 'line';
  if (vistaActual === 'pastis') tipusChart = 'pie';

  const colors = vistaActual === 'pastis'
    ? etiquetes.map((_, i) => `hsl(${(i * 47) % 360}, 60%, 55%)`)
    : `rgba(${colorBase}, 0.75)`;

  chartActual = new Chart(ctx, {
    type: tipusChart,
    data: {
      labels: etiquetes,
      datasets: [{
        label: nomMetrica(metrica),
        data: valors,
        backgroundColor: colors,
        borderColor: vistaActual === 'linia' ? `rgba(${colorBase}, 1)` : colors,
        borderWidth: vistaActual === 'linia' ? 3 : 1,
        fill: vistaActual === 'linia' ? false : true,
        tension: 0.25
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: vistaActual === 'pastis' },
        title: { display: true, text: nomMetrica(metrica) + ' per ' + nomAgrupar(agrupar) }
      },
      scales: vistaActual === 'pastis' ? {} : {
        y: { beginAtZero: true }
      }
    }
  });
}

// ---------- Taula ----------
function mostrarTaula(resultat, agrupar, metrica) {
  const cont = document.getElementById('taulaWrap');
  let html = '<table class="taula-dades"><thead><tr>';
  html += '<th>' + nomAgrupar(agrupar) + '</th><th>' + nomMetrica(metrica) + '</th></tr></thead><tbody>';
  resultat.forEach(r => {
    html += '<tr><td>' + escapar(r.clau) + '</td><td class="num">' + r.valor + '</td></tr>';
  });
  html += '</tbody></table>';
  cont.innerHTML = html;
}

// ---------- Utilitats de noms ----------
function nomMetrica(metrica) {
  if (metrica === '__count__') return 'Nombre de registres';
  const parts = metrica.split(':');
  const col = columnes.find(c => c.index === Number(parts[1]));
  const nom = col ? col.nom : '';
  return (parts[0] === 'avg' ? 'Mitjana de ' : 'Suma de ') + nom;
}

function nomAgrupar(agrupar) {
  if (agrupar.indexOf(':') !== -1) {
    const parts = agrupar.split(':');
    const col = columnes.find(c => c.index === Number(parts[0]));
    return (col ? col.nom : '') + ' (per ' + parts[1] + ')';
  }
  const col = columnes.find(c => c.index === Number(agrupar));
  return col ? col.nom : '';
}

function escapar(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---------- Inicialització ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(() => {});
}
showScreen('entitat');
