const STORE_NAME = "دیجی‌ماریکسو";
const STORE_EN = "DigiMarixo";
const DEFAULT_ADMIN_USERNAME = "admin";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // =========================
      // DATABASE
      // =========================
      await initDB(env);

      // =========================
      // PUBLIC
      // =========================
      if (path === "/" && method === "GET") {
        return html(homePage());
      }

      if (path === "/health" && method === "GET") {
        let database = false;

        try {
          if (env.DB) {
            await env.DB.prepare("SELECT 1").first();
            database = true;
          }
        } catch (_) {
          database = false;
        }

        return json({
          ok: true,
          store: STORE_EN,
          database
        });
      }

      // =========================
      // PRODUCTS API
      // =========================
      if (path === "/api/products" && method === "GET") {
        try {
          const products = await getProducts(env);

          return json({
            ok: true,
            products
          });
        } catch (_) {
          return json({
            ok: false,
            error: "خطا در دریافت محصولات از پایگاه داده."
          }, 500);
        }
      }

      if (path.startsWith("/product/") && method === "GET") {
        const id = Number(path.split("/")[2]);

        if (!Number.isInteger(id) || id <= 0) {
          return html(notFoundPage(), 404);
        }

        const product = await getProduct(env, id);

        if (!product) {
          return html(notFoundPage(), 404);
        }

        return html(productPage(product));
      }

      // =========================
      // USER AUTH
      // =========================
      if (path === "/api/register" && method === "POST") {
        return await register(request, env);
      }

      if (path === "/api/login" && method === "POST") {
        return await login(request, env);
      }

      if (path === "/api/logout" && method === "POST") {
        return await logout(request, env);
      }

      if (path === "/api/me" && method === "GET") {
        const user = await currentUser(request, env);

        return json({
          ok: true,
          user: user
            ? {
                id: user.id,
                username: user.username,
                email: user.email
              }
            : null
        });
      }

      // =========================
      // ORDERS
      // =========================
      if (path === "/api/orders" && method === "GET") {
        const user = await currentUser(request, env);

        if (!user) {
          return json({
            ok: false,
            error: "ابتدا وارد حساب کاربری شوید."
          }, 401);
        }

        const orders = await getUserOrders(env, user.id);

        return json({
          ok: true,
          orders
        });
      }

      if (path === "/api/orders" && method === "POST") {
        const user = await currentUser(request, env);

        if (!user) {
          return json({
            ok: false,
            error: "ابتدا وارد حساب کاربری شوید."
          }, 401);
        }

        let body;

        try {
          body = await request.json();
        } catch (_) {
          return json({
            ok: false,
            error: "اطلاعات ارسال‌شده نامعتبر است."
          }, 400);
        }

        const productId = Number(body.product_id);

        if (!Number.isInteger(productId) || productId <= 0) {
          return json({
            ok: false,
            error: "محصول نامعتبر است."
          }, 400);
        }

        const product = await getProduct(env, productId);

        if (!product) {
          return json({
            ok: false,
            error: "محصول پیدا نشد."
          }, 404);
        }

        const result = await env.DB.prepare(`
          INSERT INTO orders
          (user_id, product_id, status, created_at)
          VALUES (?, ?, 'pending', ?)
        `)
          .bind(
            user.id,
            productId,
            new Date().toISOString()
          )
          .run();

        return json({
          ok: true,
          message: "سفارش با موفقیت ثبت شد.",
          order_id: result.meta?.last_row_id || null
        });
      }

      // =========================
      // ADMIN AUTH
      // =========================
      if (path === "/api/admin/login" && method === "POST") {
        return await adminLogin(request, env);
      }

      if (path === "/api/admin/logout" && method === "POST") {
        return await adminLogout(request, env);
      }

      if (path === "/api/admin/me" && method === "GET") {
        const admin = await isAdmin(request, env);

        return json({
          ok: true,
          admin
        });
      }

      // =========================
      // ADMIN PRODUCTS
      // =========================
      if (path === "/api/admin/products" && method === "GET") {
        if (!(await isAdmin(request, env))) {
          return json({
            ok: false,
            error: "دسترسی غیرمجاز."
          }, 401);
        }

        return json({
          ok: true,
          products: await getProducts(env)
        });
      }

      if (path === "/api/admin/products" && method === "POST") {
        if (!(await isAdmin(request, env))) {
          return json({
            ok: false,
            error: "دسترسی غیرمجاز."
          }, 401);
        }

        let body;

        try {
          body = await request.json();
        } catch (_) {
          return json({
            ok: false,
            error: "اطلاعات نامعتبر است."
          }, 400);
        }

        const name = String(body.name || "").trim();
        const description = String(body.description || "").trim();
        const image = String(body.image || "🛍️").trim();
        const price = Number(body.price);

        if (!name) {
          return json({
            ok: false,
            error: "نام محصول الزامی است."
          }, 400);
        }

        if (!Number.isFinite(price) || price < 0) {
          return json({
            ok: false,
            error: "قیمت محصول نامعتبر است."
          }, 400);
        }

        const result = await env.DB.prepare(`
          INSERT INTO products
          (name, description, price, image, created_at)
          VALUES (?, ?, ?, ?, ?)
        `)
          .bind(
            name,
            description,
            price,
            image || "🛍️",
            new Date().toISOString()
          )
          .run();

        return json({
          ok: true,
          message: "محصول با موفقیت اضافه شد.",
          product_id: result.meta?.last_row_id || null
        });
      }

      if (path === "/api/admin/products" && method === "DELETE") {
        if (!(await isAdmin(request, env))) {
          return json({
            ok: false,
            error: "دسترسی غیرمجاز."
          }, 401);
        }

        const id = Number(url.searchParams.get("id"));

        if (!Number.isInteger(id) || id <= 0) {
          return json({
            ok: false,
            error: "شناسه محصول نامعتبر است."
          }, 400);
        }

        const used = await env.DB.prepare(`
          SELECT id
          FROM orders
          WHERE product_id = ?
          LIMIT 1
        `)
          .bind(id)
          .first();

        if (used) {
          return json({
            ok: false,
            error: "این محصول در سفارش‌ها استفاده شده و قابل حذف نیست."
          }, 400);
        }

        await env.DB.prepare(`
          DELETE FROM products
          WHERE id = ?
        `)
          .bind(id)
          .run();

        return json({
          ok: true,
          message: "محصول حذف شد."
        });
      }

      // =========================
      // ADMIN ORDERS
      // =========================
      if (path === "/api/admin/orders" && method === "GET") {
        if (!(await isAdmin(request, env))) {
          return json({
            ok: false,
            error: "دسترسی غیرمجاز."
          }, 401);
        }

        const orders = await getAdminOrders(env);

        return json({
          ok: true,
          orders
        });
      }

      if (path === "/api/admin/orders/status" && method === "POST") {
        if (!(await isAdmin(request, env))) {
          return json({
            ok: false,
            error: "دسترسی غیرمجاز."
          }, 401);
        }

        let body;

        try {
          body = await request.json();
        } catch (_) {
          return json({
            ok: false,
            error: "اطلاعات نامعتبر است."
          }, 400);
        }

        const orderId = Number(body.order_id);
        const status = String(body.status || "").trim();

        const allowed = [
          "pending",
          "paid",
          "completed",
          "cancelled"
        ];

        if (!Number.isInteger(orderId) || orderId <= 0) {
          return json({
            ok: false,
            error: "شناسه سفارش نامعتبر است."
          }, 400);
        }

        if (!allowed.includes(status)) {
          return json({
            ok: false,
            error: "وضعیت سفارش نامعتبر است."
          }, 400);
        }

        await env.DB.prepare(`
          UPDATE orders
          SET status = ?
          WHERE id = ?
        `)
          .bind(status, orderId)
          .run();

        return json({
          ok: true,
          message: "وضعیت سفارش به‌روزرسانی شد."
        });
      }

      // =========================
      // PAGES
      // =========================
      if (path === "/account" && method === "GET") {
        return html(accountPage());
      }

      if (path === "/admin" && method === "GET") {
        return html(adminPage());
      }

      return html(notFoundPage(), 404);

    } catch (error) {
      return json({
        ok: false,
        error: "Internal Server Error"
      }, 500);
    }
  }
};


// =====================================================
// DATABASE
// =====================================================

async function initDB(env) {
  if (!env.DB) {
    throw new Error("D1 binding DB is missing.");
  }

  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL DEFAULT 0,
        image TEXT,
        created_at TEXT NOT NULL
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )
    `)
  ]);
}


// =====================================================
// PRODUCTS
// =====================================================

async function getProducts(env) {
  const result = await env.DB.prepare(`
    SELECT
      id,
      name,
      description,
      price,
      image,
      created_at
    FROM products
    ORDER BY id DESC
  `).all();

  return result.results || [];
}


async function getProduct(env, id) {
  return await env.DB.prepare(`
    SELECT
      id,
      name,
      description,
      price,
      image,
      created_at
    FROM products
    WHERE id = ?
    LIMIT 1
  `)
    .bind(id)
    .first();
}


// =====================================================
// USER AUTH
// =====================================================

async function register(request, env) {
  let body;

  try {
    body = await request.json();
  } catch (_) {
    return json({
      ok: false,
      error: "اطلاعات ثبت‌نام نامعتبر است."
    }, 400);
  }

  const username = String(body.username || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!username || !email || !password) {
    return json({
      ok: false,
      error: "همه فیلدها الزامی هستند."
    }, 400);
  }

  if (username.length < 3) {
    return json({
      ok: false,
      error: "نام کاربری باید حداقل ۳ کاراکتر باشد."
    }, 400);
  }

  if (password.length < 6) {
    return json({
      ok: false,
      error: "رمز عبور باید حداقل ۶ کاراکتر باشد."
    }, 400);
  }

  const existing = await env.DB.prepare(`
    SELECT id
    FROM users
    WHERE username = ? OR email = ?
    LIMIT 1
  `)
    .bind(username, email)
    .first();

  if (existing) {
    return json({
      ok: false,
      error: "نام کاربری یا ایمیل قبلاً ثبت شده است."
    }, 409);
  }

  const passwordHash = await hashPassword(password);

  const result = await env.DB.prepare(`
    INSERT INTO users
    (username, email, password_hash, created_at)
    VALUES (?, ?, ?, ?)
  `)
    .bind(
      username,
      email,
      passwordHash,
      new Date().toISOString()
    )
    .run();

  return json({
    ok: true,
    message: "حساب کاربری با موفقیت ایجاد شد.",
    user_id: result.meta?.last_row_id || null
  });
}


async function login(request, env) {
  let body;

  try {
    body = await request.json();
  } catch (_) {
    return json({
      ok: false,
      error: "اطلاعات ورود نامعتبر است."
    }, 400);
  }

  const identity = String(
    body.username ||
    body.email ||
    ""
  ).trim();

  const password = String(body.password || "");

  if (!identity || !password) {
    return json({
      ok: false,
      error: "نام کاربری/ایمیل و رمز عبور را وارد کنید."
    }, 400);
  }

  const user = await env.DB.prepare(`
    SELECT
      id,
      username,
      email,
      password_hash
    FROM users
    WHERE username = ? OR email = ?
    LIMIT 1
  `)
    .bind(identity, identity.toLowerCase())
    .first();

  if (!user) {
    return json({
      ok: false,
      error: "اطلاعات ورود صحیح نیست."
    }, 401);
  }

  const passwordHash = await hashPassword(password);

  if (passwordHash !== user.password_hash) {
    return json({
      ok: false,
      error: "اطلاعات ورود صحیح نیست."
    }, 401);
  }

  const token = randomToken();
  const now = new Date();
  const expires = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000
  );

  await env.DB.prepare(`
    INSERT INTO sessions
    (token, user_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `)
    .bind(
      token,
      user.id,
      now.toISOString(),
      expires.toISOString()
    )
    .run();

  return new Response(
    JSON.stringify({
      ok: true,
      message: "ورود موفق بود.",
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": cookieHeader(
          "dm_session",
          token,
          30 * 24 * 60 * 60
        )
      }
    }
  );
}


async function logout(request, env) {
  const token = getCookie(request, "dm_session");

  if (token) {
    await env.DB.prepare(`
      DELETE FROM sessions
      WHERE token = ?
    `)
      .bind(token)
      .run();
  }

  return new Response(
    JSON.stringify({
      ok: true
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": cookieHeader(
          "dm_session",
          "",
          0
        )
      }
    }
  );
}


async function currentUser(request, env) {
  const token = getCookie(request, "dm_session");

  if (!token) {
    return null;
  }

  const session = await env.DB.prepare(`
    SELECT
      sessions.token,
      sessions.expires_at,
      users.id,
      users.username,
      users.email
    FROM sessions
    JOIN users
      ON users.id = sessions.user_id
    WHERE sessions.token = ?
    LIMIT 1
  `)
    .bind(token)
    .first();

  if (!session) {
    return null;
  }

  if (
    new Date(session.expires_at).getTime() <=
    Date.now()
  ) {
    await env.DB.prepare(`
      DELETE FROM sessions
      WHERE token = ?
    `)
      .bind(token)
      .run();

    return null;
  }

  return session;
}


// =====================================================
// ORDERS
// =====================================================

async function getUserOrders(env, userId) {
  const result = await env.DB.prepare(`
    SELECT
      orders.id,
      orders.status,
      orders.created_at,
      products.name AS product_name,
      products.price AS price,
      products.image AS image
    FROM orders
    JOIN products
      ON products.id = orders.product_id
    WHERE orders.user_id = ?
    ORDER BY orders.id DESC
  `)
    .bind(userId)
    .all();

  return result.results || [];
}


async function getAdminOrders(env) {
  const result = await env.DB.prepare(`
    SELECT
      orders.id,
      orders.status,
      orders.created_at,
      users.username,
      users.email,
      products.name AS product_name,
      products.price AS price,
      products.image AS image
    FROM orders
    JOIN users
      ON users.id = orders.user_id
    JOIN products
      ON products.id = orders.product_id
    ORDER BY orders.id DESC
  `).all();

  return result.results || [];
}


// =====================================================
// ADMIN
// =====================================================

async function adminLogin(request, env) {
  let body;

  try {
    body = await request.json();
  } catch (_) {
    return json({
      ok: false,
      error: "اطلاعات ورود نامعتبر است."
    }, 400);
  }

  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!env.ADMIN_PASSWORD) {
    return json({
      ok: false,
      error: "ADMIN_PASSWORD در تنظیمات Worker ثبت نشده است."
    }, 500);
  }

  if (
    username !== DEFAULT_ADMIN_USERNAME ||
    password !== env.ADMIN_PASSWORD
  ) {
    return json({
      ok: false,
      error: "نام کاربری یا رمز مدیریت اشتباه است."
    }, 401);
  }

  const token = randomToken();
  const now = new Date();
  const expires = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000
  );

  await env.DB.prepare(`
    INSERT INTO admin_sessions
    (token, username, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `)
    .bind(
      token,
      username,
      now.toISOString(),
      expires.toISOString()
    )
    .run();

  return new Response(
    JSON.stringify({
      ok: true,
      message: "ورود مدیریت موفق بود."
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": cookieHeader(
          "dm_admin",
          token,
          7 * 24 * 60 * 60
        )
      }
    }
  );
}


async function adminLogout(request, env) {
  const token = getCookie(request, "dm_admin");

  if (token) {
    await env.DB.prepare(`
      DELETE FROM admin_sessions
      WHERE token = ?
    `)
      .bind(token)
      .run();
  }

  return new Response(
    JSON.stringify({
      ok: true
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": cookieHeader(
          "dm_admin",
          "",
          0
        )
      }
    }
  );
}


async function isAdmin(request, env) {
  const token = getCookie(request, "dm_admin");

  if (!token) {
    return false;
  }

  const session = await env.DB.prepare(`
    SELECT
      username,
      expires_at
    FROM admin_sessions
    WHERE token = ?
    LIMIT 1
  `)
    .bind(token)
    .first();

  if (!session) {
    return false;
  }

  if (
    new Date(session.expires_at).getTime() <=
    Date.now()
  ) {
    await env.DB.prepare(`
      DELETE FROM admin_sessions
      WHERE token = ?
    `)
      .bind(token)
      .run();

    return false;
  }

  return session.username === DEFAULT_ADMIN_USERNAME;
}


// =====================================================
// SECURITY / HELPERS
// =====================================================

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);

  const hash = await crypto.subtle.digest(
    "SHA-256",
    data
  );

  return [...new Uint8Array(hash)]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
}


function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return [...bytes]
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
}


function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";

  const parts = cookie.split(";");

  for (const part of parts) {
    const [key, ...value] = part.trim().split("=");

    if (key === name) {
      return value.join("=");
    }
  }

  return null;
}


function cookieHeader(name, value, maxAge) {
  return [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAge}`
  ].join("; ");
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function formatPrice(value) {
  const number = Number(value || 0);

  return number.toLocaleString("fa-IR") + " تومان";
}


function statusLabel(status) {
  const labels = {
    pending: "در انتظار بررسی",
    paid: "پرداخت شده",
    completed: "تکمیل شده",
    cancelled: "لغو شده"
  };

  return labels[status] || status;
}


function html(content, status = 200) {
  return new Response(content, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}


function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}


// =====================================================
// GLOBAL STYLE
// =====================================================

function basePage(title, content, scripts = "") {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#111827">
<meta name="description" content="دیجی‌ماریکسو؛ فروشگاه دیجیتال ساده، سریع و مناسب موبایل.">
<title>${escapeHtml(title)}</title>

<style>
* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family:
    Tahoma,
    Arial,
    sans-serif;
  color: #172033;
  background:
    radial-gradient(circle at 10% 10%, rgba(99,102,241,.08), transparent 30%),
    radial-gradient(circle at 90% 20%, rgba(168,85,247,.08), transparent 28%),
    #f6f7fb;
  min-height: 100vh;
}

a {
  color: inherit;
  text-decoration: none;
}

button,
input,
textarea,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

.container {
  width: min(1120px, calc(100% - 32px));
  margin: auto;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  backdrop-filter: blur(18px);
  background: rgba(255,255,255,.86);
  border-bottom: 1px solid rgba(15,23,42,.07);
}

.nav {
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  font-weight: 900;
}

.brand-mark {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: white;
  font-size: 21px;
  background:
    linear-gradient(135deg, #111827, #4f46e5 55%, #9333ea);
  box-shadow: 0 12px 30px rgba(79,70,229,.25);
}

.brand-text strong {
  display: block;
  font-size: 16px;
}

.brand-text small {
  display: block;
  color: #7c8497;
  font-size: 11px;
  margin-top: 2px;
  direction: ltr;
  text-align: right;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 7px;
}

.nav-links a {
  padding: 10px 13px;
  border-radius: 12px;
  color: #596276;
  font-size: 14px;
  font-weight: 700;
  transition: .2s;
}

.nav-links a:hover {
  background: #f0f1f7;
  color: #111827;
}

.page {
  padding: 32px 0 70px;
}

.hero {
  position: relative;
  overflow: hidden;
  border-radius: 32px;
  padding: 58px 44px;
  color: white;
  background:
    radial-gradient(circle at 85% 15%, rgba(255,255,255,.16), transparent 22%),
    radial-gradient(circle at 10% 90%, rgba(168,85,247,.30), transparent 25%),
    linear-gradient(135deg, #0f172a, #312e81 58%, #6d28d9);
  box-shadow: 0 25px 70px rgba(30,41,59,.22);
}

.hero:before,
.hero:after {
  content: "";
  position: absolute;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,.12);
}

.hero:before {
  width: 260px;
  height: 260px;
  left: -120px;
  top: -120px;
}

.hero:after {
  width: 360px;
  height: 360px;
  right: -180px;
  bottom: -200px;
}

.hero-content {
  position: relative;
  z-index: 2;
  max-width: 760px;
}

.eyebrow {
  display: inline-flex;
  padding: 8px 13px;
  border-radius: 999px;
  background: rgba(255,255,255,.10);
  border: 1px solid rgba(255,255,255,.15);
  font-size: 11px;
  letter-spacing: 1px;
  direction: ltr;
}

.hero h1 {
  margin: 18px 0 10px;
  font-size: clamp(30px, 6vw, 56px);
  line-height: 1.2;
  letter-spacing: -1.5px;
}

.hero h2 {
  margin: 0;
  font-size: clamp(20px, 4vw, 31px);
  line-height: 1.5;
}

.hero p {
  max-width: 680px;
  margin: 18px 0 0;
  color: rgba(255,255,255,.78);
  line-height: 2;
  font-size: 15px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 11px;
  margin-top: 26px;
}

.btn {
  border: 0;
  min-height: 46px;
  padding: 0 19px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 800;
  transition: transform .2s, box-shadow .2s, background .2s;
}

.btn:hover {
  transform: translateY(-2px);
}

.btn-primary {
  color: #111827;
  background: white;
  box-shadow: 0 12px 28px rgba(0,0,0,.16);
}

.btn-secondary {
  color: white;
  background: rgba(255,255,255,.10);
  border: 1px solid rgba(255,255,255,.18);
}

.btn-dark {
  color: white;
  background: #111827;
}

.btn-purple {
  color: white;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
}

.btn-danger {
  color: white;
  background: #dc2626;
}

.btn-light {
  color: #334155;
  background: #f1f5f9;
}

.section {
  margin-top: 46px;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 20px;
  margin-bottom: 18px;
}

.section-head h2 {
  margin: 0;
  font-size: 25px;
}

.section-head p {
  margin: 7px 0 0;
  color: #7b8497;
  font-size: 14px;
}

.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
}

.feature {
  background: rgba(255,255,255,.86);
  border: 1px solid #e9ebf2;
  border-radius: 22px;
  padding: 22px;
  box-shadow: 0 12px 35px rgba(15,23,42,.05);
}

.feature-icon {
  width: 47px;
  height: 47px;
  display: grid;
  place-items: center;
  border-radius: 15px;
  background: #f1f2ff;
  font-size: 23px;
  margin-bottom: 15px;
}

.feature h3 {
  margin: 0 0 7px;
  font-size: 16px;
}

.feature p {
  margin: 0;
  color: #778095;
  font-size: 13px;
  line-height: 1.9;
}

.products {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 17px;
}

.product-card {
  overflow: hidden;
  background: white;
  border: 1px solid #e7eaf1;
  border-radius: 24px;
  box-shadow: 0 13px 35px rgba(15,23,42,.06);
  transition: transform .2s, box-shadow .2s;
}

.product-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 20px 45px rgba(15,23,42,.10);
}

.product-image {
  min-height: 155px;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 30% 20%, rgba(99,102,241,.17), transparent 28%),
    linear-gradient(135deg, #f8faff, #eef0ff);
  font-size: 60px;
}

.product-body {
  padding: 20px;
}

.product-body h3 {
  margin: 0;
  font-size: 18px;
}

.product-body p {
  min-height: 48px;
  color: #727b90;
  font-size: 13px;
  line-height: 1.9;
}

.product-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
}

.price {
  font-weight: 900;
  color: #312e81;
  font-size: 15px;
}

.empty {
  grid-column: 1 / -1;
  padding: 35px;
  text-align: center;
  border-radius: 22px;
  background: white;
  border: 1px solid #e8eaf1;
  color: #727b90;
}

.error-box {
  grid-column: 1 / -1;
  padding: 25px;
  text-align: center;
  border-radius: 22px;
  background: #fff;
  border: 1px solid #fecaca;
  color: #7f1d1d;
}

.error-box span {
  display: block;
  margin: 8px 0 16px;
  color: #991b1b;
  font-size: 13px;
}

.panel {
  background: white;
  border: 1px solid #e7eaf1;
  border-radius: 24px;
  padding: 25px;
  box-shadow: 0 15px 40px rgba(15,23,42,.05);
}

.panel h2,
.panel h3 {
  margin-top: 0;
}

.form {
  display: grid;
  gap: 13px;
}

.input,
textarea,
select {
  width: 100%;
  min-height: 46px;
  padding: 0 14px;
  border: 1px solid #dfe3ec;
  border-radius: 13px;
  outline: none;
  background: white;
  color: #172033;
}

textarea {
  padding-top: 13px;
  min-height: 100px;
  resize: vertical;
}

.input:focus,
textarea:focus,
select:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 4px rgba(99,102,241,.10);
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18px;
}

.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
}

th,
td {
  padding: 13px 10px;
  border-bottom: 1px solid #edf0f5;
  text-align: right;
  font-size: 13px;
}

th {
  color: #566074;
  background: #fafbfc;
}

.notice {
  margin: 15px 0;
  padding: 13px 15px;
  border-radius: 13px;
  background: #f1f5f9;
  color: #475569;
  font-size: 13px;
}

.notice.success {
  background: #ecfdf5;
  color: #047857;
}

.notice.error {
  background: #fef2f2;
  color: #b91c1c;
}

.order-card {
  background: #fafbff;
  border: 1px solid #e9ebf3;
  border-radius: 18px;
  padding: 17px;
  margin-top: 12px;
}

.order-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.status {
  display: inline-flex;
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 11px;
  font-weight: 800;
}

.footer {
  margin-top: 65px;
  padding: 28px 0;
  border-top: 1px solid #e6e8ef;
  color: #7c8495;
  text-align: center;
  font-size: 13px;
}

.loading {
  grid-column: 1 / -1;
  padding: 38px;
  text-align: center;
  color: #737d91;
}

@media (max-width: 820px) {
  .nav {
    min-height: 65px;
  }

  .nav-links a {
    padding: 8px 7px;
    font-size: 12px;
  }

  .hero {
    padding: 40px 24px;
    border-radius: 25px;
  }

  .features,
  .products,
  .grid-3 {
    grid-template-columns: 1fr;
  }

  .grid-2 {
    grid-template-columns: 1fr;
  }

  .brand-text small {
    display: none;
  }
}

@media (max-width: 520px) {
  .container {
    width: min(100% - 20px, 1120px);
  }

  .nav {
    gap: 4px;
  }

  .brand-mark {
    width: 39px;
    height: 39px;
    border-radius: 12px;
  }

  .brand-text strong {
    font-size: 13px;
  }

  .nav-links {
    gap: 1px;
  }

  .nav-links a {
    font-size: 11px;
    padding: 7px 5px;
  }

  .hero h1 {
    font-size: 29px;
  }

  .hero h2 {
    font-size: 20px;
  }

  .section-head {
    display: block;
  }

  .actions .btn {
    width: 100%;
  }
}
</style>
</head>

<body>

<header class="topbar">
  <div class="container nav">

    <a href="/" class="brand">
      <span class="brand-mark">D</span>

      <span class="brand-text">
        <strong>${escapeHtml(STORE_NAME)}</strong>
        <small>${escapeHtml(STORE_EN)}</small>
      </span>
    </a>

    <nav class="nav-links">
      <a href="/">خانه</a>
      <a href="/#products-section">محصولات</a>
      <a href="/account">حساب من</a>
      <a href="/admin">مدیریت</a>
    </nav>

  </div>
</header>

<main class="page">
  <div class="container">
    ${content}
  </div>
</main>

<footer class="footer">
  <div class="container">
    <strong>${escapeHtml(STORE_NAME)}</strong>
    <div style="margin-top:7px">
      ${escapeHtml(STORE_EN)} — فروشگاه دیجیتال
    </div>

    <div style="margin-top:14px">
      <a href="/">خانه</a>
      &nbsp;•&nbsp;
      <a href="/account">حساب من</a>
      &nbsp;•&nbsp;
      <a href="/admin">مدیریت</a>
    </div>
  </div>
</footer>

${scripts}

</body>
</html>`;
}


// =====================================================
// HOME
// =====================================================

function homePage() {
  const content = `

<section class="hero">

  <div class="hero-content">

    <span class="eyebrow">
      DIGITAL PRODUCTS • SIMPLE • MODERN
    </span>

    <h1>
      فروشگاه دیجیتال ${escapeHtml(STORE_EN)}
    </h1>

    <h2>
      ابزارهای دیجیتال برای شما
    </h2>

    <p>
      در ${escapeHtml(STORE_NAME)} محصولات و ابزارهای دیجیتال
      را در یک فضای ساده، سریع و مناسب موبایل پیدا کنید.
    </p>

    <div class="actions">

      <a
        href="#products-section"
        class="btn btn-primary"
      >
        مشاهده محصولات
        <span>←</span>
      </a>

      <a
        href="/account"
        class="btn btn-secondary"
      >
        حساب کاربری
      </a>

    </div>

  </div>

</section>


<section class="section">

  <div class="features">

    <div class="feature">

      <div class="feature-icon">
        ⚡
      </div>

      <h3>
        ساده و سریع
      </h3>

      <p>
        تجربه خرید ساده و روان
        بدون پیچیدگی‌های اضافی.
      </p>

    </div>


    <div class="feature">

      <div class="feature-icon">
        📱
      </div>

      <h3>
        مناسب موبایل
      </h3>

      <p>
        طراحی شده برای صفحه‌های کوچک
        و استفاده راحت با گوشی.
      </p>

    </div>


    <div class="feature">

      <div class="feature-icon">
        🛍️
      </div>

      <h3>
        محصولات دیجیتال
      </h3>

      <p>
        محصولات کاربردی در یک فروشگاه
        دیجیتال ساده و مدرن.
      </p>

    </div>

  </div>

</section>


<section
  class="section"
  id="products-section"
>

  <div class="section-head">

    <div>
      <h2>
        محصولات فروشگاه
      </h2>

      <p>
        محصولات دیجیتال موجود در ${escapeHtml(STORE_NAME)}
      </p>
    </div>

  </div>

  <div
    class="products"
    id="products"
  >
    <div class="loading">
      در حال دریافت محصولات...
    </div>
  </div>

</section>
`;

  const scripts = `
<script>

function escapeClient(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function priceClient(value) {
  return Number(value || 0).toLocaleString("fa-IR") + " تومان";
}


async function loadProducts() {

  const box = document.getElementById("products");

  box.innerHTML = \`
    <div class="loading">
      در حال دریافت محصولات...
    </div>
  \`;

  try {

    const response = await fetch(
      "/api/products",
      {
        method: "GET",
        cache: "no-store"
      }
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (_) {
      throw new Error(
        "پاسخ نامعتبر از سرور (" +
        response.status +
        ")"
      );
    }

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
        "خطا در دریافت محصولات (" +
        response.status +
        ")"
      );
    }

    const products = Array.isArray(data.products)
      ? data.products
      : [];

    if (!products.length) {

      box.innerHTML = \`
        <div class="empty">
          هنوز محصولی در فروشگاه ثبت نشده است.
        </div>
      \`;

      return;
    }

    box.innerHTML = products.map(product => \`

      <article class="product-card">

        <div class="product-image">
          \${escapeClient(product.image || "🛍️")}
        </div>

        <div class="product-body">

          <h3>
            \${escapeClient(product.name)}
          </h3>

          <p>
            \${escapeClient(
              product.description ||
              "محصول دیجیتال از فروشگاه دیجی‌ماریکسو."
            )}
          </p>

          <div class="product-bottom">

            <span class="price">
              \${priceClient(product.price)}
            </span>

            <a
              class="btn btn-dark"
              href="/product/\${Number(product.id)}"
            >
              مشاهده
            </a>

          </div>

        </div>

      </article>

    \`).join("");

  } catch (error) {

    box.innerHTML = \`
      <div class="error-box">

        <strong>
          دریافت محصولات انجام نشد.
        </strong>

        <span>
          \${escapeClient(
            error?.message ||
            "خطای نامشخص در ارتباط با سرور."
          )}
        </span>

        <button
          class="btn btn-purple"
          onclick="loadProducts()"
        >
          تلاش دوباره
        </button>

      </div>
    \`;
  }
}


loadProducts();

</script>
`;

  return basePage(
    `${STORE_NAME} | فروشگاه دیجیتال`,
    content,
    scripts
  );
}


// =====================================================
// PRODUCT PAGE
// =====================================================

function productPage(product) {
  const content = `

<section class="section">

  <div class="panel">

    <div
      style="
        display:grid;
        grid-template-columns:1fr 1.4fr;
        gap:30px;
        align-items:center;
      "
    >

      <div
        style="
          min-height:260px;
          display:grid;
          place-items:center;
          border-radius:24px;
          background:
            linear-gradient(135deg,#f8faff,#eef0ff);
          font-size:100px;
        "
      >
        ${escapeHtml(product.image || "🛍️")}
      </div>

      <div>

        <div
          style="
            color:#6366f1;
            font-size:12px;
            font-weight:800;
            margin-bottom:10px;
          "
        >
          DIGITAL PRODUCT
        </div>

        <h1>
          ${escapeHtml(product.name)}
        </h1>

        <p
          style="
            color:#697387;
            line-height:2;
          "
        >
          ${escapeHtml(
            product.description ||
            "محصول دیجیتال کاربردی در دیجی‌ماریکسو."
          )}
        </p>

        <div
          style="
            font-size:22px;
            font-weight:900;
            color:#312e81;
            margin:20px 0;
          "
        >
          ${formatPrice(product.price)}
        </div>

        <button
          class="btn btn-purple"
          onclick="createOrder(${Number(product.id)})"
        >
          ثبت سفارش
        </button>

        <a
          href="/account"
          class="btn btn-light"
          style="margin-right:7px"
        >
          حساب کاربری
        </a>

        <div id="message"></div>

      </div>

    </div>

  </div>

</section>
`;

  const scripts = `
<script>

async function createOrder(productId) {

  const box = document.getElementById("message");

  try {

    const response = await fetch(
      "/api/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          product_id: productId
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || "ثبت سفارش انجام نشد."
      );
    }

    box.innerHTML = \`
      <div class="notice success">
        سفارش با موفقیت ثبت شد.
        برای مشاهده سفارش به حساب کاربری بروید.
      </div>
    \`;

  } catch (error) {

    box.innerHTML = \`
      <div class="notice error">
        \${escapeHtml(
          error?.message ||
          "ابتدا وارد حساب کاربری شوید."
        )}
        <br><br>
        <a href="/account">
          ورود به حساب کاربری
        </a>
      </div>
    \`;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

</script>
`;

  return basePage(
    `${escapeHtml(product.name)} | ${STORE_NAME}`,
    content,
    scripts
  );
}


// =====================================================
// ACCOUNT PAGE
// =====================================================

function accountPage() {
  const content = `

<section class="section">

  <div class="section-head">
    <div>
      <h1 style="margin:0">
        حساب کاربری
      </h1>

      <p>
        مدیریت حساب و سفارش‌های ${escapeHtml(STORE_NAME)}
      </p>
    </div>
  </div>


  <div
    id="authArea"
    class="grid-2"
  >

    <div class="panel">

      <h2>
        ورود
      </h2>

      <form
        class="form"
        onsubmit="loginUser(event)"
      >

        <input
          class="input"
          id="loginIdentity"
          placeholder="نام کاربری یا ایمیل"
          autocomplete="username"
          required
        >

        <input
          class="input"
          id="loginPassword"
          type="password"
          placeholder="رمز عبور"
          autocomplete="current-password"
          required
        >

        <button class="btn btn-purple">
          ورود
        </button>

      </form>

    </div>


    <div class="panel">

      <h2>
        ثبت‌نام
      </h2>

      <form
        class="form"
        onsubmit="registerUser(event)"
      >

        <input
          class="input"
          id="registerUsername"
          placeholder="نام کاربری"
          autocomplete="username"
          required
        >

        <input
          class="input"
          id="registerEmail"
          type="email"
          placeholder="ایمیل"
          autocomplete="email"
          required
        >

        <input
          class="input"
          id="registerPassword"
          type="password"
          placeholder="رمز عبور"
          autocomplete="new-password"
          required
        >

        <button class="btn btn-dark">
          ایجاد حساب
        </button>

      </form>

    </div>

  </div>


  <div
    id="accountArea"
    style="display:none"
  >

    <div class="panel">

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:15px;
          flex-wrap:wrap;
        "
      >

        <div>

          <h2 style="margin-bottom:7px">
            حساب شما
          </h2>

          <div id="userInfo"></div>

        </div>

        <button
          class="btn btn-danger"
          onclick="logoutUser()"
        >
          خروج
        </button>

      </div>

    </div>


    <div class="section">

      <div class="section-head">

        <div>
          <h2>
            سفارش‌های من
          </h2>

          <p>
            سفارش‌های ثبت‌شده شما
          </p>
        </div>

      </div>

      <div id="orders"></div>

    </div>

  </div>


  <div id="message"></div>

</section>
`;

  const scripts = `
<script>

async function loadMe() {

  try {

    const response = await fetch(
      "/api/me",
      { cache:"no-store" }
    );

    const data = await response.json();

    if (
      data.ok &&
      data.user
    ) {

      document.getElementById(
        "authArea"
      ).style.display = "none";

      document.getElementById(
        "accountArea"
      ).style.display = "block";

      document.getElementById(
        "userInfo"
      ).innerHTML = \`
        <div>
          نام کاربری:
          <strong>
            \${escapeHtml(data.user.username)}
          </strong>
        </div>

        <div
          style="
            margin-top:7px;
            color:#70798d;
            font-size:13px;
          "
        >
          \${escapeHtml(data.user.email)}
        </div>
      \`;

      loadOrders();

    }

  } catch (_) {}

}


async function loginUser(event) {

  event.preventDefault();

  const message =
    document.getElementById("message");

  try {

    const response = await fetch(
      "/api/login",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          username:
            document.getElementById(
              "loginIdentity"
            ).value,

          password:
            document.getElementById(
              "loginPassword"
            ).value
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || "ورود ناموفق بود."
      );
    }

    location.reload();

  } catch (error) {

    message.innerHTML = \`
      <div class="notice error">
        \${escapeHtml(error.message)}
      </div>
    \`;
  }
}


async function registerUser(event) {

  event.preventDefault();

  const message =
    document.getElementById("message");

  try {

    const response = await fetch(
      "/api/register",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({

          username:
            document.getElementById(
              "registerUsername"
            ).value,

          email:
            document.getElementById(
              "registerEmail"
            ).value,

          password:
            document.getElementById(
              "registerPassword"
            ).value

        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
        "ثبت‌نام ناموفق بود."
      );
    }

    message.innerHTML = \`
      <div class="notice success">
        حساب ساخته شد. اکنون وارد شوید.
      </div>
    \`;

    document.getElementById(
      "registerPassword"
    ).value = "";

  } catch (error) {

    message.innerHTML = \`
      <div class="notice error">
        \${escapeHtml(error.message)}
      </div>
    \`;
  }
}


async function logoutUser() {

  await fetch(
    "/api/logout",
    {
      method:"POST"
    }
  );

  location.reload();
}


async function loadOrders() {

  const box =
    document.getElementById("orders");

  try {

    const response = await fetch(
      "/api/orders",
      { cache:"no-store" }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || "خطا در دریافت سفارش‌ها."
      );
    }

    if (!data.orders.length) {

      box.innerHTML = \`
        <div class="empty">
          هنوز سفارشی ثبت نکرده‌اید.
        </div>
      \`;

      return;
    }

    box.innerHTML =
      data.orders.map(order => \`

        <div class="order-card">

          <div class="order-top">

            <strong>
              \${escapeHtml(
                order.product_name
              )}
            </strong>

            <span class="status">
              \${escapeHtml(
                statusLabelClient(
                  order.status
                )
              )}
            </span>

          </div>

          <div
            style="
              margin-top:10px;
              color:#697387;
              font-size:13px;
            "
          >
            قیمت:
            \${priceClient(order.price)}
          </div>

          <div
            style="
              margin-top:7px;
              color:#9aa1b0;
              font-size:11px;
            "
          >
            \${escapeHtml(
              order.created_at
            )}
          </div>

        </div>

      \`).join("");

  } catch (error) {

    box.innerHTML = \`
      <div class="notice error">
        \${escapeHtml(error.message)}
      </div>
    \`;
  }
}


function priceClient(value) {
  return Number(value || 0)
    .toLocaleString("fa-IR") +
    " تومان";
}


function statusLabelClient(status) {

  const labels = {
    pending:"در انتظار بررسی",
    paid:"پرداخت شده",
    completed:"تکمیل شده",
    cancelled:"لغو شده"
  };

  return labels[status] || status;
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}


loadMe();

</script>
`;

  return basePage(
    `حساب کاربری | ${STORE_NAME}`,
    content,
    scripts
  );
}


// =====================================================
// ADMIN PAGE
// =====================================================

function adminPage() {
  const content = `

<section class="section">

  <div class="section-head">

    <div>
      <h1 style="margin:0">
        مدیریت ${escapeHtml(STORE_NAME)}
      </h1>

      <p>
        مدیریت محصولات و سفارش‌ها
      </p>
    </div>

  </div>


  <div
    id="adminLogin"
    class="panel"
    style="max-width:520px;margin:auto"
  >

    <h2>
      ورود مدیریت
    </h2>

    <form
      class="form"
      onsubmit="adminLogin(event)"
    >

      <input
        class="input"
        id="adminUsername"
        placeholder="نام کاربری"
        value="admin"
        required
      >

      <input
        class="input"
        id="adminPassword"
        type="password"
        placeholder="رمز مدیریت"
        required
      >

      <button class="btn btn-purple">
        ورود به مدیریت
      </button>

    </form>

    <div id="adminLoginMessage"></div>

  </div>


  <div
    id="adminArea"
    style="display:none"
  >

    <div class="actions">

      <button
        class="btn btn-dark"
        onclick="loadAdminProducts()"
      >
        محصولات
      </button>

      <button
        class="btn btn-purple"
        onclick="loadAdminOrders()"
      >
        سفارش‌ها
      </button>

      <button
        class="btn btn-danger"
        onclick="adminLogout()"
      >
        خروج
      </button>

    </div>


    <div class="section">

      <div class="grid-2">

        <div class="panel">

          <h2>
            افزودن محصول
          </h2>

          <form
            class="form"
            onsubmit="addProduct(event)"
          >

            <input
              class="input"
              id="productName"
              placeholder="نام محصول"
              required
            >

            <textarea
              id="productDescription"
              placeholder="توضیحات محصول"
            ></textarea>

            <input
              class="input"
              id="productPrice"
              type="number"
              min="0"
              placeholder="قیمت به تومان"
              required
            >

            <input
              class="input"
              id="productImage"
              placeholder="ایموجی یا تصویر"
              value="🛍️"
            >

            <button class="btn btn-purple">
              افزودن محصول
            </button>

          </form>

          <div id="productMessage"></div>

        </div>


        <div class="panel">

          <h2>
            محصولات فعلی
          </h2>

          <div id="adminProducts">
            در حال دریافت...
          </div>

        </div>

      </div>

    </div>


    <div class="section">

      <div class="panel">

        <h2>
          سفارش‌ها
        </h2>

        <div
          class="table-wrap"
          id="adminOrders"
        >
          در حال دریافت...
        </div>

      </div>

    </div>

  </div>

</section>
`;

  const scripts = `
<script>

async function checkAdmin() {

  try {

    const response = await fetch(
      "/api/admin/me",
      { cache:"no-store" }
    );

    const data = await response.json();

    if (data.ok && data.admin) {

      document.getElementById(
        "adminLogin"
      ).style.display = "none";

      document.getElementById(
        "adminArea"
      ).style.display = "block";

      loadAdminProducts();
      loadAdminOrders();
    }

  } catch (_) {}

}


async function adminLogin(event) {

  event.preventDefault();

  const message =
    document.getElementById(
      "adminLoginMessage"
    );

  try {

    const response = await fetch(
      "/api/admin/login",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({

          username:
            document.getElementById(
              "adminUsername"
            ).value,

          password:
            document.getElementById(
              "adminPassword"
            ).value

        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
        "ورود مدیریت ناموفق بود."
      );
    }

    location.reload();

  } catch (error) {

    message.innerHTML = \`
      <div class="notice error">
        \${escapeHtml(error.message)}
      </div>
    \`;
  }
}


async function adminLogout() {

  await fetch(
    "/api/admin/logout",
    {
      method:"POST"
    }
  );

  location.reload();
}


async function loadAdminProducts() {

  const box =
    document.getElementById(
      "adminProducts"
    );

  try {

    const response = await fetch(
      "/api/admin/products",
      { cache:"no-store" }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
        "خطا در دریافت محصولات."
      );
    }

    if (!data.products.length) {

      box.innerHTML =
        '<div class="empty">محصولی وجود ندارد.</div>';

      return;
    }

    box.innerHTML =
      data.products.map(product => \`

        <div
          style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:10px;
            padding:12px 0;
            border-bottom:1px solid #edf0f5;
          "
        >

          <div>

            <strong>
              \${escapeHtml(product.name)}
            </strong>

            <div
              style="
                margin-top:5px;
                color:#6b7280;
                font-size:12px;
              "
            >
              \${priceClient(product.price)}
            </div>

          </div>

          <button
            class="btn btn-danger"
            onclick="deleteProduct(\${Number(product.id)})"
          >
            حذف
          </button>

        </div>

      \`).join("");

  } catch (error) {

    box.innerHTML = \`
      <div class="notice error">
        \${escapeHtml(error.message)}
      </div>
    \`;
  }
}


async function addProduct(event) {

  event.preventDefault();

  const message =
    document.getElementById(
      "productMessage"
    );

  try {

    const response = await fetch(
      "/api/admin/products",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({

          name:
            document.getElementById(
              "productName"
            ).value,

          description:
            document.getElementById(
              "productDescription"
            ).value,

          price:
            Number(
              document.getElementById(
                "productPrice"
              ).value
            ),

          image:
            document.getElementById(
              "productImage"
            ).value

        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
        "افزودن محصول انجام نشد."
      );
    }

    message.innerHTML = \`
      <div class="notice success">
        محصول با موفقیت اضافه شد.
      </div>
    \`;

    document.getElementById(
      "productName"
    ).value = "";

    document.getElementById(
      "productDescription"
    ).value = "";

    document.getElementById(
      "productPrice"
    ).value = "";

    loadAdminProducts();

  } catch (error) {

    message.innerHTML = \`
      <div class="notice error">
        \${escapeHtml(error.message)}
      </div>
    \`;
  }
}


async function deleteProduct(id) {

  if (!confirm(
    "آیا از حذف این محصول مطمئن هستید؟"
  )) {
    return;
  }

  try {

    const response = await fetch(
      "/api/admin/products?id=" +
      encodeURIComponent(id),
      {
        method:"DELETE"
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
        "حذف محصول انجام نشد."
      );
    }

    loadAdminProducts();

  } catch (error) {

    alert(error.message);
  }
}


async function loadAdminOrders() {

  const box =
    document.getElementById(
      "adminOrders"
    );

  try {

    const response = await fetch(
      "/api/admin/orders",
      { cache:"no-store" }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
        "خطا در دریافت سفارش‌ها."
      );
    }

    if (!data.orders.length) {

      box.innerHTML =
        '<div class="empty">هنوز سفارشی ثبت نشده است.</div>';

      return;
    }

    box.innerHTML = \`

      <table>

        <thead>

          <tr>

            <th>
              سفارش
            </th>

            <th>
              کاربر
            </th>

            <th>
              محصول
            </th>

            <th>
              قیمت
            </th>

            <th>
              وضعیت
            </th>

            <th>
              تغییر
            </th>

          </tr>

        </thead>

        <tbody>

          \${data.orders.map(order => \`

            <tr>

              <td>
                #\${Number(order.id)}
              </td>

              <td>
                \${escapeHtml(order.username)}
                <br>
                <small>
                  \${escapeHtml(order.email)}
                </small>
              </td>

              <td>
                \${escapeHtml(order.product_name)}
              </td>

              <td>
                \${priceClient(order.price)}
              </td>

              <td>
                \${escapeHtml(
                  statusLabelClient(
                    order.status
                  )
                )}
              </td>

              <td>

                <select
                  id="status-\${Number(order.id)}"
                >

                  <option
                    value="pending"
                    \${order.status === "pending" ? "selected" : ""}
                  >
                    در انتظار بررسی
                  </option>

                  <option
                    value="paid"
                    \${order.status === "paid" ? "selected" : ""}
                  >
                    پرداخت شده
                  </option>

                  <option
                    value="completed"
                    \${order.status === "completed" ? "selected" : ""}
                  >
                    تکمیل شده
                  </option>

                  <option
                    value="cancelled"
                    \${order.status === "cancelled" ? "selected" : ""}
                  >
                    لغو شده
                  </option>

                </select>

                <button
                  class="btn btn-purple"
                  style="margin-top:7px"
                  onclick="updateOrderStatus(\${Number(order.id)})"
                >
                  ذخیره
                </button>

              </td>

            </tr>

          \`).join("")}

        </tbody>

      </table>

    \`;

  } catch (error) {

    box.innerHTML = \`
      <div class="notice error">
        \${escapeHtml(error.message)}
      </div>
    \`;
  }
}


async function updateOrderStatus(orderId) {

  const select =
    document.getElementById(
      "status-" + orderId
    );

  try {

    const response = await fetch(
      "/api/admin/orders/status",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({

          order_id: orderId,

          status: select.value

        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error ||
        "به‌روزرسانی انجام نشد."
      );
    }

    loadAdminOrders();

  } catch (error) {

    alert(error.message);
  }
}


function priceClient(value) {
  return Number(value || 0)
    .toLocaleString("fa-IR") +
    " تومان";
}


function statusLabelClient(status) {

  const labels = {
    pending:"در انتظار بررسی",
    paid:"پرداخت شده",
    completed:"تکمیل شده",
    cancelled:"لغو شده"
  };

  return labels[status] || status;
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}


checkAdmin();

</script>
`;

  return basePage(
    `مدیریت | ${STORE_NAME}`,
    content,
    scripts
  );
}


// =====================================================
// 404
// =====================================================

function notFoundPage() {

  return basePage(
    `صفحه پیدا نشد | ${STORE_NAME}`,

    `
    <section
      class="section"
      style="max-width:650px;margin:70px auto"
    >

      <div
        class="panel"
        style="text-align:center"
      >

        <div
          style="
            font-size:70px;
            font-weight:900;
            color:#4f46e5;
          "
        >
          404
        </div>

        <h1>
          صفحه پیدا نشد
        </h1>

        <p
          style="
            color:#727b90;
            line-height:2;
          "
        >
          صفحه‌ای که به دنبال آن هستید
          وجود ندارد یا حذف شده است.
        </p>

        <a
          href="/"
          class="btn btn-purple"
        >
          بازگشت به فروشگاه
        </a>

      </div>

    </section>
    `
  );
          }
