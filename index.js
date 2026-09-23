const STORE_NAME = "دیجی‌ماریکسو";
const STORE_EN = "DigiMarixo";
const DEFAULT_ADMIN_USERNAME = "admin";

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
          store: STORE_NAME,
          english: STORE_EN
        });
      }

      /* =========================
         PUBLIC API
      ========================= */

      if (path === "/api/products" && method === "GET") {
        const result = await env.DB.prepare(`
          SELECT
            id,
            name,
            slug,
            description,
            price,
            image,
            category,
            stock,
            featured,
            created_at
          FROM products
          WHERE active = 1
          ORDER BY featured DESC, id DESC
        `).all();

        return json({
          ok: true,
          products: result.results || []
        });
      }

      /* =========================
         AUTH API
      ========================= */

      if (path === "/api/register" && method === "POST") {
        const body = await request.json();

        const username = String(body.username || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (!username || !email || !password) {
          return json(
            { ok: false, error: "همه فیلدها الزامی هستند." },
            400
          );
        }

        if (password.length < 6) {
          return json(
            { ok: false, error: "رمز عبور باید حداقل ۶ کاراکتر باشد." },
            400
          );
        }

        const exists = await env.DB.prepare(`
          SELECT id
          FROM users
          WHERE username = ? OR email = ?
          LIMIT 1
        `)
          .bind(username, email)
          .first();

        if (exists) {
          return json(
            { ok: false, error: "نام کاربری یا ایمیل قبلاً ثبت شده است." },
            409
          );
        }

        const passwordHash = await sha256(password);

        const result = await env.DB.prepare(`
          INSERT INTO users
          (username, email, password_hash, created_at)
          VALUES (?, ?, ?, ?)
        `)
          .bind(
            username,
            email,
            passwordHash,
            now()
          )
          .run();

        const userId = result.meta.last_row_id;

        const token = crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO sessions
          (token, user_id, created_at)
          VALUES (?, ?, ?)
        `)
          .bind(token, userId, now())
          .run();

        return json(
          {
            ok: true,
            message: "ثبت‌نام با موفقیت انجام شد."
          },
          200,
          {
            "Set-Cookie": sessionCookie(token)
          }
        );
      }

      if (path === "/api/login" && method === "POST") {
        const body = await request.json();

        const identity = String(
          body.username || body.email || ""
        )
          .trim()
          .toLowerCase();

        const password = String(body.password || "");

        if (!identity || !password) {
          return json(
            { ok: false, error: "نام کاربری/ایمیل و رمز عبور را وارد کنید." },
            400
          );
        }

        const user = await env.DB.prepare(`
          SELECT id, username, email, password_hash
          FROM users
          WHERE LOWER(username) = ? OR LOWER(email) = ?
          LIMIT 1
        `)
          .bind(identity, identity)
          .first();

        if (!user) {
          return json(
            { ok: false, error: "اطلاعات ورود صحیح نیست." },
            401
          );
        }

        const passwordHash = await sha256(password);

        if (passwordHash !== user.password_hash) {
          return json(
            { ok: false, error: "اطلاعات ورود صحیح نیست." },
            401
          );
        }

        const token = crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO sessions
          (token, user_id, created_at)
          VALUES (?, ?, ?)
        `)
          .bind(token, user.id, now())
          .run();

        return json(
          {
            ok: true,
            message: "ورود موفق بود."
          },
          200,
          {
            "Set-Cookie": sessionCookie(token)
          }
        );
      }

      if (path === "/api/logout" && method === "POST") {
        const token = getCookie(request, "session");

        if (token) {
          await env.DB.prepare(`
            DELETE FROM sessions
            WHERE token = ?
          `)
            .bind(token)
            .run();
        }

        return json(
          {
            ok: true
          },
          200,
          {
            "Set-Cookie": clearCookie("session")
          }
        );
      }

      if (path === "/api/me" && method === "GET") {
        const user = await getUser(request, env);

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
            email: user.email
          }
        });
      }

      /* =========================
         USER ORDERS
      ========================= */

      if (path === "/api/orders" && method === "GET") {
        const user = await getUser(request, env);

        if (!user) {
          return json(
            {
              ok: false,
              error: "ابتدا وارد حساب کاربری شوید."
            },
            401
          );
        }

        const orders = await env.DB.prepare(`
          SELECT
            id,
            total,
            status,
            created_at
          FROM orders
          WHERE user_id = ?
          ORDER BY id DESC
        `)
          .bind(user.id)
          .all();

        return json({
          ok: true,
          orders: orders.results || []
        });
      }

      if (path === "/api/orders" && method === "POST") {
        const user = await getUser(request, env);

        if (!user) {
          return json(
            {
              ok: false,
              error: "ابتدا وارد حساب کاربری شوید."
            },
            401
          );
        }

        const body = await request.json();
        const items = Array.isArray(body.items) ? body.items : [];

        if (!items.length) {
          return json(
            {
              ok: false,
              error: "سبد خرید خالی است."
            },
            400
          );
        }

        let total = 0;
        const validItems = [];

        for (const item of items) {
          const productId = Number(item.product_id);
          const quantity = Math.max(
            1,
            Number(item.quantity || 1)
          );

          if (!Number.isInteger(productId)) {
            continue;
          }

          const product = await env.DB.prepare(`
            SELECT id, name, price, stock
            FROM products
            WHERE id = ? AND active = 1
            LIMIT 1
          `)
            .bind(productId)
            .first();

          if (!product) {
            continue;
          }

          if (
            product.stock !== null &&
            product.stock !== undefined &&
            Number(product.stock) < quantity
          ) {
            return json(
              {
                ok: false,
                error: `موجودی محصول «${product.name}» کافی نیست.`
              },
              400
            );
          }

          const lineTotal =
            Number(product.price || 0) * quantity;

          total += lineTotal;

          validItems.push({
            product,
            quantity,
            lineTotal
          });
        }

        if (!validItems.length) {
          return json(
            {
              ok: false,
              error: "محصول معتبری برای سفارش پیدا نشد."
            },
            400
          );
        }

        const orderResult = await env.DB.prepare(`
          INSERT INTO orders
          (user_id, total, status, created_at)
          VALUES (?, ?, ?, ?)
        `)
          .bind(
            user.id,
            total,
            "pending",
            now()
          )
          .run();

        const orderId = orderResult.meta.last_row_id;

        for (const item of validItems) {
          await env.DB.prepare(`
            INSERT INTO order_items
            (order_id, product_id, quantity, price)
            VALUES (?, ?, ?, ?)
          `)
            .bind(
              orderId,
              item.product.id,
              item.quantity,
              item.product.price
            )
            .run();

          if (
            item.product.stock !== null &&
            item.product.stock !== undefined
          ) {
            await env.DB.prepare(`
              UPDATE products
              SET stock = stock - ?
              WHERE id = ?
            `)
              .bind(
                item.quantity,
                item.product.id
              )
              .run();
          }
        }

        return json({
          ok: true,
          order_id: orderId,
          total
        });
      }

      /* =========================
         ADMIN AUTH
      ========================= */

      if (path === "/api/admin/login" && method === "POST") {
        const body = await request.json();

        const username = String(
          body.username || ""
        ).trim();

        const password = String(
          body.password || ""
        );

        const adminPassword =
          env.ADMIN_PASSWORD || "";

        if (
          username !== DEFAULT_ADMIN_USERNAME ||
          !adminPassword ||
          password !== adminPassword
        ) {
          return json(
            {
              ok: false,
              error: "نام کاربری یا رمز عبور مدیریت صحیح نیست."
            },
            401
          );
        }

        const token = crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO admin_sessions
          (token, username, created_at)
          VALUES (?, ?, ?)
        `)
          .bind(
            token,
            DEFAULT_ADMIN_USERNAME,
            now()
          )
          .run();

        return json(
          {
            ok: true
          },
          200,
          {
            "Set-Cookie": adminCookie(token)
          }
        );
      }

      if (path === "/api/admin/logout" && method === "POST") {
        const token = getCookie(
          request,
          "admin_session"
        );

        if (token) {
          await env.DB.prepare(`
            DELETE FROM admin_sessions
            WHERE token = ?
          `)
            .bind(token)
            .run();
        }

        return json(
          {
            ok: true
          },
          200,
          {
            "Set-Cookie": clearCookie(
              "admin_session"
            )
          }
        );
      }

      if (
        path === "/api/admin/me" &&
        method === "GET"
      ) {
        const admin = await getAdmin(
          request,
          env
        );

        return json({
          ok: true,
          loggedIn: !!admin,
          username: admin
            ? admin.username
            : null
        });
      }

      /* =========================
         ADMIN PRODUCTS
      ========================= */

      if (
        path === "/api/admin/products" &&
        method === "GET"
      ) {
        const admin = await getAdmin(
          request,
          env
        );

        if (!admin) {
          return json(
            {
              ok: false,
              error: "دسترسی غیرمجاز."
            },
            401
          );
        }

        const products = await env.DB.prepare(`
          SELECT *
          FROM products
          ORDER BY id DESC
        `).all();

        return json({
          ok: true,
          products: products.results || []
        });
      }

      if (
        path === "/api/admin/products" &&
        method === "POST"
      ) {
        const admin = await getAdmin(
          request,
          env
        );

        if (!admin) {
          return json(
            {
              ok: false,
              error: "دسترسی غیرمجاز."
            },
            401
          );
        }

        const body = await request.json();

        const name = String(
          body.name || ""
        ).trim();

        const slug = String(
          body.slug ||
            name
              .toLowerCase()
              .replace(/\s+/g, "-")
        ).trim();

        const description = String(
          body.description || ""
        ).trim();

        const price = Number(
          body.price || 0
        );

        const image = String(
          body.image || ""
        ).trim();

        const category = String(
          body.category || ""
        ).trim();

        const stock = Number(
          body.stock || 0
        );

        const featured =
          body.featured ? 1 : 0;

        if (!name) {
          return json(
            {
              ok: false,
              error: "نام محصول الزامی است."
            },
            400
          );
        }

        const result = await env.DB.prepare(`
          INSERT INTO products
          (
            name,
            slug,
            description,
            price,
            image,
            category,
            stock,
            featured,
            active,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `)
          .bind(
            name,
            slug,
            description,
            price,
            image,
            category,
            stock,
            featured,
            now()
          )
          .run();

        return json({
          ok: true,
          id: result.meta.last_row_id
        });
      }

      if (
        path === "/api/admin/products" &&
        method === "DELETE"
      ) {
        const admin = await getAdmin(
          request,
          env
        );

        if (!admin) {
          return json(
            {
              ok: false,
              error: "دسترسی غیرمجاز."
            },
            401
          );
        }

        const body = await request.json();
        const id = Number(body.id);

        if (!id) {
          return json(
            {
              ok: false,
              error: "شناسه محصول نامعتبر است."
            },
            400
          );
        }

        await env.DB.prepare(`
          DELETE FROM products
          WHERE id = ?
        `)
          .bind(id)
          .run();

        return json({
          ok: true
        });
      }

      /* =========================
         ADMIN ORDERS
      ========================= */

      if (
        path === "/api/admin/orders" &&
        method === "GET"
      ) {
        const admin = await getAdmin(
          request,
          env
        );

        if (!admin) {
          return json(
            {
              ok: false,
              error: "دسترسی غیرمجاز."
            },
            401
          );
        }

        const orders = await env.DB.prepare(`
          SELECT
            o.id,
            o.user_id,
            o.total,
            o.status,
            o.created_at,
            u.username,
            u.email
          FROM orders o
          LEFT JOIN users u
            ON u.id = o.user_id
          ORDER BY o.id DESC
        `).all();

        return json({
          ok: true,
          orders: orders.results || []
        });
      }

      if (
        path === "/api/admin/orders/status" &&
        method === "POST"
      ) {
        const admin = await getAdmin(
          request,
          env
        );

        if (!admin) {
          return json(
            {
              ok: false,
              error: "دسترسی غیرمجاز."
            },
            401
          );
        }

        const body = await request.json();

        const id = Number(body.id);
        const status = String(
          body.status || ""
        ).trim();

        const allowed = [
          "pending",
          "paid",
          "processing",
          "completed",
          "cancelled"
        ];

        if (
          !id ||
          !allowed.includes(status)
        ) {
          return json(
            {
              ok: false,
              error: "اطلاعات وضعیت سفارش نامعتبر است."
            },
            400
          );
        }

        await env.DB.prepare(`
          UPDATE orders
          SET status = ?
          WHERE id = ?
        `)
          .bind(status, id)
          .run();

        return json({
          ok: true
        });
      }

      /* =========================
         PAGES
      ========================= */

      if (
        path === "/" &&
        method === "GET"
      ) {
        return html(
          homePage(),
          200
        );
      }

      if (
        path.startsWith("/product/") &&
        method === "GET"
      ) {
        const slug = decodeURIComponent(
          path.replace("/product/", "")
        );

        const product = await env.DB.prepare(`
          SELECT *
          FROM products
          WHERE (slug = ? OR CAST(id AS TEXT) = ?)
            AND active = 1
          LIMIT 1
        `)
          .bind(slug, slug)
          .first();

        if (!product) {
          return html(
            pageLayout(
              "محصول پیدا نشد",
              notFoundPage(
                "محصول موردنظر پیدا نشد."
              )
            ),
            404
          );
        }

        return html(
          pageLayout(
            product.name,
            productPage(product)
          )
        );
      }

      if (
        path === "/account" &&
        method === "GET"
      ) {
        return html(
          pageLayout(
            "حساب کاربری",
            accountPage()
          )
        );
      }

      if (
        path === "/admin" &&
        method === "GET"
      ) {
        return html(
          pageLayout(
            "مدیریت فروشگاه",
            adminPage()
          )
        );
      }

      return html(
        pageLayout(
          "صفحه پیدا نشد",
          notFoundPage(
            "صفحه‌ای که به دنبال آن هستید وجود ندارد."
          )
        ),
        404
      );

    } catch (error) {
      return json(
        {
          ok: false,
          error: error.message || "خطای داخلی سرور"
        },
        500
      );
    }
  }
};


/* =========================================================
   DATABASE
========================================================= */

async function initDB(env) {
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
        created_at TEXT NOT NULL
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT DEFAULT '',
        price INTEGER DEFAULT 0,
        image TEXT DEFAULT '',
        category TEXT DEFAULT '',
        stock INTEGER DEFAULT 0,
        featured INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        total INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER DEFAULT 1,
        price INTEGER DEFAULT 0
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `)
  ]);
}


/* =========================================================
   AUTH HELPERS
========================================================= */

async function getUser(request, env) {
  const token = getCookie(
    request,
    "session"
  );

  if (!token) {
    return null;
  }

  return await env.DB.prepare(`
    SELECT
      u.id,
      u.username,
      u.email
    FROM sessions s
    JOIN users u
      ON u.id = s.user_id
    WHERE s.token = ?
    LIMIT 1
  `)
    .bind(token)
    .first();
}


async function getAdmin(request, env) {
  const token = getCookie(
    request,
    "admin_session"
  );

  if (!token) {
    return null;
  }

  return await env.DB.prepare(`
    SELECT
      username
    FROM admin_sessions
    WHERE token = ?
    LIMIT 1
  `)
    .bind(token)
    .first();
}


/* =========================================================
   CRYPTO
========================================================= */

async function sha256(value) {
  const data =
    new TextEncoder().encode(value);

  const hash =
    await crypto.subtle.digest(
      "SHA-256",
      data
    );

  return Array.from(
    new Uint8Array(hash)
  )
    .map(
      byte =>
        byte
          .toString(16)
          .padStart(2, "0")
    )
    .join("");
}


/* =========================================================
   COOKIES
========================================================= */

function getCookie(request, name) {
  const cookie =
    request.headers.get("Cookie") || "";

  const parts =
    cookie.split(";");

  for (const part of parts) {
    const item = part.trim();

    if (
      item.startsWith(name + "=")
    ) {
      return decodeURIComponent(
        item.substring(
          name.length + 1
        )
      );
    }
  }

  return null;
}


function sessionCookie(token) {
  return [
    "session=" +
      encodeURIComponent(token),
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=2592000"
  ].join("; ");
}


function adminCookie(token) {
  return [
    "admin_session=" +
      encodeURIComponent(token),
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=86400"
  ].join("; ");
}


function clearCookie(name) {
  return [
    name + "=",
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0"
  ].join("; ");
}


/* =========================================================
   RESPONSE HELPERS
========================================================= */

function json(
  data,
  status = 200,
  extraHeaders = {}
) {
  const headers = {
    "Content-Type":
      "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  };

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers
    }
  );
}


function html(
  content,
  status = 200
) {
  return new Response(
    content,
    {
      status,
      headers: {
        "Content-Type":
          "text/html; charset=utf-8",
        "Cache-Control":
          "no-store"
      }
    }
  );
}


function now() {
  return new Date().toISOString();
}


/* =========================================================
   LAYOUT
========================================================= */

function pageLayout(
  title,
  content
) {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport"
      content="width=device-width,initial-scale=1">

<meta name="theme-color"
      content="#0f172a">

<meta name="description"
      content="${escapeHtml(
        STORE_NAME +
        "؛ فروشگاه آنلاین کالا و محصولات دیجیتال"
      )}">

<title>${escapeHtml(
    title + " | " + STORE_NAME
  )}</title>

<style>
${globalCSS()}
</style>
</head>

<body>

<header class="site-header">
  <div class="container header-inner">

    <a class="brand" href="/">
      <span class="brand-mark">D</span>
      <span>
        <strong>${STORE_NAME}</strong>
        <small>${STORE_EN}</small>
      </span>
    </a>

    <nav class="nav">
      <a href="/">خانه</a>
      <a href="/#products">محصولات</a>
      <a href="/#features">امکانات</a>
      <a href="/account">حساب کاربری</a>
    </nav>

  </div>
</header>

<main>
${content}
</main>

<footer class="footer">
  <div class="container footer-inner">
    <div>
      <strong>${STORE_NAME}</strong>
      <span>فروشگاه آنلاین ${STORE_EN}</span>
    </div>

    <div>
      © ${new Date().getFullYear()}
      ${STORE_NAME}
    </div>
  </div>
</footer>

<script>
${clientJS()}
</script>

</body>
</html>`;
}


/* =========================================================
   GLOBAL CSS
========================================================= */

function globalCSS() {
  return `
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

  background:
    radial-gradient(
      circle at 10% 10%,
      rgba(37,99,235,.08),
      transparent 28%
    ),
    radial-gradient(
      circle at 90% 20%,
      rgba(20,184,166,.08),
      transparent 30%
    ),
    #f4f7fb;

  color: #172033;
  line-height: 1.8;
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

.container {
  width: min(
    1120px,
    calc(100% - 32px)
  );

  margin: 0 auto;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 50;

  background:
    rgba(255,255,255,.94);

  backdrop-filter:
    blur(12px);

  border-bottom:
    1px solid #e2e8f0;
}

.header-inner {
  min-height: 76px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;

  color: #0f172a;
}

.brand-mark {
  width: 44px;
  height: 44px;

  display: grid;
  place-items: center;

  border-radius: 14px;

  color: white;
  font-weight: 900;
  font-size: 21px;

  background:
    linear-gradient(
      135deg,
      #0f172a,
      #2563eb
    );

  box-shadow:
    0 10px 24px
    rgba(15,23,42,.18);
}

.brand strong {
  display: block;
  font-size: 17px;
}

.brand small {
  display: block;
  color: #64748b;
  font-size: 11px;
  direction: ltr;
  text-align: right;
}

.nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.nav a {
  padding: 8px 12px;
  border-radius: 10px;
  color: #475569;
  font-size: 14px;
}

.nav a:hover {
  color: #0f172a;
  background: #eef2ff;
}

.hero {
  padding: 70px 0 50px;
}

.hero-card {
  overflow: hidden;
  position: relative;

  padding: 54px 42px;

  border-radius: 28px;

  color: white;

  background:
    linear-gradient(
      135deg,
      #0f172a 0%,
      #1e3a8a 55%,
      #0f766e 100%
    );

  box-shadow:
    0 25px 60px
    rgba(15,23,42,.20);
}

.hero-card::after {
  content: "";
  position: absolute;

  width: 280px;
  height: 280px;

  border-radius: 50%;

  background:
    rgba(255,255,255,.07);

  left: -90px;
  bottom: -140px;
}

.hero h1 {
  margin: 0 0 14px;

  font-size:
    clamp(30px, 6vw, 52px);

  line-height: 1.35;
}

.hero p {
  max-width: 680px;

  margin: 0 0 28px;

  color: #dbeafe;
  font-size: 17px;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.btn {
  border: 0;
  cursor: pointer;

  display: inline-flex;
  align-items: center;
  justify-content: center;

  min-height: 44px;
  padding: 9px 18px;

  border-radius: 12px;

  font-weight: 700;
}

.btn-primary {
  color: white;

  background:
    linear-gradient(
      135deg,
      #0f766e,
      #14b8a6
    );

  box-shadow:
    0 10px 25px
    rgba(15,118,110,.24);
}

.btn-primary:hover {
  filter: brightness(1.05);
}

.btn-secondary {
  color: #0f172a;
  background: white;
}

.btn-orange {
  color: white;

  background:
    linear-gradient(
      135deg,
      #f97316,
      #fb923c
    );
}

.section {
  padding: 42px 0;
}

.section-title {
  margin-bottom: 22px;
}

.section-title h2 {
  margin: 0;
  font-size: 28px;
  color: #0f172a;
}

.section-title p {
  margin: 4px 0 0;
  color: #64748b;
}

.features {
  display: grid;

  grid-template-columns:
    repeat(
      3,
      minmax(0, 1fr)
    );

  gap: 18px;
}

.feature {
  padding: 24px;

  border-radius: 20px;

  color: white;

  min-height: 180px;

  box-shadow:
    0 16px 35px
    rgba(15,23,42,.12);
}

.feature:nth-child(1) {
  background:
    linear-gradient(
      135deg,
      #0f172a,
      #2563eb
    );
}

.feature:nth-child(2) {
  background:
    linear-gradient(
      135deg,
      #1d4ed8,
      #06b6d4
    );
}

.feature:nth-child(3) {
  background:
    linear-gradient(
      135deg,
      #ea580c,
      #fb923c
    );
}

.feature-icon {
  font-size: 30px;
  margin-bottom: 8px;
}

.feature h3 {
  margin: 0 0 6px;
}

.feature p {
  margin: 0;
  color: rgba(255,255,255,.88);
}

.products {
  display: grid;

  grid-template-columns:
    repeat(
      3,
      minmax(0, 1fr)
    );

  gap: 18px;
}

.product-card {
  overflow: hidden;

  background: white;

  border:
    1px solid #e2e8f0;

  border-radius: 20px;

  box-shadow:
    0 12px 30px
    rgba(15,23,42,.07);

  transition:
    transform .2s ease,
    box-shadow .2s ease;
}

.product-card:hover {
  transform:
    translateY(-3px);

  box-shadow:
    0 18px 38px
    rgba(15,23,42,.12);
}

.product-cover {
  min-height: 190px;

  display: grid;
  place-items: center;

  color: white;

  font-size: 42px;
  font-weight: 900;

  background:
    linear-gradient(
      135deg,
      #0f172a,
      #2563eb,
      #0f766e
    );
}

.product-body {
  padding: 20px;
}

.product-body h3 {
  margin: 0 0 8px;
  color: #0f172a;
}

.product-body p {
  color: #64748b;
  font-size: 14px;
}

.product-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 12px;

  margin-top: 18px;
}

.price {
  color: #f97316;
  font-weight: 900;
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

.card {
  padding: 26px;

  background: white;

  border:
    1px solid #e2e8f0;

  border-radius: 20px;

  box-shadow:
    0 12px 30px
    rgba(15,23,42,.06);
}

.form {
  display: grid;
  gap: 14px;
}

.form label {
  display: grid;
  gap: 6px;

  color: #334155;
  font-weight: 700;
}

.form input,
.form textarea,
.form select {
  width: 100%;

  padding: 12px 14px;

  border:
    1px solid #cbd5e1;

  border-radius: 11px;

  outline: none;

  background: white;
}

.form textarea {
  min-height: 120px;
  resize: vertical;
}

.form input:focus,
.form textarea:focus,
.form select:focus {
  border-color: #14b8a6;

  box-shadow:
    0 0 0 3px
    rgba(20,184,166,.12);
}

.account-grid {
  display: grid;

  grid-template-columns:
    repeat(
      2,
      minmax(0, 1fr)
    );

  gap: 20px;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 12px;

  text-align: right;

  border-bottom:
    1px solid #e2e8f0;
}

th {
  background: #ecfeff;
  color: #0f766e;
}

.badge {
  display: inline-block;

  padding: 4px 9px;

  border-radius: 999px;

  color: #0f766e;
  background: #ccfbf1;

  font-size: 12px;
  font-weight: 700;
}

.admin-grid {
  display: grid;

  gap: 20px;
}

.product-detail {
  display: grid;

  grid-template-columns:
    minmax(280px, 1fr)
    minmax(280px, 1fr);

  gap: 28px;
}

.product-detail-cover {
  min-height: 360px;

  display: grid;
  place-items: center;

  border-radius: 24px;

  color: white;

  font-size: 70px;
  font-weight: 900;

  background:
    linear-gradient(
      135deg,
      #0f172a,
      #2563eb,
      #0f766e
    );
}

.product-detail h1 {
  margin-top: 0;

  color: #0f172a;
}

.detail-price {
  margin: 22px 0;

  color: #f97316;

  font-size: 30px;
  font-weight: 900;
}

.footer {
  margin-top: 60px;

  border-top:
    1px solid #e2e8f0;

  background: white;
}

.footer-inner {
  min-height: 100px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 20px;

  color: #64748b;
}

.footer strong {
  display: block;
  color: #0f172a;
}

.footer span {
  display: block;
  font-size: 12px;
}

.notice {
  padding: 13px 15px;

  border-radius: 12px;

  color: #0f766e;
  background: #ecfeff;

  border:
    1px solid #a5f3fc;
}

.error {
  padding: 13px 15px;

  border-radius: 12px;

  color: #991b1b;
  background: #fef2f2;

  border:
    1px solid #fecaca;
}

.loading {
  padding: 25px;
  text-align: center;
  color: #64748b;
}

@media (max-width: 850px) {
  .header-inner {
    align-items: flex-start;
    flex-direction: column;

    padding: 12px 0;
  }

  .nav {
    width: 100%;
    overflow-x: auto;
  }

  .features,
  .products,
  .account-grid,
  .product-detail {
    grid-template-columns: 1fr;
  }

  .hero-card {
    padding: 38px 24px;
  }

  .footer-inner {
    align-items: flex-start;
    flex-direction: column;
    padding: 22px 0;
  }
}

@media (max-width: 500px) {
  .container {
    width:
      calc(100% - 22px);
  }

  .hero {
    padding-top: 28px;
  }

  .hero h1 {
    font-size: 30px;
  }

  .section {
    padding: 28px 0;
  }

  .product-cover {
    min-height: 150px;
  }
}
`;
}


/* =========================================================
   HOME PAGE
========================================================= */

function homePage() {
  return `
<section class="hero">
  <div class="container">

    <div class="hero-card">

      <h1>
        ${STORE_NAME}
      </h1>

      <p>
        فروشگاه آنلاین ${STORE_EN}؛
        بستری ساده برای معرفی و خرید محصولات.
      </p>

      <div class="hero-actions">
        <a
          href="#products"
          class="btn btn-secondary"
        >
          مشاهده محصولات
        </a>

        <a
          href="/account"
          class="btn btn-primary"
        >
          حساب کاربری
        </a>
      </div>

    </div>

  </div>
</section>


<section
  id="features"
  class="section"
>
  <div class="container">

    <div class="section-title">
      <h2>امکانات فروشگاه</h2>
      <p>
        تجربه‌ای ساده و سریع برای مشتری و مدیریت فروشگاه
      </p>
    </div>

    <div class="features">

      <div class="feature">
        <div class="feature-icon">🛍️</div>
        <h3>فروش آنلاین</h3>
        <p>
          نمایش محصولات و ثبت سفارش آنلاین.
        </p>
      </div>

      <div class="feature">
        <div class="feature-icon">⚡</div>
        <h3>سریع و سبک</h3>
        <p>
          اجرا روی زیرساخت Cloudflare برای سرعت بالا.
        </p>
      </div>

      <div class="feature">
        <div class="feature-icon">🔐</div>
        <h3>حساب کاربری</h3>
        <p>
          مدیریت حساب و مشاهده سفارش‌های ثبت‌شده.
        </p>
      </div>

    </div>

  </div>
</section>


<section
  id="products"
  class="section"
>
  <div class="container">

    <div class="section-title">
      <h2>محصولات</h2>
      <p>
        محصولات موجود در فروشگاه
      </p>
    </div>

    <div
      id="products-list"
      class="products"
    >
      <div class="loading">
        در حال دریافت محصولات...
      </div>
    </div>

  </div>
</section>
`;
}


/* =========================================================
   PRODUCT PAGE
========================================================= */

function productPage(product) {
  const image = product.image
    ? `<img
         src="${escapeAttr(product.image)}"
         alt="${escapeAttr(product.name)}"
         style="width:100%;height:100%;object-fit:cover;border-radius:24px;"
       >`
    : "D";

  return `
<section class="section">
  <div class="container">

    <div class="product-detail">

      <div class="product-detail-cover">
        ${image}
      </div>

      <div class="card">

        <h1>
          ${escapeHtml(product.name)}
        </h1>

        ${
          product.category
            ? `
              <span class="badge">
                ${escapeHtml(product.category)}
              </span>
            `
            : ""
        }

        <div class="detail-price">
          ${formatPrice(product.price)}
        </div>

        <p>
          ${escapeHtml(
            product.description ||
            "توضیحی برای این محصول ثبت نشده است."
          )}
        </p>

        <p>
          موجودی:
          <strong>
            ${Number(product.stock || 0)}
          </strong>
        </p>

        ${
          Number(product.stock || 0) > 0
            ? `
              <button
                class="btn btn-primary"
                onclick="addToCart(${Number(product.id)})"
              >
                افزودن به سبد خرید
              </button>
            `
            : `
              <div class="error">
                این محصول در حال حاضر ناموجود است.
              </div>
            `
        }

      </div>

    </div>

  </div>
</section>
`;
}


/* =========================================================
   ACCOUNT PAGE
========================================================= */

function accountPage() {
  return `
<section class="section">
  <div class="container">

    <div
      id="account-area"
      class="account-grid"
    >

      <div class="card">

        <h2>ورود</h2>

        <form
          id="login-form"
          class="form"
        >

          <label>
            نام کاربری یا ایمیل

            <input
              name="username"
              autocomplete="username"
              required
            >
          </label>

          <label>
            رمز عبور

            <input
              type="password"
              name="password"
              autocomplete="current-password"
              required
            >
          </label>

          <button
            class="btn btn-primary"
            type="submit"
          >
            ورود
          </button>

        </form>

        <div
          id="login-message"
          style="margin-top:12px;"
        ></div>

      </div>


      <div class="card">

        <h2>ثبت‌نام</h2>

        <form
          id="register-form"
          class="form"
        >

          <label>
            نام کاربری

            <input
              name="username"
              autocomplete="username"
              required
            >
          </label>

          <label>
            ایمیل

            <input
              type="email"
              name="email"
              autocomplete="email"
              required
            >
          </label>

          <label>
            رمز عبور

            <input
              type="password"
              name="password"
              autocomplete="new-password"
              minlength="6"
              required
            >
          </label>

          <button
            class="btn btn-orange"
            type="submit"
          >
            ایجاد حساب
          </button>

        </form>

        <div
          id="register-message"
          style="margin-top:12px;"
        ></div>

      </div>

    </div>

    <div
      id="orders-area"
      style="margin-top:22px;"
    ></div>

  </div>
</section>
`;
}


/* =========================================================
   ADMIN PAGE
========================================================= */

function adminPage() {
  return `
<section class="section">
  <div class="container">

    <div
      id="admin-login"
      class="card"
    >

      <h2>مدیریت فروشگاه</h2>

      <p>
        ورود مدیر
      </p>

      <form
        id="admin-login-form"
        class="form"
      >

        <label>
          نام کاربری

          <input
            name="username"
            value="admin"
            required
          >
        </label>

        <label>
          رمز عبور

          <input
            type="password"
            name="password"
            required
          >
        </label>

        <button
          class="btn btn-primary"
          type="submit"
        >
          ورود مدیریت
        </button>

      </form>

      <div
        id="admin-login-message"
        style="margin-top:12px;"
      ></div>

    </div>


    <div
      id="admin-panel"
      style="display:none;"
    >

      <div class="admin-grid">

        <div class="card">

          <h2>
            افزودن محصول
          </h2>

          <form
            id="product-form"
            class="form"
          >

            <label>
              نام محصول

              <input
                name="name"
                required
              >
            </label>

            <label>
              نامک انگلیسی

              <input
                name="slug"
                placeholder="product-name"
              >
            </label>

            <label>
              توضیحات

              <textarea
                name="description"
              ></textarea>
            </label>

            <label>
              قیمت

              <input
                type="number"
                name="price"
                min="0"
                value="0"
                required
              >
            </label>

            <label>
              تصویر

              <input
                name="image"
                placeholder="https://..."
              >
            </label>

            <label>
              دسته‌بندی

              <input
                name="category"
              >
            </label>

            <label>
              موجودی

              <input
                type="number"
                name="stock"
                min="0"
                value="0"
              >
            </label>

            <label>
              <span>
                محصول ویژه
              </span>

              <input
                type="checkbox"
                name="featured"
              >
            </label>

            <button
              class="btn btn-primary"
              type="submit"
            >
              افزودن محصول
            </button>

          </form>

          <div
            id="product-message"
            style="margin-top:12px;"
          ></div>

        </div>


        <div class="card">

          <h2>
            محصولات
          </h2>

          <div
            id="admin-products"
          >
            در حال دریافت...
          </div>

        </div>


        <div class="card">

          <h2>
            سفارش‌ها
          </h2>

          <div
            id="admin-orders"
          >
            در حال دریافت...
          </div>

        </div>

      </div>

    </div>

  </div>
</section>
`;
}


/* =========================================================
   NOT FOUND
========================================================= */

function notFoundPage(message) {
  return `
<section class="section">
  <div class="container">

    <div class="card"
         style="text-align:center;">

      <h1>
        صفحه پیدا نشد
      </h1>

      <p>
        ${escapeHtml(message)}
      </p>

      <a
        href="/"
        class="btn btn-primary"
      >
        بازگشت به فروشگاه
      </a>

    </div>

  </div>
</section>
`;
}


/* =========================================================
   CLIENT JAVASCRIPT
========================================================= */

function clientJS() {
  return `

async function api(
  url,
  options = {}
) {
  const response =
    await fetch(
      url,
      {
        credentials: "same-origin",
        ...options
      }
    );

  let data = null;

  try {
    data = await response.json();
  } catch (e) {
    data = {
      ok: false,
      error: "پاسخ نامعتبر از سرور."
    };
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
      "خطایی رخ داد."
    );
  }

  return data;
}


function escapeText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function price(value) {
  return Number(value || 0)
    .toLocaleString("fa-IR") +
    " تومان";
}


/* =========================
   HOME PRODUCTS
========================= */

async function loadProducts() {
  const box =
    document.getElementById(
      "products-list"
    );

  if (!box) {
    return;
  }

  try {
    const data =
      await api(
        "/api/products"
      );

    const products =
      data.products || [];

    if (!products.length) {
      box.innerHTML =
        '<div class="empty" style="grid-column:1/-1;">' +
        "هنوز محصولی ثبت نشده است." +
        "</div>";

      return;
    }

    box.innerHTML =
      products.map(
        product => {

          const cover =
            product.image
              ? '<img src="' +
                escapeText(
                  product.image
                ) +
                '" alt="' +
                escapeText(
                  product.name
                ) +
                '" style="width:100%;height:100%;object-fit:cover;">'
              : "D";

          return \`
            <article class="product-card">

              <a
                href="/product/\${encodeURIComponent(
                  product.slug || product.id
                )}"
              >
                <div class="product-cover">
                  \${cover}
                </div>
              </a>

              <div class="product-body">

                <h3>
                  \${escapeText(
                    product.name
                  )}
                </h3>

                <p>
                  \${escapeText(
                    product.description ||
                    "محصول فروشگاه"
                  )}
                </p>

                <div class="product-bottom">

                  <strong class="price">
                    \${price(
                      product.price
                    )}
                  </strong>

                  <a
                    href="/product/\${encodeURIComponent(
                      product.slug || product.id
                    )}"
                    class="btn btn-primary"
                  >
                    مشاهده
                  </a>

                </div>

              </div>

            </article>
          \`;
        }
      ).join("");

  } catch (error) {
    box.innerHTML =
      '<div class="error" style="grid-column:1/-1;">' +
      escapeText(error.message) +
      "</div>";
  }
}


/* =========================
   CART
========================= */

function getCart() {
  try {
    return JSON.parse(
      localStorage.getItem(
        "digimarixo_cart"
      ) || "[]"
    );
  } catch (e) {
    return [];
  }
}


function saveCart(cart) {
  localStorage.setItem(
    "digimarixo_cart",
    JSON.stringify(cart)
  );
}


function addToCart(productId) {
  const cart = getCart();

  const existing =
    cart.find(
      item =>
        Number(item.product_id) ===
        Number(productId)
    );

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      product_id:
        Number(productId),
      quantity: 1
    });
  }

  saveCart(cart);

  alert(
    "محصول به سبد خرید اضافه شد."
  );
}


/* =========================
   ACCOUNT
========================= */

async function loadAccount() {
  const area =
    document.getElementById(
      "account-area"
    );

  if (!area) {
    return;
  }

  try {
    const data =
      await api("/api/me");

    if (
      !data.loggedIn
    ) {
      setupAccountForms();
      return;
    }

    area.innerHTML =
      \`
      <div class="card">

        <h2>
          حساب کاربری
        </h2>

        <p>
          سلام
          <strong>
            \${escapeText(
              data.user.username
            )}
          </strong>
        </p>

        <p>
          ایمیل:
          \${escapeText(
            data.user.email
          )}
        </p>

        <button
          class="btn btn-primary"
          onclick="logoutUser()"
        >
          خروج از حساب
        </button>

      </div>
      \`;

    await loadOrders();

  } catch (error) {
    setupAccountForms();
  }
}


function setupAccountForms() {
  const loginForm =
    document.getElementById(
      "login-form"
    );

  const registerForm =
    document.getElementById(
      "register-form"
    );

  if (loginForm) {
    loginForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        const form =
          new FormData(
            loginForm
          );

        const message =
          document.getElementById(
            "login-message"
          );

        try {

          const data =
            await api(
              "/api/login",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json"
                },
                body:
                  JSON.stringify({
                    username:
                      form.get(
                        "username"
                      ),
                    password:
                      form.get(
                        "password"
                      )
                  })
              }
            );

          message.innerHTML =
            '<div class="notice">' +
            escapeText(
              data.message ||
              "ورود موفق بود."
            ) +
            "</div>";

          setTimeout(
            () =>
              location.reload(),
            500
          );

        } catch (error) {

          message.innerHTML =
            '<div class="error">' +
            escapeText(
              error.message
            ) +
            "</div>";
        }
      }
    );
  }


  if (registerForm) {
    registerForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        const form =
          new FormData(
            registerForm
          );

        const message =
          document.getElementById(
            "register-message"
          );

        try {

          const data =
            await api(
              "/api/register",
              {
                method: "POST",
                headers: {
                  "Content-Type":
                    "application/json"
                },
                body:
                  JSON.stringify({
                    username:
                      form.get(
                        "username"
                      ),
                    email:
                      form.get(
                        "email"
                      ),
                    password:
                      form.get(
                        "password"
                      )
                  })
              }
            );

          message.innerHTML =
            '<div class="notice">' +
            escapeText(
              data.message ||
              "ثبت‌نام موفق بود."
            ) +
            "</div>";

          setTimeout(
            () =>
              location.reload(),
            500
          );

        } catch (error) {

          message.innerHTML =
            '<div class="error">' +
            escapeText(
              error.message
            ) +
            "</div>";
        }
      }
    );
  }
}


async function logoutUser() {
  try {
    await api(
      "/api/logout",
      {
        method: "POST"
      }
    );

    location.reload();

  } catch (error) {
    alert(error.message);
  }
}


async function loadOrders() {
  const area =
    document.getElementById(
      "orders-area"
    );

  if (!area) {
    return;
  }

  try {

    const data =
      await api(
        "/api/orders"
      );

    const orders =
      data.orders || [];

    if (!orders.length) {

      area.innerHTML =
        \`
        <div class="card">
          <h2>سفارش‌های من</h2>
          <div class="empty">
            هنوز سفارشی ثبت نشده است.
          </div>
        </div>
        \`;

      return;
    }

    area.innerHTML =
      \`
      <div class="card">

        <h2>
          سفارش‌های من
        </h2>

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

              \${orders.map(
                order =>
                  \`
                  <tr>
                    <td>
                      #\${order.id}
                    </td>

                    <td>
                      \${price(
                        order.total
                      )}
                    </td>

                    <td>
                      <span class="badge">
                        \${escapeText(
                          order.status
                        )}
                      </span>
                    </td>

                    <td>
                      \${escapeText(
                        order.created_at
                      )}
                    </td>
                  </tr>
                  \`
              ).join("")}

            </tbody>

          </table>

        </div>

      </div>
      \`;

  } catch (error) {
    area.innerHTML =
      '<div class="error">' +
      escapeText(
        error.message
      ) +
      "</div>";
  }
}


/* =========================
   ADMIN
========================= */

async function loadAdmin() {
  const loginBox =
    document.getElementById(
      "admin-login"
    );

  const panel =
    document.getElementById(
      "admin-panel"
    );

  if (!loginBox || !panel) {
    return;
  }

  try {

    const data =
      await api(
        "/api/admin/me"
      );

    if (data.loggedIn) {

      loginBox.style.display =
        "none";

      panel.style.display =
        "block";

      await loadAdminProducts();
      await loadAdminOrders();

    } else {
      setupAdminLogin();
    }

  } catch (error) {
    setupAdminLogin();
  }
}


function setupAdminLogin() {
  const form =
    document.getElementById(
      "admin-login-form"
    );

  if (!form) {
    return;
  }

  form.addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const data =
        new FormData(form);

      const message =
        document.getElementById(
          "admin-login-message"
        );

      try {

        await api(
          "/api/admin/login",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body:
              JSON.stringify({
                username:
                  data.get(
                    "username"
                  ),
                password:
                  data.get(
                    "password"
                  )
              })
          }
        );

        location.reload();

      } catch (error) {

        message.innerHTML =
          '<div class="error">' +
          escapeText(
            error.message
          ) +
          "</div>";
      }
    }
  );


  const productForm =
    document.getElementById(
      "product-form"
    );

  if (productForm) {

    productForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        const data =
          new FormData(
            productForm
          );

        const message =
          document.getElementById(
            "product-message"
          );

        try {

          await api(
            "/api/admin/products",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json"
              },
              body:
                JSON.stringify({
                  name:
                    data.get("name"),
                  slug:
                    data.get("slug"),
                  description:
                    data.get(
                      "description"
                    ),
                  price:
                    Number(
                      data.get(
                        "price"
                      ) || 0
                    ),
                  image:
                    data.get(
                      "image"
                    ),
                  category:
                    data.get(
                      "category"
                    ),
                  stock:
                    Number(
                      data.get(
                        "stock"
                      ) || 0
                    ),
                  featured:
                    data.get(
                      "featured"
                    ) === "on"
                })
            }
          );

          productForm.reset();

          message.innerHTML =
            '<div class="notice">' +
            "محصول با موفقیت اضافه شد." +
            "</div>";

          await loadAdminProducts();

        } catch (error) {

          message.innerHTML =
            '<div class="error">' +
            escapeText(
              error.message
            ) +
            "</div>";
        }
      }
    );
  }
}


async function loadAdminProducts() {
  const box =
    document.getElementById(
      "admin-products"
    );

  if (!box) {
    return;
  }

  try {

    const data =
      await api(
        "/api/admin/products"
      );

    const products =
      data.products || [];

    if (!products.length) {

      box.innerHTML =
        '<div class="empty">' +
        "محصولی وجود ندارد." +
        "</div>";

      return;
    }

    box.innerHTML =
      \`
      <div class="table-wrap">

        <table>

          <thead>
            <tr>
              <th>محصول</th>
              <th>قیمت</th>
              <th>موجودی</th>
              <th>عملیات</th>
            </tr>
          </thead>

          <tbody>

            \${products.map(
              product =>
                \`
                <tr>

                  <td>
                    \${escapeText(
                      product.name
                    )}
                  </td>

                  <td>
                    \${price(
                      product.price
                    )}
                  </td>

                  <td>
                    \${product.stock}
                  </td>

                  <td>

                    <button
                      class="btn btn-orange"
                      onclick="deleteProduct(\${product.id})"
                    >
                      حذف
                    </button>

                  </td>

                </tr>
                \`
            ).join("")}

          </tbody>

        </table>

      </div>
      \`;

  } catch (error) {

    box.innerHTML =
      '<div class="error">' +
      escapeText(
        error.message
      ) +
      "</div>";
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

  try {

    await api(
      "/api/admin/products",
      {
        method: "DELETE",
        headers: {
          "Content-Type":
            "application/json"
        },
        body:
          JSON.stringify({
            id
          })
      }
    );

    await loadAdminProducts();

  } catch (error) {
    alert(error.message);
  }
}


async function loadAdminOrders() {
  const box =
    document.getElementById(
      "admin-orders"
    );

  if (!box) {
    return;
  }

  try {

    const data =
      await api(
        "/api/admin/orders"
      );

    const orders =
      data.orders || [];

    if (!orders.length) {

      box.innerHTML =
        '<div class="empty">' +
        "هنوز سفارشی ثبت نشده است." +
        "</div>";

      return;
    }

    box.innerHTML =
      \`
      <div class="table-wrap">

        <table>

          <thead>
            <tr>
              <th>شماره</th>
              <th>کاربر</th>
              <th>مبلغ</th>
              <th>وضعیت</th>
              <th>تغییر</th>
            </tr>
          </thead>

          <tbody>

            \${orders.map(
              order =>
                \`
                <tr>

                  <td>
                    #\${order.id}
                  </td>

                  <td>
                    \${escapeText(
                      order.username ||
                      "-"
                    )}
                  </td>

                  <td>
                    \${price(
                      order.total
                    )}
                  </td>

                  <td>
                    \${escapeText(
                      order.status
                    )}
                  </td>

                  <td>

                    <select
                      onchange="changeOrderStatus(
                        \${order.id},
                        this.value
                      )"
                    >

                      <option value="pending">
                        pending
                      </option>

                      <option value="paid">
                        paid
                      </option>

                      <option value="processing">
                        processing
                      </option>

                      <option value="completed">
                        completed
                      </option>

                      <option value="cancelled">
                        cancelled
                      </option>

                    </select>

                  </td>

                </tr>
                \`
            ).join("")}

          </tbody>

        </table>

      </div>
      \`;

  } catch (error) {

    box.innerHTML =
      '<div class="error">' +
      escapeText(
        error.message
      ) +
      "</div>";
  }
}


async function changeOrderStatus(
  id,
  status
) {
  try {

    await api(
      "/api/admin/orders/status",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json"
        },
        body:
          JSON.stringify({
            id,
            status
          })
      }
    );

    await loadAdminOrders();

  } catch (error) {
    alert(error.message);
  }
}


/* =========================
   START
========================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    loadProducts();
    loadAccount();
    loadAdmin();

  }
);

`;
}


/* =========================================================
   SERVER-SIDE HELPERS
========================================================= */

function formatPrice(value) {
  return (
    Number(value || 0)
      .toLocaleString("fa-IR") +
    " تومان"
  );
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function escapeAttr(value) {
  return escapeHtml(value);
    }
