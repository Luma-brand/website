const {
  buildCustomersCsv,
  createCustomerSegment,
  createCustomerTag,
  deleteCustomerSegment,
  getCustomerAnalyticsOverview,
  getCustomerOrderItems,
  getCustomerOrders,
  getCustomerProfile,
  getCustomers,
  listCustomerSegments,
  listCustomerTags,
  updateCustomerSegment,
  updateCustomerTags,
} = require("../services/customerService");

function sendError(res, error, fallbackMessage) {
  const status = error.statusCode || error.status || 500;
  if (status >= 500) {
    console.error(fallbackMessage, error);
  }
  return res.status(status).json({
    success: false,
    message: error.message || fallbackMessage,
  });
}

function getCustomerFilters(query = {}) {
  return {
    page: query.page,
    limit: query.limit,
    search: query.search || "",
    tag: query.tag || "",
    segment: query.segment || "",
    status: query.status || "",
    source: query.source || "",
    sort: query.sort || "last_activity_desc",
  };
}

async function getCustomersHandler(req, res) {
  try {
    const result = await getCustomers(getCustomerFilters(req.query));
    return res.status(200).json({
      success: true,
      count: result.customers.length,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      data: result.customers,
      customers: result.customers,
    });
  } catch (error) {
    return sendError(res, error, "Failed to load customers.");
  }
}

async function getCustomerAnalyticsOverviewHandler(req, res) {
  try {
    const data = await getCustomerAnalyticsOverview(getCustomerFilters(req.query));
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "Failed to load customer analytics.");
  }
}

async function getCustomerProfileHandler(req, res) {
  try {
    const data = await getCustomerProfile(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, message: "Customer not found." });
    }
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "Failed to load customer profile.");
  }
}

async function updateCustomerTagsHandler(req, res) {
  try {
    const data = await updateCustomerTags(req.params.id, req.body || {});
    return res.status(200).json({ success: true, message: "Customer tags updated.", data });
  } catch (error) {
    return sendError(res, error, "Failed to update customer tags.");
  }
}

async function listCustomerTagsHandler(req, res) {
  try {
    const data = await listCustomerTags();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "Failed to load customer tags.");
  }
}

async function createCustomerTagHandler(req, res) {
  try {
    const data = await createCustomerTag(req.body || {});
    return res.status(201).json({ success: true, message: "Customer tag saved.", data });
  } catch (error) {
    return sendError(res, error, "Failed to create customer tag.");
  }
}

async function listCustomerSegmentsHandler(req, res) {
  try {
    const data = await listCustomerSegments();
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error, "Failed to load customer segments.");
  }
}

async function createCustomerSegmentHandler(req, res) {
  try {
    const data = await createCustomerSegment(req.body || {});
    return res.status(201).json({ success: true, message: "Customer segment saved.", data });
  } catch (error) {
    return sendError(res, error, "Failed to create customer segment.");
  }
}

async function updateCustomerSegmentHandler(req, res) {
  try {
    const data = await updateCustomerSegment(req.params.id, req.body || {});
    if (!data) {
      return res.status(404).json({ success: false, message: "Customer segment not found." });
    }
    return res.status(200).json({ success: true, message: "Customer segment updated.", data });
  } catch (error) {
    return sendError(res, error, "Failed to update customer segment.");
  }
}

async function deleteCustomerSegmentHandler(req, res) {
  try {
    const data = await deleteCustomerSegment(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, message: "Customer segment not found." });
    }
    return res.status(200).json({ success: true, message: "Customer segment deleted.", data });
  } catch (error) {
    return sendError(res, error, "Failed to delete customer segment.");
  }
}

async function getCustomerOrdersHandler(req, res) {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ success: false, message: "Customer email is required." });
    }
    const orders = await getCustomerOrders(email);
    const items = await getCustomerOrderItems(orders.map((order) => order.id));
    const itemsByOrderId = new Map();
    for (const item of items) {
      const currentItems = itemsByOrderId.get(item.order_id) || [];
      currentItems.push(item);
      itemsByOrderId.set(item.order_id, currentItems);
    }
    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders.map((order) => ({ ...order, items: itemsByOrderId.get(order.id) || [] })),
    });
  } catch (error) {
    return sendError(res, error, "Failed to load customer orders.");
  }
}

async function exportCustomersCsvHandler(req, res) {
  try {
    const customers = await getCustomers({ ...getCustomerFilters(req.query), page: 1, limit: 250 });
    const csv = buildCustomersCsv(customers);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="luma-customers-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    return sendError(res, error, "Failed to export customers.");
  }
}

module.exports = {
  createCustomerSegmentHandler,
  createCustomerTagHandler,
  deleteCustomerSegmentHandler,
  exportCustomersCsvHandler,
  getCustomerAnalyticsOverviewHandler,
  getCustomerOrdersHandler,
  getCustomerProfileHandler,
  getCustomersHandler,
  listCustomerSegmentsHandler,
  listCustomerTagsHandler,
  updateCustomerSegmentHandler,
  updateCustomerTagsHandler,
};