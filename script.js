(() => {
  "use strict";

  const STORAGE_KEY = "hslu-wi-notenrechner-v1";
  const SCHEMA_VERSION = 2;
  const DEFAULT_TARGET = 5.0;
  // Fester Modulkatalog aus modules.js, alphabetisch sortiert.
  const library = (Array.isArray(window.HSLU_MODULE_LIBRARY) ? [...window.HSLU_MODULE_LIBRARY] : [])
    .sort((a, b) => a.name.localeCompare(b.name, "de-CH") || a.code.localeCompare(b.code));

  // Inline-SVG-Icons (rein dekorativ, Beschriftungen bleiben unverändert).
  const svg = (body, extra = "") => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${extra}>${body}</svg>`;
  const ICON = {
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    chevron: svg('<path d="m6 9 6 6 6-6"/>'),
    trash: svg('<path d="M4 7h16M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.5 7l.8 12a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8l.8-12M10 11v6M14 11v6"/>', ' stroke-width="1.8"'),
    grip: '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
    layers: svg('<path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8 12 3.5Z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5"/>', ' stroke-width="1.6"')
  };

  const els = {
    studyTarget: document.getElementById("studyTarget"),
    studyAverage: document.getElementById("studyAverage"),
    studyStats: document.getElementById("studyStats"),
    addSemesterBtn: document.getElementById("addSemesterBtn"),
    emptyAddSemesterBtn: document.getElementById("emptyAddSemesterBtn"),
    semesterContainer: document.getElementById("semesterContainer"),
    emptyState: document.getElementById("emptyState"),
    semesterDialog: document.getElementById("semesterDialog"),
    semesterForm: document.getElementById("semesterForm"),
    semesterName: document.getElementById("semesterName"),
    semesterTarget: document.getElementById("semesterTarget"),
    moduleDialog: document.getElementById("moduleDialog"),
    moduleDialogTitle: document.getElementById("moduleDialogTitle"),
    moduleSearch: document.getElementById("moduleSearch"),
    catalogList: document.getElementById("catalogList"),
    customTab: document.getElementById("customTab"),
    customName: document.getElementById("customName"),
    customCode: document.getElementById("customCode"),
    customEcts: document.getElementById("customEcts"),
    customTarget: document.getElementById("customTarget"),
    confirmDialog: document.getElementById("confirmDialog"),
    confirmTitle: document.getElementById("confirmTitle"),
    confirmText: document.getElementById("confirmText"),
    confirmCancel: document.getElementById("confirmCancel"),
    confirmOk: document.getElementById("confirmOk"),
    toast: document.getElementById("toast")
  };

  let state = loadState();
  let activeSemesterId = null;
  let pendingConfirmAction = null;
  let toastTimer = null;

  let cloud;
  init();
  cloud = window.connectGradebook({ readGuest: loadState, getBook: () => state, setBook(book) {
    state = { ...defaultState(), ...book };
    populateTargetSelects();
    render();
  } });

  function init() {
    populateTargetSelects();
    bindStaticEvents();
    render();
  }

  function defaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      studyTarget: DEFAULT_TARGET,
      semesters: [],
      updatedAt: new Date().toISOString()
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return defaultState();

      if (Array.isArray(parsed.semesters)) {
        return {
          ...defaultState(),
          ...parsed,
          schemaVersion: SCHEMA_VERSION,
          studyTarget: normaliseHalfGrade(parsed.studyTarget ?? DEFAULT_TARGET),
          semesters: parsed.semesters.map(normaliseSemesterObject)
        };
      }

      if (Array.isArray(parsed.modules)) {
        return migrateLegacyState(parsed);
      }

      return defaultState();
    } catch (error) {
      console.warn("Gespeicherte Daten konnten nicht geladen werden.", error);
      return defaultState();
    }
  }

  function migrateLegacyState(oldState) {
    const grouped = new Map();
    for (const legacyModule of oldState.modules || []) {
      const name = String(legacyModule.semester || "Ohne Bezeichnung").trim() || "Ohne Bezeichnung";
      if (!grouped.has(name)) {
        grouped.set(name, {
          id: uid(),
          name,
          target: normaliseHalfGrade(oldState.semesterTargets?.[name] ?? DEFAULT_TARGET),
          collapsed: false,
          modules: []
        });
      }
      grouped.get(name).modules.push(normaliseModule(legacyModule));
    }

    const migrated = {
      schemaVersion: SCHEMA_VERSION,
      studyTarget: normaliseHalfGrade(oldState.studyTarget ?? DEFAULT_TARGET),
      semesters: Array.from(grouped.values()),
      updatedAt: new Date().toISOString()
    };

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch (_) {}
    return migrated;
  }

  function normaliseSemesterObject(semester) {
    return {
      id: semester.id || uid(),
      name: String(semester.name || "Unbenanntes Semester").trim() || "Unbenanntes Semester",
      target: normaliseHalfGrade(semester.target ?? DEFAULT_TARGET),
      collapsed: Boolean(semester.collapsed),
      modules: Array.isArray(semester.modules) ? semester.modules.map(normaliseModule) : []
    };
  }

  function normaliseModule(module) {
    return {
      id: module.id || uid(),
      code: String(module.code || ""),
      name: String(module.name || "Unbenanntes Modul").trim() || "Unbenanntes Modul",
      ects: clampNumber(module.ects, 0, 60, 3),
      target: normaliseHalfGrade(module.target ?? DEFAULT_TARGET),
      source: module.source || "custom",
      expanded: Boolean(module.expanded),
      assessments: Array.isArray(module.assessments)
        ? module.assessments.map(a => ({
            id: a.id || uid(),
            name: String(a.name || "Leistungsnachweis").trim() || "Leistungsnachweis",
            weight: clampNumber(a.weight, 0, 1000, 0),
            grade: validGradeOrNull(a.grade)
          }))
        : []
    };
  }

  function bindStaticEvents() {
    els.studyTarget.addEventListener("change", () => {
      state.studyTarget = parseFloat(els.studyTarget.value);
      saveState();
      renderStudyAverage();
    });

    els.addSemesterBtn.addEventListener("click", openSemesterDialog);
    els.emptyAddSemesterBtn.addEventListener("click", openSemesterDialog);

    els.semesterForm.addEventListener("submit", event => {
      event.preventDefault();
      const name = els.semesterName.value.trim();
      if (!name) return;

      state.semesters.push({
        id: uid(),
        name,
        target: parseFloat(els.semesterTarget.value),
        collapsed: false,
        modules: []
      });
      saveState();
      els.semesterForm.reset();
      els.semesterTarget.value = String(DEFAULT_TARGET);
      els.semesterDialog.close();
      render();
      showToast("Semester erstellt.");
    });

    document.querySelectorAll("[data-close-dialog]").forEach(button => {
      button.addEventListener("click", () => document.getElementById(button.dataset.closeDialog)?.close());
    });

    document.querySelectorAll(".tab-btn").forEach(button => {
      button.addEventListener("click", () => switchTab(button.dataset.tab));
    });

    els.moduleSearch.addEventListener("input", renderCatalog);

    els.customTab.addEventListener("submit", event => {
      event.preventDefault();
      const semester = findSemester(activeSemesterId);
      if (!semester) return;
      const name = els.customName.value.trim();
      if (!name) return;

      semester.modules.push(normaliseModule({
        id: uid(),
        code: els.customCode.value.trim(),
        name,
        ects: parseNumber(els.customEcts.value) || 3,
        target: parseFloat(els.customTarget.value),
        source: "custom",
        assessments: [{ id: uid(), name: "Leistungsnachweis", weight: 100, grade: null }]
      }));

      saveState();
      resetCustomModuleForm();
      els.moduleDialog.close();
      render();
      showToast("Modul hinzugefügt.");
    });

    els.confirmCancel.addEventListener("click", () => {
      pendingConfirmAction = null;
      els.confirmDialog.close();
    });

    els.confirmOk.addEventListener("click", () => {
      const action = pendingConfirmAction;
      pendingConfirmAction = null;
      els.confirmDialog.close();
      if (action) action();
    });

    [els.semesterDialog, els.moduleDialog, els.confirmDialog].forEach(dialog => {
      dialog.addEventListener("click", event => {
        if (event.target === dialog) {
          if (dialog === els.confirmDialog) pendingConfirmAction = null;
          dialog.close();
        }
      });
    });
  }

  function populateTargetSelects() {
    els.studyTarget.innerHTML = targetOptionsHtml(state.studyTarget);
    els.semesterTarget.innerHTML = targetOptionsHtml(DEFAULT_TARGET);
    els.customTarget.innerHTML = targetOptionsHtml(DEFAULT_TARGET);
    els.studyTarget.value = String(state.studyTarget);
    els.semesterTarget.value = String(DEFAULT_TARGET);
    els.customTarget.value = String(DEFAULT_TARGET);
  }

  function targetOptionsHtml(selected) {
    const values = [];
    for (let grade = 4; grade <= 6.001; grade += 0.5) values.push(Math.round(grade * 2) / 2);
    return values.map(v => `<option value="${v}" ${v === Number(selected) ? "selected" : ""}>${formatGrade(v)}</option>`).join("");
  }

  function openSemesterDialog() {
    els.semesterName.value = "";
    els.semesterTarget.value = String(DEFAULT_TARGET);
    els.semesterDialog.showModal();
    setTimeout(() => els.semesterName.focus(), 30);
  }

  function openModuleDialog(semesterId) {
    const semester = findSemester(semesterId);
    if (!semester) return;
    activeSemesterId = semesterId;
    els.moduleDialogTitle.textContent = `Modul zu «${semester.name}» hinzufügen`;
    els.moduleSearch.value = "";
    resetCustomModuleForm();
    switchTab("catalog");
    renderCatalog();
    els.moduleDialog.showModal();
    setTimeout(() => els.moduleSearch.focus(), 30);
  }

  function resetCustomModuleForm() {
    els.customTab.reset();
    els.customEcts.value = "3";
    els.customTarget.value = String(DEFAULT_TARGET);
  }

  function switchTab(tabName) {
    document.querySelectorAll(".tab-btn").forEach(button => button.classList.toggle("active", button.dataset.tab === tabName));
    document.getElementById("catalogTab").classList.toggle("active", tabName === "catalog");
    els.customTab.classList.toggle("active", tabName === "custom");
  }

  function render() {
    renderStudyAverage();
    els.emptyState.hidden = state.semesters.length > 0;
    els.semesterContainer.innerHTML = state.semesters.map(renderSemesterHtml).join("");
    bindDynamicEvents();
  }

  function renderStudyAverage() {
    const allModules = state.semesters.flatMap(semester => semester.modules);
    const avg = weightedAverage(allModules);

    const moduleTotal = state.semesters.reduce((sum, semester) => sum + semester.modules.length, 0);
    const ectsTotal = state.semesters.reduce((sum, semester) => sum + semester.modules.reduce((s, module) => s + module.ects, 0), 0);
    els.studyStats.innerHTML = [
      ["Semester", state.semesters.length],
      ["Module", moduleTotal],
      ["ECTS", formatNumber(ectsTotal)]
    ].map(([label, value]) => `<div class="hero-stat"><span>${label}</span><strong>${value}</strong></div>`).join("");

    if (avg == null) {
      els.studyAverage.innerHTML = `<span class="study-average-label">aktueller Schnitt</span><span class="study-average-empty">Noch keine abgeschlossenen Module</span>`;
      return;
    }

    const reached = avg >= rawThresholdForTarget(state.studyTarget);
    els.studyAverage.innerHTML = `<span class="study-average-label">aktueller Schnitt</span><strong class="study-average-value${reached ? " is-reached" : ""}">${formatUnroundedGrade(avg)}</strong>`;
  }

  function renderSemesterHtml(semester, index = 0) {
    // Der Semesterschnitt wird aus den gerundeten Modulnoten berechnet (ECTS-gewichtet).
    const semesterAvg = calculateSemesterAverage(semester);
    const semesterEcts = semester.modules.reduce((sum, module) => sum + module.ects, 0);

    return `
      <article class="semester-card panel ${semester.collapsed ? "semester-collapsed" : ""}" data-semester-card="${semester.id}">
        <div class="semester-header">
          <button class="semester-toggle" data-toggle-semester="${semester.id}" type="button" aria-expanded="${semester.collapsed ? "false" : "true"}" aria-label="Semester ${semester.collapsed ? "aufklappen" : "einklappen"}">
            <span class="semester-toggle-icon">${ICON.chevron}</span>
          </button>
          <div class="semester-name-wrap">
            <span class="semester-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
            <input class="semester-name-input" data-semester-name="${semester.id}" value="${escapeAttr(semester.name)}" aria-label="Semestername">
          </div>
          <label class="target-control semester-target-wrap">
            <span>Wunschnote</span>
            <select data-semester-target="${semester.id}">${targetOptionsHtml(semester.target)}</select>
          </label>
          <div class="semester-actions">
            <button class="btn btn-danger-ghost btn-small" data-delete-semester="${semester.id}" type="button">${ICON.trash}Semester löschen</button>
          </div>
        </div>

        <div class="semester-summary">
          <div class="summary-stat"><span class="summary-label">Wunschnote</span> <strong class="summary-value">${formatGrade(semester.target)}</strong></div>
          <div class="summary-stat is-key"><span class="summary-label">Semesterschnitt</span> <strong class="summary-value${semesterAvg == null ? " is-empty" : ""}">${semesterAvg == null ? "Noch offen" : formatUnroundedGrade(semesterAvg)}</strong></div>
          <div class="summary-stat"><span class="summary-label">Module</span> <strong class="summary-value">${semester.modules.length}</strong></div>
          <div class="summary-stat"><span class="summary-label">ECTS</span> <strong class="summary-value">${formatNumber(semesterEcts)}</strong></div>
        </div>

        <div class="semester-content" ${semester.collapsed ? "hidden" : ""}>
          <div class="semester-body">
            <div class="semester-toolbar">
              <span class="module-count">Module in diesem Semester</span>
              <button class="btn btn-primary btn-small" data-add-module="${semester.id}" type="button">${ICON.plus}Modul hinzufügen</button>
            </div>
            ${semester.modules.length
              ? `<div class="module-list" data-module-list="${semester.id}">${semester.modules.map(module => renderModuleHtml(semester, module)).join("")}</div>`
              : `<div class="empty-semester"><span class="empty-icon" aria-hidden="true">${ICON.layers}</span><p>Noch keine Module in diesem Semester.</p><button class="btn btn-primary btn-small" data-add-module="${semester.id}" type="button">${ICON.plus}Erstes Modul hinzufügen</button></div>`
            }
          </div>
        </div>
      </article>
    `;
  }

  function calculateSemesterAverage(semester) {
    return weightedAverage(semester.modules);
  }

  // Schnitt über abgeschlossene Module, gewichtet nach ECTS.
  // Jedes Modul fliesst mit seiner auf halbe Noten gerundeten Modulnote ein.
  // Noch offene Module und Module ohne ECTS zählen nicht.
  function weightedAverage(modules) {
    let ectsSum = 0;
    let gradeSum = 0;
    for (const module of modules) {
      const calc = calculateModule(module);
      if (!calc.complete || !(module.ects > 0)) continue;
      ectsSum += module.ects;
      gradeSum += calc.rounded * module.ects;
    }
    return ectsSum > 0 ? gradeSum / ectsSum : null;
  }

  function renderModuleHtml(semester, module) {
    const calc = calculateModule(module);
    // Beim einzelnen Modul wird nur die offizielle, auf halbe Noten
    // gerundete Modulnote angezeigt. Der Rohwert bleibt intern erhalten.
    const resultText = calc.complete && calc.rounded != null ? formatGrade(calc.rounded) : "Offen";
    const resultLabel = calc.complete ? "Modulnote" : "Noch nicht abgeschlossen";
    const status = !calc.complete ? "is-open" : calc.raw >= rawThresholdForTarget(module.target) ? "is-reached" : "is-missed";

    return `
      <details class="module-card ${status}" data-module-card="${module.id}" data-semester-id="${semester.id}" ${module.expanded ? "open" : ""}>
        <summary>
          <span class="module-drag-handle" draggable="true" data-module-drag="${module.id}" data-semester="${semester.id}" title="Modul verschieben" aria-label="Modul verschieben">${ICON.grip}</span>
          <div class="module-main">
            <div class="module-name">${escapeHtml(module.name)}</div>
            <div class="module-meta">${module.code ? `<span class="module-code">${escapeHtml(module.code)}</span>` : "Ohne Modulnummer"} · ${formatNumber(module.ects)} ECTS · Ziel ${formatGrade(module.target)}</div>
          </div>
          <div class="module-result">
            <strong>${resultText}</strong>
            <span>${resultLabel}</span>
          </div>
          <span class="module-chevron">${ICON.chevron}</span>
        </summary>

        <div class="module-body">
          <div class="module-settings">
            <label>
              <span>Modulname</span>
              <input data-module-name="${module.id}" data-semester="${semester.id}" value="${escapeAttr(module.name)}">
            </label>
            <label>
              <span>ECTS</span>
              <input data-module-ects="${module.id}" data-semester="${semester.id}" type="number" min="0" max="60" step="0.5" value="${formatNumber(module.ects)}">
            </label>
            <label>
              <span>Wunschmodulnote</span>
              <select data-module-target="${module.id}" data-semester="${semester.id}">${targetOptionsHtml(module.target)}</select>
            </label>
            <div class="delete-module-wrap">
              <button class="btn btn-danger-ghost btn-small" data-delete-module="${module.id}" data-semester="${semester.id}" type="button">${ICON.trash}Modul löschen</button>
            </div>
          </div>

          ${renderModuleGoalBox(module, calc)}

          <div class="assessment-heading">
            <h4>Leistungsnachweise</h4>
            <button class="btn btn-secondary btn-small" data-add-assessment="${module.id}" data-semester="${semester.id}" type="button">${ICON.plus}Prüfung hinzufügen</button>
          </div>

          <div class="assessment-list">
            ${module.assessments.length
              ? module.assessments.map(a => renderAssessmentHtml(semester, module, a)).join("")
              : `<div class="empty-semester"><p>Keine Leistungsnachweise vorhanden.</p></div>`
            }
          </div>
        </div>
      </details>
    `;
  }

  function renderModuleGoalBox(module, calc) {
    const threshold = rawThresholdForTarget(module.target);
    if (!module.assessments.length) {
      return `<div class="goal-box warning">Füge zuerst mindestens einen Leistungsnachweis hinzu</div>`;
    }

    if (calc.totalWeight <= 0) {
      return `<div class="goal-box warning">Bitte trage die Gewichtungen der Leistungsnachweise ein (zusammen 100 %)</div>`;
    }

    const weightHint = Math.abs(calc.totalWeight - 100) > 0.001
      ? `<div class="goal-box warning">Die Gewichtungen ergeben zusammen ${formatNumber(Math.round(calc.totalWeight * 100) / 100)} % statt 100 %. Die Note wird anteilig berechnet.</div>`
      : "";
    return weightHint + renderGoalMessage(module, calc, threshold);
  }

  function renderGoalMessage(module, calc, threshold) {
    if (calc.complete) {
      const reached = calc.raw >= threshold;
      const className = reached ? "success" : "danger";
      return `<div class="goal-box ${className}">Modulnote <strong>${formatGrade(calc.rounded)}</strong> – Wunschmodulnote ${formatGrade(module.target)} ${reached ? "erreicht" : "nicht erreicht"}</div>`;
    }

    if (calc.openWeight <= 0) {
      return `<div class="goal-box warning">Es sind noch Noten offen, aber keine offene Gewichtung vorhanden</div>`;
    }

    const needed = (threshold * calc.totalWeight - calc.knownWeightedSum) / calc.openWeight;
    if (needed > 6) {
      return `<div class="goal-box danger">Die Wunschmodulnote ${formatGrade(module.target)} ist mit den bereits eingetragenen Noten nicht mehr erreichbar</div>`;
    }
    if (needed <= 1) {
      return `<div class="goal-box success">Die Wunschmodulnote ${formatGrade(module.target)} ist bereits abgesichert, sofern die offenen Leistungen mindestens mit 1.0 bewertet werden</div>`;
    }

    return `<div class="goal-box">Für die Wunschmodulnote ${formatGrade(module.target)} brauchst du in den noch offenen Leistungsnachweisen im gewichteten Durchschnitt mindestens <strong>${formatNeededGrade(needed)}</strong></div>`;
  }

  function renderAssessmentHtml(semester, module, assessment) {
    return `
      <div class="assessment-row">
        <label class="assessment-name-field">
          <span>Leistungsnachweis</span>
          <input data-assessment-name="${assessment.id}" data-module="${module.id}" data-semester="${semester.id}" value="${escapeAttr(assessment.name)}">
        </label>
        <label>
          <span>Gewichtung %</span>
          <input data-assessment-weight="${assessment.id}" data-module="${module.id}" data-semester="${semester.id}" type="number" min="0" max="1000" step="0.5" value="${formatNumber(assessment.weight)}">
        </label>
        <label>
          <span>Note</span>
          <input data-assessment-grade="${assessment.id}" data-module="${module.id}" data-semester="${semester.id}" type="number" min="1" max="6" step="0.1" placeholder="offen" value="${assessment.grade == null ? "" : formatNumber(assessment.grade)}">
        </label>
        <button class="icon-btn delete-icon" data-delete-assessment="${assessment.id}" data-module="${module.id}" data-semester="${semester.id}" type="button" aria-label="Leistungsnachweis löschen">${ICON.trash}</button>
      </div>
    `;
  }

  function bindDynamicEvents() {
    document.querySelectorAll("[data-toggle-semester]").forEach(button => {
      button.addEventListener("click", () => {
        const semester = findSemester(button.dataset.toggleSemester);
        if (!semester) return;
        semester.collapsed = !semester.collapsed;
        saveState();
        render();
      });
    });

    document.querySelectorAll("[data-module-card]").forEach(details => {
      details.addEventListener("toggle", () => {
        const module = findModule(details.dataset.semesterId, details.dataset.moduleCard);
        if (!module) return;
        if (module.expanded === details.open) return;
        module.expanded = details.open;
        saveStateQuietly();
      });
    });

    bindModuleDragAndDrop();

    document.querySelectorAll("[data-add-module]").forEach(button => {
      button.addEventListener("click", () => openModuleDialog(button.dataset.addModule));
    });

    document.querySelectorAll("[data-semester-name]").forEach(input => {
      input.addEventListener("input", () => {
        const semester = findSemester(input.dataset.semesterName);
        if (!semester) return;
        semester.name = input.value;
        saveStateQuietly();
      });
      input.addEventListener("change", () => {
        const semester = findSemester(input.dataset.semesterName);
        if (!semester) return;
        semester.name = input.value.trim() || "Unbenanntes Semester";
        saveState();
        render();
      });
    });

    document.querySelectorAll("[data-semester-target]").forEach(select => {
      select.addEventListener("change", () => {
        const semester = findSemester(select.dataset.semesterTarget);
        if (!semester) return;
        semester.target = parseFloat(select.value);
        saveState();
        render();
      });
    });

    document.querySelectorAll("[data-delete-semester]").forEach(button => {
      button.addEventListener("click", () => {
        const semester = findSemester(button.dataset.deleteSemester);
        if (!semester) return;
        askConfirm(
          "Semester löschen?",
          `«${semester.name}» und alle darin enthaltenen Module und Noten werden gelöscht.`,
          () => {
            state.semesters = state.semesters.filter(s => s.id !== semester.id);
            saveState();
            render();
          }
        );
      });
    });

    document.querySelectorAll("[data-module-name]").forEach(input => {
      input.addEventListener("input", () => {
        const module = findModule(input.dataset.semester, input.dataset.moduleName);
        if (!module) return;
        module.name = input.value;
        saveStateQuietly();
      });
      input.addEventListener("change", () => {
        const module = findModule(input.dataset.semester, input.dataset.moduleName);
        if (!module) return;
        module.name = input.value.trim() || "Unbenanntes Modul";
        saveState();
        render();
      });
    });

    document.querySelectorAll("[data-module-ects]").forEach(input => {
      input.addEventListener("change", () => {
        const module = findModule(input.dataset.semester, input.dataset.moduleEcts);
        if (!module) return;
        module.ects = clampNumber(parseNumber(input.value), 0, 60, module.ects);
        saveState();
        render();
      });
    });

    document.querySelectorAll("[data-module-target]").forEach(select => {
      select.addEventListener("change", () => {
        const module = findModule(select.dataset.semester, select.dataset.moduleTarget);
        if (!module) return;
        module.target = parseFloat(select.value);
        saveState();
        render();
      });
    });

    document.querySelectorAll("[data-delete-module]").forEach(button => {
      button.addEventListener("click", () => {
        const semester = findSemester(button.dataset.semester);
        const module = findModule(button.dataset.semester, button.dataset.deleteModule);
        if (!semester || !module) return;
        askConfirm(
          "Modul löschen?",
          `«${module.name}» und alle eingetragenen Noten werden gelöscht.`,
          () => {
            semester.modules = semester.modules.filter(m => m.id !== module.id);
            saveState();
            render();
          }
        );
      });
    });

    document.querySelectorAll("[data-assessment-name]").forEach(input => {
      input.addEventListener("input", () => {
        const assessment = findAssessment(input.dataset.semester, input.dataset.module, input.dataset.assessmentName);
        if (!assessment) return;
        assessment.name = input.value;
        saveStateQuietly();
      });
      input.addEventListener("change", () => {
        const assessment = findAssessment(input.dataset.semester, input.dataset.module, input.dataset.assessmentName);
        if (!assessment) return;
        assessment.name = input.value.trim() || "Leistungsnachweis";
        saveState();
        renderPreservingOpenModule(input.dataset.module);
      });
    });

    document.querySelectorAll("[data-assessment-weight]").forEach(input => {
      input.addEventListener("input", () => {
        const assessment = findAssessment(input.dataset.semester, input.dataset.module, input.dataset.assessmentWeight);
        if (!assessment) return;
        const parsed = parseNumber(input.value);
        if (Number.isFinite(parsed) && parsed >= 0) assessment.weight = parsed;
        saveStateQuietly();
      });
      input.addEventListener("change", () => {
        const assessment = findAssessment(input.dataset.semester, input.dataset.module, input.dataset.assessmentWeight);
        if (!assessment) return;
        assessment.weight = clampNumber(parseNumber(input.value), 0, 1000, assessment.weight);
        saveState();
        renderPreservingOpenModule(input.dataset.module);
      });
    });

    document.querySelectorAll("[data-assessment-grade]").forEach(input => {
      input.addEventListener("input", () => {
        const assessment = findAssessment(input.dataset.semester, input.dataset.module, input.dataset.assessmentGrade);
        if (!assessment) return;
        const raw = input.value.trim();
        const parsed = parseNumber(raw);
        if (raw === "") assessment.grade = null;
        else if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 6) assessment.grade = Math.round(parsed * 100) / 100;
        saveStateQuietly();
      });
      input.addEventListener("change", () => {
        const assessment = findAssessment(input.dataset.semester, input.dataset.module, input.dataset.assessmentGrade);
        if (!assessment) return;
        const raw = input.value.trim();
        const parsed = parseNumber(raw);
        if (raw === "") assessment.grade = null;
        else if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 6) assessment.grade = Math.round(parsed * 100) / 100;
        else {
          showToast("Bitte eine Note zwischen 1.0 und 6.0 eingeben.");
          input.value = assessment.grade == null ? "" : assessment.grade;
          return;
        }
        saveState();
        renderPreservingOpenModule(input.dataset.module);
      });
    });

    document.querySelectorAll("[data-add-assessment]").forEach(button => {
      button.addEventListener("click", () => {
        const module = findModule(button.dataset.semester, button.dataset.addAssessment);
        if (!module) return;
        module.assessments.push({ id: uid(), name: "Neuer Leistungsnachweis", weight: 0, grade: null });
        saveState();
        renderPreservingOpenModule(module.id);
      });
    });

    document.querySelectorAll("[data-delete-assessment]").forEach(button => {
      button.addEventListener("click", () => {
        const module = findModule(button.dataset.semester, button.dataset.module);
        if (!module) return;
        const assessment = module.assessments.find(a => a.id === button.dataset.deleteAssessment);
        if (!assessment) return;
        askConfirm(
          "Leistungsnachweis löschen?",
          `«${assessment.name}» wird aus «${module.name}» entfernt.`,
          () => {
            module.assessments = module.assessments.filter(a => a.id !== assessment.id);
            saveState();
            renderPreservingOpenModule(module.id);
          }
        );
      });
    });
  }

  function bindModuleDragAndDrop() {
    let draggedModuleId = null;
    let draggedSemesterId = null;

    document.querySelectorAll("[data-module-drag]").forEach(handle => {
      handle.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
      });

      handle.addEventListener("dragstart", event => {
        draggedModuleId = handle.dataset.moduleDrag;
        draggedSemesterId = handle.dataset.semester;
        const card = handle.closest(".module-card");
        if (card) card.classList.add("dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", draggedModuleId);
        }
      });

      handle.addEventListener("dragend", () => {
        document.querySelectorAll(".module-card").forEach(card => card.classList.remove("dragging", "drag-before", "drag-after"));
        draggedModuleId = null;
        draggedSemesterId = null;
      });
    });

    document.querySelectorAll(".module-card").forEach(card => {
      card.addEventListener("dragover", event => {
        if (!draggedModuleId || card.dataset.semesterId !== draggedSemesterId || card.dataset.moduleCard === draggedModuleId) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        const rect = card.getBoundingClientRect();
        const before = event.clientY < rect.top + rect.height / 2;
        card.classList.toggle("drag-before", before);
        card.classList.toggle("drag-after", !before);
      });

      card.addEventListener("dragleave", event => {
        if (card.contains(event.relatedTarget)) return;
        card.classList.remove("drag-before", "drag-after");
      });

      card.addEventListener("drop", event => {
        if (!draggedModuleId || card.dataset.semesterId !== draggedSemesterId || card.dataset.moduleCard === draggedModuleId) return;
        event.preventDefault();
        const semester = findSemester(draggedSemesterId);
        if (!semester) return;

        const fromIndex = semester.modules.findIndex(module => module.id === draggedModuleId);
        const targetIndex = semester.modules.findIndex(module => module.id === card.dataset.moduleCard);
        if (fromIndex < 0 || targetIndex < 0) return;

        const rect = card.getBoundingClientRect();
        const placeBefore = event.clientY < rect.top + rect.height / 2;
        const [moved] = semester.modules.splice(fromIndex, 1);
        let insertIndex = semester.modules.findIndex(module => module.id === card.dataset.moduleCard);
        if (!placeBefore) insertIndex += 1;
        semester.modules.splice(insertIndex, 0, moved);

        saveState();
        render();
        showToast("Reihenfolge gespeichert.");
      });
    });
  }

  function renderPreservingOpenModule(moduleId) {
    render();
    const details = document.querySelector(`[data-module-card="${cssEscape(moduleId)}"]`);
    if (details) {
      details.open = true;
      const module = findModule(details.dataset.semesterId, moduleId);
      if (module) {
        module.expanded = true;
        saveStateQuietly();
      }
    }
  }

  function renderCatalog() {
    const semester = findSemester(activeSemesterId);
    if (!semester) {
      els.catalogList.innerHTML = "";
      return;
    }

    const query = els.moduleSearch.value.trim().toLowerCase();
    const items = library.filter(module => !query ||
      module.name.toLowerCase().includes(query) || module.code.toLowerCase().includes(query));

    els.catalogList.innerHTML = items.length
      ? items.map(module => {
          // Bereits belegte Module bleiben sichtbar, z. B. für eine Wiederholung.
          const presentIn = state.semesters.filter(s => s.modules.some(m => m.code && m.code === module.code));
          const count = module.assessments.length;
          return `
            <div class="catalog-item${presentIn.length ? " catalog-item-present" : ""}">
              <div>
                <div class="catalog-item-name">${escapeHtml(module.name)}</div>
                <div class="catalog-item-meta"><span class="module-code">${escapeHtml(module.code)}</span> · ${module.ects ? formatNumber(module.ects) + " ECTS" : "ohne ECTS"} · ${count} ${count === 1 ? "Leistungsnachweis" : "Leistungsnachweise"}</div>
                ${presentIn.length ? `<div class="catalog-presence">Bereits in ${presentIn.map(s => "«" + escapeHtml(s.name) + "»").join(", ")}</div>` : ""}
              </div>
              <div class="catalog-target">
                <label class="field-control">
                  <span>Wunsch</span>
                  <select data-catalog-target="${escapeAttr(module.code)}">${targetOptionsHtml(DEFAULT_TARGET)}</select>
                </label>
                <button class="btn btn-primary btn-small" data-catalog-add="${escapeAttr(module.code)}" type="button">${ICON.plus}Hinzufügen</button>
              </div>
            </div>
          `;
        }).join("")
      : `<div class="empty-semester"><p>Keine passenden Module gefunden. Über «Eigenes Modul» kannst du es selbst erfassen.</p></div>`;

    els.catalogList.querySelectorAll("[data-catalog-add]").forEach(button => {
      button.addEventListener("click", () => {
        const semesterNow = findSemester(activeSemesterId);
        const template = library.find(module => module.code === button.dataset.catalogAdd);
        if (!semesterNow || !template) return;
        if (semesterNow.modules.some(existing => existing.code === template.code)) {
          showToast("Dieses Modul ist in diesem Semester bereits vorhanden.");
          return;
        }

        const targetSelect = els.catalogList.querySelector(`[data-catalog-target="${cssEscape(template.code)}"]`);
        semesterNow.modules.push(normaliseModule({
          id: uid(),
          code: template.code,
          name: template.name,
          ects: template.ects,
          target: parseFloat(targetSelect?.value || DEFAULT_TARGET),
          source: "catalog",
          assessments: template.assessments.map(a => ({ id: uid(), name: a.name, weight: a.weight, grade: null }))
        }));

        saveState();
        els.moduleDialog.close();
        render();
        const weightSum = template.assessments.reduce((sum, a) => sum + Number(a.weight || 0), 0);
        showToast(weightSum === 100 ? "Modul hinzugefügt." : "Modul hinzugefügt. Bitte die Gewichtungen prüfen.");
      });
    });
  }

  function calculateModule(module) {
    const totalWeight = module.assessments.reduce((sum, a) => sum + Number(a.weight || 0), 0);
    const known = module.assessments.filter(a => a.grade != null);
    const open = module.assessments.filter(a => a.grade == null);
    const knownWeightedSum = known.reduce((sum, a) => sum + a.grade * Number(a.weight || 0), 0);
    const openWeight = open.reduce((sum, a) => sum + Number(a.weight || 0), 0);
    const knownWeight = known.reduce((sum, a) => sum + Number(a.weight || 0), 0);
    const raw = totalWeight > 0 && open.length === 0 ? knownWeightedSum / totalWeight : null;
    const partialRaw = knownWeight > 0 ? knownWeightedSum / knownWeight : null;
    const rounded = raw == null ? null : roundHalf(raw);

    return {
      totalWeight,
      knownWeightedSum,
      openWeight,
      knownWeight,
      raw,
      partialRaw,
      rounded,
      complete: module.assessments.length > 0 && open.length === 0 && totalWeight > 0
    };
  }

  function findSemester(id) {
    return state.semesters.find(s => s.id === id) || null;
  }

  function findModule(semesterId, moduleId) {
    return findSemester(semesterId)?.modules.find(m => m.id === moduleId) || null;
  }

  function findAssessment(semesterId, moduleId, assessmentId) {
    return findModule(semesterId, moduleId)?.assessments.find(a => a.id === assessmentId) || null;
  }

  function saveState() {
    if (cloud?.accountActive()) { cloud.changed(); return; }
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      showToast("Speichern im Browser ist fehlgeschlagen.");
      console.error(error);
    }
  }

  function saveStateQuietly() {
    if (cloud?.accountActive()) { cloud.changed(); return; }
    state.updatedAt = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { console.error(error); }
  }

  function askConfirm(title, text, action) {
    els.confirmTitle.textContent = title;
    els.confirmText.textContent = text;
    pendingConfirmAction = action;
    els.confirmDialog.showModal();
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1700);
  }

  function rawThresholdForTarget(target) {
    return Math.max(1, Number(target) - 0.25);
  }

  function roundHalf(value) {
    return Math.min(6, Math.max(1, Math.round((Number(value) + Number.EPSILON) * 2) / 2));
  }

  function normaliseHalfGrade(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_TARGET;
    return Math.min(6, Math.max(4, Math.round(n * 2) / 2));
  }

  function validGradeOrNull(value) {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 1 && n <= 6 ? Math.round(n * 100) / 100 : null;
  }

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function parseNumber(value) {
    if (typeof value !== "string") return Number(value);
    return Number(value.replace(",", "."));
  }

  function formatNeededGrade(value) {
    const minRequired = Math.ceil((Number(value) - 1e-9) * 100) / 100;
    return minRequired.toFixed(2);
  }

  function formatGrade(value, digits = 1) {
    if (value == null || !Number.isFinite(Number(value))) return "–";
    return Number(value).toFixed(digits);
  }

  // Der Semesterschnitt wird nicht gerundet. Angezeigt werden höchstens
  // drei Nachkommastellen, weitere Stellen werden einfach abgeschnitten.
  // Beispiel: 4.7589 wird als 4.758 angezeigt.
  function formatUnroundedGrade(value) {
    if (value == null || !Number.isFinite(Number(value))) return "–";

    const n = Number(value);
    const factor = 1000;
    const scaled = n * factor;
    const nearestInteger = Math.round(scaled);
    const safeScaled = Math.abs(scaled - nearestInteger) < 1e-9 ? nearestInteger : scaled;
    const truncated = Math.trunc(safeScaled) / factor;

    return truncated.toFixed(3).replace(/\.?0+$/, "");
  }

  function formatNumber(value) {
    const n = Number(value);
    return String(n);
  }

  function uid() {
    return crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(value));
    return String(value).replace(/([ #;?%&,.+*~\\':"!^$\[\]()=>|\/@])/g, "\\$1");
  }
})();
