/**
 * Integration tests for categoryController.js + productController.js (bottom-up)
 *
 * Real components under test:
 *   1. categoryController.js  – the controller logic
 *   2. productController.js   – productCategoryController
 *   3. categoryModel.js       – schema definition + model registration (real module, not mocked)
 *   4. productModel.js        – schema definition + model registration (real module, not mocked)
 *   5. slugify                – real slug generation
 *
 * What is stubbed:
 *   Only the MongoDB I/O methods (find, findOne, findByIdAndUpdate,
 *   findByIdAndDelete, prototype.save) are replaced with in-memory
 *   implementations via jest.spyOn so no DB connection is needed.
 *   Neither model file is ever jest.mock()'d — real mongoose schemas run.
 *
 * Two levels of integration are covered:
 *   Level A (plain-object store)  – spies return plain {_id,name,slug} objects.
 *   Level B (real mongoose docs)  – spies store and return actual mongoose
 *                                   Document instances so schema setters,
 *                                   virtuals, and instanceof checks are live.
 */

import { jest } from "@jest/globals";
import {
  createCategoryController,
  updateCategoryController,
  categoryControlller,
  singleCategoryController,
  deleteCategoryController,
} from "./categoryController.js";
import { productCategoryController } from "./productController.js";
// Real import – categoryModel.js loads for real (schema runs, mongoose.model() called)
import categoryModel from "../models/categoryModel.js";
import productModel from "../models/productModel.js";
import slugify from "slugify";

// ─────────────────────────────────────────────────────────────────────────────
// In-memory store – reset and re-wired before every test
// ─────────────────────────────────────────────────────────────────────────────

let store;
let nextId;

const buildRes = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

beforeEach(() => {
  store = [];
  nextId = 1;

  // Spy on DB-layer methods of the real categoryModel, substituting in-memory behaviour.
  // categoryModel.js itself is NOT mocked – only its database I/O calls are intercepted.

  jest.spyOn(categoryModel, "find").mockImplementation(() =>
    Promise.resolve([...store])
  );

  jest.spyOn(categoryModel, "findOne").mockImplementation((query) => {
    return Promise.resolve(
      store.find((doc) =>
        Object.entries(query).every(([field, value]) => {
          if (value && value.$regex instanceof RegExp) {
            return value.$regex.test(doc[field]);
          }
          return doc[field] === value;
        })
      ) ?? null
    );
  });

  jest.spyOn(categoryModel, "findByIdAndUpdate").mockImplementation(
    (id, update) => {
      const idx = store.findIndex((doc) => doc._id === id);
      if (idx === -1) return Promise.resolve(null);
      store[idx] = { ...store[idx], ...update };
      return Promise.resolve({ ...store[idx] });
    }
  );

  jest.spyOn(categoryModel, "findByIdAndDelete").mockImplementation((id) => {
    const idx = store.findIndex((doc) => doc._id === id);
    if (idx === -1) return Promise.resolve(null);
    const [deleted] = store.splice(idx, 1);
    return Promise.resolve(deleted);
  });

  // Spy on the real mongoose Document prototype save so `new categoryModel({…}).save()`
  // writes to the in-memory store instead of hitting MongoDB.
  jest
    .spyOn(categoryModel.prototype, "save")
    .mockImplementation(async function () {
      const doc = { _id: String(nextId++), name: this.name, slug: this.slug };
      store.push(doc);
      return doc;
    });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("categoryController integration tests", () => {
  // ── 1. Create success (201) ─────────────────────────────────────────────
  it("creates a category and stores a slug equal to real slugify(name)", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    const name = "Fresh Produce";
    const req = { body: { name } };
    const res = buildRes();

    await createCategoryController(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.send.mock.calls[0][0];
    expect(payload.success).toBe(true);
    // Real slugify produces "Fresh-Produce"; the real mongoose schema's
    // `lowercase: true` then transforms it to "fresh-produce".
    // Assert against slugify(name, { lower: true }) to capture both behaviours.
    expect(payload.category.slug).toBe(slugify(name, { lower: true }));
    // Confirm it is not just the raw name
    expect(payload.category.slug).not.toBe(name);
  });

  // ── 2. Missing name (401) ───────────────────────────────────────────────
  it("returns 401 and does not attempt a DB insert when name is missing", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    const req = { body: {} };
    const res = buildRes();

    await createCategoryController(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({ message: "Name is required" });
    // prototype.save must never have been called
    expect(categoryModel.prototype.save).not.toHaveBeenCalled();
    expect(store).toHaveLength(0);
  });

  // ── 3a. Empty name (401) ────────────────────────────────────────────────
  it("returns 401 and does not insert when name is an empty string", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    const req = { body: { name: "" } };
    const res = buildRes();

    await createCategoryController(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({ message: "Name is required" });
    expect(categoryModel.prototype.save).not.toHaveBeenCalled();
    expect(store).toHaveLength(0);
  });

  // ── 3b. Whitespace-only name (401) ──────────────────────────────────────
  it("returns 401 and does not insert when name is whitespace only", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    const req = { body: { name: "   " } };
    const res = buildRes();

    await createCategoryController(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({ message: "Name is required" });
    expect(categoryModel.prototype.save).not.toHaveBeenCalled();
    expect(store).toHaveLength(0);
  });

  // ── 3c. Duplicate category – exact match (409) ──────────────────────────
  it("returns 409 with 'Category Already Exists' and does not insert a duplicate", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    const name = "Electronics";
    store.push({ _id: "seed-1", name, slug: slugify(name) });

    const req = { body: { name } };
    const res = buildRes();

    await createCategoryController(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category Already Exists",
    });
    expect(store).toHaveLength(1);
  });

  // ── 3d. Duplicate category – case-insensitive match (409) ───────────────
  it("returns 409 when a category with the same name but different case already exists", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    store.push({ _id: "seed-1", name: "Electronics", slug: "electronics" });

    const req = { body: { name: "electronics" } };
    const res = buildRes();

    await createCategoryController(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category Already Exists",
    });
    expect(store).toHaveLength(1);
  });

  // ── 4a. Update – missing name (401) ────────────────────────────────────
  it("returns 401 and does not update when update name is missing", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    store.push({ _id: "cat-1", name: "Old Name", slug: slugify("Old Name") });

    const req = { body: {}, params: { id: "cat-1" } };
    const res = buildRes();

    await updateCategoryController(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({ message: "Name is required" });
    expect(categoryModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(store[0].name).toBe("Old Name");
  });

  // ── 4b. Update – whitespace-only name (401) ─────────────────────────────
  it("returns 401 and does not update when update name is whitespace only", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    store.push({ _id: "cat-1", name: "Old Name", slug: slugify("Old Name") });

    const req = { body: { name: "   " }, params: { id: "cat-1" } };
    const res = buildRes();

    await updateCategoryController(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({ message: "Name is required" });
    expect(categoryModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(store[0].name).toBe("Old Name");
  });

  // ── 4. Update success (200) ─────────────────────────────────────────────
  it("updates a category and regenerates the slug via real slugify", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    store.push({ _id: "cat-1", name: "Old Name", slug: slugify("Old Name") });

    const newName = "Brand New Name";
    const req = { body: { name: newName }, params: { id: "cat-1" } };
    const res = buildRes();

    await updateCategoryController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.send.mock.calls[0][0];
    expect(payload.success).toBe(true);
    // Slug comes from real slugify applied to the new name
    expect(payload.category.slug).toBe(slugify(newName));
    expect(payload.category.slug).not.toBe(slugify("Old Name"));
  });

  // ── 5. Get all categories (200) ─────────────────────────────────────────
  it("returns all categories with success: true and the full category array", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    store.push(
      { _id: "c1", name: "Books", slug: slugify("Books") },
      { _id: "c2", name: "Toys", slug: slugify("Toys") }
    );

    const req = {};
    const res = buildRes();

    await categoryControlller(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.send.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.category).toHaveLength(2);
    expect(payload.category).toEqual(expect.arrayContaining(store));
  });

  // ── 6. Get single category (200) ────────────────────────────────────────
  it("returns the matching category document for a valid slug param", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    const doc = {
      _id: "c3",
      name: "Garden Tools",
      slug: slugify("Garden Tools"),
    };
    store.push(doc);

    const req = { params: { slug: doc.slug } };
    const res = buildRes();

    await singleCategoryController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.send.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.category).toEqual(doc);
  });

  // ── 7. Delete success (200) ─────────────────────────────────────────────
  it("removes the category and returns 'Category Deleted Successfully'", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    store.push({ _id: "del-1", name: "Sports", slug: slugify("Sports") });

    const req = { params: { id: "del-1" } };
    const res = buildRes();

    await deleteCategoryController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "Category Deleted Successfully",
    });
    expect(store).toHaveLength(0);
  });

  // ── 8. Cross-controller slug contract ───────────────────────────────────
  //
  // This verifies the slug produced by createCategoryController (via the
  // real slugify + the schema's lowercase:true) is the exact same value
  // that productCategoryController receives and passes to categoryModel.findOne.
  // Unit tests on each controller use hardcoded mock slugs independently,
  // so they cannot catch a mismatch in this contract.
  describe("cross-controller: createCategoryController → productCategoryController slug flow", () => {
    const seedProducts = [
      {
        _id: "prod-1",
        name: "Galaxy S24",
        slug: "galaxy-s24",
        category: "1",
        price: 999,
        description: "flagship phone",
        quantity: 10,
      },
    ];

    beforeEach(() => {
      // The outer beforeEach already wires up categoryModel spies and the store.
      // Additionally mock productModel.find().populate() with an in-memory product list.
      jest.spyOn(productModel, "find").mockImplementation(() => ({
        populate: jest.fn().mockResolvedValue([...seedProducts]),
      }));
    });

    it("slug from createCategoryController (real slugify + lowercase) is the slug productCategoryController looks up", async () => {
      // Julius Bryan Reynon Gambe A0252251R
      const name = "Smart Phones";

      // ── Step 1: create the category via the real controller ──────────────
      // slugify("Smart Phones") → "Smart-Phones"
      // schema lowercase:true  → "smart-phones"
      const createReq = { body: { name } };
      const createRes = buildRes();
      await createCategoryController(createReq, createRes);

      expect(createRes.status).toHaveBeenCalledWith(201);
      const createdCategory = createRes.send.mock.calls[0][0].category;
      const slug = createdCategory.slug;

      // Confirm the real slug pipeline produced lowercase-with-hyphens
      expect(slug).toBe("smart-phones");
      // And that it is NOT the raw input or a capitalised variant
      expect(slug).not.toBe(name);
      expect(slug).not.toBe("Smart-Phones");

      // ── Step 2: use the EXACT slug emitted by step 1 as the route param ──
      const productReq = { params: { slug } };
      const productRes = buildRes();
      await productCategoryController(productReq, productRes);

      // categoryModel.findOne must have been called with the slug from step 1 —
      // this is the cross-controller contract being tested.
      expect(categoryModel.findOne).toHaveBeenCalledWith({ slug: "smart-phones" });

      // productCategoryController resolves successfully with the found category
      // and the products that belong to it.
      expect(productRes.status).toHaveBeenCalledWith(200);
      const payload = productRes.send.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.category).toEqual(createdCategory);
      expect(payload.products).toHaveLength(1);
      expect(payload.products[0].name).toBe("Galaxy S24");
    });

    it("unknown slug (no matching category) still completes without error and returns null category", async () => {
      // Julius Bryan Reynon Gambe A0252251R
      // store is empty — findOne will return null for any slug
      const productReq = { params: { slug: "non-existent-category" } };
      const productRes = buildRes();
      await productCategoryController(productReq, productRes);

      expect(productRes.status).toHaveBeenCalledWith(200);
      const payload = productRes.send.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.category).toBeNull();
    });
  });

  // ── 9. Higher-level integration with real mongoose Document instances ────
  //
  // Level B: prototype.save returns `this` (the live mongoose Document) so
  // the in-memory store holds real categoryModel instances.  productModel
  // instances are constructed via `new productModel({…})` — real schema
  // validation runs on both sides.  Only the DB transport (save / find /
  // findOne) is stubbed; everything else is the real mongoose stack.
  describe("cross-controller with real mongoose model instances (higher-level integration)", () => {
    beforeEach(() => {
      // Override the outer save spy: push the real mongoose Document (`this`)
      // into the store instead of a plain object.  Schema setters — including
      // lowercase:true on the slug field — have already been applied by the
      // time this function runs.
      categoryModel.prototype.save.mockImplementation(async function () {
        store.push(this);
        return this;
      });
    });

    it("real categoryModel document (with schema lowercase) is retrieved by productCategoryController", async () => {
      // Julius Bryan Reynon Gambe A0252251R
      const name = "Smart Phones";

      // ── Step 1: create via real controller + real slugify + real schema ──
      const createReq = { body: { name } };
      const createRes = buildRes();
      await createCategoryController(createReq, createRes);

      expect(createRes.status).toHaveBeenCalledWith(201);
      const createdCategory = createRes.send.mock.calls[0][0].category;

      // The returned document is a real mongoose categoryModel instance
      expect(createdCategory).toBeInstanceOf(categoryModel);
      // Schema lowercase:true lowercased the slugify output
      expect(createdCategory.slug).toBe("smart-phones");
      expect(createdCategory.name).toBe("Smart Phones");

      // ── Step 2: build a real productModel instance referencing the category ─
      // new productModel({…}) exercises real schema validation (required fields,
      // ObjectId cast for category, etc.) — no plain objects used.
      const realProduct = new productModel({
        name: "Galaxy S24",
        slug: "galaxy-s24",
        description: "flagship phone",
        price: 999,
        category: createdCategory._id,
        quantity: 10,
      });
      // Simulate what populate("category") would do: swap the ObjectId for the
      // real category document.
      realProduct.category = createdCategory;

      jest.spyOn(productModel, "find").mockImplementation(() => ({
        populate: jest.fn().mockResolvedValue([realProduct]),
      }));

      // ── Step 3: run productCategoryController with the slug from step 1 ──
      const productReq = { params: { slug: createdCategory.slug } };
      const productRes = buildRes();
      await productCategoryController(productReq, productRes);

      expect(productRes.status).toHaveBeenCalledWith(200);
      const payload = productRes.send.mock.calls[0][0];
      expect(payload.success).toBe(true);

      // The category returned is the real mongoose document stored in step 1
      expect(payload.category).toBeInstanceOf(categoryModel);
      expect(payload.category.slug).toBe("smart-phones");
      expect(payload.category.name).toBe("Smart Phones");

      // Products are real productModel instances with correct field values
      expect(payload.products).toHaveLength(1);
      expect(payload.products[0]).toBeInstanceOf(productModel);
      expect(payload.products[0].name).toBe("Galaxy S24");
      expect(payload.products[0].price).toBe(999);

      // The populated category on the product is the same real category document
      expect(payload.products[0].category).toBeInstanceOf(categoryModel);
      expect(payload.products[0].category.slug).toBe("smart-phones");
    });

    it("real productModel schema rejects a product missing required fields", async () => {
      // Julius Bryan Reynon Gambe A0252251R
      // Demonstrates that real schema validation is active (not bypassed by mocks).
      // A product without required fields should fail mongoose validation.
      const invalidProduct = new productModel({ name: "Incomplete" });
      const validationError = invalidProduct.validateSync();

      expect(validationError).toBeDefined();
      const missingFields = Object.keys(validationError.errors);
      expect(missingFields).toEqual(
        expect.arrayContaining(["slug", "description", "price", "category", "quantity"])
      );
    });
  });
});
