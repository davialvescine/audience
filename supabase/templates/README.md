# Email Templates

Custom Supabase Auth email templates with UCOB branding.

## How to apply

Go to <https://supabase.com/dashboard/project/ogfalobvfofcrazaeydr/auth/templates>

### Magic Link template
1. Select **"Magic Link"** from the template dropdown
2. Subject: `Seu link de acesso ao Audience`
3. HTML: paste contents of `magic_link.html`
4. Save

### Invite User template
1. Select **"Invite user"** from the template dropdown
2. Subject: `Você foi convidado pro Audience`
3. HTML: paste contents of `invite.html`
4. Save

## How to disable public signup

To make the system invite-only:
1. Authentication → Providers → Email
2. Set **"Enable email signups"** to OFF
3. Save

After this, only `supabase.auth.admin.inviteUserByEmail` can create users.

## Variables

- `{{ .ConfirmationURL }}` — magic link / invite URL
- `{{ .SiteURL }}` — configured site URL
- `{{ .Email }}` — recipient email
