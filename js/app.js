//------------------------------------------------------------
// GTL APP — Final Version with FIXED DNP Sorting (Mac-safe)
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
// Latest week where EVERY player has a valid score
//------------------------------------------------------------
function getLatestCompletedWeek(players) {
  const weekCount = Math.max(...players.map(p => p.scores.length));

  for (let w = weekCount - 1; w >= 0; w--) {
    const hasAnyScore = players.some(p => !isMissingScore(p.scores[w]));
    if (hasAnyScore) return w + 1; // 1-based week number
  }

  return 1;
}

//------------------------------------------------------------
// Next upcoming week with a course assigned
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

  // Determine key week indices
  const standingsWeek = getLatestCompletedWeek(players);   // IMPORTANT
  const courseWeek = getNextCourseWeek(players, courses);

  //------------------------------------------------------------
  // Page Title + Subtitle
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
  // Score Utilities
  //------------------------------------------------------------
  const getTotal = scores =>
    scores.reduce((acc, s) => acc + (!isMissingScore(s) ? s : 0), 0);

  const getNet = (total, h) => (h !== null ? total - h : total);

  //------------------------------------------------------------
  // RENDER STANDINGS
  //------------------------------------------------------------
  function render(sortBy = "net") {

  let list = players.map(p => {
    // Apply handicap to every week individually
    const weeklyNetScores = p.scores.map(s => {
      // If score is missing, treat as 0, do NOT apply handicap
      if (s === 0 || s === "DNP") return 0;
      return s - p.handicap;
    });

    const totalRaw = p.scores.reduce((a, b) => a + (isNaN(b) ? 0 : b), 0);
    const totalNet = weeklyNetScores.reduce((a, b) => a + (isNaN(b) ? 0 : b), 0);

    return {
      ...p,
      totalRaw,
      totalNet,
      weeklyNetScores
    };
  });

  // Use totalNet for net sorting
  list.sort((a, b) => a.totalNet - b.totalNet);

  body.innerHTML = list
    .map((p, i) => {

      const weeklyDisplay = p.scores
        .map((s, w) => {
          if (s === 0 || s === "DNP") {
            return `<div><strong>Week ${w+1}:</strong> <span class="dnp">DNP</span></div>`;
          }
          return `<div><strong>Week ${w+1}:</strong> ${s} (Net: ${p.weeklyNetScores[w]})</div>`;
        })
        .join("");

      return `
        <tr class="player-row ${p.scores.includes("DNP") || p.scores.includes(0) ? "dnp-row" : ""}">
          <td>${i + 1}</td>
          <td>
            <div class="player-info">
              <span class="player-name">${p.name}</span>
              <button class="toggle-btn">View Scores</button>
            </div>
            <div class="scores-list hidden">
              ${weeklyDisplay}
            </div>
          </td>
          <td>${p.handicap}</td>
          <td>${p.totalRaw}</td>
          <td>${p.totalNet}</td>
        </tr>
      `;
    })
    .join("");

  attachToggles();
}

  //------------------------------------------------------------
  // Toggle expanded weekly scores
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

  // Dropdown changes
  sortSelect.addEventListener("change", e =>
    render(e.target.value, standingsWeek)
  );

  // First render
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
      <p><strong>🤡 HIGH-MAN AWARDD:</strong> ${highMan.name} (${highMan.score})</p>
    `;
  }

  renderSummary();
}
