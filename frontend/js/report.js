const API_BASE_URL = "http://https://adaptive-aid-production.up.railway.app";

document.addEventListener("DOMContentLoaded", () => {
  const reportMessage = document.getElementById("reportMessage");
  const reportSubtitle = document.getElementById("reportSubtitle");
  const scoreText = document.getElementById("scoreText");
  const scorePercent = document.getElementById("scorePercent");
  const summaryText = document.getElementById("summaryText");

  const durationValue = document.getElementById("durationValue");
  const answeredValue = document.getElementById("answeredValue");
  const correctValue = document.getElementById("correctValue");
  const wrongValue = document.getElementById("wrongValue");
  const skippedValue = document.getElementById("skippedValue");

  const strengthsList = document.getElementById("strengthsList");
  const weaknessesList = document.getElementById("weaknessesList");

  const easyCorrect = document.getElementById("easyCorrect");
  const easyWrong = document.getElementById("easyWrong");
  const easySkipped = document.getElementById("easySkipped");

  const mediumCorrect = document.getElementById("mediumCorrect");
  const mediumWrong = document.getElementById("mediumWrong");
  const mediumSkipped = document.getElementById("mediumSkipped");

  const hardCorrect = document.getElementById("hardCorrect");
  const hardWrong = document.getElementById("hardWrong");
  const hardSkipped = document.getElementById("hardSkipped");

  const backToMaterialsBtn = document.getElementById("backToMaterialsBtn");
  const newSessionBtn = document.getElementById("newSessionBtn");

  const quizId = localStorage.getItem("quizId");
  const savedReportData = localStorage.getItem("reportData");

  function showMessage(text) {
    if (!reportMessage) return;
    reportMessage.textContent = text;
    reportMessage.className = "message error";
  }

  function renderTags(container, items, className, fallbackText) {
    if (!container) return;

    container.innerHTML = "";

    if (!Array.isArray(items) || items.length === 0) {
      const tag = document.createElement("span");
      tag.className = `tag ${className}`;
      tag.textContent = fallbackText;
      container.appendChild(tag);
      return;
    }

    items.forEach((item) => {
      const tag = document.createElement("span");
      tag.className = `tag ${className}`;
      tag.textContent = item;
      container.appendChild(tag);
    });
  }

  function renderReport(payload) {
    const summary = payload.summary || payload;

    const overall = summary.overall_performance || {};
    const totals = summary.totals || {};
    const difficulty = summary.difficulty_breakdown || {};

    const easy = difficulty.easy || {};
    const medium = difficulty.medium || {};
    const hard = difficulty.hard || {};

    const noAttempts = (totals.total_answered ?? 0) === 0;
    const scoreTextValue = noAttempts
      ? "No questions attempted"
      : (overall.score_text || `${totals.total_correct || 0}/${totals.total_answered || 0}`);

    if (scoreText) {
      scoreText.textContent = scoreTextValue;

      if (noAttempts || scoreTextValue === "No questions attempted") {
        scoreText.classList.add("no-attempt");
      } else {
        scoreText.classList.remove("no-attempt");
      }
    }

    if (scorePercent) {
      const percent = overall.score_percent ?? 0;
      scorePercent.textContent = `${Number(percent).toFixed(1)}%`;
    }

    if (durationValue) {
      durationValue.textContent = overall.session_duration_text || "0m 0s";
    }

    if (answeredValue) {
      answeredValue.textContent = totals.total_answered ?? 0;
    }

    if (correctValue) {
      correctValue.textContent = totals.total_correct ?? 0;
    }

    if (wrongValue) {
      wrongValue.textContent = totals.total_wrong ?? 0;
    }

    if (skippedValue) {
      skippedValue.textContent = totals.total_skipped ?? 0;
    }

    if (summaryText) {
      const percentLine = `${Number(overall.score_percent ?? 0).toFixed(1)}%`;
      const durationLine = overall.session_duration_text || "0m 0s";

      if (noAttempts) {
        summaryText.textContent =
          `You ended this session before answering or skipping any questions. ` +
          `Your session lasted ${durationLine}.`;
      } else {
        summaryText.textContent =
          `You completed this session with an overall performance of ${scoreTextValue} (${percentLine}). ` +
          `Your session lasted ${durationLine}, with ${totals.total_skipped ?? 0} skipped question(s).`;
      }
    }

    renderTags(
      strengthsList,
      summary.strengths || [],
      "tag-strong",
      "No clear strength identified yet"
    );

    renderTags(
      weaknessesList,
      summary.weaknesses || [],
      "tag-weak",
      "No clear weakness identified yet"
    );

    if (easyCorrect) easyCorrect.textContent = easy.correct ?? 0;
    if (easyWrong) easyWrong.textContent = easy.wrong ?? 0;
    if (easySkipped) easySkipped.textContent = easy.skipped ?? 0;

    if (mediumCorrect) mediumCorrect.textContent = medium.correct ?? 0;
    if (mediumWrong) mediumWrong.textContent = medium.wrong ?? 0;
    if (mediumSkipped) mediumSkipped.textContent = medium.skipped ?? 0;

    if (hardCorrect) hardCorrect.textContent = hard.correct ?? 0;
    if (hardWrong) hardWrong.textContent = hard.wrong ?? 0;
    if (hardSkipped) hardSkipped.textContent = hard.skipped ?? 0;

    if (reportSubtitle) {
      reportSubtitle.textContent = noAttempts
        ? "No questions were attempted in this session"
        : "Your session summary is ready";
    }
  }

  async function fetchReport() {
    if (!quizId) {
      showMessage("No quiz found for this report.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/reports/${quizId}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showMessage(data.detail || data.message || "Failed to load report.");
        return;
      }

      renderReport(data);
    } catch (error) {
      console.error("Fetch report error:", error);
      showMessage("Could not connect to the server.");
    }
  }

  if (savedReportData) {
    try {
      const parsed = JSON.parse(savedReportData);
      renderReport(parsed);
    } catch (error) {
      console.error("Invalid saved report data:", error);
      fetchReport();
    }
  } else {
    fetchReport();
  }

  if (backToMaterialsBtn) {
    backToMaterialsBtn.addEventListener("click", () => {
      window.location.href = "materials.html";
    });
  }

  if (newSessionBtn) {
    newSessionBtn.addEventListener("click", () => {
      localStorage.removeItem("currentQuestion");
      localStorage.removeItem("answeredCount");
      localStorage.removeItem("score");
      localStorage.removeItem("lastAnswerResult");
      localStorage.removeItem("reportId");
      localStorage.removeItem("reportData");
      localStorage.removeItem("displayQuestionNumber");
      window.location.href = "materials.html";
    });
  }
});