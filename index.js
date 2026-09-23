const STORE_NAME = "دیجی‌ماریکسو";
const STORE_EN = "DigiMarixo";
const DEFAULT_ADMIN_USERNAME = "admin";

/* =========================================================
   HTML RESPONSE
========================================================= */

function html(body) {
  return new Response(
    `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0f172a">
<meta name="description" content="فروشگاه آنلاین دیجی‌ماریکسو">
<title>${STORE_NAME} | ${STORE_EN}</title>

<style>
:root{
  --navy:#0f172a;
  --navy2:#172554;
  --blue:#1e3a8a;
  --blue2:#2563eb;
  --teal:#0f766e;
  --cyan:#14b8a6;
  --orange:#f97316;
  --orange2:#fb923c;
  --bg:#f4f7fb;
  --card:#ffffff;
  --text:#172033;
  --muted:#64748b;
  --border:#e2e8f0;
  --shadow:0 10px 30px rgba(15,23,42,.08);
}

*{
  box-sizing:border-box;
}

html{
  scroll-behavior:smooth;
}

body{
  margin:0;
  background:var(--bg);
  color:var(--text);
  font-family:
    Tahoma,
    Arial,
    sans-serif;
  line-height:1.8;
}

a{
  color:inherit;
  text-decoration:none;
}

button,
input,
textarea,
select{
  font:inherit;
}

.container{
  width:min(1180px,92%);
  margin:auto;
}

/* =========================================================
   HEADER
========================================================= */

header{
  position:sticky;
  top:0;
  z-index:100;
  background:rgba(15,23,42,.97);
  color:#fff;
  box-shadow:0 4px 18px rgba(0,0,0,.14);
}

.nav{
  min-height:72px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:20px;
}

.logo{
  display:flex;
  align-items:center;
  gap:10px;
  font-size:20px;
  font-weight:900;
  white-space:nowrap;
}

.logo-mark{
  width:42px;
  height:42px;
  border-radius:13px;
  display:grid;
  place-items:center;
  background:linear-gradient(
    135deg,
    var(--orange),
    var(--cyan)
  );
  color:white;
  box-shadow:0 7px 20px rgba(20,184,166,.25);
}

.logo small{
  display:block;
  color:#94a3b8;
  font-size:10px;
  line-height:1.2;
}

nav{
  display:flex;
  align-items:center;
  gap:5px;
  flex-wrap:wrap;
}

nav a{
  padding:8px 12px;
  border-radius:10px;
  color:#e2e8f0;
  transition:.2s;
}

nav a:hover{
  background:rgba(255,255,255,.1);
  color:#fff;
}

.nav-btn{
  background:var(--orange)!important;
  color:#fff!important;
  font-weight:bold;
}

/* =========================================================
   HERO
========================================================= */

.hero{
  margin-top:26px;
  border-radius:28px;
  overflow:hidden;
  color:#fff;
  padding:65px 7%;
  position:relative;

  background:
    radial-gradient(
      circle at 85% 20%,
      rgba(20,184,166,.30),
      transparent 28%
    ),
    radial-gradient(
      circle at 15% 90%,
      rgba(249,115,22,.27),
      transparent 30%
    ),
    linear-gradient(
      135deg,
      var(--navy),
      var(--navy2) 55%,
      var(--teal)
    );
}

.hero-grid{
  display:grid;
  grid-template-columns:1.15fr .85fr;
  gap:40px;
  align-items:center;
}

.hero h1{
  margin:0 0 16px;
  font-size:clamp(32px,5vw,58px);
  line-height:1.25;
}

.hero p{
  color:#dbeafe;
  font-size:18px;
  max-width:680px;
}

.hero-actions{
  display:flex;
  gap:12px;
  flex-wrap:wrap;
  margin-top:25px;
}

.hero-card{
  background:rgba(255,255,255,.1);
  border:1px solid rgba(255,255,255,.18);
  backdrop-filter:blur(12px);
  border-radius:25px;
  padding:25px;
}

.hero-card .big{
  font-size:70px;
  text-align:center;
  margin-bottom:5px;
}

/* =========================================================
   BUTTONS
========================================================= */

.btn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border:0;
  cursor:pointer;
  border-radius:13px;
  padding:12px 20px;
  font-weight:bold;
  transition:.2s;
}

.btn:hover{
  transform:translateY(-2px);
}

.btn-primary{
  background:var(--orange);
  color:#fff;
}

.btn-secondary{
  background:#fff;
  color:var(--navy);
}

/* =========================================================
   SECTIONS
========================================================= */

section{
  padding:55px 0 10px;
}

.section-title{
  display:flex;
  align-items:end;
  justify-content:space-between;
  gap:15px;
  margin-bottom:22px;
}

.section-title h2{
  margin:0;
  font-size:28px;
}

.section-title p{
  margin:0;
  color:var(--muted);
}

/* =========================================================
   CATEGORIES
========================================================= */

.categories{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:15px;
}

.category{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:18px;
  padding:22px;
  text-align:center;
  box-shadow:var(--shadow);
  transition:.2s;
}

.category:hover{
  transform:translateY(-4px);
  border-color:#bfdbfe;
}

.category-icon{
  width:55px;
  height:55px;
  border-radius:16px;
  display:grid;
  place-items:center;
  margin:auto auto 10px;
  background:#eff6ff;
  color:var(--blue2);
  font-size:25px;
}

/* =========================================================
   PRODUCTS
========================================================= */

.products{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:18px;
}

.product{
  background:var(--card);
  border:1px solid var(--border);
  border-radius:20px;
  overflow:hidden;
  box-shadow:var(--shadow);
  transition:.2s;
}

.product:hover{
  transform:translateY(-4px);
  box-shadow:
    0 15px 35px rgba(15,23,42,.12);
}

.product-img{
  height:190px;
  display:grid;
  place-items:center;
  background:
    linear-gradient(
      135deg,
      #e0f2fe,
      #ecfeff
    );
  font-size:60px;
  overflow:hidden;
}

.product-img img{
  width:100%;
  height:100%;
  object-fit:contain;
}

.product-body{
  padding:18px;
}

.product h3{
  margin:0 0 7px;
}

.product p{
  color:var(--muted);
  font-size:14px;
  min-height:50px;
}

.price{
  font-size:19px;
  font-weight:900;
  color:var(--blue);
}

/* =========================================================
   FEATURES
========================================================= */

.features{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:18px;
}

.feature{
  background:#fff;
  border:1px solid var(--border);
  border-radius:20px;
  padding:25px;
  box-shadow:var(--shadow);
}

.feature-icon{
  font-size:30px;
  margin-bottom:8px;
}

/* =========================================================
   PROMO
========================================================= */

.promo{
  margin-top:45px;
  border-radius:24px;
  padding:32px;
  color:#fff;

  background:
    linear-gradient(
      110deg,
      var(--teal),
      var(--blue2)
    );

  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:20px;
}

.promo h2{
  margin:0 0 5px;
}

/* =========================================================
   PAGE / PANEL
========================================================= */

.page{
  padding:40px 0;
}

.panel{
  background:#fff;
  border:1px solid var(--border);
  border-radius:22px;
  padding:28px;
  box-shadow:var(--shadow);
}

.form{
  max-width:650px;
}

.form-group{
  margin-bottom:15px;
}

.form label{
  display:block;
  margin-bottom:6px;
  font-weight:bold;
}

.form input,
.form textarea,
.form select{
  width:100%;
  border:1px solid var(--border);
  border-radius:12px;
  padding:12px 14px;
  outline:none;
  background:#fff;
}

.form input:focus,
.form textarea:focus,
.form select:focus{
  border-color:var(--blue2);
  box-shadow:
    0 0 0 3px rgba(37,99,235,.1);
}

.message{
  padding:12px 15px;
  border-radius:12px;
  margin-bottom:15px;
  background:#eff6ff;
  color:#1e40af;
}

.empty{
  text-align:center;
  color:var(--muted);
  padding:30px;
  background:#fff;
  border:1px dashed var(--border);
  border-radius:18px;
}

/* =========================================================
   FOOTER
========================================================= */

footer{
  margin-top:60px;
  background:var(--navy);
  color:#cbd5e1;
  padding:45px 0 25px;
}

.footer-grid{
  display:grid;
  grid-template-columns:2fr 1fr 1fr;
  gap:35px;
}

footer h3,
footer h4{
  color:#fff;
  margin-top:0;
}

footer a{
  display:block;
  margin:6px 0;
}

.copyright{
  border-top:1px solid rgba(255,255,255,.1);
  margin-top:30px;
  padding-top:18px;
  text-align:center;
  font-size:13px;
}

/* =========================================================
   RESPONSIVE
========================================================= */

@media(max-width:900px){

  .hero-grid{
    grid-template-columns:1fr;
  }

  .products{
    grid-template-columns:repeat(2,1fr);
  }

  .categories{
    grid-template-columns:repeat(2,1fr);
  }

  .features{
    grid-template-columns:1fr;
  }

  .footer-grid{
    grid-template-columns:1fr 1fr;
  }
}

@media(max-width:600px){

  .nav{
    min-height:auto;
    padding:12px 0;
    align-items:flex-start;
    flex-direction:column;
  }

  nav{
    width:100%;
    overflow-x:auto;
    flex-wrap:nowrap;
  }

  nav a{
    white-space:nowrap;
  }

  .hero{
    padding:40px 24px;
  }

  .hero h1{
    font-size:34px;
  }

  .products{
    grid-template-columns:1fr;
  }

  .categories{
    grid-template-columns:1fr 1fr;
  }

  .promo{
    flex-direction:column;
    align-items:flex-start;
  }

  .footer-grid{
    grid-template-columns:1fr;
  }
}
</style>
</head>

<body>

${body}

</body>
</html>`,
    {
      headers:{
        "content-type":"text/html;charset=UTF-8",
        "cache-control":"no-store"
      }
    }
  );
}

/* =========================================================
   LAYOUT
========================================================= */

function layout(content){

  return `
<header>

  <div class="container nav">

    <a class="logo" href="/">

      <span class="logo-mark">
        DM
      </span>

      <span>
        ${STORE_NAME}
        <small>${STORE_EN}</small>
      </span>

    </a>

    <nav>

      <a href="/">خانه</a>

      <a href="/#categories">
        دسته‌بندی‌ها
      </a>

      <a href="/#products">
        محصولات
      </a>

      <a href="/#features">
        امکانات
      </a>

      <a href="/account">
        حساب کاربری
      </a>

      <a class="nav-btn" href="/admin">
        مدیریت
      </a>

    </nav>

  </div>

</header>

${content}

<footer>

  <div class="container">

    <div class="footer-grid">

      <div>

        <h3>${STORE_NAME}</h3>

        <p>
          فروشگاه آنلاین ${STORE_EN}
          برای خرید آسان و مطمئن
          محصولات دیجیتال و کاربردی.
        </p>

      </div>

      <div>

        <h4>دسترسی سریع</h4>

        <a href="/">
          خانه
        </a>

        <a href="/#products">
          محصولات
        </a>

        <a href="/account">
          حساب کاربری
        </a>

      </div>

      <div>

        <h4>اطلاعات</h4>

        <a href="/about">
          درباره ما
        </a>

        <a href="/contact">
          تماس با ما
        </a>

        <a href="/terms">
          قوانین و مقررات
        </a>

      </div>

    </div>

    <div class="copyright">

      © ${new Date().getFullYear()}
      ${STORE_NAME}
      —
      ${STORE_EN}

    </div>

  </div>

</footer>`;
}

/* =========================================================
   HOME PAGE
========================================================= */

function homePage(products=[]){

  const productHtml = products.length

    ? products.map(p => `

      <article class="product">

        <div class="product-img">

          ${
            p.image
              ? `<img
                  src="${escapeHtml(p.image)}"
                  alt="${escapeHtml(p.name)}"
                >`
              : "🛍️"
          }

        </div>

        <div class="product-body">

          <h3>
            ${escapeHtml(p.name || "محصول")}
          </h3>

          <p>
            ${escapeHtml(
              p.description ||
              "محصول با کیفیت در دیجی‌ماریکسو"
            )}
          </p>

          <div class="price">
            ${formatPrice(p.price)}
          </div>

          <div style="margin-top:12px">

            <a
              class="btn btn-primary"
              href="/product/${p.id}"
            >
              مشاهده محصول
            </a>

          </div>

        </div>

      </article>

    `).join("")

    : `
      <div
        class="empty"
        style="grid-column:1/-1"
      >
        هنوز محصولی ثبت نشده است.
      </div>
    `;

  return layout(`

<main class="container">

  <!-- HERO -->

  <section class="hero">

    <div class="hero-grid">

      <div>

        <div
          style="
            color:#5eead4;
            font-weight:bold;
            margin-bottom:8px
          "
        >
          ${STORE_EN}
        </div>

        <h1>
          خرید ساده، سریع و مطمئن
        </h1>

        <p>
          به فروشگاه ${STORE_NAME}
          خوش آمدید.
          محصولات را مشاهده کنید
          و تجربه‌ای ساده و حرفه‌ای
          از خرید آنلاین داشته باشید.
        </p>

        <div class="hero-actions">

          <a
            class="btn btn-primary"
            href="#products"
          >
            مشاهده محصولات
          </a>

          <a
            class="btn btn-secondary"
            href="/account"
          >
            حساب کاربری
          </a>

        </div>

      </div>

      <div class="hero-card">

        <div class="big">
          🛒
        </div>

        <h2 style="text-align:center;margin:0">
          فروشگاه ${STORE_EN}
        </h2>

        <p
          style="
            text-align:center;
            color:#cbd5e1
          "
        >
          انتخاب، بررسی و خرید
          در یک محیط ساده
        </p>

      </div>

    </div>

  </section>

  <!-- CATEGORIES -->

  <section id="categories">

    <div class="section-title">

      <div>

        <h2>
          دسته‌بندی‌ها
        </h2>

        <p>
          محصولات مورد نیازتان را
          سریع‌تر پیدا کنید.
        </p>

      </div>

    </div>

    <div class="categories">

      <a
        class="category"
        href="#products"
      >
        <div class="category-icon">
          💻
        </div>
        <b>دیجیتال</b>
      </a>

      <a
        class="category"
        href="#products"
      >
        <div class="category-icon">
          📱
        </div>
        <b>موبایل و لوازم</b>
      </a>

      <a
        class="category"
        href="#products"
      >
        <div class="category-icon">
          🎧
        </div>
        <b>لوازم جانبی</b>
      </a>

      <a
        class="category"
        href="#products"
      >
        <div class="category-icon">
          ⭐
        </div>
        <b>محصولات ویژه</b>
      </a>

    </div>

  </section>

  <!-- PRODUCTS -->

  <section id="products">

    <div class="section-title">

      <div>

        <h2>
          محصولات
        </h2>

        <p>
          جدیدترین محصولات فروشگاه
        </p>

      </div>

    </div>

    <div class="products">

      ${productHtml}

    </div>

  </section>

  <!-- FEATURES -->

  <section id="features">

    <div class="section-title">

      <div>

        <h2>
          چرا ${STORE_NAME}؟
        </h2>

        <p>
          ویژگی‌های اصلی فروشگاه
        </p>

      </div>

    </div>

    <div class="features">

      <div class="feature">

        <div class="feature-icon">
          🚀
        </div>

        <h3>
          سریع و ساده
        </h3>

        <p>
          محیط فروشگاه برای دسترسی
          سریع به محصولات طراحی شده است.
        </p>

      </div>

      <div class="feature">

        <div class="feature-icon">
          🔒
        </div>

        <h3>
          امن و مطمئن
        </h3>

        <p>
          اطلاعات فروشگاه و سفارش‌ها
          در پایگاه داده اختصاصی نگهداری می‌شوند.
        </p>

      </div>

      <div class="feature">

        <div class="feature-icon">
          💬
        </div>

        <h3>
          پشتیبانی
        </h3>

        <p>
          برای ارتباط و پیگیری سفارش
          می‌توانید از بخش تماس با ما استفاده کنید.
        </p>

      </div>

    </div>

  </section>

  <!-- PROMO -->

  <div class="promo">

    <div>

      <h2>
        خرید خود را شروع کنید
      </h2>

      <div>
        محصولات ${STORE_NAME}
        را بررسی کنید.
      </div>

    </div>

    <a
      class="btn btn-secondary"
      href="#products"
    >
      مشاهده محصولات
    </a>

  </div>

</main>
`);
}

/* =========================================================
   ACCOUNT PAGE
========================================================= */

function accountPage(){

  return layout(`

<main class="container page">

  <div class="panel form">

    <h1>
      حساب کاربری
    </h1>

    <p style="color:var(--muted)">
      مدیریت حساب و سفارش‌های
      ${STORE_NAME}
    </p>

    <h2>
      ورود
    </h2>

    <form
      method="POST"
      action="/account/login"
    >

      <div class="form-group">

        <label>
          نام کاربری یا ایمیل
        </label>

        <input
          name="identifier"
          required
        >

      </div>

      <div class="form-group">

        <label>
          رمز عبور
        </label>

        <input
          type="password"
          name="password"
          required
        >

      </div>

      <button
        class="btn btn-primary"
        type="submit"
      >
        ورود
      </button>

    </form>

    <hr
      style="
        margin:30px 0;
        border:0;
        border-top:1px solid var(--border)
      "
    >

    <h2>
      ثبت‌نام
    </h2>

    <form
      method="POST"
      action="/account/register"
    >

      <div class="form-group">

        <label>
          نام کاربری
        </label>

        <input
          name="username"
          required
        >

      </div>

      <div class="form-group">

        <label>
          ایمیل
        </label>

        <input
          type="email"
          name="email"
          required
        >

      </div>

      <div class="form-group">

        <label>
          رمز عبور
        </label>

        <input
          type="password"
          name="password"
          required
        >

      </div>

      <button
        class="btn btn-primary"
        type="submit"
      >
        ایجاد حساب
      </button>

    </form>

    <div style="margin-top:20px">

      <a href="/">
        بازگشت به فروشگاه
      </a>

    </div>

  </div>

</main>
`);
}

/* =========================================================
   ADMIN PAGE
========================================================= */

function adminPage(products=[]){

  return layout(`

<main class="container page">

  <div class="panel">

    <h1>
      مدیریت ${STORE_NAME}
    </h1>

    <p style="color:var(--muted)">
      مدیریت محصولات فروشگاه
    </p>

    <form
      class="form"
      method="POST"
      action="/admin/product"
    >

      <div class="form-group">

        <label>
          نام محصول
        </label>

        <input
          name="name"
          required
        >

      </div>

      <div class="form-group">

        <label>
          توضیحات
        </label>

        <textarea
          name="description"
          rows="4"
        ></textarea>

      </div>

      <div class="form-group">

        <label>
          قیمت
        </label>

        <input
          name="price"
          type="number"
          min="0"
          required
        >

      </div>

      <div class="form-group">

        <label>
          لینک تصویر
        </label>

        <input
          name="image"
          type="url"
        >

      </div>

      <div class="form-group">

        <label>
          دسته‌بندی
        </label>

        <input
          name="category"
        >

      </div>

      <div class="form-group">

        <label>
          موجودی
        </label>

        <input
          name="stock"
          type="number"
          min="0"
          value="0"
        >

      </div>

      <button
        class="btn btn-primary"
        type="submit"
      >
        افزودن محصول
      </button>

    </form>

    <hr
      style="
        margin:35px 0;
        border:0;
        border-top:1px solid var(--border)
      "
    >

    <h2>
      محصولات ثبت‌شده
    </h2>

    ${
      products.length
        ? `
          <div class="products">

            ${products.map(p => `

              <div class="product">

                <div class="product-img">

                  ${
                    p.image
                      ? `
                        <img
                          src="${escapeHtml(p.image)}"
                          alt="${escapeHtml(p.name)}"
                        >
                      `
                      : "🛍️"
                  }

                </div>

                <div class="product-body">

                  <h3>
                    ${escapeHtml(p.name)}
                  </h3>

                  <p>
                    ${escapeHtml(
                      p.description || ""
                    )}
                  </p>

                  <div class="price">
                    ${formatPrice(p.price)}
                  </div>

                  <div
                    style="
                      margin-top:8px;
                      color:var(--muted);
                      font-size:13px
                    "
                  >
                    دسته‌بندی:
                    ${escapeHtml(
                      p.category || "عمومی"
                    )}
                  </div>

                  <div
                    style="
                      color:var(--muted);
                      font-size:13px
                    "
                  >
                    موجودی:
                    ${Number(p.stock || 0)}
                  </div>

                </div>

              </div>

            `).join("")}

          </div>
        `
        : `
          <div class="empty">
            هنوز محصولی ثبت نشده است.
          </div>
        `
    }

  </div>

</main>
`);
}

/* =========================================================
   DATABASE INITIALIZATION
   IMPORTANT:
   Automatically adds missing columns.
========================================================= */

async function initDB(env){

  if(!env.DB){
    return;
  }

  /* =======================================================
     PRODUCTS
  ======================================================= */

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS products (

      id INTEGER PRIMARY KEY AUTOINCREMENT,

      name TEXT NOT NULL,

      description TEXT DEFAULT '',

      price INTEGER DEFAULT 0,

      image TEXT DEFAULT '',

      created_at TEXT DEFAULT CURRENT_TIMESTAMP

    )
  `).run();

  /* -------------------------------------------------------
     Read existing products columns
  ------------------------------------------------------- */

  const productColumnsResult =
    await env.DB.prepare(`
      PRAGMA table_info(products)
    `).all();

  const productColumns =
    new Set(
      (productColumnsResult.results || [])
        .map(column => column.name)
    );

  /* -------------------------------------------------------
     Add category automatically if missing
  ------------------------------------------------------- */

  if(!productColumns.has("category")){

    await env.DB.prepare(`
      ALTER TABLE products
      ADD COLUMN category TEXT DEFAULT ''
    `).run();

  }

  /* -------------------------------------------------------
     Add stock automatically if missing
  ------------------------------------------------------- */

  if(!productColumns.has("stock")){

    await env.DB.prepare(`
      ALTER TABLE products
      ADD COLUMN stock INTEGER DEFAULT 0
    `).run();

  }

  /* =======================================================
     USERS
  ======================================================= */

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS users (

      id INTEGER PRIMARY KEY AUTOINCREMENT,

      username TEXT UNIQUE NOT NULL,

      email TEXT UNIQUE NOT NULL,

      password TEXT NOT NULL,

      created_at TEXT DEFAULT CURRENT_TIMESTAMP

    )
  `).run();

  /* =======================================================
     ORDERS
  ======================================================= */

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS orders (

      id INTEGER PRIMARY KEY AUTOINCREMENT,

      user_id INTEGER,

      total INTEGER DEFAULT 0,

      status TEXT DEFAULT 'pending',

      created_at TEXT DEFAULT CURRENT_TIMESTAMP

    )
  `).run();

  /* =======================================================
     ORDER ITEMS
  ======================================================= */

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS order_items (

      id INTEGER PRIMARY KEY AUTOINCREMENT,

      order_id INTEGER,

      product_id INTEGER,

      quantity INTEGER DEFAULT 1,

      price INTEGER DEFAULT 0

    )
  `).run();

  /* =======================================================
     REVIEWS
  ======================================================= */

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS reviews (

      id INTEGER PRIMARY KEY AUTOINCREMENT,

      product_id INTEGER,

      user_id INTEGER,

      rating INTEGER DEFAULT 5,

      comment TEXT DEFAULT '',

      created_at TEXT DEFAULT CURRENT_TIMESTAMP

    )
  `).run();
}

/* =========================================================
   GET PRODUCTS
========================================================= */

async function getProducts(env){

  if(!env.DB){
    return [];
  }

  const result =
    await env.DB.prepare(`
      SELECT
        id,
        name,
        description,
        price,
        image,
        category,
        stock,
        created_at

      FROM products

      ORDER BY id DESC
    `).all();

  return result.results || [];
}

/* =========================================================
   GET PRODUCT
========================================================= */

async function getProduct(env,id){

  if(!env.DB){
    return null;
  }

  const product =
    await env.DB.prepare(`
      SELECT
        id,
        name,
        description,
        price,
        image,
        category,
        stock,
        created_at

      FROM products

      WHERE id=?

      LIMIT 1
    `)
    .bind(id)
    .first();

  return product || null;
}

/* =========================================================
   FORMAT PRICE
========================================================= */

function formatPrice(value){

  const number =
    Number(value || 0);

  return (
    number.toLocaleString("fa-IR")
    + " تومان"
  );
}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value){

  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* =========================================================
   READ FORM
========================================================= */

async function readForm(request){

  const form =
    await request.formData();

  const data = {};

  for(
    const [key,value]
    of form.entries()
  ){

    data[key] =
      String(value);

  }

  return data;
}

/* =========================================================
   MAIN WORKER
========================================================= */

export default {

  async fetch(request,env){

    const url =
      new URL(request.url);

    const path =
      url.pathname;

    const method =
      request.method;

    try{

      /* -----------------------------------------------
         Initialize database
      ----------------------------------------------- */

      await initDB(env);

      /* -----------------------------------------------
         HEALTH
      ----------------------------------------------- */

      if(
        path === "/health"
        &&
        method === "GET"
      ){

        return Response.json({

          ok:true,

          store:STORE_EN,

          database:!!env.DB

        });

      }

      /* -----------------------------------------------
         API PRODUCTS
      ----------------------------------------------- */

      if(
        path === "/api/products"
        &&
        method === "GET"
      ){

        const products =
          await getProducts(env);

        return Response.json({

          ok:true,

          products

        });

      }

      /* -----------------------------------------------
         HOME
      ----------------------------------------------- */

      if(
        path === "/"
        &&
        method === "GET"
      ){

        const products =
          await getProducts(env);

        return html(
          homePage(products)
        );

      }

      /* -----------------------------------------------
         ACCOUNT
      ----------------------------------------------- */

      if(
        path === "/account"
        &&
        method === "GET"
      ){

        return html(
          accountPage()
        );

      }

      /* -----------------------------------------------
         REGISTER
      ----------------------------------------------- */

      if(
        path === "/account/register"
        &&
        method === "POST"
      ){

        if(!env.DB){

          return new Response(
            "Database not connected",
            {status:500}
          );

        }

        const data =
          await readForm(request);

        const username =
          data.username?.trim();

        const email =
          data.email?.trim();

        const password =
          data.password;

        if(
          !username ||
          !email ||
          !password
        ){

          return html(
            layout(`
              <main class="container page">

                <div class="panel">

                  <div class="message">
                    همه فیلدها را کامل کنید.
                  </div>

                  <a href="/account">
                    بازگشت
                  </a>

                </div>

              </main>
            `)
          );

        }

        try{

          await env.DB.prepare(`
            INSERT INTO users
            (
              username,
              email,
              password
            )
            VALUES
            (
              ?,
              ?,
              ?
            )
          `)
          .bind(
            username,
            email,
            password
          )
          .run();

          return html(
            layout(`
              <main class="container page">

                <div class="panel">

                  <h1>
                    ثبت‌نام موفق بود
                  </h1>

                  <p>
                    حساب شما با موفقیت ایجاد شد.
                  </p>

                  <a
                    class="btn btn-primary"
                    href="/account"
                  >
                    ورود به حساب
                  </a>

                </div>

              </main>
            `)
          );

        }catch(error){

          return html(
            layout(`
              <main class="container page">

                <div class="panel">

                  <div class="message">
                    نام کاربری یا ایمیل
                    قبلاً استفاده شده است.
                  </div>

                  <a href="/account">
                    بازگشت
                  </a>

                </div>

              </main>
            `)
          );

        }

      }

      /* -----------------------------------------------
         LOGIN
      ----------------------------------------------- */

      if(
        path === "/account/login"
        &&
        method === "POST"
      ){

        if(!env.DB){

          return new Response(
            "Database not connected",
            {status:500}
          );

        }

        const data =
          await readForm(request);

        const identifier =
          data.identifier?.trim();

        const user =
          await env.DB.prepare(`
            SELECT
              id,
              username,
              email

            FROM users

            WHERE
              (
                username=?
                OR
                email=?
              )
              AND
              password=?

            LIMIT 1
          `)
          .bind(
            identifier,
            identifier,
            data.password
          )
          .first();

        if(!user){

          return html(
            layout(`
              <main class="container page">

                <div class="panel">

                  <div class="message">
                    نام کاربری یا رمز عبور اشتباه است.
                  </div>

                  <a href="/account">
                    بازگشت
                  </a>

                </div>

              </main>
            `)
          );

        }

        return html(
          layout(`
            <main class="container page">

              <div class="panel">

                <h1>
                  خوش آمدید
                  ${escapeHtml(user.username)}
                </h1>

                <p>
                  ورود شما با موفقیت انجام شد.
                </p>

                <a
                  class="btn btn-primary"
                  href="/"
                >
                  بازگشت به فروشگاه
                </a>

              </div>

            </main>
          `)
        );

      }

      /* -----------------------------------------------
         ADMIN
      ----------------------------------------------- */

      if(
        path === "/admin"
        &&
        method === "GET"
      ){

        const products =
          await getProducts(env);

        return html(
          adminPage(products)
        );

      }

      /* -----------------------------------------------
         ADD PRODUCT
      ----------------------------------------------- */

      if(
        path === "/admin/product"
        &&
        method === "POST"
      ){

        if(!env.DB){

          return new Response(
            "Database not connected",
            {status:500}
          );

        }

        const data =
          await readForm(request);

        if(!data.name?.trim()){

          return new Response(
            "Product name is required",
            {status:400}
          );

        }

        await env.DB.prepare(`
          INSERT INTO products
          (
            name,
            description,
            price,
            image,
            category,
            stock
          )
          VALUES
          (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
          )
        `)
        .bind(
          data.name.trim(),

          data.description?.trim() || "",

          Number(data.price || 0),

          data.image?.trim() || "",

          data.category?.trim() || "",

          Number(data.stock || 0)
        )
        .run();

        return Response.redirect(
          new URL(
            "/admin",
            request.url
          ).toString(),
          303
        );

      }

      /* -----------------------------------------------
         PRODUCT DETAIL
      ----------------------------------------------- */

      if(
        path.startsWith("/product/")
        &&
        method === "GET"
      ){

        const id =
          Number(
            path.split("/").pop()
          );

        if(
          !Number.isInteger(id)
          ||
          id <= 0
        ){

          return new Response(
            "Product not found",
            {status:404}
          );

        }

        const product =
          await getProduct(
            env,
            id
          );

        if(!product){

          return html(
            layout(`
              <main class="container page">

                <div class="panel">

                  <h1>
                    محصول پیدا نشد
                  </h1>

                  <a
                    class="btn btn-primary"
                    href="/"
                  >
                    بازگشت به فروشگاه
                  </a>

                </div>

              </main>
            `)
          );

        }

        return html(
          layout(`

            <main class="container page">

              <div class="panel">

                <div class="hero-grid">

                  <div>

                    <div
                      style="
                        min-height:300px;
                        display:grid;
                        place-items:center;
                        font-size:90px
                      "
                    >

                      ${
                        product.image

                          ? `
                            <img
                              src="${escapeHtml(
                                product.image
                              )}"
                              alt="${escapeHtml(
                                product.name
                              )}"
                              style="
                                max-width:100%;
                                max-height:360px;
                                object-fit:contain
                              "
                            >
                          `

                          : "🛍️"
                      }

                    </div>

                  </div>

                  <div>

                    <h1>
                      ${escapeHtml(
                        product.name
                      )}
                    </h1>

                    <p>
                      ${escapeHtml(
                        product.description ||
                        "توضیحی برای این محصول ثبت نشده است."
                      )}
                    </p>

                    <div
                      class="price"
                      style="
                        font-size:28px;
                        margin:20px 0
                      "
                    >
                      ${formatPrice(
                        product.price
                      )}
                    </div>

                    <div
                      style="
                        color:var(--muted);
                        margin-bottom:15px
                      "
                    >

                      دسته‌بندی:
                      ${escapeHtml(
                        product.category ||
                        "عمومی"
                      )}

                      <br>

                      موجودی:
                      ${Number(
                        product.stock || 0
                      )}

                    </div>

                    <a
                      class="btn btn-primary"
                      href="/account"
                    >
                      ادامه و ورود به حساب
                    </a>

                  </div>

                </div>

              </div>

            </main>

          `)
        );

      }

      /* -----------------------------------------------
         ABOUT
      ----------------------------------------------- */

      if(
        path === "/about"
        &&
        method === "GET"
      ){

        return html(
          layout(`

            <main class="container page">

              <div class="panel">

                <h1>
                  درباره ${STORE_NAME}
                </h1>

                <p>
                  ${STORE_NAME}
                  با هدف ایجاد یک تجربه ساده
                  و کاربردی برای خرید آنلاین
                  راه‌اندازی شده است.
                </p>

              </div>

            </main>

          `)
        );

      }

      /* -----------------------------------------------
         CONTACT
      ----------------------------------------------- */

      if(
        path === "/contact"
        &&
        method === "GET"
      ){

        return html(
          layout(`

            <main class="container page">

              <div class="panel">

                <h1>
                  تماس با ما
                </h1>

                <p>
                  برای ارتباط با
                  ${STORE_NAME}
                  از راه‌های ارتباطی اعلام‌شده
                  در فروشگاه استفاده کنید.
                </p>

              </div>

            </main>

          `)
        );

      }

      /* -----------------------------------------------
         TERMS
      ----------------------------------------------- */

      if(
        path === "/terms"
        &&
        method === "GET"
      ){

        return html(
          layout(`

            <main class="container page">

              <div class="panel">

                <h1>
                  قوانین و مقررات
                </h1>

                <p>
                  استفاده از خدمات
                  ${STORE_NAME}
                  به معنی پذیرش قوانین و مقررات
                  فروشگاه است.
                </p>

              </div>

            </main>

          `)
        );

      }

      /* -----------------------------------------------
         404
      ----------------------------------------------- */

      return html(
        layout(`

          <main class="container page">

            <div class="panel">

              <h1>
                صفحه پیدا نشد
              </h1>

              <p>
                آدرس مورد نظر وجود ندارد.
              </p>

              <a
                class="btn btn-primary"
                href="/"
              >
                بازگشت به فروشگاه
              </a>

            </div>

          </main>

        `)
      );

    }catch(error){

      return new Response(

        "DigiMarixo Error: " +
        error.message,

        {
          status:500,

          headers:{
            "content-type":
              "text/plain;charset=UTF-8",

            "cache-control":
              "no-store"
          }
        }

      );

    }

  }

};
