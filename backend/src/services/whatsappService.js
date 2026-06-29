const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
const defaultContentSid = process.env.TWILIO_CONTENT_SID;

let client = null;
let twilio = null;

function getTwilioClient() {
  if (!accountSid || !authToken) {
    throw new Error("Twilio is not configured. Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN.");
  }

  if (!twilio) {
    try {
      twilio = require("twilio");
    } catch (error) {
      if (error.code === "MODULE_NOT_FOUND") {
        throw new Error("Twilio package is not installed. Run npm install in the backend before using WhatsApp messaging.");
      }

      throw error;
    }
  }

  if (!client) {
    client = twilio(accountSid, authToken);
  }

  return client;
}

async function sendWhatsAppTemplateMessage({
  to,
  contentSid = defaultContentSid,
  contentVariables = {},
}) {
  if (!whatsappFrom) {
    throw new Error("Twilio WhatsApp sender is not configured. Missing TWILIO_WHATSAPP_FROM.");
  }

  if (!contentSid) {
    throw new Error("Twilio content template is not configured. Missing contentSid.");
  }

  const twilioClient = getTwilioClient();

  const message = await twilioClient.messages.create({
    from: whatsappFrom,
    to: `whatsapp:${to}`,
    contentSid,
    contentVariables: JSON.stringify(contentVariables),
  });

  return message;
}

module.exports = {
  sendWhatsAppTemplateMessage,
};
