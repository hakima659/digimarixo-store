const STORE_NAME = "دیجی‌ماریکسو";
const STORE_EN = "DigiMarixo";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
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
          message: "DigiMarixo is online"
        });
      }

      // =========================
      // PRODUCTS API
      // =========================
      if (path === "/api/products" && method === "GET") {
        const products = await getProducts(env);

        return json({
          ok: true,
          products
        });
      }

      // =========================
      // 404
      // =========================
      return html(notFoundPage(), 404);

    } catch (error) {
      return json(
        {
          ok: false,
          error: "Internal Server Error",
          message: error?.message || String(error)
        },
        500
      );
    }
  }
};


// =====================================================
// D1 PRODUCTS
// =====================================================

async function getProducts(env) {
  if (!env.DB) {
    return [];
  }

  try {
    const result = await env.DB
      .prepare(`
        SELECT *
        FROM products
        ORDER BY id DESC
      `)
      .all();

    return result?.results || [];
  } catch (error) {
    return [];
  }
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
    content="دیجی‌ماریکسو؛ فروشگاه آنلاین محصولات دیجیتال و خدمات دیجیتال"
  >

  <meta
    name="theme-color"
    content="#111827"
  >

  <title>دیجی‌ماریکسو | DigiMarixo</title>

  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
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

      color: #111827;
      line-height: 1.8;
      min-height: 100vh;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    button {
      font-family: inherit;
    }

    .container {
      width: min(1180px, 92%);
      margin: 0 auto;
    }

    /* =========================
       HEADER
       ========================= */

    header {
      position: sticky;
      top: 0;
      z-index: 100;

      background: rgba(255,255,255,0.94);
      backdrop-filter: blur(12px);

      border-bottom:
        1px solid #e5e7eb;
    }

    .nav {
      min-height: 72px;

      display: flex;
      align-items: center;
      justify-content: space-between;

      gap: 20px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;

      font-weight: 900;
      font-size: 20px;
    }

    .brand-logo {
      width: 44px;
      height: 44px;

      border-radius: 14px;

      display: flex;
      align-items: center;
      justify-content: center;

      background:
        linear-gradient(
          135deg,
          #111827,
          #4f46e5
        );

      color: white;
      font-size: 20px;
      font-weight: 900;

      box-shadow:
        0 8px 24px rgba(79,70,229,0.25);
    }

    .brand-text small {
      display: block;
      font-size: 11px;
      color: #6b7280;
      direction: ltr;
      text-align: right;
    }

    .menu {
      display: flex;
      align-items: center;
      gap: 22px;

      color: #374151;
      font-size: 14px;
      font-weight: 700;
    }

    .menu a {
      transition: 0.2s;
    }

    .menu a:hover {
      color: #4f46e5;
    }

    .nav-button {
      padding: 10px 16px;

      border-radius: 12px;

      background: #111827;
      color: white;

      font-size: 13px;
    }

    /* =========================
       HERO
       ========================= */

    .hero {
      padding:
        80px 0
        70px;
    }

    .hero-grid {
      display: grid;
      grid-template-columns:
        minmax(0, 1.15fr)
        minmax(300px, 0.85fr);

      gap: 50px;
      align-items: center;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;

      padding: 7px 13px;

      border-radius: 999px;

      background: #eef2ff;
      color: #4338ca;

      font-size: 13px;
      font-weight: 800;

      margin-bottom: 20px;
    }

    .hero h1 {
      font-size:
        clamp(34px, 6vw, 62px);

      line-height: 1.2;

      font-weight: 950;

      letter-spacing: -1.5px;

      margin-bottom: 22px;
    }

    .hero h1 span {
      color: #4f46e5;
    }

    .hero p {
      max-width: 680px;

      color: #6b7280;

      font-size:
        clamp(16px, 2vw, 19px);

      margin-bottom: 30px;
    }

    .hero-buttons {
      display: flex;
      flex-wrap: wrap;

      gap: 12px;
    }

    .btn {
      border: none;

      border-radius: 14px;

      padding:
        13px 20px;

      cursor: pointer;

      font-size: 14px;
      font-weight: 800;

      transition:
        transform 0.2s,
        box-shadow 0.2s;
    }

    .btn:hover {
      transform: translateY(-2px);
    }

    .btn-primary {
      background: #111827;
      color: white;

      box-shadow:
        0 10px 25px
        rgba(17,24,39,0.18);
    }

    .btn-secondary {
      background: white;
      color: #111827;

      border:
        1px solid #e5e7eb;
    }

    .hero-card {
      min-height: 360px;

      border-radius: 28px;

      background:
        linear-gradient(
          145deg,
          #111827,
          #312e81
        );

      color: white;

      padding: 30px;

      position: relative;
      overflow: hidden;

      box-shadow:
        0 25px 60px
        rgba(17,24,39,0.20);
    }

    .hero-card::before {
      content: "";

      position: absolute;

      width: 230px;
      height: 230px;

      border-radius: 50%;

      background:
        rgba(129,140,248,0.22);

      top: -90px;
      left: -70px;
    }

    .hero-card::after {
      content: "";

      position: absolute;

      width: 180px;
      height: 180px;

      border-radius: 50%;

      background:
        rgba(255,255,255,0.07);

      bottom: -70px;
      right: -50px;
    }

    .hero-card-content {
      position: relative;
      z-index: 2;
    }

    .hero-card-icon {
      width: 65px;
      height: 65px;

      display: flex;
      align-items: center;
      justify-content: center;

      border-radius: 20px;

      background:
        rgba(255,255,255,0.12);

      font-size: 30px;

      margin-bottom: 25px;
    }

    .hero-card h2 {
      font-size: 27px;
      margin-bottom: 12px;
    }

    .hero-card p {
      color: #dbeafe;
      margin-bottom: 25px;
      font-size: 15px;
    }

    .hero-card-list {
      display: grid;
      gap: 12px;
    }

    .hero-card-item {
      display: flex;
      align-items: center;
      gap: 10px;

      font-size: 14px;
      color: #f9fafb;
    }

    .check {
      width: 25px;
      height: 25px;

      border-radius: 50%;

      background: rgba(255,255,255,0.12);

      display: flex;
      align-items: center;
      justify-content: center;

      font-size: 13px;
    }

    /* =========================
       FEATURES
       ========================= */

    .section {
      padding: 65px 0;
    }

    .section-header {
      text-align: center;

      max-width: 720px;

      margin:
        0 auto
        40px;
    }

    .section-header h2 {
      font-size:
        clamp(26px, 4vw, 38px);

      margin-bottom: 10px;
    }

    .section-header p {
      color: #6b7280;
    }

    .features {
      display: grid;

      grid-template-columns:
        repeat(3, minmax(0, 1fr));

      gap: 20px;
    }

    .feature {
      background: white;

      border:
        1px solid #e5e7eb;

      border-radius: 20px;

      padding: 25px;

      box-shadow:
        0 10px 30px
        rgba(15,23,42,0.05);
    }

    .feature-icon {
      width: 50px;
      height: 50px;

      display: flex;
      align-items: center;
      justify-content: center;

      border-radius: 15px;

      background: #eef2ff;

      font-size: 23px;

      margin-bottom: 18px;
    }

    .feature h3 {
      margin-bottom: 8px;
      font-size: 18px;
    }

    .feature p {
      color: #6b7280;
      font-size: 14px;
    }

    /* =========================
       PRODUCTS
       ========================= */

    .products-section {
      padding:
        70px 0
        90px;
    }

    .products {
      display: grid;

      grid-template-columns:
        repeat(3, minmax(0, 1fr));

      gap: 20px;
    }

    .product {
      background: white;

      border:
        1px solid #e5e7eb;

      border-radius: 20px;

      overflow: hidden;

      box-shadow:
        0 10px 30px
        rgba(15,23,42,0.05);

      transition:
        transform 0.2s,
        box-shadow 0.2s;
    }

    .product:hover {
      transform: translateY(-4px);

      box-shadow:
        0 18px 40px
        rgba(15,23,42,0.09);
    }

    .product-image {
      height: 190px;

      background:
        linear-gradient(
          135deg,
          #eef2ff,
          #e0e7ff
        );

      display: flex;
      align-items: center;
      justify-content: center;

      font-size: 45px;
    }

    .product-body {
      padding: 22px;
    }

    .product-title {
      font-size: 18px;
      font-weight: 900;

      margin-bottom: 8px;
    }

    .product-description {
      color: #6b7280;

      font-size: 13px;

      min-height: 48px;

      margin-bottom: 18px;
    }

    .product-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;

      gap: 10px;
    }

    .product-price {
      font-weight: 900;
      color: #111827;
    }

    .product-button {
      border: none;

      border-radius: 11px;

      padding:
        9px 13px;

      background: #111827;
      color: white;

      cursor: pointer;

      font-size: 12px;
      font-weight: 800;
    }

    .empty-products {
      grid-column: 1 / -1;

      text-align: center;

      padding: 45px 20px;

      background: white;

      border:
        1px dashed #d1d5db;

      border-radius: 20px;

      color: #6b7280;
    }

    /* =========================
       FOOTER
       ========================= */

    footer {
      background: #111827;
      color: white;

      padding:
        45px 0
        25px;
    }

    .footer-grid {
      display: grid;

      grid-template-columns:
        1.2fr
        1fr
        1fr;

      gap: 35px;

      margin-bottom: 35px;
    }

    .footer h3 {
      margin-bottom: 12px;
    }

    .footer p {
      color: #9ca3af;

      font-size: 13px;
    }

    .footer-links {
      display: grid;
      gap: 8px;

      font-size: 13px;
      color: #d1d5db;
    }

    .footer-bottom {
      border-top:
        1px solid
        rgba(255,255,255,0.1);

      padding-top: 20px;

      text-align: center;

      color: #9ca3af;

      font-size: 12px;
    }

    /* =========================
       RESPONSIVE
       ========================= */

    @media (max-width: 900px) {
      .hero-grid {
        grid-template-columns: 1fr;
      }

      .features {
        grid-template-columns: 1fr 1fr;
      }

      .products {
        grid-template-columns: 1fr 1fr;
      }

      .footer-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 650px) {
      .nav {
        min-height: 64px;
      }

      .menu {
        display: none;
      }

      .hero {
        padding-top: 50px;
      }

      .hero-card {
        min-height: 300px;
      }

      .features {
        grid-template-columns: 1fr;
      }

      .products {
        grid-template-columns: 1fr;
      }

      .footer-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>

<body>

  <!-- =========================
       HEADER
       ========================= -->

  <header>
    <div class="container nav">

      <a href="/" class="brand">

        <div class="brand-logo">
          D
        </div>

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

        <a
          href="#products"
          class="nav-button"
        >
          مشاهده فروشگاه
        </a>
      </nav>

    </div>
  </header>


  <!-- =========================
       HERO
       ========================= -->

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
              href="#features"
              class="btn btn-secondary"
            >
              امکانات فروشگاه
            </a>

          </div>

        </div>


        <div class="hero-card">

          <div class="hero-card-content">

            <div class="hero-card-icon">
              🛍️
            </div>

            <h2>
              DigiMarixo
            </h2>

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

      </div>

    </section>


    <!-- =========================
         FEATURES
         ========================= -->

    <section
      class="section"
      id="features"
    >

      <div class="container">

        <div class="section-header">

          <h2>
            چرا دیجی‌ماریکسو؟
          </h2>

          <p>
            امکاناتی برای یک تجربه ساده،
            سریع و مدرن در دنیای دیجیتال.
          </p>

        </div>


        <div class="features">

          <article class="feature">

            <div class="feature-icon">
              ⚡
            </div>

            <h3>
              سریع و ساده
            </h3>

            <p>
              صفحات سبک و سریع برای دسترسی
              راحت با موبایل و کامپیوتر.
            </p>

          </article>


          <article class="feature">

            <div class="feature-icon">
              🔒
            </div>

            <h3>
              امنیت
            </h3>

            <p>
              زیرساخت فروشگاه روی سرویس‌های
              ابری مدرن اجرا می‌شود.
            </p>

          </article>


          <article class="feature">

            <div class="feature-icon">
              🌐
            </div>

            <h3>
              آنلاین و جهانی
            </h3>

            <p>
              آماده برای ارائه محصولات دیجیتال
              به کاربران مختلف در سراسر جهان.
            </p>

          </article>

        </div>

      </div>

    </section>


    <!-- =========================
         PRODUCTS
         ========================= -->

    <section
      class="products-section"
      id="products"
    >

      <div class="container">

        <div class="section-header">

          <h2>
            محصولات فروشگاه
          </h2>

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


    <!-- =========================
         ABOUT
         ========================= -->

    <section
      class="section"
      id="about"
    >

      <div class="container">

        <div class="section-header">

          <h2>
            درباره دیجی‌ماریکسو
          </h2>

          <p>
            هدف دیجی‌ماریکسو ایجاد یک فروشگاه
            مدرن برای محصولات و خدمات دیجیتال است.
          </p>

        </div>

      </div>

    </section>

  </main>


  <!-- =========================
       FOOTER
       ========================= -->

  <footer>

    <div class="container">

      <div class="footer-grid">

        <div class="footer">

          <h3>
            ${STORE_NAME}
          </h3>

          <p>
            ${STORE_EN} — فروشگاه آنلاین
            محصولات و خدمات دیجیتال.
          </p>

        </div>


        <div class="footer">

          <h3>
            دسترسی سریع
          </h3>

          <div class="footer-links">

            <a href="/">
              خانه
            </a>

            <a href="#features">
              امکانات
            </a>

            <a href="#products">
              محصولات
            </a>

          </div>

        </div>


        <div class="footer">

          <h3>
            وضعیت
          </h3>

          <div class="footer-links">

            <a href="/health">
              وضعیت سرویس
            </a>

            <span>
              آنلاین
            </span>

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


  <!-- =========================
       JAVASCRIPT
       ========================= -->

  <script>
    async function loadProducts() {

      const container =
        document.getElementById(
          "products-list"
        );

      try {

        const response =
          await fetch("/api/products");

        if (!response.ok) {
          throw new Error(
            "Products request failed"
          );
        }

        const data =
          await response.json();

        const products =
          Array.isArray(data.products)
            ? data.products
            : [];

        if (products.length === 0) {

          container.innerHTML = \`
            <div class="empty-products">
              هنوز محصولی برای نمایش ثبت نشده است.
            </div>
          \`;

          return;
        }

        container.innerHTML =
          products
            .map(function(product) {

              const name =
                product.name ||
                product.title ||
                "محصول دیجیتال";

              const description =
                product.description ||
                "محصول دیجیتال از فروشگاه دیجی‌ماریکسو";

              const price =
                product.price ||
                product.amount ||
                "";

              const image =
                product.image ||
                product.image_url ||
                "🛍️";

              return \`
                <article class="product">

                  <div class="product-image">
                    \${escapeHtml(String(image))}
                  </div>

                  <div class="product-body">

                    <div class="product-title">
                      \${escapeHtml(String(name))}
                    </div>

                    <div class="product-description">
                      \${escapeHtml(String(description))}
                    </div>

                    <div class="product-bottom">

                      <div class="product-price">
                        \${escapeHtml(String(price))}
                      </div>

                      <button
                        class="product-button"
                        onclick="selectProduct('\${escapeAttribute(String(name))}')"
                      >
                        مشاهده
                      </button>

                    </div>

                  </div>

                </article>
              \`;

            })
            .join("");

      } catch (error) {

        container.innerHTML = \`
          <div class="empty-products">
            فعلاً امکان دریافت محصولات وجود ندارد.
          </div>
        \`;

      }
    }


    function escapeHtml(value) {

      return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }


    function escapeAttribute(value) {

      return value
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, "&quot;");
    }


    function selectProduct(name) {

      alert(
        "محصول انتخاب شد: " + name
      );
    }


    loadProducts();
  </script>

</body>
</html>
  `;
}


// =====================================================
// 404 PAGE
// =====================================================

function notFoundPage() {
  return `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>صفحه پیدا نشد | دیجی‌ماریکسو</title>

  <style>

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;

      min-height: 100vh;

      display: flex;
      align-items: center;
      justify-content: center;

      font-family:
        Tahoma,
        Arial,
        sans-serif;

      background: #f8fafc;

      color: #111827;

      text-align: center;

      padding: 20px;
    }

    .box {
      max-width: 500px;

      background: white;

      border:
        1px solid #e5e7eb;

      border-radius: 24px;

      padding: 45px 30px;

      box-shadow:
        0 20px 50px
        rgba(15,23,42,0.08);
    }

    h1 {
      font-size: 70px;

      margin:
        0 0
        10px;
    }

    h2 {
      margin-bottom: 10px;
    }

    p {
      color: #6b7280;

      line-height: 1.8;

      margin-bottom: 25px;
    }

    a {
      display: inline-block;

      background: #111827;

      color: white;

      text-decoration: none;

      padding:
        12px 20px;

      border-radius: 12px;

      font-weight: 800;
    }

  </style>

</head>

<body>

  <div class="box">

    <h1>
      404
    </h1>

    <h2>
      صفحه پیدا نشد
    </h2>

    <p>
      صفحه‌ای که به دنبال آن هستید
      وجود ندارد یا آدرس آن تغییر کرده است.
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

function html(content, status = 200) {

  return new Response(
    content,
    {
      status,

      headers: {
        "content-type":
          "text/html; charset=UTF-8",

        "cache-control":
          "no-cache"
      }
    }
  );
}


function json(data, status = 200) {

  return new Response(
    JSON.stringify(data, null, 2),

    {
      status,

      headers: {
        "content-type":
          "application/json; charset=UTF-8",

        "cache-control":
          "no-cache"
      }
    }
  );
}
