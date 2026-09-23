const STORE_NAME = "دیجی‌ماریکسو";
const STORE_EN = "DigiMarixo";
const DEFAULT_ADMIN_USERNAME = "admin";

/* =========================================================
   MAIN WORKER
========================================================= */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      await initDB(env);

      /* =========================
         BASIC / HEALTH
      ========================= */

      if (path === "/health" && method === "GET") {
        return json({
          ok: true,
          store: STORE_EN,
          database: !!env.DB
        });
      }

      /* =========================
         API - PRODUCTS
      ========================= */

      if (path === "/api/products" && method === "GET") {
        const products = await getProducts(env);

        return json({
          ok: true,
          products
        });
      }

      /* =========================
         API - REGISTER
      ========================= */

      if (path === "/api/register" && method === "POST") {
        const body = await readJSON(request);

        const username = String(body.username || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

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

        const existing = await env.DB.prepare(`
          SELECT id
          FROM users
          WHERE username = ? OR email = ?
          LIMIT 1
        `).bind(username, email).first();

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
        `).bind(
          username,
          email,
          passwordHash,
          Date.now()
        ).run();

        const userId = result.meta.last_row_id;
        const token = randomToken();

        await env.DB.prepare(`
          INSERT INTO sessions
          (token, user_id, created_at)
          VALUES (?, ?, ?)
        `).bind(
          token,
          userId,
          Date.now()
        ).run();

        return new Response(JSON.stringify({
          ok: true,
          message: "حساب با موفقیت ساخته شد."
        }), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Set-Cookie": cookieHeader("session", token)
          }
        });
      }

      /* =========================
         API - LOGIN
      ========================= */

      if (path === "/api/login" && method === "POST") {
        const body = await readJSON(request);

        const login = String(body.login || "").trim();
        const password = String(body.password || "");

        if (!login || !password) {
          return json({
            ok: false,
            error: "نام کاربری/ایمیل و رمز عبور را وارد کنید."
          }, 400);
        }

        const user = await env.DB.prepare(`
          SELECT *
          FROM users
          WHERE username = ? OR email = ?
          LIMIT 1
        `).bind(
          login,
          login.toLowerCase()
        ).first();

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

        await env.DB.prepare(`
          INSERT INTO sessions
          (token, user_id, created_at)
          VALUES (?, ?, ?)
        `).bind(
          token,
          user.id,
          Date.now()
        ).run();

        return new Response(JSON.stringify({
          ok: true,
          message: "ورود موفق بود."
        }), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Set-Cookie": cookieHeader("session", token)
          }
        });
      }

      /* =========================
         API - LOGOUT
      ========================= */

      if (path === "/api/logout" && method === "POST") {
        const token = getCookie(request, "session");

        if (token) {
          await env.DB.prepare(`
            DELETE FROM sessions
            WHERE token = ?
          `).bind(token).run();
        }

        return new Response(JSON.stringify({
          ok: true
        }), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Set-Cookie": cookieHeader("session", "", true)
          }
        });
      }

      /* =========================
         API - ME
      ========================= */

      if (path === "/api/me" && method === "GET") {
        const user = await getCurrentUser(request, env);

        if (!user) {
          return json({
            ok: true,
            loggedIn: false
          });
        }

        return json({
          ok: true,
          loggedIn: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            created_at: user.created_at
          }
        });
      }

      /* =========================
         API - ORDERS
      ========================= */

      if (path === "/api/orders" && method === "GET") {
        const user = await getCurrentUser(request, env);

        if (!user) {
          return json({
            ok: false,
            error: "ابتدا وارد حساب شوید."
          }, 401);
        }

        const result = await env.DB.prepare(`
          SELECT *
          FROM orders
          WHERE user_id = ?
          ORDER BY id DESC
        `).bind(user.id).all();

        return json({
          ok: true,
          orders: result.results || []
        });
      }

      if (path === "/api/orders" && method === "POST") {
        const user = await getCurrentUser(request, env);

        if (!user) {
          return json({
            ok: false,
            error: "ابتدا وارد حساب شوید."
          }, 401);
        }

        const body = await readJSON(request);
        const productId = Number(body.productId);

        if (!productId) {
          return json({
            ok: false,
            error: "محصول انتخاب نشده است."
          }, 400);
        }

        const product = await getProduct(env, productId);

        if (!product) {
          return json({
            ok: false,
            error: "محصول پیدا نشد."
          }, 404);
        }

        const orderResult = await env.DB.prepare(`
          INSERT INTO orders
          (user_id, total_price, status, created_at)
          VALUES (?, ?, ?, ?)
        `).bind(
          user.id,
          product.price,
          "pending",
          Date.now()
        ).run();

        const orderId = orderResult.meta.last_row_id;

        await env.DB.prepare(`
          INSERT INTO order_items
          (order_id, product_id, quantity, price)
          VALUES (?, ?, ?, ?)
        `).bind(
          orderId,
          product.id,
          1,
          product.price
        ).run();

        return json({
          ok: true,
          message: "سفارش با موفقیت ثبت شد.",
          orderId
        });
      }

      /* =========================
         ADMIN LOGIN
      ========================= */

      if (path === "/api/admin/login" && method === "POST") {
        const body = await readJSON(request);

        const username = String(body.username || "").trim();
        const password = String(body.password || "");
        const adminPassword = String(env.ADMIN_PASSWORD || "");

        if (!adminPassword) {
          return json({
            ok: false,
            error: "ADMIN_PASSWORD در Cloudflare تنظیم نشده است."
          }, 500);
        }

        if (
          username !== DEFAULT_ADMIN_USERNAME ||
          password !== adminPassword
        ) {
          return json({
            ok: false,
            error: "اطلاعات مدیریت صحیح نیست."
          }, 401);
        }

        const token = randomToken();

        await env.DB.prepare(`
          INSERT INTO admin_sessions
          (token, username, created_at)
          VALUES (?, ?, ?)
        `).bind(
          token,
          username,
          Date.now()
        ).run();

        return new Response(JSON.stringify({
          ok: true,
          message: "ورود مدیریت موفق بود."
        }), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Set-Cookie": cookieHeader("admin_session", token)
          }
        });
      }

      /* =========================
         ADMIN LOGOUT
      ========================= */

      if (path === "/api/admin/logout" && method === "POST") {
        const token = getCookie(request, "admin_session");

        if (token) {
          await env.DB.prepare(`
            DELETE FROM admin_sessions
            WHERE token = ?
          `).bind(token).run();
        }

        return new Response(JSON.stringify({
          ok: true
        }), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Set-Cookie": cookieHeader(
              "admin_session",
              "",
              true
            )
          }
        });
      }

      /* =========================
         ADMIN ME
      ========================= */

      if (path === "/api/admin/me" && method === "GET") {
        const admin = await getAdmin(request, env);

        return json({
          ok: true,
          loggedIn: !!admin,
          admin: admin || null
        });
      }

      /* =========================
         ADMIN PRODUCTS
      ========================= */

      if (
        path === "/api/admin/products" &&
        method === "GET"
      ) {
        const admin = await getAdmin(request, env);

        if (!admin) {
          return json({
            ok: false,
            error: "دسترسی غیرمجاز."
          }, 401);
        }

        const products = await getProducts(env);

        return json({
          ok: true,
          products
        });
      }

      if (
        path === "/api/admin/products" &&
        method === "POST"
      ) {
        const admin = await getAdmin(request, env);

        if (!admin) {
          return json({
            ok: false,
            error: "دسترسی غیرمجاز."
          }, 401);
        }

        const body = await readJSON(request);

        const name = String(body.name || "").trim();
        const description = String(
          body.description || ""
        ).trim();

        const price = normalizePrice(body.price);

        if (!name || !price) {
          return json({
            ok: false,
            error: "نام محصول و قیمت را وارد کنید."
          }, 400);
        }

        const result = await env.DB.prepare(`
          INSERT INTO products
          (name, description, price, created_at)
          VALUES (?, ?, ?, ?)
        `).bind(
          name,
          description,
          price,
          Date.now()
        ).run();

        return json({
          ok: true,
          message: "محصول اضافه شد.",
          id: result.meta.last_row_id
        });
      }

      if (
        path.startsWith("/api/admin/products/") &&
        method === "DELETE"
      ) {
        const admin = await getAdmin(request, env);

        if (!admin) {
          return json({
            ok: false,
            error: "دسترسی غیرمجاز."
          }, 401);
        }

        const id = Number(
          path.split("/").pop()
        );

        if (!id) {
          return json({
            ok: false,
            error: "شناسه محصول نامعتبر است."
          }, 400);
        }

        await env.DB.prepare(`
          DELETE FROM products
          WHERE id = ?
        `).bind(id).run();

        return json({
          ok: true,
          message: "محصول حذف شد."
        });
      }

      /* =========================
         ADMIN ORDERS
      ========================= */

      if (
        path === "/api/admin/orders" &&
        method === "GET"
      ) {
        const admin = await getAdmin(request, env);

        if (!admin) {
          return json({
            ok: false,
            error: "دسترسی غیرمجاز."
          }, 401);
        }

        const result = await env.DB.prepare(`
          SELECT
            orders.*,
            users.username,
            users.email
          FROM orders
          LEFT JOIN users
            ON users.id = orders.user_id
          ORDER BY orders.id DESC
        `).all();

        return json({
          ok: true,
          orders: result.results || []
        });
      }

      if (
        path === "/api/admin/orders/status" &&
        method === "POST"
      ) {
        const admin = await getAdmin(request, env);

        if (!admin) {
          return json({
            ok: false,
            error: "دسترسی غیرمجاز."
          }, 401);
        }

        const body = await readJSON(request);

        const orderId = Number(body.orderId);
        const status = String(body.status || "").trim();

        const allowed = [
          "pending",
          "paid",
          "processing",
          "completed",
          "cancelled"
        ];

        if (!orderId || !allowed.includes(status)) {
          return json({
            ok: false,
            error: "اطلاعات وضعیت سفارش نامعتبر است."
          }, 400);
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
          message: "وضعیت سفارش تغییر کرد."
        });
      }

      /* =========================
         PAGES
      ========================= */

      if (path === "/" && method === "GET") {
        return html(
          await homePage(env)
        );
      }

      if (
        path.startsWith("/product/") &&
        method === "GET"
      ) {
        const id = Number(
          path.split("/").pop()
        );

        const product = await getProduct(env, id);

        if (!product) {
          return html(
            notFoundPage(),
            404
          );
        }

        return html(
          productPage(product)
        );
      }

      if (
        path === "/account" &&
        method === "GET"
      ) {
        return html(
          accountPage()
        );
      }

      if (
        path === "/admin" &&
        method === "GET"
      ) {
        return html(
          adminPage()
        );
      }

      return html(
        notFoundPage(),
        404
      );

    } catch (error) {
      return json({
        ok: false,
        error: error?.message || "خطای داخلی سرور."
      }, 500);
    }
  }
};


/* =========================================================
   DATABASE
========================================================= */

async function initDB(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total_price INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `).run();
}


/* =========================================================
   PRODUCTS
========================================================= */

async function getProducts(env) {
  const result = await env.DB.prepare(`
    SELECT *
    FROM products
    ORDER BY id DESC
  `).all();

  return result.results || [];
}

async function getProduct(env, id) {
  return await env.DB.prepare(`
    SELECT *
    FROM products
    WHERE id = ?
    LIMIT 1
  `).bind(id).first();
}


/* =========================================================
   PRICE
========================================================= */

function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, d =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    )
    .replace(/[٠-٩]/g, d =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(d))
    );
}

function normalizePrice(value) {
  const clean = normalizeDigits(value)
    .replace(/[^\d]/g, "");

  return Number(clean || 0);
}

function formatPrice(value) {
  return Number(value || 0)
    .toLocaleString("fa-IR") + " تومان";
}


/* =========================================================
   AUTH
========================================================= */

async function getCurrentUser(request, env) {
  const token = getCookie(request, "session");

  if (!token) {
    return null;
  }

  const result = await env.DB.prepare(`
    SELECT users.*
    FROM sessions
    JOIN users
      ON users.id = sessions.user_id
    WHERE sessions.token = ?
    LIMIT 1
  `).bind(token).first();

  return result || null;
}

async function getAdmin(request, env) {
  const token = getCookie(
    request,
    "admin_session"
  );

  if (!token) {
    return null;
  }

  const result = await env.DB.prepare(`
    SELECT *
    FROM admin_sessions
    WHERE token = ?
    LIMIT 1
  `).bind(token).first();

  return result || null;
}


/* =========================================================
   PASSWORD / TOKEN
========================================================= */

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);

  const hash = await crypto.subtle.digest(
    "SHA-256",
    data
  );

  return [...new Uint8Array(hash)]
    .map(x =>
      x.toString(16).padStart(2, "0")
    )
    .join("");
}

function randomToken() {
  return crypto.randomUUID() +
    "-" +
    crypto.randomUUID();
}


/* =========================================================
   REQUEST
========================================================= */

async function readJSON(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const parts = cookie.split(";");

  for (const part of parts) {
    const [key, ...rest] = part.trim().split("=");

    if (key === name) {
      return rest.join("=");
    }
  }

  return null;
}

function cookieHeader(name, value, remove = false) {
  if (remove) {
    return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
  }

  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}


/* =========================================================
   RESPONSE
========================================================= */

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}

function html(content, status = 200) {
  return new Response(
    content,
    {
      status,
      headers: {
        "Content-Type":
          "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}


/* =========================================================
   SECURITY / HTML
========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function statusLabel(status) {
  const labels = {
    pending: "در انتظار پرداخت",
    paid: "پرداخت شده",
    processing: "در حال پردازش",
    completed: "تکمیل شده",
    cancelled: "لغو شده"
  };

  return labels[status] || status;
}


/* =========================================================
   BASE PAGE
========================================================= */

function basePage(
  title,
  content,
  scripts = ""
) {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>${escapeHtml(title)} | ${STORE_NAME}</title>

<meta
  name="theme-color"
  content="#6d5dfc"
>

<meta
  name="description"
  content="فروشگاه دیجیتال ${STORE_EN}"
>

<style>

*{
  box-sizing:border-box;
}

html{
  scroll-behavior:smooth;
}

body{
  margin:0;
  font-family:
    Tahoma,
    Arial,
    sans-serif;

  color:#172033;

  background:
    radial-gradient(
      circle at top right,
      rgba(124,92,255,.18),
      transparent 35%
    ),
    radial-gradient(
      circle at bottom left,
      rgba(255,82,151,.13),
      transparent 35%
    ),
    #f6f8ff;

  min-height:100vh;
}

a{
  color:inherit;
  text-decoration:none;
}

button,
input,
textarea,
select{
  font-family:inherit;
}

button{
  cursor:pointer;
}

.container{
  width:min(1120px, calc(100% - 28px));
  margin:auto;
}


/* =========================
   HEADER
========================= */

header{
  position:sticky;
  top:0;
  z-index:50;

  background:
    rgba(255,255,255,.82);

  backdrop-filter:
    blur(18px);

  -webkit-backdrop-filter:
    blur(18px);

  border-bottom:
    1px solid rgba(110,93,252,.12);
}

.nav{
  min-height:76px;

  display:flex;
  align-items:center;
  justify-content:space-between;

  gap:20px;
}

.brand{
  display:flex;
  align-items:center;
  gap:12px;

  font-weight:900;
}

.logo{
  width:46px;
  height:46px;

  border-radius:15px;

  display:grid;
  place-items:center;

  color:white;

  font-size:20px;
  font-weight:900;

  background:
    linear-gradient(
      135deg,
      #6d5dfc,
      #8b5cf6,
      #ec4899
    );

  box-shadow:
    0 10px 25px
    rgba(109,93,252,.28);
}

.brand-title{
  font-size:17px;
}

.brand-en{
  display:block;

  color:#7b8192;

  font-size:11px;
  margin-top:3px;

  direction:ltr;
  text-align:right;
}

.nav-links{
  display:flex;
  align-items:center;
  gap:8px;

  flex-wrap:wrap;
}

.nav-links a{
  padding:10px 14px;

  border-radius:12px;

  color:#4a5265;

  font-size:14px;

  transition:
    .2s ease;
}

.nav-links a:hover{
  color:#fff;

  background:
    linear-gradient(
      135deg,
      #6d5dfc,
      #ec4899
    );

  transform:translateY(-1px);
}


/* =========================
   MAIN
========================= */

main{
  padding:
    35px 0
    60px;
}

.hero{
  position:relative;
  overflow:hidden;

  padding:
    60px 30px;

  border-radius:30px;

  color:#fff;

  background:
    linear-gradient(
      135deg,
      #5146d9 0%,
      #6d5dfc 42%,
      #b64fc8 72%,
      #ec4899 100%
    );

  box-shadow:
    0 25px 70px
    rgba(82,68,200,.25);

  margin-bottom:32px;
}

.hero:before{
  content:"";

  position:absolute;

  width:260px;
  height:260px;

  border-radius:50%;

  background:
    rgba(255,255,255,.12);

  top:-100px;
  left:-70px;
}

.hero:after{
  content:"";

  position:absolute;

  width:220px;
  height:220px;

  border-radius:50%;

  background:
    rgba(255,255,255,.10);

  bottom:-100px;
  right:-50px;
}

.hero-content{
  position:relative;
  z-index:2;
}

.eyebrow{
  display:inline-block;

  padding:
    8px 13px;

  border-radius:999px;

  background:
    rgba(255,255,255,.16);

  border:
    1px solid
    rgba(255,255,255,.2);

  font-size:12px;

  margin-bottom:16px;
}

.hero h1{
  margin:0 0 14px;

  font-size:
    clamp(30px, 6vw, 56px);

  line-height:1.15;
}

.hero p{
  max-width:650px;

  line-height:2;

  margin:0;

  color:
    rgba(255,255,255,.9);
}


/* =========================
   BUTTONS
========================= */

.btn{
  border:0;

  display:inline-flex;

  align-items:center;
  justify-content:center;

  gap:8px;

  min-height:46px;

  padding:
    0 18px;

  border-radius:14px;

  font-weight:800;

  transition:
    .2s ease;
}

.btn:hover{
  transform:translateY(-2px);

  box-shadow:
    0 12px 25px
    rgba(0,0,0,.12);
}

.btn-primary{
  color:white;

  background:
    linear-gradient(
      135deg,
      #6d5dfc,
      #ec4899
    );
}

.btn-white{
  color:#5b4bd8;

  background:white;
}

.btn-danger{
  color:white;

  background:
    linear-gradient(
      135deg,
      #ef4444,
      #dc2626
    );
}

.btn-success{
  color:white;

  background:
    linear-gradient(
      135deg,
      #10b981,
      #059669
    );
}

.btn-small{
  min-height:38px;

  padding:
    0 13px;

  border-radius:10px;

  font-size:13px;
}


/* =========================
   SECTIONS
========================= */

.section-title{
  display:flex;

  align-items:end;
  justify-content:space-between;

  gap:15px;

  margin:
    35px 0 18px;
}

.section-title h2{
  margin:0;

  font-size:24px;
}

.section-title p{
  margin:0;

  color:#818899;

  font-size:13px;
}


/* =========================
   FEATURES
========================= */

.features{
  display:grid;

  grid-template-columns:
    repeat(3,1fr);

  gap:18px;
}

.feature{
  padding:22px;

  border-radius:22px;

  background:
    rgba(255,255,255,.8);

  border:
    1px solid
    rgba(109,93,252,.1);

  box-shadow:
    0 10px 35px
    rgba(28,35,70,.07);

  transition:.2s ease;
}

.feature:hover{
  transform:
    translateY(-5px);

  box-shadow:
    0 18px 45px
    rgba(28,35,70,.11);
}

.feature-icon{
  width:50px;
  height:50px;

  display:grid;
  place-items:center;

  border-radius:16px;

  color:white;

  font-size:21px;

  margin-bottom:15px;

  background:
    linear-gradient(
      135deg,
      #6d5dfc,
      #ec4899
    );
}

.feature:nth-child(2) .feature-icon{
  background:
    linear-gradient(
      135deg,
      #06b6d4,
      #3b82f6
    );
}

.feature:nth-child(3) .feature-icon{
  background:
    linear-gradient(
      135deg,
      #f59e0b,
      #ef4444
    );
}

.feature h3{
  margin:
    0 0 8px;
}

.feature p{
  margin:0;

  color:#777f91;

  line-height:1.9;

  font-size:14px;
}


/* =========================
   PRODUCTS
========================= */

.products{
  display:grid;

  grid-template-columns:
    repeat(3,1fr);

  gap:20px;
}

.product{
  overflow:hidden;

  border-radius:23px;

  background:white;

  border:
    1px solid
    rgba(109,93,252,.1);

  box-shadow:
    0 12px 38px
    rgba(25,30,60,.08);

  transition:
    .25s ease;
}

.product:hover{
  transform:
    translateY(-6px);

  box-shadow:
    0 22px 50px
    rgba(25,30,60,.13);
}

.product-top{
  height:150px;

  display:grid;
  place-items:center;

  color:white;

  font-size:40px;

  background:
    linear-gradient(
      135deg,
      #6d5dfc,
      #ec4899
    );
}

.product:nth-child(3n+2) .product-top{
  background:
    linear-gradient(
      135deg,
      #06b6d4,
      #3b82f6
    );
}

.product:nth-child(3n) .product-top{
  background:
    linear-gradient(
      135deg,
      #f59e0b,
      #ef4444
    );
}

.product-body{
  padding:20px;
}

.product h3{
  margin:
    0 0 8px;

  font-size:18px;
}

.product p{
  color:#777f91;

  line-height:1.8;

  min-height:52px;

  font-size:13px;
}

.price{
  color:#5b4bd8;

  font-size:20px;

  font-weight:900;

  margin:
    15px 0;
}


/* =========================
   CARDS / FORMS
========================= */

.card{
  background:white;

  border-radius:24px;

  padding:24px;

  border:
    1px solid
    rgba(109,93,252,.1);

  box-shadow:
    0 12px 40px
    rgba(25,30,60,.07);

  margin-bottom:20px;
}

.form{
  max-width:550px;
  margin:auto;
}

.form-group{
  margin-bottom:15px;
}

label{
  display:block;

  margin-bottom:7px;

  font-size:13px;

  font-weight:700;

  color:#4b5365;
}

input,
textarea,
select{
  width:100%;

  border:
    1px solid #e2e5ef;

  border-radius:13px;

  padding:
    13px 14px;

  background:#fafbff;

  color:#172033;

  outline:none;

  transition:.2s ease;
}

input:focus,
textarea:focus,
select:focus{
  border-color:#6d5dfc;

  box-shadow:
    0 0 0 4px
    rgba(109,93,252,.10);

  background:white;
}

textarea{
  min-height:110px;

  resize:vertical;
}


/* =========================
   TABLE
========================= */

.table-wrap{
  overflow-x:auto;
}

table{
  width:100%;

  border-collapse:collapse;

  min-width:650px;
}

th,
td{
  padding:13px;

  border-bottom:
    1px solid #edf0f6;

  text-align:right;

  font-size:13px;
}

th{
  color:#5b4bd8;

  background:#f7f6ff;
}


/* =========================
   BADGES
========================= */

.badge{
  display:inline-flex;

  align-items:center;

  padding:
    6px 10px;

  border-radius:999px;

  font-size:11px;

  font-weight:800;

  background:#f1efff;

  color:#5b4bd8;
}


/* =========================
   PRODUCT DETAIL
========================= */

.product-detail{
  display:grid;

  grid-template-columns:
    .9fr 1.1fr;

  gap:28px;

  align-items:stretch;
}

.product-cover{
  min-height:350px;

  border-radius:28px;

  display:grid;

  place-items:center;

  color:white;

  font-size:80px;

  background:
    linear-gradient(
      135deg,
      #6d5dfc,
      #ec4899
    );

  box-shadow:
    0 25px 60px
    rgba(109,93,252,.2);
}

.product-detail-info{
  background:white;

  border-radius:28px;

  padding:30px;

  box-shadow:
    0 15px 45px
    rgba(25,30,60,.08);
}

.product-detail-info h1{
  margin-top:0;

  font-size:32px;
}

.description{
  color:#737b8c;

  line-height:2;

  white-space:pre-wrap;
}


/* =========================
   EMPTY
========================= */

.empty{
  padding:45px 20px;

  text-align:center;

  border-radius:22px;

  background:white;

  color:#7d8596;

  box-shadow:
    0 10px 35px
    rgba(25,30,60,.06);
}


/* =========================
   ALERT
========================= */

.alert{
  padding:14px 16px;

  border-radius:14px;

  background:#f3f1ff;

  color:#5547c9;

  margin-bottom:16px;

  font-size:13px;
}


/* =========================
   FOOTER
========================= */

footer{
  padding:
    30px 0;

  border-top:
    1px solid
    rgba(109,93,252,.1);

  background:
    rgba(255,255,255,.7);

  color:#7c8494;

  text-align:center;

  font-size:13px;
}


/* =========================
   MOBILE
========================= */

@media(max-width:800px){

  .nav{
    padding:
      10px 0;

    align-items:flex-start;

    flex-direction:column;
  }

  .nav-links{
    width:100%;

    overflow-x:auto;

    flex-wrap:nowrap;

    padding-bottom:3px;
  }

  .nav-links a{
    white-space:nowrap;
  }

  .hero{
    padding:
      42px 22px;

    border-radius:24px;
  }

  .features,
  .products{
    grid-template-columns:1fr;
  }

  .product-detail{
    grid-template-columns:1fr;
  }

  .product-cover{
    min-height:240px;
  }

  .product-detail-info{
    padding:22px;
  }

  .card{
    padding:18px;
  }
}

@media(max-width:480px){

  .container{
    width:
      calc(100% - 20px);
  }

  main{
    padding-top:22px;
  }

  .hero h1{
    font-size:30px;
  }

  .section-title{
    align-items:flex-start;
    flex-direction:column;
  }

  .btn{
    width:100%;
  }

}


/* =========================
   ANIMATION
========================= */

@keyframes fadeUp{
  from{
    opacity:0;
    transform:translateY(12px);
  }

  to{
    opacity:1;
    transform:translateY(0);
  }
}

.hero,
.feature,
.product,
.card{
  animation:
    fadeUp .45s ease both;
}

</style>
</head>

<body>

<header>
  <div class="container nav">

    <a href="/" class="brand">

      <div class="logo">
        D
      </div>

      <div>
        <div class="brand-title">
          ${STORE_NAME}
        </div>

        <span class="brand-en">
          ${STORE_EN}
        </span>
      </div>

    </a>

    <nav class="nav-links">

      <a href="/">
        خانه
      </a>

      <a href="/#products">
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

<main>
  <div class="container">
    ${content}
  </div>
</main>

<footer>
  <div class="container">
    ${STORE_NAME} © 2026
    <br>
    <span style="font-size:11px">
      ${STORE_EN} Digital Store
    </span>
  </div>
</footer>

${scripts}

</body>
</html>`;
}


/* =========================================================
   HOME
========================================================= */

async function homePage(env) {
  const products = await getProducts(env);

  const productHTML = products.length
    ? products.map(product => `
      <article class="product">

        <div class="product-top">
          ✦
        </div>

        <div class="product-body">

          <h3>
            ${escapeHtml(product.name)}
          </h3>

          <p>
            ${escapeHtml(
              product.description || "محصول دیجیتال"
            )}
          </p>

          <div class="price">
            ${formatPrice(product.price)}
          </div>

          <a
            class="btn btn-primary"
            href="/product/${product.id}"
          >
            مشاهده محصول
          </a>

        </div>

      </article>
    `).join("")
    : `
      <div class="empty">
        هنوز محصولی ثبت نشده است.
      </div>
    `;

  return basePage(
    "فروشگاه دیجیتال",
    `

    <section class="hero">

      <div class="hero-content">

        <span class="eyebrow">
          DIGITAL PRODUCTS • SIMPLE • MODERN
        </span>

        <h1>
          فروشگاه دیجیتال
          ${STORE_EN}
        </h1>

        <p>
          ابزارهای دیجیتال برای شما
          با تجربه‌ای ساده، سریع و مناسب موبایل.
        </p>

        <div style="margin-top:24px">

          <a
            href="#products"
            class="btn btn-white"
          >
            مشاهده محصولات
          </a>

        </div>

      </div>

    </section>


    <section>

      <div class="section-title">

        <div>
          <h2>
            چرا ${STORE_NAME}؟
          </h2>

          <p>
            ساده، سریع و کاربردی
          </p>
        </div>

      </div>

      <div class="features">

        <div class="feature">

          <div class="feature-icon">
            ⚡
          </div>

          <h3>
            ساده و سریع
          </h3>

          <p>
            خرید و استفاده از محصولات
            با چند مرحله ساده.
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
            طراحی واکنش‌گرا برای
            گوشی و تبلت.
          </p>

        </div>


        <div class="feature">

          <div class="feature-icon">
            ✨
          </div>

          <h3>
            محصولات دیجیتال
          </h3>

          <p>
            دسترسی آسان به محصولات
            و ابزارهای دیجیتال.
          </p>

        </div>

      </div>

    </section>


    <section id="products">

      <div class="section-title">

        <div>
          <h2>
            محصولات
          </h2>

          <p>
            محصولات موجود در فروشگاه
          </p>
        </div>

      </div>

      <div class="products">
        ${productHTML}
      </div>

    </section>

    `
  );
}


/* =========================================================
   PRODUCT PAGE
========================================================= */

function productPage(product) {
  return basePage(
    product.name,
    `

    <div class="product-detail">

      <div class="product-cover">
        ✦
      </div>

      <div class="product-detail-info">

        <span class="badge">
          محصول دیجیتال
        </span>

        <h1>
          ${escapeHtml(product.name)}
        </h1>

        <div class="price">
          ${formatPrice(product.price)}
        </div>

        <div class="description">
          ${escapeHtml(
            product.description ||
            "توضیحات محصول ثبت نشده است."
          )}
        </div>

        <div style="margin-top:25px">

          <button
            class="btn btn-primary"
            onclick="createOrder(${product.id})"
          >
            ثبت سفارش
          </button>

        </div>

        <div
          id="message"
          style="margin-top:15px"
        ></div>

      </div>

    </div>


    <script>

    async function createOrder(productId){

      const message =
        document.getElementById("message");

      message.innerHTML =
        '<div class="alert">در حال ثبت سفارش...</div>';

      try{

        const response =
          await fetch("/api/orders",{
            method:"POST",

            headers:{
              "Content-Type":
                "application/json"
            },

            body:JSON.stringify({
              productId
            })
          });

        const data =
          await response.json();

        if(!data.ok){

          message.innerHTML =
            '<div class="alert">' +
            escapeText(data.error || "خطا") +
            '</div>';

          if(response.status === 401){
            setTimeout(()=>{
              location.href="/account";
            },1000);
          }

          return;
        }

        message.innerHTML =
          '<div class="alert">' +
          'سفارش شما با موفقیت ثبت شد.' +
          '<br>شماره سفارش: ' +
          data.orderId +
          '</div>';

      }catch(error){

        message.innerHTML =
          '<div class="alert">' +
          'خطا در ارتباط با سرور.' +
          '</div>';
      }
    }

    function escapeText(text){

      const div =
        document.createElement("div");

      div.textContent = text;

      return div.innerHTML;
    }

    </script>

    `
  );
}


/* =========================================================
   ACCOUNT PAGE
========================================================= */

function accountPage() {
  return basePage(
    "حساب کاربری",
    `

    <div class="section-title">

      <div>
        <h2>
          حساب کاربری
        </h2>

        <p>
          مدیریت حساب و سفارش‌های ${STORE_NAME}
        </p>
      </div>

    </div>


    <div
      id="account-area"
      class="card"
    >
      در حال بررسی حساب...
    </div>


    <script>

    async function loadAccount(){

      const area =
        document.getElementById(
          "account-area"
        );

      try{

        const response =
          await fetch("/api/me");

        const data =
          await response.json();

        if(data.loggedIn){

          await loadLoggedAccount(data.user);

        }else{

          showLogin();

        }

      }catch(error){

        area.innerHTML =
          '<div class="alert">' +
          'خطا در ارتباط با سرور.' +
          '</div>';

      }
    }


    function showLogin(){

      document.getElementById(
        "account-area"
      ).innerHTML = `

        <div class="form">

          <h3>
            ورود
          </h3>

          <div class="form-group">

            <label>
              نام کاربری یا ایمیل
            </label>

            <input
              id="login"
              autocomplete="username"
            >

          </div>


          <div class="form-group">

            <label>
              رمز عبور
            </label>

            <input
              id="loginPassword"
              type="password"
              autocomplete="current-password"
            >

          </div>


          <button
            class="btn btn-primary"
            onclick="login()"
          >
            ورود
          </button>


          <hr
            style="
              margin:30px 0;
              border:0;
              border-top:
              1px solid #eee;
            "
          >


          <h3>
            ثبت‌نام
          </h3>


          <div class="form-group">

            <label>
              نام کاربری
            </label>

            <input id="registerUsername">

          </div>


          <div class="form-group">

            <label>
              ایمیل
            </label>

            <input
              id="registerEmail"
              type="email"
            >

          </div>


          <div class="form-group">

            <label>
              رمز عبور
            </label>

            <input
              id="registerPassword"
              type="password"
            >

          </div>


          <button
            class="btn btn-success"
            onclick="register()"
          >
            ایجاد حساب
          </button>


          <div
            id="account-message"
            style="margin-top:15px"
          ></div>

        </div>
      `;
    }


    async function login(){

      const message =
        document.getElementById(
          "account-message"
        );

      const loginValue =
        document.getElementById(
          "login"
        ).value.trim();

      const password =
        document.getElementById(
          "loginPassword"
        ).value;

      const response =
        await fetch(
          "/api/login",
          {
            method:"POST",

            headers:{
              "Content-Type":
                "application/json"
            },

            body:JSON.stringify({
              login:loginValue,
              password
            })
          }
        );

      const data =
        await response.json();

      if(!data.ok){

        message.innerHTML =
          '<div class="alert">' +
          escapeText(
            data.error || "خطا"
          ) +
          '</div>';

        return;
      }

      location.reload();
    }


    async function register(){

      const message =
        document.getElementById(
          "account-message"
        );

      const username =
        document.getElementById(
          "registerUsername"
        ).value.trim();

      const email =
        document.getElementById(
          "registerEmail"
        ).value.trim();

      const password =
        document.getElementById(
          "registerPassword"
        ).value;

      const response =
        await fetch(
          "/api/register",
          {
            method:"POST",

            headers:{
              "Content-Type":
                "application/json"
            },

            body:JSON.stringify({
              username,
              email,
              password
            })
          }
        );

      const data =
        await response.json();

      if(!data.ok){

        message.innerHTML =
          '<div class="alert">' +
          escapeText(
            data.error || "خطا"
          ) +
          '</div>';

        return;
      }

      location.reload();
    }


    async function loadLoggedAccount(user){

      const area =
        document.getElementById(
          "account-area"
        );

      let orders = [];

      try{

        const response =
          await fetch("/api/orders");

        const data =
          await response.json();

        if(data.ok){
          orders = data.orders || [];
        }

      }catch(e){}


      const ordersHTML =
        orders.length
        ? `
          <div class="table-wrap">

            <table>

              <thead>

                <tr>
                  <th>شماره</th>
                  <th>مبلغ</th>
                  <th>وضعیت</th>
                  <th>تاریخ</th>
                </tr>

              </thead>

              <tbody>

                ${orders.map(order => `

                  <tr>

                    <td>
                      #${order.id}
                    </td>

                    <td>
                      ${Number(
                        order.total_price || 0
                      ).toLocaleString("fa-IR")}
                      تومان
                    </td>

                    <td>
                      <span class="badge">
                        ${statusText(
                          order.status
                        )}
                      </span>
                    </td>

                    <td>
                      ${new Date(
                        order.created_at
                      ).toLocaleDateString(
                        "fa-IR"
                      )}
                    </td>

                  </tr>

                `).join("")}

              </tbody>

            </table>

          </div>
        `
        : `
          <div class="empty">
            هنوز سفارشی ندارید.
          </div>
        `;


      area.innerHTML = `

        <div
          style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:15px;
            flex-wrap:wrap;
          "
        >

          <div>

            <span class="badge">
              حساب کاربری
            </span>

            <h2>
              ${escapeText(user.username)}
            </h2>

            <p>
              ${escapeText(user.email)}
            </p>

          </div>


          <button
            class="btn btn-danger"
            onclick="logout()"
          >
            خروج
          </button>

        </div>


        <hr
          style="
            border:0;
            border-top:
            1px solid #eee;
            margin:25px 0;
          "
        >


        <h3>
          سفارش‌های من
        </h3>

        ${ordersHTML}

      `;
    }


    async function logout(){

      await fetch(
        "/api/logout",
        {
          method:"POST"
        }
      );

      location.reload();
    }


    function statusText(status){

      const labels = {
        pending:"در انتظار پرداخت",
        paid:"پرداخت شده",
        processing:"در حال پردازش",
        completed:"تکمیل شده",
        cancelled:"لغو شده"
      };

      return labels[status] || status;
    }


    function escapeText(text){

      const div =
        document.createElement("div");

      div.textContent = text;

      return div.innerHTML;
    }


    loadAccount();

    </script>

    `
  );
}


/* =========================================================
   ADMIN PAGE
========================================================= */

function adminPage() {
  return basePage(
    "مدیریت فروشگاه",
    `

    <div
      id="admin-area"
      class="card"
    >
      در حال بررسی پنل مدیریت...
    </div>


    <script>

    async function loadAdmin(){

      const area =
        document.getElementById(
          "admin-area"
        );

      const response =
        await fetch("/api/admin/me");

      const data =
        await response.json();

      if(!data.loggedIn){

        showAdminLogin();

        return;
      }

      showDashboard();
    }


    function showAdminLogin(){

      document.getElementById(
        "admin-area"
      ).innerHTML = `

        <div class="form">

          <div
            style="
              text-align:center;
              margin-bottom:25px;
            "
          >

            <div
              class="logo"
              style="
                margin:auto;
              "
            >
              D
            </div>

            <h2>
              مدیریت ${STORE_NAME}
            </h2>

          </div>


          <div class="form-group">

            <label>
              نام کاربری
            </label>

            <input
              id="adminUsername"
              value="admin"
            >

          </div>


          <div class="form-group">

            <label>
              رمز عبور مدیریت
            </label>

            <input
              id="adminPassword"
              type="password"
            >

          </div>


          <button
            class="btn btn-primary"
            onclick="adminLogin()"
          >
            ورود به مدیریت
          </button>


          <div
            id="admin-message"
            style="margin-top:15px"
          ></div>

        </div>

      `;
    }


    async function adminLogin(){

      const message =
        document.getElementById(
          "admin-message"
        );

      const username =
        document.getElementById(
          "adminUsername"
        ).value.trim();

      const password =
        document.getElementById(
          "adminPassword"
        ).value;

      const response =
        await fetch(
          "/api/admin/login",
          {
            method:"POST",

            headers:{
              "Content-Type":
                "application/json"
            },

            body:JSON.stringify({
              username,
              password
            })
          }
        );

      const data =
        await response.json();

      if(!data.ok){

        message.innerHTML =
          '<div class="alert">' +
          escapeText(
            data.error || "خطا"
          ) +
          '</div>';

        return;
      }

      location.reload();
    }


    async function showDashboard(){

      const area =
        document.getElementById(
          "admin-area"
        );

      area.innerHTML = `

        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:15px;
            flex-wrap:wrap;
            margin-bottom:25px;
          "
        >

          <div>

            <span class="badge">
              ADMIN
            </span>

            <h2>
              مدیریت فروشگاه
            </h2>

          </div>


          <button
            class="btn btn-danger btn-small"
            onclick="adminLogout()"
          >
            خروج
          </button>

        </div>


        <div class="card">

          <h3>
            افزودن محصول
          </h3>

          <div class="form-group">

            <label>
              نام محصول
            </label>

            <input
              id="productName"
              placeholder="مثلاً بسته ابزارهای دیجیتال"
            >

          </div>


          <div class="form-group">

            <label>
              توضیحات
            </label>

            <textarea
              id="productDescription"
              placeholder="توضیحات محصول"
            ></textarea>

          </div>


          <div class="form-group">

            <label>
              قیمت
            </label>

            <input
              id="productPrice"
              inputmode="numeric"
              placeholder="99000"
            >

          </div>


          <button
            class="btn btn-success"
            onclick="addProduct()"
          >
            افزودن محصول
          </button>


          <div
            id="product-message"
            style="margin-top:15px"
          ></div>

        </div>


        <div class="card">

          <h3>
            محصولات
          </h3>

          <div id="products-admin">
            در حال بارگذاری...
          </div>

        </div>


        <div class="card">

          <h3>
            سفارش‌ها
          </h3>

          <div id="orders-admin">
            در حال بارگذاری...
          </div>

        </div>

      `;

      await loadAdminProducts();
      await loadAdminOrders();
    }


    async function addProduct(){

      const message =
        document.getElementById(
          "product-message"
        );

      const name =
        document.getElementById(
          "productName"
        ).value.trim();

      const description =
        document.getElementById(
          "productDescription"
        ).value.trim();

      const price =
        document.getElementById(
          "productPrice"
        ).value;

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
              price
            })
          }
        );

      const data =
        await response.json();

      if(!data.ok){

        message.innerHTML =
          '<div class="alert">' +
          escapeText(
            data.error || "خطا"
          ) +
          '</div>';

        return;
      }

      message.innerHTML =
        '<div class="alert">' +
        'محصول با موفقیت اضافه شد.' +
        '</div>';

      document.getElementById(
        "productName"
      ).value = "";

      document.getElementById(
        "productDescription"
      ).value = "";

      document.getElementById(
        "productPrice"
      ).value = "";

      await loadAdminProducts();
    }


    async function loadAdminProducts(){

      const box =
        document.getElementById(
          "products-admin"
        );

      const response =
        await fetch(
          "/api/admin/products"
        );

      const data =
        await response.json();

      if(!data.ok){

        box.innerHTML =
          '<div class="alert">' +
          escapeText(
            data.error || "خطا"
          ) +
          '</div>';

        return;
      }

      const products =
        data.products || [];

      if(!products.length){

        box.innerHTML =
          '<div class="empty">' +
          'محصولی وجود ندارد.' +
          '</div>';

        return;
      }

      box.innerHTML = `

        <div class="table-wrap">

          <table>

            <thead>

              <tr>
                <th>شناسه</th>
                <th>نام</th>
                <th>قیمت</th>
                <th>عملیات</th>
              </tr>

            </thead>

            <tbody>

              ${products.map(product => `

                <tr>

                  <td>
                    ${product.id}
                  </td>

                  <td>
                    ${escapeText(
                      product.name
                    )}
                  </td>

                  <td>
                    ${Number(
                      product.price || 0
                    ).toLocaleString("fa-IR")}
                    تومان
                  </td>

                  <td>

                    <button
                      class="btn btn-danger btn-small"
                      onclick="deleteProduct(${product.id})"
                    >
                      حذف
                    </button>

                  </td>

                </tr>

              `).join("")}

            </tbody>

          </table>

        </div>

      `;
    }


    async function deleteProduct(id){

      if(!confirm(
        "آیا از حذف این محصول مطمئن هستید؟"
      )){
        return;
      }

      const response =
        await fetch(
          "/api/admin/products/" + id,
          {
            method:"DELETE"
          }
        );

      const data =
        await response.json();

      if(!data.ok){

        alert(
          data.error || "خطا"
        );

        return;
      }

      await loadAdminProducts();
    }


    async function loadAdminOrders(){

      const box =
        document.getElementById(
          "orders-admin"
        );

      const response =
        await fetch(
          "/api/admin/orders"
        );

      const data =
        await response.json();

      if(!data.ok){

        box.innerHTML =
          '<div class="alert">' +
          escapeText(
            data.error || "خطا"
          ) +
          '</div>';

        return;
      }

      const orders =
        data.orders || [];

      if(!orders.length){

        box.innerHTML =
          '<div class="empty">' +
          'هنوز سفارشی ثبت نشده است.' +
          '</div>';

        return;
      }

      box.innerHTML = `

        <div class="table-wrap">

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
                  ایمیل
                </th>

                <th>
                  مبلغ
                </th>

                <th>
                  وضعیت
                </th>

                <th>
                  عملیات
                </th>

              </tr>

            </thead>

            <tbody>

              ${orders.map(order => `

                <tr>

                  <td>
                    #${order.id}
                  </td>

                  <td>
                    ${escapeText(
                      order.username || "-"
                    )}
                  </td>

                  <td>
                    ${escapeText(
                      order.email || "-"
                    )}
                  </td>

                  <td>
                    ${Number(
                      order.total_price || 0
                    ).toLocaleString("fa-IR")}
                    تومان
                  </td>

                  <td>
                    <span class="badge">
                      ${statusText(
                        order.status
                      )}
                    </span>
                  </td>

                  <td>

                    <select
                      onchange="
                        changeOrderStatus(
                          ${order.id},
                          this.value
                        )
                      "
                    >

                      <option
                        value="pending"
                        ${order.status === "pending"
                          ? "selected"
                          : ""}
                      >
                        در انتظار پرداخت
                      </option>

                      <option
                        value="paid"
                        ${order.status === "paid"
                          ? "selected"
                          : ""}
                      >
                        پرداخت شده
                      </option>

                      <option
                        value="processing"
                        ${order.status === "processing"
                          ? "selected"
                          : ""}
                      >
                        در حال پردازش
                      </option>

                      <option
                        value="completed"
                        ${order.status === "completed"
                          ? "selected"
                          : ""}
                      >
                        تکمیل شده
                      </option>

                      <option
                        value="cancelled"
                        ${order.status === "cancelled"
                          ? "selected"
                          : ""}
                      >
                        لغو شده
                      </option>

                    </select>

                  </td>

                </tr>

              `).join("")}

            </tbody>

          </table>

        </div>

      `;
    }


    async function changeOrderStatus(
      orderId,
      status
    ){

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
              orderId,
              status
            })
          }
        );

      const data =
        await response.json();

      if(!data.ok){

        alert(
          data.error || "خطا"
        );

        return;
      }

      await loadAdminOrders();
    }


    async function adminLogout(){

      await fetch(
        "/api/admin/logout",
        {
          method:"POST"
        }
      );

      location.reload();
    }


    function statusText(status){

      const labels = {
        pending:"در انتظار پرداخت",
        paid:"پرداخت شده",
        processing:"در حال پردازش",
        completed:"تکمیل شده",
        cancelled:"لغو شده"
      };

      return labels[status] || status;
    }


    function escapeText(text){

      const div =
        document.createElement("div");

      div.textContent = text;

      return div.innerHTML;
    }


    loadAdmin();

    </script>

    `
  );
}


/* =========================================================
   404
========================================================= */

function notFoundPage() {
  return basePage(
    "صفحه پیدا نشد",
    `

    <div
      class="card"
      style="
        text-align:center;
        padding:60px 20px;
      "
    >

      <div
        style="
          font-size:70px;
          margin-bottom:15px;
        "
      >
        404
      </div>

      <h2>
        صفحه پیدا نشد
      </h2>

      <p
        style="
          color:#777f91;
          line-height:2;
        "
      >
        صفحه‌ای که به دنبال آن هستید
        وجود ندارد.
      </p>

      <a
        href="/"
        class="btn btn-primary"
      >
        بازگشت به فروشگاه
      </a>

    </div>

    `
  );
}
