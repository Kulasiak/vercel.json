/* Pagina di ingresso: mette in cima la lingua salvata o quella del browser,
   senza redirect automatici — la scelta resta sempre visibile e cliccabile. */
(function () {
  "use strict";

  var supported = ["it", "en", "fr", "de", "ar"];

  function preferred() {
    try {
      var saved = localStorage.getItem("olea:lang");
      if (saved && supported.indexOf(saved) !== -1) return saved;
    } catch (err) { /* storage non disponibile */ }

    var prefs = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < prefs.length; i++) {
      var code = String(prefs[i]).slice(0, 2).toLowerCase();
      if (supported.indexOf(code) !== -1) return code;
    }
    return null;
  }

  var code = preferred();
  if (!code) return;

  var link = document.querySelector('.picker-list a[data-lang="' + code + '"]');
  if (!link) return;

  var item = link.closest("li");
  var list = item && item.parentNode;
  if (!item || !list) return;

  list.insertBefore(item, list.firstElementChild);
  link.focus({ preventScroll: true });
})();
