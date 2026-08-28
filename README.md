# BAR CAPRI — sito multilingue

Sito del **Bar Capri**, ristorante e pizzeria in **Via Principe Amedeo 78/80, 00185 Roma**.
Telefono **351 265 0441** · WhatsApp **388 632 9575**.

**9 lingue · 11 pagine ciascuna · 101 pagine HTML** generate staticamente:
Italiano, English, Français, Español, Português, العربية (da destra a sinistra), Русский, Polski, Ελληνικά.

Niente framework, niente database, nessuna dipendenza da installare: sono file HTML già pronti.
Si aprono all'istante anche con la connessione lenta del telefono di un cliente al tavolo.

---

## I tre codici QR

Sono la parte pratica del sito. I primi due **riconoscono da soli la lingua del telefono**
e aprono la pagina giusta fra le nove disponibili; il terzo collega alla rete Wi-Fi.

| Codice | Dove porta | A cosa serve |
|---|---|---|
| **QR menu** (`/assets/qr/menu.svg`) | `/menu/` | Sui tavoli, in vetrina, sui volantini |
| **QR sito** (`/assets/qr/sito.svg`) | `/` | Biglietti da visita, insegna, social |
| **QR Wi-Fi** (`/assets/qr/wifi.svg`) | la rete del locale | Sui tavoli: il cliente si collega senza chiedere la password |

La pagina **`/it/qr/`** li mostra tutti, con il pulsante per scaricarli o stamparli,
un **segnaposto da tavolo** per il menu e un **cartellino Wi-Fi**, entrambi già
impaginati e pronti da stampare.

Sono immagini vettoriali: restano nitide a qualsiasi dimensione, da un adesivo a un poster.
Dimensione minima consigliata per la stampa: **3 cm di lato**.

> I codici sono generati durante il build da `src/qr.mjs`, un encoder QR scritto da zero
> (correzione d'errore Reed-Solomon, livello H). La correttezza è verificata rileggendo
> gli SVG pubblicati con un lettore QR reale.

### Accendere il QR del Wi-Fi

Il terzo codice **non viene generato finché la rete non è configurata**: meglio
nessun codice che un codice che non collega a niente. Servono due valori in
`src/site.config.json`:

```json
"wifi": { "ssid": "NOME DELLA RETE", "password": "la-password", "security": "WPA", "hidden": false }
```

Poi `node build.mjs` e il QR compare da solo nella pagina dei codici, in tutte e
nove le lingue, insieme al cartellino da tavolo.

- `security`: `WPA` quasi sempre. `WEP` solo su impianti vecchi. `nopass` per una
  rete aperta — in quel caso lascia `password` vuota.
- `hidden`: `true` solo se la rete non trasmette il nome.
- Nome e password possono contenere spazi, accenti e punteggiatura: i caratteri
  che romperebbero il formato (`\ ; , : "`) vengono protetti da soli.

**Una cosa da sapere prima di pubblicarlo.** Il QR contiene la password in
chiaro: chiunque apra il sito può leggerla, non solo chi è seduto al tavolo. Per
una rete ospiti va benissimo — è fatta per essere data a tutti. Se invece è la
stessa rete che usate voi per la cassa o il gestionale, **usane una separata per
i clienti**.

---

## Il logo

Lo stemma dipinto fornito dal titolare: maiolica della Costiera, i Faraglioni,
il forno a legna, il limone. E' un'immagine **raster**, non vettoriale.

| File | A cosa serve |
|---|---|
| `src/assets/logo-crest.png` | Lo stemma scontornato, fondo trasparente. Usato in tutto il sito |
| `src/assets/logo.svg` / `logo.png` | Il solo nome composto, per quando lo stemma non entra |
| `src/assets/favicon.svg` | Icona della scheda del browser: la **C** su fondo blu, bordo terracotta |
| `src/assets/apple-touch-icon.png` | Icona sullo schermo dell'iPhone |

Dove compare: intestazione di tutte le pagine (56 px), pagina di scelta lingua
(grande, e la prima cosa che vede chi inquadra il QR), segnaposto da tavolo e
immagine di anteprima social.

### Due cose da sapere

**Nel logo c'e scritto «RESISTENTE» al posto di «RISTORANTE».** L'errore e
nell'immagine originale e non e correggibile senza rifare il disegno.

**Risoluzione: 426 x 475 pixel.** Basta e avanza per lo schermo, ma e poco per
una stampa grande: su un'insegna o un manifesto si vedrebbero i bordi sgranati.
Per quelli serve il file originale a risoluzione maggiore, o un ridisegno
vettoriale.

Accanto allo stemma resta il nome scritto, perche a 56 px le parole dentro il
disegno non si leggono.

---

## Struttura

```
build.mjs              generatore statico (Node, zero dipendenze)
src/site.config.json   dati dell'attività: indirizzo, telefono, orari, social
src/menu.json          i 70 piatti: nome, prezzo, etichette
src/i18n/<lingua>.json tutti i testi tradotti, una lingua per file
src/qr.mjs             generatore dei codici QR
src/assets/            CSS, JavaScript, favicon, immagine social

# generato automaticamente — da non modificare a mano:
index.html             pagina di scelta lingua (destinazione del QR sito)
menu/index.html        scelta lingua del menu (destinazione del QR menu)
it/ en/ fr/ es/ pt/ ar/ ru/ pl/ el/
assets/                copia di src/assets, più assets/qr/
sitemap.xml robots.txt
```

Ogni lingua ha: **Home · Menu · Chi siamo · Blog (4 articoli) · Domande frequenti · Contatti · Codici QR**.

## Comandi

```bash
node build.mjs      # rigenera tutte le pagine
npm run build       # equivalente
npm run serve       # build + anteprima su http://localhost:3000
```

Su Vercel il deploy è già configurato in `vercel.json`: *Build Command* `node build.mjs`,
*Output Directory* `.` (la radice). Il sito viene quindi rigenerato dai sorgenti a ogni deploy,
e l'HTML committato serve come rete di sicurezza. Senza queste due voci Vercel cerca l'output
in `public/` e la distribuzione fallisce.

---

## Modificare i contenuti

**Cambiare un prezzo o un piatto** → `src/menu.json`, poi `node build.mjs`.
Il prezzo si aggiorna in tutte e nove le lingue insieme, e il QR sui tavoli continua a funzionare:
non c'è nessun menu di carta da ristampare.

**Aggiungere una foto a una categoria del menu** → metti l'immagine in
`src/assets/img/` e aggiungi il campo `photo` alla categoria in `src/menu.json`:

```json
{ "id": "pizza", "icon": "pizza", "photo": "pizza.jpg", "items": [ … ] }
```

La foto compare in testa alla categoria, si carica solo quando serve e si adatta
da sola allo schermo. Formato consigliato: 1600 px di larghezza, orizzontale.

Se parti dalla foto originale del telefono, fai tutto con un comando solo — ci
pensa lui a ruotarla, ridimensionarla, comprimerla e a scrivere il campo `photo`:

```
python3 tools/add-menu-photo.py ~/Download/bistecca.jpg carne
node build.mjs
```

Le categorie disponibili sono `colazione`, `antipasti`, `pasta`, `pizza`,
`carne`, `pesce`, `vegano`, `vegetariano`, `senza-glutine`, `dolci`, `bevande`.
Lo script richiede Pillow (`pip install Pillow`).

**Cambiare orari, telefono, indirizzo, social** → `src/site.config.json`.

**Cambiare un testo** → `src/i18n/<lingua>.json`.

Il build **si ferma con un errore** se in una lingua manca anche un solo testo o la descrizione di un
piatto: non è possibile pubblicare per sbaglio una pagina tradotta a metà.

### Da completare con i dati reali

Tre valori sono impostati con un segnaposto ragionevole e vanno confermati in `src/site.config.json`:

| Voce | Valore attuale | Nota |
|---|---|---|
| `social.facebook` / `social.instagram` | `.../barcapriroma` | Sostituire con gli indirizzi reali (`""` per nascondere il pulsante) |
| `hours` | Bar 7:00–23:30 · Cucina 12:00–15:30 e 18:30–23:00 | Alimenta anche gli orari mostrati a Google |
| `geo` | 41.8973, 12.5028 | Coordinate indicative della via. La mappa incorporata usa l'indirizzo, quindi il segnaposto è già corretto; queste servono solo ai dati strutturati e ai pulsanti Apple Maps/Waze |
| `domain` | `https://www.barcapriroma.it` | Il dominio definitivo: compare in sitemap, link canonici **e nei due QR** |

Cambiando `domain` i codici QR vengono rigenerati automaticamente al build successivo.

---

## Come è fatto

**Ricerca e visibilità.** Ogni pagina ha titolo e descrizione propri, link canonico, `hreflang`
verso le altre otto lingue, anteprima social e dati strutturati `schema.org`: la scheda
`Restaurant` con indirizzo, telefono e orari, il `Menu` completo con i prezzi e le diete,
le `FAQPage`, gli articoli e i percorsi di navigazione. `sitemap.xml` elenca tutte e 100 le pagine.

**Mappa.** Reale, di Google Maps, ma caricata **solo dopo un clic**: finché il visitatore non la
apre, la pagina non contatta alcun servizio esterno. I pulsanti Google Maps, Apple Maps e Waze
funzionano subito.

**Sul telefono.** Barra fissa in basso con *Menu · Chiama · WhatsApp · Mappa*: le quattro cose
che serve davvero fare da un telefono, sempre a portata di pollice.

**Menu.** Ricerca per nome o ingrediente e filtri combinabili: vegano, vegetariano, senza glutine,
piccante, specialità. Le etichette colorate sono su ogni piatto.

**Aperto o chiuso.** Calcolato nel browser sull'ora di Roma, quindi corretto anche per chi guarda
il sito da un altro fuso orario.

**Tema chiaro e scuro**, automatico secondo le impostazioni del telefono e commutabile a mano.

**Senza JavaScript** il sito resta interamente leggibile: menu, prezzi, orari e contatti compresi.

---

© Bar Capri — Via Principe Amedeo 78/80, 00185 Roma
