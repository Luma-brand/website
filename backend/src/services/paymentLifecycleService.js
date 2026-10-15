const { reduceStockAfterPaidOrder } = require("./inventoryService");
const { emitOrderCompleted, emitStockTransition } = require("./automationEventBridge");
const { isMissingWaitlistTable, markWaitlistsPurchasedForPaidOrder } = require("./productWaitlistService");
const { markBrowseAbandonmentsConvertedForOrder } = require("./browseAbandonmentService");
const { recordPaidOrder } = require("./affiliateService");
const { withTransactionSavepoint } = require("../utils/transactionSavepoint");

async function reconcileSuccessfulPaymentStock({ client, order, reference, createdBy }) {
  const stockReduction = await reduceStockAfterPaidOrder({ client, orderId: order.id, paymentReference: reference, createdBy });
  const updatedOrderResult = await client.query(
    `UPDATE orders
     SET payment_status='paid',
         status=CASE WHEN $2::boolean = false THEN 'stock_issue' WHEN status IN ('pending','stock_issue') THEN 'processing' ELSE status END,
         updated_at=NOW()
     WHERE id=$1
     RETURNING *`,
    [order.id, stockReduction.success]
  );
  if (stockReduction.success) await recordPaidOrder({ client, order: updatedOrderResult.rows[0] });
  try {
    await withTransactionSavepoint(client, "payment_waitlist_conversion", () =>
      markWaitlistsPurchasedForPaidOrder({ client, order: updatedOrderResult.rows[0] })
    );
  } catch (error) {
    if (!isMissingWaitlistTable(error)) console.error("Product waitlist conversion error:", error.message);
  }
  return { success: stockReduction.success, stockReduction, order: updatedOrderResult.rows[0] };
}

async function emitPaidOrderEvents({ order, stockReduction, sessionId, source }) {
  await markBrowseAbandonmentsConvertedForOrder(order).catch((error) => {
    console.error("Browse abandonment paid-order conversion error:", error.message);
  });
  await emitOrderCompleted(order, { sessionId, source });
  for (const movement of stockReduction?.movements || []) {
    if (!movement?.product_id) continue;
    await emitStockTransition(
      { id: movement.product_id },
      Number(movement.previous_stock || 0),
      Number(movement.new_stock || 0),
      { orderId: order.id, source }
    );
  }
}

module.exports = { reconcileSuccessfulPaymentStock, emitPaidOrderEvents };
