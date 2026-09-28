const STORE_NAME = "دیجی‌ماریکسو";
const STORE_EN = "DigiMarixo";

const ADMIN_USERNAME = "DigiMarixoAdmin";

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

      // -----------------------------
      // HEALTH
      // -----------------------------
      if (path === "/health") {
        return json({
          ok: true,
          store: STORE_EN,
          database: true
        });
      }

      // -----------------------------
      // PUBLIC API
      // -----------------------------
      if (path === "/api/products" && method === "GET") {
        return json(await getProducts(env));
      }

      if (path.startsWith("/api/products/") && method === "GET") {
        const id = decodeURIComponent(path.split("/").pop());
        return json(await getProduct(env, id));
      }

      if (path === "/api/suppliers" && method === "GET") {
        return json(await getSuppliers(env));
      }

      // -----------------------------
      // ORDERS
      // -----------------------------
      if (path === "/api/orders" && method === "POST") {
        return json(await createOrder(request, env));
      }

      if (path === "/api/orders" && method === "GET") {
        if (!isBasicAdmin(request, env)) {
          return basicAuthResponse();
        }

        return json(await getOrders(env));
      }

      // -----------------------------
      // ADMIN API
      // -----------------------------
      if (path === "/api/admin/suppliers" && method === "POST") {
        if (!isBasicAdmin(request, env)) {
          return json({ ok: false, error: "Unauthorized" }, 401);
        }

        return json(await createSupplier(request, env));
      }

      if (path === "/api/admin/products" && method === "POST") {
        if (!isBasicAdmin(request, env)) {
          return json({ ok: false, error: "Unauthorized" }, 401);
        }

        return json(await createProduct(request, env));
      }

      if (path === "/api/admin/products" && method === "PUT") {
        if (!isBasicAdmin(request, env)) {
          return json({ ok: false, error: "Unauthorized" }, 401);
        }

        return json(await updateProduct(request, env));
      }

      if (path === "/api/admin/orders/status" && method === "PUT") {
        if (!isBasicAdmin(request, env)) {
          return json({ ok: false, error: "Unauthorized" }, 401);
        }

        return json(await updateOrderStatus(request, env));
      }

      // -----------------------------
      // ADMIN PAGE
      // -----------------------------
      if (path === "/admin") {
        if (!isBasicAdmin(request, env)) {
          return basicAuthResponse();
        }

        return html(await adminPage(env));
      }

      // -----------------------------
      // ACCOUNT
      // -----------------------------
      if (path === "/account") {
        return html(accountPage());
      }

      // -----------------------------
      // PRODUCTS
      // -----------------------------
      if (path === "/products") {
        const id = url.searchParams.get("id");

        if (id) {
          const result = await getProduct(env, id);

          if (!result.ok) {
            return html(
              layout(
                "محصول پیدا نشد",
                `
                <section class="empty">
                  <h2>محصول پیدا نشد</h2>
                  <p>این محصول وجود ندارد یا غیرفعال شده است.</p>
                  <a class="btn" href="/products">بازگشت به محصولات</a>
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

      // -----------------------------
      // CART
      // -----------------------------
      if (path === "/cart") {
        return html(cartPage());
      }

      // -----------------------------
      // HOME
      // -----------------------------
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
// AUTH
// ============================================================

function isBasicAdmin(request, env) {
  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    return false;
  }

  if (!authorization.startsWith("Basic ")) {
    return false;
  }

  try {
    const encoded = authorization.slice(6);
    const decoded = atob(encoded);

    const separator = decoded.indexOf(":");

    if (separator < 0) {
      return false;
    }

    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);

    if (username !== ADMIN_USERNAME) {
      return false;
    }

    if (!env.ADMIN_PASSWORD) {
      return false;
    }

    return password === env.ADMIN_PASSWORD;
  } catch (error) {
    console.error("Admin auth error:", error);
    return false;
  }
}


function basicAuthResponse() {
  return new Response(
    "Authentication required",
    {
      status: 401,
      headers: {
        "WWW-Authenticate":
          'Basic realm="DigiMarixo Admin", charset="UTF-8"',
        "Content-Type":
          "text/plain; charset=UTF-8",
        "Cache-Control":
          "no-store"
      }
    }
  );
}


// ============================================================
// DATABASE
// ============================================================

async function initDB(env) {
  const statements = [

    `
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
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
    `,

    `
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL DEFAULT 0,
      image TEXT,
      category TEXT,
      stock INTEGER NOT NULL DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      supplier_id TEXT,
      supplier_price REAL DEFAULT 0,
      commission REAL DEFAULT 0
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_email TEXT,
      customer_phone TEXT NOT NULL,
      address TEXT NOT NULL,
      total REAL NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'در حال بررسی',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      supplier_id TEXT,
      supplier_status TEXT DEFAULT 'در انتظار فروشنده',
      shipping_status TEXT DEFAULT 'در انتظار ارسال'
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      supplier_id TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL DEFAULT 0,
      supplier_price REAL DEFAULT 0,
      commission REAL DEFAULT 0
    )
    `,

    `
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
    `,

    `
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      name TEXT,
      rating INTEGER DEFAULT 5,
      comment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE TABLE IF NOT EXISTS supplier_sessions (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    `,

    `
    CREATE INDEX IF NOT EXISTS idx_products_supplier
    ON products(supplier_id)
    `,

    `
    CREATE INDEX IF NOT EXISTS idx_orders_supplier
    ON orders(supplier_id)
    `,

    `
    CREATE INDEX IF NOT EXISTS idx_order_items_order
    ON order_items(order_id)
    `,

    `
    CREATE INDEX IF NOT EXISTS idx_supplier_orders_order
    ON supplier_orders(order_id)
    `,

    `
    CREATE INDEX IF NOT EXISTS idx_supplier_orders_supplier
    ON supplier_orders(supplier_id)
    `

  ];

  for (const sql of statements) {
    await env.DB.prepare(sql).run();
  }

  await ensureColumn(
    env,
    "suppliers",
    "login_email",
    "TEXT"
  );

  await ensureColumn(
    env,
    "suppliers",
    "password_hash",
    "TEXT"
  );

  await ensureColumn(
    env,
    "orders",
    "supplier_id",
    "TEXT"
  );

  await ensureColumn(
    env,
    "orders",
    "supplier_status",
    "TEXT DEFAULT 'در انتظار فروشنده'"
  );

  await ensureColumn(
    env,
    "orders",
    "shipping_status",
    "TEXT DEFAULT 'در انتظار ارسال'"
  );

  await ensureColumn(
    env,
    "products",
    "supplier_id",
    "TEXT"
  );

  await ensureColumn(
    env,
    "products",
    "supplier_price",
    "REAL DEFAULT 0"
  );

  await ensureColumn(
    env,
    "products",
    "commission",
    "REAL DEFAULT 0"
  );
}


async function ensureColumn(
  env,
  table,
  column,
  definition
) {
  const allowedTables = new Set([
    "suppliers",
    "orders",
    "products"
  ]);

  const allowedColumns = new Set([
    "login_email",
    "password_hash",
    "supplier_id",
    "supplier_status",
    "shipping_status",
    "supplier_price",
    "commission"
  ]);

  if (!allowedTables.has(table)) {
    return;
  }

  if (!allowedColumns.has(column)) {
    return;
  }

  const result = await env.DB
    .prepare(`PRAGMA table_info(${table})`)
    .all();

  const exists = (result.results || []).some(
    row => row.name === column
  );

  if (!exists) {
    await env.DB
      .prepare(
        `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`
      )
      .run();
  }
}


// ============================================================
// PRODUCTS
// ============================================================

async function getProducts(env) {
  const result = await env.DB
    .prepare(`
      SELECT
        p.*,
        s.name AS supplier_name
      FROM products p
      LEFT JOIN suppliers s
        ON s.id = p.supplier_id
      WHERE p.active = 1
      ORDER BY p.created_at DESC
    `)
    .all();

  return {
    ok: true,
    products: result.results || []
  };
}


async function getProduct(env, id) {
  const result = await env.DB
    .prepare(`
      SELECT
        p.*,
        s.name AS supplier_name
      FROM products p
      LEFT JOIN suppliers s
        ON s.id = p.supplier_id
      WHERE p.id = ?
      LIMIT 1
    `)
    .bind(id)
    .all();

  if (!result.results || !result.results.length) {
    return {
      ok: false,
      error: "Product not found"
    };
  }

  return {
    ok: true,
    product: result.results[0]
  };
}


async function createProduct(request, env) {
  const body = await request.json();

  const name = String(body.name || "").trim();
  const description = String(
    body.description || ""
  ).trim();

  const price = Number(body.price || 0);
  const image = String(body.image || "").trim();
  const category = String(
    body.category || ""
  ).trim();

  const stock = Number(body.stock || 0);

  const supplierId = String(
    body.supplier_id || ""
  ).trim();

  const supplierPrice = Number(
    body.supplier_price || 0
  );

  const commission = Number(
    body.commission || 0
  );

  if (!name) {
    return {
      ok: false,
      error: "نام محصول الزامی است."
    };
  }

  if (!Number.isFinite(price) || price < 0) {
    return {
      ok: false,
      error: "قیمت نامعتبر است."
    };
  }

  if (!Number.isInteger(stock) || stock < 0) {
    return {
      ok: false,
      error: "موجودی نامعتبر است."
    };
  }

  if (supplierId) {
    const supplier = await env.DB
      .prepare(`
        SELECT id
        FROM suppliers
        WHERE id = ?
        AND active = 1
        LIMIT 1
      `)
      .bind(supplierId)
      .first();

    if (!supplier) {
      return {
        ok: false,
        error: "تأمین‌کننده پیدا نشد."
      };
    }
  }

  const id = crypto.randomUUID();

  await env.DB
    .prepare(`
      INSERT INTO products (
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
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `)
    .bind(
      id,
      name,
      description,
      price,
      image,
      category,
      stock,
      supplierId || null,
      supplierPrice,
      commission
    )
    .run();

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
      error: "شناسه محصول الزامی است."
    };
  }

  const existing = await env.DB
    .prepare(`
      SELECT id
      FROM products
      WHERE id = ?
      LIMIT 1
    `)
    .bind(id)
    .first();

  if (!existing) {
    return {
      ok: false,
      error: "محصول پیدا نشد."
    };
  }

  const fields = [];
  const values = [];

  if (body.name !== undefined) {
    fields.push("name = ?");
    values.push(String(body.name).trim());
  }

  if (body.description !== undefined) {
    fields.push("description = ?");
    values.push(String(body.description));
  }

  if (body.price !== undefined) {
    fields.push("price = ?");
    values.push(Number(body.price));
  }

  if (body.image !== undefined) {
    fields.push("image = ?");
    values.push(String(body.image));
  }

  if (body.category !== undefined) {
    fields.push("category = ?");
    values.push(String(body.category));
  }

  if (body.stock !== undefined) {
    fields.push("stock = ?");
    values.push(Number(body.stock));
  }

  if (body.active !== undefined) {
    fields.push("active = ?");
    values.push(body.active ? 1 : 0);
  }

  if (body.supplier_id !== undefined) {
    fields.push("supplier_id = ?");
    values.push(
      body.supplier_id
        ? String(body.supplier_id)
        : null
    );
  }

  if (body.supplier_price !== undefined) {
    fields.push("supplier_price = ?");
    values.push(Number(body.supplier_price));
  }

  if (body.commission !== undefined) {
    fields.push("commission = ?");
    values.push(Number(body.commission));
  }

  if (!fields.length) {
    return {
      ok: false,
      error: "تغییری ارسال نشده است."
    };
  }

  values.push(id);

  await env.DB
    .prepare(`
      UPDATE products
      SET ${fields.join(", ")}
      WHERE id = ?
    `)
    .bind(...values)
    .run();

  return {
    ok: true
  };
}


// ============================================================
// SUPPLIERS
// ============================================================

async function getSuppliers(env) {
  const result = await env.DB
    .prepare(`
      SELECT
        id,
        name,
        phone,
        email,
        address,
        direct_shipping,
        active,
        created_at,
        login_email
      FROM suppliers
      ORDER BY created_at DESC
    `)
    .all();

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

  const loginEmail = String(
    body.login_email || ""
  ).trim();

  const password = String(
    body.password || ""
  );

  const directShipping =
    body.direct_shipping === false ? 0 : 1;

  if (!name) {
    return {
      ok: false,
      error: "نام تأمین‌کننده الزامی است."
    };
  }

  const id = crypto.randomUUID();

  let passwordHash = null;

  if (password) {
    passwordHash = await hashPassword(password);
  }

  await env.DB
    .prepare(`
      INSERT INTO suppliers (
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
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `)
    .bind(
      id,
      name,
      phone,
      email,
      address,
      directShipping,
      loginEmail || null,
      passwordHash
    )
    .run();

  return {
    ok: true,
    supplier_id: id
  };
}


// ============================================================
// ORDERS
// ============================================================

async function createOrder(request, env) {
  const body = await request.json();

  const customerName = String(
    body.customer_name || ""
  ).trim();

  const customerEmail = String(
    body.customer_email || ""
  ).trim();

  const customerPhone = String(
    body.customer_phone || ""
  ).trim();

  const address = String(
    body.address || ""
  ).trim();

  const items = Array.isArray(body.items)
    ? body.items
    : [];

  if (!customerName) {
    return {
      ok: false,
      error: "نام مشتری الزامی است."
    };
  }

  if (!customerPhone) {
    return {
      ok: false,
      error: "شماره تماس الزامی است."
    };
  }

  if (!address) {
    return {
      ok: false,
      error: "آدرس الزامی است."
    };
  }

  if (!items.length) {
    return {
      ok: false,
      error: "سبد خرید خالی است."
    };
  }

  const orderItems = [];
  const supplierGroups = new Map();

  let total = 0;

  for (const rawItem of items) {
    const productId = String(
      rawItem.product_id ||
      rawItem.productId ||
      ""
    ).trim();

    const quantity = Number(
      rawItem.quantity || 0
    );

    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      return {
        ok: false,
        error: "اطلاعات محصول نامعتبر است."
      };
    }

    const result = await env.DB
      .prepare(`
        SELECT
          p.*,
          s.name AS supplier_name,
          s.active AS supplier_active,
          s.direct_shipping AS supplier_direct_shipping
        FROM products p
        LEFT JOIN suppliers s
          ON s.id = p.supplier_id
        WHERE p.id = ?
        LIMIT 1
      `)
      .bind(productId)
      .all();

    const product = result.results &&
      result.results.length
      ? result.results[0]
      : null;

    if (!product) {
      return {
        ok: false,
        error: "محصول پیدا نشد."
      };
    }

    if (!product.active) {
      return {
        ok: false,
        error: `محصول ${product.name} فعال نیست.`
      };
    }

    if (
      product.stock === null ||
      Number(product.stock) < quantity
    ) {
      return {
        ok: false,
        error: `موجودی محصول ${product.name} کافی نیست.`
      };
    }

    if (
      !product.supplier_id ||
      !product.supplier_active ||
      !product.supplier_direct_shipping
    ) {
      return {
        ok: false,
        error:
          `برای محصول ${product.name} تأمین‌کننده معتبر وجود ندارد.`
      };
    }

    const price = Number(product.price || 0);

    if (!Number.isFinite(price) || price <= 0) {
      return {
        ok: false,
        error: `قیمت محصول ${product.name} نامعتبر است.`
      };
    }

    const itemTotal = price * quantity;

    total += itemTotal;

    const supplierId = String(
      product.supplier_id
    );

    orderItems.push({
      productId,
      supplierId,
      quantity,
      price,
      supplierPrice: Number(
        product.supplier_price || 0
      ),
      commission: Number(
        product.commission || 0
      )
    });

    if (!supplierGroups.has(supplierId)) {
      supplierGroups.set(supplierId, []);
    }

    supplierGroups
      .get(supplierId)
      .push({
        productId,
        quantity
      });
  }

  const orderId = crypto.randomUUID();

  await env.DB
    .prepare(`
      INSERT INTO orders (
        id,
        customer_name,
        customer_email,
        customer_phone,
        address,
        total,
        status,
        supplier_status,
        shipping_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      orderId,
      customerName,
      customerEmail,
      customerPhone,
      address,
      total,
      "در حال بررسی",
      "در انتظار فروشنده",
      "در انتظار ارسال"
    )
    .run();

  for (const item of orderItems) {
    const itemId = crypto.randomUUID();

    await env.DB
      .prepare(`
        INSERT INTO order_items (
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
      `)
      .bind(
        itemId,
        orderId,
        item.productId,
        item.supplierId,
        item.quantity,
        item.price,
        item.supplierPrice,
        item.commission
      )
      .run();

    await env.DB
      .prepare(`
        UPDATE products
        SET stock = stock - ?
        WHERE id = ?
        AND stock >= ?
      `)
      .bind(
        item.quantity,
        item.productId,
        item.quantity
      )
      .run();
  }

  for (const supplierId of supplierGroups.keys()) {
    const supplierOrderId = crypto.randomUUID();

    await env.DB
      .prepare(`
        INSERT INTO supplier_orders (
          id,
          order_id,
          supplier_id,
          status,
          shipping_status
        )
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(
        supplierOrderId,
        orderId,
        supplierId,
        "جدید",
        "در انتظار ارسال"
      )
      .run();
  }

  return {
    ok: true,
    order_id: orderId,
    total,
    suppliers: supplierGroups.size
  };
}


async function getOrders(env) {
  const result = await env.DB
    .prepare(`
      SELECT
        o.*,
        s.name AS supplier_name
      FROM orders o
      LEFT JOIN suppliers s
        ON s.id = o.supplier_id
      ORDER BY o.created_at DESC
    `)
    .all();

  const orders = result.results || [];

  for (const order of orders) {
    const itemsResult = await env.DB
      .prepare(`
        SELECT
          oi.*,
          p.name AS product_name,
          s.name AS supplier_name
        FROM order_items oi
        LEFT JOIN products p
          ON p.id = oi.product_id
        LEFT JOIN suppliers s
          ON s.id = oi.supplier_id
        WHERE oi.order_id = ?
      `)
      .bind(order.id)
      .all();

    order.items = itemsResult.results || [];

    const supplierOrders = await env.DB
      .prepare(`
        SELECT
          so.*,
          s.name AS supplier_name
        FROM supplier_orders so
        LEFT JOIN suppliers s
          ON s.id = so.supplier_id
        WHERE so.order_id = ?
      `)
      .bind(order.id)
      .all();

    order.supplier_orders =
      supplierOrders.results || [];
  }

  return {
    ok: true,
    orders
  };
}


async function updateOrderStatus(request, env) {
  const body = await request.json();

  const orderId = String(
    body.order_id || ""
  ).trim();

  const status = String(
    body.status || ""
  ).trim();

  if (!orderId || !status) {
    return {
      ok: false,
      error: "شناسه سفارش و وضعیت الزامی است."
    };
  }

  if (!STATUS_VALUES.includes(status)) {
    return {
      ok: false,
      error: "وضعیت سفارش نامعتبر است."
    };
  }

  await env.DB
    .prepare(`
      UPDATE orders
      SET
        status = ?,
        supplier_status = ?,
        shipping_status = ?
      WHERE id = ?
    `)
    .bind(
      status,
      status,
      shippingStatusFromOrderStatus(status),
      orderId
    )
    .run();

  await env.DB
    .prepare(`
      UPDATE supplier_orders
      SET
        status = ?,
        shipping_status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ?
    `)
    .bind(
      status,
      shippingStatusFromOrderStatus(status),
      orderId
    )
    .run();

  return {
    ok: true
  };
}


function shippingStatusFromOrderStatus(status) {
  if (status === "آماده ارسال") {
    return "آماده ارسال";
  }

  if (status === "ارسال شد") {
    return "ارسال شد";
  }

  if (status === "تحویل شد") {
    return "تحویل شد";
  }

  if (status === "لغو شد") {
    return "لغو شد";
  }

  return "در انتظار ارسال";
}


// ============================================================
// PASSWORD HASH
// ============================================================

async function hashPassword(password) {
  const salt = crypto.getRandomValues(
    new Uint8Array(16)
  );

  const keyMaterial =
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      {
        name: "PBKDF2"
      },
      false,
      ["deriveBits"]
    );

  const bits =
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );

  return (
    "pbkdf2$100000$" +
    base64url(salt) +
    "$" +
    base64url(new Uint8Array(bits))
  );
}


function base64url(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


// ============================================================
// HOME PAGE
// ============================================================

async function homePage(env) {
  const result = await getProducts(env);
  const products = result.products || [];

  const cards = products.length
    ? products
        .slice(0, 8)
        .map(productCard)
        .join("")
    : `
      <div class="empty">
        <h3>هنوز محصولی ثبت نشده است</h3>
        <p>محصولات به‌زودی در دیجی‌ماریکسو قرار می‌گیرند.</p>
      </div>
    `;

  return layout(
    STORE_NAME,
    `
    <section class="hero">
      <div>
        <span class="badge">DigiMarixo</span>

        <h1>
          فروشگاه دیجیتال
          <strong>دیجی‌ماریکسو</strong>
        </h1>

        <p>
          محصولات را از تأمین‌کنندگان دریافت کنید و سفارش خود را
          به‌صورت آنلاین ثبت کنید.
        </p>

        <div class="hero-actions">
          <a class="btn primary" href="/products">
            مشاهده محصولات
          </a>

          <a class="btn secondary" href="/cart">
            🛒 سبد خرید
          </a>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div>
          <span class="small-title">محصولات</span>
          <h2>محصولات جدید</h2>
        </div>

        <a href="/products">مشاهده همه</a>
      </div>

      <div class="grid">
        ${cards}
      </div>
    </section>

    <section class="features">
      <div class="feature">
        <div class="feature-icon">🛍️</div>
        <h3>تنوع محصولات</h3>
        <p>محصولات تأمین‌کنندگان مختلف در یک فروشگاه.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">🚚</div>
        <h3>ارسال مستقیم</h3>
        <p>تأمین‌کننده سفارش را مستقیماً برای مشتری ارسال می‌کند.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">📦</div>
        <h3>مدیریت سفارش</h3>
        <p>سفارش‌ها و وضعیت ارسال در سیستم مدیریت می‌شوند.</p>
      </div>
    </section>
    `
  );
}


// ============================================================
// PRODUCTS PAGE
// ============================================================

async function productsPage(env) {
  const result = await getProducts(env);
  const products = result.products || [];

  const cards = products.length
    ? products.map(productCard).join("")
    : `
      <div class="empty">
        <h2>محصولی موجود نیست</h2>
        <p>هنوز محصولی برای نمایش ثبت نشده است.</p>
      </div>
    `;

  return layout(
    "محصولات",
    `
    <section class="page-head">
      <span class="small-title">DigiMarixo</span>
      <h1>محصولات</h1>
      <p>محصولات موجود در فروشگاه دیجی‌ماریکسو</p>
    </section>

    <section class="section">
      <div class="grid">
        ${cards}
      </div>
    </section>
    `
  );
}


function productCard(product) {
  const image = product.image
    ? `
      <img
        src="${escapeHTML(product.image)}"
        alt="${escapeHTML(product.name)}"
      >
    `
    : `
      <div class="product-placeholder">
        🛍️
      </div>
    `;

  const price = Number(product.price || 0);

  return `
    <article class="product-card">
      <a
        href="/products?id=${encodeURIComponent(product.id)}"
        class="product-image"
      >
        ${image}
      </a>

      <div class="product-body">
        <div class="category">
          ${escapeHTML(product.category || "محصول")}
        </div>

        <h3>
          ${escapeHTML(product.name)}
        </h3>

        <p>
          ${escapeHTML(product.description || "بدون توضیحات")}
        </p>

        <div class="product-bottom">
          <strong>
            ${formatPrice(price)}
          </strong>

          <button
            class="btn small"
            onclick="addToCart(
              '${escapeJS(product.id)}',
              '${escapeJS(product.name)}',
              ${price}
            )"
          >
            افزودن
          </button>
        </div>
      </div>
    </article>
  `;
}


// ============================================================
// PRODUCT DETAIL
// ============================================================

function productDetailPage(product) {
  const price = Number(product.price || 0);

  const image = product.image
    ? `
      <img
        src="${escapeHTML(product.image)}"
        alt="${escapeHTML(product.name)}"
      >
    `
    : `
      <div class="product-placeholder large">
        🛍️
      </div>
    `;

  return `
    <section class="detail">
      <div class="detail-image">
        ${image}
      </div>

      <div class="detail-content">
        <span class="category">
          ${escapeHTML(product.category || "محصول")}
        </span>

        <h1>${escapeHTML(product.name)}</h1>

        <p>
          ${escapeHTML(
            product.description || "بدون توضیحات"
          )}
        </p>

        <div class="detail-price">
          ${formatPrice(price)}
        </div>

        <p>
          موجودی:
          <strong>
            ${Number(product.stock || 0)}
          </strong>
        </p>

        <button
          class="btn primary"
          onclick="addToCart(
            '${escapeJS(product.id)}',
            '${escapeJS(product.name)}',
            ${price}
          )"
        >
          افزودن به سبد خرید
        </button>
      </div>
    </section>
  `;
}


// ============================================================
// CART
// ============================================================

function cartPage() {
  return layout(
    "سبد خرید",
    `
    <section class="page-head">
      <span class="small-title">DigiMarixo</span>
      <h1>سبد خرید</h1>
      <p>محصولات انتخاب‌شده را بررسی و سفارش ثبت کنید.</p>
    </section>

    <section class="cart-layout">
      <div id="cartItems" class="cart-items"></div>

      <aside class="checkout-box">
        <h2>ثبت سفارش</h2>

        <input
          id="customerName"
          placeholder="نام و نام خانوادگی"
        >

        <input
          id="customerPhone"
          placeholder="شماره تماس"
        >

        <input
          id="customerEmail"
          placeholder="ایمیل - اختیاری"
        >

        <textarea
          id="customerAddress"
          placeholder="آدرس کامل"
        ></textarea>

        <div id="cartTotal" class="cart-total">
          ۰ تومان
        </div>

        <button
          class="btn primary full"
          onclick="checkoutCart()"
        >
          ثبت سفارش
        </button>
      </aside>
    </section>

    <script>
      renderCart();
    </script>
    `
  );
}


// ============================================================
// ACCOUNT
// ============================================================

function accountPage() {
  return layout(
    "حساب کاربری",
    `
    <section class="page-head">
      <span class="small-title">DigiMarixo</span>
      <h1>حساب کاربری</h1>
      <p>
        سیستم حساب مشتری در حال توسعه است.
      </p>
    </section>

    <section class="account-box">
      <div class="account-icon">👤</div>

      <h2>حساب کاربری</h2>

      <p>
        امکان ثبت سفارش بدون حساب کاربری نیز فعال است.
      </p>

      <a class="btn primary" href="/products">
        مشاهده محصولات
      </a>
    </section>
    `
  );
}


// ============================================================
// ADMIN PAGE
// ============================================================

async function adminPage(env) {
  const productsResult = await getProductsForAdmin(env);
  const suppliersResult = await getSuppliers(env);
  const ordersResult = await getOrders(env);

  const products = productsResult.products || [];
  const suppliers = suppliersResult.suppliers || [];
  const orders = ordersResult.orders || [];

  return layout(
    "DigiMarixo Admin",
    `
    <section class="admin-header">
      <div>
        <span class="small-title">DigiMarixo Admin</span>
        <h1>مدیریت دیجی‌ماریکسو</h1>
        <p>
          مدیریت محصولات، تأمین‌کنندگان و سفارش‌ها
        </p>
      </div>

      <a class="btn secondary" href="/">
        مشاهده فروشگاه
      </a>
    </section>

    <section class="stats">
      <div class="stat">
        <strong>${products.length}</strong>
        <span>محصول</span>
      </div>

      <div class="stat">
        <strong>${suppliers.length}</strong>
        <span>تأمین‌کننده</span>
      </div>

      <div class="stat">
        <strong>${orders.length}</strong>
        <span>سفارش</span>
      </div>
    </section>

    <section class="admin-section">
      <div class="section-head">
        <div>
          <span class="small-title">Products</span>
          <h2>محصولات</h2>
        </div>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>نام</th>
              <th>قیمت</th>
              <th>موجودی</th>
              <th>تأمین‌کننده</th>
              <th>وضعیت</th>
            </tr>
          </thead>

          <tbody>
            ${
              products.length
                ? products.map(adminProductRow).join("")
                : `
                  <tr>
                    <td colspan="5">
                      محصولی ثبت نشده است.
                    </td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="admin-section">
      <div class="section-head">
        <div>
          <span class="small-title">Suppliers</span>
          <h2>تأمین‌کنندگان</h2>
        </div>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>نام</th>
              <th>تلفن</th>
              <th>ایمیل</th>
              <th>ورود</th>
              <th>وضعیت</th>
            </tr>
          </thead>

          <tbody>
            ${
              suppliers.length
                ? suppliers.map(adminSupplierRow).join("")
                : `
                  <tr>
                    <td colspan="5">
                      تأمین‌کننده‌ای ثبت نشده است.
                    </td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="admin-section">
      <div class="section-head">
        <div>
          <span class="small-title">Orders</span>
          <h2>سفارش‌ها</h2>
        </div>
      </div>

      <div class="orders-list">
        ${
          orders.length
            ? orders.map(adminOrderCard).join("")
            : `
              <div class="empty">
                سفارشی ثبت نشده است.
              </div>
            `
        }
      </div>
    </section>
    `
  );
}


async function getProductsForAdmin(env) {
  const result = await env.DB
    .prepare(`
      SELECT
        p.*,
        s.name AS supplier_name
      FROM products p
      LEFT JOIN suppliers s
        ON s.id = p.supplier_id
      ORDER BY p.created_at DESC
    `)
    .all();

  return {
    ok: true,
    products: result.results || []
  };
}


function adminProductRow(product) {
  return `
    <tr>
      <td>
        <strong>
          ${escapeHTML(product.name)}
        </strong>
      </td>

      <td>
        ${formatPrice(Number(product.price || 0))}
      </td>

      <td>
        ${Number(product.stock || 0)}
      </td>

      <td>
        ${escapeHTML(product.supplier_name || "-")}
      </td>

      <td>
        ${
          product.active
            ? `<span class="status success">فعال</span>`
            : `<span class="status danger">غیرفعال</span>`
        }
      </td>
    </tr>
  `;
}


function adminSupplierRow(supplier) {
  return `
    <tr>
      <td>
        <strong>
          ${escapeHTML(supplier.name)}
        </strong>
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
          supplier.active
            ? `<span class="status success">فعال</span>`
            : `<span class="status danger">غیرفعال</span>`
        }
      </td>
    </tr>
  `;
}


function adminOrderCard(order) {
  const items = order.items || [];

  return `
    <article class="order-card">
      <div class="order-top">
        <div>
          <span class="small-title">
            سفارش
          </span>

          <h3>
            ${escapeHTML(order.id)}
          </h3>
        </div>

        <span class="status">
          ${escapeHTML(order.status || "-")}
        </span>
      </div>

      <div class="order-info">
        <div>
          <strong>مشتری</strong>
          <span>
            ${escapeHTML(order.customer_name)}
          </span>
        </div>

        <div>
          <strong>تلفن</strong>
          <span>
            ${escapeHTML(order.customer_phone)}
          </span>
        </div>

        <div>
          <strong>آدرس</strong>
          <span>
            ${escapeHTML(order.address)}
          </span>
        </div>

        <div>
          <strong>مبلغ</strong>
          <span>
            ${formatPrice(Number(order.total || 0))}
          </span>
        </div>
      </div>

      <div class="order-items">
        ${
          items.length
            ? items.map(item => `
                <div class="order-item">
                  <span>
                    ${escapeHTML(item.product_name || item.product_id)}
                  </span>

                  <strong>
                    × ${Number(item.quantity || 0)}
                  </strong>
                </div>
              `).join("")
            : "<p>آیتمی ثبت نشده است.</p>"
        }
      </div>
    </article>
  `;
}


// ============================================================
// LAYOUT
// ============================================================

function layout(title, content, status = 200) {
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
    :root {
      --navy: #0f172a;
      --blue: #2563eb;
      --teal: #14b8a6;
      --orange: #f97316;
      --white: #ffffff;
      --muted: #64748b;
      --bg: #f8fafc;
      --border: #e2e8f0;
      --success: #16a34a;
      --danger: #dc2626;
      --shadow: 0 10px 30px rgba(15, 23, 42, .08);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family:
        Tahoma,
        Arial,
        sans-serif;
      background: var(--bg);
      color: var(--navy);
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

    header {
      background: var(--navy);
      color: white;
      position: sticky;
      top: 0;
      z-index: 20;
    }

    .nav {
      max-width: 1200px;
      margin: auto;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .logo {
      font-weight: 900;
      font-size: 20px;
      color: white;
    }

    .logo span {
      color: var(--teal);
    }

    .nav-links {
      display: flex;
      gap: 18px;
      flex-wrap: wrap;
      align-items: center;
    }

    .nav-links a {
      color: #e2e8f0;
      font-size: 14px;
    }

    .nav-links a:hover {
      color: white;
    }

    main {
      max-width: 1200px;
      margin: auto;
      padding: 30px 20px 60px;
    }

    .hero {
      background:
        linear-gradient(
          135deg,
          var(--navy),
          var(--blue)
        );
      color: white;
      border-radius: 24px;
      padding: 55px 40px;
      box-shadow: var(--shadow);
      margin-bottom: 45px;
    }

    .hero h1 {
      margin: 12px 0;
      font-size: clamp(30px, 5vw, 50px);
      line-height: 1.3;
    }

    .hero h1 strong {
      color: #5eead4;
    }

    .hero p {
      max-width: 700px;
      color: #dbeafe;
      font-size: 17px;
    }

    .badge {
      display: inline-block;
      background: rgba(255,255,255,.12);
      border: 1px solid rgba(255,255,255,.2);
      border-radius: 999px;
      padding: 4px 12px;
      font-size: 13px;
    }

    .hero-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 25px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 12px;
      padding: 10px 18px;
      cursor: pointer;
      background: var(--orange);
      color: white;
      font-weight: 700;
      transition: .2s;
    }

    .btn:hover {
      transform: translateY(-1px);
      opacity: .94;
    }

    .btn.primary {
      background: var(--orange);
    }

    .btn.secondary {
      background: var(--blue);
      color: white;
    }

    .hero .btn.secondary {
      background: rgba(255,255,255,.14);
    }

    .btn.small {
      padding: 7px 12px;
      font-size: 13px;
    }

    .btn.full {
      width: 100%;
    }

    .section {
      margin-top: 35px;
    }

    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 20px;
    }

    .section-head h2 {
      margin: 0;
      font-size: 26px;
    }

    .section-head a {
      color: var(--blue);
      font-weight: 700;
    }

    .small-title {
      color: var(--teal);
      font-weight: 800;
      font-size: 13px;
    }

    .grid {
      display: grid;
      grid-template-columns:
        repeat(auto-fill, minmax(220px, 1fr));
      gap: 20px;
    }

    .product-card {
      background: white;
      border: 1px solid var(--border);
      border-radius: 18px;
      overflow: hidden;
      box-shadow: var(--shadow);
      transition: .2s;
    }

    .product-card:hover {
      transform: translateY(-3px);
    }

    .product-image {
      display: block;
      height: 210px;
      background: #eef2ff;
      overflow: hidden;
    }

    .product-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .product-placeholder {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 55px;
      background:
        linear-gradient(
          135deg,
          #dbeafe,
          #ccfbf1
        );
    }

    .product-placeholder.large {
      min-height: 380px;
      border-radius: 20px;
    }

    .product-body {
      padding: 18px;
    }

    .category {
      color: var(--teal);
      font-size: 12px;
      font-weight: 800;
    }

    .product-body h3 {
      margin: 5px 0;
      font-size: 18px;
    }

    .product-body p {
      color: var(--muted);
      font-size: 13px;
      min-height: 50px;
    }

    .product-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }

    .product-bottom strong {
      color: var(--navy);
    }

    .features {
      display: grid;
      grid-template-columns:
        repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      margin-top: 50px;
    }

    .feature {
      background: white;
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 25px;
      box-shadow: var(--shadow);
    }

    .feature-icon {
      font-size: 32px;
    }

    .feature h3 {
      margin-bottom: 5px;
    }

    .feature p {
      color: var(--muted);
      margin: 0;
    }

    .page-head {
      margin-bottom: 30px;
    }

    .page-head h1 {
      margin: 5px 0;
      font-size: 36px;
    }

    .page-head p {
      color: var(--muted);
    }

    .detail {
      display: grid;
      grid-template-columns:
        minmax(0, 1fr)
        minmax(0, 1fr);
      gap: 35px;
      background: white;
      padding: 25px;
      border-radius: 24px;
      box-shadow: var(--shadow);
    }

    .detail-image img {
      width: 100%;
      max-height: 500px;
      object-fit: cover;
      border-radius: 20px;
    }

    .detail-content {
      padding: 15px;
    }

    .detail-content h1 {
      font-size: 38px;
      margin: 10px 0;
    }

    .detail-content p {
      color: var(--muted);
    }

    .detail-price {
      color: var(--orange);
      font-size: 27px;
      font-weight: 900;
      margin: 25px 0;
    }

    .empty {
      background: white;
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 35px;
      text-align: center;
      color: var(--muted);
    }

    .cart-layout {
      display: grid;
      grid-template-columns:
        minmax(0, 1.5fr)
        minmax(280px, .7fr);
      gap: 25px;
      align-items: start;
    }

    .cart-items {
      display: grid;
      gap: 12px;
    }

    .cart-item {
      background: white;
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 15px;
    }

    .cart-item button {
      border: 0;
      background: #fee2e2;
      color: var(--danger);
      border-radius: 8px;
      padding: 6px 10px;
      cursor: pointer;
    }

    .checkout-box {
      background: white;
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 20px;
      box-shadow: var(--shadow);
    }

    .checkout-box input,
    .checkout-box textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-bottom: 10px;
      outline: none;
    }

    .checkout-box textarea {
      min-height: 100px;
      resize: vertical;
    }

    .cart-total {
      font-size: 22px;
      font-weight: 900;
      color: var(--orange);
      margin: 15px 0;
    }

    .account-box {
      background: white;
      border-radius: 22px;
      padding: 40px;
      text-align: center;
      box-shadow: var(--shadow);
    }

    .account-icon {
      font-size: 55px;
    }

    .admin-header {
      background:
        linear-gradient(
          135deg,
          var(--navy),
          var(--blue)
        );
      color: white;
      border-radius: 22px;
      padding: 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
    }

    .admin-header h1 {
      margin: 5px 0;
    }

    .stats {
      display: grid;
      grid-template-columns:
        repeat(3, 1fr);
      gap: 18px;
      margin: 25px 0;
    }

    .stat {
      background: white;
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 22px;
      text-align: center;
      box-shadow: var(--shadow);
    }

    .stat strong {
      display: block;
      font-size: 32px;
      color: var(--blue);
    }

    .stat span {
      color: var(--muted);
    }

    .admin-section {
      background: white;
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 22px;
      margin-top: 25px;
      box-shadow: var(--shadow);
    }

    .admin-table-wrap {
      overflow-x: auto;
    }

    .admin-table {
      width: 100%;
      border-collapse: collapse;
    }

    .admin-table th,
    .admin-table td {
      padding: 13px;
      border-bottom: 1px solid var(--border);
      text-align: right;
      white-space: nowrap;
    }

    .admin-table th {
      color: var(--muted);
      font-size: 13px;
    }

    .status {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      background: #e0e7ff;
      color: var(--blue);
      font-size: 12px;
      font-weight: 700;
    }

    .status.success {
      background: #dcfce7;
      color: var(--success);
    }

    .status.danger {
      background: #fee2e2;
      color: var(--danger);
    }

    .orders-list {
      display: grid;
      gap: 18px;
    }

    .order-card {
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 18px;
    }

    .order-top {
      display: flex;
      justify-content: space-between;
      gap: 15px;
      align-items: center;
    }

    .order-top h3 {
      margin: 3px 0;
      word-break: break-all;
    }

    .order-info {
      display: grid;
      grid-template-columns:
        repeat(auto-fit, minmax(180px, 1fr));
      gap: 15px;
      margin-top: 18px;
    }

    .order-info div {
      background: #f8fafc;
      padding: 12px;
      border-radius: 12px;
    }

    .order-info strong,
    .order-info span {
      display: block;
    }

    .order-info strong {
      font-size: 12px;
      color: var(--muted);
    }

    .order-items {
      margin-top: 18px;
      border-top: 1px solid var(--border);
      padding-top: 12px;
    }

    .order-item {
      display: flex;
      justify-content: space-between;
      padding: 7px 0;
    }

    footer {
      background: var(--navy);
      color: #cbd5e1;
      padding: 30px 20px;
      text-align: center;
      margin-top: 50px;
    }

    footer strong {
      color: white;
    }

    @media (max-width: 760px) {
      .nav {
        align-items: flex-start;
        flex-direction: column;
      }

      .nav-links {
        gap: 10px;
      }

      .hero {
        padding: 35px 22px;
      }

      .detail,
      .cart-layout {
        grid-template-columns: 1fr;
      }

      .stats {
        grid-template-columns: 1fr;
      }

      .admin-header {
        flex-direction: column;
        align-items: stretch;
      }

      .detail-content h1 {
        font-size: 30px;
      }
    }
  </style>
</head>

<body>

<header>
  <nav class="nav">

    <a class="logo" href="/">
      Digi<span>Marixo</span>
    </a>

    <div class="nav-links">
      <a href="/">خانه</a>
      <a href="/products">محصولات</a>
      <a href="/account">حساب کاربری</a>
      <a href="/cart">🛒 سبد خرید</a>
      <a href="/admin">مدیریت</a>
    </div>

  </nav>
</header>

<main>
  ${content}
</main>

<footer>
  <strong>DigiMarixo</strong>
  <br>
  فروشگاه دیجی‌ماریکسو
  <br>
  © ${new Date().getFullYear()}
</footer>

<script>
  const CART_KEY = "digimarixo_cart";

  function getCart() {
    try {
      return JSON.parse(
        localStorage.getItem(CART_KEY) || "[]"
      );
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(
      CART_KEY,
      JSON.stringify(cart)
    );
  }

  function addToCart(id, name, price) {
    const cart = getCart();

    const existing = cart.find(
      item => item.id === id
    );

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        id: id,
        name: name,
        price: Number(price),
        quantity: 1
      });
    }

    saveCart(cart);

    alert("محصول به سبد خرید اضافه شد.");
  }

  function removeCartItem(id) {
    const cart = getCart().filter(
      item => item.id !== id
    );

    saveCart(cart);
    renderCart();
  }

  function renderCart() {
    const container =
      document.getElementById("cartItems");

    const totalElement =
      document.getElementById("cartTotal");

    if (!container) {
      return;
    }

    const cart = getCart();

    if (!cart.length) {
      container.innerHTML =
        '<div class="empty"><h3>سبد خرید خالی است</h3><p>محصولی برای سفارش انتخاب نشده است.</p><a class="btn" href="/products">مشاهده محصولات</a></div>';

      if (totalElement) {
        totalElement.textContent =
          "۰ تومان";
      }

      return;
    }

    let total = 0;

    container.innerHTML = cart
      .map(item => {
        const itemTotal =
          Number(item.price) *
          Number(item.quantity);

        total += itemTotal;

        return (
          '<div class="cart-item">' +
            '<div>' +
              '<strong>' +
                escapeClient(item.name) +
              '</strong>' +
              '<div>' +
                formatClientPrice(item.price) +
                ' × ' +
                item.quantity +
              '</div>' +
            '</div>' +
            '<button onclick="removeCartItem(\\'' +
              escapeClient(item.id) +
            '\\')">' +
              'حذف' +
            '</button>' +
          '</div>'
        );
      })
      .join("");

    if (totalElement) {
      totalElement.textContent =
        formatClientPrice(total);
    }
  }

  async function checkoutCart() {
    const cart = getCart();

    if (!cart.length) {
      alert("سبد خرید خالی است.");
      return;
    }

    const customerName =
      document.getElementById(
        "customerName"
      ).value.trim();

    const customerPhone =
      document.getElementById(
        "customerPhone"
      ).value.trim();

    const customerEmail =
      document.getElementById(
        "customerEmail"
      ).value.trim();

    const customerAddress =
      document.getElementById(
        "customerAddress"
      ).value.trim();

    if (!customerName ||
        !customerPhone ||
        !customerAddress) {
      alert(
        "نام، شماره تماس و آدرس الزامی است."
      );
      return;
    }

    const items = cart.map(item => ({
      product_id: item.id,
      quantity: Number(item.quantity)
    }));

    try {
      const response = await fetch(
        "/api/orders",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_email: customerEmail,
            address: customerAddress,
            items: items
          })
        }
      );

      const data = await response.json();

      if (!data.ok) {
        alert(
          data.error ||
          "ثبت سفارش انجام نشد."
        );
        return;
      }

      localStorage.removeItem(CART_KEY);

      alert(
        "سفارش با موفقیت ثبت شد. شماره سفارش: " +
        data.order_id
      );

      location.href = "/";

    } catch (error) {
      alert(
        "خطا در ارتباط با سرور."
      );
    }
  }

  function escapeClient(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatClientPrice(value) {
    return Number(value || 0)
      .toLocaleString("fa-IR") +
      " تومان";
  }
</script>

</body>
</html>
  `;
}


// ============================================================
// RESPONSE HELPERS
// ============================================================

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


function formatPrice(value) {
  return Number(value || 0)
    .toLocaleString("fa-IR") +
    " تومان";
}


function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function escapeJS(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}


function safeError(error) {
  if (!error) {
    return "Unknown error";
  }

  if (typeof error === "string") {
    return error;
  }

  return error.message ||
    "Unknown error";
          }
