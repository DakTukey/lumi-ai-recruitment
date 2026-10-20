"""Lấy dữ liệu GitHub qua REST API công khai. Không clone, không lưu file."""
import asyncio
import base64
import logging
import os
import re
from urllib.parse import urlparse
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_TUTORIAL_PATTERNS = re.compile(
    r'(?i)(tutorial|course|f8|bootcamp|clone|starter|template|todo-|todomvc|'
    r'mern-|spring-boot-demo|node-express-demo|react-tutorial|practice-|'
    r'learn-|crash-course|from-scratch|udemy|viet-thanh|techmaster)'
)


@dataclass
class RepoSummary:
    name: str
    description: str
    stars: int
    language: str | None
    is_fork: bool
    commit_count: int
    first_commit_at: datetime | None
    last_commit_at: datetime | None
    has_tests: bool
    has_docker: bool
    has_ci: bool
    languages: dict[str, int] = field(default_factory=dict)  # {lang: bytes}
    readme_excerpt: str = ''
    core_file_path: str = ''
    core_file_content: str = ''
    vibe_flags: list[str] = field(default_factory=list)
    is_tutorial_clone: bool = False


@dataclass
class GitHubSummary:
    username: str
    public_repos: int
    account_age_days: int
    total_stars: int
    repos: list[RepoSummary] = field(default_factory=list)


def _extract_username(github_url: str) -> str:
    """Trích username từ URL GitHub."""
    url = github_url.strip().rstrip('/')
    # Hỗ trợ: https://github.com/username, github.com/username, username
    if re.fullmatch(r'[A-Za-z0-9-]{1,39}', url):
        username = url
    else:
        parsed = urlparse('https://' + url if url.startswith('github.com/') else url)
        if parsed.scheme != 'https' or parsed.hostname != 'github.com' or parsed.username or parsed.password or parsed.port:
            raise ValueError('Liên kết phải thuộc https://github.com/username')
        username = parsed.path.strip('/').split('/')[0]
    # Bỏ path nếu có (vd: /username/repo → username)
    username = username.split('/')[0]
    if not re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?', username):
        raise ValueError(f'Username không hợp lệ: {username}')
    return username


def _github_headers() -> dict[str, str]:
    token = os.getenv('GITHUB_TOKEN', '')
    headers = {'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    return headers


async def _get(client: httpx.AsyncClient, path: str) -> Any:
    resp = await client.get(f'https://api.github.com{path}', headers=_github_headers(), timeout=10)
    if resp.status_code == 404:
        return None
    if resp.status_code == 403:
        raise PermissionError('GitHub API rate limit hoặc access bị từ chối.')
    resp.raise_for_status()
    return resp.json()


async def _detect_code_signals(client: httpx.AsyncClient, owner: str, repo: str) -> tuple[bool, bool, bool, str, str, str]:
    """Trả về (has_tests, has_docker, has_ci, readme_excerpt, core_file_path, core_file_content)."""
    has_tests = has_docker = has_ci = False
    readme_excerpt = core_file_path = core_file_content = ''

    # Lấy file tree root
    tree_data = await _get(client, f'/repos/{owner}/{repo}/contents/')
    if not isinstance(tree_data, list):
        return has_tests, has_docker, has_ci, readme_excerpt, core_file_path, core_file_content

    root_names = {f['name'].lower(): f for f in tree_data if isinstance(f, dict)}

    has_docker = 'dockerfile' in root_names or 'docker-compose.yml' in root_names
    has_tests = 'test' in root_names or 'tests' in root_names or '__tests__' in root_names
    has_ci = '.github' in root_names  # .github/workflows/

    # Đọc README (base64 decode, chỉ lấy 400 ký tự đầu)
    readme_key = next((k for k in root_names if k.startswith('readme')), None)
    if readme_key:
        readme_data = await _get(client, f'/repos/{owner}/{repo}/contents/{root_names[readme_key]["name"]}')
        if readme_data and readme_data.get('encoding') == 'base64':
            try:
                readme_excerpt = base64.b64decode(readme_data['content']).decode('utf-8', errors='replace')[:400]
            except Exception:
                pass

    # Tìm 1 file business logic để spot-check (Service / Hook / Controller)
    core_file_path, core_file_content = await _find_core_file(client, owner, repo, tree_data)

    return has_tests, has_docker, has_ci, readme_excerpt, core_file_path, core_file_content


async def _find_core_file(client: httpx.AsyncClient, owner: str, repo: str, root_tree: list) -> tuple[str, str]:
    """Tìm 1 file logic nghiệp vụ đại diện, tối đa 200 dòng."""
    # Ưu tiên src/ hoặc app/
    src_folder = None
    for folder_name in ('src', 'app', 'lib', 'backend', 'frontend', 'server'):
        entry = next((f for f in root_tree if isinstance(f, dict) and
                      f.get('name', '').lower() == folder_name and f.get('type') == 'dir'), None)
        if entry:
            src_folder = entry['name']
            break

    search_paths = []
    if src_folder:
        search_paths.append(f'/repos/{owner}/{repo}/contents/{src_folder}')
    search_paths.append(f'/repos/{owner}/{repo}/contents/')

    for search_path in search_paths:
        tree = await _get(client, search_path)
        if not isinstance(tree, list):
            continue
        # Tìm file Service / Hook / Controller (không phải test)
        for f in tree:
            if not isinstance(f, dict) or f.get('type') != 'file':
                continue
            name = f.get('name', '')
            if 'test' in name.lower() or 'spec' in name.lower():
                continue
            if (name.endswith('Service.java') or name.endswith('Service.kt') or
                    name.endswith('Service.py') or name.endswith('service.ts') or
                    name.endswith('service.js') or
                    (name.startswith('use') and name.endswith('.tsx')) or
                    (name.startswith('use') and name.endswith('.ts'))):
                content, path = await _fetch_file_content(client, owner, repo, f)
                if content:
                    return path, content
    return '', ''


async def _fetch_file_content(client: httpx.AsyncClient, owner: str, repo: str, file_entry: dict) -> tuple[str, str]:
    """Lấy nội dung file, giới hạn 200 dòng."""
    path = file_entry.get('path', file_entry.get('name', ''))
    data = await _get(client, f'/repos/{owner}/{repo}/contents/{path}')
    if not data or data.get('encoding') != 'base64':
        return '', ''
    try:
        raw = base64.b64decode(data['content']).decode('utf-8', errors='replace')
        lines = raw.splitlines()[:200]
        return '\n'.join(lines), path
    except Exception:
        return '', ''


async def _analyze_repo(
    client: httpx.AsyncClient,
    owner: str,
    repo_data: dict,
) -> RepoSummary | None:
    """Phân tích 1 repo: lấy language, commits, code signals."""
    name = repo_data['name']

    # Lấy ngôn ngữ
    langs_data = await _get(client, f'/repos/{owner}/{name}/languages') or {}

    # Lấy tối đa 10 commit gần nhất
    commits_data = await _get(client, f'/repos/{owner}/{name}/commits?per_page=10') or []
    commit_count = len(commits_data) if isinstance(commits_data, list) else 0

    first_commit_at = last_commit_at = None
    if commit_count > 0:
        try:
            last_commit_at = datetime.fromisoformat(
                commits_data[0]['commit']['author']['date'].replace('Z', '+00:00')
            )
            first_commit_at = datetime.fromisoformat(
                commits_data[-1]['commit']['author']['date'].replace('Z', '+00:00')
            )
        except Exception:
            pass

    # Kiểm tra vibe-coding
    vibe_flags: list[str] = []
    is_tutorial_clone = bool(_TUTORIAL_PATTERNS.search(name) or _TUTORIAL_PATTERNS.search(repo_data.get('description') or ''))
    if is_tutorial_clone:
        vibe_flags.append('Tên/mô tả giống bài tập tutorial')

    if commit_count > 0 and first_commit_at and last_commit_at:
        age_days = (datetime.now(timezone.utc) - first_commit_at).days
        if commit_count < 4 and age_days > 30:
            vibe_flags.append('Ít commit trong dữ liệu công khai đã đọc; cần hỏi thêm về quá trình phát triển')
        if commit_count == 1:
            vibe_flags.append('API trả về 1 commit trong lần kiểm tra; chưa đủ căn cứ kết luận quá trình phát triển')

    # Lấy code signals
    has_tests, has_docker, has_ci, readme_excerpt, core_file_path, core_file_content = \
        await _detect_code_signals(client, owner, name)

    return RepoSummary(
        name=name,
        description=repo_data.get('description') or '',
        stars=repo_data.get('stargazers_count', 0),
        language=repo_data.get('language'),
        is_fork=repo_data.get('fork', False),
        commit_count=commit_count,
        first_commit_at=first_commit_at,
        last_commit_at=last_commit_at,
        has_tests=has_tests,
        has_docker=has_docker,
        has_ci=has_ci,
        languages=langs_data,
        readme_excerpt=readme_excerpt,
        core_file_path=core_file_path,
        core_file_content=core_file_content,
        vibe_flags=vibe_flags,
        is_tutorial_clone=is_tutorial_clone,
    )


async def fetch_github_summary(github_url: str) -> GitHubSummary:
    """Điểm vào chính: fetch tất cả dữ liệu GitHub, trả về GitHubSummary."""
    username = _extract_username(github_url)

    async with httpx.AsyncClient() as client:
        # Thông tin user
        user_data = await _get(client, f'/users/{username}')
        if not user_data:
            raise ValueError(f'Không tìm thấy GitHub user: {username}')

        created_at = user_data.get('created_at', '')
        account_age_days = 0
        if created_at:
            try:
                created = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                account_age_days = (datetime.now(timezone.utc) - created).days
            except Exception:
                pass

        # Lấy tối đa 8 repo không fork, sắp xếp theo ngày cập nhật
        repos_data = await _get(
            client,
            f'/users/{username}/repos?sort=updated&per_page=8&type=owner'
        ) or []
        repos_data = [r for r in repos_data if isinstance(r, dict) and not r.get('fork', False)]

        # Phân tích song song, giới hạn 4 concurrent để tránh rate limit
        semaphore = asyncio.Semaphore(4)

        async def safe_analyze(r):
            async with semaphore:
                try:
                    return await _analyze_repo(client, username, r)
                except Exception as e:
                    logger.warning('Bỏ qua repo %s/%s: %s', username, r.get('name'), type(e).__name__)
                    return None

        analyzed = await asyncio.gather(*[safe_analyze(r) for r in repos_data])
        repos = [r for r in analyzed if r is not None]
        if repos_data and not repos:
            raise PermissionError('Chưa đọc được repository; không thể coi lỗi tải là thiếu bằng chứng.')

        total_stars = sum(r.stars for r in repos)

        return GitHubSummary(
            username=username,
            public_repos=user_data.get('public_repos', 0),
            account_age_days=account_age_days,
            total_stars=total_stars,
            repos=repos,
        )
