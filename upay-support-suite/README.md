# upay Support Suite (plain HTML + CSS + JS)

Files
- index.html  customer app (wallet + live chat)
- admin.html  admin console (live chat inbox with AI analysis, customers, transactions, FAQ, policies, announcements)
- style.css   all styles
- app.js      ALL logic in one file: AI assistant, storage, customer app, live chat, admin

Run
Best: serve the folder, then open both pages in two tabs.
    python3 -m http.server 8000
    http://localhost:8000/index.html   (customer)
    http://localhost:8000/admin.html   (admin)
Chrome can also open the files directly (double click). Firefox needs the local server.

More customers: index.html?u=rahim&n=Rahim  (each ?u= is a separate customer)

Data lives in the browser (localStorage) and syncs between tabs on the same browser.
To go multi-device, replace makeDb() in app.js with calls to a backend (FastAPI + PostgreSQL).
All data is synthetic. Reply texts are samples, replace them with upay-approved wording (KB in app.js).
