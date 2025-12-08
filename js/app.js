//------------------------------------------------------------
// GTL FRONTEND — Per-Week Handicap Version (WITH 80% RULE)
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

  document.getElementById("sort-mode").addEventListener("change", (e) => {
    renderStandings(e.target.value);
  });

  renderStandings("net");
  renderSummary();

  // ------------------------------------------------------------
  // HANDICAP DEBUG MODE (?hc=1)
  // ------------------------------------------------------------
  (function () {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("hc")) return;

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
      const scores = p.scores.map(s => s === "DNP" ? null : Number(s));

      out += `PLAYER: ${p.name}\n`;
      out += `Raw Scores: ${JSON.stringify(scores)}\n\n`;

      let handicaps = [];

      // --- Week 3 Handicap (RAW, 80% rule)
      if (scores.length >= 3 && scores[0] !== null && scores[1] !== null && scores[2] !== null) {
        const avg = (scores[0] + scores[1] + scores[2]) / 3;
        handicaps[2] = Math.max(0, Math.round((avg - PAR) * 0.8));

        out += `--- Handicap Formula Week 3 ---\n`;
        out += `RAW: ${scores[0]}, ${scores[1]}, ${scores[2]}\n`;
        out += `Avg = ${avg.toFixed(2)} | AbvPar = ${(avg - PAR).toFixed(2)}\n`;
        out += `HC = ${handicaps[2]}\n\n`;
      }

      // --- Weeks 4+ (NET-window, 80% rule)
      for (let w = 3; w < scores.length; w++) {
        let tempNet = [];

        for (let i = 0; i < w; i++) {
          if (scores[i] === null) {
            tempNet[i] = null;
            continue;
          }
          if (i < 3) tempNet[i] = scores[i] - (handicaps[2] ?? 0);
          else tempNet[i] = scores[i] - (handicaps[i - 1] ?? 0);
        }

        const a = tempNet[w - 3];
        const b = tempNet[w - 2];
        const c = tempNet[w - 1];

        if (a === null || b === null || c === null) {
          handicaps[w] = handicaps[w - 1] ?? 0;
          out += `--- Week ${w + 1} HC Skipped (DNP)\n\n`;
          continue;
        }

        const avg = (a + b + c) / 3;
        const hc = Math.max(0, Math.round((avg - 45) * 0.8));
        handicaps[w] = hc;

        out += `--- Handicap Formula Week ${w + 1} ---\n`;
        out += `NETs: ${a}, ${b}, ${c}\n`;
        out += `Avg NET=${avg.toFixed(2)} | HC=${hc}\n\n`;
      }

      // --- Weekly Nets
      out += "--- Weekly NET Breakdown ---\n";

      for (let w = 0; w < scores.length; w++) {
        if (scores[w] === null) {
          out += `Week ${w + 1}: DNP\n`;
          continue;
        }

        let appliedHC = (w < 3) ? (handicaps[2] ?? 0) : (handicaps[w - 1] ?? 0);
        const net = scores[w] - appliedHC;

        out += `Week ${w + 1}: RAW ${scores[w]} - HC ${appliedHC} = NET ${net}\n`;
      }

      out += `\n-----------------------------------------\n\n`;
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

    const PAR = 45;
    const scores = p.scores.map(s => s === "DNP" ? null : Number(s));
    let handicaps = [];

    // ----------------------------
    // Week 3 (RAW, 80% rule)
    // ----------------------------
    if (scores.length >= 3 && scores[0] !== null && scores[1] !== null && scores[2] !== null) {
      const avg = (scores[0] + scores[1] + scores[2]) / 3;
      handicaps[2] = Math.max(0, Math.round((avg - PAR) * 0.8));
    }

    // ----------------------------
    // Weeks 4+ (NET sliding window, 80% rule)
    // ----------------------------
    for (let w = 3; w < scores.length; w++) {
      let tempNet = [];

      for (let i = 0; i < w; i++) {
        if (scores[i] === null) {
          tempNet[i] = null;
          continue;
        }
        if (i < 3) tempNet[i] = scores[i] - (handicaps[2] ?? 0);
        else tempNet[i] = scores[i] - (handicaps[i - 1] ?? 0);
      }

      const a = tempNet[w - 3];
      const b = tempNet[w - 2];
      const c = tempNet[w - 1];

      if (a === null || b === null || c === null) {
        handicaps[w] = handicaps[w - 1] ?? 0;
        continue;
      }

      const avg = (a + b + c) / 3;
      handicaps[w] = Math.max(0, Math.round((avg - 45) * 0.8));
    }

    // ----------------------------
    // Weekly NET scores
    // ----------------------------
    let weeklyNet = scores.map((raw, w) => {
      if (raw === null) return "DNP";
      let appliedHC = (w < 3)
        ? (handicaps[2] ?? 0)
        : (handicaps[w - 1] ?? 0);
      return raw - appliedHC;
    });

    // ----------------------------
    // Totals
    // ----------------------------
    const totalRaw = scores.reduce((a, s) => s === null ? a : a + s, 0);
    const totalNet = weeklyNet.reduce((a, s) => s === "DNP" ? a : a + s, 0);

    return {
      ...p,
      handicaps,
      weeklyNet,
      totalRaw,
      totalNet,
      hasDNP: scores.includes(null)
    };
  });

  // ------------------------------------------------------------
  // Sorting
  // ------------------------------------------------------------
  list.sort((a, b) => {
    if (a.hasDNP && !b.hasDNP) return 1;
    if (!a.hasDNP && b.hasDNP) return -1;

    if (sortBy === "total") return a.totalRaw - b.totalRaw;

    const netDiff = a.totalNet - b.totalNet;
    if (netDiff !== 0) return netDiff;

    const aHC = a.handicaps[a.handicaps.length - 1] ?? 0;
    const bHC = b.handicaps[b.handicaps.length - 1] ?? 0;
    if (aHC !== bHC) return aHC - bHC;

    return a.name.localeCompare(b.name);
  });

  // ------------------------------------------------------------
  // Render rows
  // ------------------------------------------------------------
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
