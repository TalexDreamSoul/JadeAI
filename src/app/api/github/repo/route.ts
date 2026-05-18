import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    || request.headers.get('x-git-token')
    || request.nextUrl.searchParams.get('token');
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  const gitHubMatch = url.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  const gitLabMatch = url.match(/gitlab\.com\/([^/]+\/[^/#?]+)/);
  if (!gitHubMatch && !gitLabMatch) {
    return NextResponse.json({ error: 'Unsupported Git URL' }, { status: 400 });
  }

  try {
    if (gitHubMatch) {
      const [, owner, repo] = gitHubMatch;
      const repoName = repo.replace(/\.git$/, '');
      const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const [repoRes, readmeRes, languagesRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers, next: { revalidate: 300 } }),
        fetch(`https://api.github.com/repos/${owner}/${repoName}/readme`, { headers, next: { revalidate: 300 } }),
        fetch(`https://api.github.com/repos/${owner}/${repoName}/languages`, { headers, next: { revalidate: 300 } }),
      ]);

      if (!repoRes.ok) {
        if (repoRes.status === 404) {
          return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
        }
        if (repoRes.status === 403) {
          return NextResponse.json({ error: 'GitHub API rate limit exceeded' }, { status: 429 });
        }
        return NextResponse.json({ error: 'Failed to fetch repository' }, { status: repoRes.status });
      }

      const data = await repoRes.json();
      const languages = languagesRes.ok ? await languagesRes.json() : {};
      const readmeData = readmeRes.ok ? await readmeRes.json() : null;
      const readme = readmeData?.content
        ? Buffer.from(readmeData.content, 'base64').toString('utf8').slice(0, 8000)
        : '';

      return NextResponse.json({
        provider: 'github',
        name: data.full_name,
        stars: data.stargazers_count,
        language: data.language || '',
        languages,
        description: data.description || '',
        url: data.html_url,
        defaultBranch: data.default_branch,
        topics: data.topics || [],
        readme,
      });
    }

    if (gitLabMatch) {
      const projectPath = gitLabMatch[1].replace(/\.git$/, '');
      const headers: Record<string, string> = {};
      if (token) headers['PRIVATE-TOKEN'] = token;
      const encoded = encodeURIComponent(projectPath);
      const res = await fetch(`https://gitlab.com/api/v4/projects/${encoded}`, {
        headers,
        next: { revalidate: 300 },
      });
      if (!res.ok) {
        return NextResponse.json({ error: 'Failed to fetch repository' }, { status: res.status });
      }
      const data = await res.json();
      return NextResponse.json({
        provider: 'gitlab',
        name: data.path_with_namespace,
        stars: data.star_count || 0,
        language: '',
        languages: {},
        description: data.description || '',
        url: data.web_url,
        defaultBranch: data.default_branch,
        topics: data.topics || [],
        readme: '',
      });
    }
  } catch {
    return NextResponse.json({ error: 'Failed to fetch repository' }, { status: 500 });
  }
}
