const STORE_NAME = "دیجی‌ماریکسو";
const STORE_EN = "DigiMarixo";
const DEFAULT_ADMIN_USERNAME = "مدیر";
const DEFAULT_ADMIN_PASSWORD = "مدیر";

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
        return json(await getProduct(env, path.split("/").pop()));
      }

      if (path === "/api/suppliers" && method === "GET") {
        return json(await getSuppliers(env));
      }

      if (path === "/api/admin/suppliers" && method === "POST") {
        if (!isAdmin(request, env)) {
          return json({ ok: false, error: "دسترسی مدیریت مجاز نیست." }, 401);
        }
        return await createSupplier(request, env);
      }

      if (path === "/api/admin/products" && method === "POST") {
        if (!isAdmin(request, env)) {
          return json({ ok: false, error: "دسترسی مدیریت مجاز نیست." }, 401);
        }
        return await createProduct(request, env);
      }

      if (path === "/api/admin/products" && method === "PUT") {
        if (!isAdmin(request, env)) {
          return json({ ok: false, error: "دسترسی مدیریت مجاز نیست." }, 401);
        }
        return await updateProduct(request, env);
      }

      if (path === "/api/admin/orders/status" && method === "PUT") {
        if (!isAdmin(request, env)) {
          return json({ ok: false, error: "دسترسی مدیریت مجاز نیست." }, 401);
        }
        return await updateOrderStatus(request, env);
      }

      if (path === "/api/orders" && method === "POST") {
        return await createOrder(request, env);
      }

      if (path === "/api/orders" && method === "GET") {
        return json(await getOrders(env));
      }

      if (path === "/account") {
        return html(accountPage());
      }

      if (path === "/admin") {
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
                <section class="page-title">
                  <span class="eyebrow">DigiMarixo</span>
                  <h1>محصول پیدا نشد</h1>
                  <p>محصول موردنظر در فروشگاه وجود ندارد.</p>
                  <a class="btn primary" href="/products">بازگشت به محصولات</a>
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
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      direct_shipping INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      supplier_id INTEGER DEFAULT NULL,
      supplier_price INTEGER DEFAULT 0,
      commission INTEGER DEFAULT 0
    )
  `).run();

  const productInfo = await env.DB
    .prepare(`PRAGMA table_info(products)`)
    .all();

  const productColumns = new Set(
    (productInfo.results || []).map(x => x.name)
  );

  const productMigrations = [
    ["category", "ALTER TABLE products ADD COLUMN category TEXT DEFAULT ''"],
    ["stock", "ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0"],
    ["image", "ALTER TABLE products ADD COLUMN image TEXT DEFAULT ''"],
    ["active", "ALTER TABLE products ADD COLUMN active INTEGER DEFAULT 1"],
    ["supplier_id", "ALTER TABLE products ADD COLUMN supplier_id INTEGER DEFAULT NULL"],
    ["supplier_price", "ALTER TABLE products ADD COLUMN supplier_price INTEGER DEFAULT 0"],
    ["commission", "ALTER TABLE products ADD COLUMN commission INTEGER DEFAULT 0"]
  ];

  for (const [name, sql] of productMigrations) {
    if (!productColumns.has(name)) {
      await env.DB.prepare(sql).run();
    }
  }

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_email TEXT DEFAULT '',
      customer_phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      total INTEGER DEFAULT 0,
      status TEXT DEFAULT 'در انتظار',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      supplier_id INTEGER DEFAULT NULL,
      supplier_status TEXT DEFAULT 'جدید',
      shipping_status TEXT DEFAULT 'در انتظار ارسال'
    )
  `).run();

  const orderInfo = await env.DB
    .prepare(`PRAGMA table_info(orders)`)
    .all();

  const orderColumns = new Set(
    (orderInfo.results || []).map(x => x.name)
  );

  const orderMigrations = [
    ["supplier_id", "ALTER TABLE orders ADD COLUMN supplier_id INTEGER DEFAULT NULL"],
    ["supplier_status", "ALTER TABLE orders ADD COLUMN supplier_status TEXT DEFAULT 'جدید'"],
    ["shipping_status", "ALTER TABLE orders ADD COLUMN shipping_status TEXT DEFAULT 'در انتظار ارسال'"]
  ];

  for (const [name, sql] of orderMigrations) {
    if (!orderColumns.has(name)) {
      await env.DB.prepare(sql).run();
    }
  }

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      supplier_id INTEGER DEFAULT NULL,
      quantity INTEGER DEFAULT 1,
      price INTEGER DEFAULT 0,
      supplier_price INTEGER DEFAULT 0,
      commission INTEGER DEFAULT 0
    )
  `).run();

  const itemInfo = await env.DB
    .prepare(`PRAGMA table_info(order_items)`)
    .all();

  const itemColumns = new Set(
    (itemInfo.results || []).map(x => x.name)
  );

  const itemMigrations = [
    ["supplier_id", "ALTER TABLE order_items ADD COLUMN supplier_id INTEGER DEFAULT NULL"],
    ["supplier_price", "ALTER TABLE order_items ADD COLUMN supplier_price INTEGER DEFAULT 0"],
    ["commission", "ALTER TABLE order_items ADD COLUMN commission INTEGER DEFAULT 0"]
  ];

  for (const [name, sql] of itemMigrations) {
    if (!itemColumns.has(name)) {
      await env.DB.prepare(sql).run();
    }
  }

  await env.DB.prepare(`
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
}


/* =========================================================
   ADMIN
========================================================= */

function isAdmin(request, env) {
  const supplied = request.headers.get("X-Admin-Password") || "";
  const expected = env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  return supplied === expected;
}


/* =========================================================
   PRODUCTS
========================================================= */

async function getProducts(env) {
  const result = await env.DB.prepare(`
    SELECT
      p.*,
      s.name AS supplier_name,
      s.direct_shipping AS supplier_direct_shipping
    FROM products p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.active = 1
    ORDER BY p.id DESC
  `).all();

  return {
    ok: true,
    products: (result.results || []).map(p => ({
      ...p,
      price: normalizePrice(p.price),
      supplier_price: normalizePrice(p.supplier_price),
      commission: normalizePrice(p.commission)
    }))
  };
}


async function getProduct(env, id) {
  const product = await env.DB.prepare(`
    SELECT
      p.*,
      s.name AS supplier_name,
      s.phone AS supplier_phone,
      s.email AS supplier_email,
      s.direct_shipping AS supplier_direct_shipping
    FROM products p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.id = ?
    LIMIT 1
  `).bind(id).first();

  if (!product) {
    return {
      ok: false,
      error: "محصول پیدا نشد"
    };
  }

  product.price = normalizePrice(product.price);
  product.supplier_price = normalizePrice(product.supplier_price);
  product.commission = normalizePrice(product.commission);

  return {
    ok: true,
    product
  };
}


/* =========================================================
   SUPPLIERS
========================================================= */

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
    ORDER BY id DESC
  `).all();

  return {
    ok: true,
    suppliers: result.results || []
  };
}


async function createSupplier(request, env) {
  let data;

  try {
    data = await request.json();
  } catch {
    return json({
      ok: false,
      error: "اطلاعات فروشنده نامعتبر است."
    }, 400);
  }

  const name = String(data.name || "").trim();
  const phone = String(data.phone || "").trim();
  const email = String(data.email || "").trim();
  const address = String(data.address || "").trim();

  const directShipping =
    Number(data.direct_shipping) === 1 ? 1 : 0;

  const active =
    Number(data.active) === 0 ? 0 : 1;

  if (!name) {
    return json({
      ok: false,
      error: "نام فروشنده الزامی است."
    }, 400);
  }

  const result = await env.DB.prepare(`
    INSERT INTO suppliers
    (name, phone, email, address, direct_shipping, active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    name,
    phone,
    email,
    address,
    directShipping,
    active
  ).run();

  return json({
    ok: true,
    supplier_id: result.meta.last_row_id
  });
}


/* =========================================================
   CREATE PRODUCT
========================================================= */

async function createProduct(request, env) {
  let data;

  try {
    data = await request.json();
  } catch {
    return json({
      ok: false,
      error: "اطلاعات محصول نامعتبر است."
    }, 400);
  }

  const name = String(data.name || "").trim();
  const description = String(data.description || "").trim();
  const category = String(data.category || "").trim();
  const image = String(data.image || "").trim();

  const price = normalizePrice(data.price);

  const stock = Math.max(
    0,
    Math.floor(Number(data.stock || 0))
  );

  const supplierId = Number(data.supplier_id || 0);
  const supplierPrice = normalizePrice(data.supplier_price);
  const commission = normalizePrice(data.commission);

  const active =
    Number(data.active) === 0 ? 0 : 1;

  if (!name) {
    return json({
      ok: false,
      error: "نام محصول الزامی است."
    }, 400);
  }

  if (price <= 0) {
    return json({
      ok: false,
      error: "قیمت فروش باید بیشتر از صفر باشد."
    }, 400);
  }

  if (!supplierId) {
    return json({
      ok: false,
      error: "فروشنده محصول را انتخاب کنید."
    }, 400);
  }

  const supplier = await env.DB.prepare(`
    SELECT id, active, direct_shipping
    FROM suppliers
    WHERE id = ?
    LIMIT 1
  `).bind(supplierId).first();

  if (!supplier) {
    return json({
      ok: false,
      error: "فروشنده پیدا نشد."
    }, 400);
  }

  if (Number(supplier.active) !== 1) {
    return json({
      ok: false,
      error: "فروشنده فعال نیست."
    }, 400);
  }

  if (Number(supplier.direct_shipping) !== 1) {
    return json({
      ok: false,
      error: "فروشنده ارسال مستقیم به مشتری را تأیید نکرده است."
    }, 400);
  }

  const result = await env.DB.prepare(`
    INSERT INTO products
    (
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    name,
    description,
    price,
    image,
    category,
    stock,
    active,
    supplierId,
    supplierPrice,
    commission
  ).run();

  return json({
    ok: true,
    product_id: result.meta.last_row_id
  });
}


/* =========================================================
   UPDATE PRODUCT
========================================================= */

async function updateProduct(request, env) {
  let data;

  try {
    data = await request.json();
  } catch {
    return json({
      ok: false,
      error: "اطلاعات محصول نامعتبر است."
    }, 400);
  }

  const id = Number(data.id);

  if (!id) {
    return json({
      ok: false,
      error: "شناسه محصول نامعتبر است."
    }, 400);
  }

  const current = await env.DB.prepare(`
    SELECT id FROM products WHERE id = ? LIMIT 1
  `).bind(id).first();

  if (!current) {
    return json({
      ok: false,
      error: "محصول پیدا نشد."
    }, 404);
  }

  const name = String(data.name || "").trim();
  const description = String(data.description || "").trim();
  const category = String(data.category || "").trim();
  const image = String(data.image || "").trim();

  const price = normalizePrice(data.price);

  const stock = Math.max(
    0,
    Math.floor(Number(data.stock || 0))
  );

  const supplierId = Number(data.supplier_id || 0);
  const supplierPrice = normalizePrice(data.supplier_price);
  const commission = normalizePrice(data.commission);

  const active =
    Number(data.active) === 0 ? 0 : 1;

  if (!name) {
    return json({
      ok: false,
      error: "نام محصول الزامی است."
    }, 400);
  }

  if (price <= 0) {
    return json({
      ok: false,
      error: "قیمت فروش باید بیشتر از صفر باشد."
    }, 400);
  }

  if (!supplierId) {
    return json({
      ok: false,
      error: "فروشنده محصول را انتخاب کنید."
    }, 400);
  }

  const supplier = await env.DB.prepare(`
    SELECT id, active, direct_shipping
    FROM suppliers
    WHERE id = ?
    LIMIT 1
  `).bind(supplierId).first();

  if (!supplier) {
    return json({
      ok: false,
      error: "فروشنده پیدا نشد."
    }, 400);
  }

  if (Number(supplier.active) !== 1) {
    return json({
      ok: false,
      error: "فروشنده فعال نیست."
    }, 400);
  }

  if (Number(supplier.direct_shipping) !== 1) {
    return json({
      ok: false,
      error: "فروشنده ارسال مستقیم را تأیید نکرده است."
    }, 400);
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
    name,
    description,
    price,
    image,
    category,
    stock,
    active,
    supplierId,
    supplierPrice,
    commission,
    id
  ).run();

  return json({ ok: true });
}


/* =========================================================
   ORDERS
========================================================= */

async function createOrder(request, env) {
  let data;

  try {
    data = await request.json();
  } catch {
    return json({
      ok: false,
      error: "اطلاعات سفارش نامعتبر است."
    }, 400);
  }

  const customerName = String(data.customer_name || "").trim();
  const customerEmail = String(data.customer_email || "").trim();
  const customerPhone = String(data.customer_phone || "").trim();
  const address = String(data.address || "").trim();
  const items = Array.isArray(data.items) ? data.items : [];

  if (!customerName) {
    return json({ ok: false, error: "نام الزامی است." }, 400);
  }

  if (!customerPhone) {
    return json({ ok: false, error: "شماره تماس الزامی است." }, 400);
  }

  if (!address) {
    return json({ ok: false, error: "آدرس الزامی است." }, 400);
  }

  if (!items.length) {
    return json({ ok: false, error: "سبد خرید خالی است." }, 400);
  }

  let total = 0;
  const orderItems = [];
  const supplierGroups = new Map();

  for (const item of items) {
    const productId = Number(item.product_id ?? item.id);
    const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));

    if (!Number.isFinite(productId) || !Number.isFinite(quantity)) {
      return json({
        ok: false,
        error: "اطلاعات محصول نامعتبر است."
      }, 400);
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
        s.direct_shipping AS supplier_direct_shipping,
        s.active AS supplier_active
      FROM products p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.id = ?
      LIMIT 1
    `).bind(productId).first();

    if (!product || Number(product.active) !== 1) {
      return json({
        ok: false,
        error: "یکی از محصولات موجود نیست."
      }, 400);
    }

    if (Number(product.stock) < quantity) {
      return json({
        ok: false,
        error: "موجودی محصول کافی نیست."
      }, 400);
    }

    if (!product.supplier_id) {
      return json({
        ok: false,
        error: "فروشنده این محصول هنوز مشخص نشده است."
      }, 400);
    }

    if (Number(product.supplier_active) !== 1) {
      return json({
        ok: false,
        error: "فروشنده این محصول فعال نیست."
      }, 400);
    }

    if (Number(product.supplier_direct_shipping) !== 1) {
      return json({
        ok: false,
        error: "فروشنده این محصول هنوز ارسال مستقیم به مشتری را تأیید نکرده است."
      }, 400);
    }

    const price = normalizePrice(product.price);
    const supplierPrice = normalizePrice(product.supplier_price);
    const commission = normalizePrice(product.commission);

    if (price <= 0) {
      return json({
        ok: false,
        error: "قیمت این محصول هنوز تعیین نشده است."
      }, 400);
    }

    total += price * quantity;

    const orderItem = {
      productId,
      supplierId: Number(product.supplier_id),
      quantity,
      price,
      supplierPrice,
      commission
    };

    orderItems.push(orderItem);

    if (!supplierGroups.has(orderItem.supplierId)) {
      supplierGroups.set(orderItem.supplierId, []);
    }

    supplierGroups.get(orderItem.supplierId).push(orderItem);
  }

  const order = await env.DB.prepare(`
    INSERT INTO orders
    (
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

  const orderId = order.meta.last_row_id;

  for (const item of orderItems) {
    await env.DB.prepare(`
      INSERT INTO order_items
      (
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
      item.supplierId,
      item.quantity,
      item.price,
      item.supplierPrice,
      item.commission
    ).run();

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

  for (const supplierId of supplierGroups.keys()) {
    await env.DB.prepare(`
      INSERT INTO supplier_orders
      (
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

  return json({
    ok: true,
    order_id: orderId,
    total,
    suppliers: supplierGroups.size
  });
}


async function getOrders(env) {
  const result = await env.DB.prepare(`
    SELECT
      id,
      customer_name,
      customer_email,
      customer_phone,
      address,
      total,
      status,
      supplier_status,
      shipping_status,
      created_at
    FROM orders
    ORDER BY id DESC
  `).all();

  return {
    ok: true,
    orders: result.results || []
  };
}


async function updateOrderStatus(request, env) {
  let data;

  try {
    data = await request.json();
  } catch {
    return json({
      ok: false,
      error: "اطلاعات نامعتبر است."
    }, 400);
  }

  const id = Number(data.id);
  const status = String(data.status || "در حال بررسی").trim();
  const supplierStatus = String(
    data.supplier_status || "در انتظار فروشنده"
  ).trim();
  const shippingStatus = String(
    data.shipping_status || "در انتظار ارسال"
  ).trim();

  if (!id) {
    return json({
      ok: false,
      error: "شناسه سفارش نامعتبر است."
    }, 400);
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
    id
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
    id
  ).run();

  return json({ ok: true });
}


/* =========================================================
   HOME
========================================================= */

async function homePage(env) {
  const data = await getProducts(env);
  const products = data.products || [];

  const cards = products.length
    ? products.slice(0, 6).map(productCard).join("")
    : `<div class="empty">هنوز محصولی در فروشگاه ثبت نشده است.</div>`;

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
          خرید و دسترسی آسان به محصولات
          با تجربه‌ای ساده، سریع و مطمئن.
        </p>

        <div class="hero-actions">
          <a class="btn primary" href="/products">محصولات ویژه</a>
          <a class="btn secondary" href="/account">حساب کاربری</a>
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

        <a href="/products" class="text-link">مشاهده همه</a>
      </div>

      <div class="products-grid">
        ${cards}
      </div>
    </section>

    <section class="features" id="features">
      <div class="feature">
        <div class="feature-icon">⚡</div>
        <h3>سریع</h3>
        <p>دسترسی آسان و سریع به محصولات.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">🔒</div>
        <h3>مطمئن</h3>
        <p>مدیریت سفارش‌ها و اطلاعات در یک محیط امن.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">◆</div>
        <h3>دیجیتال</h3>
        <p>تمرکز فروشگاه بر محصولات و خدمات کاربردی.</p>
      </div>

      <div class="feature">
        <div class="feature-icon">✓</div>
        <h3>ساده</h3>
        <p>رابط کاربری ساده برای خرید راحت‌تر.</p>
      </div>
    </section>

    <section class="promo">
      <div>
        <span class="eyebrow">DigiMarixo</span>
        <h2>همه‌چیز برای یک خرید ساده</h2>
        <p>محصولات را بررسی کنید و سفارش خود را مدیریت کنید.</p>
      </div>

      <a class="btn orange" href="/products">شروع خرید</a>
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
    : `<div class="empty">محصولی برای نمایش وجود ندارد.</div>`;

  return layout(
    "محصولات",
    `
    <section class="page-title">
      <span class="eyebrow">دیجی‌ماریکسو</span>
      <h1>محصولات فروشگاه</h1>
      <p>محصولات موجود در دیجی‌ماریکسو را مشاهده کنید.</p>
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
    ? `<img src="${escapeAttr(product.image)}" alt="${escapeAttr(product.name)}">`
    : `<div class="product-placeholder large">◆</div>`;

  const stock = Number(product.stock || 0);
  const price = normalizePrice(product.price);

  const canBuy =
    stock > 0 &&
    Number(product.supplier_id) > 0 &&
    Number(product.supplier_direct_shipping) === 1 &&
    price > 0;

  return `
    <section class="product-detail">
      <div class="detail-image">${image}</div>

      <div class="detail-content">
        <span class="product-category">
          ${escapeHTML(product.category || "عمومی")}
        </span>

        <h1>${escapeHTML(product.name || "محصول")}</h1>

        <p class="detail-description">
          ${escapeHTML(product.description || "محصول دیجی‌ماریکسو")}
        </p>

        <div class="detail-price">
          ${formatPrice(price)}
        </div>

        <div class="detail-stock">
          ${
            stock > 0
              ? `موجودی: ${formatNumber(stock)}`
              : "ناموجود"
          }
        </div>

        ${
          canBuy
            ? `
              <button
                class="btn orange"
                onclick="addToCart(
                  ${Number(product.id)},
                  '${escapeJS(product.name || "محصول")}',
                  ${price}
                )"
              >
                افزودن به سبد خرید
              </button>
            `
            : `
              <button class="btn disabled" disabled>
                فعلاً قابل خرید نیست
              </button>

              <p style="color:#64748b;font-size:13px;margin-top:12px">
                این محصول هنوز برای فروش واقعی فعال نشده است.
              </p>
            `
        }

        <a class="btn secondary" href="/products">
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
  const name = escapeHTML(product.name || "محصول");
  const description = escapeHTML(
    product.description || "محصول دیجی‌ماریکسو"
  );

  const price = normalizePrice(product.price);
  const stock = Number(product.stock || 0);

  const canBuy =
    stock > 0 &&
    Number(product.supplier_id) > 0 &&
    Number(product.supplier_direct_shipping) === 1 &&
    price > 0;

  const image = product.image
    ? `<img src="${escapeAttr(product.image)}" alt="${escapeAttr(product.name || "محصول")}">`
    : `<div class="product-placeholder">◆</div>`;

  return `
    <article class="product-card">
      <div class="product-image">
        ${image}
      </div>

      <div class="product-body">
        <span class="product-category">
          ${escapeHTML(product.category || "عمومی")}
        </span>

        <h3>${name}</h3>

        <p>${description}</p>

        <div class="product-bottom">
          <strong>${formatPrice(price)}</strong>

          <span class="stock">
            ${stock > 0 ? "موجود" : "ناموجود"}
          </span>
        </div>

        <div class="product-actions">
          <a class="btn small primary" href="/products?id=${id}">
            مشاهده
          </a>

          ${
            canBuy
              ? `
                <button
                  class="btn small orange"
                  onclick="addToCart(
                    ${id},
                    '${escapeJS(product.name || "محصول")}',
                    ${price}
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
        <span class="eyebrow">دیجی‌ماریکسو</span>
        <h1>حساب کاربری</h1>
        <p>مدیریت حساب و سفارش‌های دیجی‌ماریکسو</p>

        <form onsubmit="return false;">
          <label>نام کاربری یا ایمیل</label>
          <input type="text" placeholder="نام کاربری یا ایمیل">

          <label>رمز عبور</label>
          <input type="password" placeholder="رمز عبور">

          <button
            class="btn primary"
            type="button"
            onclick="alert('بخش ورود در حال آماده‌سازی است.')"
          >
            ورود
          </button>
        </form>

        <div class="account-links">
          <a href="#register">ثبت‌نام</a>
          <a href="/">بازگشت به فروشگاه</a>
        </div>
      </div>

      <div class="account-card register" id="register">
        <h2>ایجاد حساب</h2>

        <form onsubmit="return false;">
          <label>نام کاربری</label>
          <input type="text" placeholder="نام کاربری">

          <label>ایمیل</label>
          <input type="email" placeholder="ایمیل">

          <label>رمز عبور</label>
          <input type="password" placeholder="رمز عبور">

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
      <span class="eyebrow">دیجی‌ماریکسو</span>
      <h1>سبد خرید</h1>
      <p>محصولات انتخاب شده شما.</p>
    </section>

    <section class="cart-box">
      <div id="cart-items">
        <div class="empty">سبد خرید شما خالی است.</div>
      </div>

      <div class="cart-total">
        <span>مجموع</span>
        <strong id="cart-total">۰ تومان</strong>
      </div>

      <div class="cart-actions">
        <button class="btn orange" onclick="checkoutCart()">
          ثبت سفارش
        </button>

        <a class="btn secondary" href="/products">
          ادامه خرید
        </a>
      </div>
    </section>
    `
  );
}


/* =========================================================
   ADMIN PAGE
========================================================= */

async function adminPage(env) {
  const productCount = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM products
  `).first();

  const supplierCount = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM suppliers
  `).first();

  const orderCount = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM orders
  `).first();

  const supplierData = await getSuppliers(env);
  const suppliers = supplierData.suppliers || [];

  const productData = await env.DB.prepare(`
    SELECT
      p.id,
      p.name,
      p.price,
      p.stock,
      p.active,
      p.category,
      p.supplier_id,
      p.supplier_price,
      p.commission,
      s.name AS supplier_name
    FROM products p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    ORDER BY p.id DESC
  `).all();

  const orderData = await env.DB.prepare(`
    SELECT
      id,
      customer_name,
      customer_phone,
      total,
      status,
      supplier_status,
      shipping_status,
      created_at
    FROM orders
    ORDER BY id DESC
    LIMIT 30
  `).all();

  const productsList = productData.results || [];
  const ordersList = orderData.results || [];

  const supplierOptions = suppliers.length
    ? suppliers.map(s => `
        <option value="${Number(s.id)}">
          ${escapeHTML(s.name)}
          ${
            Number(s.direct_shipping) === 1
              ? " — ارسال مستقیم"
              : " — ارسال مستقیم تأیید نشده"
          }
        </option>
      `).join("")
    : `
      <option value="">
        هنوز فروشنده‌ای ثبت نشده است
      </option>
    `;

  const productRows = productsList.length
    ? productsList.map(p => `
        <div class="admin-card" style="grid-column:1/-1">
          <strong>${escapeHTML(p.name)}</strong>

          <span>
            قیمت فروش: ${formatPrice(p.price)}
          </span>

          <span>
            موجودی: ${formatNumber(p.stock)}
          </span>

          <span>
            فروشنده:
            ${
              p.supplier_name
                ? escapeHTML(p.supplier_name)
                : "تعیین نشده"
            }
          </span>

          <span>
            وضعیت:
            ${Number(p.active) === 1 ? "فعال" : "غیرفعال"}
          </span>

          <button
            class="btn small primary"
            style="margin-top:12px"
            onclick="editProduct(${Number(p.id)})"
          >
            ویرایش محصول
          </button>
        </div>
      `).join("")
    : `
      <div class="empty" style="grid-column:1/-1">
        هنوز محصولی ثبت نشده است.
      </div>
    `;

  const orderRows = ordersList.length
    ? ordersList.map(o => `
        <div class="admin-card" style="grid-column:1/-1">
          <strong>سفارش #${Number(o.id)}</strong>

          <span>
            مشتری: ${escapeHTML(o.customer_name)}
          </span>

          <span>
            تلفن: ${escapeHTML(o.customer_phone)}
          </span>

          <span>
            مبلغ: ${formatPrice(o.total)}
          </span>

          <span>
            وضعیت: ${escapeHTML(o.status)}
          </span>

          <span>
            وضعیت فروشنده:
            ${escapeHTML(o.supplier_status)}
          </span>

          <span>
            ارسال:
            ${escapeHTML(o.shipping_status)}
          </span>

          <select
            id="order-status-${Number(o.id)}"
            style="width:100%;margin-top:12px;padding:10px;border:1px solid #cbd5e1;border-radius:10px"
          >
            <option value="در حال بررسی">در حال بررسی</option>
            <option value="تأیید شد">تأیید شد</option>
            <option value="لغو شد">لغو شد</option>
            <option value="ارسال شد">ارسال شد</option>
            <option value="تحویل شد">تحویل شد</option>
          </select>

          <button
            class="btn small orange"
            style="margin-top:10px"
            onclick="updateOrderStatus(${Number(o.id)})"
          >
            ذخیره وضعیت
          </button>
        </div>
      `).join("")
    : `
      <div class="empty" style="grid-column:1/-1">
        هنوز سفارشی ثبت نشده است.
      </div>
    `;

  return layout(
    "مدیریت",
    `
    <section class="page-title">
      <span class="eyebrow">مدیر</span>
      <h1>مدیریت دیجی‌ماریکسو</h1>
      <p>پنل مدیریت فروشگاه دیجی‌ماریکسو.</p>
    </section>

    <section class="admin-grid">

      <div class="admin-card">
        <strong>محصولات</strong>
        <span>
          ${formatNumber(productCount?.count || 0)}
          محصول ثبت شده
        </span>
      </div>

      <div class="admin-card">
        <strong>فروشندگان</strong>
        <span>
          ${formatNumber(supplierCount?.count || 0)}
          فروشنده ثبت شده
        </span>
      </div>

      <div class="admin-card">
        <strong>سفارش‌ها</strong>
        <span>
          ${formatNumber(orderCount?.count || 0)}
          سفارش ثبت شده
        </span>
      </div>

    </section>

    <section class="section">
      <div class="section-head">
        <div>
          <span class="eyebrow">فروشنده</span>
          <h2>افزودن فروشنده</h2>
        </div>
      </div>

      <div class="account-card">
        <form id="supplier-form" onsubmit="return createSupplierForm(event)">

          <label>نام فروشنده</label>
          <input id="supplier-name" required placeholder="نام فروشنده یا شرکت">

          <label>شماره تماس</label>
          <input id="supplier-phone" placeholder="شماره تماس">

          <label>ایمیل</label>
          <input id="supplier-email" type="email" placeholder="ایمیل">

          <label>آدرس</label>
          <input id="supplier-address" placeholder="آدرس">

          <label>ارسال مستقیم</label>
          <select id="supplier-direct">
            <option value="1">بله، مستقیم برای مشتری ارسال می‌کند</option>
            <option value="0">خیر</option>
          </select>

          <button class="btn orange" type="submit">
            ثبت فروشنده
          </button>

        </form>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div>
          <span class="eyebrow">محصول</span>
          <h2>افزودن محصول</h2>
        </div>
      </div>

      <div class="account-card">
        <form id="product-form" onsubmit="return createProductForm(event)">

          <label>نام محصول</label>
          <input id="product-name" required placeholder="نام محصول">

          <label>توضیحات</label>
          <input id="product-description" placeholder="توضیحات محصول">

          <label>دسته‌بندی</label>
          <input id="product-category" placeholder="مثلاً دیجیتال">

          <label>لینک تصویر</label>
          <input id="product-image" placeholder="https://...">

          <label>قیمت فروش به مشتری</label>
          <input id="product-price" type="number" min="1" required placeholder="مثلاً 500000">

          <label>موجودی</label>
          <input id="product-stock" type="number" min="0" value="1" required>

          <label>فروشنده</label>
          <select id="product-supplier" required>
            ${supplierOptions}
          </select>

          <label>قیمت تأمین‌کننده</label>
          <input id="product-supplier-price" type="number" min="0" placeholder="هزینه خرید از فروشنده">

          <label>کمیسیون / سود</label>
          <input id="product-commission" type="number" min="0" placeholder="مبلغ سود">

          <button class="btn orange" type="submit">
            ثبت محصول
          </button>

        </form>
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div>
          <span class="eyebrow">محصولات</span>
          <h2>محصولات ثبت شده</h2>
        </div>
      </div>

      <div class="admin-grid">
        ${productRows}
      </div>
    </section>

    <section class="section">
      <div class="section-head">
        <div>
          <span class="eyebrow">سفارش‌ها</span>
          <h2>سفارش‌های اخیر</h2>
        </div>
      </div>

      <div class="admin-grid">
        ${orderRows}
      </div>
    </section>

    <script>
      function adminPassword() {
        return prompt("رمز مدیریت را وارد کنید:") || "";
      }

      async function adminFetch(url, options) {
        options = options || {};

        options.headers = Object.assign(
          {},
          options.headers || {},
          {
            "content-type": "application/json",
            "X-Admin-Password": adminPassword()
          }
        );

        return fetch(url, options);
      }

      async function createSupplierForm(event) {
        event.preventDefault();

        const response = await adminFetch(
          "/api/admin/suppliers",
          {
            method: "POST",
            body: JSON.stringify({
              name: document.getElementById("supplier-name").value,
              phone: document.getElementById("supplier-phone").value,
              email: document.getElementById("supplier-email").value,
              address: document.getElementById("supplier-address").value,
              direct_shipping: Number(
                document.getElementById("supplier-direct").value
              ),
              active: 1
            })
          }
        );

        const result = await response.json();

        if (!result.ok) {
          alert(result.error || "ثبت فروشنده انجام نشد.");
          return false;
        }

        alert("فروشنده با موفقیت ثبت شد.");
        location.reload();
        return false;
      }

      async function createProductForm(event) {
        event.preventDefault();

        const response = await adminFetch(
          "/api/admin/products",
          {
            method: "POST",
            body: JSON.stringify({
              name: document.getElementById("product-name").value,
              description: document.getElementById("product-description").value,
              category: document.getElementById("product-category").value,
              image: document.getElementById("product-image").value,
              price: Number(document.getElementById("product-price").value),
              stock: Number(document.getElementById("product-stock").value),
              supplier_id: Number(document.getElementById("product-supplier").value),
              supplier_price: Number(document.getElementById("product-supplier-price").value || 0),
              commission: Number(document.getElementById("product-commission").value || 0),
              active: 1
            })
          }
        );

        const result = await response.json();

        if (!result.ok) {
          alert(result.error || "ثبت محصول انجام نشد.");
          return false;
        }

        alert("محصول با موفقیت ثبت شد.");
        location.reload();
        return false;
      }

      async function editProduct(id) {
        const name = prompt("نام جدید محصول:");
        if (!name) return;

        const price = prompt("قیمت فروش به تومان:");
        if (!price) return;

        const stock = prompt("موجودی:");
        if (stock === null) return;

        const supplierId = prompt("شناسه فروشنده:");
        if (!supplierId) return;

        const response = await adminFetch(
          "/api/admin/products",
          {
            method: "PUT",
            body: JSON.stringify({
              id: Number(id),
              name: name,
              description: "",
              category: "عمومی",
              image: "",
              price: Number(price),
              stock: Number(stock),
              supplier_id: Number(supplierId),
              supplier_price: 0,
              commission: 0,
              active: 1
            })
          }
        );

        const result = await response.json();

        if (!result.ok) {
          alert(result.error || "ویرایش انجام نشد.");
          return;
        }

        alert("محصول ویرایش شد.");
        location.reload();
      }

      async function updateOrderStatus(id) {
        const status =
          document.getElementById("order-status-" + id).value;

        const response = await adminFetch(
          "/api/admin/orders/status",
          {
            method: "PUT",
            body: JSON.stringify({
              id: Number(id),
              status: status,
              supplier_status:
                status === "ارسال شد"
                  ? "تأیید و ارسال شد"
                  : "در انتظار فروشنده",
              shipping_status:
                status === "ارسال شد"
                  ? "ارسال شد"
                  : status === "تحویل شد"
                    ? "تحویل شد"
                    : "در انتظار ارسال"
            })
          }
        );

        const result = await response.json();

        if (!result.ok) {
          alert(result.error || "تغییر وضعیت انجام نشد.");
          return;
        }

        alert("وضعیت سفارش ذخیره شد.");
        location.reload();
      }
    </script>
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
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#0f172a">
<title>${escapeHTML(title)} | ${STORE_NAME}</title>

<style>
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0;
  font-family:Tahoma,Arial,sans-serif;
  background:#f4f7fb;
  color:#172033;
  line-height:1.8
}
a{color:inherit;text-decoration:none}
button,input,select{font-family:inherit}
.container{width:min(1180px,calc(100% - 32px));margin:auto}

header{
  position:sticky;
  top:0;
  z-index:50;
  background:rgba(15,23,42,.96);
  border-bottom:1px solid rgba(255,255,255,.08);
  backdrop-filter:blur(12px)
}

.nav{
  min-height:74px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:20px
}

.brand{
  display:flex;
  align-items:center;
  gap:12px;
  color:white;
  font-weight:900;
  font-size:20px;
  white-space:nowrap
}

.brand-icon{
  width:42px;
  height:42px;
  border-radius:13px;
  display:grid;
  place-items:center;
  background:linear-gradient(135deg,#2563eb,#14b8a6);
  color:white;
  box-shadow:0 8px 25px rgba(20,184,166,.25)
}

nav{
  display:flex;
  align-items:center;
  gap:6px;
  flex-wrap:wrap
}

nav a{
  color:#cbd5e1;
  padding:8px 12px;
  border-radius:10px;
  transition:.2s
}

nav a:hover{
  background:rgba(255,255,255,.08);
  color:white
}

main{min-height:70vh}

.hero{
  width:min(1180px,calc(100% - 32px));
  margin:34px auto;
  padding:48px;
  border-radius:28px;
  background:
    radial-gradient(circle at 85% 20%,rgba(20,184,166,.28),transparent 35%),
    linear-gradient(135deg,#0f172a,#1e3a8a);
  color:white;
  display:grid;
  grid-template-columns:1.35fr .65fr;
  gap:35px;
  align-items:center;
  box-shadow:0 25px 60px rgba(15,23,42,.18)
}

.badge,.eyebrow{
  display:inline-block;
  color:#14b8a6;
  font-size:13px;
  font-weight:900;
  letter-spacing:.3px
}

.hero .badge{color:#67e8f9}

.hero h1{
  margin:12px 0;
  font-size:clamp(32px,5vw,58px);
  line-height:1.25
}

.hero h1 strong{
  display:block;
  color:#67e8f9
}

.hero p{
  color:#dbeafe;
  max-width:650px;
  font-size:17px
}

.hero-actions{
  display:flex;
  gap:12px;
  flex-wrap:wrap;
  margin-top:25px
}

.hero-card{
  padding:30px;
  border-radius:24px;
  background:rgba(255,255,255,.10);
  border:1px solid rgba(255,255,255,.14)
}

.hero-icon{
  width:65px;
  height:65px;
  display:grid;
  place-items:center;
  border-radius:20px;
  background:#14b8a6;
  font-size:30px;
  margin-bottom:20px
}

.hero-card h3{margin:0 0 8px;font-size:24px}
.hero-card p{margin:0;font-size:14px}

.section{
  width:min(1180px,calc(100% - 32px));
  margin:70px auto
}

.section-head{
  display:flex;
  justify-content:space-between;
  align-items:end;
  gap:20px;
  margin-bottom:25px
}

.section-head h2,.page-title h1{
  margin:4px 0 0;
  font-size:32px
}

.text-link{color:#2563eb;font-weight:800}

.products-grid{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:20px
}

.product-card{
  overflow:hidden;
  background:white;
  border:1px solid #e2e8f0;
  border-radius:20px;
  box-shadow:0 10px 30px rgba(15,23,42,.06);
  transition:transform .2s,box-shadow .2s
}

.product-card:hover{
  transform:translateY(-4px);
  box-shadow:0 18px 40px rgba(15,23,42,.12)
}

.product-image{
  height:190px;
  background:linear-gradient(135deg,#dbeafe,#ccfbf1);
  overflow:hidden
}

.product-image img{
  width:100%;
  height:100%;
  object-fit:cover
}

.product-placeholder{
  width:100%;
  height:100%;
  display:grid;
  place-items:center;
  color:#2563eb;
  font-size:55px
}

.product-placeholder.large{font-size:100px}

.product-body{padding:20px}
.product-category{color:#0f766e;font-size:12px;font-weight:900}
.product-body h3{margin:6px 0;font-size:19px}

.product-body p{
  margin:0 0 15px;
  color:#64748b;
  font-size:14px;
  min-height:50px
}

.product-bottom{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
  margin-bottom:15px
}

.product-bottom strong{color:#1e3a8a;font-size:18px}

.stock{
  font-size:12px;
  color:#0f766e;
  background:#ccfbf1;
  padding:4px 9px;
  border-radius:20px
}

.product-actions{
  display:flex;
  gap:8px;
  flex-wrap:wrap
}

.btn{
  border:0;
  cursor:pointer;
  display:inline-flex;
  justify-content:center;
  align-items:center;
  padding:11px 17px;
  border-radius:12px;
  font-weight:800;
  transition:.2s
}

.btn:hover{transform:translateY(-1px)}
.btn.primary{background:#2563eb;color:white}
.btn.secondary{background:#1e3a8a;color:white}
.btn.orange{background:#f97316;color:white}
.btn.disabled{background:#94a3b8;color:white;cursor:not-allowed}
.btn.small{padding:8px 11px;font-size:12px}

.features{
  width:min(1180px,calc(100% - 32px));
  margin:70px auto;
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:16px
}

.feature{
  background:white;
  padding:25px;
  border-radius:20px;
  border:1px solid #e2e8f0
}

.feature-icon{
  width:45px;
  height:45px;
  display:grid;
  place-items:center;
  border-radius:13px;
  background:#dbeafe;
  color:#2563eb;
  font-weight:900
}

.feature h3{margin:13px 0 5px}
.feature p{margin:0;color:#64748b;font-size:14px}

.promo{
  width:min(1180px,calc(100% - 32px));
  margin:70px auto;
  padding:35px;
  border-radius:25px;
  background:linear-gradient(135deg,#0f766e,#0f172a);
  color:white;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:20px
}

.promo h2{margin:4px 0;font-size:30px}
.promo p{color:#ccfbf1}

.page-title{
  width:min(1180px,calc(100% - 32px));
  margin:55px auto 30px
}

.page-title p{color:#64748b}

.account-wrap{
  width:min(1000px,calc(100% - 32px));
  margin:50px auto;
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:22px
}

.account-card{
  background:white;
  padding:30px;
  border:1px solid #e2e8f0;
  border-radius:22px;
  box-shadow:0 12px 35px rgba(15,23,42,.06)
}

.account-card h1{margin-bottom:5px}
.account-card>p{color:#64748b}

form{
  display:grid;
  gap:9px;
  margin-top:20px
}

label{font-size:13px;font-weight:800}

input,select{
  width:100%;
  padding:13px 14px;
  border:1px solid #cbd5e1;
  border-radius:12px;
  outline:none;
  background:white
}

input:focus,select:focus{
  border-color:#2563eb;
  box-shadow:0 0 0 3px rgba(37,99,235,.10)
}

.account-links{
  display:flex;
  gap:15px;
  margin-top:20px;
  flex-wrap:wrap
}

.account-links a{
  color:#2563eb;
  font-size:13px;
  font-weight:800
}

.cart-box{
  width:min(900px,calc(100% - 32px));
  margin:30px auto 70px;
  background:white;
  padding:30px;
  border-radius:22px;
  border:1px solid #e2e8f0
}

.cart-total{
  margin-top:25px;
  padding-top:20px;
  border-top:1px solid #e2e8f0;
  display:flex;
  justify-content:space-between
}

.cart-actions{
  display:flex;
  gap:10px;
  margin-top:25px;
  flex-wrap:wrap
}

.empty{
  padding:35px;
  text-align:center;
  background:white;
  border:1px dashed #cbd5e1;
  border-radius:18px;
  color:#64748b
}

.admin-grid{
  width:min(1180px,calc(100% - 32px));
  margin:30px auto 70px;
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:18px
}

.admin-card{
  padding:25px;
  background:white;
  border:1px solid #e2e8f0;
  border-radius:18px
}

.admin-card strong,.admin-card span{display:block}
.admin-card span{
  color:#64748b;
  margin-top:5px;
  font-size:13px
}

.product-detail{
  width:min(1100px,calc(100% - 32px));
  margin:50px auto 80px;
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:35px;
  align-items:center
}

.detail-image{
  height:450px;
  overflow:hidden;
  border-radius:25px;
  background:linear-gradient(135deg,#dbeafe,#ccfbf1);
  display:grid;
  place-items:center
}

.detail-image img{
  width:100%;
  height:100%;
  object-fit:cover
}

.detail-content{
  background:white;
  padding:35px;
  border-radius:25px;
  border:1px solid #e2e8f0
}

.detail-content h1{
  font-size:34px;
  margin:10px 0
}

.detail-description{color:#64748b}

.detail-price{
  color:#f97316;
  font-size:28px;
  font-weight:900;
  margin:25px 0 10px
}

.detail-stock{
  color:#0f766e;
  margin-bottom:20px
}

footer{
  margin-top:70px;
  background:#0f172a;
  color:#cbd5e1;
  padding:40px 0
}

.footer-inner{
  width:min(1180px,calc(100% - 32px));
  margin:auto;
  display:flex;
  justify-content:space-between;
  gap:25px;
  flex-wrap:wrap
}

.footer-title{
  color:white;
  font-weight:900;
  font-size:20px
}

.footer-note{
  font-size:13px;
  color:#94a3b8
}

@media(max-width:850px){
  .hero{grid-template-columns:1fr;gap:30px;padding:30px 24px}
  .products-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .features{grid-template-columns:repeat(2,minmax(0,1fr))}
  .account-wrap{grid-template-columns:1fr}
  .admin-grid{grid-template-columns:1fr}
  .product-detail{grid-template-columns:1fr}
}

@media(max-width:600px){
  .nav{
    padding:10px 0;
    align-items:flex-start;
    flex-direction:column
  }

  nav{
    width:100%;
    overflow-x:auto;
    flex-wrap:nowrap
  }

  nav a{white-space:nowrap}
  .hero h1{font-size:34px}
  .products-grid,.features{grid-template-columns:1fr}
  .section-head,.promo{
    align-items:flex-start;
    flex-direction:column
  }

  .promo{padding:28px 22px}
  .detail-image{height:300px}
  .detail-content h1{font-size:28px}
}
</style>
</head>

<body>

<header>
  <div class="container nav">

    <a class="brand" href="/">
      <span class="brand-icon">◆</span>
      <span>${STORE_NAME}</span>
    </a>

    <nav>
      <a href="/">خانه</a>
      <a href="/products">محصولات</a>
      <a href="/#features">امکانات</a>
      <a href="/account">حساب کاربری</a>
      <a href="/cart">🛒 سبد خرید</a>
      <a href="/admin">مدیریت</a>
    </nav>

  </div>
</header>

<main>
${content}
</main>

<footer>
  <div class="footer-inner">

    <div>
      <div class="footer-title">${STORE_NAME}</div>
      <div class="footer-note">
        ${STORE_EN} — فروشگاه دیجیتال
      </div>
    </div>

    <div class="footer-note">
      © ${new Date().getFullYear()} ${STORE_NAME}
    </div>

  </div>
</footer>

<script>
function getCart(){
  try{
    return JSON.parse(
      localStorage.getItem("digimarixo_cart") || "[]"
    );
  }catch{
    return [];
  }
}

function saveCart(cart){
  localStorage.setItem(
    "digimarixo_cart",
    JSON.stringify(cart)
  );
}

function addToCart(id,name,price){
  const cart=getCart();

  const existing=cart.find(
    item=>Number(item.id)===Number(id)
  );

  if(existing){
    existing.quantity+=1;
  }else{
    cart.push({
      id:Number(id),
      name:name,
      price:Number(price)||0,
      quantity:1
    });
  }

  saveCart(cart);
  renderCart();

  alert("محصول به سبد خرید اضافه شد.");
}

function formatNumber(value){
  const number=Number(value);

  if(!Number.isFinite(number)){
    return "۰";
  }

  return number.toLocaleString("fa-IR");
}

function renderCart(){
  const box=document.getElementById("cart-items");
  const totalBox=document.getElementById("cart-total");

  if(!box || !totalBox){
    return;
  }

  const cart=getCart();

  if(!cart.length){
    box.innerHTML='<div class="empty">سبد خرید شما خالی است.</div>';
    totalBox.textContent="۰ تومان";
    return;
  }

  let total=0;
  const rows=[];

  cart.forEach(function(item,index){
    const price=Number(item.price);
    const quantity=Number(item.quantity);

    const safePrice=Number.isFinite(price)?price:0;
    const safeQuantity=
      Number.isFinite(quantity)&&quantity>0
        ? quantity
        : 1;

    const line=safePrice*safeQuantity;
    total+=line;

    rows.push(
      '<div style="' +
      'padding:15px 0;' +
      'border-bottom:1px solid #e2e8f0;' +
      'display:flex;' +
      'justify-content:space-between;' +
      'gap:15px;' +
      'align-items:center' +
      '">' +

      '<div>' +
      '<strong>' +
      escapeClientHTML(item.name) +
      '</strong>' +

      '<div style="color:#64748b;font-size:13px">' +
      'تعداد: ' +
      formatNumber(safeQuantity) +
      '</div>' +

      '</div>' +

      '<div style="text-align:left">' +
      '<strong>' +
      formatNumber(line) +
      ' تومان' +
      '</strong>' +

      '<br>' +

      '<button class="btn small orange" ' +
      'onclick="removeCartItem(' + index + ')">' +
      'حذف' +
      '</button>' +

      '</div>' +
      '</div>'
    );
  });

  box.innerHTML=rows.join("");
  totalBox.textContent=formatNumber(total)+" تومان";
}

function removeCartItem(index){
  const cart=getCart();

  cart.splice(index,1);

  saveCart(cart);
  renderCart();
}

async function checkoutCart(){
  const cart=getCart();

  if(!cart.length){
    alert("سبد خرید شما خالی است.");
    return;
  }

  const customerName=prompt("نام و نام خانوادگی:");

  if(!customerName){
    return;
  }

  const customerPhone=prompt("شماره تماس:");

  if(!customerPhone){
    return;
  }

  const customerEmail=prompt("ایمیل:");

  const address=prompt("آدرس کامل:");

  if(!address){
    return;
  }

  try{
    const response=await fetch(
      "/api/orders",
      {
        method:"POST",
        headers:{
          "content-type":"application/json"
        },
        body:JSON.stringify({
          customer_name:customerName,
          customer_phone:customerPhone,
          customer_email:customerEmail||"",
          address:address,
          items:cart.map(item=>({
            product_id:Number(item.id),
            quantity:Number(item.quantity||1)
          }))
        })
      }
    );

    const result=await response.json();

    if(!result.ok){
      alert(
        result.error ||
        "ثبت سفارش انجام نشد."
      );
      return;
    }

    localStorage.removeItem("digimarixo_cart");
    renderCart();

    alert(
      "سفارش با موفقیت ثبت شد. " +
      "شماره سفارش: " +
      result.order_id
    );

  }catch(error){
    alert("خطا در ثبت سفارش.");
    console.error(error);
  }
}

function escapeClientHTML(value){
  return String(value??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

renderCart();
</script>

</body>
</html>
  `;
}


/* =========================================================
   RESPONSE
========================================================= */

function html(content,status=200){
  return new Response(
    content,
    {
      status,
      headers:{
        "content-type":"text/html; charset=UTF-8",
        "cache-control":"no-store"
      }
    }
  );
}

function json(data,status=200){
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers:{
        "content-type":"application/json; charset=UTF-8",
        "cache-control":"no-store"
      }
    }
  );
}


/* =========================================================
   HELPERS
========================================================= */

function normalizePrice(value){
  const normalized=String(value??"")
    .trim()
    .replace(
      /[۰-۹]/g,
      d=>"۰۱۲۳۴۵۶۷۸۹".indexOf(d)
    )
    .replace(
      /[٠-٩]/g,
      d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d)
    )
    .replace(/[,\s٬،]/g,"");

  const number=Number(normalized);

  if(!Number.isFinite(number)){
    return 0;
  }

  return Math.max(0,Math.round(number));
}

function formatPrice(value){
  return normalizePrice(value).toLocaleString("fa-IR")+" تومان";
}

function formatNumberServer(value){
  const number=Number(value);

  if(!Number.isFinite(number)){
    return "۰";
  }

  return number.toLocaleString("fa-IR");
}

function formatNumber(value){
  const number=Number(value);

  if(!Number.isFinite(number)){
    return "۰";
  }

  return number.toLocaleString("fa-IR");
}

function escapeHTML(value){
  return String(value??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function escapeAttr(value){
  return escapeHTML(value);
}

function escapeJS(value){
  return String(value??"")
    .replaceAll("\\","\\\\")
    .replaceAll("'","\\'")
    .replaceAll("\n","\\n")
    .replaceAll("\r","\\r");
}

function safeError(error){
  if(!error){
    return "خطای ناشناخته";
  }

  if(error.message){
    return String(error.message);
  }

  return String(error);
         }
