"""Scrape public LinkedIn job postings via the guest (unauthenticated) search
endpoints and report which target technologies each posting mentions.

Uses the same public "jobs-guest" endpoints LinkedIn's own anonymous job
search page calls - no login or private data is involved.
"""
import time
import re
from urllib.parse import quote_plus
from collections import Counter

import requests
from bs4 import BeautifulSoup

SEARCH_URL = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
DETAIL_URL = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"

TARGET_LANGUAGES = [
    "Python", "Jira", "Confluence", "Jira Service Management", "Bitbucket",
    "Agile", "ScriptRunner",
]

REQUEST_TIMEOUT = 10  # seconds
THROTTLE_SECONDS = 1.5


def extract_languages(text: str) -> list[str]:
    """Finds all target technologies/keywords present in a block of text."""
    found_languages = []
    for lang in TARGET_LANGUAGES:
        # Match complete words to avoid partial matching (e.g. 'Go' in 'Django')
        pattern = r'\b' + re.escape(lang) + r'\b'
        if re.search(pattern, text, re.IGNORECASE):
            found_languages.append(lang)
    return found_languages


def fetch_linkedin_jobs(keyword: str, location: str, total_posts: int = 10) -> list[dict]:
    """
    Fetches job posts from LinkedIn guest endpoints, extracting title, company,
    and required technologies.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    jobs = []
    start = 0
    params = {"keywords": keyword, "location": location}

    while len(jobs) < total_posts:
        try:
            # Step 1: Search for job posts snippet list
            res = requests.get(
                SEARCH_URL,
                params={**params, "start": start},
                headers=headers,
                timeout=REQUEST_TIMEOUT,
            )
            res.raise_for_status()
        except requests.RequestException as exc:
            print(f"Failed to fetch job list page starting at {start}: {exc}")
            break

        search_soup = BeautifulSoup(res.text, "html.parser")
        job_cards = search_soup.find_all("li")

        if not job_cards:
            print("No more job postings found.")
            break

        for card in job_cards:
            if len(jobs) >= total_posts:
                break

            # Parse Job Title & Company Name
            title_elem = card.find("h3", class_=re.compile("base-search-card__title"))
            company_elem = card.find("h4", class_=re.compile("base-search-card__subtitle"))

            title = title_elem.text.strip() if title_elem else "Unknown Title"
            company = company_elem.text.strip() if company_elem else "Unknown Company"

            # Extract Job ID to pull the full description
            job_entity = card.find("div", class_=re.compile("base-card"))
            if not job_entity or "data-entity-urn" not in job_entity.attrs:
                continue

            job_urn = job_entity["data-entity-urn"]
            job_id = job_urn.split(":")[-1]

            # Step 2: Fetch individual full job posting detail
            try:
                detail_res = requests.get(
                    DETAIL_URL.format(job_id=job_id),
                    headers=headers,
                    timeout=REQUEST_TIMEOUT,
                )
                detail_res.raise_for_status()
            except requests.RequestException as exc:
                print(f"Failed to fetch details for job {job_id}: {exc}")
                time.sleep(THROTTLE_SECONDS)
                continue

            detail_soup = BeautifulSoup(detail_res.text, "html.parser")

            # Full job description text
            desc_elem = detail_soup.find("div", class_=re.compile("description__text"))
            desc_text = desc_elem.get_text(separator=" ", strip=True) if desc_elem else ""

            # Detect target technologies from description
            languages_found = extract_languages(desc_text)

            jobs.append({
                "title": title,
                "company": company,
                "languages": languages_found,
            })

            print(f"Processed: {title} at {company}")

            # Polite request throttling to avoid rate limiting
            time.sleep(THROTTLE_SECONDS)

        start += 25  # Paginate to next set of listings

    return jobs


def main() -> None:
    keyword = "Jira"
    location = "Remote"
    num_jobs = 5

    print(f"Scanning LinkedIn for '{keyword}' positions in '{location}'...\n")
    results = fetch_linkedin_jobs(keyword, location, total_posts=num_jobs)

    # Global tally counter
    language_counter = Counter()

    print("\n" + "=" * 70)
    print("JOB POSTINGS ANALYSIS")
    print("=" * 70)

    for idx, job in enumerate(results, 1):
        langs_str = ", ".join(job["languages"]) if job["languages"] else "None specified"
        print(f"{idx}. {job['title']} — {job['company']}")
        print(f"   Technologies Required: {langs_str}\n")

        # Increment total counter for each technology found in this posting
        for lang in job["languages"]:
            language_counter[lang] += 1

    print("=" * 70)
    print("TOTAL TECHNOLOGY TALLY")
    print("=" * 70)
    for lang, count in language_counter.most_common():
        print(f"{lang:12}: {count}")


if __name__ == "__main__":
    main()
