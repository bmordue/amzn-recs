# ESLint v9 Migration Notes

## Current Status
- ESLint is currently at v8.57.1 (latest v8 version)
- ESLint v9.34.0 is available but requires ecosystem support

## Blocking Dependencies
The following dependencies prevent ESLint v9 upgrade:
- `eslint-config-airbnb-base@15.0.0` - only supports ESLint `^7.32.0 || ^8.2.0`

## Migration Path
To upgrade to ESLint v9 in the future:

1. Wait for `eslint-config-airbnb-base` to support ESLint v9, OR
2. Replace `eslint-config-airbnb-base` with ESLint v9 compatible alternatives:
   - `@eslint/js` (official ESLint config)
   - Custom flat config in `eslint.config.js`

## Preparation Done
- All other ESLint-related packages are already v9 compatible:
  - `@typescript-eslint/eslint-plugin@8.42.0`
  - `@typescript-eslint/parser@8.42.0`
  - `eslint-plugin-jest@29.0.1`
  - `eslint-plugin-import@2.32.0`

## Next Steps
Monitor these packages for ESLint v9 support:
- eslint-config-airbnb-base
- eslint-plugin-import (may need updates)

Once ecosystem support is available, create `eslint.config.js` using flat config format.