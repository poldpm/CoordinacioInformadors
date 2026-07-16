// ============================================================
// CONFIGURACIÓ DEL PANELL DE CONTROL
// ------------------------------------------------------------
// Aquí van les 4 URLs /exec dels teus fulls de càlcul.
//
// IMPORTANT: són LES MATEIXES URLs que ja fan servir les teves
// apps per enviar dades (les que acaben amb /exec). NO n'has de
// crear cap de nova. El panell hi afegeix ?llegir=1 automàticament.
//
// (Perquè funcioni, cada full ha de tenir el codi de
// "AfegitoLector.gs" enganxat al seu Code.gs — mira les
// instruccions d'aquell fitxer.)
// ============================================================

const FONTS = {
  ceinr: {
    gossos:      "ENGANXA_URL_EXEC_GOSSOS_CEINR",
    itinerancia: "ENGANXA_URL_EXEC_ITINERANCIA_CEINR"
  },
  pn: {
    gossos:      "ENGANXA_URL_EXEC_GOSSOS_PN",
    itinerancia: "ENGANXA_URL_EXEC_ITINERANCIA_PN"
  }
};

// Noms bonics per mostrar a la interfície
const NOMS_ENTITAT = { ceinr: "CEINR", pn: "Parc Natural" };
const NOMS_TIPUS = { gossos: "Gossos", itinerancia: "Itineràncies" };
