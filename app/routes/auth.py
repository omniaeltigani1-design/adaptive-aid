import os
import uuid
import re
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select

from app.db import get_session
from app.models import Student
from app.schemas import RegisterRequest, LoginRequest
from app.utils.security import hash_password, verify_password

load_dotenv()

router = APIRouter(prefix="/auth", tags=["Authentication"])

MAIL_USERNAME = os.getenv("MAIL_USERNAME")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
MAIL_FROM = os.getenv("MAIL_FROM")
MAIL_SERVER = os.getenv("MAIL_SERVER")
MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://127.0.0.1:5500")
BACKEND_URL = os.getenv("BACKEND_URL", "http://https://adaptive-aid-production.up.railway.app")

conf = ConnectionConfig(
    MAIL_USERNAME=MAIL_USERNAME,
    MAIL_PASSWORD=MAIL_PASSWORD,
    MAIL_FROM=MAIL_FROM,
    MAIL_PORT=MAIL_PORT,
    MAIL_SERVER=MAIL_SERVER,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)


async def send_email(to_email: str, subject: str, body: str):
    if not all([MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM, MAIL_SERVER]):
        raise RuntimeError("Email settings are missing in .env")

    message = MessageSchema(
        subject=subject,
        recipients=[to_email],
        body=body,
        subtype="html"
    )

    fm = FastMail(conf)
    await fm.send_message(message)


def validate_password_policy(password: str, name: str, email: str) -> str | None:
    common_passwords = ["password", "password123", "12345678", "qwerty123", "admin123"]
    
    if password.lower() in common_passwords:
        return "Password is too common"
    
    if len(password) < 8:
        return "Password must be at least 8 characters long"

    if len(password) > 64:
        return "Password must not be longer than 64 characters"
    
    email_username = email.split("@")[0].lower()
    if email_username and email_username in password.lower():
        return "Password cannot contain your email name"
    
    if name and name.lower() in password.lower():
        return "Password cannot contain your name"


    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter"

    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter"

    if not re.search(r"\d", password):
        return "Password must contain at least one number"
    
    return None

@router.post("/register")
async def register(data: RegisterRequest, session: Session = Depends(get_session)):
    password_error = validate_password_policy(
        password=data.password,
        name=data.name,
        email=data.email
    )

    if password_error:
        raise HTTPException(status_code=400, detail=password_error)

    existing_student = session.exec(
        select(Student).where(Student.email == data.email)
    ).first()

    if existing_student:
        if existing_student.is_email_verified:
            raise HTTPException(status_code=400, detail="Email already exists. Please log in instead.")

        verification_token = str(uuid.uuid4())
        existing_student.verification_token = verification_token

        session.add(existing_student)
        session.commit()
        session.refresh(existing_student)

        verification_link = f"{BACKEND_URL}/auth/verify-email?token={verification_token}"

        email_body = f"""
        <h2>Verify your Adaptive Aid account</h2>
        <p>Hello {existing_student.name},</p>
        <p>This email is already registered but has not been verified yet.</p>
        <p>Please click the link below to verify your email address:</p>
        <p>
        <a href="{verification_link}">
            Verify Email
        </a>
        </p>
        """

        try:
            await send_email(
                to_email=existing_student.email,
                subject="Verify your Adaptive Aid account",
                body=email_body
            )

            return {
                "message": "This email is already registered but not verified. A new verification email has been sent.",
                "student_id": existing_student.id,
                "name": existing_student.name,
                "email": existing_student.email,
                "account_exists": True,
                "is_email_verified": False
            }

        except Exception as e:
            return {
                "message": "This email is already registered but not verified. Verification email could not be sent.",
                "student_id": existing_student.id,
                "name": existing_student.name,
                "email": existing_student.email,
                "verification_link": verification_link,
                "email_error": str(e),
                "account_exists": True,
                "is_email_verified": False
            }

    verification_token = str(uuid.uuid4())
    hashed_password = hash_password(data.password)

    student = Student(
        name=data.name,
        email=data.email,
        hash_pwd=hashed_password,
        is_email_verified=False,
        verification_token=verification_token
    )

    session.add(student)
    session.commit()
    session.refresh(student)

    verification_link = f"{BACKEND_URL}/auth/verify-email?token={verification_token}"

    email_body = f"""
    <h2>Verify your Adaptive Aid account</h2>
    <p>Hello {student.name},</p>
    <p>Please click the link below to verify your email address:</p>
    <p>
      <a href="{verification_link}">
        Verify Email
      </a>
    </p>
    <p>If you did not create this account, you can ignore this email.</p>
    """

    try:
        await send_email(
            to_email=student.email,
            subject="Verify your Adaptive Aid account",
            body=email_body
        )

        return {
            "message": "Student registered successfully. Please check your email to verify your account.",
            "student_id": student.id,
            "name": student.name,
            "email": student.email
        }

    except Exception as e:
        return {
            "message": "Student registered successfully, but verification email could not be sent.",
            "student_id": student.id,
            "name": student.name,
            "email": student.email,
            "verification_link": verification_link,
            "email_error": str(e)
        }


@router.post("/login")
async def login(data: LoginRequest, session: Session = Depends(get_session)):
    student = session.exec(
        select(Student).where(Student.email == data.email)
    ).first()

    if not student:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(data.password, student.hash_pwd):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not student.is_email_verified:
        # generate new token
        new_token = str(uuid.uuid4())
        student.verification_token = new_token

        session.add(student)
        session.commit()
        session.refresh(student)

        verification_link = f"{BACKEND_URL}/auth/verify-email?token={new_token}"

        email_body = f"""
        <h2>Verify your Adaptive Aid account</h2>
        <p>Hello {student.name},</p>
        <p>You tried logging in, but your account is not verified yet.</p>
        <p>Please click below to verify your email:</p>
        <p><a href="{verification_link}">Verify Email</a></p>
        """

        try:
            await send_email(
                to_email=student.email,
                subject="Verify your Adaptive Aid account",
                body=email_body
            )

            raise HTTPException(
                status_code=403,
                detail="Your account is not verified. A new verification email has been sent."
            )

        except Exception:
            raise HTTPException(
                status_code=403,
                detail="Your account is not verified. We could not send the email, but you can use the verification link manually.",
            )   

    return {
        "message": "Login successful",
        "student_id": student.id,
        "name": student.name,
        "email": student.email
    }


@router.get("/verify-email")
def verify_email(token: str, session: Session = Depends(get_session)):
    student = session.exec(
        select(Student).where(Student.verification_token == token)
    ).first()

    if not student:
        return RedirectResponse(
            url=f"{FRONTEND_URL}/register.html?verification=invalid"
        )

    student.is_email_verified = True
    student.verification_token = None

    session.add(student)
    session.commit()
    session.refresh(student)

    return RedirectResponse(
        url=f"{FRONTEND_URL}/login.html?verified=success"
    )
@router.post("/forgot-password")
async def forgot_password(email: str, session: Session = Depends(get_session)):
    student = session.exec(
        select(Student).where(Student.email == email)
    ).first()

    safe_message = "If an account exists with this email, a password reset link has been sent."

    if not student:
        return {"message": safe_message}

    token = str(uuid.uuid4())

    student.reset_token = token
    student.reset_token_expires = datetime.utcnow() + timedelta(minutes=15)
    
    session.add(student)
    session.commit()
    session.refresh(student)

    reset_link = f"{FRONTEND_URL}/reset_password.html?token={token}"

    try:
        await send_email(
            to_email=student.email,
            subject="Reset your Adaptive Aid password",
            body=f"""
            <h2>Password Reset</h2>
            <p>Hello {student.name},</p>
            <p>Click the link below to reset your password:</p>
            <p>
              <a href="{reset_link}">
                Reset Password
              </a>
            </p>
            <p>This link expires in 15 minutes.</p>
            """
        )

        return {"message": safe_message}

    except Exception as e:
        return {
            "message": "Password reset email could not be sent.",
            "reset_link": reset_link,
            "email_error": str(e)
        }
        
@router.post("/reset-password")
def reset_password(data: dict, session: Session = Depends(get_session)):
    token = data.get("token")
    new_password = data.get("new_password")

    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Missing token or password.")

    student = session.exec(
        select(Student).where(Student.reset_token == token)
    ).first()

    if not student:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")

    expires_at = student.reset_token_expires

    if expires_at.tzinfo is not None:
        expires_at = expires_at.replace(tzinfo=None)

    if expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This reset link has expired.")

    password_error = validate_password_policy(
        password=new_password,
        name=student.name,
        email=student.email
    )

    if password_error:
        raise HTTPException(status_code=400, detail=password_error)

    if verify_password(new_password, student.hash_pwd):
        raise HTTPException(
            status_code=400,
            detail="New password cannot be the same as your old password."
        )

    student.hash_pwd = hash_password(new_password)
    student.reset_token = None
    student.reset_token_expires = None

    session.add(student)
    session.commit()

    return {"message": "Password reset successful"}