# BAR CAPRI — sito multilingue

Sito del **Bar Capri**, ristorante e pizzeria in **Via Principe Amedeo 78/80, 00185 Roma**.
Telefono **351 265 0441** · WhatsApp **388 632 9575**.

**9 lingue · 11 pagine ciascuna · 101 pagine HTML** generate staticamente:
Italiano, English, Français, Español, Português, العربية (da destra a sinistra), Русский, Polski, Ελληνικά.

Niente framework, niente database, nessuna dipendenza da installare: sono file HTML già pronti.
Si aprono all'istante anche con la connessione lenta del telefono di un cliente al tavolo.

---

## I due codici QR

Sono la parte pratica del sito. Entrambi **riconoscono da soli la lingua del telefono**
e aprono la pagina giusta fra le nove disponibili.

| Codice | Dove porta | A cosa serve |
|---|---|---|
| **QR menu** (`/assets/qr/menu.svg`) | `/menu/` | Sui tavoli, in vetrina, sui volantini |
| **QR sito** (`/assets/qr/sito.svg`) | `/` | Biglietti da visita, insegna, social |

La pagina **`/it/qr/`** li mostra entrambi, con il pulsante per scaricarli o stamparli
e un **segnaposto da tavolo** già impaginato, pronto da stampare e piegare.

Sono immagini vettoriali: restano nitide a qualsiasi dimensione, da un adesivo a un poster.
Dimensione minima consigliata per la stampa: **3 cm di lato**.

> I codici sono generati durante il build da `src/qr.mjs`, un encoder QR scritto da zero
> (correzione d'errore Reed-Solomon, livello H). La correttezza è verificata rileggendo
> gli SVG pubblicati con un lettore QR reale.

---

## L'identita

Nessun simbolo disegnato: l'identita e il nome. **BAR CAPRI** in un serif
largo, un filetto color limone, e sotto **RISTORANTE · PIZZERIA** ben
spaziato. E la scelta di molte trattorie storiche, e invecchia meglio di un
disegno.

| File | A cosa serve |
|---|---|
| `src/assets/logo.svg` | Il nome composto. Sito, documenti, carta intestata |
| `src/assets/logo.png` | Lo stesso a 2400 px. Volantini, social, stampa veloce |
| `src/assets/favicon.svg` | Icona nella scheda del browser: la **C** su fondo blu |
| `src/assets/apple-touch-icon.png` | Icona sullo schermo dell'iPhone |

Colori: blu profondo `#0d2137`, limone `#ffd23f`, grigio del sottotitolo `#5c6f83`.

Nel file SVG il nome e testo, non tracciati: per l'insegna o la stampa
tipografica chiedi al fornitore di **convertire il testo in curve**, oppure
consegna il `logo.png`, che non ha questo problema.

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
