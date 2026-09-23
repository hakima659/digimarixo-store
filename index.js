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
          status: "online"
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
      return json({
        ok: false,
        error: error?.message || "Server error"
      }, 500);
    }
  }
};


// =====================================================
// DATABASE
// =====================================================

async function getProducts(env) {
  // اگر D1 متصل باشد، محصولات را از جدول products می‌خوانیم
  if (env.DB) {
    try {
      const result = await env.DB
        .prepare(`
          SELECT *
          FROM products
          ORDER BY id DESC
        `)
        .all();

      return result.results || [];
    } catch (error) {
      // اگر جدول هنوز ساخته نشده باشد،
      // فروشگاه همچنان بدون خطا نمایش داده می‌شود.
      return [];
    }
  }

  return [];
}


// =====================================================
// HOME PAGE
// =====================================================

function homePage() {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>${STORE_NAME} | ${STORE_EN}</title>

  <meta
    name="description"
    content="دیجی‌ماریکسو؛ فروشگاه آنلاین برای مشاهده و خرید محصولات"
  >

  <meta
    name="theme-color"
    content="#111827"
  >

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
      background: #f5f7fb;
      color: #111827;
    }

    header {
      background: #111827;
      color: white;
      padding: 18px 20px;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .header-inner {
      max-width: 1100px;
      margin: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
    }

    .brand {
      font-size: 22px;
      font-weight: bold;
    }

    .brand small {
      display: block;
      font-size: 11px;
      opacity: .7;
      margin-top: 3px;
      direction: ltr;
      text-align: right;
    }

    nav {
      display: flex;
      align-items: center;
      gap: 18px;
    }

    nav a {
      color: white;
      text-decoration: none;
      font-size: 14px;
    }

    nav a:hover {
      opacity: .75;
    }

    .hero {
      max-width: 1100px;
      margin: 30px auto;
      padding: 55px 25px;
      border-radius: 20px;
      background: white;
      text-align: center;
      box-shadow: 0 8px 30px rgba(0,0,0,.06);
    }

    .hero h1 {
      margin: 0 0 15px;
      font-size: 34px;
    }

    .hero p {
      color: #6b7280;
      line-height: 2;
      margin: 0 auto 25px;
      max-width: 650px;
    }

    .button {
      display: inline-block;
      padding: 12px 24px;
      border-radius: 12px;
      background: #111827;
      color: white;
      text-decoration: none;
      border: none;
      cursor: pointer;
      font-size: 15px;
    }

    .button:hover {
      opacity: .9;
    }

    .section {
      max-width: 1100px;
      margin: 30px auto;
      padding: 0 20px;
    }

    .section-title {
      font-size: 23px;
      margin-bottom: 18px;
    }

    .products {
      display: grid;
      grid-template-columns:
        repeat(auto-fit, minmax(230px, 1fr));
      gap: 18px;
    }

    .product {
      background: white;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 6px 25px rgba(0,0,0,.05);
      transition: transform .2s ease;
    }

    .product:hover {
      transform: translateY(-3px);
    }

    .product-image {
      width: 100%;
      height: 190px;
      background: #eef2f7;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #9ca3af;
      font-size: 14px;
    }

    .product-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .product-body {
      padding: 18px;
    }

    .product-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 10px;
    }

    .product-description {
      color: #6b7280;
      font-size: 14px;
      line-height: 1.9;
      min-height: 50px;
    }

    .product-price {
      margin-top: 15px;
      font-size: 17px;
      font-weight: bold;
    }

    .empty {
      background: white;
      border-radius: 18px;
      padding: 35px 20px;
      text-align: center;
      color: #6b7280;
      box-shadow: 0 6px 25px rgba(0,0,0,.05);
    }

    .features {
      display: grid;
      grid-template-columns:
        repeat(auto-fit, minmax(220px, 1fr));
      gap: 18px;
    }

    .feature {
      background: white;
      padding: 25px 20px;
      border-radius: 18px;
      text-align: center;
      box-shadow: 0 6px 25px rgba(0,0,0,.05);
    }

    .feature-icon {
      font-size: 34px;
      margin-bottom: 12px;
    }

    .feature h3 {
      margin: 8px 0;
    }

    .feature p {
      color: #6b7280;
      line-height: 1.8;
      font-size: 14px;
    }

    footer {
      margin-top: 50px;
      background: #111827;
      color: white;
      padding: 30px 20px;
      text-align: center;
    }

    footer p {
      margin: 6px 0;
      opacity: .8;
      font-size: 13px;
    }

    @media (max-width: 700px) {
      .header-inner {
        flex-direction: column;
      }

      nav {
        width: 100%;
        justify-content: center;
        flex-wrap: wrap;
      }

      .hero {
        margin: 18px 12px;
        padding: 40px 18px;
      }

      .hero h1 {
        font-size: 28px;
      }

      .section {
        padding: 0 12px;
      }
    }
  </style>
</head>

<body>

  <!-- =========================
       HEADER
       ========================= -->

  <header>
    <div class="header-inner">

      <div class="brand">
        ${STORE_NAME}
        <small>${STORE_EN}</small>
      </div>

      <nav>
        <a href="/">خانه</a>
        <a href="#products">محصولات</a>
        <a href="#features">امکانات</a>
      </nav>

    </div>
  </header>


  <!-- =========================
       HERO
       ========================= -->

  <main>

    <section class="hero">

      <h1>
        به ${STORE_NAME} خوش آمدید
      </h1>

      <p>
        فروشگاه آنلاین ${STORE_EN} برای مشاهده،
        بررسی و خرید محصولات.
      </p>

      <a
        href="#products"
        class="button"
      >
        مشاهده محصولات
      </a>

    </section>


    <!-- =========================
         PRODUCTS
         ========================= -->

    <section
      class="section"
      id="products"
    >

      <h2 class="section-title">
        محصولات
      </h2>

      <div
        class="products"
        id="products-list"
      >

        <div class="empty">
          در حال دریافت محصولات...
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

      <h2 class="section-title">
        چرا ${STORE_NAME}؟
      </h2>

      <div class="features">

        <div class="feature">
          <div class="feature-icon">🛍️</div>
          <h3>فروشگاه آنلاین</h3>
          <p>
            مشاهده محصولات در محیطی ساده
            و مناسب برای موبایل.
          </p>
        </div>

        <div class="feature">
          <div class="feature-icon">⚡</div>
          <h3>سریع و ساده</h3>
          <p>
            دسترسی سریع به محصولات
            بدون پیچیدگی اضافی.
          </p>
        </div>

        <div class="feature">
          <div class="feature-icon">🔒</div>
          <h3>امن و قابل توسعه</h3>
          <p>
            زیرساخت فروشگاه روی Cloudflare
            و قابل توسعه با امکانات بیشتر.
          </p>
        </div>

      </div>

    </section>

  </main>


  <!-- =========================
       FOOTER
       ========================= -->

  <footer>

    <strong>
      ${STORE_NAME}
    </strong>

    <p>
      ${STORE_EN}
    </p>

    <p>
      © ${new Date().getFullYear()} ${STORE_NAME}
    </p>

  </footer>


  <!-- =========================
       PRODUCTS SCRIPT
       ========================= -->

  <script>

    async function loadProducts() {

      const container =
        document.getElementById("products-list");

      try {

        const response =
          await fetch("/api/products");

        const data =
          await response.json();

        if (
          !data.ok ||
          !Array.isArray(data.products) ||
          data.products.length === 0
        ) {

          container.innerHTML = \`
            <div class="empty">
              هنوز محصولی برای نمایش ثبت نشده است.
            </div>
          \`;

          return;
        }

        container.innerHTML =
          data.products
            .map(product => {

              const title =
                escapeHtml(
                  product.name ||
                  product.title ||
                  "محصول"
                );

              const description =
                escapeHtml(
                  product.description ||
                  "توضیحات محصول"
                );

              const price =
                product.price != null
                  ? formatPrice(product.price)
                  : "";

              const image =
                product.image ||
                product.image_url ||
                "";

              return \`
                <article class="product">

                  <div class="product-image">

                    ${
                      image
                        ? \`
                          <img
                            src="\${escapeAttribute(image)}"
                            alt="\${title}"
                            loading="lazy"
                          >
                        \`
                        : "تصویر محصول"
                    }

                  </div>

                  <div class="product-body">

                    <div class="product-title">
                      \${title}
                    </div>

                    <div class="product-description">
                      \${description}
                    </div>

                    ${
                      price
                        ? \`
                          <div class="product-price">
                            \${price}
                          </div>
                        \`
                        : ""
                    }

                  </div>

                </article>
              `;

            })
            .join("");

      } catch (error) {

        container.innerHTML = \`
          <div class="empty">
            در حال حاضر امکان دریافت محصولات وجود ندارد.
          </div>
        \`;

      }

    }


    function formatPrice(value) {

      const number =
        Number(value);

      if (
        !Number.isFinite(number)
      ) {
        return "";
      }

      return new Intl.NumberFormat(
        "fa-IR"
      ).format(number) + " تومان";

    }


    function escapeHtml(value) {

      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    }


    function escapeAttribute(value) {

      return escapeHtml(value);

    }


    loadProducts();

  </script>

</body>
</html>`;
}


// =====================================================
// 404 PAGE
// =====================================================

function notFoundPage() {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">

<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>صفحه پیدا نشد | ${STORE_NAME}</title>

  <style>

    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f7fb;
      font-family: Tahoma, Arial, sans-serif;
      color: #111827;
      text-align: center;
    }

    .box {
      background: white;
      padding: 40px 25px;
      border-radius: 20px;
      box-shadow: 0 8px 30px rgba(0,0,0,.06);
      max-width: 450px;
      width: calc(100% - 40px);
    }

    h1 {
      font-size: 50px;
      margin: 0 0 10px;
    }

    p {
      color: #6b7280;
      line-height: 1.9;
    }

    a {
      display: inline-block;
      margin-top: 15px;
      padding: 12px 22px;
      background: #111827;
      color: white;
      text-decoration: none;
      border-radius: 12px;
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
      صفحه‌ای که به دنبال آن هستید وجود ندارد.
    </p>

    <a href="/">
      بازگشت به فروشگاه
    </a>

  </div>

</body>

</html>`;
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
          "no-store"
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
        "content-type":
          "application/json; charset=UTF-8",
        "cache-control":
          "no-store"
      }
    }
  );

}
