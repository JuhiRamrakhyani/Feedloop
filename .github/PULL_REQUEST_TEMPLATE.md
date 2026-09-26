## What does this change?

<!-- A short summary and the reason for it. Link any issue. -->

## How did you test it?

- [ ] `npm run seed` + `npm start`
- [ ] Send → open link → submit → Review shows the response
- [ ] Second submit rejected (409)

Delivery provider tested with:

## Checklist

- [ ] No secrets committed (`.env`, `.baileys_auth/`)
- [ ] New heavy/unofficial deps added to `optionalDependencies`
- [ ] Delivery providers kept isolated in `src/services/delivery/`
- [ ] `find src public/js -name '*.js' -print0 | xargs -0 -n1 node --check` passes
