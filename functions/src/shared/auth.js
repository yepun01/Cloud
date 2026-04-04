async function getAuthenticatedUser(req) {
  const userId = req && req.body ? req.body.userId : undefined;
  if (typeof userId !== "string" || userId.length === 0) {
    return { authenticated: false, error: "Missing userId" };
  }
  if (userId.length > 100) {
    return { authenticated: false, error: "userId too long (max 100 chars)" };
  }
  return { authenticated: true, userId, source: "unauthenticated" };
}

module.exports = { getAuthenticatedUser };
