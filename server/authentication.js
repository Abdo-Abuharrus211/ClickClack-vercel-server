import sql from './db.js';
import Joi from 'joi'
import bcrypt from 'bcrypt';
import lang from './lang/en.js';
import jwt from 'jsonwebtoken';


export async function signup(req, res) {
  const response = {
    result: 0, // bad if 1, gud if 0
    data: {},
    message: '',
    error: '',
    received: 'Sign up credentials'
  };

  // input validation
  const schema = Joi.object({
    display_name: Joi.string()
      .min(3)
      .max(30)
      .required(),

    password: Joi.string()
      .pattern(new RegExp('^[a-zA-Z0-9]{3,30}$'))
      .required(),

    email: Joi.string()
      .email()
      .required()
  });
  const validation = schema.validate(req.body);
  if (validation.error !== undefined) {
    response.result = 1;
    response.message = lang("SignupFailure");
    response.error = validation.error.details;
    res.status(400).json(response);
    return;
  }

  // check if user already exists
  try {
    const [{ exists }] = await sql`
      SELECT EXISTS(SELECT 1 FROM users WHERE email = ${req.body.email});
    `;
    if (exists) {
      response.result = 1;
      response.message = lang("SignupUserAlreadyExists");
      res.status(409).json(response);
      return;
    }
  } catch (error) {
    response.result = 1;
    response.message = lang("InternalServerError");
    response.error = error;
    res.status(500).json(response);
    return;
  }

  // salt and hash
  const saltRounds = 10;
  const salt = await bcrypt.genSalt(saltRounds); // Generate a salt
  const hash = await bcrypt.hash(req.body.password, salt); // Hash password with salt

  try {
    const [{ userid }] = await sql`
      INSERT INTO users (display_name, email, password_hash, role)
      VALUES(${req.body.display_name}, ${req.body.email}, ${hash}, 'user')
      RETURNING userid;
    `;

    await sql`
      INSERT INTO ai_usage (userid, remaining_tokens)
      VALUES(${userid}, 20);
    `;

    response.data.userid = userid;
    const SECRET_KEY = process.env.JWT_SECRET_KEY;
    const token = jwt.sign({userid, isAdmin: false }, SECRET_KEY, { expiresIn: "24h" });
    response.message = lang("SignupSuccess");
    setJWTCookie(res, token);
  } catch (error) {
    response.result = 1;
    response.message = lang("InternalServerError");
    response.error = error;
    res.status(500).json(response);
    return;
  }
  res.json(response);
}

export async function login(req, res) {
  const response = {
    result: 0,
    data: {},
    message: '',
    error: '',
    received: 'Login credentials'
  };

  // validate input
  const schema = Joi.object({
    email: Joi.string()
      .email()
      .required(),

    password: Joi.string()
      .pattern(new RegExp('^[a-zA-Z0-9]{3,30}$'))
      .required(),
  });

  const validation = schema.validate(req.body);
  if (validation.error !== undefined) {
    response.result = 1;
    response.error = validation.error.details;
    res.status(400).json(response);
    console.log("Failed to validate: Code 400")
    return;
  }

  const [user] = await sql`
    SELECT userid, display_name, password_hash, role
    FROM users
    WHERE email = ${req.body.email};
  `;

  if (!user){
    response.result = 1;
    response.error = lang("LoginUserNotFound");
    res.status(404).json(response);
    console.log("Failed to log in User not found 404!")
    return;
  }
  
  const isValidPassword = await bcrypt.compare(req.body.password, user.password_hash);
  if (!isValidPassword){
    response.result = 1;
    response.message = lang("LoginPasswordNotMatched");
    res.status(401).json(response);
    console.log("Failed to log in password not match 401")
    return;
  }

  response.data.isAdmin = user.role === 'admin';
  const SECRET_KEY = process.env.JWT_SECRET_KEY;
  const token = jwt.sign({ userid: user.userid, isAdmin: user.role == "admin" }, SECRET_KEY, { expiresIn: "24h" });
  response.message = lang("LoginSuccess");
  setJWTCookie(res, token)
  
  res.json(response);
}

export async function isAuthenticated(req, res) {
  const response = {
    result: 0,
    data: {
      loggedin: false,
      isAdmin: false
    },
    message: '',
    error: '',
    received: ''
  };
  
  const token = req.cookies.token;

  if (!token) {
    response.result = 1;
    response.message = lang("LoginNoUserToken");
    res.status(401).json(response);
    return;
  }

  const SECRET_KEY = process.env.JWT_SECRET_KEY;
  try {
    const { userid, isAdmin } = jwt.verify(token, SECRET_KEY);
    response.data.loggedin = true;
    response.data.userid = userid;
    response.data.isAdmin = isAdmin;
    response.message = lang("LoginUserLoggedIn");
  } catch (error) {
    response.result = 1;
    response.error = error;
    response.message = lang("LoginUserNotLoggedIn");
    res.status(403).json(response);
    return;
  }

  res.json(response);
}

export async function logout(req, res) {
  console.log("Logging Out 🪵🪵🪵");
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.ENVIRONMENT !== 'dev',
    sameSite: 'None'
  });
  res.json({ message: lang("ClearedCookie") });
}

export function middleware(req, res, next) {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      res.status(401).json({ message: lang("UserUnauthorizedNoToken") });
      return;
    }

    const SECRET_KEY = process.env.JWT_SECRET_KEY;
    const tokenData = jwt.verify(token, SECRET_KEY);
    req.userid = tokenData.userid; // Attach user data to request
    req.isAdmin = tokenData.isAdmin;
    next();
  } catch (error) {
    console.log("User unauthorized 403 ❌❌")
    res.status(403).json({ message: lang("UserUnauthorized") });
    return;
  }
}

// Must be called after middlware above
export function adminMiddleware(req, res, next) {
  if (req.isAdmin) {
    next();
    return;
  }

  res.status(403).json({ message: lang("UserUnauthorized") });
  return;
}

// function setJWTCookie(res, token) {
//   res.cookie("token", token, {
//     httpOnly: true,
//     secure: process.env.ENVIRONMENT !== "dev",
//     sameSite: "None",   // Required for cross-origin cookies
//     // partitioned: true,
//     maxAge: 86400000 // 24 hours
//   });
// }
function setJWTCookie(res, token) {
  console.log("Setting Token 🪙🪙🪙");
  console.log(`Prod secure verified? ${process.env.ENVIRONMENT !== 'dev'} cuz the value is ${process.env.ENVIRONMENT}`);
  console.log(`Secure mode: ${process.env.ENVIRONMENT !== 'dev'}`);
  res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.ENVIRONMENT !== 'dev',
      sameSite: 'None', //  a must for cross origin cookies
      path: '/',
      domain: 'web-w9x2a113zzck.up-de-fra1-k8s-1.apps.run-on-seenode.com',
      partitioned: true,
      maxAge: 86400000, // milliseconds
  });
}