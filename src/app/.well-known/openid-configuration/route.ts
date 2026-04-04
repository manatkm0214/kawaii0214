import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    issuer: "https://kawaii0214.vercel.app",
    authorization_endpoint: "https://kawaii0214.vercel.app/oauth/authorize",
    token_endpoint: "https://kawaii0214.vercel.app/oauth/token",
    userinfo_endpoint: "https://kawaii0214.vercel.app/oauth/userinfo",
    jwks_uri: "https://kawaii0214.vercel.app/.well-known/jwks.json",
    response_types_supported: ["code", "id_token", "token id_token"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid", "profile", "email"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
    claims_supported: ["sub", "iss", "aud", "exp", "iat", "name", "email"],
  });
}
