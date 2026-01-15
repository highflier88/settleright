# Load Testing with k6

This directory contains load testing scripts for the arbitration platform.

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Debian/Ubuntu
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

## Quick Start

```bash
# Run basic API load test
k6 run load-tests/api-load.js

# Run 100 concurrent cases test
k6 run load-tests/concurrent-100-cases.js

# Run with custom base URL
BASE_URL=https://staging.settleright.ai k6 run load-tests/api-load.js
```

## Test Scenarios

### api-load.js

Basic API endpoint load testing:

- Case listing
- Case creation
- Evidence upload

### case-flow-load.js

Full case lifecycle load testing:

- Case initiation
- Evidence submission
- Statement submission
- Status monitoring

### arbitrator-load.js

Arbitrator workflow load testing:

- Case queue loading
- Draft award review
- Award signing

### concurrent-100-cases.js ⭐ NEW

**100 Concurrent Cases Load Test**

Simulates 100 simultaneous active cases being processed through the full lifecycle:

- Ramps up to 100 concurrent virtual users
- Each VU creates and manages a case through:
  - Case creation
  - Evidence uploads (2-4 files per case)
  - Statement submission
  - Agreement signing
  - Status monitoring
- Maintains load for 10 minutes at peak
- Includes background health checks

**Run:**

```bash
k6 run load-tests/concurrent-100-cases.js
```

**Expected Duration:** ~23 minutes

**Performance Targets:**
| Metric | Target |
|--------|--------|
| Response Time (p95) | < 2000ms |
| Response Time (p99) | < 5000ms |
| Error Rate | < 5% |
| Case Creation Time (p95) | < 3000ms |
| Full Cycle Time (avg) | < 60s |

## Running Tests

### Basic Load Test

```bash
k6 run load-tests/api-load.js
```

### With Custom Options

```bash
# Custom virtual users and duration
k6 run --vus 50 --duration 5m load-tests/api-load.js

# Custom iterations
k6 run --iterations 1000 load-tests/api-load.js
```

### Generate HTML Report

```bash
K6_WEB_DASHBOARD=true k6 run load-tests/api-load.js
```

### Environment Variables

```bash
export BASE_URL=https://staging.settleright.ai
export AUTH_TOKEN=your_test_token
k6 run load-tests/api-load.js
```

## Output Formats

```bash
# JSON output
k6 run --out json=load-tests/results/results.json load-tests/api-load.js

# CSV output
k6 run --out csv=load-tests/results/results.csv load-tests/api-load.js

# Cloud output (k6 Cloud)
k6 cloud load-tests/api-load.js

# InfluxDB (for Grafana dashboards)
k6 run --out influxdb=http://localhost:8086/k6 load-tests/api-load.js
```

## Thresholds

Default thresholds for all tests:

- 95th percentile response time < 500ms (basic) / < 2000ms (concurrent)
- Error rate < 5%
- Request success rate > 95%

## Test Results

Results are saved to `load-tests/results/`:

- `concurrent-100-summary.json` - 100 concurrent cases test summary
- `case-flow-summary.json` - Case flow test summary
- `api-load-summary.json` - API load test summary

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Load Tests
  run: |
    k6 run --out json=results.json load-tests/concurrent-100-cases.js

- name: Upload Results
  uses: actions/upload-artifact@v3
  with:
    name: load-test-results
    path: load-tests/results/
```

### Performance Regression Detection

```bash
# Compare against baseline
k6 run --out json=current.json load-tests/api-load.js
# Use k6 threshold checks for pass/fail
```

## Monitoring During Tests

1. **k6 Cloud Dashboard**: Real-time metrics when using k6 Cloud
2. **Grafana + InfluxDB**: Local dashboard with `--out influxdb`
3. **Terminal**: Live metrics during test execution

## Scaling Tests

For larger scale tests:

```bash
# 200 concurrent users
k6 run --vus 200 --duration 30m load-tests/concurrent-100-cases.js

# Distributed testing
k6 run --out cloud load-tests/concurrent-100-cases.js
```

## Troubleshooting

### Common Issues

1. **Connection refused**: Ensure the application is running

   ```bash
   npm run dev  # In another terminal
   ```

2. **Authentication errors**: Set valid auth token

   ```bash
   export AUTH_TOKEN=$(curl -s https://api.example.com/auth | jq -r .token)
   ```

3. **High error rates**: Check application logs and database connections

### Debug Mode

```bash
k6 run --http-debug=full load-tests/api-load.js
```
