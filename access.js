(() => {
  const PIN = "1800";
  const KEY = "ballroom_admin_unlocked";
  const params = new URLSearchParams(location.search);
  const room = (params.get("room") || "main-ballroom").replace(/[^a-zA-Z0-9_-]/g, "") || "main-ballroom";
  const protectedPages = ["admin.html", "checkin.html", "summary.html", "tickets.html"];
  const page = location.pathname.split("/").pop() || "index.html";
  const isUnlocked = () => sessionStorage.getItem(KEY) === "1";

  // Protect direct links before page modules start.
  if (protectedPages.includes(page) && !isUnlocked()) {
    location.replace(`display.html?room=${encodeURIComponent(room)}&unlock=1`);
    return;
  }

  function unlock() {
    const entered = window.prompt("Enter administrator PIN");
    if (entered === null) return false;
    if (entered.trim() !== PIN) {
      window.alert("Incorrect PIN");
      return false;
    }
    sessionStorage.setItem(KEY, "1");
    applyAccessUI();
    return true;
  }

  function lock() {
    sessionStorage.removeItem(KEY);
    location.href = `display.html?room=${encodeURIComponent(room)}`;
  }

  function applyAccessUI() {
    const unlocked = isUnlocked();
    document.querySelectorAll("[data-protected-link]").forEach(el => {
      el.hidden = !unlocked;
    });
    document.querySelectorAll("[data-unlock-btn]").forEach(el => {
      el.hidden = unlocked;
      el.onclick = () => unlock();
    });
    document.querySelectorAll("[data-lock-btn]").forEach(el => {
      el.hidden = !unlocked;
      el.onclick = lock;
    });
    document.querySelectorAll("a[href]").forEach(a => {
      const href = a.getAttribute("href");
      if (!href || /^(https?:|#|mailto:|javascript:)/i.test(href)) return;
      const base = href.split("?")[0];
      if (["admin.html","display.html","checkin.html","summary.html","tickets.html","index.html"].includes(base)) {
        a.href = `${base}?room=${encodeURIComponent(room)}`;
      }
    });
  }

  window.BallroomAccess = { unlock, lock, isUnlocked, room };
  document.addEventListener("DOMContentLoaded", () => {
    applyAccessUI();
    if (page === "display.html" && params.get("unlock") === "1" && !isUnlocked()) {
      setTimeout(unlock, 100);
    }
  });
})();
