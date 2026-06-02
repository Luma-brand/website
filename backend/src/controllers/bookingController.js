const pool = require("../config/db");

const createBooking = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      service,
      preferredDate,
      preferredTime,
      budget,
      message,
    } = req.body;

    if (!fullName || !email || !service) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, and service are required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO bookings (
        full_name,
        email,
        phone,
        service,
        preferred_date,
        preferred_time,
        budget,
        message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        fullName,
        email,
        phone || null,
        service,
        preferredDate || null,
        preferredTime || null,
        budget || null,
        message || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Booking request submitted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create booking error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while submitting booking request",
    });
  }
};

const getBookings = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM bookings
      ORDER BY created_at DESC
      `
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get bookings error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching bookings",
    });
  }
};

module.exports = {
  createBooking,
  getBookings,
};