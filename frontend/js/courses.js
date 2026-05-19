const API_BASE_URL = "https://adaptive-aid-production.up.railway.app";
const COURSES_ENDPOINT = `${API_BASE_URL}/courses`;
const ANALYTICS_ENDPOINT = `${API_BASE_URL}/analytics/student`;

document.addEventListener("DOMContentLoaded", () => {
  const coursesGrid = document.getElementById("coursesGrid");
  const coursesMessage = document.getElementById("coursesMessage");
  const logoutBtn = document.getElementById("logoutBtn");
  const addCourseForm = document.getElementById("addCourseForm");
  const courseNameInput = document.getElementById("courseName");

  const deleteCourseModal = document.getElementById("deleteCourseModal");
  const confirmDeleteCourseBtn = document.getElementById("confirmDeleteCourseBtn");
  const cancelDeleteCourseBtn = document.getElementById("cancelDeleteCourseBtn");

  const studentId = localStorage.getItem("studentId");
  let courseToDelete = null;

  function formatDate(dateString) {
    if (!dateString) return "No sessions yet";

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "No sessions yet";
    }

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function showMessage(text, type = "error") {
    if (!coursesMessage) return;
    coursesMessage.textContent = text;
    coursesMessage.className = `message ${type}`;
  }

  function clearMessage() {
    if (!coursesMessage) return;
    coursesMessage.textContent = "";
    coursesMessage.className = "message";
  }

  function openDeleteCourseModal(courseId) {
    courseToDelete = courseId;

    if (deleteCourseModal) {
      deleteCourseModal.classList.remove("hidden");
    }
  }

  function closeDeleteCourseModal() {
    courseToDelete = null;

    if (deleteCourseModal) {
      deleteCourseModal.classList.add("hidden");
    }
  }

  async function renameCourse(courseId, newName) {
  clearMessage();

  if (!newName || !newName.trim()) {
    showMessage("Course name cannot be empty.");
    return false;
  }

  try {
    const response = await fetch(`${COURSES_ENDPOINT}/${courseId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        course_name: newName.trim()
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      showMessage(data.detail || data.message || "Failed to rename course.");
      return false;
    }

    showMessage("Course renamed successfully.", "success");
    await loadCourses();
    return true;

  } catch (error) {
    console.error("Rename course error:", error);
    showMessage("Could not rename course.");
    return false;
  }
}

  async function confirmDeleteCourse() {
    if (!courseToDelete) {
      showMessage("No course selected for deletion.");
      closeDeleteCourseModal();
      return;
    }

    if (confirmDeleteCourseBtn) {
      confirmDeleteCourseBtn.disabled = true;
      confirmDeleteCourseBtn.textContent = "Deleting...";
    }

    try {
      const response = await fetch(`${COURSES_ENDPOINT}/${courseToDelete}`, {
        method: "DELETE"
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showMessage(data.detail || data.message || "Failed to delete course.");
        return;
      }

      closeDeleteCourseModal();
      showMessage("Course deleted successfully.", "success");

      localStorage.removeItem("selectedCourseId");
      localStorage.removeItem("selectedCourseName");

      await loadCourses();

    } catch (error) {
      console.error("Delete course error:", error);
      showMessage("Could not delete course.");
    } finally {
      if (confirmDeleteCourseBtn) {
        confirmDeleteCourseBtn.disabled = false;
        confirmDeleteCourseBtn.textContent = "Delete";
      }
    }
  }

  function renderCourses(courses) {
  coursesGrid.innerHTML = "";

  if (!Array.isArray(courses) || courses.length === 0) {
    coursesGrid.innerHTML = `
      <div class="course-card">
        <div class="course-icon"><i class="fas fa-circle-info"></i></div>
        <h3>No courses found</h3>
        <p class="course-hint">Add your first course above.</p>
      </div>
    `;
    return;
  }

  courses.forEach((course) => {
    const card = document.createElement("div");
    card.className = "course-card";

    const courseId = course.course_id ?? course.id ?? "";
    const courseName = course.course_name ?? course.name ?? "Untitled Course";

    const averageScore = Number(course.average_score || 0).toFixed(1);
    const highestScore = Number(course.highest_score || 0).toFixed(1);
    const sessionsCompleted = course.sessions_completed || 0;

    const lastSessionDate = sessionsCompleted > 0
      ? formatDate(course.last_session_date)
      : "No sessions yet";

    card.innerHTML = `
      <div class="course-card-header">
        <div class="course-icon">
          <i class="fas fa-book"></i>
        </div>

        <h3 class="course-name">${courseName}</h3>

        <div class="course-header-actions">
          <button class="rename-course-btn" type="button" title="Rename course">
            Rename
          </button>

          <button class="delete-course-btn" type="button" title="Delete course">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>

      <div class="course-details">
        <div class="course-stats">
          <div class="stat-row">
            <span>Average Score</span>
            <strong>${averageScore}%</strong>
          </div>
          <div class="stat-row">
            <span>Highest Score</span>
            <strong>${highestScore}%</strong>
          </div>
          <div class="stat-row">
            <span>Sessions Completed</span>
            <strong>${sessionsCompleted}</strong>
          </div>
          <div class="stat-row">
            <span>Last Session</span>
            <strong>${lastSessionDate}</strong>
          </div>
        </div>

        <div class="course-actions">
          <button class="setup-session-btn" type="button">
            <i class="fas fa-play"></i> Set Up New Session
          </button>

          <button class="history-btn" type="button">
            <i class="fas fa-chart-line"></i> View Report History
          </button>
        </div>
      </div>
    `;

    card.addEventListener("click", () => {
      document.querySelectorAll(".course-card").forEach((c) => {
        if (c !== card) c.classList.remove("selected");
      });

      card.classList.toggle("selected");
    });

    const setupSessionBtn = card.querySelector(".setup-session-btn");
    const historyBtn = card.querySelector(".history-btn");
    const deleteCourseBtn = card.querySelector(".delete-course-btn");
    const renameCourseBtn = card.querySelector(".rename-course-btn");
    const courseNameEl = card.querySelector(".course-name");

    setupSessionBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      localStorage.setItem("selectedCourseId", String(courseId));
      localStorage.setItem("selectedCourseName", courseName);
      window.location.href = "materials.html";
    });

    historyBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      localStorage.setItem("selectedCourseId", String(courseId));
      localStorage.setItem("selectedCourseName", courseName);
      window.location.href = "report_history.html";
    });

    renameCourseBtn.addEventListener("click", (event) => {
  event.stopPropagation();

  const input = document.createElement("input");
  input.value = courseName;
  input.className = "rename-input";

  courseNameEl.replaceWith(input);
  input.focus();

  // save when clicking away
  input.addEventListener("blur", async () => {
    const newName = input.value.trim();

    if (!newName || newName === courseName) {
      input.replaceWith(courseNameEl);
      return;
    }

    await renameCourse(courseId, newName);
  });

  // save when pressing Enter
  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const newName = input.value.trim();

      if (!newName || newName === courseName) {
        input.replaceWith(courseNameEl);
        return;
      }

      await renameCourse(courseId, newName);
    }

    // cancel on Escape
    if (e.key === "Escape") {
      input.replaceWith(courseNameEl);
    }
  });
});

    deleteCourseBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      openDeleteCourseModal(courseId);
    });

    coursesGrid.appendChild(card);
  });
}

  async function loadCourses() {
    clearMessage();

    if (!studentId) {
      showMessage("No student is logged in.");
      return;
    }

    coursesGrid.innerHTML = `
      <div class="course-card selected">
        <div class="course-icon"><i class="fas fa-spinner fa-spin"></i></div>
        <h3>Loading courses...</h3>
      </div>
    `;

    try {
      const analyticsResponse = await fetch(`${ANALYTICS_ENDPOINT}/${studentId}/courses`);
      const analyticsData = await analyticsResponse.json().catch(() => ({}));

      if (analyticsResponse.ok && Array.isArray(analyticsData.courses)) {
        renderCourses(analyticsData.courses);
        return;
      }

      const response = await fetch(`${COURSES_ENDPOINT}/${studentId}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showMessage(data.detail || data.message || "Failed to load courses.");
        coursesGrid.innerHTML = "";
        return;
      }

      const courses = Array.isArray(data) ? data : (data.courses || []);
      renderCourses(courses);

    } catch (error) {
      console.error("Load courses error:", error);
      showMessage("Could not connect to the server.");
      coursesGrid.innerHTML = "";
    }
  }

  async function addCourse(courseName) {
    clearMessage();

    if (!studentId) {
      showMessage("No student is logged in.");
      return;
    }

    try {
      const response = await fetch(`${COURSES_ENDPOINT}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          course_name: courseName,
          student_id: Number(studentId)
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showMessage(data.detail || data.message || "Failed to create course.");
        return;
      }

      showMessage("Course added successfully.", "success");
      courseNameInput.value = "";
      await loadCourses();

    } catch (error) {
      console.error("Add course error:", error);
      showMessage("Could not connect to the server.");
    }
  }

  if (addCourseForm) {
    addCourseForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const courseName = courseNameInput.value.trim();

      if (!courseName) {
        showMessage("Please enter a course name.");
        return;
      }

      await addCourse(courseName);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.clear();
      window.location.href = "login.html";
    });
  }

  if (confirmDeleteCourseBtn) {
    confirmDeleteCourseBtn.addEventListener("click", confirmDeleteCourse);
  }

  if (cancelDeleteCourseBtn) {
    cancelDeleteCourseBtn.addEventListener("click", closeDeleteCourseModal);
  }

  if (deleteCourseModal) {
    deleteCourseModal.addEventListener("click", (event) => {
      if (event.target === deleteCourseModal) {
        closeDeleteCourseModal();
      }
    });
  }

  loadCourses();
});