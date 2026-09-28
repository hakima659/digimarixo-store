const STORE_NAME = "دیجی‌ماریکسو";
const STORE_EN = "DigiMarixo";

const SUPPLIER_SESSION_COOKIE = "dm_supplier_session";
const SUPPLIER_SESSION_DAYS = 7;

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
      if (path === "/health" && method === "GET") {
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
        const id = path.split("/").pop();
        return json(await getProduct(env, id));
      }

      // Supplier list is public only for active suppliers
      if (path === "/api/suppliers" && method === "GET") {
        return json(await getSuppliers(env));
      }

      // -----------------------------
      // CUSTOMER ORDERS
      // -----------------------------
      if (path === "/api/orders" && method === "POST") {
        const body = await readJSON(request);
        return json(await createOrder(env, body), 200);
      }

      // -----------------------------
      // ADMIN APIs
      // -----------------------------
      if (path === "/api/admin/suppliers" && method === "POST") {
        if (!isAdminAPI(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);

        const body = await readJSON(request);
        return json(await createSupplier(env, body));
      }

      if (path === "/api/admin/suppliers" && method === "PUT") {
        if (!isAdminAPI(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);

        const body = await readJSON(request);
        return json(await updateSupplier(env, body));
      }

      if (path === "/api/admin/products" && method === "POST") {
        if (!isAdminAPI(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);

        const body = await readJSON(request);
        return json(await createProduct(env, body));
      }

      if (path === "/api/admin/products" && method === "PUT") {
        if (!isAdminAPI(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);

        const body = await readJSON(request);
        return json(await updateProduct(env, body));
      }

      if (path === "/api/admin/orders/status" && method === "PUT") {
        if (!isAdminAPI(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);

        const body = await readJSON(request);
        return json(await updateOrderStatus(env, body));
      }

      if (path === "/api/admin/orders" && method === "GET") {
        if (!isAdminAPI(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);

        return json(await getOrders(env));
      }

      // -----------------------------
      // SUPPLIER AUTH
      // -----------------------------
      if (path === "/api/supplier/login" && method === "POST") {
        const body = await readJSON(request);
        const result = await supplierLogin(env, body);

        if (!result.ok) {
          return json(result, 401);
        }

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            "content-type": "application/json; charset=UTF-8",
            "Set-Cookie": result.cookie
          }
        });
      }

      if (path === "/api/supplier/logout" && method === "POST") {
        return supplierLogout(request);
      }

      if (path === "/api/supplier/me" && method === "GET") {
        const session = await getSupplierSession(request, env);

        if (!session) {
          return json({ ok: false, error: "Unauthorized" }, 401);
        }

        return json({
          ok: true,
          supplier: {
            id: session.supplier.id,
            name: session.supplier.name,
            email: session.supplier.login_email,
            phone: session.supplier.phone,
            direct_shipping: session.supplier.direct_shipping
          }
        });
      }

      if (path === "/api/supplier/orders" && method === "GET") {
        const session = await getSupplierSession(request, env);

        if (!session) {
          return json({ ok: false, error: "Unauthorized" }, 401);
        }

        return json(await getSupplierOrders(env, session.supplier.id));
      }

      if (path === "/api/supplier/orders/status" && method === "PUT") {
        const session = await getSupplierSession(request, env);

        if (!session) {
          return json({ ok: false, error: "Unauthorized" }, 401);
        }

        const body = await readJSON(request);

        return json(
          await updateSupplierOrderStatus(
            env,
            session.supplier.id,
            body
          )
        );
      }

      if (path === "/api/supplier/orders/tracking" && method === "PUT") {
        const session = await getSupplierSession(request, env);

        if (!session) {
          return json({ ok: false, error: "Unauthorized" }, 401);
        }

        const body = await readJSON(request);

        return json(
          await updateSupplierTracking(
            env,
            session.supplier.id,
            body
          )
        );
      }

      // -----------------------------
      // PUBLIC PAGES
      // -----------------------------
      if (path === "/account") {
        return html(accountPage());
      }

      if (path === "/supplier") {
        return html(await supplierPage());
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
                <section class="empty-box">
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

// ============================================================
// DATABASE
// ============================================================

async function initDB(env) {
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        address TEXT DEFAULT '',
        direct_shipping INTEGER DEFAULT 1,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        login_email TEXT DEFAULT '',
        password_hash TEXT DEFAULT ''
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        price REAL NOT NULL DEFAULT 0,
        image TEXT DEFAULT '',
        category TEXT DEFAULT '',
        stock INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        supplier_id INTEGER,
        supplier_price REAL DEFAULT 0,
        commission REAL DEFAULT 0
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        customer_email TEXT DEFAULT '',
        customer_phone TEXT NOT NULL,
        address TEXT NOT NULL,
        total REAL DEFAULT 0,
        status TEXT DEFAULT 'در حال بررسی',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        supplier_id INTEGER,
        supplier_status TEXT DEFAULT 'در انتظار فروشنده',
        shipping_status TEXT DEFAULT 'در انتظار ارسال'
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        supplier_id INTEGER,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        supplier_price REAL DEFAULT 0,
        commission REAL DEFAULT 0
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS supplier_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        supplier_id INTEGER NOT NULL,
        status TEXT DEFAULT 'جدید',
        shipping_status TEXT DEFAULT 'در انتظار ارسال',
        supplier_note TEXT DEFAULT '',
        tracking_code TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS supplier_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      `),

    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        name TEXT DEFAULT '',
        rating INTEGER DEFAULT 5,
        comment TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `)
  ]);

  // ----------------------------------------------------------
  // Safe migrations for old databases
  // ----------------------------------------------------------

  await ensureColumn(
    env,
    "suppliers",
    "login_email",
    "TEXT DEFAULT ''"
  );

  await ensureColumn(
    env,
    "suppliers",
    "password_hash",
    "TEXT DEFAULT ''"
  );

  await ensureColumn(
    env,
    "products",
    "supplier_id",
    "INTEGER"
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

  await ensureColumn(
    env,
    "orders",
    "supplier_id",
    "INTEGER"
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
    "supplier_orders",
    "supplier_note",
    "TEXT DEFAULT ''"
  );

  await ensureColumn(
    env,
    "supplier_orders",
    "tracking_code",
    "TEXT DEFAULT ''"
  );
}

async function ensureColumn(env, table, column, definition) {
  const result = await env.DB.prepare(
    `PRAGMA table_info(${table})`
  ).all();

  const exists = (result.results || []).some(
    row => row.name === column
  );

  if (!exists) {
    await env.DB.prepare(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`
    ).run();
  }
}

// ============================================================
// PRODUCTS
// ============================================================

async function getProducts(env) {
  const result = await env.DB.prepare(`
    SELECT
      p.*,
      s.name AS supplier_name,
      s.phone AS supplier_phone,
      s.direct_shipping
    FROM products p
    LEFT JOIN suppliers s
      ON p.supplier_id = s.id
    WHERE p.active = 1
    ORDER BY p.id DESC
  `).all();

  return {
    ok: true,
    products: result.results || []
  };
}

async function getProduct(env, id) {
  const product = await env.DB.prepare(`
    SELECT
      p.*,
      s.name AS supplier_name,
      s.phone AS supplier_phone,
      s.email AS supplier_email,
      s.direct_shipping
    FROM products p
    LEFT JOIN suppliers s
      ON p.supplier_id = s.id
    WHERE p.id = ?
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
// SUPPLIERS - PUBLIC
// ============================================================

async function getSuppliers(env) {
  const result = await env.DB.prepare(`
    SELECT
      id,
      name,
      phone,
      email,
      address,
      direct_shipping,
      active,
      created_at
    FROM suppliers
    WHERE active = 1
    ORDER BY id DESC
  `).all();

  return {
    ok: true,
    suppliers: result.results || []
  };
}

// ============================================================
// SUPPLIERS - ADMIN
// ============================================================

async function createSupplier(env, body) {
  const name = clean(body.name);
  const phone = clean(body.phone);
  const email = clean(body.email);
  const address = clean(body.address);
  const loginEmail = clean(body.login_email).toLowerCase();
  const password = String(body.password || "");

  if (!name) {
    return {
      ok: false,
      error: "نام تأمین‌کننده الزامی است"
    };
  }

  if (loginEmail && !isEmail(loginEmail)) {
    return {
      ok: false,
      error: "ایمیل ورود صحیح نیست"
    };
  }

  let passwordHash = "";

  if (password) {
    passwordHash = await hashPassword(password);
  }

  if (loginEmail) {
    const existing = await env.DB.prepare(`
      SELECT id
      FROM suppliers
      WHERE login_email = ?
      LIMIT 1
    `).bind(loginEmail).first();

    if (existing) {
      return {
        ok: false,
        error: "این ایمیل قبلاً برای یک تأمین‌کننده ثبت شده است"
      };
    }
  }

  const result = await env.DB.prepare(`
    INSERT INTO suppliers (
      name,
      phone,
      email,
      address,
      direct_shipping,
      active,
      login_email,
      password_hash
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    name,
    phone,
    email,
    address,
    body.direct_shipping === false ? 0 : 1,
    body.active === false ? 0 : 1,
    loginEmail,
    passwordHash
  ).run();

  return {
    ok: true,
    supplier_id: result.meta.last_row_id
  };
}

async function updateSupplier(env, body) {
  const id = Number(body.id);

  if (!id) {
    return {
      ok: false,
      error: "شناسه تأمین‌کننده الزامی است"
    };
  }

  const supplier = await env.DB.prepare(`
    SELECT *
    FROM suppliers
    WHERE id = ?
  `).bind(id).first();

  if (!supplier) {
    return {
      ok: false,
      error: "تأمین‌کننده پیدا نشد"
    };
  }

  const name = clean(body.name || supplier.name);
  const phone = clean(body.phone ?? supplier.phone);
  const email = clean(body.email ?? supplier.email);
  const address = clean(body.address ?? supplier.address);
  const loginEmail = clean(
    body.login_email ?? supplier.login_email
  ).toLowerCase();

  if (loginEmail && !isEmail(loginEmail)) {
    return {
      ok: false,
      error: "ایمیل ورود صحیح نیست"
    };
  }

  if (loginEmail) {
    const duplicate = await env.DB.prepare(`
      SELECT id
      FROM suppliers
      WHERE login_email = ?
      AND id != ?
      LIMIT 1
    `).bind(loginEmail, id).first();

    if (duplicate) {
      return {
        ok: false,
        error: "این ایمیل قبلاً استفاده شده است"
      };
    }
  }

  let passwordHash = supplier.password_hash || "";

  if (body.password) {
    passwordHash = await hashPassword(String(body.password));
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
    body.direct_shipping === false ? 0 : 1,
    body.active === false ? 0 : 1,
    loginEmail,
    passwordHash,
    id
  ).run();

  return {
    ok: true
  };
}

// ============================================================
// PRODUCTS - ADMIN
// ============================================================

async function createProduct(env, body) {
  const name = clean(body.name);
  const description = clean(body.description);
  const category = clean(body.category);
  const image = clean(body.image);
  const price = normalizePrice(body.price);
  const supplierPrice = normalizePrice(body.supplier_price);
  const commission = normalizePrice(body.commission);
  const stock = Math.max(0, Number(body.stock || 0));
  const supplierId = Number(body.supplier_id);

  if (!name) {
    return {
      ok: false,
      error: "نام محصول الزامی است"
    };
  }

  if (!price || price <= 0) {
    return {
      ok: false,
      error: "قیمت محصول صحیح نیست"
    };
  }

  if (!supplierId) {
    return {
      ok: false,
      error: "تأمین‌کننده انتخاب نشده است"
    };
  }

  const supplier = await env.DB.prepare(`
    SELECT *
    FROM suppliers
    WHERE id = ?
    AND active = 1
  `).bind(supplierId).first();

  if (!supplier) {
    return {
      ok: false,
      error: "تأمین‌کننده فعال پیدا نشد"
    };
  }

  if (Number(supplier.direct_shipping) !== 1) {
    return {
      ok: false,
      error: "این تأمین‌کننده ارسال مستقیم ندارد"
    };
  }

  const result = await env.DB.prepare(`
    INSERT INTO products (
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
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).bind(
    name,
    description,
    price,
    image,
    category,
    stock,
    supplierId,
    supplierPrice,
    commission
  ).run();

  return {
    ok: true,
    product_id: result.meta.last_row_id
  };
}

async function updateProduct(env, body) {
  const id = Number(body.id);

  if (!id) {
    return {
      ok: false,
      error: "شناسه محصول الزامی است"
    };
  }

  const old = await env.DB.prepare(`
    SELECT *
    FROM products
    WHERE id = ?
  `).bind(id).first();

  if (!old) {
    return {
      ok: false,
      error: "محصول پیدا نشد"
    };
  }

  const supplierId =
    body.supplier_id !== undefined
      ? Number(body.supplier_id)
      : Number(old.supplier_id);

  const supplier = await env.DB.prepare(`
    SELECT *
    FROM suppliers
    WHERE id = ?
    AND active = 1
  `).bind(supplierId).first();

  if (!supplier) {
    return {
      ok: false,
      error: "تأمین‌کننده فعال پیدا نشد"
    };
  }

  const price =
    body.price !== undefined
      ? normalizePrice(body.price)
      : Number(old.price);

  const stock =
    body.stock !== undefined
      ? Math.max(0, Number(body.stock))
      : Number(old.stock);

  const supplierPrice =
    body.supplier_price !== undefined
      ? normalizePrice(body.supplier_price)
      : Number(old.supplier_price);

  const commission =
    body.commission !== undefined
      ? normalizePrice(body.commission)
      : Number(old.commission);

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
    clean(body.name ?? old.name),
    clean(body.description ?? old.description),
    price,
    clean(body.image ?? old.image),
    clean(body.category ?? old.category),
    stock,
    body.active === false ? 0 : 1,
    supplierId,
    supplierPrice,
    commission,
    id
  ).run();

  return {
    ok: true
  };
}

// ============================================================
// CUSTOMER ORDERS
// ============================================================

async function createOrder(env, body) {
  const customerName = clean(body.customer_name);
  const customerEmail = clean(body.customer_email);
  const customerPhone = clean(body.customer_phone);
  const address = clean(body.address);
  const items = Array.isArray(body.items) ? body.items : [];

  if (!customerName || !customerPhone || !address) {
    return {
      ok: false,
      error: "نام، شماره تماس و آدرس الزامی است"
    };
  }

  if (!items.length) {
    return {
      ok: false,
      error: "سبد خرید خالی است"
    };
  }

  const preparedItems = [];
  const supplierGroups = new Map();
  let total = 0;

  for (const rawItem of items) {
    const productId = Number(rawItem.productId);
    const quantity = Math.max(
      1,
      Math.floor(Number(rawItem.quantity || 1))
    );

    if (!productId) {
      return {
        ok: false,
        error: "محصول نامعتبر است"
      };
    }

    const product = await env.DB.prepare(`
      SELECT
        p.*,
        s.name AS supplier_name,
        s.active AS supplier_active,
        s.direct_shipping
      FROM products p
      LEFT JOIN suppliers s
        ON p.supplier_id = s.id
      WHERE p.id = ?
      LIMIT 1
    `).bind(productId).first();

    if (!product || Number(product.active) !== 1) {
      return {
        ok: false,
        error: "یکی از محصولات موجود نیست"
      };
    }

    if (!product.supplier_id) {
      return {
        ok: false,
        error: "برای یکی از محصولات تأمین‌کننده تعیین نشده است"
      };
    }

    if (Number(product.supplier_active) !== 1) {
      return {
        ok: false,
        error: "تأمین‌کننده یکی از محصولات فعال نیست"
      };
    }

    if (Number(product.direct_shipping) !== 1) {
      return {
        ok: false,
        error: "یکی از محصولات امکان ارسال مستقیم ندارد"
      };
    }

    if (Number(product.stock) < quantity) {
      return {
        ok: false,
        error: `موجودی محصول «${product.name}» کافی نیست`
      };
    }

    const price = normalizePrice(product.price);
    const itemTotal = price * quantity;

    total += itemTotal;

    preparedItems.push({
      product,
      productId,
      quantity,
      price
    });

    if (!supplierGroups.has(product.supplier_id)) {
      supplierGroups.set(product.supplier_id, []);
    }

    supplierGroups.get(product.supplier_id).push({
      productId,
      quantity
    });
  }

  const orderResult = await env.DB.prepare(`
    INSERT INTO orders (
      customer_name,
      customer_email,
      customer_phone,
      address,
      total,
      status,
      supplier_status,
      shipping_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    customerName,
    customerEmail,
    customerPhone,
    address,
    total,
    "در حال بررسی",
    "در انتظار فروشنده",
    "در انتظار ارسال"
  ).run();

  const orderId = orderResult.meta.last_row_id;

  for (const item of preparedItems) {
    await env.DB.prepare(`
      INSERT INTO order_items (
        order_id,
        product_id,
        supplier_id,
        quantity,
        price,
        supplier_price,
        commission
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId,
      item.productId,
      item.product.supplier_id,
      item.quantity,
      item.price,
      normalizePrice(item.product.supplier_price),
      normalizePrice(item.product.commission)
    ).run();

    // Supplier-declared stock
    await env.DB.prepare(`
      UPDATE products
      SET stock = stock - ?
      WHERE id = ?
      AND stock >= ?
    `).bind(
      item.quantity,
      item.productId,
      item.quantity
    ).run();
  }

  for (const [supplierId] of supplierGroups.entries()) {
    await env.DB.prepare(`
      INSERT INTO supplier_orders (
        order_id,
        supplier_id,
        status,
        shipping_status
      )
      VALUES (?, ?, ?, ?)
    `).bind(
      orderId,
      supplierId,
      "جدید",
      "در انتظار ارسال"
    ).run();
  }

  return {
    ok: true,
    order_id: orderId,
    total,
    suppliers: supplierGroups.size
  };
}

// ============================================================
// ADMIN ORDERS
// ============================================================

async function getOrders(env) {
  const result = await env.DB.prepare(`
    SELECT
      o.*,
      (
        SELECT COUNT(*)
        FROM order_items oi
        WHERE oi.order_id = o.id
      ) AS item_count
    FROM orders o
    ORDER BY o.id DESC
    LIMIT 200
  `).all();

  return {
    ok: true,
    orders: result.results || []
  };
}

async function updateOrderStatus(env, body) {
  const orderId = Number(body.order_id);

  if (!orderId) {
    return {
      ok: false,
      error: "شناسه سفارش الزامی است"
    };
  }

  const status = clean(body.status) || "در حال بررسی";
  const supplierStatus =
    clean(body.supplier_status) || "در انتظار فروشنده";
  const shippingStatus =
    clean(body.shipping_status) || "در انتظار ارسال";

  const order = await env.DB.prepare(`
    SELECT id
    FROM orders
    WHERE id = ?
  `).bind(orderId).first();

  if (!order) {
    return {
      ok: false,
      error: "سفارش پیدا نشد"
    };
  }

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
    orderId
  ).run();

  await env.DB.prepare(`
    UPDATE supplier_orders
    SET
      status = ?,
      shipping_status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE order_id = ?
  `).bind(
    supplierStatus,
    shippingStatus,
    orderId
  ).run();

  return {
    ok: true
  };
}

// ============================================================
// SUPPLIER AUTH
// ============================================================

async function supplierLogin(env, body) {
  const email = clean(body.email).toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return {
      ok: false,
      error: "ایمیل و رمز عبور الزامی است"
    };
  }

  const supplier = await env.DB.prepare(`
    SELECT *
    FROM suppliers
    WHERE login_email = ?
    AND active = 1
    LIMIT 1
  `).bind(email).first();

  if (!supplier || !supplier.password_hash) {
    return {
      ok: false,
      error: "ایمیل یا رمز عبور صحیح نیست"
    };
  }

  const valid = await verifyPassword(
    password,
    supplier.password_hash
  );

  if (!valid) {
    return {
      ok: false,
      error: "ایمیل یا رمز عبور صحیح نیست"
    };
  }

  const rawToken = randomToken(32);
  const tokenHash = await sha256(rawToken);

  const expiresAt =
    Date.now() +
    SUPPLIER_SESSION_DAYS * 24 * 60 * 60 * 1000;

  await env.DB.prepare(`
    DELETE FROM supplier_sessions
    WHERE supplier_id = ?
  `).bind(supplier.id).run();

  await env.DB.prepare(`
    INSERT INTO supplier_sessions (
      supplier_id,
      token_hash,
      expires_at
    )
    VALUES (?, ?, ?)
  `).bind(
    supplier.id,
    tokenHash,
    expiresAt
  ).run();

  const cookie = [
    `${SUPPLIER_SESSION_COOKIE}=${rawToken}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${SUPPLIER_SESSION_DAYS * 24 * 60 * 60}`
  ].join("; ");

  return {
    ok: true,
    cookie,
    supplier: {
      id: supplier.id,
      name: supplier.name,
      email: supplier.login_email
    }
  };
}

async function supplierLogout(request) {
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const token = cookies[SUPPLIER_SESSION_COOKIE];

  const headers = new Headers({
    "content-type": "application/json; charset=UTF-8"
  });

  headers.set(
    "Set-Cookie",
    `${SUPPLIER_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );

  return new Response(
    JSON.stringify({
      ok: true
    }),
    {
      status: 200,
      headers
    }
  );
}

async function getSupplierSession(request, env) {
  const cookies = parseCookies(
    request.headers.get("Cookie") || ""
  );

  const token = cookies[SUPPLIER_SESSION_COOKIE];

  if (!token) {
    return null;
  }

  const tokenHash = await sha256(token);

  const row = await env.DB.prepare(`
    SELECT
      ss.id AS session_id,
      ss.expires_at,
      s.*
    FROM supplier_sessions ss
    JOIN suppliers s
      ON s.id = ss.supplier_id
    WHERE ss.token_hash = ?
    LIMIT 1
  `).bind(tokenHash).first();

  if (!row) {
    return null;
  }

  if (Number(row.expires_at) < Date.now()) {
    await env.DB.prepare(`
      DELETE FROM supplier_sessions
      WHERE id = ?
    `).bind(row.session_id).run();

    return null;
  }

  if (Number(row.active) !== 1) {
    return null;
  }

  return {
    session: row,
    supplier: row
  };
}

// ============================================================
// SUPPLIER ORDERS
// ============================================================

async function getSupplierOrders(env, supplierId) {
  const orders = await env.DB.prepare(`
    SELECT
      so.*,
      o.customer_name,
      o.customer_email,
      o.customer_phone,
      o.address,
      o.total,
      o.created_at AS order_created_at
    FROM supplier_orders so
    JOIN orders o
      ON o.id = so.order_id
    WHERE so.supplier_id = ?
    ORDER BY so.id DESC
    LIMIT 200
  `).bind(supplierId).all();

  const result = [];

  for (const order of orders.results || []) {
    const items = await env.DB.prepare(`
      SELECT
        oi.*,
        p.name AS product_name,
        p.image AS product_image
      FROM order_items oi
      LEFT JOIN products p
        ON p.id = oi.product_id
      WHERE oi.order_id = ?
      AND oi.supplier_id = ?
      ORDER BY oi.id ASC
    `).bind(
      order.order_id,
      supplierId
    ).all();

    result.push({
      ...order,
      items: items.results || []
    });
  }

  return {
    ok: true,
    orders: result
  };
}

async function updateSupplierOrderStatus(
  env,
  supplierId,
  body
) {
  const supplierOrderId = Number(body.supplier_order_id);

  if (!supplierOrderId) {
    return {
      ok: false,
      error: "شناسه سفارش تأمین‌کننده الزامی است"
    };
  }

  const supplierOrder = await env.DB.prepare(`
    SELECT *
    FROM supplier_orders
    WHERE id = ?
    AND supplier_id = ?
    LIMIT 1
  `).bind(
    supplierOrderId,
    supplierId
  ).first();

  if (!supplierOrder) {
    return {
      ok: false,
      error: "سفارش پیدا نشد"
    };
  }

  const status =
    clean(body.status) || supplierOrder.status;

  const shippingStatus =
    clean(body.shipping_status) ||
    supplierOrder.shipping_status;

  const note =
    body.supplier_note !== undefined
      ? clean(body.supplier_note)
      : supplierOrder.supplier_note;

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
    supplierId
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
    supplierOrder.order_id
  ).run();

  return {
    ok: true
  };
}

async function updateSupplierTracking(
  env,
  supplierId,
  body
) {
  const supplierOrderId = Number(body.supplier_order_id);
  const trackingCode = clean(body.tracking_code);

  if (!supplierOrderId) {
    return {
      ok: false,
      error: "شناسه سفارش الزامی است"
    };
  }

  const supplierOrder = await env.DB.prepare(`
    SELECT *
    FROM supplier_orders
    WHERE id = ?
    AND supplier_id = ?
    LIMIT 1
  `).bind(
    supplierOrderId,
    supplierId
  ).first();

  if (!supplierOrder) {
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
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    AND supplier_id = ?
  `).bind(
    trackingCode,
    trackingCode
      ? "ارسال شد"
      : supplierOrder.shipping_status,
    supplierOrderId,
    supplierId
  ).run();

  await env.DB.prepare(`
    UPDATE orders
    SET
      shipping_status = ?
    WHERE id = ?
  `).bind(
    trackingCode
      ? "ارسال شد"
      : supplierOrder.shipping_status,
    supplierOrder.order_id
  ).run();

  return {
    ok: true
  };
}

// ============================================================
// SUPPLIER PAGE
// ============================================================

async function supplierPage() {
  return layout(
    "پنل تأمین‌کننده",
    `
    <section class="supplier-wrap">
      <div id="supplierApp">
        <div class="supplier-login card">
          <div class="supplier-icon">📦</div>
          <h1>پنل تأمین‌کننده</h1>
          <p>برای مشاهده و مدیریت سفارش‌های خود وارد شوید.</p>

          <form id="supplierLoginForm">
            <label>ایمیل ورود</label>
            <input
              id="supplierEmail"
              type="email"
              autocomplete="username"
              placeholder="supplier@example.com"
              required
            >

            <label>رمز عبور</label>
            <input
              id="supplierPassword"
              type="password"
              autocomplete="current-password"
              placeholder="رمز عبور"
              required
            >

            <button class="btn full" type="submit">
              ورود به پنل
            </button>

            <div id="supplierLoginMessage" class="message"></div>
          </form>
        </div>
      </div>
    </section>

    <script>
      const supplierApp = document.getElementById("supplierApp");

      async function supplierRequest(url, options = {}) {
        const response = await fetch(url, {
          credentials: "same-origin",
          ...options,
          headers: {
            "content-type": "application/json",
            ...(options.headers || {})
          }
        });

        return await response.json();
      }

      document.getElementById("supplierLoginForm").addEventListener("submit", async function(event) {
        event.preventDefault();

        const message = document.getElementById("supplierLoginMessage");

        const result = await supplierRequest("/api/supplier/login", {
          method: "POST",
          body: JSON.stringify({
            email: document.getElementById("supplierEmail").value,
            password: document.getElementById("supplierPassword").value
          })
        });

        if (!result.ok) {
          message.textContent = result.error || "ورود ناموفق بود.";
          return;
        }

        await loadSupplierDashboard();
      });

      async function loadSupplierDashboard() {
        const me = await supplierRequest("/api/supplier/me");

        if (!me.ok) {
          return;
        }

        supplierApp.innerHTML = \`
          <div class="dashboard-head">
            <div>
              <span class="small-label">DigiMarixo</span>
              <h1>پنل تأمین‌کننده</h1>
              <p>سلام \${escapeHtmlClient(me.supplier.name)}</p>
            </div>

            <button class="btn danger" onclick="supplierLogout()">
              خروج
            </button>
          </div>

          <div class="supplier-stats">
            <div class="stat-card">
              <strong id="supplierOrderCount">0</strong>
              <span>سفارش‌ها</span>
            </div>

            <div class="stat-card">
              <strong id="supplierNewCount">0</strong>
              <span>سفارش جدید</span>
            </div>
          </div>

          <div id="supplierOrders" class="orders-grid">
            <div class="loading">در حال دریافت سفارش‌ها...</div>
          </div>
        \`;

        await loadSupplierOrders();
      }

      async function loadSupplierOrders() {
        const result = await supplierRequest("/api/supplier/orders");

        if (!result.ok) {
          document.getElementById("supplierOrders").innerHTML =
            '<div class="empty-box">خطا در دریافت سفارش‌ها.</div>';
          return;
        }

        const orders = result.orders || [];

        document.getElementById("supplierOrderCount").textContent = orders.length;

        const newCount = orders.filter(function(order) {
          return order.status === "جدید";
        }).length;

        document.getElementById("supplierNewCount").textContent = newCount;

        if (!orders.length) {
          document.getElementById("supplierOrders").innerHTML =
            '<div class="empty-box"><h3>هنوز سفارشی ندارید</h3><p>سفارش‌های مربوط به محصولات شما در این قسمت نمایش داده می‌شود.</p></div>';
          return;
        }

        document.getElementById("supplierOrders").innerHTML =
          orders.map(renderSupplierOrder).join("");
      }

      function renderSupplierOrder(order) {
        const items = (order.items || []).map(function(item) {
          return \`
            <div class="order-item">
              <div>
                <strong>\${escapeHtmlClient(item.product_name || "محصول")}</strong>
                <span>تعداد: \${item.quantity}</span>
              </div>
              <span>\${formatNumberClient(item.price)} تومان</span>
            </div>
          \`;
        }).join("");

        return \`
          <article class="supplier-order card">
            <div class="order-top">
              <div>
                <span class="order-number">سفارش #\${order.order_id}</span>
                <h2>\${escapeHtmlClient(order.customer_name)}</h2>
              </div>

              <span class="status-badge">
                \${escapeHtmlClient(order.status)}
              </span>
            </div>

            <div class="customer-info">
              <p><b>📞 تلفن:</b> \${escapeHtmlClient(order.customer_phone)}</p>
              <p><b>📍 آدرس:</b> \${escapeHtmlClient(order.address)}</p>
              \${order.customer_email ? '<p><b>✉️ ایمیل:</b> ' + escapeHtmlClient(order.customer_email) + '</p>' : ""}
            </div>

            <div class="items-list">
              \${items}
            </div>

            <div class="order-total">
              <span>مبلغ کل سفارش</span>
              <strong>\${formatNumberClient(order.total)} تومان</strong>
            </div>

            <div class="supplier-controls">
              <label>وضعیت سفارش</label>

              <select
                id="status-\${order.id}"
                onchange="changeSupplierStatus(\${order.id})"
              >
                \${supplierStatusOption("جدید", order.status)}
                \${supplierStatusOption("تأیید شد", order.status)}
                \${supplierStatusOption("در حال آماده‌سازی", order.status)}
                \${supplierStatusOption("آماده ارسال", order.status)}
                \${supplierStatusOption("لغو شد", order.status)}
              </select>

              <label>کد رهگیری</label>

              <div class="tracking-row">
                <input
                  id="tracking-\${order.id}"
                  value="\${escapeAttrClient(order.tracking_code || "")}"
                  placeholder="کد رهگیری مرسوله"
                >

                <button
                  class="btn"
                  onclick="saveTracking(\${order.id})"
                >
                  ثبت
                </button>
              </div>

              <label>یادداشت تأمین‌کننده</label>

              <textarea
                id="note-\${order.id}"
                placeholder="یادداشت سفارش"
              >\${escapeHtmlClient(order.supplier_note || "")}</textarea>

              <button
                class="btn full"
                onclick="saveSupplierStatus(\${order.id})"
              >
                ذخیره وضعیت
              </button>

              <div id="msg-\${order.id}" class="message"></div>
            </div>
          </article>
        \`;
      }

      function supplierStatusOption(value, current) {
        return '<option value="' +
          escapeAttrClient(value) +
          '"' +
          (value === current ? " selected" : "") +
          ">" +
          escapeHtmlClient(value) +
          "</option>";
      }

      async function changeSupplierStatus(id) {
        const select = document.getElementById("status-" + id);

        await saveSupplierStatus(id, false);
      }

      async function saveSupplierStatus(id, showMessage = true) {
        const status = document.getElementById("status-" + id).value;
        const note = document.getElementById("note-" + id).value;

        const result = await supplierRequest("/api/supplier/orders/status", {
          method: "PUT",
          body: JSON.stringify({
            supplier_order_id: id,
            status: status,
            shipping_status: status === "آماده ارسال"
              ? "در انتظار ارسال"
              : undefined,
            supplier_note: note
          })
        });

        if (showMessage) {
          const message = document.getElementById("msg-" + id);
          message.textContent = result.ok
            ? "وضعیت ذخیره شد."
            : (result.error || "خطا در ذخیره وضعیت");
        }
      }

      async function saveTracking(id) {
        const tracking = document.getElementById("tracking-" + id).value;

        const result = await supplierRequest("/api/supplier/orders/tracking", {
          method: "PUT",
          body: JSON.stringify({
            supplier_order_id: id,
            tracking_code: tracking
          })
        });

        const message = document.getElementById("msg-" + id);
        message.textContent = result.ok
          ? "کد رهگیری ثبت شد."
          : (result.error || "خطا در ثبت کد رهگیری");
      }

      async function supplierLogout() {
        await supplierRequest("/api/supplier/logout", {
          method: "POST"
        });

        location.reload();
      }

      function escapeHtmlClient(value) {
        return String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      function escapeAttrClient(value) {
        return escapeHtmlClient(value);
      }

      function formatNumberClient(value) {
        return Number(value || 0).toLocaleString("fa-IR");
      }

      loadSupplierDashboard();
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

  const products = productsResult.products || [];
  const suppliers = suppliersResult.suppliers || [];
  const orders = ordersResult.orders || [];

  return layout(
    "مدیریت دیجی‌ماریکسو",
    `
    <section class="admin-wrap">

      <div class="dashboard-head">
        <div>
          <span class="small-label">DigiMarixo Admin</span>
          <h1>مدیریت فروشگاه</h1>
          <p>مدیریت محصولات، تأمین‌کنندگان و سفارش‌ها</p>
        </div>
      </div>

      <div class="supplier-stats">
        <div class="stat-card">
          <strong>${formatNumber(products.length)}</strong>
          <span>محصول</span>
        </div>

        <div class="stat-card">
          <strong>${formatNumber(suppliers.length)}</strong>
          <span>تأمین‌کننده</span>
        </div>

        <div class="stat-card">
          <strong>${formatNumber(orders.length)}</strong>
          <span>سفارش</span>
        </div>
      </div>

      <div class="admin-grid">

        <section class="card">
          <h2>افزودن تأمین‌کننده</h2>

          <form id="supplierForm">

            <label>نام</label>
            <input id="sName" required>

            <label>تلفن</label>
            <input id="sPhone">

            <label>ایمیل</label>
            <input id="sEmail" type="email">

            <label>آدرس</label>
            <textarea id="sAddress"></textarea>

            <label>ایمیل ورود به پنل</label>
            <input id="sLoginEmail" type="email">

            <label>رمز عبور پنل</label>
            <input id="sPassword" type="password">

            <label class="check-row">
              <input id="sDirect" type="checkbox" checked>
              ارسال مستقیم توسط تأمین‌کننده
            </label>

            <button class="btn full" type="submit">
              افزودن تأمین‌کننده
            </button>

            <div id="supplierMessage" class="message"></div>
          </form>
        </section>

        <section class="card">
          <h2>افزودن محصول</h2>

          <form id="productForm">

            <label>نام محصول</label>
            <input id="pName" required>

            <label>توضیحات</label>
            <textarea id="pDescription"></textarea>

            <label>قیمت فروش</label>
            <input id="pPrice" type="number" required>

            <label>قیمت تأمین‌کننده</label>
            <input id="pSupplierPrice" type="number" value="0">

            <label>کمیسیون</label>
            <input id="pCommission" type="number" value="0">

            <label>موجودی اعلام‌شده</label>
            <input id="pStock" type="number" value="0">

            <label>دسته‌بندی</label>
            <input id="pCategory">

            <label>تصویر</label>
            <input id="pImage" placeholder="https://...">

            <label>تأمین‌کننده</label>
            <select id="pSupplier" required>
              <option value="">انتخاب کنید</option>
              ${suppliers.map(s => `
                <option value="${s.id}">
                  ${escapeHTML(s.name)}
                </option>
              `).join("")}
            </select>

            <button class="btn full" type="submit">
              افزودن محصول
            </button>

            <div id="productMessage" class="message"></div>
          </form>
        </section>

      </div>

      <section class="card admin-section">
        <h2>تأمین‌کنندگان</h2>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>نام</th>
                <th>تلفن</th>
                <th>ایمیل ورود</th>
                <th>ارسال مستقیم</th>
                <th>وضعیت</th>
              </tr>
            </thead>

            <tbody>
              ${suppliers.map(s => `
                <tr>
                  <td>${escapeHTML(s.name)}</td>
                  <td>${escapeHTML(s.phone || "-")}</td>
                  <td>${escapeHTML(s.email || "-")}</td>
                  <td>${Number(s.direct_shipping) === 1 ? "بله" : "خیر"}</td>
                  <td>${Number(s.active) === 1 ? "فعال" : "غیرفعال"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card admin-section">
        <h2>محصولات</h2>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>محصول</th>
                <th>قیمت</th>
                <th>موجودی</th>
                <th>تأمین‌کننده</th>
              </tr>
            </thead>

            <tbody>
              ${products.map(p => `
                <tr>
                  <td>${escapeHTML(p.name)}</td>
                  <td>${formatNumber(p.price)} تومان</td>
                  <td>${formatNumber(p.stock)}</td>
                  <td>${escapeHTML(p.supplier_name || "-")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card admin-section">
        <h2>آخرین سفارش‌ها</h2>

        <div class="orders-list">
          ${orders.slice(0, 30).map(o => `
            <div class="admin-order">
              <div>
                <strong>سفارش #${o.id}</strong>
                <span>${escapeHTML(o.customer_name)}</span>
                <small>${escapeHTML(o.customer_phone)}</small>
              </div>

              <div>
                <strong>${formatNumber(o.total)} تومان</strong>
                <small>${escapeHTML(o.status)}</small>
              </div>
            </div>
          `).join("")}
        </div>
      </section>

    </section>

    <script>
      async function adminFetch(url, options = {}) {
        const password = prompt("رمز مدیریت را وارد کنید:");

        if (!password) {
          return null;
        }

        const response = await fetch(url, {
          ...options,
          headers: {
            "content-type": "application/json",
            "X-Admin-Password": password,
            ...(options.headers || {})
          }
        });

        return await response.json();
      }

      document.getElementById("supplierForm").addEventListener("submit", async function(event) {
        event.preventDefault();

        const result = await adminFetch("/api/admin/suppliers", {
          method: "POST",
          body: JSON.stringify({
            name: document.getElementById("sName").value,
            phone: document.getElementById("sPhone").value,
            email: document.getElementById("sEmail").value,
            address: document.getElementById("sAddress").value,
            login_email: document.getElementById("sLoginEmail").value,
            password: document.getElementById("sPassword").value,
            direct_shipping: document.getElementById("sDirect").checked
          })
        });

        if (!result) return;

        document.getElementById("supplierMessage").textContent =
          result.ok
            ? "تأمین‌کننده با موفقیت اضافه شد. صفحه را Refresh کنید."
            : (result.error || "خطا");
      });

      document.getElementById("productForm").addEventListener("submit", async function(event) {
        event.preventDefault();

        const result = await adminFetch("/api/admin/products", {
          method: "POST",
          body: JSON.stringify({
            name: document.getElementById("pName").value,
            description: document.getElementById("pDescription").value,
            price: document.getElementById("pPrice").value,
            supplier_price: document.getElementById("pSupplierPrice").value,
            commission: document.getElementById("pCommission").value,
            stock: document.getElementById("pStock").value,
            category: document.getElementById("pCategory").value,
            image: document.getElementById("pImage").value,
            supplier_id: document.getElementById("pSupplier").value
          })
        });

        if (!result) return;

        document.getElementById("productMessage").textContent =
          result.ok
            ? "محصول با موفقیت اضافه شد. صفحه را Refresh کنید."
            : (result.error || "خطا");
      });
    </script>
    `
  );
}

// ============================================================
// HOME
// ============================================================

async function homePage(env) {
  const result = await getProducts(env);
  const products = result.products || [];

  return layout(
    STORE_NAME,
    `
    <section class="hero">
      <div>
        <span class="hero-badge">DigiMarixo</span>

        <h1>
          فروشگاه دیجیتال
          <br>
          دیجی‌ماریکسو
        </h1>

        <p>
          خرید محصولات از تأمین‌کنندگان معتبر
          با مدیریت سفارش و ارسال مستقیم.
        </p>

        <div class="hero-actions">
          <a class="btn" href="/products">
            مشاهده محصولات
          </a>

          <a class="btn secondary" href="/supplier">
            پنل تأمین‌کنندگان
          </a>
        </div>
      </div>

      <div class="hero-card">
        <div>🛒</div>
        <strong>خرید آسان</strong>
        <span>مدیریت ساده سفارش‌ها</span>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div>
          <span class="small-label">DigiMarixo</span>
          <h2>محصولات</h2>
        </div>

        <a href="/products">همه محصولات ←</a>
      </div>

      <div class="products-grid">
        ${
          products.slice(0, 8).map(productCard).join("")
          ||
          `
          <div class="empty-box">
            <h3>هنوز محصولی اضافه نشده</h3>
            <p>محصولات فروشگاه به‌زودی در این قسمت نمایش داده می‌شوند.</p>
          </div>
          `
        }
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

  return layout(
    "محصولات",
    `
    <section class="section">
      <div class="section-head">
        <div>
          <span class="small-label">DigiMarixo</span>
          <h1>محصولات فروشگاه</h1>
        </div>
      </div>

      <div class="products-grid">
        ${
          products.map(productCard).join("")
          ||
          `
          <div class="empty-box">
            <h3>محصولی موجود نیست</h3>
          </div>
          `
        }
      </div>
    </section>
    `
  );
}

function productCard(product) {
  const image = product.image
    ? `
      <img
        src="${escapeAttr(product.image)}"
        alt="${escapeAttr(product.name)}"
        loading="lazy"
      >
    `
    : `
      <div class="product-placeholder">
        🛍️
      </div>
    `;

  return `
    <article class="product-card">
      <a href="/products?id=${encodeURIComponent(product.id)}">
        <div class="product-image">
          ${image}
        </div>
      </a>

      <div class="product-body">
        <span class="product-category">
          ${escapeHTML(product.category || "محصول")}
        </span>

        <h3>
          <a href="/products?id=${encodeURIComponent(product.id)}">
            ${escapeHTML(product.name)}
          </a>
        </h3>

        <p>
          ${escapeHTML(
            String(product.description || "").slice(0, 120)
          )}
        </p>

        <div class="product-bottom">
          <strong>
            ${formatNumber(product.price)} تومان
          </strong>

          ${
            Number(product.stock) > 0
              ? `<button class="btn small" onclick="addProductToCart(${product.id}, '${escapeJS(product.name)}', ${Number(product.price)})">افزودن</button>`
              : `<span class="out-stock">ناموجود</span>`
          }
        </div>
      </div>
    </article>
  `;
}

// ============================================================
// PRODUCT DETAIL
// ============================================================

function productDetailPage(product) {
  return `
  <section class="detail-page">

    <div class="detail-image">
      ${
        product.image
          ? `
          <img
            src="${escapeAttr(product.image)}"
            alt="${escapeAttr(product.name)}"
          >
          `
          : `<div class="product-placeholder large">🛍️</div>`
      }
    </div>

    <div class="detail-content">
      <span class="product-category">
        ${escapeHTML(product.category || "محصول")}
      </span>

      <h1>${escapeHTML(product.name)}</h1>

      <p class="detail-description">
        ${escapeHTML(product.description || "توضیحی ثبت نشده است.")}
      </p>

      <div class="detail-price">
        ${formatNumber(product.price)} تومان
      </div>

      <p>
        موجودی:
        <strong>
          ${formatNumber(product.stock)}
        </strong>
      </p>

      ${
        Number(product.stock) > 0
          ? `
          <button
            class="btn"
            onclick="addProductToCart(${product.id}, '${escapeJS(product.name)}', ${Number(product.price)})"
          >
            افزودن به سبد خرید
          </button>
          `
          : `
          <div class="out-stock large-stock">
            این محصول فعلاً ناموجود است.
          </div>
          `
      }

      <div class="supplier-box">
        <strong>فروشنده / تأمین‌کننده</strong>
        <p>${escapeHTML(product.supplier_name || "-")}</p>
        <small>ارسال مستقیم توسط تأمین‌کننده</small>
      </div>
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
    <section class="section">

      <div class="section-head">
        <div>
          <span class="small-label">DigiMarixo</span>
          <h1>سبد خرید</h1>
        </div>
      </div>

      <div id="cartItems"></div>

      <div id="cartSummary" class="cart-summary"></div>

    </section>

    <script>
      renderCartPage();

      function renderCartPage() {
        const cart = getCart();

        const container = document.getElementById("cartItems");
        const summary = document.getElementById("cartSummary");

        if (!cart.length) {
          container.innerHTML = \`
            <div class="empty-box">
              <h2>سبد خرید خالی است</h2>
              <p>محصول موردنظر خود را انتخاب کنید.</p>
              <a class="btn" href="/products">مشاهده محصولات</a>
            </div>
          \`;

          summary.innerHTML = "";
          return;
        }

        let total = 0;

        container.innerHTML = cart.map(function(item, index) {
          const itemTotal = Number(item.price) * Number(item.quantity);
          total += itemTotal;

          return \`
            <div class="cart-item">
              <div>
                <strong>\${escapeHtmlClient(item.name)}</strong>
                <span>\${formatNumberClient(item.price)} تومان</span>
              </div>

              <div class="cart-controls">
                <button onclick="changeQty(\${index}, -1)">−</button>
                <span>\${item.quantity}</span>
                <button onclick="changeQty(\${index}, 1)">+</button>
                <button class="remove-btn" onclick="removeCartItem(\${index})">حذف</button>
              </div>
            </div>
          \`;
        }).join("");

        summary.innerHTML = \`
          <div>
            <span>مبلغ کل</span>
            <strong>\${formatNumberClient(total)} تومان</strong>
          </div>

          <button class="btn" onclick="checkoutCart()">
            ثبت سفارش
          </button>
        \`;
      }

      function getCart() {
        try {
          return JSON.parse(localStorage.getItem("digimarixo_cart") || "[]");
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

      function changeQty(index, amount) {
        const cart = getCart();

        cart[index].quantity += amount;

        if (cart[index].quantity <= 0) {
          cart.splice(index, 1);
        }

        saveCart(cart);
        renderCartPage();
      }

      function removeCartItem(index) {
        const cart = getCart();
        cart.splice(index, 1);
        saveCart(cart);
        renderCartPage();
      }

      async function checkoutCart() {
        const cart = getCart();

        if (!cart.length) {
          alert("سبد خرید خالی است.");
          return;
        }

        const customerName = prompt("نام و نام خانوادگی:");

        if (!customerName) return;

        const customerPhone = prompt("شماره تماس:");

        if (!customerPhone) return;

        const customerEmail = prompt("ایمیل، در صورت تمایل:");

        const address = prompt("آدرس کامل ارسال:");

        if (!address) return;

        const result = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_email: customerEmail || "",
            address: address,
            items: cart.map(function(item) {
              return {
                productId: item.productId,
                quantity: item.quantity
              };
            })
          })
        }).then(function(response) {
          return response.json();
        });

        if (!result.ok) {
          alert(result.error || "ثبت سفارش انجام نشد.");
          return;
        }

        localStorage.removeItem("digimarixo_cart");

        alert(
          "سفارش با موفقیت ثبت شد.\\nشماره سفارش: #" +
          result.order_id
        );

        location.href = "/";
      }
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
    <section class="section">
      <div class="account-box card">
        <div class="supplier-icon">👤</div>

        <h1>حساب کاربری</h1>

        <p>
          بخش حساب کاربری مشتری در نسخه بعدی تکمیل خواهد شد.
        </p>

        <a class="btn" href="/products">
          ادامه خرید
        </a>
      </div>
    </section>
    `
  );
}

// ============================================================
// LAYOUT
// ============================================================

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

  <title>${escapeHTML(title)} | ${STORE_NAME}</title>

  <meta
    name="description"
    content="فروشگاه دیجی‌ماریکسو؛ خرید آنلاین و مدیریت سفارش با ارسال مستقیم."
  >

  <meta name="theme-color" content="#07111f">

  <style>
    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      font-family: Tahoma, Arial, sans-serif;
      background: #07111f;
      color: #eef6ff;
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

    button {
      cursor: pointer;
    }

    .site-header {
      position: sticky;
      top: 0;
      z-index: 20;
      background: rgba(7, 17, 31, .96);
      border-bottom: 1px solid rgba(255,255,255,.08);
      backdrop-filter: blur(12px);
    }

    .nav {
      max-width: 1200px;
      margin: auto;
      min-height: 72px;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }

    .logo {
      font-size: 22px;
      font-weight: 900;
      color: #fff;
    }

    .logo span {
      color: #29d3ff;
    }

    .nav-links {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .nav-links a {
      padding: 8px 12px;
      border-radius: 10px;
      color: #cbd9e8;
    }

    .nav-links a:hover {
      background: rgba(255,255,255,.07);
      color: #fff;
    }

    main {
      max-width: 1200px;
      margin: auto;
      padding: 30px 20px 80px;
      min-height: 70vh;
    }

    .hero {
      min-height: 520px;
      display: grid;
      grid-template-columns: 1.4fr .8fr;
      gap: 40px;
      align-items: center;
      padding: 40px 0;
    }

    .hero h1 {
      font-size: clamp(38px, 7vw, 72px);
      line-height: 1.2;
      margin: 15px 0;
    }

    .hero p {
      color: #b9c9da;
      font-size: 19px;
      max-width: 650px;
    }

    .hero-badge,
    .small-label {
      display: inline-block;
      color: #29d3ff;
      font-weight: 800;
      letter-spacing: .5px;
    }

    .hero-card {
      min-height: 300px;
      border: 1px solid rgba(41,211,255,.25);
      border-radius: 30px;
      background: linear-gradient(
        145deg,
        rgba(18,54,88,.95),
        rgba(10,25,43,.95)
      );
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      box-shadow: 0 25px 80px rgba(0,0,0,.25);
    }

    .hero-card div {
      font-size: 90px;
    }

    .hero-card strong {
      font-size: 25px;
    }

    .hero-card span {
      color: #aebfd1;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 25px;
    }

    .btn {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      border: 0;
      border-radius: 12px;
      padding: 11px 18px;
      background: linear-gradient(135deg, #18bfff, #1479ff);
      color: #fff;
      font-weight: 800;
      box-shadow: 0 8px 25px rgba(20,121,255,.18);
    }

    .btn:hover {
      transform: translateY(-1px);
    }

    .btn.secondary {
      background: #17283d;
      border: 1px solid rgba(255,255,255,.1);
    }

    .btn.danger {
      background: #8f2735;
    }

    .btn.small {
      padding: 7px 12px;
      font-size: 13px;
    }

    .btn.full {
      width: 100%;
    }

    .section {
      padding: 35px 0;
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 20px;
      margin-bottom: 25px;
    }

    .section h1,
    .section h2 {
      margin: 4px 0;
    }

    .products-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 18px;
    }

    .product-card,
    .card {
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 20px;
      background: #0d1b2b;
      overflow: hidden;
    }

    .product-image {
      aspect-ratio: 1 / 1;
      background: #12243a;
      overflow: hidden;
    }

    .product-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .product-placeholder {
      width: 100%;
      height: 100%;
      min-height: 180px;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 65px;
    }

    .product-placeholder.large {
      min-height: 400px;
      font-size: 120px;
    }

    .product-body {
      padding: 16px;
    }

    .product-category {
      color: #29d3ff;
      font-size: 12px;
      font-weight: 800;
    }

    .product-body h3 {
      margin: 6px 0;
    }

    .product-body p {
      color: #9eb0c4;
      min-height: 55px;
      font-size: 13px;
    }

    .product-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }

    .product-bottom strong,
    .detail-price {
      color: #ffb83d;
    }

    .out-stock {
      color: #ff7b8b;
      font-size: 13px;
      font-weight: 700;
    }

    .large-stock {
      padding: 12px;
    }

    .detail-page {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      padding: 30px 0;
    }

    .detail-image {
      border-radius: 25px;
      overflow: hidden;
      background: #12243a;
    }

    .detail-image img {
      width: 100%;
      display: block;
      max-height: 600px;
      object-fit: cover;
    }

    .detail-content {
      padding: 20px 0;
    }

    .detail-content h1 {
      font-size: 42px;
      margin: 8px 0 20px;
    }

    .detail-description {
      color: #b9c9da;
      font-size: 17px;
    }

    .detail-price {
      font-size: 28px;
      font-weight: 900;
      margin: 25px 0;
    }

    .supplier-box {
      margin-top: 30px;
      padding: 18px;
      border-radius: 16px;
      background: #102338;
      border: 1px solid rgba(255,255,255,.07);
    }

    .supplier-box p {
      margin: 5px 0;
    }

    .supplier-box small {
      color: #8fa5ba;
    }

    .empty-box {
      padding: 45px 25px;
      text-align: center;
      border-radius: 20px;
      background: #0d1b2b;
      border: 1px dashed rgba(255,255,255,.12);
      grid-column: 1 / -1;
    }

    .cart-item {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: center;
      padding: 18px;
      margin-bottom: 10px;
      border-radius: 16px;
      background: #0d1b2b;
      border: 1px solid rgba(255,255,255,.07);
    }

    .cart-item span,
    .cart-item strong {
      display: block;
    }

    .cart-item span {
      color: #9eb0c4;
    }

    .cart-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .cart-controls button {
      border: 0;
      border-radius: 8px;
      padding: 5px 10px;
      background: #1a3049;
      color: #fff;
    }

    .cart-controls .remove-btn {
      background: #7d2635;
    }

    .cart-summary {
      margin-top: 20px;
      padding: 20px;
      border-radius: 18px;
      background: #102338;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
    }

    .cart-summary strong {
      color: #ffb83d;
      font-size: 22px;
    }

    .account-box {
      max-width: 600px;
      margin: 50px auto;
      padding: 35px;
      text-align: center;
    }

    .supplier-wrap,
    .admin-wrap {
      padding: 20px 0;
    }

    .supplier-login {
      max-width: 500px;
      margin: 50px auto;
      padding: 30px;
    }

    .supplier-icon {
      font-size: 55px;
      text-align: center;
      margin-bottom: 10px;
    }

    form label,
    .supplier-controls label {
      display: block;
      margin: 12px 0 5px;
      color: #b9c9da;
      font-size: 13px;
      font-weight: 700;
    }

    input,
    textarea,
    select {
      width: 100%;
      border: 1px solid rgba(255,255,255,.1);
      background: #091725;
      color: #fff;
      border-radius: 10px;
      padding: 11px 12px;
      outline: none;
    }

    textarea {
      min-height: 90px;
      resize: vertical;
    }

    input:focus,
    textarea:focus,
    select:focus {
      border-color: #29d3ff;
    }

    .message {
      margin-top: 12px;
      color: #72e4a2;
      font-size: 13px;
    }

    .dashboard-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      margin-bottom: 25px;
    }

    .supplier-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 25px;
    }

    .stat-card {
      padding: 20px;
      border-radius: 17px;
      background: #0d1b2b;
      border: 1px solid rgba(255,255,255,.07);
      text-align: center;
    }

    .stat-card strong {
      display: block;
      font-size: 30px;
      color: #29d3ff;
    }

    .stat-card span {
      color: #9eb0c4;
    }

    .orders-grid {
      display: grid;
      gap: 18px;
    }

    .supplier-order {
      padding: 22px;
      overflow: visible;
    }

    .order-top {
      display: flex;
      justify-content: space-between;
      gap: 15px;
      align-items: start;
      border-bottom: 1px solid rgba(255,255,255,.07);
      padding-bottom: 15px;
    }

    .order-top h2 {
      margin: 4px 0;
    }

    .order-number {
      color: #29d3ff;
      font-size: 13px;
      font-weight: 800;
    }

    .status-badge {
      padding: 7px 12px;
      border-radius: 10px;
      background: #173451;
      color: #69dfff;
      font-size: 12px;
      white-space: nowrap;
    }

    .customer-info {
      margin: 15px 0;
      color: #c1cedc;
    }

    .customer-info p {
      margin: 5px 0;
    }

    .items-list {
      margin: 15px 0;
    }

    .order-item {
      display: flex;
      justify-content: space-between;
      gap: 15px;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255,255,255,.05);
    }

    .order-item span {
      display: block;
      color: #9eb0c4;
      font-size: 13px;
    }

    .order-total {
      display: flex;
      justify-content: space-between;
      gap: 15px;
      padding: 15px 0;
    }

    .order-total strong {
      color: #ffb83d;
    }

    .supplier-controls {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid rgba(255,255,255,.07);
    }

    .tracking-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
    }

    .admin-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .admin-grid .card,
    .admin-section {
      padding: 22px;
    }

    .admin-section {
      margin-top: 20px;
      overflow: hidden;
    }

    .check-row {
      display: flex !important;
      gap: 8px;
      align-items: center;
    }

    .check-row input {
      width: auto;
    }

    .table-wrap {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 600px;
    }

    th,
    td {
      text-align: right;
      padding: 12px;
      border-bottom: 1px solid rgba(255,255,255,.07);
    }

    th {
      color: #29d3ff;
      font-size: 13px;
    }

    td {
      color: #c5d2df;
      font-size: 13px;
    }

    .orders-list {
      display: grid;
      gap: 10px;
    }

    .admin-order {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      padding: 15px;
      border-radius: 12px;
      background: #091725;
    }

    .admin-order span,
    .admin-order small {
      display: block;
      color: #9eb0c4;
    }

    .loading {
      text-align: center;
      padding: 30px;
      color: #9eb0c4;
    }

    footer {
      border-top: 1px solid rgba(255,255,255,.07);
      padding: 30px 20px;
      text-align: center;
      color: #8498ad;
    }

    @media (max-width: 900px) {
      .products-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .hero,
      .detail-page,
      .admin-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 600px) {
      .nav {
        flex-direction: column;
        align-items: stretch;
      }

      .nav-links {
        justify-content: center;
      }

      main {
        padding-left: 14px;
        padding-right: 14px;
      }

      .products-grid {
        grid-template-columns: 1fr;
      }

      .hero {
        min-height: auto;
      }

      .hero h1 {
        font-size: 40px;
      }

      .supplier-stats {
        grid-template-columns: 1fr;
      }

      .dashboard-head,
      .section-head,
      .cart-summary,
      .cart-item,
      .order-top {
        flex-direction: column;
        align-items: stretch;
      }

      .tracking-row {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>

<body>

<header class="site-header">
  <nav class="nav">

    <a class="logo" href="/">
      <span>Digi</span>Marixo
    </a>

    <div class="nav-links">
      <a href="/">خانه</a>
      <a href="/products">محصولات</a>
      <a href="/account">حساب کاربری</a>
      <a href="/cart">🛒 سبد خرید</a>
      <a href="/supplier">تأمین‌کننده</a>
      <a href="/admin">مدیریت</a>
    </div>

  </nav>
</header>

<main>
  ${content}
</main>

<footer>
  <strong>${STORE_NAME}</strong>
  <br>
  خرید آنلاین و مدیریت سفارش با ارسال مستقیم
  <br>
  © ${new Date().getFullYear()} DigiMarixo
</footer>

<script>
  function getGlobalCart() {
    try {
      return JSON.parse(
        localStorage.getItem("digimarixo_cart") || "[]"
      );
    } catch {
      return [];
    }
  }

  function saveGlobalCart(cart) {
    localStorage.setItem(
      "digimarixo_cart",
      JSON.stringify(cart)
    );
  }

  function addProductToCart(productId, name, price) {
    const cart = getGlobalCart();

    const existing = cart.find(function(item) {
      return Number(item.productId) === Number(productId);
    });

    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        productId: Number(productId),
        name: name,
        price: Number(price),
        quantity: 1
      });
    }

    saveGlobalCart(cart);

    alert("محصول به سبد خرید اضافه شد.");
  }
</script>

</body>
</html>
  `;
}

// ============================================================
// AUTH
// ============================================================

function isAdminAPI(request, env) {
  const password =
    request.headers.get("X-Admin-Password") || "";

  return !!env.ADMIN_PASSWORD &&
    password === env.ADMIN_PASSWORD;
}

function isBasicAdmin(request, env) {
  const header =
    request.headers.get("Authorization") || "";

  if (!header.startsWith("Basic ")) {
    return false;
  }

  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");

    if (separator === -1) {
      return false;
    }

    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);

    return (
      username === "مدیر" &&
      !!env.ADMIN_PASSWORD &&
      password === env.ADMIN_PASSWORD
    );
  } catch {
    return false;
  }
}

function basicAuthResponse() {
  return new Response(
    "Authentication required",
    {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="DigiMarixo Admin", charset="UTF-8"',
        "content-type": "text/plain; charset=UTF-8"
      }
    }
  );
}

// ============================================================
// PASSWORD HASHING
// ============================================================

async function hashPassword(password) {
  const salt = randomBytes(16);

  const keyMaterial =
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
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

  return [
    "pbkdf2",
    "sha256",
    "100000",
    bytesToBase64(salt),
    bytesToBase64(new Uint8Array(bits))
  ].join("$");
}

async function verifyPassword(password, stored) {
  const parts = String(stored).split("$");

  if (parts.length !== 5) {
    return false;
  }

  const iterations = Number(parts[2]);

  if (!iterations) {
    return false;
  }

  const salt = base64ToBytes(parts[3]);
  const expected = base64ToBytes(parts[4]);

  const keyMaterial =
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );

  const bits =
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256"
      },
      keyMaterial,
      256
    );

  const actual = new Uint8Array(bits);

  return constantTimeEqual(actual, expected);
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

// ============================================================
// CRYPTO HELPERS
// ============================================================

async function sha256(value) {
  const data =
    typeof value === "string"
      ? new TextEncoder().encode(value)
      : value;

  const hash =
    await crypto.subtle.digest("SHA-256", data);

  return bytesToBase64(new Uint8Array(hash));
}

function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function randomToken(length) {
  return bytesToBase64Url(randomBytes(length));
}

function bytesToBase64(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64ToBytes(value) {
  const binary = atob(value);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

// ============================================================
// COOKIE
// ============================================================

function parseCookies(header) {
  const result = {};

  for (const part of header.split(";")) {
    const index = part.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    result[key] = value;
  }

  return result;
}

// ============================================================
// HELPERS
// ============================================================

async function readJSON(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "content-type": "application/json; charset=UTF-8"
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
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "no-store"
      }
    }
  );
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizePrice(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value ?? "")
    .replace(/,/g, "")
    .replace(/٬/g, "")
    .replace(/[۰-۹]/g, digit => {
      return String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit));
    })
    .replace(/[٠-٩]/g, digit => {
      return String("٠١٢٣٤٥٦٧٨٩".indexOf(digit));
    });

  const number = Number(normalized);

  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("fa-IR");
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHTML(value);
}

function escapeJS(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safeError(error) {
  if (!error) {
    return "Unknown error";
  }

  return String(error.message || error)
    .replace(/\n/g, " ")
    .slice(0, 500);
}
