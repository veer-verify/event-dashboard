const localurl: string = "http://localhost";

export const environment = {
  name: "dev",
  production: false,
  apiBaseUrl: "https://usstaging.ivisecurity.com",
  authBaseUrl: "https://usstaging.ivisecurity.com/userDetails",
  mqApiBaseUrl: "https://stagingmq.ivisecurity.com/queueManagement",
  meteDataUrl: "https://usstaging.ivisecurity.com/metadata",
  eventDataUrl: "https://usstaging.ivisecurity.com/events_data",
  guard_monitoring_url: `https://usstaging.ivisecurity.com/guard_monitoring`,
  vipSitesUrl: `https://usstaging.ivisecurity.com/vipsites`,
  loggingEnabled: true,


  //   production: false,
  // apiBaseUrl:"http://localhost",
  // authBaseUrl: `${localurl}:3002/userDetails`,
  // mqApiBaseUrl: `${localurl}:80`,
  // meteDataUrl: `${localurl}:8844/metadata`,
  // eventDataUrl: `${localurl}:80/events_data`,
  // guard_monitoring_url: `${localurl}:3009/guard_monitoring`,
  // loggingEnabled: true,
};
