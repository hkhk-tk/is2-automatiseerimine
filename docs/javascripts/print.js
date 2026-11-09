// Trükkimisel ja PDF-i salvestamisel avatakse kokkuvolditud plokid, et tabelid ja selgitused jõuaksid paberile.
(function () {
  var avatud = [];
  window.addEventListener("beforeprint", function () {
    document.querySelectorAll("details:not([open])").forEach(function (d) { d.open = true; avatud.push(d); });
  });
  window.addEventListener("afterprint", function () {
    avatud.forEach(function (d) { d.open = false; }); avatud = [];
  });
})();
