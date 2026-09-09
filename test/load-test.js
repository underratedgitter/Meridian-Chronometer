/**
 * Meridian Chronometer — High-Concurrency Load Test (1,000 Concurrent Users)
 * Simulates 1,000 concurrent virtual users over HTTP keep-alive connections.
 * Measures:
 *   - Requests Per Second (RPS / Throughput)
 *   - Latency distribution (p50, p90, p95, p99, min, max, avg)
 *   - Error / drop rate (asserts 0.00%)
 *   - Memory RSS delta
 *   - Event-loop delay / lag
 */

import http from 'node:http';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';

const TARGET_PORT = parseInt(process.env.PORT, 10) || 8085;
const TARGET_HOST = '127.0.0.1';
const CONCURRENT_USERS = 1000;
const TEST_DURATION_MS = 6000; // 6 seconds sustained burst
const REQUEST_TIMEOUT_MS = 5000;

// Reusable HTTP Keep-Alive Agent for 1,000 concurrent sockets
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: CONCURRENT_USERS + 50,
  maxFreeSockets: CONCURRENT_USERS,
  timeout: REQUEST_TIMEOUT_MS
});

// Paths to simulate realistic user browsing
const TEST_ENDPOINTS = [
  { path: '/', headers: { 'Accept-Encoding': 'gzip' } },
  { path: '/src/styles/chronometer.css', headers: { 'Accept-Encoding': 'gzip' } },
  { path: '/src/index.js', headers: { 'Accept-Encoding': 'gzip' } },
  { path: '/src/engine/astronomy.js', headers: { 'Accept-Encoding': 'gzip' } }
];

function makeRequest(endpoint, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const options = {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: endpoint.path,
      method: 'GET',
      agent,
      headers: {
        'User-Agent': 'MeridianLoadTest/1.0',
        ...endpoint.headers,
        ...extraHeaders
      }
    };

    const req = http.request(options, (res) => {
      let dataLen = 0;
      res.on('data', (chunk) => {
        dataLen += chunk.length;
      });
      res.on('end', () => {
        const duration = performance.now() - start;
        resolve({
          statusCode: res.statusCode,
          duration,
          bytes: dataLen,
          etag: res.headers['etag']
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('Request timeout'));
    });

    req.end();
  });
}

function computePercentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const index = Math.min(
    Math.floor((p / 100) * sortedArr.length),
    sortedArr.length - 1
  );
  return sortedArr[index];
}

async function runLoadTest() {
  console.log('═'.repeat(72));
  console.log(`🚀 MERIDIAN CHRONOMETER — HIGH-CONCURRENCY LOAD TEST`);
  console.log(`   Target: http://${TARGET_HOST}:${TARGET_PORT}/`);
  console.log(`   Simulated Concurrency: ${CONCURRENT_USERS} Concurrent Virtual Users`);
  console.log(`   Sustained Duration:    ${TEST_DURATION_MS / 1000} seconds`);
  console.log('═'.repeat(72));

  // Initialize event loop delay histogram
  const elDelayHistogram = monitorEventLoopDelay({ resolution: 10 });
  elDelayHistogram.enable();

  const memInitial = process.memoryUsage();
  const latencies = [];
  let totalRequests = 0;
  let successCount = 0;
  let notModifiedCount = 0;
  let errorCount = 0;
  let totalBytesTransferred = 0;
  const errors = [];

  // Warmup probe to fetch valid ETag for conditional requests
  let cachedEtag = null;
  try {
    const probe = await makeRequest({ path: '/' });
    cachedEtag = probe.etag;
    console.log(`✓ Probe successful (Status ${probe.statusCode}, ETag: ${cachedEtag})`);
  } catch (err) {
    console.error(`❌ Warmup probe failed: Could not connect to http://${TARGET_HOST}:${TARGET_PORT}/`);
    console.error(err);
    process.exit(1);
  }

  const startTime = performance.now();
  const endTime = startTime + TEST_DURATION_MS;

  // Worker loop for a single concurrent user
  const etagsByPath = new Map();
  if (cachedEtag) etagsByPath.set('/', cachedEtag);

  async function userWorker(workerId) {
    let reqIndex = 0;
    while (performance.now() < endTime) {
      const endpoint = TEST_ENDPOINTS[reqIndex % TEST_ENDPOINTS.length];
      // Every 4th request tests conditional 304 ETag caching on that endpoint
      const isConditional = reqIndex % 4 === 3 && etagsByPath.has(endpoint.path);
      const extraHeaders = isConditional ? { 'If-None-Match': etagsByPath.get(endpoint.path) } : {};

      totalRequests++;
      try {
        const res = await makeRequest(endpoint, extraHeaders);
        latencies.push(res.duration);
        totalBytesTransferred += res.bytes;

        if (res.statusCode === 200) {
          successCount++;
          if (res.etag) etagsByPath.set(endpoint.path, res.etag);
        } else if (res.statusCode === 304) {
          notModifiedCount++;
        } else {
          errorCount++;
          if (errors.length < 5) errors.push(`Unexpected HTTP ${res.statusCode} on ${endpoint.path}`);
        }
      } catch (err) {
        errorCount++;
        if (errors.length < 5) errors.push(err.message);
      }
      reqIndex++;
    }
  }

  console.log(`\n⚡ Ramping up ${CONCURRENT_USERS} concurrent keep-alive connections...`);
  const workerPromises = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    workerPromises.push(userWorker(i));
  }

  await Promise.all(workerPromises);
  const actualDurationMs = performance.now() - startTime;
  elDelayHistogram.disable();

  const memFinal = process.memoryUsage();
  agent.destroy();

  // Statistical calculations
  latencies.sort((a, b) => a - b);
  const sumLatency = latencies.reduce((acc, v) => acc + v, 0);
  const avgLatency = latencies.length > 0 ? sumLatency / latencies.length : 0;
  const p50 = computePercentile(latencies, 50);
  const p90 = computePercentile(latencies, 90);
  const p95 = computePercentile(latencies, 95);
  const p99 = computePercentile(latencies, 99);
  const minLatency = latencies[0] || 0;
  const maxLatency = latencies[latencies.length - 1] || 0;

  const actualDurationSec = actualDurationMs / 1000;
  const throughputRps = totalRequests / actualDurationSec;
  const errorRate = (errorCount / totalRequests) * 100;
  const mbTransferred = (totalBytesTransferred / (1024 * 1024)).toFixed(2);
  const bandwidthMbps = ((totalBytesTransferred * 8) / (actualDurationSec * 1000000)).toFixed(2);

  const rssDeltaMB = ((memFinal.rss - memInitial.rss) / (1024 * 1024)).toFixed(2);
  const elMeanMs = (elDelayHistogram.mean / 1e6).toFixed(2);
  const elP99Ms = (elDelayHistogram.percentile(99) / 1e6).toFixed(2);

  console.log('\n' + '═'.repeat(72));
  console.log(`📊 LOAD TEST RESULTS & TELEMETRY REPORT`);
  console.log('═'.repeat(72));
  console.log(`  Throughput:             ${throughputRps.toFixed(2)} Req/sec`);
  console.log(`  Total Requests:         ${totalRequests.toLocaleString()}`);
  console.log(`  Successful (200 OK):    ${successCount.toLocaleString()}`);
  console.log(`  Cached (304 Not Mod):   ${notModifiedCount.toLocaleString()}`);
  console.log(`  Failed / Dropped:       ${errorCount} (${errorRate.toFixed(2)}%)`);
  console.log(`  Data Transferred:       ${mbTransferred} MB (${bandwidthMbps} Mbps)`);
  console.log('-'.repeat(72));
  console.log(`  Latency (Distribution):`);
  console.log(`    • Min:                ${minLatency.toFixed(2)} ms`);
  console.log(`    • Average:            ${avgLatency.toFixed(2)} ms`);
  console.log(`    • p50 (Median):       ${p50.toFixed(2)} ms`);
  console.log(`    • p90:                ${p90.toFixed(2)} ms`);
  console.log(`    • p95:                ${p95.toFixed(2)} ms`);
  console.log(`    • p99:                ${p99.toFixed(2)} ms`);
  console.log(`    • Max:                ${maxLatency.toFixed(2)} ms`);
  console.log('-'.repeat(72));
  console.log(`  Runtime Telemetry:`);
  console.log(`    • Final Node.js RSS:  ${(memFinal.rss / (1024 * 1024)).toFixed(2)} MB (Delta: ${rssDeltaMB} MB)`);
  console.log(`    • Event-Loop Mean:    ${elMeanMs} ms`);
  console.log(`    • Event-Loop p99:     ${elP99Ms} ms`);
  console.log('═'.repeat(72));

  if (errors.length > 0) {
    console.error(`Sample errors encountered:`, errors);
  }

  if (errorRate === 0) {
    console.log(`\n🎉 SUCCESS: 0.00% Error Rate achieved under 1,000 concurrent connections!`);
    process.exit(0);
  } else {
    console.error(`\n❌ FAILED: Error rate was ${errorRate.toFixed(2)}% (must be 0.00%)`);
    process.exit(1);
  }
}

runLoadTest().catch((err) => {
  console.error('Fatal load test runner error:', err);
  process.exit(1);
});
