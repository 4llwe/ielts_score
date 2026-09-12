const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => [...r.querySelectorAll(s)];
const money = (n) =>
  n == null
    ? "Hubungi admin"
    : new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(n);
const localPreview =
  location.hostname === "localhost" || location.hostname === "127.0.0.1";
const normalizeRole = (value) => {
  const role = String(value || "student")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return ["admin", "administrator", "super_admin", "superadmin"].includes(role)
    ? "admin"
    : ["student", "instructor", "examiner"].includes(role)
      ? role
      : "student";
};
const normalizeMenuItem = (item) => {
  let href = String(item?.href || "/home").trim();
  href = href.replace(/^#(?=\/)/, "");
  if (!href.startsWith("/")) href = `/${href.replace(/^\/+/, "")}`;
  if (item?.id === "method" || href === "/method")
    return {
      ...item,
      id: "alumni",
      label: "Alumni & Testimoni",
      href: "/alumni",
    };
  return { ...item, href };
};
const routePath = () => {
  if (window.__QA_ROUTE)
    return `/${String(window.__QA_ROUTE).replace(/^\/+/, "")}`;
  const path = location.pathname.replace(/\/+$/, "") || "/home";
  return path === "/" ? "/home" : path;
};
const navigate = (path, replace = false) => {
  const target = String(path || "/home").replace(/^#/, "");
  history[replace ? "replaceState" : "pushState"]({}, "", target);
  render();
  // Inform independently loaded route modules (dashboard/test) after an
  // in-page navigation. pushState does not emit popstate by itself.
  window.dispatchEvent(new Event("ielts:navigation"));
  window.scrollTo({ top: 0, behavior: "smooth" });
};
async function apiCall(path, options = {}, retry = true) {
  const headers = {
    "content-type": "application/json",
    ...(session?.accessToken
      ? { authorization: `Bearer ${session.accessToken}` }
      : {}),
    ...(options.headers || {}),
  };
  const r = await fetch("/api/" + path, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && retry && !path.startsWith("auth/")) {
    const refreshed = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
    });
    if (refreshed.ok) {
      const refreshedData = await refreshed.json().catch(() => ({}));
      if (refreshedData.accessToken && session) {
        session.accessToken = refreshedData.accessToken;
        session.expiresAt =
          Date.now() + (refreshedData.expiresIn || 3600) * 1000;
        sessionStorage.setItem("im-session", JSON.stringify(session));
      }
      return apiCall(path, options, false);
    }
    session = null;
    sessionStorage.removeItem("im-session");
  }
  if (!r.ok) throw new Error(data.error || "Permintaan gagal");
  return data;
}
async function syncAttempts() {
  if (!session?.authenticated) return;
  try {
    const rows = await apiCall("attempts");
    const mapped = rows.map((x) => ({
      id: x.id,
      testId: x.test_slug,
      label: x.metadata?.label || x.test_slug,
      score: Number(x.objective_score || 0),
      date: x.submitted_at || x.started_at,
    }));
    localStorage.setItem("im-attempts", JSON.stringify(mapped));
  } catch (e) {
    console.warn("Attempt sync:", e.message);
  }
}
async function syncPublicData() {
  try {
    const x = await apiCall("public");
    if (Array.isArray(x.programs)) {
      data.programs = x.programs.map((p) => ({
        id: p.slug,
        title: p.title,
        description: p.description || "",
        category: p.category || "Program",
        level: "",
        duration: p.duration_weeks
          ? `${p.duration_weeks} minggu`
          : "Sesuai program",
        meetings: p.meetings || "",
        mode: p.mode || "",
        price: p.consultation_required ? null : Number(p.price || 0),
        oldPrice: p.old_price == null ? null : Number(p.old_price),
        billingUnit: p.billing_unit || "",
        features: p.features || [],
        featured: false,
      }));
    }
    if (Array.isArray(x.tests))
      data.tests = x.tests.map((t) => ({
        id: t.slug,
        title: t.title,
        minutes: t.duration_minutes,
        questions: 0,
        price: Number(t.price || 0),
      }));
    if (Array.isArray(x.menus)) data.menus = x.menus.map(normalizeMenuItem);
    nav();
  } catch (e) {
    if (!localPreview) console.warn("Public data:", e.message);
  }
}
const fallback = {
  programs: [
    {
      id: "ielts-online",
      title: "IELTS Preparation Online Course",
      category: "IELTS Preparation",
      level: "Intermediate–Advanced",
      duration: "12 minggu",
      meetings: "30 pertemuan × 100 menit",
      mode: "Online",
      price: 1750000,
      oldPrice: 2350000,
      billingUnit: "per kelas",
      featured: true,
      features: [
        "Tutor lulusan luar negeri",
        "Jadwal fleksibel",
        "Konsultasi 24 jam",
        "Progress report rutin",
        "Kelas eksklusif dan interaktif",
      ],
    },
    {
      id: "ielts-private",
      title: "IELTS Preparation Private Coaching",
      category: "IELTS Preparation",
      level: "Semua level",
      duration: "Fleksibel",
      meetings: "Sesuai kebutuhan",
      mode: "Private 1-on-1",
      price: 150000,
      oldPrice: null,
      billingUnit: "per pertemuan",
      features: ["Jadwal fleksibel", "Program personal", "Feedback individual"],
    },
    {
      id: "ielts-academic",
      title: "IELTS Academic Preparation",
      category: "IELTS Preparation",
      level: "Intermediate–Advanced",
      duration: "12 minggu",
      meetings: "30 pertemuan × 100 menit",
      mode: "Online & On-site",
      price: 1750000,
      oldPrice: 2350000,
      billingUnit: "per kelas",
      featured: true,
      features: [
        "Tutor lulusan luar negeri",
        "Progress report rutin",
        "Konsultasi 24 jam",
        "Bonus mengulang sesuai ketentuan",
      ],
    },
    {
      id: "ielts-whv",
      title: "IELTS Preparation for WHV",
      category: "IELTS Preparation",
      level: "Intermediate–Advanced",
      duration: "12 minggu",
      meetings: "30 pertemuan × 100 menit",
      mode: "Online & On-site",
      price: 1975000,
      oldPrice: 2975000,
      billingUnit: "per kelas",
      featured: true,
      features: [
        "Tutor berpengalaman dan praktisi WHV",
        "Kelas eksklusif",
        "Progress report rutin",
        "Jadwal fleksibel",
      ],
    },
    {
      id: "toefl-preparation",
      title: "TOEFL Preparation Class",
      category: "TOEFL Preparation",
      level: "Pre-intermediate–Advanced",
      duration: "12 minggu",
      meetings: "30 pertemuan × 100 menit",
      mode: "Online & On-site",
      price: 1375000,
      oldPrice: 1975000,
      billingUnit: "per kelas",
      featured: true,
      features: [
        "Tutor lulusan luar negeri",
        "Latihan intensif",
        "Progress report rutin",
        "Konsultasi 24 jam",
      ],
    },
    {
      id: "toefl-ielts-private",
      title: "TOEFL & IELTS Preparation Private Coaching",
      category: "Private",
      level: "Semua level",
      duration: "Fleksibel",
      meetings: "Sesuai kebutuhan",
      mode: "Private",
      price: 150000,
      oldPrice: null,
      billingUnit: "mulai per pertemuan",
      features: ["Kurikulum personal", "Jadwal fleksibel", "Feedback tutor"],
    },
    {
      id: "speakup-academy",
      title: "SpeakUp Academy",
      category: "General English",
      level: "Semua level",
      duration: "3 minggu per level",
      meetings: "10 pertemuan × 90 menit",
      mode: "Online Group Class",
      price: 175000,
      oldPrice: 550000,
      billingUnit: "per level",
      featured: true,
      features: [
        "Kelas eksklusif dan interaktif",
        "Progress report dan sertifikat",
        "Jadwal fleksibel",
      ],
    },
    {
      id: "prediction-test",
      title: "TOEFL & IELTS Preparation Practice",
      category: "Tes",
      level: "Semua level",
      duration: "Sesuai jadwal",
      meetings: "1 sesi tes",
      mode: "Online / On-site",
      price: null,
      oldPrice: null,
      billingUnit: "",
      features: [
        "Latihan terstruktur",
        "Laporan hasil",
        "Informasi biaya melalui admin",
      ],
    },
    {
      id: "toefl-official-registration",
      title: "TOEFL Preparation Consultation",
      category: "Tes",
      level: "Semua level",
      duration: "Sesuai penyelenggara",
      meetings: "1 sesi tes",
      mode: "Sesuai penyelenggara",
      price: null,
      oldPrice: null,
      billingUnit: "",
      features: [
        "Layanan pendaftaran",
        "Jadwal dan biaya dikonfirmasi admin",
        "Tidak mencakup pendaftaran atau penyelenggaraan tes resmi",
      ],
    },
    {
      id: "sworn-translator",
      title: "Sworn Translator",
      category: "Layanan",
      level: "Dokumen",
      duration: "Sesuai dokumen",
      meetings: "Layanan profesional",
      mode: "Online",
      price: null,
      oldPrice: null,
      billingUnit: "",
      features: [
        "Penawaran berdasarkan jenis dan jumlah dokumen",
        "Estimasi biaya setelah review",
      ],
    },
    {
      id: "general-english",
      title: "General English",
      category: "General English",
      level: "Beginner–Advanced",
      duration: "Sesuai level",
      meetings: "Program kelas",
      mode: "Online & On-site",
      price: null,
      oldPrice: null,
      billingUnit: "",
      features: ["Speaking, grammar, vocabulary", "Progress report"],
    },
    {
      id: "academic-writing",
      title: "Academic Writing",
      category: "Academic",
      level: "Intermediate–Advanced",
      duration: "Fleksibel",
      meetings: "Program kelas / private",
      mode: "Online",
      price: null,
      oldPrice: null,
      billingUnit: "",
      features: [
        "Essay structure",
        "Citation and academic style",
        "Individual feedback",
      ],
    },
    {
      id: "smart-english-children",
      title: "Smart English for Children",
      category: "Children",
      level: "Anak-anak",
      duration: "Sesuai level",
      meetings: "Program kelas",
      mode: "Online & On-site",
      price: null,
      oldPrice: null,
      billingUnit: "",
      features: [
        "Aktivitas sesuai usia",
        "Kelas interaktif",
        "Laporan perkembangan",
      ],
    },
    {
      id: "english-specific-purpose",
      title: "English for Specific Purpose",
      category: "Professional",
      level: "Disesuaikan",
      duration: "Disesuaikan",
      meetings: "Custom program",
      mode: "Online & On-site",
      price: null,
      oldPrice: null,
      billingUnit: "",
      features: [
        "Needs analysis",
        "Materi sesuai profesi",
        "Corporate/private option",
      ],
    },
    {
      id: "scholarship-mentoring",
      title: "Bimbingan Beasiswa",
      category: "Mentoring",
      level: "Pelajar–Profesional",
      duration: "Fleksibel",
      meetings: "Mentoring",
      mode: "Online",
      price: null,
      oldPrice: null,
      billingUnit: "",
      features: ["Strategi aplikasi", "Review dokumen", "Persiapan wawancara"],
    },
    {
      id: "campus-application",
      title: "Bimbingan Mendaftar Kampus 13+ Negara",
      category: "Mentoring",
      level: "Pelajar–Profesional",
      duration: "Sesuai proses aplikasi",
      meetings: "Pendampingan",
      mode: "Online",
      price: null,
      oldPrice: null,
      billingUnit: "",
      features: ["Pemilihan kampus", "Review aplikasi", "Pendampingan proses"],
    },
  ],
  tests: [
    {
      id: "placement",
      title: "English Preparation Diagnostic",
      minutes: 15,
      questions: 15,
      price: 0,
    },
    {
      id: "toefl-prediction",
      title: "TOEFL Preparation Full Practice",
      minutes: 120,
      questions: 140,
      price: 175000,
    },
    {
      id: "ielts-simulation",
      title: "IELTS Preparation Full Practice",
      minutes: 165,
      questions: 80,
      price: 250000,
    },
    {
      id: "ielts-mini",
      title: "IELTS Mini Preparation",
      minutes: 20,
      questions: 10,
      price: 0,
    },
    {
      id: "toefl-mini",
      title: "TOEFL iBT 2026 Mini Preparation",
      minutes: 15,
      questions: 10,
      price: 0,
    },
    {
      id: "toefl-preparation-2026-form-a",
      title: "TOEFL Preparation 2026 — Form A",
      minutes: 90,
      questions: 68,
      price: 0,
    },
  ],
  menus: [
    { id: "home", label: "Home", href: "/home", order: 1, active: true },
    {
      id: "programs",
      label: "Program",
      href: "/programs",
      order: 2,
      active: true,
    },
    {
      id: "tests",
      label: "Tes Online",
      href: "/tests",
      order: 3,
      active: true,
    },
    {
      id: "pricing",
      label: "Paket & Harga",
      href: "/pricing",
      order: 4,
      active: true,
    },
    {
      id: "resources",
      label: "Sumber Belajar",
      href: "/resources",
      order: 5,
      active: true,
    },
    {
      id: "about",
      label: "Profil Lembaga",
      href: "/about",
      order: 6,
      active: true,
    },
    {
      id: "alumni",
      label: "Alumni & Testimoni",
      href: "/alumni",
      order: 7,
      active: true,
    },
    {
      id: "contact",
      label: "Kontak",
      href: "/contact",
      order: 8,
      active: true,
    },
  ],
};
let data =
  JSON.parse(localStorage.getItem("im-content-v2") || "null") || fallback;
data.menus = Array.isArray(data.menus)
  ? data.menus.map(normalizeMenuItem)
  : fallback.menus.map(normalizeMenuItem);
let session = JSON.parse(sessionStorage.getItem("im-session") || "null");
if (session) session.role = normalizeRole(session.role);
const defaultInstitution = {
  name: "IELTS_MATE",
  legalPosition: "Lembaga persiapan dan pembelajaran bahasa Inggris independen",
  profileStatement:
    "IELTS_MATE adalah lembaga persiapan dan pembelajaran bahasa Inggris yang menghadirkan program terstruktur untuk membantu peserta mengembangkan kemampuan akademik, profesional, dan komunikasi sehari-hari. Pembelajaran memadukan diagnosis awal, kelas terarah, latihan mandiri, umpan balik, serta pemantauan progres dalam satu ekosistem digital.",
  vision:
    "Menjadi lembaga persiapan bahasa Inggris yang tepercaya, mudah diakses, dan berorientasi pada perkembangan nyata peserta dari Nusa Tenggara Barat untuk peluang pendidikan dan karier yang lebih luas.",
  mission: [
    "Menyediakan pembelajaran bahasa Inggris yang terstruktur, relevan, dan terjangkau.",
    "Mendampingi peserta melalui target belajar yang jelas, latihan terukur, dan umpan balik berkala.",
    "Memanfaatkan teknologi untuk memperluas akses, menjaga konsistensi belajar, dan memudahkan pemantauan progres.",
    "Mengembangkan layanan IELTS Preparation, TOEFL Preparation, General English, Academic English, dan mentoring sesuai kebutuhan peserta.",
    "Menjalankan layanan secara transparan, bertanggung jawab, dan terus meningkatkan mutu program.",
  ],
  values: [
    "Integritas",
    "Berpusat pada peserta",
    "Progres terukur",
    "Aksesibilitas",
    "Perbaikan berkelanjutan",
  ],
  learningModel: [
    "Diagnosis kebutuhan",
    "Rencana belajar",
    "Kelas dan materi",
    "Latihan terarah",
    "Feedback manusia",
    "Evaluasi progres",
    "Pengakuan penyelesaian",
  ],
  founderName: "Sumawartini, M.TESOL",
  founderTitle: "Founder & Program Director",
  address:
    "Perumahan Aghniya Harmony, Terong Tawah, Kec. Labuapi, Kab. Lombok Barat, Nusa Tenggara Barat 83361",
  phone: "+62 878-6405-3222",
  email: "sumawartinitajalli@gmail.com",
  disclaimer:
    "IELTS_MATE merupakan lembaga persiapan independen. Program latihan, diagnostic, dan sertifikat pengakuan bukan tes, skor, atau sertifikat IELTS/TOEFL resmi.",
};
function getInstitution() {
  try {
    return {
      ...defaultInstitution,
      ...JSON.parse(localStorage.getItem("im-institution-profile") || "{}"),
    };
  } catch {
    return defaultInstitution;
  }
}
async function syncInstitutionProfile() {
  try {
    const p = await apiCall("institution");
    localStorage.setItem(
      "im-institution-profile",
      JSON.stringify({ ...defaultInstitution, ...p }),
    );
    if (routePath().includes("/about")) render();
  } catch (e) {
    console.warn("Institution profile sync:", e.message);
  }
}
const main = qs("#main"),
  toast = qs("#toast");
const notify = (m) => {
  toast.textContent = m;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
};
function nav() {
  const route = routePath();
  qs("#publicNav").className = "public-nav";
  qs("#publicNav").innerHTML = data.menus
    .filter((m) => m.active)
    .sort((a, b) => a.order - b.order)
    .map(
      (m) =>
        `<a href="${esc(m.href)}" ${route === m.href ? 'aria-current="page"' : ""}>${esc(m.label)}</a>`,
    )
    .join("");
}
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );
const pageHero = (k, t, d) =>
  `<section class="page-hero"><div class="shell"><div class="crumb">Home / ${esc(k)}</div><p class="eyebrow">${esc(k).toUpperCase()}</p><h1>${esc(t)}</h1><p class="lead">${esc(d)}</p></div></section>`;
const priceBlock = (p) =>
  p.price == null
    ? `<b class="consult-price">Konsultasikan biaya</b>`
    : `<div class="catalog-price">${p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : ""}<b>${money(p.price)}</b><small>${esc(p.billingUnit || "")}</small></div>`;
const programCards = (limit = routePath().includes("/home") ? 4 : 0) =>
  `<div class="cards catalog-grid">${(limit
    ? data.programs.slice(0, limit)
    : data.programs
  )
    .map(
      (p) =>
        `<article class="card program-card" data-category="${esc(p.category || "Lainnya")}"><div class="card-top"><span class="tag">${esc(p.category || p.mode)}</span>${p.featured ? '<span class="promo-badge">PROMO</span>' : ""}</div><h3>${esc(p.title)}</h3><p>${esc(p.level)} · ${esc(p.duration)}</p><div class="program-meta"><span>${esc(p.mode)}</span><span>${esc(p.meetings || "")}</span></div><ul class="compact-features">${(
          p.features || []
        )
          .slice(0, 3)
          .map((f) => `<li>${esc(f)}</li>`)
          .join(
            "",
          )}</ul>${priceBlock(p)}<div class="card-actions">${p.price != null ? `<button class="btn primary wide" data-buy="${esc(p.id)}" data-name="${esc(p.title)}" data-amount="${p.price}">Pilih program</button>` : `<a class="btn wide" href="/contact">Tanya biaya</a>`}</div></article>`,
    )
    .join("")}</div>`;
function home() {
  return `<section class="hero commercial-hero"><div class="shell hero-grid"><div><p class="eyebrow">PERSIAPAN BAHASA INGGRIS TERINTEGRASI</p><h1>Latihan yang jelas.<br><em>Feedback yang bermakna.</em><br>Progres yang terlihat.</h1><p class="lead">Bangun kesiapan melalui IELTS Preparation, TOEFL Preparation, English akademik, dan komunikasi profesional dengan diagnosis awal, kelas bersama mentor M.TESOL, latihan terarah, dan dashboard progres dalam satu platform.</p><div class="hero-actions"><a class="btn primary" href="/test/placement">Mulai diagnostic gratis</a><a class="btn secondary" href="/programs">Lihat program</a></div><p class="micro-proof">Tanpa klaim skor resmi · Data belajar milik peserta · Feedback Writing & Speaking dapat ditinjau manusia</p><div class="trust-row"><span><b>1 ekosistem</b>Kelas, tes, tugas, feedback</span><span><b>4 jalur</b>IELTS Preparation, TOEFL Preparation, akademik, profesi</span><span><b>Transparan</b>Harga dan batas layanan</span></div></div><aside class="hero-panel product-preview" aria-label="Pratinjau pengalaman belajar"><div class="preview-top"><div><p class="eyebrow">LEARNER WORKSPACE</p><h2>Fokus pada langkah berikutnya.</h2></div><span class="status live">Terintegrasi</span></div><div class="score-card action-card"><small>REKOMENDASI HARI INI</small><h3>Selesaikan diagnostic, lalu susun target belajar.</h3><p>Setelah masuk, dashboard memprioritaskan program, jadwal, tugas, latihan, feedback, dan sertifikat yang benar-benar dimiliki akun.</p></div><div class="mini-list"><div><span>Diagnosis & latihan</span><b>Terukur</b></div><div><span>Writing & Speaking</span><b>Human review</b></div><div><span>Pembayaran & akses</span><b>Otomatis</b></div></div></aside></div></section>
  <section class="proof-bar"><div class="shell proof-grid"><div><b>Mentor-led</b><span>Pendampingan akademik</span></div><div><b>Progress-first</b><span>Aktivitas dapat ditindaklanjuti</span></div><div><b>Independent</b><span>Bukan penyelenggara tes resmi</span></div><div><b>Privacy-aware</b><span>Data minimum dan akses berbasis peran</span></div></div></section>
  <section class="section"><div class="shell"><div class="section-head"><div><p class="eyebrow">PROGRAM PILIHAN</p><h2>Mulai dari tujuan, bukan sekadar materi</h2></div><p>Setiap program menjelaskan format, durasi, biaya, dan hasil belajar sebelum peserta mendaftar.</p></div>${programCards()}</div></section>
  <section class="section soft"><div class="shell"><div class="section-head"><div><p class="eyebrow">LEARNING JOURNEY</p><h2>Satu alur dari diagnosis hingga evaluasi</h2></div><p>Pengalaman belajar dirancang agar peserta selalu mengetahui posisi saat ini dan langkah berikutnya.</p></div><ol class="journey-pro"><li><span>01</span><div><b>Ukur baseline</b><p>Diagnostic awal memetakan kebutuhan tanpa mengklaim skor resmi.</p></div></li><li><span>02</span><div><b>Tetapkan target</b><p>Pilih tujuan, tenggat, format kelas, dan ritme belajar realistis.</p></div></li><li><span>03</span><div><b>Belajar & berlatih</b><p>Materi, kelas, tugas, dan practice test berada dalam satu akun.</p></div></li><li><span>04</span><div><b>Dapatkan feedback</b><p>Hasil objektif, review manusia, dan riwayat progres membentuk latihan berikutnya.</p></div></li></ol></div></section>
  <section class="section"><div class="shell"><div class="section-head"><div><p class="eyebrow">UNTUK SETIAP PERAN</p><h2>Operasional yang benar-benar terhubung</h2></div></div><div class="role-grid"><article><span>Peserta</span><h3>Belajar dengan arah</h3><p>Program, jadwal, tugas, hasil, feedback, notifikasi, dan sertifikat.</p></article><article><span>Instructor</span><h3>Kelola kelas</h3><p>Siswa, materi, tugas, kehadiran, dan jadwal dalam satu workspace.</p></article><article><span>Examiner</span><h3>Feedback terstandar</h3><p>Antrian evaluasi Writing dan Speaking dengan rubrik dan tenggat.</p></article><article><span>Admin</span><h3>Kendalikan bisnis</h3><p>Katalog, enrollment, pembayaran, CRM, konten, akses, dan audit log.</p></article></div></div></section>
  <section class="section evidence-section"><div class="shell evidence-grid"><div><p class="eyebrow">MUTU & TRANSPARANSI</p><h2>Persiapan independen dengan batas layanan yang jelas.</h2><p>Kami memisahkan latihan internal, feedback pembelajaran, dan sertifikat penyelesaian dari hasil tes resmi. Materi produksi harus melalui review konten, lisensi, rubrik, dan quality assurance.</p><div class="hero-actions"><a class="btn primary" href="/alumni">Lihat alumni</a><a class="btn" href="/trust">Pusat kepercayaan</a></div></div><div class="evidence-list"><div><b>Penilaian bertanggung jawab</b><span>Skor diagnostik program preparation tidak dipasarkan sebagai skor ujian resmi.</span></div><div><b>Hak akses terkontrol</b><span>Peran ditetapkan administrator dan diverifikasi di server.</span></div><div><b>Jejak perubahan</b><span>Aktivitas administratif penting tercatat dalam audit log.</span></div></div></div></section>
  <section class="section institution-home"><div class="shell institution-home-grid"><div><p class="eyebrow">DIPIMPIN PENDIDIK</p><h2>Program yang berpusat pada kebutuhan peserta.</h2><p>IELTS_MATE menghubungkan pendampingan manusia dan teknologi agar proses belajar tetap personal, terukur, dan mudah dipantau.</p><a class="text-link" href="/about">Kenali lembaga dan pengelola →</a></div><img src="/assets/images/director-sumawartini.webp" alt="Sumawartini, M.TESOL, Founder dan Program Director" loading="lazy" width="640" height="640"></div></section>
  <section class="section"><div class="shell cta"><div><p class="eyebrow">LANGKAH PERTAMA</p><h2>Temukan jalur belajar yang sesuai target Anda.</h2><p>Mulai dengan diagnostic gratis atau konsultasikan kebutuhan program.</p></div><div class="hero-actions"><a class="btn secondary" href="/register">Buat akun</a><a class="btn ghost-on-dark" href="/contact">Konsultasi</a></div></div></section>`;
}
function programs() {
  const cats = [
    "Semua",
    "IELTS Preparation",
    "TOEFL Preparation",
    "Tes",
    "General English",
    "Academic",
    "Children",
    "Professional",
    "Mentoring",
    "Layanan",
    "Private",
  ];
  return (
    pageHero(
      "Program",
      "Program belajar dan layanan bahasa",
      "Pilih program berdasarkan target, format belajar, dan anggaran Anda.",
    ) +
    `<section class="section"><div class="shell"><div class="filters program-filters">${cats.map((c, i) => `<button class="filter ${i === 0 ? "active" : ""}" data-program-filter="${esc(c)}">${esc(c)}</button>`).join("")}</div>${programCards()}</div></section>`
  );
}
function tests() {
  return (
    pageHero(
      "Tes Online",
      "Latihan preparation yang terukur",
      "Kerjakan tes, simpan jawaban otomatis, dan pantau hasil dalam dashboard.",
    ) +
    `<section class="section"><div class="shell"><div class="cards">${data.tests.map((t) => `<article class="card"><span class="tag">${t.price ? "PREMIUM" : "GRATIS"}</span><h3>${esc(t.title)}</h3><p>${t.minutes} menit · ${t.questions} soal · autosave · laporan hasil</p><div class="card-meta"><b>${t.price ? money(t.price) : "Gratis"}</b><a href="/test/${t.id}">Mulai →</a></div></article>`).join("")}</div><p class="notice notice-spaced">Produk merupakan latihan internal untuk IELTS Preparation dan TOEFL Preparation; bukan tes atau skor resmi.</p></div></section>`
  );
}
function pricing() {
  const fixed = data.programs.filter((p) => p.price != null);
  return (
    pageHero(
      "Paket & Harga",
      "Harga program yang transparan",
      "Bandingkan biaya, durasi, format kelas, dan fasilitas sebelum memilih program.",
    ) +
    `<section class="section"><div class="shell"><div class="price-summary"><div><span>SpeakUp Academy</span><b>${money(175000)}</b><small>per level</small></div><div><span>Private IELTS Preparation</span><b>${money(150000)}</b><small>per pertemuan</small></div><div><span>Kelas persiapan</span><b>${money(1375000)}</b><small>mulai per program</small></div></div><div class="cards pricing-grid">${fixed.map((p) => `<article class="card pricing-card"><div class="card-top"><span class="tag">${esc(p.category)}</span>${p.oldPrice ? '<span class="promo-badge">PROMO</span>' : ""}</div><h3>${esc(p.title)}</h3>${priceBlock(p)}<p>${esc(p.duration)} · ${esc(p.meetings || "")}</p><ul class="feature-list">${(p.features || []).map((f) => `<li>${esc(f)}</li>`).join("")}</ul><button class="btn primary wide" data-buy="${esc(p.id)}" data-name="${esc(p.title)}" data-amount="${p.price}">Daftar sekarang</button></article>`).join("")}</div><div class="notice price-note"><b>Transparansi harga:</b> harga final, periode akses, jadwal, fasilitas, dan ketentuan refund harus ditampilkan kembali sebelum checkout. Program tanpa harga tetap diarahkan ke konsultasi agar tidak menampilkan informasi yang belum disetujui.</div></div></section>`
  );
}
function resources() {
  const articles = [
    [
      "ielts-study-plan",
      "IELTS PREPARATION",
      "Rencana belajar 8 minggu yang realistis",
      "Susun baseline, target mingguan, latihan per skill, dan evaluasi dua mingguan.",
    ],
    [
      "writing-feedback",
      "WRITING",
      "Cara menggunakan feedback agar tulisan benar-benar membaik",
      "Ubah komentar examiner menjadi daftar revisi dan latihan yang dapat diulang.",
    ],
    [
      "clinical-english",
      "PROFESSIONAL",
      "English for Nurses: komunikasi klinis yang aman",
      "Fokus pada handover, klarifikasi, informed consent, dan dokumentasi.",
    ],
  ];
  return (
    pageHero(
      "Sumber Belajar",
      "Panduan untuk belajar lebih strategis",
      "Artikel praktis yang menghubungkan target, latihan, feedback, dan refleksi.",
    ) +
    `<section class="section"><div class="shell"><div class="resource-feature"><div><span class="tag">MULAI DI SINI</span><h2>Jangan mengerjakan semua hal sekaligus.</h2><p>Mulai dengan diagnostic, pilih satu kelemahan utama, lakukan latihan terfokus, lalu gunakan feedback untuk menentukan langkah berikutnya.</p><a class="btn primary" href="/test/placement">Ambil diagnostic gratis</a></div><aside><b>Prinsip belajar efektif</b><ul class="feature-list"><li>Target spesifik dan berbatas waktu</li><li>Latihan yang menyerupai tugas sebenarnya</li><li>Feedback berbasis bukti dari jawaban</li><li>Pengulangan pada pola kesalahan</li></ul></aside></div><div class="cards resource-grid">${articles.map((a) => `<article class="card"><span class="tag">${a[1]}</span><h3>${a[2]}</h3><p>${a[3]}</p><a class="text-link" href="/article/${a[0]}">Baca panduan →</a></article>`).join("")}</div><div class="notice"><b>Catatan editorial:</b> konten edukasi harus mencantumkan penulis, tanggal review, sumber, dan batas penggunaan sebelum diterbitkan secara komersial.</div></div></section>`
  );
}
const resourceArticles = {
  "ielts-study-plan": [
    "IELTS Preparation",
    "Rencana belajar 8 minggu yang realistis",
    "Mulai dari baseline, bukan asumsi.",
    [
      "Minggu 1: diagnostic dan analisis kebutuhan",
      "Minggu 2–3: latihan terfokus pada skill terlemah",
      "Minggu 4: mock test dan evaluasi",
      "Minggu 5–6: perbaikan pola kesalahan",
      "Minggu 7: simulasi terpadu",
      "Minggu 8: konsolidasi dan strategi hari tes",
    ],
  ],
  "writing-feedback": [
    "Writing",
    "Cara menggunakan feedback secara efektif",
    "Feedback bernilai ketika menghasilkan revisi yang dapat diuji.",
    [
      "Kelompokkan komentar berdasarkan kriteria",
      "Pilih maksimal tiga prioritas per tulisan",
      "Tulis ulang bagian bermasalah",
      "Bandingkan versi awal dan revisi",
      "Ulangi latihan dengan topik baru",
    ],
  ],
  "clinical-english": [
    "Professional English",
    "English for Nurses: komunikasi klinis yang aman",
    "Bahasa klinis harus jelas, terstruktur, dan tidak ambigu.",
    [
      "Latih handover dengan kerangka konsisten",
      "Gunakan closed-loop communication",
      "Konfirmasi pemahaman pasien",
      "Pisahkan fakta, observasi, dan rekomendasi",
      "Dokumentasikan istilah secara konsisten",
    ],
  ],
};
function articlePage(slug) {
  const a = resourceArticles[slug];
  if (!a) return notFound();
  return (
    pageHero(a[0], a[1], a[2]) +
    `<section class="section"><article class="shell article-body"><p class="article-meta">Ditinjau oleh tim akademik IELTS_MATE · Pembaruan 9 September 2026 · Waktu baca 4 menit</p><h2>Langkah yang disarankan</h2><ol>${a[3].map((x) => `<li>${esc(x)}</li>`).join("")}</ol><h2>Gunakan data belajar Anda</h2><p>Catat baseline, jenis kesalahan, hasil latihan, dan perubahan setelah revisi. Fokus pada bukti progres, bukan jumlah jam semata.</p><div class="notice"><b>Batas penggunaan:</b> panduan ini bersifat edukatif dan bukan jaminan skor tes resmi atau pengganti nasihat profesional.</div><div class="article-actions"><a class="btn primary" href="/register">Buat rencana belajar</a><a class="btn" href="/resources">Kembali ke sumber belajar</a></div></article></section>`
  );
}
function about() {
  const p = getInstitution();
  return (
    pageHero(
      "Profil Lembaga",
      "Belajar terarah untuk peluang yang lebih luas",
      "Mengenal identitas, visi, misi, metode pembelajaran, dan kepemimpinan IELTS_MATE.",
    ) +
    `<section class="section institution-intro"><div class="shell profile-lead-grid"><div><p class="eyebrow">PROFIL LEMBAGA</p><h2>${esc(p.name)}</h2><p class="lead">${esc(p.profileStatement)}</p><div class="institution-facts"><div><small>Kedudukan</small><b>${esc(p.legalPosition)}</b></div><div><small>Lokasi</small><b>Lombok Barat, Nusa Tenggara Barat</b></div><div><small>Model layanan</small><b>Online, on-site, kelas, dan private</b></div></div></div><aside class="vision-card"><p class="eyebrow">VISI</p><h3>${esc(p.vision)}</h3></aside></div></section><section class="section soft"><div class="shell"><div class="section-head"><div><p class="eyebrow">ARAH LEMBAGA</p><h2>Misi dan nilai utama</h2></div><p>Setiap program dirancang agar peserta memahami target, proses, progres, dan batas layanan.</p></div><div class="profile-two"><ol class="mission-list">${p.mission.map((x, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span><p>${esc(x)}</p></li>`).join("")}</ol><div><h3>Nilai IELTS_MATE</h3><div class="value-grid">${p.values.map((x) => `<div><i>✓</i><b>${esc(x)}</b></div>`).join("")}</div><div class="notice profile-notice"><b>Posisi layanan:</b> ${esc(p.disclaimer)}</div></div></div></div></section><section class="section"><div class="shell"><div class="section-head"><div><p class="eyebrow">LEARNING JOURNEY</p><h2>Metode pendampingan terintegrasi</h2></div><p>Dari pemetaan kebutuhan sampai pengakuan penyelesaian program.</p></div><div class="journey-row">${p.learningModel.map((x, i) => `<div><span>${i + 1}</span><b>${esc(x)}</b></div>`).join("")}</div></div></section><section class="section director-section"><div class="shell founder-feature"><div class="founder-photo-wrap"><img src="/assets/images/director-sumawartini.webp" alt="${esc(p.founderName)}, Direktur IELTS_MATE" class="founder-photo"></div><div class="founder-copy"><p class="eyebrow">${esc(p.founderTitle).toUpperCase()}</p><h2>${esc(p.founderName)}</h2><p class="lead">Memimpin IELTS_MATE dalam menyediakan program persiapan bahasa Inggris yang terstruktur, relevan, transparan, dan berorientasi pada perkembangan peserta.</p><div class="founder-contact"><a href="https://wa.me/6287864053222" target="_blank" rel="noopener">WhatsApp · ${esc(p.phone)}</a><a href="mailto:${esc(p.email)}">${esc(p.email)}</a><span>${esc(p.address)}</span></div></div></div></section>`
  );
}
function formPage(kind) {
  const contact = kind === "contact";
  return (
    pageHero(
      contact ? "Kontak" : "Pendaftaran",
      contact ? "Mari diskusikan kebutuhanmu" : "Mulai perjalanan belajarmu",
      contact
        ? "Tim akademik akan merespons dalam satu hari kerja."
        : "Buat akun dan pilih target awal.",
    ) +
    `<section class="section"><div class="shell shell-form-wide">${contact ? `<div class="contact-profile"><img src="/assets/images/ielts-mate-logo.webp" alt="Logo IELTS_MATE"><div><p class="eyebrow">PROGRAM DIRECTOR</p><h2>Sumawartini, M.TESOL</h2><p>Perumahan Aghniya Harmony, Terong Tawah, Kec. Labuapi, Kab. Lombok Barat, Nusa Tenggara Barat 83361</p><div class="contact-links"><a href="https://wa.me/6287864053222" target="_blank" rel="noopener">WhatsApp · +62 878-6405-3222</a><a href="mailto:sumawartinitajalli@gmail.com">sumawartinitajalli@gmail.com</a></div></div></div>` : ""}<form class="panel form-grid" data-local-form="${kind}"><label>Nama lengkap<input name="name" required></label><label>Email<input type="email" name="email" required></label><label>WhatsApp<input name="phone" required></label><label>${contact ? "Topik" : "Program"}<select name="topic"><option>IELTS Preparation</option><option>TOEFL Preparation</option><option>English for Nurse</option><option>Private Class</option></select></label><label class="field full">Pesan<textarea name="message" required></textarea></label><label class="field full consent-field"><input type="checkbox" required><span>Saya menyetujui pemrosesan data sesuai Kebijakan Privasi.</span></label><button class="btn primary" type="submit">${contact ? "Kirim pesan" : "Buat pendaftaran"}</button></form></div></section>`
  );
}
function registerPage() {
  return (
    pageHero(
      "Pendaftaran",
      "Buat akun IELTS_MATE",
      "Akun digunakan untuk menyimpan progres, pembayaran, evaluasi, dan sertifikat.",
    ) +
    `<section class="section"><div class="shell shell-form-narrow"><form id="registerForm" class="panel form-grid"><label>Nama lengkap<input name="full_name" required maxlength="120" autocomplete="name"></label><label>Email<input type="email" name="email" required autocomplete="email"></label><label class="field full">Password<input type="password" name="password" required minlength="10" autocomplete="new-password"><small>Minimal 10 karakter. Gunakan kombinasi unik.</small></label><label class="field full consent-field"><input type="checkbox" required><span>Saya menyetujui Kebijakan Privasi dan Syarat Layanan.</span></label><button class="btn primary" type="submit">Buat akun</button><p id="registerStatus" class="form-help" role="status"></p></form></div></section>`
  );
}
const legalContent = {
  privacy: {
    title: "Kebijakan Privasi",
    intro:
      "Cara IELTS_MATE mengumpulkan, menggunakan, menyimpan, dan melindungi data pengguna.",
    sections: [
      [
        "Data yang kami proses",
        "Identitas akun, informasi kontak, enrollment, aktivitas belajar, jawaban tes, rekaman yang Anda unggah, feedback, transaksi, serta log keamanan. Kami menerapkan prinsip minimisasi data.",
      ],
      [
        "Tujuan pemrosesan",
        "Memberikan layanan belajar, mengelola akun dan pembayaran, menilai latihan, memberi dukungan, menjaga keamanan, memenuhi kewajiban hukum, dan meningkatkan layanan menggunakan data agregat.",
      ],
      [
        "Penyedia layanan",
        "Data dapat diproses oleh penyedia hosting, autentikasi, database, penyimpanan, pembayaran, email, analitik, dan dukungan sesuai fungsi yang diperlukan dan perjanjian yang berlaku.",
      ],
      [
        "Retensi dan keamanan",
        "Data disimpan selama akun atau kewajiban operasional masih berlaku, kemudian dihapus atau dianonimkan sesuai jadwal retensi. Akses dibatasi berdasarkan peran dan aktivitas penting dicatat.",
      ],
      [
        "Hak pengguna",
        "Pengguna dapat meminta akses, koreksi, salinan, pembatasan, atau penghapusan data, dengan mempertimbangkan kewajiban hukum dan integritas catatan transaksi.",
      ],
    ],
  },
  terms: {
    title: "Syarat Layanan",
    intro:
      "Ketentuan penggunaan platform, program, latihan, pembayaran, dan akun IELTS_MATE.",
    sections: [
      [
        "Akun dan akses",
        "Pengguna wajib memberikan informasi yang benar, menjaga kerahasiaan kredensial, dan tidak membagikan akun. Hak akses program mengikuti enrollment dan status pembayaran.",
      ],
      [
        "Layanan pendidikan",
        "Jadwal, materi, mentor, dan metode dapat disesuaikan untuk menjaga mutu. Hasil belajar bergantung pada partisipasi, latihan, kemampuan awal, dan faktor individual.",
      ],
      [
        "Tes dan skor",
        "Seluruh diagnostic, practice test, feedback, dan prediksi merupakan alat pembelajaran internal. Hasilnya bukan skor atau sertifikat IELTS/TOEFL resmi.",
      ],
      [
        "Pembayaran",
        "Harga, periode akses, fasilitas, pajak, dan metode pembayaran ditampilkan sebelum checkout. Akses diaktifkan setelah pembayaran terverifikasi atau aktivasi administratif.",
      ],
      [
        "Penggunaan wajar",
        "Dilarang menyalin, menjual kembali, mengganggu sistem, mengakses akun lain, mengunggah materi melanggar hukum, atau menyalahgunakan konten dan assessment.",
      ],
    ],
  },
  refund: {
    title: "Kebijakan Pembatalan & Refund",
    intro:
      "Ketentuan transparan untuk pembatalan program dan pengembalian pembayaran.",
    sections: [
      [
        "Sebelum kelas dimulai",
        "Permohonan diajukan tertulis dengan nomor pesanan. Biaya gateway atau administrasi yang telah terjadi dapat dikurangi jika dijelaskan saat checkout.",
      ],
      [
        "Setelah layanan digunakan",
        "Besaran refund mempertimbangkan sesi yang telah berjalan, materi yang telah diakses, layanan review yang telah digunakan, dan komponen non-refundable yang diinformasikan sebelumnya.",
      ],
      [
        "Perubahan oleh penyelenggara",
        "Jika program dibatalkan oleh IELTS_MATE, peserta ditawarkan jadwal pengganti, kredit layanan, atau refund untuk layanan yang belum diberikan.",
      ],
      [
        "Proses permohonan",
        "Hubungi dukungan dengan email akun, nomor pesanan, program, dan alasan. Keputusan dan estimasi waktu penyelesaian disampaikan secara tertulis.",
      ],
    ],
  },
  cookies: {
    title: "Kebijakan Cookie",
    intro: "Penggunaan penyimpanan browser dan teknologi serupa pada platform.",
    sections: [
      [
        "Penyimpanan esensial",
        "Digunakan untuk sesi, keamanan, preferensi, progres lokal sementara, dan fungsi inti. Komponen ini diperlukan agar layanan bekerja.",
      ],
      [
        "Analitik opsional",
        "Analitik non-esensial hanya boleh diaktifkan setelah persetujuan dan harus dapat ditolak. Versi ini tidak memuat skrip iklan pihak ketiga secara bawaan.",
      ],
      [
        "Mengubah pilihan",
        "Pengguna dapat menghapus data situs melalui pengaturan browser atau memperbarui preferensi ketika pusat preferensi tersedia.",
      ],
    ],
  },
};
function legal(type) {
  const x = legalContent[type] || legalContent.terms;
  return (
    pageHero("Legal", x.title, x.intro) +
    `<section class="section"><article class="shell legal legal-pro"><div class="legal-meta"><span>Berlaku: 9 September 2026</span><span>Versi 1.0</span><span>Kontak: sumawartinitajalli@gmail.com</span></div>${x.sections.map((s) => `<section><h2>${s[0]}</h2><p>${s[1]}</p></section>`).join("")}<section><h2>Kontak dan keluhan</h2><p>Kirim pertanyaan atau permintaan melalui halaman <a href="/contact">Kontak</a>. Identitas pemohon dapat diverifikasi untuk melindungi data akun.</p></section><div class="notice"><b>Tinjauan hukum:</b> dokumen operasional ini harus diselaraskan dengan badan usaha, alur pembayaran, kebijakan retensi, dan hukum yang berlaku sebelum peluncuran publik.</div></article></section>`
  );
}
function loginPage() {
  return (
    pageHero(
      "Portal Aman",
      "Masuk ke workspace Anda",
      "Akses program, jadwal, tugas, hasil, feedback, pembayaran, dan sertifikat dalam satu akun.",
    ) +
    `<section class="section"><div class="shell auth-layout"><form id="pageLoginForm" class="panel auth-card"><h2>Masuk</h2><label>Email<input name="email" type="email" required autocomplete="email" placeholder="nama@email.com"></label><label>Password<input name="password" type="password" required minlength="8" autocomplete="current-password"></label><div class="auth-row"><label class="check-row"><input type="checkbox" name="remember"> <span>Ingat email</span></label><a href="/forgot-password">Lupa password?</a></div><button class="btn primary wide">Masuk dengan aman</button><p class="form-help" role="status"></p><p>Belum punya akun? <a href="/register">Daftar di sini</a>.</p></form><aside class="auth-aside"><span class="tag">KEAMANAN AKUN</span><h2>Peran tidak dipilih saat login.</h2><p>Hak akses ditetapkan oleh administrator dan diverifikasi kembali oleh API. Administrator disarankan menggunakan MFA dari penyedia autentikasi.</p><a href="/trust">Lihat pusat kepercayaan →</a></aside></div></section>`
  );
}
function forgotPage() {
  return (
    pageHero(
      "Pemulihan Akun",
      "Atur ulang password",
      "Masukkan email akun. Demi keamanan, respons tidak akan mengungkap apakah email terdaftar.",
    ) +
    `<section class="section"><div class="shell auth-narrow"><form id="forgotForm" class="panel auth-card"><label>Email akun<input name="email" type="email" required autocomplete="email"></label><button class="btn primary wide">Kirim tautan pemulihan</button><p class="form-help" role="status"></p><a href="/login">← Kembali ke login</a></form></div></section>`
  );
}
function trustPage() {
  return (
    pageHero(
      "Pusat Kepercayaan",
      "Mutu akademik, keamanan, dan transparansi",
      "Ringkasan prinsip yang digunakan sebelum layanan dijalankan secara komersial.",
    ) +
    `<section class="section"><div class="shell trust-center"><div class="trust-cards"><article><span>01</span><h2>Assessment integrity</h2><p>Answer key tetap di server. Writing dan Speaking dapat melalui review manusia dan moderasi.</p></article><article><span>02</span><h2>Role-based access</h2><p>Siswa, instructor, examiner, dan admin memperoleh akses sesuai tanggung jawabnya.</p></article><article><span>03</span><h2>Data protection</h2><p>Data minimum, koneksi HTTPS, security headers, private storage, RLS, dan audit log.</p></article><article><span>04</span><h2>Commercial transparency</h2><p>Harga, periode, fasilitas, refund, dan batas klaim ditampilkan sebelum transaksi.</p></article></div><div class="panel"><h2>Penggunaan istilah IELTS Preparation dan TOEFL Preparation</h2><p>Istilah IELTS Preparation dan TOEFL Preparation hanya menjelaskan tujuan pembelajaran. IELTS dan TOEFL adalah merek pemiliknya masing-masing; IELTS_MATE independen, tidak berafiliasi, tidak disponsori, tidak disahkan, dan bukan penyelenggara tes resmi.</p><h2>Pelaporan masalah</h2><p>Laporkan kerentanan, masalah privasi, sengketa pembayaran, atau masalah akademik melalui <a href="/contact">kanal dukungan</a>. Jangan mengirim password atau secret melalui formulir.</p></div></div></section>`
  );
}
function accessibilityPage() {
  return (
    pageHero(
      "Aksesibilitas",
      "Belajar harus dapat diakses lebih banyak orang",
      "Platform menargetkan WCAG 2.2 Level AA dan perbaikan berkelanjutan.",
    ) +
    `<section class="section"><article class="shell legal"><h2>Dukungan yang tersedia</h2><ul><li>Navigasi keyboard dan focus state yang terlihat.</li><li>Struktur heading, label form, status message, dan skip link.</li><li>Target sentuh minimal 44 piksel dan layout responsif.</li><li>Reduced motion serta kontras warna yang ditinjau.</li><li>Transkrip diperlukan untuk materi audio produksi.</li></ul><h2>Meminta bantuan</h2><p>Jika Anda menemui hambatan, hubungi tim melalui halaman <a href="/contact">Kontak</a> dan sertakan perangkat, browser, halaman, serta kebutuhan akses Anda.</p></article></section>`
  );
}
function supportPage() {
  return (
    pageHero(
      "Dukungan",
      "Kami siap membantu",
      "Gunakan kanal resmi untuk akun, program, pembayaran, feedback, atau kendala teknis.",
    ) +
    `<section class="section"><div class="shell support-grid"><div class="panel"><h2>Hubungi tim</h2><p><b>WhatsApp</b><br><a href="https://wa.me/6287864053222" target="_blank" rel="noopener">+62 878-6405-3222</a></p><p><b>Email</b><br><a href="mailto:sumawartinitajalli@gmail.com">sumawartinitajalli@gmail.com</a></p><p>Jam respons dan SLA perlu ditetapkan sebelum peluncuran komersial.</p></div><div><h2>Pertanyaan umum</h2><details><summary>Apakah hasil tes merupakan skor resmi?</summary><p>Tidak. Hasil adalah diagnostic atau practice internal untuk mendukung pembelajaran.</p></details><details><summary>Kapan akses program aktif?</summary><p>Setelah pembayaran terverifikasi atau enrollment diaktifkan administrator.</p></details><details><summary>Bagaimana meminta refund?</summary><p>Ikuti <a href="/refund">kebijakan refund</a> dan sertakan nomor pesanan.</p></details><details><summary>Bagaimana melindungi akun?</summary><p>Gunakan password unik, jangan membagikan kode pemulihan, dan keluar dari perangkat bersama.</p></details></div></div></section>`
  );
}
function notFound() {
  return (
    pageHero(
      "404",
      "Halaman tidak ditemukan",
      "Tautan mungkin berubah atau halaman belum tersedia.",
    ) +
    `<section class="section"><div class="shell empty-state"><a class="btn primary" href="/home">Kembali ke beranda</a></div></section>`
  );
}

const testBanks = {
  "ielts-mini": {
    label: "IELTS-style Mini Preparation",
    minutes: 20,
    audio:
      "Good morning. This is a reminder for visitors joining the coastal research tour on Saturday. Please arrive at the south gate by eight fifteen, fifteen minutes before departure. Bring a reusable water bottle and a light rain jacket. Lunch is included, but participants should inform the office about dietary requirements by Thursday evening. The tour returns at approximately four thirty.",
    items: [
      {
        type: "text",
        skill: "Listening",
        prompt: "Type the meeting point (maximum two words).",
        answer: "south gate",
      },
      {
        type: "choice",
        skill: "Listening",
        prompt: "When should dietary requirements be reported?",
        options: ["Saturday morning", "By Thursday evening", "At 4:30"],
        answer: "By Thursday evening",
      },
      {
        type: "passage",
        skill: "Reading",
        passage:
          "Urban pocket parks are small green spaces inserted into densely built neighbourhoods. Although they cannot replace large parks, studies suggest they offer brief restoration, shade, and opportunities for informal social contact. Their success depends less on size than on access, seating, and maintenance.",
        prompt: "What is the writer’s main claim?",
        options: [
          "Large parks should be divided.",
          "Well-designed small parks can provide meaningful benefits.",
          "Maintenance is unnecessary in small parks.",
        ],
        answer: "Well-designed small parks can provide meaningful benefits.",
      },
      {
        type: "choice",
        skill: "Reading",
        prompt:
          "The passage states that pocket parks cost less to maintain than large parks.",
        options: ["TRUE", "FALSE", "NOT GIVEN"],
        answer: "NOT GIVEN",
      },
      {
        type: "text",
        skill: "Reading",
        prompt:
          "Complete: The value of pocket parks is influenced by seating, maintenance, and ____.",
        answer: "access",
      },
      {
        type: "writing",
        skill: "Writing Task 1",
        prompt:
          "Cycling commuters in City A rose from 12% in 2015 to 28% in 2025, while City B increased from 18% to 22%. Summarise the main features and comparisons. Write at least 150 words.",
        min: 150,
      },
      {
        type: "writing",
        skill: "Writing Task 2",
        prompt:
          "Some people believe universities should prioritise job-specific skills, while others value broad academic knowledge. Discuss both views and give your opinion. Write at least 250 words.",
        min: 250,
      },
      {
        type: "speaking",
        skill: "Speaking Part 1",
        prompt: "What kind of place do you prefer for studying, and why?",
      },
      {
        type: "speaking",
        skill: "Speaking Part 2",
        prompt:
          "Describe a useful skill you learned from another person. Explain who taught you, how you learned it, and why it is useful.",
      },
      {
        type: "speaking",
        skill: "Speaking Part 3",
        prompt:
          "How might technology change the way practical skills are taught in the future?",
      },
    ],
  },
  "toefl-mini": {
    label: "TOEFL iBT 2026-style Mini Preparation",
    minutes: 15,
    audio:
      "Today we will consider why some desert plants open their stomata at night. Stomata are tiny pores used for gas exchange. Opening them during the day can cause severe water loss. By opening them at night, these plants collect carbon dioxide when temperatures are lower, then use the stored carbon dioxide for photosynthesis during daylight. This adaptation is efficient in dry climates, although it also limits how quickly the plant can grow.",
    items: [
      {
        type: "choice",
        skill: "Listening",
        prompt: "Could you send me the revised schedule this afternoon?",
        options: [
          "The afternoon was revised.",
          "Sure, I’ll email it before three.",
          "Schedules are usually printed.",
        ],
        answer: "Sure, I’ll email it before three.",
      },
      {
        type: "choice",
        skill: "Listening",
        prompt: "Why do certain desert plants open their stomata at night?",
        options: [
          "To grow more quickly",
          "To reduce water loss",
          "To avoid carbon dioxide",
        ],
        answer: "To reduce water loss",
      },
      {
        type: "choice",
        skill: "Listening",
        prompt: "What trade-off does the professor mention?",
        options: [
          "The plants need wetter soil.",
          "Photosynthesis stops completely.",
          "Growth rate may be limited.",
        ],
        answer: "Growth rate may be limited.",
      },
      {
        type: "text",
        skill: "Reading",
        prompt:
          "Complete the word: Community gardens can improve neighbourhood resi____.",
        answer: "resilience",
      },
      {
        type: "passage",
        skill: "Reading",
        passage:
          "Library notice: The second floor will close at 6 p.m. on Tuesday for electrical maintenance. Reserved books may be collected from the ground-floor desk until 9 p.m.",
        prompt: "What can visitors still do after 6 p.m.?",
        options: [
          "Study on the second floor",
          "Collect reserved books downstairs",
          "Request electrical repairs",
        ],
        answer: "Collect reserved books downstairs",
      },
      {
        type: "passage",
        skill: "Reading",
        passage:
          "When a new tool is introduced, productivity may initially decline while workers learn it. The eventual benefit depends on training quality and whether workflows are redesigned rather than transferred unchanged.",
        prompt: "Which statement is supported?",
        options: [
          "Training and workflow redesign shape long-term gains.",
          "New tools always increase productivity immediately.",
          "Existing workflows should never change.",
        ],
        answer: "Training and workflow redesign shape long-term gains.",
      },
      {
        type: "text",
        skill: "Writing — Build a Sentence",
        prompt:
          "Arrange: because / postponed / was / the speaker / the seminar / was ill",
        answer: "The seminar was postponed because the speaker was ill",
      },
      {
        type: "writing",
        skill: "Writing — Email",
        prompt:
          "Write a concise email requesting a two-day course extension. Explain the reason, acknowledge the original deadline, and propose a new submission time.",
        min: 80,
      },
      {
        type: "writing",
        skill: "Writing — Academic Discussion",
        prompt:
          "Should cities make public transport free? State and support your position while responding to one counterargument.",
        min: 100,
      },
      {
        type: "speaking",
        skill: "Speaking — Interview",
        prompt:
          "Describe one change that would improve learning in your community and explain the expected benefit.",
      },
    ],
  },
};
function alumni() {
  return (
    pageHero(
      "Alumni & Testimoni",
      "Cerita belajar dari komunitas IELTS_MATE",
      "Ruang untuk pengalaman alumni yang telah memperoleh izin dan melalui verifikasi sebelum dipublikasikan.",
    ) +
    `<section class="section"><div class="shell"><div class="section-head"><div><p class="eyebrow">CERITA ALUMNI</p><h2>Testimoni yang jujur dan dapat dipertanggungjawabkan</h2></div><p>Kami tidak membuat kutipan atau hasil belajar tanpa persetujuan alumni.</p></div><div class="cards"><article class="card"><span class="tag">TERVERIFIKASI</span><h3>Cerita alumni sedang dikumpulkan</h3><p>Testimoni pertama akan muncul setelah identitas, program, izin publikasi, dan isi pengalaman selesai ditinjau.</p></article><article class="card"><span class="tag">PRIVASI</span><h3>Alumni menentukan informasi yang tampil</h3><p>Nama dapat disingkat dan foto hanya digunakan jika alumni memberikan persetujuan khusus.</p></article><article class="card"><span class="tag">TRANSPARAN</span><h3>Tidak menjanjikan skor tertentu</h3><p>Pengalaman setiap peserta berbeda. Testimoni tidak digunakan sebagai jaminan hasil ujian atau penerimaan studi.</p></article></div><div class="notice notice-spaced"><b>Catatan:</b> halaman ini sengaja tidak memuat testimoni contoh agar tidak menampilkan klaim alumni yang belum terverifikasi.</div></div></section><section class="section soft"><div class="shell shell-form-wide"><div class="section-head"><div><p class="eyebrow">BAGIKAN PENGALAMAN</p><h2>Sudah pernah belajar bersama IELTS_MATE?</h2></div><p>Kirim pengalaman Anda. Tim akan menghubungi Anda sebelum publikasi.</p></div><form class="panel form-grid" data-local-form="contact"><input type="hidden" name="topic" value="Testimoni alumni"><label>Nama lengkap<input name="name" required autocomplete="name"></label><label>Email<input name="email" type="email" required autocomplete="email"></label><label>WhatsApp<input name="phone" required autocomplete="tel"></label><label>Program yang diikuti<input name="program" required></label><label class="field full">Ceritakan pengalaman Anda<textarea name="message" required minlength="30"></textarea></label><label class="field full consent-field"><input type="checkbox" required><span>Saya setuju dihubungi untuk verifikasi. Pengiriman formulir belum berarti testimoni otomatis dipublikasikan.</span></label><button class="btn primary" type="submit">Kirim untuk ditinjau</button></form></div></section>`
  );
}
function prepTestPage(id) {
  const bank = testBanks[id];
  const saved = JSON.parse(localStorage.getItem("im-prep-" + id) || "{}");
  const items = bank.items
    .map((x, i) => {
      const name = `q${i}`;
      let control = "";
      if (x.options)
        control = `<div class="options">${x.options.map((o) => `<label><input type="radio" name="${name}" value="${esc(o)}" ${saved[name] === o ? "checked" : ""}> ${esc(o)}</label>`).join("")}</div>`;
      else if (x.type === "writing")
        control = `<textarea name="${name}" data-min="${x.min}" placeholder="Tulis jawaban Anda...">${esc(saved[name] || "")}</textarea><small class="word-count">0 kata · minimum ${x.min}</small>`;
      else if (x.type === "speaking")
        control = `<button class="btn record-answer" type="button">● Rekam jawaban</button><span class="record-state">Belum merekam</span>`;
      else
        control = `<input name="${name}" value="${esc(saved[name] || "")}" placeholder="Type your answer">`;
      return `<article class="test-question" data-index="${i}" ${x.answer ? `data-answer="${esc(x.answer)}"` : ""}><div class="question-top"><span class="tag">${esc(x.skill)}</span><b>${i + 1}/${bank.items.length}</b></div>${x.passage ? `<div class="reading-passage">${esc(x.passage)}</div>` : ""}<h3>${esc(x.prompt)}</h3>${control}<div class="answer-feedback" aria-live="polite"></div></article>`;
    })
    .join("");
  return (
    pageHero(
      "Preparation Lab",
      bank.label,
      `${bank.minutes} menit · autosave lokal · materi latihan orisinal`,
    ) +
    `<section class="section test-lab"><div class="shell"><div class="test-toolbar"><div><b>${esc(bank.label)}</b><small>Skor objektif bersifat diagnostik, bukan skor resmi.</small></div><div class="test-time" data-seconds="${bank.minutes * 60}">${String(bank.minutes).padStart(2, "0")}:00</div></div><progress class="lab-progress" max="100" value="0" aria-label="Progres pengerjaan"></progress><section class="listening-player"><div><p class="eyebrow">AUDIO SIMULASI</p><h2>Dengarkan materi sebelum menjawab</h2></div><div class="speech-controls"><button class="btn secondary play-bank" type="button">▶ Putar audio</button><button class="btn ghost-on-dark stop-bank" type="button">■ Hentikan</button><span class="audio-status">Siap diputar</span></div></section><form id="prepForm" data-test-id="${id}" data-audio="${esc(bank.audio)}">${items}<div class="submit-bar"><button class="btn primary" type="submit">Periksa jawaban objektif</button><button class="btn" type="button" data-clear-test>Hapus jawaban</button></div></form><div id="testResult" class="test-result" hidden></div><p class="notice">Materi IELTS Preparation dan TOEFL Preparation ini independen; tidak berafiliasi, disponsori, atau disahkan oleh pemilik ujian.</p></div></section>`
  );
}
function setupPrepTest() {
  const form = qs("#prepForm");
  if (!form) return;
  const id = form.dataset.testId,
    key = "im-prep-" + id;
  let saved = JSON.parse(localStorage.getItem(key) || "{}");
  const fields = qsa("input,textarea", form),
    bar = qs(".lab-progress");
  const update = () => {
    fields.forEach((f) => {
      if (f.type === "radio") {
        if (f.checked) saved[f.name] = f.value;
      } else saved[f.name] = f.value;
    });
    localStorage.setItem(key, JSON.stringify(saved));
    const answered = new Set(
      fields
        .filter((f) => (f.type === "radio" ? f.checked : f.value.trim()))
        .map((f) => f.name),
    ).size;
    bar.value = Math.round((answered / testBanks[id].items.length) * 100);
    qsa("textarea", form).forEach((t) => {
      const n = t.value.trim() ? t.value.trim().split(/\s+/).length : 0;
      t.nextElementSibling.textContent = `${n} kata · minimum ${t.dataset.min}`;
    });
  };
  fields.forEach((f) => f.addEventListener("input", update));
  update();
  const status = qs(".audio-status");
  qs(".play-bank").onclick = () => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(form.dataset.audio);
    u.lang = "en-US";
    u.rate = 0.9;
    u.onstart = () => (status.textContent = "Sedang diputar…");
    u.onend = () => (status.textContent = "Selesai");
    speechSynthesis.speak(u);
  };
  qs(".stop-bank").onclick = () => {
    speechSynthesis.cancel();
    status.textContent = "Dihentikan";
  };
  let left = +(
    sessionStorage.getItem("im-time-" + id) || qs(".test-time").dataset.seconds
  );
  const clock = qs(".test-time");
  const timer = setInterval(() => {
    if (!document.body.contains(clock) || left <= 0)
      return clearInterval(timer);
    left--;
    sessionStorage.setItem("im-time-" + id, left);
    clock.textContent = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  }, 1000);
  form.onsubmit = (e) => {
    e.preventDefault();
    let correct = 0,
      total = 0;
    qsa(".test-question[data-answer]", form).forEach((q) => {
      total++;
      const input = qs("input:checked,input:not([type=radio])", q);
      const got = (input?.value || "")
        .trim()
        .toLowerCase()
        .replace(/[.!?]$/, "");
      const ans = q.dataset.answer
        .trim()
        .toLowerCase()
        .replace(/[.!?]$/, "");
      const ok = got === ans;
      correct += ok ? 1 : 0;
      const f = qs(".answer-feedback", q);
      f.className = "answer-feedback " + (ok ? "correct" : "incorrect");
      f.textContent = ok
        ? "Benar."
        : "Belum tepat. Jawaban model: " + q.dataset.answer;
    });
    const pct = Math.round((correct / total) * 100);
    const attempts = getAttempts();
    attempts.unshift({
      id: crypto.randomUUID(),
      testId: id,
      label: testBanks[id].label,
      score: pct,
      date: new Date().toISOString(),
    });
    localStorage.setItem("im-attempts", JSON.stringify(attempts.slice(0, 50)));
    if (session?.authenticated)
      apiCall("attempts", {
        method: "POST",
        body: JSON.stringify({
          testSlug: id,
          label: testBanks[id].label,
          objectiveScore: pct,
        }),
      }).catch((e) =>
        notify("Hasil tersimpan lokal; sinkronisasi server gagal."),
      );
    const r = qs("#testResult");
    r.hidden = false;
    r.innerHTML = `<strong>${pct}%</strong><div><h2>Hasil diagnostik objektif</h2><p>${correct} dari ${total} item benar. Evaluasi Writing dan Speaking menggunakan rubrik atau examiner.</p></div>`;
    r.scrollIntoView({ behavior: "smooth" });
  };
  qs("[data-clear-test]").onclick = () => {
    localStorage.removeItem(key);
    location.reload();
  };
  setupRecording();
}
function setupRecording() {
  let rec,
    chunks = [];
  qsa(".record-answer").forEach(
    (btn) =>
      (btn.onclick = async () => {
        const state = btn.nextElementSibling;
        if (rec?.state === "recording") {
          rec.stop();
          btn.textContent = "● Rekam jawaban";
          return;
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          chunks = [];
          rec = new MediaRecorder(stream);
          rec.ondataavailable = (e) => chunks.push(e.data);
          rec.onstop = () => {
            const url = URL.createObjectURL(
              new Blob(chunks, { type: "audio/webm" }),
            );
            state.innerHTML = `<a download="speaking-answer.webm" href="${url}">Unduh rekaman</a>`;
            stream.getTracks().forEach((t) => t.stop());
          };
          rec.start();
          btn.textContent = "■ Stop";
          state.textContent = "Merekam…";
        } catch {
          state.textContent = "Mikrofon tidak tersedia atau izin ditolak.";
        }
      }),
  );
}

function legacyTestPage(id) {
  const t = data.tests.find((x) => x.id === id) || data.tests[0];
  const listening = id !== "placement";
  const media = listening
    ? `<section class="listening-player" aria-labelledby="audioTitle"><div><p class="eyebrow">LISTENING SECTION</p><h2 id="audioTitle">Dengarkan rekaman sebelum menjawab</h2><p>Rekaman latihan dapat diputar kembali. Pada tes produksi, jumlah pemutaran dapat dibatasi oleh pengelola.</p></div><div class="speech-controls"><button id="playListening" class="btn secondary" type="button">▶ Putar rekaman</button><button id="stopListening" class="btn ghost-on-dark" type="button">■ Hentikan</button><span id="audioStatus" role="status" aria-live="polite">Siap diputar</span></div><div class="audio-note" role="note">Gunakan headphone. Pastikan volume perangkat telah diuji sebelum memulai.</div></section>`
    : "";
  const question = listening
    ? "According to the recording, what time does the library open from Monday to Friday?"
    : "Choose the grammatically correct sentence.";
  const options = listening
    ? [
        ["a", "Eight o’clock"],
        ["b", "Nine o’clock"],
        ["c", "Ten o’clock"],
      ]
    : [
        ["a", "She have completed the course."],
        ["b", "She has completed the course."],
        ["c", "She completing the course."],
      ];
  return (
    pageHero(
      "Test Engine",
      t.title,
      `${t.minutes} menit · autosave aktif · hasil tersimpan di dashboard`,
    ) +
    `<section class="section"><div class="shell quiz">${media}<div class="panel"><div class="card-meta"><b>Soal 1 dari 3</b><span class="status">${listening ? "Audio aktif" : "Latihan interaktif"}</span></div><p class="question">${question}</p><form id="quizForm" class="options">${options.map((o) => `<label><input type="radio" name="q" value="${o[0]}"> ${o[1]}</label>`).join("")}<button class="btn primary" type="submit">Simpan & lanjut</button></form><details class="transcript"><summary>Transkrip latihan — buka setelah menjawab</summary><p>Good morning. The library opens at nine o’clock from Monday to Friday. On Saturday, it opens at ten o’clock. Students must bring their identification card.</p></details></div><p class="notice">Audio ini hanya materi latihan. Ganti dengan rekaman berlisensi melalui bank soal sebelum penggunaan produksi.</p></div></section>`
  );
}
function testPage(id) {
  return testBanks[id] ? prepTestPage(id) : legacyTestPage(id);
}
function setupListening() {
  const play = qs("#playListening"),
    stop = qs("#stopListening"),
    status = qs("#audioStatus");
  if (!play) return;
  const text =
    "Good morning. The library opens at nine o’clock from Monday to Friday. On Saturday, it opens at ten o’clock. Students must bring their identification card.";
  play.onclick = () => {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.82;
    utterance.pitch = 1;
    utterance.onstart = () => (status.textContent = "Sedang diputar…");
    utterance.onend = () => (status.textContent = "Selesai diputar");
    utterance.onerror = () =>
      (status.textContent = "Suara gagal diputar. Periksa volume dan browser.");
    speechSynthesis.speak(utterance);
  };
  stop.onclick = () => {
    speechSynthesis.cancel();
    status.textContent = "Dihentikan";
  };
}
function dashboard() {
  if (!session?.authenticated) {
    setTimeout(() => qs("#loginDialog").showModal(), 0);
    return pageHero(
      "Portal",
      "Masuk diperlukan",
      "Gunakan akun terverifikasi untuk mengakses dashboard.",
    );
  }
  return `<section class="section"><div class="shell"><div class="panel live-loading"><span class="loader"></span><p>Memuat dashboard produksi…</p></div></div></section>`;
}
function getAttempts() {
  return JSON.parse(localStorage.getItem("im-attempts") || "[]");
}

function getCertificates() {
  return JSON.parse(localStorage.getItem("im-certificates") || "[]");
}
async function syncCertificates() {
  if (!session?.authenticated) return;
  try {
    const rows = await apiCall("certificates");
    const list = rows.map((x) => ({
      number: x.certificate_no,
      name: x.participant_name,
      type: x.certificate_type,
      program: x.program_title,
      hours: x.completion_hours,
      criteria: x.criteria,
      issuedAt: x.issued_at,
      revokedAt: x.revoked_at,
    }));
    localStorage.setItem("im-certificates", JSON.stringify(list));
  } catch (e) {
    console.warn("Certificate sync:", e.message);
  }
}
function certificateStatus(c) {
  return c.revokedAt ? "Dicabut" : "Valid";
}
function findCertificate(code) {
  const publicCert = JSON.parse(
    sessionStorage.getItem("im-verified-certificate") || "null",
  );
  return (
    getCertificates().find(
      (c) =>
        c.number.toLowerCase() === decodeURIComponent(code || "").toLowerCase(),
    ) ||
    (publicCert?.number.toLowerCase() ===
    decodeURIComponent(code || "").toLowerCase()
      ? publicCert
      : null)
  );
}
function verificationPage(code) {
  const c = findCertificate(code);
  return (
    pageHero(
      "Verifikasi",
      "Verifikasi Sertifikat Pengakuan",
      "Masukkan atau periksa nomor sertifikat IELTS_MATE.",
    ) +
    `<section class="section"><div class="shell verify-shell"><form class="verify-search" data-verify-form><label>Nomor sertifikat<input name="code" value="${esc(decodeURIComponent(code || ""))}" placeholder="IM-COC-2026-XXXX" required></label><button class="btn primary">Periksa</button></form>${code ? (c ? `<article class="verification-result ${c.revokedAt ? "revoked" : ""}"><div class="verify-icon">${c.revokedAt ? "!" : "✓"}</div><div><span class="status ${c.revokedAt ? "draft" : "live"}">${certificateStatus(c)}</span><h2>${esc(c.type)}</h2><p>Sertifikat diterbitkan kepada <b>${esc(c.name)}</b> untuk program <b>${esc(c.program)}</b>.</p><dl><div><dt>Nomor</dt><dd>${esc(c.number)}</dd></div><div><dt>Tanggal terbit</dt><dd>${new Date(c.issuedAt).toLocaleDateString("id-ID")}</dd></div><div><dt>Durasi</dt><dd>${esc(c.hours)} jam</dd></div></dl><p class="verify-disclaimer">Bukti keikutsertaan/penyelesaian program independen. Bukan sertifikat atau skor IELTS/TOEFL resmi.</p></div></article>` : `<div id="remoteVerification" class="verification-result"><div class="verify-icon">…</div><div><span class="status">Memeriksa</span><h2>Memvalidasi nomor sertifikat</h2><p>Mohon tunggu.</p></div></div>`) : ""}</div></section>`
  );
}
function certificateDocument(code) {
  const c = findCertificate(code);
  if (!c) return verificationPage(code);
  return `<section class="certificate-page"><div class="certificate-paper"><div class="cert-brand"><img src="/assets/images/ielts-mate-logo.webp" alt="IELTS_MATE"><b>IELTS_MATE</b></div><p class="cert-kicker">${esc(c.type).toUpperCase()}</p><h1>${c.type === "Certificate of Participation" ? "Certificate of Participation" : "Certificate of Completion"}</h1><p class="cert-presented">This certificate is presented to</p><h2>${esc(c.name)}</h2><p class="cert-copy">for ${c.type === "Certificate of Participation" ? "participating in" : "completing"} the independent preparation program</p><h3>${esc(c.program)}</h3><p class="cert-meta">${esc(c.hours)} learning hours · Issued ${new Date(c.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p><div class="cert-footer"><div class="cert-signature"><img src="/assets/images/director-signature.png" alt="Tanda tangan Sumawartini, M.TESOL"><span class="signature-line"></span><b>Sumawartini, M.TESOL</b><small>Founder & Program Director · IELTS_MATE</small></div><div class="cert-verification"><img class="certificate-barcode" src="/assets/images/certificate-verification-qr.svg" alt="Barcode QR untuk membuka halaman verifikasi sertifikat"><div class="cert-number"><b>${esc(c.number)}</b><small>Scan barcode atau verifikasi di ${location.origin}/verify/${encodeURIComponent(c.number)}</small></div></div></div><p class="cert-disclaimer">This certificate confirms participation or completion of an independent English preparation program. It is not an official IELTS or TOEFL certificate and does not represent an official language proficiency score.</p></div><div class="certificate-toolbar"><button class="btn primary" type="button" data-print-certificate>Cetak / Simpan PDF</button><a class="btn" href="/verify/${encodeURIComponent(c.number)}">Verifikasi</a><a class="btn" href="/dashboard">Kembali</a></div></section>`;
}
function institutionProfilePanel() {
  const p = getInstitution();
  return `<div class="panel-title page-title"><div><p class="eyebrow">INSTITUTION CMS</p><h2>Profil Lembaga</h2><p>Kelola narasi yang tampil pada halaman publik. Perubahan produksi memerlukan akun admin.</p></div><a class="btn" href="/about">Lihat publik</a></div><form id="institutionProfileForm" class="panel institution-form"><label>Nama lembaga<input name="name" value="${esc(p.name)}" required maxlength="120"></label><label>Kedudukan<input name="legalPosition" value="${esc(p.legalPosition)}" required maxlength="180"></label><label class="field full">Narasi profil<textarea name="profileStatement" required maxlength="2000">${esc(p.profileStatement)}</textarea></label><label class="field full">Visi<textarea name="vision" required maxlength="1000">${esc(p.vision)}</textarea></label><label class="field full">Misi — satu poin per baris<textarea name="mission" required>${esc(p.mission.join("\n"))}</textarea></label><label class="field full">Nilai — pisahkan dengan koma<input name="values" value="${esc(p.values.join(", "))}" required></label><label class="field full">Tahap pembelajaran — pisahkan dengan koma<input name="learningModel" value="${esc(p.learningModel.join(", "))}" required></label><label>Nama pimpinan<input name="founderName" value="${esc(p.founderName)}" required></label><label>Jabatan<input name="founderTitle" value="${esc(p.founderTitle)}" required></label><label class="field full">Alamat<textarea name="address" required>${esc(p.address)}</textarea></label><label>WhatsApp<input name="phone" value="${esc(p.phone)}" required></label><label>Email<input name="email" type="email" value="${esc(p.email)}" required></label><label class="field full">Disclaimer<textarea name="disclaimer" required>${esc(p.disclaimer)}</textarea></label><button class="btn primary" type="submit">Simpan dan publikasikan</button><span class="form-help">Versi lokal disimpan otomatis; versi deploy disinkronkan ke Supabase.</span></form>`;
}

const routes = {
  home,
  programs,
  tests,
  pricing,
  resources,
  article: articlePage,
  about,
  alumni,
  method: alumni,
  verify: verificationPage,
  certificate: certificateDocument,
  contact: () => formPage("contact"),
  register: registerPage,
  login: loginPage,
  "forgot-password": forgotPage,
  privacy: () => legal("privacy"),
  terms: () => legal("terms"),
  refund: () => legal("refund"),
  cookies: () => legal("cookies"),
  trust: trustPage,
  accessibility: accessibilityPage,
  support: supportPage,
  dashboard,
  admin: dashboard,
};
const seoPages = {
  home: [
    "IELTS & TOEFL Preparation Terintegrasi | IELTS_MATE",
    "Diagnosis, kelas mentor, latihan, feedback manusia, dan dashboard progres dalam satu platform persiapan bahasa Inggris independen.",
  ],
  programs: [
    "Program English Preparation | IELTS_MATE",
    "Bandingkan program IELTS Preparation, TOEFL Preparation, General English, Academic English, dan English for Professionals.",
  ],
  tests: [
    "Practice Test & Diagnostic | IELTS_MATE",
    "Latihan dan diagnostic bahasa Inggris dengan hasil tersimpan serta batas skor yang transparan.",
  ],
  pricing: [
    "Paket & Harga | IELTS_MATE",
    "Lihat biaya, durasi, format, dan fasilitas program sebelum mendaftar.",
  ],
  resources: [
    "Sumber Belajar Bahasa Inggris | IELTS_MATE",
    "Panduan praktis untuk IELTS, Writing, dan English for Professionals.",
  ],
  about: [
    "Profil Lembaga | IELTS_MATE",
    "Kenali visi, metode, lokasi, dan kepemimpinan platform persiapan bahasa Inggris independen IELTS_MATE.",
  ],
  alumni: [
    "Alumni & Testimoni | IELTS_MATE",
    "Cerita belajar alumni IELTS_MATE yang dipublikasikan setelah izin dan verifikasi.",
  ],
  contact: [
    "Kontak & Konsultasi | IELTS_MATE",
    "Hubungi tim IELTS_MATE untuk program, kelas, akun, atau dukungan.",
  ],
  login: ["Masuk | IELTS_MATE", "Masuk ke workspace belajar IELTS_MATE."],
  trust: [
    "Pusat Kepercayaan | IELTS_MATE",
    "Mutu akademik, keamanan, privasi, dan transparansi layanan IELTS_MATE.",
  ],
  privacy: [
    "Kebijakan Privasi | IELTS_MATE",
    "Cara IELTS_MATE memproses dan melindungi data pengguna.",
  ],
  terms: [
    "Syarat Layanan | IELTS_MATE",
    "Ketentuan akun, pembelajaran, assessment, dan pembayaran IELTS_MATE.",
  ],
  accessibility: [
    "Aksesibilitas | IELTS_MATE",
    "Komitmen aksesibilitas platform pembelajaran IELTS_MATE.",
  ],
  support: [
    "Dukungan | IELTS_MATE",
    "Bantuan untuk akun, program, pembayaran, feedback, dan kendala teknis.",
  ],
};
function updateSeo(route, param) {
  const page = seoPages[route] || [
    "IELTS_MATE — Learn. Test. Progress.",
    "Platform persiapan bahasa Inggris terintegrasi dan independen.",
  ];
  document.title = page[0];
  const set = (selector, value, attr = "content") => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  };
  set('meta[name="description"]', page[1]);
  set('meta[property="og:title"]', page[0]);
  set('meta[property="og:description"]', page[1]);
  set('meta[property="og:url"]', location.href.split("?")[0]);
  set('link[rel="canonical"]', location.href.split(/[?#]/)[0], "href");
  const schema = document.querySelector("#pageSchema");
  if (schema)
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": route === "programs" ? "ItemList" : "EducationalOrganization",
      name: "IELTS_MATE",
      url: location.origin,
      description: page[1],
      email: "sumawartinitajalli@gmail.com",
      telephone: "+62 878-6405-3222",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Lombok Barat",
        addressRegion: "Nusa Tenggara Barat",
        addressCountry: "ID",
      },
    });
}
function render() {
  const parts = routePath().replace(/^\/+/, "").split("/");
  const route = parts[0] || "home",
    param = parts[1];
  main.innerHTML =
    route === "test"
      ? testPage(param)
      : route === "verify"
        ? verificationPage(param)
        : route === "certificate"
          ? certificateDocument(param)
          : (routes[route] || notFound)(param);
  document.body.classList.toggle(
    "dashboard-mode",
    ["dashboard", "admin"].includes(route) && !!session?.authenticated,
  );
  nav();
  updateSeo(route, param);
  bind();
  main.focus({ preventScroll: true });
}
function bind() {
  qs("[data-print-certificate]")?.addEventListener("click", () => window.print());
  const dialogLogin = qs("#loginForm");
  if (dialogLogin)
    dialogLogin.onsubmit = (e) => authenticate(e, dialogLogin);
  const pageLogin = qs("#pageLoginForm");
  if (pageLogin) pageLogin.onsubmit = (e) => authenticate(e, pageLogin);
  const forgot = qs("#forgotForm");
  if (forgot)
    forgot.onsubmit = async (e) => {
      e.preventDefault();
      const status = qs(".form-help", forgot);
      status.textContent = "Mengirim…";
      try {
        const x = await apiCall("auth/recover", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(new FormData(forgot))),
        });
        status.textContent = x.message;
        forgot.reset();
      } catch (err) {
        status.textContent = err.message;
      }
    };
  const pw = qs('#registerForm input[name="password"]');
  if (pw)
    pw.addEventListener("input", () => {
      const hint = pw.nextElementSibling;
      const score = [
        pw.value.length >= 10,
        /[A-Z]/.test(pw.value),
        /[a-z]/.test(pw.value),
        /\d/.test(pw.value),
        /[^A-Za-z0-9]/.test(pw.value),
      ].filter(Boolean).length;
      hint.textContent = `Kekuatan password: ${score < 3 ? "lemah" : score < 5 ? "cukup" : "kuat"}. Gunakan minimal 10 karakter unik.`;
    });
  setupListening();
  setupPrepTest();
  bindCertificateActions();
  qsa("[data-program-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        qsa("[data-program-filter]").forEach((x) =>
          (x.classList.remove("active"), x.setAttribute("aria-pressed", "false")),
        );
        b.classList.add("active");
        b.setAttribute("aria-pressed", "true");
        const f = b.dataset.programFilter;
        qsa(".program-card").forEach(
          (c) => (c.hidden = f !== "Semua" && c.dataset.category !== f),
        );
      }),
  );
  qs("#registerForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = qs("#registerStatus"),
      b = Object.fromEntries(new FormData(e.currentTarget));
    status.textContent = "Membuat akun…";
    try {
      const x = await apiCall("auth/register", {
        method: "POST",
        body: JSON.stringify(b),
      });
      status.textContent = x.message || "Akun dibuat. Periksa email Anda.";
      e.currentTarget.reset();
    } catch (err) {
      status.textContent = err.message;
    }
  });
  qsa("[data-buy]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (!session?.authenticated) {
          notify("Silakan masuk sebelum membeli.");
          return qs("#loginDialog").showModal();
        }
        b.disabled = true;
        try {
          const x = await apiCall("payments/create", {
            method: "POST",
            body: JSON.stringify({ programSlug: b.dataset.buy }),
          });
          location.href = x.redirectUrl;
        } catch (err) {
          notify(err.message);
          b.disabled = false;
        }
      }),
  );
  qsa('[data-action="login"]').forEach(
    (b) => (b.onclick = () => qs("#loginDialog").showModal()),
  );
  qsa('[data-action="logout"]').forEach(
    (b) =>
      (b.onclick = async () => {
        await apiCall("auth/logout", { method: "POST" }, false).catch(() => {});
        session = null;
        sessionStorage.removeItem("im-session");
        navigate("/home");
        notify("Anda telah keluar");
      }),
  );
  qsa("[data-local-form]").forEach(
    (f) =>
      (f.onsubmit = async (e) => {
        e.preventDefault();
        const b = Object.fromEntries(new FormData(f));
        try {
          if (f.dataset.localForm === "contact")
            await apiCall("leads", { method: "POST", body: JSON.stringify(b) });
          else
            throw new Error(
              "Gunakan dashboard akun untuk menyimpan perubahan.",
            );
          f.reset();
          notify("Pesan tersimpan. Tim kami akan menghubungi Anda.");
        } catch (err) {
          notify(err.message);
        }
      }),
  );
  qs("#quizForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const a = new FormData(e.currentTarget).get("q");
    if (!a) return notify("Pilih satu jawaban.");
    localStorage.setItem("im-last-answer", a);
    notify(
      a === "b"
        ? "Jawaban tersimpan — benar."
        : "Jawaban tersimpan — lanjutkan latihan.",
    );
  });
  qsa("[data-panel]").forEach(
    (b) =>
      (b.onclick = () => {
        qsa("[data-panel]").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        const title = b.dataset.panel;
        qs("#dashContent").innerHTML = dashboardPanel(title, session.role);
        bindDashboardActions();
        bindCertificateActions();
        bindAdmin();
      }),
  );
  bindAdmin();
}
function bindCertificateActions() {
  qs("#issueCertificateForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    const now = new Date(),
      prefix = b.type.includes("Completion") ? "COC" : "COP";
    const number = `IM-${prefix}-${now.getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const c = {
      ...b,
      number,
      hours: +b.hours,
      issuedAt: new Date(b.issuedAt).toISOString(),
      revokedAt: null,
    };
    const list = getCertificates();
    list.unshift(c);
    localStorage.setItem("im-certificates", JSON.stringify(list));
    if (session?.authenticated)
      apiCall("certificates", {
        method: "POST",
        body: JSON.stringify(c),
      }).catch((err) =>
        notify("Sertifikat tersimpan lokal; sinkronisasi gagal."),
      );
    notify("Sertifikat pengakuan diterbitkan");
    qs("#dashContent").innerHTML = certificateAdminPanel();
    bindCertificateActions();
  });
  qsa("[data-revoke-cert]").forEach(
    (b) =>
      (b.onclick = () => {
        const list = getCertificates(),
          c = list.find((x) => x.number === b.dataset.revokeCert);
        if (c) c.revokedAt = new Date().toISOString();
        localStorage.setItem("im-certificates", JSON.stringify(list));
        if (session?.authenticated)
          apiCall("certificates/revoke", {
            method: "POST",
            body: JSON.stringify({ number: b.dataset.revokeCert }),
          }).catch(() =>
            notify("Pencabutan tersimpan lokal; sinkronisasi gagal."),
          );
        notify("Sertifikat dicabut");
        qs("#dashContent").innerHTML = certificateAdminPanel();
        bindCertificateActions();
      }),
  );
  qs("[data-verify-form]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    navigate(
      "/verify/" +
        encodeURIComponent(new FormData(e.currentTarget).get("code")),
    );
  });
  const remote = qs("#remoteVerification"),
    code = qs("[data-verify-form] input[name=code]")?.value;
  if (remote && code) {
    apiCall("certificates/verify?code=" + encodeURIComponent(code))
      .then((x) => {
        const c = {
          number: x.certificate_no,
          name: x.participant_name,
          type: x.certificate_type,
          program: x.program_title,
          hours: x.completion_hours,
          issuedAt: x.issued_at,
          revokedAt: x.is_valid ? null : new Date().toISOString(),
        };
        sessionStorage.setItem("im-verified-certificate", JSON.stringify(c));
        render();
      })
      .catch(() => {
        remote.className = "verification-result invalid";
        remote.innerHTML =
          '<div class="verify-icon">×</div><div><span class="status draft">Tidak ditemukan</span><h2>Nomor tidak valid</h2><p>Periksa kembali nomor sertifikat atau hubungi administrator IELTS_MATE.</p></div>';
      });
  }
}
function bindDashboardActions() {}
function bindAdmin() {
  qs("#institutionProfileForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = Object.fromEntries(new FormData(e.currentTarget));
    const p = {
      ...getInstitution(),
      ...b,
      mission: String(b.mission || "")
        .split(/\n+/)
        .map((x) => x.trim())
        .filter(Boolean),
      values: String(b.values || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      learningModel: String(b.learningModel || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    };
    localStorage.setItem("im-institution-profile", JSON.stringify(p));
    if (session?.authenticated) {
      try {
        await apiCall("institution", {
          method: "PUT",
          body: JSON.stringify(p),
        });
        notify("Profil lembaga dipublikasikan");
      } catch (err) {
        notify("Tersimpan lokal; sinkronisasi produksi gagal");
      }
    } else notify("Profil lembaga tersimpan di pratinjau");
  });
  const save = qs("#saveMenus");
  if (save)
    save.onclick = () => {
      data.menus = qsa("tr[data-menu]").map((r) => {
        const [order, label, href, status] = qsa("input,select", r);
        return {
          id: r.dataset.menu,
          label: label.value.trim(),
          href: href.value.trim(),
          order: +order.value,
          active: status.value === "true",
        };
      });
      localStorage.setItem("im-content-v2", JSON.stringify(data));
      nav();
      notify("Navigasi dipublikasikan");
    };
  qs("#addMenu")?.addEventListener("click", () => {
    data.menus.push({
      id: crypto.randomUUID(),
      label: "Menu baru",
      href: "/home",
      order: data.menus.length + 1,
      active: false,
    });
    localStorage.setItem("im-content-v2", JSON.stringify(data));
    qs("#dashContent").innerHTML = navManager();
    bindAdmin();
  });
  qsa("[data-delete-menu]").forEach(
    (b) =>
      (b.onclick = () => {
        data.menus = data.menus.filter((m) => m.id !== b.dataset.deleteMenu);
        localStorage.setItem("im-content-v2", JSON.stringify(data));
        qs("#dashContent").innerHTML = navManager();
        bindAdmin();
      }),
  );
  qs("#resetMenus")?.addEventListener("click", () => {
    data = structuredClone(fallback);
    localStorage.setItem("im-content-v2", JSON.stringify(data));
    qs("#dashContent").innerHTML = navManager();
    nav();
    bindAdmin();
    notify("Data awal dipulihkan");
  });
}
async function authenticate(e, form) {
  e.preventDefault();
  const status = qs(".form-help", form);
  if (status) status.textContent = "Memverifikasi akun…";
  const fd = new FormData(form),
    payload = { email: fd.get("email"), password: fd.get("password") };
  try {
    const out = await apiCall("auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    session = {
      ...out.user,
      role: normalizeRole(out.user?.role),
      authenticated: true,
      accessToken: out.accessToken,
      expiresAt: Date.now() + (out.expiresIn || 3600) * 1000,
    };
    sessionStorage.setItem("im-session", JSON.stringify(session));
    await syncAttempts();
    await syncCertificates();
    qs("#loginDialog")?.close();
    navigate(session.role === "admin" ? "/admin" : "/dashboard");
    notify("Login berhasil");
  } catch (err) {
    if (status) status.textContent = err.message || "Login gagal";
    notify(err.message || "Login gagal");
  }
}
qs("#loginDialog .dialog-x")?.addEventListener("click", () => {
  qs("#loginDialog")?.close();
});
qs("#navToggle").onclick = () => {
  const n = qs("#publicNav");
  n.classList.toggle("open");
  qs("#navToggle").setAttribute("aria-expanded", n.classList.contains("open"));
};
window.addEventListener("popstate", render);
document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="/"]');
  if (
    !link ||
    link.target ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  navigate(link.getAttribute("href"));
});
if (location.hash.startsWith("#/"))
  history.replaceState({}, "", location.hash.slice(1));
if ("serviceWorker" in navigator && location.protocol.startsWith("http"))
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
async function restoreSession() {
  if (session?.authenticated) return;
  try {
    const user = await apiCall("me");
    session = {
      ...user,
      role: normalizeRole(user?.role),
      authenticated: true,
      accessToken: session?.accessToken,
    };
    sessionStorage.setItem("im-session", JSON.stringify(session));
    if (session.role === "admin" && routePath().startsWith("/dashboard"))
      navigate("/admin", true);
    else if (["/dashboard", "/admin"].some((x) => routePath().startsWith(x)))
      render();
  } catch {}
}
const cookieBanner = qs("#cookieBanner");
if (cookieBanner && !localStorage.getItem("im-cookie-choice"))
  cookieBanner.hidden = false;
qs("#acceptEssential")?.addEventListener("click", () => {
  localStorage.setItem("im-cookie-choice", "essential");
  cookieBanner.hidden = true;
  notify("Preferensi privasi disimpan");
});
render();
restoreSession();
syncPublicData();
syncInstitutionProfile();
