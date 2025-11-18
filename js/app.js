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
  function render(sortBy = "net", standingsWeekParam) {
    const list = players.map(p => {
      const total = getTotal(p.scores);
      const net = getNet(total, p.handicap);
      return { ...p, total, net };
    });

    // -------- FIXED SORTING --------
    list.sort((a, b) => {
      const aMissing = isMissingScore(a.scores[standingsWeekParam - 1]);
      const bMissing = isMissingScore(b.scores[standingsWeekParam - 1]);

      // If A DNP and B didn't → A goes last
      if (aMissing && !bMissing) return 1;

      // If B DNP and A didn't → B goes last
      if (!aMissing && bMissing) return -1;

      // Otherwise sort normally
      return a[sortBy] - b[sortBy];
    });

    body.innerHTML = list
      .map((p, i) => {
        // Weekly score list
        const weekly = p.scores
          .map((s, w) => {
            if (isMissingScore(s)) {
              return `
                <div>
                  <strong>Week ${w + 1}:</strong>
                  <span class="badge-dnp">DNP</span>
                </div>
              `;
            }
            return `<div><strong>Week ${w + 1}:</strong> ${s}</div>`;
          })
          .join("");

        // DNP badge for leaderboard table (Option B)
        const dnp = isMissingScore(p.scores[standingsWeekParam - 1])
          ? `<span class="badge-dnp" style="margin-left:6px;">DNP</span>`
          : "";

        const rowClass = isMissingScore(p.scores[standingsWeekParam - 1]) 
          ? "player-row dnp-row" 
          : "player-row";
        
        return `
          <tr class="${rowClass}">
            <td>${i + 1}</td>
            <td>
              <div class="player-info">
                <span class="player-name">${p.name}</span>
                <button class="toggle-btn">View Scores</button>
              </div>
              <div class="scores-list hidden">${weekly}</div>
            </td>
            <td>${p.handicap ?? "—"}</td>
            <td>${p.total} ${dnp}</td>
            <td>${p.net} ${dnp}</td>
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
