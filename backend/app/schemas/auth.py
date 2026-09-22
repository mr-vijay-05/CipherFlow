from pydantic import BaseModel, EmailStr

class DevLoginRequest(BaseModel):
    email: EmailStr = "vijay@exemple.com"
    deviceName: str = "Windows Workstation (WebCrypto Enclave)"

class TokenResponse(BaseModel):
    accessToken: str
    tokenType: str = "bearer"
    userId: str
    email: str

class UserResponse(BaseModel):
    id: str
    email: str
    createdAt: str
