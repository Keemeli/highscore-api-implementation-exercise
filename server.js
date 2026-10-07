const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const jwt = require("jsonwebtoken");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const crypto = require("crypto");

app.use(express.json()); // for parsing application/json

// ------ WRITE YOUR SOLUTION HERE BELOW ------//

const JWT_SECRET = process.env.JWT_SECRET || "game-high-scores-secret";
const PAGE_SIZE = 20;

// In-memory storage. Note: this module is required once and shared by all
// test files in a single mocha run, so state persists between them
// (e.g. DukeNukem is signed up in two test files - re-signup must stay 201).
const users = []; // { userHandle, passwordHash }
const scores = []; // { level, userHandle, score, timestamp }

// ---- Request body validation (AJV, no type coercion, format checks) ----
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const signupSchema = {
  type: "object",
  required: ["userHandle", "password"],
  additionalProperties: false,
  properties: {
    userHandle: { type: "string", minLength: 6 },
    password: { type: "string", minLength: 6 },
  },
};

const loginSchema = {
  type: "object",
  required: ["userHandle", "password"],
  additionalProperties: false,
  properties: {
    userHandle: { type: "string", minLength: 1 },
    password: { type: "string", minLength: 1 },
  },
};

const highScoreSchema = {
  type: "object",
  required: ["level", "userHandle", "score", "timestamp"],
  additionalProperties: false,
  properties: {
    level: { type: "string", minLength: 1 },
    userHandle: { type: "string", minLength: 1 },
    score: { type: "integer" },
    timestamp: { type: "string", format: "date-time" },
  },
};

const validateSignup = ajv.compile(signupSchema);
const validateLogin = ajv.compile(loginSchema);
const validateHighScore = ajv.compile(highScoreSchema);

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// ---- POST /signup: register a user ----
app.post("/signup", (req, res) => {
  if (!validateSignup(req.body)) {
    return res.status(400).json({ error: "Invalid request body" });
  }
  const { userHandle, password } = req.body;
  if (!users.some((user) => user.userHandle === userHandle)) {
    users.push({ userHandle, passwordHash: hashPassword(password) });
  }
  return res.status(201).json({ message: "User registered successfully" });
});

// ---- POST /login: verify credentials, return JWT ----
app.post("/login", (req, res) => {
  if (!validateLogin(req.body)) {
    return res.status(400).json({ error: "Invalid request body" });
  }
  const { userHandle, password } = req.body;
  const user = users.find((candidate) => candidate.userHandle === userHandle);
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: "Incorrect username or password" });
  }
  const jsonWebToken = jwt.sign({ userHandle }, JWT_SECRET);
  return res.status(200).json({ jsonWebToken });
});

// ---- JWT authentication middleware for protected routes ----
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "JWT token is missing or invalid" });
  }
  const token = authHeader.split(" ")[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "JWT token is missing or invalid" });
  }
}

// ---- POST /high-scores: submit a high score (JWT protected) ----
app.post("/high-scores", authenticateJWT, (req, res) => {
  if (!validateHighScore(req.body)) {
    return res.status(400).json({ error: "Invalid request body" });
  }
  scores.push({ ...req.body });
  return res.status(201).json({ message: "High score posted successfully" });
});

// ---- GET /high-scores: list scores for a level, sorted, paginated ----
app.get("/high-scores", (req, res) => {
  const level = req.query.level;
  if (typeof level !== "string" || level.length === 0) {
    return res
      .status(400)
      .json({ error: "Missing or invalid level query parameter" });
  }
  const requestedPage = parseInt(req.query.page, 10);
  const page = Number.isNaN(requestedPage) ? 1 : Math.max(1, requestedPage);

  const levelScores = scores
    .filter((score) => score.level === level)
    .sort((a, b) => b.score - a.score);

  const start = (page - 1) * PAGE_SIZE;
  return res.status(200).json(levelScores.slice(start, start + PAGE_SIZE));
});

//------ WRITE YOUR SOLUTION ABOVE THIS LINE ------//

let serverInstance = null;
module.exports = {
  start: function () {
    serverInstance = app.listen(port, () => {
      console.log(`Example app listening at http://localhost:${port}`);
    });
  },
  close: function () {
    if (serverInstance) {
      serverInstance.close();
    }
  },
};
