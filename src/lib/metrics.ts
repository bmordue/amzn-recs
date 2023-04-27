import { StatsD } from "hot-shots";

const metrics = new StatsD({ mock: true });

// const statsd = new StatsD({
//     prefix: "amzn-recs.crawl_queue.",
//     host: config.get("STATSD_HOST"),
//   });

export default metrics;
