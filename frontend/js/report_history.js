const API_BASE_URL = "http://https://adaptive-aid-production.up.railway.app";

document.addEventListener("DOMContentLoaded", () => {
  const historyTitle = document.getElementById("historyTitle");
  const historySubtitle = document.getElementById("historySubtitle");
  const historyMessage = document.getElementById("historyMessage");
  const reportsList = document.getElementById("reportsList");
  const backToCoursesBtn = document.getElementById("backToCoursesBtn");

  const studentId = localStorage.getItem("studentId") || "1";
  const courseId = localStorage.getItem("selectedCourseId");
  const courseName = localStorage.getItem("selectedCourseName") || "Selected Course";

  function showMessage(text) {
    if (!historyMessage) return;
    historyMessage.textContent = text;
    historyMessage.className = "message error";
  }

  function formatDate(dateString) {
  if (!dateString) return "Unknown date";

  let fixedDateString = dateString;

  if (!fixedDateString.endsWith("Z") && !fixedDateString.includes("+")) {
    fixedDateString += "Z";
  }

  const date = new Date(fixedDateString);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

  function renderReports(reports) {
    reportsList.innerHTML = "";

    if (!Array.isArray(reports) || reports.length === 0) {
      reportsList.innerHTML = `
        <div class="empty-card">
          No evaluation reports yet for this course.
        </div>
      `;
      return;
    }

    reports.forEach((report, index) => {
      const card = document.createElement("div");
      card.className = "report-card";

      card.innerHTML = `
        <div class="report-info">
        <h3>${report.material_name || `Session ${reports.length - index}`}</h3>          <p>Date: ${formatDate(report.created_at)}</p>
          <p>Score: ${report.score_text} (${Number(report.score_percent || 0).toFixed(1)}%)</p>
        </div>

        <div class="score-badge">
          ${Number(report.score_percent || 0).toFixed(1)}%
        </div>

        <button class="btn btn-primary" data-quiz-id="${report.quiz_id}">
          View Report
        </button>
      `;

      const viewBtn = card.querySelector("button");

      viewBtn.addEventListener("click", () => {
        localStorage.setItem("quizId", String(report.quiz_id));
        localStorage.setItem("reportData", JSON.stringify({
          quiz_id: report.quiz_id,
          report_id: report.report_id,
          summary: report.summary
        }));

        window.location.href = "report.html";
      });

      reportsList.appendChild(card);
    });
  }

  async function loadReportHistory() {
    if (!courseId) {
      showMessage("No course selected.");
      return;
    }

    historyTitle.textContent = `${courseName} Report History`;
    historySubtitle.textContent = "Previous evaluation reports for this course";

    try {
      const response = await fetch(
        `${API_BASE_URL}/analytics/student/${studentId}/course/${courseId}/reports`
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showMessage(data.detail || data.message || "Failed to load report history.");
        return;
      }

      renderReports(data.reports || []);
    } catch (error) {
      console.error("Load report history error:", error);
      showMessage("Could not connect to the server.");
    }
  }

  if (backToCoursesBtn) {
    backToCoursesBtn.addEventListener("click", () => {
      window.location.href = "courses.html";
    });
  }

  loadReportHistory();
});