"use strict";

(() => {
  // Check if loaded with Alogyan parameters or inside an iframe
  const params = new URLSearchParams(window.location.search);
  const teacherId = params.get("alogyanTeacherId") || params.get("teacherId");
  const teacherName = params.get("alogyanTeacherName") || params.get("teacherName");
  const instituteId = params.get("alogyanInstituteId") || params.get("tenantId");
  const batchId = params.get("batchId");
  const batchName = params.get("batchName");

  const isEmbedded = window.parent !== window;
  const isAlogyanSession = Boolean(teacherId || isEmbedded || params.has("alogyanToken"));

  if (teacherId) {
    sessionStorage.setItem("alogyan_session", JSON.stringify({
      teacherId,
      teacherName: teacherName || "Teacher",
      instituteId: instituteId || "",
      batchId: batchId || "general",
      batchName: batchName || "General Whiteboard",
      timestamp: Date.now()
    }));
  }

  // Force clean minimal white studio theme when accessed via Alogyan
  if (isAlogyanSession) {
    try {
      localStorage.setItem("penecho-theme", "studio");
      localStorage.setItem("penecho-studio-palette", "teal");
      document.documentElement.dataset.theme = "studio";
      document.documentElement.dataset.studioPalette = "teal";
      if (document.body) {
        document.body.dataset.theme = "studio";
        document.body.dataset.studioPalette = "teal";
      }
    } catch {}
  }

  function getActiveTeacherName() {
    if (teacherName) return teacherName;
    try {
      const stored = JSON.parse(sessionStorage.getItem("alogyan_session") || "{}");
      return stored.teacherName || "Teacher";
    } catch {
      return "Teacher";
    }
  }

  function getActiveBatchName() {
    if (batchName) return batchName;
    try {
      const stored = JSON.parse(sessionStorage.getItem("alogyan_session") || "{}");
      return stored.batchName || "";
    } catch {
      return "";
    }
  }

  // Attach Alogyan SSO badge in PenEcho topbar
  function attachAlogyanHeaderBadge() {
    if (!isAlogyanSession) return;
    if (document.querySelector("#alogyanSsoBadge")) return;

    const brand = document.querySelector(".brand");
    if (!brand) return;

    const name = getActiveTeacherName();
    const batch = getActiveBatchName();

    const badge = document.createElement("div");
    badge.id = "alogyanSsoBadge";
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      background: #f0fdf4;
      color: #166534;
      border: 1px solid #bbf7d0;
      margin-left: 10px;
      user-select: none;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    `;
    badge.innerHTML = `
      <span style="width: 7px; height: 7px; border-radius: 50%; background: #22c55e; flex-shrink: 0;"></span>
      <span>Alogyan Single Sign-On: <strong>${escapeHtml(name)}</strong>${batch ? ` <span style="opacity: 0.75;">(${escapeHtml(batch)})</span>` : ""}</span>
    `;
    brand.appendChild(badge);
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  // Listen for parent messages from Alogyan CMS
  window.addEventListener("message", async (event) => {
    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "alogyan:init-session") {
      if (data.user) {
        sessionStorage.setItem("alogyan_session", JSON.stringify({
          teacherId: data.user.uid,
          teacherName: data.user.name || data.user.displayName || "Teacher",
          instituteId: data.user.tenantId || "",
          batchId: data.batch?.id || "general",
          batchName: data.batch?.name || "",
          timestamp: Date.now()
        }));
        attachAlogyanHeaderBadge();
      }
      try {
        window.parent.postMessage({ type: "alogyan:ready", status: "authenticated" }, "*");
      } catch {}
    }

    if (data.type === "alogyan:get-snapshot") {
      try {
        let dataUrl = null;
        if (typeof window.PenEchoExportCanvas === "function") {
          const exportCanvas = await window.PenEchoExportCanvas();
          if (exportCanvas) dataUrl = exportCanvas.toDataURL("image/png");
        } else {
          const canvasEl = document.querySelector("canvas");
          if (canvasEl) dataUrl = canvasEl.toDataURL("image/png");
        }

        const title = document.querySelector("#canvasDocumentNameLabel")?.textContent?.trim() || "Whiteboard Notes";
        window.parent.postMessage({
          type: "alogyan:snapshot-result",
          requestId: data.requestId,
          dataUrl,
          title
        }, "*");
      } catch (err) {
        window.parent.postMessage({
          type: "alogyan:snapshot-error",
          requestId: data.requestId,
          error: String(err?.message || err)
        }, "*");
      }
    }
  });

  // Notify parent on ready
  if (isEmbedded) {
    try {
      window.parent.postMessage({ type: "alogyan:ready", status: "connected" }, "*");
    } catch {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachAlogyanHeaderBadge);
  } else {
    attachAlogyanHeaderBadge();
  }
})();
