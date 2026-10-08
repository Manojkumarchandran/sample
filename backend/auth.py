import os
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SUPABASE_URL = os.environ["SUPABASE_URL"]
jwks = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json", cache_keys=True)
_bearer = HTTPBearer()

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(_bearer)) -> dict:
    token = creds.credentials
    try:
        key = jwks.get_signing_key_from_jwt(token).key
        claims = jwt.decode(token, key, algorithms=["ES256", "RS256"], audience="authenticated")
    except jwt.PyJWTError:
        try:
            # Fallback for HS256 legacy setups
            jwt_secret = os.getenv("SUPABASE_JWT_SECRET")
            if jwt_secret:
                claims = jwt.decode(token, jwt_secret, algorithms=["HS256"], audience="authenticated")
            else:
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
        except jwt.PyJWTError:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
            
    return {"id": claims["sub"], "email": claims.get("email"), "token": token}