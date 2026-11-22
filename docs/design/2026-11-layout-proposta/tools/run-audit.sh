W=/Users/joaofsantos/Documents/code/qualroteiro/repos/qualroteiro/.worktrees/layout-proposta
cd $W && pnpm --filter "@qualroteiro/fuel" --filter "@qualroteiro/tolls" --filter "@qualroteiro/geo" build 2>&1 | tail -3
cd $W/apps/web
VITE_DEMO_MODE=true npx vite --port 5199 --host 127.0.0.1 > /tmp/vite-audit.log 2>&1 &
VP=$!
sleep 7
node $W/docs/design/2026-11-layout-proposta/tools/audit.mjs 2>&1 | tail -20
kill $VP
