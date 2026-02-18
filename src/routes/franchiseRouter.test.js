const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");
const { StatusCodeError } = require("../endpointHelper.js");

const testFranchise = {
  name: "pizzaPocket",
  admins: [{ email: "reg@test.com" }],
};
let adminUser;
let adminUserAuthToken;
let franchiseId;
let storeId;

beforeAll(async () => {
  adminUser = await createAdminUser();
  const loginRes = await request(app).put("/api/auth").send(adminUser);
  expect(loginRes.status).toBe(200);
  adminUserAuthToken = loginRes.body.token;
  testFranchise.admins[0].email = adminUser.email;
});

test("StatusCodeError should store message and status", () => {
  const error = new StatusCodeError("Unauthorized access", 401);

  expect(error.message).toBe("Unauthorized access");
  expect(error.status).toBe(401);
  expect(error instanceof Error).toBe(true);
});

test("create franchise", async () => {
  testFranchise.name = randomName();
  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminUserAuthToken}`)
    .send(testFranchise);

  expect(createFranchiseRes.status).toBe(200);
  expect(createFranchiseRes.body.name).toBe(testFranchise.name);
  franchiseId = createFranchiseRes.body.id;
});

test("should return 401 if no token is provided", async () => {
  const res = await request(app).post("/api/franchise").send(testFranchise);
  expect(res.status).toBe(401);
});

test("create store", async () => {
  const storeName = randomName();
  const storeRequest = { franchiseId: franchiseId, name: storeName };
  const createStoreRes = await request(app)
    .post(`/api/franchise/${franchiseId}/store`)
    .set("Authorization", `Bearer ${adminUserAuthToken}`)
    .send(storeRequest);

  expect(createStoreRes.status).toBe(200);
  expect(createStoreRes.body.name).toBe(storeName);
  storeId = createStoreRes.body.id;
});

test("get franchises", async () => {
  const getFranchiseRes = await request(app)
    .get(`/api/franchise?page=0&limit=10&name=${testFranchise.name}`)
    .set("Authorization", `Bearer ${adminUserAuthToken}`);

  expect(getFranchiseRes.status).toBe(200);
  expect(getFranchiseRes.body.franchises[0].name).toBe(testFranchise.name);
  expect(getFranchiseRes.body.franchises[0].id).toBe(franchiseId);
});

test("get user franchises", async () => {
  const getUserFranchiseRes = await request(app)
    .get(`/api/franchise/${adminUser.id}`)
    .set("Authorization", `Bearer ${adminUserAuthToken}`);

  expect(getUserFranchiseRes.status).toBe(200);
  expect(getUserFranchiseRes.body[0].name).toBe(testFranchise.name);
  expect(getUserFranchiseRes.body[0].id).toBe(franchiseId);
});

test("add menu item", async () => {
  const menuItem = {
    title: "Veggie",
    description: "Veggie con carne",
    image: "veggie.jpg",
    price: 0.05,
  };

  const addMenuItemRes = await request(app)
    .put("/api/order/menu")
    .set("Authorization", `Bearer ${adminUserAuthToken}`)
    .send(menuItem);

  expect(addMenuItemRes.status).toBe(200);
  expect(addMenuItemRes.body).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        title: "Veggie",
        description: "Veggie con carne",
        image: "veggie.jpg",
        price: 0.05,
      }),
    ]),
  );
});

test("create order", async () => {
  const order = {
    franchiseId: franchiseId,
    storeId: storeId,
    items: [
      {
        menuId: 1,
        description: "Veggie",
        price: 0.05,
      },
    ],
  };

  const createOrderRes = await request(app)
    .post("/api/order")
    .set("Authorization", `Bearer ${adminUserAuthToken}`)
    .send(order);

  expect(createOrderRes.status).toBe(200);
  expect(createOrderRes.body.order.franchiseId).toEqual(franchiseId);
  expect(createOrderRes.body.order.storeId).toEqual(storeId);
  expect(createOrderRes.body.order.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        menuId: 1,
        description: "Veggie",
        price: 0.05,
      }),
    ]),
  );
});

test("delete store", async () => {
  const deleteStoreRes = await request(app)
    .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
    .set("Authorization", `Bearer ${adminUserAuthToken}`);

  expect(deleteStoreRes.status).toBe(200);
  expect(deleteStoreRes.body.message).toBe("store deleted");
});

afterAll(async () => {
  const deleteFranchiseRes = await request(app)
    .delete(`/api/franchise/${franchiseId}`)
    .set("Authorization", `Bearer ${adminUserAuthToken}`)
    .send(testFranchise);

  expect(deleteFranchiseRes.status).toBe(200);
});

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  let user = {
    name: "temp",
    password: "toomanysecrets",
    email: "test",
    roles: [{ role: Role.Admin }],
  };
  user.name = randomName();
  user.email = user.name + "@admin.com";
  console.log("Admin email:", user.email);

  user = await DB.addUser(user);
  return { ...user, password: "toomanysecrets" };
}
