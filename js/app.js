//------------------------------------------------------------
// GTL FRONTEND — Per-Week Handicap Version
//------------------------------------------------------------

let players = [];
let courses = [];
let summaries = [];

function isMissingScore(s) {
  return (
    s === null ||
    s === "" ||
    s === 0 ||
    s === "DNP" ||
    s === "x" ||
    s === "X" ||
    isNaN(s)
  );
}

// Load data
document.addEventListener("DOMContentLoaded", () => {
  fetch("data/players.json?_=" + Date.now())
    .then(r => r.json())
    .then(data => {
      players = data.players;
      courses = data.courses;

      return fetch("data/summaries.json?_=" + Date.now());
    })
    .then(r => r.json())
    .then(data => {
      summaries = data.summaries;
      initialize();
    });
});

function getLatestCompletedWeek(players) {
  const weeks = Math.max(...players.map(p => p.scores.length));
  for (let w = weeks - 1; w >= 0; w--) {
    if (players.some(p => !isMissingScore(p.scores[w]))) {
      return w + 1;
    }
  }
  return 1;
}

function initialize() {
  const standingsWeek = getLatestCompletedWeek(players);

  document.getElementById("page-title").textContent =
    `Week ${standingsWeek} Leaderboard`;

  renderStandings();
  renderSummary();

  // ------------------------------------------------------------
  // HANDICAP DEBUG MODE (?hc=1)
  // ------------------------------------------------------------
  (function () {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("hc")) return; // only run if ?hc=1 in URL

    const debugBox = document.createElement("div");
    debugBox.id = "hc-debug";
    debugBox.style.padding = "20px";
    debugBox.style.background = "#222";
    debugBox.style.color = "#0f0";
    debugBox.style.marginTop = "40px";
    debugBox.style.fontFamily = "monospace";
    debugBox.style.whiteSpace = "pre-wrap";
    debugBox.style.border = "2px solid #0f0";

    const PAR = 45;
    let out = "=== HANDICAP DEBUG MODE ENABLED ===\n\n";

    players.forEach((p) => {
      out += `PLAYER: ${p.name}\n`;
      out += `Scores: ${JSON.stringify(p.scores)}\n`;
      out += `Stored Handicaps: ${JSON.stringify(p.handicaps)}\n\n`;

      // Week 3 calculation (first 3 weeks)
      if (p.scores.length >= 3) {
        const w1 = Number(p.scores[0]);
        const w2 = Number(p.scores[1]);
        const w3 = Number(p.scores[2]);

        const avg = (w1 + w2 + w3) / 3;
        const base = avg - PAR;
        const calc = base * 0.8;
        const newHc = Math.max(0, Math.floor(calc));

        out += `--- Week 3 Handicap Formula ---\n`;
        out += `Average = (${w1} + ${w2} + ${w3}) / 3 = ${avg.toFixed(2)}\n`;
        out += `Above Par = avg - 45 = ${base.toFixed(2)}\n`;
        out += `80% = (avg - 45) × 0.8 = ${calc.toFixed(2)}\n`;
        out += `Final Handicap = floor(max(0, ${calc.toFixed(2)})) = ${newHc}\n\n`;
      }

      // Weekly Net Breakdown
      out += "--- Weekly NET breakdown ---\n";
      p.scores.forEach((s, w) => {
        if (s === "DNP") {
          out += `Week ${w+1}: DNP\n`;
        } else {
          const h = p.handicaps[w] ?? 0;
          out += `Week ${w+1}: RAW ${s} - HC ${h} = NET ${s - h}\n`;
        }
      });

      out += "\n-----------------------------------------\n\n";
    });

    debugBox.textContent = out;
    document.body.appendChild(debugBox);
  })();

} // ← END initialize()



function renderStandings() {
  const tbody = document.getElementById("league-body");

  let list = players.map(p => {
  let weeklyNet = p.scores.map((raw, w) => {
    if (raw === "DNP") return "DNP";

    // Retroactive Week 3 handicap for Weeks 1–3
    if (w < 3) {
      const week3HC = p.handicaps[2] ?? 0;
      return raw - week3HC;
    }

    // Week N uses handicap from previous week (N-1)
    const prevHC = p.handicaps[w - 1] ?? 0;
    return raw - prevHC;
  });


    let totalRaw = p.scores.reduce((acc, s) => (s === "DNP" ? acc : acc + s), 0);
    let totalNet = weeklyNet.reduce((acc, s) => (s === "DNP" ? acc : acc + s), 0);

    return {
      ...p,
      totalRaw,
      totalNet,
      weeklyNet,
      hasDNP: p.scores.includes("DNP")
    };
  });

  // Sort DNP last, then by total net
  list.sort((a, b) => {
    if (a.hasDNP && !b.hasDNP) return 1;
    if (!a.hasDNP && b.hasDNP) return -1;
    return a.totalNet - b.totalNet;
  });

  tbody.innerHTML = list.map((p, i) => {
    const scores = p.scores.map((s, w) => {
      if (s === "DNP")
        return `<div><strong>Week ${w + 1}:</strong> <span class="dnp">DNP</span></div>`;
      return `<div><strong>Week ${w + 1}:</strong> ${s} (Net ${p.weeklyNet[w]})</div>`;
    }).join("");

    return `
      <tr class="player-row ${p.hasDNP ? "dnp-row" : ""}">
        <td>${i + 1}</td>
        <td>
          <div class="player-info">
            <span class="player-name">${p.name}</span>
            <button class="toggle-btn">View Scores</button>
          </div>
          <div class="scores-list hidden">${scores}</div>
        </td>
        <td>${p.handicaps[p.handicaps.length - 1] ?? 0}</td>
        <td>${p.totalRaw}</td>
        <td>${p.totalNet}</td>
      </tr>
    `;
  }).join("");

  document.querySelectorAll(".toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const list = btn.closest("td").querySelector(".scores-list");
      list.classList.toggle("hidden");
      btn.textContent = list.classList.contains("hidden") ? "View Scores" : "Hide Scores";
    });
  });
}

function renderSummary() {
  if (!summaries.length) return;

  const latest = [...summaries].sort((a, b) => b.week - a.week)[0];

  document.getElementById("summary-title").textContent = latest.title;
  document.getElementById("summary-content").innerHTML = latest.content;

  renderWeeklyAwards(latest.week);
}

function renderWeeklyAwards(weekNum) {
  const div = document.getElementById("weekly-awards");

  const scores = players
    .map(p => {
      const s = p.scores[weekNum - 1];
      return isMissingScore(s) ? null : { name: p.name, score: s };
    })
    .filter(Boolean);

  if (!scores.length) {
    div.innerHTML = "";
    return;
  }

  const low = scores.reduce((a, b) => (b.score < a.score ? b : a));
  const high = scores.reduce((a, b) => (b.score > a.score ? b : a));

  div.innerHTML = `
    <h3>Weekly Awards</h3>
    <p><strong>🏆 LOW-MAN:</strong> ${low.name} (${low.score})</p>
    <p><strong>🤡 HIGH-MAN:</strong> ${high.name} (${high.score})</p>
  `;
}
