var panels = chrome.devtools.panels;

panels.create(
  "JS Runtime",
  "assets/logo-16.png",
  "jsruntime.html"
);

panels.elements.createSidebarPane("JS Runtime", function (sidebar) {
  sidebar.setHeight("93px");
  sidebar.setPage("jsruntime.html");
});
