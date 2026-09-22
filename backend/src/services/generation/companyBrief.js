import { completeJSON, fence } from '../llm/llmClient.js';

/**
 * Builds the company brief from whatever pages the crawler actually found.
 * If nothing was found, returns an honest empty-ish brief rather than
 * fabricating one (Section 10 / the FAQ on thin sources).
 */
export async function generateCompanyBrief({ companyName, companyUrl, pagesUsed, hiringPage, discussion }) {
  if (!pagesUsed || pagesUsed.length === 0) {
    return {
      summary: `No pages from ${companyUrl} could be retrieved, so no company brief could be generated from source material.`,
      what_they_do: '',
      sources: [],
    };
  }

  const pagesText = pagesUsed.slice(0, 5).map((p) => `[${p.url}]\n${p.text.slice(0, 2000)}`).join('\n\n');
  const hiringText = hiringPage ? `\n\nHiring/interview-process page [${hiringPage.url}]:\n${hiringPage.text.slice(0, 2000)}` : '\n\nNo dedicated hiring/interview-process page was found.';
  const discussionText = discussion?.results?.length
    ? `\n\nPublic discussion found:\n${discussion.results.map((r) => `- ${r.title}: ${r.snippet}`).join('\n')}`
    : '\n\nNo public discussion of the interview process was found.';

  const system = `You write a short, factual company brief for someone preparing for an interview.
Only state things supported by the provided pages. If the hiring process isn't described anywhere, say so plainly instead of guessing.`;

  const user = `Company: ${companyName || companyUrl}
${fence('COMPANY_PAGES', pagesText)}${fence('HIRING_PAGE', hiringText)}${fence('PUBLIC_DISCUSSION', discussionText)}

Return JSON exactly:
{ "summary": "2-4 sentences on the company and, if known, what to expect in their interview process", "what_they_do": "1-2 sentences" }`;

  const result = await completeJSON({ system, user, maxTokens: 500 });
  return {
    summary: String(result.summary || '').trim(),
    what_they_do: String(result.what_they_do || '').trim(),
    sources: pagesUsed.map((p) => p.url),
  };
}
