# Security Policy

## Supported versions

Mailrova doesn't yet have tagged releases — `main` is the only supported
branch. Security fixes land there; update to the latest commit to pick them
up.

## Reporting a vulnerability

**Please don't open a public GitHub issue for a security report.**

Email **mubashir@ua-technologies.com** with:
- What you found and where (file/endpoint/component).
- Steps to reproduce, or a proof of concept if you have one.
- The potential impact as you see it.

We'll acknowledge within a few business days. Once a fix is out, we'll credit
you in the fix's commit/PR unless you'd rather stay anonymous.

## Scope

In scope: this repository (backend, frontend, `mta/` Docker build, and the
Docker Compose setup itself). Third-party dependencies should generally be
reported upstream, unless the issue is specifically in how Mailrova uses
them (e.g. a missing input check before data reaches a library).

## What's already been hardened (so you know what's expected)

A security-focused pass already covers: tenant isolation on every repository
query, hashed/prefix-indexed API keys shown once, rate limiting on
auth/public endpoints, a scoped Docker socket proxy instead of raw
`/var/run/docker.sock` access, HTML sanitization on every outbound email,
and HttpOnly session cookies (never `localStorage`). If you find a gap in
any of these, that's exactly the kind of report this policy is for.
