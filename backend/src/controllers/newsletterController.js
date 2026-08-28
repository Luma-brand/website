const pool = require("../config/db");
const { sendNewsletterConfirmationEmail, sendWaitlistConfirmationEmail } = require("../services/emailService");

const subscribeNewsletter = async (req, res) => {
  try {
    const { name, email, interest } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO newsletter_subscribers (full_name, email, interest)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [name || null, email, interest || null]
    );

    const subscriber = result.rows[0];
    const emailResult = await sendNewsletterConfirmationEmail({
      email: subscriber.email,
      name: subscriber.full_name,
      source: "newsletter_signup",
    });
    await sendWaitlistConfirmationEmail({
      email: subscriber.email,
      name: subscriber.full_name,
      source: "waitlist_signup",
    }).catch(() => null);

    return res.status(201).json({
      success: true,
      message: "Waitlist subscription successful",
      data: subscriber,
      email: {
        attempted: true,
        success: Boolean(emailResult?.success),
        status: emailResult?.status || (emailResult?.skipped ? "skipped" : "unknown"),
      },
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This email is already on the waitlist",
      });
    }

    console.error("Newsletter subscribe error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while joining waitlist",
    });
  }
};

const getNewsletterSubscribers = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, full_name, email, interest, status, admin_notes, created_at, updated_at
      FROM newsletter_subscribers
      ORDER BY created_at DESC
      `
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get newsletter subscribers error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching waitlist subscribers",
    });
  }
};

const updateNewsletterSubscriber = async (req, res) => {
  try {
    const fullName = String(req.body?.fullName ?? req.body?.full_name ?? "").trim().slice(0, 160) || null;
    const interest = String(req.body?.interest || "").trim().slice(0, 160) || null;
    const status = String(req.body?.status || "active").trim().toLowerCase();
    const adminNotes = String(req.body?.adminNotes ?? req.body?.admin_notes ?? "").trim().slice(0, 2000) || null;
    if (!["active", "contacted", "converted", "unsubscribed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Choose a valid waitlist status." });
    }

    const result = await pool.query(
      `UPDATE newsletter_subscribers
       SET full_name=$2, interest=$3, status=$4, admin_notes=$5, updated_at=NOW()
       WHERE id=$1
       RETURNING id, full_name, email, interest, status, admin_notes, created_at, updated_at`,
      [req.params.id, fullName, interest, status, adminNotes]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: "Waitlist user not found." });
    }
    return res.status(200).json({ success: true, message: "Waitlist entry updated.", data: result.rows[0] });
  } catch (error) {
    console.error("Update waitlist user error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update waitlist entry." });
  }
};

const deleteNewsletterSubscriber = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM newsletter_subscribers
      WHERE id = $1
      RETURNING id, email
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Waitlist user not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Waitlist user deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Delete waitlist user error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while deleting waitlist user",
    });
  }
};

module.exports = {
  subscribeNewsletter,
  getNewsletterSubscribers,
  deleteNewsletterSubscriber,
  updateNewsletterSubscriber,
};
