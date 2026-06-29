const {
  registerCustomer,
  loginCustomer,
  getCustomerMe,
} = require("./authController");

module.exports = {
  registerCustomer,
  loginCustomer,
  getCurrentCustomer: getCustomerMe,
};