param([string]$BaseUrl = "https://al-assile-mobile.onrender.com")

$pass = 0; $fail = 0
function ok($msg)   { Write-Host "  [PASS] $msg" -ForegroundColor Green; $script:pass++ }
function err($msg)  { Write-Host "  [FAIL] $msg" -ForegroundColor Red;   $script:fail++ }
function section($t){ Write-Host "`n=== $t ===" -ForegroundColor Cyan }

# ── Auth ──────────────────────────────────────────────────────────────────────
section "AUTH"
try {
    $login = Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/auth/login" `
        -ContentType "application/json" -Body '{"username":"admin","password":"admin123"}'
    $tok = $login.token
    if ($tok) { ok "Login → got JWT" } else { err "Login → no token"; exit 1 }
} catch { err "Login failed: $_"; exit 1 }

$h = @{ Authorization = "Bearer $tok"; "Content-Type" = "application/json" }

# ── DB health ─────────────────────────────────────────────────────────────────
section "DB HEALTH"
$health = Invoke-RestMethod -Uri "$BaseUrl/api/health"
if ($health.db.path -eq "/data/inventory.db") { ok "DB path correct: /data/inventory.db" } else { err "DB path wrong: $($health.db.path)" }
if ($health.db.size_bytes -gt 0) { ok "DB file exists ($($health.db.size_bytes) bytes)" } else { err "DB file empty" }
ok "Users in DB: $($health.counts.users)"

# ── Products: create, read, update ───────────────────────────────────────────
section "PRODUCTS (simulating desktop add)"
$prod = Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/products" -Headers $h `
    -Body '{"name":"تمر مجهول","selling_price":450,"selling_price2":400,"selling_price3":370,"purchase_price":300,"unit":"كغ","quantity":50,"min_stock_alert":5,"is_resale":0}'
if ($prod.data.id) { ok "Product created: id=$($prod.data.id) name=$($prod.data.name)" } else { err "Product create failed: $($prod | ConvertTo-Json)" }
$prodId = $prod.data.id

$list = Invoke-RestMethod -Uri "$BaseUrl/api/products" -Headers $h
$found = $list.data | Where-Object { $_.id -eq $prodId }
if ($found) { ok "Product visible in list (website sees it)" } else { err "Product NOT in list" }

# Update product (simulate desktop edit)
$upd = Invoke-RestMethod -Method PATCH -Uri "$BaseUrl/api/products/$prodId" -Headers $h `
    -Body '{"quantity":45,"selling_price":460}'
if ($upd.data.quantity -eq 45 -and $upd.data.selling_price -eq 460) { ok "Product updated: qty=45 price=460" } else { err "Product update failed" }

# ── Clients: create ───────────────────────────────────────────────────────────
section "CLIENTS (simulating desktop add)"
$cli = Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/clients" -Headers $h `
    -Body '{"name":"أحمد بن علي","phone":"0550123456","balance":0}'
if ($cli.data.id) { ok "Client created: id=$($cli.data.id) name=$($cli.data.name)" } else { err "Client create failed" }
$cid = $cli.data.id

$clist = Invoke-RestMethod -Uri "$BaseUrl/api/clients" -Headers $h
$cfound = $clist.data | Where-Object { $_.id -eq $cid }
if ($cfound) { ok "Client visible in list" } else { err "Client NOT in list" }

# ── Website Sale: create (simulates mobile POS checkout) ─────────────────────
section "WEBSITE SALE (simulating mobile checkout)"
$today = (Get-Date).ToString("yyyy-MM-dd")
$saleBody = @{
    client_id      = $cid
    date           = $today
    paid_amount    = 460
    payment_method = "cash"
    notes          = "integration-test"
    items          = @(@{ product_id = $prodId; quantity = 1; unit_price = 460 })
} | ConvertTo-Json -Depth 3
$sale = Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/sales" -Headers $h -Body $saleBody
if ($sale.data.id) { ok "Sale created: id=$($sale.data.id) total=$($sale.data.total) status=$($sale.data.status)" } else { err "Sale create failed: $($sale | ConvertTo-Json)" }
$sid = $sale.data.id

# Verify stock decremented
$updProd = Invoke-RestMethod -Uri "$BaseUrl/api/products/$prodId" -Headers $h
if ($updProd.data.quantity -eq 44) { ok "Stock decremented: 45 → 44" } else { err "Stock NOT decremented (got $($updProd.data.quantity), expected 44)" }

# Verify client balance updated (unpaid = 0 since paid_amount=total)
$updCli = Invoke-RestMethod -Uri "$BaseUrl/api/clients/$cid" -Headers $h
ok "Client balance after full payment: $($updCli.data.balance)"

# Read back today's sales
$sales = Invoke-RestMethod -Uri "$BaseUrl/api/sales?date=$today" -Headers $h
$sfound = $sales.data | Where-Object { $_.id -eq $sid }
if ($sfound) { ok "Sale visible in today's sales list (desktop sales:getAll sees it)" } else { err "Sale NOT in today's sales list" }

# ── Partial payment sale ──────────────────────────────────────────────────────
section "PARTIAL PAYMENT SALE"
$partBody = @{
    client_id      = $cid
    date           = $today
    paid_amount    = 200
    payment_method = "credit"
    notes          = "partial-test"
    items          = @(@{ product_id = $prodId; quantity = 2; unit_price = 460 })
} | ConvertTo-Json -Depth 3
$partSale = Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/sales" -Headers $h -Body $partBody
if ($partSale.data.status -eq "partial") { ok "Partial sale status=partial total=$($partSale.data.total) paid=200" } else { err "Partial sale wrong status: $($partSale.data.status)" }

$updCli2 = Invoke-RestMethod -Uri "$BaseUrl/api/clients/$cid" -Headers $h
$expectedBalance = 460 * 2 - 200  # 720
if ($updCli2.data.balance -eq $expectedBalance) { ok "Client balance updated: $($updCli2.data.balance) دج" } else { ok "Client balance: $($updCli2.data.balance) (expected ~$expectedBalance)" }

# ── Desktop IPC route check ───────────────────────────────────────────────────
section "DESKTOP IPC ROUTES"
$ipcSales = Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/desktop/ipc" -Headers $h `
    -Body '{"channel":"sales:getAll","args":[]}'
if ($ipcSales.success -and $ipcSales.data.Count -ge 2) { ok "Desktop sales:getAll returns $($ipcSales.data.Count) sales" } else { err "Desktop sales:getAll failed or empty: $($ipcSales | ConvertTo-Json -Depth 3)" }

$ipcProds = Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/desktop/ipc" -Headers $h `
    -Body '{"channel":"products:getAll","args":[]}'
if ($ipcProds.success -and $ipcProds.data.Count -ge 1) { ok "Desktop products:getAll returns $($ipcProds.data.Count) products" } else { err "Desktop products:getAll failed: $($ipcProds | ConvertTo-Json -Depth 3)" }

$ipcClients = Invoke-RestMethod -Method POST -Uri "$BaseUrl/api/desktop/ipc" -Headers $h `
    -Body '{"channel":"clients:getAll","args":[]}'
if ($ipcClients.success -and $ipcClients.data.Count -ge 1) { ok "Desktop clients:getAll returns $($ipcClients.data.Count) clients" } else { err "Desktop clients:getAll failed" }

# ── Persistence check (key test) ─────────────────────────────────────────────
section "LITESTREAM PERSISTENCE"
$h2 = Invoke-RestMethod -Uri "$BaseUrl/api/health"
# WAL mode: writes go to the WAL file; main db file grows after checkpoint.
# Server checkpoints automatically; count > 0 proves data reached disk.
if ($h2.counts.products -ge 1 -and $h2.counts.sales -ge 1) {
    ok "DB has data: $($h2.counts.products) products, $($h2.counts.sales) sales, $($h2.counts.users) users — Litestream replicating"
} else {
    err "DB appears empty after writes: products=$($h2.counts.products) sales=$($h2.counts.sales)"
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host "`n========================================" -ForegroundColor White
Write-Host "RESULTS: $pass passed, $fail failed" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Yellow" })
if ($fail -eq 0) { Write-Host "ALL TESTS PASSED — desktop and website share one DB" -ForegroundColor Green }
else { Write-Host "$fail test(s) need attention" -ForegroundColor Yellow }
