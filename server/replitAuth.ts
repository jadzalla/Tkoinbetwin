import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const isProduction = process.env.NODE_ENV === 'production';
  
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction, // Only require HTTPS in production
      maxAge: sessionTtl,
      sameSite: isProduction ? 'lax' : 'lax',
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  // Validate required claims
  if (!claims["sub"]) {
    throw new Error("User claims missing required 'sub' field");
  }
  
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"] || null,
    firstName: claims["first_name"] || null,
    lastName: claims["last_name"] || null,
    profileImageUrl: claims["profile_image_url"] || null,
  });
}

export async function setupAuth(app: Express) {
  // Only trust proxy in production (Replit always uses proxy)
  // In local dev, we may not have a proxy setup
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction || process.env.REPL_ID) {
    app.set("trust proxy", 1);
  }
  
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  // Keep track of registered strategies
  const registeredStrategies = new Set<string>();

  // Helper function to ensure strategy exists for a domain  
  const ensureStrategy = (protocol: string, host: string) => {
    const strategyName = `replitauth:${host}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `${protocol}://${host}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    const protocol = req.protocol;
    const host = req.get('host') || req.hostname;
    ensureStrategy(protocol, host);
    passport.authenticate(`replitauth:${host}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    const protocol = req.protocol;
    const host = req.get('host') || req.hostname;
    ensureStrategy(protocol, host);
    passport.authenticate(`replitauth:${host}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    const host = req.get('host') || req.hostname;
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${host}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

// Middleware to check if user is an approved agent
// NOTE: This should always be chained after isAuthenticated
export const isApprovedAgent: RequestHandler = async (req, res, next) => {
  // isAuthenticated should have already verified user and refreshed token
  const user = req.user as any;
  
  if (!user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  try {
    const agent = await storage.getAgentByReplitUserId(user.claims.sub);
    
    if (!agent) {
      return res.status(403).json({ message: "Not registered as an agent" });
    }
    
    if (agent.status !== 'active') {
      return res.status(403).json({ message: `Agent status is: ${agent.status}` });
    }
    
    // Attach agent to request for use in routes
    (req as any).agent = agent;
    next();
  } catch (error) {
    console.error("Error checking agent status:", error);
    res.status(500).json({ message: "Failed to verify agent status" });
  }
};

// Middleware to check if user is an admin
// NOTE: This should always be chained after isAuthenticated
export const isAdmin: RequestHandler = async (req, res, next) => {
  // isAuthenticated should have already verified user and refreshed token
  const user = req.user as any;
  
  if (!user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  try {
    const agent = await storage.getAgentByReplitUserId(user.claims.sub);
    
    // Check if agent has admin privileges (you can add an isAdmin field to agent schema)
    if (!agent || agent.status !== 'active') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    // For now, only specific agents can be admins
    // You can add an isAdmin boolean field to the agents table
    (req as any).agent = agent;
    next();
  } catch (error) {
    console.error("Error checking admin status:", error);
    res.status(500).json({ message: "Failed to verify admin status" });
  }
};
