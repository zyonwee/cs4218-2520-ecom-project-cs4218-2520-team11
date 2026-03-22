import { MongoClient } from "mongodb";

async function globalSetup() {
  const client = new MongoClient(
    "mongodb://root:password@localhost:27017/test?authSource=admin",
  );

  try {
    await client.connect();
    const db = client.db("test");

    // Delete test2's user so registration test can run fresh every time
    await db.collection("users").deleteOne({ email: "test1234@gmail.com" });

    // Also clear their cart orders if any
    await db.collection("orders").deleteMany({ buyer: "test1234@gmail.com" });

    console.log("✅ Global setup complete");
  } finally {
    await client.close();
  }
}

export default globalSetup;
