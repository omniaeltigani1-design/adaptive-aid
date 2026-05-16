import os
import json
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv
from app.services.retrieval_service import get_relevant_material_context

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise ValueError("OPENAI_API_KEY not found in .env file")

client = OpenAI(
    api_key=api_key,
    base_url="https://api.deepseek.com"
)

def read_text_from_txt_file(txt_file_path: str) -> str:
    path = Path(txt_file_path)

    if not path.exists():
        raise FileNotFoundError(f"Text file not found: {txt_file_path}")

    text = path.read_text(encoding="utf-8", errors="ignore").strip()

    if not text:
        raise ValueError("Extracted text file is empty")

    return text


def generate_mcq_bank_from_material(
    material_text: str,
    difficulty_level: int,
    count: int = 5,
    excluded_questions: list[str] | None = None
) -> dict:

    if not material_text or not material_text.strip():
        raise ValueError("material_text is empty")

    if difficulty_level not in [1, 2, 3]:
        raise ValueError("difficulty_level must be 1, 2, or 3")

    excluded_questions = excluded_questions or []

    excluded_text = "\n".join([f"- {q}" for q in excluded_questions[:50]])

    # ----------------------------
    # LlamaIndex retrieval
    # ----------------------------
    relevant_context = get_relevant_material_context(
        material_text=material_text,
        topic=f"Generate difficulty level {difficulty_level} multiple choice questions from the most important concepts",
        top_k=4
    )

    # fallback if retrieval fails
    if not relevant_context or not relevant_context.strip():
        relevant_context = material_text[:4000]

    prompt = f"""
You are generating quiz questions for a learning system.

Return json only.
Do not use markdown.
Do not add any explanation outside the json.

Generate exactly {count} multiple-choice questions based only on the material below.

Rules:
- every question must have difficulty_level = {difficulty_level}
- each question must have exactly 4 options
- exactly 1 option must have "is_correct": true
- the other 3 options must have "is_correct": false
- questions must be clear and not vague
- options must not be duplicates
- do not invent facts outside the material
- do not repeat or closely paraphrase any previously generated question
- each question must include "topic"
- each question must include "subtopic"
- topic should be the broad subject area from the material
- subtopic should be the specific concept being tested
- do not generate questions that test the same fact, same concept, or same answer as the previously generated questions
- a question is repeated even if the wording is different but the correct answer is the same concept
- each new question must test a different subtopic or a different reasoning angle

Difficulty meaning:

difficulty_level 1 = EASY:
- Ask for a simple definition, fact, name, purpose, or direct recall.
- The answer should be found clearly in one sentence from the material.
- Do not require comparison, analysis, or reasoning.

difficulty_level 2 = MEDIUM:
- Ask the student to understand or apply a concept.
- Use wording such as "why", "how", "what is the effect of", or "which situation best represents".
- The answer should require connecting 2 related facts from the material.
- Do not ask only for a definition.

difficulty_level 3 = HARD:
- Ask the student to analyze, infer, compare, or choose the best answer in a scenario.
- Use clinical/practical/scenario-based wording when possible.
- The answer should require deeper reasoning from the material.
- Do not ask simple recall questions.

Previously generated questions to avoid:
{excluded_text if excluded_text else "None"}

Return this exact json shape:

{{
  "questions": [
    {{
      "question_text": "string",
      "difficulty_level": {difficulty_level},
      "topic": "main topic from the material",
      "subtopic": "specific subtopic tested by this question",
      "options": [
        {{"option_text": "string", "is_correct": false}},
        {{"option_text": "string", "is_correct": true}},
        {{"option_text": "string", "is_correct": false}},
        {{"option_text": "string", "is_correct": false}}
      ]
    }}
  ]
}}

Material:
\"\"\"{relevant_context[:4000]}\"\"\"
"""

    response = client.chat.completions.create(
        model="deepseek-chat",
        response_format={"type": "json_object"},
        temperature=0.7,
        max_tokens=3000,
        messages=[
            {"role": "system", "content": "You output valid json only."},
            {"role": "user", "content": prompt}
        ]
    )

    content = response.choices[0].message.content

    try:
        data = json.loads(content)

        existing_lower = [q.lower().strip() for q in excluded_questions]

        filtered_questions = []

        for q in data.get("questions", []):
            question_text = q.get("question_text", "").lower().strip()

            is_duplicate = False

            for old_q in existing_lower:
                if question_text == old_q:
                    is_duplicate = True
                    break

                if question_text in old_q or old_q in question_text:
                    is_duplicate = True
                    break

            if not is_duplicate:
                filtered_questions.append(q)

        data["questions"] = filtered_questions

        return data

    except json.JSONDecodeError:
        raise ValueError("AI returned invalid JSON")

def generate_mcq_bank_from_txt(
    txt_file_path: str,
    difficulty_level: int,
    count: int = 5,
    excluded_questions: list[str] | None = None
) -> dict:
    material_text = read_text_from_txt_file(txt_file_path)
    return generate_mcq_bank_from_material(
        material_text=material_text,
        difficulty_level=difficulty_level,
        count=count,
        excluded_questions=excluded_questions
    )