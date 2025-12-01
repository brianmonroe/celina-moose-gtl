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

// ------------------------------------------------------------
// Load JSON data
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Determine latest completed week
// ------------------------------------------------------------
function getLatestCompletedWeek(players) {
  const weeks = Math.max(...players.map(p => p.scores.length));
  for (let w = weeks - 1; w >= 0; w--) {
    if (players.some(p => !isMissingScore(p.scores[w]))) {
      return w + 1;
    }
  }
  return 1;
}

// ------------------------------------------------------------
// Initialize page
// ------------------------------------------------------------
function initialize() {
  const standingsWeek = getLatestCompletedWeek(players);

  document.getElementById("page-title").textContent =
    `Week ${standingsWeek} Leaderboard`;

  // Enable dropdown sorting
  document.getElementById("sort-mode").addEventListener("change", (e) => {
    renderStandings(e.target.value);
  });

  renderStandings("net");
  renderSummary();

    // ------------------------------------------------------------
  // HANDICAP DEBUG MODE (?hc=1)
  // Shows formula for the *latest* handicap week (3, 4, 5, …)
  // and the actual applied HC per week.
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

      // ---- Latest handicap formula (Week N) ----
      const hcIndex = (() => {
        const arr = p.handicaps || [];
        for (let i = arr.length - 1; i >= 0; i--) {
          const h = arr[i];
          if (h !== "" && h !== null && !isNaN(h)) return i;
        }
        return -1;
      })();

      if (hcIndex >= 2) {
        const start = hcIndex - 2;              // sliding window of 3 weeks
        const windowScores = p.scores
          .slice(start, hcIndex + 1)
          .map(Number);

        const avg =
          windowScores.reduce((a, b) => a + b, 0) / windowScores.length;
        const abovePar = avg - PAR;
        const calc = abovePar * 0.8;
        const newHc = Math.max(0, Math.round(calc));

        out += `--- Handicap Formula for Week ${hcIndex + 1} ---\n`;
        out += `Using weeks ${start + 1}–${hcIndex + 1} scores: ${windowScores.join(", ")}\n`;
        out += `Average = ${avg.toFixed(2)}\n`;
        out += `Above Par = avg - 45 = ${abovePar.toFixed(2)}\n`;
        out += `80% = (avg - 45) × 0.8 = ${calc.toFixed(2)}\n`;
        out += `Final Handicap = round(max(0, ${calc.toFixed(2)})) = ${newHc}\n\n`;
      } else if (p.scores.length >= 3) {
        // Fallback: if no handicaps are stored yet, show the "first" one (Week 3)
        const w1 = Number(p.scores[0]);
        const w2 = Number(p.scores[1]);
        const w3 = Number(p.scores[2]);
        const avg = (w1 + w2 + w3) / 3;
        const abovePar = avg - PAR;
        const calc = abovePar * 0.8;
        const newHc = Math.max(0, Math.round(calc));

        out += `--- First Handicap Formula (Week 3) ---\n`;
        out += `Using weeks 1–3 scores: ${w1}, ${w2}, ${w3}\n`;
        out += `Average = ${avg.toFixed(2)}\n`;
        out += `Above Par = avg - 45 = ${abovePar.toFixed(2)}\n`;
        out += `80% = (avg - 45) × 0.8 = ${calc.toFixed(2)}\n`;
        out += `Final Handicap = round(max(0, ${calc.toFixed(2)})) = ${newHc}\n\n`;
      }

      // ---- Weekly NET breakdown using ACTUAL applied HC ----
      out += "--- Weekly NET breakdown (applied HC) ---\n";

      p.scores.forEach((raw, w) => {
        if (raw === "DNP") {
          out += `Week ${w + 1}: DNP\n`;
          return;
        }

        let appliedHC = 0;
        if (w < 3) {
          // Weeks 1–3 use Week 3 HC
          appliedHC = p.handicaps[2] ?? 0;
        } else {
          // Week N uses HC from previous week (N-1)
          appliedHC = p.handicaps[w - 1] ?? 0;
        }

        out += `Week ${w + 1}: RAW ${raw} - HC ${appliedHC} = NET ${raw - appliedHC}\n`;
      });

      out += "\n-----------------------------------------\n\n";
    });

    debugBox.textContent = out;
    document.body.appendChild(debugBox);
  })();
}

// ------------------------------------------------------------
// Render standings table
// ------------------------------------------------------------
function renderStandings(sortBy = "net") {
  const tbody = document.getElementById("league-body");

  let list = players.map(p => {
    let weeklyNet = p.scores.map((raw, w) => {
      if (raw === "DNP") return "DNP";

      // Weeks 1–3: retro Week 3 handicap
      if (w < 3) {
        const week3HC = p.handicaps[2] ?? 0;
        return raw - week3HC;
      }

      // Week N uses handicap from previous week
      const prevHC = p.handicaps[w - 1] ?? 0;
      return raw - prevHC;
    });

    let totalRaw = p.scores.reduce((acc, s) => s === "DNP" ? acc : acc + s, 0);
    let totalNet = weeklyNet.reduce((acc, s) => s === "DNP" ? acc : acc + s, 0);

    return {
      ...p,
      totalRaw,
      totalNet,
      weeklyNet,
      hasDNP: p.scores.includes("DNP")
    };
  });

  // ------------------------------------------------------------
  // Sorting with tiebreakers
  // ------------------------------------------------------------
  list.sort((a, b) => {
    // 1. DNP last
    if (a.hasDNP && !b.hasDNP) return 1;
    if (!a.hasDNP && b.hasDNP) return -1;

    if (sortBy === "total") {
      return a.totalRaw - b.totalRaw;
    }

    // 2. NET sort
    const netDiff = a.totalNet - b.totalNet;
    if (netDiff !== 0) return netDiff;

    // 3. Tiebreaker = lower final handicap wins
    const aHC = a.handicaps[a.handicaps.length - 1] ?? 0;
    const bHC = b.handicaps[b.handicaps.length - 1] ?? 0;

    if (aHC !== bHC) return aHC - bHC;

    // 4. Alphabetical fallback
    return a.name.localeCompare(b.name);
  });

  // ------------------------------------------------------------
  // Render rows
  // ------------------------------------------------------------
  tbody.innerHTML = list.map((p, i) => {
    const scores = p.scores.map((s, w) => {
      if (s === "DNP")
        return `<div><strong>Week ${w+1}:</strong> <span class="dnp">DNP</span></div>`;
      return `<div><strong>Week ${w+1}:</strong> ${s} (Net ${p.weeklyNet[w]})</div>`;
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

// ------------------------------------------------------------
// Weekly summary + awards
// ------------------------------------------------------------
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
