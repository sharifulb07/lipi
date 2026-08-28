# Open-source Word compatibility service

Vercel cannot run LibreOffice binaries. Run Collabora Online (which uses LibreOffice technology) on a container host and let the Vercel route call its document conversion endpoint.

## Application configuration

Set these variables in Vercel and redeploy:

```env
WORD_COMPATIBILITY_API_URL=https://office-converter.example.com
WORD_COMPATIBILITY_API_TOKEN=a-long-random-secret
```

The URL can be either the Collabora server root or a complete URL ending in `/cool/convert-to/docx`. The token is optional in the application but strongly recommended. Enforce it in an HTTPS reverse proxy before traffic reaches Collabora.

## Local Collabora test

```bash
docker run --rm -p 127.0.0.1:9980:9980 \
  -e 'extra_params=--o:ssl.enable=false' \
  collabora/code
```

Then use:

```env
WORD_COMPATIBILITY_API_URL=http://127.0.0.1:9980
```

HTTP endpoints are accepted only during local development. Production requires HTTPS.

## Production requirements

- Put Collabora behind an HTTPS reverse proxy.
- Restrict request size and rate-limit the conversion endpoint.
- Require the bearer token configured above.
- Do not expose the rest of the Collabora administration surface publicly unless needed.
- Install the fonts used by your documents in the Collabora container; missing fonts cause layout substitutions.

The output is normalized to DOCX. Microsoft Word 2007 and newer support DOCX, but exact rendering across every Word version cannot be guaranteed when a version lacks a font, layout feature, macro, or newer Office capability.