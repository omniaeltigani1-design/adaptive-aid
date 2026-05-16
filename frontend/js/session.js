const API_BASE_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", () => {
  const questionText = document.getElementById("questionText");
  const optionsContainer = document.getElementById("optionsList");
  const submitAnswerBtn = document.getElementById("submitBtn");
  const skipQuestionBtn = document.getElementById("skipBtn");
  const endSessionBtn = document.getElementById("endSessionBtn");
  const nextQuestionBtn = document.getElementById("nextQuestionBtn");
  const sessionMessage = document.getElementById("sessionMessage");
  const questionCard = document.querySelector(".question-card");

  const courseNameEl = document.getElementById("testCourseName");
  const chapterNameEl = document.getElementById("testChapterName");
  const currentQuestionEl = document.getElementById("currentQuestion");
  const difficultyBadge = document.getElementById("difficultyBadge");
  const difficultyMini = document.getElementById("difficultyMini");
  const scoreEl = document.getElementById("score");
  const sessionTimer = document.getElementById("sessionTimer");

  const quizId = localStorage.getItem("quizId");
  const selectedCourseName = localStorage.getItem("selectedCourseName");
  const selectedMaterialName =
    localStorage.getItem("selectedMaterialName") || "Selected Material";

  let currentQuestion = null;
  let selectedOptionId = null;
  let hasAnsweredCurrentQuestion = false;

  let answeredCount = Number(localStorage.getItem("answeredCount") || 0);
  let score = Number(localStorage.getItem("score") || 0);
  let displayQuestionNumber = Number(localStorage.getItem("displayQuestionNumber") || 1);

  let sessionStartTime = localStorage.getItem("sessionStartTime");

  if (!sessionStartTime) {
    sessionStartTime = Date.now().toString();
    localStorage.setItem("sessionStartTime", sessionStartTime);
  }

  let timerInterval = null;
  let pausedDuration = Number(localStorage.getItem("pausedDuration") || 0);
  let pauseStartedAt = null;

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function startTimer() {
    if (!sessionTimer) return;

    function updateTimer() {
      const elapsedSeconds = Math.floor(
        (Date.now() - Number(sessionStartTime) - pausedDuration) / 1000
      );

      sessionTimer.textContent = formatTime(Math.max(elapsedSeconds, 0));
    }

    updateTimer();

    if (!timerInterval) {
      timerInterval = setInterval(updateTimer, 1000);
    }
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function pauseTimer() {
    if (pauseStartedAt) return;
    pauseStartedAt = Date.now();
    stopTimer();
  }

  function resumeTimer() {
    if (!pauseStartedAt) {
      startTimer();
      return;
    }

    pausedDuration += Date.now() - pauseStartedAt;
    localStorage.setItem("pausedDuration", String(pausedDuration));
    pauseStartedAt = null;

    startTimer();
  }

  function showMessage(text, type = "error") {
    if (!sessionMessage) return;
    sessionMessage.textContent = text;
    sessionMessage.className = `feedback-message ${type}`;
  }

  function clearMessage() {
    if (!sessionMessage) return;
    sessionMessage.textContent = "";
    sessionMessage.className = "feedback-message";
  }

  function setButtonsDisabled(disabled) {
    if (submitAnswerBtn) submitAnswerBtn.disabled = disabled;
    if (skipQuestionBtn) skipQuestionBtn.disabled = disabled;
    if (endSessionBtn) endSessionBtn.disabled = disabled;
  }

  function prepareForNewQuestion() {
    hasAnsweredCurrentQuestion = false;

    if (submitAnswerBtn) {
      submitAnswerBtn.disabled = false;
      submitAnswerBtn.style.display = "inline-flex";
    }

    if (skipQuestionBtn) {
      skipQuestionBtn.disabled = false;
      skipQuestionBtn.style.display = "inline-flex";
    }

    if (nextQuestionBtn) {
      nextQuestionBtn.style.display = "none";
      nextQuestionBtn.disabled = true;
      nextQuestionBtn.textContent = "Next Question";
    }

    if (endSessionBtn) {
      endSessionBtn.disabled = false;
    }
  }

  function prepareAfterAnswer() {
    hasAnsweredCurrentQuestion = true;

    if (submitAnswerBtn) {
      submitAnswerBtn.disabled = true;
      submitAnswerBtn.style.display = "none";
    }

    if (skipQuestionBtn) {
      skipQuestionBtn.disabled = true;
      skipQuestionBtn.style.display = "none";
    }

    if (nextQuestionBtn) {
      nextQuestionBtn.style.display = "inline-flex";
      nextQuestionBtn.disabled = false;
      nextQuestionBtn.textContent = "Next Question";
    }

    if (endSessionBtn) {
      endSessionBtn.disabled = false;
    }

    document.querySelectorAll(".option-item").forEach((card) => {
      card.classList.add("locked");
    });
  }

  function getDifficultyLabel(level) {
    if (level === 1) return "Easy";
    if (level === 2) return "Medium";
    if (level === 3) return "Hard";
    return "Unknown";
  }

  function updateTopInfo() {
    if (courseNameEl) {
      courseNameEl.textContent = selectedCourseName || "Course Name";
    }

    if (chapterNameEl) {
      chapterNameEl.textContent = selectedMaterialName;
    }

    if (currentQuestionEl) {
      currentQuestionEl.textContent = `Q${displayQuestionNumber}`;
    }

    if (difficultyBadge && currentQuestion) {
      difficultyBadge.textContent = getDifficultyLabel(currentQuestion.difficulty_level);
    }

    if (difficultyMini && currentQuestion) {
      difficultyMini.textContent = getDifficultyLabel(currentQuestion.difficulty_level);
    }

    if (scoreEl) {
      scoreEl.textContent = score;
    }
  }

  function animateQuestionSwap() {
    if (!questionCard) return;
    questionCard.classList.remove("fade-swap");
    void questionCard.offsetWidth;
    questionCard.classList.add("fade-swap");
  }

  function renderQuestion(question) {
    if (!questionText || !optionsContainer) return;

    currentQuestion = question;
    selectedOptionId = null;

    localStorage.setItem("currentQuestion", JSON.stringify(question));

    questionText.textContent = question.question_text || "No question found.";
    optionsContainer.innerHTML = "";

    if (!Array.isArray(question.options) || question.options.length === 0) {
      optionsContainer.innerHTML = "<p>No options available.</p>";
      updateTopInfo();
      animateQuestionSwap();
      prepareForNewQuestion();
      return;
    }

    const prefixes = ["A", "B", "C", "D", "E", "F"];

    question.options.forEach((option, index) => {
      const optionCard = document.createElement("div");
      optionCard.className = "option-item";
      optionCard.dataset.optionId = option.id;

      optionCard.innerHTML = `
        <span class="option-prefix">${prefixes[index] || index + 1}</span>
        <span>${option.option_text}</span>
      `;

      optionCard.addEventListener("click", () => {
        if (hasAnsweredCurrentQuestion) return;

        document.querySelectorAll(".option-item").forEach((card) => {
          card.classList.remove("selected");
        });

        optionCard.classList.add("selected");
        selectedOptionId = Number(option.id);
      });

      optionsContainer.appendChild(optionCard);
    });

    updateTopInfo();
    animateQuestionSwap();
    prepareForNewQuestion();
  }

  function highlightAnswer(selectedId, correctId, isSkipped) {
    document.querySelectorAll(".option-item").forEach((card) => {
      const optionId = Number(card.dataset.optionId);

      card.classList.remove("selected");

      if (optionId === correctId) {
        card.classList.add("correct-answer");
      }

      if (!isSkipped && optionId === selectedId && selectedId !== correctId) {
        card.classList.add("wrong-answer");
      }
    });
  }

  async function fetchNextQuestion() {
    try {
      const response = await fetch(`${API_BASE_URL}/questions/next/${quizId}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showMessage(data.detail || data.message || "Failed to load the next question.");
        return null;
      }

      if (data.message === "Quiz completed") {
        showMessage(
          "You’ve reached the end of the current question bank. End the session to view your report.",
          "success"
        );

        if (submitAnswerBtn) submitAnswerBtn.disabled = true;
        if (skipQuestionBtn) skipQuestionBtn.disabled = true;
        if (nextQuestionBtn) {
          nextQuestionBtn.style.display = "none";
          nextQuestionBtn.disabled = true;
        }
        if (endSessionBtn) endSessionBtn.disabled = false;

        return null;
      }

      return data;
    } catch (error) {
      console.error("Fetch next question error:", error);
      showMessage("Could not connect to the server.");
      return null;
    }
  }

  async function submitAnswer(isSkipped = false) {
    clearMessage();

    if (!quizId || !currentQuestion) {
      showMessage("Quiz data is missing.");
      return;
    }

    if (hasAnsweredCurrentQuestion) {
      showMessage("You already answered this question. Click Next Question to continue.");
      return;
    }

    if (!isSkipped && !selectedOptionId) {
      showMessage("Please select an answer or skip the question.");
      return;
    }

    setButtonsDisabled(true);

    try {
      const response = await fetch(`${API_BASE_URL}/questions/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question_id: Number(currentQuestion.question_id),
          selected_option_id: isSkipped ? null : Number(selectedOptionId),
          is_skipped: isSkipped
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setButtonsDisabled(false);
        showMessage(data.detail || data.message || "Failed to submit answer.");
        return;
      }

      answeredCount += 1;
      localStorage.setItem("answeredCount", String(answeredCount));
      localStorage.setItem("lastAnswerResult", JSON.stringify(data));

      if (data.is_correct === true) {
        score += 1;
        localStorage.setItem("score", String(score));
      }

      const correctOptionId = Number(data.correct_option_id);

      highlightAnswer(
        isSkipped ? null : Number(selectedOptionId),
        correctOptionId,
        isSkipped
      );

      if (isSkipped) {
        showMessage("Question skipped.", "neutral");
      } else if (data.is_correct === true) {
        showMessage("Correct!", "success");
      } else {
        showMessage("Incorrect.", "error");
      }

      updateTopInfo();
      prepareAfterAnswer();

    } catch (error) {
      console.error("Submit answer error:", error);
      setButtonsDisabled(false);
      showMessage("Could not connect to the server.");
    }
  }

  async function goToNextQuestion() {
    clearMessage();

    if (!hasAnsweredCurrentQuestion) {
      showMessage("Please answer or skip this question first.");
      return;
    }

    if (nextQuestionBtn) {
      nextQuestionBtn.disabled = true;
      nextQuestionBtn.textContent = "Generating...";
    }

    if (endSessionBtn) {
      endSessionBtn.disabled = true;
    }

    pauseTimer();
    showMessage("Generating the next question. Please wait...", "neutral");

    const nextQuestion = await fetchNextQuestion();

    if (nextQuestion) {
      displayQuestionNumber += 1;
      localStorage.setItem("displayQuestionNumber", String(displayQuestionNumber));
      renderQuestion(nextQuestion);
    } else {
      if (nextQuestionBtn) {
        nextQuestionBtn.disabled = false;
        nextQuestionBtn.textContent = "Next Question";
      }

      if (endSessionBtn) {
        endSessionBtn.disabled = false;
      }
    }

    resumeTimer();
  }

  async function endSession() {
    clearMessage();

    if (!quizId) {
      showMessage("Quiz ID is missing.");
      return;
    }

    setButtonsDisabled(true);

    try {
      const response = await fetch(`${API_BASE_URL}/session/quiz/${quizId}/end`, {
        method: "POST"
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setButtonsDisabled(false);
        showMessage(data.detail || data.message || "Failed to end session.");
        return;
      }

      localStorage.setItem("reportId", String(data.report_id));
      localStorage.setItem("reportData", JSON.stringify(data));

      stopTimer();
      localStorage.removeItem("sessionStartTime");
      localStorage.removeItem("pausedDuration");

      window.location.href = "report.html";

    } catch (error) {
      console.error("End session error:", error);
      setButtonsDisabled(false);
      showMessage("Could not connect to the server.");
    }
  }

  async function initializeSession() {
    startTimer();

    if (!quizId) {
      showMessage("No active session found. Please start from materials page.");
      setButtonsDisabled(true);
      return;
    }

    updateTopInfo();

    const savedQuestionRaw = localStorage.getItem("currentQuestion");

    if (savedQuestionRaw) {
      try {
        const savedQuestion = JSON.parse(savedQuestionRaw);
        renderQuestion(savedQuestion);
        return;
      } catch (error) {
        console.error("Invalid saved question:", error);
        localStorage.removeItem("currentQuestion");
      }
    }

    pauseTimer();
    showMessage("Loading question. Please wait...", "neutral");

    const firstQuestion = await fetchNextQuestion();

    if (firstQuestion) {
      clearMessage();
      renderQuestion(firstQuestion);
    }

    resumeTimer();
  }

  if (submitAnswerBtn) {
    submitAnswerBtn.addEventListener("click", () => submitAnswer(false));
  }

  if (skipQuestionBtn) {
    skipQuestionBtn.addEventListener("click", () => submitAnswer(true));
  }

  if (nextQuestionBtn) {
    nextQuestionBtn.addEventListener("click", goToNextQuestion);
  }

  if (endSessionBtn) {
    endSessionBtn.addEventListener("click", endSession);
  }

  initializeSession();
});