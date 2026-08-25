#!/usr/bin/env node
/**
 * Generatore statico del sito OLEA.
 *
 * Legge le traduzioni da src/i18n/<lang>.json e produce, nella radice del
 * repository, una cartella per lingua (/it, /en, /fr, /de, /ar) con HTML già
 * pronto: nessun runtime, nessuna dipendenza, deploy statico su Vercel.
 *
 *   node build.mjs
 */

import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");

/** Lingue pubblicate. L'ordine è quello del selettore e della pagina di ingresso. */
const LANGS = [
  { code: "it", native: "Italiano", english: "Italian", dir: "ltr", locale: "it_IT" },
  { code: "en", native: "English", english: "English", dir: "ltr", locale: "en_GB" },
  { code: "fr", native: "Français", english: "French", dir: "ltr", locale: "fr_FR" },
  { code: "de", native: "Deutsch", english: "German", dir: "ltr", locale: "de_DE" },
  { code: "ar", native: "العربية", english: "Arabic", dir: "rtl", locale: "ar_AR" },
];

/**
 * Pagine del sito. Gli slug restano identici in tutte le lingue: così il
 * cambio lingua è la semplice sostituzione del prefisso e gli hreflang
 * combaciano sempre.
 */
const PAGES = [
  { key: "home", slug: "" },
  { key: "about", slug: "about" },
  { key: "rules", slug: "rules" },
  { key: "contribution", slug: "environmental-contribution" },
  { key: "companies", slug: "companies" },
  { key: "associations", slug: "partners" },
  { key: "campaign", slug: "campaign" },
  { key: "membership", slug: "membership" },
  { key: "contacts", slug: "contacts" },
  { key: "faq", slug: "faq" },
];

/** Voci mostrate nella barra di navigazione (l'ordine è quello del menu). */
const NAV_KEYS = ["about", "rules", "contribution", "companies", "associations", "campaign", "membership", "contacts", "faq"];

/* ------------------------------------------------------------------ utils */

const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Testo con un solo markup ammesso: **grassetto**. */
const rich = (value) =>
  esc(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

const paragraphs = (list = []) => list.map((p) => `<p>${rich(p)}</p>`).join("\n            ");

const href = (lang, slug) => (slug ? `/${lang}/${slug}/` : `/${lang}/`);

const ICONS = {
  collect: '<path d="M3 7h18M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-9 0 1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12"/>',
  recycle: '<path d="m7 19-3-5 3-5m-3 5h9m4-9 3 5-3 5m3-5h-9m-1 9 3 5h6"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.2 8.4 8 9 4.8-.6 8-4.5 8-9V6l-8-3Z"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  users: '<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 20v-2a4 4 0 0 0-3-3.9"/>',
  factory: '<path d="M3 20h18M4 20V9l6 4V9l6 4V6h4v14"/>',
  drop: '<path d="M12 3s6 6.3 6 10.2A6 6 0 0 1 6 13.2C6 9.3 12 3 12 3Z"/>',
  chart: '<path d="M4 20V10m5 10V4m5 16v-7m5 7V8"/>',
  map: '<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  euro: '<path d="M17 6.5A6.5 6.5 0 0 0 7.2 10M17 17.5A6.5 6.5 0 0 1 7.2 14M4 10h8M4 14h8"/>',
  check: '<path d="m5 13 4 4L19 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};

const icon = (name) => {
  const path = ICONS[name] || ICONS.check;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
};

/* --------------------------------------------------------------- sections */

const sectionRenderers = {
  stats: (s) => `
        <div class="stats">
          ${s.items.map((i) => `<div class="stat">
            <div class="stat-value">${esc(i.value)}</div>
            <div class="stat-label">${esc(i.label)}</div>
          </div>`).join("\n          ")}
        </div>`,

  text: (s) => `
        ${sectionHead(s)}
        <div class="prose">
            ${paragraphs(s.body)}
        </div>`,

  cards: (s) => `
        ${sectionHead(s)}
        <div class="grid grid-${s.columns || 3}">
          ${s.items.map((i) => `<article class="card">
            <div class="card-icon">${icon(i.icon)}</div>
            <h3>${esc(i.title)}</h3>
            <p>${rich(i.text)}</p>
          </article>`).join("\n          ")}
        </div>`,

  split: (s) => `
        <div class="split">
          <div>
            ${sectionHead(s, false)}
            ${paragraphs(s.body)}
          </div>
          <aside class="panel">
            <h3>${esc(s.panel.title)}</h3>
            <ul>
              ${s.panel.items.map((i) => `<li>${rich(i)}</li>`).join("\n              ")}
            </ul>
          </aside>
        </div>`,

  steps: (s) => `
        ${sectionHead(s)}
        <ol class="steps">
          ${s.items.map((i) => `<li>
            <h3>${esc(i.title)}</h3>
            <p>${rich(i.text)}</p>
          </li>`).join("\n          ")}
        </ol>`,

  norms: (s) => `
        ${sectionHead(s)}
        <ul class="norms">
          ${s.items.map((i) => `<li>
            <span class="tag">${esc(i.tag)}</span>
            <h3>${esc(i.title)}</h3>
            <p>${rich(i.text)}</p>${i.href ? `
            <p class="norm-link"><a href="${esc(i.href)}" rel="noopener noreferrer" target="_blank">${esc(i.linkLabel)}</a></p>` : ""}
          </li>`).join("\n          ")}
        </ul>`,

  slogans: (s) => `
        ${sectionHead(s)}
        <div class="slogans">
          ${s.items.map((i) => `<blockquote class="slogan">
            <p class="slogan-ar" lang="ar" dir="rtl">${esc(i.ar)}</p>
            <p class="slogan-local">${esc(i.local)}</p>
            <p class="slogan-note">${esc(i.note)}</p>
          </blockquote>`).join("\n          ")}
        </div>`,

  regions: (s) => `
        ${sectionHead(s)}
        <ul class="regions">
          ${s.items.map((i) => `<li>${esc(i.title)}<span class="region-sub">${esc(i.sub)}</span></li>`).join("\n          ")}
        </ul>${s.note ? `
        <p class="note">${rich(s.note)}</p>` : ""}`,

  sources: (s) => `
        ${sectionHead(s)}
        <ul class="sources">
          ${s.items.map((i) => `<li><a href="${esc(i.href)}" rel="noopener noreferrer" target="_blank">${esc(i.title)}</a> — ${esc(i.publisher)}</li>`).join("\n          ")}
        </ul>${s.note ? `
        <p class="note">${rich(s.note)}</p>` : ""}`,

  faq: (s) => `
        ${sectionHead(s)}
        <div class="faq">
          ${s.items.map((i) => `<details>
            <summary>${esc(i.q)}</summary>
            <div class="answer">${rich(i.a)}</div>
          </details>`).join("\n          ")}
        </div>`,

  contacts: (s, ctx) => `
        ${sectionHead(s)}
        <div class="contact-grid">
          <div class="contact-card">
            <h3>${esc(s.labels.office)}</h3>
            <address>
              ${esc(ctx.config.contact.street)}<br>
              ${esc(ctx.config.contact.city)}<br>
              ${esc(ctx.config.contact.country)}
            </address>
          </div>
          <div class="contact-card">
            <h3>${esc(s.labels.phone)}</h3>
            <p><a href="tel:${esc(ctx.config.contact.phoneHref)}">${esc(ctx.config.contact.phone)}</a></p>
            <p>${esc(s.labels.hours)}: ${esc(ctx.config.contact.hours)}</p>
          </div>
          <div class="contact-card">
            <h3>${esc(s.labels.email)}</h3>
            <p><a href="mailto:${esc(ctx.config.contact.email)}">${esc(ctx.config.contact.email)}</a></p>
            <p>${esc(s.labels.pec)}: <a href="mailto:${esc(ctx.config.contact.pec)}">${esc(ctx.config.contact.pec)}</a></p>
          </div>
        </div>`,

  form: (s) => `
        ${sectionHead(s)}
        <form class="form" method="post" action="${esc(s.action || "#")}" novalidate>
          <div class="field">
            <label for="f-name">${esc(s.fields.name)}</label>
            <input id="f-name" name="name" type="text" autocomplete="organization" required>
          </div>
          <div class="field">
            <label for="f-email">${esc(s.fields.email)}</label>
            <input id="f-email" name="email" type="email" autocomplete="email" required>
          </div>
          <div class="field">
            <label for="f-subject">${esc(s.fields.subject)}</label>
            <select id="f-subject" name="subject">
              ${s.fields.subjects.map((o) => `<option>${esc(o)}</option>`).join("\n              ")}
            </select>
          </div>
          <div class="field">
            <label for="f-message">${esc(s.fields.message)}</label>
            <textarea id="f-message" name="message" required></textarea>
          </div>
          <div>
            <button class="btn btn-primary" type="submit">${esc(s.fields.submit)}</button>
          </div>
          <p class="form-note">${rich(s.fields.note)}</p>
        </form>`,

  cta: (s) => `
        <div class="cta-band">
          <div>
            <h2>${esc(s.title)}</h2>
            <p>${rich(s.text)}</p>
          </div>
          <div class="cta-actions">
            ${s.actions.map((a, idx) => `<a class="btn ${idx === 0 ? "btn-light" : "btn-outline-light"}" href="${esc(a.href)}">${esc(a.label)}</a>`).join("\n            ")}
          </div>
        </div>`,
};

function sectionHead(s, wrap = true) {
  const eyebrow = s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : "";
  const heading = s.title ? `<h2>${esc(s.title)}</h2>` : "";
  const lead = s.lead ? `<p class="lead">${rich(s.lead)}</p>` : "";
  if (!eyebrow && !heading && !lead) return "";
  const inner = [eyebrow, heading, lead].filter(Boolean).join("\n          ");
  return wrap ? `<div class="section-head">\n          ${inner}\n        </div>` : inner;
}

function renderSection(section, ctx) {
  const render = sectionRenderers[section.type];
  if (!render) throw new Error(`Tipo di sezione sconosciuto: "${section.type}"`);
  const body = render(section, ctx);
  const classes = ["section", section.alt ? "section-alt" : ""].filter(Boolean).join(" ");
  return `      <section class="${classes}"${section.id ? ` id="${esc(section.id)}"` : ""}>
        <div class="wrap">${body}
        </div>
      </section>`;
}

/* ----------------------------------------------------------------- chrome */

const logo = `<svg class="brand-mark" viewBox="0 0 40 40" role="img" aria-hidden="true">
      <circle cx="20" cy="20" r="19" fill="currentColor" opacity=".1"/>
      <path d="M20 8c4.6 4.7 7 8.5 7 11.9A7 7 0 0 1 13 20c0-3.4 2.4-7.2 7-12Z" fill="currentColor"/>
      <path d="M20 32c-5.5 0-10-3.3-11.6-8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/>
    </svg>`;

function header(ctx) {
  const { lang, t, page } = ctx;

  const nav = NAV_KEYS.map((key) => {
    const target = PAGES.find((p) => p.key === key);
    const current = key === page.key ? ' aria-current="page"' : "";
    return `<li><a href="${href(lang.code, target.slug)}"${current}>${esc(t.nav[key])}</a></li>`;
  }).join("\n            ");

  const langItems = LANGS.map((l) => {
    const current = l.code === lang.code;
    return `<li><a href="${href(l.code, page.slug)}" hreflang="${l.code}" lang="${l.code}" data-lang="${l.code}"${current ? ' aria-current="true"' : ""}>
              <span>${esc(l.native)}</span><span class="code">${l.code}</span>
            </a></li>`;
  }).join("\n            ");

  return `  <a class="skip" href="#main">${esc(t.common.skip)}</a>

  <header class="site-header">
    <div class="wrap header-bar">
      <a class="brand" href="${href(lang.code, "")}">
        ${logo}
        <span class="brand-text">
          <span class="brand-name">${esc(t.common.brandName)}</span>
          <span class="brand-sub">${esc(t.common.brandSub)}</span>
        </span>
      </a>

      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        ${esc(t.common.menu)}
      </button>

      <nav class="site-nav" id="site-nav" aria-label="${esc(t.common.mainNav)}">
        <ul>
            ${nav}
          <li class="lang">
            <button class="lang-btn" type="button" aria-expanded="false" aria-controls="lang-menu" aria-label="${esc(t.common.languageLabel)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z"/></svg>
              ${lang.code.toUpperCase()}
            </button>
            <ul class="lang-menu" id="lang-menu" hidden>
            ${langItems}
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  </header>`;
}

function footer(ctx) {
  const { lang, t, config } = ctx;

  const links = (keys) =>
    keys.map((key) => {
      const target = PAGES.find((p) => p.key === key);
      return `<li><a href="${href(lang.code, target.slug)}">${esc(t.nav[key] || t.pages[key].title)}</a></li>`;
    }).join("\n            ");

  return `  <footer class="site-footer">
    <div class="wrap">
      <div class="footer-grid">
        <div class="footer-about">
          <a class="brand" href="${href(lang.code, "")}">
            ${logo}
            <span class="brand-text">
              <span class="brand-name">${esc(t.common.brandName)}</span>
              <span class="brand-sub">${esc(t.common.brandSub)}</span>
            </span>
          </a>
          <p>${rich(t.common.footerAbout)}</p>
        </div>

        <div class="footer-col">
          <h3>${esc(t.common.footerConsortium)}</h3>
          <ul>
            ${links(["about", "rules", "associations"])}
          </ul>
        </div>

        <div class="footer-col">
          <h3>${esc(t.common.footerServices)}</h3>
          <ul>
            ${links(["contribution", "companies", "campaign", "membership"])}
          </ul>
        </div>

        <div class="footer-col">
          <h3>${esc(t.nav.contacts)}</h3>
          <address>
            ${esc(config.contact.street)}<br>
            ${esc(config.contact.city)}<br>
            <a href="tel:${esc(config.contact.phoneHref)}">${esc(config.contact.phone)}</a><br>
            <a href="mailto:${esc(config.contact.email)}">${esc(config.contact.email)}</a>
          </address>
        </div>
      </div>

      <div class="footer-bottom">
        <p>&copy; <span data-year>2026</span> ${esc(t.common.brandName)} — ${esc(t.common.rights)}</p>
        <p>${esc(t.common.vat)}: ${esc(config.contact.vat)}</p>
        <p>${rich(t.common.disclaimer)}</p>
      </div>
    </div>
  </footer>`;
}

/* ------------------------------------------------------------------ pages */

function renderPage(ctx) {
  const { lang, t, page, config } = ctx;
  const content = t.pages[page.key];
  const url = config.url + href(lang.code, page.slug);

  const alternates = LANGS.map(
    (l) => `  <link rel="alternate" hreflang="${l.code}" href="${config.url}${href(l.code, page.slug)}">`
  ).join("\n");

  const isHome = page.key === "home";

  const hero = isHome
    ? `  <section class="hero">
    <div class="wrap">
      <div class="hero-inner">
      <p class="eyebrow">${esc(content.eyebrow)}</p>
      <h1>${esc(content.title)}</h1>
      <p>${rich(content.intro)}</p>
        <div class="hero-actions">
          ${content.actions.map((a, i) => `<a class="btn ${i === 0 ? "btn-light" : "btn-outline-light"}" href="${esc(a.href)}">${esc(a.label)}</a>`).join("\n          ")}
        </div>
      </div>
    </div>
  </section>`
    : `  <section class="page-hero">
    <div class="wrap">
      <nav class="crumbs" aria-label="${esc(t.common.breadcrumb)}">
        <ol>
          <li><a href="${href(lang.code, "")}">${esc(t.nav.home)}</a></li>
          <li>${esc(content.title)}</li>
        </ol>
      </nav>
      <h1>${esc(content.title)}</h1>
      <p>${rich(content.intro)}</p>
    </div>
  </section>`;

  const sections = content.sections.map((s) => renderSection(s, ctx)).join("\n\n");

  return `<!DOCTYPE html>
<html lang="${lang.code}" dir="${lang.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(content.metaTitle)}</title>
<meta name="description" content="${esc(content.metaDescription)}">
<link rel="canonical" href="${url}">
${alternates}
  <link rel="alternate" hreflang="x-default" href="${config.url}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(config.brand.name)}">
<meta property="og:locale" content="${lang.locale}">
<meta property="og:title" content="${esc(content.metaTitle)}">
<meta property="og:description" content="${esc(content.metaDescription)}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#14713f">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>
${header(ctx)}

  <main id="main">
${hero}

${sections}
  </main>

${footer(ctx)}

  <script src="/assets/js/site.js" defer></script>
</body>
</html>
`;
}

function renderEntry(config, translations) {
  const items = LANGS.map((l) => {
    const t = translations[l.code];
    return `        <li><a href="${href(l.code, "")}" hreflang="${l.code}" lang="${l.code}" dir="${l.dir}" data-lang="${l.code}">
          <span>${esc(l.native)}</span><span class="code">${l.code}</span>
        </a></li>`;
  }).join("\n");

  const alternates = LANGS.map(
    (l) => `<link rel="alternate" hreflang="${l.code}" href="${config.url}${href(l.code, "")}">`
  ).join("\n");

  const subtitle = LANGS.map((l) => esc(translations[l.code].common.chooseLanguage)).join(" · ");

  return `<!DOCTYPE html>
<html lang="${config.defaultLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(config.brand.name)} — ${esc(translations[config.defaultLang].common.brandSub)}</title>
<meta name="description" content="${esc(translations[config.defaultLang].pages.home.metaDescription)}">
<link rel="canonical" href="${config.url}/">
${alternates}
<link rel="alternate" hreflang="x-default" href="${config.url}/">
<meta name="theme-color" content="#14713f">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>
  <main class="picker">
    <div class="picker-card">
      <span class="brand">
        ${logo}
        <span class="brand-text">
          <span class="brand-name">${esc(config.brand.name)}</span>
          <span class="brand-sub" lang="ar" dir="rtl">${esc(config.brand.arabic)}</span>
        </span>
      </span>
      <p class="lead">${subtitle}</p>
      <ul class="picker-list">
${items}
      </ul>
    </div>
  </main>
  <script src="/assets/js/entry.js" defer></script>
</body>
</html>
`;
}

function renderSitemap(config) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [];

  for (const lang of LANGS) {
    for (const page of PAGES) {
      const alternates = LANGS.map(
        (l) => `    <xhtml:link rel="alternate" hreflang="${l.code}" href="${config.url}${href(l.code, page.slug)}"/>`
      ).join("\n");
      urls.push(`  <url>
    <loc>${config.url}${href(lang.code, page.slug)}</loc>
${alternates}
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${page.key === "home" ? "1.0" : "0.7"}</priority>
  </url>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;
}

/* ------------------------------------------------------------------- main */

async function main() {
  const config = JSON.parse(await readFile(join(SRC, "site.config.json"), "utf8"));

  const translations = {};
  for (const lang of LANGS) {
    const file = join(SRC, "i18n", `${lang.code}.json`);
    if (!existsSync(file)) throw new Error(`Traduzione mancante: ${file}`);
    translations[lang.code] = JSON.parse(await readFile(file, "utf8"));
  }

  // Controllo di completezza: ogni lingua deve avere tutte le pagine e le voci di menu.
  for (const lang of LANGS) {
    const t = translations[lang.code];
    for (const page of PAGES) {
      if (!t.pages?.[page.key]) throw new Error(`[${lang.code}] pagina mancante: ${page.key}`);
      if (!Array.isArray(t.pages[page.key].sections)) throw new Error(`[${lang.code}] sezioni mancanti in: ${page.key}`);
    }
    for (const key of NAV_KEYS.concat("home")) {
      if (!t.nav?.[key]) throw new Error(`[${lang.code}] voce di menu mancante: ${key}`);
    }
  }

  // Ripulisce l'output precedente.
  for (const lang of LANGS) await rm(join(ROOT, lang.code), { recursive: true, force: true });
  await rm(join(ROOT, "assets"), { recursive: true, force: true });

  let written = 0;
  for (const lang of LANGS) {
    const t = translations[lang.code];
    for (const page of PAGES) {
      const dir = join(ROOT, lang.code, page.slug);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "index.html"), renderPage({ lang, t, page, config }), "utf8");
      written++;
    }
  }

  await cp(join(SRC, "assets"), join(ROOT, "assets"), { recursive: true });
  await writeFile(join(ROOT, "index.html"), renderEntry(config, translations), "utf8");
  await writeFile(join(ROOT, "sitemap.xml"), renderSitemap(config), "utf8");
  await writeFile(
    join(ROOT, "robots.txt"),
    `User-agent: *\nAllow: /\n\nSitemap: ${config.url}/sitemap.xml\n`,
    "utf8"
  );

  console.log(`OK — ${written} pagine in ${LANGS.length} lingue (${LANGS.map((l) => l.code).join(", ")}) + index, sitemap.xml, robots.txt`);
}

main().catch((err) => {
  console.error("Build fallita:", err.message);
  process.exit(1);
});
