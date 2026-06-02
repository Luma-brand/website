const pool = require("../config/db");

const createContactMessage = async (req, res) => {
  try {
    const { fullName, email, phone, subject, message } = req.body;

    if (!fullName || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and message are required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO contacts (full_name, email, phone, subject, message)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, full_name, email, phone, subject, message, status, created_at
      `,
      [fullName, email, phone || null, subject || null, message]
    );

    return res.status(201).json({
      success: true,
      message: "Contact message submitted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create contact error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while submitting contact message",
    });
  }
};

const getContactMessages = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, full_name, email, phone, subject, message, status, created_at
      FROM contacts
      ORDER BY created_at DESC
      `
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get contacts error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching contact messages",
    });
  }
};

const markContactAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE contacts
      SET status = 'read'
      WHERE id = $1
      RETURNING id, full_name, email, phone, subject, message, status, created_at
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Enquiry marked as read",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Mark enquiry as read error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while updating enquiry",
    });
  }
};

const deleteContactMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM contacts
      WHERE id = $1
      RETURNING id, email
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Enquiry deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Delete enquiry error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while deleting enquiry",
    });
  }
};

module.exports = {
  createContactMessage,
  getContactMessages,
  markContactAsRead,
  deleteContactMessage,
};