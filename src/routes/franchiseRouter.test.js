const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

const testFranchise = {
  name: "pizzaPocket",
  admins: [{ email: "reg@test.com" }],
};
let adminUser;
let adminUserAuthToken;

beforeAll(async () => {
  adminUser = await createAdminUser();
  const loginRes = await request(app).put("/api/auth").send(adminUser);
  expect(loginRes.status).toBe(200);
  adminUserAuthToken = loginRes.body.token;
  testFranchise.admins[0].email = adminUser.email;
});

test("create franchise", async () => {
  testFranchise.name = randomName();
  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${adminUserAuthToken}`)
    .send(testFranchise);

  expect(createFranchiseRes.status).toBe(200);
  expect(createFranchiseRes.body.name).toBe(testFranchise.name);
});

test("should return 401 if no token is provided", async () => {
  const res = await request(app).post("/api/franchise").send(testFranchise);
  expect(res.status).toBe(401);
});

afterAll(async () => {
  const deleteFranchiseRes = await request(app)
    .delete("/api/franchise/:franchiseId")
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

  user = await DB.addUser(user);
  return { ...user, password: "toomanysecrets" };
}
