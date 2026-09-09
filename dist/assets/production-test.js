const $ = (s, r = document) => r.querySelector(s);
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );
const session = () =>
  JSON.parse(sessionStorage.getItem("im-session") || "null");
async function api(path, options = {}) {
  const s = session(),
    headers = {
      "content-type": "application/json",
      ...(options.headers || {}),
    };

  const r = await fetch("/api/" + path, {
      ...options,
      headers,
      credentials: "same-origin",
    }),
    x = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(x.error || "Permintaan gagal");
  return x;
}
let active = null;
const recordedBlobs = new Map();
function loginRequired() {
  const main = $("#main");
  main.innerHTML = `<section class="page-hero"><div class="shell"><p class="eyebrow">PORTAL AMAN</p><h1>Masuk untuk mengerjakan tes</h1><p class="lead">Attempt, jawaban, waktu, dan hasil disimpan pada akun terverifikasi.</p><button class="btn primary" id="openSecureLogin">Masuk</button></div></section>`;
  $("#openSecureLogin").onclick = () => $("#loginDialog").showModal();
}
async function renderTest() {
  const m = location.pathname.match(/^\/test\/([^/]+)/);
  const requestedSlug = window.__QA_TEST_SLUG || m?.[1];
  if (!requestedSlug) return;
  const main = $("#main");
  if (!session()?.authenticated) return setTimeout(loginRequired, 0);
  main.innerHTML = `<section class="section"><div class="shell"><div class="panel live-loading"><span class="loader"></span><p>Memuat paket tes terpublikasi…</p></div></div></section>`;
  try {
    const t = await api("tests/" + encodeURIComponent(requestedSlug));
    active = t;
    main.innerHTML = `<section class="page-hero"><div class="shell"><p class="eyebrow">PRODUCTION TEST ENGINE</p><h1>${esc(t.title)}</h1><p class="lead">${esc(t.instructions || "Baca setiap instruksi dengan cermat. Jawaban disimpan ke server saat disubmit.")}</p></div></section><section class="section"><div class="shell"><div class="test-toolbar"><div><b>${t.questions.length} item terpublikasi</b><small>Versi ${esc(t.version)} · ${t.duration_minutes} menit</small></div><div class="test-time" id="serverTimer">${String(t.duration_minutes).padStart(2, "0")}:00</div></div><button class="btn primary" id="startServerTest">Mulai attempt</button><form id="serverTestForm" hidden>${t.questions.map((q, i) => question(q, i)).join("")}<div class="submit-bar"><button class="btn primary" type="submit">Submit ke server</button></div></form><div id="serverResult"></div></div></section>`;
    $("#startServerTest").onclick = start;
    bindAudio();
  } catch (e) {
    main.innerHTML = `<section class="section"><div class="shell"><div class="notice"><b>Tes tidak tersedia.</b> ${esc(e.message)}</div></div></section>`;
  }
}
function question(q, i) {
  let input;
  if (q.item_type === "choice")
    input = `<div class="options">${(q.options || []).map((o) => `<label><input type="radio" name="${q.id}" value="${esc(o)}" required> ${esc(o)}</label>`).join("")}</div>`;
  else if (q.item_type === "writing")
    input = `<textarea name="${q.id}" required placeholder="Tulis jawaban Anda"></textarea>`;
  else if (q.item_type === "speaking")
    input = `<div class="record-box"><button class="btn record-server-answer" type="button" data-record-question="${q.id}">● Rekam respons</button><span class="record-state" role="status">Belum direkam</span></div><textarea name="${q.id}" placeholder="Catatan opsional untuk examiner"></textarea>`;
  else input = `<input name="${q.id}" required>`;
  return `<article class="test-question"><div class="question-top"><span class="tag">${esc(q.section)}</span><b>${i + 1}/${active.questions.length}</b></div>${q.audio_url ? `<audio controls preload="metadata" src="${esc(q.audio_url)}"></audio>` : ""}${q.audio_text ? `<button class="btn play-secure-prompt" type="button" data-speech="${esc(q.audio_text)}">▶ Putar prompt audio</button>` : ""}${q.passage ? `<div class="reading-passage">${esc(q.passage)}</div>` : ""}<h3>${esc(q.prompt)}</h3>${input}</article>`;
}
async function start() {
  const b = $("#startServerTest");
  b.disabled = true;
  try {
    const a = await api("test-attempts/start", {
      method: "POST",
      body: JSON.stringify({ testSlug: active.slug }),
    });
    b.remove();
    const f = $("#serverTestForm");
    f.hidden = false;
    f.dataset.attempt = a.id;
    timer(active.duration_minutes * 60);
    f.onsubmit = submit;
    bindRecording();
  } catch (e) {
    alert(e.message);
    b.disabled = false;
  }
}
function timer(left) {
  const c = $("#serverTimer"),
    id = setInterval(() => {
      if (!c || left <= 0) return clearInterval(id);
      left--;
      c.textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
    }, 1000);
}
async function submit(e) {
  e.preventDefault();
  const f = e.currentTarget,
    answers = {};
  new FormData(f).forEach((v, k) => (answers[k] = v));
  const btn = $("button[type=submit]", f);
  btn.disabled = true;
  try {
    const recordings = {};
    for (const [questionId, blob] of recordedBlobs) {
      const sign = await api("uploads/sign", {
        method: "POST",
        body: JSON.stringify({
          bucket: "speaking",
          extension: "webm",
          size: blob.size,
        }),
      });
      const uploaded = await fetch(sign.signedUrl, {
        method: "PUT",
        headers: {
          "content-type": blob.type || "audio/webm",
          ...(sign.token ? { "x-upsert": "false" } : {}),
        },
        body: blob,
      });
      if (!uploaded.ok) throw new Error("Unggahan rekaman Speaking gagal.");
      recordings[questionId] = sign.path;
    }
    const r = await api("test-attempts/submit", {
      method: "POST",
      body: JSON.stringify({
        attemptId: f.dataset.attempt,
        answers,
        recordings,
      }),
    });
    f.querySelectorAll("input,textarea,button").forEach(
      (x) => (x.disabled = true),
    );
    $("#serverResult").innerHTML =
      `<div class="test-result"><strong>${r.objectiveScore == null ? "—" : r.objectiveScore + "%"}</strong><div><h2>Attempt tersimpan</h2><p>${r.total ? `${r.correct} dari ${r.total} item objektif benar.` : "Item memerlukan evaluasi manusia."} ${r.requiresHumanReview ? "Writing/Speaking diteruskan melalui workflow evaluasi." : ""}</p></div></div>`;
  } catch (err) {
    alert(err.message);
    btn.disabled = false;
  }
}
function bindAudio() {
  $$("audio").forEach((a) =>
    a.addEventListener("contextmenu", (e) => e.preventDefault()),
  );
  $$(".play-secure-prompt").forEach((button) =>
    button.addEventListener("click", () => {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        button.dataset.speech || "",
      );
      utterance.lang = "en-US";
      utterance.rate = 0.92;
      speechSynthesis.speak(utterance);
    }),
  );
}
function bindRecording() {
  let recorder = null,
    stream = null,
    chunks = [],
    activeButton = null;
  $$(".record-server-answer").forEach((button) =>
    button.addEventListener("click", async () => {
      const state = button.nextElementSibling;
      if (recorder?.state === "recording" && activeButton === button) {
        recorder.stop();
        return;
      }
      if (recorder?.state === "recording")
        return alert("Hentikan rekaman aktif terlebih dahulu.");
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        activeButton = button;
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, {
            type: recorder.mimeType || "audio/webm",
          });
          recordedBlobs.set(button.dataset.recordQuestion, blob);
          state.textContent = `Rekaman siap (${Math.ceil(blob.size / 1024)} KB)`;
          button.textContent = "● Rekam ulang";
          stream?.getTracks().forEach((track) => track.stop());
          activeButton = null;
        };
        recorder.start();
        button.textContent = "■ Hentikan";
        state.textContent = "Merekam…";
      } catch {
        state.textContent = "Mikrofon tidak tersedia atau izin ditolak.";
      }
    }),
  );
}
function $$(s, r = document) {
  return [...r.querySelectorAll(s)];
}
window.addEventListener("popstate", renderTest);
window.addEventListener("load", renderTest);
renderTest();
