import sql from "./db.js";
import lang from "./lang/en.js";

export async function usage(req, res) {
  const response = {
    result: 0,
    data: [],
    message: '',
    error: '',
    received: req.body
  };

  try {
    const result = await sql`
      SELECT endpoint, method, requests
      FROM usage
      ORDER BY method;
    `;
    response.data = result;
  } catch (error) {
    response.result = 1;
    response.message = lang("UsageRetrievalFailed");
    res.status(500).json(response);
    return;
  }
  response.message = lang("UsageRetrievalSucceeded");
  res.json(response);
}