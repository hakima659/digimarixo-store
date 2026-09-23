const STORE_NAME = "دیجی‌ماریکسو";
const STORE_EN = "DigiMarixo";
const DEFAULT_ADMIN_USERNAME = "admin";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      await initDB(env);

      // =========================
      // PUBLIC
      // =========================

      if (path === "/" && method === "GET") {
        return html(homePage());
      }

      if (path === "/health" && method === "GET") {
        return json({
          ok: true,
          store: STORE_EN,
          database: !!env.DB
        });
      }

      if (path === "/api/products" && method === "GET") {
        return json({
          ok: true,
          products: await getProducts(env)
        });
      }

      if (path.startsWith("/product/") && method === "GET") {
        const id = Number(path.split("/")[2]);

        if (!id) {
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
        return await registerUser(request, env);
      }

      if (path === "/api/login" && method === "POST") {
        return await loginUser(request, env);
      }

      if (path === "/api/logout" && method === "POST") {
        return await logoutUser(request, env);
      }

      if (path === "/api/me" && method === "GET") {
        const user = await currentUser(request, env);

        return json({
          ok: true,
          user: user || null
        });
      }

      // =========================
      // ORDERS
      // =========================

      if (path === "/api/orders" && method === "GET") {
        return await getUserOrders(request, env);
      }

      if (path === "/api/orders" && method === "POST") {
        return await createOrder(request, env);
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
        return json({
          ok: true,
          admin: await isAdmin(request, env)
        });
      }

      // =========================
      // ADMIN PRODUCTS
      // =========================

      if (path === "/api/admin/products" && method === "GET") {
        return await adminProducts(request, env);
      }

      if (path === "/api/admin/products" && method === "POST") {
        return await adminCreateProduct(request, env);
      }

      if (path === "/api/admin/products" && method === "DELETE") {
        return await adminDeleteProduct(request, env);
      }

      // =========================
      // ADMIN ORDERS
      // =========================

      if (path === "/api/admin/orders" && method === "GET") {
        return await adminOrders(request, env);
      }

      if (path === "/api/admin/orders/status" && method === "POST") {
        return await adminUpdateOrderStatus(request, env);
      }

      // =========================
      // PAGES
      // =========================

      if (path === "/admin" && method === "GET") {
        return html(adminPage());
      }

      if (path === "/account" && method === "GET") {
        return html(accountPage());
      }

      return html(notFoundPage(), 404);

    } catch (error) {
      return json({
        ok: false,
        error: "Internal Server Error",
        message: error?.message || String(error)
      }, 500);
    }
  }
};


// ============================================================
// DATABASE
// ============================================================

async function initDB(env) {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        price TEXT DEFAULT '',
        image TEXT DEFAULT '🛍️',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL
      )
    `)
  ]);
}


// ============================================================
// PRODUCTS
// ============================================================

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
  `).bind(id).first();
}


// ============================================================
// PASSWORD
// ============================================================

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);

  const hash = await crypto.subtle.digest(
    "SHA-256",
    data
  );

  return [...new Uint8Array(hash)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}


// ============================================================
// RANDOM TOKEN
// ============================================================

function randomToken() {
  const bytes = new Uint8Array(32);

  crypto.getRandomValues(bytes);

  return [...bytes]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}


// ============================================================
// COOKIE
// ============================================================

function getCookie(request, name) {
  const cookieHeader =
    request.headers.get("Cookie") || "";

  const cookies =
    cookieHeader.split(";");

  for (const cookie of cookies) {
    const [key, ...rest] =
      cookie.trim().split("=");

    if (key === name) {
      return rest.join("=");
    }
  }

  return null;
}


function cookieHeader(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}


// ============================================================
// USER REGISTER
// ============================================================

async function registerUser(request, env) {
  const body = await request.json();

  const username =
    String(body.username || "").trim();

  const email =
    String(body.email || "")
      .trim()
      .toLowerCase();

  const password =
    String(body.password || "");

  if (!username || !email || !password) {
    return json({
      ok: false,
      error: "همه فیلدها را کامل کنید."
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

  const exists = await env.DB.prepare(`
    SELECT id
    FROM users
    WHERE username = ? OR email = ?
    LIMIT 1
  `).bind(
    username,
    email
  ).first();

  if (exists) {
    return json({
      ok: false,
      error: "نام کاربری یا ایمیل قبلاً ثبت شده است."
    }, 400);
  }

  const passwordHash =
    await hashPassword(password);

  await env.DB.prepare(`
    INSERT INTO users (
      username,
      email,
      password_hash
    )
    VALUES (?, ?, ?)
  `).bind(
    username,
    email,
    passwordHash
  ).run();

  return json({
    ok: true,
    message: "ثبت‌نام با موفقیت انجام شد."
  });
}


// ============================================================
// USER LOGIN
// ============================================================

async function loginUser(request, env) {
  const body = await request.json();

  const identity =
    String(
      body.username ||
      body.email ||
      ""
    ).trim();

  const password =
    String(body.password || "");

  if (!identity || !password) {
    return json({
      ok: false,
      error: "نام کاربری/ایمیل و رمز عبور را وارد کنید."
    }, 400);
  }

  const passwordHash =
    await hashPassword(password);

  const user =
    await env.DB.prepare(`
      SELECT
        id,
        username,
        email
      FROM users
      WHERE
        (username = ? OR email = ?)
        AND password_hash = ?
      LIMIT 1
    `).bind(
      identity,
      identity.toLowerCase(),
      passwordHash
    ).first();

  if (!user) {
    return json({
      ok: false,
      error: "اطلاعات ورود صحیح نیست."
    }, 401);
  }

  const token =
    randomToken();

  await env.DB.prepare(`
    INSERT INTO sessions (
      token,
      user_id,
      expires_at
    )
    VALUES (
      ?,
      ?,
      datetime('now', '+30 days')
    )
  `).bind(
    token,
    user.id
  ).run();

  return new Response(
    JSON.stringify({
      ok: true,
      message: "ورود موفق بود.",
      user
    }),
    {
      status: 200,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        "Set-Cookie":
          cookieHeader(
            "dm_session",
            token,
            60 * 60 * 24 * 30
          )
      }
    }
  );
}


// ============================================================
// USER LOGOUT
// ============================================================

async function logoutUser(request, env) {
  const token =
    getCookie(request, "dm_session");

  if (token) {
    await env.DB.prepare(`
      DELETE FROM sessions
      WHERE token = ?
    `).bind(token).run();
  }

  return new Response(
    JSON.stringify({
      ok: true,
      message: "خروج انجام شد."
    }),
    {
      status: 200,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        "Set-Cookie":
          cookieHeader(
            "dm_session",
            "",
            0
          )
      }
    }
  );
}


// ============================================================
// CURRENT USER
// ============================================================

async function currentUser(request, env) {
  const token =
    getCookie(request, "dm_session");

  if (!token) {
    return null;
  }

  const user =
    await env.DB.prepare(`
      SELECT
        users.id,
        users.username,
        users.email
      FROM sessions
      JOIN users
        ON users.id = sessions.user_id
      WHERE
        sessions.token = ?
        AND sessions.expires_at > datetime('now')
      LIMIT 1
    `).bind(token).first();

  return user || null;
}


// ============================================================
// USER ORDERS
// ============================================================

async function getUserOrders(request, env) {
  const user =
    await currentUser(request, env);

  if (!user) {
    return json({
      ok: false,
      error: "برای مشاهده سفارش‌ها وارد حساب شوید."
    }, 401);
  }

  const orders =
    await userOrders(env, user.id);

  return json({
    ok: true,
    orders
  });
}


async function userOrders(env, userId) {
  const result =
    await env.DB.prepare(`
      SELECT
        orders.id,
        orders.status,
        orders.created_at,

        products.id AS product_id,
        products.name AS product_name,
        products.price AS product_price,
        products.image AS product_image

      FROM orders

      JOIN products
        ON products.id = orders.product_id

      WHERE orders.user_id = ?

      ORDER BY orders.id DESC
    `).bind(userId).all();

  return result.results || [];
}


// ============================================================
// CREATE ORDER
// ============================================================

async function createOrder(request, env) {
  const user =
    await currentUser(request, env);

  if (!user) {
    return json({
      ok: false,
      error: "برای ثبت سفارش ابتدا وارد حساب شوید."
    }, 401);
  }

  const body =
    await request.json();

  const productId =
    Number(body.product_id);

  if (!productId) {
    return json({
      ok: false,
      error: "محصول نامعتبر است."
    }, 400);
  }

  const product =
    await getProduct(env, productId);

  if (!product) {
    return json({
      ok: false,
      error: "محصول پیدا نشد."
    }, 404);
  }

  const result =
    await env.DB.prepare(`
      INSERT INTO orders (
        user_id,
        product_id,
        status
      )
      VALUES (?, ?, 'pending')
    `).bind(
      user.id,
      productId
    ).run();

  return json({
    ok: true,
    message: "سفارش با موفقیت ثبت شد.",
    order_id:
      result.meta?.last_row_id || null
  });
}


// ============================================================
// ADMIN LOGIN
// ============================================================

async function adminLogin(request, env) {
  if (!env.ADMIN_PASSWORD) {
    return json({
      ok: false,
      error:
        "ADMIN_PASSWORD در تنظیمات Worker تعریف نشده است."
    }, 500);
  }

  const body =
    await request.json();

  const username =
    String(
      body.username ||
      DEFAULT_ADMIN_USERNAME
    ).trim();

  const password =
    String(body.password || "");

  if (
    username !== DEFAULT_ADMIN_USERNAME ||
    password !== env.ADMIN_PASSWORD
  ) {
    return json({
      ok: false,
      error: "اطلاعات مدیریت صحیح نیست."
    }, 401);
  }

  const token =
    randomToken();

  await env.DB.prepare(`
    INSERT INTO admin_sessions (
      token,
      username,
      expires_at
    )
    VALUES (
      ?,
      ?,
      datetime('now', '+7 days')
    )
  `).bind(
    token,
    username
  ).run();

  return new Response(
    JSON.stringify({
      ok: true,
      message: "ورود مدیریت موفق بود."
    }),
    {
      status: 200,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        "Set-Cookie":
          cookieHeader(
            "dm_admin",
            token,
            60 * 60 * 24 * 7
          )
      }
    }
  );
}


// ============================================================
// ADMIN LOGOUT
// ============================================================

async function adminLogout(request, env) {
  const token =
    getCookie(request, "dm_admin");

  if (token) {
    await env.DB.prepare(`
      DELETE FROM admin_sessions
      WHERE token = ?
    `).bind(token).run();
  }

  return new Response(
    JSON.stringify({
      ok: true,
      message: "از مدیریت خارج شدید."
    }),
    {
      status: 200,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        "Set-Cookie":
          cookieHeader(
            "dm_admin",
            "",
            0
          )
      }
    }
  );
}


// ============================================================
// CHECK ADMIN
// ============================================================

async function isAdmin(request, env) {
  const token =
    getCookie(request, "dm_admin");

  if (!token) {
    return false;
  }

  const admin =
    await env.DB.prepare(`
      SELECT id
      FROM admin_sessions
      WHERE
        token = ?
        AND expires_at > datetime('now')
      LIMIT 1
    `).bind(token).first();

  return !!admin;
}


// ============================================================
// ADMIN PRODUCTS
// ============================================================

async function adminProducts(request, env) {
  if (!(await isAdmin(request, env))) {
    return json({
      ok: false,
      error: "دسترسی مدیریت لازم است."
    }, 401);
  }

  return json({
    ok: true,
    products:
      await getProducts(env)
  });
}


async function adminCreateProduct(request, env) {
  if (!(await isAdmin(request, env))) {
    return json({
      ok: false,
      error: "دسترسی مدیریت لازم است."
    }, 401);
  }

  const body =
    await request.json();

  const name =
    String(body.name || "").trim();

  const description =
    String(body.description || "").trim();

  const price =
    String(body.price || "").trim();

  const image =
    String(
      body.image || "🛍️"
    ).trim();

  if (!name) {
    return json({
      ok: false,
      error: "نام محصول الزامی است."
    }, 400);
  }

  await env.DB.prepare(`
    INSERT INTO products (
      name,
      description,
      price,
      image
    )
    VALUES (?, ?, ?, ?)
  `).bind(
    name,
    description,
    price,
    image || "🛍️"
  ).run();

  return json({
    ok: true,
    message: "محصول اضافه شد."
  });
}


async function adminDeleteProduct(request, env) {
  if (!(await isAdmin(request, env))) {
    return json({
      ok: false,
      error: "دسترسی مدیریت لازم است."
    }, 401);
  }

  const body =
    await request.json();

  const productId =
    Number(body.id);

  if (!productId) {
    return json({
      ok: false,
      error: "شناسه محصول نامعتبر است."
    }, 400);
  }

  const used =
    await env.DB.prepare(`
      SELECT id
      FROM orders
      WHERE product_id = ?
      LIMIT 1
    `).bind(productId).first();

  if (used) {
    return json({
      ok: false,
      error:
        "این محصول در سفارش‌ها استفاده شده و حذف آن ممکن نیست."
    }, 400);
  }

  await env.DB.prepare(`
    DELETE FROM products
    WHERE id = ?
  `).bind(productId).run();

  return json({
    ok: true,
    message: "محصول حذف شد."
  });
}


// ============================================================
// ADMIN ORDERS
// ============================================================

async function adminOrders(request, env) {
  if (!(await isAdmin(request, env))) {
    return json({
      ok: false,
      error: "دسترسی مدیریت لازم است."
    }, 401);
  }

  const result =
    await env.DB.prepare(`
      SELECT
        orders.id,
        orders.status,
        orders.created_at,

        users.id AS user_id,
        users.username,
        users.email,

        products.id AS product_id,
        products.name AS product_name,
        products.price AS product_price,
        products.image AS product_image

      FROM orders

      JOIN users
        ON users.id = orders.user_id

      JOIN products
        ON products.id = orders.product_id

      ORDER BY orders.id DESC
    `).all();

  return json({
    ok: true,
    orders:
      result.results || []
  });
}


async function adminUpdateOrderStatus(request, env) {
  if (!(await isAdmin(request, env))) {
    return json({
      ok: false,
      error: "دسترسی مدیریت لازم است."
    }, 401);
  }

  const body =
    await request.json();

  const orderId =
    Number(body.order_id);

  const status =
    String(
      body.status || ""
    ).trim();

  const allowedStatuses = [
    "pending",
    "paid",
    "completed",
    "cancelled"
  ];

  if (!orderId) {
    return json({
      ok: false,
      error: "شماره سفارش نامعتبر است."
    }, 400);
  }

  if (!allowedStatuses.includes(status)) {
    return json({
      ok: false,
      error: "وضعیت سفارش نامعتبر است."
    }, 400);
  }

  const order =
    await env.DB.prepare(`
      SELECT id
      FROM orders
      WHERE id = ?
      LIMIT 1
    `).bind(orderId).first();

  if (!order) {
    return json({
      ok: false,
      error: "سفارش پیدا نشد."
    }, 404);
  }

  await env.DB.prepare(`
    UPDATE orders
    SET status = ?
    WHERE id = ?
  `).bind(
    status,
    orderId
  ).run();

  return json({
    ok: true,
    message: "وضعیت سفارش تغییر کرد.",
    order_id: orderId,
    status
  });
}


// ============================================================
// HOME PAGE - PREMIUM DESIGN
// ============================================================

function homePage() {
  return `
<!DOCTYPE html>
<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1.0">

<title>${STORE_NAME} | ${STORE_EN}</title>

<meta name="description"
content="فروشگاه دیجیتال ${STORE_NAME} برای خرید محصولات و ابزارهای دیجیتال">

<style>

* {
  box-sizing:border-box;
}

html {
  scroll-behavior:smooth;
}

body {
  margin:0;
  font-family:
    Tahoma,
    Arial,
    sans-serif;
  color:#172033;
  background:
    radial-gradient(
      circle at top right,
      rgba(99,102,241,.10),
      transparent 32%
    ),
    radial-gradient(
      circle at 10% 35%,
      rgba(14,165,233,.08),
      transparent 30%
    ),
    #f7f8fc;
}

a {
  text-decoration:none;
}

button,
a {
  -webkit-tap-highlight-color:transparent;
}

.header {
  position:sticky;
  top:0;
  z-index:50;
  padding:14px 16px;
  background:rgba(255,255,255,.82);
  backdrop-filter:blur(18px);
  -webkit-backdrop-filter:blur(18px);
  border-bottom:1px solid rgba(226,232,240,.8);
}

.nav {
  max-width:1150px;
  margin:auto;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:20px;
}

.logo {
  display:flex;
  align-items:center;
  gap:11px;
  color:#111827;
}

.logo-mark {
  width:45px;
  height:45px;
  border-radius:14px;
  display:flex;
  align-items:center;
  justify-content:center;
  color:white;
  font-size:22px;
  font-weight:bold;
  background:
    linear-gradient(
      135deg,
      #4f46e5,
      #7c3aed
    );
  box-shadow:
    0 10px 25px rgba(79,70,229,.25);
}

.logo-text {
  font-size:18px;
  font-weight:900;
}

.logo-text small {
  display:block;
  margin-top:2px;
  color:#64748b;
  font-size:10px;
  letter-spacing:.7px;
  direction:ltr;
  text-align:right;
}

.nav-links {
  display:flex;
  align-items:center;
  gap:5px;
}

.nav-links a {
  color:#475569;
  padding:10px 13px;
  border-radius:12px;
  font-size:13px;
  font-weight:700;
  transition:.2s;
}

.nav-links a:hover {
  background:#eef2ff;
  color:#4f46e5;
}

.container {
  max-width:1150px;
  margin:auto;
  padding:28px 16px 50px;
}

.hero {
  position:relative;
  overflow:hidden;
  min-height:430px;
  display:flex;
  align-items:center;
  border-radius:30px;
  padding:48px;
  color:white;
  background:
    radial-gradient(
      circle at 85% 20%,
      rgba(129,140,248,.55),
      transparent 28%
    ),
    radial-gradient(
      circle at 10% 90%,
      rgba(56,189,248,.28),
      transparent 32%
    ),
    linear-gradient(
      135deg,
      #111827 0%,
      #312e81 52%,
      #4f46e5 100%
    );
  box-shadow:
    0 25px 70px rgba(30,41,59,.22);
}

.hero:before {
  content:"";
  position:absolute;
  width:250px;
  height:250px;
  border-radius:50%;
  border:1px solid rgba(255,255,255,.15);
  left:-90px;
  bottom:-100px;
}

.hero:after {
  content:"";
  position:absolute;
  width:180px;
  height:180px;
  border-radius:50%;
  border:1px solid rgba(255,255,255,.13);
  right:-55px;
  top:-60px;
}

.hero-content {
  position:relative;
  z-index:2;
  max-width:680px;
}

.eyebrow {
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:8px 13px;
  border-radius:999px;
  background:rgba(255,255,255,.12);
  border:1px solid rgba(255,255,255,.16);
  font-size:12px;
  font-weight:bold;
  margin-bottom:18px;
}

.eyebrow span {
  width:7px;
  height:7px;
  border-radius:50%;
  background:#a5f3fc;
  box-shadow:0 0 12px #a5f3fc;
}

.hero h1 {
  margin:0;
  font-size:clamp(34px,6vw,58px);
  line-height:1.15;
  letter-spacing:-1px;
}

.hero-title-en {
  margin-top:8px;
  font-size:14px;
  opacity:.65;
  direction:ltr;
  text-align:right;
  letter-spacing:2px;
}

.hero p {
  max-width:620px;
  margin:22px 0;
  line-height:2.1;
  color:#e0e7ff;
  font-size:15px;
}

.hero-buttons {
  display:flex;
  flex-wrap:wrap;
  gap:10px;
}

.btn {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  border:0;
  cursor:pointer;
  border-radius:14px;
  padding:13px 19px;
  font-family:inherit;
  font-size:13px;
  font-weight:800;
  transition:
    transform .2s,
    box-shadow .2s,
    background .2s;
}

.btn:hover {
  transform:translateY(-2px);
}

.btn-primary {
  color:white;
  background:
    linear-gradient(
      135deg,
      #6366f1,
      #7c3aed
    );
  box-shadow:
    0 12px 25px rgba(79,70,229,.28);
}

.btn-light {
  background:white;
  color:#312e81;
  box-shadow:0 10px 25px rgba(0,0,0,.12);
}

.btn-soft {
  background:#eef2ff;
  color:#4338ca;
}

.features {
  display:grid;
  grid-template-columns:
    repeat(3,1fr);
  gap:14px;
  margin:20px 0 38px;
}

.feature {
  display:flex;
  align-items:center;
  gap:13px;
  padding:18px;
  background:rgba(255,255,255,.8);
  border:1px solid #e8eaf2;
  border-radius:20px;
  box-shadow:0 10px 35px rgba(15,23,42,.04);
}

.feature-icon {
  width:44px;
  height:44px;
  flex:0 0 44px;
  display:flex;
  align-items:center;
  justify-content:center;
  border-radius:14px;
  background:#eef2ff;
  font-size:21px;
}

.feature strong {
  display:block;
  margin-bottom:4px;
  font-size:13px;
}

.feature span {
  color:#64748b;
  font-size:11px;
}

.section-head {
  display:flex;
  align-items:end;
  justify-content:space-between;
  gap:15px;
  margin:15px 0 18px;
}

.section-head h2 {
  margin:0;
  font-size:25px;
}

.section-head p {
  margin:6px 0 0;
  color:#64748b;
  font-size:12px;
}

.section-badge {
  padding:8px 12px;
  background:#eef2ff;
  color:#4f46e5;
  border-radius:999px;
  font-size:11px;
  font-weight:bold;
}

.products {
  display:grid;
  grid-template-columns:
    repeat(auto-fill,minmax(245px,1fr));
  gap:18px;
}

.product-card {
  position:relative;
  overflow:hidden;
  background:rgba(255,255,255,.94);
  border:1px solid #e7eaf1;
  border-radius:23px;
  padding:15px;
  box-shadow:
    0 10px 35px rgba(15,23,42,.055);
  transition:
    transform .25s,
    box-shadow .25s,
    border-color .25s;
}

.product-card:hover {
  transform:translateY(-6px);
  border-color:#c7d2fe;
  box-shadow:
    0 20px 45px rgba(79,70,229,.12);
}

.product-image {
  min-height:190px;
  display:flex;
  align-items:center;
  justify-content:center;
  border-radius:18px;
  font-size:72px;
  background:
    radial-gradient(
      circle at 50% 30%,
      #eef2ff,
      #f8fafc 68%
    );
  border:1px solid #eef2f7;
}

.product-body {
  padding:16px 5px 4px;
}

.product-body h3 {
  margin:0 0 8px;
  font-size:17px;
}

.product-body p {
  margin:0;
  min-height:52px;
  color:#64748b;
  font-size:12px;
  line-height:1.9;
}

.product-bottom {
  display:flex;
  align-items:end;
  justify-content:space-between;
  gap:10px;
  margin-top:17px;
}

.price-label {
  display:block;
  color:#94a3b8;
  font-size:10px;
  margin-bottom:4px;
}

.price {
  color:#312e81;
  font-size:17px;
  font-weight:900;
}

.product-btn {
  padding:10px 13px;
  font-size:11px;
  white-space:nowrap;
}

.loading,
.empty {
  grid-column:1/-1;
  text-align:center;
  padding:45px 20px;
  background:white;
  border:1px solid #e7eaf1;
  border-radius:22px;
  color:#64748b;
}

.footer {
  margin-top:30px;
  background:#111827;
  color:#cbd5e1;
}

.footer-inner {
  max-width:1150px;
  margin:auto;
  padding:30px 16px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:20px;
}

.footer-brand {
  color:white;
  font-weight:900;
}

.footer small {
  display:block;
  margin-top:5px;
  color:#94a3b8;
}

.footer-links {
  display:flex;
  gap:8px;
}

.footer-links a {
  color:#cbd5e1;
  padding:8px 10px;
  border-radius:9px;
}

.footer-links a:hover {
  background:#1f2937;
}

@media(max-width:700px) {

  .header {
    padding:11px 12px;
  }

  .nav {
    gap:8px;
  }

  .logo-mark {
    width:40px;
    height:40px;
    border-radius:12px;
  }

  .logo-text {
    font-size:15px;
  }

  .nav-links a {
    padding:8px 8px;
    font-size:11px;
  }

  .nav-links a:last-child {
    display:none;
  }

  .container {
    padding:16px 12px 35px;
  }

  .hero {
    min-height:auto;
    padding:34px 22px;
    border-radius:24px;
  }

  .hero h1 {
    font-size:36px;
  }

  .hero p {
    font-size:13px;
  }

  .hero-buttons {
    flex-direction:column;
  }

  .hero-buttons .btn {
    width:100%;
  }

  .features {
    grid-template-columns:1fr;
    gap:10px;
    margin:14px 0 30px;
  }

  .feature {
    padding:14px;
  }

  .section-head {
    align-items:flex-start;
    flex-direction:column;
  }

  .section-head h2 {
    font-size:22px;
  }

  .products {
    grid-template-columns:
      repeat(2,minmax(0,1fr));
    gap:11px;
  }

  .product-card {
    padding:9px;
    border-radius:18px;
  }

  .product-image {
    min-height:135px;
    font-size:50px;
    border-radius:14px;
  }

  .product-body {
    padding:11px 3px 3px;
  }

  .product-body h3 {
    font-size:13px;
  }

  .product-body p {
    min-height:auto;
    font-size:10px;
    line-height:1.7;
  }

  .product-bottom {
    align-items:stretch;
    flex-direction:column;
    margin-top:12px;
  }

  .price {
    font-size:14px;
  }

  .product-btn {
    width:100%;
  }

  .footer-inner {
    flex-direction:column;
    text-align:center;
  }
}

@media(max-width:390px) {

  .products {
    grid-template-columns:1fr;
  }

  .nav-links a {
    display:none;
  }

  .nav-links a:first-child {
    display:block;
  }
}

</style>

</head>

<body>

<header class="header">

<div class="nav">

<a class="logo" href="/">

<div class="logo-mark">
D
</div>

<div class="logo-text">
${STORE_NAME}
<small>${STORE_EN}</small>
</div>

</a>

<nav class="nav-links">

<a href="/">
خانه
</a>

<a href="#products">
محصولات
</a>

<a href="/account">
حساب من
</a>

<a href="/admin">
مدیریت
</a>

</nav>

</div>

</header>


<main class="container">

<section class="hero">

<div class="hero-content">

<div class="eyebrow">
<span></span>
فروشگاه دیجیتال ${STORE_EN}
</div>

<h1>
ابزارهای دیجیتال
برای شما
</h1>

<div class="hero-title-en">
DIGITAL PRODUCTS • SIMPLE • MODERN
</div>

<p>
در ${STORE_NAME} محصولات و ابزارهای دیجیتال
را در یک فضای ساده، سریع و مناسب موبایل پیدا کنید.
</p>

<div class="hero-buttons">

<a
class="btn btn-primary"
href="#products"
>
مشاهده محصولات
<span>←</span>
</a>

<a
class="btn btn-light"
href="/account"
>
حساب کاربری
</a>

</div>

</div>

</section>


<section class="features">

<div class="feature">

<div class="feature-icon">
⚡
</div>

<div>
<strong>
ساده و سریع
</strong>

<span>
تجربه خرید ساده و روان
</span>
</div>

</div>


<div class="feature">

<div class="feature-icon">
📱
</div>

<div>
<strong>
مناسب موبایل
</strong>

<span>
طراحی شده برای صفحه‌های کوچک
</span>
</div>

</div>


<div class="feature">

<div class="feature-icon">
🛍️
</div>

<div>
<strong>
محصولات دیجیتال
</strong>

<span>
محصولات کاربردی در یک فروشگاه
</span>
</div>

</div>

</section>


<section id="products">

<div class="section-head">

<div>

<h2>
محصولات فروشگاه
</h2>

<p>
محصولات دیجیتال موجود در ${STORE_NAME}
</p>

</div>

<div class="section-badge">
DigiMarixo
</div>

</div>


<div id="productsBox" class="products">

<div class="loading">
در حال دریافت محصولات...
</div>

</div>

</section>

</main>


<footer class="footer">

<div class="footer-inner">

<div>

<div class="footer-brand">
${STORE_NAME}
</div>

<small>
${STORE_EN} — فروشگاه دیجیتال
</small>

</div>

<div class="footer-links">

<a href="/">
خانه
</a>

<a href="/account">
حساب من
</a>

<a href="/admin">
مدیریت
</a>

</div>

</div>

</footer>


<script>

async function loadProducts() {

  const box =
    document.getElementById("productsBox");

  try {

    const response =
      await fetch("/api/products");

    const data =
      await response.json();

    if (!data.ok) {
      throw new Error(
        data.error || "خطا"
      );
    }

    if (
      !data.products ||
      data.products.length === 0
    ) {

      box.innerHTML =
        '<div class="empty">' +
        'هنوز محصولی ثبت نشده است.' +
        '</div>';

      return;
    }

    box.innerHTML =
      data.products.map(function(product) {

        return (
          '<article class="product-card">' +

          '<div class="product-image">' +
          escapeHtml(
            product.image || "🛍️"
          ) +
          '</div>' +

          '<div class="product-body">' +

          '<h3>' +
          escapeHtml(product.name) +
          '</h3>' +

          '<p>' +
          escapeHtml(
            product.description || ""
          ) +
          '</p>' +

          '<div class="product-bottom">' +

          '<div>' +

          '<span class="price-label">' +
          'قیمت' +
          '</span>' +

          '<div class="price">' +
          escapeHtml(
            product.price || "تماس بگیرید"
          ) +
          '</div>' +

          '</div>' +

          '<a ' +
          'class="btn btn-primary product-btn" ' +
          'href="/product/' +
          product.id +
          '">' +
          'مشاهده و سفارش' +
          '</a>' +

          '</div>' +

          '</div>' +

          '</article>'
        );

      }).join("");

  } catch (error) {

    box.innerHTML =
      '<div class="empty">' +
      'دریافت محصولات انجام نشد.' +
      '</div>';
  }
}


loadProducts();

</script>

</body>

</html>
`;
}


// ============================================================
// PRODUCT PAGE - PREMIUM
// ============================================================

function productPage(product) {
  return `
<!DOCTYPE html>
<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1.0">

<title>
${escapeHtml(product.name)} | ${STORE_NAME}
</title>

<style>

* {
  box-sizing:border-box;
}

body {
  margin:0;
  font-family:Tahoma,Arial,sans-serif;
  color:#172033;
  background:
    radial-gradient(
      circle at top right,
      #eef2ff,
      transparent 35%
    ),
    #f7f8fc;
}

.header {
  padding:14px 16px;
  background:rgba(255,255,255,.85);
  backdrop-filter:blur(16px);
  border-bottom:1px solid #e5e7eb;
}

.nav {
  max-width:1000px;
  margin:auto;
  display:flex;
  justify-content:space-between;
  align-items:center;
}

.brand {
  font-weight:900;
  color:#111827;
}

.brand small {
  display:block;
  font-size:9px;
  color:#64748b;
  direction:ltr;
}

.container {
  max-width:900px;
  margin:auto;
  padding:28px 16px 60px;
}

.back {
  display:inline-flex;
  margin-bottom:15px;
  color:#4f46e5;
  font-size:13px;
  font-weight:bold;
}

.card {
  overflow:hidden;
  background:white;
  border:1px solid #e5e7eb;
  border-radius:28px;
  box-shadow:
    0 20px 55px rgba(15,23,42,.08);
}

.product-top {
  display:grid;
  grid-template-columns: .9fr 1.1fr;
}

.image {
  min-height:390px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:120px;
  background:
    radial-gradient(
      circle,
      #eef2ff,
      #f8fafc 70%
    );
}

.info {
  padding:42px;
}

.label {
  display:inline-block;
  padding:7px 11px;
  border-radius:999px;
  background:#eef2ff;
  color:#4f46e5;
  font-size:10px;
  font-weight:bold;
}

h1 {
  margin:18px 0 13px;
  font-size:32px;
}

.description {
  color:#64748b;
  line-height:2;
  font-size:14px;
}

.price-box {
  margin:25px 0;
  padding:17px;
  border-radius:17px;
  background:#f8fafc;
  border:1px solid #e5e7eb;
}

.price-label {
  color:#94a3b8;
  font-size:10px;
}

.price {
  margin-top:6px;
  color:#312e81;
  font-size:25px;
  font-weight:900;
}

.btn {
  width:100%;
  border:0;
  padding:14px;
  border-radius:14px;
  color:white;
  background:
    linear-gradient(
      135deg,
      #4f46e5,
      #7c3aed
    );
  font-family:inherit;
  font-size:14px;
  font-weight:900;
  cursor:pointer;
  box-shadow:
    0 12px 25px rgba(79,70,229,.22);
}

.btn:hover {
  opacity:.94;
}

#message {
  margin-top:15px;
  padding:12px;
  border-radius:12px;
  background:#f8fafc;
  color:#475569;
  font-size:12px;
  line-height:1.8;
}

@media(max-width:700px) {

  .product-top {
    grid-template-columns:1fr;
  }

  .image {
    min-height:260px;
    font-size:90px;
  }

  .info {
    padding:25px 20px 28px;
  }

  h1 {
    font-size:25px;
  }
}

</style>

</head>

<body>

<header class="header">

<div class="nav">

<a
class="brand"
href="/"
>
${STORE_NAME}
<small>${STORE_EN}</small>
</a>

<a
class="back"
style="margin:0"
href="/"
>
فروشگاه
</a>

</div>

</header>

<div class="container">

<a class="back" href="/">
← بازگشت به فروشگاه
</a>

<div class="card">

<div class="product-top">

<div class="image">
${escapeHtml(product.image || "🛍️")}
</div>

<div class="info">

<span class="label">
محصول دیجیتال
</span>

<h1>
${escapeHtml(product.name)}
</h1>

<div class="description">
${escapeHtml(product.description || "")}
</div>

<div class="price-box">

<div class="price-label">
قیمت محصول
</div>

<div class="price">
${escapeHtml(product.price || "تماس بگیرید")}
</div>

</div>

<button
class="btn"
onclick="buyProduct()"
>
ثبت سفارش
</button>

<div id="message"></div>

</div>

</div>

</div>

</div>


<script>

async function buyProduct() {

  const message =
    document.getElementById("message");

  message.textContent =
    "در حال ثبت سفارش...";

  try {

    const response =
      await fetch("/api/orders", {

        method:"POST",

        headers:{
          "Content-Type":"application/json"
        },

        body:JSON.stringify({
          product_id:${Number(product.id)}
        })

      });

    const data =
      await response.json();

    if (response.status === 401) {

      window.location.href =
        "/account?login=1";

      return;
    }

    if (!data.ok) {

      message.textContent =
        data.error ||
        "ثبت سفارش انجام نشد.";

      return;
    }

    message.textContent =
      "سفارش شما با موفقیت ثبت شد. شماره سفارش: " +
      (data.order_id || "");

  } catch (error) {

    message.textContent =
      "خطا در ارتباط با سرور.";
  }
}

</script>

</body>

</html>
`;
}


// ============================================================
// ACCOUNT PAGE - PREMIUM
// ============================================================

function accountPage() {
  return `
<!DOCTYPE html>
<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1.0">

<title>
حساب کاربری | ${STORE_NAME}
</title>

<style>

* {
  box-sizing:border-box;
}

body {
  margin:0;
  background:
    radial-gradient(
      circle at top right,
      #eef2ff,
      transparent 35%
    ),
    #f7f8fc;
  color:#172033;
  font-family:Tahoma,Arial,sans-serif;
}

.header {
  padding:14px 16px;
  background:rgba(255,255,255,.86);
  backdrop-filter:blur(16px);
  border-bottom:1px solid #e5e7eb;
}

.nav {
  max-width:1000px;
  margin:auto;
  display:flex;
  justify-content:space-between;
  align-items:center;
}

.brand {
  color:#111827;
  font-weight:900;
}

.brand small {
  display:block;
  color:#64748b;
  font-size:9px;
  direction:ltr;
}

.nav a {
  color:#4f46e5;
  font-size:12px;
  font-weight:bold;
}

.container {
  max-width:1000px;
  margin:auto;
  padding:28px 16px 60px;
}

.hero-title {
  margin-bottom:20px;
}

.hero-title h1 {
  margin:0 0 8px;
  font-size:28px;
}

.hero-title p {
  margin:0;
  color:#64748b;
  font-size:13px;
}

.grid {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:18px;
}

.card {
  background:white;
  border:1px solid #e5e7eb;
  border-radius:22px;
  padding:23px;
  box-shadow:0 12px 35px rgba(15,23,42,.055);
}

.card h2 {
  margin-top:0;
  font-size:18px;
}

input {
  width:100%;
  padding:13px 14px;
  margin:6px 0 11px;
  border:1px solid #dbe1ea;
  border-radius:12px;
  outline:none;
  font-family:inherit;
  background:#fbfcfe;
}

input:focus {
  border-color:#818cf8;
  box-shadow:0 0 0 3px rgba(99,102,241,.10);
}

button {
  border:0;
  background:
    linear-gradient(
      135deg,
      #4f46e5,
      #7c3aed
    );
  color:white;
  padding:12px 17px;
  border-radius:12px;
  cursor:pointer;
  font-family:inherit;
  font-weight:bold;
}

button.secondary {
  background:#eef2ff;
  color:#4338ca;
}

hr {
  border:0;
  border-top:1px solid #eef0f4;
  margin:25px 0;
}

.message {
  margin-top:12px;
  padding:10px;
  border-radius:11px;
  background:#f8fafc;
  font-size:12px;
}

.orders {
  display:grid;
  gap:11px;
}

.order {
  border:1px solid #e5e7eb;
  border-radius:15px;
  padding:15px;
  background:#fbfcff;
}

.order strong {
  color:#312e81;
}

.status {
  display:inline-block;
  background:#eef2ff;
  color:#4338ca;
  padding:5px 9px;
  border-radius:8px;
  margin-top:8px;
  font-size:11px;
}

.back {
  display:inline-block;
  margin-top:20px;
  color:#4f46e5;
  font-size:12px;
  font-weight:bold;
}

@media(max-width:700px) {

  .grid {
    grid-template-columns:1fr;
  }

  .hero-title h1 {
    font-size:24px;
  }

  .card {
    padding:19px;
  }
}

</style>

</head>

<body>

<header class="header">

<div class="nav">

<div class="brand">
${STORE_NAME}
<small>${STORE_EN}</small>
</div>

<a href="/">
بازگشت به فروشگاه
</a>

</div>

</header>

<div class="container">

<div class="hero-title">

<h1>
حساب کاربری
</h1>

<p>
مدیریت حساب و سفارش‌های ${STORE_NAME}
</p>

</div>


<div class="grid">

<div class="card">

<div id="auth">

<h2>
ورود به حساب
</h2>

<input
id="loginIdentity"
placeholder="نام کاربری یا ایمیل"
>

<input
id="loginPassword"
type="password"
placeholder="رمز عبور"
>

<button onclick="login()">
ورود
</button>

<hr>

<h2>
ایجاد حساب
</h2>

<input
id="registerUsername"
placeholder="نام کاربری"
>

<input
id="registerEmail"
placeholder="ایمیل"
>

<input
id="registerPassword"
type="password"
placeholder="رمز عبور"
>

<button onclick="register()">
ثبت‌نام
</button>

<div id="authMessage" class="message"></div>

</div>


<div id="userArea" style="display:none">

<h2>
حساب من
</h2>

<div id="userInfo"></div>

<br>

<button
class="secondary"
onclick="logout()"
>
خروج از حساب
</button>

</div>

</div>


<div class="card">

<h2>
سفارش‌های من
</h2>

<div id="orders">
برای مشاهده سفارش‌ها وارد حساب شوید.
</div>

</div>

</div>


<a class="back" href="/">
← بازگشت به فروشگاه
</a>

</div>


<script>

async function loadMe() {

  const response =
    await fetch("/api/me");

  const data =
    await response.json();

  if (data.user) {

    document.getElementById("auth")
      .style.display = "none";

    document.getElementById("userArea")
      .style.display = "block";

    document.getElementById("userInfo")
      .innerHTML =
        '<p>نام کاربری: <strong>' +
        escapeHtml(data.user.username) +
        '</strong></p>' +

        '<p>ایمیل: ' +
        escapeHtml(data.user.email) +
        '</p>';

    loadOrders();
  }
}


async function register() {

  const username =
    document.getElementById(
      "registerUsername"
    ).value;

  const email =
    document.getElementById(
      "registerEmail"
    ).value;

  const password =
    document.getElementById(
      "registerPassword"
    ).value;

  const message =
    document.getElementById(
      "authMessage"
    );

  const response =
    await fetch("/api/register", {

      method:"POST",

      headers:{
        "Content-Type":"application/json"
      },

      body:JSON.stringify({
        username,
        email,
        password
      })

    });

  const data =
    await response.json();

  message.textContent =
    data.ok
      ? "ثبت‌نام موفق بود. اکنون وارد شوید."
      : data.error;
}


async function login() {

  const identity =
    document.getElementById(
      "loginIdentity"
    ).value;

  const password =
    document.getElementById(
      "loginPassword"
    ).value;

  const message =
    document.getElementById(
      "authMessage"
    );

  const response =
    await fetch("/api/login", {

      method:"POST",

      headers:{
        "Content-Type":"application/json"
      },

      body:JSON.stringify({
        username:identity,
        password
      })

    });

  const data =
    await response.json();

  if (!data.ok) {

    message.textContent =
      data.error;

    return;
  }

  message.textContent =
    "ورود موفق بود.";

  await loadMe();
}


async function logout() {

  await fetch("/api/logout", {
    method:"POST"
  });

  location.reload();
}


async function loadOrders() {

  const box =
    document.getElementById("orders");

  const response =
    await fetch("/api/orders");

  const data =
    await response.json();

  if (!data.ok) {

    box.textContent =
      data.error || "خطا";

    return;
  }

  if (!data.orders.length) {

    box.textContent =
      "هنوز سفارشی ثبت نشده است.";

    return;
  }

  box.innerHTML =
    '<div class="orders">' +

    data.orders.map(function(order) {

      return (
        '<div class="order">' +

        '<strong>سفارش #' +
        order.id +
        '</strong>' +

        '<p>' +
        escapeHtml(
          order.product_name
        ) +
        '</p>' +

        '<p>قیمت: ' +
        escapeHtml(
          order.product_price || "-"
        ) +
        '</p>' +

        '<span class="status">' +
        'وضعیت: ' +
        escapeHtml(order.status) +
        '</span>' +

        '</div>'
      );

    }).join("") +

    '</div>';
}


loadMe();

</script>

</body>

</html>
`;
}


// ============================================================
// ADMIN PAGE - PREMIUM
// ============================================================

function adminPage() {
  return `
<!DOCTYPE html>
<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1.0">

<title>
مدیریت | ${STORE_NAME}
</title>

<style>

* {
  box-sizing:border-box;
}

body {
  margin:0;
  background:
    radial-gradient(
      circle at top right,
      #eef2ff,
      transparent 30%
    ),
    #f7f8fc;
  color:#172033;
  font-family:Tahoma,Arial,sans-serif;
}

.header {
  padding:14px 16px;
  background:rgba(255,255,255,.86);
  backdrop-filter:blur(16px);
  border-bottom:1px solid #e5e7eb;
}

.nav {
  max-width:1100px;
  margin:auto;
  display:flex;
  justify-content:space-between;
  align-items:center;
}

.brand {
  font-weight:900;
  color:#111827;
}

.brand small {
  display:block;
  color:#64748b;
  font-size:9px;
  direction:ltr;
}

.nav a {
  color:#4f46e5;
  font-size:12px;
  font-weight:bold;
}

.container {
  max-width:1100px;
  margin:auto;
  padding:25px 16px 60px;
}

.card {
  background:white;
  border:1px solid #e5e7eb;
  border-radius:22px;
  padding:22px;
  margin-bottom:18px;
  box-shadow:0 10px 32px rgba(15,23,42,.05);
}

.card h1 {
  margin-top:0;
  font-size:25px;
}

.card h2 {
  margin-top:0;
  font-size:18px;
}

input,
textarea,
select {
  width:100%;
  padding:12px 13px;
  margin:6px 0 11px;
  border:1px solid #dbe1ea;
  border-radius:11px;
  font-family:inherit;
  background:#fbfcfe;
  outline:none;
}

input:focus,
textarea:focus,
select:focus {
  border-color:#818cf8;
  box-shadow:0 0 0 3px rgba(99,102,241,.10);
}

textarea {
  min-height:105px;
  resize:vertical;
}

button {
  border:0;
  background:
    linear-gradient(
      135deg,
      #4f46e5,
      #7c3aed
    );
  color:white;
  padding:11px 15px;
  border-radius:11px;
  cursor:pointer;
  font-family:inherit;
  font-weight:bold;
}

button.danger {
  background:#dc2626;
}

button.secondary {
  background:#eef2ff;
  color:#4338ca;
}

.hidden {
  display:none;
}

.row {
  display:flex;
  gap:9px;
  flex-wrap:wrap;
  align-items:center;
}

.products,
.orders {
  display:grid;
  gap:12px;
}

.item {
  border:1px solid #e5e7eb;
  border-radius:16px;
  padding:16px;
  background:#fbfcff;
}

.item strong {
  color:#312e81;
}

.order-info {
  line-height:2;
  font-size:13px;
}

.badge {
  display:inline-block;
  padding:5px 9px;
  background:#eef2ff;
  color:#4338ca;
  border-radius:8px;
  font-size:11px;
}

.message {
  margin-top:10px;
  padding:10px;
  border-radius:10px;
  background:#f8fafc;
  font-size:12px;
}

.back {
  color:#4f46e5;
  font-size:12px;
  font-weight:bold;
}

@media(max-width:700px) {

  .container {
    padding:18px 12px 45px;
  }

  .card {
    padding:18px;
    border-radius:19px;
  }

  .card h1 {
    font-size:21px;
  }

  .row button {
    flex:1;
  }
}

</style>

</head>

<body>

<header class="header">

<div class="nav">

<div class="brand">
${STORE_NAME}
<small>${STORE_EN}</small>
</div>

<a href="/">
بازگشت به فروشگاه
</a>

</div>

</header>


<div class="container">

<div class="card">

<h1>
پنل مدیریت ${STORE_NAME}
</h1>

<p style="color:#64748b;font-size:12px">
مدیریت محصولات و سفارش‌های فروشگاه
</p>

<div id="loginBox">

<h2>
ورود مدیریت
</h2>

<input
id="adminUsername"
value="admin"
placeholder="نام کاربری"
>

<input
id="adminPassword"
type="password"
placeholder="رمز مدیریت"
>

<button onclick="adminLogin()">
ورود به مدیریت
</button>

<div id="loginMessage" class="message"></div>

</div>


<div id="adminArea" class="hidden">

<div class="row">

<button
class="secondary"
onclick="adminLogout()"
>
خروج از مدیریت
</button>

<button
class="secondary"
onclick="loadProducts()"
>
بروزرسانی محصولات
</button>

<button
class="secondary"
onclick="loadOrders()"
>
بروزرسانی سفارش‌ها
</button>

</div>

</div>

</div>


<div id="dashboard" class="hidden">

<div class="card">

<h2>
افزودن محصول جدید
</h2>

<input
id="productName"
placeholder="نام محصول"
>

<textarea
id="productDescription"
placeholder="توضیحات محصول"
></textarea>

<input
id="productPrice"
placeholder="قیمت مثلا 99,000 تومان"
>

<input
id="productImage"
placeholder="ایموجی یا تصویر"
value="🛍️"
>

<button onclick="createProduct()">
افزودن محصول
</button>

<div id="productMessage" class="message"></div>

</div>


<div class="card">

<h2>
محصولات
</h2>

<div id="products" class="products">
در حال دریافت...
</div>

</div>


<div class="card">

<h2>
مدیریت سفارش‌ها
</h2>

<div id="orders" class="orders">
در حال دریافت سفارش‌ها...
</div>

</div>

</div>


<a class="back" href="/">
← بازگشت به فروشگاه
</a>

</div>


<script>

async function checkAdmin() {

  try {

    const response =
      await fetch("/api/admin/me");

    const data =
      await response.json();

    if (data.admin) {

      showAdmin();

      await loadProducts();

      await loadOrders();
    }

  } catch (error) {}
}


function showAdmin() {

  document
    .getElementById("loginBox")
    .classList.add("hidden");

  document
    .getElementById("adminArea")
    .classList.remove("hidden");

  document
    .getElementById("dashboard")
    .classList.remove("hidden");
}


async function adminLogin() {

  const username =
    document.getElementById(
      "adminUsername"
    ).value;

  const password =
    document.getElementById(
      "adminPassword"
    ).value;

  const message =
    document.getElementById(
      "loginMessage"
    );

  const response =
    await fetch("/api/admin/login", {

      method:"POST",

      headers:{
        "Content-Type":"application/json"
      },

      body:JSON.stringify({
        username,
        password
      })

    });

  const data =
    await response.json();

  if (!data.ok) {

    message.textContent =
      data.error ||
      "ورود ناموفق بود.";

    return;
  }

  showAdmin();

  await loadProducts();

  await loadOrders();
}


async function adminLogout() {

  await fetch("/api/admin/logout", {
    method:"POST"
  });

  location.reload();
}


// ============================================================
// PRODUCTS
// ============================================================

async function loadProducts() {

  const box =
    document.getElementById("products");

  const response =
    await fetch("/api/admin/products");

  const data =
    await response.json();

  if (response.status === 401) {

    location.reload();

    return;
  }

  if (!data.ok) {

    box.textContent =
      data.error || "خطا";

    return;
  }

  if (!data.products.length) {

    box.textContent =
      "محصولی وجود ندارد.";

    return;
  }

  box.innerHTML =
    data.products.map(function(product) {

      return (
        '<div class="item">' +

        '<strong>' +
        escapeHtml(product.name) +
        '</strong>' +

        '<p>' +
        escapeHtml(
          product.description || ""
        ) +
        '</p>' +

        '<p>قیمت: ' +
        escapeHtml(
          product.price || "-"
        ) +
        '</p>' +

        '<button class="danger" ' +
        'onclick="deleteProduct(' +
        product.id +
        ')">' +
        'حذف محصول' +
        '</button>' +

        '</div>'
      );

    }).join("");
}


async function createProduct() {

  const name =
    document.getElementById(
      "productName"
    ).value;

  const description =
    document.getElementById(
      "productDescription"
    ).value;

  const price =
    document.getElementById(
      "productPrice"
    ).value;

  const image =
    document.getElementById(
      "productImage"
    ).value;

  const message =
    document.getElementById(
      "productMessage"
    );

  const response =
    await fetch(
      "/api/admin/products",
      {

        method:"POST",

        headers:{
          "Content-Type":
            "application/json"
        },

        body:JSON.stringify({
          name,
          description,
          price,
          image
        })

      }
    );

  const data =
    await response.json();

  message.textContent =
    data.ok
      ? "محصول اضافه شد."
      : data.error;

  if (data.ok) {

    document.getElementById(
      "productName"
    ).value = "";

    document.getElementById(
      "productDescription"
    ).value = "";

    document.getElementById(
      "productPrice"
    ).value = "";

    document.getElementById(
      "productImage"
    ).value = "🛍️";

    await loadProducts();
  }
}


async function deleteProduct(id) {

  if (
    !confirm(
      "آیا از حذف این محصول مطمئن هستید؟"
    )
  ) {
    return;
  }

  const response =
    await fetch(
      "/api/admin/products",
      {

        method:"DELETE",

        headers:{
          "Content-Type":
            "application/json"
        },

        body:JSON.stringify({
          id
        })

      }
    );

  const data =
    await response.json();

  alert(
    data.ok
      ? "محصول حذف شد."
      : data.error
  );

  if (data.ok) {
    await loadProducts();
  }
}


// ============================================================
// ORDERS
// ============================================================

async function loadOrders() {

  const box =
    document.getElementById("orders");

  const response =
    await fetch("/api/admin/orders");

  const data =
    await response.json();

  if (response.status === 401) {

    location.reload();

    return;
  }

  if (!data.ok) {

    box.textContent =
      data.error || "خطا";

    return;
  }

  if (!data.orders.length) {

    box.textContent =
      "هنوز سفارشی ثبت نشده است.";

    return;
  }

  box.innerHTML =
    data.orders.map(function(order) {

      const pendingSelected =
        order.status === "pending"
          ? "selected"
          : "";

      const paidSelected =
        order.status === "paid"
          ? "selected"
          : "";

      const completedSelected =
        order.status === "completed"
          ? "selected"
          : "";

      const cancelledSelected =
        order.status === "cancelled"
          ? "selected"
          : "";

      return (
        '<div class="item">' +

        '<div class="order-info">' +

        '<strong>سفارش #' +
        order.id +
        '</strong>' +

        '<br>' +

        'مشتری: ' +
        escapeHtml(order.username) +

        '<br>' +

        'ایمیل: ' +
        escapeHtml(order.email) +

        '<br>' +

        'محصول: ' +
        escapeHtml(order.product_name) +

        '<br>' +

        'قیمت: ' +
        escapeHtml(
          order.product_price || "-"
        ) +

        '<br>' +

        'تاریخ: ' +
        escapeHtml(order.created_at) +

        '<br>' +

        'وضعیت فعلی: ' +

        '<span class="badge">' +
        escapeHtml(order.status) +
        '</span>' +

        '</div>' +

        '<br>' +

        '<div class="row">' +

        '<select id="status-' +
        order.id +
        '">' +

        '<option value="pending" ' +
        pendingSelected +
        '>در انتظار</option>' +

        '<option value="paid" ' +
        paidSelected +
        '>پرداخت شده</option>' +

        '<option value="completed" ' +
        completedSelected +
        '>تکمیل شده</option>' +

        '<option value="cancelled" ' +
        cancelledSelected +
        '>لغو شده</option>' +

        '</select>' +

        '<button onclick="updateOrderStatus(' +
        order.id +
        ')">' +
        'ذخیره وضعیت' +
        '</button>' +

        '</div>' +

        '</div>'
      );

    }).join("");
}


async function updateOrderStatus(orderId) {

  const select =
    document.getElementById(
      "status-" + orderId
    );

  const status =
    select.value;

  const response =
    await fetch(
      "/api/admin/orders/status",
      {

        method:"POST",

        headers:{
          "Content-Type":
            "application/json"
        },

        body:JSON.stringify({
          order_id:orderId,
          status
        })

      }
    );

  const data =
    await response.json();

  if (!data.ok) {

    alert(
      data.error ||
      "تغییر وضعیت انجام نشد."
    );

    return;
  }

  alert(
    "وضعیت سفارش تغییر کرد."
  );

  await loadOrders();
}


checkAdmin();

</script>

</body>

</html>
`;
}


// ============================================================
// 404
// ============================================================

function notFoundPage() {
  return `
<!DOCTYPE html>
<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1.0">

<title>
صفحه پیدا نشد | ${STORE_NAME}
</title>

<style>

* {
  box-sizing:border-box;
}

body {
  margin:0;
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  background:
    radial-gradient(
      circle at top right,
      #eef2ff,
      transparent 35%
    ),
    #f7f8fc;
  font-family:Tahoma,Arial,sans-serif;
  color:#172033;
}

.container {
  width:min(92%,600px);
}

.card {
  background:white;
  padding:45px 25px;
  border-radius:26px;
  text-align:center;
  border:1px solid #e5e7eb;
  box-shadow:0 20px 55px rgba(15,23,42,.08);
}

.code {
  font-size:65px;
  font-weight:900;
  color:#4f46e5;
}

h2 {
  margin:5px 0 10px;
}

p {
  color:#64748b;
}

a {
  display:inline-flex;
  margin-top:18px;
  background:
    linear-gradient(
      135deg,
      #4f46e5,
      #7c3aed
    );
  color:white;
  padding:12px 18px;
  border-radius:12px;
  text-decoration:none;
  font-weight:bold;
}

</style>

</head>

<body>

<div class="container">

<div class="card">

<div class="code">
404
</div>

<h2>
صفحه پیدا نشد
</h2>

<p>
صفحه‌ای که به دنبال آن هستید وجود ندارد.
</p>

<a href="/">
بازگشت به فروشگاه
</a>

</div>

</div>

</body>

</html>
`;
}


// ============================================================
// HELPERS
// ============================================================

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function html(content, status = 200) {
  return new Response(
    content,
    {
      status,
      headers: {
        "Content-Type":
          "text/html; charset=utf-8"
      }
    }
  );
}


function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8"
      }
    }
  );
          }
