const test = require("node:test");
const assert = require("node:assert/strict");
const { manejarRequest } = require("./http");

const createResponse = () => ({
  statusCode: 200,
  payload: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

test("manejarRequest unwraps Firebase-style data and returns a typed result", async () => {
  const req = { body: { data: { value: 7 } } };
  const res = createResponse();

  await manejarRequest(req, res, async (data) => ({ doubled: data.value * 2 }));

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, { data: { doubled: 14 } });
});

test("manejarRequest reports handler failures without exposing stack details", async () => {
  const req = { body: { data: {} } };
  const res = createResponse();

  await manejarRequest(req, res, async () => {
    throw new Error("controlled failure");
  });

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.payload, { error: { message: "controlled failure" } });
});
