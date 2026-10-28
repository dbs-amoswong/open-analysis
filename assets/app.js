(function () {
  "use strict";

  var state = new Map();

  function getState(target) {
    if (!state.has(target)) state.set(target, { q: "", group: "all" });
    return state.get(target);
  }

  function targetOf(table) {
    return table.getAttribute("data-filter-target") || table.id;
  }

  function tablesFor(target) {
    return Array.prototype.filter.call(
      document.querySelectorAll("table[data-filterable]"),
      function (table) {
        return targetOf(table) === target;
      }
    );
  }

  function apply(target) {
    var s = getState(target);
    var tables = tablesFor(target);
    var anyVisible = false;

    tables.forEach(function (table) {
      var rows = table.querySelectorAll("tbody tr");
      var visibleInTable = 0;

      Array.prototype.forEach.call(rows, function (row) {
        var haystack = (row.getAttribute("data-search") || "").toLowerCase();
        var group = row.getAttribute("data-group") || "";
        var matchesText = s.q === "" || haystack.indexOf(s.q) !== -1;
        var matchesGroup = s.group === "all" || group === s.group;
        var visible = matchesText && matchesGroup;
        row.hidden = !visible;
        if (visible) visibleInTable += 1;
      });

      var section = table.closest(".whitelist-section");
      if (section) section.hidden = visibleInTable === 0;
      if (visibleInTable > 0) anyVisible = true;
    });

    var filtering = s.q !== "" || s.group !== "all";
    document.querySelectorAll(".no-matches").forEach(function (el) {
      el.hidden = !(filtering && !anyVisible);
    });
  }

  function debounce(fn, ms) {
    var timer;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(null, args);
      }, ms);
    };
  }

  var onSearch = debounce(function (event) {
    var input = event.target;
    var target = input.getAttribute("data-filter-target");
    if (!target) return;
    var s = getState(target);
    s.q = input.value.trim().toLowerCase();
    apply(target);
  }, 100);

  document.addEventListener("input", function (event) {
    if (event.target.matches("input[type='search'][data-filter-target]")) onSearch(event);
  });

  document.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-filter-table]");
    if (!button) return;
    var target = button.getAttribute("data-filter-table");
    var s = getState(target);
    s.group = button.getAttribute("data-filter-value") || "all";

    var group = button.parentElement;
    if (group) {
      group.querySelectorAll("button[data-filter-table]").forEach(function (b) {
        var active = b === button;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }
    apply(target);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    var tag = (event.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || event.target.isContentEditable) return;
    var input = document.querySelector("input[type='search'][data-filter-target]");
    if (!input) return;
    event.preventDefault();
    input.focus();
    input.select();
  });

  // Keep segmented controls in sync with their initial markup.
  document.querySelectorAll("button[data-filter-table]").forEach(function (b) {
    b.setAttribute("aria-pressed", b.classList.contains("is-active") ? "true" : "false");
  });
})();
