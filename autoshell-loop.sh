#!/bin/bash
# AutoShell loop script for ssl-manager-openspec
# Replace the # Commands section in ~/.autoshell/scripts/ssl-manager-openspec.sh with this content after install

PROMPT='You are working on the react-native-ssl-manager library. Your job is to implement tasks from the OpenSpec proposal.

## Context
Read these files FIRST before doing anything:
- openspec/changes/add-android-network-security-config/proposal.md — understand WHY
- openspec/changes/add-android-network-security-config/design.md — understand HOW
- openspec/changes/add-android-network-security-config/tasks.md — the task checklist
- openspec/changes/add-android-network-security-config/specs/android-network-security-config/spec.md — requirements & scenarios
- openspec/changes/add-android-network-security-config/specs/android-pinned-client-api/spec.md — requirements & scenarios
- openspec/changes/add-android-network-security-config/specs/ios-urlsession-documentation/spec.md — requirements & scenarios

## Existing code to understand
- android/src/main/java/com/usesslpinning/SslPinningFactory.kt — current Android SSL pinning
- android/ssl-pinning-setup.gradle — current Gradle setup script
- app.plugin.js — current Expo plugin
- scripts/postinstall.js — current postinstall script
- ios/SharedLogic.swift — iOS TrustKit implementation (already covers URLSession)
- README.md — current documentation

## Rules
1. Work through tasks.md IN ORDER. Find the first unchecked task (marked with [ ]) and implement it.
2. After completing each task, update tasks.md to mark it as done (change [ ] to [x]).
3. Follow the spec requirements and scenarios EXACTLY — they are your acceptance criteria.
4. Follow design.md decisions — especially: generate XML at build time, merge with existing NSC, expose PinnedOkHttpClient as singleton.
5. Use /react-native-best-practices and /native-data-fetching skills when writing code.
6. Do NOT over-engineer. Keep implementations minimal and focused.
7. Do NOT modify iOS native code — it already works.
8. Run openspec validate add-android-network-security-config --strict after making spec-related changes.
9. When done with a batch of tasks, commit locally with a clear message describing what was completed.
10. Do NOT push to remote — only commit locally.
11. If ALL tasks in tasks.md are complete (all marked [x]), reply with DONE.

Continue from where the last run left off. Check tasks.md for progress.'

MAX_RUNS=5
for i in $(seq 1 $MAX_RUNS); do
  echo "=== Run $i of $MAX_RUNS ==="

  OUTPUT=$(claude -p "$PROMPT" --dangerously-skip-permissions 2>&1)
  echo "$OUTPUT"

  # Stop if Claude says all tasks are done
  if echo "$OUTPUT" | grep -qi "^DONE$\|all tasks.*complete\|all phases.*complete\|nothing.*left\|no remaining"; then
    echo "All tasks complete! Stopping."
    break
  fi

  echo "Run $i finished. Checking for more tasks..."
  sleep 5
done

echo "Task completed successfully"
exit 0
