/**
 * Integration tests for productController.js (bottom-up)
 *
 * Real components under test:
 *   1. productController.js – controller logic
 *   2. productModel.js      – real mongoose schema (required fields, photo
 *                             Buffer, ObjectId ref) – never jest.mock()'d
 *   3. categoryModel.js     – real mongoose schema – never jest.mock()'d
 *   4. slugify              – real slug generation (no mock)
 *
 * What is stubbed:
 *   - productModel / categoryModel DB I/O (find, findOne, findByIdAndUpdate,
 *     findByIdAndDelete, prototype.save) replaced with an in-memory store
 *     via jest.spyOn – the model modules themselves are fully real.
 *   - fs.readFileSync replaced to avoid touching the filesystem.
 */

import { jest } from "@jest/globals";
import fs from "fs";
import slugify from "slugify";
import {
  createProductController,
  getProductController,
  getSingleProductController,
  updateProductController,
  deleteProductController,
} from "./productController.js";
import productModel from "../models/productModel.js";
import categoryModel from "../models/categoryModel.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const buildRes = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

/**
 * Returns a thenable query chain where every method (populate, select, limit,
 * sort, skip) returns the same chain.  Awaiting the chain at any point in the
 * pipeline resolves to `result`.  Each method is a jest spy so call assertions
 * like expect(chain.populate).toHaveBeenCalledWith("category") work.
 */
const makeQueryChain = (result) => {
  const chain = {
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (reject) => Promise.resolve(result).catch(reject),
    finally: (fn) => Promise.resolve(result).finally(fn),
  };
  ["populate", "select", "limit", "sort", "skip"].forEach((m) => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  return chain;
};

// ─────────────────────────────────────────────────────────────────────────────
// In-memory stores – reset before every test
// ─────────────────────────────────────────────────────────────────────────────

let productStore;
let categoryStore;

beforeEach(() => {
  productStore = [];
  categoryStore = [];

  // ── productModel stubs ────────────────────────────────────────────────────

  jest
    .spyOn(productModel, "find")
    .mockImplementation(() => makeQueryChain([...productStore]));

  jest.spyOn(productModel, "findOne").mockImplementation((query) => {
    const [field, value] = Object.entries(query)[0];
    const doc =
      productStore.find(
        (p) =>
          (p[field]?.toString?.() ?? p[field]) ===
          (value?.toString?.() ?? value)
      ) ?? null;
    return makeQueryChain(doc);
  });

  /**
   * findByIdAndUpdate: creates a real productModel Document from the merged
   * fields so the controller can set .photo.data / .photo.contentType on it
   * and call .save() on a proper mongoose instance.
   */
  jest
    .spyOn(productModel, "findByIdAndUpdate")
    .mockImplementation(async (id, update) => {
      const idx = productStore.findIndex(
        (p) => p._id?.toString() === id?.toString()
      );
      if (idx === -1) return null;

      const existing = productStore[idx];
      const merged = {
        name: existing.name,
        description: existing.description,
        price: existing.price,
        category: existing.category,
        quantity: existing.quantity,
        slug: existing.slug,
        ...update,
      };
      const updatedDoc = new productModel(merged);
      // Preserve original _id so the upsert save spy can locate it
      updatedDoc._id = existing._id;
      // Carry forward the existing photo subdocument when the update has no photo
      if (!update.photo) updatedDoc.photo = existing.photo ?? {};
      productStore[idx] = updatedDoc;
      return updatedDoc;
    });

  jest.spyOn(productModel, "findByIdAndDelete").mockImplementation((id) => {
    const idx = productStore.findIndex(
      (p) => p._id?.toString() === id?.toString()
    );
    const deleted = idx !== -1 ? productStore.splice(idx, 1)[0] : null;
    // Controller calls .select("-photo") on the result but ignores the value
    return { select: jest.fn().mockResolvedValue(deleted) };
  });

  // save: upsert by _id – handles both initial create and post-update save
  jest
    .spyOn(productModel.prototype, "save")
    .mockImplementation(async function () {
      const idx = productStore.findIndex(
        (p) => p._id?.toString() === this._id?.toString()
      );
      if (idx !== -1) {
        productStore[idx] = this;
      } else {
        productStore.push(this);
      }
      return this;
    });

  // ── categoryModel stubs ───────────────────────────────────────────────────
  jest.spyOn(categoryModel, "findOne").mockImplementation((query) => {
    const [field, value] = Object.entries(query)[0];
    return Promise.resolve(
      categoryStore.find((c) => c[field] === value) ?? null
    );
  });

  // ── fs.readFileSync stub ──────────────────────────────────────────────────
  jest
    .spyOn(fs, "readFileSync")
    .mockReturnValue(Buffer.from("fake-image-data"));
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────

const validFields = {
  name: "Galaxy S24",
  description: "flagship smartphone",
  price: "999",
  category: "cat-1",
  quantity: "10",
};

const validPhoto = {
  path: "/tmp/galaxy.jpg",
  type: "image/jpeg",
  size: 500_000,
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("productController integration tests", () => {
  // ── 1. Create success (201) ─────────────────────────────────────────────
  it("creates a product (201): slug = real slugify(name), photo.data from readFileSync, photo.contentType from file type", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    const req = { fields: { ...validFields }, files: { photo: validPhoto } };
    const res = buildRes();

    await createProductController(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const { success, message, products } = res.send.mock.calls[0][0];
    expect(success).toBe(true);
    expect(message).toBe("Product Created Successfully");

    // Real slugify integration: slug must equal slugify("Galaxy S24")
    expect(products.slug).toBe(slugify("Galaxy S24"));

    // fs.readFileSync was called with the uploaded photo path
    expect(fs.readFileSync).toHaveBeenCalledWith(validPhoto.path);

    // photo.data is the Buffer returned by readFileSync
    expect(Buffer.isBuffer(products.photo.data)).toBe(true);
    expect(products.photo.data.toString()).toBe("fake-image-data");

    // photo.contentType comes from the file's MIME type
    expect(products.photo.contentType).toBe("image/jpeg");

    // Exactly one document persisted to the in-memory store
    expect(productStore).toHaveLength(1);
    expect(productStore[0].slug).toBe(slugify("Galaxy S24"));
  });

  // ── 2. Create without photo ─────────────────────────────────────────────
  // Verifies the conditional photo branch: when no file is uploaded,
  // fs.readFileSync must not be called and the product is still persisted
  // with an empty photo subdocument on a real mongoose Document.
  it("creates a product without a photo: readFileSync not called, photo subdoc remains empty", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    const req = { fields: { ...validFields }, files: {} };
    const res = buildRes();

    await createProductController(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const { products } = res.send.mock.calls[0][0];

    // Real mongoose Document – not a plain object
    expect(products).toBeInstanceOf(productModel);

    // fs must never have been touched
    expect(fs.readFileSync).not.toHaveBeenCalled();

    // photo subdoc exists (mongoose initialises it) but has no data
    expect(products.photo.data).toBeUndefined();
    expect(products.photo.contentType).toBeUndefined();

    // Product reaches the store
    expect(productStore).toHaveLength(1);
  });

  // ── 3. Real mongoose schema rejects missing required fields at save time ─
  // Unlike the controller switch (which the unit tests already cover), this
  // test bypasses the controller's own validation to confirm the real
  // mongoose schema's `required: true` constraints are independently active.
  it("real productModel schema invalidates a document with missing required fields", () => {
    // Julius Bryan Reynon Gambe A0252251R
    const incompleteDoc = new productModel({ name: "Only Name" });
    const validationError = incompleteDoc.validateSync();

    expect(validationError).toBeDefined();
    const missing = Object.keys(validationError.errors);
    expect(missing).toEqual(
      expect.arrayContaining(["slug", "description", "price", "category", "quantity"])
    );
    // name was provided so it must not appear in errors
    expect(missing).not.toContain("name");
  });

  // ── 4. Get all products (200) ────────────────────────────────────────────
  it("returns up to 12 products (200), photo excluded, category populated, sorted desc by createdAt", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    for (let i = 1; i <= 3; i++) {
      productStore.push(
        new productModel({
          name: `Product ${i}`,
          slug: `product-${i}`,
          description: `desc ${i}`,
          price: i * 100,
          category: "cat-1",
          quantity: i,
        })
      );
    }

    const req = {};
    const res = buildRes();

    await getProductController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.send.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.products).toHaveLength(3);
    expect(payload.counTotal).toBe(3);

    // Verify the controller wired the query chain correctly
    expect(productModel.find).toHaveBeenCalledWith({});
    const chain = productModel.find.mock.results[0].value;
    expect(chain.populate).toHaveBeenCalledWith("category");
    expect(chain.select).toHaveBeenCalledWith("-photo");
    expect(chain.limit).toHaveBeenCalledWith(12);
    expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  // ── 5. Get single product (200) ──────────────────────────────────────────
  it("returns the matching product (200) by slug, with category populated and photo excluded", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    const doc = new productModel({
      name: "Galaxy S24",
      slug: slugify("Galaxy S24"),
      description: "flagship",
      price: 999,
      category: "cat-1",
      quantity: 5,
    });
    productStore.push(doc);

    const req = { params: { slug: doc.slug } };
    const res = buildRes();

    await getSingleProductController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.send.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.message).toBe("Single Product Fetched");
    expect(payload.product).toBeDefined();
    expect(payload.product.slug).toBe(doc.slug);

    // Verify query chain options
    const chain = productModel.findOne.mock.results[0].value;
    expect(chain.select).toHaveBeenCalledWith("-photo");
    expect(chain.populate).toHaveBeenCalledWith("category");
  });

  // ── 6. Update success (201) ──────────────────────────────────────────────
  it("updates a product (201): slug regenerated via real slugify, photo replaced when a new photo is provided", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    // Create an initial product so the store holds a real mongoose Document
    const createReq = { fields: { ...validFields }, files: { photo: validPhoto } };
    const createRes = buildRes();
    await createProductController(createReq, createRes);
    const pid = productStore[0]._id.toString();

    const newPhoto = { path: "/tmp/new.png", type: "image/png", size: 200_000 };
    const updateReq = {
      params: { pid },
      fields: {
        name: "Galaxy S25",
        description: "next-gen phone",
        price: "1199",
        category: "cat-1",
        quantity: "8",
      },
      files: { photo: newPhoto },
    };
    const updateRes = buildRes();

    await updateProductController(updateReq, updateRes);

    expect(updateRes.status).toHaveBeenCalledWith(201);
    const payload = updateRes.send.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.message).toBe("Product Updated Successfully");

    // Slug must be regenerated from the new name via real slugify
    expect(payload.products.slug).toBe(slugify("Galaxy S25"));
    expect(payload.products.slug).not.toBe(slugify("Galaxy S24"));

    // Photo replaced: readFileSync called with new path, contentType updated
    expect(fs.readFileSync).toHaveBeenLastCalledWith("/tmp/new.png");
    expect(payload.products.photo.contentType).toBe("image/png");

    // Store still has exactly one product (updated in-place, not duplicated)
    expect(productStore).toHaveLength(1);
    expect(productStore[0].slug).toBe(slugify("Galaxy S25"));
  });

  // ── 7. Update without a new photo: existing photo preserved ─────────────
  // Verifies the conditional photo branch in updateProductController:
  // when files is empty the existing photo subdocument is carried forward
  // unchanged and fs.readFileSync is never invoked.
  it("update without new photo (201): existing photo data preserved, readFileSync not called", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    // Seed via create so the store holds a real mongoose Document with photo
    const createReq = { fields: { ...validFields }, files: { photo: validPhoto } };
    const createRes = buildRes();
    await createProductController(createReq, createRes);
    const pid = productStore[0]._id.toString();

    // Clear the spy call count so we can assert on the update call only
    fs.readFileSync.mockClear();

    const updateReq = {
      params: { pid },
      fields: { ...validFields, name: "Galaxy S25", price: "1199" },
      files: {}, // no new photo
    };
    const updateRes = buildRes();

    await updateProductController(updateReq, updateRes);

    expect(updateRes.status).toHaveBeenCalledWith(201);
    const { products } = updateRes.send.mock.calls[0][0];

    // readFileSync must not be called again – no new photo provided
    expect(fs.readFileSync).not.toHaveBeenCalled();

    // The photo subdoc from the original create is preserved
    expect(products.photo.data.toString()).toBe("fake-image-data");
    expect(products.photo.contentType).toBe("image/jpeg");

    // Slug regenerated for the new name
    expect(products.slug).toBe(slugify("Galaxy S25"));

    // Still one product in the store
    expect(productStore).toHaveLength(1);
  });

  // ── 8. Delete success (200) ──────────────────────────────────────────────
  it("deletes a product (200) and removes it from the store", async () => {
    // Julius Bryan Reynon Gambe A0252251R
    // Seed via createProductController so the document is a real mongoose instance
    const createReq = { fields: { ...validFields }, files: {} };
    const createRes = buildRes();
    await createProductController(createReq, createRes);
    expect(productStore).toHaveLength(1);
    const pid = productStore[0]._id.toString();

    const deleteReq = { params: { pid } };
    const deleteRes = buildRes();

    await deleteProductController(deleteReq, deleteRes);

    expect(deleteRes.status).toHaveBeenCalledWith(200);
    expect(deleteRes.send).toHaveBeenCalledWith({
      success: true,
      message: "Product Deleted successfully",
    });
    expect(productStore).toHaveLength(0);
  });
});
