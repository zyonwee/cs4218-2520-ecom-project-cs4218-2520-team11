# CS4218 Project - Virtual Vault

## 1. Project Introduction

Virtual Vault is a full-stack MERN (MongoDB, Express.js, React.js, Node.js) e-commerce website, offering seamless connectivity and user-friendly features. The platform provides a robust framework for online shopping. The website is designed to adapt to evolving business needs and can be efficiently extended.

## MS1 CI Status

**MS1 CI Log:** [https://github.com/cs4218/cs4218-2520-ecom-project-cs4218-2520-team11/actions/runs/22292370589/job/64481995214]

## 2. Website Features

- **User Authentication**: Secure user authentication system implemented to manage user accounts and sessions.
- **Payment Gateway Integration**: Seamless integration with popular payment gateways for secure and reliable online transactions.
- **Search and Filters**: Advanced search functionality and filters to help users easily find products based on their preferences.
- **Product Set**: Organized product sets for efficient navigation and browsing through various categories and collections.

## 3. Your Task

- **Unit and Integration Testing**: Utilize Jest for writing and running tests to ensure individual components and functions work as expected, finding and fixing bugs in the process.
- **UI Testing**: Utilize Playwright for UI testing to validate the behavior and appearance of the website's user interface.
- **Code Analysis and Coverage**: Utilize SonarQube for static code analysis and coverage reports to maintain code quality and identify potential issues.
- **Load Testing**: Leverage JMeter for load testing to assess the performance and scalability of the ecommerce platform under various traffic conditions.

## 4. Setting Up The Project

### 1. Installing Node.js

1. **Download and Install Node.js**:
   - Visit [nodejs.org](https://nodejs.org) to download and install Node.js.

2. **Verify Installation**:
   - Open your terminal and check the installed versions of Node.js and npm:
     ```bash
     node -v
     npm -v
     ```

### 2. MongoDB Setup (Local Docker)

We use Docker to run MongoDB locally. This ensures all developers have an identical database environment.

1. **Install Docker Desktop**:
   - Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop/) for your operating system.

2. **Verify Docker is Running**:
   ```bash
   docker --version
   ```

### 3. Application Setup

To download and use the MERN (MongoDB, Express.js, React.js, Node.js) app from GitHub, follow these general steps:

1. **Clone the Repository**
   - Go to the GitHub repository of the MERN app.
   - Click on the "Code" button and copy the URL of the repository.
   - Open your terminal or command prompt.
   - Use the `git clone` command followed by the repository URL to clone the repository to your local machine:
     ```bash
     git clone <repository_url>
     ```
   - Navigate into the cloned directory.

2. **Install Frontend and Backend Dependencies**
   - Run the following command in your project's root directory:

     ```bash
     npm install && cd client && npm install && cd ..
     ```

3. **Start MongoDB and Seed Database**

   ```bash
   npm run db:start    # Start MongoDB container
   npm run db:seed     # Import sample data
   ```

   if anything goes wrong and you need to reset the database (revert back to seed data)

   ```bash
   npm run db:reset
   ```

4. **Run the Application**

   ```bash
   npm run dev
   ```

   Navigate to `http://localhost:3000` to access the application.

### Database Management Commands

| Command             | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `npm run db:start`  | Start MongoDB container                              |
| `npm run db:stop`   | Stop MongoDB container                               |
| `npm run db:seed`   | Import/refresh seed data                             |
| `npm run db:reset`  | Reset database (stop, delete data, restart, re-seed) |
| `npm run db:logs`   | View MongoDB logs                                    |
| `npm run db:status` | Check container status                               |

### Connecting with MongoDB Compass (Optional)

If you want to browse the database visually, on MongoDB Compass navigate to:
`mongodb://root:password@localhost:27017/?authSource=admin`

## 5. Unit Testing with Jest

Unit testing is a crucial aspect of software development aimed at verifying the functionality of individual units or components of a software application. It involves isolating these units and subjecting them to various test scenarios to ensure their correctness.  
Jest is a popular JavaScript testing framework widely used for unit testing. It offers a simple and efficient way to write and execute tests in JavaScript projects.

### Getting Started with Jest

To begin unit testing with Jest in your project, follow these steps:

1. **Install Jest**:  
   Use your preferred package manager to install Jest. For instance, with npm:

   ```bash
   npm install --save-dev jest

   ```

2. **Write Tests**  
   Create test files for your components or units where you define test cases to evaluate their behaviour.

3. **Run Tests**  
   Execute your tests using Jest to ensure that your components meet the expected behaviour.  
   You can run the tests by using the following command in the root of the directory:
   - **Frontend tests**

     ```bash
     npm run test:frontend
     ```

   - **Backend tests**

     ```bash
     npm run test:backend
     ```

   - **All the tests**
     ```bash
     npm run test
     ```

## Contributions

Julius Bryan Reynon Gambe, A0252251R
Features: Admin Actions (`client/src/pages/admin/CreateCategory.test.js`, `client/src/components/Form/CategoryForm.test.js`, `controllers/categoryController.test.js`, `controllers/categoryController.integration.test.js`, `controllers/authController.test.js`, `tests/create-product.spec.js`, `tests/create-category.spec.js`), Admin View Products (`client/src/pages/admin/Products.test.js`, `client/src/pages/admin/CreateProduct.test.js`, `client/src/pages/admin/UpdateProduct.test.js`, `client/src/components/Form/SearchInput.test.js`, `controllers/productController.test.js`, `controllers/productController.integration.test.js`), Admin View Users (`client/src/pages/admin/Users.test.js`), Admin View Orders (`client/src/pages/admin/AdminOrders.test.js`, `controllers/order.integration.test.js`, `tests/orders.spec.js`, `Orders.test.js`)

Huang Yi Chee, A0259617R
Features and tests: Protected Routes (`context/auth.js`, `helpers/authHelper.js`, `middlewares/authMiddleware.js`), Registration & Login (`pages/Auth/Register.js`, `pages/Auth/Login.js`, `controllers/authController.js`), Profile (`pages/user/Profile.js`)

Zyon Aaronel Wee Zhun Wei, A0277598B
Features and tests: Category (`hooks/useCategory.js`, `pages/Categories.js`, `controllers/categoryController.js`, `models/categoryModel.js`), Payment (`controllers/productController.js` for `braintreeTokenController` and `brainTreePaymentController`), Admin Dashboard (`components/AdminMenu.js`, `pages/admin/AdminDashboard.js`), General (`components/Footer.js`, `components/Header.js`, `components/Layout.js`, `components/Spinner.js`, `pages/About.js`, `pages/Pagenotfound.js`, `config/db.js`)

Antony Swami Alfred Ben, A0253016R
Features: General, Order, Search

Gabriel Seethor, A0257008H
Features and tests: Product, Contact, Home, Cart, Policy
(`productController.test.js`, `CartPage.test.js`, `CategoryProduct.test.js`, `FilterHomePage.test.js`, `HomePageCart.test.js`, `HomePageCart.test.js`)
(`CartCheckoutIntegration.test.js`
`HomePageCartIntegration.test.js`
`HomePageIntegration.test.js`  
`HomePageNavigationIntegration.test.js`
`MergeGuestCartIntegration.test.js `
`ProductDetailsCartIntegration.test.js`
`ProductDetailsIntegration.test.js`
`cart-productdetails.spec.ts`
`Note: must run db.seed for test cases to work`
)
