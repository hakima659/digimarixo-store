const STORE_NAME = "دیجی‌ماریکسو";
const STORE_EN = "DigiMarixo";
const DEFAULT_ADMIN_USERNAME = "مدیر";

/* =========================================================
   MAIN
========================================================= */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      await initDB(env);

      if (path === "/health") {
        return json({
          ok: true,
          store: STORE_EN,
          database: true
        });
      }

      if (path === "/api/products" && method === "GET") {
        return json(await getProducts(env));
      }

      if (path.startsWith("/api/products/") && method === "GET") {
        const id = path.split("/").pop();
        return json(await getProduct(env, id));
      }

      if (path === "/api/orders" && method === "POST") {
        return await createOrder(request, env);
      }

      if (path === "/account") {
        return html(accountPage());
      }

      if (path === "/admin") {
        return html(adminPage());
      }

      if (path === "/products") {
        const productId = url.searchParams.get("id");

        if (productId) {
          const result = await getProduct(env, productId);

          if (!result.ok) {
            return html(
              layout(
                "محصول پیدا نشد",
                `
                <section class="page-title">
                  <span class="eyebrow">DigiMarixo</span>
                  <h1>محصول پیدا نشد</h1>
                  <p>محصول موردنظر در فروشگاه وجود ندارد.</p>
                  <a class="btn primary" href="/products">
                    بازگشت به محصولات
                  </a>
                </section>
                `
              ),
              404
            );
          }

          return html(
            layout(
              result.product.name,
              productDetailPage(result.product)
            )
          );
        }

        return html(await productsPage(env));
      }

      if (path === "/cart") {
        return html(cartPage());
      }

      return html(await homePage(env));

    } catch (error) {
      console.error("DigiMarixo Error:", error);

      return new Response(
        "DigiMarixo Error: " + safeError(error),
        {
          status: 500,
          headers: {
            "content-type": "text/plain; charset=UTF-8"
          }
        }
      );
    }
  }
};


/* =========================================================
   DATABASE
========================================================= */

async function initDB(env) {
  if (!env.DB) {
    throw new Error("D1 binding DB is not configured");
  }

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price INTEGER DEFAULT 0,
      image TEXT DEFAULT '',
      category TEXT DEFAULT '',
      stock INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_email TEXT DEFAULT '',
      customer_phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      total INTEGER DEFAULT 0,
      status TEXT DEFAULT 'در انتظار',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      price INTEGER DEFAULT 0
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      name TEXT DEFAULT '',
      rating INTEGER DEFAULT 5,
      comment TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
    Migration for old products table.
    This checks existing columns before ALTER TABLE.
  */

  const columns = await env.DB
    .prepare(`PRAGMA table_info(products)`)
    .all();

  const names = new Set(
    (columns.results || []).map(row => row.name)
  );

  if (!names.has("category")) {
    await env.DB
      .prepare(
        `ALTER TABLE products ADD COLUMN category TEXT DEFAULT ''`
      )
      .run();
  }

  if (!names.has("stock")) {
    await env.DB
      .prepare(
        `ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0`
      )
      .run();
  }

  if (!names.has("image")) {
    await env.DB
      .prepare(
        `ALTER TABLE products ADD COLUMN image TEXT DEFAULT ''`
      )
      .run();
  }

  if (!names.has("active")) {
    await env.DB
      .prepare(
        `ALTER TABLE products ADD COLUMN active INTEGER DEFAULT 1`
      )
      .run();
  }

  await seedProducts(env);
}


/* =========================================================
   SEED
========================================================= */

async function seedProducts(env) {
  const result = await env.DB
    .prepare(`SELECT COUNT(*) AS count FROM products`)
    .first();

  if (Number(result?.count || 0) > 0) {
    return;
  }

  const products = [
    {
      name: "محصول دیجیتال شماره ۱",
      description: "یک محصول دیجیتال کاربردی از فروشگاه دیجی‌ماریکسو.",
      price: 99000,
      category: "دیجیتال",
      stock: 10
    },
    {
      name: "محصول دیجیتال شماره ۲",
      description: "محصول کاربردی برای استفاده روزمره.",
      price: 149000,
      category: "دیجیتال",
      stock: 10
    },
    {
      name: "محصول ویژه دیجی‌ماریکسو",
      description: "یکی از محصولات ویژه فروشگاه.",
      price: 249000,
      category: "ویژه",
      stock: 5
    }
  ];

  for (const product of products) {
    await env.DB
      .prepare(`
        INSERT INTO products
        (name, description, price, image, category, stock, active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `)
      .bind(
        product.name,
        product.description,
        product.price,
        "",
        product.category,
        product.stock
      )
      .run();
  }
}


/* =========================================================
   PRODUCTS
========================================================= */

async function getProducts(env) {
  const result = await env.DB.prepare(`
    SELECT
      id,
      name,
      description,
      price,
      image,
      category,
      stock,
      active,
      created_at
    FROM products
    WHERE active = 1
    ORDER BY id DESC
  `).all();

  return {
    ok: true,
    products: result.results || []
  };
}


async function getProduct(env, id) {
  const product = await env.DB.prepare(`
    SELECT
      id,
      name,
      description,
      price,
      image,
      category,
      stock,
      active,
      created_at
    FROM products
    WHERE id = ?
    LIMIT 1
  `)
    .bind(id)
    .first();

  if (!product) {
    return {
      ok: false,
      error: "محصول پیدا نشد"
    };
  }

  return {
    ok: true,
    product
  };
}


/* =========================================================
   CREATE ORDER
========================================================= */

async function createOrder(request, env) {
  let data;

  try {
    data = await request.json();
  } catch {
    return json(
      {
        ok: false,
        error: "اطلاعات سفارش نامعتبر است"
      },
      400
    );
  }

  const customerName =
    String(data.customer_name || "").trim();

  const customerEmail =
    String(data.customer_email || "").trim();

  const customerPhone =
    String(data.customer_phone || "").trim();

  const address =
    String(data.address || "").trim();

  const items =
    Array.isArray(data.items) ? data.items : [];

  if (!customerName) {
    return json(
      {
        ok: false,
        error: "نام الزامی است"
      },
      400
    );
  }

  if (!items.length) {
    return json(
      {
        ok: false,
        error: "سبد خرید خالی است"
      },
      400
    );
  }

  let total = 0;
  const orderItems = [];

  for (const item of items) {
    const productId =
      Number(item.product_id ?? item.id);

    const quantity =
      Math.max(1, Number(item.quantity || 1));

    if (!Number.isFinite(productId)) {
      return json(
        {
          ok: false,
          error: "شناسه محصول نامعتبر است"
        },
        400
      );
    }

    const product = await env.DB.prepare(`
      SELECT id, price, stock, active
      FROM products
      WHERE id = ?
      LIMIT 1
    `)
      .bind(productId)
      .first();

    if (!product || Number(product.active) !== 1) {
      return json(
        {
          ok: false,
          error: "یکی از محصولات موجود نیست"
        },
        400
      );
    }

    if (Number(product.stock) < quantity) {
      return json(
        {
          ok: false,
          error: "موجودی محصول کافی نیست"
        },
        400
      );
    }

    const price = Number(product.price || 0);

    total += price * quantity;

    orderItems.push({
      productId,
      quantity,
      price
    });
  }

  const order = await env.DB.prepare(`
    INSERT INTO orders
    (
      customer_name,
      customer_email,
      customer_phone,
      address,
      total,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `)
    .bind(
      customerName,
      customerEmail,
      customerPhone,
      address,
      total,
      "در حال بررسی"
    )
    .run();

  const orderId = order.meta.last_row_id;

  for (const item of orderItems) {
    await env.DB.prepare(`
      INSERT INTO order_items
      (
        order_id,
        product_id,
        quantity,
        price
      )
      VALUES (?, ?, ?, ?)
    `)
      .bind(
        orderId,
        item.productId,
        item.quantity,
        item.price
      )
      .run();

    await env.DB.prepare(`
      UPDATE products
      SET stock = stock - ?
      WHERE id = ?
    `)
      .bind(
        item.quantity,
        item.productId
      )
      .run();
  }

  return json({
    ok: true,
    order_id: orderId,
    total
  });
}


/* =========================================================
   HOME
========================================================= */

async function homePage(env) {
  const data = await getProducts(env);
  const products = data.products || [];

  const productCards = products.length
    ? products.slice(0, 6).map(productCard).join("")
    : `
      <div class="empty">
        هنوز محصولی در فروشگاه ثبت نشده است.
      </div>
    `;

  return layout(
    "خانه",
    `
    <section class="hero">
      <div class="hero-content">

        <span class="badge">دیجی‌ماریکسو</span>

        <h1>
          فروشگاه دیجیتال
          <strong>دیجی‌ماریکسو</strong>
        </h1>

        <p>
          خرید و دسترسی آسان به محصولات دیجیتال
          با تجربه‌ای ساده، سریع و مطمئن.
        </p>

        <div class="hero-actions">
          <a class="btn primary" href="/products">
            محصولات ویژه
          </a>

          <a class="btn secondary" href="/account">
            حساب کاربری
          </a>
        </div>

      </div>

      <div class="hero-card">
        <div class="hero-icon">◆</div>

        <h3>دیجی‌ماریکسو</h3>

        <p>
          انتخاب، خرید و مدیریت محصولات
          در یک فروشگاه مدرن.
        </p>
      </div>
    </section>


    <section class="section">

      <div class="section-head">
        <div>
          <span class="eyebrow">محصولات</span>
          <h2>محصولات منتخب</h2>
        </div>

        <a href="/products" class="text-link">
          مشاهده همه
        </a>
      </div>

      <div class="products-grid">
        ${productCards}
      </div>

    </section>


    <section class="features" id="features">

      <div class="feature">
        <div class="feature-icon">⚡</div>
        <h3>سریع</h3>
        <p>
          دسترسی آسان و سریع به محصولات.
        </p>
      </div>

      <div class="feature">
        <div class="feature-icon">🔒</div>
        <h3>مطمئن</h3>
        <p>
          مدیریت سفارش‌ها و اطلاعات در یک محیط امن.
        </p>
      </div>

      <div class="feature">
        <div class="feature-icon">◆</div>
        <h3>دیجیتال</h3>
        <p>
          تمرکز فروشگاه بر محصولات دیجیتال و کاربردی.
        </p>
      </div>

      <div class="feature">
        <div class="feature-icon">✓</div>
        <h3>ساده</h3>
        <p>
          رابط کاربری ساده برای خرید راحت‌تر.
        </p>
      </div>

    </section>


    <section class="promo">

      <div>
        <span class="eyebrow">DigiMarixo</span>

        <h2>
          همه‌چیز برای یک خرید ساده
        </h2>

        <p>
          محصولات را بررسی کنید و از طریق
          حساب کاربری سفارشات خود را مدیریت کنید.
        </p>
      </div>

      <a class="btn orange" href="/products">
        شروع خرید
      </a>

    </section>
    `
  );
}


/* =========================================================
   PRODUCTS PAGE
========================================================= */

async function productsPage(env) {
  const data = await getProducts(env);

  const cards = data.products?.length
    ? data.products.map(productCard).join("")
    : `
      <div class="empty">
        محصولی برای نمایش وجود ندارد.
      </div>
    `;

  return layout(
    "محصولات",
    `
    <section class="page-title">

      <span class="eyebrow">
        دیجی‌ماریکسو
      </span>

      <h1>
        محصولات فروشگاه
      </h1>

      <p>
        محصولات موجود در دیجی‌ماریکسو را مشاهده کنید.
      </p>

    </section>

    <section class="section">

      <div class="products-grid">
        ${cards}
      </div>

    </section>
    `
  );
}


/* =========================================================
   PRODUCT DETAIL
========================================================= */

function productDetailPage(product) {
  const image = product.image
    ? `
      <img
        src="${escapeAttr(product.image)}"
        alt="${escapeAttr(product.name)}"
      >
    `
    : `
      <div class="product-placeholder large">
        ◆
      </div>
    `;

  const stock = Number(product.stock || 0);

  return `
    <section class="product-detail">

      <div class="detail-image">
        ${image}
      </div>

      <div class="detail-content">

        <span class="product-category">
          ${escapeHTML(product.category || "دیجیتال")}
        </span>

        <h1>
          ${escapeHTML(product.name || "محصول")}
        </h1>

        <p class="detail-description">
          ${escapeHTML(
            product.description ||
            "محصول دیجیتال دیجی‌ماریکسو"
          )}
        </p>

        <div class="detail-price">
          ${formatPrice(product.price)}
        </div>

        <div class="detail-stock">
          ${
            stock > 0
              ? `موجودی: ${formatNumber(stock)}`
              : "ناموجود"
          }
        </div>

        ${
          stock > 0
            ? `
              <button
                class="btn orange"
                onclick="addToCart(
                  ${Number(product.id)},
                  '${escapeJS(product.name || "محصول")}',
                  ${Number(product.price || 0)}
                )"
              >
                افزودن به سبد خرید
              </button>
            `
            : `
              <button
                class="btn disabled"
                disabled
              >
                ناموجود
              </button>
            `
        }

        <a
          class="btn secondary"
          href="/products"
        >
          بازگشت به محصولات
        </a>

      </div>

    </section>
  `;
}


/* =========================================================
   PRODUCT CARD
========================================================= */

function productCard(product) {
  const id = Number(product.id || 0);

  const name =
    escapeHTML(product.name || "محصول");

  const description =
    escapeHTML(
      product.description ||
      "محصول دیجیتال دیجی‌ماریکسو"
    );

  const price =
    formatPrice(product.price);

  const stock =
    Number(product.stock || 0);

  const image = product.image
    ? `
      <img
        src="${escapeAttr(product.image)}"
        alt="${escapeAttr(product.name || "محصول")}"
      >
    `
    : `
      <div class="product-placeholder">
        ◆
      </div>
    `;

  return `
    <article class="product-card">

      <div class="product-image">
        ${image}
      </div>

      <div class="product-body">

        <span class="product-category">
          ${escapeHTML(
            product.category || "دیجیتال"
          )}
        </span>

        <h3>
          ${name}
        </h3>

        <p>
          ${description}
        </p>

        <div class="product-bottom">

          <strong>
            ${price}
          </strong>

          <span class="stock">
            ${
              stock > 0
                ? "موجود"
                : "ناموجود"
            }
          </span>

        </div>

        <div class="product-actions">

          <a
            class="btn small primary"
            href="/products?id=${id}"
          >
            مشاهده
          </a>

          ${
            stock > 0
              ? `
                <button
                  class="btn small orange"
                  onclick="addToCart(
                    ${id},
                    '${escapeJS(product.name || "محصول")}',
                    ${Number(product.price || 0)}
                  )"
                >
                  افزودن به سبد
                </button>
              `
              : ""
          }

        </div>

      </div>

    </article>
  `;
}


/* =========================================================
   ACCOUNT
========================================================= */

function accountPage() {
  return layout(
    "حساب کاربری",
    `
    <section class="account-wrap">

      <div class="account-card">

        <span class="eyebrow">
          دیجی‌ماریکسو
        </span>

        <h1>
          حساب کاربری
        </h1>

        <p>
          مدیریت حساب و سفارش‌های دیجی‌ماریکسو
        </p>

        <form
          onsubmit="return false;"
        >

          <label>
            نام کاربری یا ایمیل
          </label>

          <input
            type="text"
            name="username"
            placeholder="نام کاربری یا ایمیل"
          >

          <label>
            رمز عبور
          </label>

          <input
            type="password"
            name="password"
            placeholder="رمز عبور"
          >

          <button
            class="btn primary"
            type="button"
            onclick="alert('بخش ورود در حال آماده‌سازی است.')"
          >
            ورود
          </button>

        </form>

        <div class="account-links">
          <a href="#register">
            ثبت‌نام
          </a>

          <a href="/">
            بازگشت به فروشگاه
          </a>
        </div>

      </div>


      <div
        class="account-card register"
        id="register"
      >

        <h2>
          ایجاد حساب
        </h2>

        <form
          onsubmit="return false;"
        >

          <label>
            نام کاربری
          </label>

          <input
            type="text"
            placeholder="نام کاربری"
          >

          <label>
            ایمیل
          </label>

          <input
            type="email"
            placeholder="ایمیل"
          >

          <label>
            رمز عبور
          </label>

          <input
            type="password"
            placeholder="رمز عبور"
          >

          <button
            class="btn secondary"
            type="button"
            onclick="alert('ثبت‌نام در حال آماده‌سازی است.')"
          >
            ایجاد حساب
          </button>

        </form>

      </div>

    </section>
    `
  );
}


/* =========================================================
   CART
========================================================= */

function cartPage() {
  return layout(
    "سبد خرید",
    `
    <section class="page-title">

      <span class="eyebrow">
        دیجی‌ماریکسو
      </span>

      <h1>
        سبد خرید
      </h1>

      <p>
        محصولات انتخاب شده شما.
      </p>

    </section>

    <section class="cart-box">

      <div id="cart-items">
        <div class="empty">
          سبد خرید شما خالی است.
        </div>
      </div>

      <div class="cart-total">

        <span>
          مجموع
        </span>

        <strong id="cart-total">
          ۰ تومان
        </strong>

      </div>

      <div class="cart-actions">

        <button
          class="btn orange"
          onclick="checkoutCart()"
        >
          ثبت سفارش
        </button>

        <a
          class="btn secondary"
          href="/products"
        >
          ادامه خرید
        </a>

      </div>

    </section>
    `
  );
}


/* =========================================================
   ADMIN
========================================================= */

function adminPage() {
  return layout(
    "مدیریت",
    `
    <section class="page-title">

      <span class="eyebrow">
        مدیر
      </span>

      <h1>
        مدیریت دیجی‌ماریکسو
      </h1>

      <p>
        پنل مدیریت فروشگاه دیجی‌ماریکسو.
      </p>

    </section>

    <section class="admin-grid">

      <div class="admin-card">
        <strong>
          محصولات
        </strong>

        <span>
          مدیریت محصولات فروشگاه
        </span>
      </div>

      <div class="admin-card">
        <strong>
          سفارش‌ها
        </strong>

        <span>
          مشاهده و مدیریت سفارش‌ها
        </span>
      </div>

      <div class="admin-card">
        <strong>
          دسته‌بندی‌ها
        </strong>

        <span>
          مدیریت دسته‌بندی محصولات
        </span>
      </div>

      <div class="admin-card">
        <strong>
          مدیر
        </strong>

        <span>
          ${escapeHTML(DEFAULT_ADMIN_USERNAME)}
        </span>
      </div>

    </section>
    `
  );
}


/* =========================================================
   LAYOUT
========================================================= */

function layout(title, content) {
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
    name="theme-color"
    content="#0f172a"
  >

  <title>
    ${escapeHTML(title)} | ${STORE_NAME}
  </title>

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
      background: #f4f7fb;
      color: #172033;
      line-height: 1.8;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    button,
    input {
      font-family: inherit;
    }

    .container {
      width: min(
        1180px,
        calc(100% - 32px)
      );
      margin: auto;
    }

    header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(15, 23, 42, .96);
      border-bottom:
        1px solid rgba(255,255,255,.08);
      backdrop-filter: blur(12px);
    }

    .nav {
      min-height: 74px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
      font-weight: 900;
      font-size: 20px;
      white-space: nowrap;
    }

    .brand-icon {
      width: 42px;
      height: 42px;
      border-radius: 13px;
      display: grid;
      place-items: center;
      background:
        linear-gradient(
          135deg,
          #2563eb,
          #14b8a6
        );
      color: white;
      box-shadow:
        0 8px 25px
        rgba(20,184,166,.25);
    }

    nav {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    nav a {
      color: #cbd5e1;
      padding: 8px 12px;
      border-radius: 10px;
      transition: .2s;
    }

    nav a:hover {
      background: rgba(255,255,255,.08);
      color: white;
    }

    main {
      min-height: 70vh;
    }

    .hero {
      width: min(
        1180px,
        calc(100% - 32px)
      );
      margin: 34px auto;
      padding: 48px;
      border-radius: 28px;

      background:
        radial-gradient(
          circle at 85% 20%,
          rgba(20,184,166,.28),
          transparent 35%
        ),
        linear-gradient(
          135deg,
          #0f172a,
          #1e3a8a
        );

      color: white;

      display: grid;
      grid-template-columns:
        1.35fr .65fr;

      gap: 35px;
      align-items: center;

      box-shadow:
        0 25px 60px
        rgba(15,23,42,.18);
    }

    .badge,
    .eyebrow {
      display: inline-block;
      color: #14b8a6;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: .3px;
    }

    .hero .badge {
      color: #67e8f9;
    }

    .hero h1 {
      margin: 12px 0;
      font-size:
        clamp(32px, 5vw, 58px);
      line-height: 1.25;
    }

    .hero h1 strong {
      display: block;
      color: #67e8f9;
    }

    .hero p {
      color: #dbeafe;
      max-width: 650px;
      font-size: 17px;
    }

    .hero-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 25px;
    }

    .hero-card {
      padding: 30px;
      border-radius: 24px;
      background:
        rgba(255,255,255,.10);
      border:
        1px solid rgba(255,255,255,.14);
    }

    .hero-icon {
      width: 65px;
      height: 65px;
      display: grid;
      place-items: center;
      border-radius: 20px;
      background: #14b8a6;
      font-size: 30px;
      margin-bottom: 20px;
    }

    .hero-card h3 {
      margin: 0 0 8px;
      font-size: 24px;
    }

    .hero-card p {
      margin: 0;
      font-size: 14px;
    }

    .section {
      width: min(
        1180px,
        calc(100% - 32px)
      );
      margin: 70px auto;
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 20px;
      margin-bottom: 25px;
    }

    .section-head h2,
    .page-title h1 {
      margin: 4px 0 0;
      font-size: 32px;
    }

    .text-link {
      color: #2563eb;
      font-weight: 800;
    }

    .products-grid {
      display: grid;
      grid-template-columns:
        repeat(3, minmax(0, 1fr));
      gap: 20px;
    }

    .product-card {
      overflow: hidden;
      background: white;
      border:
        1px solid #e2e8f0;
      border-radius: 20px;

      box-shadow:
        0 10px 30px
        rgba(15,23,42,.06);

      transition:
        transform .2s,
        box-shadow .2s;
    }

    .product-card:hover {
      transform: translateY(-4px);
      box-shadow:
        0 18px 40px
        rgba(15,23,42,.12);
    }

    .product-image {
      height: 190px;

      background:
        linear-gradient(
          135deg,
          #dbeafe,
          #ccfbf1
        );

      overflow: hidden;
    }

    .product-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .product-placeholder {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      color: #2563eb;
      font-size: 55px;
    }

    .product-placeholder.large {
      font-size: 100px;
    }

    .product-body {
      padding: 20px;
    }

    .product-category {
      color: #0f766e;
      font-size: 12px;
      font-weight: 900;
    }

    .product-body h3 {
      margin: 6px 0;
      font-size: 19px;
    }

    .product-body p {
      margin: 0 0 15px;
      color: #64748b;
      font-size: 14px;
      min-height: 50px;
    }

    .product-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
    }

    .product-bottom strong {
      color: #1e3a8a;
      font-size: 18px;
    }

    .stock {
      font-size: 12px;
      color: #0f766e;
      background: #ccfbf1;
      padding: 4px 9px;
      border-radius: 20px;
    }

    .product-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .btn {
      border: 0;
      cursor: pointer;
      display: inline-flex;
      justify-content: center;
      align-items: center;
      padding: 11px 17px;
      border-radius: 12px;
      font-weight: 800;
      transition: .2s;
    }

    .btn:hover {
      transform: translateY(-1px);
    }

    .btn.primary {
      background: #2563eb;
      color: white;
    }

    .btn.secondary {
      background: #1e3a8a;
      color: white;
    }

    .btn.orange {
      background: #f97316;
      color: white;
    }

    .btn.disabled {
      background: #94a3b8;
      color: white;
      cursor: not-allowed;
    }

    .btn.small {
      padding: 8px 11px;
      font-size: 12px;
    }

    .features {
      width: min(
        1180px,
        calc(100% - 32px)
      );
      margin: 70px auto;

      display: grid;
      grid-template-columns:
        repeat(4, minmax(0, 1fr));

      gap: 16px;
    }

    .feature {
      background: white;
      padding: 25px;
      border-radius: 20px;
      border:
        1px solid #e2e8f0;
    }

    .feature-icon {
      width: 45px;
      height: 45px;
      display: grid;
      place-items: center;
      border-radius: 13px;
      background: #dbeafe;
      color: #2563eb;
      font-weight: 900;
    }

    .feature h3 {
      margin: 13px 0 5px;
    }

    .feature p {
      margin: 0;
      color: #64748b;
      font-size: 14px;
    }

    .promo {
      width: min(
        1180px,
        calc(100% - 32px)
      );
      margin: 70px auto;
      padding: 35px;
      border-radius: 25px;

      background:
        linear-gradient(
          135deg,
          #0f766e,
          #0f172a
        );

      color: white;

      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .promo h2 {
      margin: 4px 0;
      font-size: 30px;
    }

    .promo p {
      color: #ccfbf1;
    }

    .page-title {
      width: min(
        1180px,
        calc(100% - 32px)
      );
      margin: 55px auto 30px;
    }

    .page-title p {
      color: #64748b;
    }

    .account-wrap {
      width: min(
        1000px,
        calc(100% - 32px)
      );
      margin: 50px auto;

      display: grid;
      grid-template-columns:
        1fr 1fr;

      gap: 22px;
    }

    .account-card {
      background: white;
      padding: 30px;
      border:
        1px solid #e2e8f0;
      border-radius: 22px;

      box-shadow:
        0 12px 35px
        rgba(15,23,42,.06);
    }

    .account-card h1 {
      margin-bottom: 5px;
    }

    .account-card > p {
      color: #64748b;
    }

    form {
      display: grid;
      gap: 9px;
      margin-top: 20px;
    }

    label {
      font-size: 13px;
      font-weight: 800;
    }

    input {
      width: 100%;
      padding: 13px 14px;
      border:
        1px solid #cbd5e1;
      border-radius: 12px;
      outline: none;
      background: white;
    }

    input:focus {
      border-color: #2563eb;
      box-shadow:
        0 0 0 3px
        rgba(37,99,235,.10);
    }

    .account-links {
      display: flex;
      gap: 15px;
      margin-top: 20px;
      flex-wrap: wrap;
    }

    .account-links a {
      color: #2563eb;
      font-size: 13px;
      font-weight: 800;
    }

    .cart-box {
      width: min(
        900px,
        calc(100% - 32px)
      );
      margin: 30px auto 70px;
      background: white;
      padding: 30px;
      border-radius: 22px;
      border:
        1px solid #e2e8f0;
    }

    .cart-total {
      margin-top: 25px;
      padding-top: 20px;
      border-top:
        1px solid #e2e8f0;

      display: flex;
      justify-content: space-between;
    }

    .cart-actions {
      display: flex;
      gap: 10px;
      margin-top: 25px;
      flex-wrap: wrap;
    }

    .empty {
      padding: 35px;
      text-align: center;
      background: white;
      border:
        1px dashed #cbd5e1;
      border-radius: 18px;
      color: #64748b;
    }

    .admin-grid {
      width: min(
        1180px,
        calc(100% - 32px)
      );
      margin: 30px auto 70px;

      display: grid;
      grid-template-columns:
        repeat(3, minmax(0, 1fr));

      gap: 18px;
    }

    .admin-card {
      padding: 25px;
      background: white;
      border:
        1px solid #e2e8f0;
      border-radius: 18px;
    }

    .admin-card strong,
    .admin-card span {
      display: block;
    }

    .admin-card span {
      color: #64748b;
      margin-top: 5px;
      font-size: 13px;
    }

    .product-detail {
      width: min(
        1100px,
        calc(100% - 32px)
      );
      margin: 50px auto 80px;

      display: grid;
      grid-template-columns:
        1fr 1fr;

      gap: 35px;
      align-items: center;
    }

    .detail-image {
      height: 450px;
      overflow: hidden;
      border-radius: 25px;

      background:
        linear-gradient(
          135deg,
          #dbeafe,
          #ccfbf1
        );

      display: grid;
      place-items: center;
    }

    .detail-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .detail-content {
      background: white;
      padding: 35px;
      border-radius: 25px;
      border:
        1px solid #e2e8f0;
    }

    .detail-content h1 {
      font-size: 34px;
      margin: 10px 0;
    }

    .detail-description {
      color: #64748b;
    }

    .detail-price {
      color: #f97316;
      font-size: 28px;
      font-weight: 900;
      margin: 25px 0 10px;
    }

    .detail-stock {
      color: #0f766e;
      margin-bottom: 20px;
    }

    footer {
      margin-top: 70px;
      background: #0f172a;
      color: #cbd5e1;
      padding: 40px 0;
    }

    .footer-inner {
      width: min(
        1180px,
        calc(100% - 32px)
      );
      margin: auto;

      display: flex;
      justify-content: space-between;
      gap: 25px;
      flex-wrap: wrap;
    }

    .footer-title {
      color: white;
      font-weight: 900;
      font-size: 20px;
    }

    .footer-note {
      font-size: 13px;
      color: #94a3b8;
    }

    @media (max-width: 850px) {

      .hero {
        grid-template-columns: 1fr;
        gap: 30px;
        padding: 30px 24px;
      }

      .products-grid {
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
      }

      .features {
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
      }

      .account-wrap {
        grid-template-columns: 1fr;
      }

      .admin-grid {
        grid-template-columns: 1fr;
      }

      .product-detail {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 600px) {

      .nav {
        padding: 10px 0;
        align-items: flex-start;
        flex-direction: column;
      }

      nav {
        width: 100%;
        overflow-x: auto;
        flex-wrap: nowrap;
      }

      nav a {
        white-space: nowrap;
      }

      .hero h1 {
        font-size: 34px;
      }

      .products-grid,
      .features {
        grid-template-columns: 1fr;
      }

      .section-head,
      .promo {
        align-items: flex-start;
        flex-direction: column;
      }

      .promo {
        padding: 28px 22px;
      }

      .detail-image {
        height: 300px;
      }

      .detail-content h1 {
        font-size: 28px;
      }
    }

  </style>

</head>


<body>

<header>

  <div class="container nav">

    <a class="brand" href="/">

      <span class="brand-icon">
        ◆
      </span>

      <span>
        ${STORE_NAME}
      </span>

    </a>

    <nav>

      <a href="/">
        خانه
      </a>

      <a href="/products">
        محصولات
      </a>

      <a href="/#features">
        امکانات
      </a>

      <a href="/account">
        حساب کاربری
      </a>

      <a href="/cart">
        🛒 سبد خرید
      </a>

      <a href="/admin">
        مدیریت
      </a>

    </nav>

  </div>

</header>


<main>
  ${content}
</main>


<footer>

  <div class="footer-inner">

    <div>

      <div class="footer-title">
        ${STORE_NAME}
      </div>

      <div class="footer-note">
        ${STORE_EN} — فروشگاه دیجیتال
      </div>

    </div>

    <div class="footer-note">
      © ${new Date().getFullYear()}
      ${STORE_NAME}
    </div>

  </div>

</footer>


<script>

  function getCart() {
    try {
      return JSON.parse(
        localStorage.getItem(
          "digimarixo_cart"
        ) || "[]"
      );
    } catch {
      return [];
    }
  }


  function saveCart(cart) {
    localStorage.setItem(
      "digimarixo_cart",
      JSON.stringify(cart)
    );
  }


  function addToCart(id, name, price) {

    const cart = getCart();

    const existing = cart.find(
      item =>
        Number(item.id) === Number(id)
    );

    if (existing) {

      existing.quantity += 1;

    } else {

      cart.push({
        id: Number(id),
        name: name,
        price: Number(price),
        quantity: 1
      });

    }

    saveCart(cart);

    renderCart();

    alert(
      "محصول به سبد خرید اضافه شد."
    );
  }


  function formatNumber(value) {
    return Number(
      value || 0
    ).toLocaleString("fa-IR");
  }


  function renderCart() {

    const box =
      document.getElementById(
        "cart-items"
      );

    const totalBox =
      document.getElementById(
        "cart-total"
      );

    if (!box || !totalBox) {
      return;
    }

    const cart = getCart();

    if (!cart.length) {

      box.innerHTML =
        '<div class="empty">' +
        'سبد خرید شما خالی است.' +
        '</div>';

      totalBox.textContent =
        "۰ تومان";

      return;
    }

    let total = 0;

    box.innerHTML =
      cart.map(
        function(item, index) {

          const line =
            Number(item.price || 0) *
            Number(item.quantity || 1);

          total += line;

          return `
            <div
              style="
                padding:15px 0;
                border-bottom:1px solid #e2e8f0;
                display:flex;
                justify-content:space-between;
                gap:15px;
                align-items:center
              "
            >

              <div>

                <strong>
                  ${escapeClientHTML(
                    item.name
                  )}
                </strong>

                <div
                  style="
                    color:#64748b;
                    font-size:13px
                  "
                >
                  تعداد:
                  ${formatNumber(
                    item.quantity
                  )}
                </div>

              </div>

              <div style="text-align:left">

                <strong>
                  ${formatNumber(line)}
                  تومان
                </strong>

                <br>

                <button
                  class="btn small orange"
                  onclick="removeCartItem(${index})"
                >
                  حذف
                </button>

              </div>

            </div>
          `;
        }
      ).join("");

    totalBox.textContent =
      formatNumber(total) +
      " تومان";
  }


  function removeCartItem(index) {

    const cart = getCart();

    cart.splice(index, 1);

    saveCart(cart);

    renderCart();
  }


  async function checkoutCart() {

    const cart = getCart();

    if (!cart.length) {
      alert(
        "سبد خرید شما خالی است."
      );
      return;
    }

    const customerName =
      prompt("نام و نام خانوادگی:");

    if (!customerName) {
      return;
    }

    const customerPhone =
      prompt("شماره تماس:");

    const customerEmail =
      prompt("ایمیل:");

    const address =
      prompt("آدرس:");

    try {

      const response =
        await fetch(
          "/api/orders",
          {
            method: "POST",
            headers: {
              "content-type":
                "application/json"
            },
            body: JSON.stringify({
              customer_name:
                customerName,
              customer_phone:
                customerPhone || "",
              customer_email:
                customerEmail || "",
              address:
                address || "",
              items:
                cart.map(item => ({
                  product_id:
                    Number(item.id),
                  quantity:
                    Number(
                      item.quantity || 1
                    )
                }))
            })
          }
        );

      const result =
        await response.json();

      if (!result.ok) {

        alert(
          result.error ||
          "ثبت سفارش انجام نشد."
        );

        return;
      }

      localStorage.removeItem(
        "digimarixo_cart"
      );

      renderCart();

      alert(
        "سفارش با موفقیت ثبت شد. شماره سفارش: " +
        result.order_id
      );

    } catch (error) {

      alert(
        "خطا در ثبت سفارش."
      );

      console.error(error);
    }
  }


  function escapeClientHTML(value) {

    return String(
      value ?? ""
    )
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  renderCart();

</script>


</body>
</html>
  `;
}


/* =========================================================
   RESPONSE HELPERS
========================================================= */

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


/* =========================================================
   HELPERS
========================================================= */

/*
  FIX:
  جلوگیری از نمایش NaN تومان
  و پشتیبانی از اعداد فارسی و عربی
*/

function formatPrice(value) {
  const normalized = String(value ?? "")
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[,\s٬،]/g, "");

  const number = Number(normalized);

  return (
    (Number.isFinite(number) ? number : 0)
      .toLocaleString("fa-IR") +
    " تومان"
  );
}


function formatNumber(value) {
  return Number(
    value || 0
  ).toLocaleString("fa-IR");
}


function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function escapeAttr(value) {
  return escapeHTML(value);
}


function escapeJS(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r");
}


function safeError(error) {

  if (!error) {
    return "خطای ناشناخته";
  }

  if (error.message) {
    return String(error.message);
  }

  return String(error);
      }
