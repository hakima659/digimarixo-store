const STORE_NAME = "دیجی‌ماریکسو";
const STORE_EN = "DigiMarixo";

const DEFAULT_ADMIN_USERNAME = "admin";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
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

async function readJSON(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, function (d) {
      return String("۰۱۲۳۴۵۶۷۸۹".indexOf(d));
    })
    .replace(/[٠-٩]/g, function (d) {
      return String("٠١٢٣٤٥٦٧٨٩".indexOf(d));
    });
}

function normalizePrice(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  let text = normalizeDigits(value);

  text = text
    .replace(/[٬,]/g, "")
    .replace(/تومان/gi, "")
    .replace(/تومن/gi, "")
    .replace(/[^\d.-]/g, "")
    .trim();

  if (!text) {
    return 0;
  }

  const number = Number(text);

  return Number.isFinite(number) ? number : 0;
}

function formatPrice(value) {
  const number = normalizePrice(value);

  if (!Number.isFinite(number) || number <= 0) {
    return "قیمت نامشخص";
  }

  return number.toLocaleString("fa-IR") + " تومان";
}

function cookieValue(request, name) {
  const cookie = request.headers.get("Cookie") || "";

  const parts = cookie.split(";");

  for (const part of parts) {
    const item = part.trim();

    if (item.startsWith(name + "=")) {
      return decodeURIComponent(item.substring(name.length + 1));
    }
  }

  return null;
}

async function getCurrentUser(request, env) {
  const token = cookieValue(request, "dm_session");

  if (!token) {
    return null;
  }

  try {
    const session = await env.DB.prepare(`
      SELECT
        sessions.id,
        sessions.token,
        sessions.user_id,
        sessions.expires_at,
        users.id AS uid,
        users.username,
        users.email
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token = ?
      LIMIT 1
    `)
      .bind(token)
      .first();

    if (!session) {
      return null;
    }

    if (
      session.expires_at &&
      new Date(session.expires_at).getTime() < Date.now()
    ) {
      return null;
    }

    return {
      id: session.uid,
      username: session.username,
      email: session.email
    };
  } catch {
    return null;
  }
}

async function getAdmin(request, env) {
  const token = cookieValue(request, "dm_admin");

  if (!token) {
    return null;
  }

  try {
    const admin = await env.DB.prepare(`
      SELECT
        id,
        token,
        username,
        expires_at
      FROM admin_sessions
      WHERE token = ?
      LIMIT 1
    `)
      .bind(token)
      .first();

    if (!admin) {
      return null;
    }

    if (
      admin.expires_at &&
      new Date(admin.expires_at).getTime() < Date.now()
    ) {
      return null;
    }

    return admin;
  } catch {
    return null;
  }
}

function setCookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function deleteCookie(name) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function responseWithCookie(data, cookie, status = 200) {
  const response = json(data, status);
  response.headers.set("Set-Cookie", cookie);
  return response;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function layout(title, body, extraScript = "") {
  return `
<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapeHTML(title)} | ${STORE_NAME}</title>

<style>
*{
  box-sizing:border-box;
}

html{
  scroll-behavior:smooth;
}

body{
  margin:0;
  font-family:
    Tahoma,
    Arial,
    sans-serif;
  background:#f7f7f7;
  color:#222;
}

a{
  color:inherit;
  text-decoration:none;
}

button,
input{
  font-family:inherit;
}

.topbar{
  background:#c40000;
  color:white;
  padding:8px 20px;
  font-size:13px;
  text-align:center;
}

.header{
  background:white;
  border-bottom:1px solid #eee;
  position:sticky;
  top:0;
  z-index:50;
}

.header-inner{
  max-width:1250px;
  margin:auto;
  min-height:78px;
  display:flex;
  align-items:center;
  gap:18px;
  padding:12px 18px;
}

.logo{
  min-width:190px;
  font-size:25px;
  font-weight:900;
  color:#d00000;
}

.logo small{
  display:block;
  color:#777;
  font-size:11px;
  font-weight:normal;
  margin-top:2px;
}

.search{
  flex:1;
  position:relative;
}

.search input{
  width:100%;
  height:48px;
  border:1px solid #ddd;
  border-radius:12px;
  padding:0 48px 0 15px;
  outline:none;
  background:#f8f8f8;
  font-size:14px;
}

.search input:focus{
  border-color:#d00000;
  background:white;
}

.search-icon{
  position:absolute;
  right:16px;
  top:13px;
  font-size:20px;
}

.header-actions{
  display:flex;
  align-items:center;
  gap:8px;
}

.action{
  border:1px solid #eee;
  background:white;
  border-radius:12px;
  min-height:45px;
  padding:8px 12px;
  cursor:pointer;
  white-space:nowrap;
}

.action:hover{
  border-color:#d00000;
  color:#d00000;
}

.cart-btn{
  background:#d00000;
  color:white;
  border-color:#d00000;
}

.cart-count{
  background:white;
  color:#d00000;
  padding:2px 6px;
  border-radius:20px;
  margin-right:4px;
  font-size:11px;
}

.nav{
  background:#fff;
  border-bottom:1px solid #eee;
}

.nav-inner{
  max-width:1250px;
  margin:auto;
  padding:0 18px;
  min-height:48px;
  display:flex;
  align-items:center;
  gap:22px;
  overflow:auto;
}

.nav a{
  white-space:nowrap;
  font-size:14px;
  color:#444;
}

.nav a:hover{
  color:#d00000;
}

.hero{
  max-width:1250px;
  margin:22px auto;
  padding:0 18px;
}

.hero-box{
  min-height:330px;
  border-radius:22px;
  overflow:hidden;
  position:relative;
  background:
    linear-gradient(
      120deg,
      #7e0000 0%,
      #c40000 45%,
      #ef2020 100%
    );
  color:white;
  display:flex;
  align-items:center;
  padding:40px;
  box-shadow:0 10px 35px rgba(180,0,0,.18);
}

.hero-content{
  max-width:650px;
  position:relative;
  z-index:2;
}

.hero h1{
  font-size:38px;
  margin:0 0 15px;
}

.hero p{
  line-height:2;
  color:#fff;
  opacity:.95;
}

.hero-btn{
  display:inline-block;
  background:white;
  color:#b00000;
  padding:13px 25px;
  border-radius:12px;
  font-weight:bold;
  margin-top:12px;
}

.hero-shape{
  position:absolute;
  left:-90px;
  top:-80px;
  width:420px;
  height:420px;
  border-radius:50%;
  background:rgba(255,255,255,.08);
}

.hero-shape2{
  position:absolute;
  left:220px;
  bottom:-170px;
  width:400px;
  height:400px;
  border-radius:50%;
  background:rgba(255,255,255,.07);
}

.section{
  max-width:1250px;
  margin:30px auto;
  padding:0 18px;
}

.section-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom:18px;
}

.section-title{
  font-size:23px;
  font-weight:900;
}

.section-title span{
  color:#d00000;
}

.categories{
  display:grid;
  grid-template-columns:
    repeat(6,1fr);
  gap:12px;
}

.category{
  background:white;
  border-radius:14px;
  border:1px solid #eee;
  padding:18px 10px;
  text-align:center;
  cursor:pointer;
  transition:.2s;
}

.category:hover{
  transform:translateY(-3px);
  border-color:#d00000;
  box-shadow:0 8px 20px rgba(0,0,0,.06);
}

.category-icon{
  font-size:30px;
  margin-bottom:7px;
}

.products{
  display:grid;
  grid-template-columns:
    repeat(4,1fr);
  gap:18px;
}

.product{
  background:white;
  border-radius:16px;
  border:1px solid #eee;
  overflow:hidden;
  transition:.2s;
  position:relative;
}

.product:hover{
  transform:translateY(-4px);
  box-shadow:0 10px 25px rgba(0,0,0,.08);
}

.product-image{
  height:190px;
  display:flex;
  align-items:center;
  justify-content:center;
  background:#fafafa;
  font-size:65px;
}

.product-image img{
  width:100%;
  height:100%;
  object-fit:cover;
}

.product-info{
  padding:16px;
}

.product-name{
  font-size:16px;
  font-weight:bold;
  margin-bottom:8px;
}

.product-description{
  color:#777;
  font-size:12px;
  line-height:1.8;
  min-height:43px;
}

.price{
  color:#d00000;
  font-size:17px;
  font-weight:bold;
  margin:13px 0;
}

.product-actions{
  display:flex;
  gap:8px;
}

.btn{
  border:0;
  border-radius:10px;
  padding:10px 12px;
  cursor:pointer;
  font-weight:bold;
  flex:1;
}

.btn-primary{
  background:#d00000;
  color:white;
}

.btn-secondary{
  background:#f3f3f3;
  color:#333;
}

.empty{
  background:white;
  border-radius:15px;
  padding:40px;
  text-align:center;
  color:#777;
}

.footer{
  margin-top:60px;
  background:#1b1b1b;
  color:#ddd;
  padding:40px 20px;
}

.footer-inner{
  max-width:1250px;
  margin:auto;
  display:grid;
  grid-template-columns:
    2fr 1fr 1fr;
  gap:30px;
}

.footer h3{
  color:white;
}

.footer p{
  color:#aaa;
  line-height:2;
}

.modal{
  display:none;
  position:fixed;
  inset:0;
  background:rgba(0,0,0,.6);
  z-index:100;
  align-items:center;
  justify-content:center;
  padding:18px;
}

.modal.show{
  display:flex;
}

.modal-box{
  width:100%;
  max-width:500px;
  max-height:90vh;
  overflow:auto;
  background:white;
  border-radius:18px;
  padding:22px;
}

.modal-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom:18px;
}

.close{
  border:0;
  background:#eee;
  width:35px;
  height:35px;
  border-radius:50%;
  cursor:pointer;
}

.form-group{
  margin-bottom:13px;
}

.form-group label{
  display:block;
  margin-bottom:6px;
  font-size:13px;
  font-weight:bold;
}

.form-group input,
.form-group textarea{
  width:100%;
  border:1px solid #ddd;
  border-radius:10px;
  padding:12px;
  outline:none;
}

.form-group textarea{
  min-height:100px;
  resize:vertical;
}

.notice{
  background:#fff3f3;
  border:1px solid #ffd2d2;
  color:#a40000;
  padding:12px;
  border-radius:10px;
  margin-bottom:15px;
}

.cart-item{
  display:flex;
  gap:12px;
  align-items:center;
  padding:12px 0;
  border-bottom:1px solid #eee;
}

.cart-item-image{
  width:60px;
  height:60px;
  border-radius:10px;
  background:#f7f7f7;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:30px;
}

.cart-item-info{
  flex:1;
}

.cart-total{
  padding-top:18px;
  font-weight:bold;
  font-size:18px;
}

@media(max-width:900px){
  .header-inner{
    flex-wrap:wrap;
  }

  .logo{
    min-width:auto;
  }

  .search{
    order:3;
    flex-basis:100%;
  }

  .products{
    grid-template-columns:
      repeat(2,1fr);
  }

  .categories{
    grid-template-columns:
      repeat(3,1fr);
  }

  .footer-inner{
    grid-template-columns:1fr;
  }
}

@media(max-width:550px){
  .hero-box{
    min-height:280px;
    padding:25px;
  }

  .hero h1{
    font-size:27px;
  }

  .products{
    grid-template-columns:1fr 1fr;
    gap:10px;
  }

  .product-image{
    height:145px;
  }

  .categories{
    grid-template-columns:
      repeat(2,1fr);
  }

  .header-actions{
    margin-right:auto;
  }

  .action{
    padding:7px 9px;
  }
}
</style>
</head>

<body>

<div class="topbar">
  ارسال و خدمات دیجیتال در دیجی‌ماریکسو
</div>

<header class="header">
  <div class="header-inner">

    <a class="logo" href="/">
      ${STORE_NAME}
      <small>${STORE_EN}</small>
    </a>

    <div class="search">
      <span class="search-icon">🔍</span>
      <input
        id="searchInput"
        type="search"
        placeholder="جستجوی محصول..."
        oninput="filterProducts()"
      >
    </div>

    <div class="header-actions">

      <button
        class="action"
        onclick="location.href='/account'"
      >
        👤 حساب
      </button>

      <button
        class="action cart-btn"
        onclick="openCart()"
      >
        🛒 سبد
        <span
          class="cart-count"
          id="cartCount"
        >0</span>
      </button>

    </div>

  </div>
</header>

<nav class="nav">
  <div class="nav-inner">
    <a href="/">خانه</a>
    <a href="#categories">دسته‌بندی‌ها</a>
    <a href="#products">محصولات</a>
    <a href="/account">حساب کاربری</a>
    <a href="/admin">مدیریت</a>
  </div>
</nav>

${body}

<div class="modal" id="cartModal">
  <div class="modal-box">

    <div class="modal-head">
      <h2>🛒 سبد خرید</h2>
      <button class="close" onclick="closeCart()">×</button>
    </div>

    <div id="cartItems"></div>

    <div class="cart-total" id="cartTotal">
      مجموع: ۰ تومان
    </div>

    <br>

    <button
      class="btn btn-primary"
      onclick="checkout()"
    >
      ثبت سفارش
    </button>

  </div>
</div>

<div class="modal" id="productModal">
  <div class="modal-box">

    <div class="modal-head">
      <h2 id="modalProductName">محصول</h2>
      <button class="close" onclick="closeProduct()">×</button>
    </div>

    <div id="modalProductContent"></div>

  </div>
</div>

<footer class="footer">
  <div class="footer-inner">

    <div>
      <h3>${STORE_NAME}</h3>
      <p>
        فروشگاه دیجیتال دیجی‌ماریکسو؛
        محصولات و خدمات دیجیتال کاربردی.
      </p>
    </div>

    <div>
      <h3>دسترسی سریع</h3>
      <p>
        <a href="/">خانه</a><br>
        <a href="#products">محصولات</a><br>
        <a href="/account">حساب کاربری</a>
      </p>
    </div>

    <div>
      <h3>اطلاعات</h3>
      <p>
        ${STORE_EN}<br>
        DigiMarixo
      </p>
    </div>

  </div>
</footer>

<script>
let PRODUCTS = [];
let CART = [];

try {
  CART = JSON.parse(localStorage.getItem("dm_cart") || "[]");
} catch {
  CART = [];
}

function saveCart(){
  localStorage.setItem(
    "dm_cart",
    JSON.stringify(CART)
  );

  updateCartCount();
}

function updateCartCount(){
  const count = document.getElementById("cartCount");

  if(count){
    count.textContent =
      CART.length.toLocaleString("fa-IR");
  }
}

function filterProducts(){

  const input =
    document.getElementById("searchInput");

  const term =
    String(input?.value || "")
      .trim()
      .toLowerCase();

  const filtered =
    PRODUCTS.filter(function(product){

      const text =
        (
          String(product.name || "") +
          " " +
          String(product.description || "")
        ).toLowerCase();

      return text.includes(term);
    });

  renderProducts(filtered);
}

function renderProducts(list){

  const container =
    document.getElementById("productsGrid");

  if(!container){
    return;
  }

  if(!list.length){

    container.innerHTML =
      '<div class="empty" style="grid-column:1/-1">محصولی پیدا نشد.</div>';

    return;
  }

  container.innerHTML =
    list.map(function(product){

      const image =
        String(product.image || "🛍️");

      const imageHTML =
        image.startsWith("http")
          ? '<img src="' +
            escapeHTML(image) +
            '" alt="' +
            escapeHTML(product.name) +
            '">'
          : escapeHTML(image);

      return `
        <article class="product">

          <div class="product-image">
            ${imageHTML}
          </div>

          <div class="product-info">

            <div class="product-name">
              ${escapeHTML(product.name)}
            </div>

            <div class="product-description">
              ${escapeHTML(product.description || "")}
            </div>

            <div class="price">
              ${formatPriceClient(product.price)}
            </div>

            <div class="product-actions">

              <button
                class="btn btn-secondary"
                onclick="showProduct(${Number(product.id)})"
              >
                مشاهده
              </button>

              <button
                class="btn btn-primary"
                onclick="addToCart(${Number(product.id)})"
              >
                🛒 افزودن
              </button>

            </div>

          </div>

        </article>
      `;
    }).join("");
}

function formatPriceClient(value){

  const text =
    String(value ?? "")
      .replace(/[۰-۹]/g,function(d){
        return String("۰۱۲۳۴۵۶۷۸۹".indexOf(d));
      })
      .replace(/[٠-٩]/g,function(d){
        return String("٠١٢٣٤٥٦٧٨٩".indexOf(d));
      })
      .replace(/[٬,]/g,"")
      .replace(/[^\d.-]/g,"");

  const number = Number(text);

  if(!Number.isFinite(number) || number <= 0){
    return "قیمت نامشخص";
  }

  return number.toLocaleString("fa-IR") + " تومان";
}

function addToCart(id){

  const product =
    PRODUCTS.find(function(item){
      return Number(item.id) === Number(id);
    });

  if(!product){
    alert("محصول پیدا نشد.");
    return;
  }

  CART.push({
    id:Number(product.id),
    name:product.name,
    price:product.price,
    image:product.image
  });

  saveCart();

  alert("محصول به سبد خرید اضافه شد.");
}

function removeFromCart(index){

  CART.splice(index,1);

  saveCart();

  renderCart();
}

function renderCart(){

  const container =
    document.getElementById("cartItems");

  const total =
    document.getElementById("cartTotal");

  if(!container){
    return;
  }

  if(!CART.length){

    container.innerHTML =
      '<div class="empty">سبد خرید شما خالی است.</div>';

    if(total){
      total.textContent = "مجموع: ۰ تومان";
    }

    return;
  }

  let sum = 0;

  container.innerHTML =
    CART.map(function(item,index){

      const price =
        Number(item.price) || 0;

      sum += price;

      return `
        <div class="cart-item">

          <div class="cart-item-image">
            ${escapeHTML(item.image || "🛍️")}
          </div>

          <div class="cart-item-info">
            <strong>
              ${escapeHTML(item.name)}
            </strong>

            <div class="price">
              ${formatPriceClient(price)}
            </div>
          </div>

          <button
            class="close"
            onclick="removeFromCart(${index})"
          >
            ×
          </button>

        </div>
      `;
    }).join("");

  if(total){
    total.textContent =
      "مجموع: " +
      sum.toLocaleString("fa-IR") +
      " تومان";
  }
}

function openCart(){

  renderCart();

  document
    .getElementById("cartModal")
    .classList.add("show");
}

function closeCart(){

  document
    .getElementById("cartModal")
    .classList.remove("show");
}

function showProduct(id){

  const product =
    PRODUCTS.find(function(item){
      return Number(item.id) === Number(id);
    });

  if(!product){
    return;
  }

  document.getElementById("modalProductName")
    .textContent = product.name;

  document.getElementById("modalProductContent")
    .innerHTML = `

      <div class="product-image">
        ${escapeHTML(product.image || "🛍️")}
      </div>

      <p style="line-height:2">
        ${escapeHTML(product.description || "")}
      </p>

      <div class="price">
        ${formatPriceClient(product.price)}
      </div>

      <button
        class="btn btn-primary"
        onclick="addToCart(${Number(product.id)});closeProduct()"
      >
        🛒 افزودن به سبد خرید
      </button>
    `;

  document
    .getElementById("productModal")
    .classList.add("show");
}

function closeProduct(){

  document
    .getElementById("productModal")
    .classList.remove("show");
}

async function checkout(){

  if(!CART.length){
    alert("سبد خرید خالی است.");
    return;
  }

  if(CART.length > 1){

    alert(
      "فعلاً هر سفارش برای یک محصول ثبت می‌شود. " +
      "لطفاً فقط یک محصول را در سبد نگه دارید."
    );

    return;
  }

  const product = CART[0];

  try{

    const response =
      await fetch("/api/orders",{
        method:"POST",
        headers:{
          "content-type":"application/json"
        },
        body:JSON.stringify({
          product_id:Number(product.id)
        })
      });

    const data =
      await response.json();

    if(response.status === 401){

      alert(
        "برای ثبت سفارش ابتدا وارد حساب کاربری شوید."
      );

      location.href =
        "/account";

      return;
    }

    if(!response.ok || !data.ok){

      alert(
        data.error ||
        "ثبت سفارش انجام نشد."
      );

      return;
    }

    CART = [];

    saveCart();

    closeCart();

    alert(
      "سفارش با موفقیت ثبت شد."
    );

  }catch(error){

    alert(
      "خطا در ارتباط با سرور."
    );
  }
}

function escapeHTML(value){

  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

async function loadProducts(){

  try{

    const response =
      await fetch("/api/products");

    const data =
      await response.json();

    if(data.ok && Array.isArray(data.products)){

      PRODUCTS = data.products;

      renderProducts(PRODUCTS);

    }else{

      PRODUCTS = [];

      renderProducts([]);

    }

  }catch(error){

    PRODUCTS = [];

    renderProducts([]);
  }

  updateCartCount();
}

loadProducts();
</script>

${extraScript}

</body>
</html>
`;
}

function homePage(products) {

  const productJSON =
    JSON.stringify(products || [])
      .replace(/</g, "\\u003c");

  return layout(
    "فروشگاه",
    `
    <section class="hero">

      <div class="hero-box">

        <div class="hero-shape"></div>
        <div class="hero-shape2"></div>

        <div class="hero-content">

          <h1>
            به ${STORE_NAME} خوش آمدید
          </h1>

          <p>
            محصولات و خدمات دیجیتال کاربردی
            را در یک فروشگاه ساده و سریع پیدا کنید.
          </p>

          <a
            class="hero-btn"
            href="#products"
          >
            مشاهده محصولات
          </a>

        </div>

      </div>

    </section>

    <section
      class="section"
      id="categories"
    >

      <div class="section-head">

        <div class="section-title">
          دسته‌بندی‌ها
        </div>

      </div>

      <div class="categories">

        <div
          class="category"
          onclick="document.getElementById('products').scrollIntoView()"
        >
          <div class="category-icon">💻</div>
          <strong>محصولات دیجیتال</strong>
        </div>

        <div
          class="category"
          onclick="document.getElementById('products').scrollIntoView()"
        >
          <div class="category-icon">🧰</div>
          <strong>ابزارها</strong>
        </div>

        <div
          class="category"
          onclick="document.getElementById('products').scrollIntoView()"
        >
          <div class="category-icon">⚡</div>
          <strong>خدمات دیجیتال</strong>
        </div>

        <div
          class="category"
          onclick="document.getElementById('products').scrollIntoView()"
        >
          <div class="category-icon">🎁</div>
          <strong>پیشنهادها</strong>
        </div>

        <div
          class="category"
          onclick="document.getElementById('products').scrollIntoView()"
        >
          <div class="category-icon">🔥</div>
          <strong>محبوب‌ها</strong>
        </div>

        <div
          class="category"
          onclick="document.getElementById('products').scrollIntoView()"
        >
          <div class="category-icon">🛍️</div>
          <strong>همه محصولات</strong>
        </div>

      </div>

    </section>

    <section
      class="section"
      id="products"
    >

      <div class="section-head">

        <div class="section-title">
          محصولات <span>دیجی‌ماریکسو</span>
        </div>

      </div>

      <div
        class="products"
        id="productsGrid"
      >
        <div
          class="empty"
          style="grid-column:1/-1"
        >
          در حال دریافت محصولات...
        </div>
      </div>

    </section>

    <script>
      window.DIGIMARIXO_PRODUCTS =
        ${productJSON};
    </script>
    `,
    `
    <script>
      if(
        Array.isArray(window.DIGIMARIXO_PRODUCTS) &&
        window.DIGIMARIXO_PRODUCTS.length
      ){
        PRODUCTS =
          window.DIGIMARIXO_PRODUCTS;

        renderProducts(PRODUCTS);
      }
    </script>
    `
  );
}

function accountPage() {

  return layout(
    "حساب کاربری",
    `
    <section class="section">

      <div
        style="
          max-width:600px;
          margin:40px auto;
        "
      >

        <div class="empty">

          <h1>
            حساب کاربری
          </h1>

          <p>
            ورود یا ایجاد حساب کاربری
            در ${STORE_NAME}
          </p>

          <div
            id="accountStatus"
            style="margin:20px 0"
          >
            در حال بررسی...
          </div>

          <div id="authForms">

            <div
              style="
                text-align:right;
                margin-bottom:30px;
              "
            >

              <h3>ورود</h3>

              <div class="form-group">
                <label>نام کاربری یا ایمیل</label>
                <input
                  id="loginIdentifier"
                  autocomplete="username"
                >
              </div>

              <div class="form-group">
                <label>رمز عبور</label>
                <input
                  id="loginPassword"
                  type="password"
                  autocomplete="current-password"
                >
              </div>

              <button
                class="btn btn-primary"
                onclick="login()"
              >
                ورود
              </button>

            </div>

            <hr>

            <div
              style="
                text-align:right;
                margin-top:30px;
              "
            >

              <h3>ثبت‌نام</h3>

              <div class="form-group">
                <label>نام کاربری</label>
                <input id="registerUsername">
              </div>

              <div class="form-group">
                <label>ایمیل</label>
                <input
                  id="registerEmail"
                  type="email"
                >
              </div>

              <div class="form-group">
                <label>رمز عبور</label>
                <input
                  id="registerPassword"
                  type="password"
                >
              </div>

              <button
                class="btn btn-primary"
                onclick="register()"
              >
                ایجاد حساب
              </button>

            </div>

          </div>

          <br>

          <a href="/">
            بازگشت به فروشگاه
          </a>

        </div>

      </div>

    </section>
    `,
    `
    <script>

    async function checkAccount(){

      try{

        const response =
          await fetch("/api/me");

        const data =
          await response.json();

        const status =
          document.getElementById("accountStatus");

        const forms =
          document.getElementById("authForms");

        if(data.ok && data.user){

          status.innerHTML =
            "<div class='notice'>" +
            "سلام " +
            escapeHTML(data.user.username) +
            "، شما وارد حساب هستید." +
            "</div>" +
            "<button class='btn btn-secondary' onclick='logout()'>" +
            "خروج از حساب" +
            "</button>";

          forms.style.display="none";

        }else{

          status.textContent =
            "برای ثبت سفارش وارد حساب خود شوید.";

        }

      }catch(error){}

    }

    async function login(){

      const identifier =
        document.getElementById("loginIdentifier").value;

      const password =
        document.getElementById("loginPassword").value;

      const response =
        await fetch("/api/login",{
          method:"POST",
          headers:{
            "content-type":"application/json"
          },
          body:JSON.stringify({
            identifier,
            password
          })
        });

      const data =
        await response.json();

      if(!response.ok || !data.ok){

        alert(
          data.error ||
          "ورود ناموفق بود."
        );

        return;
      }

      location.reload();
    }

    async function register(){

      const username =
        document.getElementById("registerUsername").value;

      const email =
        document.getElementById("registerEmail").value;

      const password =
        document.getElementById("registerPassword").value;

      const response =
        await fetch("/api/register",{
          method:"POST",
          headers:{
            "content-type":"application/json"
          },
          body:JSON.stringify({
            username,
            email,
            password
          })
        });

      const data =
        await response.json();

      if(!response.ok || !data.ok){

        alert(
          data.error ||
          "ثبت‌نام ناموفق بود."
        );

        return;
      }

      alert(
        "حساب کاربری با موفقیت ساخته شد."
      );

      location.reload();
    }

    async function logout(){

      await fetch(
        "/api/logout",
        {method:"POST"}
      );

      location.reload();
    }

    checkAccount();

    </script>
    `
  );
}

function adminPage() {

  return layout(
    "مدیریت",
    `
    <section class="section">

      <div
        style="
          max-width:850px;
          margin:35px auto;
        "
      >

        <div class="empty">

          <h1>
            مدیریت ${STORE_NAME}
          </h1>

          <div id="adminArea">

            <div id="adminLogin">

              <div class="form-group"
                style="text-align:right">
                <label>نام کاربری</label>
                <input id="adminUsername" value="admin">
              </div>

              <div class="form-group"
                style="text-align:right">
                <label>رمز مدیریت</label>
                <input
                  id="adminPassword"
                  type="password"
                >
              </div>

              <button
                class="btn btn-primary"
                onclick="adminLogin()"
              >
                ورود مدیریت
              </button>

            </div>

            <div
              id="adminPanel"
              style="display:none;text-align:right"
            >

              <h3>
                افزودن محصول
              </h3>

              <div class="form-group">
                <label>نام محصول</label>
                <input id="productName">
              </div>

              <div class="form-group">
                <label>توضیحات</label>
                <textarea id="productDescription"></textarea>
              </div>

              <div class="form-group">
                <label>قیمت</label>
                <input
                  id="productPrice"
                  inputmode="decimal"
                  placeholder="99000"
                >
              </div>

              <div class="form-group">
                <label>تصویر یا ایموجی</label>
                <input
                  id="productImage"
                  value="🛍️"
                >
              </div>

              <button
                class="btn btn-primary"
                onclick="createProduct()"
              >
                افزودن محصول
              </button>

              <hr style="margin:30px 0">

              <h3>
                محصولات موجود
              </h3>

              <div id="adminProducts"></div>

              <br>

              <button
                class="btn btn-secondary"
                onclick="adminLogout()"
              >
                خروج مدیریت
              </button>

            </div>

          </div>

        </div>

      </div>

    </section>
    `,
    `
    <script>

    async function checkAdmin(){

      const response =
        await fetch("/api/admin/me");

      const data =
        await response.json();

      if(data.ok && data.admin){

        document.getElementById(
          "adminLogin"
        ).style.display="none";

        document.getElementById(
          "adminPanel"
        ).style.display="block";

        loadAdminProducts();
      }
    }

    async function adminLogin(){

      const username =
        document.getElementById(
          "adminUsername"
        ).value;

      const password =
        document.getElementById(
          "adminPassword"
        ).value;

      const response =
        await fetch("/api/admin/login",{
          method:"POST",
          headers:{
            "content-type":"application/json"
          },
          body:JSON.stringify({
            username,
            password
          })
        });

      const data =
        await response.json();

      if(!response.ok || !data.ok){

        alert(
          data.error ||
          "ورود مدیریت ناموفق بود."
        );

        return;
      }

      location.reload();
    }

    async function createProduct(){

      const name =
        document.getElementById(
          "productName"
        ).value;

      const description =
        document.getElementById(
          "productDescription"
        ).value;

      const price =
        document.getElementById(
          "productPrice"
        ).value;

      const image =
        document.getElementById(
          "productImage"
        ).value;

      const response =
        await fetch("/api/admin/products",{
          method:"POST",
          headers:{
            "content-type":"application/json"
          },
          body:JSON.stringify({
            name,
            description,
            price,
            image
          })
        });

      const data =
        await response.json();

      if(!response.ok || !data.ok){

        alert(
          data.error ||
          "افزودن محصول ناموفق بود."
        );

        return;
      }

      alert(
        "محصول با موفقیت اضافه شد."
      );

      document.getElementById(
        "productName"
      ).value="";

      document.getElementById(
        "productDescription"
      ).value="";

      document.getElementById(
        "productPrice"
      ).value="";

      loadAdminProducts();
    }

    async function loadAdminProducts(){

      const response =
        await fetch("/api/products");

      const data =
        await response.json();

      const container =
        document.getElementById(
          "adminProducts"
        );

      if(!data.ok || !data.products.length){

        container.innerHTML =
          "<div class='notice'>" +
          "هنوز محصولی ثبت نشده است." +
          "</div>";

        return;
      }

      container.innerHTML =
        data.products.map(function(product){

          return `
            <div
              style="
                background:#fafafa;
                border:1px solid #eee;
                padding:14px;
                border-radius:12px;
                margin-bottom:10px;
              "
            >
              <strong>
                ${escapeHTML(product.name)}
              </strong>

              <br>

              <span>
                ${formatPriceClient(product.price)}
              </span>

              <br>

              <small>
                شناسه محصول:
                ${Number(product.id)}
              </small>
            </div>
          `;

        }).join("");
    }

    async function adminLogout(){

      await fetch(
        "/api/admin/logout",
        {method:"POST"}
      );

      location.reload();
    }

    checkAdmin();

    </script>
    `
  );
}

export default {

  async fetch(request, env) {

    const url =
      new URL(request.url);

    const path =
      url.pathname;

    const method =
      request.method;

    try {

      // =========================================
      // HOME
      // =========================================

      if(
        path === "/" &&
        method === "GET"
      ){

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

        return html(
          homePage(result.results || [])
        );
      }

      // =========================================
      // HEALTH
      // =========================================

      if(
        path === "/health" &&
        method === "GET"
      ){

        return json({
          ok:true,
          store:STORE_EN,
          database:true,
          time:new Date().toISOString()
        });
      }

      // =========================================
      // PRODUCTS
      // =========================================

      if(
        path === "/api/products" &&
        method === "GET"
      ){

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

        return json({
          ok:true,
          products:result.results || []
        });
      }

      // =========================================
      // CURRENT USER
      // =========================================

      if(
        path === "/api/me" &&
        method === "GET"
      ){

        const user =
          await getCurrentUser(
            request,
            env
          );

        return json({
          ok:!!user,
          user:user || null
        });
      }

      // =========================================
      // REGISTER
      // =========================================

      if(
        path === "/api/register" &&
        method === "POST"
      ){

        const body =
          await readJSON(request);

        const username =
          String(body.username || "")
            .trim();

        const email =
          String(body.email || "")
            .trim()
            .toLowerCase();

        const password =
          String(body.password || "");

        if(
          username.length < 3 ||
          email.length < 5 ||
          password.length < 4
        ){

          return json({
            ok:false,
            error:
              "نام کاربری، ایمیل یا رمز عبور معتبر نیست."
          },400);
        }

        const existing =
          await env.DB.prepare(`
            SELECT id
            FROM users
            WHERE username = ?
               OR email = ?
            LIMIT 1
          `)
            .bind(
              username,
              email
            )
            .first();

        if(existing){

          return json({
            ok:false,
            error:
              "نام کاربری یا ایمیل قبلاً ثبت شده است."
          },409);
        }

        const passwordHash =
          await hashPassword(password);

        const result =
          await env.DB.prepare(`
            INSERT INTO users
              (
                username,
                email,
                password_hash,
                created_at
              )
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

        const userId =
          result.meta?.last_row_id;

        const token =
          crypto.randomUUID();

        const expires =
          new Date(
            Date.now() +
            1000 * 60 * 60 * 24 * 30
          ).toISOString();

        await env.DB.prepare(`
          INSERT INTO sessions
            (
              id,
              token,
              user_id,
              created_at,
              expires_at
            )
          VALUES
            (?, ?, ?, ?, ?)
        `)
          .bind(
            crypto.randomUUID(),
            token,
            userId,
            new Date().toISOString(),
            expires
          )
          .run();

        return responseWithCookie(
          {
            ok:true,
            message:"ثبت‌نام با موفقیت انجام شد.",
            user:{
              id:userId,
              username,
              email
            }
          },
          setCookie(
            "dm_session",
            token,
            60 * 60 * 24 * 30
          )
        );
      }

      // =========================================
      // LOGIN
      // =========================================

      if(
        path === "/api/login" &&
        method === "POST"
      ){

        const body =
          await readJSON(request);

        const identifier =
          String(
            body.identifier || ""
          ).trim();

        const password =
          String(
            body.password || ""
          );

        const user =
          await env.DB.prepare(`
            SELECT
              id,
              username,
              email,
              password_hash
            FROM users
            WHERE username = ?
               OR email = ?
            LIMIT 1
          `)
            .bind(
              identifier,
              identifier.toLowerCase()
            )
            .first();

        if(!user){

          return json({
            ok:false,
            error:
              "نام کاربری یا ایمیل پیدا نشد."
          },401);
        }

        const valid =
          await verifyPassword(
            password,
            user.password_hash
          );

        if(!valid){

          return json({
            ok:false,
            error:
              "رمز عبور اشتباه است."
          },401);
        }

        const token =
          crypto.randomUUID();

        const expires =
          new Date(
            Date.now() +
            1000 * 60 * 60 * 24 * 30
          ).toISOString();

        await env.DB.prepare(`
          INSERT INTO sessions
            (
              id,
              token,
              user_id,
              created_at,
              expires_at
            )
          VALUES
            (?, ?, ?, ?, ?)
        `)
          .bind(
            crypto.randomUUID(),
            token,
            user.id,
            new Date().toISOString(),
            expires
          )
          .run();

        return responseWithCookie(
          {
            ok:true,
            message:"ورود موفق بود.",
            user:{
              id:user.id,
              username:user.username,
              email:user.email
            }
          },
          setCookie(
            "dm_session",
            token,
            60 * 60 * 24 * 30
          )
        );
      }

      // =========================================
      // LOGOUT
      // =========================================

      if(
        path === "/api/logout" &&
        method === "POST"
      ){

        const token =
          cookieValue(
            request,
            "dm_session"
          );

        if(token){

          await env.DB.prepare(`
            DELETE FROM sessions
            WHERE token = ?
          `)
            .bind(token)
            .run();
        }

        return responseWithCookie(
          {
            ok:true
          },
          deleteCookie("dm_session")
        );
      }

      // =========================================
      // CREATE ORDER
      // =========================================

      if(
        path === "/api/orders" &&
        method === "POST"
      ){

        const user =
          await getCurrentUser(
            request,
            env
          );

        if(!user){

          return json(
            {
              ok:false,
              error:
                "برای ثبت سفارش ابتدا وارد حساب کاربری شوید."
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

        if(
          !Number.isFinite(productId) ||
          productId <= 0
        ){

          return json(
            {
              ok:false,
              error:
                "شناسه محصول نامعتبر است."
            },
            400
          );
        }

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

        if(!product){

          return json(
            {
              ok:false,
              error:
                "محصول موردنظر پیدا نشد."
            },
            404
          );
        }

        const normalizedPrice =
          normalizePrice(
            product.price
          );

        if(
          !Number.isFinite(normalizedPrice) ||
          normalizedPrice <= 0
        ){

          return json(
            {
              ok:false,
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
            (
              id,
              user_id,
              product_id,
              status,
              created_at
            )
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
          ok:true,
          message:
            "سفارش با موفقیت ثبت شد.",
          order:{
            id:orderId,
            product_id:product.id,
            product_name:product.name,
            price:normalizedPrice,
            price_display:
              formatPrice(normalizedPrice),
            status:"pending"
          }
        });
      }

      // =========================================
      // ADMIN LOGIN
      // =========================================

      if(
        path === "/api/admin/login" &&
        method === "POST"
      ){

        const body =
          await readJSON(request);

        const username =
          String(
            body.username ||
            DEFAULT_ADMIN_USERNAME
          ).trim();

        const password =
          String(
            body.password || ""
          );

        if(
          username !==
          DEFAULT_ADMIN_USERNAME
        ){

          return json({
            ok:false,
            error:
              "نام کاربری مدیریت نادرست است."
          },401);
        }

        if(
          !env.ADMIN_PASSWORD ||
          password !== env.ADMIN_PASSWORD
        ){

          return json({
            ok:false,
            error:
              "رمز مدیریت نادرست است."
          },401);
        }

        const token =
          crypto.randomUUID();

        const expires =
          new Date(
            Date.now() +
            1000 * 60 * 60 * 12
          ).toISOString();

        await env.DB.prepare(`
          INSERT INTO admin_sessions
            (
              id,
              token,
              username,
              created_at,
              expires_at
            )
          VALUES
            (?, ?, ?, ?, ?)
        `)
          .bind(
            crypto.randomUUID(),
            token,
            username,
            new Date().toISOString(),
            expires
          )
          .run();

        return responseWithCookie(
          {
            ok:true,
            message:
              "ورود مدیریت موفق بود."
          },
          setCookie(
            "dm_admin",
            token,
            60 * 60 * 12
          )
        );
      }

      // =========================================
      // ADMIN ME
      // =========================================

      if(
        path === "/api/admin/me" &&
        method === "GET"
      ){

        const admin =
          await getAdmin(
            request,
            env
          );

        return json({
          ok:!!admin,
          admin:admin
            ? {
                username:admin.username
              }
            : null
        });
      }

      // =========================================
      // ADMIN LOGOUT
      // =========================================

      if(
        path === "/api/admin/logout" &&
        method === "POST"
      ){

        const token =
          cookieValue(
            request,
            "dm_admin"
          );

        if(token){

          await env.DB.prepare(`
            DELETE FROM admin_sessions
            WHERE token = ?
          `)
            .bind(token)
            .run();
        }

        return responseWithCookie(
          {
            ok:true
          },
          deleteCookie("dm_admin")
        );
      }

      // =========================================
      // ADMIN CREATE PRODUCT
      // =========================================

      if(
        path === "/api/admin/products" &&
        method === "POST"
      ){

        const admin =
          await getAdmin(
            request,
            env
          );

        if(!admin){

          return json({
            ok:false,
            error:
              "دسترسی مدیریت لازم است."
          },401);
        }

        const body =
          await readJSON(request);

        const name =
          String(
            body.name || ""
          ).trim();

        const description =
          String(
            body.description || ""
          ).trim();

        const price =
          normalizePrice(
            body.price
          );

        const image =
          String(
            body.image || "🛍️"
          ).trim();

        if(!name){

          return json({
            ok:false,
            error:
              "نام محصول الزامی است."
          },400);
        }

        if(
          !Number.isFinite(price) ||
          price <= 0
        ){

          return json({
            ok:false,
            error:
              "قیمت محصول معتبر نیست."
          },400);
        }

        // مهم:
        // products.id از نوع INTEGER AUTOINCREMENT است.
        // اینجا نباید crypto.randomUUID() برای id استفاده شود.

        const result =
          await env.DB.prepare(`
            INSERT INTO products
              (
                name,
                description,
                price,
                image,
                created_at
              )
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

        return json({
          ok:true,
          message:
            "محصول با موفقیت اضافه شد.",
          product:{
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

      // =========================================
      // ACCOUNT PAGE
      // =========================================

      if(
        path === "/account" &&
        method === "GET"
      ){

        return html(
          accountPage()
        );
      }

      // =========================================
      // ADMIN PAGE
      // =========================================

      if(
        path === "/admin" &&
        method === "GET"
      ){

        return html(
          adminPage()
        );
      }

      // =========================================
      // 404
      // =========================================

      return json(
        {
          ok:false,
          error:"صفحه پیدا نشد."
        },
        404
      );

    } catch(error){

      return json(
        {
          ok:false,
          error:
            "خطای داخلی سرور.",
          detail:
            error?.message ||
            String(error)
        },
        500
      );
    }
  }
};


// =========================================
// PASSWORD HASH
// =========================================

async function hashPassword(password){

  const data =
    new TextEncoder().encode(
      password
    );

  const hash =
    await crypto.subtle.digest(
      "SHA-256",
      data
    );

  return Array
    .from(new Uint8Array(hash))
    .map(function(byte){
      return byte
        .toString(16)
        .padStart(2,"0");
    })
    .join("");
}

async function verifyPassword(
  password,
  passwordHash
){

  const hash =
    await hashPassword(password);

  return hash === passwordHash;
     }
