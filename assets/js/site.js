/* OLEA — comportamenti minimi: menu mobile, selettore lingua, anno corrente. */
(function () {
  "use strict";

  /* --- Menu mobile --- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* --- Selettore lingua --- */
  var langBtn = document.querySelector(".lang-btn");
  var langMenu = document.getElementById("lang-menu");

  function closeLang() {
    if (!langMenu || langMenu.hidden) return;
    langMenu.hidden = true;
    if (langBtn) langBtn.setAttribute("aria-expanded", "false");
  }

  if (langBtn && langMenu) {
    langBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = langMenu.hidden;
      langMenu.hidden = !open;
      langBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    langMenu.addEventListener("click", function (e) {
      var link = e.target.closest("a[data-lang]");
      if (link) storeLang(link.getAttribute("data-lang"));
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest(".lang")) closeLang();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeLang();
        if (nav && nav.classList.contains("is-open")) {
          nav.classList.remove("is-open");
          if (toggle) toggle.setAttribute("aria-expanded", "false");
        }
      }
    });
  }

  /* Ricorda l'ultima lingua scelta: la usa solo la pagina di ingresso. */
  function storeLang(code) {
    try { localStorage.setItem("olea:lang", code); } catch (err) { /* storage non disponibile */ }
  }

  var current = document.documentElement.getAttribute("lang");
  if (current) storeLang(current);

  /* --- Anno corrente nel footer --- */
  var year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
})();
