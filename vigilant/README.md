# Vigilant de les apps — avisos automàtics 24/7

Vigila que les **4 apps** segueixen guardant dades i **t'envia un correu** si
alguna cosa falla. Funciona als servidors de Google (no cal cap ordinador encès)
i és gratuït.

## Què vigila

| Comprovació | Quan avisa |
|---|---|
| El full de cada app respon | Si no respon → **avís urgent** (cap tablet pot enviar dades) |
| El desplegament és viu | Si dona error HTTP (caducat, permisos canviats) |
| La pestanya "Registres" es pot llegir | Si falta o el lector del panell no hi és |
| Arriben dades noves | Si passen més de 12 dies sense cap dada |
| **Prova de vida** | Cada dilluns t'arriba un resum, encara que tot vagi bé |

> El resum setmanal és important: **un vigilant silenciós no es distingeix d'un
> vigilant espatllat**. Si algun dilluns no reps el correu, revisa'l.

## Instal·lació (10 minuts, un sol cop)

1. Ves a **https://script.google.com** → **Projecte nou**.
2. Esborra el que hi hagi i **enganxa tot el `Vigilant.gs`**.
3. Comprova que `AVIS_EMAIL` (a dalt del fitxer) és el teu correu.
4. Dalt tria la funció **`instalar`** i prem **Executa**.
5. Accepta els permisos (enviar correu i connectar-se als fulls).
   Sortirà «Google no ha verificat l'aplicació» → *Configuració avançada* →
   *Anar a (nom del projecte)*. És normal: és el teu propi script.
6. Rebràs un correu de confirmació. Ja està.

**Per provar-ho:** executa la funció `provaAra` i mira el correu — t'arriba
l'estat de les 4 apps al moment.

## Manteniment

- Si canvies la URL `/exec` d'algun full (nou desplegament que canviï la URL),
  actualitza-la a la llista `APPS` del `Vigilant.gs`.
- Si vols que avisi abans o després per manca de dades, canvia `DIES_SENSE_DADES`.
- Si el mateix vigilant peta, Google t'envia un correu automàtic d'error
  d'execució: és una segona xarxa de seguretat.

## Què NO cobreix

Aquest vigilant comprova el **servidor** (els fulls). No pot saber si una tablet
concreta té registres encallats — això ho avisa **la mateixa app a la tablet**
amb una barra vermella quan hi ha pendents d'un dia anterior.
