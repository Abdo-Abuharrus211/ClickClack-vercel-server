import express from 'express'
import * as auth from './authentication.js'
import bodyParser from 'body-parser'
import * as ai from './ai.js';
import * as test from './test.js';
import * as users from './users.js';
import lang from './lang/en.js';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import sql from './db.js';
import * as endpoints from './endpoints.js'
import swaggerUiDist from 'swagger-ui-dist';


const app = express();
const port = 3001;
const API_PREFIX = "/api/v1";




const __dirname = path.dirname(fileURLToPath(import.meta.url));
const swaggerDocument = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'swagger-output.json'), 'utf-8')
);
// app.use('/doc', express.static(swaggerUiDist.getAbsoluteFSPath()));
app.use(
  '/doc',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument)
);

// const swaggerDocument = JSON.parse(fs.readFileSync('./swagger-output.json', 'utf-8'));
// app.use(
//   '/doc',
//   swaggerUi.serve,
//   swaggerUi.setup(swaggerDocument, {
//     swaggerOptions: {
//       url: './swagger-output.json', // or wherever your spec lives
//     },
//   })
// );

// -------------------- Middleware --------------------
app.use(bodyParser.json()) // for parsing application/json
app.use(cookieParser()); // enables reading cookies from `req.cookies`
const allowedOrigins = [
  "https://click-clack-lime.vercel.app",
  "https://clickclack.aabuharrus.dev",
  "http://localhost:3000"
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, origin);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET, POST, PUT, DELETE, OPTIONS",
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  exposedHeaders: ["Set-Cookie"]
}));

// Automatically respond to OPTIONS (preflight) requests
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
  } else {
    next();
  }
});

// Track usage among endpoints
app.use(async (req, _, next) => {
  const method = req.method;
  const url = req.path;

  const routeExists = app._router.stack.some((layer) => {
    if (!layer.route) return false;
    const normalize = (path) => path.replace(/\/+$/, '');

    return (
      normalize(layer.route.path) === normalize(url) &&
      layer.route.methods[method.toLowerCase()]
    );
  });

  if (routeExists) {
    try {
      await sql`
        INSERT INTO usage (method, endpoint, requests)
        VALUES (${method}, ${url}, 1)
        ON CONFLICT (method, endpoint)
        DO UPDATE SET requests = usage.requests + 1;
      `;
    } catch (err) {
      console.error("Error inserting into usage table:", err);
    }
  }

  next();
});

// -------------------- Begin endpoints --------------------
app.get('/', (_, res) => {
  // #swagger.tags = ['Root']
  // #swagger.description = 'Returns a welcome message for the ClickClack API server.'
  res.send('This is the root of ClickClack\'s API server.')
})

app.get(`${API_PREFIX}/endpoints/usage/`, auth.middleware, auth.adminMiddleware, async (req, res) => {
  // #swagger.tags = ['Endpoints']
  // #swagger.description = 'Reveals usage information about API endpoints.'
  try {
    await endpoints.usage(req, res);
  } catch (error) {
    serverError(res, error)
  }
});

// -------------------- Auth endpoints --------------------
app.post(`${API_PREFIX}/auth/signup/`, async (req, res) => {
  // #swagger.tags = ['Auth']
  // #swagger.description = 'Creates a new user account with email and password.'
  try {
    await auth.signup(req, res);
  } catch (error) {
    serverError(res, error)
  }
});

app.post(`${API_PREFIX}/auth/login/`, async (req, res) => {
  // #swagger.tags = ['Auth']
  // #swagger.description = 'Authenticates a user and starts a new session.'
  try {
    await auth.login(req, res);
  } catch (error) {
    console.log(`Server error here in login endpoint: ${error}`)
    serverError(res, error)
  }
});

app.get(`${API_PREFIX}/auth/me/`, async (req, res) => {
  // #swagger.tags = ['Auth']
  // #swagger.description = 'Checks if the user is currently authenticated by verifying the session token.'
  try {
    await auth.isAuthenticated(req, res);
  } catch (error) {
    serverError(res, error);
  }
});

app.get(`${API_PREFIX}/auth/logout/`, async (req, res) => {
  // #swagger.tags = ['Auth']
  // #swagger.description = 'Logs the user out by clearing the session token stored in cookies.'
  try {
    await auth.logout(req, res);
  } catch (error) {
    serverError(res, error);
  }
});

// -------------------- User endpoints --------------------
app.get(`${API_PREFIX}/users/get-previous-prompts/`, auth.middleware, async (req, res) => {
  // #swagger.tags = ['Users']
  // #swagger.description = 'Retrieves a list of prompts previously generated by the logged-in user, including their ID, text, difficulty, and theme.'
  try {
    await test.getPreviousPrompts(req, res);
  } catch (error) {
    serverError(res, error);
  }
});

app.get(`${API_PREFIX}/users/profile/`, auth.middleware, async (req, res) => {
  // #swagger.tags = ['Users']
  // #swagger.description = 'Retrieves the logged-in user's profile information, including display name and remaining AI token count.'
  try {
    await users.getProfile(req, res);
  } catch (error) {
    serverError(res, error);
  }
});

app.get(`${API_PREFIX}/users/admin/`, auth.middleware, auth.adminMiddleware, async (req, res) => {
  // #swagger.tags = ['Users']
  // #swagger.description = 'Retrieves all user profiles including display names, remaining AI tokens, and roles. Accessible only to admin users.'
  try {
    await users.getAdmin(req, res);
  } catch (error) {
    serverError(res, error);
  }
});

app.put(`${API_PREFIX}/users/boost-tokens/`, auth.middleware, auth.adminMiddleware, async (req, res) => {
  // #swagger.tags = ['Users']
  // #swagger.description = 'Boosts the remaining AI tokens of a given user back to original amount (20).'
  try {
    await users.boostTokens(req, res);
  } catch (error) {
    serverError(res, error);
  }
});

// -------------------- Test endpoints --------------------
app.post(`${API_PREFIX}/tests/save-test/`, auth.middleware, async (req, res) => {
  // #swagger.tags = ['Tests']
  // #swagger.description = 'Saves a completed typing test for the authenticated user, including WPM, AWPM, and accuracy calculations.'
  try {
    await test.saveTest(req, res);
  } catch (error) {
    serverError(res, error);
  }
});

app.delete(`${API_PREFIX}/tests/remove-prompt/`, auth.middleware, async (req, res) => {
  // #swagger.tags = ['Tests']
  // #swagger.description = 'Boosts the remaining AI tokens of a given user back to original amount (20).'
  try {
    await test.removePrompt(req, res);
  } catch (error) {
    serverError(res, error);
  }
});

app.get(`${API_PREFIX}/tests/get-tests/`, auth.middleware, async (req, res) => {
  // #swagger.tags = ['Tests']
  // #swagger.description = 'Retrieves all previously completed typing tests for the authenticated user.'
  try {
    await test.getTests(req, res);
  } catch (error) {
    serverError(res, error);
  }
});

// -------------------- AI endpoints --------------------
app.post(`${API_PREFIX}/ai/generate-test-prompt/`, auth.middleware, async (req, res) => {
  // #swagger.tags = ['Tests']
  // #swagger.description = 'Generates a typing test prompt using a selected theme and difficulty level. The prompt is created by an AI model and saved to the database.'
  try {
    await ai.generateTestPrompt(req, res);
  } catch (error) {
    serverError(res, error)
  }
});

app.listen(port, () => {
  console.log(`ClickClack API listening on port ${port}...`)
});

function serverError(res, error) {
  console.log(error);
  res.status(500).json({ message: lang("InternalServerError"), error });
}