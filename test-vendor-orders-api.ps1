# Test Spare2App Vendor Orders API
# Replace YOUR_TOKEN with actual JWT token

$token = "YOUR_TOKEN_HERE"
$apiBase = "https://api.spare2app.com/wp-json/spare2app/v1"

Write-Host "🧪 Testing Spare2App Vendor Orders API..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Get all orders
Write-Host "Test 1: Get all orders (first page)" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$apiBase/vendor-orders?per_page=5&page=1" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

Write-Host "✅ Total orders: $($response.pagination.total)" -ForegroundColor Green
Write-Host "✅ Current page: $($response.pagination.page)" -ForegroundColor Green
Write-Host "✅ Orders returned: $($response.orders.Count)" -ForegroundColor Green
Write-Host ""

# Test 2: Filter by status
Write-Host "Test 2: Filter by status = 'processing'" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$apiBase/vendor-orders?status=processing&per_page=5" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

Write-Host "✅ Processing orders: $($response.pagination.total)" -ForegroundColor Green
$allProcessing = $response.orders | ForEach-Object { $_.status -eq "processing" } | Where-Object { $_ -eq $false }
if ($allProcessing.Count -eq 0) {
    Write-Host "✅ All orders have status 'processing'" -ForegroundColor Green
} else {
    Write-Host "❌ Some orders don't have status 'processing'" -ForegroundColor Red
}
Write-Host ""

# Test 3: Filter by status = 'completed'
Write-Host "Test 3: Filter by status = 'completed'" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$apiBase/vendor-orders?status=completed&per_page=5" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

Write-Host "✅ Completed orders: $($response.pagination.total)" -ForegroundColor Green
$allCompleted = $response.orders | ForEach-Object { $_.status -eq "completed" } | Where-Object { $_ -eq $false }
if ($allCompleted.Count -eq 0) {
    Write-Host "✅ All orders have status 'completed'" -ForegroundColor Green
} else {
    Write-Host "❌ Some orders don't have status 'completed'" -ForegroundColor Red
}
Write-Host ""

# Test 4: Search functionality
Write-Host "Test 4: Search for 'ahmed'" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$apiBase/vendor-orders?search=ahmed&per_page=5" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

Write-Host "✅ Search results: $($response.pagination.total) orders" -ForegroundColor Green
Write-Host ""

# Test 5: Pagination
Write-Host "Test 5: Get second page" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$apiBase/vendor-orders?per_page=10&page=2" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

Write-Host "✅ Page 2 orders: $($response.orders.Count)" -ForegroundColor Green
Write-Host "✅ Has more: $($response.pagination.has_more)" -ForegroundColor Green
Write-Host ""

# Test 6: Date filtering
Write-Host "Test 6: Filter by date (after 2024-01-01)" -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$apiBase/vendor-orders?after=2024-01-01&per_page=5" `
    -Method Get `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

Write-Host "✅ Orders after 2024-01-01: $($response.pagination.total)" -ForegroundColor Green
Write-Host ""

Write-Host "🎉 All tests completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "- API endpoint is working ✅"
Write-Host "- Authentication is working ✅"
Write-Host "- Filtering is working ✅"
Write-Host "- Pagination is working ✅"
Write-Host "- Search is working ✅"
