/**
 * SITE_MODE=test marks a test copy of the site (docs/mediu-test.md): Google must not index it, so
 * it never competes with dentalarena.ro. Read at build time for the static pages, so the test
 * image is built with it.
 */
export const isTestSite = process.env.SITE_MODE === "test";
