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

      /* =========================
         HEALTH
      ========================= */

      if (path === "/health") {
        return json({
          ok: true,
          store: STORE_EN,
          database: Boolean(env.DB),
          time: new Date().toISOString()
        });
      }

      /* =========================
         PRODUCTS API
      ========================= */

      if (
        path === "/api/products" &&
        method === "GET"
      ) {
        return json(await getProducts(env));
      }

      if (
        path.startsWith("/api/products/") &&
        method === "GET"
      ) {
        const id = path.split("/").pop();
        return json(await getProduct(env, id));
      }

      /* =========================
         SUPPLIERS API
      ========================= */

      if (
        path === "/api/suppliers" &&
        method === "GET"
      ) {
        if (!isAdmin(request, env)) {
          return json(
            {
              ok: false,
              error: "دسترسی غیرمجاز"
            },
            401
          );
        }

        return json(await getSuppliers(env));
      }

      if (
        path === "/api/admin/suppliers" &&
        method === "POST"
      ) {
        if (!isAdmin(request, env)) {
          return json(
            {
              ok: false,
              error: "دسترسی غیرمجاز"
            },
            401
          );
        }

        return await createSupplier(request, env);
      }

      /* =========================
         ADMIN PRODUCTS
      ========================= */

      if (
        path === "/api/admin/products" &&
        method === "POST"
      ) {
        if (!isAdmin(request, env)) {
          return json(
            {
              ok: false,
              error: "دسترسی غیرمجاز"
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
              error: "دسترسی غیرمجاز"
            },
            401
          );
        }

        return await updateProduct(request, env);
      }

      /* =========================
         ADMIN ORDERS
      ========================= */

      if (
        path === "/api/orders" &&
        method === "GET"
      ) {
        if (!isAdmin(request, env)) {
          return json(
            {
              ok: false,
              error: "دسترسی غیرمجاز"
            },
            401
          );
        }

        return json(await getOrders(env));
      }

      if (
        path === "/api/admin/orders/status" &&
        method === "PUT"
      ) {
        if (!isAdmin(request, env)) {
          return json(
            {
              ok: false,
              error: "دسترسی غیرمجاز"
            },
            401
          );
        }

        return await updateOrderStatus(
          request,
          env
        );
      }

      /* =========================
         CREATE ORDER
      ========================= */

      if (
        path === "/api/orders" &&
        method === "POST"
      ) {
        return await createOrder(
          request,
          env
        );
      }

      /* =========================
         ACCOUNT
      ========================= */

      if (path === "/account") {
        return html(accountPage());
      }

      /* =========================
         ADMIN
      ========================= */

      if (path === "/admin") {
        return html(
          await adminPage(
            request,
            env
          )
        );
      }

      /* =========================
         PRODUCTS
      ========================= */

      if (path === "/products") {
        const productId =
          url.searchParams.get("id");

        if (productId) {
          const result =
            await getProduct(
              env,
              productId
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
                    محصول موردنظر در فروشگاه وجود ندارد.
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

      /* =========================
         CART
      ========================= */

      if (path === "/cart") {
        return html(cartPage());
      }

      /* =========================
         HOME
      ========================= */

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
              "text/plain; charset=UTF-8"
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
      website TEXT DEFAULT '',
      shipping_method TEXT DEFAULT '',
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await ensureProductColumns(env);

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

  await ensureOrderColumns(env);

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

  await ensureOrderItemColumns(env);

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

  await seedCategories(env);
}


/* =========================================================
   PRODUCT MIGRATION
========================================================= */

async function ensureProductColumns(env) {
  const result =
    await env.DB
      .prepare(
        `PRAGMA table_info(products)`
      )
      .all();

  const names =
    new Set(
      (result.results || [])
        .map(row => row.name)
    );

  const columns = [
    [
      "category",
      `ALTER TABLE products
       ADD COLUMN category TEXT DEFAULT ''`
    ],
    [
      "stock",
      `ALTER TABLE products
       ADD COLUMN stock INTEGER DEFAULT 0`
    ],
    [
      "image",
      `ALTER TABLE products
       ADD COLUMN image TEXT DEFAULT ''`
    ],
    [
      "active",
      `ALTER TABLE products
       ADD COLUMN active INTEGER DEFAULT 1`
    ],
    [
      "supplier_id",
      `ALTER TABLE products
       ADD COLUMN supplier_id INTEGER DEFAULT NULL`
    ],
    [
      "supplier_price",
      `ALTER TABLE products
       ADD COLUMN supplier_price INTEGER DEFAULT 0`
    ],
    [
      "commission",
      `ALTER TABLE products
       ADD COLUMN commission INTEGER DEFAULT 0`
    ],
    [
      "supplier_sku",
      `ALTER TABLE products
       ADD COLUMN supplier_sku TEXT DEFAULT ''`
    ],
    [
      "delivery_days",
      `ALTER TABLE products
       ADD COLUMN delivery_days TEXT DEFAULT ''`
    ]
  ];

  for (const [name, sql] of columns) {
    if (!names.has(name)) {
      await env.DB.prepare(sql).run();
    }
  }
}


/* =========================================================
   ORDER MIGRATION
========================================================= */

async function ensureOrderColumns(env) {
  const result =
    await env.DB
      .prepare(
        `PRAGMA table_info(orders)`
      )
      .all();

  const names =
    new Set(
      (result.results || [])
        .map(row => row.name)
    );

  const columns = [
    [
      "supplier_id",
      `ALTER TABLE orders
       ADD COLUMN supplier_id INTEGER DEFAULT NULL`
    ],
    [
      "supplier_status",
      `ALTER TABLE orders
       ADD COLUMN supplier_status TEXT DEFAULT 'جدید'`
    ],
    [
      "shipping_status",
      `ALTER TABLE orders
       ADD COLUMN shipping_status TEXT DEFAULT 'در انتظار ارسال'`
    ]
  ];

  for (const [name, sql] of columns) {
    if (!names.has(name)) {
      await env.DB.prepare(sql).run();
    }
  }
}


/* =========================================================
   ORDER ITEM MIGRATION
========================================================= */

async function ensureOrderItemColumns(env) {
  const result =
    await env.DB
      .prepare(
        `PRAGMA table_info(order_items)`
      )
      .all();

  const names =
    new Set(
      (result.results || [])
        .map(row => row.name)
    );

  const columns = [
    [
      "supplier_id",
      `ALTER TABLE order_items
       ADD COLUMN supplier_id INTEGER DEFAULT NULL`
    ],
    [
      "supplier_price",
      `ALTER TABLE order_items
       ADD COLUMN supplier_price INTEGER DEFAULT 0`
    ],
    [
      "commission",
      `ALTER TABLE order_items
       ADD COLUMN commission INTEGER DEFAULT 0`
    ]
  ];

  for (const [name, sql] of columns) {
    if (!names.has(name)) {
      await env.DB.prepare(sql).run();
    }
  }
}


/* =========================================================
   CATEGORY SEED
========================================================= */

async function seedCategories(env) {
  const categories = [
    "لوازم جانبی موبایل",
    "کابل و شارژر",
    "لوازم خودرو",
    "لوازم کامپیوتر",
    "لوازم دیجیتال",
    "خانه و کاربردی",
    "سایر"
  ];

  for (const category of categories) {
    await env.DB
      .prepare(`
        INSERT OR IGNORE INTO categories
        (name)
        VALUES (?)
      `)
      .bind(category)
      .run();
  }
}


/* =========================================================
   ADMIN AUTH
========================================================= */

function isAdmin(
  request,
  env
) {
  const configured =
    String(
      env.ADMIN_PASSWORD || ""
    ).trim();

  if (!configured) {
    return false;
  }

  const supplied =
    request.headers.get(
      "X-Admin-Password"
    ) || "";

  return supplied === configured;
}


/* =========================================================
   PRODUCTS
========================================================= */

async function getProducts(env) {
  const result =
    await env.DB.prepare(`
      SELECT
        p.id,
        p.name,
        p.description,
        p.price,
        p.image,
        p.category,
        p.stock,
        p.active,
        p.supplier_id,
        p.supplier_price,
        p.commission,
        p.supplier_sku,
        p.delivery_days,
        p.created_at,

        s.name AS supplier_name,
        s.direct_shipping
          AS supplier_direct_shipping

      FROM products p

      LEFT JOIN suppliers s
        ON s.id = p.supplier_id

      WHERE p.active = 1

      ORDER BY p.id DESC
    `).all();

  const products =
    (result.results || [])
      .map(product => ({
        ...product,
        price:
          normalizePrice(
            product.price
          ),
        supplier_price:
          normalizePrice(
            product.supplier_price
          ),
        commission:
          normalizePrice(
            product.commission
          )
      }));

  return {
    ok: true,
    products
  };
}


/* =========================================================
   SINGLE PRODUCT
========================================================= */

async function getProduct(
  env,
  id
) {
  const product =
    await env.DB
      .prepare(`
        SELECT
          p.id,
          p.name,
          p.description,
          p.price,
          p.image,
          p.category,
          p.stock,
          p.active,
          p.supplier_id,
          p.supplier_price,
          p.commission,
          p.supplier_sku,
          p.delivery_days,
          p.created_at,

          s.name AS supplier_name,
          s.phone AS supplier_phone,
          s.email AS supplier_email,
          s.direct_shipping
            AS supplier_direct_shipping

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
    await env.DB
      .prepare(`
        SELECT
          id,
          name,
          phone,
          email,
          address,
          website,
          shipping_method,
          direct_shipping,
          active,
          created_at
        FROM suppliers
        ORDER BY id DESC
      `)
      .all();

  return {
    ok: true,
    suppliers:
      result.results || []
  };
}


/* =========================================================
   CREATE SUPPLIER
========================================================= */

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
        error: "اطلاعات نامعتبر است"
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

  const website =
    String(
      data.website || ""
    ).trim();

  const shippingMethod =
    String(
      data.shipping_method || ""
    ).trim();

  const directShipping =
    Number(
      data.direct_shipping
    ) === 1
      ? 1
      : 0;

  if (!name) {
    return json(
      {
        ok: false,
        error: "نام فروشنده الزامی است"
      },
      400
    );
  }

  const result =
    await env.DB
      .prepare(`
        INSERT INTO suppliers
        (
          name,
          phone,
          email,
          address,
          website,
          shipping_method,
          direct_shipping,
          active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `)
      .bind(
        name,
        phone,
        email,
        address,
        website,
        shippingMethod,
        directShipping
      )
      .run();

  return json({
    ok: true,
    supplier_id:
      result.meta.last_row_id
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
        error: "اطلاعات محصول نامعتبر است"
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
      data.category || "سایر"
    ).trim();

  const image =
    String(
      data.image || ""
    ).trim();

  const supplierSku =
    String(
      data.supplier_sku || ""
    ).trim();

  const deliveryDays =
    String(
      data.delivery_days || ""
    ).trim();

  const price =
    normalizePrice(
      data.price
    );

  const supplierPrice =
    normalizePrice(
      data.supplier_price
    );

  const commission =
    normalizePrice(
      data.commission
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
    data.supplier_id
      ? Number(data.supplier_id)
      : null;

  if (!name) {
    return json(
      {
        ok: false,
        error: "نام محصول الزامی است"
      },
      400
    );
  }

  if (price <= 0) {
    return json(
      {
        ok: false,
        error:
          "قیمت فروش باید بیشتر از صفر باشد"
      },
      400
    );
  }

  if (
    supplierId &&
    !Number.isFinite(supplierId)
  ) {
    return json(
      {
        ok: false,
        error:
          "شناسه فروشنده نامعتبر است"
      },
      400
    );
  }

  if (supplierId) {
    const supplier =
      await env.DB
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
      return json(
        {
          ok: false,
          error:
            "فروشنده فعال پیدا نشد"
        },
        400
      );
    }
  }

  const result =
    await env.DB
      .prepare(`
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
          commission,
          supplier_sku,
          delivery_days
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      `)
      .bind(
        name,
        description,
        price,
        image,
        category,
        stock,
        supplierId,
        supplierPrice,
        commission,
        supplierSku,
        deliveryDays
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
        error: "اطلاعات نامعتبر است"
      },
      400
    );
  }

  const id =
    Number(data.id);

  if (!Number.isFinite(id)) {
    return json(
      {
        ok: false,
        error: "شناسه محصول نامعتبر است"
      },
      400
    );
  }

  const current =
    await env.DB
      .prepare(`
        SELECT *
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
        error: "محصول پیدا نشد"
      },
      404
    );
  }

  const name =
    String(
      data.name ??
      current.name ??
      ""
    ).trim();

  const description =
    String(
      data.description ??
      current.description ??
      ""
    ).trim();

  const category =
    String(
      data.category ??
      current.category ??
      "سایر"
    ).trim();

  const image =
    String(
      data.image ??
      current.image ??
      ""
    ).trim();

  const supplierSku =
    String(
      data.supplier_sku ??
      current.supplier_sku ??
      ""
    ).trim();

  const deliveryDays =
    String(
      data.delivery_days ??
      current.delivery_days ??
      ""
    ).trim();

  const price =
    normalizePrice(
      data.price ??
      current.price
    );

  const supplierPrice =
    normalizePrice(
      data.supplier_price ??
      current.supplier_price
    );

  const commission =
    normalizePrice(
      data.commission ??
      current.commission
    );

  const stock =
    Math.max(
      0,
      Math.floor(
        Number(
          data.stock ??
          current.stock ??
          0
        )
      )
    );

  let supplierId =
    data.supplier_id !== undefined
      ? (
          data.supplier_id === null ||
          data.supplier_id === ""
            ? null
            : Number(
                data.supplier_id
              )
        )
      : (
          current.supplier_id
            ? Number(
                current.supplier_id
              )
            : null
        );

  const active =
    data.active !== undefined
      ? (
          Number(data.active) === 1
            ? 1
            : 0
        )
      : Number(
          current.active || 0
        );

  if (!name) {
    return json(
      {
        ok: false,
        error: "نام محصول الزامی است"
      },
      400
    );
  }

  if (
    supplierId !== null &&
    !Number.isFinite(
      supplierId
    )
  ) {
    return json(
      {
        ok: false,
        error:
          "شناسه فروشنده نامعتبر است"
      },
      400
    );
  }

  if (supplierId !== null) {
    const supplier =
      await env.DB
        .prepare(`
          SELECT id
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
            "فروشنده پیدا نشد"
        },
        400
      );
    }
  }

  await env.DB
    .prepare(`
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
        commission = ?,
        supplier_sku = ?,
        delivery_days = ?
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
      supplierSku,
      deliveryDays,
      id
    )
    .run();

  return json({
    ok: true,
    product_id: id
  });
}


/* =========================================================
   CREATE ORDER
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
          "اطلاعات سفارش نامعتبر است"
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
        error: "نام الزامی است"
      },
      400
    );
  }

  if (!customerPhone) {
    return json(
      {
        ok: false,
        error:
          "شماره تماس الزامی است"
      },
      400
    );
  }

  if (!address) {
    return json(
      {
        ok: false,
        error: "آدرس الزامی است"
      },
      400
    );
  }

  if (!items.length) {
    return json(
      {
        ok: false,
        error:
          "سبد خرید خالی است"
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
      Math.floor(
        Number(
          item.quantity || 1
        )
      );

    if (
      !Number.isFinite(
        productId
      )
    ) {
      return json(
        {
          ok: false,
          error:
            "شناسه محصول نامعتبر است"
        },
        400
      );
    }

    if (
      !Number.isFinite(
        quantity
      ) ||
      quantity < 1
    ) {
      return json(
        {
          ok: false,
          error:
            "تعداد محصول نامعتبر است"
        },
        400
      );
    }

    const product =
      await env.DB
        .prepare(`
          SELECT
            p.id,
            p.name,
            p.price,
            p.stock,
            p.active,
            p.supplier_id,
            p.supplier_price,
            p.commission,

            s.name
              AS supplier_name,

            s.direct_shipping
              AS supplier_direct_shipping,

            s.active
              AS supplier_active

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
            "یکی از محصولات موجود نیست"
        },
        400
      );
    }

    if (
      Number(product.stock) <
      quantity
    ) {
      return json(
        {
          ok: false,
          error:
            "موجودی محصول کافی نیست"
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
            "فروشنده این محصول هنوز ارسال مستقیم به مشتری را تأیید نکرده است."
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

  /* =========================
     CREATE MAIN ORDER
  ========================= */

  const firstSupplier =
    supplierGroups.size === 1
      ? Array.from(
          supplierGroups.keys()
        )[0]
      : null;

  const order =
    await env.DB
      .prepare(`
        INSERT INTO orders
        (
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        customerName,
        customerEmail,
        customerPhone,
        address,
        total,
        "در حال بررسی",
        firstSupplier,
        "در انتظار فروشنده",
        "در انتظار ارسال"
      )
      .run();

  const orderId =
    order.meta.last_row_id;

  /* =========================
     ORDER ITEMS
  ========================= */

  const statements = [];

  for (
    const item of orderItems
  ) {
    statements.push(
      env.DB
        .prepare(`
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
    );

    statements.push(
      env.DB
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
    );
  }

  for (
    const supplierId
    of supplierGroups.keys()
  ) {
    statements.push(
      env.DB
        .prepare(`
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
    );
  }

  if (statements.length) {
    await env.DB.batch(
      statements
    );
  }

  return json({
    ok: true,
    order_id: orderId,
    total,
    suppliers:
      supplierGroups.size,
    status:
      "در حال بررسی"
  });
}


/* =========================================================
   ORDERS
========================================================= */

async function getOrders(env) {
  const result =
    await env.DB
      .prepare(`
        SELECT
          o.id,
          o.customer_name,
          o.customer_email,
          o.customer_phone,
          o.address,
          o.total,
          o.status,
          o.supplier_status,
          o.shipping_status,
          o.created_at,
          s.name AS supplier_name
        FROM orders o
        LEFT JOIN suppliers s
          ON s.id = o.supplier_id
        ORDER BY o.id DESC
      `)
      .all();

  return {
    ok: true,
    orders:
      result.results || []
  };
}


/* =========================================================
   UPDATE ORDER STATUS
========================================================= */

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
          "اطلاعات نامعتبر است"
      },
      400
    );
  }

  const orderId =
    Number(data.order_id);

  const status =
    String(
      data.status || ""
    ).trim();

  const supplierStatus =
    String(
      data.supplier_status || ""
    ).trim();

  const shippingStatus =
    String(
      data.shipping_status || ""
    ).trim();

  if (
    !Number.isFinite(
      orderId
    )
  ) {
    return json(
      {
        ok: false,
        error:
          "شناسه سفارش نامعتبر است"
      },
      400
    );
  }

  const order =
    await env.DB
      .prepare(`
        SELECT id
        FROM orders
        WHERE id = ?
        LIMIT 1
      `)
      .bind(orderId)
      .first();

  if (!order) {
    return json(
      {
        ok: false,
        error:
          "سفارش پیدا نشد"
      },
      404
    );
  }

  await env.DB
    .prepare(`
      UPDATE orders
      SET
        status =
          CASE
            WHEN ? = '' THEN status
            ELSE ?
          END,

        supplier_status =
          CASE
            WHEN ? = '' THEN supplier_status
            ELSE ?
          END,

        shipping_status =
          CASE
            WHEN ? = '' THEN shipping_status
            ELSE ?
          END
      WHERE id = ?
    `)
    .bind(
      status,
      status,
      supplierStatus,
      supplierStatus,
      shippingStatus,
      shippingStatus,
      orderId
    )
    .run();

  return json({
    ok: true,
    order_id: orderId
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

  const productCards =
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
        ${productCards}
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
          رابط کاربری ساده برای خرید راحت‌تر.
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
          محصولات را بررسی کنید و
          سفارش خود را مدیریت کنید.
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
                موجودی:
                ${formatNumber(stock)}
              `
              : `
                ناموجود
              `
          }

        </div>

        ${
          product.delivery_days
            ? `
              <p
                style="
                  color:#64748b;
                  font-size:13px;
                  margin:8px 0 15px;
                "
              >
                زمان ارسال تقریبی:
                ${escapeHTML(
                  product.delivery_days
                )}
              </p>
            `
            : ""
        }

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
                  margin-top:12px;
                "
              >
                این محصول هنوز برای
                فروش واقعی فعال نشده است.
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
          حساب کاربری
        </h1>

        <p>
          مدیریت حساب و سفارش‌های
          دیجی‌ماریکسو
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
            onclick="alert(
              'بخش ورود در حال آماده‌سازی است.'
            )"
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
            onclick="alert(
              'ثبت‌نام در حال آماده‌سازی است.'
            )"
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
   ADMIN PAGE
========================================================= */

async function adminPage(
  request,
  env
) {
  const products =
    await env.DB
      .prepare(`
        SELECT COUNT(*) AS count
        FROM products
      `)
      .first();

  const activeProducts =
    await env.DB
      .prepare(`
        SELECT COUNT(*) AS count
        FROM products
        WHERE active = 1
      `)
      .first();

  const suppliers =
    await env.DB
      .prepare(`
        SELECT COUNT(*) AS count
        FROM suppliers
      `)
      .first();

  const activeSuppliers =
    await env.DB
      .prepare(`
        SELECT COUNT(*) AS count
        FROM suppliers
        WHERE active = 1
      `)
      .first();

  const orders =
    await env.DB
      .prepare(`
        SELECT COUNT(*) AS count
        FROM orders
      `)
      .first();

  const authorized =
    isAdmin(
      request,
      env
    );

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
            products?.count || 0
          )}
          محصول ثبت شده
        </span>

      </div>

      <div class="admin-card">

        <strong>
          محصولات فعال
        </strong>

        <span>
          ${formatNumber(
            activeProducts?.count || 0
          )}
          محصول فعال
        </span>

      </div>

      <div class="admin-card">

        <strong>
          فروشندگان
        </strong>

        <span>
          ${formatNumber(
            suppliers?.count || 0
          )}
          فروشنده ثبت شده
        </span>

      </div>

      <div class="admin-card">

        <strong>
          فروشندگان فعال
        </strong>

        <span>
          ${formatNumber(
            activeSuppliers?.count || 0
          )}
          فروشنده فعال
        </span>

      </div>

      <div class="admin-card">

        <strong>
          سفارش‌ها
        </strong>

        <span>
          ${formatNumber(
            orders?.count || 0
          )}
          سفارش ثبت شده
        </span>

      </div>

      <div class="admin-card">

        <strong>
          مدل فروش
        </strong>

        <span>
          ارسال کالا توسط تأمین‌کننده انجام می‌شود.
        </span>

      </div>

    </section>

    ${
      authorized
        ? adminManagementHTML()
        : `
          <section class="cart-box">

            <h2>
              ورود مدیریت
            </h2>

            <p
              style="
                color:#64748b;
                font-size:14px;
              "
            >
              برای مدیریت محصولات و فروشندگان،
              رمز مدیریت Cloudflare را وارد کنید.
            </p>

            <input
              id="admin-password"
              type="password"
              placeholder="رمز مدیریت"
            >

            <button
              class="btn primary"
              style="margin-top:12px;"
              onclick="adminLogin()"
            >
              ورود به مدیریت
            </button>

          </section>
        `
    }
    `
  );
}


/* =========================================================
   ADMIN MANAGEMENT HTML
========================================================= */

function adminManagementHTML() {
  return `
  <section
    class="cart-box"
    style="margin-top:20px;"
  >

    <h2>
      ثبت فروشنده
    </h2>

    <div
      style="
        display:grid;
        gap:10px;
        margin-top:15px;
      "
    >

      <input
        id="supplier-name"
        placeholder="نام فروشنده / تأمین‌کننده"
      >

      <input
        id="supplier-phone"
        placeholder="شماره تماس"
      >

      <input
        id="supplier-email"
        placeholder="ایمیل"
      >

      <input
        id="supplier-website"
        placeholder="وب‌سایت"
      >

      <input
        id="supplier-address"
        placeholder="آدرس"
      >

      <input
        id="supplier-shipping"
        placeholder="روش ارسال"
      >

      <label
        style="
          display:flex;
          gap:8px;
          align-items:center;
        "
      >
        <input
          id="supplier-direct"
          type="checkbox"
          style="width:auto;"
        >
        ارسال مستقیم به مشتری را تأیید کرده است
      </label>

      <button
        class="btn orange"
        onclick="createSupplierAdmin()"
      >
        ثبت فروشنده
      </button>

    </div>

  </section>


  <section
    class="cart-box"
    style="margin-top:20px;"
  >

    <h2>
      ثبت محصول
    </h2>

    <div
      style="
        display:grid;
        gap:10px;
        margin-top:15px;
      "
    >

      <input
        id="product-name"
        placeholder="نام محصول"
      >

      <input
        id="product-category"
        placeholder="دسته‌بندی"
      >

      <input
        id="product-description"
        placeholder="توضیحات محصول"
      >

      <input
        id="product-image"
        placeholder="لینک تصویر محصول"
      >

      <input
        id="product-price"
        type="number"
        placeholder="قیمت فروش به مشتری به تومان"
      >

      <input
        id="product-supplier-price"
        type="number"
        placeholder="قیمت خرید از تأمین‌کننده به تومان"
      >

      <input
        id="product-commission"
        type="number"
        placeholder="سود/کمیسیون به تومان"
      >

      <input
        id="product-stock"
        type="number"
        placeholder="موجودی"
        value="0"
      >

      <input
        id="product-supplier-id"
        type="number"
        placeholder="شناسه فروشنده"
      >

      <input
        id="product-sku"
        placeholder="SKU / کد محصول فروشنده"
      >

      <input
        id="product-delivery"
        placeholder="زمان ارسال تقریبی"
      >

      <button
        class="btn orange"
        onclick="createProductAdmin()"
      >
        ثبت محصول
      </button>

    </div>

  </section>


  <section
    class="cart-box"
    style="margin-top:20px;"
  >

    <h2>
      اطلاعات مدیریت
    </h2>

    <p
      style="
        color:#64748b;
        font-size:14px;
      "
    >
      بعد از ثبت فروشنده، شناسه فروشنده در پاسخ
      ثبت نمایش داده می‌شود و می‌توانی همان شناسه
      را هنگام ثبت محصول وارد کنی.
    </p>

    <button
      class="btn secondary"
      onclick="loadAdminData()"
    >
      نمایش محصولات، فروشندگان و سفارش‌ها
    </button>

    <div
      id="admin-data"
      style="margin-top:20px;"
    ></div>

  </section>
  `;
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
      background:
        rgba(15, 23, 42, .96);
      border-bottom:
        1px solid
        rgba(255,255,255,.08);
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
      background:
        rgba(255,255,255,.08);
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
        1px solid
        rgba(255,255,255,.14);
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
        — فروشگاه دیجیتال
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


  function addToCart(
    id,
    name,
    price
  ) {

    const cart =
      getCart();

    const existing =
      cart.find(
        item =>
          Number(item.id) ===
          Number(id)
      );

    if (existing) {
      existing.quantity += 1;
    } else {
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

    saveCart(cart);

    renderCart();

    alert(
      "محصول به سبد خرید اضافه شد."
    );
  }


  function formatNumber(value) {

    const number =
      Number(value);

    if (
      !Number.isFinite(
        number
      )
    ) {
      return "۰";
    }

    return number.toLocaleString(
      "fa-IR"
    );
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

    if (
      !box ||
      !totalBox
    ) {
      return;
    }

    const cart =
      getCart();

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

    const rows = [];

    cart.forEach(
      function(
        item,
        index
      ) {

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

        total += line;

        rows.push(
          '<div ' +
          'style="' +
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

              '<div ' +
              'style="' +
              'color:#64748b;' +
              'font-size:13px' +
              '">' +

                'تعداد: ' +
                formatNumber(
                  safeQuantity
                ) +

              '</div>' +

            '</div>' +

            '<div style="text-align:left">' +

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
              ')"' +
              '>' +

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
  ) {

    const cart =
      getCart();

    cart.splice(
      index,
      1
    );

    saveCart(cart);

    renderCart();
  }


  async function checkoutCart() {

    const cart =
      getCart();

    if (!cart.length) {

      alert(
        "سبد خرید شما خالی است."
      );

      return;
    }

    const customerName =
      prompt(
        "نام و نام خانوادگی:"
      );

    if (!customerName) {
      return;
    }

    const customerPhone =
      prompt(
        "شماره تماس:"
      );

    if (!customerPhone) {
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

    if (!address) {
      return;
    }

    try {

      const response =
        await fetch(
          "/api/orders",
          {
            method:
              "POST",

            headers: {
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
        "سفارش با موفقیت ثبت شد. " +
        "شماره سفارش: " +
        result.order_id
      );

    } catch (error) {

      alert(
        "خطا در ثبت سفارش."
      );

      console.error(
        error
      );
    }
  }


  function adminLogin() {

    const password =
      document.getElementById(
        "admin-password"
      )?.value || "";

    if (!password) {
      alert(
        "رمز مدیریت را وارد کنید."
      );
      return;
    }

    sessionStorage.setItem(
      "digimarixo_admin_password",
      password
    );

    location.reload();
  }


  function adminHeaders() {

    return {
      "content-type":
        "application/json",

      "X-Admin-Password":
        sessionStorage.getItem(
          "digimarixo_admin_password"
        ) || ""
    };
  }


  async function createSupplierAdmin() {

    try {

      const response =
        await fetch(
          "/api/admin/suppliers",
          {
            method:
              "POST",

            headers:
              adminHeaders(),

            body:
              JSON.stringify({
                name:
                  document.getElementById(
                    "supplier-name"
                  )?.value || "",

                phone:
                  document.getElementById(
                    "supplier-phone"
                  )?.value || "",

                email:
                  document.getElementById(
                    "supplier-email"
                  )?.value || "",

                website:
                  document.getElementById(
                    "supplier-website"
                  )?.value || "",

                address:
                  document.getElementById(
                    "supplier-address"
                  )?.value || "",

                shipping_method:
                  document.getElementById(
                    "supplier-shipping"
                  )?.value || "",

                direct_shipping:
                  document.getElementById(
                    "supplier-direct"
                  )?.checked
                    ? 1
                    : 0
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
        return;
      }

      alert(
        "فروشنده ثبت شد. شناسه فروشنده: " +
        result.supplier_id
      );

    } catch {
      alert(
        "خطا در ثبت فروشنده."
      );
    }
  }


  async function createProductAdmin() {

    try {

      const response =
        await fetch(
          "/api/admin/products",
          {
            method:
              "POST",

            headers:
              adminHeaders(),

            body:
              JSON.stringify({
                name:
                  document.getElementById(
                    "product-name"
                  )?.value || "",

                category:
                  document.getElementById(
                    "product-category"
                  )?.value || "سایر",

                description:
                  document.getElementById(
                    "product-description"
                  )?.value || "",

                image:
                  document.getElementById(
                    "product-image"
                  )?.value || "",

                price:
                  Number(
                    document.getElementById(
                      "product-price"
                    )?.value || 0
                  ),

                supplier_price:
                  Number(
                    document.getElementById(
                      "product-supplier-price"
                    )?.value || 0
                  ),

                commission:
                  Number(
                    document.getElementById(
                      "product-commission"
                    )?.value || 0
                  ),

                stock:
                  Number(
                    document.getElementById(
                      "product-stock"
                    )?.value || 0
                  ),

                supplier_id:
                  document.getElementById(
                    "product-supplier-id"
                  )?.value || null,

                supplier_sku:
                  document.getElementById(
                    "product-sku"
                  )?.value || "",

                delivery_days:
                  document.getElementById(
                    "product-delivery"
                  )?.value || ""
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
        return;
      }

      alert(
        "محصول ثبت شد. شناسه محصول: " +
        result.product_id
      );

      location.reload();

    } catch {
      alert(
        "خطا در ثبت محصول."
      );
    }
  }


  async function loadAdminData() {

    const box =
      document.getElementById(
        "admin-data"
      );

    if (!box) {
      return;
    }

    box.innerHTML =
      "در حال دریافت اطلاعات...";

    try {

      const password =
        sessionStorage.getItem(
          "digimarixo_admin_password"
        ) || "";

      const headers = {
        "X-Admin-Password":
          password
      };

      const [
        suppliersResponse,
        productsResponse,
        ordersResponse
      ] =
        await Promise.all([
          fetch(
            "/api/suppliers",
            {
              headers
            }
          ),
          fetch(
            "/api/products"
          ),
          fetch(
            "/api/orders",
            {
              headers
            }
          )
        ]);

      const suppliers =
        await suppliersResponse.json();

      const products =
        await productsResponse.json();

      const orders =
        await ordersResponse.json();

      let html =
        "<div>";

      html +=
        "<h3>فروشندگان</h3>";

      if (
        suppliers.ok &&
        suppliers.suppliers?.length
      ) {

        html +=
          "<ul>";

        suppliers.suppliers.forEach(
          supplier => {

            html +=
              "<li>" +
              escapeClientHTML(
                supplier.name
              ) +
              " — شناسه: " +
              formatNumber(
                supplier.id
              ) +
              " — ارسال مستقیم: " +
              (
                Number(
                  supplier.direct_shipping
                ) === 1
                  ? "بله"
                  : "خیر"
              ) +
              "</li>";
          }
        );

        html +=
          "</ul>";

      } else {

        html +=
          "<p>فروشنده‌ای ثبت نشده است.</p>";
      }

      html +=
        "<h3>محصولات</h3>";

      if (
        products.ok &&
        products.products?.length
      ) {

        html +=
          "<ul>";

        products.products.forEach(
          product => {

            html +=
              "<li>" +
              escapeClientHTML(
                product.name
              ) +
              " — " +
              formatNumber(
                product.price
              ) +
              " تومان" +
              " — موجودی: " +
              formatNumber(
                product.stock
              ) +
              " — فروشنده: " +
              escapeClientHTML(
                product.supplier_name ||
                "تعیین نشده"
              ) +
              "</li>";
          }
        );

        html +=
          "</ul>";

      } else {

        html +=
          "<p>محصولی ثبت نشده است.</p>";
      }

      html +=
        "<h3>سفارش‌ها</h3>";

      if (
        orders.ok &&
        orders.orders?.length
      ) {

        html +=
          "<ul>";

        orders.orders.forEach(
          order => {

            html +=
              "<li>" +
              "سفارش #" +
              formatNumber(
                order.id
              ) +
              " — " +
              escapeClientHTML(
                order.customer_name
              ) +
              " — " +
              formatNumber(
                order.total
              ) +
              " تومان — " +
              escapeClientHTML(
                order.status
              ) +
              "</li>";
          }
        );

        html +=
          "</ul>";

      } else {

        html +=
          "<p>سفارشی ثبت نشده است.</p>";
      }

      html +=
        "</div>";

      box.innerHTML =
        html;

    } catch {
      box.innerHTML =
        "<p>خطا در دریافت اطلاعات مدیریت.</p>";
    }
  }


  function escapeClientHTML(
    value
  ) {

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
   RESPONSE HELPERS
========================================================= */

function html(
  content,
  status = 200
) {
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


function json(
  data,
  status = 200
) {
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

function normalizePrice(
  value
) {

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

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(number)
  );
}


function formatPrice(
  value
) {

  const number =
    normalizePrice(
      value
    );

  return (
    number.toLocaleString(
      "fa-IR"
    ) +
    " تومان"
  );
}


function formatNumber(
  value
) {

  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "۰";
  }

  return number.toLocaleString(
    "fa-IR"
  );
}


function escapeHTML(
  value
) {

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
) {
  return escapeHTML(
    value
  );
}


function escapeJS(
  value
) {

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
) {

  if (!error) {
    return "خطای ناشناخته";
  }

  if (error.message) {
    return String(
      error.message
    );
  }

  return String(
    error
  );
                    }
