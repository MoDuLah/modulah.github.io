(function () {
  var WIDGET_SRC = "https://discord.com/widget?id=1492449197729775817&theme=dark";

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  function init() {
    if (!document.body || document.querySelector("[data-discord-dock]")) {
      return;
    }

    injectStyles();

    var dock = document.createElement("details");
    dock.className = "discord-dock";
    dock.setAttribute("data-discord-dock", "true");
    dock.setAttribute("role", "complementary");
    dock.setAttribute("aria-label", "Discord community");
    dock.open = false;

    dock.innerHTML =
      '<summary class="discord-dock-toggle" aria-label="Toggle Discord community widget">' +
        '<span class="discord-dock-icon" aria-hidden="true">' +
          '<svg viewBox="0 0 127.14 96.36" focusable="false" aria-hidden="true">' +
            '<path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21A105.73 105.73 0 0 0 32.71 96.36a77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.35 2.66-2.06a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.4 2.66 2.06a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69c-6.26 0-11.43-5.75-11.43-12.81s5.05-12.82 11.43-12.82 11.54 5.8 11.43 12.82-5.04 12.81-11.43 12.81Zm42.24 0c-6.26 0-11.43-5.75-11.43-12.81s5-12.82 11.43-12.82 11.54 5.8 11.43 12.82-5.04 12.81-11.43 12.81Z"></path>' +
          "</svg>" +
        "</span>" +
        '<span class="discord-dock-copy">' +
          '<span class="discord-dock-title">Discord Community</span>' +
          '<span class="discord-dock-subtitle">Support, licensing, and updates</span>' +
        "</span>" +
        '<span class="discord-dock-caret" aria-hidden="true"></span>' +
      "</summary>" +
      '<div class="discord-dock-panel">' +
        '<div class="discord-dock-panel-head">' +
          '<div class="discord-dock-panel-copy">' +
            "<strong>Stay in the loop</strong>" +
            "<p>Join the server for releases, support, and license help.</p>" +
          "</div>" +
          '<a class="discord-dock-link" href="https://discord.gg/g4ekwrhrAf" target="_blank" rel="noopener noreferrer">Open Discord</a>' +
        "</div>" +
        '<iframe class="discord-dock-frame" src="' + WIDGET_SRC + '" width="320" height="460" allowtransparency="true" frameborder="0" loading="lazy" sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"></iframe>' +
      "</div>";

    document.body.appendChild(dock);
  }

  function injectStyles() {
    if (document.getElementById("discord-dock-styles")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "discord-dock-styles";
    style.textContent =
      ".discord-dock{" +
        "position:fixed;" +
        "right:14px;" +
        "bottom:14px;" +
        "z-index:1200;" +
        "width:min(320px,calc(100vw - 20px));" +
        "font:13px/1.4 Arial,Helvetica,sans-serif;" +
        "letter-spacing:0;" +
      "}" +
      ".discord-dock summary{" +
        "list-style:none;" +
      "}" +
      ".discord-dock summary::-webkit-details-marker{" +
        "display:none;" +
      "}" +
      ".discord-dock-toggle{" +
        "display:flex;" +
        "align-items:center;" +
        "gap:10px;" +
        "padding:10px 12px;" +
        "border:1px solid rgba(79,126,49,.9);" +
        "border-radius:8px;" +
        "background:rgba(10,18,9,.94);" +
        "box-shadow:0 18px 42px rgba(0,0,0,.34);" +
        "color:#f3f8df;" +
        "cursor:pointer;" +
        "user-select:none;" +
        "backdrop-filter:blur(10px);" +
      "}" +
      ".discord-dock[open] .discord-dock-toggle{" +
        "border-bottom-left-radius:0;" +
        "border-bottom-right-radius:0;" +
        "border-bottom-color:rgba(217,239,82,.2);" +
      "}" +
      ".discord-dock-icon{" +
        "display:inline-flex;" +
        "align-items:center;" +
        "justify-content:center;" +
        "width:36px;" +
        "height:36px;" +
        "flex:0 0 auto;" +
        "border:1px solid rgba(88,101,242,.45);" +
        "border-radius:8px;" +
        "background:#5865f2;" +
        "color:#fff;" +
      "}" +
      ".discord-dock-icon svg{" +
        "width:20px;" +
        "height:16px;" +
        "fill:currentColor;" +
      "}" +
      ".discord-dock-copy{" +
        "display:grid;" +
        "gap:2px;" +
        "min-width:0;" +
        "flex:1 1 auto;" +
      "}" +
      ".discord-dock-title{" +
        "font-size:.9rem;" +
        "font-weight:700;" +
        "color:#f3f8df;" +
      "}" +
      ".discord-dock-subtitle{" +
        "font-size:.76rem;" +
        "color:#8fd36a;" +
      "}" +
      ".discord-dock-caret{" +
        "width:10px;" +
        "height:10px;" +
        "flex:0 0 auto;" +
        "border-right:2px solid #d9ef52;" +
        "border-bottom:2px solid #d9ef52;" +
        "transform:rotate(45deg);" +
        "transition:transform .2s ease;" +
      "}" +
      ".discord-dock[open] .discord-dock-caret{" +
        "transform:rotate(225deg);" +
      "}" +
      ".discord-dock-panel{" +
        "display:grid;" +
        "gap:10px;" +
        "padding:12px;" +
        "border:1px solid rgba(79,126,49,.9);" +
        "border-top:none;" +
        "border-bottom-left-radius:8px;" +
        "border-bottom-right-radius:8px;" +
        "background:rgba(11,20,10,.96);" +
        "box-shadow:0 18px 42px rgba(0,0,0,.34);" +
        "backdrop-filter:blur(10px);" +
      "}" +
      ".discord-dock-panel-head{" +
        "display:grid;" +
        "gap:10px;" +
      "}" +
      ".discord-dock-panel-copy strong{" +
        "display:block;" +
        "margin:0;" +
        "font-size:.95rem;" +
        "color:#f3f8df;" +
      "}" +
      ".discord-dock-panel-copy p{" +
        "margin:4px 0 0;" +
        "color:#c3cfaf;" +
      "}" +
      ".discord-dock-link{" +
        "display:inline-flex;" +
        "align-items:center;" +
        "justify-content:center;" +
        "min-height:36px;" +
        "padding:9px 12px;" +
        "border:1px solid rgba(88,101,242,.45);" +
        "border-radius:8px;" +
        "background:#5865f2;" +
        "color:#fff;" +
        "font-weight:700;" +
        "text-decoration:none;" +
      "}" +
      ".discord-dock-link:hover{" +
        "text-decoration:none;" +
      "}" +
      ".discord-dock-frame{" +
        "display:block;" +
        "width:100%;" +
        "height:min(460px,calc(100vh - 160px));" +
        "border:0;" +
        "border-radius:8px;" +
        "background:#111827;" +
      "}" +
      "@media (max-width:720px){" +
        ".discord-dock{" +
          "left:12px;" +
          "right:12px;" +
          "bottom:12px;" +
          "width:auto;" +
        "}" +
        ".discord-dock-toggle{" +
          "padding:10px 11px;" +
        "}" +
        ".discord-dock-icon{" +
          "width:34px;" +
          "height:34px;" +
        "}" +
        ".discord-dock-subtitle{" +
          "display:none;" +
        "}" +
        ".discord-dock-panel{" +
          "padding:11px;" +
        "}" +
        ".discord-dock-frame{" +
          "height:min(380px,calc(100vh - 150px));" +
        "}" +
      "}";

    document.head.appendChild(style);
  }
}());
