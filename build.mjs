#!/usr/bin/env node
/**
 * Generatore statico del sito BAR CAPRI.
 *
 * Legge i dati da src/ e produce nella radice del repository una cartella per
 * lingua con HTML gia pronto: nessun framework, nessuna dipendenza, nessuna
 * chiamata a servizi esterni al caricamento della pagina.
 *
 *   node build.mjs
 */

import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { qrSvg } from "./src/qr.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");

/** Lingue pubblicate. L'ordine e quello del selettore e della pagina di ingresso. */
const LANGS = [
  { code: "it", native: "Italiano",  english: "Italian",    dir: "ltr", locale: "it_IT", hreflang: "it" },
  { code: "en", native: "English",   english: "English",    dir: "ltr", locale: "en_GB", hreflang: "en" },
  { code: "fr", native: "Français",  english: "French",     dir: "ltr", locale: "fr_FR", hreflang: "fr" },
  { code: "es", native: "Español",   english: "Spanish",    dir: "ltr", locale: "es_ES", hreflang: "es" },
  { code: "pt", native: "Português", english: "Portuguese", dir: "ltr", locale: "pt_PT", hreflang: "pt" },
  { code: "ar", native: "العربية",    english: "Arabic",     dir: "rtl", locale: "ar_AR", hreflang: "ar" },
  { code: "ru", native: "Русский",   english: "Russian",    dir: "ltr", locale: "ru_RU", hreflang: "ru" },
  { code: "pl", native: "Polski",    english: "Polish",     dir: "ltr", locale: "pl_PL", hreflang: "pl" },
  { code: "el", native: "Ελληνικά",  english: "Greek",      dir: "ltr", locale: "el_GR", hreflang: "el" },
];

/** Gli slug restano uguali in tutte le lingue: il cambio lingua e la sola sostituzione del prefisso. */
const PAGES = [
  { key: "home",     slug: "" },
  { key: "menu",     slug: "menu" },
  { key: "about",    slug: "about" },
  { key: "blog",     slug: "blog" },
  { key: "faq",      slug: "faq" },
  { key: "contacts", slug: "contacts" },
  { key: "qr",       slug: "qr" },
];

const NAV_KEYS = ["menu", "about", "blog", "faq", "contacts"];

/* ------------------------------------------------------------------ utils */

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Testo con un solo markup ammesso: **grassetto**. */
const rich = (v) => esc(v).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

const paragraphs = (list = []) => list.map((p) => `<p>${rich(p)}</p>`).join("\n            ");

const href = (lang, slug) => (slug ? `/${lang}/${slug}/` : `/${lang}/`);

const money = (n) => Number(n).toFixed(2).replace(".", ",");

const attr = (name, value) => (value ? ` ${name}="${esc(value)}"` : "");

/**
 * Isola un valore che va sempre letto da sinistra a destra — numeri di
 * telefono, orari, civici. In una pagina araba, senza questo, l'algoritmo
 * bidirezionale riordina le cifre e il numero diventa sbagliato.
 */
const ltr = (v) => `<bdi dir="ltr">${esc(v)}</bdi>`;


/* ------------------------------------------------------------------ icone */

const ICONS = {
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
  whatsapp: '<path d="M12.04 2A9.9 9.9 0 0 0 2.1 11.9a9.8 9.8 0 0 0 1.4 5.1L2 22l5.2-1.4a9.9 9.9 0 0 0 4.8 1.2h.01A9.9 9.9 0 0 0 22 11.9 9.9 9.9 0 0 0 12.04 2Z"/><path d="M8.6 7.3c.2-.5.4-.5.7-.5h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .6l-.4.5c-.1.2-.3.3-.1.6a7 7 0 0 0 3.2 2.8c.3.1.5.1.6-.1l.6-.7c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.4a2 2 0 0 1-1.3 1.9c-.5.2-1.2.3-3.6-.8a9.6 9.6 0 0 1-4.3-4.3c-.5-1-.7-1.8-.7-2.4a2.6 2.6 0 0 1 .5-1.3Z"/>',
  pin: '<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-6 8-9 16-9 0 8-3 16-9 16Z"/><path d="M4 21c3-6 7-9 12-11"/>',
  sprout: '<path d="M12 21v-8"/><path d="M12 13C12 9 9 6 5 6c0 4 3 7 7 7Z"/><path d="M12 13c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6Z"/>',
  wheat: '<path d="M12 22V9"/><path d="M12 9 8.5 5.5A3 3 0 0 1 12 2a3 3 0 0 1 3.5 3.5Z"/><path d="M12 14 8 11a3 3 0 0 0-2 3.5A3 3 0 0 0 9.5 17Z"/><path d="M12 14l4-3a3 3 0 0 1 2 3.5 3 3 0 0 1-3.5 2.5Z"/>',
  flame: '<path d="M12 22c3.9 0 6-2.6 6-5.8 0-4.3-4.4-5.8-3.5-10.2C11.2 7.5 9 9.6 9 12c-1 0-2-1.2-2-2.8-1.3 1.5-2 3.5-2 5.6C5 19.2 8.1 22 12 22Z"/>',
  pizza: '<path d="M12 2 2.5 20.5a1 1 0 0 0 1.3 1.3L22 12Z"/><circle cx="10" cy="12" r="1.2"/><circle cx="14.5" cy="9" r="1.2"/><circle cx="8" cy="17" r="1.2"/>',
  pasta: '<path d="M4 20h16"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M8 12c0-3 1-6 1-8M12 12c0-3 1-6 1-8M16 12c0-3 1-6 1-8"/>',
  meat: '<path d="M14.5 3.5a5.5 5.5 0 0 0-7.8 7.8l-3.4 3.4a3.5 3.5 0 0 0 5 5l3.4-3.4a5.5 5.5 0 0 0 7.8-7.8Z"/><circle cx="8" cy="16" r="1.6"/>',
  fish: '<path d="M6.5 12c3-4.5 7.5-6 11.5-6 0 4-1.5 8.5-6 11.5-2.5 1.6-5.5 1.5-8 .5 1-2.5 1-5.4.5-6Z"/><path d="M18 6c1-1 3-1.5 4-1.5-.5 1-1 3-2 4"/><circle cx="15" cy="9" r="1"/>',
  coffee: '<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M17 9h2a2.5 2.5 0 0 1 0 5h-2"/><path d="M7 2v3M11 2v3"/>',
  cake: '<path d="M4 21h16v-6a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3Z"/><path d="M4 17c2 0 2-1.5 4-1.5S10 17 12 17s2-1.5 4-1.5S18 17 20 17"/><path d="M12 8V5M8 8V6M16 8V6"/>',
  glass: '<path d="M5 3h14l-1.5 6a5.5 5.5 0 0 1-11 0Z"/><path d="M12 14v7M8 21h8"/>',
  plate: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
  wifi: '<path d="M2 8.8a16 16 0 0 1 20 0M5 12.5a11 11 0 0 1 14 0M8.5 16a6 6 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  users: '<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 20v-2a4 4 0 0 0-3-3.9"/>',
  accessible: '<circle cx="12" cy="4.5" r="1.8"/><path d="M8 8.5h8M12 8.5V14m0 0 3.5 6M12 14l-3.5 6"/>',
  snow: '<path d="M12 2v20M4 6l16 12M20 6 4 18"/>',
  paw: '<circle cx="7" cy="9" r="2"/><circle cx="12" cy="6.5" r="2"/><circle cx="17" cy="9" r="2"/><path d="M12 12c3 0 5 2.2 5 4.6S15 21 12 21s-5-2-5-4.4S9 12 12 12Z"/>',
  bag: '<path d="M6 7h12l1 13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>',
  scooter: '<circle cx="5.5" cy="18" r="2.5"/><circle cx="18.5" cy="18" r="2.5"/><path d="M8 18h8M15 5h3l2 9"/><path d="M6 18c0-5 3-9 8-9"/>',
  tree: '<path d="M12 3 6 12h3l-4 6h14l-4-6h3Z"/><path d="M12 18v3"/>',
  check: '<path d="m5 13 4 4L19 7"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM19 19h2v2h-2zM14 19h2v2h-2zM19 14h2v3h-2z"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M4 19h16"/>',
  facebook: '<path d="M14 8.5V7a1.5 1.5 0 0 1 1.5-1.5H17V2.5h-2.5A4.5 4.5 0 0 0 10 7v1.5H7.5V12H10v9.5h4V12h2.5l.5-3.5Z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
  train: '<rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14M8 20l-2 2M16 20l2 2M9 16h6"/><circle cx="8.5" cy="13" r="1"/><circle cx="15.5" cy="13" r="1"/>',
  arrow: '<path d="M5 12h14m0 0-6-6m6 6-6 6"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22Z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z"/>',
  chef: '<path d="M6 14v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-6"/><path d="M6 14a4 4 0 0 1-1-7.9 4 4 0 0 1 7-2.6 4 4 0 0 1 7 2.6A4 4 0 0 1 18 14Z"/>',
  heart: '<path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.5 2.9C20.5 15 12 20.5 12 20.5Z"/>',
};

const icon = (name, cls = "") =>
  `<svg${cls ? ` class="${cls}"` : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.check}</svg>`;

/* I marchi social vanno disegnati pieni, non a linee come le altre icone:
   dentro un bottone tondo un contorno sottile si perde. Servono percio
   sagome proprie — quelle di ICONS sono line art e riempite diventano
   macchie (il rettangolo di Instagram si chiude in un quadrato). */
const SOCIAL_ICONS = {
  facebook: '<path d="M14 8.5V7a1.5 1.5 0 0 1 1.5-1.5H17V2.5h-2.5A4.5 4.5 0 0 0 10 7v1.5H7.5V12H10v9.5h4V12h2.5l.5-3.5Z"/>',
  instagram:
    '<path fill-rule="evenodd" d="M8 2h8a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6Zm0 2a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4H8Zm4 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm5.2-3.8a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z"/>',
};

/** Icone piene, per i marchi social. */
const solidIcon = (name) =>
  `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${SOCIAL_ICONS[name] || ICONS[name] || ICONS.check}</svg>`;

/* --------------------------------------------------------------- frammenti */

/** Numero di telefono e WhatsApp, i due gesti piu frequenti su mobile. */
const actionButtons = (ctx, { light = false } = {}) => {
  const { t, config } = ctx;
  const cls = light ? "btn-light" : "btn-primary";
  return `<a class="btn ${cls}" href="tel:${esc(config.contact.phoneHref)}" data-track="call">${icon("phone")}<span>${esc(t.ui.call)}</span></a>
            <a class="btn ${light ? "btn-outline-light" : "btn-whatsapp"}" href="https://wa.me/${esc(config.contact.whatsappHref)}" target="_blank" rel="noopener">${icon("whatsapp")}<span>${esc(t.ui.whatsapp)}</span></a>`;
};

/** Etichette vegano / vegetariano / senza glutine / piccante / specialita. */
const tagChips = (tags, t) =>
  (tags || [])
    .map((tag) => `<span class="chip chip-${tag}" title="${esc(t.tags[tag])}">${icon(TAG_ICON[tag])}<span>${esc(t.tags[tag])}</span></span>`)
    .join("");

const TAG_ICON = { vg: "leaf", v: "sprout", gf: "wheat", sp: "flame", chef: "star" };

const sectionHead = (s, wrap = true) => {
  const eyebrow = s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : "";
  const heading = s.title ? `<h2>${rich(s.title)}</h2>` : "";
  const lead = s.lead ? `<p class="lead">${rich(s.lead)}</p>` : "";
  if (!eyebrow && !heading && !lead) return "";
  const inner = [eyebrow, heading, lead].filter(Boolean).join("\n          ");
  return wrap ? `<div class="section-head reveal">\n          ${inner}\n        </div>` : inner;
};

const section = (inner, { id = "", alt = false, tone = "", tight = false } = {}) =>
  `      <section class="section${alt ? " section-alt" : ""}${tight ? " section-tight" : ""}${tone ? ` section-${tone}` : ""}"${id ? ` id="${esc(id)}"` : ""}>
        <div class="wrap">${inner}
        </div>
      </section>`;

/* ------------------------------------------------------------------ blocchi */

/** Apertura: titolo grande, due gesti, e le informazioni che servono subito. */
function heroBlock(ctx) {
  const { t, config, lang } = ctx;
  const h = t.home.hero;
  return `      <section class="hero" id="hero">
        <div class="hero-art" aria-hidden="true">
          <span class="hero-glow hero-glow-a"></span>
          <span class="hero-glow hero-glow-b"></span>
          <span class="hero-grain"></span>
        </div>
        <div class="wrap hero-inner">
          <img class="hero-crest" src="/assets/logo-crest.png" alt="${esc(config.brand.display)}" width="426" height="475" decoding="async">
          <div class="hero-chips">
            <p class="hero-kicker">${icon("pin")}<span>${ltr(config.contact.street)} · ${esc(config.contact.city)}</span></p>
            <p class="hero-kicker hero-kicker-accent">${icon("chef")}<span>${esc(t.features.items.italian)}</span></p>
          </div>
          <h1 class="hero-title">${esc(h.title)} <em>${esc(h.titleAccent)}</em></h1>
          <p class="hero-lead">${rich(h.lead)}</p>
          <div class="hero-actions">
            <a class="btn btn-primary btn-lg" href="${href(lang, "menu")}">${icon("book")}<span>${esc(h.ctaPrimary)}</span></a>
            ${actionButtons(ctx)}
          </div>
          <dl class="hero-facts">
            <div><dt>${icon("clock")}${esc(t.ui.today)}</dt><dd data-hours-today>—</dd></div>
            <div><dt>${icon("train")}${esc(t.home.strip.walkLabel)}</dt><dd>${esc(t.home.strip.walk)}</dd></div>
            <div><dt>${icon("phone")}${esc(t.ui.phone)}</dt><dd><a href="tel:${esc(config.contact.phoneHref)}">${ltr(config.contact.phone)}</a></dd></div>
          </dl>
        </div>
        <a class="hero-scroll" href="#dopo-hero" aria-label="${esc(t.ui.scroll)}">${icon("chevron")}</a>
      </section>`;
}

/** Striscia con lo stato di apertura calcolato nel browser. */
function statusStrip(ctx) {
  const { t, config, lang } = ctx;
  return `      <div class="strip" id="dopo-hero">
        <div class="wrap strip-inner">
          <p class="strip-status" data-open-status><span class="dot"></span><span data-open-text>—</span></p>
          <p class="strip-item">${icon("pin")}<a href="${href(lang, "contacts")}">${esc(config.contact.street)}, ${esc(config.contact.postalCode)} ${esc(config.contact.city)}</a></p>
          <p class="strip-item">${icon("qr")}<a href="${href(lang, "qr")}">${esc(t.ui.qrStrip)}</a></p>
        </div>
      </div>`;
}

/** Griglia di carte con icona: i motivi per entrare. */
function cardsBlock(ctx, data, opts = {}) {
  return section(`
        ${sectionHead(data)}
        <div class="grid grid-${data.items.length % 4 === 0 ? 4 : 3}">
          ${data.items.map((i) => `<article class="card reveal">
            <span class="card-icon">${icon(i.icon)}</span>
            <h3>${esc(i.title)}</h3>
            <p>${rich(i.text)}</p>
          </article>`).join("\n          ")}
        </div>`, opts);
}

/** Anteprima del menu: le categorie e i piatti della casa. */
function menuPreviewBlock(ctx) {
  const { t, menu, lang } = ctx;
  const specials = [];
  for (const cat of menu.categories) {
    for (const item of cat.items) if ((item.tags || []).includes("chef")) specials.push({ ...item, cat: cat.id });
  }
  return section(`
        ${sectionHead(t.home.menuPreview)}
        <div class="cat-tiles">
          ${menu.categories.map((c) => `<a class="cat-tile reveal" href="${href(lang, "menu")}#cat-${esc(c.id)}">
            <span class="cat-tile-icon">${icon(c.icon)}</span>
            <span class="cat-tile-name">${esc(t.categories[c.id].name)}</span>
            <span class="cat-tile-count">${c.items.length}</span>
          </a>`).join("\n          ")}
        </div>
        <h3 class="subhead reveal">${icon("star")}${esc(t.home.menuPreview.specialsTitle)}</h3>
        <div class="dish-grid">
          ${specials.map((d) => dishCard(d, ctx)).join("\n          ")}
        </div>
        <p class="center reveal"><a class="btn btn-primary btn-lg" href="${href(lang, "menu")}">${esc(t.home.menuPreview.cta)}${icon("arrow")}</a></p>`, { id: "menu-preview" });
}

/** Scheda di un piatto, usata in anteprima e nel menu completo. */
function dishCard(item, ctx, level = 4) {
  const { t } = ctx;
  const d = t.dishes[item.id] || {};
  // Il secondo nome si mostra solo se dice davvero qualcosa di diverso:
  // "Tonnarelli Cacio e Pepe" con sotto "Tonnarelli cacio e pepe" sembra
  // un errore di stampa, non una traduzione.
  const nudo = (v) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();
  const localName = d.name && nudo(d.name) !== nudo(item.name) ? `<span class="dish-alt">${esc(d.name)}</span>` : "";
  return `<article class="dish reveal" data-tags="${esc((item.tags || []).join(" "))}" data-search="${esc(`${item.name} ${d.name || ""} ${d.desc || ""}`.toLowerCase())}">
            <div class="dish-top">
              <h${level} class="dish-name">${esc(item.name)}${localName}</h${level}>
              <span class="dish-price"><bdi dir="ltr">€&nbsp;${money(item.price)}</bdi></span>
            </div>
            ${d.desc ? `<p class="dish-desc">${esc(d.desc)}</p>` : ""}
            ${(item.tags || []).length ? `<div class="dish-tags">${tagChips(item.tags, t)}</div>` : ""}
          </article>`;
}

/** Menu completo con ricerca, filtri e indice delle categorie. */
function menuFullBlock(ctx) {
  const { t, menu } = ctx;
  const filterTags = ["vg", "v", "gf", "sp", "chef"];
  return `      <section class="section menu-section" id="menu-completo">
        <div class="wrap">
          <div class="menu-tools" data-menu-tools>
            <div class="menu-search">
              ${icon("search", "search-icon")}
              <input type="search" id="dish-search" placeholder="${esc(t.ui.search)}" aria-label="${esc(t.ui.search)}" autocomplete="off">
            </div>
            <div class="menu-filters" role="group" aria-label="${esc(t.ui.filters)}">
              <button type="button" class="filter is-active" data-filter="all">${esc(t.ui.all)}</button>
              ${filterTags.map((tag) => `<button type="button" class="filter filter-${tag}" data-filter="${tag}">${icon(TAG_ICON[tag])}<span>${esc(t.tags[tag])}</span></button>`).join("\n              ")}
            </div>
          </div>
          <nav class="cat-nav" aria-label="${esc(t.ui.categories)}">
            ${menu.categories.map((c) => `<a href="#cat-${esc(c.id)}" data-cat-link="${esc(c.id)}">${icon(c.icon)}<span>${esc(t.categories[c.id].name)}</span></a>`).join("\n            ")}
          </nav>
          <p class="menu-empty" data-menu-empty hidden>${esc(t.ui.noResults)}</p>
          ${menu.categories.map((c) => `
          <div class="menu-cat" id="cat-${esc(c.id)}" data-cat="${esc(c.id)}">${c.photo ? `
            <figure class="menu-cat-photo reveal">
              <img src="/assets/img/${esc(c.photo)}" alt="${esc(t.categories[c.id].name)}" loading="lazy" decoding="async" width="1600" height="900">
            </figure>` : ""}
            <div class="menu-cat-head reveal">
              <span class="menu-cat-icon">${icon(c.icon)}</span>
              <div>
                <h2>${esc(t.categories[c.id].name)}</h2>
                ${t.categories[c.id].lead ? `<p>${esc(t.categories[c.id].lead)}</p>` : ""}
              </div>
            </div>
            <div class="dish-grid">
              ${c.items.map((i) => dishCard(i, ctx, 3)).join("\n              ")}
            </div>
          </div>`).join("")}
          <p class="menu-note">${icon("wheat")}<span>${rich(t.menu.allergenNote)}</span></p>
          <p class="menu-note">${icon("card")}<span>${rich(t.menu.priceNote)}</span></p>
        </div>
      </section>`;
}

/** Testo lungo con pannello laterale. */
function storyBlock(ctx, data, opts = {}) {
  return section(`
        <div class="split">
          <div class="reveal">
            ${sectionHead(data, false)}
            <div class="prose">
            ${paragraphs(data.body)}
            </div>
          </div>
          <aside class="panel reveal">
            <h3>${esc(data.panelTitle)}</h3>
            <ul class="ticks">
              ${data.panelItems.map((i) => `<li>${icon("check")}<span>${rich(i)}</span></li>`).join("\n              ")}
            </ul>
          </aside>
        </div>`, opts);
}

/** Servizi disponibili, come pastiglie. */
function featuresBlock(ctx, opts = {}) {
  const { t, config } = ctx;
  return section(`
        ${sectionHead(t.features)}
        <ul class="feature-chips">
          ${config.features.map((f) => `<li class="reveal">${icon(FEATURE_ICON[f] || "check")}<span>${esc(t.features.items[f])}</span></li>`).join("\n          ")}
        </ul>`, opts);
}

const FEATURE_ICON = {
  italian: "chef", wifi: "wifi", outdoor: "tree", takeaway: "bag", delivery: "scooter", cards: "card",
  family: "users", accessible: "accessible", airCon: "snow", petFriendly: "paw", groups: "users",
};

/** Orari giorno per giorno; il giorno corrente viene evidenziato dal browser. */
function hoursBlock(ctx, { compact = false } = {}) {
  const { t, config } = ctx;
  const bar = config.hours.bar;
  const [lunch, dinner] = config.hours.kitchen;
  const rows = [1, 2, 3, 4, 5, 6, 0].map((day) => `
            <tr data-day="${day}">
              <th scope="row">${esc(t.days[day])}</th>
              <td data-label="${esc(t.ui.bar)}"><span class="hours-val">${ltr(`${bar.opens} – ${bar.closes}`)}</span></td>
              <td data-label="${esc(t.ui.kitchen)}"><span class="hours-val">${ltr(`${lunch.opens} – ${lunch.closes}`)} · ${ltr(`${dinner.opens} – ${dinner.closes}`)}</span></td>
            </tr>`).join("");
  return `<div class="hours-card${compact ? " is-compact" : ""}">
            <div class="hours-status" data-open-status>
              <span class="dot"></span><span data-open-text>—</span>
            </div>
            <table class="hours-table">
              <caption class="sr-only">${esc(t.contacts.hoursTitle)}</caption>
              <thead><tr><th scope="col">${esc(t.ui.day)}</th><th scope="col">${icon("coffee")}${esc(t.ui.bar)}</th><th scope="col">${icon("plate")}${esc(t.ui.kitchen)}</th></tr></thead>
              <tbody>${rows}
              </tbody>
            </table>
            <p class="hours-note">${rich(t.contacts.hoursNote)}</p>
          </div>`;
}

/**
 * Mappa reale. L'iframe di Google Maps viene caricato solo dopo un clic:
 * la pagina non contatta servizi esterni finche non lo chiede il visitatore.
 */
function mapBlock(ctx, { height = "reg" } = {}) {
  const { t, config, lang } = ctx;
  const query = encodeURIComponent(`${config.contact.street}, ${config.contact.postalCode} ${config.contact.city}, ${config.contact.country}`);
  const embed = `https://maps.google.com/maps?q=${query}&hl=${lang}&z=17&output=embed`;
  const { lat, lng } = config.geo;
  return `<div class="map map-${height}" data-map data-embed="${esc(embed)}">
            <div class="map-placeholder">
              <svg class="map-sketch" viewBox="0 0 400 260" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
                <rect width="400" height="260" fill="var(--map-bg)"/>
                <g stroke="var(--map-road)" fill="none" stroke-width="10" stroke-linecap="round">
                  <path d="M-10 90 H410"/><path d="M-10 190 H410"/><path d="M70 -10 V270"/><path d="M250 -10 V270"/><path d="M-10 250 L410 40"/>
                </g>
                <g stroke="var(--map-road2)" fill="none" stroke-width="4">
                  <path d="M150 -10 V270"/><path d="M330 -10 V270"/><path d="M-10 140 H410"/>
                </g>
                <g fill="var(--map-block)">
                  <rect x="86" y="104" width="50" height="24" rx="3"/><rect x="166" y="104" width="70" height="24" rx="3"/>
                  <rect x="266" y="104" width="50" height="24" rx="3"/><rect x="86" y="154" width="50" height="22" rx="3"/>
                  <rect x="166" y="154" width="70" height="22" rx="3"/><rect x="266" y="154" width="50" height="22" rx="3"/>
                </g>
              </svg>
              <div class="map-pin-fixed">${icon("pin")}</div>
              <div class="map-cta">
                <p class="map-address"><strong>${esc(config.brand.display)}</strong><br>${ltr(config.contact.street)}<br>${ltr(config.contact.postalCode)} ${esc(config.contact.city)}</p>
                <button type="button" class="btn btn-primary" data-map-load>${icon("pin")}<span>${esc(t.ui.showMap)}</span></button>
                <p class="map-consent">${esc(t.ui.mapConsent)}</p>
              </div>
            </div>
          </div>
          <div class="map-links">
            <a class="btn btn-ghost" href="https://www.google.com/maps/search/?api=1&query=${query}" target="_blank" rel="noopener">${icon("pin")}<span>Google Maps</span></a>
            <a class="btn btn-ghost" href="https://maps.apple.com/?q=${query}&ll=${lat},${lng}" target="_blank" rel="noopener">${icon("pin")}<span>Apple Maps</span></a>
            <a class="btn btn-ghost" href="https://waze.com/ul?ll=${lat},${lng}&navigate=yes" target="_blank" rel="noopener">${icon("arrow")}<span>Waze</span></a>
          </div>`;
}

/** Domande frequenti, aperte una alla volta. */
function faqBlock(ctx, items, data, opts = {}) {
  return section(`
        ${sectionHead(data)}
        <div class="faq" data-faq>
          ${items.map((i, n) => `<details class="reveal"${n === 0 ? " open" : ""}>
            <summary>${esc(i.q)}${icon("chevron", "faq-caret")}</summary>
            <div class="answer">${paragraphs([i.a])}</div>
          </details>`).join("\n          ")}
        </div>`, opts);
}

/** Elenco degli articoli del blog. */
function blogListBlock(ctx, opts = {}) {
  const { t, lang } = ctx;
  return section(`
        <div class="post-grid">
          ${t.blog.posts.map((p) => `<article class="post-card reveal">
            <span class="post-tag">${esc(p.tag)}</span>
            <h2><a href="${href(lang, `blog/${p.slug}`)}">${esc(p.title)}</a></h2>
            <p class="post-meta"><time datetime="${esc(p.date)}">${esc(formatDate(p.date, lang))}</time> · ${readingTime(p)} ${esc(t.ui.minRead)}</p>
            <p>${esc(p.excerpt)}</p>
            <a class="post-more" href="${href(lang, `blog/${p.slug}`)}">${esc(t.ui.readMore)}${icon("arrow")}</a>
          </article>`).join("\n          ")}
        </div>`, opts);
}

const readingTime = (post) =>
  Math.max(1, Math.ceil(post.body.join(" ").split(/\s+/).length / 180));

const formatDate = (iso, lang) => {
  try {
    return new Intl.DateTimeFormat(lang, { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  } catch { return iso; }
};

/** Recapiti: indirizzo, telefono, orari. */
function contactCardsBlock(ctx, opts = {}) {
  const { t, config } = ctx;
  const social = Object.entries(config.social).filter(([, v]) => v);
  return section(`
        ${sectionHead(t.contacts.intro)}
        <div class="contact-grid">
          <div class="contact-card reveal">
            <span class="card-icon">${icon("pin")}</span>
            <h3>${esc(t.ui.address)}</h3>
            <address>${ltr(config.contact.street)}<br>${ltr(config.contact.postalCode)} ${esc(config.contact.city)}<br>${esc(config.contact.country)}</address>
            <p class="contact-sub">${esc(t.contacts.nearTermini)}</p>
          </div>
          <div class="contact-card reveal">
            <span class="card-icon">${icon("phone")}</span>
            <h3>${esc(t.ui.phone)}</h3>
            <p class="contact-big"><a href="tel:${esc(config.contact.phoneHref)}">${ltr(config.contact.phone)}</a></p>
            <p><a class="contact-wa" href="https://wa.me/${esc(config.contact.whatsappHref)}" target="_blank" rel="noopener">${icon("whatsapp")}WhatsApp ${ltr(config.contact.whatsapp)}</a></p>
            <p class="contact-sub">${esc(t.contacts.phoneNote)}</p>
          </div>
          <div class="contact-card reveal">
            <span class="card-icon">${icon("clock")}</span>
            <h3>${esc(t.contacts.hoursTitle)}</h3>
            ${hoursBlock(ctx, { compact: true })}
          </div>
        </div>
        ${social.length ? `<div class="social-row reveal">
          <span>${esc(t.ui.follow)}</span>
          ${social.map(([k, v]) => `<a class="social-btn social-${k}" href="${esc(v)}" target="_blank" rel="noopener" aria-label="${esc(k)}">${solidIcon(k)}</a>`).join("\n          ")}
        </div>` : ""}`, opts);
}

/** Come arrivare: mezzi e punti di riferimento. */
function nearbyBlock(ctx, opts = {}) {
  const { t, config } = ctx;
  return section(`
        ${sectionHead(t.contacts.nearby)}
        <ul class="nearby">
          ${config.nearby.map((n, i) => `<li class="reveal">${icon(i === 0 || i === 4 ? "train" : "pin")}<span class="nearby-name">${esc(n.name)}</span><span class="nearby-walk">${n.walk} ${esc(t.ui.minWalk)}</span></li>`).join("\n          ")}
        </ul>`, opts);
}

/** I due codici QR: uno per il menu al tavolo, uno per il sito. */
function qrBlock(ctx, opts = {}) {
  const { t, qr } = ctx;
  const KIND_ICON = { menu: "book", site: "globe", wifi: "wifi", review: "star" };
  const KIND_LABEL = { menu: "menuKind", site: "siteKind", wifi: "wifiKind", review: "reviewKind" };
  const card = (kind, title, text, url, svg, file) => `<article class="qr-card reveal">
            <div class="qr-card-head">
              <span class="qr-kind">${icon(KIND_ICON[kind])}${esc(t.qr[KIND_LABEL[kind]])}</span>
              <h3>${esc(title)}</h3>
              <p>${esc(text)}</p>
            </div>
            <div class="qr-frame">${svg}</div>
            <p class="qr-url">${kind === "wifi"
              ? `${esc(t.qr.wifiNetwork)}: <strong>${esc(url)}</strong>`
              : `<a href="${esc(url)}">${esc(url.replace(/^https?:\/\//, ""))}</a>`}</p>
            <div class="qr-actions">
              <a class="btn btn-ghost" href="/assets/qr/${file}.svg" download>${icon("download")}<span>SVG</span></a>
              <button type="button" class="btn btn-ghost" data-print-qr="${kind}">${icon("print")}<span>${esc(t.ui.print)}</span></button>
            </div>
          </article>`;
  return section(`
        ${sectionHead(t.qr.intro)}
        <div class="qr-grid">
          ${card("menu", t.qr.menuTitle, t.qr.menuText, qr.menuUrl, qr.menuSvg, "menu")}
          ${card("site", t.qr.siteTitle, t.qr.siteText, qr.siteUrl, qr.siteSvg, "sito")}
          ${qr.wifiSvg ? card("wifi", t.qr.wifiTitle, t.qr.wifiText, qr.wifi.ssid, qr.wifiSvg, "wifi") : ""}
          ${qr.reviewSvg ? card("review", t.qr.reviewTitle, t.qr.reviewText, qr.reviewUrl, qr.reviewSvg, "recensioni") : ""}
        </div>
        <div class="qr-how reveal">
          <h3>${esc(t.qr.howTitle)}</h3>
          <ol class="steps">
            ${t.qr.how.map((s) => `<li><h4>${esc(s.title)}</h4><p>${rich(s.text)}</p></li>`).join("\n            ")}
          </ol>
        </div>`, opts);
}

/** Il segnaposto da stampare e appoggiare sui tavoli. */
function qrPrintable(ctx) {
  const { t, config, qr } = ctx;
  return `      <section class="print-area" id="print-area">
        <div class="wrap">
          <h2 class="reveal">${esc(t.qr.tentTitle)}</h2>
          <p class="lead reveal">${rich(t.qr.tentText)}</p>
          <div class="tent" id="tent">
            <div class="tent-face">
              <img class="tent-crest" src="/assets/logo-crest.png" alt="" width="426" height="475">
              <p class="tent-brand">${esc(config.brand.display)}</p>
              <p class="tent-sub">${esc(t.qr.tentSub)}</p>
              <div class="tent-qr">${qr.menuSvg}</div>
              <p class="tent-scan">${esc(t.qr.tentScan)}</p>
              <p class="tent-langs">${LANGS.map((l) => esc(l.native)).join(" · ")}</p>
              <p class="tent-foot">${ltr(config.contact.street)} · ${esc(config.contact.city)} · ${ltr(config.contact.phone)}</p>
            </div>
          </div>
          <p class="center"><button type="button" class="btn btn-primary btn-lg" data-print-tent="tent">${icon("print")}<span>${esc(t.qr.tentPrint)}</span></button></p>
${qr.wifiSvg ? `
          <div class="wifi-block reveal">
            <h2>${esc(t.qr.wifiCardTitle)}</h2>
            <p class="lead">${rich(t.qr.wifiCardText)}</p>
            <div class="tent">
              <div class="tent-face wifi-face" id="wifi-card">
                <p class="wifi-eyebrow">${icon("wifi")}<span>${esc(t.qr.wifiFree)}</span></p>
                <p class="tent-brand">${esc(config.brand.display)}</p>
                <div class="tent-qr">${qr.wifiSvg}</div>
                <p class="tent-scan">${esc(t.qr.wifiScan)}</p>
                <dl class="wifi-data">
                  <dt>${esc(t.qr.wifiNetwork)}</dt><dd>${ltr(qr.wifi.ssid)}</dd>
                  ${qr.wifi.password ? `<dt>${esc(t.qr.wifiPassword)}</dt><dd>${ltr(qr.wifi.password)}</dd>` : ""}
                </dl>
                <p class="tent-foot">${ltr(config.contact.street)} · ${esc(config.contact.city)}</p>
              </div>
            </div>
            <p class="center"><button type="button" class="btn btn-primary btn-lg" data-print-tent="wifi-card">${icon("print")}<span>${esc(t.qr.wifiCardPrint)}</span></button></p>
          </div>` : ""}
${qr.reviewSvg ? `
          <div class="wifi-block reveal">
            <h2>${esc(t.qr.reviewCardTitle)}</h2>
            <p class="lead">${rich(t.qr.reviewCardText)}</p>
            <div class="tent">
              <div class="tent-face wifi-face" id="review-card">
                <p class="wifi-eyebrow">${icon("star")}<span>${esc(t.qr.reviewHead)}</span></p>
                <p class="tent-brand">${esc(config.brand.display)}</p>
                <div class="tent-qr">${qr.reviewSvg}</div>
                <p class="tent-scan">${esc(t.qr.reviewScan)}</p>
                <p class="tent-foot">${ltr(config.contact.street)} · ${esc(config.contact.city)}</p>
              </div>
            </div>
            <p class="center"><button type="button" class="btn btn-primary btn-lg" data-print-tent="review-card">${icon("print")}<span>${esc(t.qr.reviewCardPrint)}</span></button></p>
          </div>` : ""}
        </div>
      </section>`;
}

/** Fascia finale con l'invito ad agire. */
function ctaBlock(ctx, data) {
  return `      <section class="cta-band">
        <div class="wrap cta-inner">
          <div class="reveal">
            <h2>${esc(data.title)}</h2>
            <p>${rich(data.text)}</p>
          </div>
          <div class="cta-actions reveal">
            ${actionButtons(ctx, { light: true })}
          </div>
        </div>
      </section>`;
}

/** Testata delle pagine interne. */
function pageHeader(ctx, data) {
  const { t, lang } = ctx;
  const crumbs = `<nav class="crumbs" aria-label="breadcrumb"><a href="${href(lang, "")}">${esc(t.nav.home)}</a>${icon("chevron")}<span>${esc(data.crumb || data.title)}</span></nav>`;
  return `      <section class="page-head">
        <div class="wrap">
          ${crumbs}
          <h1>${esc(data.title)}</h1>
          ${data.lead ? `<p class="lead">${rich(data.lead)}</p>` : ""}
        </div>
      </section>`;
}

/* ------------------------------------------------------------ dati strutturati */

const OPEN_DAYS = { 0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday" };

const DIET = { vg: "https://schema.org/VeganDiet", v: "https://schema.org/VegetarianDiet", gf: "https://schema.org/GlutenFreeDiet" };

/** Scheda dell'attivita: e cio che Google usa per la ricerca locale e le mappe. */
function restaurantSchema(ctx) {
  const { config, lang, t } = ctx;
  const base = config.domain;
  const bar = config.hours.bar;
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${base}/#restaurant`,
    name: config.brand.display,
    alternateName: config.brand.name,
    description: t.pages.home.description,
    url: `${base}${href(lang, "")}`,
    image: `${base}/assets/og.png`,
    logo: `${base}/assets/favicon.svg`,
    telephone: config.contact.phoneHref,
    priceRange: config.business.priceRange,
    currenciesAccepted: config.business.currency,
    paymentAccepted: config.business.payments.join(", "),
    servesCuisine: config.business.cuisine,
    acceptsReservations: config.business.acceptsReservations,
    hasMenu: `${base}${href(lang, "menu")}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: config.contact.street,
      postalCode: config.contact.postalCode,
      addressLocality: config.contact.city,
      addressRegion: config.contact.region,
      addressCountry: config.contact.countryCode,
    },
    geo: { "@type": "GeoCoordinates", latitude: config.geo.lat, longitude: config.geo.lng },
    openingHoursSpecification: bar.days.map((d) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${OPEN_DAYS[d]}`,
      opens: bar.opens,
      closes: bar.closes,
    })),
    sameAs: Object.values(config.social).filter(Boolean),
  };
}

/** Il menu completo, leggibile dai motori di ricerca. */
function menuSchema(ctx) {
  const { config, menu, t, lang } = ctx;
  return {
    "@context": "https://schema.org",
    "@type": "Menu",
    "@id": `${config.domain}${href(lang, "menu")}#menu`,
    name: t.pages.menu.title,
    inLanguage: lang,
    hasMenuSection: menu.categories.map((c) => ({
      "@type": "MenuSection",
      name: t.categories[c.id].name,
      description: t.categories[c.id].lead || undefined,
      hasMenuItem: c.items.map((i) => {
        const d = t.dishes[i.id] || {};
        const diets = (i.tags || []).map((tag) => DIET[tag]).filter(Boolean);
        return {
          "@type": "MenuItem",
          name: i.name,
          description: d.desc || undefined,
          offers: { "@type": "Offer", price: i.price.toFixed(2), priceCurrency: config.business.currency },
          ...(diets.length ? { suitableForDiet: diets } : {}),
        };
      }),
    })),
  };
}

const faqSchema = (items) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((i) => ({
    "@type": "Question",
    name: i.q,
    acceptedAnswer: { "@type": "Answer", text: i.a },
  })),
});

const breadcrumbSchema = (ctx, trail) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: trail.map((c, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: c.name,
    item: `${ctx.config.domain}${c.url}`,
  })),
});

const postSchema = (ctx, post) => ({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: post.title,
  description: post.excerpt,
  datePublished: post.date,
  dateModified: post.date,
  inLanguage: ctx.lang,
  author: { "@type": "Organization", name: ctx.config.brand.display },
  publisher: { "@type": "Organization", name: ctx.config.brand.display, logo: { "@type": "ImageObject", url: `${ctx.config.domain}/assets/favicon.svg` } },
  mainEntityOfPage: `${ctx.config.domain}${href(ctx.lang, `blog/${post.slug}`)}`,
});

const jsonLd = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj, null, 0).replace(/</g, "\\u003c")}</script>`;

/* ------------------------------------------------------------------- guscio */

/** Intestazione con navigazione, selettore di lingua e tema. */
function header(ctx) {
  const { t, lang, config, pageKey, slug } = ctx;
  const navLinks = NAV_KEYS.map((k) => {
    const page = PAGES.find((p) => p.key === k);
    const current = k === pageKey;
    return `<a href="${href(lang, page.slug)}"${current ? ' aria-current="page"' : ""}>${esc(t.nav[k])}</a>`;
  }).join("\n            ");

  const langLinks = LANGS.map((l) => {
    const current = l.code === lang;
    return `<a href="${href(l.code, slug)}" lang="${l.code}" hreflang="${l.hreflang}"${current ? ' aria-current="true"' : ""}><span>${esc(l.native)}</span><span class="lang-en">${esc(l.english)}</span></a>`;
  }).join("\n              ");

  return `    <header class="site-head" data-head>
      <div class="wrap head-inner">
        <a class="logo" href="${href(lang, "")}" aria-label="${esc(config.brand.display)}">
          <img class="logo-crest" src="/assets/logo-crest.png" alt="" width="426" height="475" decoding="async">
          <span class="logo-text"><strong>${esc(config.brand.display)}</strong><small>${esc(t.ui.tagline)}</small></span>
        </a>

        <nav class="head-nav" aria-label="${esc(t.ui.mainNav)}">
            ${navLinks}
        </nav>

        <div class="head-tools">
          <div class="lang-switch" data-lang-switch>
            <button type="button" class="lang-btn" aria-expanded="false" aria-haspopup="true">${icon("globe")}<span>${esc(LANGS.find((l) => l.code === lang).native)}</span>${icon("chevron", "caret")}</button>
            <div class="lang-menu" role="menu" hidden>
              <p class="lang-menu-title">${esc(t.ui.chooseLanguage)}</p>
              ${langLinks}
            </div>
          </div>
          <button type="button" class="icon-btn" data-theme-toggle aria-label="${esc(t.ui.theme)}">${icon("sun", "i-sun")}${icon("moon", "i-moon")}</button>
          <a class="btn btn-primary btn-sm head-call" href="tel:${esc(config.contact.phoneHref)}">${icon("phone")}<span>${esc(t.ui.call)}</span></a>
          <button type="button" class="icon-btn burger" data-nav-toggle aria-expanded="false" aria-label="${esc(t.ui.openMenu)}"><span></span><span></span><span></span></button>
        </div>
      </div>
    </header>

    <div class="mobile-nav" data-mobile-nav hidden>
      <nav aria-label="${esc(t.ui.mainNav)}">
        <a href="${href(lang, "")}">${esc(t.nav.home)}</a>
        ${NAV_KEYS.map((k) => `<a href="${href(lang, PAGES.find((p) => p.key === k).slug)}">${esc(t.nav[k])}</a>`).join("\n        ")}
        <a href="${href(lang, "qr")}">${esc(t.nav.qr)}</a>
      </nav>
      <div class="mobile-nav-actions">${actionButtons(ctx)}</div>
    </div>`;
}

/** Barra fissa in basso su telefono: le azioni che servono davvero. */
function actionBar(ctx) {
  const { t, config, lang } = ctx;
  const query = encodeURIComponent(`${config.contact.street}, ${config.contact.postalCode} ${config.contact.city}`);
  return `    <nav class="action-bar" aria-label="${esc(t.ui.quickActions)}">
      <a href="${href(lang, "menu")}">${icon("book")}<span>${esc(t.nav.menu)}</span></a>
      <a href="tel:${esc(config.contact.phoneHref)}">${icon("phone")}<span>${esc(t.ui.call)}</span></a>
      <a class="ab-wa" href="https://wa.me/${esc(config.contact.whatsappHref)}" target="_blank" rel="noopener">${icon("whatsapp")}<span>WhatsApp</span></a>
      <a href="https://www.google.com/maps/search/?api=1&query=${query}" target="_blank" rel="noopener">${icon("pin")}<span>${esc(t.ui.map)}</span></a>
    </nav>`;
}

function footer(ctx) {
  const { t, config, lang, slug } = ctx;
  const social = Object.entries(config.social).filter(([, v]) => v);
  return `    <footer class="site-foot">
      <div class="wrap foot-grid">
        <div class="foot-brand">
          <p class="foot-name">${esc(config.brand.display)}</p>
          <p class="foot-tagline">${esc(t.footer.tagline)}</p>
          <address>
            ${ltr(config.contact.street)}<br>
            ${ltr(config.contact.postalCode)} ${esc(config.contact.city)}, ${esc(config.contact.country)}<br>
            <a href="tel:${esc(config.contact.phoneHref)}">${ltr(config.contact.phone)}</a> ·
            <a href="https://wa.me/${esc(config.contact.whatsappHref)}" target="_blank" rel="noopener">WhatsApp ${ltr(config.contact.whatsapp)}</a>
          </address>
          ${social.length ? `<div class="foot-social">
            ${social.map(([k, v]) => `<a href="${esc(v)}" target="_blank" rel="noopener" aria-label="${esc(k)}">${solidIcon(k)}</a>`).join("\n            ")}
          </div>` : ""}
        </div>
        <div class="foot-col">
          <h3>${esc(t.footer.navTitle)}</h3>
          <ul>
            <li><a href="${href(lang, "")}">${esc(t.nav.home)}</a></li>
            ${NAV_KEYS.map((k) => `<li><a href="${href(lang, PAGES.find((p) => p.key === k).slug)}">${esc(t.nav[k])}</a></li>`).join("\n            ")}
            <li><a href="${href(lang, "qr")}">${esc(t.nav.qr)}</a></li>
          </ul>
        </div>
        <div class="foot-col">
          <h3>${esc(t.footer.hoursTitle)}</h3>
          <p class="foot-hours"><strong>${esc(t.ui.bar)}</strong><br>${ltr(`${config.hours.bar.opens} – ${config.hours.bar.closes}`)}</p>
          <p class="foot-hours"><strong>${esc(t.ui.kitchen)}</strong><br>${ltr(`${config.hours.kitchen[0].opens} – ${config.hours.kitchen[0].closes}`)}<br>${ltr(`${config.hours.kitchen[1].opens} – ${config.hours.kitchen[1].closes}`)}</p>
        </div>
        <div class="foot-col foot-langs">
          <h3>${esc(t.ui.chooseLanguage)}</h3>
          <ul>
            ${LANGS.map((l) => `<li><a href="${href(l.code, slug)}" lang="${l.code}" hreflang="${l.hreflang}"${l.code === lang ? ' aria-current="true"' : ""}>${esc(l.native)}</a></li>`).join("\n            ")}
          </ul>
        </div>
      </div>
      <div class="wrap foot-legal">
        <p>© ${new Date().getFullYear()} ${esc(config.brand.display)} — ${esc(t.footer.rights)}</p>
        <p>${esc(t.footer.made)}</p>
      </div>
    </footer>`;
}

/** Documento completo. */
function shell(ctx, { title, description, body, schemas = [], canonicalSlug }) {
  const { lang, config } = ctx;
  const l = LANGS.find((x) => x.code === lang);
  const slug = canonicalSlug ?? ctx.slug;
  const canonical = `${config.domain}${href(lang, slug)}`;
  // Il nome del locale si aggiunge solo se il titolo resta leggibile nei
  // risultati di ricerca: Google ne mostra una sessantina di caratteri.
  const suffix = ` · ${config.brand.display}`;
  const fullTitle = title.length + suffix.length <= 65 ? title + suffix : title;

  const alternates = LANGS.map((x) => `    <link rel="alternate" hreflang="${x.hreflang}" href="${config.domain}${href(x.code, slug)}">`).join("\n");

  return `<!doctype html>
<html lang="${lang}" dir="${l.dir}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>${esc(fullTitle)}</title>
    <meta name="description" content="${esc(description)}">
    <link rel="canonical" href="${canonical}">
${alternates}
    <link rel="alternate" hreflang="x-default" href="${config.domain}/">
    <meta name="theme-color" content="#0d2137" media="(prefers-color-scheme: dark)">
    <meta name="theme-color" content="#fdf8f0" media="(prefers-color-scheme: light)">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta name="format-detection" content="telephone=yes">
    <meta property="og:type" content="${ctx.pageKey === "blogPost" ? "article" : "website"}">
    <meta property="og:site_name" content="${esc(config.brand.display)}">
    <meta property="og:title" content="${esc(fullTitle)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:locale" content="${l.locale}">
${LANGS.filter((x) => x.code !== lang).map((x) => `    <meta property="og:locale:alternate" content="${x.locale}">`).join("\n")}
    <meta property="og:image" content="${config.domain}/assets/og.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(fullTitle)}">
    <meta name="twitter:description" content="${esc(description)}">
    <meta name="twitter:image" content="${config.domain}/assets/og.png">
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
    <link rel="manifest" href="/assets/site.webmanifest">
    <link rel="stylesheet" href="/assets/css/style.css">
    <script>${THEME_BOOT}</script>
${schemas.map((s) => `    ${jsonLd(s)}`).join("\n")}
</head>
<body data-page="${esc(ctx.pageKey)}">
    <a class="skip" href="#main">${esc(ctx.t.ui.skipToContent)}</a>
${header(ctx)}
    <main id="main">
${body}
    </main>
${footer(ctx)}
${actionBar(ctx)}
    <button type="button" class="to-top" data-to-top aria-label="${esc(ctx.t.ui.backTop)}">${icon("chevron")}</button>
    <script>window.CAPRI=${JSON.stringify({
      hours: config.hours,
      strings: {
        openNow: ctx.t.ui.openNow,
        closedNow: ctx.t.ui.closedNow,
        opensAt: ctx.t.ui.opensAt,
        closesAt: ctx.t.ui.closesAt,
      },
    }).replace(/</g, "\\u003c")}</script>
    <script src="/assets/js/site.js" defer></script>
</body>
</html>
`;
}

/** Applica il tema salvato prima del primo disegno, per evitare il lampo bianco. */
const THEME_BOOT = `document.documentElement.classList.add("js");try{var t=localStorage.getItem("capri-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t;}catch(e){}`;

/* --------------------------------------------------------------- le pagine */

/** Orari e mappa affiancati: tutto quello che serve per venire. */
function visitBlock(ctx) {
  const { t } = ctx;
  return section(`
        ${sectionHead(t.home.visit)}
        <div class="visit">
          <div class="reveal">${hoursBlock(ctx)}</div>
          <div class="reveal">${mapBlock(ctx)}</div>
        </div>`, { alt: true, id: "orari" });
}

const buildHome = (ctx) => [
  heroBlock(ctx),
  statusStrip(ctx),
  cardsBlock(ctx, ctx.t.home.highlights),
  menuPreviewBlock(ctx),
  storyBlock(ctx, ctx.t.home.story, { alt: true }),
  visitBlock(ctx),
  featuresBlock(ctx),
  ctaBlock(ctx, ctx.t.home.cta),
].join("\n");

const buildMenu = (ctx) => [
  pageHeader(ctx, { title: ctx.t.pages.menu.title, lead: ctx.t.menu.lead }),
  menuFullBlock(ctx),
  ctaBlock(ctx, ctx.t.menu.cta),
].join("\n");

const buildAbout = (ctx) => [
  pageHeader(ctx, { title: ctx.t.pages.about.title, lead: ctx.t.about.lead }),
  storyBlock(ctx, ctx.t.about.story),
  cardsBlock(ctx, ctx.t.about.values, { alt: true }),
  featuresBlock(ctx),
  ctaBlock(ctx, ctx.t.about.cta),
].join("\n");

const buildBlog = (ctx) => [
  pageHeader(ctx, { title: ctx.t.pages.blog.title, lead: ctx.t.blog.lead }),
  blogListBlock(ctx, { tight: true }),
  ctaBlock(ctx, ctx.t.blog.cta),
].join("\n");

function buildPost(ctx, post) {
  const { t, lang } = ctx;
  const others = t.blog.posts.filter((p) => p.slug !== post.slug).slice(0, 3);
  return [
    `      <article class="post">
        <div class="wrap post-wrap">
          <nav class="crumbs" aria-label="breadcrumb"><a href="${href(lang, "")}">${esc(t.nav.home)}</a>${icon("chevron")}<a href="${href(lang, "blog")}">${esc(t.nav.blog)}</a>${icon("chevron")}<span>${esc(post.title)}</span></nav>
          <span class="post-tag">${esc(post.tag)}</span>
          <h1>${esc(post.title)}</h1>
          <p class="post-meta"><time datetime="${esc(post.date)}">${esc(formatDate(post.date, lang))}</time> · ${readingTime(post)} ${esc(t.ui.minRead)}</p>
          <p class="post-lead">${rich(post.excerpt)}</p>
          <div class="prose post-body">
            ${post.body.map((b) => (b.startsWith("## ") ? `<h2>${esc(b.slice(3))}</h2>` : `<p>${rich(b)}</p>`)).join("\n            ")}
          </div>
          <p class="post-back"><a class="btn btn-ghost" href="${href(lang, "blog")}">${icon("chevron", "flip")}<span>${esc(t.ui.backToBlog)}</span></a></p>
        </div>
      </article>`,
    others.length ? section(`
        ${sectionHead({ title: t.blog.moreTitle })}
        <div class="post-grid">
          ${others.map((p) => `<article class="post-card reveal">
            <span class="post-tag">${esc(p.tag)}</span>
            <h3><a href="${href(lang, `blog/${p.slug}`)}">${esc(p.title)}</a></h3>
            <p>${esc(p.excerpt)}</p>
          </article>`).join("\n          ")}
        </div>`, { alt: true }) : "",
    ctaBlock(ctx, t.blog.cta),
  ].join("\n");
}

const buildFaq = (ctx) => [
  pageHeader(ctx, { title: ctx.t.pages.faq.title, lead: ctx.t.faq.lead }),
  faqBlock(ctx, ctx.t.faq.items, {}, { tight: true }),
  ctaBlock(ctx, ctx.t.faq.cta),
].join("\n");

const buildContacts = (ctx) => [
  pageHeader(ctx, { title: ctx.t.pages.contacts.title, lead: ctx.t.contacts.lead }),
  contactCardsBlock(ctx),
  section(`
        ${sectionHead(ctx.t.contacts.mapTitle)}
        ${mapBlock(ctx, { height: "big" })}`, { alt: true, id: "mappa" }),
  nearbyBlock(ctx),
  ctaBlock(ctx, ctx.t.contacts.cta),
].join("\n");

const buildQr = (ctx) => [
  pageHeader(ctx, { title: ctx.t.pages.qr.title, lead: ctx.t.qr.lead }),
  qrBlock(ctx),
  qrPrintable(ctx),
  ctaBlock(ctx, ctx.t.qr.cta),
].join("\n");

const BUILDERS = { home: buildHome, menu: buildMenu, about: buildAbout, blog: buildBlog, faq: buildFaq, contacts: buildContacts, qr: buildQr };

/** Dati strutturati specifici per pagina. */
function schemasFor(ctx) {
  const { t, lang, pageKey, slug } = ctx;
  const list = [restaurantSchema(ctx)];
  if (pageKey === "menu") list.push(menuSchema(ctx));
  if (pageKey === "faq") list.push(faqSchema(t.faq.items));
  if (pageKey !== "home") {
    list.push(breadcrumbSchema(ctx, [
      { name: t.nav.home, url: href(lang, "") },
      { name: t.pages[pageKey].title, url: href(lang, slug) },
    ]));
  }
  return list;
}

/* ------------------------------------------------------------- validazione */

const REQUIRED_UI = [
  "call", "whatsapp", "phone", "address", "hours", "bar", "kitchen", "day", "today", "map", "follow",
  "search", "filters", "all", "categories", "noResults", "print", "readMore", "backToBlog", "minRead",
  "minWalk", "openNow", "closedNow", "opensAt", "closesAt", "chooseLanguage", "theme", "backTop",
  "openMenu", "mainNav", "quickActions", "skipToContent", "scroll", "tagline", "qrStrip", "showMap", "mapConsent",
];

/** Il sito esce solo se tutte le lingue hanno tutti i testi: nessuna pagina a meta. */
function validate(t, lang, menu) {
  const missing = [];
  const need = (path) => {
    const value = path.split(".").reduce((o, k) => (o == null ? o : o[k]), t);
    if (value == null || value === "") missing.push(path);
  };

  for (const k of REQUIRED_UI) need(`ui.${k}`);
  for (const p of PAGES) { need(`pages.${p.key}.title`); need(`pages.${p.key}.description`); }
  for (const k of [...NAV_KEYS, "home", "qr"]) need(`nav.${k}`);
  for (const k of ["vg", "v", "gf", "sp", "chef"]) need(`tags.${k}`);
  if (!Array.isArray(t.days) || t.days.length !== 7) missing.push("days (servono 7 voci)");

  for (const c of menu.categories) {
    need(`categories.${c.id}.name`);
    for (const i of c.items) if (!t.dishes?.[i.id]?.desc && !NO_DESC.has(c.id)) missing.push(`dishes.${i.id}.desc`);
  }
  if (lang !== "it") {
    for (const c of menu.categories) for (const i of c.items) if (!t.dishes?.[i.id]?.name) missing.push(`dishes.${i.id}.name`);
  }

  for (const k of ["home.hero.title", "home.hero.lead", "home.highlights.items", "home.story.body",
                   "menu.lead", "about.story.body", "blog.posts", "faq.items", "contacts.lead",
                   "qr.menuTitle", "qr.siteTitle", "qr.how", "footer.tagline", "features.items",
                   "qr.wifiKind", "qr.wifiTitle", "qr.wifiText", "qr.wifiNetwork", "qr.wifiPassword",
                   "qr.wifiScan", "qr.wifiFree", "qr.wifiCardTitle", "qr.wifiCardText", "qr.wifiCardPrint",
                   "qr.reviewKind", "qr.reviewTitle", "qr.reviewText", "qr.reviewHead", "qr.reviewScan",
                   "qr.reviewCardTitle", "qr.reviewCardText", "qr.reviewCardPrint"]) need(k);

  if (Array.isArray(t.blog?.posts) && t.blog.posts.length !== POST_SLUGS.length) missing.push(`blog.posts: attesi ${POST_SLUGS.length} articoli, trovati ${t.blog.posts.length}`);
  if (Array.isArray(t.blog?.posts)) {
    t.blog.posts.forEach((p, i) => {
      for (const k of ["slug", "title", "date", "excerpt", "tag"]) if (!p[k]) missing.push(`blog.posts[${i}].${k}`);
      if (p.slug && !POST_SLUGS.includes(p.slug)) missing.push(`blog.posts[${i}].slug "${p.slug}" non e fra quelli previsti (${POST_SLUGS.join(", ")})`);
      if (!Array.isArray(p.body) || !p.body.length) missing.push(`blog.posts[${i}].body`);
    });
  }
  if (t.features?.items) for (const f of CONFIG_FEATURES) if (!t.features.items[f]) missing.push(`features.items.${f}`);

  if (missing.length) {
    throw new Error(`Lingua "${lang}": mancano ${missing.length} testi:\n  - ${missing.slice(0, 25).join("\n  - ")}${missing.length > 25 ? `\n  ... e altri ${missing.length - 25}` : ""}`);
  }
}

/** Categorie di sole bevande: il nome basta, la descrizione no. */
const NO_DESC = new Set(["bevande", "colazione"]);
let CONFIG_FEATURES = [];

/* ------------------------------------------------- pagine di primo livello */

/**
 * Pagina di ingresso: sceglie la lingua. Chi arriva dal QR viene portato
 * subito nella lingua del proprio telefono; i collegamenti restano visibili
 * per i motori di ricerca e per chi ha JavaScript disattivato.
 */
function languageGate(config, dict, { target = "", title, sub, description }) {
  const codes = LANGS.map((l) => l.code);
  const links = LANGS.map((l) => {
    const t = dict[l.code];
    return `      <a class="gate-lang" href="${href(l.code, target)}" lang="${l.code}" hreflang="${l.hreflang}" dir="${l.dir}">
        <span class="gate-native">${esc(l.native)}</span>
        <span class="gate-label">${esc(t.gate.enter)}</span>
      </a>`;
  }).join("\n");

  const alternates = LANGS.map((l) => `    <link rel="alternate" hreflang="${l.hreflang}" href="${config.domain}${href(l.code, target)}">`).join("\n");

  return `<!doctype html>
<html lang="it">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <link rel="canonical" href="${config.domain}/${target ? `${target}/` : ""}">
${alternates}
    <link rel="alternate" hreflang="x-default" href="${config.domain}/${target ? `${target}/` : ""}">
    <meta name="theme-color" content="#0d2137">
    <meta name="robots" content="index,follow,max-image-preview:large">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${esc(config.brand.display)}">
    <meta property="og:locale" content="it_IT">
${LANGS.filter((l) => l.code !== "it").map((l) => `    <meta property="og:locale:alternate" content="${l.locale}">`).join("\n")}
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:image" content="${config.domain}/assets/og.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="${config.domain}/${target ? `${target}/` : ""}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(description)}">
    <meta name="twitter:image" content="${config.domain}/assets/og.png">
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
    <link rel="manifest" href="/assets/site.webmanifest">
    <link rel="stylesheet" href="/assets/css/style.css">
    <script>
    (function () {
      var codes = ${JSON.stringify(codes)};
      var target = ${JSON.stringify(target ? `${target}/` : "")};
      try {
        if (location.search.indexOf("scegli") > -1) return;
        var saved = localStorage.getItem("capri-lang");
        var wanted = saved && codes.indexOf(saved) > -1 ? saved : null;
        if (!wanted) {
          var prefs = navigator.languages || [navigator.language || ""];
          for (var i = 0; i < prefs.length && !wanted; i++) {
            var code = String(prefs[i]).slice(0, 2).toLowerCase();
            if (codes.indexOf(code) > -1) wanted = code;
          }
        }
        if (wanted) location.replace("/" + wanted + "/" + target);
      } catch (e) {}
    })();
    </script>
</head>
<body class="gate-body">
    <main class="gate">
      <img class="gate-crest" src="/assets/logo-crest.png" alt="${esc(config.brand.display)}" width="426" height="475" decoding="async">
      <h1>${esc(config.brand.display)}</h1>
      <p class="gate-sub">${esc(sub)}</p>
      <p class="gate-addr">${ltr(config.contact.street)} · ${ltr(config.contact.postalCode)} ${esc(config.contact.city)}</p>
      <div class="gate-grid">
${links}
      </div>
      <div class="gate-actions">
        <a class="btn btn-primary" href="tel:${esc(config.contact.phoneHref)}">${ltr(config.contact.phone)}</a>
        <a class="btn btn-ghost" href="https://wa.me/${esc(config.contact.whatsappHref)}" target="_blank" rel="noopener">WhatsApp</a>
      </div>
    </main>
</body>
</html>
`;
}

/**
 * La stringa che un telefono riconosce come "collegati a questa rete".
 * Formato standard WIFI:, letto da iPhone e Android senza applicazioni.
 * Dentro il nome e la password i caratteri  \\ ; , : "  vanno protetti,
 * altrimenti spezzano i campi e il QR porta a una rete sbagliata.
 */
const wifiPayload = (wifi) => {
  const q = (v) => String(v ?? "").replace(/([\\;,:"])/g, "\\$1");
  const sicurezza = wifi.password ? (wifi.security || "WPA") : "nopass";
  return `WIFI:T:${sicurezza};S:${q(wifi.ssid)};${wifi.password ? `P:${q(wifi.password)};` : ""}${wifi.hidden ? "H:true;" : ""};`;
};

/** Gli articoli hanno lo stesso slug in tutte le lingue: gli hreflang combaciano sempre. */
const POST_SLUGS = ["carbonara-vera", "pizza-romana-napoletana", "senza-glutine-roma", "mangiare-vicino-termini"];

const sitemap = (config, dict) => {
  const urls = [];
  const push = (loc, priority, changefreq, alternates) =>
    urls.push(`  <url>
    <loc>${config.domain}${loc}</loc>
${alternates.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${config.domain}${a.loc}"/>`).join("\n")}
    <xhtml:link rel="alternate" hreflang="x-default" href="${config.domain}/"/>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`);

  push("/", "1.0", "monthly", LANGS.map((l) => ({ hreflang: l.hreflang, loc: href(l.code, "") })));
  push("/menu/", "0.9", "monthly", LANGS.map((l) => ({ hreflang: l.hreflang, loc: href(l.code, "menu") })));

  for (const page of PAGES) {
    const alternates = LANGS.map((l) => ({ hreflang: l.hreflang, loc: href(l.code, page.slug) }));
    const priority = page.key === "home" ? "1.0" : page.key === "menu" ? "0.9" : "0.7";
    for (const l of LANGS) push(href(l.code, page.slug), priority, page.key === "blog" ? "weekly" : "monthly", alternates);
  }

  for (const slug of POST_SLUGS) {
    const alternates = LANGS.map((l) => ({ hreflang: l.hreflang, loc: href(l.code, `blog/${slug}`) }));
    for (const l of LANGS) push(href(l.code, `blog/${slug}`), "0.6", "monthly", alternates);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;
};

const robots = (config) => `User-agent: *
Allow: /

Sitemap: ${config.domain}/sitemap.xml
`;

const webmanifest = (config) => JSON.stringify({
  name: config.brand.display,
  short_name: config.brand.shortName,
  start_url: "/",
  display: "standalone",
  background_color: "#fdf8f0",
  theme_color: "#0d2137",
  icons: [
    { src: "/assets/favicon.svg", sizes: "any", type: "image/svg+xml" },
    { src: "/assets/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  ],
}, null, 2);

/* --------------------------------------------------------------------- main */

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

async function writePage(path, html) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, html, "utf8");
}

async function main() {
  const config = await readJson(join(SRC, "site.config.json"));
  const menu = await readJson(join(SRC, "menu.json"));
  CONFIG_FEATURES = config.features;

  const dict = {};
  for (const l of LANGS) dict[l.code] = await readJson(join(SRC, "i18n", `${l.code}.json`));
  for (const l of LANGS) validate(dict[l.code], l.code, menu);

  // I due codici QR: il menu al tavolo e il sito. Puntano alle pagine senza
  // prefisso di lingua, che riconoscono da sole la lingua del telefono.
  const menuUrl = `${config.domain}/menu/`;
  const siteUrl = `${config.domain}/`;
  const qrOptions = { ecl: "H", border: 4, dark: "#0d2137", light: "#ffffff" };
  const qr = {
    menuUrl,
    siteUrl,
    menuSvg: qrSvg(menuUrl, { ...qrOptions, label: `QR menu ${config.brand.display}` }),
    siteSvg: qrSvg(siteUrl, { ...qrOptions, label: `QR ${config.brand.display}` }),
  };
  // Il terzo QR nasce solo se la rete e stata configurata: meglio nessun
  // codice che un codice che non collega a niente.
  const wifi = config.wifi || {};
  if (wifi.ssid) {
    qr.wifi = wifi;
    qr.wifiSvg = qrSvg(wifiPayload(wifi), { ...qrOptions, label: `QR Wi-Fi ${config.brand.display}` });
  }
  // Il QR delle recensioni: stessa regola, nasce solo se il link c'e.
  const recensione = config.review?.google;
  if (recensione) {
    qr.reviewUrl = recensione;
    qr.reviewSvg = qrSvg(recensione, { ...qrOptions, label: `QR recensioni ${config.brand.display}` });
  }

  // Pulizia dell'output precedente.
  for (const l of LANGS) await rm(join(ROOT, l.code), { recursive: true, force: true });
  for (const p of ["assets", "menu", "index.html", "sitemap.xml", "robots.txt"]) {
    await rm(join(ROOT, p), { recursive: true, force: true });
  }

  await cp(join(SRC, "assets"), join(ROOT, "assets"), { recursive: true });
  await mkdir(join(ROOT, "assets", "qr"), { recursive: true });
  await writeFile(join(ROOT, "assets", "qr", "menu.svg"), qr.menuSvg, "utf8");
  await writeFile(join(ROOT, "assets", "qr", "sito.svg"), qr.siteSvg, "utf8");
  if (qr.wifiSvg) await writeFile(join(ROOT, "assets", "qr", "wifi.svg"), qr.wifiSvg, "utf8");
  if (qr.reviewSvg) await writeFile(join(ROOT, "assets", "qr", "recensioni.svg"), qr.reviewSvg, "utf8");
  await writeFile(join(ROOT, "assets", "site.webmanifest"), webmanifest(config), "utf8");

  let pageCount = 0;
  for (const l of LANGS) {
    const t = dict[l.code];

    for (const page of PAGES) {
      const ctx = { lang: l.code, t, config, menu, qr, pageKey: page.key, slug: page.slug };
      const html = shell(ctx, {
        // seoTitle, se c'e, vale solo per la scheda del browser e per Google:
        // il titolo visibile in pagina e nelle briciole di pane resta breve.
        title: t.pages[page.key].seoTitle || t.pages[page.key].title,
        description: t.pages[page.key].description,
        body: BUILDERS[page.key](ctx),
        schemas: schemasFor(ctx),
      });
      await writePage(join(ROOT, l.code, page.slug, "index.html"), html);
      pageCount++;
    }

    for (const post of t.blog.posts) {
      const slug = `blog/${post.slug}`;
      const ctx = { lang: l.code, t, config, menu, qr, pageKey: "blogPost", slug };
      const html = shell(ctx, {
        title: post.title,
        description: post.excerpt,
        body: buildPost(ctx, post),
        canonicalSlug: slug,
        schemas: [
          restaurantSchema(ctx),
          postSchema(ctx, post),
          breadcrumbSchema(ctx, [
            { name: t.nav.home, url: href(l.code, "") },
            { name: t.nav.blog, url: href(l.code, "blog") },
            { name: post.title, url: href(l.code, slug) },
          ]),
        ],
      });
      await writePage(join(ROOT, l.code, slug, "index.html"), html);
      pageCount++;
    }
  }

  // Ingressi senza lingua: /  e  /menu/  (sono le destinazioni dei due QR).
  await writePage(join(ROOT, "index.html"), languageGate(config, dict, {
    target: "",
    title: `${config.brand.display} — ${dict.it.gate.title}`,
    sub: dict.en.gate.sub,
    description: dict.it.gate.description,
  }));
  await writePage(join(ROOT, "menu", "index.html"), languageGate(config, dict, {
    target: "menu",
    title: `${dict.it.gate.menuTitle} — ${config.brand.display}`,
    sub: dict.en.gate.menuSub,
    description: dict.it.gate.menuDescription,
  }));

  await writeFile(join(ROOT, "sitemap.xml"), sitemap(config, dict), "utf8");
  await writeFile(join(ROOT, "robots.txt"), robots(config), "utf8");

  console.log(`BAR CAPRI — sito generato`);
  console.log(`  lingue:   ${LANGS.length} (${LANGS.map((l) => l.code).join(", ")})`);
  console.log(`  pagine:   ${pageCount + 2} (comprese le due di ingresso senza lingua)`);
  console.log(`  piatti:   ${menu.categories.reduce((n, c) => n + c.items.length, 0)} in ${menu.categories.length} categorie`);
  console.log(`  QR:       ${qr.menuUrl}  ·  ${qr.siteUrl}`);
}

main().catch((err) => {
  console.error(`\nBuild interrotta:\n${err.message}\n`);
  process.exit(1);
});
