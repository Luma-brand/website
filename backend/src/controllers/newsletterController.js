const pool = require("../config/db");

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

    return res.status(201).json({
      success: true,
      message: "Waitlist subscription successful",
      data: result.rows[0],
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
      SELECT id, full_name, email, interest, created_at
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
};