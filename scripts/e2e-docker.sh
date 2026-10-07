#!/usr/bin/env sh
# Runs the Playwright suite in the same container image as CI, so screenshot
# baselines match pixel for pixel. Extra arguments go to `playwright test`
# (e.g. --update-snapshots, --grep "gráfico", --project desktop).
# The project is copied into the container and built there: the host's
# node_modules, .next and config files are never touched. Only the report,
# test results and screenshot baselines are copied back.
set -eu
version=$(node -p 'require("@playwright/test/package.json").version')
image="mcr.microsoft.com/playwright:v${version}-noble"
exec docker run --rm --init --ipc=host \
  -v "$PWD":/src -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
  "$image" sh -c '
    set -e
    mkdir /work
    tar -C /src --exclude=./node_modules --exclude=./.next --exclude=./.git \
      --exclude=./output --exclude=./test-results --exclude=./playwright-report \
      -cf - . | tar -C /work -xf -
    cd /work
    npm ci --no-audit --no-fund --loglevel=error >/dev/null
    status=0
    npx playwright test "$@" || status=$?
    rm -rf /src/playwright-report /src/test-results
    cp -r playwright-report test-results /src/ 2>/dev/null || true
    mkdir -p /src/tests/e2e/__screenshots__
    cp -r tests/e2e/__screenshots__/. /src/tests/e2e/__screenshots__/
    chown -R "$HOST_UID:$HOST_GID" /src/playwright-report /src/test-results \
      /src/tests/e2e/__screenshots__ 2>/dev/null || true
    exit $status
  ' sh "$@"
