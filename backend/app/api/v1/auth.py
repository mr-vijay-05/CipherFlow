from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.auth import DevLoginRequest, TokenResponse, UserResponse
from app.security.auth import create_dev_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/dev-token", response_model=TokenResponse)
def get_development_token(payload: DevLoginRequest, db: Session = Depends(get_db)):
    """
    Returns development bearer token.
    NOTE: Production authentication belongs to future phases.
    """
    user_id = f"user-{payload.email.split('@')[0]}"
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(id=user_id, email=payload.email)
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_dev_access_token(user.id, user.email)
    return TokenResponse(
        accessToken=token,
        tokenType="bearer",
        userId=user.id,
        email=user.email,
    )

@router.get("/me", response_model=UserResponse)
def get_current_user_profile(user: User = Depends(get_current_user)):
    return UserResponse(
        id=user.id,
        email=user.email,
        createdAt=user.created_at.isoformat(),
    )

