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
// HOME PAGE
// ============================================================

function homePage() {
  return `
<!DOCTYPE html>
<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${STORE_NAME} | ${STORE_EN}</title>

<meta name="description"
content="فروشگاه دیجیتال ${STORE_NAME} برای خرید محصولات و ابزارهای دیجیتال">

<style>

* {
  box-sizing:border-box;
}

:root {
  --primary:#5b5cf0;
  --primary-dark:#4647d8;
  --text:#172033;
  --muted:#6b7280;
  --bg:#f5f7ff;
  --card:#ffffff;
  --border:#e7e9f2;
}

body {
  margin:0;
  font-family:Tahoma,Arial,sans-serif;
  background:
    radial-gradient(circle at top right,#eef0ff 0,#f5f7ff 35%,#f8fafc 100%);
  color:var(--text);
}

header {
  background:rgba(255,255,255,.9);
  backdrop-filter:blur(14px);
  border-bottom:1px solid rgba(231,233,242,.9);
  padding:14px 18px;
  position:sticky;
  top:0;
  z-index:20;
}

.nav {
  max-width:1120px;
  margin:auto;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:15px;
}

.logo {
  text-decoration:none;
  color:var(--text);
  font-size:20px;
  font-weight:900;
}

.logo small {
  display:block;
  color:var(--muted);
  font-size:10px;
  margin-top:4px;
  letter-spacing:.5px;
}

.nav-links {
  display:flex;
  gap:6px;
  flex-wrap:wrap;
}

.nav-links a {
  color:#374151;
  text-decoration:none;
  padding:9px 12px;
  border-radius:11px;
  font-size:14px;
  transition:.2s;
}

.nav-links a:hover {
  background:#eef0ff;
  color:var(--primary);
}

.container {
  max-width:1120px;
  margin:auto;
  padding:28px 18px 45px;
}

.hero {
  position:relative;
  overflow:hidden;
  background:
    linear-gradient(135deg,#171a3b 0%,#3639a6 55%,#6466ff 100%);
  color:white;
  padding:48px 30px;
  border-radius:28px;
  margin-bottom:34px;
  box-shadow:0 18px 45px rgba(70,72,216,.22);
}

.hero:before {
  content:"";
  position:absolute;
  width:240px;
  height:240px;
  border-radius:50%;
  background:rgba(255,255,255,.08);
  left:-70px;
  top:-90px;
}

.hero:after {
  content:"";
  position:absolute;
  width:180px;
  height:180px;
  border-radius:50%;
  background:rgba(255,255,255,.06);
  right:8%;
  bottom:-100px;
}

.hero-content {
  position:relative;
  z-index:2;
  max-width:700px;
}

.hero-badge {
  display:inline-block;
  background:rgba(255,255,255,.12);
  border:1px solid rgba(255,255,255,.2);
  padding:7px 12px;
  border-radius:999px;
  font-size:12px;
  margin-bottom:15px;
}

.hero h1 {
  margin:0 0 12px;
  font-size:34px;
  line-height:1.4;
}

.hero p {
  margin:0 0 24px;
  line-height:2;
  color:#eef0ff;
}

.hero-buttons {
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}

.btn {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border:0;
  background:var(--primary);
  color:white;
  padding:11px 17px;
  border-radius:12px;
  cursor:pointer;
  text-decoration:none;
  font-size:14px;
  font-family:inherit;
  transition:.2s;
}

.btn:hover {
  transform:translateY(-1px);
  background:var(--primary-dark);
}

.btn-light {
  background:white;
  color:#30328f;
}

.btn-light:hover {
  background:#f4f5ff;
}

.section-head {
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
  margin:0 0 18px;
}

.section-title {
  margin:0;
  font-size:23px;
}

.section-subtitle {
  color:var(--muted);
  font-size:13px;
}

.products {
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(235px,1fr));
  gap:18px;
}

.card {
  background:var(--card);
  border:1px solid var(--border);
  border-radius:20px;
  padding:18px;
  box-shadow:0 8px 28px rgba(31,41,55,.05);
  transition:.25s;
}

.card:hover {
  transform:translateY(-4px);
  box-shadow:0 14px 35px rgba(31,41,55,.09);
}

.product-image {
  min-height:150px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:64px;
  border-radius:16px;
  background:linear-gradient(135deg,#f1f2ff,#fafaff);
  margin-bottom:15px;
}

.card h3 {
  margin:8px 0;
  font-size:18px;
}

.card p {
  color:var(--muted);
  line-height:1.9;
  min-height:48px;
}

.price {
  font-weight:900;
  color:var(--primary);
  margin:16px 0;
  font-size:18px;
}

.loading {
  grid-column:1/-1;
  text-align:center;
  padding:40px;
  color:var(--muted);
  background:white;
  border-radius:20px;
  border:1px solid var(--border);
}

footer {
  margin-top:25px;
  padding:30px 20px;
  text-align:center;
  color:var(--muted);
  border-top:1px solid var(--border);
  background:white;
}

@media(max-width:650px) {

  .nav {
    align-items:flex-start;
  }

  .nav-links {
    justify-content:flex-end;
  }

  .nav-links a {
    padding:7px 8px;
    font-size:12px;
  }

  .hero {
    padding:35px 20px;
    border-radius:22px;
  }

  .hero h1 {
    font-size:27px;
  }

  .container {
    padding:20px 13px 35px;
  }

  .products {
    grid-template-columns:1fr;
  }
}

</style>
</head>

<body>

<header>
<div class="nav">

<a class="logo" href="/">
${STORE_NAME}
<small>${STORE_EN}</small>
</a>

<div class="nav-links">
<a href="/">خانه</a>
<a href="/account">حساب من</a>
<a href="/admin">مدیریت</a>
</div>

</div>
</header>

<main class="container">

<section class="hero">

<div class="hero-content">

<div class="hero-badge">
فروشگاه دیجیتال ${STORE_EN}
</div>

<h1>
ابزارها و محصولات دیجیتال برای شما
</h1>

<p>
${STORE_NAME} یک فروشگاه دیجیتال برای ارائه
محصولات و ابزارهای کاربردی است؛ ساده، سریع و مناسب موبایل.
</p>

<div class="hero-buttons">

<a class="btn btn-light" href="#products">
مشاهده محصولات
</a>

<a class="btn"
href="/account">
حساب کاربری
</a>

</div>

</div>
</section>

<div class="section-head">

<div>
<h2 class="section-title">
محصولات
</h2>

<div class="section-subtitle">
محصولات دیجیتال موجود در فروشگاه
</div>
</div>

</div>

<div id="products" class="products">

<div class="loading">
در حال دریافت محصولات...
</div>

</div>

</main>

<footer>
${STORE_NAME} — ${STORE_EN}
</footer>

<script>

function escapeHtmlClient(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function loadProducts() {

  const box =
    document.getElementById("products");

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

    if (!data.products || !data.products.length) {

      box.innerHTML =
        '<div class="loading">' +
        'هنوز محصولی ثبت نشده است.' +
        '</div>';

      return;
    }

    box.innerHTML =
      data.products.map(function(product) {

        return (
          '<div class="card">' +

          '<div class="product-image">' +
          escapeHtmlClient(
            product.image || "🛍️"
          ) +
          '</div>' +

          '<h3>' +
          escapeHtmlClient(product.name) +
          '</h3>' +

          '<p>' +
          escapeHtmlClient(
            product.description || ""
          ) +
          '</p>' +

          '<div class="price">' +
          escapeHtmlClient(
            product.price || "تماس بگیرید"
          ) +
          '</div>' +

          '<a class="btn" href="/product/' +
          product.id +
          '">' +
          'مشاهده و سفارش' +
          '</a>' +

          '</div>'
        );

      }).join("");

  } catch (error) {

    box.innerHTML =
      '<div class="loading">' +
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
// PRODUCT PAGE
// ============================================================

function productPage(product) {
  return `
<!DOCTYPE html>
<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

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
  background:#f5f7ff;
  color:#172033;
}

.container {
  max-width:900px;
  margin:auto;
  padding:28px 16px;
}

.back {
  display:inline-flex;
  margin-bottom:18px;
  text-decoration:none;
  color:#4f46e5;
  font-size:14px;
}

.card {
  background:white;
  border:1px solid #e7e9f2;
  border-radius:24px;
  padding:25px;
  box-shadow:0 12px 35px rgba(31,41,55,.07);
}

.image {
  text-align:center;
  font-size:90px;
  padding:35px;
  border-radius:20px;
  background:linear-gradient(135deg,#f0f1ff,#fafaff);
}

h1 {
  margin:25px 0 12px;
}

.description {
  line-height:2;
  color:#5f6675;
}

.price {
  font-size:24px;
  font-weight:900;
  color:#5657e9;
  margin:25px 0;
}

.btn {
  border:0;
  background:#5758ed;
  color:white;
  padding:13px 20px;
  border-radius:12px;
  cursor:pointer;
  font-family:inherit;
}

#message {
  margin-top:20px;
  padding:12px;
  border-radius:12px;
  background:#f5f7ff;
}

</style>

</head>

<body>

<div class="container">

<a class="back" href="/">
← بازگشت به فروشگاه
</a>

<div class="card">

<div class="image">
${escapeHtml(product.image || "🛍️")}
</div>

<h1>
${escapeHtml(product.name)}
</h1>

<div class="description">
${escapeHtml(product.description || "")}
</div>

<div class="price">
${escapeHtml(product.price || "تماس بگیرید")}
</div>

<button class="btn" onclick="buyProduct()">
ثبت سفارش
</button>

<div id="message"></div>

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
// ACCOUNT PAGE
// ============================================================

function accountPage() {
  return `
<!DOCTYPE html>
<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>حساب کاربری | ${STORE_NAME}</title>

<style>

* {
  box-sizing:border-box;
}

body {
  margin:0;
  background:#f5f7ff;
  font-family:Tahoma,Arial,sans-serif;
  color:#172033;
}

.container {
  max-width:900px;
  margin:auto;
  padding:28px 16px;
}

.card {
  background:white;
  border:1px solid #e7e9f2;
  border-radius:22px;
  padding:23px;
  margin-bottom:18px;
  box-shadow:0 10px 30px rgba(31,41,55,.06);
}

h1,h2 {
  margin-top:0;
}

input {
  width:100%;
  padding:13px;
  margin:7px 0 12px;
  border:1px solid #dfe2ec;
  border-radius:12px;
  font-family:inherit;
  outline:none;
}

input:focus {
  border-color:#6366f1;
  box-shadow:0 0 0 3px rgba(99,102,241,.1);
}

button {
  border:0;
  background:#5758ed;
  color:white;
  padding:11px 17px;
  border-radius:11px;
  cursor:pointer;
  font-family:inherit;
}

button.secondary {
  background:#eef0f7;
  color:#303542;
}

hr {
  border:0;
  border-top:1px solid #eceef4;
  margin:25px 0;
}

.orders {
  display:grid;
  gap:12px;
}

.order {
  border:1px solid #e7e9f2;
  border-radius:15px;
  padding:16px;
}

.status {
  display:inline-block;
  background:#f0f1ff;
  color:#5557df;
  padding:6px 10px;
  border-radius:8px;
  margin-top:8px;
}

#authMessage {
  margin-top:12px;
}

</style>

</head>

<body>

<div class="container">

<div class="card">

<h1>
حساب کاربری
</h1>

<p>
مدیریت حساب و سفارش‌های ${STORE_NAME}
</p>

<div id="auth">

<h2>ورود</h2>

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

<h2>ثبت‌نام</h2>

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
ایجاد حساب
</button>

<div id="authMessage"></div>

</div>

<div id="userArea" style="display:none">

<h2>
اطلاعات حساب
</h2>

<div id="userInfo"></div>

<button class="secondary" onclick="logout()">
خروج
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

<a href="/">
بازگشت به فروشگاه
</a>

</div>

<script>

function escapeHtmlClient(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

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
        escapeHtmlClient(data.user.username) +
        '</strong></p>' +

        '<p>ایمیل: ' +
        escapeHtmlClient(data.user.email) +
        '</p>';

    loadOrders();
  }
}


async function register() {

  const username =
    document.getElementById("registerUsername").value;

  const email =
    document.getElementById("registerEmail").value;

  const password =
    document.getElementById("registerPassword").value;

  const message =
    document.getElementById("authMessage");

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
    document.getElementById("loginIdentity").value;

  const password =
    document.getElementById("loginPassword").value;

  const message =
    document.getElementById("authMessage");

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
        escapeHtmlClient(order.product_name) +
        '</p>' +

        '<p>قیمت: ' +
        escapeHtmlClient(
          order.product_price || "-"
        ) +
        '</p>' +

        '<span class="status">' +
        'وضعیت: ' +
        escapeHtmlClient(order.status) +
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
// ADMIN PAGE
// ============================================================

function adminPage() {
  return `
<!DOCTYPE html>
<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>مدیریت | ${STORE_NAME}</title>

<style>

* {
  box-sizing:border-box;
}

body {
  margin:0;
  background:#f5f7ff;
  color:#172033;
  font-family:Tahoma,Arial,sans-serif;
}

.container {
  max-width:1100px;
  margin:auto;
  padding:25px 16px;
}

.card {
  background:white;
  border:1px solid #e7e9f2;
  border-radius:20px;
  padding:22px;
  margin-bottom:18px;
  box-shadow:0 9px 28px rgba(31,41,55,.06);
}

h1,h2 {
  margin-top:0;
}

input,
textarea,
select {
  width:100%;
  padding:12px;
  margin:6px 0 12px;
  border:1px solid #dfe2ec;
  border-radius:11px;
  font-family:inherit;
  outline:none;
}

textarea {
  min-height:100px;
  resize:vertical;
}

button {
  border:0;
  background:#5758ed;
  color:white;
  padding:10px 15px;
  border-radius:10px;
  cursor:pointer;
  font-family:inherit;
}

button.danger {
  background:#dc3545;
}

button.secondary {
  background:#eef0f7;
  color:#303542;
}

.hidden {
  display:none;
}

.products,
.orders {
  display:grid;
  gap:12px;
}

.item {
  border:1px solid #e7e9f2;
  border-radius:15px;
  padding:16px;
}

.row {
  display:flex;
  gap:9px;
  flex-wrap:wrap;
  align-items:center;
}

.order-info {
  line-height:2;
}

.badge {
  display:inline-block;
  padding:5px 9px;
  background:#f0f1ff;
  color:#5557df;
  border-radius:8px;
  font-size:13px;
}

.message {
  margin-top:10px;
  padding:10px;
  border-radius:9px;
}

</style>

</head>

<body>

<div class="container">

<div class="card">

<h1>
پنل مدیریت ${STORE_NAME}
</h1>

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

<div id="loginMessage"></div>

</div>

<div id="adminArea" class="hidden">

<div class="row">

<button class="secondary" onclick="adminLogout()">
خروج از مدیریت
</button>

<button class="secondary" onclick="loadProducts()">
بروزرسانی محصولات
</button>

<button class="secondary" onclick="loadOrders()">
بروزرسانی سفارش‌ها
</button>

</div>

</div>

</div>

<div id="dashboard" class="hidden">

<div class="card">

<h2>
افزودن محصول
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

<div id="productMessage"></div>

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

<a href="/">
بازگشت به فروشگاه
</a>

</div>

<script>

function escapeHtmlClient(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

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
    document.getElementById("adminUsername").value;

  const password =
    document.getElementById("adminPassword").value;

  const message =
    document.getElementById("loginMessage");

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
        escapeHtmlClient(product.name) +
        '</strong>' +

        '<p>' +
        escapeHtmlClient(
          product.description || ""
        ) +
        '</p>' +

        '<p>قیمت: ' +
        escapeHtmlClient(
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
    document.getElementById("productName").value;

  const description =
    document.getElementById("productDescription").value;

  const price =
    document.getElementById("productPrice").value;

  const image =
    document.getElementById("productImage").value;

  const message =
    document.getElementById("productMessage");

  const response =
    await fetch(
      "/api/admin/products",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
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

    document.getElementById("productName").value = "";
    document.getElementById("productDescription").value = "";
    document.getElementById("productPrice").value = "";
    document.getElementById("productImage").value = "🛍️";

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
          "Content-Type":"application/json"
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
        escapeHtmlClient(order.username) +

        '<br>' +

        'ایمیل: ' +
        escapeHtmlClient(order.email) +

        '<br>' +

        'محصول: ' +
        escapeHtmlClient(order.product_name) +

        '<br>' +

        'قیمت: ' +
        escapeHtmlClient(
          order.product_price || "-"
        ) +

        '<br>' +

        'تاریخ: ' +
        escapeHtmlClient(order.created_at) +

        '<br>' +

        'وضعیت فعلی: ' +

        '<span class="badge">' +
        escapeHtmlClient(order.status) +
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
          "Content-Type":"application/json"
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
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>صفحه پیدا نشد | ${STORE_NAME}</title>

<style>

body {
  margin:0;
  background:#f5f7ff;
  font-family:Tahoma,Arial,sans-serif;
  color:#172033;
}

.container {
  max-width:700px;
  margin:90px auto;
  padding:20px;
  text-align:center;
}

.card {
  background:white;
  padding:40px;
  border-radius:24px;
  border:1px solid #e7e9f2;
  box-shadow:0 12px 35px rgba(31,41,55,.07);
}

a {
  display:inline-block;
  margin-top:20px;
  background:#5758ed;
  color:white;
  padding:12px 18px;
  border-radius:11px;
  text-decoration:none;
}

</style>

</head>

<body>

<div class="container">

<div class="card">

<h1>404</h1>

<h2>
صفحه پیدا نشد
</h2>

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
