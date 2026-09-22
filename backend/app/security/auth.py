import hmac
import hashlib
import base64
import json
import time
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.config import settings

security_bearer = HTTPBearer(auto_error=False)

def create_dev_access_token(user_id: str, email: str) -> str:
    """
    Creates a development signed token: payload.signature
    NOTE: Production cryptographic identity (e.g. Ed25519 attestations / OIDC)
    belongs to future security hardening phases.
    """
    payload = {
        "sub": user_id,
        "email": email,
        "iat": int(time.time()),
        "exp": int(time.time()) + (86400 * 30),  # 30 days
    }
    payload_bytes = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode('utf-8').rstrip('=')

    sig = hmac.new(settings.SECRET_KEY.encode('utf-8'), payload_b64.encode('utf-8'), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).decode('utf-8').rstrip('=')

    return f"{payload_b64}.{sig_b64}"

def verify_dev_token(token: str) -> Optional[dict]:
    try:
        parts = token.split('.')
        if len(parts) != 2:
            return None
        payload_b64, sig_b64 = parts

        expected_sig = hmac.new(settings.SECRET_KEY.encode('utf-8'), payload_b64.encode('utf-8'), hashlib.sha256).digest()
        expected_sig_b64 = base64.urlsafe_b64encode(expected_sig).decode('utf-8').rstrip('=')

        if not hmac.compare_digest(sig_b64, expected_sig_b64):
            return None

        # Pad base64
        padded = payload_b64 + '=' * ((4 - len(payload_b64) % 4) % 4)
        payload_bytes = base64.urlsafe_b64decode(padded)
        payload = json.loads(payload_bytes.decode('utf-8'))

        if payload.get('exp', 0) < time.time():
            return None

        return payload
    except Exception:
        return None

def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db)
) -> User:
    """
    FastAPI dependency resolving the authenticated User.
    For local development, if no Authorization header is provided,
    it automatically resolves or provisions the default dev user (Vijay Vignesh).
    """
    default_user_id = "user-default-vijay"
    default_email = "vijay@exemple.com"

    if auth and auth.credentials:
        token_data = verify_dev_token(auth.credentials)
        if not token_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication credentials.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id = token_data.get("sub")
        email = token_data.get("email", default_email)
    else:
        # Development fallback
        user_id = default_user_id
        email = default_email

    # Fetch or provision user in DB
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(id=user_id, email=email)
        db.add(user)
        db.commit()
        db.refresh(user)

    return user
