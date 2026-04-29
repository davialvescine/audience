# Email Templates

Custom Supabase Auth email templates with UCOB branding.

## How to apply

1. Go to <https://supabase.com/dashboard/project/ogfalobvfofcrazaeydr/auth/templates>
2. Select **"Magic Link"** from the template dropdown
3. Replace the **Subject** with: `Seu link de acesso ao Audience`
4. Replace the **HTML** content with the contents of `magic_link.html`
5. Click **Save**

The template uses the Supabase variable `{{ .ConfirmationURL }}` which is automatically replaced when the email is sent.

## Variables available
- `{{ .ConfirmationURL }}` — the magic link URL
- `{{ .SiteURL }}` — your configured site URL
- `{{ .Email }}` — recipient email
