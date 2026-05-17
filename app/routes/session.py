from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from datetime import datetime, timezone
from pathlib import Path

from app.db import get_session
from app.models import (
    Student,
    Course,
    CourseMaterial,
    Quiz,
    QuizMaterial,
    Question,
    QuestionOptions,
    Report,
    Response,
)
from app.schemas import StartQuizRequest, SubmitAnswerRequest
from app.services.ai_service import generate_mcq_bank_from_txt

router = APIRouter(prefix="/session", tags=["Session"])

TEXT_DIR = Path("uploads/extracted_text")


def get_txt_file_path_from_material(material: CourseMaterial) -> Path:
    original_path = Path(material.file_path)
    return TEXT_DIR / f"{original_path.stem}.txt"


def get_next_difficulty(current_difficulty: int, is_correct: bool, is_skipped: bool) -> int:
    if is_skipped:
        return current_difficulty
    if is_correct:
        return min(current_difficulty + 1, 3)
    return max(current_difficulty - 1, 1)


def get_answered_question_ids(quiz_id: int, session: Session) -> set[int]:
    answered_question_ids = session.exec(
        select(Response.question_id)
        .join(Question, Response.question_id == Question.id)
        .where(Question.quiz_id == quiz_id)
    ).all()
    return set(answered_question_ids)


def get_unused_question_by_difficulty(quiz_id: int, difficulty_level: int, session: Session):
    answered_ids = get_answered_question_ids(quiz_id, session)

    questions = session.exec(
        select(Question)
        .where(
            Question.quiz_id == quiz_id,
            Question.difficulty_level == difficulty_level
        )
        .order_by(Question.question_no)
    ).all()

    for q in questions:
        if q.id not in answered_ids:
            return q

    return None


def get_options_for_question(question_id: int, session: Session):
    return session.exec(
        select(QuestionOptions).where(QuestionOptions.question_id == question_id)
    ).all()


def build_question_response(question: Question, session: Session):
    options = get_options_for_question(question.id, session)

    return {
        "question_id": question.id,
        "question_no": question.question_no,
        "difficulty_level": question.difficulty_level,
        "question_text": question.question_text,
        "options": [
            {
                "option_id": o.id,
                "option_text": o.option_text
            }
            for o in options
        ]
    }


def get_quiz_material(quiz_id: int, session: Session):
    quiz_material = session.exec(
        select(QuizMaterial).where(QuizMaterial.quiz_id == quiz_id)
    ).first()

    if not quiz_material:
        raise HTTPException(status_code=404, detail="Quiz material link not found")

    material = session.get(CourseMaterial, quiz_material.course_material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Course material not found")

    return material


def get_next_question_no(quiz_id: int, session: Session) -> int:
    last_question = session.exec(
        select(Question)
        .where(Question.quiz_id == quiz_id)
        .order_by(Question.question_no.desc())
    ).first()

    if not last_question:
        return 1

    return last_question.question_no + 1


def get_existing_question_texts(quiz_id: int, difficulty_level: int, session: Session) -> list[str]:
    questions = session.exec(
        select(Question.question_text).where(
            Question.quiz_id == quiz_id,
            Question.difficulty_level == difficulty_level
        )
    ).all()
    return list(questions)


def save_generated_questions(
    quiz_id: int,
    generated_questions: list,
    difficulty_level: int,
    session: Session
):
    created_questions = []
    next_question_no = get_next_question_no(quiz_id, session)

    for q_data in generated_questions:
        if "question_text" not in q_data or "options" not in q_data:
            continue

        valid_options = []
        for opt in q_data["options"]:
            if "option_text" in opt and "is_correct" in opt:
                valid_options.append(opt)

        if len(valid_options) != 4:
            continue

        question = Question(
            question_no=next_question_no,
            difficulty_level=difficulty_level,
            question_text=q_data["question_text"],
            quiz_id=quiz_id
        )
        session.add(question)
        session.commit()
        session.refresh(question)

        for opt in valid_options:
            option = QuestionOptions(
                question_id=question.id,
                option_text=opt["option_text"],
                is_correct=opt["is_correct"]
            )
            session.add(option)

        session.commit()
        created_questions.append(question)
        next_question_no += 1

    return created_questions


def generate_and_save_question_bank_for_difficulty(
    quiz_id: int,
    txt_file_path: str,
    difficulty_level: int,
    count: int,
    session: Session
):
    existing_question_texts = get_existing_question_texts(
        quiz_id=quiz_id,
        difficulty_level=difficulty_level,
        session=session
    )

    mcq_data = generate_mcq_bank_from_txt(
        txt_file_path=txt_file_path,
        difficulty_level=difficulty_level,
        count=count,
        excluded_questions=existing_question_texts
    )

    questions = mcq_data.get("questions", [])
    if not questions:
        raise ValueError(f"No questions generated for difficulty {difficulty_level}")

    filtered_questions = []
    existing_lower = {q.strip().lower() for q in existing_question_texts}

    for q in questions:
        question_text = q.get("question_text", "").strip()
        if not question_text:
            continue
        if question_text.lower() in existing_lower:
            continue
        filtered_questions.append(q)
        existing_lower.add(question_text.lower())

    if not filtered_questions:
        raise ValueError(f"Only duplicate questions were generated for difficulty {difficulty_level}")

    created_questions = save_generated_questions(
        quiz_id=quiz_id,
        generated_questions=filtered_questions,
        difficulty_level=difficulty_level,
        session=session
    )

    if not created_questions:
        raise ValueError(f"No valid questions were saved for difficulty {difficulty_level}")

    return created_questions


@router.post("/quiz/start")
def start_quiz(data: StartQuizRequest, session: Session = Depends(get_session)):
    student = session.get(Student, data.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    course = session.get(Course, data.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    material = session.get(CourseMaterial, data.course_material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Course material not found")

    txt_file_path = get_txt_file_path_from_material(material)
    if not txt_file_path.exists():
        raise HTTPException(status_code=404, detail="Extracted text file not found")

    quiz = Quiz(
        student_id=data.student_id,
        course_id=data.course_id,
        start_time=datetime.now(timezone.utc),
        end_time=None
    )
    session.add(quiz)
    session.commit()
    session.refresh(quiz)

    quiz_material = QuizMaterial(
        quiz_id=quiz.id,
        course_material_id=data.course_material_id
    )
    session.add(quiz_material)
    session.commit()

    try:
        generate_and_save_question_bank_for_difficulty(
            quiz_id=quiz.id,
            txt_file_path=str(txt_file_path),
            difficulty_level=1,
            count=5,
            session=session
        )
        generate_and_save_question_bank_for_difficulty(
            quiz_id=quiz.id,
            txt_file_path=str(txt_file_path),
            difficulty_level=2,
            count=5,
            session=session
        )
        generate_and_save_question_bank_for_difficulty(
            quiz_id=quiz.id,
            txt_file_path=str(txt_file_path),
            difficulty_level=3,
            count=5,
            session=session
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Question bank generation failed: {str(e)}")

    first_question = get_unused_question_by_difficulty(
        quiz_id=quiz.id,
        difficulty_level=2,
        session=session
    )

    if not first_question:
        raise HTTPException(status_code=400, detail="No starting question available")

    return {
        "message": "Quiz started successfully",
        "quiz_id": quiz.id,
        "question": build_question_response(first_question, session)
    }


@router.post("/quiz/{quiz_id}/answer")
def submit_answer(quiz_id: int, data: SubmitAnswerRequest, session: Session = Depends(get_session)):
    quiz = session.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.end_time is not None:
        raise HTTPException(status_code=400, detail="Quiz has already ended")

    question = session.get(Question, data.question_id)
    if not question or question.quiz_id != quiz_id:
        raise HTTPException(status_code=404, detail="Question not found for this quiz")

    existing_response = session.exec(
        select(Response).where(Response.question_id == question.id)
    ).first()

    if existing_response:
        raise HTTPException(status_code=400, detail="This question has already been answered")

    if data.is_skipped:
        is_correct = False
    else:
        if data.selected_option_id is None:
            raise HTTPException(status_code=400, detail="selected_option_id is required when not skipping")

        option = session.get(QuestionOptions, data.selected_option_id)
        if not option or option.question_id != question.id:
            raise HTTPException(status_code=404, detail="Selected option not found for this question")

        is_correct = bool(option.is_correct)

    response = Response(
        question_id=question.id,
        selected_option=data.selected_option_id,
        is_correct=is_correct,
        is_skipped=data.is_skipped
    )
    session.add(response)
    session.commit()
    session.refresh(response)

    next_difficulty = get_next_difficulty(
        current_difficulty=question.difficulty_level,
        is_correct=is_correct,
        is_skipped=data.is_skipped
    )

    next_question = get_unused_question_by_difficulty(
        quiz_id=quiz_id,
        difficulty_level=next_difficulty,
        session=session
    )

    replenished = False

    if not next_question:
        material = get_quiz_material(quiz_id, session)
        txt_file_path = get_txt_file_path_from_material(material)

        if not txt_file_path.exists():
            raise HTTPException(status_code=404, detail="Extracted text file not found")

        try:
            generate_and_save_question_bank_for_difficulty(
                quiz_id=quiz_id,
                txt_file_path=str(txt_file_path),
                difficulty_level=next_difficulty,
                count=5,
                session=session
            )
            replenished = True
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Replenishment failed for difficulty {next_difficulty}: {str(e)}"
            )

        next_question = get_unused_question_by_difficulty(
            quiz_id=quiz_id,
            difficulty_level=next_difficulty,
            session=session
        )

        if not next_question:
            raise HTTPException(
                status_code=400,
                detail=f"Replenishment ran for difficulty {next_difficulty}, but no unused question was found afterward"
            )

    return {
        "message": "Answer submitted successfully",
        "response_id": response.id,
        "is_correct": is_correct,
        "debug_target_difficulty": next_difficulty,
        "replenished_target_bank": replenished,
        "next_question": build_question_response(next_question, session)
    }


@router.post("/quiz/{quiz_id}/end")
def end_quiz(quiz_id: int, session: Session = Depends(get_session)):
    quiz = session.get(Quiz, quiz_id)

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.end_time is None:
        quiz.end_time = datetime.now(timezone.utc)
        session.add(quiz)
        session.commit()
        session.refresh(quiz)

    responses = session.exec(
        select(Response)
        .join(Question, Response.question_id == Question.id)
        .where(Question.quiz_id == quiz_id)
    ).all()

    total_answered = len(responses)
    total_correct = sum(1 for r in responses if r.is_correct is True)
    total_skipped = sum(1 for r in responses if r.is_skipped is True)
    total_wrong = sum(
        1 for r in responses
        if r.is_correct is False and r.is_skipped is not True
    )

    score_percent = (total_correct / total_answered * 100) if total_answered > 0 else 0

    duration_seconds = 0
    if quiz.start_time and quiz.end_time:
        duration_seconds = int((quiz.end_time - quiz.start_time).total_seconds())

    duration_minutes = duration_seconds // 60
    duration_remaining_seconds = duration_seconds % 60
    duration_text = f"{duration_minutes}m {duration_remaining_seconds}s"

    difficulty_map = {
        1: "easy",
        2: "medium",
        3: "hard"
    }

    difficulty_breakdown = {
        "easy": {"correct": 0, "wrong": 0, "skipped": 0},
        "medium": {"correct": 0, "wrong": 0, "skipped": 0},
        "hard": {"correct": 0, "wrong": 0, "skipped": 0}
    }

    subtopic_stats = {}

    for response in responses:
        question = session.get(Question, response.question_id)

        if not question:
            continue

        difficulty_name = difficulty_map.get(question.difficulty_level, "medium")
        subtopic = question.subtopic or question.topic or "General"

        if subtopic not in subtopic_stats:
            subtopic_stats[subtopic] = {
                "attempted": 0,
                "correct": 0,
                "wrong": 0,
                "skipped": 0,
                "accuracy_percent": 0
            }

        # Count skipped separately, but still include it in overall exposure
        if response.is_skipped is True:
            difficulty_breakdown[difficulty_name]["skipped"] += 1
            subtopic_stats[subtopic]["skipped"] += 1

        elif response.is_correct is True:
            difficulty_breakdown[difficulty_name]["correct"] += 1
            subtopic_stats[subtopic]["attempted"] += 1
            subtopic_stats[subtopic]["correct"] += 1

        else:
            difficulty_breakdown[difficulty_name]["wrong"] += 1
            subtopic_stats[subtopic]["attempted"] += 1
            subtopic_stats[subtopic]["wrong"] += 1

    strengths = []
    weaknesses = []

    for subtopic, stats in subtopic_stats.items():
        attempted = stats["attempted"]
        correct = stats["correct"]
        wrong = stats["wrong"]
        skipped = stats["skipped"]

        if attempted > 0:
            accuracy = correct / attempted
            stats["accuracy_percent"] = round(accuracy * 100, 1)

            if accuracy >= 0.7 and correct >= 1:
                strengths.append(subtopic)

            elif accuracy <= 0.4 and wrong > 0:
                weaknesses.append(subtopic)

        # Only mark skipped-only subtopics as weakness if the user skipped it more than once
        if attempted == 0 and skipped >= 2:
            weaknesses.append(subtopic)

    strengths = list(dict.fromkeys(strengths))
    weaknesses = list(dict.fromkeys(weaknesses))

    report_summary = {
        "quiz_id": quiz.id,
        "overall_performance": {
            "score_text": f"{total_correct}/{total_answered}" if total_answered > 0 else "No questions attempted",
            "score_percent": round(score_percent, 1),
            "session_duration_seconds": duration_seconds,
            "session_duration_text": duration_text
        },
        "totals": {
            "total_answered": total_answered,
            "total_correct": total_correct,
            "total_wrong": total_wrong,
            "total_skipped": total_skipped
        },
        "difficulty_breakdown": difficulty_breakdown,
        "subtopic_breakdown": subtopic_stats,
        "strengths": strengths if strengths else ["No clear strength identified"],
        "weaknesses": weaknesses if weaknesses else ["No clear weakness identified"]
    }

    existing_report = session.exec(
        select(Report).where(Report.quiz_id == quiz_id)
    ).first()

    if existing_report:
        existing_report.summary_json = report_summary
        session.add(existing_report)
        session.commit()
        session.refresh(existing_report)
        report = existing_report
    else:
        report = Report(
            quiz_id=quiz.id,
            summary_json=report_summary
        )
        session.add(report)
        session.commit()
        session.refresh(report)

    return {
        "message": "Quiz ended successfully",
        "quiz_id": quiz.id,
        "report_id": report.id,
        "summary": report.summary_json
    }

@router.get("/reports/{quiz_id}")
def get_report(quiz_id: int, session: Session = Depends(get_session)):
    report = session.exec(
        select(Report).where(Report.quiz_id == quiz_id)
    ).first()

    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    return {
        "report_id": report.id,
        "quiz_id": report.quiz_id,
        "created_at": report.created_at,
        "summary": report.summary_json
    }