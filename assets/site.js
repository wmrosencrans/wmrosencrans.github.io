/* Inner pages: organelle nav, hero art, "next organelle" link. */
(function () {
  'use strict';
  var O = Cell.ORGANELLES, cur = document.body.getAttribute('data-org');

  var nav = document.querySelector('[data-organelle-nav]');
  if (nav) {
    nav.innerHTML = O.map(function (o) {
      var here = o.id === cur;
      return '<a href="' + o.href + '" style="--c:' + o.color + '"' + (here ? ' class="current" aria-current="page"' : '') +
        '><span class="dot"></span><span class="nm">' + o.page + '</span></a>';
    }).join('');
    var c = nav.querySelector('.current');
    if (c && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = c.offsetLeft - nav.clientWidth / 2 + c.offsetWidth / 2;
  }

  document.querySelectorAll('svg[data-art]').forEach(function (svg) { Cell.art(svg, svg.getAttribute('data-art')); });

  var i = O.findIndex(function (o) { return o.id === cur; });
  var next = O[(i + 1) % O.length], nx = document.querySelector('[data-next]');
  if (nx && i >= 0) {
    nx.href = next.href;
    nx.innerHTML = '<span class="mono">Next page</span><strong style="color:' + next.color + '">' +
      next.page + ' →</strong>';
  }
})();
