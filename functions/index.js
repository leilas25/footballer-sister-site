const functions = require("firebase-functions");
const axios = require("axios");

// ─── 1. Subscribe a new user ───────────────────────────────────────────────
// Called when someone fills in your blog subscribe form.
// It adds them to Brevo list ID 4 and triggers your "Welcome" automation.
exports.subscribeUser = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(403).send("Forbidden");
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const email = req.body.email;

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "A valid email is required" });
  }

  try {
    // Add contact to your list
    await axios.post(
      "https://api.brevo.com/v3/contacts",
      {
        email: email.trim().toLowerCase(),
        listIds: [4],          // <-- Your Brevo list ID (change if needed)
        updateEnabled: true,   // Update existing contacts
      },
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(200).json({ message: "Successfully subscribed!" });
  } catch (error) {
    const data = error.response ? error.response.data : null;
    const status = error.response ? error.response.status : null;
    console.error("Brevo subscribe error", { status, data });

    // Contact already exists — treat as success
    if (status === 400 && data && JSON.stringify(data).includes("already")) {
      return res.status(200).json({ message: "You are already subscribed!" });
    }

    return res.status(500).json({ error: "Failed to subscribe. Please try again." });
  }
});


// ─── 2. Send new blog post notification to all subscribers ────────────────
// Call this from your CMS or manually whenever you publish a new post.
// POST body: { title, url, previewText }
exports.sendBlogNotification = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(403).send("Forbidden");
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const { title, url, previewText } = req.body;

  if (!title || !url) {
    return res.status(400).json({ error: "title and url are required" });
  }

  try {
    // Send a campaign email to list ID 4
    // We use the "Send a transactional email to a list" approach via campaigns.
    // NOTE: Brevo requires campaigns to be created + sent separately.
    // This creates a campaign and immediately schedules it to send now.

    // Step 1 – Create the campaign
    const createResp = await axios.post(
      "https://api.brevo.com/v3/emailCampaigns",
      {
        name: `Blog: ${title}`,
        subject: `New post: ${title}`,
        sender: {
          name: "The Footballer's sister",       
          email: "thefootballerssister@gmail.com",  
        },
        type: "classic",
        htmlContent: `
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
              <h2>${title}</h2>
              <p>${previewText || "A new post has been published on the blog."}</p>
              <p>
                <a href="${url}"
                   style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">
                  Read the post
                </a>
              </p>
              <hr style="margin-top:40px;" />
              <p style="font-size:12px;color:#999;">
                You're receiving this because you subscribed to blog updates.
                <a href="{{unsubscribeLink}}">Unsubscribe</a>
              </p>
            </body>
          </html>
        `,
        recipients: {
          listIds: [4],   // <-- Your Brevo list ID (change if needed)
        },
        // scheduledAt omitted = send immediately
      },
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const campaignId = createResp.data.id;

    // Step 2 – Send the campaign now
    await axios.post(
      `https://api.brevo.com/v3/emailCampaigns/${campaignId}/sendNow`,
      {},
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`Blog notification sent for: ${title} (campaign ${campaignId})`);
    return res.status(200).json({ message: "Blog notification sent!", campaignId });
  } catch (error) {
    const data = error.response ? error.response.data : null;
    const status = error.response ? error.response.status : null;
    console.error("Brevo campaign error", { status, data });
    return res.status(500).json({ error: "Failed to send notification." });
  }
});
