const request = require("supertest");
const app = require("../service");
// const { Role, DB } = require("../database/database.js");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;
let userId;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  expectValidJwt(testUserAuthToken);
  userId = registerRes.body.user.id;
});

test("login", async () => {
  const loginRes = await request(app).put("/api/auth").send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { ...testUser, roles: [{ role: "diner" }] };
  delete expectedUser.password;
  expect(loginRes.body.user).toMatchObject(expectedUser);
});

test("update user", async () => {
  const userUpdate = {
    name: randomName(),
    email: randomName() + "@test.com",
    password: "b",
  };
  const updateUserRes = await request(app)
    .put(`/api/user/${userId}`)
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(userUpdate);

  expect(updateUserRes.status).toBe(200);
  expectValidJwt(updateUserRes.body.token);
  expect(updateUserRes.body.user.name).toBe(userUpdate.name);
  expect(updateUserRes.body.user.email).toBe(userUpdate.email);
  expect(updateUserRes.body.user.id).toBe(userId);
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/,
  );
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}
