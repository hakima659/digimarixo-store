const STORE_NAME = "دیجی‌ماریکسو";
const STORE_EN = "DigiMarixo";

const COOKIE_NAME = "dm_supplier_session";
const SESSION_DAYS = 7;

const STATUS_VALUES = [
  "جدید",
  "در حال آماده‌سازی",
  "آماده ارسال",
  "ارسال شد",
  "تحویل شد",
  "لغو شد"
];

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

      // =========================
      // PUBLIC API
      // =========================

      if (path === "/api/products" && method === "GET") {
        return json(await getProducts(env));
      }

      if (path.startsWith("/api/products/") && method === "GET") {
        const id = path.split("/").pop();
        return json(await getProduct(env, id));
      }

      if (path === "/api/suppliers" && method === "GET") {
        return json(await getSuppliers(env));
      }

      if (path === "/api/orders" && method === "POST") {
        return json(await createOrder(request, env));
      }

      // =========================
      // ADMIN API
      // =========================

      if (path === "/api/admin/suppliers" && method === "POST") {
        requireAdmin(request, env);
        return json(await createSupplier(request, env));
      }

      if (path === "/api/admin/suppliers" && method === "PUT") {
        requireAdmin(request, env);
        return json(await updateSupplier(request, env));
      }

      if (path === "/api/admin/products" && method === "POST") {
        requireAdmin(request, env);
        return json(await createProduct(request, env));
      }

      if (path === "/api/admin/products" && method === "PUT") {
        requireAdmin(request, env);
        return json(await updateProduct(request, env));
      }

      if (path === "/api/admin/orders/status" && method === "PUT") {
        requireAdmin(request, env);
        return json(await updateOrderStatus(request, env));
      }

      if (path === "/api/orders" && method === "GET") {
        requireAdmin(request, env);
        return json(await getOrders(env));
      }

      // =========================
      // SUPPLIER API
      // =========================

      if (path === "/api/supplier/login" && method === "POST") {
        return json(await supplierLogin(request, env));
      }

      if (path === "/api/supplier/logout" && method === "POST") {
        return json(await supplierLogout(request, env));
      }

      if (path === "/api/supplier/orders" && method === "GET") {
        return json(await getSupplierOrders(request, env));
      }

      if (path === "/api/supplier/orders/status" && method === "PUT") {
        return json(await updateSupplierOrderStatus(request, env));
      }

      if (path === "/api/supplier/orders/tracking" && method === "PUT") {
        return json(await updateSupplierTracking(request, env));
      }

      // =========================
      // PUBLIC PAGES
      // =========================

      if (path === "/account") {
        return html(accountPage());
      }

      if (path === "/cart") {
        return html(cartPage());
      }

      if (path === "/supplier") {
        return html(await supplierPage(request, env));
      }

      if (path === "/admin") {
        if (!isBasicAdmin(request, env)) {
          return basicAuthResponse();
        }

        return html(await adminPage(env));
      }

      if (path === "/products") {
        const id = url.searchParams.get("id");

        if (id) {
          const result = await getProduct(env, id);

          if (!result.ok) {
            return html(
              layout(
                "محصول پیدا نشد",
                `
                <div class="container section">
                  <div class="empty">
                    <h2>محصول پیدا نشد</h2>
                    <a class="btn" href="/products">بازگشت به محصولات</a>
                  </div>
                </div>
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


// ============================================================
// DATABASE
// ============================================================

async function initDB(env) {
  if (!env.DB) {
    throw new Error("D1 binding DB is not configured");
  }

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      direct_shipping INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      login_email TEXT,
      password_hash TEXT
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price REAL DEFAULT 0,
      image TEXT,
      category TEXT,
      stock INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      supplier_id TEXT,
      supplier_price REAL DEFAULT 0,
      commission REAL DEFAULT 0
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_email TEXT,
      customer_phone TEXT NOT NULL,
      address TEXT NOT NULL,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'در حال بررسی',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      supplier_id TEXT,
      supplier_status TEXT DEFAULT 'در انتظار فروشنده',
      shipping_status TEXT DEFAULT 'در انتظار ارسال'
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      supplier_id TEXT,
      quantity INTEGER NOT NULL,
      price REAL DEFAULT 0,
      supplier_price REAL DEFAULT 0,
      commission REAL DEFAULT 0
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS supplier_orders (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      status TEXT DEFAULT 'جدید',
      shipping_status TEXT DEFAULT 'در انتظار ارسال',
      supplier_note TEXT,
      tracking_code TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      name TEXT,
      rating INTEGER DEFAULT 5,
      comment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS supplier_sessions (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // ----------------------------------------------------------
  // Safe migrations for older DigiMarixo databases
  // ----------------------------------------------------------

  await ensureColumn(env, "suppliers", "login_email", "TEXT");
  await ensureColumn(env, "suppliers", "password_hash", "TEXT");

  await ensureColumn(env, "products", "supplier_id", "TEXT");
  await ensureColumn(env, "products", "supplier_price", "REAL DEFAULT 0");
  await ensureColumn(env, "products", "commission", "REAL DEFAULT 0");
  await ensureColumn(env, "products", "category", "TEXT");
  await ensureColumn(env, "products", "stock", "INTEGER DEFAULT 0");

  await ensureColumn(env, "orders", "supplier_id", "TEXT");
  await ensureColumn(env, "orders", "supplier_status", "TEXT DEFAULT 'در انتظار فروشنده'");
  await ensureColumn(env, "orders", "shipping_status", "TEXT DEFAULT 'در انتظار ارسال'");

  await ensureColumn(env, "order_items", "supplier_id", "TEXT");
  await ensureColumn(env, "order_items", "supplier_price", "REAL DEFAULT 0");
  await ensureColumn(env, "order_items", "commission", "REAL DEFAULT 0");

  await ensureColumn(env, "supplier_orders", "status", "TEXT DEFAULT 'جدید'");
  await ensureColumn(env, "supplier_orders", "shipping_status", "TEXT DEFAULT 'در انتظار ارسال'");
  await ensureColumn(env, "supplier_orders", "supplier_note", "TEXT");
  await ensureColumn(env, "supplier_orders", "tracking_code", "TEXT");
  await ensureColumn(env, "supplier_orders", "updated_at", "TEXT DEFAULT CURRENT_TIMESTAMP");

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_products_supplier
    ON products(supplier_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_orders_supplier
    ON orders(supplier_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_order_items_order
    ON order_items(order_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_supplier_orders_supplier
    ON supplier_orders(supplier_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_supplier_orders_order
    ON supplier_orders(order_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_supplier_sessions_token
    ON supplier_sessions(token_hash)
  `).run();
}


async function ensureColumn(env, table, column, definition) {
  const allowed = {
    suppliers: ["login_email", "password_hash"],
    products: ["supplier_id", "supplier_price", "commission", "category", "stock"],
    orders: ["supplier_id", "supplier_status", "shipping_status"],
    order_items: ["supplier_id", "supplier_price", "commission"],
    supplier_orders: [
      "status",
      "shipping_status",
      "supplier_note",
      "tracking_code",
      "updated_at"
    ]
  };

  if (!allowed[table] || !allowed[table].includes(column)) {
    throw new Error("Invalid migration column");
  }

  const result = await env.DB
    .prepare("PRAGMA table_info(" + table + ")")
    .all();

  const rows = result.results || [];

  const exists = rows.some(function(row) {
    return row.name === column;
  });

  if (!exists) {
    await env.DB.prepare(
      "ALTER TABLE " +
      table +
      " ADD COLUMN " +
      column +
      " " +
      definition
    ).run();
  }
}


// ============================================================
// BASIC HELPERS
// ============================================================

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}


function html(content, status = 200) {
  return new Response(content, {
    status,
    headers: {
      "content-type": "text/html; charset=UTF-8",
      "cache-control": "no-store"
    }
  });
}


function safeError(error) {
  if (!error) return "Unknown error";

  const message = String(error.message || error);

  return message
    .replace(/ADMIN_PASSWORD/gi, "SECRET")
    .slice(0, 1000);
}


function makeId(prefix) {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    "_" +
    crypto.randomUUID().replace(/-/g, "").slice(0, 12)
  );
}


function escapeHTML(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}


function toInt(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}


function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}


function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}


// ============================================================
// ADMIN AUTH
// ============================================================

function isBasicAdmin(request, env) {
  const header = request.headers.get("Authorization");

  if (!header || !header.startsWith("Basic ")) {
    return false;
  }

  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");

    if (separator < 0) return false;

    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);

    return (
      username === "مدیر" &&
      password === String(env.ADMIN_PASSWORD || "")
    );
  } catch {
    return false;
  }
}


function requireAdmin(request, env) {
  const header = request.headers.get("X-Admin-Password");

  if (!env.ADMIN_PASSWORD || header !== env.ADMIN_PASSWORD) {
    throw new Response(
      JSON.stringify({
        ok: false,
        error: "Unauthorized"
      }),
      {
        status: 401,
        headers: {
          "content-type": "application/json; charset=UTF-8"
        }
      }
    );
  }
}


function basicAuthResponse() {
  return new Response(
    "DigiMarixo Admin",
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="DigiMarixo Admin"',
        "content-type": "text/plain; charset=UTF-8"
      }
    }
  );
}


// ============================================================
// PASSWORD / SESSION
// ============================================================

function bytesToBase64Url(bytes) {
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


function base64UrlToBytes(value) {
  let base64 = String(value)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  while (base64.length % 4) {
    base64 += "=";
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}


async function sha256Bytes(data) {
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(buffer);
}


async function sha256Text(text) {
  return sha256Bytes(
    new TextEncoder().encode(String(text))
  );
}


async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password)),
    {
      name: "PBKDF2"
    },
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    material,
    256
  );

  return (
    "pbkdf2$100000$" +
    bytesToBase64Url(salt) +
    "$" +
    bytesToBase64Url(new Uint8Array(bits))
  );
}


function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}


async function verifyPassword(password, stored) {
  if (!stored || !String(stored).startsWith("pbkdf2$")) {
    return false;
  }

  const parts = String(stored).split("$");

  if (parts.length !== 4) return false;

  const iterations = Number(parts[1]);

  if (!Number.isFinite(iterations) || iterations < 10000) {
    return false;
  }

  let salt;
  let expected;

  try {
    salt = base64UrlToBytes(parts[2]);
    expected = base64UrlToBytes(parts[3]);
  } catch {
    return false;
  }

  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password)),
    {
      name: "PBKDF2"
    },
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    },
    material,
    256
  );

  return timingSafeEqual(
    expected,
    new Uint8Array(bits)
  );
}


function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const result = {};

  header.split(";").forEach(function(part) {
    const index = part.indexOf("=");

    if (index < 0) return;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    if (key) {
      result[key] = decodeURIComponent(value);
    }
  });

  return result;
}


async function createSupplierSession(env, supplierId) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = bytesToBase64Url(tokenBytes);

  const hash = await sha256Text(token);
  const tokenHash = bytesToBase64Url(hash);

  const id = makeId("ss");
  const expiresAt = nowSeconds() + SESSION_DAYS * 86400;

  await env.DB.prepare(`
    DELETE FROM supplier_sessions
    WHERE supplier_id = ?
  `).bind(supplierId).run();

  await env.DB.prepare(`
    INSERT INTO supplier_sessions
    (
      id,
      supplier_id,
      token_hash,
      expires_at
    )
    VALUES (?, ?, ?, ?)
  `).bind(
    id,
    supplierId,
    tokenHash,
    expiresAt
  ).run();

  return token;
}


async function getSupplierFromSession(request, env) {
  const cookies = parseCookies(request);
  const token = cookies[COOKIE_NAME];

  if (!token) return null;

  const hash = await sha256Text(token);
  const tokenHash = bytesToBase64Url(hash);

  const result = await env.DB.prepare(`
    SELECT
      s.id,
      s.name,
      s.phone,
      s.email,
      s.address,
      s.direct_shipping,
      s.active,
      s.login_email
    FROM supplier_sessions ss
    JOIN suppliers s
      ON s.id = ss.supplier_id
    WHERE ss.token_hash = ?
      AND ss.expires_at > ?
      AND s.active = 1
    LIMIT 1
  `).bind(
    tokenHash,
    nowSeconds()
  ).first();

  return result || null;
}


function supplierCookie(token) {
  return (
    COOKIE_NAME +
    "=" +
    encodeURIComponent(token) +
    "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=" +
    (SESSION_DAYS * 86400)
  );
}


function clearSupplierCookie() {
  return (
    COOKIE_NAME +
    "=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
  );
}


// ============================================================
// PRODUCTS
// ============================================================

async function getProducts(env) {
  const result = await env.DB.prepare(`
    SELECT
      p.id,
      p.name,
      p.description,
      p.price,
      p.image,
      p.category,
      p.stock,
      p.active,
      p.created_at,
      p.supplier_id,
      s.name AS supplier_name,
      s.direct_shipping
    FROM products p
    LEFT JOIN suppliers s
      ON s.id = p.supplier_id
    WHERE p.active = 1
    ORDER BY p.created_at DESC
  `).all();

  return {
    ok: true,
    products: result.results || []
  };
}


async function getProduct(env, id) {
  const product = await env.DB.prepare(`
    SELECT
      p.id,
      p.name,
      p.description,
      p.price,
      p.image,
      p.category,
      p.stock,
      p.active,
      p.created_at,
      p.supplier_id,
      s.name AS supplier_name,
      s.direct_shipping
    FROM products p
    LEFT JOIN suppliers s
      ON s.id = p.supplier_id
    WHERE p.id = ?
      AND p.active = 1
    LIMIT 1
  `).bind(id).first();

  if (!product) {
    return {
      ok: false,
      error: "Product not found"
    };
  }

  return {
    ok: true,
    product
  };
}


// ============================================================
// SUPPLIERS
// ============================================================

async function getSuppliers(env) {
  const result = await env.DB.prepare(`
    SELECT
      id,
      name,
      active,
      direct_shipping
    FROM suppliers
    WHERE active = 1
    ORDER BY name ASC
  `).all();

  return {
    ok: true,
    suppliers: result.results || []
  };
}


async function createSupplier(request, env) {
  const body = await request.json();

  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim();
  const address = String(body.address || "").trim();

  const loginEmail = normalizeEmail(body.login_email);
  const password = String(body.password || "");

  const directShipping = body.direct_shipping === false ? 0 : 1;
  const active = body.active === false ? 0 : 1;

  if (!name) {
    return {
      ok: false,
      error: "نام تأمین‌کننده الزامی است"
    };
  }

  if (loginEmail) {
    const duplicate = await env.DB.prepare(`
      SELECT id
      FROM suppliers
      WHERE lower(login_email) = ?
      LIMIT 1
    `).bind(loginEmail).first();

    if (duplicate) {
      return {
        ok: false,
        error: "این ایمیل ورود قبلاً ثبت شده است"
      };
    }
  }

  if (loginEmail && password.length < 6) {
    return {
      ok: false,
      error: "رمز عبور باید حداقل ۶ کاراکتر باشد"
    };
  }

  const id = makeId("sup");

  let passwordHash = null;

  if (password) {
    passwordHash = await hashPassword(password);
  }

  await env.DB.prepare(`
    INSERT INTO suppliers
    (
      id,
      name,
      phone,
      email,
      address,
      direct_shipping,
      active,
      login_email,
      password_hash
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    name,
    phone,
    email,
    address,
    directShipping,
    active,
    loginEmail || null,
    passwordHash
  ).run();

  return {
    ok: true,
    supplier_id: id
  };
}


async function updateSupplier(request, env) {
  const body = await request.json();

  const id = String(body.id || "").trim();

  if (!id) {
    return {
      ok: false,
      error: "شناسه تأمین‌کننده الزامی است"
    };
  }

  const current = await env.DB.prepare(`
    SELECT *
    FROM suppliers
    WHERE id = ?
    LIMIT 1
  `).bind(id).first();

  if (!current) {
    return {
      ok: false,
      error: "تأمین‌کننده پیدا نشد"
    };
  }

  const name = String(
    body.name == null ? current.name : body.name
  ).trim();

  const phone = String(
    body.phone == null ? current.phone || "" : body.phone
  ).trim();

  const email = String(
    body.email == null ? current.email || "" : body.email
  ).trim();

  const address = String(
    body.address == null ? current.address || "" : body.address
  ).trim();

  const loginEmail = normalizeEmail(
    body.login_email == null
      ? current.login_email || ""
      : body.login_email
  );

  const directShipping =
    body.direct_shipping == null
      ? Number(current.direct_shipping || 0)
      : body.direct_shipping ? 1 : 0;

  const active =
    body.active == null
      ? Number(current.active || 0)
      : body.active ? 1 : 0;

  if (!name) {
    return {
      ok: false,
      error: "نام تأمین‌کننده الزامی است"
    };
  }

  if (loginEmail) {
    const duplicate = await env.DB.prepare(`
      SELECT id
      FROM suppliers
      WHERE lower(login_email) = ?
        AND id != ?
      LIMIT 1
    `).bind(
      loginEmail,
      id
    ).first();

    if (duplicate) {
      return {
        ok: false,
        error: "این ایمیل ورود قبلاً استفاده شده است"
      };
    }
  }

  let passwordHash = current.password_hash || null;

  if (body.password != null && String(body.password) !== "") {
    const password = String(body.password);

    if (password.length < 6) {
      return {
        ok: false,
        error: "رمز عبور باید حداقل ۶ کاراکتر باشد"
      };
    }

    passwordHash = await hashPassword(password);
  }

  await env.DB.prepare(`
    UPDATE suppliers
    SET
      name = ?,
      phone = ?,
      email = ?,
      address = ?,
      direct_shipping = ?,
      active = ?,
      login_email = ?,
      password_hash = ?
    WHERE id = ?
  `).bind(
    name,
    phone,
    email,
    address,
    directShipping,
    active,
    loginEmail || null,
    passwordHash,
    id
  ).run();

  return {
    ok: true
  };
}


// ============================================================
// ADMIN PRODUCTS
// ============================================================

async function createProduct(request, env) {
  const body = await request.json();

  const name = String(body.name || "").trim();

  if (!name) {
    return {
      ok: false,
      error: "نام محصول الزامی است"
    };
  }

  const id = makeId("prd");

  const price = Math.max(0, toNumber(body.price));
  const stock = Math.max(0, toInt(body.stock));
  const supplierPrice = Math.max(0, toNumber(body.supplier_price));
  const commission = Math.max(0, toNumber(body.commission));

  const active = body.active === false ? 0 : 1;

  await env.DB.prepare(`
    INSERT INTO products
    (
      id,
      name,
      description,
      price,
      image,
      category,
      stock,
      active,
      supplier_id,
      supplier_price,
      commission
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    name,
    String(body.description || ""),
    price,
    String(body.image || ""),
    String(body.category || ""),
    stock,
    active,
    body.supplier_id ? String(body.supplier_id) : null,
    supplierPrice,
    commission
  ).run();

  return {
    ok: true,
    product_id: id
  };
}


async function updateProduct(request, env) {
  const body = await request.json();

  const id = String(body.id || "").trim();

  if (!id) {
    return {
      ok: false,
      error: "شناسه محصول الزامی است"
    };
  }

  const current = await env.DB.prepare(`
    SELECT *
    FROM products
    WHERE id = ?
    LIMIT 1
  `).bind(id).first();

  if (!current) {
    return {
      ok: false,
      error: "محصول پیدا نشد"
    };
  }

  await env.DB.prepare(`
    UPDATE products
    SET
      name = ?,
      description = ?,
      price = ?,
      image = ?,
      category = ?,
      stock = ?,
      active = ?,
      supplier_id = ?,
      supplier_price = ?,
      commission = ?
    WHERE id = ?
  `).bind(
    String(body.name == null ? current.name : body.name),
    String(body.description == null ? current.description || "" : body.description),
    Math.max(0, toNumber(body.price == null ? current.price : body.price)),
    String(body.image == null ? current.image || "" : body.image),
    String(body.category == null ? current.category || "" : body.category),
    Math.max(0, toInt(body.stock == null ? current.stock : body.stock)),
    body.active == null
      ? Number(current.active || 0)
      : body.active ? 1 : 0,
    body.supplier_id == null
      ? current.supplier_id || null
      : String(body.supplier_id),
    Math.max(
      0,
      toNumber(
        body.supplier_price == null
          ? current.supplier_price
          : body.supplier_price
      )
    ),
    Math.max(
      0,
      toNumber(
        body.commission == null
          ? current.commission
          : body.commission
      )
    ),
    id
  ).run();

  return {
    ok: true
  };
}


// ============================================================
// ORDERS
// ============================================================

async function createOrder(request, env) {
  const body = await request.json();

  const customerName = String(body.customer_name || "").trim();
  const customerEmail = String(body.customer_email || "").trim();
  const customerPhone = String(body.customer_phone || "").trim();
  const address = String(body.address || "").trim();

  const items = Array.isArray(body.items)
    ? body.items
    : [];

  if (!customerName || !customerPhone || !address) {
    return {
      ok: false,
      error: "نام، شماره تلفن و آدرس الزامی است"
    };
  }

  if (!items.length) {
    return {
      ok: false,
      error: "سبد خرید خالی است"
    };
  }

  const normalizedItems = [];
  const supplierGroups = new Map();

  let total = 0;

  for (const rawItem of items) {
    const productId = String(rawItem.productId || rawItem.id || "").trim();
    const quantity = Math.max(
      1,
      toInt(rawItem.quantity, 1)
    );

    if (!productId) {
      return {
        ok: false,
        error: "شناسه محصول نامعتبر است"
      };
    }

    const product = await env.DB.prepare(`
      SELECT
        p.id,
        p.name,
        p.price,
        p.stock,
        p.active,
        p.supplier_id,
        p.supplier_price,
        p.commission,
        s.name AS supplier_name,
        s.active AS supplier_active,
        s.direct_shipping
      FROM products p
      LEFT JOIN suppliers s
        ON s.id = p.supplier_id
      WHERE p.id = ?
      LIMIT 1
    `).bind(productId).first();

    if (!product) {
      return {
        ok: false,
        error: "محصول پیدا نشد: " + productId
      };
    }

    if (!Number(product.active)) {
      return {
        ok: false,
        error: "این محصول فعال نیست: " + product.name
      };
    }

    if (!product.supplier_id) {
      return {
        ok: false,
        error: "برای محصول تأمین‌کننده تعیین نشده است: " + product.name
      };
    }

    if (!Number(product.supplier_active)) {
      return {
        ok: false,
        error: "تأمین‌کننده این محصول فعال نیست"
      };
    }

    if (!Number(product.direct_shipping)) {
      return {
        ok: false,
        error: "ارسال مستقیم برای این تأمین‌کننده فعال نیست"
      };
    }

    if (Number(product.stock) < quantity) {
      return {
        ok: false,
        error: "موجودی محصول کافی نیست: " + product.name
      };
    }

    const price = Math.max(0, toNumber(product.price));
    const supplierPrice = Math.max(
      0,
      toNumber(product.supplier_price)
    );

    const commission = Math.max(
      0,
      toNumber(product.commission)
    );

    total += price * quantity;

    normalizedItems.push({
      productId: product.id,
      supplierId: product.supplier_id,
      quantity,
      price,
      supplierPrice,
      commission
    });

    if (!supplierGroups.has(product.supplier_id)) {
      supplierGroups.set(product.supplier_id, []);
    }

    supplierGroups
      .get(product.supplier_id)
      .push(product.id);
  }

  const orderId = makeId("ord");

  const firstSupplier =
    normalizedItems.length === 1
      ? normalizedItems[0].supplierId
      : null;

  await env.DB.prepare(`
    INSERT INTO orders
    (
      id,
      customer_name,
      customer_email,
      customer_phone,
      address,
      total,
      status,
      supplier_id,
      supplier_status,
      shipping_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    orderId,
    customerName,
    customerEmail,
    customerPhone,
    address,
    total,
    "در حال بررسی",
    firstSupplier,
    "در انتظار فروشنده",
    "در انتظار ارسال"
  ).run();

  for (const item of normalizedItems) {
    const itemId = makeId("itm");

    await env.DB.prepare(`
      INSERT INTO order_items
      (
        id,
        order_id,
        product_id,
        supplier_id,
        quantity,
        price,
        supplier_price,
        commission
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      itemId,
      orderId,
      item.productId,
      item.supplierId,
      item.quantity,
      item.price,
      item.supplierPrice,
      item.commission
    ).run();

    const stockUpdate = await env.DB.prepare(`
      UPDATE products
      SET stock = stock - ?
      WHERE id = ?
        AND stock >= ?
    `).bind(
      item.quantity,
      item.productId,
      item.quantity
    ).run();

    if (!stockUpdate.meta || Number(stockUpdate.meta.changes || 0) < 1) {
      return {
        ok: false,
        error: "موجودی محصول هنگام ثبت سفارش کافی نبود"
      };
    }
  }

  for (const supplierId of supplierGroups.keys()) {
    const supplierOrderId = makeId("so");

    await env.DB.prepare(`
      INSERT INTO supplier_orders
      (
        id,
        order_id,
        supplier_id,
        status,
        shipping_status,
        supplier_note,
        tracking_code
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      supplierOrderId,
      orderId,
      supplierId,
      "جدید",
      "در انتظار ارسال",
      "",
      ""
    ).run();
  }

  return {
    ok: true,
    order_id: orderId,
    total,
    suppliers: supplierGroups.size
  };
}


async function getOrders(env) {
  const ordersResult = await env.DB.prepare(`
    SELECT
      id,
      customer_name,
      customer_email,
      customer_phone,
      address,
      total,
      status,
      created_at,
      supplier_id,
      supplier_status,
      shipping_status
    FROM orders
    ORDER BY created_at DESC
  `).all();

  const orders = ordersResult.results || [];

  for (const order of orders) {
    const itemsResult = await env.DB.prepare(`
      SELECT
        oi.id,
        oi.product_id,
        oi.supplier_id,
        oi.quantity,
        oi.price,
        oi.supplier_price,
        oi.commission,
        p.name AS product_name,
        s.name AS supplier_name
      FROM order_items oi
      LEFT JOIN products p
        ON p.id = oi.product_id
      LEFT JOIN suppliers s
        ON s.id = oi.supplier_id
      WHERE oi.order_id = ?
    `).bind(order.id).all();

    order.items = itemsResult.results || [];

    const supplierOrdersResult = await env.DB.prepare(`
      SELECT
        so.id,
        so.supplier_id,
        so.status,
        so.shipping_status,
        so.supplier_note,
        so.tracking_code,
        so.created_at,
        so.updated_at,
        s.name AS supplier_name
      FROM supplier_orders so
      LEFT JOIN suppliers s
        ON s.id = so.supplier_id
      WHERE so.order_id = ?
      ORDER BY so.created_at ASC
    `).bind(order.id).all();

    order.supplier_orders =
      supplierOrdersResult.results || [];
  }

  return {
    ok: true,
    orders
  };
}


async function updateOrderStatus(request, env) {
  const body = await request.json();

  const id = String(body.id || "").trim();

  if (!id) {
    return {
      ok: false,
      error: "شناسه سفارش الزامی است"
    };
  }

  const status = String(
    body.status || "در حال بررسی"
  );

  const supplierStatus = String(
    body.supplier_status || "در انتظار فروشنده"
  );

  const shippingStatus = String(
    body.shipping_status || "در انتظار ارسال"
  );

  await env.DB.prepare(`
    UPDATE orders
    SET
      status = ?,
      supplier_status = ?,
      shipping_status = ?
    WHERE id = ?
  `).bind(
    status,
    supplierStatus,
    shippingStatus,
    id
  ).run();

  return {
    ok: true
  };
}


// ============================================================
// SUPPLIER LOGIN
// ============================================================

async function supplierLogin(request, env) {
  const body = await request.json();

  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (!email || !password) {
    return {
      ok: false,
      error: "ایمیل و رمز عبور الزامی است"
    };
  }

  const supplier = await env.DB.prepare(`
    SELECT
      id,
      name,
      phone,
      email,
      address,
      active,
      login_email,
      password_hash
    FROM suppliers
    WHERE lower(login_email) = ?
    LIMIT 1
  `).bind(email).first();

  if (!supplier || !Number(supplier.active)) {
    return {
      ok: false,
      error: "اطلاعات ورود صحیح نیست"
    };
  }

  const valid = await verifyPassword(
    password,
    supplier.password_hash
  );

  if (!valid) {
    return {
      ok: false,
      error: "اطلاعات ورود صحیح نیست"
    };
  }

  const token = await createSupplierSession(
    env,
    supplier.id
  );

  return new Response(
    JSON.stringify({
      ok: true,
      supplier: {
        id: supplier.id,
        name: supplier.name,
        login_email: supplier.login_email
      }
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "cache-control": "no-store",
        "Set-Cookie": supplierCookie(token)
      }
    }
  );
}


async function supplierLogout(request, env) {
  const cookies = parseCookies(request);
  const token = cookies[COOKIE_NAME];

  if (token) {
    const hash = await sha256Text(token);
    const tokenHash = bytesToBase64Url(hash);

    await env.DB.prepare(`
      DELETE FROM supplier_sessions
      WHERE token_hash = ?
    `).bind(tokenHash).run();
  }

  return new Response(
    JSON.stringify({
      ok: true
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "cache-control": "no-store",
        "Set-Cookie": clearSupplierCookie()
      }
    }
  );
}


// ============================================================
// SUPPLIER ORDERS
// ============================================================

async function getSupplierOrders(request, env) {
  const supplier = await getSupplierFromSession(
    request,
    env
  );

  if (!supplier) {
    return {
      ok: false,
      error: "لطفاً وارد حساب تأمین‌کننده شوید",
      unauthorized: true
    };
  }

  const result = await env.DB.prepare(`
    SELECT
      so.id AS supplier_order_id,
      so.order_id,
      so.status AS supplier_order_status,
      so.shipping_status,
      so.supplier_note,
      so.tracking_code,
      so.created_at AS supplier_order_created_at,
      so.updated_at,
      o.customer_name,
      o.customer_email,
      o.customer_phone,
      o.address,
      o.total,
      o.status AS order_status,
      o.created_at AS order_created_at
    FROM supplier_orders so
    JOIN orders o
      ON o.id = so.order_id
    WHERE so.supplier_id = ?
    ORDER BY so.created_at DESC
  `).bind(supplier.id).all();

  const orders = result.results || [];

  for (const order of orders) {
    const items = await env.DB.prepare(`
      SELECT
        oi.id,
        oi.product_id,
        oi.quantity,
        oi.price,
        p.name AS product_name,
        p.image
      FROM order_items oi
      LEFT JOIN products p
        ON p.id = oi.product_id
      WHERE oi.order_id = ?
        AND oi.supplier_id = ?
      ORDER BY oi.id ASC
    `).bind(
      order.order_id,
      supplier.id
    ).all();

    order.items = items.results || [];
  }

  return {
    ok: true,
    supplier,
    orders
  };
}


async function updateSupplierOrderStatus(request, env) {
  const supplier = await getSupplierFromSession(
    request,
    env
  );

  if (!supplier) {
    return {
      ok: false,
      unauthorized: true,
      error: "جلسه ورود معتبر نیست"
    };
  }

  const body = await request.json();

  const supplierOrderId =
    String(body.supplier_order_id || "").trim();

  if (!supplierOrderId) {
    return {
      ok: false,
      error: "شناسه سفارش تأمین‌کننده الزامی است"
    };
  }

  let status = String(
    body.status || "جدید"
  );

  let shippingStatus = String(
    body.shipping_status || "در انتظار ارسال"
  );

  if (!STATUS_VALUES.includes(status)) {
    status = "جدید";
  }

  const note = String(
    body.supplier_note || ""
  ).slice(0, 2000);

  const current = await env.DB.prepare(`
    SELECT
      id,
      order_id
    FROM supplier_orders
    WHERE id = ?
      AND supplier_id = ?
    LIMIT 1
  `).bind(
    supplierOrderId,
    supplier.id
  ).first();

  if (!current) {
    return {
      ok: false,
      error: "سفارش پیدا نشد"
    };
  }

  await env.DB.prepare(`
    UPDATE supplier_orders
    SET
      status = ?,
      shipping_status = ?,
      supplier_note = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND supplier_id = ?
  `).bind(
    status,
    shippingStatus,
    note,
    supplierOrderId,
    supplier.id
  ).run();

  await env.DB.prepare(`
    UPDATE orders
    SET
      supplier_status = ?,
      shipping_status = ?
    WHERE id = ?
  `).bind(
    status,
    shippingStatus,
    current.order_id
  ).run();

  return {
    ok: true
  };
}


async function updateSupplierTracking(request, env) {
  const supplier = await getSupplierFromSession(
    request,
    env
  );

  if (!supplier) {
    return {
      ok: false,
      unauthorized: true,
      error: "جلسه ورود معتبر نیست"
    };
  }

  const body = await request.json();

  const supplierOrderId =
    String(body.supplier_order_id || "").trim();

  const trackingCode =
    String(body.tracking_code || "")
      .trim()
      .slice(0, 200);

  if (!supplierOrderId) {
    return {
      ok: false,
      error: "شناسه سفارش الزامی است"
    };
  }

  const current = await env.DB.prepare(`
    SELECT
      id,
      order_id
    FROM supplier_orders
    WHERE id = ?
      AND supplier_id = ?
    LIMIT 1
  `).bind(
    supplierOrderId,
    supplier.id
  ).first();

  if (!current) {
    return {
      ok: false,
      error: "سفارش پیدا نشد"
    };
  }

  await env.DB.prepare(`
    UPDATE supplier_orders
    SET
      tracking_code = ?,
      shipping_status = ?,
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND supplier_id = ?
  `).bind(
    trackingCode,
    trackingCode ? "ارسال شد" : "در انتظار ارسال",
    trackingCode ? "ارسال شد" : "آماده ارسال",
    supplierOrderId,
    supplier.id
  ).run();

  await env.DB.prepare(`
    UPDATE orders
    SET
      shipping_status = ?
    WHERE id = ?
  `).bind(
    trackingCode ? "ارسال شد" : "در انتظار ارسال",
    current.order_id
  ).run();

  return {
    ok: true
  };
}


// ============================================================
// LAYOUT / CSS
// ============================================================

function layout(title, body) {
  return `
<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >
  <title>${escapeHTML(title)} | ${STORE_NAME}</title>

  <meta
    name="description"
    content="فروشگاه دیجیتال دیجی‌ماریکسو"
  >

  <style>
    :root {
      --navy: #0f172a;
      --blue: #2563eb;
      --teal: #14b8a6;
      --orange: #f97316;
      --light: #f8fafc;
      --muted: #64748b;
      --border: #e2e8f0;
      --white: #ffffff;
      --danger: #dc2626;
      --success: #16a34a;
    }

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
      background: var(--light);
      color: var(--navy);
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
      font-family: inherit;
    }

    .header {
      background:
        linear-gradient(
          135deg,
          var(--navy),
          #172554
        );
      color: #fff;
      position: sticky;
      top: 0;
      z-index: 50;
      box-shadow:
        0 4px 20px rgba(15, 23, 42, .16);
    }

    .nav {
      max-width: 1180px;
      margin: auto;
      min-height: 72px;
      padding: 12px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 900;
      font-size: 20px;
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
          var(--blue),
          var(--teal)
        );
      box-shadow:
        0 8px 20px rgba(37, 99, 235, .25);
    }

    .nav-links {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
    }

    .nav-links a {
      padding: 8px 12px;
      border-radius: 10px;
      color: #e2e8f0;
      font-size: 14px;
    }

    .nav-links a:hover {
      background: rgba(255,255,255,.1);
      color: #fff;
    }

    .container {
      max-width: 1180px;
      margin: auto;
      padding: 0 18px;
    }

    .hero {
      padding: 70px 18px;
      color: #fff;
      background:
        linear-gradient(
          135deg,
          #0f172a 0%,
          #172554 55%,
          #0f766e 100%
        );
    }

    .hero-inner {
      max-width: 1180px;
      margin: auto;
      display: grid;
      grid-template-columns:
        minmax(0, 1.4fr)
        minmax(280px, .8fr);
      gap: 35px;
      align-items: center;
    }

    .hero h1 {
      margin: 0 0 18px;
      font-size: clamp(30px, 6vw, 54px);
      line-height: 1.25;
    }

    .hero p {
      color: #cbd5e1;
      font-size: 17px;
      max-width: 720px;
    }

    .hero-card {
      padding: 25px;
      border-radius: 24px;
      background: rgba(255,255,255,.1);
      border: 1px solid rgba(255,255,255,.15);
      backdrop-filter: blur(12px);
    }

    .section {
      padding: 48px 0;
    }

    .section-title {
      margin: 0 0 8px;
      font-size: 30px;
    }

    .section-subtitle {
      color: var(--muted);
      margin-top: 0;
    }

    .grid {
      display: grid;
      grid-template-columns:
        repeat(
          auto-fit,
          minmax(220px, 1fr)
        );
      gap: 18px;
    }

    .card {
      background: var(--white);
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 20px;
      box-shadow:
        0 5px 20px rgba(15,23,42,.05);
    }

    .product-card {
      overflow: hidden;
      padding: 0;
    }

    .product-image {
      height: 190px;
      width: 100%;
      object-fit: cover;
      display: block;
      background: #e2e8f0;
    }

    .product-placeholder {
      height: 190px;
      display: grid;
      place-items: center;
      font-size: 48px;
      background:
        linear-gradient(
          135deg,
          #dbeafe,
          #ccfbf1
        );
    }

    .product-body {
      padding: 18px;
    }

    .product-title {
      font-weight: 800;
      font-size: 18px;
      margin-bottom: 8px;
    }

    .price {
      font-size: 20px;
      font-weight: 900;
      color: var(--blue);
      margin: 12px 0;
    }

    .muted {
      color: var(--muted);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      cursor: pointer;
      padding: 11px 17px;
      border-radius: 11px;
      color: #fff;
      background: var(--blue);
      font-weight: 800;
      transition: .2s;
    }

    .btn:hover {
      transform: translateY(-1px);
      filter: brightness(.96);
    }

    .btn-orange {
      background: var(--orange);
    }

    .btn-teal {
      background: var(--teal);
    }

    .btn-danger {
      background: var(--danger);
    }

    .btn-secondary {
      background: #475569;
    }

    .btn-light {
      background: #e2e8f0;
      color: var(--navy);
    }

    .form {
      display: grid;
      gap: 14px;
    }

    .field {
      display: grid;
      gap: 6px;
    }

    .field label {
      font-weight: 800;
      font-size: 14px;
    }

    .field input,
    .field textarea,
    .field select {
      width: 100%;
      padding: 12px 13px;
      border-radius: 11px;
      border: 1px solid var(--border);
      outline: none;
      background: #fff;
    }

    .field input:focus,
    .field textarea:focus,
    .field select:focus {
      border-color: var(--blue);
      box-shadow:
        0 0 0 3px rgba(37,99,235,.1);
    }

    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 9px;
      border-radius: 999px;
      background: #dbeafe;
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 800;
    }

    .badge-teal {
      background: #ccfbf1;
      color: #0f766e;
    }

    .badge-orange {
      background: #ffedd5;
      color: #c2410c;
    }

    .badge-danger {
      background: #fee2e2;
      color: #b91c1c;
    }

    .empty {
      text-align: center;
      background: #fff;
      border: 1px dashed #cbd5e1;
      padding: 45px 20px;
      border-radius: 18px;
    }

    .table-wrap {
      overflow-x: auto;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 16px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 760px;
    }

    th,
    td {
      padding: 12px;
      border-bottom: 1px solid var(--border);
      text-align: right;
      vertical-align: top;
    }

    th {
      background: #f1f5f9;
      font-size: 13px;
    }

    .footer {
      margin-top: 50px;
      background: var(--navy);
      color: #cbd5e1;
      padding: 35px 18px;
    }

    .footer-inner {
      max-width: 1180px;
      margin: auto;
      display: flex;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
    }

    .notice {
      padding: 13px 15px;
      border-radius: 12px;
      background: #eff6ff;
      color: #1e40af;
      margin-bottom: 15px;
    }

    .notice-success {
      background: #ecfdf5;
      color: #166534;
    }

    .notice-error {
      background: #fef2f2;
      color: #991b1b;
    }

    .stat-grid {
      display: grid;
      grid-template-columns:
        repeat(
          auto-fit,
          minmax(170px, 1fr)
        );
      gap: 14px;
    }

    .stat {
      padding: 18px;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 16px;
    }

    .stat strong {
      display: block;
      font-size: 28px;
      color: var(--blue);
    }

    .order-box {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 20px;
      margin-bottom: 18px;
    }

    .order-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 15px;
    }

    .item-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .admin-nav {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }

    @media (max-width: 760px) {
      .hero-inner {
        grid-template-columns: 1fr;
      }

      .hero {
        padding: 45px 18px;
      }

      .nav {
        justify-content: center;
      }

      .brand {
        width: 100%;
        justify-content: center;
      }

      .nav-links {
        justify-content: center;
      }
    }
  </style>
</head>

<body>

<header class="header">
  <nav class="nav">

    <a class="brand" href="/">
      <span class="brand-icon">🛍️</span>
      <span>${STORE_NAME}</span>
    </a>

    <div class="nav-links">
      <a href="/">خانه</a>
      <a href="/products">محصولات</a>
      <a href="/#features">امکانات</a>
      <a href="/account">حساب کاربری</a>
      <a href="/cart">🛒 سبد خرید</a>
      <a href="/supplier">تأمین‌کننده</a>
      <a href="/admin">مدیریت</a>
    </div>

  </nav>
</header>

${body}

<footer class="footer">
  <div class="footer-inner">
    <div>
      <strong>${STORE_NAME}</strong>
      <div class="muted">
        فروشگاه دیجیتال دیجی‌ماریکسو
      </div>
    </div>

    <div>
      © ${new Date().getFullYear()} ${STORE_EN}
    </div>
  </div>
</footer>

</body>
</html>
`;
}


// ============================================================
// HOME
// ============================================================

async function homePage(env) {
  const result = await getProducts(env);
  const products = result.products || [];

  const featured = products.slice(0, 8);

  let productsHTML = "";

  if (!featured.length) {
    productsHTML = `
      <div class="empty">
        <h3>هنوز محصولی ثبت نشده است</h3>
        <p class="muted">
          محصولات فروشگاه به‌زودی در این بخش نمایش داده می‌شوند.
        </p>
      </div>
    `;
  } else {
    productsHTML = `
      <div class="grid">
        ${featured.map(productCard).join("")}
      </div>
    `;
  }

  return layout(
    STORE_NAME,
    `
    <section class="hero">
      <div class="hero-inner">

        <div>
          <span class="badge badge-teal">
            ${STORE_EN}
          </span>

          <h1>
            فروشگاه دیجیتال دیجی‌ماریکسو
          </h1>

          <p>
            خرید و ثبت سفارش محصولات از فروشندگان و
            تأمین‌کنندگان دیجی‌ماریکسو با ارسال مستقیم.
          </p>

          <div class="actions">
            <a
              class="btn btn-orange"
              href="/products"
            >
              مشاهده محصولات
            </a>

            <a
              class="btn"
              href="/supplier"
            >
              پنل تأمین‌کنندگان
            </a>
          </div>
        </div>

        <div class="hero-card">
          <h2>دیجی‌ماریکسو</h2>

          <p>
            ارتباط بین مشتری و تأمین‌کننده
            با مدیریت سفارش و وضعیت ارسال.
          </p>

          <div class="actions">
            <span class="badge">ثبت سفارش</span>
            <span class="badge badge-teal">ارسال مستقیم</span>
            <span class="badge badge-orange">پیگیری سفارش</span>
          </div>
        </div>

      </div>
    </section>

    <section class="section" id="features">
      <div class="container">

        <h2 class="section-title">
          امکانات دیجی‌ماریکسو
        </h2>

        <p class="section-subtitle">
          امکانات فروشگاه و مدیریت سفارش‌ها
        </p>

        <div class="grid">

          <div class="card">
            <h3>🛍️ محصولات</h3>
            <p class="muted">
              نمایش محصولات ثبت‌شده توسط تأمین‌کنندگان.
            </p>
          </div>

          <div class="card">
            <h3>🚚 ارسال مستقیم</h3>
            <p class="muted">
              تأمین‌کننده سفارش را مستقیماً برای مشتری ارسال می‌کند.
            </p>
          </div>

          <div class="card">
            <h3>📦 مدیریت سفارش</h3>
            <p class="muted">
              وضعیت سفارش‌ها و ارسال‌ها قابل مدیریت است.
            </p>
          </div>

          <div class="card">
            <h3>🔎 کد رهگیری</h3>
            <p class="muted">
              تأمین‌کننده می‌تواند کد رهگیری مرسوله را ثبت کند.
            </p>
          </div>

        </div>

      </div>
    </section>

    <section class="section">
      <div class="container">

        <h2 class="section-title">
          محصولات
        </h2>

        <p class="section-subtitle">
          آخرین محصولات فروشگاه
        </p>

        ${productsHTML}

      </div>
    </section>
    `
  );
}


// ============================================================
// PRODUCT CARD
// ============================================================

function productCard(product) {
  const image = String(product.image || "").trim();

  const imageHTML = image
    ? `
      <img
        class="product-image"
        src="${escapeHTML(image)}"
        alt="${escapeHTML(product.name)}"
        loading="lazy"
      >
    `
    : `
      <div class="product-placeholder">
        🛍️
      </div>
    `;

  return `
    <article class="card product-card">

      ${imageHTML}

      <div class="product-body">

        <div class="product-title">
          ${escapeHTML(product.name)}
        </div>

        <div class="muted">
          ${escapeHTML(product.category || "محصول")}
        </div>

        <div class="price">
          ${toNumber(product.price).toLocaleString("fa-IR")}
          تومان
        </div>

        <div class="actions">

          <a
            class="btn"
            href="/products?id=${encodeURIComponent(product.id)}"
          >
            جزئیات
          </a>

          <button
            class="btn btn-orange"
            onclick="addToCart(
              '${escapeHTML(product.id)}',
              '${escapeHTML(product.name).replace(/'/g, "\\'")}',
              ${toNumber(product.price)}
            )"
          >
            افزودن به سبد
          </button>

        </div>

      </div>

    </article>
  `;
}


// ============================================================
// PRODUCTS PAGE
// ============================================================

async function productsPage(env) {
  const result = await getProducts(env);
  const products = result.products || [];

  return layout(
    "محصولات",
    `
    <section class="section">
      <div class="container">

        <h1 class="section-title">
          محصولات
        </h1>

        <p class="section-subtitle">
          محصولات دیجی‌ماریکسو
        </p>

        ${
          products.length
            ? `<div class="grid">
                ${products.map(productCard).join("")}
               </div>`
            : `
              <div class="empty">
                <h3>محصولی وجود ندارد</h3>
              </div>
            `
        }

      </div>
    </section>

    ${storeClientScript()}
    `
  );
}


// ============================================================
// PRODUCT DETAIL
// ============================================================

function productDetailPage(product) {
  const image = String(product.image || "").trim();

  const imageHTML = image
    ? `
      <img
        class="product-image"
        style="height:320px;border-radius:16px"
        src="${escapeHTML(image)}"
        alt="${escapeHTML(product.name)}"
      >
    `
    : `
      <div
        class="product-placeholder"
        style="height:320px;border-radius:16px"
      >
        🛍️
      </div>
    `;

  return `
  <section class="section">
    <div class="container">

      <div class="grid">

        <div class="card">
          ${imageHTML}
        </div>

        <div class="card">

          <span class="badge">
            ${escapeHTML(product.category || "محصول")}
          </span>

          <h1>
            ${escapeHTML(product.name)}
          </h1>

          <p class="muted">
            ${escapeHTML(product.description || "توضیحات محصول ثبت نشده است.")}
          </p>

          <div class="price">
            ${toNumber(product.price).toLocaleString("fa-IR")}
            تومان
          </div>

          <p>
            موجودی:
            <strong>
              ${toInt(product.stock).toLocaleString("fa-IR")}
            </strong>
          </p>

          ${
            product.supplier_name
              ? `
                <p>
                  تأمین‌کننده:
                  <strong>
                    ${escapeHTML(product.supplier_name)}
                  </strong>
                </p>
              `
              : ""
          }

          <div class="actions">

            <button
              class="btn btn-orange"
              onclick="addToCart(
                '${escapeHTML(product.id)}',
                '${escapeHTML(product.name).replace(/'/g, "\\'")}',
                ${toNumber(product.price)}
              )"
            >
              افزودن به سبد خرید
            </button>

            <a
              class="btn btn-light"
              href="/products"
            >
              بازگشت
            </a>

          </div>

        </div>

      </div>

    </div>
  </section>

  ${storeClientScript()}
  `;
}


// ============================================================
// ACCOUNT
// ============================================================

function accountPage() {
  return layout(
    "حساب کاربری",
    `
    <section class="section">
      <div class="container">

        <div class="card" style="max-width:650px;margin:auto">

          <h1>حساب کاربری</h1>

          <p class="muted">
            بخش حساب کاربری مشتری در حال آماده‌سازی است.
          </p>

          <div class="notice">
            برای خرید می‌توانید محصولات را به سبد خرید
            اضافه کرده و سفارش خود را ثبت کنید.
          </div>

          <div class="actions">
            <a class="btn" href="/products">
              مشاهده محصولات
            </a>

            <a class="btn btn-orange" href="/cart">
              🛒 سبد خرید
            </a>
          </div>

        </div>

      </div>
    </section>
    `
  );
}


// ============================================================
// CART
// ============================================================

function cartPage() {
  return layout(
    "سبد خرید",
    `
    <section class="section">
      <div class="container">

        <h1 class="section-title">
          🛒 سبد خرید
        </h1>

        <div
          id="cart"
          class="card"
        >
          در حال بارگذاری...
        </div>

      </div>
    </section>

    ${storeClientScript()}

    <script>
      document.addEventListener("DOMContentLoaded", function() {
        renderCart();
      });
    </script>
    `
  );
}


// ============================================================
// CLIENT STORE SCRIPT
// ============================================================

function storeClientScript() {
  return `
<script>
(function() {

  window.DM_CART_KEY = "digimarixo_cart";

  window.getCart = function() {
    try {
      return JSON.parse(
        localStorage.getItem(window.DM_CART_KEY) || "[]"
      );
    } catch (e) {
      return [];
    }
  };

  window.saveCart = function(cart) {
    localStorage.setItem(
      window.DM_CART_KEY,
      JSON.stringify(cart)
    );
  };

  window.addToCart = function(id, name, price) {

    var cart = window.getCart();

    var existing = cart.find(function(item) {
      return item.productId === id;
    });

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        productId: id,
        name: name,
        price: Number(price) || 0,
        quantity: 1
      });
    }

    window.saveCart(cart);

    alert("محصول به سبد خرید اضافه شد.");

    if (
      confirm("سبد خرید را مشاهده می‌کنید؟")
    ) {
      location.href = "/cart";
    }
  };

  window.removeCartItem = function(id) {

    var cart = window.getCart();

    cart = cart.filter(function(item) {
      return item.productId !== id;
    });

    window.saveCart(cart);
    window.renderCart();
  };

  window.changeQty = function(id, delta) {

    var cart = window.getCart();

    var item = cart.find(function(row) {
      return row.productId === id;
    });

    if (!item) return;

    item.quantity += delta;

    if (item.quantity <= 0) {
      cart = cart.filter(function(row) {
        return row.productId !== id;
      });
    }

    window.saveCart(cart);
    window.renderCart();
  };

  window.renderCart = function() {

    var root = document.getElementById("cart");

    if (!root) return;

    var cart = window.getCart();

    if (!cart.length) {

      root.innerHTML =
        '<div class="empty">' +
          '<h2>سبد خرید خالی است</h2>' +
          '<p class="muted">هنوز محصولی به سبد اضافه نکرده‌اید.</p>' +
          '<a class="btn" href="/products">مشاهده محصولات</a>' +
        '</div>';

      return;
    }

    var total = 0;

    var rows = cart.map(function(item) {

      var line =
        (Number(item.price) || 0) *
        (Number(item.quantity) || 0);

      total += line;

      return (
        '<div class="item-row">' +
          '<div>' +
            '<strong>' +
              escapeClient(item.name) +
            '</strong>' +
            '<div class="muted">' +
              Number(item.price).toLocaleString("fa-IR") +
              ' تومان' +
            '</div>' +
          '</div>' +

          '<div class="actions">' +

            '<button ' +
              'class="btn btn-light" ' +
              'onclick="changeQty(\\'' +
                escapeClientAttr(item.productId) +
                '\\',-1)"' +
            '>−</button>' +

            '<span class="badge">' +
              item.quantity +
            '</span>' +

            '<button ' +
              'class="btn btn-light" ' +
              'onclick="changeQty(\\'' +
                escapeClientAttr(item.productId) +
                '\\',1)"' +
            '>+</button>' +

            '<button ' +
              'class="btn btn-danger" ' +
              'onclick="removeCartItem(\\'' +
                escapeClientAttr(item.productId) +
                '\\')"' +
            '>حذف</button>' +

          '</div>' +
        '</div>'
      );
    }).join("");

    root.innerHTML =
      '<div>' +
        rows +
      '</div>' +

      '<hr style="border:0;border-top:1px solid #e2e8f0;margin:20px 0">' +

      '<div class="actions" style="justify-content:space-between">' +

        '<strong style="font-size:20px">' +
          'مجموع: ' +
          total.toLocaleString("fa-IR") +
          ' تومان' +
        '</strong>' +

        '<button ' +
          'class="btn btn-orange" ' +
          'onclick="checkoutCart()"' +
        '>ثبت سفارش</button>' +

      '</div>';
  };

  window.checkoutCart = async function() {

    var cart = window.getCart();

    if (!cart.length) {
      alert("سبد خرید خالی است.");
      return;
    }

    var name = prompt("نام و نام خانوادگی:");
    if (!name) return;

    var phone = prompt("شماره تلفن:");
    if (!phone) return;

    var email = prompt("ایمیل، در صورت تمایل:");
    var address = prompt("آدرس کامل:");
    if (!address) return;

    var payload = {
      customer_name: name,
      customer_phone: phone,
      customer_email: email || "",
      address: address,
      items: cart.map(function(item) {
        return {
          productId: item.productId,
          quantity: item.quantity
        };
      })
    };

    try {

      var response = await fetch(
        "/api/orders",
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      var data = await response.json();

      if (!data.ok) {
        alert(
          data.error ||
          "ثبت سفارش انجام نشد."
        );
        return;
      }

      window.saveCart([]);

      alert(
        "سفارش با موفقیت ثبت شد.\\n" +
        "شماره سفارش: " +
        data.order_id
      );

      location.href = "/";

    } catch (error) {

      alert(
        "خطا در ارتباط با سرور."
      );
    }
  };

  function escapeClient(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeClientAttr(value) {
    return String(value == null ? "" : value)
      .replace(/\\\\/g, "\\\\\\\\")
      .replace(/'/g, "\\\\'");
  }

})();
</script>
`;
}


// ============================================================
// SUPPLIER PAGE
// ============================================================

async function supplierPage(request, env) {
  const supplier = await getSupplierFromSession(
    request,
    env
  );

  if (!supplier) {
    return layout(
      "ورود تأمین‌کننده",
      `
      <section class="section">
        <div class="container">

          <div
            class="card"
            style="max-width:520px;margin:auto"
          >

            <h1>
              پنل تأمین‌کننده
            </h1>

            <p class="muted">
              برای مشاهده سفارش‌های خود وارد شوید.
            </p>

            <div
              id="loginMessage"
              class="notice"
              style="display:none"
            ></div>

            <form
              class="form"
              id="supplierLoginForm"
            >

              <div class="field">
                <label>
                  ایمیل ورود
                </label>

                <input
                  type="email"
                  name="email"
                  required
                  autocomplete="username"
                >
              </div>

              <div class="field">
                <label>
                  رمز عبور
                </label>

                <input
                  type="password"
                  name="password"
                  required
                  autocomplete="current-password"
                >
              </div>

              <button
                class="btn"
                type="submit"
              >
                ورود به پنل
              </button>

            </form>

          </div>

        </div>
      </section>

      <script>
      document
        .getElementById("supplierLoginForm")
        .addEventListener("submit", async function(event) {

          event.preventDefault();

          var form = event.currentTarget;
          var message =
            document.getElementById("loginMessage");

          var body = {
            email: form.email.value,
            password: form.password.value
          };

          try {

            var response = await fetch(
              "/api/supplier/login",
              {
                method: "POST",
                headers: {
                  "content-type": "application/json"
                },
                body: JSON.stringify(body)
              }
            );

            var data = await response.json();

            if (!data.ok) {
              message.style.display = "block";
              message.className =
                "notice notice-error";
              message.textContent =
                data.error ||
                "ورود انجام نشد.";
              return;
            }

            location.reload();

          } catch (error) {

            message.style.display = "block";
            message.className =
              "notice notice-error";
            message.textContent =
              "خطا در ارتباط با سرور.";
          }
        });
      </script>
      `
    );
  }

  return layout(
    "پنل تأمین‌کننده",
    `
    <section class="section">
      <div class="container">

        <div class="order-head">
          <div>
            <h1 class="section-title">
              پنل تأمین‌کننده
            </h1>

            <p class="section-subtitle">
              خوش آمدید،
              <strong>
                ${escapeHTML(supplier.name)}
              </strong>
            </p>
          </div>

          <div class="actions">
            <button
              class="btn btn-danger"
              onclick="supplierLogout()"
            >
              خروج
            </button>
          </div>
        </div>

        <div
          id="supplierStats"
          class="stat-grid"
          style="margin-bottom:20px"
        >
          <div class="stat">
            <span class="muted">
              سفارش‌ها
            </span>
            <strong id="ordersCount">-</strong>
          </div>

          <div class="stat">
            <span class="muted">
              ارسال‌شده
            </span>
            <strong id="shippedCount">-</strong>
          </div>
        </div>

        <div id="supplierOrders">
          در حال دریافت سفارش‌ها...
        </div>

      </div>
    </section>

    <script>

    async function supplierLogout() {

      await fetch(
        "/api/supplier/logout",
        {
          method: "POST"
        }
      );

      location.reload();
    }

    function escapeSupplier(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    async function loadSupplierOrders() {

      var root =
        document.getElementById("supplierOrders");

      try {

        var response =
          await fetch("/api/supplier/orders");

        var data =
          await response.json();

        if (
          !data.ok
        ) {

          if (data.unauthorized) {
            location.reload();
            return;
          }

          root.innerHTML =
            '<div class="notice notice-error">' +
            escapeSupplier(data.error) +
            '</div>';

          return;
        }

        var orders =
          data.orders || [];

        document.getElementById(
          "ordersCount"
        ).textContent =
          orders.length.toLocaleString("fa-IR");

        var shipped =
          orders.filter(function(order) {
            return order.shipping_status === "ارسال شد";
          }).length;

        document.getElementById(
          "shippedCount"
        ).textContent =
          shipped.toLocaleString("fa-IR");

        if (!orders.length) {

          root.innerHTML =
            '<div class="empty">' +
              '<h2>سفارشی وجود ندارد</h2>' +
              '<p class="muted">' +
                'در حال حاضر سفارشی برای شما ثبت نشده است.' +
              '</p>' +
            '</div>';

          return;
        }

        root.innerHTML =
          orders.map(renderSupplierOrder).join("");

      } catch (error) {

        root.innerHTML =
          '<div class="notice notice-error">' +
            'خطا در دریافت سفارش‌ها.' +
          '</div>';
      }
    }


    function renderSupplierOrder(order) {

      var items =
        (order.items || []).map(function(item) {

          return (
            '<div class="item-row">' +
              '<div>' +
                '<strong>' +
                  escapeSupplier(item.product_name || "محصول") +
                '</strong>' +
              '</div>' +

              '<div>' +
                'تعداد: ' +
                Number(item.quantity || 0)
                  .toLocaleString("fa-IR") +
              '</div>' +
            '</div>'
          );

        }).join("");


      var tracking =
        escapeSupplier(
          order.tracking_code || ""
        );

      return (
        '<div class="order-box">' +

          '<div class="order-head">' +

            '<div>' +
              '<strong>سفارش #' +
                escapeSupplier(order.order_id) +
              '</strong>' +

              '<div class="muted">' +
                escapeSupplier(
                  order.order_created_at || ""
                ) +
              '</div>' +
            '</div>' +

            '<span class="badge badge-teal">' +
              escapeSupplier(
                order.supplier_order_status
              ) +
            '</span>' +

          '</div>' +

          '<div class="card" style="margin-bottom:15px">' +

            '<h3>اطلاعات مشتری</h3>' +

            '<p>' +
              '<strong>نام:</strong> ' +
              escapeSupplier(order.customer_name) +
            '</p>' +

            '<p>' +
              '<strong>تلفن:</strong> ' +
              escapeSupplier(order.customer_phone) +
            '</p>' +

            '<p>' +
              '<strong>ایمیل:</strong> ' +
              escapeSupplier(order.customer_email || "-") +
            '</p>' +

            '<p>' +
              '<strong>آدرس:</strong> ' +
              escapeSupplier(order.address) +
            '</p>' +

          '</div>' +

          '<div class="card" style="margin-bottom:15px">' +

            '<h3>محصولات سفارش</h3>' +

            items +

          '</div>' +

          '<div class="grid">' +

            '<div class="card">' +

              '<h3>وضعیت سفارش</h3>' +

              '<div class="form">' +

                '<div class="field">' +
                  '<label>وضعیت</label>' +

                  '<select id="status-' +
                    escapeSupplier(order.supplier_order_id) +
                  '">' +

                    '<option>جدید</option>' +
                    '<option>در حال آماده‌سازی</option>' +
                    '<option>آماده ارسال</option>' +
                    '<option>ارسال شد</option>' +
                    '<option>تحویل شد</option>' +
                    '<option>لغو شد</option>' +

                  '</select>' +

                '</div>' +

                '<div class="field">' +
                  '<label>وضعیت ارسال</label>' +

                  '<select id="shipping-' +
                    escapeSupplier(order.supplier_order_id) +
                  '">' +

                    '<option>در انتظار ارسال</option>' +
                    '<option>آماده ارسال</option>' +
                    '<option>ارسال شد</option>' +
                    '<option>تحویل شد</option>' +

                  '</select>' +

                '</div>' +

                '<div class="field">' +
                  '<label>یادداشت</label>' +

                  '<textarea id="note-' +
                    escapeSupplier(order.supplier_order_id) +
                    '" rows="3">' +
                    escapeSupplier(order.supplier_note || "") +
                  '</textarea>' +

                '</div>' +

                '<button ' +
                  'class="btn" ' +
                  'onclick="saveSupplierStatus(\\'' +
                    escapeSupplier(order.supplier_order_id) +
                    '\\')"' +
                '>' +
                  'ذخیره وضعیت' +
                '</button>' +

              '</div>' +

            '</div>' +

            '<div class="card">' +

              '<h3>کد رهگیری</h3>' +

              '<div class="form">' +

                '<div class="field">' +
                  '<label>کد رهگیری مرسوله</label>' +

                  '<input ' +
                    'id="tracking-' +
                    escapeSupplier(order.supplier_order_id) +
                    '" ' +
                    'value="' +
                    tracking +
                    '" ' +
                    'placeholder="کد رهگیری" ' +
                  '>' +

                '</div>' +

                '<button ' +
                  'class="btn btn-orange" ' +
                  'onclick="saveTracking(\\'' +
                    escapeSupplier(order.supplier_order_id) +
                    '\\')"' +
                '>' +
                  'ثبت کد رهگیری' +
                '</button>' +

              '</div>' +

            '</div>' +

          '</div>' +

        '</div>'
      );
    }


    async function saveSupplierStatus(id) {

      var status =
        document.getElementById(
          "status-" + id
        ).value;

      var shipping =
        document.getElementById(
          "shipping-" + id
        ).value;

      var note =
        document.getElementById(
          "note-" + id
        ).value;

      var response =
        await fetch(
          "/api/supplier/orders/status",
          {
            method: "PUT",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({
              supplier_order_id: id,
              status: status,
              shipping_status: shipping,
              supplier_note: note
            })
          }
        );

      var data =
        await response.json();

      if (data.unauthorized) {
        location.reload();
        return;
      }

      alert(
        data.ok
          ? "وضعیت سفارش ذخیره شد."
          : (data.error || "خطا")
      );

      if (data.ok) {
        loadSupplierOrders();
      }
    }


    async function saveTracking(id) {

      var input =
        document.getElementById(
          "tracking-" + id
        );

      var response =
        await fetch(
          "/api/supplier/orders/tracking",
          {
            method: "PUT",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({
              supplier_order_id: id,
              tracking_code: input.value
            })
          }
        );

      var data =
        await response.json();

      if (data.unauthorized) {
        location.reload();
        return;
      }

      alert(
        data.ok
          ? "کد رهگیری ذخیره شد."
          : (data.error || "خطا")
      );

      if (data.ok) {
        loadSupplierOrders();
      }
    }


    loadSupplierOrders();

    </script>
    `
  );
}


// ============================================================
// ADMIN PAGE
// ============================================================

async function adminPage(env) {
  const productsResult = await getProducts(env);
  const suppliersResult = await getSuppliers(env);
  const ordersResult = await getOrders(env);

  const products =
    productsResult.products || [];

  const suppliers =
    suppliersResult.suppliers || [];

  const orders =
    ordersResult.orders || [];

  const suppliersForAdmin =
    await env.DB.prepare(`
      SELECT
        id,
        name,
        phone,
        email,
        address,
        active,
        direct_shipping,
        login_email
      FROM suppliers
      ORDER BY created_at DESC
    `).all();

  const allSuppliers =
    suppliersForAdmin.results || [];

  return layout(
    "مدیریت",
    `
    <section class="section">
      <div class="container">

        <div class="order-head">

          <div>
            <h1 class="section-title">
              مدیریت دیجی‌ماریکسو
            </h1>

            <p class="section-subtitle">
              مدیریت محصولات، تأمین‌کنندگان و سفارش‌ها
            </p>
          </div>

        </div>

        <div class="stat-grid">

          <div class="stat">
            <span class="muted">
              محصولات
            </span>
            <strong>
              ${products.length.toLocaleString("fa-IR")}
            </strong>
          </div>

          <div class="stat">
            <span class="muted">
              تأمین‌کنندگان
            </span>
            <strong>
              ${allSuppliers.length.toLocaleString("fa-IR")}
            </strong>
          </div>

          <div class="stat">
            <span class="muted">
              سفارش‌ها
            </span>
            <strong>
              ${orders.length.toLocaleString("fa-IR")}
            </strong>
          </div>

        </div>

        <div class="section">

          <h2>
            افزودن تأمین‌کننده
          </h2>

          <div class="card">

            <form
              id="supplierForm"
              class="form"
            >

              <div class="grid">

                <div class="field">
                  <label>نام تأمین‌کننده</label>
                  <input
                    name="name"
                    required
                  >
                </div>

                <div class="field">
                  <label>تلفن</label>
                  <input name="phone">
                </div>

                <div class="field">
                  <label>ایمیل</label>
                  <input
                    type="email"
                    name="email"
                  >
                </div>

                <div class="field">
                  <label>آدرس</label>
                  <input name="address">
                </div>

                <div class="field">
                  <label>ایمیل ورود پنل</label>
                  <input
                    type="email"
                    name="login_email"
                  >
                </div>

                <div class="field">
                  <label>رمز ورود پنل</label>
                  <input
                    type="password"
                    name="password"
                    minlength="6"
                  >
                </div>

              </div>

              <label>
                <input
                  type="checkbox"
                  name="direct_shipping"
                  checked
                >
                ارسال مستقیم
              </label>

              <button
                class="btn btn-teal"
                type="submit"
              >
                افزودن تأمین‌کننده
              </button>

            </form>

          </div>

        </div>


        <div class="section">

          <h2>
            تأمین‌کنندگان
          </h2>

          <div class="table-wrap">

            <table>

              <thead>
                <tr>
                  <th>نام</th>
                  <th>تلفن</th>
                  <th>ایمیل</th>
                  <th>ایمیل ورود</th>
                  <th>وضعیت</th>
                  <th>ویرایش</th>
                </tr>
              </thead>

              <tbody>

                ${
                  allSuppliers.map(function(supplier) {
                    return `
                    <tr>

                      <td>
                        ${escapeHTML(supplier.name)}
                      </td>

                      <td>
                        ${escapeHTML(supplier.phone || "-")}
                      </td>

                      <td>
                        ${escapeHTML(supplier.email || "-")}
                      </td>

                      <td>
                        ${escapeHTML(supplier.login_email || "-")}
                      </td>

                      <td>
                        ${
                          Number(supplier.active)
                            ? '<span class="badge badge-teal">فعال</span>'
                            : '<span class="badge badge-danger">غیرفعال</span>'
                        }
                      </td>

                      <td>
                        <button
                          class="btn btn-light"
                          onclick="editSupplier('${escapeHTML(supplier.id)}')"
                        >
                          تنظیم ورود
                        </button>
                      </td>

                    </tr>
                    `;
                  }).join("")
                }

              </tbody>

            </table>

          </div>

        </div>


        <div class="section">

          <h2>
            افزودن محصول
          </h2>

          <div class="card">

            <form
              id="productForm"
              class="form"
            >

              <div class="grid">

                <div class="field">
                  <label>نام محصول</label>
                  <input
                    name="name"
                    required
                  >
                </div>

                <div class="field">
                  <label>قیمت فروش</label>
                  <input
                    name="price"
                    type="number"
                    min="0"
                    required
                  >
                </div>

                <div class="field">
                  <label>موجودی</label>
                  <input
                    name="stock"
                    type="number"
                    min="0"
                    value="0"
                  >
                </div>

                <div class="field">
                  <label>دسته‌بندی</label>
                  <input name="category">
                </div>

                <div class="field">
                  <label>تصویر</label>
                  <input
                    name="image"
                    placeholder="https://..."
                  >
                </div>

                <div class="field">
                  <label>تأمین‌کننده</label>

                  <select name="supplier_id">

                    <option value="">
                      بدون تأمین‌کننده
                    </option>

                    ${
                      allSuppliers.map(function(s) {
                        return `
                          <option value="${escapeHTML(s.id)}">
                            ${escapeHTML(s.name)}
                          </option>
                        `;
                      }).join("")
                    }

                  </select>
                </div>

                <div class="field">
                  <label>قیمت تأمین‌کننده</label>
                  <input
                    name="supplier_price"
                    type="number"
                    min="0"
                    value="0"
                  >
                </div>

                <div class="field">
                  <label>کمیسیون</label>
                  <input
                    name="commission"
                    type="number"
                    min="0"
                    value="0"
                  >
                </div>

              </div>

              <div class="field">
                <label>توضیحات</label>
                <textarea
                  name="description"
                  rows="4"
                ></textarea>
              </div>

              <button
                class="btn"
                type="submit"
              >
                افزودن محصول
              </button>

            </form>

          </div>

        </div>


        <div class="section">

          <h2>
            محصولات
          </h2>

          <div class="table-wrap">

            <table>

              <thead>
                <tr>
                  <th>محصول</th>
                  <th>قیمت</th>
                  <th>موجودی</th>
                  <th>تأمین‌کننده</th>
                  <th>وضعیت</th>
                </tr>
              </thead>

              <tbody>

                ${
                  products.map(function(product) {
                    return `
                    <tr>

                      <td>
                        ${escapeHTML(product.name)}
                      </td>

                      <td>
                        ${toNumber(product.price).toLocaleString("fa-IR")}
                      </td>

                      <td>
                        ${toInt(product.stock).toLocaleString("fa-IR")}
                      </td>

                      <td>
                        ${escapeHTML(product.supplier_name || "-")}
                      </td>

                      <td>
                        ${
                          Number(product.active)
                            ? '<span class="badge badge-teal">فعال</span>'
                            : '<span class="badge badge-danger">غیرفعال</span>'
                        }
                      </td>

                    </tr>
                    `;
                  }).join("")
                }

              </tbody>

            </table>

          </div>

        </div>


        <div class="section">

          <h2>
            سفارش‌ها
          </h2>

          ${
            orders.length
              ? orders.map(adminOrderCard).join("")
              : `
                <div class="empty">
                  <h3>سفارشی ثبت نشده است</h3>
                </div>
              `
          }

        </div>

      </div>
    </section>

    <script>

    async function adminRequest(
      url,
      options
    ) {

      var password =
        prompt(
          "رمز مدیریت را وارد کنید:"
        );

      if (!password) {
        throw new Error(
          "رمز مدیریت وارد نشد."
        );
      }

      options =
        options || {};

      options.headers =
        Object.assign(
          {},
          options.headers || {},
          {
            "X-Admin-Password":
              password
          }
        );

      return fetch(
        url,
        options
      );
    }


    document
      .getElementById("supplierForm")
      .addEventListener(
        "submit",
        async function(event) {

          event.preventDefault();

          var form =
            event.currentTarget;

          var body = {
            name: form.name.value,
            phone: form.phone.value,
            email: form.email.value,
            address: form.address.value,
            login_email: form.login_email.value,
            password: form.password.value,
            direct_shipping:
              form.direct_shipping.checked
          };

          try {

            var response =
              await adminRequest(
                "/api/admin/suppliers",
                {
                  method: "POST",
                  headers: {
                    "content-type":
                      "application/json"
                  },
                  body:
                    JSON.stringify(body)
                }
              );

            var data =
              await response.json();

            alert(
              data.ok
                ? "تأمین‌کننده اضافه شد."
                : (
                    data.error ||
                    "خطا"
                  )
            );

            if (data.ok) {
              location.reload();
            }

          } catch (error) {

            alert(
              error.message ||
              "خطا"
            );
          }
        }
      );


    document
      .getElementById("productForm")
      .addEventListener(
        "submit",
        async function(event) {

          event.preventDefault();

          var form =
            event.currentTarget;

          var body = {
            name: form.name.value,
            price: Number(form.price.value),
            stock: Number(form.stock.value),
            category: form.category.value,
            image: form.image.value,
            supplier_id:
              form.supplier_id.value,
            supplier_price:
              Number(form.supplier_price.value),
            commission:
              Number(form.commission.value),
            description:
              form.description.value
          };

          try {

            var response =
              await adminRequest(
                "/api/admin/products",
                {
                  method: "POST",
                  headers: {
                    "content-type":
                      "application/json"
                  },
                  body:
                    JSON.stringify(body)
                }
              );

            var data =
              await response.json();

            alert(
              data.ok
                ? "محصول اضافه شد."
                : (
                    data.error ||
                    "خطا"
                  )
            );

            if (data.ok) {
              location.reload();
            }

          } catch (error) {

            alert(
              error.message ||
              "خطا"
            );
          }
        }
      );


    async function editSupplier(id) {

      var email =
        prompt(
          "ایمیل ورود جدید:"
        );

      if (email === null) return;

      var password =
        prompt(
          "رمز جدید، حداقل ۶ کاراکتر:"
        );

      if (password === null) return;

      if (password.length < 6) {

        alert(
          "رمز باید حداقل ۶ کاراکتر باشد."
        );

        return;
      }

      try {

        var response =
          await adminRequest(
            "/api/admin/suppliers",
            {
              method: "PUT",
              headers: {
                "content-type":
                  "application/json"
              },
              body:
                JSON.stringify({
                  id: id,
                  login_email: email,
                  password: password
                })
            }
          );

        var data =
          await response.json();

        alert(
          data.ok
            ? "اطلاعات ورود تأمین‌کننده ذخیره شد."
            : (
                data.error ||
                "خطا"
              )
        );

        if (data.ok) {
          location.reload();
        }

      } catch (error) {

        alert(
          error.message ||
          "خطا"
        );
      }
    }


    async function updateAdminOrder(id) {

      var status =
        prompt(
          "وضعیت سفارش:",
          "در حال بررسی"
        );

      if (status === null) return;

      try {

        var response =
          await adminRequest(
            "/api/admin/orders/status",
            {
              method: "PUT",
              headers: {
                "content-type":
                  "application/json"
              },
              body:
                JSON.stringify({
                  id: id,
                  status: status,
                  supplier_status:
                    "در انتظار فروشنده",
                  shipping_status:
                    "در انتظار ارسال"
                })
            }
          );

        var data =
          await response.json();

        alert(
          data.ok
            ? "وضعیت سفارش ذخیره شد."
            : (
                data.error ||
                "خطا"
              )
        );

        if (data.ok) {
          location.reload();
        }

      } catch (error) {

        alert(
          error.message ||
          "خطا"
        );
      }
    }

    </script>
    `
  );
}


function adminOrderCard(order) {
  const items =
    (order.items || []).map(function(item) {
      return `
        <div class="item-row">

          <div>
            <strong>
              ${escapeHTML(item.product_name || "محصول")}
            </strong>

            <div class="muted">
              تأمین‌کننده:
              ${escapeHTML(item.supplier_name || "-")}
            </div>
          </div>

          <div>
            تعداد:
            ${toInt(item.quantity).toLocaleString("fa-IR")}
          </div>

        </div>
      `;
    }).join("");

  const supplierOrders =
    (order.supplier_orders || []).map(function(so) {
      return `
        <div
          class="card"
          style="margin-top:10px"
        >

          <strong>
            ${escapeHTML(so.supplier_name || "-")}
          </strong>

          <div class="actions">
            <span class="badge">
              ${escapeHTML(so.status)}
            </span>

            <span class="badge badge-teal">
              ${escapeHTML(so.shipping_status)}
            </span>

            ${
              so.tracking_code
                ? `
                  <span class="badge badge-orange">
                    رهگیری:
                    ${escapeHTML(so.tracking_code)}
                  </span>
                `
                : ""
            }
          </div>

          ${
            so.supplier_note
              ? `
                <p class="muted">
                  ${escapeHTML(so.supplier_note)}
                </p>
              `
              : ""
          }

        </div>
      `;
    }).join("");

  return `
    <div class="order-box">

      <div class="order-head">

        <div>

          <strong>
            سفارش #${escapeHTML(order.id)}
          </strong>

          <div class="muted">
            ${escapeHTML(order.created_at || "")}
          </div>

        </div>

        <div class="actions">

          <span class="badge">
            ${escapeHTML(order.status)}
          </span>

          <button
            class="btn btn-light"
            onclick="updateAdminOrder('${escapeHTML(order.id)}')"
          >
            تغییر وضعیت
          </button>

        </div>

      </div>


      <div class="grid">

        <div class="card">

          <h3>
            مشتری
          </h3>

          <p>
            <strong>نام:</strong>
            ${escapeHTML(order.customer_name)}
          </p>

          <p>
            <strong>تلفن:</strong>
            ${escapeHTML(order.customer_phone)}
          </p>

          <p>
            <strong>ایمیل:</strong>
            ${escapeHTML(order.customer_email || "-")}
          </p>

          <p>
            <strong>آدرس:</strong>
            ${escapeHTML(order.address)}
          </p>

        </div>


        <div class="card">

          <h3>
            محصولات
          </h3>

          ${items}

          <div
            style="margin-top:15px"
          >
            <strong>
              مجموع:
              ${toNumber(order.total).toLocaleString("fa-IR")}
              تومان
            </strong>
          </div>

        </div>

      </div>


      <div style="margin-top:15px">

        <h3>
          سفارش‌های تأمین‌کنندگان
        </h3>

        ${supplierOrders}

      </div>

    </div>
  `;
          }
