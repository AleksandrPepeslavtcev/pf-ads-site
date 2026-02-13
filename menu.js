document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.querySelector(".menu-toggle");
  var links = document.getElementById("primary-nav");
  if (!toggle || !links) return;

  var dropdowns = Array.from(document.querySelectorAll(".nav-item.dropdown"));

  function isMobile() {
    return window.matchMedia("(max-width: 700px)").matches;
  }

  function resetDropdowns() {
    dropdowns.forEach(function (dd) {
      dd.classList.remove("open");
      var btn = dd.querySelector(".dropdown-toggle");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  }

  function syncNavState() {
    var mobile = isMobile();
    toggle.hidden = !mobile;
    if (!mobile) {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      resetDropdowns();
    }
  }

  syncNavState();
  window.addEventListener("resize", syncNavState);

  toggle.addEventListener("click", function () {
    var open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) resetDropdowns();
  });

  dropdowns.forEach(function (dd) {
    var btn = dd.querySelector(".dropdown-toggle");
    if (!btn) return;

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var open = dd.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });

  document.addEventListener("click", function (e) {
    if (!isMobile()) {
      dropdowns.forEach(function (dd) {
        if (!dd.contains(e.target)) {
          dd.classList.remove("open");
          var btn = dd.querySelector(".dropdown-toggle");
          if (btn) btn.setAttribute("aria-expanded", "false");
        }
      });
    }
  });
});
