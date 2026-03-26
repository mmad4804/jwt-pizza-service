const config = require("./config");
const os = require("os");
let lastCpuUsage = os.cpus();
let lastTimestamp = Date.now();

function getCpuUsagePercentage() {
  const currentCpuUsage = os.cpus();
  const currentTimestamp = Date.now();

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
  lastTimestamp = currentTimestamp;

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

  if (metrics.length > 0) sendMetricToGrafana(metrics);
}, 5000); // Send every 5 seconds (adjust as needed)

// Middleware to track requests
function requestTracker(req, res, next) {
  const method = req.method; // "GET", "POST", etc.
  requests[method] = (requests[method] || 0) + 1;

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

function createMetric(
  metricName,
  metricValue,
  metricUnit,
  metricType,
  valueType,
  attributes,
) {
  attributes = { ...attributes, source: config.source };

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

  fetch(`${config.endpointUrl}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${config.accountId}:${config.apiKey}`,
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
};

// let requests = 0;
// let latency = 0;

// setInterval(() => {
//   const cpuValue = Math.floor(Math.random() * 100) + 1;
//   sendMetricToGrafana("cpu", cpuValue, "gauge", "%");

//   requests += Math.floor(Math.random() * 200) + 1;
//   sendMetricToGrafana("requests", requests, "sum", "1");

//   latency += Math.floor(Math.random() * 200) + 1;
//   sendMetricToGrafana("latency", latency, "sum", "ms");
// }, 1000);

// function sendMetricToGrafana(metricName, metricValue, type, unit) {
//   const metric = {
//     resourceMetrics: [
//       {
//         scopeMetrics: [
//           {
//             metrics: [
//               {
//                 name: metricName,
//                 unit: unit,
//                 [type]: {
//                   dataPoints: [
//                     {
//                       asInt: metricValue,
//                       timeUnixNano: Date.now() * 1000000,
//                     },
//                   ],
//                 },
//               },
//             ],
//           },
//         ],
//       },
//     ],
//   };

//   if (type === "sum") {
//     metric.resourceMetrics[0].scopeMetrics[0].metrics[0][
//       type
//     ].aggregationTemporality = "AGGREGATION_TEMPORALITY_CUMULATIVE";
//     metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].isMonotonic =
//       true;
//   }

//   const body = JSON.stringify(metric);
//   fetch(`${config.endpointUrl}`, {
//     method: "POST",
//     body: body,
//     headers: {
//       Authorization: `Bearer ${config.accountId}:${config.apiKey}`,
//       "Content-Type": "application/json",
//     },
//   })
//     .then((response) => {
//       if (!response.ok) {
//         response.text().then((text) => {
//           console.error(
//             `Failed to push metrics data to Grafana: ${text}\n${body}`,
//           );
//         });
//       } else {
//         console.log(`Pushed ${metricName}`);
//       }
//     })
//     .catch((error) => {
//       console.error("Error pushing metrics:", error);
//     });
// }
