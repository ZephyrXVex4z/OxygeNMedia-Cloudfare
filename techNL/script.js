// TechNL: resalta en la navegación la sección visible e imprime la versión de entrega.
(function () {
  'use strict';
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
  var map = {};
  links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });

  function activar(id) {
    links.forEach(function (a) { a.classList.remove('on'); a.removeAttribute('aria-current'); });
    var a = map[id];
    if (!a) return;
    a.classList.add('on');
    a.setAttribute('aria-current', 'true');
    var bar = a.parentElement.parentElement;
    bar.scrollLeft = a.offsetLeft - bar.clientWidth / 2 + a.clientWidth / 2; // mantiene visible el enlace activo en celular
  }

  if ('IntersectionObserver' in window) {
    // "sin-tecnologia" no tiene enlace propio: cuenta como parte de "Necesidad".
    var alias = { 'sin-tecnologia': 'necesidad' };
    var ids = ['inicio', 'proceso', 'medios', 'necesidad', 'sin-tecnologia', 'capacidad', 'organizacion', 'pasos', 'conclusion'];
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) activar(alias[e.target.id] || e.target.id);
      });
    }, { rootMargin: '-35% 0px -60% 0px' });
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }
  activar('inicio');

  var btn = document.getElementById('imprimir');
  if (btn) btn.addEventListener('click', function () { window.print(); });
})();
