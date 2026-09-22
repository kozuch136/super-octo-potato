# super-octo-potato

## LinkedIn job scraper

`linkedin_job_scraper.py` queries LinkedIn's public "jobs-guest" search
endpoints (the same ones used by anonymous visitors to the job search page,
no login required) and reports which technologies from `TARGET_LANGUAGES`
each posting mentions.

```bash
pip install -r requirements.txt
python linkedin_job_scraper.py
```

Edit the `keyword`, `location`, and `num_jobs` values in `main()` to change
what is searched for.
