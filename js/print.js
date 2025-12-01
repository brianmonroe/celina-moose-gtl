let players = [];
let courses = [];

fetch("data/players.json?_=" + Date.now())
  .then(r => r.json())
  .then(data => {
    players = data.players;
    courses = data.courses;
    renderPrintView();
  });

function isMissing(s) {
  return s === "" || s === null || s === "DNP" || isNaN(s);
}

function getLatestCompletedWeek(players) {
  const weeks = Math.max(...players.map(p => p.scores.length));
  for (let w = weeks - 1; w >= 0; w--) {
    if (players.some(p => !isMissing(p.scores[w]))) return w + 1;
  }
  return 1;
}

function computeWeeklyNet(p) {
  return p.scores.map((raw, w) => {
    if (raw === "DNP") return "DNP";

    // Weeks 1-3 use Week 3 HC
    if (w < 3) {
      const week3HC = p.handicaps[2] ?? 0;
      return raw - week3HC;
    }

    // Week N uses handicap from previous week
    const prevHC = p.handicaps[w - 1] ?? 0;
    return raw - prevHC;
  });
}

function renderPrintView() {
  const week = getLatestCompletedWeek(players);
  document.getElementById("print-week-label").textContent =
    "Standings After Week " + week;

  // Generate QR code to GTL homepage (using qrserver.com)
  const qrURL = encodeURIComponent("https://celinamoose.com/gtl/");
  document.getElementById("qr-code").src =
    `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrURL}`;

  const maxWeeks = Math.max(...players.map(p => p.scores.length));

  // ---------- HEADER ----------
  let head = "<tr>";
  head += "<th>Rank</th><th>Player</th>";

  for (let w = 1; w <= maxWeeks; w++) {
    head += `<th>W${w} Net</th>`;
  }

  head += "<th>HC</th><th>Total</th><th>Net</th>";
  head += "</tr>";

  document.getElementById("print-head").innerHTML = head;

  // ---------- BUILD STANDINGS ----------
  let rows = players.map(p => {
    const weeklyNet = computeWeeklyNet(p);
    const totalRaw = p.scores.reduce((a, s) => s === "DNP" ? a : a + s, 0);
    const totalNet = weeklyNet.reduce((a, s) => s === "DNP" ? a : a + s, 0);

    return {
      ...p,
      weeklyNet,
      totalRaw,
      totalNet,
      hasDNP: p.scores.includes("DNP")
    };
  });

  // ---------- SORT ----------
  rows.sort((a, b) => {
    if (a.hasDNP && !b.hasDNP) return 1;
    if (!a.hasDNP && b.hasDNP) return -1;

    const netDiff = a.totalNet - b.totalNet;
    if (netDiff !== 0) return netDiff;

    const aHC = a.handicaps[a.handicaps.length - 1] || 0;
    const bHC = b.handicaps[b.handicaps.length - 1] || 0;

    if (aHC !== bHC) return aHC - bHC;

    return a.name.localeCompare(b.name);
  });

  // ---------- RENDER ROWS ----------
  let bodyHTML = "";

  rows.forEach((p, i) => {
    bodyHTML += "<tr>";
    bodyHTML += `<td>${i + 1}</td>`;
    bodyHTML += `<td>${p.name}</td>`;

    // Weekly Net
    p.weeklyNet.forEach(n => {
      bodyHTML += `<td>${n}</td>`;
    });

    const finalHC = p.handicaps[p.handicaps.length - 1] ?? 0;

    bodyHTML += `<td>${finalHC}</td>`;
    bodyHTML += `<td>${p.totalRaw}</td>`;
    bodyHTML += `<td>${p.totalNet}</td>`;
    bodyHTML += "</tr>";
  });

  document.getElementById("print-body").innerHTML = bodyHTML;

  // Auto-open print
  setTimeout(() => window.print(), 250);
}
