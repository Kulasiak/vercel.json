/* BAR CAPRI — comportamenti della pagina. Nessuna libreria, nessuna richiesta esterna. */
(function () {
  "use strict";

  var DATA = window.CAPRI || {};
  var $  = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ------------------------------------------------------------- tema */

  var root = document.documentElement;
  function applyTheme(mode) {
    if (mode) root.dataset.theme = mode; else delete root.dataset.theme;
    try { mode ? localStorage.setItem("capri-theme", mode) : localStorage.removeItem("capri-theme"); } catch (e) {}
  }
  $$("[data-theme-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dark = root.dataset.theme
        ? root.dataset.theme === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyTheme(dark ? "light" : "dark");
    });
  });

  /* --------------------------------------------------- intestazione */

  var head = $("[data-head]");
  var toTop = $("[data-to-top]");
  var lastY = -1;
  function onScroll() {
    var y = window.scrollY;
    if (y === lastY) return;
    lastY = y;
    if (head) head.classList.toggle("is-stuck", y > 8);
    if (toTop) toTop.classList.toggle("is-visible", y > 700);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (toTop) toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

  /* ---------------------------------------------------- selettore lingua */

  var langSwitch = $("[data-lang-switch]");
  if (langSwitch) {
    var langBtn = $(".lang-btn", langSwitch);
    var langMenu = $(".lang-menu", langSwitch);
    var setOpen = function (open) {
      langSwitch.classList.toggle("is-open", open);
      langBtn.setAttribute("aria-expanded", open ? "true" : "false");
      langMenu.hidden = !open;
    };
    langBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(langMenu.hidden);
    });
    document.addEventListener("click", function (e) { if (!langSwitch.contains(e.target)) setOpen(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
  }

  // Ricorda la lingua scelta: al prossimo QR si apre gia giusta.
  $$('a[hreflang]').forEach(function (a) {
    a.addEventListener("click", function () {
      try { localStorage.setItem("capri-lang", a.getAttribute("hreflang")); } catch (e) {}
    });
  });

  /* ------------------------------------------------------ menu su telefono */

  var navToggle = $("[data-nav-toggle]");
  var mobileNav = $("[data-mobile-nav]");
  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", function () {
      var open = mobileNav.hidden;
      mobileNav.hidden = !open;
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    $$("a", mobileNav).forEach(function (a) {
      a.addEventListener("click", function () {
        mobileNav.hidden = true;
        navToggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  /* --------------------------------------------------- aperto o chiuso ora */

  function romeNow() {
    try { return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" })); }
    catch (e) { return new Date(); }
  }
  function toMinutes(hhmm) {
    var p = String(hhmm).split(":");
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }
  function updateStatus() {
    if (!DATA.hours) return;
    var now = romeNow();
    var minutes = now.getHours() * 60 + now.getMinutes();
    var bar = DATA.hours.bar;
    var openToday = bar.days.indexOf(now.getDay()) > -1;
    var opens = toMinutes(bar.opens), closes = toMinutes(bar.closes);
    var isOpen = openToday && minutes >= opens && minutes < closes;

    var text = isOpen
      ? DATA.strings.openNow + " · " + DATA.strings.closesAt.replace("{time}", bar.closes)
      : DATA.strings.closedNow + " · " + DATA.strings.opensAt.replace("{time}", bar.opens);

    $$("[data-open-status]").forEach(function (el) {
      el.classList.toggle("is-open", isOpen);
      el.classList.toggle("is-closed", !isOpen);
      var span = $("[data-open-text]", el);
      if (span) span.textContent = text;
    });
    $$("[data-hours-today]").forEach(function (el) { el.textContent = bar.opens + " – " + bar.closes; });
    $$(".hours-table tr[data-day]").forEach(function (tr) {
      tr.classList.toggle("is-today", parseInt(tr.getAttribute("data-day"), 10) === now.getDay());
    });
  }
  updateStatus();
  setInterval(updateStatus, 60000);

  /* ------------------------------------------------------ comparse a scorrimento */

  var reveals = $$(".reveal");
  if (reveals.length && "IntersectionObserver" in window) {
    $$(".dish-grid").forEach(function (grid) {
      $$(".reveal", grid).forEach(function (el, i) { el.style.setProperty("--i", Math.min(i, 12)); });
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ------------------------------------------------------- ricerca e filtri */

  var tools = $("[data-menu-tools]");
  if (tools) {
    var search = $("#dish-search");
    var filters = $$(".filter", tools);
    var dishes = $$(".dish");
    var cats = $$(".menu-cat");
    var empty = $("[data-menu-empty]");
    var active = [];

    function applyFilters() {
      var q = (search && search.value || "").trim().toLowerCase();
      var shown = 0;

      dishes.forEach(function (dish) {
        var tags = (dish.getAttribute("data-tags") || "").split(" ");
        var okTags = active.every(function (t) { return tags.indexOf(t) > -1; });
        var okText = !q || (dish.getAttribute("data-search") || "").indexOf(q) > -1;
        var visible = okTags && okText;
        dish.classList.toggle("is-hidden", !visible);
        if (visible) shown++;
      });

      cats.forEach(function (cat) {
        var any = $$(".dish", cat).some(function (d) { return !d.classList.contains("is-hidden"); });
        cat.classList.toggle("is-hidden", !any);
      });

      if (empty) empty.hidden = shown > 0;
    }

    filters.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var value = btn.getAttribute("data-filter");
        if (value === "all") {
          active = [];
        } else {
          var at = active.indexOf(value);
          if (at > -1) active.splice(at, 1); else active.push(value);
        }
        filters.forEach(function (f) {
          var v = f.getAttribute("data-filter");
          f.classList.toggle("is-active", v === "all" ? active.length === 0 : active.indexOf(v) > -1);
        });
        applyFilters();
      });
    });

    if (search) {
      search.addEventListener("input", applyFilters);
      search.addEventListener("search", applyFilters);
    }

    // Evidenzia nell'indice la categoria che si sta guardando.
    var catLinks = $$("[data-cat-link]");
    if (catLinks.length && "IntersectionObserver" in window) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = entry.target.getAttribute("data-cat");
          catLinks.forEach(function (a) { a.classList.toggle("is-current", a.getAttribute("data-cat-link") === id); });
        });
      }, { rootMargin: "-30% 0px -60% 0px" });
      cats.forEach(function (c) { spy.observe(c); });
    }
  }

  /* -------------------------------------------------------------- mappa */

  $$("[data-map]").forEach(function (box) {
    var btn = $("[data-map-load]", box);
    if (!btn) return;
    btn.addEventListener("click", function () {
      var frame = document.createElement("iframe");
      frame.src = box.getAttribute("data-embed");
      frame.loading = "lazy";
      frame.title = "Mappa";
      frame.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
      frame.setAttribute("allowfullscreen", "");
      box.innerHTML = "";
      box.appendChild(frame);
    });
  });

  /* ------------------------------------------------------- una faq per volta */

  var faq = $("[data-faq]");
  if (faq) {
    var items = $$("details", faq);
    items.forEach(function (d) {
      d.addEventListener("toggle", function () {
        if (!d.open) return;
        items.forEach(function (other) { if (other !== d) other.open = false; });
      });
    });
  }

  /* ------------------------------------------------------------- stampa */

  function printNode(node) {
    var host = document.createElement("div");
    host.className = "print-host";
    host.appendChild(node);
    document.body.appendChild(host);
    document.body.classList.add("printing-only");
    var cleanup = function () {
      document.body.classList.remove("printing-only");
      host.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(function () { if (document.body.classList.contains("printing-only")) cleanup(); }, 1500);
  }

  $$("[data-print-qr]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var card = btn.closest(".qr-card");
      if (!card) return;
      var block = document.createElement("div");
      block.className = "qr-print";
      var title = card.querySelector("h3");
      block.innerHTML = (title ? "<h2>" + title.textContent + "</h2>" : "") +
        card.querySelector(".qr-frame").innerHTML +
        "<p>" + (card.querySelector(".qr-url") ? card.querySelector(".qr-url").textContent : "") + "</p>";
      printNode(block);
    });
  });

  $$("[data-print-tent]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var tent = $("#tent");
      if (tent) printNode(tent.cloneNode(true));
    });
  });
})();
