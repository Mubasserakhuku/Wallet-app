/* app.js - boot: picks the admin or customer app */
/* ---------- Boot ---------- */
(document.body.classList.contains("admin")?initAdmin:initCustomer)();
