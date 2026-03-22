import { jest } from "@jest/globals";
import {
  categoryControlller,
  singleCategoryController,
  createCategoryController,
  updateCategoryController,
  deleteCategoryController,
} from "./categoryController.js";
import categoryModel from "../models/categoryModel.js";
import slugify from "slugify";

// ─────────────────────────────────────────────────────────────────────────────
// Module Mocks
// ─────────────────────────────────────────────────────────────────────────────

// This mock supports BOTH:
// 1) Zyon's tests: categoryModel.find / categoryModel.findOne
// 2) Julius tests: new categoryModel({...}).save() + static methods
jest.mock("../models/categoryModel.js", () => {
  const MockCategoryModel = jest.fn().mockImplementation(() => ({
    save: jest.fn(),
  }));

  // Static methods used across both test suites
  MockCategoryModel.find = jest.fn();
  MockCategoryModel.findOne = jest.fn();
  MockCategoryModel.findByIdAndUpdate = jest.fn();
  MockCategoryModel.findByIdAndDelete = jest.fn();

  return { __esModule: true, default: MockCategoryModel };
});

jest.mock("slugify", () => ({
  __esModule: true,
  default: jest.fn((str) => str.toLowerCase().replace(/\s+/g, "-")),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Shared Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

const buildRes = () => ({
  status: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
});

// ─────────────────────────────────────────────────────────────────────────────
// categoryControlller + singleCategoryController (ZYON)
// ─────────────────────────────────────────────────────────────────────────────

describe("categoryController", () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => { });
    jest.clearAllMocks();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  // ZYON AARONEL WEE ZHUN WEI, A0277598B
  it("returns all categories with success payload", async () => {
    // Arrange
    const req = {};
    const res = buildRes();
    const categories = [{ _id: "1", name: "Phones" }];
    categoryModel.find.mockResolvedValue(categories);

    // Act
    await categoryControlller(req, res);

    // Assert
    expect(categoryModel.find).toHaveBeenCalledWith({});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "All Categories List",
      category: categories,
    });
  });

  // ZYON AARONEL WEE ZHUN WEI, A0277598B
  it("returns 500 when fetching categories fails", async () => {
    // Arrange
    const req = {};
    const res = buildRes();
    const error = new Error("db failed");
    categoryModel.find.mockRejectedValue(error);

    // Act
    await categoryControlller(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      error,
      message: "Error while getting all categories",
    });
  });

  // ZYON AARONEL WEE ZHUN WEI, A0277598B
  it("returns a single category by slug", async () => {
    // Arrange
    const req = { params: { slug: "phones" } };
    const res = buildRes();
    const category = { _id: "1", name: "Phones", slug: "phones" };
    categoryModel.findOne.mockResolvedValue(category);

    // Act
    await singleCategoryController(req, res);

    // Assert
    expect(categoryModel.findOne).toHaveBeenCalledWith({ slug: "phones" });
    expect(res.status).toHaveBeenCalledWith(200);

    // NOTE: Prefer refactor-resistant assertion; message casing may change
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        category,
        message: expect.any(String),
      })
    );
  });

  // ZYON AARONEL WEE ZHUN WEI, A0277598B
  it("returns 500 when fetching a single category fails", async () => {
    // Arrange
    const req = { params: { slug: "phones" } };
    const res = buildRes();
    const error = new Error("db error");
    categoryModel.findOne.mockRejectedValue(error);

    // Act
    await singleCategoryController(req, res);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      error,
      message: "Error While getting Single Category",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createCategoryController (Julius)
// ─────────────────────────────────────────────────────────────────────────────

describe("createCategoryController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {}, params: {} };
    res = buildRes();
    slugify.mockReturnValue("electronics");
  });

  it("given no name in request body – should return 401 with error message", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.body = {};

    // When
    await createCategoryController(req, res);

    // Then
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({ message: "Name is required" });
  });

  it("given an empty string name – should return 401 with error message", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.body = { name: "" };

    // When
    await createCategoryController(req, res);

    // Then
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({ message: "Name is required" });
  });

  it("given a whitespace-only name – should return 401 with error message", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.body = { name: "   " };

    // When
    await createCategoryController(req, res);

    // Then
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({ message: "Name is required" });
  });

  it("given a name that already exists – should return 409 with already exists message", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.body = { name: "Electronics" };
    categoryModel.findOne.mockResolvedValueOnce({
      _id: "cat1",
      name: "Electronics",
      slug: "electronics",
    });

    // When
    await createCategoryController(req, res);

    // Then
    expect(categoryModel.findOne).toHaveBeenCalledWith({
      name: { $regex: expect.any(RegExp) },
    });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category Already Exists",
    });
  });

  it("given a name that already exists in different case – should return 409", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.body = { name: "electronics" };
    categoryModel.findOne.mockResolvedValueOnce({
      _id: "cat1",
      name: "Electronics",
      slug: "electronics",
    });

    // When
    await createCategoryController(req, res);

    // Then
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith({
      success: false,
      message: "Category Already Exists",
    });
    // Verify the regex passed to findOne is case-insensitive
    const queryArg = categoryModel.findOne.mock.calls[0][0];
    expect(queryArg.name.$regex.flags).toContain("i");
  });

  it("given a valid new category name – should slugify name, save, and return 201", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.body = { name: "Electronics" };
    categoryModel.findOne.mockResolvedValueOnce(null);
    const savedCategory = {
      _id: "cat1",
      name: "Electronics",
      slug: "electronics",
    };
    const mockSave = jest.fn().mockResolvedValueOnce(savedCategory);
    categoryModel.mockImplementationOnce(() => ({ save: mockSave }));

    // When
    await createCategoryController(req, res);

    // Then
    expect(slugify).toHaveBeenCalledWith("Electronics");
    expect(mockSave).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "new category created",
      })
    );
  });

  it("given a valid new category name – should construct the model with name and slug", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.body = { name: "Laptops" };
    slugify.mockReturnValue("laptops");
    categoryModel.findOne.mockResolvedValueOnce(null);
    categoryModel.mockImplementationOnce(() => ({
      save: jest.fn().mockResolvedValueOnce({ _id: "cat2" }),
    }));

    // When
    await createCategoryController(req, res);

    // Then
    expect(categoryModel).toHaveBeenCalledWith({
      name: "Laptops",
      slug: "laptops",
    });
  });

  it("given a database error – should return 500 with error details", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.body = { name: "Electronics" };
    const dbError = new Error("DB Error");
    categoryModel.findOne.mockRejectedValueOnce(dbError);

    // When
    await createCategoryController(req, res);

    // Then
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: dbError,
        message: "Error in Category",
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateCategoryController (Julius)
// ─────────────────────────────────────────────────────────────────────────────

describe("updateCategoryController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {}, params: {} };
    res = buildRes();
    slugify.mockImplementation((str) => str.toLowerCase().replace(/\s+/g, "-"));
  });

  it("given no name in request body – should return 401 with error message", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.body = {};
    req.params = { id: "cat1" };

    // When
    await updateCategoryController(req, res);

    // Then
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({ message: "Name is required" });
    expect(categoryModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("given an empty string name – should return 401 with error message", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.body = { name: "" };
    req.params = { id: "cat1" };

    // When
    await updateCategoryController(req, res);

    // Then
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({ message: "Name is required" });
    expect(categoryModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("given a whitespace-only name – should return 401 with error message", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.body = { name: "   " };
    req.params = { id: "cat1" };

    // When
    await updateCategoryController(req, res);

    // Then
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith({ message: "Name is required" });
    expect(categoryModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("given a valid name and id – should update category and return 200", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.body = { name: "Updated Electronics" };
    req.params = { id: "cat1" };
    const updatedCategory = {
      _id: "cat1",
      name: "Updated Electronics",
      slug: "updated-electronics",
    };
    categoryModel.findByIdAndUpdate.mockResolvedValueOnce(updatedCategory);

    // When
    await updateCategoryController(req, res);

    // Then
    expect(categoryModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "cat1",
      { name: "Updated Electronics", slug: expect.any(String) },
      { new: true }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        category: updatedCategory,
      })
    );
  });

  it("given a valid name – should call slugify with the new name", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.body = { name: "New Category Name" };
    req.params = { id: "cat2" };
    categoryModel.findByIdAndUpdate.mockResolvedValueOnce({
      _id: "cat2",
      name: "New Category Name",
    });

    // When
    await updateCategoryController(req, res);

    // Then
    expect(slugify).toHaveBeenCalledWith("New Category Name");
  });

  it("given a valid update – should pass { new: true } to get the updated document", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.body = { name: "Gadgets" };
    req.params = { id: "cat3" };
    categoryModel.findByIdAndUpdate.mockResolvedValueOnce({ _id: "cat3" });

    // When
    await updateCategoryController(req, res);

    // Then
    const callArgs = categoryModel.findByIdAndUpdate.mock.calls[0];
    expect(callArgs[2]).toEqual({ new: true });
  });

  it("given a database error – should return 500 with error details", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.body = { name: "Electronics" };
    req.params = { id: "cat1" };
    categoryModel.findByIdAndUpdate.mockRejectedValueOnce(new Error("DB Error"));

    // When
    await updateCategoryController(req, res);

    // Then
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Error while updating category",
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// deleteCategoryController (Julius)
// ─────────────────────────────────────────────────────────────────────────────

describe("deleteCategoryController", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { params: {} };
    res = buildRes();
  });

  it("given a valid category id – should delete it and return 200", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.params = { id: "cat1" };
    categoryModel.findByIdAndDelete.mockResolvedValueOnce({ _id: "cat1" });

    // When
    await deleteCategoryController(req, res);

    // Then
    expect(categoryModel.findByIdAndDelete).toHaveBeenCalledWith("cat1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "Category Deleted Successfully",
    });
  });

  it("given a non-existent id – should still return 200 (delete is idempotent)", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.params = { id: "nonexistent-id" };
    categoryModel.findByIdAndDelete.mockResolvedValueOnce(null);

    // When
    await deleteCategoryController(req, res);

    // Then
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: true,
      message: "Category Deleted Successfully",
    });
  });

  it("given a valid id – should call findByIdAndDelete with the exact id", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.params = { id: "cat-xyz-123" };
    categoryModel.findByIdAndDelete.mockResolvedValueOnce({});

    // When
    await deleteCategoryController(req, res);

    // Then
    expect(categoryModel.findByIdAndDelete).toHaveBeenCalledWith("cat-xyz-123");
  });

  it("given a database error – should return 500 with error details", async () => {
    //Julius Bryan Reynon Gambe, A0252251R
    // Given
    req.params = { id: "cat1" };
    categoryModel.findByIdAndDelete.mockRejectedValueOnce(new Error("DB Error"));

    // When
    await deleteCategoryController(req, res);

    // Then
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "error while deleting category",
      })
    );
  });
});