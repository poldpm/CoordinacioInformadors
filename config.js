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
    gossos:      "https://script.google.com/macros/s/AKfycbzjN0OFizFNdM2x0nE4miK1SWdUXGOppfc5WKsKU11Mrki1iaSHzWY_GAzIL8MIDASs/exec",
    itinerancia: "https://script.google.com/macros/s/AKfycbxvwXfBN6Gf5j7sNaa3poXKZbLx8WxRNZun_gZxlctbUC2E4WVrp6ayXTah_X33gTHZ/exec"
  },
  pn: {
    gossos:      "https://script.google.com/macros/s/AKfycbwXfARxx3B58cUCCh9hUi4vXQg7Z6u38345r_zm0DJaM4NOWhw_xLb43gVnJEY67WF2_g/exec",
    itinerancia: "https://script.google.com/macros/s/AKfycbx9QwXzshuIMwb5nkVVKtP9GB5kX9kPTAyyHRLZ7FfHTAbptXpPHnJsowGcn7ASi4zGdg/exec"
  }
};

// Noms bonics per mostrar a la interfície
const NOMS_ENTITAT = { ceinr: "CEINR", pn: "Parc Natural" };
const NOMS_TIPUS = { gossos: "Gossos", itinerancia: "Itineràncies" };
