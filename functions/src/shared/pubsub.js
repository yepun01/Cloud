const { PubSub } = require("@google-cloud/pubsub");

const TOPIC_NAME = "pixel-events";

let pubsubClient = null;

function getClient() {
  if (!pubsubClient) pubsubClient = new PubSub();
  return pubsubClient;
}

async function publishPixelEvent(event) {
  const data = Buffer.from(JSON.stringify(event));
  return getClient().topic(TOPIC_NAME).publishMessage({ data });
}

module.exports = { publishPixelEvent, TOPIC_NAME };
