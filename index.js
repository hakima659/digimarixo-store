const STORE_NAME = "دیجی‌ماریکسو";
const STORE_EN = "DigiMarixo";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      await initDB(env);

      /* =====================================================
         HEALTH
      ===================================================== */

      if (path === "/health") {
        return json({
          ok: true,
          store: STORE_EN,
          database: true
        });
      }

      /* =====================================================
         PUBLIC PRODUCTS
      ===================================================== */

      if (path === "/api/products" && method === "GET") {
        return json(await getProducts(env));
      }

      if (
        path.startsWith("/api/products/") &&
        method === "GET"
      ) {
        return json(
          await getProduct(
            env,
            path.split("/").pop()
          )
        );
      }

      /* =====================================================
         PUBLIC SUPPLIERS
      ===================================================== */

      if (
        path === "/api/suppliers" &&
        method === "GET"
      ) {
        return json(await getSuppliers(env));
      }

      /* =====================================================
         ADMIN API
      ===================================================== */

      if (
        path === "/api/admin/suppliers" &&
        method === "POST"
      ) {
        if (!isAdmin(request, env)) {
          return json(
            {
              ok: false,
              error: "دسترسی مدیریت مجاز نیست."
            },
            401
          );
        }

        return await createSupplier(request, env);
      }

      if (
        path === "/api/admin/products" &&
        method === "POST"
      ) {
        if (!isAdmin(request, env)) {
          return json(
            {
              ok: false,
              error: "دسترسی مدیریت مجاز نیست."
            },
            401
          );
        }

        return await createProduct(request, env);
      }

      if (
        path === "/api/admin/products" &&
        method === "PUT"
      ) {
        if (!isAdmin(request, env)) {
          return json(
            {
              ok: false,
              error: "دسترسی مدیریت مجاز نیست."
            },
            401
          );
        }

        return await updateProduct(request, env);
      }

      if (
        path === "/api/admin/orders/status" &&
        method === "PUT"
      ) {
        if (!isAdmin(request, env)) {
          return json(
            {
              ok: false,
              error: "دسترسی مدیریت مجاز نیست."
            },
            401
          );
        }

        return await updateOrderStatus(request, env);
      }

      /* =====================================================
         SUPPLIER API
      ===================================================== */

      if (
        path === "/api/supplier/login" &&
        method === "POST"
      ) {
        return await supplierLogin(request, env);
      }

      if (
        path === "/api/supplier/orders" &&
        method === "GET"
      ) {
        const supplier = await authenticateSupplier(
          request,
          env
        );

        if (!supplier) {
          return json(
            {
              ok: false,
              error:
                "دسترسی تأمین‌کننده معتبر نیست."
            },
            401
          );
        }

        return json(
          await getSupplierOrders(
            env,
            supplier.id
          )
        );
      }

      if (
        path === "/api/supplier/orders/status" &&
        method === "PUT"
      ) {
        const supplier = await authenticateSupplier(
          request,
          env
        );

        if (!supplier) {
          return json(
            {
              ok: false,
              error:
                "دسترسی تأمین‌کننده معتبر نیست."
            },
            401
          );
        }

        return await updateSupplierOrder(
          request,
          env,
          supplier.id
        );
      }

      /* =====================================================
         ORDERS
      ===================================================== */

      if (
        path === "/api/orders" &&
        method === "POST"
      ) {
        return await createOrder(
          request,
          env
        );
      }

      if (
        path === "/api/orders" &&
        method === "GET"
      ) {
        if (!isAdmin(request, env)) {
          return json(
            {
              ok: false,
              error:
                "دسترسی مدیریت مجاز نیست."
            },
            401
          );
        }

        return json(
          await getOrders(env)
        );
      }

      /* =====================================================
         CUSTOMER ORDER LOOKUP
      ===================================================== */

      if (
        path === "/api/order/lookup" &&
        method === "POST"
      ) {
        return await lookupOrder(
          request,
          env
        );
      }

      /* =====================================================
         PAGES
      ===================================================== */

      if (path === "/account") {
        return html(
          accountPage()
        );
      }

      if (path === "/supplier") {
        return html(
          supplierPage()
        );
      }

      if (path === "/admin") {
        if (!isBasicAdmin(request, env)) {
          return basicAuthResponse();
        }

        return html(
          await adminPage(env)
        );
      }

      if (path === "/products") {
        const id =
          url.searchParams.get("id");

        if (id) {
          const result =
            await getProduct(
              env,
              id
            );

          if (!result.ok) {
            return html(
              layout(
                "محصول پیدا نشد",
                `
                <section class="page-title">
                  <span class="eyebrow">
                    DigiMarixo
                  </span>

                  <h1>
                    محصول پیدا نشد
                  </h1>

                  <p>
                    محصول موردنظر در فروشگاه
                    وجود ندارد.
                  </p>

                  <a
                    class="btn primary"
                    href="/products"
                  >
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
              productDetailPage(
                result.product
              )
            )
          );
        }

        return html(
          await productsPage(env)
        );
      }

      if (path === "/cart") {
        return html(
          cartPage()
        );
      }

      return html(
        await homePage(env)
      );

    } catch (error) {
      console.error(
        "DigiMarixo Error:",
        error
      );

      return new Response(
        "DigiMarixo Error: " +
          safeError(error),
        {
          status: 500,
          headers: {
            "content-type":
              "text/plain; charset=UTF-8",
            "cache-control":
              "no-store"
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
    throw new Error(
      "D1 binding DB is not configured"
    );
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
      access_code TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const supplierInfo =
    await env.DB
      .prepare(
        `PRAGMA table_info(suppliers)`
      )
      .all();

  const supplierColumns =
    new Set(
      (supplierInfo.results || [])
        .map(x => x.name)
    );

  if (!supplierColumns.has("access_code")) {
    await env.DB.prepare(`
      ALTER TABLE suppliers
      ADD COLUMN access_code TEXT DEFAULT ''
    `).run();
  }

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

  const productInfo =
    await env.DB
      .prepare(
        `PRAGMA table_info(products)`
      )
      .all();

  const productColumns =
    new Set(
      (productInfo.results || [])
        .map(x => x.name)
    );

  const productMigrations = [
    [
      "category",
      "ALTER TABLE products ADD COLUMN category TEXT DEFAULT ''"
    ],
    [
      "stock",
      "ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0"
    ],
    [
      "image",
      "ALTER TABLE products ADD COLUMN image TEXT DEFAULT ''"
    ],
    [
      "active",
      "ALTER TABLE products ADD COLUMN active INTEGER DEFAULT 1"
    ],
    [
      "supplier_id",
      "ALTER TABLE products ADD COLUMN supplier_id INTEGER DEFAULT NULL"
    ],
    [
      "supplier_price",
      "ALTER TABLE products ADD COLUMN supplier_price INTEGER DEFAULT 0"
    ],
    [
      "commission",
      "ALTER TABLE products ADD COLUMN commission INTEGER DEFAULT 0"
    ]
  ];

  for (
    const [name, sql]
    of productMigrations
  ) {
    if (!productColumns.has(name)) {
      await env.DB
        .prepare(sql)
        .run();
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

  const orderInfo =
    await env.DB
      .prepare(
        `PRAGMA table_info(orders)`
      )
      .all();

  const orderColumns =
    new Set(
      (orderInfo.results || [])
        .map(x => x.name)
    );

  const orderMigrations = [
    [
      "supplier_id",
      "ALTER TABLE orders ADD COLUMN supplier_id INTEGER DEFAULT NULL"
    ],
    [
      "supplier_status",
      "ALTER TABLE orders ADD COLUMN supplier_status TEXT DEFAULT 'جدید'"
    ],
    [
      "shipping_status",
      "ALTER TABLE orders ADD COLUMN shipping_status TEXT DEFAULT 'در انتظار ارسال'"
    ]
  ];

  for (
    const [name, sql]
    of orderMigrations
  ) {
    if (!orderColumns.has(name)) {
      await env.DB
        .prepare(sql)
        .run();
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

  const itemInfo =
    await env.DB
      .prepare(
        `PRAGMA table_info(order_items)`
      )
      .all();

  const itemColumns =
    new Set(
      (itemInfo.results || [])
        .map(x => x.name)
    );

  const itemMigrations = [
    [
      "supplier_id",
      "ALTER TABLE order_items ADD COLUMN supplier_id INTEGER DEFAULT NULL"
    ],
    [
      "supplier_price",
      "ALTER TABLE order_items ADD COLUMN supplier_price INTEGER DEFAULT 0"
    ],
    [
      "commission",
      "ALTER TABLE order_items ADD COLUMN commission INTEGER DEFAULT 0"
    ]
  ];

  for (
    const [name, sql]
    of itemMigrations
  ) {
    if (!itemColumns.has(name)) {
      await env.DB
        .prepare(sql)
        .run();
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

  const supplierOrderInfo =
    await env.DB
      .prepare(
        `PRAGMA table_info(supplier_orders)`
      )
      .all();

  const supplierOrderColumns =
    new Set(
      (supplierOrderInfo.results || [])
        .map(x => x.name)
    );

  if (
    !supplierOrderColumns.has(
      "tracking_code"
    )
  ) {
    await env.DB.prepare(`
      ALTER TABLE supplier_orders
      ADD COLUMN tracking_code TEXT DEFAULT ''
    `).run();
  }

  if (
    !supplierOrderColumns.has(
      "supplier_note"
    )
  ) {
    await env.DB.prepare(`
      ALTER TABLE supplier_orders
      ADD COLUMN supplier_note TEXT DEFAULT ''
    `).run();
  }

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
   ADMIN AUTH
========================================================= */

function getAdminPassword(env) {
  const password =
    env.ADMIN_PASSWORD;

  if (
    password === undefined ||
    password === null ||
    String(password).trim() === ""
  ) {
    return "";
  }

  return String(password);
}


function isAdmin(
  request,
  env
) {
  const expected =
    getAdminPassword(env);

  if (!expected) {
    return false;
  }

  const supplied =
    request.headers.get(
      "X-Admin-Password"
    ) || "";

  return supplied === expected;
}


function isBasicAdmin(
  request,
  env
) {
  const expected =
    getAdminPassword(env);

  if (!expected) {
    return false;
  }

  const authorization =
    request.headers.get(
      "Authorization"
    ) || "";

  if (
    !authorization.startsWith(
      "Basic "
    )
  ) {
    return false;
  }

  try {
    const encoded =
      authorization.slice(6);

    const decoded =
      atob(encoded);

    const separator =
      decoded.indexOf(":");

    if (separator < 0) {
      return false;
    }

    const username =
      decoded.slice(
        0,
        separator
      );

    const password =
      decoded.slice(
        separator + 1
      );

    return (
      username === "مدیر" &&
      password === expected
    );

  } catch {
    return false;
  }
}


function basicAuthResponse() {
  return new Response(
    "DigiMarixo Admin Authentication Required",
    {
      status: 401,
      headers: {
        "WWW-Authenticate":
          'Basic realm="DigiMarixo Admin"',
        "content-type":
          "text/plain; charset=UTF-8",
        "cache-control":
          "no-store"
      }
    }
  );
}


/* =========================================================
   PRODUCTS
========================================================= */

async function getProducts(env) {
  const result =
    await env.DB.prepare(`
      SELECT
        p.*,
        s.name AS supplier_name,
        s.direct_shipping AS supplier_direct_shipping
      FROM products p
      LEFT JOIN suppliers s
        ON s.id = p.supplier_id
      WHERE p.active = 1
      ORDER BY p.id DESC
    `).all();

  return {
    ok: true,
    products:
      (result.results || [])
        .map(p => ({
          ...p,
          price:
            normalizePrice(p.price),
          supplier_price:
            normalizePrice(
              p.supplier_price
            ),
          commission:
            normalizePrice(
              p.commission
            )
        }))
  };
}


async function getProduct(
  env,
  id
) {
  const product =
    await env.DB.prepare(`
      SELECT
        p.*,
        s.name AS supplier_name,
        s.phone AS supplier_phone,
        s.email AS supplier_email,
        s.direct_shipping AS supplier_direct_shipping
      FROM products p
      LEFT JOIN suppliers s
        ON s.id = p.supplier_id
      WHERE p.id = ?
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

  product.price =
    normalizePrice(
      product.price
    );

  product.supplier_price =
    normalizePrice(
      product.supplier_price
    );

  product.commission =
    normalizePrice(
      product.commission
    );

  return {
    ok: true,
    product
  };
}


/* =========================================================
   SUPPLIERS
========================================================= */

async function getSuppliers(env) {
  const result =
    await env.DB.prepare(`
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
    suppliers:
      result.results || []
  };
}


function generateSupplierCode() {
  const bytes =
    new Uint8Array(12);

  crypto.getRandomValues(
    bytes
  );

  let result = "";

  for (const byte of bytes) {
    result +=
      byte.toString(16)
        .padStart(2, "0");
  }

  return result;
}


async function createSupplier(
  request,
  env
) {
  let data;

  try {
    data =
      await request.json();
  } catch {
    return json(
      {
        ok: false,
        error:
          "اطلاعات فروشنده نامعتبر است."
      },
      400
    );
  }

  const name =
    String(
      data.name || ""
    ).trim();

  const phone =
    String(
      data.phone || ""
    ).trim();

  const email =
    String(
      data.email || ""
    ).trim();

  const address =
    String(
      data.address || ""
    ).trim();

  const directShipping =
    Number(
      data.direct_shipping
    ) === 1
      ? 1
      : 0;

  const active =
    Number(
      data.active
    ) === 0
      ? 0
      : 1;

  if (!name) {
    return json(
      {
        ok: false,
        error:
          "نام فروشنده الزامی است."
      },
      400
    );
  }

  if (!directShipping) {
    return json(
      {
        ok: false,
        error:
          "برای این سیستم، فروشنده باید ارسال مستقیم را فعال کند."
      },
      400
    );
  }

  const accessCode =
    generateSupplierCode();

  const result =
    await env.DB.prepare(`
      INSERT INTO suppliers
      (
        name,
        phone,
        email,
        address,
        direct_shipping,
        active,
        access_code
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      name,
      phone,
      email,
      address,
      directShipping,
      active,
      accessCode
    )
    .run();

  return json({
    ok: true,
    supplier_id:
      result.meta.last_row_id,
    access_code:
      accessCode
  });
}


/* =========================================================
   SUPPLIER AUTHENTICATION
========================================================= */

async function supplierLogin(
  request,
  env
) {
  let data;

  try {
    data =
      await request.json();
  } catch {
    return json(
      {
        ok: false,
        error:
          "اطلاعات ورود نامعتبر است."
      },
      400
    );
  }

  const supplierId =
    Number(
      data.supplier_id || 0
    );

  const accessCode =
    String(
      data.access_code || ""
    ).trim();

  if (
    !supplierId ||
    !accessCode
  ) {
    return json(
      {
        ok: false,
        error:
          "شناسه تأمین‌کننده و کد دسترسی الزامی است."
      },
      400
    );
  }

  const supplier =
    await env.DB.prepare(`
      SELECT
        id,
        name,
        phone,
        email,
        address,
        direct_shipping,
        active,
        access_code
      FROM suppliers
      WHERE id = ?
      LIMIT 1
    `)
    .bind(supplierId)
    .first();

  if (!supplier) {
    return json(
      {
        ok: false,
        error:
          "تأمین‌کننده پیدا نشد."
      },
      401
    );
  }

  if (
    Number(supplier.active) !== 1
  ) {
    return json(
      {
        ok: false,
        error:
          "حساب تأمین‌کننده فعال نیست."
      },
      403
    );
  }

  if (
    !supplier.access_code ||
    supplier.access_code !==
      accessCode
  ) {
    return json(
      {
        ok: false,
        error:
          "کد دسترسی اشتباه است."
      },
      401
    );
  }

  return json({
    ok: true,
    supplier: {
      id:
        Number(supplier.id),
      name:
        supplier.name,
      phone:
        supplier.phone,
      email:
        supplier.email
    }
  });
}


async function authenticateSupplier(
  request,
  env
) {
  const supplierId =
    Number(
      request.headers.get(
        "X-Supplier-ID"
      ) || 0
    );

  const accessCode =
    String(
      request.headers.get(
        "X-Supplier-Code"
      ) || ""
    ).trim();

  if (
    !supplierId ||
    !accessCode
  ) {
    return null;
  }

  const supplier =
    await env.DB.prepare(`
      SELECT
        id,
        name,
        phone,
        email,
        address,
        direct_shipping,
        active,
        access_code
      FROM suppliers
      WHERE id = ?
      LIMIT 1
    `)
    .bind(supplierId)
    .first();

  if (!supplier) {
    return null;
  }

  if (
    Number(supplier.active) !== 1
  ) {
    return null;
  }

  if (
    !supplier.access_code ||
    supplier.access_code !==
      accessCode
  ) {
    return null;
  }

  return supplier;
}


/* =========================================================
   SUPPLIER ORDERS
========================================================= */

async function getSupplierOrders(
  env,
  supplierId
) {
  const result =
    await env.DB.prepare(`
      SELECT
        so.id,
        so.order_id,
        so.status,
        so.shipping_status,
        so.supplier_note,
        so.tracking_code,
        so.created_at,
        so.updated_at,

        o.customer_name,
        o.customer_phone,
        o.customer_email,
        o.address,
        o.total,
        o.status AS order_status,

        (
          SELECT
            GROUP_CONCAT(
              p.name ||
              ' × ' ||
              oi.quantity,
              '، '
            )
          FROM order_items oi
          JOIN products p
            ON p.id = oi.product_id
          WHERE
            oi.order_id = o.id
            AND oi.supplier_id = ?
        ) AS items

      FROM supplier_orders so

      JOIN orders o
        ON o.id = so.order_id

      WHERE
        so.supplier_id = ?

      ORDER BY
        so.id DESC
    `)
    .bind(
      supplierId,
      supplierId
    )
    .all();

  return {
    ok: true,
    orders:
      result.results || []
  };
}


async function updateSupplierOrder(
  request,
  env,
  supplierId
) {
  let data;

  try {
    data =
      await request.json();
  } catch {
    return json(
      {
        ok: false,
        error:
          "اطلاعات نامعتبر است."
      },
      400
    );
  }

  const supplierOrderId =
    Number(
      data.supplier_order_id ||
      data.id ||
      0
    );

  const status =
    String(
      data.status ||
        "تأیید شد"
    ).trim();

  const shippingStatus =
    String(
      data.shipping_status ||
        "در انتظار ارسال"
    ).trim();

  const note =
    String(
      data.supplier_note ||
        ""
    ).trim();

  const trackingCode =
    String(
      data.tracking_code ||
        ""
    ).trim();

  if (!supplierOrderId) {
    return json(
      {
        ok: false,
        error:
          "شناسه سفارش نامعتبر است."
      },
      400
    );
  }

  const supplierOrder =
    await env.DB.prepare(`
      SELECT
        id,
        order_id,
        supplier_id
      FROM supplier_orders
      WHERE
        id = ?
        AND supplier_id = ?
      LIMIT 1
    `)
    .bind(
      supplierOrderId,
      supplierId
    )
    .first();

  if (!supplierOrder) {
    return json(
      {
        ok: false,
        error:
          "این سفارش برای شما نیست."
      },
      403
    );
  }

  await env.DB.prepare(`
    UPDATE supplier_orders
    SET
      status = ?,
      shipping_status = ?,
      supplier_note = ?,
      tracking_code = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE
      id = ?
      AND supplier_id = ?
  `)
  .bind(
    status,
    shippingStatus,
    note,
    trackingCode,
    supplierOrderId,
    supplierId
  )
  .run();

  /*
   * وضعیت اصلی سفارش نیز بر اساس
   * وضعیت تأمین‌کننده به‌روزرسانی می‌شود.
   */

  let mainStatus =
    "در حال بررسی";

  if (
    status === "تأیید شد"
  ) {
    mainStatus =
      "تأیید تأمین‌کننده";
  }

  if (
    status === "لغو شد"
  ) {
    mainStatus =
      "لغو شده توسط تأمین‌کننده";
  }

  if (
    shippingStatus === "ارسال شد"
  ) {
    mainStatus =
      "ارسال شد";
  }

  if (
    shippingStatus === "تحویل شد"
  ) {
    mainStatus =
      "تحویل شد";
  }

  await env.DB.prepare(`
    UPDATE orders
    SET
      status = ?,
      supplier_status = ?,
      shipping_status = ?
    WHERE id = ?
  `)
  .bind(
    mainStatus,
    status,
    shippingStatus,
    supplierOrder.order_id
  )
  .run();

  return json({
    ok: true,
    order_id:
      supplierOrder.order_id
  });
}


/* =========================================================
   CREATE PRODUCT
========================================================= */

async function createProduct(
  request,
  env
) {
  let data;

  try {
    data =
      await request.json();
  } catch {
    return json(
      {
        ok: false,
        error:
          "اطلاعات محصول نامعتبر است."
      },
      400
    );
  }

  const name =
    String(
      data.name || ""
    ).trim();

  const description =
    String(
      data.description || ""
    ).trim();

  const category =
    String(
      data.category || ""
    ).trim();

  const image =
    String(
      data.image || ""
    ).trim();

  const price =
    normalizePrice(
      data.price
    );

  const stock =
    Math.max(
      0,
      Math.floor(
        Number(
          data.stock || 0
        )
      )
    );

  const supplierId =
    Number(
      data.supplier_id || 0
    );

  const supplierPrice =
    normalizePrice(
      data.supplier_price
    );

  const commission =
    normalizePrice(
      data.commission
    );

  const active =
    Number(
      data.active
    ) === 0
      ? 0
      : 1;

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

  if (price <= 0) {
    return json(
      {
        ok: false,
        error:
          "قیمت فروش باید بیشتر از صفر باشد."
      },
      400
    );
  }

  if (!supplierId) {
    return json(
      {
        ok: false,
        error:
          "فروشنده محصول را انتخاب کنید."
      },
      400
    );
  }

  const supplier =
    await env.DB.prepare(`
      SELECT
        id,
        active,
        direct_shipping
      FROM suppliers
      WHERE id = ?
      LIMIT 1
    `)
    .bind(supplierId)
    .first();

  if (!supplier) {
    return json(
      {
        ok: false,
        error:
          "فروشنده پیدا نشد."
      },
      400
    );
  }

  if (
    Number(supplier.active) !== 1
  ) {
    return json(
      {
        ok: false,
        error:
          "فروشنده فعال نیست."
      },
      400
    );
  }

  if (
    Number(
      supplier.direct_shipping
    ) !== 1
  ) {
    return json(
      {
        ok: false,
        error:
          "فروشنده ارسال مستقیم به مشتری را تأیید نکرده است."
      },
      400
    );
  }

  const result =
    await env.DB.prepare(`
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
    `)
    .bind(
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
    )
    .run();

  return json({
    ok: true,
    product_id:
      result.meta.last_row_id
  });
}


/* =========================================================
   UPDATE PRODUCT
========================================================= */

async function updateProduct(
  request,
  env
) {
  let data;

  try {
    data =
      await request.json();
  } catch {
    return json(
      {
        ok: false,
        error:
          "اطلاعات محصول نامعتبر است."
      },
      400
    );
  }

  const id =
    Number(data.id);

  if (!id) {
    return json(
      {
        ok: false,
        error:
          "شناسه محصول نامعتبر است."
      },
      400
    );
  }

  const current =
    await env.DB.prepare(`
      SELECT id
      FROM products
      WHERE id = ?
      LIMIT 1
    `)
    .bind(id)
    .first();

  if (!current) {
    return json(
      {
        ok: false,
        error:
          "محصول پیدا نشد."
      },
      404
    );
  }

  const name =
    String(
      data.name || ""
    ).trim();

  const description =
    String(
      data.description || ""
    ).trim();

  const category =
    String(
      data.category || ""
    ).trim();

  const image =
    String(
      data.image || ""
    ).trim();

  const price =
    normalizePrice(
      data.price
    );

  const stock =
    Math.max(
      0,
      Math.floor(
        Number(
          data.stock || 0
        )
      )
    );

  const supplierId =
    Number(
      data.supplier_id || 0
    );

  const supplierPrice =
    normalizePrice(
      data.supplier_price
    );

  const commission =
    normalizePrice(
      data.commission
    );

  const active =
    Number(
      data.active
    ) === 0
      ? 0
      : 1;

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

  if (price <= 0) {
    return json(
      {
        ok: false,
        error:
          "قیمت فروش باید بیشتر از صفر باشد."
      },
      400
    );
  }

  if (!supplierId) {
    return json(
      {
        ok: false,
        error:
          "فروشنده محصول را انتخاب کنید."
      },
      400
    );
  }

  const supplier =
    await env.DB.prepare(`
      SELECT
        id,
        active,
        direct_shipping
      FROM suppliers
      WHERE id = ?
      LIMIT 1
    `)
    .bind(supplierId)
    .first();

  if (!supplier) {
    return json(
      {
        ok: false,
        error:
          "فروشنده پیدا نشد."
      },
      400
    );
  }

  if (
    Number(supplier.active) !== 1
  ) {
    return json(
      {
        ok: false,
        error:
          "فروشنده فعال نیست."
      },
      400
    );
  }

  if (
    Number(
      supplier.direct_shipping
    ) !== 1
  ) {
    return json(
      {
        ok: false,
        error:
          "فروشنده ارسال مستقیم را تأیید نکرده است."
      },
      400
    );
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
  `)
  .bind(
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
  )
  .run();

  return json({
    ok: true
  });
}


/* =========================================================
   ORDERS
========================================================= */

async function createOrder(
  request,
  env
) {
  let data;

  try {
    data =
      await request.json();
  } catch {
    return json(
      {
        ok: false,
        error:
          "اطلاعات سفارش نامعتبر است."
      },
      400
    );
  }

  const customerName =
    String(
      data.customer_name || ""
    ).trim();

  const customerEmail =
    String(
      data.customer_email || ""
    ).trim();

  const customerPhone =
    String(
      data.customer_phone || ""
    ).trim();

  const address =
    String(
      data.address || ""
    ).trim();

  const items =
    Array.isArray(data.items)
      ? data.items
      : [];

  if (!customerName) {
    return json(
      {
        ok: false,
        error:
          "نام الزامی است."
      },
      400
    );
  }

  if (!customerPhone) {
    return json(
      {
        ok: false,
        error:
          "شماره تماس الزامی است."
      },
      400
    );
  }

  if (!address) {
    return json(
      {
        ok: false,
        error:
          "آدرس الزامی است."
      },
      400
    );
  }

  if (!items.length) {
    return json(
      {
        ok: false,
        error:
          "سبد خرید خالی است."
      },
      400
    );
  }

  let total = 0;

  const orderItems = [];

  const supplierGroups =
    new Map();

  for (const item of items) {
    const productId =
      Number(
        item.product_id ??
        item.id
      );

    const quantity =
      Math.max(
        1,
        Math.floor(
          Number(
            item.quantity || 1
          )
        )
      );

    if (
      !Number.isFinite(
        productId
      ) ||
      !Number.isFinite(
        quantity
      )
    ) {
      return json(
        {
          ok: false,
          error:
            "اطلاعات محصول نامعتبر است."
        },
        400
      );
    }

    const product =
      await env.DB.prepare(`
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
        LEFT JOIN suppliers s
          ON s.id = p.supplier_id
        WHERE p.id = ?
        LIMIT 1
      `)
      .bind(productId)
      .first();

    if (
      !product ||
      Number(product.active) !== 1
    ) {
      return json(
        {
          ok: false,
          error:
            "یکی از محصولات موجود نیست."
        },
        400
      );
    }

    /*
     * موجودی همچنان توسط تأمین‌کننده
     * قابل تنظیم است، اما بعد از سفارش
     * خودکار کم نمی‌شود.
     *
     * چون DigiMarixo انباردار کالا نیست.
     */
    if (
      Number(product.stock) <= 0
    ) {
      return json(
        {
          ok: false,
          error:
            "این محصول در حال حاضر موجود نیست."
        },
        400
      );
    }

    if (!product.supplier_id) {
      return json(
        {
          ok: false,
          error:
            "فروشنده این محصول هنوز مشخص نشده است."
        },
        400
      );
    }

    if (
      Number(
        product.supplier_active
      ) !== 1
    ) {
      return json(
        {
          ok: false,
          error:
            "فروشنده این محصول فعال نیست."
        },
        400
      );
    }

    if (
      Number(
        product.supplier_direct_shipping
      ) !== 1
    ) {
      return json(
        {
          ok: false,
          error:
            "فروشنده این محصول ارسال مستقیم به مشتری را تأیید نکرده است."
        },
        400
      );
    }

    const price =
      normalizePrice(
        product.price
      );

    const supplierPrice =
      normalizePrice(
        product.supplier_price
      );

    const commission =
      normalizePrice(
        product.commission
      );

    if (price <= 0) {
      return json(
        {
          ok: false,
          error:
            "قیمت این محصول هنوز تعیین نشده است."
        },
        400
      );
    }

    total +=
      price * quantity;

    const orderItem = {
      productId,
      supplierId:
        Number(
          product.supplier_id
        ),
      quantity,
      price,
      supplierPrice,
      commission
    };

    orderItems.push(
      orderItem
    );

    if (
      !supplierGroups.has(
        orderItem.supplierId
      )
    ) {
      supplierGroups.set(
        orderItem.supplierId,
        []
      );
    }

    supplierGroups
      .get(
        orderItem.supplierId
      )
      .push(orderItem);
  }

  const order =
    await env.DB.prepare(`
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
    `)
    .bind(
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

  const orderId =
    order.meta.last_row_id;

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
    `)
    .bind(
      orderId,
      item.productId,
      item.supplierId,
      item.quantity,
      item.price,
      item.supplierPrice,
      item.commission
    )
    .run();

    /*
     * عمداً موجودی را کم نمی‌کنیم.
     * چون محصول متعلق به تأمین‌کننده است.
     */
  }

  for (
    const supplierId
    of supplierGroups.keys()
  ) {
    await env.DB.prepare(`
      INSERT INTO supplier_orders
      (
        order_id,
        supplier_id,
        status,
        shipping_status
      )
      VALUES (?, ?, ?, ?)
    `)
    .bind(
      orderId,
      supplierId,
      "جدید",
      "در انتظار ارسال"
    )
    .run();
  }

  return json({
    ok: true,
    order_id:
      orderId,
    total,
    suppliers:
      supplierGroups.size
  });
}


async function getOrders(env) {
  const result =
    await env.DB.prepare(`
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
    orders:
      result.results || []
  };
}


async function updateOrderStatus(
  request,
  env
) {
  let data;

  try {
    data =
      await request.json();
  } catch {
    return json(
      {
        ok: false,
        error:
          "اطلاعات نامعتبر است."
      },
      400
    );
  }

  const id =
    Number(data.id);

  const status =
    String(
      data.status ||
        "در حال بررسی"
    ).trim();

  const supplierStatus =
    String(
      data.supplier_status ||
        "در انتظار فروشنده"
    ).trim();

  const shippingStatus =
    String(
      data.shipping_status ||
        "در انتظار ارسال"
    ).trim();

  if (!id) {
    return json(
      {
        ok: false,
        error:
          "شناسه سفارش نامعتبر است."
      },
      400
    );
  }

  await env.DB.prepare(`
    UPDATE orders
    SET
      status = ?,
      supplier_status = ?,
      shipping_status = ?
    WHERE id = ?
  `)
  .bind(
    status,
    supplierStatus,
    shippingStatus,
    id
  )
  .run();

  await env.DB.prepare(`
    UPDATE supplier_orders
    SET
      status = ?,
      shipping_status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE order_id = ?
  `)
  .bind(
    supplierStatus,
    shippingStatus,
    id
  )
  .run();

  return json({
    ok: true
  });
}


/* =========================================================
   CUSTOMER ORDER LOOKUP
========================================================= */

async function lookupOrder(
  request,
  env
) {
  let data;

  try {
    data =
      await request.json();
  } catch {
    return json(
      {
        ok: false,
        error:
          "اطلاعات نامعتبر است."
      },
      400
    );
  }

  const orderId =
    Number(
      data.order_id || 0
    );

  const phone =
    String(
      data.phone || ""
    ).trim();

  if (
    !orderId ||
    !phone
  ) {
    return json(
      {
        ok: false,
        error:
          "شماره سفارش و شماره تماس الزامی است."
      },
      400
    );
  }

  const order =
    await env.DB.prepare(`
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
      WHERE
        id = ?
        AND customer_phone = ?
      LIMIT 1
    `)
    .bind(
      orderId,
      phone
    )
    .first();

  if (!order) {
    return json(
      {
        ok: false,
        error:
          "سفارش پیدا نشد."
      },
      404
    );
  }

  const suppliers =
    await env.DB.prepare(`
      SELECT
        so.id,
        so.status,
        so.shipping_status,
        so.tracking_code,
        so.supplier_note,
        s.name AS supplier_name
      FROM supplier_orders so
      LEFT JOIN suppliers s
        ON s.id = so.supplier_id
      WHERE so.order_id = ?
      ORDER BY so.id ASC
    `)
    .bind(orderId)
    .all();

  return json({
    ok: true,
    order: {
      ...order,
      suppliers:
        suppliers.results || []
    }
  });
}


/* =========================================================
   HOME
========================================================= */

async function homePage(env) {
  const data =
    await getProducts(env);

  const products =
    data.products || [];

  const cards =
    products.length
      ? products
          .slice(0, 6)
          .map(productCard)
          .join("")
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

        <span class="badge">
          دیجی‌ماریکسو
        </span>

        <h1>
          فروشگاه دیجیتال
          <strong>
            دیجی‌ماریکسو
          </strong>
        </h1>

        <p>
          خرید و دسترسی آسان به محصولات
          با تجربه‌ای ساده، سریع و مطمئن.
        </p>

        <div class="hero-actions">

          <a
            class="btn primary"
            href="/products"
          >
            محصولات ویژه
          </a>

          <a
            class="btn secondary"
            href="/account"
          >
            حساب کاربری
          </a>

        </div>

      </div>

      <div class="hero-card">

        <div class="hero-icon">
          ◆
        </div>

        <h3>
          دیجی‌ماریکسو
        </h3>

        <p>
          انتخاب، خرید و مدیریت محصولات
          در یک فروشگاه مدرن.
        </p>

      </div>

    </section>

    <section class="section">

      <div class="section-head">

        <div>

          <span class="eyebrow">
            محصولات
          </span>

          <h2>
            محصولات منتخب
          </h2>

        </div>

        <a
          href="/products"
          class="text-link"
        >
          مشاهده همه
        </a>

      </div>

      <div class="products-grid">
        ${cards}
      </div>

    </section>

    <section
      class="features"
      id="features"
    >

      <div class="feature">

        <div class="feature-icon">
          ⚡
        </div>

        <h3>
          سریع
        </h3>

        <p>
          دسترسی آسان و سریع به محصولات.
        </p>

      </div>

      <div class="feature">

        <div class="feature-icon">
          🔒
        </div>

        <h3>
          مطمئن
        </h3>

        <p>
          مدیریت سفارش‌ها و اطلاعات
          در یک محیط امن.
        </p>

      </div>

      <div class="feature">

        <div class="feature-icon">
          ◆
        </div>

        <h3>
          دیجیتال
        </h3>

        <p>
          تمرکز فروشگاه بر محصولات
          و خدمات کاربردی.
        </p>

      </div>

      <div class="feature">

        <div class="feature-icon">
          ✓
        </div>

        <h3>
          ساده
        </h3>

        <p>
          رابط کاربری ساده
          برای خرید راحت‌تر.
        </p>

      </div>

    </section>

    <section class="promo">

      <div>

        <span class="eyebrow">
          DigiMarixo
        </span>

        <h2>
          همه‌چیز برای یک خرید ساده
        </h2>

        <p>
          محصولات را بررسی کنید
          و سفارش خود را مدیریت کنید.
        </p>

      </div>

      <a
        class="btn orange"
        href="/products"
      >
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
  const data =
    await getProducts(env);

  const cards =
    data.products?.length
      ? data.products
          .map(productCard)
          .join("")
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
        محصولات موجود در دیجی‌ماریکسو
        را مشاهده کنید.
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

function productDetailPage(
  product
) {
  const image =
    product.image
      ? `
        <img
          src="${escapeAttr(
            product.image
          )}"
          alt="${escapeAttr(
            product.name
          )}"
        >
      `
      : `
        <div class="product-placeholder large">
          ◆
        </div>
      `;

  const stock =
    Number(
      product.stock || 0
    );

  const price =
    normalizePrice(
      product.price
    );

  const canBuy =
    stock > 0 &&
    Number(
      product.supplier_id
    ) > 0 &&
    Number(
      product.supplier_direct_shipping
    ) === 1 &&
    price > 0;

  return `
    <section class="product-detail">

      <div class="detail-image">
        ${image}
      </div>

      <div class="detail-content">

        <span class="product-category">
          ${escapeHTML(
            product.category ||
              "عمومی"
          )}
        </span>

        <h1>
          ${escapeHTML(
            product.name ||
              "محصول"
          )}
        </h1>

        <p class="detail-description">
          ${escapeHTML(
            product.description ||
              "محصول دیجی‌ماریکسو"
          )}
        </p>

        <div class="detail-price">
          ${formatPrice(price)}
        </div>

        <div class="detail-stock">

          ${
            stock > 0
              ? `
                موجود و قابل سفارش
              `
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
                  '${escapeJS(
                    product.name ||
                      "محصول"
                  )}',
                  ${price}
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
                فعلاً قابل خرید نیست
              </button>

              <p
                style="
                  color:#64748b;
                  font-size:13px;
                  margin-top:12px
                "
              >
                این محصول هنوز
                برای فروش واقعی
                فعال نشده است.
              </p>
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

function productCard(
  product
) {
  const id =
    Number(
      product.id || 0
    );

  const name =
    escapeHTML(
      product.name ||
        "محصول"
    );

  const description =
    escapeHTML(
      product.description ||
        "محصول دیجی‌ماریکسو"
    );

  const price =
    normalizePrice(
      product.price
    );

  const stock =
    Number(
      product.stock || 0
    );

  const canBuy =
    stock > 0 &&
    Number(
      product.supplier_id
    ) > 0 &&
    Number(
      product.supplier_direct_shipping
    ) === 1 &&
    price > 0;

  const image =
    product.image
      ? `
        <img
          src="${escapeAttr(
            product.image
          )}"
          alt="${escapeAttr(
            product.name ||
              "محصول"
          )}"
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
            product.category ||
              "عمومی"
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
            ${formatPrice(price)}
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
            canBuy
              ? `
                <button
                  class="btn small orange"
                  onclick="addToCart(
                    ${id},
                    '${escapeJS(
                      product.name ||
                        "محصول"
                    )}',
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

        <span class="eyebrow">
          دیجی‌ماریکسو
        </span>

        <h1>
          پیگیری سفارش
        </h1>

        <p>
          برای مشاهده وضعیت سفارش،
          شماره سفارش و شماره تماس
          خود را وارد کنید.
        </p>

        <form
          onsubmit="
            return lookupOrderForm(event)
          "
        >

          <label>
            شماره سفارش
          </label>

          <input
            id="lookup-order-id"
            type="number"
            min="1"
            required
            placeholder="مثلاً ۱۲۳"
          >

          <label>
            شماره تماس
          </label>

          <input
            id="lookup-phone"
            required
            placeholder="شماره تماس ثبت سفارش"
          >

          <button
            class="btn primary"
            type="submit"
          >
            پیگیری سفارش
          </button>

        </form>

        <div
          id="lookup-result"
          style="margin-top:20px"
        ></div>

        <div class="account-links">

          <a href="/products">
            ادامه خرید
          </a>

          <a href="/">
            بازگشت به فروشگاه
          </a>

        </div>

      </div>

      <div class="account-card">

        <span class="eyebrow">
          DigiMarixo
        </span>

        <h2>
          حساب کاربری
        </h2>

        <p>
          سیستم ورود و ثبت‌نام کامل
          مشتریان در مرحله بعدی
          اضافه می‌شود.
        </p>

        <div
          style="
            margin-top:20px;
            padding:18px;
            background:#f1f5f9;
            border-radius:15px;
            color:#475569;
            font-size:14px
          "
        >
          در حال حاضر بدون نیاز به
          ایجاد حساب، می‌توانید سفارش
          ثبت کنید و با شماره سفارش
          آن را پیگیری کنید.
        </div>

      </div>

    </section>

    <script>

      async function lookupOrderForm(
        event
      ) {
        event.preventDefault();

        const orderId =
          Number(
            document
              .getElementById(
                "lookup-order-id"
              )
              .value
          );

        const phone =
          document
            .getElementById(
              "lookup-phone"
            )
            .value
            .trim();

        const box =
          document
            .getElementById(
              "lookup-result"
            );

        box.innerHTML =
          "در حال بررسی...";

        try {

          const response =
            await fetch(
              "/api/order/lookup",
              {
                method:"POST",

                headers:{
                  "content-type":
                    "application/json"
                },

                body:
                  JSON.stringify({
                    order_id:
                      orderId,
                    phone:
                      phone
                  })
              }
            );

          const result =
            await response.json();

          if (!result.ok) {

            box.innerHTML =
              '<div class="empty">' +
              escapeClientHTML(
                result.error ||
                "سفارش پیدا نشد."
              ) +
              '</div>';

            return false;
          }

          const order =
            result.order;

          const supplierRows =
            (
              order.suppliers ||
              []
            )
            .map(
              function(s) {

                return `
                  <div
                    style="
                      padding:12px;
                      margin-top:10px;
                      background:#f8fafc;
                      border-radius:12px
                    "
                  >

                    <strong>
                      ${escapeClientHTML(
                        s.supplier_name ||
                        "تأمین‌کننده"
                      )}
                    </strong>

                    <div>
                      وضعیت:
                      ${escapeClientHTML(
                        s.status
                      )}
                    </div>

                    <div>
                      ارسال:
                      ${escapeClientHTML(
                        s.shipping_status
                      )}
                    </div>

                    ${
                      s.tracking_code
                        ? `
                          <div>
                            کد رهگیری:
                            <strong>
                              ${escapeClientHTML(
                                s.tracking_code
                              )}
                            </strong>
                          </div>
                        `
                        : ""
                    }

                  </div>
                `;
              }
            )
            .join("");

          box.innerHTML = `
            <div
              class="admin-card"
              style="margin-top:15px"
            >

              <strong>
                سفارش #${Number(order.id)}
              </strong>

              <div>
                وضعیت:
                ${escapeClientHTML(
                  order.status
                )}
              </div>

              <div>
                مبلغ:
                ${formatClientPrice(
                  order.total
                )}
              </div>

              ${supplierRows}

            </div>
          `;

        } catch(error) {

          console.error(error);

          box.innerHTML =
            '<div class="empty">' +
            'خطا در پیگیری سفارش.' +
            '</div>';
        }

        return false;
      }

    </script>
    `
  );
}


/* =========================================================
   SUPPLIER PAGE
========================================================= */

function supplierPage() {
  return layout(
    "پنل تأمین‌کننده",
    `
    <section class="page-title">

      <span class="eyebrow">
        DigiMarixo Supplier
      </span>

      <h1>
        پنل تأمین‌کننده
      </h1>

      <p>
        مشاهده و مدیریت سفارش‌های مربوط
        به محصولات شما.
      </p>

    </section>

    <section
      class="account-wrap"
      style="
        grid-template-columns:1fr;
        max-width:900px
      "
    >

      <div
        class="account-card"
        id="supplier-login-box"
      >

        <span class="eyebrow">
          ورود تأمین‌کننده
        </span>

        <h2>
          ورود به پنل
        </h2>

        <form
          onsubmit="
            return supplierLoginForm(event)
          "
        >

          <label>
            شناسه تأمین‌کننده
          </label>

          <input
            id="supplier-id"
            type="number"
            min="1"
            required
            placeholder="شناسه‌ای که مدیر فروشگاه داده است"
          >

          <label>
            کد دسترسی
          </label>

          <input
            id="supplier-code"
            type="password"
            required
            placeholder="کد دسترسی تأمین‌کننده"
          >

          <button
            class="btn orange"
            type="submit"
          >
            ورود به پنل
          </button>

        </form>

        <p
          style="
            color:#64748b;
            font-size:13px;
            margin-top:18px
          "
        >
          شناسه و کد دسترسی توسط مدیر
          دیجی‌ماریکسو هنگام ثبت فروشنده
          ایجاد می‌شود.
        </p>

      </div>

      <div
        class="account-card"
        id="supplier-panel"
        style="display:none"
      >

        <div
          style="
            display:flex;
            justify-content:space-between;
            gap:15px;
            align-items:center;
            flex-wrap:wrap
          "
        >

          <div>

            <span class="eyebrow">
              سفارش‌های شما
            </span>

            <h2 id="supplier-name-title">
              تأمین‌کننده
            </h2>

          </div>

          <button
            class="btn secondary"
            onclick="supplierLogout()"
          >
            خروج
          </button>

        </div>

        <div
          id="supplier-orders"
          style="margin-top:25px"
        >
          در حال دریافت سفارش‌ها...
        </div>

      </div>

    </section>

    <script>

      function getSupplierSession() {

        try {

          return JSON.parse(
            localStorage.getItem(
              "digimarixo_supplier"
            ) || "null"
          );

        } catch {

          return null;

        }

      }


      function saveSupplierSession(
        data
      ) {

        localStorage.setItem(
          "digimarixo_supplier",
          JSON.stringify(data)
        );

      }


      function supplierLogout() {

        localStorage.removeItem(
          "digimarixo_supplier"
        );

        location.reload();

      }


      async function supplierLoginForm(
        event
      ) {

        event.preventDefault();

        const supplierId =
          Number(
            document
              .getElementById(
                "supplier-id"
              )
              .value
          );

        const accessCode =
          document
            .getElementById(
              "supplier-code"
            )
            .value
            .trim();

        try {

          const response =
            await fetch(
              "/api/supplier/login",
              {
                method:"POST",

                headers:{
                  "content-type":
                    "application/json"
                },

                body:
                  JSON.stringify({
                    supplier_id:
                      supplierId,

                    access_code:
                      accessCode
                  })
              }
            );

          const result =
            await response.json();

          if (!result.ok) {

            alert(
              result.error ||
              "ورود انجام نشد."
            );

            return false;
          }

          saveSupplierSession({
            id:
              result.supplier.id,

            name:
              result.supplier.name,

            access_code:
              accessCode
          });

          location.reload();

        } catch(error) {

          console.error(error);

          alert(
            "خطا در ارتباط با سرور."
          );

        }

        return false;
      }


      async function loadSupplierPanel() {

        const session =
          getSupplierSession();

        if (!session) {
          return;
        }

        const loginBox =
          document
            .getElementById(
              "supplier-login-box"
            );

        const panel =
          document
            .getElementById(
              "supplier-panel"
            );

        const title =
          document
            .getElementById(
              "supplier-name-title"
            );

        if (!loginBox || !panel) {
          return;
        }

        loginBox.style.display =
          "none";

        panel.style.display =
          "block";

        title.textContent =
          session.name ||
          "تأمین‌کننده";

        const box =
          document
            .getElementById(
              "supplier-orders"
            );

        try {

          const response =
            await fetch(
              "/api/supplier/orders",
              {
                headers:{
                  "X-Supplier-ID":
                    String(
                      session.id
                    ),

                  "X-Supplier-Code":
                    session.access_code
                }
              }
            );

          const result =
            await response.json();

          if (!result.ok) {

            box.innerHTML =
              '<div class="empty">' +
              escapeClientHTML(
                result.error ||
                "دسترسی رد شد."
              ) +
              '</div>';

            return;
          }

          const orders =
            result.orders || [];

          if (!orders.length) {

            box.innerHTML =
              '<div class="empty">' +
              'هنوز سفارشی برای شما ثبت نشده است.' +
              '</div>';

            return;
          }

          box.innerHTML =
            orders
              .map(
                function(order) {

                  return supplierOrderCard(
                    order
                  );

                }
              )
              .join("");

        } catch(error) {

          console.error(error);

          box.innerHTML =
            '<div class="empty">' +
            'خطا در دریافت سفارش‌ها.' +
            '</div>';
        }
      }


      function supplierOrderCard(
        order
      ) {

        return `
          <div
            class="admin-card"
            style="
              margin-bottom:18px
            "
          >

            <strong>
              سفارش #${Number(
                order.order_id
              )}
            </strong>

            <span>
              مشتری:
              ${escapeClientHTML(
                order.customer_name
              )}
            </span>

            <span>
              تلفن:
              ${escapeClientHTML(
                order.customer_phone
              )}
            </span>

            <span>
              آدرس:
              ${escapeClientHTML(
                order.address
              )}
            </span>

            <span>
              محصولات:
              ${escapeClientHTML(
                order.items ||
                "اطلاعات محصول"
              )}
            </span>

            <span>
              مبلغ کل سفارش:
              ${formatClientPrice(
                order.total
              )}
            </span>

            <span>
              وضعیت:
              ${escapeClientHTML(
                order.status
              )}
            </span>

            <span>
              وضعیت ارسال:
              ${escapeClientHTML(
                order.shipping_status
              )}
            </span>

            ${
              order.tracking_code
                ? `
                  <span>
                    کد رهگیری فعلی:
                    <strong>
                      ${escapeClientHTML(
                        order.tracking_code
                      )}
                    </strong>
                  </span>
                `
                : ""
            }

            <label
              style="
                margin-top:15px
              "
            >
              وضعیت سفارش
            </label>

            <select
              id="supplier-status-${Number(
                order.id
              )}"
            >

              <option
                value="جدید"
                ${
                  order.status === "جدید"
                    ? "selected"
                    : ""
                }
              >
                جدید
              </option>

              <option
                value="تأیید شد"
                ${
                  order.status === "تأیید شد"
                    ? "selected"
                    : ""
                }
              >
                تأیید شد
              </option>

              <option
                value="لغو شد"
                ${
                  order.status === "لغو شد"
                    ? "selected"
                    : ""
                }
              >
                لغو شد
              </option>

            </select>

            <label
              style="
                margin-top:10px
              "
            >
              وضعیت ارسال
            </label>

            <select
              id="supplier-shipping-${Number(
                order.id
              )}"
            >

              <option
                value="در انتظار ارسال"
                ${
                  order.shipping_status ===
                  "در انتظار ارسال"
                    ? "selected"
                    : ""
                }
              >
                در انتظار ارسال
              </option>

              <option
                value="آماده ارسال"
                ${
                  order.shipping_status ===
                  "آماده ارسال"
                    ? "selected"
                    : ""
                }
              >
                آماده ارسال
              </option>

              <option
                value="ارسال شد"
                ${
                  order.shipping_status ===
                  "ارسال شد"
                    ? "selected"
                    : ""
                }
              >
                ارسال شد
              </option>

              <option
                value="تحویل شد"
                ${
                  order.shipping_status ===
                  "تحویل شد"
                    ? "selected"
                    : ""
                }
              >
                تحویل شد
              </option>

            </select>

            <label
              style="
                margin-top:10px
              "
            >
              کد رهگیری
            </label>

            <input
              id="supplier-tracking-${Number(
                order.id
              )}"
              value="${escapeAttr(
                order.tracking_code ||
                ""
              )}"
              placeholder="در صورت ارسال، کد رهگیری را وارد کنید"
            >

            <label
              style="
                margin-top:10px
              "
            >
              توضیحات برای مدیر
            </label>

            <input
              id="supplier-note-${Number(
                order.id
              )}"
              value="${escapeAttr(
                order.supplier_note ||
                ""
              )}"
              placeholder="توضیح اختیاری"
            >

            <button
              class="btn orange"
              style="
                margin-top:15px
              "
              onclick="
                updateSupplierOrder(
                  ${Number(order.id)}
                )
              "
            >
              ذخیره وضعیت سفارش
            </button>

          </div>
        `;
      }


      async function updateSupplierOrder(
        supplierOrderId
      ) {

        const session =
          getSupplierSession();

        if (!session) {

          alert(
            "ابتدا وارد پنل شوید."
          );

          return;
        }

        const status =
          document
            .getElementById(
              "supplier-status-" +
              supplierOrderId
            )
            .value;

        const shippingStatus =
          document
            .getElementById(
              "supplier-shipping-" +
              supplierOrderId
            )
            .value;

        const trackingCode =
          document
            .getElementById(
              "supplier-tracking-" +
              supplierOrderId
            )
            .value
            .trim();

        const note =
          document
            .getElementById(
              "supplier-note-" +
              supplierOrderId
            )
            .value
            .trim();

        try {

          const response =
            await fetch(
              "/api/supplier/orders/status",
              {
                method:"PUT",

                headers:{
                  "content-type":
                    "application/json",

                  "X-Supplier-ID":
                    String(
                      session.id
                    ),

                  "X-Supplier-Code":
                    session.access_code
                },

                body:
                  JSON.stringify({

                    supplier_order_id:
                      supplierOrderId,

                    status:
                      status,

                    shipping_status:
                      shippingStatus,

                    tracking_code:
                      trackingCode,

                    supplier_note:
                      note

                  })
              }
            );

          const result =
            await response.json();

          if (!result.ok) {

            alert(
              result.error ||
              "ذخیره انجام نشد."
            );

            return;
          }

          alert(
            "وضعیت سفارش با موفقیت ذخیره شد."
          );

          loadSupplierPanel();

        } catch(error) {

          console.error(error);

          alert(
            "خطا در ذخیره سفارش."
          );

        }
      }


      loadSupplierPanel();

    </script>
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
   ADMIN PAGE
========================================================= */

async function adminPage(env) {

  const productCount =
    await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM products
    `).first();

  const supplierCount =
    await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM suppliers
    `).first();

  const orderCount =
    await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM orders
    `).first();

  const supplierData =
    await getSuppliers(env);

  const suppliers =
    supplierData.suppliers || [];

  const productData =
    await env.DB.prepare(`
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
      LEFT JOIN suppliers s
        ON s.id = p.supplier_id
      ORDER BY p.id DESC
    `).all();

  const orderData =
    await env.DB.prepare(`
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

  const productsList =
    productData.results || [];

  const ordersList =
    orderData.results || [];

  const supplierOptions =
    suppliers.length
      ? suppliers
          .map(
            s => `
              <option
                value="${Number(s.id)}"
              >
                ${escapeHTML(
                  s.name
                )}

                ${
                  Number(
                    s.direct_shipping
                  ) === 1
                    ? " — ارسال مستقیم"
                    : " — ارسال مستقیم تأیید نشده"
                }
              </option>
            `
          )
          .join("")
      : `
        <option value="">
          هنوز فروشنده‌ای ثبت نشده است
        </option>
      `;

  const productRows =
    productsList.length
      ? productsList
          .map(
            p => `
              <div
                class="admin-card"
                style="grid-column:1/-1"
              >

                <strong>
                  ${escapeHTML(
                    p.name
                  )}
                </strong>

                <span>
                  قیمت فروش:
                  ${formatPrice(
                    p.price
                  )}
                </span>

                <span>
                  موجودی اعلام‌شده:
                  ${formatNumber(
                    p.stock
                  )}
                </span>

                <span>
                  فروشنده:
                  ${
                    p.supplier_name
                      ? escapeHTML(
                          p.supplier_name
                        )
                      : "تعیین نشده"
                  }
                </span>

                <span>
                  وضعیت:
                  ${
                    Number(
                      p.active
                    ) === 1
                      ? "فعال"
                      : "غیرفعال"
                  }
                </span>

                <button
                  class="btn small primary"
                  style="margin-top:12px"
                  onclick="editProduct(
                    ${Number(p.id)}
                  )"
                >
                  ویرایش محصول
                </button>

              </div>
            `
          )
          .join("")
      : `
        <div
          class="empty"
          style="grid-column:1/-1"
        >
          هنوز محصولی ثبت نشده است.
        </div>
      `;

  const orderRows =
    ordersList.length
      ? ordersList
          .map(
            o => `
              <div
                class="admin-card"
                style="grid-column:1/-1"
              >

                <strong>
                  سفارش #${Number(o.id)}
                </strong>

                <span>
                  مشتری:
                  ${escapeHTML(
                    o.customer_name
                  )}
                </span>

                <span>
                  تلفن:
                  ${escapeHTML(
                    o.customer_phone
                  )}
                </span>

                <span>
                  مبلغ:
                  ${formatPrice(
                    o.total
                  )}
                </span>

                <span>
                  وضعیت:
                  ${escapeHTML(
                    o.status
                  )}
                </span>

                <span>
                  وضعیت فروشنده:
                  ${escapeHTML(
                    o.supplier_status
                  )}
                </span>

                <span>
                  ارسال:
                  ${escapeHTML(
                    o.shipping_status
                  )}
                </span>

                <select
                  id="order-status-${Number(o.id)}"
                  style="
                    width:100%;
                    margin-top:12px;
                    padding:10px;
                    border:1px solid #cbd5e1;
                    border-radius:10px
                  "
                >

                  <option value="در حال بررسی">
                    در حال بررسی
                  </option>

                  <option value="تأیید شد">
                    تأیید شد
                  </option>

                  <option value="لغو شد">
                    لغو شد
                  </option>

                  <option value="ارسال شد">
                    ارسال شد
                  </option>

                  <option value="تحویل شد">
                    تحویل شد
                  </option>

                </select>

                <button
                  class="btn small orange"
                  style="margin-top:10px"
                  onclick="updateOrderStatus(
                    ${Number(o.id)}
                  )"
                >
                  ذخیره وضعیت
                </button>

              </div>
            `
          )
          .join("")
      : `
        <div
          class="empty"
          style="grid-column:1/-1"
        >
          هنوز سفارشی ثبت نشده است.
        </div>
      `;

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
          ${formatNumber(
            productCount?.count || 0
          )}
          محصول ثبت شده
        </span>

      </div>

      <div class="admin-card">

        <strong>
          فروشندگان
        </strong>

        <span>
          ${formatNumber(
            supplierCount?.count || 0
          )}
          فروشنده ثبت شده
        </span>

      </div>

      <div class="admin-card">

        <strong>
          سفارش‌ها
        </strong>

        <span>
          ${formatNumber(
            orderCount?.count || 0
          )}
          سفارش ثبت شده
        </span>

      </div>

    </section>

    <section class="section">

      <div class="section-head">

        <div>

          <span class="eyebrow">
            فروشنده
          </span>

          <h2>
            افزودن فروشنده
          </h2>

        </div>

      </div>

      <div class="account-card">

        <form
          id="supplier-form"
          onsubmit="
            return createSupplierForm(event)
          "
        >

          <label>
            نام فروشنده
          </label>

          <input
            id="supplier-name"
            required
            placeholder="نام فروشنده یا شرکت"
          >

          <label>
            شماره تماس
          </label>

          <input
            id="supplier-phone"
            placeholder="شماره تماس"
          >

          <label>
            ایمیل
          </label>

          <input
            id="supplier-email"
            type="email"
            placeholder="ایمیل"
          >

          <label>
            آدرس
          </label>

          <input
            id="supplier-address"
            placeholder="آدرس"
          >

          <label>
            ارسال مستقیم
          </label>

          <select id="supplier-direct">

            <option value="1">
              بله، مستقیم برای مشتری ارسال می‌کند
            </option>

            <option value="0">
              خیر
            </option>

          </select>

          <button
            class="btn orange"
            type="submit"
          >
            ثبت فروشنده
          </button>

        </form>

      </div>

    </section>

    <section class="section">

      <div class="section-head">

        <div>

          <span class="eyebrow">
            محصول
          </span>

          <h2>
            افزودن محصول
          </h2>

        </div>

      </div>

      <div class="account-card">

        <form
          id="product-form"
          onsubmit="
            return createProductForm(event)
          "
        >

          <label>
            نام محصول
          </label>

          <input
            id="product-name"
            required
            placeholder="نام محصول"
          >

          <label>
            توضیحات
          </label>

          <input
            id="product-description"
            placeholder="توضیحات محصول"
          >

          <label>
            دسته‌بندی
          </label>

          <input
            id="product-category"
            placeholder="مثلاً دیجیتال"
          >

          <label>
            لینک تصویر
          </label>

          <input
            id="product-image"
            placeholder="https://..."
          >

          <label>
            قیمت فروش به مشتری
          </label>

          <input
            id="product-price"
            type="number"
            min="1"
            required
            placeholder="مثلاً 500000"
          >

          <label>
            موجودی اعلام‌شده توسط فروشنده
          </label>

          <input
            id="product-stock"
            type="number"
            min="0"
            value="1"
            required
          >

          <label>
            فروشنده
          </label>

          <select
            id="product-supplier"
            required
          >
            ${supplierOptions}
          </select>

          <label>
            قیمت تأمین‌کننده
          </label>

          <input
            id="product-supplier-price"
            type="number"
            min="0"
            placeholder="هزینه خرید از فروشنده"
          >

          <label>
            کمیسیون / سود
          </label>

          <input
            id="product-commission"
            type="number"
            min="0"
            placeholder="مبلغ سود"
          >

          <button
            class="btn orange"
            type="submit"
          >
            ثبت محصول
          </button>

        </form>

      </div>

    </section>

    <section class="section">

      <div class="section-head">

        <div>

          <span class="eyebrow">
            محصولات
          </span>

          <h2>
            محصولات ثبت شده
          </h2>

        </div>

      </div>

      <div class="admin-grid">
        ${productRows}
      </div>

    </section>

    <section class="section">

      <div class="section-head">

        <div>

          <span class="eyebrow">
            سفارش‌ها
          </span>

          <h2>
            سفارش‌های اخیر
          </h2>

        </div>

      </div>

      <div class="admin-grid">
        ${orderRows}
      </div>

    </section>

    <section class="section">

      <div class="account-card">

        <span class="eyebrow">
          تأمین‌کننده
        </span>

        <h2>
          ورود تأمین‌کننده
        </h2>

        <p>
          آدرس پنل تأمین‌کننده:
        </p>

        <div
          style="
            background:#f1f5f9;
            padding:14px;
            border-radius:12px;
            direction:ltr;
            text-align:left
          "
        >
          /supplier
        </div>

        <p
          style="
            color:#64748b;
            font-size:13px;
            margin-top:12px
          "
        >
          بعد از ثبت فروشنده، شناسه و کد
          دسترسی او نمایش داده می‌شود.
          کد را فقط در اختیار همان
          تأمین‌کننده قرار دهید.
        </p>

      </div>

    </section>

    <script>

      function adminPassword() {

        return prompt(
          "رمز مدیریت را وارد کنید:"
        ) || "";

      }


      async function adminFetch(
        url,
        options
      ) {

        options =
          options || {};

        options.headers =
          Object.assign(
            {},
            options.headers || {},
            {
              "content-type":
                "application/json",

              "X-Admin-Password":
                adminPassword()
            }
          );

        return fetch(
          url,
          options
        );
      }


      async function createSupplierForm(
        event
      ) {

        event.preventDefault();

        const response =
          await adminFetch(
            "/api/admin/suppliers",
            {
              method:"POST",

              body:
                JSON.stringify({

                  name:
                    document
                      .getElementById(
                        "supplier-name"
                      )
                      .value,

                  phone:
                    document
                      .getElementById(
                        "supplier-phone"
                      )
                      .value,

                  email:
                    document
                      .getElementById(
                        "supplier-email"
                      )
                      .value,

                  address:
                    document
                      .getElementById(
                        "supplier-address"
                      )
                      .value,

                  direct_shipping:
                    Number(
                      document
                        .getElementById(
                          "supplier-direct"
                        )
                        .value
                    ),

                  active:1

                })
            }
          );

        const result =
          await response.json();

        if (!result.ok) {

          alert(
            result.error ||
            "ثبت فروشنده انجام نشد."
          );

          return false;
        }

        alert(
          "فروشنده با موفقیت ثبت شد.\n\n" +
          "شناسه تأمین‌کننده: " +
          result.supplier_id +
          "\n\n" +
          "کد دسترسی تأمین‌کننده:\n" +
          result.access_code +
          "\n\n" +
          "این کد را ذخیره کنید و فقط در اختیار همان تأمین‌کننده قرار دهید."
        );

        location.reload();

        return false;
      }


      async function createProductForm(
        event
      ) {

        event.preventDefault();

        const response =
          await adminFetch(
            "/api/admin/products",
            {
              method:"POST",

              body:
                JSON.stringify({

                  name:
                    document
                      .getElementById(
                        "product-name"
                      )
                      .value,

                  description:
                    document
                      .getElementById(
                        "product-description"
                      )
                      .value,

                  category:
                    document
                      .getElementById(
                        "product-category"
                      )
                      .value,

                  image:
                    document
                      .getElementById(
                        "product-image"
                      )
                      .value,

                  price:
                    Number(
                      document
                        .getElementById(
                          "product-price"
                        )
                        .value
                    ),

                  stock:
                    Number(
                      document
                        .getElementById(
                          "product-stock"
                        )
                        .value
                    ),

                  supplier_id:
                    Number(
                      document
                        .getElementById(
                          "product-supplier"
                        )
                        .value
                    ),

                  supplier_price:
                    Number(
                      document
                        .getElementById(
                          "product-supplier-price"
                        )
                        .value ||
                      0
                    ),

                  commission:
                    Number(
                      document
                        .getElementById(
                          "product-commission"
                        )
                        .value ||
                      0
                    ),

                  active:1

                })
            }
          );

        const result =
          await response.json();

        if (!result.ok) {

          alert(
            result.error ||
            "ثبت محصول انجام نشد."
          );

          return false;
        }

        alert(
          "محصول با موفقیت ثبت شد."
        );

        location.reload();

        return false;
      }


      async function editProduct(
        id
      ) {

        const name =
          prompt(
            "نام جدید محصول:"
          );

        if (!name) {
          return;
        }

        const price =
          prompt(
            "قیمت فروش به تومان:"
          );

        if (!price) {
          return;
        }

        const stock =
          prompt(
            "موجودی اعلام‌شده توسط فروشنده:"
          );

        if (stock === null) {
          return;
        }

        const supplierId =
          prompt(
            "شناسه فروشنده:"
          );

        if (!supplierId) {
          return;
        }

        const response =
          await adminFetch(
            "/api/admin/products",
            {
              method:"PUT",

              body:
                JSON.stringify({

                  id:
                    Number(id),

                  name:
                    name,

                  description:
                    "",

                  category:
                    "عمومی",

                  image:
                    "",

                  price:
                    Number(price),

                  stock:
                    Number(stock),

                  supplier_id:
                    Number(
                      supplierId
                    ),

                  supplier_price:
                    0,

                  commission:
                    0,

                  active:
                    1

                })
            }
          );

        const result =
          await response.json();

        if (!result.ok) {

          alert(
            result.error ||
            "ویرایش انجام نشد."
          );

          return;
        }

        alert(
          "محصول ویرایش شد."
        );

        location.reload();
      }


      async function updateOrderStatus(
        id
      ) {

        const status =
          document
            .getElementById(
              "order-status-" +
              id
            )
            .value;

        const response =
          await adminFetch(
            "/api/admin/orders/status",
            {
              method:"PUT",

              body:
                JSON.stringify({

                  id:
                    Number(id),

                  status:
                    status,

                  supplier_status:
                    status ===
                    "ارسال شد"
                      ? "تأیید و ارسال شد"
                      : "در انتظار فروشنده",

                  shipping_status:
                    status ===
                    "ارسال شد"
                      ? "ارسال شد"
                      : status ===
                        "تحویل شد"
                        ? "تحویل شد"
                        : "در انتظار ارسال"

                })
            }
          );

        const result =
          await response.json();

        if (!result.ok) {

          alert(
            result.error ||
            "تغییر وضعیت انجام نشد."
          );

          return;
        }

        alert(
          "وضعیت سفارش ذخیره شد."
        );

        location.reload();
      }

    </script>
    `
  );
}


/* =========================================================
   LAYOUT
========================================================= */

function layout(
  title,
  content
) {
  return `
<!DOCTYPE html>
<html
  lang="fa"
  dir="rtl"
>

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
  ${escapeHTML(title)}
  |
  ${STORE_NAME}
</title>

<style>

*{
  box-sizing:border-box
}

html{
  scroll-behavior:smooth
}

body{
  margin:0;
  font-family:
    Tahoma,
    Arial,
    sans-serif;
  background:#f4f7fb;
  color:#172033;
  line-height:1.8
}

a{
  color:inherit;
  text-decoration:none
}

button,
input,
select{
  font-family:inherit
}

.container{
  width:min(
    1180px,
    calc(100% - 32px)
  );
  margin:auto
}

header{
  position:sticky;
  top:0;
  z-index:50;
  background:
    rgba(15,23,42,.96);
  border-bottom:
    1px solid
    rgba(255,255,255,.08);
  backdrop-filter:
    blur(12px)
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
  background:
    linear-gradient(
      135deg,
      #2563eb,
      #14b8a6
    );
  color:white;
  box-shadow:
    0 8px 25px
    rgba(20,184,166,.25)
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
  background:
    rgba(255,255,255,.08);
  color:white
}

main{
  min-height:70vh
}

.hero{
  width:min(
    1180px,
    calc(100% - 32px)
  );
  margin:34px auto;
  padding:48px;
  border-radius:28px;
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
  color:white;
  display:grid;
  grid-template-columns:
    1.35fr .65fr;
  gap:35px;
  align-items:center;
  box-shadow:
    0 25px 60px
    rgba(15,23,42,.18)
}

.badge,
.eyebrow{
  display:inline-block;
  color:#14b8a6;
  font-size:13px;
  font-weight:900;
  letter-spacing:.3px
}

.hero .badge{
  color:#67e8f9
}

.hero h1{
  margin:12px 0;
  font-size:
    clamp(
      32px,
      5vw,
      58px
    );
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
  background:
    rgba(255,255,255,.10);
  border:
    1px solid
    rgba(255,255,255,.14)
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

.hero-card h3{
  margin:0 0 8px;
  font-size:24px
}

.hero-card p{
  margin:0;
  font-size:14px
}

.section{
  width:min(
    1180px,
    calc(100% - 32px)
  );
  margin:70px auto
}

.section-head{
  display:flex;
  justify-content:space-between;
  align-items:end;
  gap:20px;
  margin-bottom:25px
}

.section-head h2,
.page-title h1{
  margin:4px 0 0;
  font-size:32px
}

.text-link{
  color:#2563eb;
  font-weight:800
}

.products-grid{
  display:grid;
  grid-template-columns:
    repeat(
      3,
      minmax(0,1fr)
    );
  gap:20px
}

.product-card{
  overflow:hidden;
  background:white;
  border:
    1px solid
    #e2e8f0;
  border-radius:20px;
  box-shadow:
    0 10px 30px
    rgba(15,23,42,.06);
  transition:
    transform .2s,
    box-shadow .2s
}

.product-card:hover{
  transform:
    translateY(-4px);
  box-shadow:
    0 18px 40px
    rgba(15,23,42,.12)
}

.product-image{
  height:190px;
  background:
    linear-gradient(
      135deg,
      #dbeafe,
      #ccfbf1
    );
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

.product-placeholder.large{
  font-size:100px
}

.product-body{
  padding:20px
}

.product-category{
  color:#0f766e;
  font-size:12px;
  font-weight:900
}

.product-body h3{
  margin:6px 0;
  font-size:19px
}

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

.product-bottom strong{
  color:#1e3a8a;
  font-size:18px
}

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

.btn:hover{
  transform:
    translateY(-1px)
}

.btn.primary{
  background:#2563eb;
  color:white
}

.btn.secondary{
  background:#1e3a8a;
  color:white
}

.btn.orange{
  background:#f97316;
  color:white
}

.btn.disabled{
  background:#94a3b8;
  color:white;
  cursor:not-allowed
}

.btn.small{
  padding:8px 11px;
  font-size:12px
}

.features{
  width:min(
    1180px,
    calc(100% - 32px)
  );
  margin:70px auto;
  display:grid;
  grid-template-columns:
    repeat(
      4,
      minmax(0,1fr)
    );
  gap:16px
}

.feature{
  background:white;
  padding:25px;
  border:
    1px solid
    #e2e8f0;
  border-radius:20px
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

.feature h3{
  margin:13px 0 5px
}

.feature p{
  margin:0;
  color:#64748b;
  font-size:14px
}

.promo{
  width:min(
    1180px,
    calc(100% - 32px)
  );
  margin:70px auto;
  padding:35px;
  border-radius:25px;
  background:
    linear-gradient(
      135deg,
      #0f766e,
      #0f172a
    );
  color:white;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:20px
}

.promo h2{
  margin:4px 0;
  font-size:30px
}

.promo p{
  color:#ccfbf1
}

.page-title{
  width:min(
    1180px,
    calc(100% - 32px)
  );
  margin:55px auto 30px
}

.page-title p{
  color:#64748b
}

.account-wrap{
  width:min(
    1000px,
    calc(100% - 32px)
  );
  margin:50px auto;
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:22px
}

.account-card{
  background:white;
  padding:30px;
  border:
    1px solid
    #e2e8f0;
  border-radius:22px;
  box-shadow:
    0 12px 35px
    rgba(15,23,42,.06)
}

.account-card h1{
  margin-bottom:5px
}

.account-card>p{
  color:#64748b
}

form{
  display:grid;
  gap:9px;
  margin-top:20px
}

label{
  font-size:13px;
  font-weight:800
}

input,
select{
  width:100%;
  padding:13px 14px;
  border:
    1px solid
    #cbd5e1;
  border-radius:12px;
  outline:none;
  background:white
}

input:focus,
select:focus{
  border-color:#2563eb;
  box-shadow:
    0 0 0 3px
    rgba(37,99,235,.10)
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
  width:min(
    900px,
    calc(100% - 32px)
  );
  margin:30px auto 70px;
  background:white;
  padding:30px;
  border-radius:22px;
  border:
    1px solid
    #e2e8f0
}

.cart-total{
  margin-top:25px;
  padding-top:20px;
  border-top:
    1px solid
    #e2e8f0;
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
  border:
    1px dashed
    #cbd5e1;
  border-radius:18px;
  color:#64748b
}

.admin-grid{
  width:min(
    1180px,
    calc(100% - 32px)
  );
  margin:30px auto 70px;
  display:grid;
  grid-template-columns:
    repeat(
      3,
      minmax(0,1fr)
    );
  gap:18px
}

.admin-card{
  padding:25px;
  background:white;
  border:
    1px solid
    #e2e8f0;
  border-radius:18px
}

.admin-card strong,
.admin-card span{
  display:block
}

.admin-card span{
  color:#64748b;
  margin-top:5px;
  font-size:13px
}

.product-detail{
  width:min(
    1100px,
    calc(100% - 32px)
  );
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
  background:
    linear-gradient(
      135deg,
      #dbeafe,
      #ccfbf1
    );
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
  border:
    1px solid
    #e2e8f0
}

.detail-content h1{
  font-size:34px;
  margin:10px 0
}

.detail-description{
  color:#64748b
}

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
  width:min(
    1180px,
    calc(100% - 32px)
  );
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

  .hero{
    grid-template-columns:1fr;
    gap:30px;
    padding:30px 24px
  }

  .products-grid{
    grid-template-columns:
      repeat(
        2,
        minmax(0,1fr)
      )
  }

  .features{
    grid-template-columns:
      repeat(
        2,
        minmax(0,1fr)
      )
  }

  .account-wrap{
    grid-template-columns:1fr
  }

  .admin-grid{
    grid-template-columns:1fr
  }

  .product-detail{
    grid-template-columns:1fr
  }
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

  nav a{
    white-space:nowrap
  }

  .hero h1{
    font-size:34px
  }

  .products-grid,
  .features{
    grid-template-columns:1fr
  }

  .section-head,
  .promo{
    align-items:flex-start;
    flex-direction:column
  }

  .promo{
    padding:28px 22px
  }

  .detail-image{
    height:300px
  }

  .detail-content h1{
    font-size:28px
  }
}

</style>

</head>

<body>

<header>

  <div class="container nav">

    <a
      class="brand"
      href="/"
    >

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

      <a href="/supplier">
        پنل تأمین‌کننده
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
        ${STORE_EN}
        —
        فروشگاه دیجیتال
      </div>

    </div>

    <div class="footer-note">
      ©
      ${new Date().getFullYear()}
      ${STORE_NAME}
    </div>

  </div>

</footer>

<script>

function getCart(){

  try{

    return JSON.parse(
      localStorage.getItem(
        "digimarixo_cart"
      ) || "[]"
    );

  }catch{

    return [];

  }

}


function saveCart(
  cart
){

  localStorage.setItem(
    "digimarixo_cart",
    JSON.stringify(cart)
  );

}


function addToCart(
  id,
  name,
  price
){

  const cart =
    getCart();

  const existing =
    cart.find(
      item =>
        Number(item.id) ===
        Number(id)
    );

  if(existing){

    existing.quantity += 1;

  }else{

    cart.push({

      id:
        Number(id),

      name:
        name,

      price:
        Number(price) || 0,

      quantity:
        1

    });

  }

  saveCart(
    cart
  );

  renderCart();

  alert(
    "محصول به سبد خرید اضافه شد."
  );

}


function formatNumber(
  value
){

  const number =
    Number(value);

  if(
    !Number.isFinite(number)
  ){
    return "۰";
  }

  return number.toLocaleString(
    "fa-IR"
  );

}


function formatClientPrice(
  value
){

  return (
    Number(value || 0)
      .toLocaleString(
        "fa-IR"
      ) +
    " تومان"
  );

}


function renderCart(){

  const box =
    document.getElementById(
      "cart-items"
    );

  const totalBox =
    document.getElementById(
      "cart-total"
    );

  if(
    !box ||
    !totalBox
  ){
    return;
  }

  const cart =
    getCart();

  if(!cart.length){

    box.innerHTML =
      '<div class="empty">' +
      'سبد خرید شما خالی است.' +
      '</div>';

    totalBox.textContent =
      "۰ تومان";

    return;
  }

  let total = 0;

  const rows = [];

  cart.forEach(
    function(
      item,
      index
    ){

      const price =
        Number(
          item.price
        );

      const quantity =
        Number(
          item.quantity
        );

      const safePrice =
        Number.isFinite(
          price
        )
          ? price
          : 0;

      const safeQuantity =
        Number.isFinite(
          quantity
        ) &&
        quantity > 0
          ? quantity
          : 1;

      const line =
        safePrice *
        safeQuantity;

      total +=
        line;

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
        escapeClientHTML(
          item.name
        ) +
        '</strong>' +

        '<div style="' +
        'color:#64748b;' +
        'font-size:13px' +
        '">' +

        'تعداد: ' +

        formatNumber(
          safeQuantity
        ) +

        '</div>' +

        '</div>' +

        '<div style="' +
        'text-align:left' +
        '">' +

        '<strong>' +

        formatNumber(
          line
        ) +

        ' تومان' +

        '</strong>' +

        '<br>' +

        '<button ' +
        'class="btn small orange" ' +
        'onclick="removeCartItem(' +
        index +
        ')">' +

        'حذف' +

        '</button>' +

        '</div>' +

        '</div>'
      );

    }
  );

  box.innerHTML =
    rows.join("");

  totalBox.textContent =
    formatNumber(total) +
    " تومان";

}


function removeCartItem(
  index
){

  const cart =
    getCart();

  cart.splice(
    index,
    1
  );

  saveCart(
    cart
  );

  renderCart();

}


async function checkoutCart(){

  const cart =
    getCart();

  if(!cart.length){

    alert(
      "سبد خرید شما خالی است."
    );

    return;
  }

  const customerName =
    prompt(
      "نام و نام خانوادگی:"
    );

  if(!customerName){
    return;
  }

  const customerPhone =
    prompt(
      "شماره تماس:"
    );

  if(!customerPhone){
    return;
  }

  const customerEmail =
    prompt(
      "ایمیل:"
    );

  const address =
    prompt(
      "آدرس کامل:"
    );

  if(!address){
    return;
  }

  try{

    const response =
      await fetch(
        "/api/orders",
        {
          method:"POST",

          headers:{
            "content-type":
              "application/json"
          },

          body:
            JSON.stringify({

              customer_name:
                customerName,

              customer_phone:
                customerPhone,

              customer_email:
                customerEmail ||
                "",

              address:
                address,

              items:
                cart.map(
                  item => ({

                    product_id:
                      Number(
                        item.id
                      ),

                    quantity:
                      Number(
                        item.quantity ||
                        1
                      )

                  })
                )

            })
        }
      );

    const result =
      await response.json();

    if(!result.ok){

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
      "سفارش با موفقیت ثبت شد.\n" +
      "شماره سفارش: " +
      result.order_id
    );

  }catch(error){

    alert(
      "خطا در ثبت سفارش."
    );

    console.error(
      error
    );

  }

}


function escapeClientHTML(
  value
){

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

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

function html(
  content,
  status = 200
){

  return new Response(
    content,
    {
      status,

      headers:{
        "content-type":
          "text/html; charset=UTF-8",

        "cache-control":
          "no-store"
      }
    }
  );

}


function json(
  data,
  status = 200
){

  return new Response(
    JSON.stringify(data),
    {
      status,

      headers:{
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

function normalizePrice(
  value
){

  const normalized =
    String(
      value ?? ""
    )
      .trim()
      .replace(
        /[۰-۹]/g,
        d =>
          "۰۱۲۳۴۵۶۷۸۹"
            .indexOf(d)
      )
      .replace(
        /[٠-٩]/g,
        d =>
          "٠١٢٣٤٥٦٧٨٩"
            .indexOf(d)
      )
      .replace(
        /[,\s٬،]/g,
        ""
      );

  const number =
    Number(
      normalized
    );

  if(
    !Number.isFinite(
      number
    )
  ){
    return 0;
  }

  return Math.max(
    0,
    Math.round(
      number
    )
  );

}


function formatPrice(
  value
){

  return (
    normalizePrice(
      value
    )
      .toLocaleString(
        "fa-IR"
      ) +
    " تومان"
  );

}


function escapeHTML(
  value
){

  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );

}


function escapeAttr(
  value
){

  return escapeHTML(
    value
  );

}


function escapeJS(
  value
){

  return String(
    value ?? ""
  )
    .replaceAll(
      "\\",
      "\\\\"
    )
    .replaceAll(
      "'",
      "\\'"
    )
    .replaceAll(
      "\n",
      "\\n"
    )
    .replaceAll(
      "\r",
      "\\r"
    );

}


function safeError(
  error
){

  if(!error){
    return "خطای ناشناخته";
  }

  if(error.message){
    return String(
      error.message
    );
  }

  return String(
    error
  );

      }
