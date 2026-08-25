# EL MAIN LIL SINAA — sito multilingue (المعين للصناعة)

Sito statico per il mercato **algerino**: raccolta, tracciabilità e valorizzazione degli
oli usati (lubrificanti e alimentari) per le imprese, più una sezione di **campagna di
comunicazione ambientale** rivolta al pubblico algerino.

**5 lingue · 10 pagine ciascuna · 50 pagine HTML** generate staticamente:
عربية (RTL), Français, English, Italiano, Deutsch.

---

## Struttura

```
build.mjs              generatore statico (Node, zero dipendenze)
src/site.config.json   dati globali: dominio, nome azienda, recapiti
src/i18n/<lang>.json   tutti i testi, una lingua per file
src/assets/            CSS, JS e favicon sorgente
vercel.json            configurazione deploy (trailing slash, header, cache)

# output generato — da non modificare a mano:
index.html             pagina di scelta lingua
ar/ fr/ en/ it/ de/    una cartella per lingua
assets/                copia di src/assets
sitemap.xml robots.txt
```

## Comandi

```bash
node build.mjs      # rigenera tutte le pagine
npm run build       # equivalente
npm run serve       # build + server locale su http://localhost:3000
```

Su Vercel non serve alcun build step: l'HTML è già committato nel repository.
Se preferisci generarlo in fase di deploy, imposta *Build Command* = `node build.mjs`
e *Output Directory* = `.`.

## Modificare i contenuti

Tutti i testi stanno in `src/i18n/<lingua>.json`. Ogni pagina è una lista di sezioni;
il tipo di sezione decide il layout:

| tipo | resa |
|---|---|
| `stats` | fascia di numeri chiave |
| `cards` | griglia di schede con icona |
| `text` | titolo + paragrafi |
| `split` | testo + riquadro laterale |
| `steps` | elenco numerato |
| `norms` | elenco di riferimenti normativi con etichetta |
| `slogans` | slogan in arabo + traduzione + nota d'uso |
| `regions` | griglia della copertura territoriale |
| `faq` | accordion di domande e risposte |
| `contacts` / `form` | recapiti e modulo |
| `sources` | elenco di fonti esterne |
| `cta` | banda di invito all'azione |

Nel testo è ammesso solo `**grassetto**`. Gli slug delle pagine sono identici in tutte
le lingue (`/ar/rules/`, `/fr/rules/`, …), così il cambio lingua resta sulla stessa
pagina e gli `hreflang` combaciano.

Per aggiungere una lingua: crea `src/i18n/<code>.json` e aggiungi una riga in `LANGS`
dentro `build.mjs` (`dir: "rtl"` se necessario). Il build fallisce se una lingua ha
pagine o voci di menu mancanti.

## Da sostituire prima della pubblicazione

Il sito è completo ma i dati identificativi sono **segnaposto**:

- `src/site.config.json` — dominio, indirizzo, telefono, e-mail (`@example.dz`), NIF e RC
- logo: `src/assets/favicon.svg` e il simbolo inline in `build.mjs` (costante `logo`)
- città elencate nella sezione "copertura territoriale" di ogni lingua
- il modulo contatti è solo interfaccia: collegalo a Vercel Forms, Formspree o a un'API
- verifica i riferimenti normativi sul **JORADP** prima di pubblicarli come informazione
  ufficiale (in fondo alla pagina "Normativa" ci sono i link alle fonti usate)

## Fonti dei dati citati

- Agence Nationale des Déchets — <https://and.dz/presentation/cadre-institutionnel-et-reglementaire/>
- Legge 25-02 (JORADP n. 12/2025), testo integrale in PDF
- Décret exécutif n° 13-176 — CNTPP
- Ministère de l'Environnement — <https://www.me.gov.dz/fr/dechets-et-recyclage/>
- Taxes écologiques — ONEDD — <https://onedd.org/taxes-ecologiques/>

## Accessibilità e resa

Skip link, landmark semantici, `aria-current`, menu mobile e selettore lingua
accessibili da tastiera, contrasti verificati, supporto tema chiaro/scuro,
`prefers-reduced-motion` e stile di stampa. L'arabo usa proprietà CSS logiche:
lo stesso foglio di stile serve LTR e RTL senza duplicazioni.
