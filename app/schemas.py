from pydantic import BaseModel

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class CreateCourseRequest(BaseModel):
    student_id: int
    course_name: str


class StartQuizRequest(BaseModel):
    student_id: int
    course_id: int
    course_material_id: int


class SubmitAnswerRequest(BaseModel):
    question_id: int
    selected_option_id: int | None = None
    is_skipped: bool = False


class CreateMaterialRequest(BaseModel):
    course_id: int

class RenameCourseRequest(BaseModel):
    course_name: str

class RenameMaterialRequest(BaseModel):
    material_id: int
    new_name: str
