const request = require("supertest");
const app = require("../service");
const { DB } = require("../database/database.js");

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

test("list users unauthorized", async () => {
  const listUsersRes = await request(app).get("/api/user");
  expect(listUsersRes.status).toBe(401);
});

test("list users as admin", async () => {
  const adminUser = await DB.addUser({
    name: randomName(),
    email: randomName() + "@admin.com",
    password: "admin",
    roles: [{ role: "admin" }],
  });
  const loginRes = await request(app).put("/api/auth").send({
    email: adminUser.email,
    password: "admin",
  });
  const userAuthToken = loginRes.body.token;

  await request(app)
    .put("/api/user/" + adminUser.id)
    .set("Authorization", "Bearer " + userAuthToken)
    .send({
      name: adminUser.name,
      email: adminUser.email,
      password: adminUser.password,
      roles: [{ role: "admin" }],
    });

  const listUsersRes = await request(app)
    .get("/api/user")
    .set("Authorization", "Bearer " + userAuthToken);
  expect(listUsersRes.status).toBe(200);
});

test("delete user authorized", async () => {
  const adminUser = await DB.addUser({
    name: randomName(),
    email: randomName() + "@admin.com",
    password: "admin",
    roles: [{ role: "admin" }],
  });
  const loginRes = await request(app).put("/api/auth").send({
    email: adminUser.email,
    password: "admin",
  });
  const userAuthToken = loginRes.body.token;

  // Create a user to delete
  const userToDelete = await DB.addUser({
    name: randomName(),
    email: randomName() + "@test.com",
    password: "test",
    roles: [{ role: "diner" }],
  });

  const deleteUserRes = await request(app)
    .delete(`/api/user/${userToDelete.id}`)
    .set("Authorization", `Bearer ${userAuthToken}`);
  expect(deleteUserRes.status).toBe(200);
  expect(deleteUserRes.body.message).toBe("user deleted");
});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(
    /^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/,
  );
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}
