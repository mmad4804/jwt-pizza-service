const config = require("./config");

const requests = {};

// Periodically send the collected data to Grafana
setInterval(() => {
  const metrics = [];

  for (const [endpoint, count] of Object.entries(requests)) {
    metrics.push(
      createMetric(
        "http_requests_total", // Metric name
        count, // The current count
        "1", // Unit
        "sum", // Metric type
        "asInt", // Value type
        { endpoint: endpoint }, // Attribute to filter by in Grafana
      ),
    );
  }

  if (metrics.length > 0) {
    console.log(`Attempting to push ${metrics.length} metrics to Grafana...`);
    sendMetricToGrafana(metrics);
  } else {
    console.log("No new requests tracked in the last 5s.");
  }
}, 5000); // Send every 5 seconds (adjust as needed)

// Middleware to track requests
function requestTracker(req, res, next) {
  const endpoint = `[${req.method}] ${req.path}`;
  requests[endpoint] = (requests[endpoint] || 0) + 1;
  next();
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
  createMetric,
  sendMetricToGrafana,
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
