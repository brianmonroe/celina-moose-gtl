<?php
session_start();
if (!isset($_SESSION['gtl_admin'])) {
    header("Location: index.php");
    exit;
}
?>
<!DOCTYPE html>
<html>
<head>
<title>GTL Admin Dashboard</title>
<style>
body { font-family: Arial; padding:20px; }
table { width:100%; border-collapse:collapse; margin-top:20px; }
td, th { border:1px solid #ccc; padding:8px; text-align:center; }
th { background:#333; color:white; }
input, select { width:70px; }
button { padding:10px 20px; margin-top:20px; cursor:pointer; }
.dnp { color:#b33; font-weight:bold; }
.dnp-row { background:#f7f7f7; }
</style>
</head>
<body>

<h2>GTL Admin Dashboard</h2>

<div id="admin-container">Loading...</div>

<button id="publish-btn">Publish Changes</button>
<button id="recompute-btn" style="background:#0077cc;color:white;">Recompute Handicaps</button>

<hr style="margin: 40px 0;">

<!-- WEEKLY SUMMARIES (unchanged) -->
<section id="summary-admin">
  <h2>Weekly Summaries</h2>

  <div style="margin-bottom:10px;">
    <label for="summary-week-select"><strong>Week:</strong></label>
    <select id="summary-week-select"></select>
  </div>

  <div style="margin-bottom:10px;">
    <label for="summary-title-input"><strong>Title:</strong></label><br>
    <input type="text" id="summary-title-input" style="width:100%;">
  </div>

  <div style="margin-bottom:10px;">
    <label><strong>Content (HTML allowed):</strong></label><br>

    <div id="format-toolbar" style="margin-bottom:8px;">
      <button type="button" class="fmt-btn" data-tag="b">Bold</button>
      <button type="button" class="fmt-btn" data-tag="i">Italic</button>
      <button type="button" class="fmt-btn" data-insert="<br>">Line Break</button>
      <button type="button" class="fmt-btn" data-wrap="<p>" data-wrap-end="</p>">Paragraph</button>
      <button type="button" class="fmt-btn" data-insert="<ul><li>Item</li></ul>">Bullet List</button>
    </div>

    <textarea id="summary-content-input" rows="8" style="width:100%;"></textarea>
  </div>

  <button id="save-summary-btn">Save Summary</button>
  <span id="summary-status" style="margin-left:10px;"></span>
</section>

<script>
let players = [];
let courses = [];

// Load data
fetch("../data/players.json?_=" + Date.now())
  .then(r => r.json())
  .then(data => {
    players = data.players;
    courses = data.courses ?? [];
    renderAdmin();
  });

// ---------- RENDER ADMIN TABLE ----------
function renderAdmin() {
  const container = document.getElementById("admin-container");
  let maxWeeks = Math.max(...players.map(p => p.scores.length), courses.length);

  let html = "<table>";

  // Courses row
  html += "<tr><th>Course</th><th></th>";
  for (let w = 0; w < maxWeeks; w++) {
    html += `
      <th>
        <input data-type="course" data-w="${w}" value="${courses[w] ?? ""}">
      </th>
    `;
  }
  html += "</tr>";

  // Header
  html += "<tr><th>Player</th><th>HC (W)</th>";
  for (let w = 1; w <= maxWeeks; w++) html += `<th>W${w}</th>`;
  html += "</tr>";

  // Player rows
  players.forEach((p, i) => {
    html += `<tr><td>${p.name}</td>`;

    html += `
      <td>
        <input data-type="handicap" data-i="${i}" data-w="LAST" 
               value="${p.handicaps[p.handicaps.length - 1] ?? 0}">
      </td>
    `;

    for (let w = 0; w < maxWeeks; w++) {
      const s = p.scores[w] ?? "";
      const h = p.handicaps[w] ?? "";

      html += `
        <td>
          <select data-type="score" data-i="${i}" data-w="${w}">
            <option value="">—</option>
            <option value="DNP" ${s === "DNP" ? "selected" : ""}>DNP</option>
            ${generateScoreOptions(s)}
          </select>
        </td>
      `;
    }

    html += "</tr>";
  });

  html += "</table>";

  html += `<button id="add-week-btn" style="margin-top:15px;">Add Week</button>`;
  container.innerHTML = html;

  document.getElementById("add-week-btn").onclick = addWeek;
}

function generateScoreOptions(current) {
  let html = "";
  for (let n = 40; n <= 90; n++) {
    html += `<option value="${n}" ${current == n ? "selected" : ""}>${n}</option>`;
  }
  return html;
}

function addWeek() {
  courses.push("");
  players.forEach(p => {
    p.scores.push("");
    p.handicaps.push("");
  });
  renderAdmin();
}

// ---------- PUBLISH ----------
document.getElementById("publish-btn").addEventListener("click", () => {
  // Save course updates
  document.querySelectorAll("input[data-type='course']").forEach(el => {
    courses[Number(el.dataset.w)] = el.value;
  });

  // Save scores
  document.querySelectorAll("select[data-type='score']").forEach(el => {
    const i = Number(el.dataset.i);
    const w = Number(el.dataset.w);

    const v = el.value;
    players[i].scores[w] = (v === "" ? "" : v === "DNP" ? "DNP" : Number(v));
  });

  fetch("save.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ players, courses })
  }).then(r => r.text()).then(alert);
});

// ---------- RECOMPUTE HANDICAPS ----------
document.getElementById("recompute-btn").addEventListener("click", () => {
  recomputeHandicaps();
  renderAdmin(); // Refresh UI
});

function recomputeHandicaps() {
  players.forEach(p => {
    const scores = p.scores;
    const h = [];

    for (let w = 0; w < scores.length; w++) {
      if (w < 2) {
        h.push(""); // Weeks 1–2 always empty
        continue;
      }

      // Compute handicap based on previous 3 raw scores
      const window = scores.slice(w - 3, w).filter(s => s !== "DNP" && s !== "" && !isNaN(s));

      if (window.length < 3) {
        h.push("");
        continue;
      }

      const avg = window.reduce((a, b) => a + b, 0) / 3;
      const raw = avg - 45;
      const hc = Math.max(0, Math.floor(raw * 0.8));

      h.push(hc);
    }

    p.handicaps = h;
  });

  // Save back to file
  fetch("save.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ players, courses })
  });
}
</script>

</body>
</html>
