const STORE_NAME = "دیجی‌ماریکسو";
const STORE_EN = "DigiMarixo";

const DEFAULT_ADMIN_USERNAME = "admin";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // ساخت جدول‌های موردنیاز در اولین درخواست
      await initDB(env);

      // =========================
      // HOME
      // =========================
      if (path === "/" && method === "GET") {
        return html(homePage());
      }

      // =========================
      // HEALTH
      // =========================
      if (path === "/health" && method === "GET") {
        return json({
          ok: true,
          store: STORE_EN,
          database: !!env.DB,
          message: "DigiMarixo is online"
        });
      }

      // =========================
      // PRODUCTS API
      // =========================
      if (path === "/api/products" && method === "GET") {
        return json({
          ok: true,
          products: await getProducts(env)
        });
      }

      // =========================
      // REGISTER
      // =========================
      if (path === "/api/register" && method === "POST") {
        return await registerUser(request, env);
      }

      // =========================
      // LOGIN
      // =========================
      if (path === "/api/login" && method === "POST") {
        return await loginUser(request, env);
      }

      // =========================
      // LOGOUT
      // =========================
      if (path === "/api/logout" && method === "POST") {
        return await logoutUser(request, env);
      }

      // =========================
      // CURRENT USER
      // =========================
      if (path === "/api/me" && method === "GET") {
        return await currentUser(request, env);
      }

      // =========================
      // USER ORDERS
      // =========================
      if (path === "/api/orders" && method === "GET") {
        return await userOrders(request, env);
      }

      // =========================
      // ADMIN LOGIN
      // =========================
      if (path === "/api/admin/login" && method === "POST") {
        return await adminLogin(request, env);
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
      // ADMIN PAGE
      // =========================
      if (path === "/admin" && method === "GET") {
        return html(adminPage());
      }

      // =========================
      // ACCOUNT PAGE
      // =========================
      if (path === "/account" && method === "GET") {
        return html(accountPage());
      }

      // =========================
      // 404
      // =========================
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


// =====================================================
// DATABASE INITIALIZATION
// =====================================================

async function initDB(env) {
  if (!env.DB) {
    throw new Error("D1 database binding DB is not configured");
  }

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
    `)
  ]);
}


// =====================================================
// PRODUCTS
// =====================================================

async function getProducts(env) {
  const result = await env.DB
    .prepare(`
      SELECT
        id,
        name,
        description,
        price,
        image,
        created_at
      FROM products
      ORDER BY id DESC
    `)
    .all();

  return result.results || [];
}


// =====================================================
// AUTH HELPERS
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
      return decodeURIComponent(value.join("="));
    }
  }

  return null;
}


async function getCurrentUser(request, env) {
  const token = getCookie(request, "dm_session");

  if (!token) {
    return null;
  }

  const result = await env.DB
    .prepare(`
      SELECT
        users.id,
        users.username,
        users.email,
        users.created_at
      FROM sessions
      JOIN users
        ON users.id = sessions.user_id
      WHERE sessions.token = ?
        AND sessions.expires_at > datetime('now')
      LIMIT 1
    `)
    .bind(token)
    .first();

  return result || null;
}


// =====================================================
// REGISTER
// =====================================================

async function registerUser(request, env) {
  const body = await request.json();

  const username = String(body.username || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!username || !email || !password) {
    return json({
      ok: false,
      error: "لطفاً همه اطلاعات را وارد کنید."
    }, 400);
  }

  if (password.length < 6) {
    return json({
      ok: false,
      error: "رمز عبور باید حداقل ۶ کاراکتر باشد."
    }, 400);
  }

  const exists = await env.DB
    .prepare(`
      SELECT id
      FROM users
      WHERE username = ? OR email = ?
      LIMIT 1
    `)
    .bind(username, email)
    .first();

  if (exists) {
    return json({
      ok: false,
      error: "نام کاربری یا ایمیل قبلاً ثبت شده است."
    }, 409);
  }

  const passwordHash = await hashPassword(password);

  const result = await env.DB
    .prepare(`
      INSERT INTO users
      (username, email, password_hash)
      VALUES (?, ?, ?)
    `)
    .bind(
      username,
      email,
      passwordHash
    )
    .run();

  return json({
    ok: true,
    user_id: result.meta.last_row_id,
    message: "حساب کاربری با موفقیت ایجاد شد."
  });
}


// =====================================================
// LOGIN
// =====================================================

async function loginUser(request, env) {
  const body = await request.json();

  const login = String(body.login || "").trim();
  const password = String(body.password || "");

  if (!login || !password) {
    return json({
      ok: false,
      error: "نام کاربری/ایمیل و رمز عبور را وارد کنید."
    }, 400);
  }

  const passwordHash = await hashPassword(password);

  const user = await env.DB
    .prepare(`
      SELECT id, username, email
      FROM users
      WHERE
        (username = ? OR email = ?)
        AND password_hash = ?
      LIMIT 1
    `)
    .bind(
      login,
      login.toLowerCase(),
      passwordHash
    )
    .first();

  if (!user) {
    return json({
      ok: false,
      error: "اطلاعات ورود صحیح نیست."
    }, 401);
  }

  const token = randomToken();

  await env.DB
    .prepare(`
      INSERT INTO sessions
      (token, user_id, expires_at)
      VALUES (?, ?, datetime('now', '+30 days'))
    `)
    .bind(token, user.id)
    .run();

  return new Response(
    JSON.stringify({
      ok: true,
      message: "ورود موفق بود."
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "Set-Cookie":
          `dm_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
      }
    }
  );
}


// =====================================================
// LOGOUT
// =====================================================

async function logoutUser(request, env) {
  const token = getCookie(request, "dm_session");

  if (token) {
    await env.DB
      .prepare(`
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
        "content-type": "application/json; charset=UTF-8",
        "Set-Cookie":
          "dm_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
      }
    }
  );
}


// =====================================================
// CURRENT USER
// =====================================================

async function currentUser(request, env) {
  const user = await getCurrentUser(request, env);

  return json({
    ok: true,
    logged_in: !!user,
    user
  });
}


// =====================================================
// USER ORDERS
// =====================================================

async function userOrders(request, env) {
  const user = await getCurrentUser(request, env);

  if (!user) {
    return json({
      ok: false,
      error: "ابتدا وارد حساب کاربری شوید."
    }, 401);
  }

  const result = await env.DB
    .prepare(`
      SELECT
        orders.id,
        orders.status,
        orders.created_at,
        products.name,
        products.price
      FROM orders
      JOIN products
        ON products.id = orders.product_id
      WHERE orders.user_id = ?
      ORDER BY orders.id DESC
    `)
    .bind(user.id)
    .all();

  return json({
    ok: true,
    orders: result.results || []
  });
}


// =====================================================
// ADMIN AUTH
// =====================================================

async function adminLogin(request, env) {
  const body = await request.json();

  const username =
    String(body.username || "").trim();

  const password =
    String(body.password || "");

  const adminPassword =
    env.ADMIN_PASSWORD || "";

  if (!adminPassword) {
    return json({
      ok: false,
      error:
        "ADMIN_PASSWORD در Cloudflare تنظیم نشده است."
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

  return new Response(
    JSON.stringify({
      ok: true
    }),
    {
      status: 200,
      headers: {
        "content-type":
          "application/json; charset=UTF-8",

        "Set-Cookie":
          `dm_admin=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`
      }
    }
  );
}


function isAdmin(request, env) {
  const token = getCookie(
    request,
    "dm_admin"
  );

  return !!token && !!env.ADMIN_PASSWORD;
}


// =====================================================
// ADMIN PRODUCTS
// =====================================================

async function adminProducts(request, env) {
  if (!isAdmin(request, env)) {
    return json({
      ok: false,
      error: "دسترسی مدیریت لازم است."
    }, 401);
  }

  return json({
    ok: true,
    products: await getProducts(env)
  });
}


async function adminCreateProduct(request, env) {
  if (!isAdmin(request, env)) {
    return json({
      ok: false,
      error: "دسترسی مدیریت لازم است."
    }, 401);
  }

  const body = await request.json();

  const name =
    String(body.name || "").trim();

  const description =
    String(body.description || "").trim();

  const price =
    String(body.price || "").trim();

  const image =
    String(body.image || "🛍️").trim();

  if (!name) {
    return json({
      ok: false,
      error: "نام محصول الزامی است."
    }, 400);
  }

  const result = await env.DB
    .prepare(`
      INSERT INTO products
      (name, description, price, image)
      VALUES (?, ?, ?, ?)
    `)
    .bind(
      name,
      description,
      price,
      image
    )
    .run();

  return json({
    ok: true,
    id: result.meta.last_row_id,
    message: "محصول اضافه شد."
  });
}


async function adminDeleteProduct(request, env) {
  if (!isAdmin(request, env)) {
    return json({
      ok: false,
      error: "دسترسی مدیریت لازم است."
    }, 401);
  }

  const body = await request.json();

  const id =
    Number(body.id);

  if (!id) {
    return json({
      ok: false,
      error: "شناسه محصول نامعتبر است."
    }, 400);
  }

  await env.DB
    .prepare(`
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


// =====================================================
// HOME PAGE
// =====================================================

function homePage() {
  return `
<!DOCTYPE html>
<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<meta
  name="description"
  content="دیجی‌ماریکسو؛ فروشگاه آنلاین محصولات و خدمات دیجیتال"
>

<meta
  name="theme-color"
  content="#111827"
>

<title>دیجی‌ماریکسو | DigiMarixo</title>

<style>

*{
  box-sizing:border-box;
  margin:0;
  padding:0;
}

html{
  scroll-behavior:smooth;
}

body{
  font-family:
    Tahoma,
    Arial,
    sans-serif;

  background:
    linear-gradient(
      180deg,
      #f8fafc 0%,
      #eef2ff 100%
    );

  color:#111827;
  line-height:1.8;
  min-height:100vh;
}

a{
  color:inherit;
  text-decoration:none;
}

button,
input{
  font-family:inherit;
}

.container{
  width:min(1180px,92%);
  margin:0 auto;
}

header{
  position:sticky;
  top:0;
  z-index:100;

  background:
    rgba(255,255,255,.94);

  backdrop-filter:blur(12px);

  border-bottom:
    1px solid #e5e7eb;
}

.nav{
  min-height:72px;

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
  font-size:20px;
}

.brand-logo{
  width:44px;
  height:44px;

  border-radius:14px;

  display:flex;
  align-items:center;
  justify-content:center;

  background:
    linear-gradient(
      135deg,
      #111827,
      #4f46e5
    );

  color:white;
  font-weight:900;
}

.brand-text small{
  display:block;
  font-size:11px;
  color:#6b7280;
  direction:ltr;
  text-align:right;
}

.menu{
  display:flex;
  align-items:center;
  gap:20px;

  color:#374151;
  font-size:14px;
  font-weight:700;
}

.menu a:hover{
  color:#4f46e5;
}

.nav-button{
  padding:10px 15px;
  border-radius:12px;
  background:#111827;
  color:white;
}

.hero{
  padding:80px 0 70px;
}

.hero-grid{
  display:grid;
  grid-template-columns:
    minmax(0,1.15fr)
    minmax(300px,.85fr);

  gap:50px;
  align-items:center;
}

.hero-badge{
  display:inline-flex;
  padding:7px 13px;

  border-radius:999px;

  background:#eef2ff;
  color:#4338ca;

  font-size:13px;
  font-weight:800;

  margin-bottom:20px;
}

.hero h1{
  font-size:
    clamp(34px,6vw,62px);

  line-height:1.2;
  font-weight:950;

  margin-bottom:22px;
}

.hero h1 span{
  color:#4f46e5;
}

.hero p{
  color:#6b7280;
  font-size:18px;
  margin-bottom:30px;
}

.hero-buttons{
  display:flex;
  flex-wrap:wrap;
  gap:12px;
}

.btn{
  border:none;
  border-radius:14px;
  padding:13px 20px;

  cursor:pointer;

  font-size:14px;
  font-weight:800;
}

.btn-primary{
  background:#111827;
  color:white;
}

.btn-secondary{
  background:white;
  border:1px solid #e5e7eb;
}

.hero-card{
  min-height:360px;

  border-radius:28px;

  background:
    linear-gradient(
      145deg,
      #111827,
      #312e81
    );

  color:white;
  padding:30px;

  box-shadow:
    0 25px 60px
    rgba(17,24,39,.20);
}

.hero-card-icon{
  width:65px;
  height:65px;

  display:flex;
  align-items:center;
  justify-content:center;

  border-radius:20px;

  background:
    rgba(255,255,255,.12);

  font-size:30px;
  margin-bottom:25px;
}

.hero-card h2{
  font-size:27px;
  margin-bottom:12px;
}

.hero-card p{
  color:#dbeafe;
  font-size:15px;
}

.hero-card-list{
  display:grid;
  gap:12px;
  margin-top:20px;
}

.hero-card-item{
  display:flex;
  align-items:center;
  gap:10px;
}

.check{
  width:25px;
  height:25px;

  border-radius:50%;

  background:
    rgba(255,255,255,.12);

  display:flex;
  align-items:center;
  justify-content:center;
}

.section{
  padding:65px 0;
}

.section-header{
  text-align:center;
  max-width:720px;
  margin:0 auto 40px;
}

.section-header h2{
  font-size:
    clamp(26px,4vw,38px);

  margin-bottom:10px;
}

.section-header p{
  color:#6b7280;
}

.features{
  display:grid;
  grid-template-columns:
    repeat(3,minmax(0,1fr));

  gap:20px;
}

.feature{
  background:white;

  border:1px solid #e5e7eb;

  border-radius:20px;

  padding:25px;

  box-shadow:
    0 10px 30px
    rgba(15,23,42,.05);
}

.feature-icon{
  width:50px;
  height:50px;

  display:flex;
  align-items:center;
  justify-content:center;

  border-radius:15px;

  background:#eef2ff;

  font-size:23px;

  margin-bottom:18px;
}

.feature h3{
  margin-bottom:8px;
}

.feature p{
  color:#6b7280;
  font-size:14px;
}

.products-section{
  padding:70px 0 90px;
}

.products{
  display:grid;

  grid-template-columns:
    repeat(3,minmax(0,1fr));

  gap:20px;
}

.product{
  background:white;

  border:1px solid #e5e7eb;

  border-radius:20px;

  overflow:hidden;

  box-shadow:
    0 10px 30px
    rgba(15,23,42,.05);
}

.product-image{
  height:190px;

  background:
    linear-gradient(
      135deg,
      #eef2ff,
      #e0e7ff
    );

  display:flex;
  align-items:center;
  justify-content:center;

  font-size:45px;
}

.product-body{
  padding:22px;
}

.product-title{
  font-size:18px;
  font-weight:900;
  margin-bottom:8px;
}

.product-description{
  color:#6b7280;
  font-size:13px;

  min-height:48px;
  margin-bottom:18px;
}

.product-bottom{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}

.product-price{
  font-weight:900;
}

.product-button{
  border:none;
  border-radius:11px;

  padding:9px 13px;

  background:#111827;
  color:white;

  cursor:pointer;
}

.empty-products{
  grid-column:1/-1;

  text-align:center;

  padding:45px 20px;

  background:white;

  border:1px dashed #d1d5db;

  border-radius:20px;

  color:#6b7280;
}

.account-box{
  margin-top:20px;

  display:inline-flex;

  padding:12px 18px;

  border-radius:12px;

  background:#eef2ff;

  color:#3730a3;

  font-weight:800;
}

footer{
  background:#111827;
  color:white;

  padding:45px 0 25px;
}

.footer-grid{
  display:grid;

  grid-template-columns:
    1.2fr 1fr 1fr;

  gap:35px;

  margin-bottom:35px;
}

.footer p{
  color:#9ca3af;
  font-size:13px;
}

.footer-links{
  display:grid;
  gap:8px;
  font-size:13px;
  color:#d1d5db;
}

.footer-bottom{
  border-top:
    1px solid
    rgba(255,255,255,.1);

  padding-top:20px;

  text-align:center;

  color:#9ca3af;

  font-size:12px;
}

@media(max-width:900px){

  .hero-grid{
    grid-template-columns:1fr;
  }

  .features,
  .products{
    grid-template-columns:1fr 1fr;
  }

}

@media(max-width:650px){

  .menu{
    display:none;
  }

  .hero{
    padding-top:50px;
  }

  .features,
  .products{
    grid-template-columns:1fr;
  }

  .footer-grid{
    grid-template-columns:1fr;
  }

}

</style>

</head>

<body>

<header>

<div class="container nav">

<a href="/" class="brand">

<div class="brand-logo">D</div>

<div class="brand-text">
${STORE_NAME}
<small>${STORE_EN}</small>
</div>

</a>

<nav class="menu">

<a href="/">خانه</a>

<a href="#features">امکانات</a>

<a href="#products">محصولات</a>

<a href="#about">درباره ما</a>

<a href="/account">حساب کاربری</a>

<a
  href="#products"
  class="nav-button"
>
مشاهده فروشگاه
</a>

</nav>

</div>

</header>


<main>

<section class="hero">

<div class="container hero-grid">

<div>

<div class="hero-badge">
✦ فروشگاه دیجیتال
</div>

<h1>
دنیای دیجیتال
<span>در دیجی‌ماریکسو</span>
</h1>

<p>
دیجی‌ماریکسو یک فروشگاه آنلاین برای
محصولات، ابزارها و خدمات دیجیتال است.
ساده، سریع و قابل استفاده برای همه.
</p>

<div class="hero-buttons">

<a
href="#products"
class="btn btn-primary"
>
مشاهده محصولات
</a>

<a
href="/account"
class="btn btn-secondary"
>
حساب کاربری
</a>

</div>

</div>


<div class="hero-card">

<div class="hero-card-icon">
🛍️
</div>

<h2>DigiMarixo</h2>

<p>
تجربه‌ای ساده برای خرید
محصولات و خدمات دیجیتال.
</p>

<div class="hero-card-list">

<div class="hero-card-item">
<span class="check">✓</span>
دسترسی آنلاین
</div>

<div class="hero-card-item">
<span class="check">✓</span>
طراحی ساده و سریع
</div>

<div class="hero-card-item">
<span class="check">✓</span>
محصولات دیجیتال
</div>

</div>

</div>

</div>

</section>


<section
class="section"
id="features"
>

<div class="container">

<div class="section-header">

<h2>چرا دیجی‌ماریکسو؟</h2>

<p>
امکاناتی برای یک تجربه ساده،
سریع و مدرن در دنیای دیجیتال.
</p>

</div>

<div class="features">

<article class="feature">

<div class="feature-icon">⚡</div>

<h3>سریع و ساده</h3>

<p>
صفحات سبک و سریع برای دسترسی
راحت با موبایل و کامپیوتر.
</p>

</article>

<article class="feature">

<div class="feature-icon">🔒</div>

<h3>امنیت</h3>

<p>
زیرساخت فروشگاه روی سرویس‌های
ابری مدرن اجرا می‌شود.
</p>

</article>

<article class="feature">

<div class="feature-icon">🌐</div>

<h3>آنلاین و جهانی</h3>

<p>
آماده برای ارائه محصولات دیجیتال
به کاربران مختلف در سراسر جهان.
</p>

</article>

</div>

</div>

</section>


<section
class="products-section"
id="products"
>

<div class="container">

<div class="section-header">

<h2>محصولات فروشگاه</h2>

<p>
محصولات موجود از پایگاه داده فروشگاه
در این بخش نمایش داده می‌شوند.
</p>

</div>

<div
class="products"
id="products-list"
>

<div class="empty-products">
در حال دریافت محصولات...
</div>

</div>

</div>

</section>


<section
class="section"
id="about"
>

<div class="container">

<div class="section-header">

<h2>درباره دیجی‌ماریکسو</h2>

<p>
هدف دیجی‌ماریکسو ایجاد یک فروشگاه
مدرن برای محصولات و خدمات دیجیتال است.
</p>

</div>

</div>

</section>

</main>


<footer>

<div class="container">

<div class="footer-grid">

<div>

<h3>${STORE_NAME}</h3>

<p>
${STORE_EN} — فروشگاه آنلاین
محصولات و خدمات دیجیتال.
</p>

</div>

<div>

<h3>دسترسی سریع</h3>

<div class="footer-links">

<a href="/">خانه</a>

<a href="#features">امکانات</a>

<a href="#products">محصولات</a>

<a href="/account">حساب کاربری</a>

</div>

</div>

<div>

<h3>وضعیت</h3>

<div class="footer-links">

<a href="/health">
وضعیت سرویس
</a>

<a href="/admin">
مدیریت فروشگاه
</a>

</div>

</div>

</div>

<div class="footer-bottom">

© ${new Date().getFullYear()}
${STORE_NAME}
— تمامی حقوق محفوظ است.

</div>

</div>

</footer>


<script>

async function loadProducts(){

const container =
document.getElementById("products-list");

try{

const response =
await fetch("/api/products");

const data =
await response.json();

if(!data.ok){

throw new Error("API error");

}

const products =
Array.isArray(data.products)
? data.products
: [];

if(!products.length){

container.innerHTML = \`
<div class="empty-products">
هنوز محصولی برای نمایش ثبت نشده است.
</div>
\`;

return;

}

container.innerHTML =
products.map(function(product){

return \`

<article class="product">

<div class="product-image">
\${escapeHtml(
String(product.image || "🛍️")
)}
</div>

<div class="product-body">

<div class="product-title">
\${escapeHtml(
String(product.name || "محصول دیجیتال")
)}
</div>

<div class="product-description">
\${escapeHtml(
String(product.description || "")
)}
</div>

<div class="product-bottom">

<div class="product-price">
\${escapeHtml(
String(product.price || "")
)}
</div>

<button
class="product-button"
onclick="selectProduct(\${Number(product.id)})"
>
مشاهده
</button>

</div>

</div>

</article>

\`;

}).join("");

}catch(error){

container.innerHTML = \`
<div class="empty-products">
فعلاً امکان دریافت محصولات وجود ندارد.
</div>
\`;

}

}


function escapeHtml(value){

return value
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#039;");

}


function selectProduct(id){

alert(
"شناسه محصول: " + id
);

}


loadProducts();

</script>

</body>

</html>
`;
}


// =====================================================
// ACCOUNT PAGE
// =====================================================

function accountPage() {

return `
<!DOCTYPE html>

<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1"
>

<title>
حساب کاربری | دیجی‌ماریکسو
</title>

<style>

body{
margin:0;
font-family:Tahoma,Arial;
background:#f3f4f6;
color:#111827;
}

.container{
width:min(700px,92%);
margin:50px auto;
}

.box{
background:white;
padding:30px;
border-radius:20px;
box-shadow:0 15px 40px rgba(0,0,0,.08);
margin-bottom:20px;
}

h1,h2{
margin-top:0;
}

input{
width:100%;
padding:13px;
margin:7px 0;
border:1px solid #d1d5db;
border-radius:10px;
box-sizing:border-box;
}

button{
border:0;
padding:12px 18px;
border-radius:10px;
background:#111827;
color:white;
cursor:pointer;
margin-top:8px;
}

.secondary{
background:#4f46e5;
}

.danger{
background:#dc2626;
}

.message{
margin-top:12px;
padding:10px;
border-radius:10px;
background:#f3f4f6;
}

a{
color:#4f46e5;
text-decoration:none;
}

.hidden{
display:none;
}

</style>

</head>

<body>

<div class="container">

<div class="box">

<h1>حساب کاربری</h1>

<p>
مدیریت حساب و سفارش‌های دیجی‌ماریکسو
</p>

<div id="loggedOut">

<h2>ورود</h2>

<input
id="login"
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


<h2 style="margin-top:30px">
ثبت‌نام
</h2>

<input
id="regUsername"
placeholder="نام کاربری"
>

<input
id="regEmail"
type="email"
placeholder="ایمیل"
>

<input
id="regPassword"
type="password"
placeholder="رمز عبور"
>

<button
class="secondary"
onclick="register()"
>
ایجاد حساب
</button>

</div>


<div
id="loggedIn"
class="hidden"
>

<h2>
حساب من
</h2>

<div id="userInfo"></div>

<h2 style="margin-top:25px">
سفارش‌های من
</h2>

<div id="orders">
در حال دریافت...
</div>

<button
class="danger"
onclick="logout()"
>
خروج از حساب
</button>

</div>

<div
id="message"
class="message"
></div>

<p style="margin-top:20px">

<a href="/">
بازگشت به فروشگاه
</a>

</p>

</div>

</div>


<script>

async function api(url,options={}){

const response =
await fetch(url,{
headers:{
"content-type":"application/json"
},
...options
});

return await response.json();

}


async function checkUser(){

const data =
await api("/api/me");

if(data.logged_in){

document.getElementById(
"loggedOut"
).classList.add("hidden");

document.getElementById(
"loggedIn"
).classList.remove("hidden");

document.getElementById(
"userInfo"
).innerHTML =
\`
<strong>
\${escapeHtml(data.user.username)}
</strong>
<br>
\${escapeHtml(data.user.email)}
\`;

await loadOrders();

}else{

document.getElementById(
"loggedOut"
).classList.remove("hidden");

document.getElementById(
"loggedIn"
).classList.add("hidden");

}

}


async function register(){

const data =
await api(
"/api/register",
{
method:"POST",
body:JSON.stringify({
username:
document.getElementById(
"regUsername"
).value,

email:
document.getElementById(
"regEmail"
).value,

password:
document.getElementById(
"regPassword"
).value
})
}
);

show(data.message || data.error);

if(data.ok){

document.getElementById(
"regPassword"
).value = "";

}

}


async function login(){

const data =
await api(
"/api/login",
{
method:"POST",
body:JSON.stringify({
login:
document.getElementById(
"login"
).value,

password:
document.getElementById(
"loginPassword"
).value
})
}
);

show(data.message || data.error);

if(data.ok){

await checkUser();

}

}


async function logout(){

const data =
await api(
"/api/logout",
{
method:"POST"
}
);

show("از حساب خارج شدید.");

await checkUser();

}


async function loadOrders(){

const data =
await api("/api/orders");

const box =
document.getElementById("orders");

if(!data.ok){

box.innerHTML =
"خطا در دریافت سفارش‌ها.";

return;

}

if(!data.orders.length){

box.innerHTML =
"هنوز سفارشی ثبت نشده است.";

return;

}

box.innerHTML =
data.orders.map(order => \`
<div
style="
padding:12px;
border-bottom:1px solid #eee;
"
>
<strong>
\${escapeHtml(order.name)}
</strong>

<br>

قیمت:
\${escapeHtml(String(order.price || ""))}

<br>

وضعیت:
\${escapeHtml(order.status)}

</div>
\`).join("");

}


function show(message){

document.getElementById(
"message"
).textContent =
message || "";

}


function escapeHtml(value){

return String(value)
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#039;");

}


checkUser();

</script>

</body>

</html>
`;
}


// =====================================================
// ADMIN PAGE
// =====================================================

function adminPage(){

return `
<!DOCTYPE html>

<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1"
>

<title>
مدیریت دیجی‌ماریکسو
</title>

<style>

body{
margin:0;
font-family:Tahoma,Arial;
background:#f3f4f6;
color:#111827;
}

.container{
width:min(1000px,94%);
margin:35px auto;
}

.box{
background:white;
padding:25px;
border-radius:20px;
margin-bottom:20px;
box-shadow:0 10px 30px rgba(0,0,0,.06);
}

input,textarea{
width:100%;
box-sizing:border-box;
padding:12px;
margin:6px 0;
border:1px solid #d1d5db;
border-radius:10px;
font-family:inherit;
}

textarea{
min-height:100px;
}

button{
border:0;
padding:11px 16px;
border-radius:10px;
background:#111827;
color:white;
cursor:pointer;
}

.delete{
background:#dc2626;
}

.hidden{
display:none;
}

.product{
padding:15px 0;
border-bottom:1px solid #e5e7eb;
display:flex;
align-items:center;
justify-content:space-between;
gap:15px;
}

.login-box{
max-width:500px;
margin:70px auto;
}

.message{
margin-top:12px;
padding:10px;
background:#f3f4f6;
border-radius:10px;
}

a{
color:#4f46e5;
text-decoration:none;
}

</style>

</head>

<body>

<div class="container">

<div
id="loginBox"
class="box login-box"
>

<h1>
مدیریت دیجی‌ماریکسو
</h1>

<p>
ورود مدیر فروشگاه
</p>

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
ورود به پنل
</button>

<div id="loginMessage"
class="message"
></div>

</div>


<div
id="panel"
class="hidden"
>

<div class="box">

<h1>
پنل مدیریت فروشگاه
</h1>

<p>
افزودن و مدیریت محصولات
</p>

<a href="/">
بازگشت به فروشگاه
</a>

</div>


<div class="box">

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
placeholder="قیمت مثال: 250000 تومان"
>

<input
id="productImage"
placeholder="ایموجی یا آدرس تصویر"
value="🛍️"
>

<button onclick="addProduct()">
افزودن محصول
</button>

<div
id="productMessage"
class="message"
></div>

</div>


<div class="box">

<h2>
محصولات
</h2>

<div id="products">
در حال دریافت...
</div>

</div>

</div>

</div>


<script>

async function api(url,options={}){

const response =
await fetch(url,{
headers:{
"content-type":"application/json"
},
...options
});

return await response.json();

}


async function adminLogin(){

const data =
await api(
"/api/admin/login",
{
method:"POST",
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

document.getElementById(
"loginMessage"
).textContent =
data.error || "";

if(data.ok){

document.getElementById(
"loginBox"
).classList.add("hidden");

document.getElementById(
"panel"
).classList.remove("hidden");

loadProducts();

}

}


async function loadProducts(){

const data =
await api(
"/api/admin/products"
);

const box =
document.getElementById("products");

if(!data.ok){

box.innerHTML =
"دسترسی مدیریت ندارید.";

return;

}

if(!data.products.length){

box.innerHTML =
"هنوز محصولی ثبت نشده است.";

return;

}

box.innerHTML =
data.products.map(product => \`

<div class="product">

<div>

<strong>
\${escapeHtml(product.name)}
</strong>

<br>

<small>
\${escapeHtml(
String(product.price || "")
)}
</small>

</div>

<button
class="delete"
onclick="deleteProduct(\${Number(product.id)})"
>
حذف
</button>

</div>

\`).join("");

}


async function addProduct(){

const data =
await api(
"/api/admin/products",
{
method:"POST",
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
document.getElementById(
"productPrice"
).value,

image:
document.getElementById(
"productImage"
).value

})
}
);

document.getElementById(
"productMessage"
).textContent =
data.message || data.error;

if(data.ok){

document.getElementById(
"productName"
).value = "";

document.getElementById(
"productDescription"
).value = "";

document.getElementById(
"productPrice"
).value = "";

await loadProducts();

}

}


async function deleteProduct(id){

if(!confirm("این محصول حذف شود؟")){
return;
}

const data =
await api(
"/api/admin/products",
{
method:"DELETE",
body:JSON.stringify({id})
}
);

if(data.ok){

await loadProducts();

}

}


function escapeHtml(value){

return String(value)
.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#039;");

}

</script>

</body>

</html>
`;
}


// =====================================================
// 404
// =====================================================

function notFoundPage(){

return `
<!DOCTYPE html>

<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1"
>

<title>
404 | دیجی‌ماریکسو
</title>

<style>

body{
margin:0;
min-height:100vh;

display:flex;
align-items:center;
justify-content:center;

font-family:Tahoma,Arial;

background:#f8fafc;
color:#111827;
text-align:center;
}

.box{
background:white;
padding:40px;
border-radius:24px;
box-shadow:
0 20px 50px
rgba(0,0,0,.08);
}

h1{
font-size:70px;
margin:0;
}

a{
display:inline-block;
padding:12px 20px;
border-radius:12px;
background:#111827;
color:white;
text-decoration:none;
}

</style>

</head>

<body>

<div class="box">

<h1>404</h1>

<h2>
صفحه پیدا نشد
</h2>

<p>
صفحه موردنظر وجود ندارد.
</p>

<a href="/">
بازگشت به فروشگاه
</a>

</div>

</body>

</html>
`;
}


// =====================================================
// RESPONSE HELPERS
// =====================================================

function html(content,status=200){

return new Response(
content,
{
status,

headers:{
"content-type":
"text/html; charset=UTF-8",

"cache-control":
"no-cache"
}
}
);

}


function json(data,status=200){

return new Response(
JSON.stringify(data,null,2),
{
status,

headers:{
"content-type":
"application/json; charset=UTF-8",

"cache-control":
"no-cache"
}
}
);

           }
