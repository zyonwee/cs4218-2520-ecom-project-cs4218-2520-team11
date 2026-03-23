/**
 * Integration tests for search & product browsing endpoints (bottom-up)
 *
 * Antony Swami Alfred Ben, A0253016R
 *
 * Real components under test:
 *   1. searchProductController, realtedProductController,
 *      productCategoryController — from productController.js
 *   2. productModel.js — real mongoose schema (name, description, price, slug)
 *   3. categoryModel.js — real mongoose schema (name, slug)
 *
 * Only stubbed:
 *   DB transport only — find, findOne via jest.spyOn.
 *   No model file is ever jest.mock()'d.
 *
 * Integration contracts verified:
 *   - searchProductController escapes regex special chars before passing to $regex
 *   - realtedProductController excludes the current product and limits to 3
 *   - productCategoryController looks up category by slug, then finds products
 *   - EP: valid keyword, empty results, special characters
 *   - BVA: keyword with regex meta-characters at the boundary
 */

import { jest } from "@jest/globals";
import mongoose from "mongoose";

import {
  searchProductController,
  realtedProductController,
  productCategoryController,
} from "./productController.js";
import productModel from "../models/productModel.js";
import categoryModel from "../models/categoryModel.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const buildRes = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

/**
 * Thenable query chain: awaiting it at any depth resolves to `result`.
 * Every chained method is a jest spy returning the same chain.
 */
const makeChain = (result) => {
  const chain = {
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (reject) => Promise.resolve(result).catch(reject),
    finally: (fn) => Promise.resolve(result).finally(fn),
  };
  ["populate", "select", "sort", "limit", "skip"].forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  return chain;
};

// ─────────────────────────────────────────────────────────────────────────────
// In-memory data
// ─────────────────────────────────────────────────────────────────────────────

let productStore;
let categoryStore;

const makeProduct = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  name: "Test Product",
  description: "A test product description",
  price: 99.99,
  slug: "test-product",
  category: new mongoose.Types.ObjectId(),
  quantity: 10,
  ...overrides,
});

const makeCategory = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  name: "Electronics",
  slug: "electronics",
  ...overrides,
});

beforeEach(() => {
  productStore = [];
  categoryStore = [];

  // Default product find: returns products filter by query
  jest.spyOn(productModel, "find").mockImplementation((query) => {
    let results = [...productStore];

    // Handle $or queries (search)
    if (query?.$or) {
      const orConditions = query.$or;
      results = productStore.filter((p) =>
        orConditions.some((cond) => {
          if (cond.name?.$regex) {
            const re = new RegExp(cond.name.$regex, cond.name.$options || "");
            return re.test(p.name);
          }
          if (cond.description?.$regex) {
            const re = new RegExp(
              cond.description.$regex,
              cond.description.$options || ""
            );
            return re.test(p.description);
          }
          return false;
        })
      );
    }

    // Handle category + $ne (related products)
    if (query?.category && query?._id?.$ne) {
      results = productStore.filter(
        (p) =>
          p.category?.toString() === query.category?.toString() &&
          p._id?.toString() !== query._id.$ne?.toString()
      );
    }

    // Handle category filter (productCategoryController)
    // Note: productCategoryController passes the full category object to find()
    if (query?.category && !query?._id) {
      const queryCatId = query.category?._id
        ? query.category._id.toString()
        : query.category?.toString();
      results = productStore.filter(
        (p) => p.category?.toString() === queryCatId
      );
    }

    return makeChain(results);
  });

  // Category findOne
  jest.spyOn(categoryModel, "findOne").mockImplementation(async (query) => {
    return (
      categoryStore.find((c) => {
        if (query.slug) return c.slug === query.slug;
        return false;
      }) ?? null
    );
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Search & product browsing integration tests", () => {
  // ── searchProductController ────────────────────────────────────────────
  describe("GET /api/v1/product/search/:keyword [searchProductController]", () => {
    // Antony Swami Alfred Ben, A0253016R
    it("EP: valid keyword returns matching products by name", async () => {
      productStore.push(
        makeProduct({ name: "iPhone 15 Pro", description: "Apple smartphone" }),
        makeProduct({ name: "Samsung Galaxy", description: "Android phone" }),
        makeProduct({ name: "MacBook Pro", description: "Apple laptop" })
      );

      const req = { params: { keyword: "iPhone" } };
      const res = buildRes();

      await searchProductController(req, res);

      const results = res.json.mock.calls[0][0];
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("iPhone 15 Pro");
    });

    // Antony Swami Alfred Ben, A0253016R
    it("EP: valid keyword matches description too ($or query)", async () => {
      productStore.push(
        makeProduct({ name: "Phone Case", description: "Fits iPhone perfectly" }),
        makeProduct({ name: "USB Cable", description: "Universal charger" })
      );

      const req = { params: { keyword: "iPhone" } };
      const res = buildRes();

      await searchProductController(req, res);

      const results = res.json.mock.calls[0][0];
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Phone Case");
    });

    // Antony Swami Alfred Ben, A0253016R
    it("EP: keyword with no matches returns empty array", async () => {
      productStore.push(
        makeProduct({ name: "Book", description: "A novel" })
      );

      const req = { params: { keyword: "NonExistentProduct999" } };
      const res = buildRes();

      await searchProductController(req, res);

      const results = res.json.mock.calls[0][0];
      expect(results).toHaveLength(0);
    });

    // Antony Swami Alfred Ben, A0253016R
    it("BVA/Security: regex special chars are escaped (no injection)", async () => {
      productStore.push(
        makeProduct({ name: "Product (Special)", description: "Test" })
      );

      // These characters would cause regex injection without escaping
      const req = { params: { keyword: ".*+?^${}()|[]" } };
      const res = buildRes();

      await searchProductController(req, res);

      // Should NOT throw, and the literal regex chars should not match everything
      const results = res.json.mock.calls[0][0];
      expect(results).toHaveLength(0); // no product has this literal string
    });

    // Antony Swami Alfred Ben, A0253016R
    it("search is case-insensitive ($options: 'i')", async () => {
      productStore.push(
        makeProduct({ name: "WIRELESS MOUSE", description: "Bluetooth" })
      );

      const req = { params: { keyword: "wireless" } };
      const res = buildRes();

      await searchProductController(req, res);

      const results = res.json.mock.calls[0][0];
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("WIRELESS MOUSE");
    });

    // Antony Swami Alfred Ben, A0253016R
    it("DB error: controller catches and returns 400", async () => {
      productModel.find.mockImplementation(() => {
        throw new Error("DB unavailable");
      });

      const req = { params: { keyword: "test" } };
      const res = buildRes();

      await searchProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Error In Search Product API",
        })
      );
    });
  });

  // ── realtedProductController ───────────────────────────────────────────
  describe("GET /api/v1/product/related-product/:pid/:cid [realtedProductController]", () => {
    // Antony Swami Alfred Ben, A0253016R
    it("returns related products in same category, excluding current product", async () => {
      const catId = new mongoose.Types.ObjectId();
      const currentProduct = makeProduct({
        _id: new mongoose.Types.ObjectId(),
        name: "Current",
        category: catId,
      });
      const related1 = makeProduct({ name: "Related 1", category: catId });
      const related2 = makeProduct({ name: "Related 2", category: catId });
      const different = makeProduct({
        name: "Different Category",
        category: new mongoose.Types.ObjectId(),
      });
      productStore.push(currentProduct, related1, related2, different);

      const req = {
        params: {
          pid: currentProduct._id.toString(),
          cid: catId.toString(),
        },
      };
      const res = buildRes();

      await realtedProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const returned = res.send.mock.calls[0][0];
      expect(returned.success).toBe(true);
      // Should not include the current product or different-category product
      const names = returned.products.map((p) => p.name);
      expect(names).not.toContain("Current");
      expect(names).not.toContain("Different Category");
    });

    // Antony Swami Alfred Ben, A0253016R
    it("returns empty when no related products exist", async () => {
      const catId = new mongoose.Types.ObjectId();
      const current = makeProduct({ category: catId });
      productStore.push(current);

      // Only the current product in this category — so 0 related
      productModel.find.mockImplementation(() => makeChain([]));

      const req = {
        params: {
          pid: current._id.toString(),
          cid: catId.toString(),
        },
      };
      const res = buildRes();

      await realtedProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send.mock.calls[0][0].products).toHaveLength(0);
    });

    // Antony Swami Alfred Ben, A0253016R
    it("query chain uses limit(3) and populate('category')", async () => {
      const req = {
        params: {
          pid: new mongoose.Types.ObjectId().toString(),
          cid: new mongoose.Types.ObjectId().toString(),
        },
      };
      const res = buildRes();

      await realtedProductController(req, res);

      const chain = productModel.find.mock.results[0].value;
      expect(chain.select).toHaveBeenCalledWith("-photo");
      expect(chain.limit).toHaveBeenCalledWith(3);
      expect(chain.populate).toHaveBeenCalledWith("category");
    });

    // Antony Swami Alfred Ben, A0253016R
    it("DB error: controller returns 400", async () => {
      productModel.find.mockImplementation(() => {
        throw new Error("DB error");
      });

      const req = {
        params: {
          pid: "some-pid",
          cid: "some-cid",
        },
      };
      const res = buildRes();

      await realtedProductController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "error while geting related product",
        })
      );
    });
  });

  // ── productCategoryController ──────────────────────────────────────────
  describe("GET /api/v1/product/product-category/:slug [productCategoryController]", () => {
    // Antony Swami Alfred Ben, A0253016R
    it("looks up category by slug, then finds all products in that category", async () => {
      const cat = makeCategory({ name: "Books", slug: "books" });
      categoryStore.push(cat);

      const p1 = makeProduct({
        name: "Book A",
        category: cat._id,
      });
      const p2 = makeProduct({
        name: "Book B",
        category: cat._id,
      });
      productStore.push(p1, p2);

      const req = { params: { slug: "books" } };
      const res = buildRes();

      await productCategoryController(req, res);

      expect(categoryModel.findOne).toHaveBeenCalledWith({ slug: "books" });
      expect(res.status).toHaveBeenCalledWith(200);
      const returned = res.send.mock.calls[0][0];
      expect(returned.success).toBe(true);
      expect(returned.category.name).toBe("Books");
      expect(returned.products).toHaveLength(2);
    });

    // Antony Swami Alfred Ben, A0253016R
    it("returns empty products when category has no products", async () => {
      const cat = makeCategory({ slug: "empty-cat" });
      categoryStore.push(cat);

      const req = { params: { slug: "empty-cat" } };
      const res = buildRes();

      await productCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send.mock.calls[0][0].products).toHaveLength(0);
    });

    // Antony Swami Alfred Ben, A0253016R
    it("DB error: controller returns 400", async () => {
      categoryModel.findOne.mockRejectedValue(new Error("DB error"));

      const req = { params: { slug: "crash" } };
      const res = buildRes();

      await productCategoryController(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Error While Getting products",
        })
      );
    });
  });
});
