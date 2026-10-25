# Finish Auth0 dashboard setup

Pinlight's code, token verification and Supabase ownership migration are configured. These provider-side settings still need to be enabled by the account owner.

## 1. Authorize the SPA to use Pinlight API

In Auth0, open **Applications → APIs → Pinlight API → Application Access**.
Find the Pinlight SPA with client ID `mZNlXoauoS9kWmXy9gqywJ5PKHmQVNPG`, select **Edit**, and authorize **User-Delegated Access**. Keep client/machine-to-machine access disabled unless needed separately. Use per-application authorization rather than allowing every application.

The API identifier must be exactly `https://api.pinlight.local`.

If sign-in succeeds but API calls fail with `invalid_request`, this client is not authorized to access that API. See [Auth0's application access policies](https://auth0.com/blog/developers-guide-api-access-policies-auth0/).

## 2. Add the Supabase role to ID tokens

Open **Actions → Library → Build Custom**, create a **Login / Post Login** Action named `Pinlight Supabase role`, and paste the contents of [auth0-post-login.cjs](../scripts/auth0-post-login.cjs).

Deploy the Action. Open **Actions → Flows → Login**, add that Action between Start and Complete, and apply the flow. Auth0 dashboard labels may also group Login under Actions → Triggers.

The Action adds `role: authenticated` to the ID token for this specific application. Pinlight uses the ID token for Supabase and a separate audience-bound access token for its own API. An access-token-only role claim does not satisfy this Supabase integration.

## 3. Trust the Auth0 tenant in Supabase

In the Supabase project, open **Authentication → Third-Party Auth**, add **Auth0**, and enter:

- If the domain input already shows `https://` and `.auth0.com`, enter only `dev-5f3cky32odqy8tll.us`.
- If it asks for the complete domain, enter `dev-5f3cky32odqy8tll.us.auth0.com`.
- For a separate tenant/region form, use tenant `dev-5f3cky32odqy8tll` and region `us`.
- Click **Create connection**.

Use the provider's Auth0 integration; do not disable JWT verification. See [Supabase's Auth0 guide](https://supabase.com/docs/guides/auth/third-party/auth0).

## 4. Check callback settings and test

In Auth0's Pinlight SPA Settings:

- Allowed Callback URLs: `http://127.0.0.1:5173/signin`
- Allowed Logout URLs: `http://127.0.0.1:5173`
- Allowed Web Origins: `http://127.0.0.1:5173`

Add production equivalents when deploying. Set `VITE_ACCOUNTS=on` so the sign-in and desk routes are visible. The browser app needs no client secret. Open `/signin`, continue with Auth0 and complete the hosted sign-in yourself. Upload a PDF and verify its saved journey in My desk.

Existing Supabase accounts remain separate from new Auth0 identities. Accounts are not linked by an unverified matching email. Existing data is preserved; any account-linking migration needs a proof-of-ownership flow.

## Local verification

- `npm test`: signed-token issuer/audience/expiry/signature checks and cached reference-search tests.
- `npm run migrate:learning`: applies `0003_auth0_ownership.sql` when the ownership function is missing or `AUTH0_DOMAIN` is set, so native Supabase accounts also get `current_owner_key()`. Re-run it after setting `AUTH0_DOMAIN`.
- `node --env-file=.env scripts/test-auth0-storage.js`: simulated, verified-claim database contexts test identity isolation inside a rolled-back transaction. This does not test Supabase's external JWT gateway configuration.
- `node --env-file=.env scripts/test-learning-storage.js`: existing Supabase account isolation.
- `node --env-file=.env scripts/test-reference-search.js`: real SerpApi query for a public part name.
