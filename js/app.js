//------------------------------------------------------------
// GTL APP — Final Unified Frontend Logic (Option A)
//------------------------------------------------------------

let players = [];
let courses = [];
let summaries = [];

//------------------------------------------------------------
// Determine latest completed week (all players have scores)
//------------------------------------------------------------
function getLatestCompletedWeek(players) {
  const weekCount = Math.max(...players.map(p => p.scores.length));

  for (let w = weekCount - 1; w >= 0; w--) {
    const allHaveScores = players.every(p => {
      const s = p.scores[w];
      return s !== "" && s !== null && !isNaN(s);
    });
    if (allHaveScores) return w + 1; // convert to 1-based
  }

  return 1;
}

//------------------------------------------------------------
// Determine next week with a course but incomplete scores
//------------------------------------------------------------
function getNextCourseWeek(players, courses) {
  for (let w = 0; w < courses.length; w++) {
    const course = courses[w];
    if (!course || course.trim() === "") continue;

    const allHaveScores = players.every(p => {
      const s = p.scores[w];
      // 0 MUST count as "not played yet"
      return s !== "" && s !== null && s !== 0 && !isNaN(s);
    });

    if (!allHaveScores) {
      return w + 1; // return 1-based week
    }
  }

  return null;
}

//------------------------------------------------------------
// Load Data (players.json → summaries.json)
//------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  fetch("data/players.json?_=" + Date.now())
    .then(r => r.json())
    .then(data => {
      players = data.players ?? [];
      courses = data.courses ?? [];

      return fetch("data/summaries.json?_=" + Date.now());
    })
    .then(r => r.json())
    .then(summaryData => {
      summaries = summaryData.summaries ?? [];
      initializeApp();
    });
});

//------------------------------------------------------------
// MAIN INITIALIZER
//------------------------------------------------------------
function initializeApp() {
  const body = document.getElementById("league-body");
  const sortSelect = document.getElementById("sort-mode");

  //------------------------------------------------------------
  // PAGE HEADER (Leaderboard + Course)
  //------------------------------------------------------------
  const standingsWeek = getLatestCompletedWeek(players);
  const courseWeek = getNextCourseWeek(players, courses);

  // Leaderboard title
  document.getElementById("page-title").innerHTML =
    `Week ${standingsWeek} Leaderboard`;

  // Course subtitle
  if (courseWeek && courses[courseWeek - 1]) {
    document.getElementById("page-subtitle").innerHTML =
      `Week ${courseWeek} Course: ${courses[courseWeek - 1]}`;
  } else {
    document.getElementById("page-subtitle").innerHTML = "";
  }

  //------------------------------------------------------------
  // Standings Table Rendering
  //------------------------------------------------------------
  const getTotal = scores => scores.reduce((a, b) => a + b, 0);
  const getNet = (total, h) => (h !== null ? total - h : total);

  function render(sortBy = "net") {
    const list = players.map(p => ({
      ...p,
      total: getTotal(p.scores),
      net: getNet(getTotal(p.scores), p.handicap)
    }));

    list.sort((a, b) => a[sortBy] - b[sortBy]);

    body.innerHTML = list
      .map((p, i) => {
        const weekly = p.scores
          .map((s, w) => {
            const display =
              (s === 0 || s === null || s === "" || isNaN(s)) ? "—" : s;
            return `<div><strong>Week ${w + 1}:</strong> ${display}</div>`;
          })
          .join("");

        return `
          <tr class="player-row">
            <td>${i + 1}</td>
            <td>
              <div class="player-info">
                <span class="player-name">${p.name}</span>
                <button class="toggle-btn">View Scores</button>
              </div>
              <div class="scores-list hidden">${weekly}</div>
            </td>
            <td>${p.handicap ?? "—"}</td>
            <td>${p.total}</td>
            <td>${p.net}</td>
          </tr>
        `;
      })
      .join("");

    attachToggles();
  }

  //------------------------------------------------------------
  // Expand/Collapse Score Toggles
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

  sortSelect.addEventListener("change", e => render(e.target.value));
  render(); // initial render

  //------------------------------------------------------------
  // WEEKLY SUMMARY (title + content + awards)
  //------------------------------------------------------------
  function renderSummary() {
    if (!summaries.length) return;

    const latest = [...summaries].sort((a, b) => b.week - a.week)[0];

    document.getElementById("summary-title").textContent = latest.title;
    document.getElementById("summary-content").innerHTML = latest.content;

    renderWeeklyAwards(latest.week);
  }

  renderSummary();

  //------------------------------------------------------------
  // WEEKLY AWARDS (Dynamic Low-Man + High-Man)
  //------------------------------------------------------------
  function renderWeeklyAwards(weekNumber) {
    const awardsDiv = document.getElementById("weekly-awards");

    const weekScores = players
      .map(p => {
        const score = p.scores[weekNumber - 1];
        return (score !== null && score !== "" && !isNaN(score))
          ? { name: p.name, score }
          : null;
      })
      .filter(Boolean);

    if (!weekScores.length) {
      awardsDiv.innerHTML = "";
      return;
    }

    const lowMan = weekScores.reduce((a, b) => (b.score < a.score ? b : a));
    const highMan = weekScores.reduce((a, b) => (b.score > a.score ? b : a));

    awardsDiv.innerHTML = `
      <h3>Weekly Awards</h3>
      <p><strong>🏆 LOW-MAN AWARD:</strong> ${lowMan.name} (${lowMan.score})</p>
      <p><strong>🤡 HIGH-MAN AWARD:</strong> ${highMan.name} (${highMan.score})</p>
    `;
  }
}
