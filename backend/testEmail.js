require("dotenv").config();
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  try {
    const result = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: [process.env.LUMA_ADMIN_EMAIL],
      subject: "LUMA Resend Test",
      html: "<h1>Resend is working</h1><p>This is a test email from LUMA backend.</p>",
    });

    console.log("Email result:", result);
  } catch (error) {
    console.error("Email test failed:", error);
  }
}

testEmail();