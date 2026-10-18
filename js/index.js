document.addEventListener("DOMContentLoaded", () => {
  // Keep the branded splash visible for exactly 1000 ms.
  window.setTimeout(() => {
    window.location.replace("pages/home.html");
  }, 1000);
});
