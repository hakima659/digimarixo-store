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

      /* =========================
         STATIC / BASIC
      ========================= */

      if (path === "/health" && method === "GET") {
        return json({
          ok: true,
          store: STORE_EN,
          database: "connected"
        });
      }

      /* =========================
         HOME
      ========================= */

      if (path === "/" && method === "GET") {
        return html(homePage());
      }

      /* =========================
         PRODUCT PAGE
      ========================= */

      if (path.startsWith("/product/") && method === "GET") {
        const id = Number(path.split("/").pop());

        if (!Number.isFinite(id) || id <= 0) {
          return html(notFoundPage(), 404);
        }

        const product = await getProduct(env, id);

        if (!product) {
          return html(notFoundPage(), 404);
        }

        return html(productPage(product));
      }

      /* =========================
         ACCOUNT
      ========================= */

      if (path === "/account" && method === "GET") {
        return html(accountPage());
      }

      /* =========================
         ADMIN
      ========================= */

      if (path === "/admin" && method === "GET") {
        return html(adminPage());
      }

      /* =========================
         PRODUCTS API
      ========================= */

      if (path === "/api/products" && method === "GET") {
        try {
          const products = await getProducts(env);

          return json({
            ok: true,
            products
          });
        } catch (error) {
          return json(
            {
              ok: false,
              error: "خطا در دریافت محصولات از پایگاه داده."
            },
            500
          );
        }
      }

      /* =========================
         REGISTER
      ========================= */

      if (path === "/api/register" && method === "POST") {
        const body = await readJSON(request);

        const username = String(body.username || "").trim();
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");

        if (!username || !email || !password) {
          return json(
            {
              ok: false,
              error: "همه فیلدها را کامل کنید."
            },
            400
          );
        }

        if (password.length < 4) {
          return json(
            {
              ok: false,
              error: "رمز عبور باید حداقل ۴ کاراکتر باشد."
            },
            400
          );
        }

        const existing = await env.DB.prepare(`
          SELECT id
          FROM users
          WHERE username = ? OR email = ?
          LIMIT 1
        `)
          .bind(username, email)
          .first();

        if (existing) {
          return json(
            {
              ok: false,
              error: "نام کاربری یا ایمیل قبلاً ثبت شده است."
            },
            409
          );
        }

        const passwordHash = await hashPassword(password);

        const result = await env.DB.prepare(`
          INSERT INTO users
            (username, email, password_hash, created_at)
          VALUES
            (?, ?, ?, ?)
        `)
          .bind(
            username,
            email,
            passwordHash,
            new Date().toISOString()
          )
          .run();

        const userId = result.meta?.last_row_id;

        if (!userId) {
          return json(
            {
              ok: false,
              error: "ایجاد حساب کاربری انجام نشد."
            },
            500
          );
        }

        const token = randomToken();

        await env.DB.prepare(`
          INSERT INTO sessions
            (id, token, user_id, created_at, expires_at)
          VALUES
            (?, ?, ?, ?, ?)
        `)
          .bind(
            crypto.randomUUID(),
            token,
            userId,
            new Date().toISOString(),
            new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString()
          )
          .run();

        return new Response(
          JSON.stringify({
            ok: true,
            message: "حساب با موفقیت ایجاد شد."
          }),
          {
            headers: {
              "Content-Type":
                "application/json; charset=UTF-8",
              "Set-Cookie":
                cookieHeader("session", token)
            }
          }
        );
      }

      /* =========================
         LOGIN
      ========================= */

      if (path === "/api/login" && method === "POST") {
        const body = await readJSON(request);

        const login =
          String(body.login || "")
            .trim()
            .toLowerCase();

        const password =
          String(body.password || "");

        if (!login || !password) {
          return json(
            {
              ok: false,
              error:
                "نام کاربری/ایمیل و رمز عبور را وارد کنید."
            },
            400
          );
        }

        const user = await env.DB.prepare(`
          SELECT *
          FROM users
          WHERE LOWER(username) = ?
             OR LOWER(email) = ?
          LIMIT 1
        `)
          .bind(login, login)
          .first();

        if (!user) {
          return json(
            {
              ok: false,
              error: "اطلاعات ورود صحیح نیست."
            },
            401
          );
        }

        const passwordHash =
          await hashPassword(password);

        if (passwordHash !== user.password_hash) {
          return json(
            {
              ok: false,
              error: "اطلاعات ورود صحیح نیست."
            },
            401
          );
        }

        const token = randomToken();

        await env.DB.prepare(`
          INSERT INTO sessions
            (id, token, user_id, created_at, expires_at)
          VALUES
            (?, ?, ?, ?, ?)
        `)
          .bind(
            crypto.randomUUID(),
            token,
            user.id,
            new Date().toISOString(),
            new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString()
          )
          .run();

        return new Response(
          JSON.stringify({
            ok: true,
            message: "ورود موفق بود."
          }),
          {
            headers: {
              "Content-Type":
                "application/json; charset=UTF-8",
              "Set-Cookie":
                cookieHeader("session", token)
            }
          }
        );
      }

      /* =========================
         LOGOUT
      ========================= */

      if (path === "/api/logout" && method === "POST") {
        const token =
          getCookie(request, "session");

        if (token) {
          await env.DB.prepare(`
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
            headers: {
              "Content-Type":
                "application/json; charset=UTF-8",
              "Set-Cookie":
                "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
            }
          }
        );
      }

      /* =========================
         CURRENT USER
      ========================= */

      if (path === "/api/me" && method === "GET") {
        const user =
          await getCurrentUser(request, env);

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
         ORDERS - GET
      ========================= */

      if (path === "/api/orders" && method === "GET") {
        const user =
          await getCurrentUser(request, env);

        if (!user) {
          return json(
            {
              ok: false,
              error:
                "ابتدا وارد حساب کاربری شوید."
            },
            401
          );
        }

        const orders =
          await env.DB.prepare(`
            SELECT
              o.id,
              o.user_id,
              o.product_id,
              o.status,
              o.created_at,
              p.name,
              p.description,
              p.price,
              p.image
            FROM orders o
            LEFT JOIN products p
              ON p.id = o.product_id
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC
          `)
            .bind(user.id)
            .all();

        return json({
          ok: true,
          orders: orders.results || []
        });
      }

      /* =========================
         CREATE ORDER
      ========================= */

      if (path === "/api/orders" && method === "POST") {
        const user =
          await getCurrentUser(request, env);

        if (!user) {
          return json(
            {
              ok: false,
              error:
                "برای ثبت سفارش ابتدا وارد حساب کاربری شوید."
            },
            401
          );
        }

        const body =
          await readJSON(request);

        const productId = Number(
          body.product_id ??
          body.productId ??
          body.id
        );

        if (
          !Number.isFinite(productId) ||
          productId <= 0
        ) {
          return json(
            {
              ok: false,
              error:
                "شناسه محصول نامعتبر است."
            },
            400
          );
        }

        /*
         * قیمت فقط از D1 خوانده می‌شود.
         * قیمت ارسالی مرورگر قابل اعتماد نیست.
         */

        const product =
          await env.DB.prepare(`
            SELECT
              id,
              name,
              description,
              price,
              image
            FROM products
            WHERE id = ?
            LIMIT 1
          `)
            .bind(productId)
            .first();

        if (!product) {
          return json(
            {
              ok: false,
              error:
                "محصول موردنظر پیدا نشد."
            },
            404
          );
        }

        const normalizedPrice =
          normalizePrice(product.price);

        if (
          !Number.isFinite(normalizedPrice) ||
          normalizedPrice <= 0
        ) {
          return json(
            {
              ok: false,
              error:
                "قیمت محصول در پایگاه داده معتبر نیست."
            },
            400
          );
        }

        const orderId =
          crypto.randomUUID();

        await env.DB.prepare(`
          INSERT INTO orders
            (id, user_id, product_id, status, created_at)
          VALUES
            (?, ?, ?, ?, ?)
        `)
          .bind(
            orderId,
            user.id,
            product.id,
            "pending",
            new Date().toISOString()
          )
          .run();

        return json({
          ok: true,
          message:
            "سفارش با موفقیت ثبت شد.",
          order: {
            id: orderId,
            product_id: product.id,
            product_name: product.name,
            price: normalizedPrice,
            price_display:
              formatPrice(normalizedPrice),
            status: "pending"
          }
        });
      }

      /* =========================
         ADMIN LOGIN
      ========================= */

      if (
        path === "/api/admin/login" &&
        method === "POST"
      ) {
        const body =
          await readJSON(request);

        const username =
          String(body.username || "").trim();

        const password =
          String(body.password || "");

        if (!username || !password) {
          return json(
            {
              ok: false,
              error:
                "نام کاربری و رمز عبور را وارد کنید."
            },
            400
          );
        }

        if (
          username !==
            DEFAULT_ADMIN_USERNAME ||
          password !==
            String(env.ADMIN_PASSWORD || "")
        ) {
          return json(
            {
              ok: false,
              error:
                "اطلاعات مدیریت صحیح نیست."
            },
            401
          );
        }

        const token =
          randomToken();

        await env.DB.prepare(`
          INSERT INTO admin_sessions
            (id, token, username, created_at, expires_at)
          VALUES
            (?, ?, ?, ?, ?)
        `)
          .bind(
            crypto.randomUUID(),
            token,
            username,
            new Date().toISOString(),
            new Date(
              Date.now() + 24 * 60 * 60 * 1000
            ).toISOString()
          )
          .run();

        return new Response(
          JSON.stringify({
            ok: true,
            message:
              "ورود مدیریت موفق بود."
          }),
          {
            headers: {
              "Content-Type":
                "application/json; charset=UTF-8",
              "Set-Cookie":
                cookieHeader(
                  "admin_session",
                  token
                )
            }
          }
        );
      }

      /* =========================
         ADMIN LOGOUT
      ========================= */

      if (
        path === "/api/admin/logout" &&
        method === "POST"
      ) {
        const token =
          getCookie(
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

        return new Response(
          JSON.stringify({
            ok: true
          }),
          {
            headers: {
              "Content-Type":
                "application/json; charset=UTF-8",
              "Set-Cookie":
                "admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
            }
          }
        );
      }

      /* =========================
         ADMIN ME
      ========================= */

      if (
        path === "/api/admin/me" &&
        method === "GET"
      ) {
        const admin =
          await getAdmin(request, env);

        return json({
          ok: true,
          loggedIn: !!admin,
          username:
            admin?.username || null
        });
      }

      /* =========================
         ADMIN PRODUCTS - GET
      ========================= */

      if (
        path === "/api/admin/products" &&
        method === "GET"
      ) {
        const admin =
          await getAdmin(request, env);

        if (!admin) {
          return json(
            {
              ok: false,
              error:
                "دسترسی مدیریت لازم است."
            },
            401
          );
        }

        const products =
          await getProducts(env);

        return json({
          ok: true,
          products
        });
      }

      /* =========================
         ADMIN ADD PRODUCT
      ========================= */

      if (
        path === "/api/admin/products" &&
        method === "POST"
      ) {
        const admin =
          await getAdmin(request, env);

        if (!admin) {
          return json(
            {
              ok: false,
              error:
                "دسترسی مدیریت لازم است."
            },
            401
          );
        }

        const body =
          await readJSON(request);

        const name =
          String(body.name || "").trim();

        const description =
          String(
            body.description || ""
          ).trim();

        const image =
          String(
            body.image || "🛍️"
          ).trim();

        const price =
          normalizePrice(body.price);

        if (!name) {
          return json(
            {
              ok: false,
              error:
                "نام محصول الزامی است."
            },
            400
          );
        }

        if (
          !Number.isFinite(price) ||
          price <= 0
        ) {
          return json(
            {
              ok: false,
              error:
                "قیمت محصول معتبر نیست."
            },
            400
          );
        }

        /*
         * مهم:
         * id در جدول products از نوع INTEGER
         * و AUTOINCREMENT است.
         *
         * بنابراین نباید UUID داخل id قرار دهیم.
         */

        const result =
          await env.DB.prepare(`
            INSERT INTO products
              (name, description, price, image, created_at)
            VALUES
              (?, ?, ?, ?, ?)
          `)
            .bind(
              name,
              description,
              price,
              image,
              new Date().toISOString()
            )
            .run();

        const id =
          result.meta?.last_row_id;

        if (!id) {
          return json(
            {
              ok: false,
              error:
                "محصول ایجاد شد اما شناسه آن دریافت نشد."
            },
            500
          );
        }

        return json({
          ok: true,
          message:
            "محصول اضافه شد.",
          product: {
            id,
            name,
            description,
            price,
            price_display:
              formatPrice(price),
            image
          }
        });
      }

      /* =========================
         ADMIN DELETE PRODUCT
      ========================= */

      if (
        path === "/api/admin/products" &&
        method === "DELETE"
      ) {
        const admin =
          await getAdmin(request, env);

        if (!admin) {
          return json(
            {
              ok: false,
              error:
                "دسترسی مدیریت لازم است."
            },
            401
          );
        }

        const body =
          await readJSON(request);

        const productId =
          Number(
            body.product_id ??
            body.productId ??
            body.id
          );

        if (
          !Number.isFinite(productId) ||
          productId <= 0
        ) {
          return json(
            {
              ok: false,
              error:
                "شناسه محصول نامعتبر است."
            },
            400
          );
        }

        await env.DB.prepare(`
          DELETE FROM products
          WHERE id = ?
        `)
          .bind(productId)
          .run();

        return json({
          ok: true,
          message:
            "محصول حذف شد."
        });
      }

      /* =========================
         ADMIN ORDERS
      ========================= */

      if (
        path === "/api/admin/orders" &&
        method === "GET"
      ) {
        const admin =
          await getAdmin(request, env);

        if (!admin) {
          return json(
            {
              ok: false,
              error:
                "دسترسی مدیریت لازم است."
            },
            401
          );
        }

        const orders =
          await env.DB.prepare(`
            SELECT
              o.id,
              o.user_id,
              o.product_id,
              o.status,
              o.created_at,
              u.username,
              u.email,
              p.name,
              p.price,
              p.image
            FROM orders o
            LEFT JOIN users u
              ON u.id = o.user_id
            LEFT JOIN products p
              ON p.id = o.product_id
            ORDER BY o.created_at DESC
          `)
            .all();

        return json({
          ok: true,
          orders:
            orders.results || []
        });
      }

      /* =========================
         ADMIN ORDER STATUS
      ========================= */

      if (
        path === "/api/admin/orders/status" &&
        method === "POST"
      ) {
        const admin =
          await getAdmin(request, env);

        if (!admin) {
          return json(
            {
              ok: false,
              error:
                "دسترسی مدیریت لازم است."
            },
            401
          );
        }

        const body =
          await readJSON(request);

        const orderId =
          String(
            body.order_id ??
            body.orderId ??
            body.id ??
            ""
          ).trim();

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

        if (
          !orderId ||
          !allowedStatuses.includes(status)
        ) {
          return json(
            {
              ok: false,
              error:
                "اطلاعات وضعیت سفارش معتبر نیست."
            },
            400
          );
        }

        await env.DB.prepare(`
          UPDATE orders
          SET status = ?
          WHERE id = ?
        `)
          .bind(
            status,
            orderId
          )
          .run();

        return json({
          ok: true,
          message:
            "وضعیت سفارش تغییر کرد."
        });
      }

      return html(
        notFoundPage(),
        404
      );

    } catch (error) {
      return json(
        {
          ok: false,
          error:
            "خطای داخلی سرور.",
          detail:
            String(
              error?.message ||
              error
            )
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

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      image TEXT,
      created_at TEXT NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `).run();
}


/* =========================================================
   PRODUCTS
========================================================= */

async function getProducts(env) {

  const result =
    await env.DB.prepare(`
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
  `)
    .bind(id)
    .first();
}


/* =========================================================
   PRICE HELPERS
========================================================= */

function normalizeDigits(value) {

  return String(value ?? "")
    .replace(
      /[۰-۹]/g,
      function (d) {
        return String(
          "۰۱۲۳۴۵۶۷۸۹".indexOf(d)
        );
      }
    )
    .replace(
      /[٠-٩]/g,
      function (d) {
        return String(
          "٠١٢٣٤٥٦٧٨٩".indexOf(d)
        );
      }
    );
}

function normalizePrice(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  if (
    typeof value === "number"
  ) {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  let text =
    normalizeDigits(value);

  text = text
    .replace(/[٬,]/g, "")
    .replace(/تومان/gi, "")
    .replace(/تومن/gi, "")
    .replace(/[^\d.-]/g, "")
    .trim();

  if (!text) {
    return 0;
  }

  const number =
    Number(text);

  return Number.isFinite(number)
    ? number
    : 0;
}

function formatPrice(value) {

  const number =
    normalizePrice(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return "قیمت نامشخص";
  }

  return (
    number.toLocaleString("fa-IR") +
    " تومان"
  );
}


/* =========================================================
   AUTH
========================================================= */

async function getCurrentUser(
  request,
  env
) {

  const token =
    getCookie(
      request,
      "session"
    );

  if (!token) {
    return null;
  }

  const session =
    await env.DB.prepare(`
      SELECT
        s.*,
        u.id AS uid,
        u.username,
        u.email
      FROM sessions s
      JOIN users u
        ON u.id = s.user_id
      WHERE s.token = ?
        AND s.expires_at > ?
      LIMIT 1
    `)
      .bind(
        token,
        new Date().toISOString()
      )
      .first();

  if (!session) {
    return null;
  }

  return {
    id: session.uid,
    username:
      session.username,
    email:
      session.email
  };
}

async function getAdmin(
  request,
  env
) {

  const token =
    getCookie(
      request,
      "admin_session"
    );

  if (!token) {
    return null;
  }

  return await env.DB.prepare(`
    SELECT *
    FROM admin_sessions
    WHERE token = ?
      AND expires_at > ?
    LIMIT 1
  `)
    .bind(
      token,
      new Date().toISOString()
    )
    .first();
}


/* =========================================================
   PASSWORD / TOKEN
========================================================= */

async function hashPassword(
  password
) {

  const data =
    new TextEncoder().encode(
      password
    );

  const hash =
    await crypto.subtle.digest(
      "SHA-256",
      data
    );

  return [
    ...new Uint8Array(hash)
  ]
    .map(function (b) {
      return b
        .toString(16)
        .padStart(2, "0");
    })
    .join("");
}

function randomToken() {

  return (
    crypto.randomUUID() +
    "-" +
    crypto.randomUUID()
  );
}


/* =========================================================
   REQUEST HELPERS
========================================================= */

async function readJSON(request) {

  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}

function getCookie(
  request,
  name
) {

  const cookie =
    request.headers.get(
      "Cookie"
    ) || "";

  const parts =
    cookie.split(";");

  for (
    const part of parts
  ) {

    const [
      key,
      ...rest
    ] =
      part
        .trim()
        .split("=");

    if (key === name) {
      return decodeURIComponent(
        rest.join("=")
      );
    }
  }

  return null;
}

function cookieHeader(
  name,
  value
) {

  return (
    `${name}=${encodeURIComponent(value)}; ` +
    `Path=/; ` +
    `HttpOnly; ` +
    `SameSite=Lax; ` +
    `Max-Age=2592000`
  );
}


/* =========================================================
   RESPONSE HELPERS
========================================================= */

function json(
  data,
  status = 200
) {

  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=UTF-8",
        "Cache-Control":
          "no-store"
      }
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
          "text/html; charset=UTF-8",
        "Cache-Control":
          "no-store"
      }
    }
  );
}

function escapeHtml(value) {

  return String(value ?? "")
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

function statusLabel(status) {

  const map = {
    pending:
      "در انتظار بررسی",
    paid:
      "پرداخت شده",
    completed:
      "تکمیل شده",
    cancelled:
      "لغو شده"
  };

  return (
    map[status] ||
    status
  );
}


/* =========================================================
   BASE PAGE
========================================================= */

function basePage(
  title,
  content,
  scripts = ""
) {

  return `<!doctype html>
<html lang="fa" dir="rtl">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width,initial-scale=1"
  >

  <title>
    ${escapeHtml(title)}
  </title>

  <meta
    name="description"
    content="فروشگاه دیجیتال دیجی‌ماریکسو؛ محصولات و ابزارهای دیجیتال کاربردی."
  >

  <style>

    *{
      box-sizing:border-box;
    }

    body{
      margin:0;
      font-family:
        Tahoma,
        Arial,
        sans-serif;
      background:#f6f7fb;
      color:#171717;
    }

    a{
      color:inherit;
      text-decoration:none;
    }

    .container{
      width:min(1120px,92%);
      margin:auto;
    }

    header{
      background:#fff;
      border-bottom:1px solid #e8e8ef;
      position:sticky;
      top:0;
      z-index:20;
    }

    .nav{
      min-height:70px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:20px;
    }

    .brand{
      display:flex;
      align-items:center;
      gap:10px;
      font-weight:900;
    }

    .logo{
      width:42px;
      height:42px;
      border-radius:13px;
      background:#111;
      color:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:20px;
    }

    .brand-text{
      line-height:1.2;
    }

    .brand-fa{
      font-size:16px;
    }

    .brand-en{
      font-size:11px;
      color:#777;
      direction:ltr;
      text-align:right;
    }

    nav{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
    }

    nav a{
      padding:9px 12px;
      border-radius:10px;
      color:#555;
      font-size:14px;
    }

    nav a:hover{
      background:#f0f0f5;
      color:#111;
    }

    main{
      padding:34px 0 60px;
    }

    .hero{
      padding:55px 0 35px;
    }

    .eyebrow{
      color:#6d28d9;
      font-weight:800;
      font-size:12px;
      letter-spacing:.8px;
      direction:ltr;
    }

    h1{
      margin:12px 0;
      font-size:clamp(30px,6vw,56px);
      line-height:1.2;
    }

    .hero p{
      color:#666;
      font-size:17px;
      line-height:2;
      max-width:720px;
    }

    .actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-top:24px;
    }

    .btn{
      border:0;
      cursor:pointer;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:12px 18px;
      border-radius:12px;
      font-weight:800;
      font-size:14px;
    }

    .btn-dark{
      background:#111;
      color:#fff;
    }

    .btn-purple{
      background:#6d28d9;
      color:#fff;
    }

    .btn-light{
      background:#eeeef4;
      color:#222;
    }

    .section-title{
      margin:35px 0 18px;
    }

    .section-title h2{
      margin:0 0 7px;
    }

    .section-title p{
      margin:0;
      color:#777;
    }

    .features{
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:15px;
      margin:20px 0 45px;
    }

    .feature{
      background:#fff;
      border:1px solid #e9e9ef;
      border-radius:18px;
      padding:22px;
    }

    .feature-icon{
      font-size:27px;
    }

    .feature h3{
      margin:12px 0 6px;
    }

    .feature p{
      color:#777;
      line-height:1.8;
      margin:0;
    }

    .products{
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:18px;
    }

    .product-card{
      background:#fff;
      border:1px solid #e8e8ef;
      border-radius:20px;
      overflow:hidden;
      transition:.2s;
    }

    .product-card:hover{
      transform:translateY(-3px);
      box-shadow:
        0 12px 35px rgba(0,0,0,.07);
    }

    .product-image{
      min-height:150px;
      display:flex;
      align-items:center;
      justify-content:center;
      background:
        linear-gradient(
          135deg,
          #f2ecff,
          #f8f8ff
        );
      font-size:58px;
    }

    .product-body{
      padding:20px;
    }

    .product-body h3{
      margin:0 0 9px;
      font-size:19px;
    }

    .product-body p{
      min-height:52px;
      color:#777;
      line-height:1.8;
      margin:0 0 18px;
    }

    .product-bottom{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
    }

    .price{
      font-weight:900;
      color:#6d28d9;
      white-space:nowrap;
    }

    .loading,
    .empty,
    .error-box{
      background:#fff;
      border:1px solid #e8e8ef;
      border-radius:16px;
      padding:22px;
      text-align:center;
    }

    .error-box{
      color:#8b1e1e;
    }

    .error-box span{
      display:block;
      margin:10px 0 15px;
      color:#666;
    }

    .card{
      background:#fff;
      border:1px solid #e8e8ef;
      border-radius:20px;
      padding:22px;
      margin-bottom:18px;
    }

    input,
    textarea,
    select{
      width:100%;
      padding:13px;
      border:1px solid #dddde6;
      border-radius:11px;
      margin:7px 0 13px;
      font:inherit;
      outline:none;
    }

    input:focus,
    textarea:focus,
    select:focus{
      border-color:#6d28d9;
    }

    label{
      font-size:13px;
      font-weight:700;
    }

    .form-grid{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:12px;
    }

    .order{
      border:1px solid #e7e7ee;
      border-radius:15px;
      padding:15px;
      margin-top:12px;
    }

    .order-row{
      display:flex;
      justify-content:space-between;
      gap:12px;
      padding:6px 0;
    }

    footer{
      background:#111;
      color:#aaa;
      padding:30px 0;
      margin-top:30px;
      text-align:center;
    }

    @media(max-width:800px){

      .features,
      .products{
        grid-template-columns:1fr;
      }

      .nav{
        align-items:flex-start;
        flex-direction:column;
        padding:14px 0;
      }

      nav{
        width:100%;
      }

      nav a{
        background:#f4f4f7;
      }

      .form-grid{
        grid-template-columns:1fr;
      }

      .hero{
        padding-top:25px;
      }

    }

  </style>

</head>

<body>

<header>

  <div class="container nav">

    <a
      href="/"
      class="brand"
    >

      <div class="logo">
        D
      </div>

      <div class="brand-text">

        <div class="brand-fa">
          ${STORE_NAME}
        </div>

        <div class="brand-en">
          ${STORE_EN}
        </div>

      </div>

    </a>

    <nav>

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
    ${STORE_NAME}
    ©
    ${new Date().getFullYear()}
  </div>

</footer>

${scripts}

</body>

</html>`;
}


/* =========================================================
   HOME PAGE
========================================================= */

function homePage() {

  const content = `

    <section class="hero">

      <div class="eyebrow">
        DIGITAL PRODUCTS • SIMPLE • MODERN
      </div>

      <h1>
        فروشگاه دیجیتال ${STORE_EN}
      </h1>

      <p>
        ابزارهای دیجیتال برای شما
      </p>

      <p>
        در دیجی‌ماریکسو محصولات و ابزارهای دیجیتال
        را در یک فضای ساده، سریع و مناسب موبایل پیدا کنید.
      </p>

      <div class="actions">

        <a
          class="btn btn-dark"
          href="#products"
        >
          مشاهده محصولات
        </a>

        <a
          class="btn btn-light"
          href="/account"
        >
          حساب کاربری
        </a>

      </div>

    </section>

    <section class="features">

      <div class="feature">

        <div class="feature-icon">
          ⚡
        </div>

        <h3>
          ساده و سریع
        </h3>

        <p>
          تجربه‌ای ساده و سریع برای دسترسی به محصولات دیجیتال.
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
          طراحی مناسب برای استفاده با گوشی و تبلت.
        </p>

      </div>

      <div class="feature">

        <div class="feature-icon">
          🛍️
        </div>

        <h3>
          محصولات دیجیتال
        </h3>

        <p>
          محصولات کاربردی دیجیتال در یک فروشگاه آنلاین.
        </p>

      </div>

    </section>

    <section id="products">

      <div class="section-title">

        <h2>
          محصولات فروشگاه
        </h2>

        <p>
          محصولات دیجیتال موجود در دیجی‌ماریکسو
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

    </section>
  `;

  const scripts = `

<script>

function normalizeDigitsClient(value){

  return String(value ?? "")
    .replace(
      /[۰-۹]/g,
      function(d){
        return String(
          "۰۱۲۳۴۵۶۷۸۹".indexOf(d)
        );
      }
    )
    .replace(
      /[٠-٩]/g,
      function(d){
        return String(
          "٠١٢٣٤٥٦٧٨٩".indexOf(d)
        );
      }
    );
}

function normalizePriceClient(value){

  if(
    value === null ||
    value === undefined
  ){
    return 0;
  }

  if(
    typeof value === "number"
  ){
    return Number.isFinite(value)
      ? value
      : 0;
  }

  let text =
    normalizeDigitsClient(value);

  text = text
    .replace(/[٬,]/g,"")
    .replace(/تومان/gi,"")
    .replace(/تومن/gi,"")
    .replace(/[^\\d.-]/g,"")
    .trim();

  const number =
    Number(text);

  return Number.isFinite(number)
    ? number
    : 0;
}

function priceClient(value){

  const number =
    normalizePriceClient(value);

  if(
    !Number.isFinite(number) ||
    number <= 0
  ){
    return "قیمت نامشخص";
  }

  return (
    number.toLocaleString("fa-IR") +
    " تومان"
  );
}

function escapeClient(value){

  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

async function loadProducts(){

  const box =
    document.getElementById(
      "products-list"
    );

  box.innerHTML =
    '<div class="loading">' +
    'در حال دریافت محصولات...' +
    '</div>';

  try{

    const response =
      await fetch(
        "/api/products",
        {
          method:"GET",
          cache:"no-store"
        }
      );

    const text =
      await response.text();

    let data;

    try{

      data =
        JSON.parse(text);

    }catch(_){

      throw new Error(
        "پاسخ نامعتبر از سرور (" +
        response.status +
        ")"
      );
    }

    if(
      !response.ok ||
      !data.ok
    ){

      throw new Error(
        data.error ||
        "خطا در دریافت محصولات."
      );
    }

    const products =
      Array.isArray(data.products)
        ? data.products
        : [];

    if(!products.length){

      box.innerHTML =
        '<div class="empty">' +
        'هنوز محصولی در فروشگاه ثبت نشده است.' +
        '</div>';

      return;
    }

    box.innerHTML =
      products.map(
        function(product){

          const id =
            Number(product.id);

          return \`
            <article class="product-card">

              <div class="product-image">
                \${escapeClient(
                  product.image ||
                  "🛍️"
                )}
              </div>

              <div class="product-body">

                <h3>
                  \${escapeClient(
                    product.name
                  )}
                </h3>

                <p>
                  \${escapeClient(
                    product.description ||
                    "محصول دیجیتال از فروشگاه دیجی‌ماریکسو."
                  )}
                </p>

                <div class="product-bottom">

                  <span class="price">
                    \${priceClient(
                      product.price
                    )}
                  </span>

                  <a
                    class="btn btn-dark"
                    href="/product/\${id}"
                  >
                    مشاهده
                  </a>

                </div>

              </div>

            </article>
          \`;

        }
      ).join("");

  }catch(error){

    box.innerHTML = \`
      <div class="error-box">

        <strong>
          دریافت محصولات انجام نشد.
        </strong>

        <span>
          \${escapeClient(
            error?.message ||
            "خطای نامشخص در ارتباط با سرور."
          )}
        </span>

        <button
          class="btn btn-purple"
          onclick="loadProducts()"
        >
          تلاش دوباره
        </button>

      </div>
    \`;
  }
}

loadProducts();

</script>
`;

  return basePage(
    "دیجی‌ماریکسو | فروشگاه دیجیتال",
    content,
    scripts
  );
}


/* =========================================================
   PRODUCT PAGE
========================================================= */

function productPage(product){

  const safeId =
    Number(product.id);

  const content = `

    <section class="hero">

      <div class="eyebrow">
        DIGITAL PRODUCT
      </div>

      <h1>
        ${escapeHtml(product.name)}
      </h1>

      <p>
        ${escapeHtml(
          product.description ||
          "محصول دیجیتال از دیجی‌ماریکسو."
        )}
      </p>

      <div class="card">

        <div class="product-image">
          ${escapeHtml(
            product.image ||
            "🛍️"
          )}
        </div>

        <h2>
          ${escapeHtml(product.name)}
        </h2>

        <p>
          ${escapeHtml(
            product.description ||
            "محصول دیجیتال."
          )}
        </p>

        <div class="product-bottom">

          <span class="price">
            ${formatPrice(product.price)}
          </span>

          <button
            class="btn btn-purple"
            onclick="createOrder(${safeId})"
          >
            ثبت سفارش
          </button>

        </div>

        <div id="order-result"></div>

      </div>

    </section>
  `;

  const scripts = `

<script>

async function createOrder(
  productId
){

  const result =
    document.getElementById(
      "order-result"
    );

  result.innerHTML =
    '<div class="loading">' +
    'در حال ثبت سفارش...' +
    '</div>';

  try{

    const response =
      await fetch(
        "/api/orders",
        {
          method:"POST",
          headers:{
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              product_id:
                productId
            })
        }
      );

    const data =
      await response.json();

    if(
      !response.ok ||
      !data.ok
    ){

      throw new Error(
        data.error ||
        "ثبت سفارش انجام نشد."
      );
    }

    result.innerHTML = \`

      <div
        class="card"
        style="margin-top:15px"
      >

        <strong>
          سفارش با موفقیت ثبت شد.
        </strong>

        <p>
          محصول:
          \${escapeClient(
            data.order.product_name
          )}
        </p>

        <p>
          مبلغ:
          <strong>
            \${escapeClient(
              data.order.price_display
            )}
          </strong>
        </p>

        <p>
          وضعیت:
          در انتظار بررسی
        </p>

        <a
          class="btn btn-dark"
          href="/account"
        >
          مشاهده سفارش‌ها
        </a>

      </div>

    \`;

  }catch(error){

    result.innerHTML = \`

      <div
        class="error-box"
        style="margin-top:15px"
      >

        <strong>
          ثبت سفارش انجام نشد.
        </strong>

        <span>
          \${escapeClient(
            error?.message ||
            "خطای نامشخص."
          )}
        </span>

        <button
          class="btn btn-purple"
          onclick="createOrder(${safeId})"
        >
          تلاش دوباره
        </button>

      </div>

    \`;
  }
}

function escapeClient(value){

  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

</script>
`;

  return basePage(
    escapeHtml(product.name) +
      " | دیجی‌ماریکسو",
    content,
    scripts
  );
}


/* =========================================================
   ACCOUNT PAGE
========================================================= */

function accountPage(){

  const content = `

    <section class="hero">

      <div class="eyebrow">
        ACCOUNT
      </div>

      <h1>
        حساب کاربری
      </h1>

      <p>
        مدیریت حساب و سفارش‌های دیجی‌ماریکسو
      </p>

    </section>

    <div id="account-area">

      <div class="card">

        <h2>
          ورود
        </h2>

        <label>
          نام کاربری یا ایمیل
        </label>

        <input
          id="login"
          autocomplete="username"
        >

        <label>
          رمز عبور
        </label>

        <input
          id="login-password"
          type="password"
          autocomplete="current-password"
        >

        <button
          class="btn btn-dark"
          onclick="loginUser()"
        >
          ورود
        </button>

        <div id="login-result"></div>

      </div>

      <div class="card">

        <h2>
          ثبت‌نام
        </h2>

        <label>
          نام کاربری
        </label>

        <input
          id="register-username"
        >

        <label>
          ایمیل
        </label>

        <input
          id="register-email"
          type="email"
        >

        <label>
          رمز عبور
        </label>

        <input
          id="register-password"
          type="password"
        >

        <button
          class="btn btn-purple"
          onclick="registerUser()"
        >
          ایجاد حساب
        </button>

        <div id="register-result"></div>

      </div>

    </div>
  `;

  const scripts = `

<script>

async function loadMe(){

  try{

    const response =
      await fetch(
        "/api/me",
        {
          cache:"no-store"
        }
      );

    const data =
      await response.json();

    if(data.loggedIn){

      showLoggedIn(
        data.user
      );

      loadOrders();
    }

  }catch(error){}

}

function showLoggedIn(user){

  document.getElementById(
    "account-area"
  ).innerHTML = \`

    <div class="card">

      <h2>
        سلام
        \${escapeClient(
          user.username
        )}
      </h2>

      <p>
        ایمیل:
        \${escapeClient(
          user.email
        )}
      </p>

      <button
        class="btn btn-dark"
        onclick="logoutUser()"
      >
        خروج
      </button>

    </div>

    <div class="card">

      <h2>
        سفارش‌های من
      </h2>

      <div id="orders">
        در حال دریافت سفارش‌ها...
      </div>

    </div>

  \`;
}

async function loginUser(){

  const result =
    document.getElementById(
      "login-result"
    );

  result.innerHTML =
    "در حال ورود...";

  try{

    const response =
      await fetch(
        "/api/login",
        {
          method:"POST",
          headers:{
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({

              login:
                document.getElementById(
                  "login"
                ).value,

              password:
                document.getElementById(
                  "login-password"
                ).value

            })
        }
      );

    const data =
      await response.json();

    if(
      !response.ok ||
      !data.ok
    ){

      throw new Error(
        data.error ||
        "ورود انجام نشد."
      );
    }

    location.reload();

  }catch(error){

    result.innerHTML =
      '<div class="error-box">' +
      escapeClient(
        error.message
      ) +
      '</div>';
  }
}

async function registerUser(){

  const result =
    document.getElementById(
      "register-result"
    );

  result.innerHTML =
    "در حال ایجاد حساب...";

  try{

    const response =
      await fetch(
        "/api/register",
        {
          method:"POST",
          headers:{
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({

              username:
                document.getElementById(
                  "register-username"
                ).value,

              email:
                document.getElementById(
                  "register-email"
                ).value,

              password:
                document.getElementById(
                  "register-password"
                ).value

            })
        }
      );

    const data =
      await response.json();

    if(
      !response.ok ||
      !data.ok
    ){

      throw new Error(
        data.error ||
        "ثبت‌نام انجام نشد."
      );
    }

    location.reload();

  }catch(error){

    result.innerHTML =
      '<div class="error-box">' +
      escapeClient(
        error.message
      ) +
      '</div>';
  }
}

async function logoutUser(){

  await fetch(
    "/api/logout",
    {
      method:"POST"
    }
  );

  location.reload();
}

async function loadOrders(){

  const box =
    document.getElementById(
      "orders"
    );

  if(!box) return;

  try{

    const response =
      await fetch(
        "/api/orders",
        {
          cache:"no-store"
        }
      );

    const data =
      await response.json();

    if(
      !response.ok ||
      !data.ok
    ){

      throw new Error(
        data.error ||
        "خطا در دریافت سفارش‌ها."
      );
    }

    const orders =
      Array.isArray(data.orders)
        ? data.orders
        : [];

    if(!orders.length){

      box.innerHTML =
        '<div class="empty">' +
        'هنوز سفارشی ثبت نکرده‌اید.' +
        '</div>';

      return;
    }

    box.innerHTML =
      orders.map(
        function(order){

          return \`

            <div class="order">

              <div class="order-row">

                <strong>
                  \${escapeClient(
                    order.name ||
                    "محصول"
                  )}
                </strong>

                <strong>
                  \${priceClient(
                    order.price
                  )}
                </strong>

              </div>

              <div class="order-row">

                <span>
                  وضعیت
                </span>

                <span>
                  \${statusLabel(
                    order.status
                  )}
                </span>

              </div>

            </div>

          \`;

        }
      ).join("");

  }catch(error){

    box.innerHTML =
      '<div class="error-box">' +
      escapeClient(
        error.message
      ) +
      '</div>';
  }
}

function normalizeDigitsClient(value){

  return String(value ?? "")
    .replace(
      /[۰-۹]/g,
      function(d){
        return String(
          "۰۱۲۳۴۵۶۷۸۹".indexOf(d)
        );
      }
    )
    .replace(
      /[٠-٩]/g,
      function(d){
        return String(
          "٠١٢٣٤٥٦٧٨٩".indexOf(d)
        );
      }
    );
}

function normalizePriceClient(value){

  let text =
    normalizeDigitsClient(value)
      .replace(/[٬,]/g,"")
      .replace(/تومان/gi,"")
      .replace(/تومن/gi,"")
      .replace(/[^\\d.-]/g,"");

  const number =
    Number(text);

  return Number.isFinite(number)
    ? number
    : 0;
}

function priceClient(value){

  const number =
    normalizePriceClient(value);

  if(
    !Number.isFinite(number) ||
    number <= 0
  ){
    return "قیمت نامشخص";
  }

  return (
    number.toLocaleString("fa-IR") +
    " تومان"
  );
}

function statusLabel(status){

  const map = {
    pending:
      "در انتظار بررسی",
    paid:
      "پرداخت شده",
    completed:
      "تکمیل شده",
    cancelled:
      "لغو شده"
  };

  return (
    map[status] ||
    status
  );
}

function escapeClient(value){

  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

loadMe();

</script>
`;

  return basePage(
    "حساب کاربری | دیجی‌ماریکسو",
    content,
    scripts
  );
}


/* =========================================================
   ADMIN PAGE
========================================================= */

function adminPage(){

  const content = `

    <section class="hero">

      <div class="eyebrow">
        ADMIN PANEL
      </div>

      <h1>
        مدیریت دیجی‌ماریکسو
      </h1>

      <p>
        مدیریت محصولات و سفارش‌های فروشگاه
      </p>

    </section>

    <div id="admin-area">

      <div class="card">

        <h2>
          ورود مدیریت
        </h2>

        <label>
          نام کاربری
        </label>

        <input
          id="admin-username"
          value="admin"
        >

        <label>
          رمز عبور
        </label>

        <input
          id="admin-password"
          type="password"
        >

        <button
          class="btn btn-dark"
          onclick="adminLogin()"
        >
          ورود مدیریت
        </button>

        <div id="admin-login-result"></div>

      </div>

    </div>
  `;

  const scripts = `

<script>

async function checkAdmin(){

  try{

    const response =
      await fetch(
        "/api/admin/me",
        {
          cache:"no-store"
        }
      );

    const data =
      await response.json();

    if(data.loggedIn){
      showAdminPanel();
    }

  }catch(error){}

}

async function adminLogin(){

  const result =
    document.getElementById(
      "admin-login-result"
    );

  result.innerHTML =
    "در حال ورود...";

  try{

    const response =
      await fetch(
        "/api/admin/login",
        {
          method:"POST",
          headers:{
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({

              username:
                document.getElementById(
                  "admin-username"
                ).value,

              password:
                document.getElementById(
                  "admin-password"
                ).value

            })
        }
      );

    const data =
      await response.json();

    if(
      !response.ok ||
      !data.ok
    ){

      throw new Error(
        data.error ||
        "ورود مدیریت انجام نشد."
      );
    }

    showAdminPanel();

  }catch(error){

    result.innerHTML =
      '<div class="error-box">' +
      escapeClient(
        error.message
      ) +
      '</div>';
  }
}

function showAdminPanel(){

  document.getElementById(
    "admin-area"
  ).innerHTML = \`

    <div class="card">

      <h2>
        افزودن محصول
      </h2>

      <label>
        نام محصول
      </label>

      <input id="product-name">

      <label>
        توضیحات
      </label>

      <textarea
        id="product-description"
      ></textarea>

      <label>
        قیمت به تومان
      </label>

      <input
        id="product-price"
        inputmode="numeric"
        placeholder="99000"
      >

      <label>
        تصویر یا ایموجی
      </label>

      <input
        id="product-image"
        value="🛍️"
      >

      <button
        class="btn btn-purple"
        onclick="addProduct()"
      >
        افزودن محصول
      </button>

      <div id="product-result"></div>

    </div>

    <div class="card">

      <h2>
        محصولات
      </h2>

      <div id="admin-products">
        در حال دریافت...
      </div>

    </div>

    <div class="card">

      <h2>
        سفارش‌ها
      </h2>

      <div id="admin-orders">
        در حال دریافت...
      </div>

    </div>

    <div class="card">

      <button
        class="btn btn-dark"
        onclick="adminLogout()"
      >
        خروج مدیریت
      </button>

    </div>

  \`;

  loadAdminProducts();
  loadAdminOrders();
}

async function addProduct(){

  const result =
    document.getElementById(
      "product-result"
    );

  result.innerHTML =
    "در حال افزودن...";

  try{

    const response =
      await fetch(
        "/api/admin/products",
        {
          method:"POST",
          headers:{
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({

              name:
                document.getElementById(
                  "product-name"
                ).value,

              description:
                document.getElementById(
                  "product-description"
                ).value,

              price:
                document.getElementById(
                  "product-price"
                ).value,

              image:
                document.getElementById(
                  "product-image"
                ).value

            })
        }
      );

    const data =
      await response.json();

    if(
      !response.ok ||
      !data.ok
    ){

      throw new Error(
        data.error ||
        "افزودن محصول انجام نشد."
      );
    }

    result.innerHTML =
      '<div class="card">' +
      'محصول با موفقیت اضافه شد.' +
      '</div>';

    document.getElementById(
      "product-name"
    ).value = "";

    document.getElementById(
      "product-description"
    ).value = "";

    document.getElementById(
      "product-price"
    ).value = "";

    loadAdminProducts();

  }catch(error){

    result.innerHTML =
      '<div class="error-box">' +
      escapeClient(
        error.message
      ) +
      '</div>';
  }
}

async function loadAdminProducts(){

  const box =
    document.getElementById(
      "admin-products"
    );

  try{

    const response =
      await fetch(
        "/api/admin/products",
        {
          cache:"no-store"
        }
      );

    const data =
      await response.json();

    if(
      !response.ok ||
      !data.ok
    ){

      throw new Error(
        data.error ||
        "خطا در دریافت محصولات."
      );
    }

    const products =
      Array.isArray(data.products)
        ? data.products
        : [];

    if(!products.length){

      box.innerHTML =
        "محصولی وجود ندارد.";

      return;
    }

    box.innerHTML =
      products.map(
        function(product){

          return \`

            <div class="order">

              <div class="order-row">

                <strong>
                  \${escapeClient(
                    product.name
                  )}
                </strong>

                <strong>
                  \${priceClient(
                    product.price
                  )}
                </strong>

              </div>

              <button
                class="btn btn-light"
                onclick="deleteProduct(
                  \${Number(product.id)}
                )"
              >
                حذف
              </button>

            </div>

          \`;

        }
      ).join("");

  }catch(error){

    box.innerHTML =
      '<div class="error-box">' +
      escapeClient(
        error.message
      ) +
      '</div>';
  }
}

async function deleteProduct(id){

  if(
    !confirm(
      "آیا از حذف این محصول مطمئن هستید؟"
    )
  ){
    return;
  }

  try{

    const response =
      await fetch(
        "/api/admin/products",
        {
          method:"DELETE",
          headers:{
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              product_id:id
            })
        }
      );

    const data =
      await response.json();

    if(
      !response.ok ||
      !data.ok
    ){

      throw new Error(
        data.error ||
        "حذف انجام نشد."
      );
    }

    loadAdminProducts();

  }catch(error){

    alert(error.message);
  }
}

async function loadAdminOrders(){

  const box =
    document.getElementById(
      "admin-orders"
    );

  try{

    const response =
      await fetch(
        "/api/admin/orders",
        {
          cache:"no-store"
        }
      );

    const data =
      await response.json();

    if(
      !response.ok ||
      !data.ok
    ){

      throw new Error(
        data.error ||
        "خطا در دریافت سفارش‌ها."
      );
    }

    const orders =
      Array.isArray(data.orders)
        ? data.orders
        : [];

    if(!orders.length){

      box.innerHTML =
        "هنوز سفارشی ثبت نشده است.";

      return;
    }

    box.innerHTML =
      orders.map(
        function(order){

          return \`

            <div class="order">

              <div class="order-row">

                <strong>
                  \${escapeClient(
                    order.name ||
                    "محصول"
                  )}
                </strong>

                <strong>
                  \${priceClient(
                    order.price
                  )}
                </strong>

              </div>

              <div>
                کاربر:
                \${escapeClient(
                  order.username ||
                  "-"
                )}
              </div>

              <div>
                ایمیل:
                \${escapeClient(
                  order.email ||
                  "-"
                )}
              </div>

              <div class="order-row">

                <span>
                  وضعیت:
                  \${statusLabel(
                    order.status
                  )}
                </span>

                <select
                  onchange="changeOrderStatus(
                    '\${escapeClient(
                      order.id
                    )}',
                    this.value
                  )"
                >

                  <option
                    value="pending"
                    \${order.status === "pending"
                      ? "selected"
                      : ""}
                  >
                    در انتظار بررسی
                  </option>

                  <option
                    value="paid"
                    \${order.status === "paid"
                      ? "selected"
                      : ""}
                  >
                    پرداخت شده
                  </option>

                  <option
                    value="completed"
                    \${order.status === "completed"
                      ? "selected"
                      : ""}
                  >
                    تکمیل شده
                  </option>

                  <option
                    value="cancelled"
                    \${order.status === "cancelled"
                      ? "selected"
                      : ""}
                  >
                    لغو شده
                  </option>

                </select>

              </div>

            </div>

          \`;

        }
      ).join("");

  }catch(error){

    box.innerHTML =
      '<div class="error-box">' +
      escapeClient(
        error.message
      ) +
      '</div>';
  }
}

async function changeOrderStatus(
  orderId,
  status
){

  try{

    const response =
      await fetch(
        "/api/admin/orders/status",
        {
          method:"POST",
          headers:{
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              order_id:
                orderId,
              status:
                status
            })
        }
      );

    const data =
      await response.json();

    if(
      !response.ok ||
      !data.ok
    ){

      throw new Error(
        data.error ||
        "تغییر وضعیت انجام نشد."
      );
    }

    loadAdminOrders();

  }catch(error){

    alert(error.message);
  }
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

function normalizeDigitsClient(value){

  return String(value ?? "")
    .replace(
      /[۰-۹]/g,
      function(d){
        return String(
          "۰۱۲۳۴۵۶۷۸۹".indexOf(d)
        );
      }
    )
    .replace(
      /[٠-٩]/g,
      function(d){
        return String(
          "٠١٢٣٤٥٦٧٨٩".indexOf(d)
        );
      }
    );
}

function priceClient(value){

  let text =
    normalizeDigitsClient(value)
      .replace(/[٬,]/g,"")
      .replace(/تومان/gi,"")
      .replace(/تومن/gi,"")
      .replace(/[^\\d.-]/g,"");

  const number =
    Number(text);

  if(
    !Number.isFinite(number) ||
    number <= 0
  ){
    return "قیمت نامشخص";
  }

  return (
    number.toLocaleString("fa-IR") +
    " تومان"
  );
}

function statusLabel(status){

  const map = {
    pending:
      "در انتظار بررسی",
    paid:
      "پرداخت شده",
    completed:
      "تکمیل شده",
    cancelled:
      "لغو شده"
  };

  return (
    map[status] ||
    status
  );
}

function escapeClient(value){

  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

checkAdmin();

</script>
`;

  return basePage(
    "مدیریت | دیجی‌ماریکسو",
    content,
    scripts
  );
}


/* =========================================================
   404
========================================================= */

function notFoundPage(){

  return basePage(
    "صفحه پیدا نشد | دیجی‌ماریکسو",

    `
      <section class="hero">

        <div class="eyebrow">
          404
        </div>

        <h1>
          صفحه پیدا نشد
        </h1>

        <p>
          صفحه موردنظر وجود ندارد یا آدرس آن اشتباه است.
        </p>

        <div class="actions">

          <a
            class="btn btn-dark"
            href="/"
          >
            بازگشت به فروشگاه
          </a>

        </div>

      </section>
    `
  );
}
