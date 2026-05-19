const API_BASE_URL = "http://https://adaptive-aid-production.up.railway.app";
const MATERIALS_ENDPOINT = `${API_BASE_URL}/materials/course`;
const UPLOAD_ENDPOINT = `${API_BASE_URL}/materials/upload`;
const START_QUIZ_ENDPOINT = `${API_BASE_URL}/questions/generate-from-material`;
const DELETE_MATERIAL_ENDPOINT = `${API_BASE_URL}/materials`;

document.addEventListener("DOMContentLoaded", () => {
  const filesGrid = document.getElementById("filesGrid");
  const startSessionBtn = document.getElementById("startSessionBtn");
  const uploadMaterialBtn = document.getElementById("uploadMaterialBtn");
  const backToCoursesBtn = document.getElementById("backToCoursesBtn");
  const aiGenerating = document.getElementById("aiGenerating");
  const materialsMessage = document.getElementById("materialsMessage");
  const courseTitle = document.getElementById("courseTitle");
  const fileInput = document.getElementById("fileInput");
  const materialsSectionTitle = document.getElementById("materialsSectionTitle");

  const deleteModal = document.getElementById("deleteModal");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

  const courseId = localStorage.getItem("selectedCourseId");
  const courseName = localStorage.getItem("selectedCourseName");

  let materialToDelete = null;
  let studentId = localStorage.getItem("studentId");
  let selectedMaterialId = null;
  let selectedMaterialName = null;

  if (!studentId) {
    studentId = "1";
    localStorage.setItem("studentId", studentId);
  }

  function showMessage(text, type = "error") {
    if (!materialsMessage) return;
    materialsMessage.textContent = text;
    materialsMessage.className = `message ${type}`;
  }

  function clearMessage() {
    if (!materialsMessage) return;
    materialsMessage.textContent = "";
    materialsMessage.className = "message";
  }

  function getMaterialIcon(filename = "") {
    const lower = filename.toLowerCase();

    if (lower.endsWith(".pdf")) return "fa-file-pdf";
    if (lower.endsWith(".docx")) return "fa-file-word";
    if (lower.endsWith(".pptx")) return "fa-file-powerpoint";
    return "fa-file";
  }

  function openDeleteModal(materialId) {
    materialToDelete = materialId;

    if (deleteModal) {
      deleteModal.classList.remove("hidden");
    }
  }

  function closeDeleteModal() {
    materialToDelete = null;

    if (deleteModal) {
      deleteModal.classList.add("hidden");
    }
  }

  async function confirmDeleteMaterial() {
    if (!materialToDelete) {
      showMessage("No material selected for deletion.");
      closeDeleteModal();
      return;
    }

    if (confirmDeleteBtn) {
      confirmDeleteBtn.disabled = true;
      confirmDeleteBtn.textContent = "Deleting...";
    }

    try {
      const response = await fetch(`${DELETE_MATERIAL_ENDPOINT}/${materialToDelete}`, {
        method: "DELETE"
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showMessage(data.detail || data.message || "Failed to delete material.");
        return;
      }

      closeDeleteModal();
      showMessage("Material deleted successfully.", "success");
      await loadMaterials();

    } catch (error) {
      console.error("Delete material error:", error);
      showMessage("Could not delete material.");
    } finally {
      if (confirmDeleteBtn) {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = "Delete";
      }
    }
  }

  function renderMaterials(materials) {
  if (!filesGrid) return;

  filesGrid.innerHTML = "";
  selectedMaterialId = null;
  selectedMaterialName = null;

  if (startSessionBtn) {
    startSessionBtn.disabled = true;
  }

  if (!Array.isArray(materials) || materials.length === 0) {
    if (materialsSectionTitle) {
      materialsSectionTitle.textContent = "No Materials Uploaded";
    }

    filesGrid.innerHTML = `
      <div class="file-card empty-card">
        <div class="file-icon"><i class="fas fa-circle-info"></i></div>
        <div class="file-info">
          <h4>No materials found</h4>
          <p>Upload a PDF, DOCX, or PPTX file to start a quiz.</p>
        </div>
      </div>
    `;
    return;
  }

  if (materialsSectionTitle) {
    materialsSectionTitle.textContent = "Select Material for Quiz";
  }

  materials.forEach((material) => {
    const card = document.createElement("div");
    card.className = "file-card";

    const materialId = material.id;
    const materialName = material.filename || `Material ${materialId}`;
    const details = "Uploaded material";

    card.dataset.materialId = String(materialId);
    card.dataset.materialName = materialName;

    card.innerHTML = `
      <div class="file-icon">
        <i class="fas ${getMaterialIcon(materialName)}"></i>
      </div>

      <div class="file-info">
        <h4 class="file-name">${materialName}</h4>
        <p>${details}</p>
      </div>

      <button class="rename-course-btn rename-material-btn" type="button" title="Rename material">
        Rename
      </button>

      <button class="delete-material-btn" type="button" title="Delete material">
        <i class="fas fa-trash"></i>
      </button>
    `;

    card.addEventListener("click", () => {
      document.querySelectorAll(".file-card").forEach((c) => {
        c.classList.remove("selected");
      });

      card.classList.add("selected");
      selectedMaterialId = materialId;
      selectedMaterialName = card.dataset.materialName;

      if (startSessionBtn) {
        startSessionBtn.disabled = false;
      }

      clearMessage();
    });

    const renameMaterialBtn = card.querySelector(".rename-material-btn");
    const deleteMaterialBtn = card.querySelector(".delete-material-btn");
    const materialNameEl = card.querySelector(".file-name");

    renameMaterialBtn.addEventListener("click", (event) => {
      event.stopPropagation();

      const input = document.createElement("input");
      input.value = card.dataset.materialName;
      input.className = "rename-input";

      materialNameEl.replaceWith(input);
      input.focus();

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          input.blur();
        }

        if (e.key === "Escape") {
          input.replaceWith(materialNameEl);
        }
      });

      input.addEventListener("blur", async () => {
        const newName = input.value.trim();

        if (!newName || newName === card.dataset.materialName) {
          input.replaceWith(materialNameEl);
          return;
        }

        try {
          const response = await fetch(`${API_BASE_URL}/materials/rename`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              material_id: materialId,
              new_name: newName
            })
          });

          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            showMessage(data.detail || data.message || "Failed to rename material.");
            input.replaceWith(materialNameEl);
            return;
          }

          material.filename = newName;
          card.dataset.materialName = newName;

          if (selectedMaterialId === materialId) {
            selectedMaterialName = newName;
          }

          const newNameEl = document.createElement("h4");
          newNameEl.className = "file-name";
          newNameEl.textContent = newName;

          input.replaceWith(newNameEl);

        } catch (error) {
          console.error("Rename material error:", error);
          showMessage("Could not rename material.");
          input.replaceWith(materialNameEl);
        }
      });
    });

    deleteMaterialBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      openDeleteModal(materialId);
    });

    filesGrid.appendChild(card);
  });
}

  async function loadMaterials() {
    clearMessage();

    if (startSessionBtn) {
      startSessionBtn.disabled = true;
    }

    if (!courseId) {
      showMessage("No course selected. Please go back and choose a course.");
      return;
    }

    if (courseTitle) {
      courseTitle.textContent = courseName
        ? `${courseName} Materials`
        : "Course Materials";
    }

    if (filesGrid) {
      filesGrid.innerHTML = `
        <div class="file-card empty-card">
          <div class="file-icon"><i class="fas fa-spinner fa-spin"></i></div>
          <div class="file-info">
            <h4>Loading materials...</h4>
            <p>Please wait.</p>
          </div>
        </div>
      `;
    }

    try {
      const response = await fetch(`${MATERIALS_ENDPOINT}/${courseId}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showMessage(data.detail || data.message || "Failed to load materials.");
        if (filesGrid) filesGrid.innerHTML = "";
        return;
      }

      renderMaterials(data.materials || []);
    } catch (error) {
      console.error("Load materials error:", error);
      showMessage("Could not connect to the server.");
      if (filesGrid) filesGrid.innerHTML = "";
    }
  }

  async function uploadMaterial(file) {
    clearMessage();

    if (!courseId) {
      showMessage("No course selected.");
      return;
    }

    if (!file) {
      showMessage("Please choose a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("course_id", courseId);
    formData.append("file", file);

    if (uploadMaterialBtn) uploadMaterialBtn.disabled = true;
    showMessage("Uploading material...", "success");

    try {
      const response = await fetch(UPLOAD_ENDPOINT, {
        method: "POST",
        body: formData
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showMessage(data.detail || data.message || "Upload failed.");
        return;
      }

      showMessage("Material uploaded successfully.", "success");
      await loadMaterials();
    } catch (error) {
      console.error("Upload material error:", error);
      showMessage("Could not upload material.");
    } finally {
      if (uploadMaterialBtn) uploadMaterialBtn.disabled = false;
    }
  }

 async function startQuiz() {
  clearMessage();

  if (!selectedMaterialId) {
    showMessage("Please select a material first.");
    return;
  }

  if (!studentId || !courseId) {
    showMessage("Missing student or course information.");
    return;
  }

  // Freeze the selected material for this session
  const materialIdForSession = selectedMaterialId;
  const materialNameForSession = selectedMaterialName || "";

  // Lock material cards while preparing
  document.querySelectorAll(".file-card").forEach((card) => {
    card.style.pointerEvents = "none";
    card.style.opacity = "0.6";
  });

  if (aiGenerating) {
    aiGenerating.style.display = "flex";
  }

  if (startSessionBtn) {
    startSessionBtn.disabled = true;
    startSessionBtn.textContent = "Preparing session...";
  }

  try {
    const response = await fetch(
      `${START_QUIZ_ENDPOINT}?student_id=${studentId}&course_id=${courseId}&course_material_id=${materialIdForSession}`,
      {
        method: "POST"
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      showMessage(data.detail || data.message || "Failed to generate quiz.");
      return;
    }

    localStorage.removeItem("quizId");
    localStorage.removeItem("currentQuestion");
    localStorage.removeItem("answeredCount");
    localStorage.removeItem("score");
    localStorage.removeItem("lastAnswerResult");
    localStorage.removeItem("reportId");
    localStorage.removeItem("reportData");
    localStorage.removeItem("displayQuestionNumber");
    localStorage.removeItem("sessionStartTime");
    localStorage.removeItem("pausedDuration");
    
    localStorage.setItem("selectedMaterialId", String(materialIdForSession));
    localStorage.setItem("selectedMaterialName", materialNameForSession);
    localStorage.setItem("quizId", String(data.quiz_id));
    localStorage.setItem("selectedCourseName", courseName || "");
    localStorage.setItem("displayQuestionNumber", "1");
    localStorage.setItem("sessionStartTime", Date.now().toString());

    window.location.href = "session.html";

  } catch (error) {
    console.error("Start quiz error:", error);
    showMessage("Could not start the quiz.");
  } finally {
    if (aiGenerating) {
      aiGenerating.style.display = "none";
    }

    if (startSessionBtn) {
      startSessionBtn.disabled = false;
      startSessionBtn.textContent = "Start Session";
    }

    document.querySelectorAll(".file-card").forEach((card) => {
      card.style.pointerEvents = "auto";
      card.style.opacity = "1";
    });
  }
}

  if (backToCoursesBtn) {
    backToCoursesBtn.addEventListener("click", () => {
      window.location.href = "courses.html";
    });
  }

  if (uploadMaterialBtn) {
    uploadMaterialBtn.addEventListener("click", () => {
      if (!fileInput) {
        showMessage("File input element not found in HTML.");
        return;
      }
      fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];

      if (file) {
        uploadMaterial(file);
        fileInput.value = "";
      }
    });
  }

  if (startSessionBtn) {
    startSessionBtn.addEventListener("click", startQuiz);
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", confirmDeleteMaterial);
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", closeDeleteModal);
  }

  if (deleteModal) {
    deleteModal.addEventListener("click", (event) => {
      if (event.target === deleteModal) {
        closeDeleteModal();
      }
    });
  }

  loadMaterials();
});