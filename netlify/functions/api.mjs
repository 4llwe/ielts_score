import crypto from "node:crypto";
import seed from "../../data/seed.json" with { type: "json" };

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};
const out = (body, status = 200, extra = {}) => {
  const headers = new Headers(JSON_HEADERS);
  for (const [key, value] of Object.entries(extra)) {
    if (Array.isArray(value))
      value.forEach((item) => headers.append(key, item));
    else headers.set(key, value);
  }
  return new Response(JSON.stringify(body), { status, headers });
};
const env = (k) => process.env[k] || "";
const requireConfig = (keys) => {
  const missing = keys.filter((k) => !env(k));
  if (missing.length)
    throw Object.assign(
      new Error(`Missing configuration: ${missing.join(", ")}`),
      { status: 503 },
    );
};
const cookies = (req) =>
  Object.fromEntries(
    String(req.headers.get("cookie") || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const at = part.indexOf("=");
        return at < 0
          ? [part, ""]
          : [part.slice(0, at), decodeURIComponent(part.slice(at + 1))];
      }),
  );
const bearer = (req) =>
  req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
const accessToken = (req) => bearer(req) || cookies(req).im_access || "";
const cookieFlags = (req, maxAge) =>
  `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
const authCookieHeaders = (req, data) => [
  `im_access=${encodeURIComponent(data.access_token)}; ${cookieFlags(req, Math.max(60, Number(data.expires_in || 3600)))}`,
  `im_refresh=${encodeURIComponent(data.refresh_token)}; ${cookieFlags(req, 2592000)}`,
];
const clearCookieHeaders = (req) => [
  `im_access=; ${cookieFlags(req, 0)}`,
  `im_refresh=; ${cookieFlags(req, 0)}`,
];
const clean = (v, max = 500) =>
  String(v ?? "")
    .trim()
    .slice(0, max);
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ""));
const safeJson = async (req) => {
  const length = Number(req.headers.get("content-length") || 0);
  if (length > 2_000_000)
    throw Object.assign(new Error("Payload terlalu besar."), { status: 413 });
  try {
    return await req.json();
  } catch {
    return {};
  }
};
const safeHttpsUrl = (value, max = 500) => {
  const text = clean(value, max);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};
const htmlEscape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

async function supabase(
  path,
  {
    method = "GET",
    token,
    service = false,
    body,
    query,
    prefer = "return=representation",
  } = {},
) {
  requireConfig([
    "SUPABASE_URL",
    service ? "SUPABASE_SERVICE_ROLE_KEY" : "SUPABASE_ANON_KEY",
  ]);
  const url = new URL(env("SUPABASE_URL").replace(/\/$/, "") + path);
  if (query)
    Object.entries(query).forEach(
      ([k, v]) =>
        v !== undefined && v !== null && url.searchParams.set(k, String(v)),
    );
  const key = service
    ? env("SUPABASE_SERVICE_ROLE_KEY")
    : env("SUPABASE_ANON_KEY");
  const r = await fetch(url, {
    method,
    headers: {
      apikey: key,
      ...(token || key.startsWith("eyJ")
  ? { authorization: `Bearer ${token || key}` }
  : {}),
      "content-type": "application/json",
      prefer,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }
  if (!r.ok)
    throw Object.assign(
      new Error(
        data.msg ||
          data.message ||
          data.error_description ||
          "Database request failed",
      ),
      { status: r.status, data },
    );
  return data;
}
async function actor(req) {
  const token = accessToken(req);
  if (!token) return null;
  try {
    const user = await supabase("/auth/v1/user", { token });
    const rows = await supabase("/rest/v1/profiles", {
      token,
      query: {
        id: `eq.${user.id}`,
        select:
          "id,email,full_name,phone,role,target,timezone,status,last_active_at",
      },
    });
    const profile = rows[0];
    if (!profile || profile.status !== "active") return null;
    supabase("/rest/v1/profiles", {
      method: "PATCH",
      service: true,
      query: { id: `eq.${user.id}` },
      body: { last_active_at: new Date().toISOString() },
    }).catch(() => {});
    return { ...user, profile, token };
  } catch {
    return null;
  }
}
const roleOf = (u) => u?.profile?.role || "student";
const allow = (u, roles) => !!u && roles.includes(roleOf(u));
const audit = (u, action, type, id, metadata = {}) =>
  supabase("/rest/v1/audit_logs", {
    method: "POST",
    service: true,
    body: {
      actor_id: u?.id || null,
      action,
      entity_type: type,
      entity_id: id ? String(id) : null,
      metadata,
    },
  }).catch(() => {});
const parseList = (v, max = 20) =>
  Array.isArray(v)
    ? v
        .map((x) => clean(x, 500))
        .filter(Boolean)
        .slice(0, max)
    : [];
async function enforceRateLimit(
  req,
  scope,
  limit,
  windowSeconds,
  subject = "",
) {
  const forwarded = clean(
    req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown",
    100,
  );
  const key = crypto
    .createHash("sha256")
    .update(`${scope}|${forwarded}|${clean(subject, 200)}`)
    .digest("hex");
  const result = await supabase("/rest/v1/rpc/consume_rate_limit", {
    method: "POST",
    service: true,
    body: { p_key: key, p_limit: limit, p_window_seconds: windowSeconds },
  });
  const allowed =
    typeof result === "boolean" ? result : result?.[0]?.consume_rate_limit;
  if (!allowed)
    throw Object.assign(
      new Error("Terlalu banyak permintaan. Silakan coba lagi nanti."),
      { status: 429 },
    );
}

async function sendEmail(to, subject, html) {
  if (!env("RESEND_API_KEY") || !env("EMAIL_FROM") || !to) return;
  await fetch("https:" + "//api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env("RESEND_API_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from: env("EMAIL_FROM"), to: [to], subject, html }),
  }).catch(() => {});
}
async function notify(userId, title, body, link = null) {
  if (!userId) return;
  await supabase("/rest/v1/notifications", {
    method: "POST",
    service: true,
    body: { user_id: userId, title, body, link },
  }).catch(() => {});
}

async function publicData() {
  const [programs, tests, nav] = await Promise.all([
    supabase("/rest/v1/programs", {
      query: {
        status: "eq.published",
        select:
          "id,slug,title,description,category,price,old_price,billing_unit,meetings,mode,features,consultation_required,duration_weeks",
        order: "title.asc",
      },
    }),
    supabase("/rest/v1/tests", {
      query: {
        status: "eq.published",
        validation_status: "in.(approved,classroom_ready)",
        select:
          "id,slug,title,test_type,duration_minutes,price,instructions,version",
        order: "created_at.desc",
      },
    }),
    supabase("/rest/v1/site_content", {
      query: {
        key: "eq.navigation",
        published: "eq.true",
        select: "value",
        limit: "1",
      },
    }),
  ]);
  return out({ programs, tests, menus: nav[0]?.value || seed.menus }, 200, {
    "cache-control": "public,max-age=60",
  });
}
async function register(req) {
  const b = await safeJson(req),
    email = clean(b.email, 200).toLowerCase(),
    password = String(b.password || ""),
    full_name = clean(b.full_name, 120);
  await enforceRateLimit(req, "register", 5, 3600, email);
  if (!full_name || !emailOk(email) || password.length < 10)
    return out(
      {
        error:
          "Nama, email valid, dan password minimal 10 karakter diperlukan.",
      },
      400,
    );
  const data = await supabase("/auth/v1/signup", {
    method: "POST",
    body: { email, password, data: { full_name } },
  });
  return out(
    {
      user: { id: data.user?.id, email },
      message: "Akun dibuat. Periksa email untuk konfirmasi.",
    },
    201,
  );
}
async function recover(req) {
  const b = await safeJson(req),
    email = clean(b.email, 200).toLowerCase();
  await enforceRateLimit(req, "recover", 5, 3600, email);
  const message = "Jika email terdaftar, tautan pemulihan akan dikirim.";
  if (!emailOk(email)) return out({ message });
  try {
    const base = env("SITE_URL") || new URL(req.url).origin;
    await supabase("/auth/v1/recover", {
      method: "POST",
      query: { redirect_to: `${base.replace(/\/$/, "")}/login?recovery=1` },
      body: { email },
    });
  } catch (e) {
    console.warn("Password recovery request failed", e.status || e.message);
  }
  return out({ message });
}
async function login(req) {
  const b = await safeJson(req),
    email = clean(b.email, 200).toLowerCase(),
    password = String(b.password || "");
  await enforceRateLimit(req, "login", 10, 900, email);
  if (!emailOk(email) || password.length < 8)
    return out({ error: "Kredensial tidak valid." }, 400);
  const data = await supabase("/auth/v1/token", {
    method: "POST",
    query: { grant_type: "password" },
    body: { email, password },
  });
  const rows = await supabase("/rest/v1/profiles", {
    token: data.access_token,
    query: {
      id: `eq.${data.user.id}`,
      select: "id,email,full_name,phone,role,target,timezone,status",
    },
  });
  if (rows[0]?.status !== "active")
    return out({ error: "Akun tidak aktif. Hubungi administrator." }, 403);
  // Return the short-lived access token as a same-tab fallback. Netlify and
  // privacy-focused browsers can occasionally discard Set-Cookie headers on
  // rewritten function responses. The refresh token remains HttpOnly-only.
  return out({
    expiresIn: data.expires_in,
    accessToken: data.access_token,
    user: rows[0],
  }, 200, {
    "set-cookie": authCookieHeaders(req, data),
  });
}
async function refreshSession(req) {
  const refreshToken = cookies(req).im_refresh;
  if (!refreshToken)
    return out({ error: "Unauthorized" }, 401, {
      "set-cookie": clearCookieHeaders(req),
    });
  try {
    const data = await supabase("/auth/v1/token", {
      method: "POST",
      query: { grant_type: "refresh_token" },
      body: { refresh_token: refreshToken },
    });
    return out({
      ok: true,
      expiresIn: data.expires_in,
      accessToken: data.access_token,
    }, 200, {
      "set-cookie": authCookieHeaders(req, data),
    });
  } catch {
    return out({ error: "Sesi berakhir. Silakan masuk kembali." }, 401, {
      "set-cookie": clearCookieHeaders(req),
    });
  }
}
async function logout(req) {
  const token = accessToken(req);
  if (token)
    await supabase("/auth/v1/logout", { method: "POST", token }).catch(
      () => {},
    );
  return out({ ok: true }, 200, { "set-cookie": clearCookieHeaders(req) });
}
async function profile(req, u) {
  if (req.method === "GET") return out(u.profile);
  const b = await safeJson(req),
    row = {
      full_name: clean(b.full_name, 120),
      phone: clean(b.phone, 50),
      target: clean(b.target, 120),
      timezone: clean(b.timezone, 80) || "Asia/Makassar",
    };
  const rows = await supabase("/rest/v1/profiles", {
    method: "PATCH",
    token: u.token,
    query: { id: `eq.${u.id}` },
    body: row,
  });
  audit(u, "profile.update", "profile", u.id);
  return out(rows[0]);
}

async function attempts(req, u) {
  if (req.method === "GET")
    return out(
      await supabase("/rest/v1/attempts", {
        token: u.token,
        query: {
          user_id: `eq.${u.id}`,
          select:
            "id,test_slug,status,started_at,submitted_at,objective_score,final_score,metadata",
          order: "started_at.desc",
          limit: "100",
        },
      }),
    );
  const b = await safeJson(req),
    score = Number(b.objectiveScore),
    slug = clean(b.testSlug, 80);
  if (!slug || !Number.isFinite(score) || score < 0 || score > 100)
    return out({ error: "Data hasil tidak valid." }, 400);
  const rows = await supabase("/rest/v1/attempts", {
    method: "POST",
    token: u.token,
    body: {
      user_id: u.id,
      test_slug: slug,
      status: "scored",
      submitted_at: new Date().toISOString(),
      objective_score: score,
      metadata: { label: clean(b.label, 150), source: "web" },
    },
  });
  audit(u, "attempt.create", "attempt", rows[0]?.id, { slug, score });
  return out(rows[0], 201);
}
async function enrollments(req, u) {
  if (req.method === "GET") {
    const q = allow(u, ["admin"])
      ? {
          select:
            "id,user_id,program_id,class_id,status,progress,started_at,ends_at,profiles:user_id(full_name,email),programs:program_id(title,slug),classes:class_id(name,starts_at,ends_at)",
          order: "started_at.desc",
        }
      : {
          user_id: `eq.${u.id}`,
          select:
            "id,status,progress,started_at,ends_at,programs:program_id(id,title,slug,description,mode),classes:class_id(id,name,starts_at,ends_at,meeting_url,location)",
          order: "started_at.desc",
        };
    return out(
      await supabase("/rest/v1/enrollments", {
        token: u.token,
        service: allow(u, ["admin"]),
        query: q,
      }),
    );
  }
  if (!allow(u, ["admin"])) return out({ error: "Forbidden" }, 403);
  const b = await safeJson(req);
  if (req.method === "POST") {
    const row = {
      user_id: clean(b.userId, 60),
      program_id: clean(b.programId, 60),
      class_id: clean(b.classId, 60) || null,
      status: clean(b.status, 30) || "active",
    };
    const rows = await supabase("/rest/v1/enrollments", {
      method: "POST",
      service: true,
      body: row,
      prefer: "resolution=merge-duplicates,return=representation",
    });
    if (row.class_id)
      await supabase("/rest/v1/class_members", {
        method: "POST",
        service: true,
        body: { class_id: row.class_id, user_id: row.user_id },
        prefer: "resolution=merge-duplicates,return=representation",
      });
    audit(u, "enrollment.create", "enrollment", rows[0]?.id, row);
    return out(rows[0], 201);
  }
  const id = clean(b.id, 60);
  const rows = await supabase("/rest/v1/enrollments", {
    method: "PATCH",
    service: true,
    query: { id: `eq.${id}` },
    body: {
      status: clean(b.status, 30),
      progress: Number(b.progress) || 0,
      class_id: clean(b.classId, 60) || null,
    },
  });
  audit(u, "enrollment.update", "enrollment", id);
  return out(rows[0]);
}
async function schedules(req, u) {
  const q =
    roleOf(u) === "student"
      ? {
          select:
            "id,title,starts_at,ends_at,meeting_url,location,classes:class_id!inner(name,class_members!inner(user_id))",
          "classes.class_members.user_id": `eq.${u.id}`,
          order: "starts_at.asc",
        }
      : roleOf(u) === "instructor"
        ? {
            select:
              "id,title,starts_at,ends_at,meeting_url,location,classes:class_id!inner(name,instructor_id)",
            "classes.instructor_id": `eq.${u.id}`,
            order: "starts_at.asc",
          }
        : {
            select:
              "id,title,starts_at,ends_at,meeting_url,location,classes:class_id(name)",
            order: "starts_at.asc",
          };
  return out(
    await supabase("/rest/v1/schedules", {
      token: u.token,
      service: allow(u, ["admin"]),
      query: q,
    }),
  );
}
async function submissions(req, u) {
  if (req.method === "GET") {
    const staff = allow(u, ["examiner", "admin"]);
    const q = staff
      ? {
          select:
            "id,user_id,kind,response_text,file_path,status,examiner_id,submitted_at,due_at,profiles:user_id(full_name,email),evaluations(id,overall_score,feedback,moderation_status,created_at)",
          order: "due_at.asc",
        }
      : {
          user_id: `eq.${u.id}`,
          select:
            "id,kind,response_text,file_path,status,submitted_at,due_at,evaluations(id,overall_score,feedback,moderation_status,created_at)",
          order: "submitted_at.desc",
        };
    return out(
      await supabase("/rest/v1/submissions", {
        token: u.token,
        service: staff,
        query: q,
      }),
    );
  }
  const b = await safeJson(req),
    kind = clean(b.kind, 20);
  if (!["writing", "speaking"].includes(kind) || !clean(b.attemptId, 60))
    return out({ error: "Submission tidak valid." }, 400);
  const rows = await supabase("/rest/v1/submissions", {
    method: "POST",
    token: u.token,
    body: {
      attempt_id: b.attemptId,
      user_id: u.id,
      kind,
      response_text: clean(b.responseText, 20000) || null,
      file_path: clean(b.filePath, 500) || null,
    },
  });
  audit(u, "submission.create", "submission", rows[0]?.id, { kind });
  return out(rows[0], 201);
}
async function evaluate(req, u) {
  if (!allow(u, ["examiner", "admin"])) return out({ error: "Forbidden" }, 403);
  const b = await safeJson(req),
    submissionId = clean(b.submissionId, 60),
    feedback = clean(b.feedback, 5000);
  const submissions = await supabase("/rest/v1/submissions", {
    service: true,
    query: {
      id: `eq.${submissionId}`,
      status: "eq.queued",
      select: "id,kind",
      limit: "1",
    },
  });
  const submission = submissions[0];
  if (!submission)
    return out(
      { error: "Submission tidak ditemukan atau sudah dievaluasi." },
      404,
    );
  const criteria =
    submission.kind === "writing"
      ? ["task_response", "coherence", "lexical", "grammar"]
      : ["fluency", "lexical", "grammar", "pronunciation"];
  const rubricScores =
    b.rubricScores && typeof b.rubricScores === "object" ? b.rubricScores : {};
  const values = criteria.map((key) => Number(rubricScores[key]));
  if (
    feedback.length < 50 ||
    values.some(
      (value) =>
        !Number.isFinite(value) ||
        value < 0 ||
        value > 9 ||
        Math.round(value * 2) !== value * 2,
    )
  )
    return out(
      {
        error:
          "Lengkapi empat kriteria band 0–9 (kelipatan 0,5) dan feedback minimal 50 karakter.",
      },
      400,
    );
  const score =
    Math.round(
      (values.reduce((a, value) => a + value, 0) / values.length) * 2,
    ) / 2;
  const rows = await supabase("/rest/v1/evaluations", {
    method: "POST",
    service: true,
    body: {
      submission_id: submissionId,
      examiner_id: u.id,
      rubric_scores: Object.fromEntries(
        criteria.map((key, index) => [key, values[index]]),
      ),
      overall_score: score,
      feedback,
      moderation_status: roleOf(u) === "admin" ? "approved" : "pending",
    },
  });
  await supabase("/rest/v1/submissions", {
    method: "PATCH",
    service: true,
    query: { id: `eq.${submissionId}` },
    body: { status: "evaluated", examiner_id: u.id },
  });
  audit(u, "evaluation.create", "evaluation", rows[0]?.id, {
    submissionId,
    score,
    criteria,
  });
  return out(rows[0], 201);
}

async function classOps(req, u, url) {
  const id = url.searchParams.get("id");
  if (req.method === "GET") {
    const q =
      roleOf(u) === "admin"
        ? {
            select:
              "*,programs:program_id(title,slug),profiles:instructor_id(full_name,email)",
            order: "starts_at.desc",
          }
        : {
            instructor_id: `eq.${u.id}`,
            select: "*,programs:program_id(title,slug)",
            order: "starts_at.desc",
          };
    return out(
      await supabase("/rest/v1/classes", {
        token: u.token,
        service: roleOf(u) === "admin",
        query: q,
      }),
    );
  }
  if (!allow(u, ["admin"])) return out({ error: "Forbidden" }, 403);
  const b = await safeJson(req),
    row = {
      program_id: clean(b.programId, 60),
      name: clean(b.name, 150),
      instructor_id: clean(b.instructorId, 60) || null,
      capacity: Number(b.capacity) || 20,
      starts_at: b.startsAt || null,
      ends_at: b.endsAt || null,
      meeting_url: safeHttpsUrl(b.meetingUrl),
      location: clean(b.location, 300) || null,
      status: clean(b.status, 30) || "draft",
      updated_at: new Date().toISOString(),
    };
  if (req.method === "POST") {
    const rows = await supabase("/rest/v1/classes", {
      method: "POST",
      service: true,
      body: row,
    });
    audit(u, "class.create", "class", rows[0]?.id);
    return out(rows[0], 201);
  }
  const rows = await supabase("/rest/v1/classes", {
    method: "PATCH",
    service: true,
    query: { id: `eq.${id || b.id}` },
    body: row,
  });
  audit(u, "class.update", "class", id || b.id);
  return out(rows[0]);
}
async function instructorStudents(u, url) {
  const classId = clean(url.searchParams.get("classId"), 60);
  const classes =
    roleOf(u) === "admin"
      ? []
      : await supabase("/rest/v1/classes", {
          token: u.token,
          query: { instructor_id: `eq.${u.id}`, select: "id" },
        });
  const allowedIds = classes.map((x) => x.id);
  if (classId && roleOf(u) !== "admin" && !allowedIds.includes(classId))
    return out({ error: "Forbidden" }, 403);
  const q = classId
    ? {
        class_id: `eq.${classId}`,
        select:
          "joined_at,profiles:user_id(id,full_name,email,phone,status),classes:class_id(name)",
      }
    : {
        select:
          "joined_at,profiles:user_id(id,full_name,email,phone,status),classes:class_id!inner(name,instructor_id)",
        "classes.instructor_id": `eq.${u.id}`,
      };
  return out(
    await supabase("/rest/v1/class_members", {
      token: u.token,
      service: roleOf(u) === "admin",
      query: q,
    }),
  );
}
async function materials(req, u) {
  if (!allow(u, ["instructor", "admin"]))
    return out({ error: "Forbidden" }, 403);
  if (req.method === "GET")
    return out(
      await supabase("/rest/v1/materials", {
        token: u.token,
        service: roleOf(u) === "admin",
        query: {
          select: "*,classes:class_id(name,instructor_id)",
          order: "created_at.desc",
        },
      }),
    );
  const b = await safeJson(req);
  const rows = await supabase("/rest/v1/materials", {
    method: "POST",
    service: true,
    body: {
      class_id: b.classId,
      title: clean(b.title, 180),
      description: clean(b.description, 2000),
      file_url: safeHttpsUrl(b.fileUrl),
      published_at: b.published ? new Date().toISOString() : null,
      created_by: u.id,
    },
  });
  audit(u, "material.create", "material", rows[0]?.id);
  return out(rows[0], 201);
}
async function assignments(req, u) {
  if (req.method === "GET") {
    const service = allow(u, ["admin"]);
    const q =
      roleOf(u) === "student"
        ? {
            select:
              "*,classes:class_id!inner(name,class_members!inner(user_id)),assignment_submissions(id,submitted_at,score,feedback)",
            "classes.class_members.user_id": `eq.${u.id}`,
            order: "due_at.asc",
          }
        : {
            select: "*,classes:class_id(name,instructor_id)",
            order: "due_at.asc",
          };
    return out(
      await supabase("/rest/v1/assignments", {
        token: u.token,
        service,
        query: q,
      }),
    );
  }
  if (!allow(u, ["instructor", "admin"]))
    return out({ error: "Forbidden" }, 403);
  const b = await safeJson(req);
  const rows = await supabase("/rest/v1/assignments", {
    method: "POST",
    service: true,
    body: {
      class_id: b.classId,
      title: clean(b.title, 180),
      instructions: clean(b.instructions, 5000),
      due_at: b.dueAt || null,
      max_score: Number(b.maxScore) || 100,
      status: clean(b.status, 30) || "published",
      created_by: u.id,
    },
  });
  audit(u, "assignment.create", "assignment", rows[0]?.id);
  return out(rows[0], 201);
}
async function attendance(req, u) {
  if (!allow(u, ["instructor", "admin"]))
    return out({ error: "Forbidden" }, 403);
  if (req.method === "GET")
    return out(
      await supabase("/rest/v1/attendance", {
        token: u.token,
        service: roleOf(u) === "admin",
        query: {
          select: "*,profiles:user_id(full_name,email),classes:class_id(name)",
          order: "session_at.desc",
          limit: "200",
        },
      }),
    );
  const b = await safeJson(req);
  const rows = await supabase("/rest/v1/attendance", {
    method: "POST",
    service: true,
    body: {
      class_id: b.classId,
      user_id: b.userId,
      session_at: b.sessionAt,
      status: clean(b.status, 20),
      notes: clean(b.notes, 500) || null,
      recorded_by: u.id,
    },
    prefer: "resolution=merge-duplicates,return=representation",
  });
  audit(u, "attendance.record", "attendance", rows[0]?.id);
  return out(rows[0], 201);
}

async function adminStats(u) {
  if (!allow(u, ["admin"])) return out({ error: "Forbidden" }, 403);
  const safeRows = async (label, request) => {
    try {
      const rows = await request;
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      console.warn(`Admin metric unavailable: ${label}`, error.status || error.message);
      return [];
    }
  };
  const [profiles, enrollments, payments, subs, leads] = await Promise.all([
    safeRows("profiles", supabase("/rest/v1/profiles", {
      service: true,
      query: { select: "id,status" },
    })),
    safeRows("enrollments", supabase("/rest/v1/enrollments", {
      service: true,
      query: { select: "id,status" },
    })),
    safeRows("payments", supabase("/rest/v1/payments", {
      service: true,
      query: { select: "amount,status" },
    })),
    safeRows("submissions", supabase("/rest/v1/submissions", {
      service: true,
      query: { select: "id,status,due_at" },
    })),
    safeRows("leads", supabase("/rest/v1/leads", {
      service: true,
      query: { select: "id,status" },
    })),
  ]);
  return out({
    students: profiles.filter((x) => x.status === "active").length,
    enrollments: enrollments.filter((x) => x.status === "active").length,
    revenue: payments
      .filter((x) => ["settlement", "capture"].includes(x.status))
      .reduce((a, x) => a + Number(x.amount || 0), 0),
    pendingEvaluations: subs.filter((x) => x.status === "queued").length,
    newLeads: leads.filter((x) => x.status === "new").length,
  });
}
async function adminUsers(req, u, url) {
  if (!allow(u, ["admin"])) return out({ error: "Forbidden" }, 403);
  if (req.method === "GET")
    return out(
      await supabase("/rest/v1/profiles", {
        service: true,
        query: {
          select:
            "id,email,full_name,phone,role,status,target,created_at,last_active_at",
          order: "created_at.desc",
          limit: "500",
        },
      }),
    );
  const b = await safeJson(req),
    id = clean(url.searchParams.get("id") || b.id, 60);
  if (id === u.id && b.status && b.status !== "active")
    return out(
      { error: "Administrator tidak dapat menonaktifkan akun sendiri." },
      400,
    );
  const row = {};
  if (b.role) row.role = clean(b.role, 20);
  if (b.status) row.status = clean(b.status, 20);
  const rows = await supabase("/rest/v1/profiles", {
    method: "PATCH",
    service: true,
    query: { id: `eq.${id}` },
    body: row,
  });
  audit(u, "user.update", "profile", id, row);
  return out(rows[0]);
}
async function adminPrograms(req, u, url) {
  if (!allow(u, ["admin"])) return out({ error: "Forbidden" }, 403);
  if (req.method === "GET")
    return out(
      await supabase("/rest/v1/programs", {
        service: true,
        query: { select: "*", order: "title.asc" },
      }),
    );
  const b = await safeJson(req),
    id = url.searchParams.get("id") || b.id,
    row = {
      slug: clean(b.slug, 100),
      title: clean(b.title, 180),
      description: clean(b.description, 3000),
      category: clean(b.category, 80),
      price: Math.max(0, Number(b.price) || 0),
      old_price: b.oldPrice ? Number(b.oldPrice) : null,
      billing_unit: clean(b.billingUnit, 80),
      meetings: clean(b.meetings, 200),
      mode: clean(b.mode, 100),
      features: parseList(b.features),
      consultation_required: !!b.consultationRequired,
      status: clean(b.status, 20) || "draft",
    };
  if (req.method === "POST") {
    const rows = await supabase("/rest/v1/programs", {
      method: "POST",
      service: true,
      body: row,
    });
    audit(u, "program.create", "program", rows[0]?.id);
    return out(rows[0], 201);
  }
  const rows = await supabase("/rest/v1/programs", {
    method: "PATCH",
    service: true,
    query: { id: `eq.${id}` },
    body: row,
  });
  audit(u, "program.update", "program", id);
  return out(rows[0]);
}
async function leads(req, u, url) {
  if (req.method === "POST" && !u) {
    const b = await safeJson(req),
      row = {
        name: clean(b.name, 120),
        email: clean(b.email, 200).toLowerCase(),
        phone: clean(b.phone, 50),
        topic: clean(b.topic, 150),
        message: clean(b.message, 5000),
        source: "website",
      };
    if (!row.name || !emailOk(row.email) || !row.phone || !row.message)
      return out({ error: "Data kontak belum lengkap." }, 400);
    const rows = await supabase("/rest/v1/leads", {
      method: "POST",
      service: true,
      body: row,
    });
    return out({ id: rows[0]?.id, message: "Pesan diterima." }, 201);
  }
  if (!allow(u, ["admin"])) return out({ error: "Forbidden" }, 403);
  if (req.method === "GET")
    return out(
      await supabase("/rest/v1/leads", {
        service: true,
        query: { select: "*", order: "created_at.desc", limit: "500" },
      }),
    );
  const b = await safeJson(req),
    id = url.searchParams.get("id") || b.id;
  const rows = await supabase("/rest/v1/leads", {
    method: "PATCH",
    service: true,
    query: { id: `eq.${id}` },
    body: {
      status: clean(b.status, 20),
      assigned_to: b.assignedTo || null,
      updated_at: new Date().toISOString(),
    },
  });
  audit(u, "lead.update", "lead", id);
  return out(rows[0]);
}
async function content(req, u) {
  if (req.method === "GET")
    return out(
      await supabase("/rest/v1/site_content", {
        service: allow(u, ["admin"]),
        token: u?.token,
        query: { select: "key,value,published,updated_at" },
      }),
    );
  if (!allow(u, ["admin"])) return out({ error: "Forbidden" }, 403);
  const b = await safeJson(req),
    key = clean(b.key, 80);
  const rows = await supabase("/rest/v1/site_content", {
    method: "POST",
    service: true,
    body: {
      key,
      value: b.value,
      published: !!b.published,
      updated_by: u.id,
      updated_at: new Date().toISOString(),
    },
    prefer: "resolution=merge-duplicates,return=representation",
  });
  audit(u, "content.publish", "site_content", key);
  return out(rows[0]);
}
async function auditList(u) {
  if (!allow(u, ["admin"])) return out({ error: "Forbidden" }, 403);
  return out(
    await supabase("/rest/v1/audit_logs", {
      service: true,
      query: {
        select:
          "id,action,entity_type,entity_id,metadata,created_at,profiles:actor_id(full_name,email)",
        order: "created_at.desc",
        limit: "200",
      },
    }),
  );
}
async function notifications(req, u) {
  if (req.method === "GET")
    return out(
      await supabase("/rest/v1/notifications", {
        token: u.token,
        query: {
          user_id: `eq.${u.id}`,
          select: "id,title,body,link,read_at,created_at",
          order: "created_at.desc",
          limit: "100",
        },
      }),
    );
  const b = await safeJson(req);
  await supabase("/rest/v1/notifications", {
    method: "PATCH",
    token: u.token,
    query: { id: `eq.${b.id}`, user_id: `eq.${u.id}` },
    body: { read_at: new Date().toISOString() },
  });
  return out({ ok: true });
}

async function createPayment(req, u) {
  requireConfig(["MIDTRANS_SERVER_KEY", "MIDTRANS_CLIENT_KEY", "SITE_URL"]);
  const b = await safeJson(req),
    slug = clean(b.programSlug || b.itemId, 100);
  const programs = await supabase("/rest/v1/programs", {
      service: true,
      query: {
        slug: `eq.${slug}`,
        status: "eq.published",
        select: "id,slug,title,price,consultation_required",
        limit: "1",
      },
    }),
    p = programs[0];
  if (!p || p.consultation_required || Number(p.price) < 1000)
    return out(
      { error: "Program tidak dapat dibayar langsung. Hubungi admin." },
      400,
    );
  const orderId = `IM-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    amount = Number(p.price),
    payload = {
      transaction_details: { order_id: orderId, gross_amount: amount },
      customer_details: {
        first_name: u.profile.full_name || "Student",
        email: u.profile.email,
      },
      item_details: [
        { id: p.slug, price: amount, quantity: 1, name: p.title.slice(0, 50) },
      ],
      callbacks: {
        finish: `${env("SITE_URL").replace(/\/$/, "")}//dashboard`,
      },
    };
  const host =
    env("MIDTRANS_IS_PRODUCTION") === "true"
      ? "app.midtrans.com"
      : "app.sandbox.midtrans.com";
  const r = await fetch("https:" + "//" + host + "/snap/v1/transactions", {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(env("MIDTRANS_SERVER_KEY") + ":").toString("base64")}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    }),
    x = await r.json();
  if (!r.ok)
    return out(
      {
        error:
          x.error_messages?.join(", ") || "Midtrans gagal membuat transaksi.",
      },
      502,
    );
  await supabase("/rest/v1/payments", {
    method: "POST",
    service: true,
    body: {
      order_id: orderId,
      user_id: u.id,
      program_id: p.id,
      amount,
      status: "pending",
      snap_token: x.token,
    },
  });
  audit(u, "payment.create", "payment", orderId, { program: p.slug, amount });
  return out(
    {
      orderId,
      token: x.token,
      redirectUrl: x.redirect_url,
      clientKey: env("MIDTRANS_CLIENT_KEY"),
      production: env("MIDTRANS_IS_PRODUCTION") === "true",
    },
    201,
  );
}
async function midtransWebhook(req) {
  requireConfig(["MIDTRANS_SERVER_KEY"]);
  const b = await safeJson(req),
    expected = crypto
      .createHash("sha512")
      .update(
        `${b.order_id}${b.status_code}${b.gross_amount}${env("MIDTRANS_SERVER_KEY")}`,
      )
      .digest("hex"),
    provided = String(b.signature_key || "");
  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  )
    return out({ error: "Invalid signature" }, 401);
  const map = {
      settlement: "settlement",
      capture: "capture",
      pending: "pending",
      deny: "deny",
      cancel: "cancel",
      expire: "expire",
      refund: "refund",
      partial_refund: "refund",
    },
    status = map[b.transaction_status] || "pending";
  await supabase("/rest/v1/payments", {
    method: "PATCH",
    service: true,
    query: { order_id: `eq.${b.order_id}` },
    body: {
      status,
      transaction_id: b.transaction_id || null,
      raw_notification: b,
      updated_at: new Date().toISOString(),
    },
  });
  if (["settlement", "capture"].includes(status)) {
    const rows = await supabase("/rest/v1/payments", {
        service: true,
        query: {
          order_id: `eq.${b.order_id}`,
          select:
            "id,user_id,program_id,amount,profiles:user_id(email,full_name),programs:program_id(title)",
          limit: "1",
        },
      }),
      p = rows[0];
    if (p?.program_id) {
      await supabase("/rest/v1/enrollments", {
        method: "POST",
        service: true,
        body: {
          user_id: p.user_id,
          program_id: p.program_id,
          payment_id: p.id,
          status: "active",
        },
        prefer: "resolution=merge-duplicates,return=representation",
      });
      await notify(
        p.user_id,
        "Program aktif",
        `Pembayaran ${b.order_id} berhasil. Program Anda telah diaktifkan.`,
        "/dashboard",
      );
      await sendEmail(
        p.profiles?.email,
        "Program IELTS_MATE aktif",
        `<p>Halo ${htmlEscape(p.profiles?.full_name || "")},</p><p>Pembayaran berhasil dan program <b>${htmlEscape(p.programs?.title || "")}</b> telah aktif.</p>`,
      );
    }
  }
  return out({ ok: true });
}

async function verifyCertificate(url) {
  const code = clean(url.searchParams.get("code"), 100);
  if (!code) return out({ error: "Nomor sertifikat diperlukan." }, 400);
  const rows = await supabase("/rest/v1/rpc/verify_recognition_certificate", {
    method: "POST",
    service: true,
    body: { code },
  });
  return rows?.length
    ? out(rows[0])
    : out({ error: "Sertifikat tidak ditemukan." }, 404);
}
async function certificates(req, u, url) {
  if (req.method === "GET") {
    const q = allow(u, ["admin"])
      ? { select: "*", order: "issued_at.desc" }
      : {
          user_id: `eq.${u.id}`,
          select:
            "certificate_no,participant_name,certificate_type,program_title,completion_hours,criteria,issued_at,revoked_at,disclaimer",
          order: "issued_at.desc",
        };
    return out(
      await supabase("/rest/v1/certificates", {
        token: u.token,
        service: allow(u, ["admin"]),
        query: q,
      }),
    );
  }
  if (!allow(u, ["admin"])) return out({ error: "Forbidden" }, 403);
  const b = await safeJson(req);
  if (url.pathname.endsWith("/revoke")) {
    const number = clean(b.number, 100);
    await supabase("/rest/v1/certificates", {
      method: "PATCH",
      service: true,
      query: { certificate_no: `eq.${number}` },
      body: { revoked_at: new Date().toISOString() },
    });
    audit(u, "certificate.revoke", "certificate", number);
    return out({ ok: true });
  }
  const email = clean(b.email, 200).toLowerCase(),
    profiles = await supabase("/rest/v1/profiles", {
      service: true,
      query: { email: `eq.${email}`, select: "id,email", limit: "1" },
    });
  if (!profiles.length || !b.number || !b.name || !b.program || !b.type)
    return out(
      { error: "Data sertifikat belum lengkap atau peserta tidak ditemukan." },
      400,
    );
  const hash = crypto
      .createHash("sha256")
      .update(
        `${b.number}:${profiles[0].id}:${env("SUPABASE_SERVICE_ROLE_KEY")}`,
      )
      .digest("hex"),
    rows = await supabase("/rest/v1/certificates", {
      method: "POST",
      service: true,
      body: {
        user_id: profiles[0].id,
        certificate_no: clean(b.number, 100),
        verification_hash: hash,
        participant_name: clean(b.name, 120),
        certificate_type: clean(b.type, 80),
        program_title: clean(b.program, 180),
        completion_hours: Number(b.hours) || null,
        criteria: clean(b.criteria, 300),
        issued_at: b.issuedAt || new Date().toISOString(),
      },
    });
  await notify(
    profiles[0].id,
    "Sertifikat diterbitkan",
    `Sertifikat ${b.number} tersedia.`,
    "/dashboard",
  );
  audit(u, "certificate.issue", "certificate", b.number);
  return out(rows[0], 201);
}
async function institution(req, u) {
  if (req.method === "GET") {
    const rows = await supabase("/rest/v1/institution_profile", {
        query: { id: "eq.true", select: "*", limit: "1" },
      }),
      x = rows[0];
    if (!x) return out({ error: "Profil lembaga belum tersedia." }, 404);
    return out({
      name: x.name,
      legalPosition: x.legal_position,
      profileStatement: x.profile_statement,
      vision: x.vision,
      mission: x.mission,
      values: x.values_list,
      learningModel: x.learning_model,
      founderName: x.founder_name,
      founderTitle: x.founder_title,
      address: x.address,
      phone: x.phone,
      email: x.email,
      disclaimer: x.disclaimer,
    });
  }
  if (!allow(u, ["admin"])) return out({ error: "Forbidden" }, 403);
  const b = await safeJson(req),
    row = {
      name: clean(b.name, 120),
      legal_position: clean(b.legalPosition, 180),
      profile_statement: clean(b.profileStatement, 2000),
      vision: clean(b.vision, 1000),
      mission: parseList(b.mission, 10),
      values_list: parseList(b.values, 10),
      learning_model: parseList(b.learningModel, 10),
      founder_name: clean(b.founderName, 120),
      founder_title: clean(b.founderTitle, 120),
      address: clean(b.address, 500),
      phone: clean(b.phone, 50),
      email: clean(b.email, 200),
      disclaimer: clean(b.disclaimer, 1000),
      updated_at: new Date().toISOString(),
    };
  const rows = await supabase("/rest/v1/institution_profile", {
    method: "PATCH",
    service: true,
    query: { id: "eq.true" },
    body: row,
  });
  audit(u, "institution.update", "institution", "primary");
  return out(rows[0]);
}
async function signUpload(req, u) {
  const b = await safeJson(req),
    bucket = clean(b.bucket, 20);
  if (!["writing", "speaking"].includes(bucket))
    return out({ error: "Bucket tidak diizinkan." }, 400);
  const ext = clean(b.extension, 10)
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase(),
    size = Number(b.size || 0),
    allowed =
      bucket === "speaking"
        ? ["webm", "mp3", "m4a", "wav"]
        : ["pdf", "docx", "txt"];
  if (!allowed.includes(ext) || size <= 0 || size > 15_000_000)
    return out(
      { error: "Jenis atau ukuran berkas tidak diizinkan (maksimum 15 MB)." },
      400,
    );
  const path = `${u.id}/${crypto.randomUUID()}.${ext}`;
  const x = await supabase(`/storage/v1/object/upload/sign/${bucket}/${path}`, {
    method: "POST",
    token: u.token,
    body: { upsert: false },
  });
  const rawSigned = x.signedUrl || x.signedURL || x.url;
  const base = env("SUPABASE_URL").replace(/\/$/, "");
  const signedUrl = /^https?:\/\//.test(rawSigned || "")
    ? rawSigned
    : `${base}${String(rawSigned || "").startsWith("/storage/v1") ? "" : "/storage/v1"}${String(rawSigned || "").startsWith("/") ? "" : "/"}${rawSigned || ""}`;
  return out({ bucket, path, signedUrl, token: x.token });
}

async function adminTests(req, u, url) {
  if (!allow(u, ["admin"])) return out({ error: "Forbidden" }, 403);
  if (req.method === "GET")
    return out(
      await supabase("/rest/v1/tests", {
        service: true,
        query: { select: "*", order: "updated_at.desc" },
      }),
    );
  const b = await safeJson(req),
    id = url.searchParams.get("id") || b.id,
    row = {
      slug: clean(b.slug, 100),
      title: clean(b.title, 180),
      test_type: clean(b.testType, 30),
      duration_minutes: Number(b.durationMinutes) || 1,
      price: Math.max(0, Number(b.price) || 0),
      instructions: clean(b.instructions, 5000),
      validation_status: clean(b.validationStatus, 20) || "unvalidated",
      validation_notes: clean(b.validationNotes, 3000) || null,
      status: clean(b.status, 20) || "draft",
      updated_at: new Date().toISOString(),
    };
  if (
    row.status === "published" &&
    !["approved", "classroom_ready"].includes(row.validation_status)
  )
    return out(
      {
        error:
          "Tes hanya dapat dipublikasikan setelah validation status disetujui.",
      },
      400,
    );
  if (req.method === "POST") {
    const rows = await supabase("/rest/v1/tests", {
      method: "POST",
      service: true,
      body: row,
    });
    audit(u, "test.create", "test", rows[0]?.id);
    return out(rows[0], 201);
  }
  const rows = await supabase("/rest/v1/tests", {
    method: "PATCH",
    service: true,
    query: { id: `eq.${id}` },
    body: row,
  });
  audit(u, "test.update", "test", id);
  return out(rows[0]);
}
async function adminQuestions(req, u, url) {
  if (!allow(u, ["admin"])) return out({ error: "Forbidden" }, 403);
  if (req.method === "GET")
    return out(
      await supabase("/rest/v1/questions", {
        service: true,
        query: {
          select:
            "id,test_id,section,item_type,prompt,passage,audio_url,audio_text,options,answer_key,rubric,status,position,rights_status,source_reference,reviewed_by,reviewed_at,tests:test_id(title,slug)",
          order: "test_id.asc,position.asc",
        },
      }),
    );
  const b = await safeJson(req),
    id = url.searchParams.get("id") || b.id,
    row = {
      test_id: clean(b.testId, 60),
      section: clean(b.section, 80),
      item_type: clean(b.itemType, 50),
      prompt: clean(b.prompt, 5000),
      passage: clean(b.passage, 10000) || null,
      audio_url: safeHttpsUrl(b.audioUrl),
      audio_text: clean(b.audioText, 12000) || null,
      options: parseList(b.options, 20),
      answer_key: b.answerKey === undefined ? null : b.answerKey,
      rubric: b.rubric || null,
      rights_status: clean(b.rightsStatus, 20) || "unverified",
      source_reference: clean(b.sourceReference, 1000) || null,
      status: clean(b.status, 20) || "draft",
      position: Number(b.position) || 0,
      reviewed_by: clean(b.status, 20) === "published" ? u.id : null,
      reviewed_at:
        clean(b.status, 20) === "published" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
  if (
    row.status === "published" &&
    !["original", "licensed", "cleared"].includes(row.rights_status)
  )
    return out(
      {
        error:
          "Soal hanya dapat dipublikasikan setelah hak konten diverifikasi.",
      },
      400,
    );
  if (b.audioUrl && !row.audio_url)
    return out({ error: "URL audio produksi harus menggunakan HTTPS." }, 400);
  if (req.method === "POST") {
    const rows = await supabase("/rest/v1/questions", {
      method: "POST",
      service: true,
      body: row,
    });
    audit(u, "question.create", "question", rows[0]?.id);
    return out(rows[0], 201);
  }
  const rows = await supabase("/rest/v1/questions", {
    method: "PATCH",
    service: true,
    query: { id: `eq.${id}` },
    body: row,
  });
  audit(u, "question.update", "question", id);
  return out(rows[0]);
}
async function testPackage(slug, u) {
  const tests = await supabase("/rest/v1/tests", {
      token: u.token,
      query: {
        slug: `eq.${clean(slug, 100)}`,
        status: "eq.published",
        validation_status: "in.(approved,classroom_ready)",
        select:
          "id,slug,title,test_type,duration_minutes,instructions,version,validation_status",
        limit: "1",
      },
    }),
    t = tests[0];
  if (!t) return out({ error: "Paket tes tidak tersedia." }, 404);
  const q = await supabase("/rest/v1/questions", {
    token: u.token,
    service: true,
    query: {
      test_id: `eq.${t.id}`,
      status: "eq.published",
      rights_status: "in.(original,licensed,cleared)",
      select:
        "id,section,item_type,prompt,passage,audio_url,audio_text,options,rubric,position",
      order: "position.asc",
    },
  });
  return out({ ...t, questions: q });
}
async function startTest(req, u) {
  const b = await safeJson(req),
    slug = clean(b.testSlug, 100),
    tests = await supabase("/rest/v1/tests", {
      service: true,
      query: {
        slug: `eq.${slug}`,
        status: "eq.published",
        validation_status: "in.(approved,classroom_ready)",
        select: "id,slug,title",
        limit: "1",
      },
    }),
    t = tests[0];
  if (!t) return out({ error: "Paket tes tidak tersedia." }, 404);
  const rows = await supabase("/rest/v1/attempts", {
    method: "POST",
    token: u.token,
    body: {
      user_id: u.id,
      test_id: t.id,
      test_slug: t.slug,
      status: "started",
      metadata: { label: t.title, source: "production-test-engine" },
    },
  });
  audit(u, "attempt.start", "attempt", rows[0]?.id, { slug });
  return out(rows[0], 201);
}
const norm = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.!?]$/, "");
async function submitTest(req, u) {
  const b = await safeJson(req),
    id = clean(b.attemptId, 60),
    attempts = await supabase("/rest/v1/attempts", {
      service: true,
      query: {
        id: `eq.${id}`,
        user_id: `eq.${u.id}`,
        status: "eq.started",
        select: "id,test_id,test_slug,started_at",
        limit: "1",
      },
    }),
    a = attempts[0];
  if (!a)
    return out({ error: "Attempt tidak ditemukan atau sudah disubmit." }, 404);
  const qs = await supabase("/rest/v1/questions", {
      service: true,
      query: {
        test_id: `eq.${a.test_id}`,
        status: "eq.published",
        select: "id,item_type,answer_key,rubric",
        rights_status: "in.(original,licensed,cleared)",
      },
    }),
    answers = b.answers && typeof b.answers === "object" ? b.answers : {};
  let correct = 0,
    total = 0;
  const rows = [];
  for (const q of qs) {
    const value = answers[q.id] ?? null,
      hasKey = q.answer_key !== null && q.answer_key !== undefined;
    let ok = null;
    if (hasKey) {
      total++;
      const expected = Array.isArray(q.answer_key)
        ? q.answer_key
        : [q.answer_key];
      ok = expected.some((x) => norm(x) === norm(value));
      if (ok) correct++;
    }
    rows.push({
      attempt_id: a.id,
      question_id: q.id,
      item_key: q.id,
      answer: { value },
      is_correct: ok,
      score: ok === null ? null : ok ? 1 : 0,
    });
  }
  if (rows.length)
    await supabase("/rest/v1/answers", {
      method: "POST",
      service: true,
      body: rows,
      prefer: "resolution=merge-duplicates,return=representation",
    });
  const score = total ? Math.round((correct / total) * 10000) / 100 : null;
  const recordings =
    b.recordings && typeof b.recordings === "object" ? b.recordings : {};
  const reviewRows = qs
    .filter((q) => ["writing", "speaking"].includes(q.item_type))
    .map((q) => ({
      attempt_id: a.id,
      user_id: u.id,
      kind: q.item_type,
      response_text: clean(answers[q.id], 20000) || null,
      file_path:
        q.item_type === "speaking"
          ? clean(recordings[q.id], 500) || null
          : null,
      status: "queued",
    }))
    .filter((row) => row.response_text || row.file_path);
  if (reviewRows.length)
    await supabase("/rest/v1/submissions", {
      method: "POST",
      service: true,
      body: reviewRows,
    });
  await supabase("/rest/v1/attempts", {
    method: "PATCH",
    service: true,
    query: { id: `eq.${a.id}` },
    body: {
      status: "submitted",
      submitted_at: new Date().toISOString(),
      elapsed_seconds: Math.max(
        0,
        Math.round((Date.now() - new Date(a.started_at).getTime()) / 1000),
      ),
      objective_score: score,
    },
  });
  audit(u, "attempt.submit", "attempt", a.id, { score, total });
  return out({
    attemptId: a.id,
    objectiveScore: score,
    correct,
    total,
    requiresHumanReview: qs.some((q) =>
      ["writing", "speaking"].includes(q.item_type),
    ),
  });
}

async function privacyExport(u) {
  const query = (table, select) =>
    supabase(`/rest/v1/${table}`, {
      service: true,
      query: { user_id: `eq.${u.id}`, select, limit: "1000" },
    });
  const [enrollments, attempts, submissions, payments, certificates] =
    await Promise.all([
      query(
        "enrollments",
        "id,status,progress,started_at,ends_at,program_id,class_id",
      ),
      query(
        "attempts",
        "id,test_slug,status,started_at,submitted_at,objective_score,final_score,metadata",
      ),
      query(
        "submissions",
        "id,kind,response_text,file_path,status,submitted_at,due_at",
      ),
      query(
        "payments",
        "order_id,program_id,test_id,amount,status,created_at,updated_at",
      ),
      query(
        "certificates",
        "certificate_no,participant_name,certificate_type,program_title,completion_hours,criteria,issued_at,revoked_at",
      ),
    ]);
  audit(u, "privacy.export", "profile", u.id);
  return out({
    generatedAt: new Date().toISOString(),
    profile: u.profile,
    enrollments,
    attempts,
    submissions,
    payments,
    certificates,
  });
}
async function privacyRequest(req, u) {
  const b = await safeJson(req),
    type = clean(b.type, 30);
  if (!["delete", "correct", "restrict"].includes(type))
    return out({ error: "Jenis permintaan tidak valid." }, 400);
  const rows = await supabase("/rest/v1/privacy_requests", {
    method: "POST",
    service: true,
    body: {
      user_id: u.id,
      request_type: type,
      details: clean(b.details, 2000),
      status: "received",
    },
  });
  audit(u, "privacy.request", "privacy_request", rows[0]?.id, { type });
  return out(
    { id: rows[0]?.id, message: "Permintaan diterima dan akan diverifikasi." },
    201,
  );
}
async function supportTickets(req, u) {
  if (req.method === "GET") {
    const admin = allow(u, ["admin"]);
    return out(
      await supabase("/rest/v1/support_tickets", {
        service: admin,
        token: u.token,
        query: admin
          ? { select: "*", order: "created_at.desc", limit: "500" }
          : {
              user_id: `eq.${u.id}`,
              select:
                "id,category,subject,status,priority,created_at,updated_at",
              order: "created_at.desc",
              limit: "100",
            },
      }),
    );
  }
  const b = await safeJson(req),
    category = clean(b.category, 40),
    subject = clean(b.subject, 180),
    message = clean(b.message, 5000);
  await enforceRateLimit(req, "support", 10, 3600, u.id);
  if (!subject || !message)
    return out({ error: "Subjek dan pesan diperlukan." }, 400);
  const rows = await supabase("/rest/v1/support_tickets", {
    method: "POST",
    service: true,
    body: {
      user_id: u.id,
      category: category || "general",
      subject,
      message,
      status: "open",
      priority: "normal",
    },
  });
  audit(u, "support.create", "support_ticket", rows[0]?.id);
  return out(rows[0], 201);
}
async function readiness() {
  requireConfig([
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SITE_URL",
  ]);
  await supabase("/rest/v1/institution_profile", {
    service: true,
    query: { select: "id", limit: "1" },
  });
  return out({
    ok: true,
    database: "reachable",
    authentication: "configured",
    siteUrl: new URL(env("SITE_URL")).origin,
    checkedAt: new Date().toISOString(),
  });
}

export default async (request) => {
  try {
    const url = new URL(request.url),
      path = url.pathname.replace(/^\/api\/?/, "");
    const origin = request.headers.get("origin"),
      configuredOrigin = env("SITE_URL");
    if (
      request.method !== "GET" &&
      configuredOrigin &&
      path !== "payments/webhook"
    ) {
      if (
        !origin ||
        new URL(origin).origin !== new URL(configuredOrigin).origin
      )
        return out({ error: "Origin tidak diizinkan." }, 403);
    }
    if (path === "health")
      return out({
        ok: true,
        service: "IELTS_MATE API",
        mode: env("DEMO_MODE") === "false" ? "production" : "configuration",
        time: new Date().toISOString(),
      });
    if (path === "config")
      return out({
        production: env("DEMO_MODE") === "false",
        midtransClientKey: env("MIDTRANS_CLIENT_KEY") || null,
        midtransProduction: env("MIDTRANS_IS_PRODUCTION") === "true",
      });
    if (path === "public" && request.method === "GET") return publicData();
    if (path === "institution" && request.method === "GET")
      return institution(request, null);
    if (path === "auth/register" && request.method === "POST")
      return register(request);
    if (path === "auth/login" && request.method === "POST")
      return login(request);
    if (path === "auth/recover" && request.method === "POST")
      return recover(request);
    if (path === "auth/refresh" && request.method === "POST")
      return refreshSession(request);
    if (path === "auth/logout" && request.method === "POST")
      return logout(request);
    if (path === "health/ready" && request.method === "GET")
      return await readiness();
    if (path === "payments/webhook" && request.method === "POST")
      return midtransWebhook(request);
    if (path === "certificates/verify" && request.method === "GET")
      return verifyCertificate(url);
    if (path === "leads" && request.method === "POST")
      return leads(request, null, url);
    const u = await actor(request);
    if (!u) return out({ error: "Unauthorized" }, 401);
    if (path === "me" && request.method === "GET") return out(u.profile);
    if (path === "privacy/export" && request.method === "GET")
      return privacyExport(u);
    if (path === "privacy/request" && request.method === "POST")
      return privacyRequest(request, u);
    if (path === "support/tickets" && ["GET", "POST"].includes(request.method))
      return supportTickets(request, u);
    if (path.startsWith("tests/") && request.method === "GET")
      return testPackage(path.split("/")[1], u);
    if (path === "test-attempts/start" && request.method === "POST")
      return startTest(request, u);
    if (path === "test-attempts/submit" && request.method === "POST")
      return submitTest(request, u);
    if (path === "profile" && ["GET", "PATCH"].includes(request.method))
      return profile(request, u);
    if (path === "attempts" && ["GET", "POST"].includes(request.method))
      return attempts(request, u);
    if (
      path === "enrollments" &&
      ["GET", "POST", "PATCH"].includes(request.method)
    )
      return enrollments(request, u);
    if (path === "schedules" && request.method === "GET")
      return schedules(request, u);
    if (path === "submissions" && ["GET", "POST"].includes(request.method))
      return submissions(request, u);
    if (path === "evaluations" && request.method === "POST")
      return evaluate(request, u);
    if (path === "assignments" && ["GET", "POST"].includes(request.method))
      return assignments(request, u);
    if (path === "notifications" && ["GET", "PATCH"].includes(request.method))
      return notifications(request, u);
    if (path === "uploads/sign" && request.method === "POST")
      return signUpload(request, u);
    if (path === "payments/create" && request.method === "POST")
      return createPayment(request, u);
    if (
      (path === "certificates" || path === "certificates/revoke") &&
      ["GET", "POST"].includes(request.method)
    )
      return certificates(request, u, url);
    if (path === "institution" && request.method === "PUT")
      return institution(request, u);
    if (
      path === "admin/tests" &&
      ["GET", "POST", "PATCH"].includes(request.method)
    )
      return adminTests(request, u, url);
    if (
      path === "admin/questions" &&
      ["GET", "POST", "PATCH"].includes(request.method)
    )
      return adminQuestions(request, u, url);
    if (path === "admin/stats" && request.method === "GET")
      return adminStats(u);
    if (path === "admin/users" && ["GET", "PATCH"].includes(request.method))
      return adminUsers(request, u, url);
    if (
      path === "admin/programs" &&
      ["GET", "POST", "PATCH"].includes(request.method)
    )
      return adminPrograms(request, u, url);
    if (path === "admin/leads" && ["GET", "PATCH"].includes(request.method))
      return leads(request, u, url);
    if (path === "admin/content" && ["GET", "PUT"].includes(request.method))
      return content(request, u);
    if (path === "admin/audit" && request.method === "GET") return auditList(u);
    if (path === "classes" && ["GET", "POST", "PATCH"].includes(request.method))
      return classOps(request, u, url);
    if (
      path === "class-students" &&
      request.method === "GET" &&
      allow(u, ["instructor", "admin"])
    )
      return instructorStudents(u, url);
    if (path === "materials" && ["GET", "POST"].includes(request.method))
      return materials(request, u);
    if (path === "attendance" && ["GET", "POST"].includes(request.method))
      return attendance(request, u);
    return out({ error: "Not found" }, 404);
  } catch (e) {
    console.error(e);
    return out(
      {
        error:
          e.status && e.status < 500 ? e.message : "Server request failed.",
      },
      e.status || 500,
    );
  }
};
export const config = { path: "/api/*" };
