function isValidStockQuantity(value) {
  return Number.isInteger(Number(value)) && Number(value) >= 0;
}

function isValidLowStockThreshold(value) {
  return Number.isInteger(Number(value)) && Number(value) >= 0;
}

module.exports = {
  isValidStockQuantity,
  isValidLowStockThreshold,
};
