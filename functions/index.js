res.set("Access-Control-Allow-Origin", "*");
res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
res.set("Access-Control-Allow-Headers", "Content-Type");

if (req.method === "OPTIONS") {
  return res.status(204).send("");
}
const functions = require("firebase-functions");
const axios = require("axios");

exports.subscribeUser = functions.https.onRequest(async (req, res) => {
  // ✅ CORS HEADERS (THIS FIXES YOUR ERROR)
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  // ❌ Block non-POST requests
  if (req.method !== "POST") {
    return res.status(403).send("Forbidden");
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const email = req.body.email;

  try {
    await axios.post(
      "https://api.brevo.com/v3/contacts",
      {
        email: email,
        listIds: [4],
        updateEnabled: true,
      },
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(200).json({ message: "User subscribed" });
  } catch (error) {
    console.error(error.response ? error.response.data : error.message);
    return res.status(500).json({ error: "Error subscribing user" });
  }
});