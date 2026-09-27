# MMN OTT MART — Web Player

A customer-facing browser IPTV player for customers who already have an authorized subscription. It supports Xtream-style credentials and M3U/M3U8 playlists, with Live TV, Movies, Series, search, favorites, recent viewing and a basic EPG.

## Customer flow
1. Customer opens the web player in Chrome/Edge/Safari.
2. Customer enters the server URL, username and password supplied with their subscription.
3. The app connects through the backend API and loads the subscription library.
4. Customer watches compatible streams in the browser.

## Railway
This project is configured for Railway with a Dockerfile and `railway.json`.

1. Push the `iptv-player` folder to GitHub.
2. In Railway, create a project and deploy the GitHub repository.
3. Railway will build the Docker image and expose the Next.js server.
4. Add a custom domain after deployment if desired.
5. Check `/api/health` after deployment.

## Important
This player is intended for streams and subscriptions the customer is authorized to access. It does not host channel content. Browser playback can still be affected by provider availability, CORS/HLS support, HTTPS requirements, geo-restrictions, simultaneous-device limits, or other provider/network controls.

## Production hardening still recommended
- Add customer accounts and subscription records in PostgreSQL.
- Encrypt stored provider credentials; do not store plaintext passwords.
- Add session expiry, rate limiting and audit logging.
- Add device/session limits if required by your subscription terms.
- Add a proper privacy policy and terms of service.
