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
input { width:60px; }
button { padding:10px 20px; margin-top:20px; }
.dnp {
  color: #b33;
  font-weight: bold;
}

.dnp-row {
  background: #f0f0f0;
}
</style>
</head>
<body>

<h2>GTL Admin Dashboard</h2>

<div id="admin-container">Loading...</div>

<button id="publish-btn">Publish Changes</button>

<hr style="margin: 30px 0;">

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

  <!-- Formatting Buttons -->
  <div id="format-toolbar" style="margin-bottom:8px;">
    <button type="button" class="fmt-btn" data-tag="b">Bold</button>
    <button type="button" class="fmt-btn" data-tag="i">Italic</button>
    <button type="button" class="fmt-btn" data-insert="<br>">Line Break</button>
    <button type="button" class="fmt-btn" data-wrap="<p>" data-wrap-end="</p>">Paragraph</button>
    <button type="button" class="fmt-btn" data-insert="<ul><li>Item</li></ul>">Bullet List</button>
  </div>

  <textarea id="summary-content-input" rows="8" style="width:100%;"></textarea>
</div>
  </div>

  <button id="save-summary-btn">Save Summary</button>
  <span id="summary-status" style="margin-left:10px;"></span>
</section>

<script>
let players = [];
let courses = [];

fetch("../data/players.json?_=" + Date.now())
  .then(r => r.json())
  .then(data => {
    players = data.players;
    courses = data.courses ?? [];   // fallback if missing
    renderAdmin();
  });

function renderAdmin() {
  const container = document.getElementById("admin-container");

  let maxWeeks = Math.max(
    ...players.map(p => p.scores.length),
    courses.length
  );

  let html = "<table>";

  // --- COURSE ROW ---
  html += "<tr><th>Course</th><th></th>";
  for (let w = 0; w < maxWeeks; w++) {
    html += `
      <th>
        <input data-type="course" data-w="${w}"
        value="${courses[w] ?? ""}"
        placeholder="Course W${w+1}">
      </th>
    `;
  }
  html += "</tr>";

  // --- HEADER ROW ---
  html += "<tr><th>Player</th><th>Handicap</th>";
  for (let w = 1; w <= maxWeeks; w++) html += `<th>W${w}</th>`;
  html += "</tr>";

  // --- PLAYER ROWS ---
  players.forEach((p, i) => {
    html += `<tr><td>${p.name}</td>`;

    html += `
      <td>
        <input data-type="handicap" data-i="${i}" 
               type="number" value="${p.handicap}">
      </td>
    `;

    // SCORE INPUTS (NOW DROPDOWNS)
    for (let w = 0; w < maxWeeks; w++) {
      const current = p.scores[w] ?? "";

      html += `
        <td>
          <select data-type="score" data-i="${i}" data-w="${w}">
            <option value="">—</option>
            <option value="DNP" ${current === "DNP" ? "selected" : ""}>DNP</option>
            ${generateScoreOptions(current)}
          </select>
        </td>
      `;
    }

    html += "</tr>";
  });

  html += "</table>";

  // Add "New Week" button
  html += `
    <button id="add-week-btn" style="margin-top:15px;">Add New Week</button>
  `;

  container.innerHTML = html;

  document.getElementById("add-week-btn").onclick = addWeek;
}

function generateScoreOptions(current) {
  let options = "";
  for (let n = 40; n <= 90; n++) {
    options += `<option value="${n}" ${current == n ? "selected" : ""}>${n}</option>`;
  }
  return options;
}

function addWeek() {
  // Extend courses array
  courses.push("");

  // Extend each player's scores array
  players.forEach(p => p.scores.push(""));

  renderAdmin();
}

document.getElementById("publish-btn").addEventListener("click", () => {

  // Update courses
  document.querySelectorAll("input[data-type='course']").forEach(el => {
    const w = Number(el.dataset.w);
    courses[w] = el.value;
  });

  // Update handicaps
  document.querySelectorAll("input[data-type='handicap']").forEach(el => {
    const i = Number(el.dataset.i);
    players[i].handicap = Number(el.value);
  });

  // Update scores (DNP-aware)
  document.querySelectorAll("select[data-type='score']").forEach(sel => {
    const i = Number(sel.dataset.i);
    const w = Number(sel.dataset.w);
    const val = sel.value;

    if (val === "") players[i].scores[w] = "";
    else if (val === "DNP") players[i].scores[w] = "DNP";
    else players[i].scores[w] = Number(val);
  });

  // Publish
  fetch("save.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ players, courses })
  })
  .then(r => r.text())
  .then(text => alert(text));
});

</script>

<script>
  // ------- Weekly Summaries Admin -------

  let summaryData = { summaries: [] };

  // Load players (for max week count) and existing summaries
  Promise.all([
    fetch("../data/players.json?_=" + Date.now()).then(r => r.json()),
    fetch("../data/summaries.json?_=" + Date.now())
      .then(r => r.ok ? r.json() : { summaries: [] })
  ])
  .then(([playersJson, summariesJson]) => {
    const players = playersJson.players || [];
    const courses = playersJson.courses || [];

    const maxWeeks = Math.max(
      players.length ? Math.max(...players.map(p => p.scores.length)) : 0,
      courses.length
    );

    summaryData.summaries = summariesJson.summaries || [];
    setupSummaryAdmin(maxWeeks || 1);
  });

  function setupSummaryAdmin(maxWeeks) {
    const weekSelect   = document.getElementById("summary-week-select");
    const titleInput   = document.getElementById("summary-title-input");
    const contentInput = document.getElementById("summary-content-input");
    const statusSpan   = document.getElementById("summary-status");

    // Populate week dropdown
    weekSelect.innerHTML = "";
    for (let w = 1; w <= maxWeeks; w++) {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = "Week " + w;
      weekSelect.appendChild(opt);
    }

    function loadSelectedWeek() {
      const week = Number(weekSelect.value);
      const existing = summaryData.summaries.find(s => s.week === week);

      titleInput.value   = existing ? (existing.title   || "") : "";
      contentInput.value = existing ? (existing.content || "") : "";
      statusSpan.textContent = "";
    }

    weekSelect.addEventListener("change", loadSelectedWeek);
    loadSelectedWeek(); // load first week by default

    document.getElementById("save-summary-btn").addEventListener("click", () => {
      const week   = Number(weekSelect.value);
      const title  = titleInput.value.trim();
      const content = contentInput.value.trim();

      let entry = summaryData.summaries.find(s => s.week === week);
      if (entry) {
        entry.title = title;
        entry.content = content;
      } else {
        summaryData.summaries.push({ week, title, content });
      }

      fetch("save_summaries.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summaries: summaryData.summaries })
      })
      .then(r => r.text())
      .then(text => {
        statusSpan.textContent = text;
        setTimeout(() => statusSpan.textContent = "", 3000);
      });
    });
  }

   // ----------------------------------------------------
  // Simple HTML formatting helpers for summary editor
  // ----------------------------------------------------

  document.addEventListener("DOMContentLoaded", () => {
    const textarea = document.getElementById("summary-content-input");
    const buttons = document.querySelectorAll(".fmt-btn");

    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        const tag = btn.dataset.tag;
        const insert = btn.dataset.insert;
        const wrapStart = btn.dataset.wrap;
        const wrapEnd = btn.dataset.wrapEnd;

        // Get cursor position
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selected = textarea.value.substring(start, end);

        let newText;

        if (tag) {
          // <b>selected</b> or <i>selected</i>
          newText = `<${tag}>${selected || "TEXT"}</${tag}>`;
        } else if (insert) {
          // Insert literal HTML (like <br>)
          newText = insert;
        } else if (wrapStart && wrapEnd) {
          // Wrap in paragraph: <p>selected</p>
          newText = `${wrapStart}${selected || "Text here"}${wrapEnd}`;
        }

        // Replace the selection with the formatted text
        textarea.setRangeText(newText, start, end, "end");

        // Trigger change for live preview (if you add it later)
        textarea.dispatchEvent(new Event("input"));
      });
    });
  });
</script>



</body>
</html>
