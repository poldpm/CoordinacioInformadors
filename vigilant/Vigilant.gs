/**
 * ============================================================
 * VIGILANT DE LES APPS DEL RIPOLLÈS
 * ------------------------------------------------------------
 * Comprova AUTOMÀTICAMENT, cada poques hores i durant tot l'any,
 * que les 4 apps segueixen guardant dades. Si alguna cosa falla,
 * envia un CORREU d'avís.
 *
 * Funciona als servidors de Google (no cal tenir cap ordinador
 * encès). És gratuït.
 *
 * QUÈ VIGILA
 *   1. Que el "full" de cada app respon (si no respon, cap tablet
 *      pot enviar dades → AVÍS URGENT).
 *   2. Que la pestanya "Registres" existeix i es pot llegir.
 *   3. Que no fa massa dies que no arriba cap dada (per si una app
 *      ha deixat d'enviar sense que ningú se n'adoni).
 *   4. T'envia un RESUM SETMANAL encara que tot vagi bé, perquè
 *      sàpigues que el vigilant està viu (un vigilant silenciós
 *      no es distingeix d'un vigilant espatllat).
 *
 * COM INSTAL·LAR-LO (10 minuts, es fa UNA sola vegada)
 *   1. Ves a  https://script.google.com  i fes "Projecte nou".
 *   2. Esborra el que hi hagi i enganxa TOT aquest fitxer.
 *   3. Posa el teu correu a AVIS_EMAIL (aquí sota).
 *   4. Dalt, tria la funció "instalar" i prem "Executa".
 *      Accepta els permisos que et demani (enviar correu i
 *      connectar-se als fulls). És normal: surt un avís de
 *      "Google no ha verificat l'aplicació" → Configuració
 *      avançada → Anar a (nom del projecte).
 *   5. Ja està. A partir d'aquí treballa sol.
 *
 * PER PROVAR-HO: executa la funció "provaAra" i mira el correu.
 * ============================================================
 */

// ---------- CONFIGURACIÓ ----------

/** On vols rebre els avisos. Pots posar-ne més separats per comes. */
const AVIS_EMAIL = 'poldelpozomurgou@gmail.com';

/** Les 4 apps que es vigilen (URL /exec de cada full). */
const APPS = [
  { nom: 'Gossos CEINR',        url: 'https://script.google.com/macros/s/AKfycbzjN0OFizFNdM2x0nE4miK1SWdUXGOppfc5WKsKU11Mrki1iaSHzWY_GAzIL8MIDASs/exec' },
  { nom: 'Itinerància CEINR',   url: 'https://script.google.com/macros/s/AKfycbxvwXfBN6Gf5j7sNaa3poXKZbLx8WxRNZun_gZxlctbUC2E4WVrp6ayXTah_X33gTHZ/exec' },
  { nom: 'Gossos PN',           url: 'https://script.google.com/macros/s/AKfycbwXfARxx3B58cUCCh9hUi4vXQg7Z6u38345r_zm0DJaM4NOWhw_xLb43gVnJEY67WF2_g/exec' },
  { nom: 'Itinerància PN',      url: 'https://script.google.com/macros/s/AKfycbx9QwXzshuIMwb5nkVVKtP9GB5kX9kPTAyyHRLZ7FfHTAbptXpPHnJsowGcn7ASi4zGdg/exec' }
];

/** Si passen més d'aquests dies sense CAP dada nova, avisa. */
const DIES_SENSE_DADES = 12;

/** Si un problema segueix, recorda-ho un cop cada tantes hores (per no saturar). */
const HORES_ENTRE_RECORDATORIS = 24;

/** Dia del resum setmanal de "tot va bé" (1=dilluns … 7=diumenge). */
const DIA_RESUM_SETMANAL = 1;

// ---------- INSTAL·LACIÓ ----------

/**
 * EXECUTA AIXÒ UN COP. Crea els avisos automàtics.
 */
function instalar() {
  // Esborrem triggers antics d'aquest projecte (per no duplicar-los)
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });

  // Comprovació cada 4 hores (6 cops al dia)
  ScriptApp.newTrigger('comprovar').timeBased().everyHours(4).create();

  // Resum setmanal (prova de vida), dilluns al matí
  ScriptApp.newTrigger('resumSetmanal').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();

  // Primera comprovació ara mateix
  comprovar();

  enviarCorreu(
    '✅ Vigilant instal·lat',
    'El vigilant de les apps del Ripollès ja està en marxa.\n\n' +
    'Comprovarà les ' + APPS.length + ' apps cada 4 hores i t\'avisarà si alguna\n' +
    'deixa de funcionar o si passen més de ' + DIES_SENSE_DADES + ' dies sense dades noves.\n\n' +
    'Cada dilluns rebràs un resum, encara que tot vagi bé, perquè sàpigues\n' +
    'que el vigilant segueix viu.'
  );
}

/** Prova manual: fa una comprovació i t'envia l'estat ara mateix. */
function provaAra() {
  var estat = revisarTotes_();
  enviarCorreu('🔎 Prova del vigilant — estat actual', textEstat_(estat, true));
}

// ---------- COMPROVACIÓ PRINCIPAL ----------

/**
 * Comprova totes les apps i avisa NOMÉS quan hi ha novetat:
 * quan una app comença a fallar, quan es recupera, o com a
 * recordatori si segueix fallant.
 */
function comprovar() {
  var estat = revisarTotes_();
  var props = PropertiesService.getScriptProperties();
  var ara = new Date().getTime();

  var nousProblemes = [];
  var recuperades = [];

  estat.forEach(function (r) {
    var clau = 'estat_' + r.nom;
    var previAnterior = props.getProperty(clau);
    var previ = null;
    try { previ = previAnterior ? JSON.parse(previAnterior) : null; } catch (e) { previ = null; }

    if (r.problema) {
      var primerCop = !previ || !previ.problema;
      var toca = primerCop ||
        (ara - (previ.avisat || 0)) > HORES_ENTRE_RECORDATORIS * 3600 * 1000;
      if (toca) {
        nousProblemes.push(r);
        props.setProperty(clau, JSON.stringify({ problema: true, avisat: ara }));
      }
    } else {
      if (previ && previ.problema) recuperades.push(r);
      props.setProperty(clau, JSON.stringify({ problema: false, avisat: 0 }));
    }
  });

  if (nousProblemes.length > 0) {
    enviarCorreu(
      '🚨 PROBLEMA amb ' + (nousProblemes.length === 1 ? nousProblemes[0].nom : nousProblemes.length + ' apps'),
      'ATENCIÓ: alguna cosa no funciona.\n\n' +
      nousProblemes.map(function (r) {
        return '❌ ' + r.nom + '\n   ' + r.problema + '\n';
      }).join('\n') +
      '\nQuè fer:\n' +
      ' · Comprova que el full de càlcul s\'obre i que hi ha la pestanya "Registres".\n' +
      ' · Si has tocat el Code.gs: Implementa → Gestiona desplegaments → Nova versió.\n' +
      ' · Mentre no funcioni, les tablets NO perden res: guarden els registres i\n' +
      '   els envien quan torni a anar. Però NO reinstal·leu cap app ni esborreu\n' +
      '   dades de l\'app fins que estigui resolt.\n\n' +
      '--- Estat complet ---\n' + textEstat_(estat, false)
    );
  }

  if (recuperades.length > 0) {
    enviarCorreu(
      '✅ Ja torna a funcionar: ' + recuperades.map(function (r) { return r.nom; }).join(', '),
      'Bona notícia, això ja funciona una altra vegada.\n\n' +
      'Recorda dir als informadors que obrin l\'app amb cobertura perquè\n' +
      'pugin els registres que tinguessin pendents.\n\n' +
      '--- Estat complet ---\n' + textEstat_(estat, false)
    );
  }
}

/** Resum setmanal: prova que el vigilant segueix viu. */
function resumSetmanal() {
  var estat = revisarTotes_();
  var problemes = estat.filter(function (r) { return r.problema; }).length;
  enviarCorreu(
    (problemes ? '⚠️' : '✅') + ' Resum setmanal de les apps',
    (problemes
      ? 'Hi ha ' + problemes + ' app(s) amb problemes. Mira el detall:\n\n'
      : 'Tot funciona correctament.\n\n') +
    textEstat_(estat, true) +
    '\n\n(Aquest correu arriba cada dilluns perquè sàpigues que el vigilant\n' +
    'segueix actiu. Si algun dilluns NO el reps, revisa el vigilant.)'
  );
}

// ---------- REVISIÓ D'UNA APP ----------

function revisarTotes_() {
  return APPS.map(function (app) { return revisar_(app); });
}

/**
 * Revisa una app: que respon, que es pot llegir i quan va arribar
 * l'última dada. Mai llança excepcions: retorna el problema com a text.
 */
function revisar_(app) {
  var res = { nom: app.nom, problema: null, registres: null, ultima: null, dies: null };

  if (!app.url || app.url.indexOf('http') !== 0) {
    res.problema = 'No hi ha URL configurada per a aquesta app.';
    return res;
  }

  var resposta;
  try {
    resposta = UrlFetchApp.fetch(app.url + '?llegir=1', {
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: true
    });
  } catch (err) {
    res.problema = 'No s\'hi pot connectar (el full no respon). Detall: ' + err;
    return res;
  }

  var codi = resposta.getResponseCode();
  if (codi !== 200) {
    res.problema = 'El full respon amb error HTTP ' + codi + '. Potser el desplegament ' +
      'ha caducat o s\'ha canviat el permís d\'accés.';
    return res;
  }

  var dades = null;
  try {
    dades = JSON.parse(resposta.getContentText());
  } catch (e) {
    res.problema = 'La resposta no és llegible. Potser falta el "lector" del panell ' +
      '(llegirDadesPanell_) al Code.gs d\'aquest full.';
    return res;
  }

  if (!dades || dades.ok !== true) {
    res.problema = 'El full contesta un error: ' + ((dades && dades.error) ? dades.error : 'desconegut');
    return res;
  }

  var files = dades.files || [];
  res.registres = files.length;

  // Busquem la data més recent entre les columnes de data
  var caps = dades['capçaleres'] || [];
  var idxData = -1;
  for (var i = 0; i < caps.length; i++) {
    var n = String(caps[i]).toLowerCase().trim();
    if (n === 'data i hora' || n === 'data') { idxData = i; break; }
  }

  if (idxData !== -1) {
    var millor = null;
    for (var f = 0; f < files.length; f++) {
      var v = files[f][idxData];
      if (!v) continue;
      var d = new Date(v);
      if (!isNaN(d.getTime()) && (millor === null || d > millor)) millor = d;
    }
    if (millor) {
      res.ultima = millor;
      res.dies = Math.floor((new Date().getTime() - millor.getTime()) / (24 * 3600 * 1000));
      if (res.dies > DIES_SENSE_DADES) {
        res.problema = 'Fa ' + res.dies + ' dies que no arriba cap dada nova ' +
          '(l\'última: ' + formatarData_(millor) + '). Si hauríeu d\'haver itinerat, ' +
          'comprova que les tablets sincronitzen.';
      }
    } else if (files.length === 0) {
      // Full buit: no és error si l'app és nova, però ho fem notar al resum.
      res.ultima = null;
    }
  }

  return res;
}

// ---------- UTILITATS ----------

function textEstat_(estat, ambDetall) {
  return estat.map(function (r) {
    var icona = r.problema ? '❌' : '✅';
    var linia = icona + ' ' + r.nom;
    if (r.problema) {
      linia += '\n   ' + r.problema;
    } else if (ambDetall) {
      linia += '\n   ' + (r.registres !== null ? r.registres + ' registres' : 'sense dades') +
        (r.ultima ? ' · última dada: ' + formatarData_(r.ultima) +
          (r.dies !== null ? ' (fa ' + r.dies + ' dies)' : '') : '');
    }
    return linia;
  }).join('\n');
}

function formatarData_(d) {
  try {
    return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Europe/Madrid', 'dd/MM/yyyy HH:mm');
  } catch (e) {
    return String(d);
  }
}

function enviarCorreu(assumpte, cos) {
  try {
    MailApp.sendEmail(AVIS_EMAIL, '[Apps Ripollès] ' + assumpte, cos);
  } catch (e) {
    // Si no es pot enviar (quota), ho deixem al registre d'execucions
    console.error('No s\'ha pogut enviar el correu: ' + e);
  }
}
