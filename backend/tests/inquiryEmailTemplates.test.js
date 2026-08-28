const test = require("node:test");
const assert = require("node:assert/strict");

const {
  inquiryAdminNotificationTemplate,
  inquiryConfirmationTemplate,
  inquiryResponseTemplate,
} = require("../src/utils/emailTemplates");

const inquiry = {
  id: "1dc3af82-32f4-4774-b5fd-49c9d750fbd2",
  full_name: "Ada Customer",
  email: "ada@example.com",
  phone: "+2348012345678",
  subject: "Product enquiry",
  message: "Is the brow pencil available?",
  created_at: "2026-08-28T20:22:00.000Z",
  metadata: {
    sourcePage: "https://shopwithluma.com/contact",
    browserTimezone: "Africa/Lagos",
    locale: "en-NG",
  },
};

test("admin enquiry email contains all submitted customer details", () => {
  const template = inquiryAdminNotificationTemplate(inquiry);

  assert.match(template.subject, /Product enquiry/);
  assert.match(template.html, new RegExp(inquiry.id));
  assert.match(template.html, /Ada Customer/);
  assert.match(template.html, /ada@example\.com/);
  assert.match(template.html, /\+2348012345678/);
  assert.match(template.html, /Is the brow pencil available\?/);
  assert.match(template.html, /Africa\/Lagos/);
  assert.match(template.html, /en-NG/);
});

test("customer acknowledgement includes a direct hello support link", () => {
  const template = inquiryConfirmationTemplate(inquiry);

  assert.match(template.html, /mailto:hello@shopwithluma\.com/);
  assert.match(template.html, /Contact LUMA directly/);
  assert.match(template.html, new RegExp(inquiry.id));
  assert.match(template.html, /Is the brow pencil available\?/);
});

test("LUMA enquiry response includes the same direct support link", () => {
  const template = inquiryResponseTemplate({
    inquiry,
    replyMessage: "Yes, it is available.",
  });

  assert.match(template.html, /Yes, it is available\./);
  assert.match(template.html, /mailto:hello@shopwithluma\.com/);
  assert.match(template.html, /hello@shopwithluma\.com/);
});

