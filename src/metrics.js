const config = require("./config");
const os = require("os");
let lastCpuUsage = os.cpus();

function getCpuUsagePercentage() {
  const currentCpuUsage = os.cpus();

  let totalIdle = 0;
  let totalTick = 0;

  for (let i = 0; i < currentCpuUsage.length; i++) {
    const start = lastCpuUsage[i].times;
    const end = currentCpuUsage[i].times;

    for (const type in end) {
      totalTick += end[type] - start[type];
    }
    totalIdle += end.idle - start.idle;
  }

  const idleDiff = totalIdle;
  const totalDiff = totalTick;
  const usage = 1 - idleDiff / totalDiff;

  lastCpuUsage = currentCpuUsage;

  return Number((usage * 100).toFixed(2));
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return Number(memoryUsage.toFixed(2));
}

const requests = {};
const activeUsers = {};
const latencies = {};

function recordLatency(type, ms) {
  latencies[type] = ms;
}

// Periodically send the collected data to Grafana
setInterval(() => {
  const metrics = [];
  const now = Date.now();
  const fifteenMinutesInMs = 15 * 60 * 1000;

  let activeCount = 0;
  for (const [userId, lastSeen] of Object.entries(activeUsers)) {
    if (now - lastSeen < fifteenMinutesInMs) {
      activeCount++;
    } else {
      delete activeUsers[userId];
    }
  }

  metrics.push(
    createMetric("active_users", activeCount, "1", "gauge", "asInt", {}),
  );

  for (const [key, count] of Object.entries(requests)) {
    let metricName = "http_requests_total";
    let attributes = {};

    if (key.startsWith("auth_")) {
      metricName = "auth_attempts_total";
      attributes = { outcome: key.replace("auth_", "") };
    } else {
      const isMethod = key.startsWith("method_");
      const label = isMethod ? key.replace("method_", "") : key;
      attributes = { [isMethod ? "method" : "endpoint"]: label };
    }

    metrics.push(
      createMetric(metricName, count, "1", "sum", "asInt", attributes),
    );
  }

  const cpuRes = getCpuUsagePercentage();
  const memRes = getMemoryUsagePercentage();

  metrics.push(
    createMetric("cpu_usage_percent", cpuRes, "%", "gauge", "asDouble", {}),
  );
  metrics.push(
    createMetric("memory_usage_percent", memRes, "%", "gauge", "asDouble", {}),
  );

  metrics.push(
    createMetric("pizzas_sold_total", totalPizzasSold, "1", "sum", "asInt", {}),
  );
  metrics.push(
    createMetric(
      "creation_failures_total",
      totalCreationFailures,
      "1",
      "sum",
      "asInt",
      {},
    ),
  );
  metrics.push(
    createMetric("revenue_total", totalRevenue, "USD", "sum", "asDouble", {}),
  );

  for (const [type, ms] of Object.entries(latencies)) {
    metrics.push(
      createMetric(`${type}_latency_ms`, ms, "ms", "gauge", "asDouble", {}),
    );
  }

  if (metrics.length > 0) sendMetricToGrafana(metrics);
}, 5000); // Send every 5 seconds (adjust as needed)

// Middleware to track requests
function requestTracker(req, res, next) {
  const method = req.method; // "GET", "POST", etc.
  requests[method] = (requests[method] || 0) + 1;

  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    recordLatency("service", duration);
  });

  next();
}

function activeUserTracker(req, res, next) {
  if (req.user && req.user.id) {
    activeUsers[req.user.id] = Date.now();
  }
  next();
}

function incrementAuthAttempt(outcome) {
  const key = `auth_${outcome}`;
  requests[key] = (requests[key] || 0) + 1;
}

let totalPizzasSold = 0;
let totalCreationFailures = 0;
let totalRevenue = 0;

function incrementPizzaMetrics(pizzaCount, revenue, isFailure) {
  if (isFailure) {
    totalCreationFailures++;
  } else {
    totalPizzasSold += pizzaCount;
    totalRevenue += revenue;
  }
}

function createMetric(
  metricName,
  metricValue,
  metricUnit,
  metricType,
  valueType,
  attributes,
) {
  attributes = { ...attributes, source: config.metrics.source };

  const metric = {
    name: metricName,
    unit: metricUnit,
    [metricType]: {
      dataPoints: [
        {
          [valueType]: metricValue,
          timeUnixNano: Date.now() * 1000000,
          attributes: [],
        },
      ],
    },
  };

  Object.keys(attributes).forEach((key) => {
    metric[metricType].dataPoints[0].attributes.push({
      key: key,
      value: { stringValue: attributes[key] },
    });
  });

  if (metricType === "sum") {
    metric[metricType].aggregationTemporality =
      "AGGREGATION_TEMPORALITY_CUMULATIVE";
    metric[metricType].isMonotonic = true;
  }

  return metric;
}

function sendMetricToGrafana(metrics) {
  const endpoint = config.metrics.endpointUrl;
  const accountId = config.metrics.accountId;
  const apiKey = config.metrics.apiKey;

  if (!endpoint || endpoint === "undefined") {
    console.error(
      "Endpoint is undefined. Full config:",
      JSON.stringify(config),
    );
    return;
  }

  const body = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics,
          },
        ],
      },
    ],
  };

  fetch(`${endpoint}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${accountId}:${apiKey}`,
      "Content-Type": "application/json",
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Grafana Rejected Metrics (${response.status}): ${errorText}`,
        );
      } else {
        console.log(
          `Successfully pushed metrics to Grafana at ${new Date().toLocaleTimeString()}`,
        );
      }
    })
    .catch((error) => {
      console.error("Error pushing metrics:", error);
    });
}

module.exports = {
  requestTracker,
  activeUserTracker,
  createMetric,
  sendMetricToGrafana,
  incrementAuthAttempt,
  incrementPizzaMetrics,
  recordLatency,
};
