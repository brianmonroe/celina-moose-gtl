//------------------------------------------------------------
// GTL APP — Final Version with Per-Week Handicap Support
//------------------------------------------------------------

let players = [];
let courses = [];
let summaries = [];

//------------------------------------------------------------
// Helper: Is a score missing?
//------------------------------------------------------------
function isMissingScore(s) {
  return (
    s === null ||
    s === "" ||
    s === 0 ||
    s === "x" ||
    s === "X" ||
    s === "ns" ||
    s === "NS" ||
    s === "—" ||
    s === 99 ||
    isNaN(s)
  );
}

//------------------------------------------------------------
// Latest week where ANY player has a valid score
//------------------------------------------------------------
function getLatestCompletedWeek(players) {
  const weekCount = Math.max(...players.map(p => p.scores.length));

  for (let w = weekCount - 1; w >= 0; w--) {
    const hasAnyScore = players.some(p => !isMissingScore(p.scores[w]));
    if (hasAnyScore) return w + 1;
  }

  return 1;
}

//------------------------------------------------------------
// Next week with a course assigned but not all scores submitted
//------------------------------------------------------------
function getNextCourseWeek(players, courses) {
  for (let w = 0; w < courses.length; w++) {
    const course = courses[w];
    if (!course || course.trim() === "") continue;

    const allDone = players.every(p => !isMissingScore(p.scores[w]));
    if (!allDone) return w + 1;
  }
  return null;
}

//------------------------------------------------------------
// LOAD DATA
//------------------------------------------------------------
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
      initializeApp();
    });
});

//------------------------------------------------------------
// MAIN APP INIT
//------------------------------------------------------------
function initializeApp() {
  const body = document.getElementById("league-body");
  const sortSelect = document.getElementById("sort-mode");

  const standingsWeek = getLatestCompletedWeek(players);
  const courseWeek = getNextCourseWeek(players, courses);

  //------------------------------------------------------------
  // Titles
  //------------------------------------------------------------
  document.getElementById("page-title").innerHTML =
    `Week ${standingsWeek} Leaderboard`;

  if (courseWeek && courses[courseWeek - 1]) {
    document.getElementById("page-subtitle").innerHTML =
      `Week ${courseWeek} Course: ${courses[courseWeek - 1]}`;
  } else {
    document.getElementById("page-subtitle").innerHTML = "";
  }

  //------------------------------------------------------------
  // RENDER STANDINGS
  //------------------------------------------------------------
  function render(sortBy = "net") {

    let list = players.map(p => {

      // Fallback if handicaps missing
      const hcaps = p.handicaps || [];

      // WEEKLY NET SCORES (fixed per-week handicap!)
      let weeklyNet = p.scores.map((s, w) => {
        if (s === "DNP") return "DNP";
        const h = hcaps[w] ?? 0;
        return s - h;
      });

      // TOTALS
      let totalRaw = p.scores.reduce((acc, s) => {
        if (s === "DNP") return acc;
        return acc + s;
      }, 0);

      let totalNet = weeklyNet.reduce((acc, s) => {
        if (s === "DNP") return acc;
        return acc + s;
      }, 0);

      return {
        ...p,
        weeklyNet,
        totalRaw,
        totalNet,
        hasDNP: p.scores.includes("DNP")
      };
    });

    // Sorting: DNP Last, then by totalNet
    list.sort((a, b) => {
      if (a.hasDNP && !b.hasDNP) return 1;
      if (!a.hasDNP && b.hasDNP) return -1;
      return a.totalNet - b.totalNet;
    });

    // Render
    body.innerHTML = list
      .map((p, i) => {
        let weeklyHtml = p.scores.map((s, w) => {
          if (s === "DNP") {
            return `<div><strong>Week ${w+1}:</strong> <span class="dnp">DNP</span></div>`;
          }
          return `<div><strong>Week ${w+1}:</strong> ${s} (Net: ${p.weeklyNet[w]})</div>`;
        }).join("");

        return `
          <tr class="player-row ${p.hasDNP ? "dnp-row" : ""}">
            <td>${i + 1}</td>
            <td>
              <div class="player-info">
                <span class="player-name">${p.name}</span>
                <button class="toggle-btn">View Scores</button>
              </div>
              <div class="scores-list hidden">${weeklyHtml}</div>
            </td>
            <td>${p.handicaps ? p.handicaps[p.handicaps.length - 1] : 0}</td>
            <td>${p.totalRaw}</td>
            <td>${p.totalNet}</td>
          </tr>
        `;
      })
      .join("");

    attachToggles();
  }

  //------------------------------------------------------------
  // Expand/Collapse Scores
  //------------------------------------------------------------
  function attachToggles() {
    document.querySelectorAll(".toggle-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const list = btn.closest("td").querySelector(".scores-list");
        list.classList.toggle("hidden");
        btn.textContent = list.classList.contains("hidden")
          ? "View Scores"
          : "Hide Scores";
      });
    });
  }

  sortSelect.addEventListener("change", e =>
    render(e.target.value, standingsWeek)
  );

  render("net", standingsWeek);

  //------------------------------------------------------------
  // WEEKLY SUMMARY
  //------------------------------------------------------------
  function renderSummary() {
    if (!summaries.length) return;

    const latest = [...summaries].sort((a, b) => b.week - a.week)[0];

    document.getElementById("summary-title").textContent = latest.title;
    document.getElementById("summary-content").innerHTML = latest.content;

    renderWeeklyAwards(latest.week);
  }

  //------------------------------------------------------------
  // WEEKLY AWARDS
  //------------------------------------------------------------
  function renderWeeklyAwards(weekNumber) {
    const awardsDiv = document.getElementById("weekly-awards");

    const scores = players
      .map(p => {
        const s = p.scores[weekNumber - 1];
        return isMissingScore(s) ? null : { name: p.name, score: s };
      })
      .filter(Boolean);

    if (!scores.length) {
      awardsDiv.innerHTML = "";
      return;
    }

    const lowMan = scores.reduce((a, b) => (b.score < a.score ? b : a));
    const highMan = scores.reduce((a, b) => (b.score > a.score ? b : a));

    awardsDiv.innerHTML = `
      <h3>Weekly Awards</h3>
      <p><strong>🏆 LOW-MAN AWARD:</strong> ${lowMan.name} (${lowMan.score})</p>
      <p><strong>🤡 HIGH-MAN AWARD:</strong> ${highMan.name} (${highMan.score})</p>
    `;
  }

  renderSummary();
}
