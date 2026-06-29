const express = require("express");
const { sendWhatsAppTemplateMessage } = require("../services/whatsappService");

const router = express.Router();

router.post("/test", async (req, res) => {
  try {
    const message = await sendWhatsAppTemplateMessage({
      to: "+2348165471979",
      contentVariables: {
        1: "12/1",
        2: "3pm",
      },
    });

    res.status(200).json({
      success: true,
      message: "WhatsApp message sent successfully",
      sid: message.sid,
    });
  } catch (error) {
    console.error("WhatsApp test error:", error.message);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;