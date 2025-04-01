import sql from "./db.js";
import lang from "./lang/en.js";

export async function getProfile(req, res) {
  const response = {
    result: 0, // bad if 1, gud if 0
    data: {
      displayName: '',
      tokenCount: 0,
    },
    message: '',
    error: '',
    received: req.body
  };

  try {
    const [{ display_name, remaining_tokens }] = await sql`
      SELECT display_name, remaining_tokens
      FROM users
      JOIN ai_usage ON users.userid = ai_usage.userid
      WHERE users.userid = ${req.userid};
    `;
    response.data.displayName = display_name;
    response.data.tokenCount = remaining_tokens;
  } catch (error) {
    response.result = 1;
    response.message = lang("InternalServerError");
    response.error = error;
    res.status(500).json(response);
    return;
  }

  res.json(response);
}

export async function getAdmin(req, res) {
  const response = {
    result: 0, // bad if 1, gud if 0
    data: [],
    message: '',
    error: '',
    received: req.body
  };

  try {
    const result = await sql`
      SELECT 
        users.userid,
        display_name AS "displayName", 
        remaining_tokens AS "tokenCount", 
        role
      FROM users
      JOIN ai_usage ON users.userid = ai_usage.userid;
    `;
    // console.log(result);
    response.data = result;
  } catch (error) {
    response.result = 1;
    response.message = lang("InternalServerError");
    response.error = error;
    res.status(500).json(response);
    return;
  }

  res.json(response);
}

export async function boostTokens(req, res) {
  const response = {
    result: 0, // bad if 1, gud if 0
    message: '',
    error: '',
    received: req.body
  };

  try {
    await sql`
      UPDATE ai_usage 
      SET remaining_tokens = 20
      WHERE userid = ${req.body.userid};
    `;
  } catch (error) {
    response.result = 1;
    response.message = lang("BoostFailed");
    response.error = error;
    res.status(500).json(response);
    return;
  }
  response.message = lang("BoostSucceeded");
  res.json(response);
}