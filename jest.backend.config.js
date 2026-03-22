export default {
  // display name
  displayName: "backend",

  // when testing backend
  testEnvironment: "node",

  // which tests to run
  testMatch: [
    "<rootDir>/controllers/*.test.js",
    "<rootDir>/middlewares/*.test.js",
    "<rootDir>/helpers/*.test.js",
    "<rootDir>/models/*.test.js",
    "<rootDir>/config/*.test.js",
  ],

  // jest code coverage
  collectCoverage: true,

  // Scope coverage to MS1 assigned backend files
    collectCoverageFrom: [
    "helpers/authHelper.js",
    "middlewares/authMiddleware.js",

    "controllers/authController.js",
    "controllers/categoryController.js",
    "controllers/productController.js",

    "models/userModel.js",
    "models/orderModel.js",
    "models/productModel.js",
    "models/categoryModel.js",

    "config/db.js",
  ],

  // Keep thresholds lower to avoid failing due to partial controller scope
  coverageThreshold: {
    global: {
      lines: 70,
      functions: 70,
    },
  },
};
