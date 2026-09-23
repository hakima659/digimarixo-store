const STORE_NAME = "دیجی‌ماریکسو";
const STORE_EN = "DigiMarixo";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // =========================
      // HOME
      // =========================
      if (path === "/" && method === "GET") {
        return html(homePage());
      }

      // =========================
      // HEALTH
      // =========================
      if (path === "/health") {
        return json({
          ok: true,
          store: STORE_EN,
          status: "online"
        });
      }

      // =========================
      // PRODUCTS API
      // =========================
      if (path === "/api/products" && method === "GET") {
        const products = await getProducts(env);
        return json({
          ok: true,
          products
        });
      }

      // =========================
      // 404
      // =========================
      return html(notFoundPage(), 404);

    } catch (error) {
      return json({
        ok: false,
        error: error.message
      }, 500);
    }
  }
};


// =====================================================
// HOME PAGE
// =====================================================

function homePage() {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <title>${STORE_NAME} | ${STORE_EN}</title>

  <meta
    name="description"
    content="دیجی‌ماریکسو؛ فروشگاه آنلاین برای مشاهده و خرید محصولات"
  >

  <meta name="theme-color" content="#111827">

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family:
        Tahoma,
        Arial,
        sans-serif;
      background: #f5f7fb;
      color: #111827;
    }

    header {
      background: #111827;
      color: white;
      padding: 18px 20px;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .header-inner {
      max-width: 1100px;
      margin: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
    }

    .brand {
      font-size: 22px;
      font-weight: bold;
    }

    .brand small {
      display: block;
      font-size: 11px;
      opacity: .7;
      margin-top: 3px;
      direction: ltr;
      text-align: right;
    }

    nav a {
      color: white;
      text-decoration: none;
      margin-right: 18px;
      font-size: 14px;
    }

    nav a:hover {
      opacity: .75;
    }

    .hero {
      max-width: 1100px;
      margin: 30px auto;
      padding: 45px 25px;
      border-radius: 20px;
      background: white;
      text-align: center;
      box-shadow: 0 8px 30px rgba(0,0,0,.06);
    }

    .hero h1 {
      margin: 0 0 15px;
      font-size: 34px;
    }

    .hero p {
      color: #6b7280;
      line-height: 2;
      margin: 0 auto 25px;
      max-width: 650px;
    }

    .button {
      display: inline-block;
      padding: 12px 24px;
      border-radius: 12px;
      background: #111827;
      color: white;
      text-decoration: none;
      border: none;
      cursor: pointer;
      font-size: 15px;
    }

    .section {
      max-width: 1100px;
      margin: 30px auto;
      padding: 0 20px;
    }

    .section-title {
      font-size: 23
