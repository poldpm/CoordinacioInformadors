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
let filtrePunts = null;   // sub-filtre de punts (itineràncies)
let agruparSel = null;   // com es reparteixen les dades (índex de columna o 'idx:granularitat')
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
    '<p>Tria a l\'esquerra què vols veure i com repartir-ho, i prem <strong>Veure el gràfic</strong>. També tens els botons de <strong>Rècords</strong> i <strong>Recompte total</strong> aquí a dalt.</p></div>';
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
  filtres = [];          // ara guardem { colIndex, valors: [] } per filtres ràpids
  agruparSel = null;
  muntarMetriques();
  muntarAgrupar();
  muntarFiltresRapids();
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

// Mètriques disponibles, en llenguatge planer.
function construirOpcionsMetriques() {
  const opcions = [];

  // A gossos, "Total gossos" té sentit (cada registre és un gos).
  // A itineràncies NO té sentit "nombre de registres": les mètriques són
  // els recomptes de cada columna (vehicles, persones...).
  if (tipusActual === 'gossos') {
    opcions.push({ id: '__count__', nom: 'Total de gossos' });
  }

  // Gossos: recompte per valor d'Estat i Resposta (Lligats, Deslligats, Acceptats...)
  const colsCondicio = columnes.filter(c =>
    c.tipus === 'text' && ['estat', 'resposta'].indexOf(c.nom.toLowerCase().trim()) !== -1
  );
  colsCondicio.forEach(col => {
    valorsUnics(col.index).forEach(val => {
      if (val === '' || val === '(buit)') return;
      opcions.push({ id: 'cond:' + col.index + ':' + val, nom: pluralMetrica(val) });
    });
  });

  // Itinerància: total de cada columna numèrica.
  columnes.filter(c => c.tipus === 'number').forEach(c => {
    opcions.push({ id: 'sum:' + c.index, nom: c.nom });
  });

  return opcions;
}

// "Deslligat" -> "Deslligats", etc. (petit toc perquè soni a recompte)
function pluralMetrica(val) {
  const mapa = {
    'Lligat': 'Lligats', 'Deslligat': 'Deslligats',
    'Acceptat': 'Acceptats', 'No acceptat': 'No acceptats', 'No avisat': 'No avisats'
  };
  return mapa[val] || val;
}

// ---------- Repartit per (agrupar, amb botons clars) ----------
function muntarAgrupar() {
  const cont = document.getElementById('agrupaGrid');
  cont.innerHTML = '';

  const opcions = construirOpcionsAgrupar();

  opcions.forEach((op, i) => {
    const btn = document.createElement('button');
    btn.className = 'agrupa-op';
    btn.dataset.valor = op.valor;
    btn.textContent = op.nom;
    btn.addEventListener('click', () => {
      cont.querySelectorAll('.agrupa-op').forEach(b => b.classList.remove('actiu'));
      btn.classList.add('actiu');
      agruparSel = op.valor;
    });
    cont.appendChild(btn);
    if (i === 0) { btn.classList.add('actiu'); agruparSel = op.valor; }
  });
}

// Opcions d'agrupament: NOMÉS temps (mes/setmana/dia). La zona, àrea i tipus
// es trien als filtres ("Mostrar només"), no aquí, per no duplicar.
function construirOpcionsAgrupar() {
  const ops = [];
  const cData = colData();
  if (cData) {
    ops.push({ nom: 'Per mes', valor: cData.index + ':mes' });
    ops.push({ nom: 'Per setmana', valor: cData.index + ':setmana' });
    ops.push({ nom: 'Per dia', valor: cData.index + ':dia' });
  }
  return ops;
}

// ---------- Filtres ràpids (caselles per mostrar només certs valors) ----------
// filtres = [{ colIndex, nom, valorsSel: Set }]
function muntarFiltresRapids() {
  const cont = document.getElementById('filtresRapids');
  cont.innerHTML = '';
  filtres = [];
  filtrePunts = null;   // sub-filtre de punts (es crea si escau)

  // Columnes que ja són mètrica (per no duplicar) o que no tenen sentit filtrar.
  const jaSonMetrica = (tipusActual === 'gossos') ? ['estat', 'resposta'] : [];
  // Columnes tècniques o de temps que NO s'ofereixen com a filtre de caselles.
  // "Punt" s'exclou aquí perquè el tractem a part, com a sub-filtre de l'Àrea.
  const noFiltrables = ['id', 'núm', 'num', 'observacions', 'punt',
    'data', 'data i hora', 'setmana', 'mes', 'any'];

  const colsFiltrables = columnes.filter(c => {
    if (c.tipus !== 'text') return false;
    const n = c.nom.toLowerCase().trim();
    if (noFiltrables.indexOf(n) !== -1) return false;
    if (jaSonMetrica.indexOf(n) !== -1) return false;
    const vals = valorsUnics(c.index).filter(v => v !== '' && v !== '(buit)');
    return vals.length >= 2 && vals.length <= 40;
  });

  const colPunt = columnes.find(c => c.nom.toLowerCase().trim() === 'punt');
  const colArea = colZona(); // a itineràncies és "Àrea"

  if (colsFiltrables.length === 0 && !colPunt) {
    cont.innerHTML = '<p class="bloc-ajuda" style="margin:0;">No hi ha res a filtrar en aquestes dades.</p>';
    document.getElementById('blocFiltres').style.display = 'none';
    return;
  }
  document.getElementById('blocFiltres').style.display = '';

  colsFiltrables.forEach(col => {
    const grup = { colIndex: col.index, nom: col.nom, valorsSel: new Set() };
    filtres.push(grup);

    const cap = document.createElement('div');
    cap.className = 'filtre-grup-nom';
    cap.textContent = col.nom;
    cont.appendChild(cap);

    const caixes = document.createElement('div');
    caixes.className = 'filtre-caixes';
    valorsUnics(col.index).filter(v => v !== '' && v !== '(buit)').forEach(val => {
      const chip = document.createElement('button');
      chip.className = 'filtre-chip';
      chip.textContent = val;
      chip.addEventListener('click', () => {
        if (grup.valorsSel.has(val)) { grup.valorsSel.delete(val); chip.classList.remove('sel'); }
        else { grup.valorsSel.add(val); chip.classList.add('sel'); }
        // si canvia l'Àrea o el Tipus, refresquem la llista de punts
        const n = col.nom.toLowerCase().trim();
        if (n === 'àrea' || n === 'area' || n === 'zona' || n === 'tipus') {
          if (filtrePunts) refrescarPunts();
        }
      });
      caixes.appendChild(chip);
    });
    cont.appendChild(caixes);
  });

  // Sub-filtre de PUNTS (només si hi ha columna Punt, típic d'itineràncies)
  if (colPunt && colArea) {
    muntarSubfiltrePunts(cont, colPunt, colArea);
  }
}

// Sub-filtre de punts: interruptor que desplega la llista de punts de les
// àrees seleccionades. Si es desactiva, es desmarca tot i es mostren tots.
function muntarSubfiltrePunts(cont, colPunt, colArea) {
  const colTipus = columnes.find(c => c.nom.toLowerCase().trim() === 'tipus');
  filtrePunts = {
    colIndex: colPunt.index,
    colArea: colArea.index,
    colTipus: colTipus ? colTipus.index : null,
    valorsSel: new Set(),
    actiu: false
  };

  const wrap = document.createElement('div');
  wrap.className = 'subfiltre-punts';
  wrap.id = 'subfiltrePunts';

  // Interruptor
  const tog = document.createElement('label');
  tog.className = 'toggle-punts';
  tog.innerHTML =
    '<input type="checkbox" id="chkPunts"> <span>Vull triar punts concrets</span>';
  wrap.appendChild(tog);

  // Contenidor de la llista (amagat per defecte)
  const llista = document.createElement('div');
  llista.className = 'punts-llista';
  llista.id = 'puntsLlista';
  llista.style.display = 'none';
  wrap.appendChild(llista);

  cont.appendChild(wrap);

  tog.querySelector('input').addEventListener('change', (e) => {
    filtrePunts.actiu = e.target.checked;
    if (e.target.checked) {
      llista.style.display = '';
      refrescarPunts();
    } else {
      llista.style.display = 'none';
      filtrePunts.valorsSel.clear();  // es desmarca tot -> es mostren tots
    }
  });

  // Comprovació inicial: si de bon principi hi ha pocs punts, s'amaga l'opció.
  refrescarPunts();
}

// Calcula quins punts hi ha disponibles segons àrees i tipus seleccionats
function puntsDisponibles() {
  const grupArea = filtres.find(g => g.colIndex === filtrePunts.colArea);
  const areesSel = grupArea ? grupArea.valorsSel : new Set();
  const grupTipus = (filtrePunts.colTipus !== null)
    ? filtres.find(g => g.colIndex === filtrePunts.colTipus) : null;
  const tipusSel = grupTipus ? grupTipus.valorsSel : new Set();

  const punts = new Set();
  dades.files.forEach(f => {
    const p = f[filtrePunts.colIndex];
    if (p === '' || p === null || p === undefined) return;
    const area = String(f[filtrePunts.colArea]);
    if (areesSel.size > 0 && !areesSel.has(area)) return;
    if (filtrePunts.colTipus !== null && tipusSel.size > 0) {
      const tip = String(f[filtrePunts.colTipus]);
      if (!tipusSel.has(tip)) return;
    }
    punts.add(String(p));
  });
  return punts;
}

// Actualitza la llista de punts segons àrees i tipus seleccionats.
// A més, amaga tota l'opció si hi ha molt pocs punts (com Daió/Fontalba).
function refrescarPunts() {
  if (!filtrePunts) return;
  const wrap = document.getElementById('subfiltrePunts');
  const llista = document.getElementById('puntsLlista');
  if (!wrap || !llista) return;

  const punts = puntsDisponibles();

  // Si hi ha 2 punts o menys disponibles (p. ex. només Pista i Aparcament),
  // no té sentit triar-los individualment: amaguem l'opció sencera.
  if (punts.size <= 2) {
    wrap.style.display = 'none';
    // desactivem qualsevol selecció prèvia
    filtrePunts.actiu = false;
    filtrePunts.valorsSel.clear();
    const chk = document.getElementById('chkPunts');
    if (chk) chk.checked = false;
    llista.style.display = 'none';
    return;
  }
  wrap.style.display = '';

  if (!filtrePunts.actiu) return;
  llista.innerHTML = '';

  if (punts.size === 0) {
    llista.innerHTML = '<p class="bloc-ajuda" style="margin:4px 0 0;">Tria abans una àrea per veure’n els punts.</p>';
    return;
  }

  // Netegem seleccions de punts que ja no són a la llista
  Array.from(filtrePunts.valorsSel).forEach(v => { if (!punts.has(v)) filtrePunts.valorsSel.delete(v); });

  const caixes = document.createElement('div');
  caixes.className = 'filtre-caixes';
  Array.from(punts).sort().forEach(val => {
    const chip = document.createElement('button');
    chip.className = 'filtre-chip';
    chip.textContent = val;
    if (filtrePunts.valorsSel.has(val)) chip.classList.add('sel');
    chip.addEventListener('click', () => {
      if (filtrePunts.valorsSel.has(val)) { filtrePunts.valorsSel.delete(val); chip.classList.remove('sel'); }
      else { filtrePunts.valorsSel.add(val); chip.classList.add('sel'); }
    });
    caixes.appendChild(chip);
  });
  llista.appendChild(caixes);
}

function valorsUnics(colIndex) {
  const set = new Set();
  dades.files.forEach(f => {
    const v = f[colIndex];
    if (v !== null && v !== undefined) set.add(String(v));
  });
  return Array.from(set).sort();
}

// ---------- Accions dels botons ----------
document.getElementById('btnGenerar').addEventListener('click', () => {
  generarInforme();
  if (window.innerWidth <= 860) tancarSidebarMobil();
});

document.getElementById('btnNetejarMetriques').addEventListener('click', () => {
  metriquesSel = [];
  document.querySelectorAll('#metriquesChips .chip-metrica').forEach(c => c.classList.remove('sel'));
});

document.getElementById('btnNetejarFiltres').addEventListener('click', () => {
  filtres.forEach(g => g.valorsSel.clear());
  document.querySelectorAll('#filtresRapids .filtre-chip').forEach(c => c.classList.remove('sel'));
  // netejar també el sub-filtre de punts
  if (filtrePunts) {
    filtrePunts.valorsSel.clear();
    filtrePunts.actiu = false;
    const chk = document.getElementById('chkPunts');
    if (chk) chk.checked = false;
    const llista = document.getElementById('puntsLlista');
    if (llista) { llista.style.display = 'none'; llista.innerHTML = ''; }
  }
});

// ============================================================
// GENERAR INFORME
// ============================================================

function generarInforme() {
  if (metriquesSel.length === 0) { toast('Tria com a mínim una dada a “Què vols veure”.'); return; }
  if (!agruparSel) { toast('Tria com repartir les dades.'); return; }

  const files = aplicarFiltres();
  if (files.length === 0) { toast('No hi ha dades amb aquests filtres. Prova de treure’n algun.'); return; }

  const puntsActius = (filtrePunts && filtrePunts.actiu && filtrePunts.valorsSel.size > 0);

  if (puntsActius) {
    generarInformePunts(files);
  } else {
    generarInformeNormal(files);
  }

  if (window.innerWidth > 860) {
    document.getElementById('pissarraCos').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// MODE NORMAL: una sèrie per mètrica, repartides pel temps (o el filtre triat).
function generarInformeNormal(files) {
  const agrupar = agruparSel;
  const series = metriquesSel.map(m => ({ id: m, nom: nomMetrica(m), dades: agregar(files, m, agrupar, files.length) }));
  const claus = unificarClaus(series);
  renderitzarPissarra(files, series, claus, agrupar, '');
}

// MODE PUNTS: eix X = temps × punt. Cada punt té la seva columna dins de cada
// període, amb el nom del punt a sota. Els colors/llegenda són les MÈTRIQUES.
// Funciona igual amb 1 o amb diverses mètriques.
function generarInformePunts(files) {
  const agrupar = agruparSel;                       // dia / setmana / mes
  const puntsList = Array.from(filtrePunts.valorsSel).sort();
  const colPunt = filtrePunts.colIndex;

  // 1) Períodes presents a les dades (ordenats cronològicament)
  const periodes = periodesOrdenats(files, agrupar);

  // 2) Eix X = una entrada per (període × punt). Etiqueta principal = punt,
  //    subetiqueta = període (per agrupar visualment).
  const eix = [];
  periodes.forEach(per => {
    puntsList.forEach(punt => {
      eix.push({ periode: per.clau, periodeOrdre: per.ordre, punt: punt });
    });
  });

  // 3) Un dataset per MÈTRICA; cada valor correspon a una casella de l'eix.
  const series = metriquesSel.map(m => {
    const dadesSerie = eix.map(cel => {
      const filesCel = files.filter(f =>
        String(f[colPunt]) === cel.punt &&
        formatarData(f[dataColIndex(agrupar)], granDe(agrupar)) === cel.periode
      );
      return { valor: valorMetrica(filesCel, m) };
    });
    return { id: m, nom: nomMetrica(m), dades: dadesSerie };
  });

  renderitzarPissarraPunts(files, series, eix, periodes, puntsList, agrupar);
}

// Índex de la columna de data segons l'agrupació ('idx:gran')
function dataColIndex(agrupar) { return Number(String(agrupar).split(':')[0]); }
function granDe(agrupar) { const p = String(agrupar).split(':'); return p[1] || null; }

// Períodes únics i ordenats presents a les dades
function periodesOrdenats(files, agrupar) {
  const ci = dataColIndex(agrupar), gran = granDe(agrupar);
  const mapa = {};
  files.forEach(f => {
    const clau = formatarData(f[ci], gran);
    if (!(clau in mapa)) mapa[clau] = ordreData(f[ci], gran);
  });
  return Object.keys(mapa)
    .map(clau => ({ clau, ordre: mapa[clau] }))
    .sort((a, b) => a.ordre < b.ordre ? -1 : (a.ordre > b.ordre ? 1 : 0));
}

// Calcula el valor d'una mètrica per a un conjunt de files
function valorMetrica(files, metrica) {
  if (metrica === '__count__') return files.length;
  if (metrica.indexOf('cond:') === 0) {
    const p = metrica.split(':'); const ci = Number(p[1]); const vc = p.slice(2).join(':');
    let n = 0; files.forEach(f => { if (String(f[ci]) === vc) n++; }); return n;
  }
  if (metrica.indexOf('sum:') === 0 || metrica.indexOf('avg:') === 0) {
    const p = metrica.split(':'); const ci = Number(p[1]);
    let suma = 0, comptats = 0;
    files.forEach(f => { const v = aNumero(f[ci]); if (!isNaN(v)) { suma += v; comptats++; } });
    if (metrica.indexOf('avg:') === 0) return comptats ? Math.round((suma / comptats) * 100) / 100 : 0;
    return Math.round(suma * 100) / 100;
  }
  return 0;
}

function unificarClaus(series) {
  const totes = [];
  const vist = {};
  series.forEach(s => s.dades.forEach(d => {
    if (!vist[d.clau]) { vist[d.clau] = true; totes.push(d.clau); }
  }));
  return totes;
}

// Igual que unificarClaus però ordena cronològicament per la clau d'ordre
function unificarClausOrdenat(series) {
  const mapa = {};
  series.forEach(s => s.dades.forEach(d => {
    if (!(d.clau in mapa)) mapa[d.clau] = d.ordre || d.clau;
  }));
  return Object.keys(mapa).sort((a, b) => mapa[a] < mapa[b] ? -1 : (mapa[a] > mapa[b] ? 1 : 0));
}

// ---------- Filtres ràpids ----------
// filtres = [{ colIndex, nom, valorsSel: Set }]. Un grup filtra si té valors
// marcats: llavors només passen les files amb algun d'aquests valors.
// A més, si el sub-filtre de punts està actiu i té punts marcats, s'aplica.
function aplicarFiltres() {
  const grupsActius = filtres.filter(g => g.valorsSel && g.valorsSel.size > 0);
  const puntsActius = (filtrePunts && filtrePunts.actiu && filtrePunts.valorsSel.size > 0)
    ? filtrePunts : null;

  if (grupsActius.length === 0 && !puntsActius) return dades.files.slice();

  return dades.files.filter(fila => {
    // filtres normals (àrea, tipus, zona...)
    const passaFiltres = grupsActius.every(g => g.valorsSel.has(String(fila[g.colIndex])));
    if (!passaFiltres) return false;
    // sub-filtre de punts
    if (puntsActius) return puntsActius.valorsSel.has(String(fila[puntsActius.colIndex]));
    return true;
  });
}

// ---------- Agregació ----------
function agregar(files, metrica, agrupar, totalFiltrat) {
  let colAgrup, gran = null;
  if (String(agrupar).indexOf(':') !== -1) {
    const p = String(agrupar).split(':'); colAgrup = Number(p[0]); gran = p[1];
  } else colAgrup = Number(agrupar);

  const grups = {};
  files.forEach(fila => {
    let clau, ordre;
    if (gran) {
      clau = formatarData(fila[colAgrup], gran);
      ordre = ordreData(fila[colAgrup], gran);
    } else {
      clau = (fila[colAgrup] === '' || fila[colAgrup] === null || fila[colAgrup] === undefined) ? '(buit)' : String(fila[colAgrup]);
      ordre = clau;
    }
    if (!grups[clau]) grups[clau] = { suma: 0, count: 0, comptats: 0, ordre: ordre };
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
    return { clau, ordre: g.ordre, valor: Math.round(valor * 100) / 100 };
  });

  if (gran) {
    // ordenació cronològica per la clau d'ordre
    entrades.sort((a, b) => a.ordre < b.ordre ? -1 : (a.ordre > b.ordre ? 1 : 0));
  } else if (semblaData(entrades)) {
    entrades.sort((a, b) => a.clau < b.clau ? -1 : (a.clau > b.clau ? 1 : 0));
  } else {
    entrades.sort((a, b) => b.valor - a.valor);
  }
  return entrades;
}

// Clau d'ordenació cronològica (invisible) segons la granularitat
function ordreData(v, gran) {
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(v);
  if (gran === 'any') return m[1];
  if (gran === 'mes') return m[1] + '-' + m[2];
  if (gran === 'setmana') {
    const setmanaMes = Math.ceil(Number(m[3]) / 7);
    return m[1] + '-' + m[2] + '-S' + setmanaMes;
  }
  return m[1] + '-' + m[2] + '-' + m[3];
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
  if (gran === 'mes') {
    return NOMS_MES[Number(m[2]) - 1] + ' ' + m[1];
  }
  if (gran === 'setmana') return setmanaEtiqueta(v);
  // dia
  return m[3] + '/' + m[2] + '/' + m[1];
}

const NOMS_MES = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
const ORDINALS = ['Primera', 'Segona', 'Tercera', 'Quarta', 'Cinquena', 'Sisena'];

// Setmana dins del mes: "Primera setmana de juny 2026", etc.
// La setmana del mes es calcula segons en quina setmana natural cau el dia.
function setmanaEtiqueta(v) {
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(v);
  const any = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  // Nombre de setmana dins del mes: (dia del mes + desplaçament del primer dia) / 7
  const setmanaMes = Math.ceil(dia / 7);
  const ordinal = ORDINALS[setmanaMes - 1] || (setmanaMes + 'a');
  return ordinal + ' setmana de ' + NOMS_MES[mes - 1] + ' ' + any;
}

// ============================================================
// RENDERITZAT A LA PISSARRA
// ============================================================

function renderitzarPissarra(files, series, claus, agrupar, subtitolExtra) {
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

  const titol = series.map(s => s.nom).join(' · ');
  const subtitol = 'per ' + nomAgrupar(agrupar) + ' · ' + files.length + ' registres';

  // ---- Gràfic o taula ----
  if (vistaActual === 'taula') {
    cos.appendChild(crearTaula(series, claus, agrupar));
  } else {
    const card = document.createElement('div');
    card.className = 'card-grafic';
    // Nombre de barres visibles (per decidir si cal scroll horitzontal)
    const nBarres = (vistaActual === 'pastis') ? 1 : claus.length * series.length;
    card.innerHTML =
      '<div class="card-grafic-titol">' + escapar(titol) + '</div>' +
      '<div class="card-grafic-sub">' + escapar(subtitol) + '</div>' +
      caixaGraficHTML(nBarres, 380);
    cos.appendChild(card);
    ajustarAmplada(card, nBarres);
    crearGrafic(series, claus, agrupar);

    // A més del gràfic, sempre una taula sota per detall
    cos.appendChild(crearTaula(series, claus, agrupar));
  }
}

// ---------- Render en MODE PUNTS (temps × punt × mètrica) ----------
function renderitzarPissarraPunts(files, series, eix, periodes, puntsList, agrupar) {
  const cos = document.getElementById('pissarraCos');
  cos.innerHTML = '';

  // KPIs (totals globals de cada mètrica)
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

  const titol = 'Punts al llarg del temps';
  const subtitol = 'per ' + nomAgrupar(agrupar) + ' · ' + puntsList.length + ' punts · ' +
                   series.length + (series.length > 1 ? ' dades' : ' dada') + ' · ' + files.length + ' registres';

  if (vistaActual === 'taula') {
    cos.appendChild(crearTaulaPunts(series, eix, periodes, puntsList));
  } else {
    const card = document.createElement('div');
    card.className = 'card-grafic';
    // En mode punts: una barra per (període × punt × mètrica)
    const nBarres = eix.length * series.length;
    card.innerHTML =
      '<div class="card-grafic-titol">' + escapar(titol) + '</div>' +
      '<div class="card-grafic-sub">' + escapar(subtitol) + '</div>' +
      caixaGraficHTML(nBarres, 460);
    cos.appendChild(card);
    ajustarAmplada(card, nBarres);
    crearGraficPunts(series, eix, periodes, puntsList, agrupar);
    cos.appendChild(crearTaulaPunts(series, eix, periodes, puntsList));
  }
}

// Gràfic mode punts: eix X jeràrquic [punt, període]; un dataset per mètrica.
function crearGraficPunts(series, eix, periodes, puntsList, agrupar) {
  const ctx = document.getElementById('grafic').getContext('2d');
  if (chartActual) { chartActual.destroy(); chartActual = null; }

  const paleta = ['#e2570a', '#2d5a3d', '#0097b2', '#c9a227', '#7a4eab', '#3fa34d', '#d1495b', '#1f6f78'];

  // Etiquetes de l'eix X: dues línies -> [nom del punt, període]
  const labels = eix.map(c => [escurçar(c.punt, 16), c.periode]);

  let tipus = 'bar';
  if (vistaActual === 'linia') tipus = 'line';
  if (vistaActual === 'pastis') tipus = 'bar'; // el pastís no té sentit aquí; usem barres

  const datasets = series.map((s, i) => {
    const color = paleta[i % paleta.length];
    return {
      label: s.nom,
      data: s.dades.map(d => d.valor),
      backgroundColor: vistaActual === 'linia' ? 'transparent' : color + 'cc',
      borderColor: color,
      borderWidth: vistaActual === 'linia' ? 3 : 1,
      borderRadius: vistaActual === 'linia' ? 0 : 5,
      tension: 0.3,
      pointBackgroundColor: color,
      pointRadius: vistaActual === 'linia' ? 4 : 0,
      fill: false
    };
  });

  // Línies separadores entre períodes (per marcar visualment els grups)
  const separadors = {
    id: 'separadorsPeriode',
    afterDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!scales.x) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(22,38,29,0.12)';
      ctx.lineWidth = 1;
      for (let i = puntsList.length; i < eix.length; i += puntsList.length) {
        const x = scales.x.getPixelForValue(i) - (scales.x.getPixelForValue(1) - scales.x.getPixelForValue(0)) / 2;
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  chartActual = new Chart(ctx, {
    type: tipus,
    data: { labels, datasets },
    plugins: [separadors],
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { font: { family: 'Inter', size: 12 }, color: '#16261d', padding: 14, usePointStyle: true } },
        tooltip: {
          backgroundColor: '#16261d', padding: 12, cornerRadius: 8,
          titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' },
          callbacks: {
            title: (items) => {
              const c = eix[items[0].dataIndex];
              return c.punt + '  ·  ' + c.periode;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Inter', size: 10 }, color: '#3a4a3f', autoSkip: false, maxRotation: 90, minRotation: 0 }
        },
        y: { beginAtZero: true, grid: { color: 'rgba(22,38,29,0.06)' }, ticks: { font: { family: 'Inter', size: 11 }, color: '#8a9a8f' } }
      }
    }
  });
}

// Taula mode punts: files = període + punt; columnes = mètriques
function crearTaulaPunts(series, eix, periodes, puntsList) {
  const card = document.createElement('div');
  card.className = 'card-taula';
  let html = '<div class="taula-scroll"><table class="dades"><thead><tr>' +
             '<th>Període</th><th>Punt</th>';
  series.forEach(s => { html += '<th style="text-align:right">' + escapar(s.nom) + '</th>'; });
  html += '</tr></thead><tbody>';

  eix.forEach((cel, idx) => {
    // només mostrem el període a la primera fila del seu grup
    const primerDelGrup = (idx % puntsList.length === 0);
    html += '<tr>';
    html += '<td>' + (primerDelGrup ? escapar(cel.periode) : '') + '</td>';
    html += '<td>' + escapar(cel.punt) + '</td>';
    series.forEach(s => { html += '<td class="num">' + s.dades[idx].valor + '</td>'; });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  card.innerHTML = html;
  return card;
}

// Escurça un text amb … si passa de n caràcters
function escurçar(s, n) {
  s = String(s);
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function calcularKPIs(files, series) {
  const t = [];
  t.push({ etiqueta: tipusActual === 'gossos' ? 'Gossos (filtrats)' : 'Registres (filtrats)', valor: formatarNum(files.length) });

  // Per cada mètrica seleccionada, el seu total global
  series.forEach(s => {
    if (s.id === '__count__' || s.id === '__pct__') return;
    let suma = 0;
    if (s.id.indexOf('cond:') === 0) {
      const p = s.id.split(':'); const ci = Number(p[1]); const vc = p.slice(2).join(':');
      files.forEach(f => { if (String(f[ci]) === vc) suma += 1; });
      t.push({ etiqueta: s.nom, valor: formatarNum(suma) });
    } else if (s.id.indexOf('sum:') === 0) {
      const ci = Number(s.id.split(':')[1]);
      files.forEach(f => { const v = aNumero(f[ci]); if (!isNaN(v)) suma += v; });
      t.push({ etiqueta: 'Total ' + s.nom, valor: formatarNum(Math.round(suma * 100) / 100) });
    }
  });
  return t.slice(0, 4);
}

function formatarNum(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ---------- Caixa del gràfic amb scroll horitzontal adaptatiu ----------
// Amplada mínima per barra perquè sempre sigui llegible. Si les barres no
// caben a l'ample disponible, el gràfic s'estén i apareix scroll horitzontal.
const AMPLE_MIN_BARRA = 46;   // px per barra
const AMPLE_MIN_GRAFIC = 320; // mai més estret que això

function caixaGraficHTML(nBarres, alcada) {
  return '<div class="grafic-scroll" id="graficScroll">' +
         '<div class="grafic-caixa" id="graficCaixa" style="height:' + alcada + 'px;">' +
         '<canvas id="grafic"></canvas></div></div>' +
         '<div class="scroll-avis" id="scrollAvis" style="display:none;">→ Desplaça de costat per veure la resta</div>';
}

// Calcula l'amplada necessària i activa el scroll si cal.
// Es crida just després d'inserir la targeta i també en redimensionar.
let _ajustPendent = null;
function ajustarAmplada(card, nBarres) {
  const aplica = () => {
    const scroll = card.querySelector('#graficScroll');
    const caixa = card.querySelector('#graficCaixa');
    const avis = card.querySelector('#scrollAvis');
    if (!scroll || !caixa) return;

    // Espai realment disponible. Si encara no s'ha pintat (clientWidth 0),
    // ho deduïm del contenidor pare.
    let disponible = scroll.clientWidth;
    if (!disponible) {
      const pare = document.getElementById('pissarraCos');
      disponible = (pare && pare.clientWidth ? pare.clientWidth : 700) - 90;
    }
    disponible = Math.max(AMPLE_MIN_GRAFIC, disponible);
    const necessari = Math.max(AMPLE_MIN_GRAFIC, nBarres * AMPLE_MIN_BARRA);

    if (necessari > disponible) {
      caixa.style.width = necessari + 'px';
      scroll.classList.add('te-scroll');
      if (avis) avis.style.display = '';
    } else {
      caixa.style.width = '100%';
      scroll.classList.remove('te-scroll');
      if (avis) avis.style.display = 'none';
    }
    if (chartActual) chartActual.resize();
  };

  aplica();
  // Recalcular en el següent frame (quan el navegador ja ha pintat)
  if (window.requestAnimationFrame) window.requestAnimationFrame(aplica);

  // I quan es redimensioni la finestra
  _ajustPendent = { card, nBarres, aplica };
}

// Recalcular el gràfic en redimensionar la finestra
window.addEventListener('resize', () => {
  if (_ajustPendent && document.getElementById('graficScroll')) {
    _ajustPendent.aplica();
  }
});

// ---------- Gràfic (Chart.js) ----------
function crearGrafic(series, claus, agrupar) {
  const ctx = document.getElementById('grafic').getContext('2d');
  if (chartActual) { chartActual.destroy(); chartActual = null; }

  const paleta = ['#e2570a', '#2d5a3d', '#0097b2', '#c9a227', '#7a4eab', '#3fa34d', '#d1495b', '#1f6f78', '#a8452b'];
  let tipus = 'bar';
  if (vistaActual === 'linia') tipus = 'line';
  if (vistaActual === 'pastis') tipus = 'pie';

  let datasets;
  if (vistaActual === 'pastis') {
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
        borderRadius: vistaActual === 'barres' ? 5 : 0,
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
  // Busquem l'etiqueta humana a les opcions d'agrupament
  const ops = construirOpcionsAgrupar();
  const trobat = ops.find(o => o.valor === String(agrupar));
  if (trobat) return trobat.nom.replace(/^Per /, '');
  // fallback
  if (String(agrupar).indexOf(':') !== -1) {
    const parts = String(agrupar).split(':');
    const col = columnes.find(c => c.index === Number(parts[0]));
    return (col ? col.nom : '') + ' (' + parts[1] + ')';
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
  return NOMS_MES[Number(m[2]) - 1] + ' ' + m[1];
}
function setmanaDe(v) {
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return setmanaEtiqueta(v);   // "Primera setmana de juny 2026"
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
