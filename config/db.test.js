import mongoose from "mongoose";
import connectDB from "./db.js";

jest.mock("mongoose", () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
  },
}));

describe("connectDB", () => {
  let logSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    process.env.MONGO_URL = "mongodb://localhost:27017/virtual-vault";
    jest.clearAllMocks();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  // ZYON AARONEL WEE ZHUN WEI, A0277598B
  it("connects to MongoDB and logs the connected host", async () => {
    // Arrange
    mongoose.connect.mockResolvedValue({
      connection: { host: "localhost" },
    });

    // Act
    await connectDB();

    // Assert
    expect(mongoose.connect).toHaveBeenCalledWith(process.env.MONGO_URL);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Connected To Mongodb Database localhost")
    );
  });

  // ZYON AARONEL WEE ZHUN WEI, A0277598B
  it("logs the connection error when MongoDB connection fails", async () => {
    // Arrange
    mongoose.connect.mockRejectedValue(new Error("connection failed"));

    // Act
    await connectDB();

    // Assert
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error in Mongodb Error: connection failed")
    );
  });
});
