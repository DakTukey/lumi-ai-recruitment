import json
import os
import re
from decimal import Decimal, ROUND_HALF_UP
from models.schemas import AssessRequest, AssessResult, CriterionResult, GapItem, InterviewQuestion
from services.prompt_builder import assessment_targets, build_assessment_prompt

MODEL_NAME = os.getenv('GEMINI_MODEL', 'gemini-3.8-flash')
PROMPT_VERSION = 'v4'



async def assess(req: AssessRequest) -> AssessResult:
    from services.grounded_generation import generate_grounded
    if len(build_assessment_prompt(req.job, req.resume)) > 120000:
        raise ValueError('CV/JD exceeds assessment input limit')
    if not assessment_targets(req.job):
        raise ValueError('JD has no assessment targets')
    schema = {'type': 'object', 'properties': {
        'summary': {'type': 'string'},
        'criteria': {'type': 'array', 'items': CriterionResult.model_json_schema()},
        'gaps': {'type': 'array', 'items': GapItem.model_json_schema()},
        'interview_questions': {'type': 'array', 'items': InterviewQuestion.model_json_schema()},
    }}
    schema['properties']['criteria']['items']['properties']['evidence']['enum'] = evidence_options(req.resume)
    schema['properties']['gaps']['items']['properties']['skill']['enum'] = [t['skill'] for t in assessment_targets(req.job)]
    return await generate_grounded(build_assessment_prompt(req.job, req.resume), schema,
                                   lambda data: normalize_result(req, data), max_tokens=16384,
                                   feature='cv_processing')


def normalize_result(req: AssessRequest, data: dict) -> AssessResult:
    targets = assessment_targets(req.job)
    expected = {t['criterion_key']: t for t in targets}
    raw_criteria = data.get('criteria', [])
    if len(expected) != len(targets) or len(raw_criteria) != len(targets):
        raise ValueError('Kết quả thiếu hoặc trùng tiêu chí của JD.')
    seen = set()
    criteria = []
    weighted = Decimal(0)
    total = Decimal(0)
    for raw in raw_criteria:
        c = CriterionResult.model_validate(raw)
        target = expected.get(c.criterion_key)
        if not target or c.criterion_key in seen or c.skill != target['skill']:
            raise ValueError('Kết quả chứa tiêu chí không thuộc JD hoặc trùng lặp.')
        if Decimal(str(c.weight)) != Decimal(str(target['weight'])):
            raise ValueError('AI đã thay đổi trọng số của JD.')
        if not c.reason.strip() or (c.match_level == 'NO_EVIDENCE' and c.points != 0):
            raise ValueError('Điểm không tương ứng bằng chứng.')
        if c.match_level != 'NO_EVIDENCE' and not c.evidence.strip():
            raise ValueError('Kết quả khớp thiếu trích dẫn CV.')
        if c.match_level == 'NO_EVIDENCE' and c.evidence.strip():
            raise ValueError('No-evidence criterion cannot contain evidence')
        if c.evidence and not any(c.evidence in text for text in resume_texts(req.resume)):
            raise ValueError('Evidence is not an exact CV quote')
        if c.criterion_key.startswith('skill:') and c.evidence and not mentions_skill(c.evidence, target['skill']):
            replacement = skill_evidence(req.resume, target['skill'])
            if replacement:
                c.evidence = replacement
            else:
                c.match_level = 'NO_EVIDENCE'
                c.evidence = ''
                c.points = 0
                c.reason = 'CV không có trích dẫn nêu rõ kỹ năng này; cần hỏi thêm ứng viên.'
        if c.criterion_key.startswith('skill:') and c.evidence in req.resume.skills:
            stronger = skill_evidence(req.resume, target['skill'])
            if stronger not in req.resume.skills:
                c.evidence = stronger
            else:
                c.match_level = 'PARTIAL'
                c.points = min(c.points, 40)
        seen.add(c.criterion_key)
        criteria.append(c)
        weight = Decimal(str(target['weight']))
        weighted += Decimal(c.points) * weight
        total += weight
    score = int((weighted / total).quantize(Decimal('1'), rounding=ROUND_HALF_UP)) if total else 0
    skill_keys = {f'skill:{s.id}': s.name for s in req.job.skills}
    matched = [skill_keys[c.criterion_key] for c in criteria
               if c.criterion_key in skill_keys and c.match_level == 'MATCHED']
    missing = [skill_keys[c.criterion_key] for c in criteria
               if c.criterion_key in skill_keys and c.match_level != 'MATCHED']
    gaps = [GapItem.model_validate(g) for g in data.get('gaps', [])]
    questions = [InterviewQuestion.model_validate(q) for q in data.get('interview_questions', [])]
    names = {t['skill'] for t in targets}
    if len(gaps) > 4 or len(questions) > 5 or any(g.skill not in names for g in gaps):
        raise ValueError('Unknown or unbounded gap suggestions')
    for gap in gaps: gap.target_level = gap.skill  # JD requirements are server-owned; do not accept an invented seniority/level.
    return AssessResult(application_id=req.application_id, model_name=MODEL_NAME,
        prompt_version=PROMPT_VERSION, score=score, summary=data.get('summary', ''),
        matched_skills=matched, missing_skills=missing, criteria=criteria,
        gaps=gaps, interview_questions=questions)


def resume_texts(resume):
    def leaves(value):
        if isinstance(value, str): yield value
        elif isinstance(value, dict):
            for child in value.values(): yield from leaves(child)
        elif isinstance(value, list):
            for child in value: yield from leaves(child)
    return list(leaves(resume.model_dump(exclude={'full_name', 'linkedin_url'})))


def skill_evidence(resume, skill: str) -> str:
    """Anchor a skill score to an actual experience/project quote when possible."""
    def strings(value):
        if isinstance(value, str):
            yield value
        elif isinstance(value, dict):
            for child in value.values():
                yield from strings(child)
        elif isinstance(value, list):
            for child in value:
                yield from strings(child)
    for section in (resume.experiences, resume.projects, resume.certifications, resume.educations):
        for item in section:
            for text in strings(item):
                if mentions_skill(text, skill) and len(text) <= 1200:
                    return text
    for text in resume_texts(resume):
        if mentions_skill(text, skill) and len(text) <= 1200:
            return text
    return ''


def mentions_skill(text: str, skill: str) -> bool:
    return bool(re.search(r'(?<!\w)' + re.escape(skill) + r'(?!\w)', text, flags=re.IGNORECASE))


def evidence_options(resume):
    # Constrain JSON output to actual CV text; a model cannot concatenate school/degree/field into a fake quote.
    options = ['']
    for text in resume_texts(resume):
        if not text.strip(): continue
        if len(text) <= 1200: options.append(text)
        for line in text.splitlines():
            if not line.strip(): continue
            options.extend(line[i:i+1200] for i in range(0, len(line), 1200))
    return list(dict.fromkeys(options))


def _parse_json(raw: str) -> dict:
    match = re.fullmatch(r'```(?:json)?\s*(\{.*\})\s*```', raw, re.DOTALL)
    if match:
        raw = match.group(1)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise ValueError('AI trả về JSON không hợp lệ.') from None
    if not isinstance(data, dict):
        raise ValueError('AI phải trả về một JSON object.')
    return data
