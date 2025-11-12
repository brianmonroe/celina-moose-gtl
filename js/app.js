document.addEventListener("DOMContentLoaded", () => {
  const body = document.getElementById("league-body");
  const sortSelect = document.getElementById("sort-mode");

  const getTotal = (scores) => scores.reduce((a, b) => a + b, 0);
  const getNet = (total, h) => (h !== null ? total - h : total);

  function render(sortBy = "net") {
    let list = players.map(p => {
      const total = getTotal(p.scores);
      const net = getNet(total, p.handicap);
      return { ...p, total, net };
    });

    list.sort((a, b) => a[sortBy] - b[sortBy]);

    body.innerHTML = list
      .map((p, i) => {
        const weekly = p.scores
          .map((s, w) => `<div><strong>Week ${w + 1}:</strong> ${s}</div>`)
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
  render(); // default = net

  // --- Weekly Summary ---
  function renderSummary() {
    const latest = weeklySummaries.sort((a, b) => b.week - a.week)[0];
    if (!latest) return;

    document.getElementById("summary-title").textContent = latest.title;
    document.getElementById("summary-content").innerHTML = latest.content.trim();
  }
  renderSummary();
});
