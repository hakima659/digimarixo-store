const STORE_NAME = "دیجی‌ماریکسو";
const STORE_EN = "DigiMarixo";
const DEFAULT_ADMIN_USERNAME = "admin";

const COLORS = {
  navy: "#0f172a",
  blue: "#1e3a8a",
  blue2: "#2563eb",
  teal: "#0f766e",
  cyan: "#14b8a6",
  orange: "#f97316",
  orange2: "#fb923c",
  bg: "#f4f7fb",
  white: "#ffffff",
  text: "#172033",
  muted: "#64748b",
  border: "#e2e8f0",
  success: "#16a34a",
  danger: "#dc2626"
};

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

      if (path === "/health" && method === "GET") {
        return json({
          ok: true,
          store: STORE_EN,
          database: !!env.DB
        });
      }

      if (path === "/api/products" && method === "GET") {
        return json(await getProducts(env));
      }

      if (path.startsWith("/api/products/") && method === "GET") {
        const id = path.split("/").pop();
        return json(await getProduct(env, id));
      }

      if (path === "/api/categories" && method === "GET") {
        return json(await getCategories(env));
      }

      if (path === "/api/register" && method === "POST") {
        return await registerUser(request, env);
      }

      if (path === "/api/login" && method === "POST") {
        return await loginUser(request, env);
      }

      if (path === "/api/order" && method === "POST") {
        return await createOrder(request, env);
      }

      if (path === "/api/admin/login" && method === "POST") {
        return await adminLogin(request, env);
      }

      if (path === "/api/admin/products" && method === "POST") {
        return await adminCreateProduct(request, env);
      }

      if (path === "/api/admin/products" && method === "PUT") {
        return await adminUpdateProduct(request, env);
      }

      if (path === "/api/admin/products" && method === "DELETE") {
        return await adminDeleteProduct(request, env);
      }

      if (path === "/api/admin/orders" && method === "GET") {
        return await adminOrders(env);
      }

      if (path === "/admin" && method === "GET") {
        return html(adminPage());
      }

      if (path === "/account" && method === "GET") {
        return html(accountPage());
      }

      if (path === "/products" && method === "GET") {
        return html(productsPage());
      }

      if (path === "/cart" && method === "GET") {
        return html(cartPage());
      }

      if (path === "/about" && method === "GET") {
        return html(infoPage(
          "درباره دیجی‌ماریکسو",
          "دیجی‌ماریکسو یک فروشگاه آنلاین برای ارائه محصولات دیجیتال و خدمات مرتبط است."
        ));
      }

      if (path === "/contact" && method === "GET") {
        return html(infoPage(
          "تماس با ما",
          "برای ارتباط با دیجی‌ماریکسو می‌توانید از راه‌های ارتباطی اعلام‌شده در فروشگاه استفاده کنید."
        ));
      }

      if (path === "/terms" && method === "GET") {
        return html(infoPage(
          "قوانین و شرایط",
          "استفاده از خدمات دیجی‌ماریکسو به معنی پذیرش قوانین و شرایط فروشگاه است."
        ));
      }

      if (path === "/privacy" && method === "GET") {
        return html(infoPage(
          "حریم خصوصی",
          "اطلاعات کاربران فقط برای ارائه خدمات فروشگاه و مدیریت سفارش‌ها استفاده می‌شود."
        ));
      }

      if (path === "/" && method === "GET") {
        return html(homePage());
      }

      return html(notFoundPage(), 404);

    } catch (error) {
      return html(errorPage(error), 500);
    }
  }
};


/* =========================================================
   DATABASE
========================================================= */

async function initDB(env) {
  if (!env.DB) {
    throw new Error("D1 binding DB is not connected.");
  }

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      description TEXT,
      price INTEGER DEFAULT 0,
      image TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  /*
    مهم:
    جدول products ممکن است از نسخه قبلی وجود داشته باشد.
    بنابراین ابتدا ستون‌های واقعی را می‌خوانیم و فقط ستون‌های
    گمشده را اضافه می‌کنیم.
  */

  const columns = await env.DB
    .prepare(`PRAGMA table_info(products)`)
    .all();

  const existing = new Set(
    (columns.results || []).map(row => String(row.name).toLowerCase())
  );

  const migrations = [];

  if (!existing.has("category")) {
    migrations.push(
      env.DB.prepare(
        `ALTER TABLE products ADD COLUMN category TEXT DEFAULT 'عمومی'`
      ).run()
    );
  }

  if (!existing.has("stock")) {
    migrations.push(
      env.DB.prepare(
        `ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0`
      ).run()
    );
  }

  if (!existing.has("description")) {
    migrations.push(
      env.DB.prepare(
        `ALTER TABLE products ADD COLUMN description TEXT DEFAULT ''`
      ).run()
    );
  }

  if (!existing.has("price")) {
    migrations.push(
      env.DB.prepare(
        `ALTER TABLE products ADD COLUMN price INTEGER DEFAULT 0`
      ).run()
    );
  }

  if (!existing.has("image")) {
    migrations.push(
      env.DB.prepare(
        `ALTER TABLE products ADD COLUMN image TEXT DEFAULT ''`
      ).run()
    );
  }

  if (migrations.length) {
    await Promise.all(migrations);
  }

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      customer_name TEXT,
      customer_email TEXT,
      total INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      product_id INTEGER,
      product_name TEXT,
      price INTEGER DEFAULT 0,
      quantity INTEGER DEFAULT 1
    )
  `).run();

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
      created_at
    FROM products
    ORDER BY id DESC
  `).all();

  return {
    ok: true,
    products: result.results || []
  };
}

async function getProduct(env, id) {
  const product = await env.DB
    .prepare(`
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
      WHERE id = ?
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

async function getCategories(env) {
  const result = await env.DB.prepare(`
    SELECT DISTINCT category
    FROM products
    WHERE category IS NOT NULL
      AND category != ''
    ORDER BY category
  `).all();

  return {
    ok: true,
    categories: result.results || []
  };
}


/* =========================================================
   USERS
========================================================= */

async function registerUser(request, env) {
  const body = await request.json();

  const username = String(body.username || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!username || !email || !password) {
    return json({
      ok: false,
      error: "همه فیلدها را کامل کنید."
    }, 400);
  }

  if (password.length < 4) {
    return json({
      ok: false,
      error: "رمز عبور باید حداقل ۴ کاراکتر باشد."
    }, 400);
  }

  const exists = await env.DB.prepare(`
    SELECT id
    FROM users
    WHERE username = ? OR email = ?
    LIMIT 1
  `).bind(username, email).first();

  if (exists) {
    return json({
      ok: false,
      error: "نام کاربری یا ایمیل قبلاً ثبت شده است."
    }, 409);
  }

  const result = await env.DB.prepare(`
    INSERT INTO users (username, email, password)
    VALUES (?, ?, ?)
  `).bind(username, email, password).run();

  return json({
    ok: true,
    user_id: result.meta.last_row_id,
    message: "حساب کاربری با موفقیت ایجاد شد."
  });
}

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

  const user = await env.DB.prepare(`
    SELECT id, username, email
    FROM users
    WHERE (username = ? OR email = ?)
      AND password = ?
    LIMIT 1
  `).bind(login, login.toLowerCase(), password).first();

  if (!user) {
    return json({
      ok: false,
      error: "اطلاعات ورود صحیح نیست."
    }, 401);
  }

  return json({
    ok: true,
    user
  });
}


/* =========================================================
   ORDERS
========================================================= */

async function createOrder(request, env) {
  const body = await request.json();

  const userId = body.user_id || null;
  const customerName = String(body.customer_name || "").trim();
  const customerEmail = String(body.customer_email || "").trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!customerName || !customerEmail || !items.length) {
    return json({
      ok: false,
      error: "اطلاعات سفارش کامل نیست."
    }, 400);
  }

  let total = 0;
  const finalItems = [];

  for (const item of items) {
    const productId = Number(item.product_id);
    const quantity = Math.max(1, Number(item.quantity || 1));

    const product = await env.DB.prepare(`
      SELECT id, name, price, stock
      FROM products
      WHERE id = ?
    `).bind(productId).first();

    if (!product) {
      continue;
    }

    if (Number(product.stock || 0) > 0 &&
        Number(product.stock) < quantity) {
      return json({
        ok: false,
        error: `موجودی محصول «${product.name}» کافی نیست.`
      }, 400);
    }

    const price = Number(product.price || 0);
    total += price * quantity;

    finalItems.push({
      product_id: product.id,
      product_name: product.name,
      price,
      quantity
    });
  }

  if (!finalItems.length) {
    return json({
      ok: false,
      error: "محصول معتبری در سفارش وجود ندارد."
    }, 400);
  }

  const order = await env.DB.prepare(`
    INSERT INTO orders
    (user_id, customer_name, customer_email, total, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).bind(
    userId,
    customerName,
    customerEmail,
    total
  ).run();

  const orderId = order.meta.last_row_id;

  for (const item of finalItems) {
    await env.DB.prepare(`
      INSERT INTO order_items
      (order_id, product_id, product_name, price, quantity)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      orderId,
      item.product_id,
      item.product_name,
      item.price,
      item.quantity
    ).run();
  }

  return json({
    ok: true,
    order_id: orderId,
    total
  });
}


/* =========================================================
   ADMIN
========================================================= */

async function adminLogin(request, env) {
  const body = await request.json();

  const username = String(body.username || "");
  const password = String(body.password || "");

  const adminPassword = env.ADMIN_PASSWORD || "";

  if (
    username === DEFAULT_ADMIN_USERNAME &&
    adminPassword &&
    password === adminPassword
  ) {
    return json({
      ok: true,
      message: "ورود مدیر موفق بود."
    });
  }

  return json({
    ok: false,
    error: "نام کاربری یا رمز مدیریت اشتباه است."
  }, 401);
}

async function adminCreateProduct(request, env) {
  const body = await request.json();

  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();
  const price = Number(body.price || 0);
  const image = String(body.image || "").trim();
  const category = String(body.category || "عمومی").trim();
  const stock = Number(body.stock || 0);

  if (!name) {
    return json({
      ok: false,
      error: "نام محصول الزامی است."
    }, 400);
  }

  const result = await env.DB.prepare(`
    INSERT INTO products
    (name, description, price, image, category, stock)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    name,
    description,
    price,
    image,
    category,
    stock
  ).run();

  return json({
    ok: true,
    id: result.meta.last_row_id
  });
}

async function adminUpdateProduct(request, env) {
  const body = await request.json();

  const id = Number(body.id);

  if (!id) {
    return json({
      ok: false,
      error: "شناسه محصول نامعتبر است."
    }, 400);
  }

  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();
  const price = Number(body.price || 0);
  const image = String(body.image || "").trim();
  const category = String(body.category || "عمومی").trim();
  const stock = Number(body.stock || 0);

  await env.DB.prepare(`
    UPDATE products
    SET
      name = ?,
      description = ?,
      price = ?,
      image = ?,
      category = ?,
      stock = ?
    WHERE id = ?
  `).bind(
    name,
    description,
    price,
    image,
    category,
    stock,
    id
  ).run();

  return json({
    ok: true,
    message: "محصول بروزرسانی شد."
  });
}

async function adminDeleteProduct(request, env) {
  const body = await request.json();
  const id = Number(body.id);

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

async function adminOrders(env) {
  const result = await env.DB.prepare(`
    SELECT *
    FROM orders
    ORDER BY id DESC
  `).all();

  return json({
    ok: true,
    orders: result.results || []
  });
}


/* =========================================================
   HOME PAGE
========================================================= */

function homePage() {
  return pageShell(
    "خانه",
    `
    <section class="hero">
      <div class="hero-content">
        <div class="badge">فروشگاه آنلاین ${STORE_EN}</div>

        <h1>
          خرید آسان و مطمئن از
          <span>دیجی‌ماریکسو</span>
        </h1>

        <p>
          محصولات دیجیتال و خدمات مورد نیازت را
          در یک فروشگاه ساده، سریع و حرفه‌ای پیدا کن.
        </p>

        <div class="hero-actions">
          <a class="btn btn-primary" href="/products">
            مشاهده محصولات
          </a>

          <a class="btn btn-outline" href="/account">
            حساب کاربری
          </a>
        </div>
      </div>

      <div class="hero-card">
        <div class="hero-icon">🛒</div>
        <h3>${STORE_NAME}</h3>
        <p>خرید ساده، سریع و آنلاین</p>

        <div class="mini-stat">
          <strong>24/7</strong>
          <span>دسترسی آنلاین</span>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-title">
        <span>دسته‌بندی</span>
        <h2>همه‌چیز مرتب و ساده</h2>
        <p>محصولات فروشگاه را بر اساس نیازت بررسی کن.</p>
      </div>

      <div class="feature-grid">
        <div class="feature-card">
          <div class="feature-icon blue">💻</div>
          <h3>محصولات دیجیتال</h3>
          <p>محصولات و خدمات دیجیتال در یک محیط ساده.</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon teal">⚡</div>
          <h3>دسترسی سریع</h3>
          <p>دسترسی آسان به محصولات و حساب کاربری.</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon orange">🛍️</div>
          <h3>خرید آنلاین</h3>
          <p>انتخاب محصول و مدیریت سفارش‌ها از یکجا.</p>
        </div>
      </div>
    </section>

    <section class="section products-section">
      <div class="section-title">
        <span>محصولات</span>
        <h2>محصولات فروشگاه</h2>
        <p>آخرین محصولات اضافه‌شده را ببین.</p>
      </div>

      <div id="products" class="product-grid">
        <div class="loading">در حال دریافت محصولات...</div>
      </div>
    </section>

    <section class="promo">
      <div>
        <small>${STORE_EN}</small>
        <h2>فروشگاه دیجیتال خودت را ساده‌تر مدیریت کن.</h2>
        <p>محصولات، سفارش‌ها و حساب کاربری در یک محیط یکپارچه.</p>
      </div>

      <a class="btn btn-light" href="/products">
        ورود به فروشگاه
      </a>
    </section>

    <script>
      loadProducts();
    </script>
    `
  );
}


/* =========================================================
   PRODUCTS PAGE
========================================================= */

function productsPage() {
  return pageShell(
    "محصولات",
    `
    <section class="page-header">
      <div>
        <span>فروشگاه ${STORE_EN}</span>
        <h1>محصولات دیجی‌ماریکسو</h1>
        <p>محصول مورد نظرت را انتخاب کن.</p>
      </div>
    </section>

    <section class="section">
      <div id="products" class="product-grid">
        <div class="loading">در حال دریافت محصولات...</div>
      </div>
    </section>

    <script>
      loadProducts();
    </script>
    `
  );
}


/* =========================================================
   ACCOUNT PAGE
========================================================= */

function accountPage() {
  return pageShell(
    "حساب کاربری",
    `
    <section class="account-wrap">

      <div class="account-card">
        <div class="account-icon">👤</div>

        <h1>حساب کاربری</h1>
        <p>مدیریت حساب و سفارش‌های دیجی‌ماریکسو</p>

        <div id="loginBox">
          <h3>ورود</h3>

          <input
            id="login"
            placeholder="نام کاربری یا ایمیل"
          />

          <input
            id="loginPassword"
            type="password"
            placeholder="رمز عبور"
          />

          <button class="btn btn-primary full" onclick="login()">
            ورود
          </button>

          <div id="loginMessage" class="message"></div>
        </div>

        <hr>

        <div>
          <h3>ثبت‌نام</h3>

          <input
            id="registerUsername"
            placeholder="نام کاربری"
          />

          <input
            id="registerEmail"
            type="email"
            placeholder="ایمیل"
          />

          <input
            id="registerPassword"
            type="password"
            placeholder="رمز عبور"
          />

          <button class="btn btn-teal full" onclick="register()">
            ایجاد حساب
          </button>

          <div id="registerMessage" class="message"></div>
        </div>

        <a class="back-link" href="/">
          بازگشت به فروشگاه
        </a>
      </div>

    </section>

    <script>
      async function register() {
        const data = {
          username: document.getElementById("registerUsername").value,
          email: document.getElementById("registerEmail").value,
          password: document.getElementById("registerPassword").value
        };

        const box = document.getElementById("registerMessage");

        try {
          const response = await fetch("/api/register", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data)
          });

          const result = await response.json();

          box.textContent = result.ok
            ? "حساب با موفقیت ساخته شد."
            : result.error;

          box.className = result.ok
            ? "message success"
            : "message error";
        } catch {
          box.textContent = "خطا در ارتباط با سرور.";
          box.className = "message error";
        }
      }

      async function login() {
        const data = {
          login: document.getElementById("login").value,
          password: document.getElementById("loginPassword").value
        };

        const box = document.getElementById("loginMessage");

        try {
          const response = await fetch("/api/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(data)
          });

          const result = await response.json();

          if (result.ok) {
            localStorage.setItem(
              "digimarixo_user",
              JSON.stringify(result.user)
            );

            box.textContent =
              "ورود موفق بود. خوش آمدید " +
              result.user.username;

            box.className = "message success";
          } else {
            box.textContent = result.error;
            box.className = "message error";
          }
        } catch {
          box.textContent = "خطا در ارتباط با سرور.";
          box.className = "message error";
        }
      }
    </script>
    `
  );
}


/* =========================================================
   CART PAGE
========================================================= */

function cartPage() {
  return pageShell(
    "سبد خرید",
    `
    <section class="page-header">
      <div>
        <span>سبد خرید</span>
        <h1>سبد خرید شما</h1>
        <p>محصولات انتخاب‌شده را بررسی کنید.</p>
      </div>
    </section>

    <section class="section">
      <div id="cart" class="cart-box"></div>
    </section>

    <script>
      renderCart();
    </script>
    `
  );
}


/* =========================================================
   ADMIN PAGE
========================================================= */

function adminPage() {
  return pageShell(
    "مدیریت",
    `
    <section class="admin-wrap">

      <div class="admin-card" id="adminLogin">
        <div class="account-icon">🔐</div>

        <h1>مدیریت فروشگاه</h1>
        <p>ورود مدیر دیجی‌ماریکسو</p>

        <input id="adminUsername" value="admin" placeholder="نام کاربری">

        <input
          id="adminPassword"
          type="password"
          placeholder="رمز مدیریت"
        >

        <button class="btn btn-primary full" onclick="adminLogin()">
          ورود مدیریت
        </button>

        <div id="adminMessage" class="message"></div>
      </div>

      <div id="adminPanel" class="admin-panel hidden">

        <div class="admin-header">
          <div>
            <span>پنل مدیریت</span>
            <h1>مدیریت دیجی‌ماریکسو</h1>
          </div>

          <button class="btn btn-outline" onclick="loadAdminOrders()">
            سفارش‌ها
          </button>
        </div>

        <div class="admin-grid">

          <div class="admin-form">
            <h2>افزودن محصول</h2>

            <input id="pName" placeholder="نام محصول">

            <textarea
              id="pDescription"
              placeholder="توضیحات محصول"
            ></textarea>

            <input
              id="pPrice"
              type="number"
              placeholder="قیمت"
            >

            <input
              id="pCategory"
              placeholder="دسته‌بندی"
              value="عمومی"
            >

            <input
              id="pStock"
              type="number"
              placeholder="موجودی"
              value="0"
            >

            <input
              id="pImage"
              placeholder="آدرس تصویر"
            >

            <button
              class="btn btn-teal full"
              onclick="createProduct()"
            >
              افزودن محصول
            </button>

            <div id="productMessage" class="message"></div>
          </div>

          <div>
            <h2>محصولات</h2>
            <div id="adminProducts"></div>
          </div>

        </div>

        <div id="adminOrders"></div>

      </div>
    </section>

    <script>
      async function adminLogin() {
        const username =
          document.getElementById("adminUsername").value;

        const password =
          document.getElementById("adminPassword").value;

        const box =
          document.getElementById("adminMessage");

        const response = await fetch("/api/admin/login", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({username, password})
        });

        const result = await response.json();

        if (!result.ok) {
          box.textContent = result.error;
          box.className = "message error";
          return;
        }

        document
          .getElementById("adminLogin")
          .classList.add("hidden");

        document
          .getElementById("adminPanel")
          .classList.remove("hidden");

        loadAdminProducts();
      }

      async function loadAdminProducts() {
        const response =
          await fetch("/api/products");

        const data =
          await response.json();

        const box =
          document.getElementById("adminProducts");

        box.innerHTML = "";

        for (const p of data.products || []) {
          box.innerHTML += \`
            <div class="admin-product">
              <strong>\${escapeHtml(p.name)}</strong>

              <span>
                \${formatPrice(p.price)}
              </span>

              <small>
                دسته: \${escapeHtml(p.category || "عمومی")}
                |
                موجودی: \${Number(p.stock || 0)}
              </small>
            </div>
          \`;
        }

        if (!data.products.length) {
          box.innerHTML =
            '<div class="empty">هنوز محصولی ثبت نشده است.</div>';
        }
      }

      async function createProduct() {
        const body = {
          name: document.getElementById("pName").value,
          description:
            document.getElementById("pDescription").value,
          price:
            Number(document.getElementById("pPrice").value || 0),
          category:
            document.getElementById("pCategory").value,
          stock:
            Number(document.getElementById("pStock").value || 0),
          image:
            document.getElementById("pImage").value
        };

        const response =
          await fetch("/api/admin/products", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(body)
          });

        const result =
          await response.json();

        const box =
          document.getElementById("productMessage");

        box.textContent =
          result.ok
            ? "محصول با موفقیت اضافه شد."
            : result.error;

        box.className =
          result.ok
            ? "message success"
            : "message error";

        if (result.ok) {
          loadAdminProducts();
        }
      }

      async function loadAdminOrders() {
        const response =
          await fetch("/api/admin/orders");

        const data =
          await response.json();

        const box =
          document.getElementById("adminOrders");

        box.innerHTML =
          '<h2 style="margin-top:35px">سفارش‌ها</h2>';

        for (const order of data.orders || []) {
          box.innerHTML += \`
            <div class="order-item">
              <strong>سفارش #\${order.id}</strong>
              <span>\${formatPrice(order.total)}</span>
              <small>
                \${escapeHtml(order.customer_name)}
                -
                \${escapeHtml(order.customer_email)}
                -
                وضعیت: \${escapeHtml(order.status)}
              </small>
            </div>
          \`;
        }

        if (!data.orders.length) {
          box.innerHTML +=
            '<div class="empty">هنوز سفارشی ثبت نشده است.</div>';
        }
      }
    </script>
    `
  );
}


/* =========================================================
   INFO
========================================================= */

function infoPage(title, text) {
  return pageShell(
    title,
    `
    <section class="info-page">
      <span>${STORE_EN}</span>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(text)}</p>

      <a class="btn btn-primary" href="/">
        بازگشت به فروشگاه
      </a>
    </section>
    `
  );
}


/* =========================================================
   HTML SHELL
========================================================= */

function pageShell(title, content) {
  return `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport"
        content="width=device-width, initial-scale=1.0">

  <title>${escapeHtml(title)} | ${STORE_NAME}</title>

  <meta
    name="description"
    content="فروشگاه آنلاین ${STORE_NAME} - ${STORE_EN}"
  >

  <meta name="theme-color" content="${COLORS.navy}">

  <style>
    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      background: ${COLORS.bg};
      color: ${COLORS.text};
      font-family:
        Tahoma,
        Arial,
        sans-serif;
      line-height: 1.8;
    }

    a {
      color: inherit;
      text-decoration: none;
    }

    button,
    input,
    textarea {
      font-family: inherit;
    }

    .container {
      width: min(1180px, calc(100% - 32px));
      margin: auto;
    }

    /* HEADER */

    header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(15, 23, 42, .97);
      box-shadow:
        0 8px 30px rgba(15, 23, 42, .15);
    }

    .nav {
      min-height: 74px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      width: min(1180px, calc(100% - 32px));
      margin: auto;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
      font-weight: 900;
      font-size: 19px;
    }

    .brand-logo {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background:
        linear-gradient(
          135deg,
          ${COLORS.orange},
          ${COLORS.orange2}
        );
      box-shadow:
        0 8px 20px rgba(249,115,22,.3);
    }

    nav {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    nav a {
      color: #dbeafe;
      padding: 8px 12px;
      border-radius: 10px;
      font-size: 14px;
    }

    nav a:hover {
      background: rgba(255,255,255,.1);
      color: white;
    }

    .nav-cart {
      background: ${COLORS.orange};
      color: white !important;
    }

    /* HERO */

    .hero {
      width: min(1180px, calc(100% - 32px));
      margin: 45px auto 25px;
      min-height: 440px;
      padding: 55px;
      border-radius: 30px;
      background:
        radial-gradient(
          circle at 80% 20%,
          rgba(37,99,235,.45),
          transparent 35%
        ),
        linear-gradient(
          135deg,
          ${COLORS.navy},
          ${COLORS.blue}
        );
      color: white;
      display: grid;
      grid-template-columns: 1.4fr .8fr;
      gap: 35px;
      align-items: center;
      overflow: hidden;
    }

    .badge {
      display: inline-block;
      padding: 6px 13px;
      border-radius: 999px;
      background: rgba(20,184,166,.18);
      color: #99f6e4;
      border: 1px solid rgba(153,246,228,.2);
      font-size: 13px;
      margin-bottom: 15px;
    }

    .hero h1 {
      margin: 0;
      font-size: clamp(32px, 5vw, 54px);
      line-height: 1.35;
    }

    .hero h1 span {
      color: #fb923c;
    }

    .hero p {
      color: #cbd5e1;
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
      padding: 35px;
      border-radius: 25px;
      background: rgba(255,255,255,.09);
      border: 1px solid rgba(255,255,255,.12);
      backdrop-filter: blur(10px);
    }

    .hero-card h3 {
      font-size: 24px;
      margin: 10px 0;
    }

    .hero-card p {
      font-size: 14px;
    }

    .hero-icon {
      font-size: 55px;
    }

    .mini-stat {
      margin-top: 25px;
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,.15);
      display: flex;
      justify-content: space-between;
      gap: 15px;
    }

    .mini-stat strong {
      color: #99f6e4;
    }

    /* BUTTONS */

    .btn {
      border: 0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 45px;
      padding: 9px 18px;
      border-radius: 12px;
      font-weight: 800;
      transition: .2s;
    }

    .btn:hover {
      transform: translateY(-2px);
    }

    .btn-primary {
      background: ${COLORS.blue2};
      color: white;
    }

    .btn-teal {
      background: ${COLORS.teal};
      color: white;
    }

    .btn-orange {
      background: ${COLORS.orange};
      color: white;
    }

    .btn-outline {
      border: 1px solid ${COLORS.border};
      background: white;
      color: ${COLORS.navy};
    }

    .hero .btn-outline {
      background: transparent;
      color: white;
      border-color: rgba(255,255,255,.25);
    }

    .btn-light {
      background: white;
      color: ${COLORS.navy};
    }

    .full {
      width: 100%;
    }

    /* SECTIONS */

    .section {
      width: min(1180px, calc(100% - 32px));
      margin: 70px auto;
    }

    .section-title {
      margin-bottom: 28px;
    }

    .section-title > span,
    .page-header span,
    .info-page > span,
    .admin-header span {
      color: ${COLORS.teal};
      font-size: 13px;
      font-weight: 900;
    }

    .section-title h2 {
      margin: 5px 0;
      font-size: 30px;
    }

    .section-title p {
      color: ${COLORS.muted};
      margin: 0;
    }

    /* FEATURES */

    .feature-grid {
      display: grid;
      grid-template-columns:
        repeat(3, 1fr);
      gap: 20px;
    }

    .feature-card {
      background: white;
      border: 1px solid ${COLORS.border};
      border-radius: 20px;
      padding: 28px;
      box-shadow:
        0 10px 35px rgba(15,23,42,.05);
    }

    .feature-card h3 {
      margin-bottom: 5px;
    }

    .feature-card p {
      color: ${COLORS.muted};
      font-size: 14px;
      margin: 0;
    }

    .feature-icon {
      width: 52px;
      height: 52px;
      display: grid;
      place-items: center;
      border-radius: 15px;
      font-size: 25px;
      margin-bottom: 15px;
    }

    .feature-icon.blue {
      background: #dbeafe;
    }

    .feature-icon.teal {
      background: #ccfbf1;
    }

    .feature-icon.orange {
      background: #ffedd5;
    }

    /* PRODUCTS */

    .product-grid {
      display: grid;
      grid-template-columns:
        repeat(3, 1fr);
      gap: 20px;
    }

    .product-card {
      background: white;
      border-radius: 20px;
      border: 1px solid ${COLORS.border};
      overflow: hidden;
      box-shadow:
        0 10px 30px rgba(15,23,42,.05);
      transition: .2s;
    }

    .product-card:hover {
      transform: translateY(-4px);
      box-shadow:
        0 16px 35px rgba(15,23,42,.1);
    }

    .product-image {
      height: 190px;
      display: grid;
      place-items: center;
      background:
        linear-gradient(
          135deg,
          #e0f2fe,
          #dbeafe
        );
      overflow: hidden;
    }

    .product-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .product-placeholder {
      font-size: 55px;
    }

    .product-body {
      padding: 20px;
    }

    .product-category {
      color: ${COLORS.teal};
      font-size: 12px;
      font-weight: bold;
    }

    .product-body h3 {
      margin: 5px 0;
      font-size: 19px;
    }

    .product-body p {
      color: ${COLORS.muted};
      font-size: 13px;
      min-height: 48px;
    }

    .product-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-top: 15px;
    }

    .price {
      font-weight: 900;
      color: ${COLORS.navy};
    }

    .price small {
      font-size: 11px;
      color: ${COLORS.muted};
    }

    .loading,
    .empty {
      grid-column: 1 / -1;
      background: white;
      padding: 35px;
      border-radius: 18px;
      text-align: center;
      color: ${COLORS.muted};
      border: 1px solid ${COLORS.border};
    }

    /* PROMO */

    .promo {
      width: min(1180px, calc(100% - 32px));
      margin: 70px auto;
      padding: 38px;
      border-radius: 25px;
      color: white;
      background:
        linear-gradient(
          135deg,
          ${COLORS.teal},
          ${COLORS.blue2}
        );
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 25px;
    }

    .promo h2 {
      margin: 4px 0;
    }

    .promo p {
      margin: 0;
      color: #dbeafe;
    }

    /* PAGE HEADER */

    .page-header {
      width: min(1180px, calc(100% - 32px));
      margin: 45px auto 0;
      padding: 35px;
      border-radius: 25px;
      background:
        linear-gradient(
          135deg,
          ${COLORS.navy},
          ${COLORS.blue}
        );
      color: white;
    }

    .page-header span {
      color: #99f6e4;
    }

    .page-header h1 {
      margin: 5px 0;
      font-size: 36px;
    }

    .page-header p {
      margin: 0;
      color: #cbd5e1;
    }

    /* ACCOUNT */

    .account-wrap,
    .admin-wrap {
      width: min(1050px, calc(100% - 32px));
      margin: 55px auto;
    }

    .account-card {
      width: min(520px, 100%);
      margin: auto;
      padding: 35px;
      background: white;
      border: 1px solid ${COLORS.border};
      border-radius: 25px;
      box-shadow:
        0 15px 45px rgba(15,23,42,.07);
    }

    .account-card h1 {
      margin: 8px 0 0;
    }

    .account-card > p {
      color: ${COLORS.muted};
    }

    .account-icon {
      width: 62px;
      height: 62px;
      border-radius: 18px;
      display: grid;
      place-items: center;
      background: #dbeafe;
      font-size: 30px;
    }

    input,
    textarea {
      width: 100%;
      border: 1px solid ${COLORS.border};
      border-radius: 12px;
      padding: 12px 14px;
      outline: none;
      margin: 7px 0;
      background: #fff;
      color: ${COLORS.text};
      font-size: 14px;
    }

    input:focus,
    textarea:focus {
      border-color: ${COLORS.blue2};
      box-shadow:
        0 0 0 3px rgba(37,99,235,.1);
    }

    textarea {
      min-height: 110px;
      resize: vertical;
    }

    hr {
      border: 0;
      border-top: 1px solid ${COLORS.border};
      margin: 30px 0;
    }

    .back-link {
      display: block;
      text-align: center;
      color: ${COLORS.blue2};
      margin-top: 20px;
    }

    .message {
      margin-top: 10px;
      font-size: 13px;
    }

    .message.success {
      color: ${COLORS.success};
    }

    .message.error {
      color: ${COLORS.danger};
    }

    /* ADMIN */

    .admin-card {
      width: min(500px, 100%);
      margin: auto;
      background: white;
      padding: 35px;
      border-radius: 25px;
      border: 1px solid ${COLORS.border};
    }

    .admin-panel {
      background: white;
      border: 1px solid ${COLORS.border};
      border-radius: 25px;
      padding: 30px;
    }

    .admin-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      margin-bottom: 30px;
    }

    .admin-header h1 {
      margin: 0;
    }

    .admin-grid {
      display: grid;
      grid-template-columns: .8fr 1.2fr;
      gap: 30px;
    }

    .admin-form {
      padding: 22px;
      background: ${COLORS.bg};
      border-radius: 18px;
    }

    .admin-product,
    .order-item {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 16px;
      border: 1px solid ${COLORS.border};
      border-radius: 14px;
      margin-bottom: 10px;
      background: white;
    }

    .admin-product span,
    .order-item span {
      color: ${COLORS.teal};
      font-weight: bold;
    }

    .admin-product small,
    .order-item small {
      color: ${COLORS.muted};
    }

    .hidden {
      display: none !important;
    }

    /* CART */

    .cart-box {
      background: white;
      border: 1px solid ${COLORS.border};
      border-radius: 22px;
      padding: 25px;
    }

    .cart-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      padding: 15px 0;
      border-bottom: 1px solid ${COLORS.border};
    }

    .cart-row:last-child {
      border-bottom: 0;
    }

    /* INFO */

    .info-page {
      width: min(850px, calc(100% - 32px));
      margin: 70px auto;
      background: white;
      border: 1px solid ${COLORS.border};
      border-radius: 25px;
      padding: 45px;
    }

    .info-page h1 {
      font-size: 36px;
      margin: 5px 0 15px;
    }

    .info-page p {
      color: ${COLORS.muted};
      margin-bottom: 30px;
    }

    /* FOOTER */

    footer {
      margin-top: 80px;
      background: ${COLORS.navy};
      color: #cbd5e1;
    }

    .footer-inner {
      width: min(1180px, calc(100% - 32px));
      margin: auto;
      padding: 45px 0 25px;
      display: grid;
      grid-template-columns:
        1.4fr 1fr 1fr;
      gap: 35px;
    }

    footer h3 {
      color: white;
      margin-top: 0;
    }

    footer a {
      display: block;
      margin: 5px 0;
      color: #cbd5e1;
      font-size: 14px;
    }

    footer a:hover {
      color: #fb923c;
    }

    .copyright {
      width: min(1180px, calc(100% - 32px));
      margin: auto;
      border-top: 1px solid rgba(255,255,255,.1);
      padding: 18px 0;
      text-align: center;
      font-size: 12px;
    }

    /* MOBILE */

    @media (max-width: 850px) {
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

      .hero {
        grid-template-columns: 1fr;
        padding: 32px 25px;
      }

      .feature-grid,
      .product-grid {
        grid-template-columns: 1fr;
      }

      .promo {
        flex-direction: column;
        align-items: flex-start;
      }

      .admin-grid {
        grid-template-columns: 1fr;
      }

      .footer-inner {
        grid-template-columns: 1fr;
      }

      .hero h1 {
        font-size: 34px;
      }
    }
  </style>
</head>

<body>

<header>
  <div class="nav">

    <a class="brand" href="/">
      <div class="brand-logo">🛍️</div>

      <div>
        <div>${STORE_NAME}</div>
        <small style="color:#94a3b8;font-size:10px">
          ${STORE_EN}
        </small>
      </div>
    </a>

    <nav>
      <a href="/">خانه</a>
      <a href="/products">محصولات</a>
      <a href="/#features">امکانات</a>
      <a href="/account">حساب کاربری</a>
      <a class="nav-cart" href="/cart">🛒 سبد خرید</a>
    </nav>

  </div>
</header>

<main>
  ${content}
</main>

<footer>

  <div class="footer-inner">

    <div>
      <h3>${STORE_NAME}</h3>
      <p>
        فروشگاه آنلاین ${STORE_EN}
        برای محصولات و خدمات دیجیتال.
      </p>
    </div>

    <div>
      <h3>دسترسی سریع</h3>
      <a href="/">خانه</a>
      <a href="/products">محصولات</a>
      <a href="/account">حساب کاربری</a>
      <a href="/cart">سبد خرید</a>
    </div>

    <div>
      <h3>اطلاعات</h3>
      <a href="/about">درباره ما</a>
      <a href="/contact">تماس با ما</a>
      <a href="/terms">قوانین و شرایط</a>
      <a href="/privacy">حریم خصوصی</a>
    </div>

  </div>

  <div class="copyright">
    © ${new Date().getFullYear()}
    ${STORE_NAME} -
    ${STORE_EN}
  </div>

</footer>

<script>
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatPrice(value) {
    const number = Number(value || 0);

    if (!number) {
      return "رایگان";
    }

    return number.toLocaleString("fa-IR") + " تومان";
  }

  function productCard(product) {
    const image = product.image
      ? \`
        <img
          src="\${escapeHtml(product.image)}"
          alt="\${escapeHtml(product.name)}"
          loading="lazy"
        >
      \`
      : '<div class="product-placeholder">📦</div>';

    return \`
      <article class="product-card">

        <div class="product-image">
          \${image}
        </div>

        <div class="product-body">

          <div class="product-category">
            \${escapeHtml(product.category || "عمومی")}
          </div>

          <h3>
            \${escapeHtml(product.name)}
          </h3>

          <p>
            \${escapeHtml(
              product.description ||
              "توضیحات محصول در فروشگاه دیجی‌ماریکسو."
            )}
          </p>

          <div class="product-footer">

            <div class="price">
              \${formatPrice(product.price)}
            </div>

            <button
              class="btn btn-primary"
              onclick='addToCart(${JSON.stringify({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image
              })})'
            >
              افزودن
            </button>

          </div>

        </div>
      </article>
    \`;
  }

  async function loadProducts() {
    const box =
      document.getElementById("products");

    if (!box) return;

    try {
      const response =
        await fetch("/api/products");

      const data =
        await response.json();

      if (!data.ok || !data.products.length) {
        box.innerHTML =
          '<div class="empty">هنوز محصولی در فروشگاه ثبت نشده است.</div>';
        return;
      }

      box.innerHTML =
        data.products.map(productCard).join("");

    } catch (error) {
      box.innerHTML =
        '<div class="empty">خطا در دریافت محصولات.</div>';
    }
  }

  function getCart() {
    try {
      return JSON.parse(
        localStorage.getItem("digimarixo_cart") || "[]"
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

  function addToCart(product) {
    const cart = getCart();

    const existing =
      cart.find(item => item.id === product.id);

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: Number(product.price || 0),
        image: product.image || "",
        quantity: 1
      });
    }

    saveCart(cart);

    alert("محصول به سبد خرید اضافه شد.");
  }

  function removeFromCart(id) {
    const cart =
      getCart().filter(item => item.id !== id);

    saveCart(cart);
    renderCart();
  }

  function changeQuantity(id, amount) {
    const cart = getCart();

    const item =
      cart.find(item => item.id === id);

    if (!item) return;

    item.quantity += amount;

    if (item.quantity <= 0) {
      removeFromCart(id);
      return;
    }

    saveCart(cart);
    renderCart();
  }

  function renderCart() {
    const box =
      document.getElementById("cart");

    if (!box) return;

    const cart = getCart();

    if (!cart.length) {
      box.innerHTML = \`
        <div class="empty">
          <div style="font-size:50px">🛒</div>
          <h3>سبد خرید خالی است</h3>
          <a
            class="btn btn-primary"
            href="/products"
          >
            مشاهده محصولات
          </a>
        </div>
      \`;

      return;
    }

    let total = 0;

    box.innerHTML =
      cart.map(item => {

        const itemTotal =
          Number(item.price) *
          Number(item.quantity);

        total += itemTotal;

        return \`
          <div class="cart-row">

            <div>
              <strong>
                \${escapeHtml(item.name)}
              </strong>

              <div style="color:#64748b;font-size:13px">
                \${formatPrice(item.price)}
              </div>
            </div>

            <div style="display:flex;align-items:center;gap:8px">

              <button
                class="btn btn-outline"
                onclick="changeQuantity(\${item.id},-1)"
              >
                −
              </button>

              <strong>
                \${item.quantity}
              </strong>

              <button
                class="btn btn-outline"
                onclick="changeQuantity(\${item.id},1)"
              >
                +
              </button>

            </div>

            <strong>
              \${formatPrice(itemTotal)}
            </strong>

            <button
              class="btn btn-outline"
              onclick="removeFromCart(\${item.id})"
            >
              حذف
            </button>

          </div>
        \`;
      }).join("") +

      \`
        <div
          style="
            display:flex;
            justify-content:space-between;
            margin-top:25px;
            font-size:20px;
            font-weight:900;
          "
        >
          <span>مجموع</span>
          <span>\${formatPrice(total)}</span>
        </div>

        <button
          class="btn btn-orange full"
          style="margin-top:20px"
          onclick="checkout()"
        >
          ادامه ثبت سفارش
        </button>
      \`;
  }

  function checkout() {
    const user =
      localStorage.getItem("digimarixo_user");

    if (!user) {
      alert(
        "برای ثبت سفارش ابتدا وارد حساب کاربری شوید."
      );

      location.href = "/account";
      return;
    }

    alert(
      "سبد خرید آماده ثبت سفارش است. اتصال درگاه پرداخت را می‌توان بعداً اضافه کرد."
    );
  }
</script>

</body>
</html>
`;
}


/* =========================================================
   RESPONSE HELPERS
========================================================= */

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
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
        "Content-Type": "text/html; charset=UTF-8"
      }
    }
  );
}


/* =========================================================
   ERROR / 404
========================================================= */

function errorPage(error) {
  const message =
    error?.message ||
    String(error);

  return pageShell(
    "خطا",
    `
    <section class="info-page">

      <span>خطای فروشگاه</span>

      <h1>مشکلی رخ داده است</h1>

      <p>
        ${escapeHtml(message)}
      </p>

      <a
        class="btn btn-primary"
        href="/"
      >
        بازگشت به فروشگاه
      </a>

    </section>
    `
  );
}

function notFoundPage() {
  return pageShell(
    "یافت نشد",
    `
    <section class="info-page">

      <span>404</span>

      <h1>صفحه پیدا نشد</h1>

      <p>
        صفحه‌ای که به دنبال آن هستید وجود ندارد.
      </p>

      <a
        class="btn btn-primary"
        href="/"
      >
        بازگشت به خانه
      </a>

    </section>
    `
  );
}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
           }
