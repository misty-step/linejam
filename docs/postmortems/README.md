# Incident postmortems

Write a postmortem for each production incident here to record observed impact, the failure-class mechanism, and how that class will be prevented. Name each report `YYYY-MM-DD-short-incident-name.md` using the incident date and a distinct kebab-case name.

Start from the [shared Pokayoke postmortem template](https://github.com/misty-step/harness/blob/master/agent-config/skills/pokayoke/postmortem-template.md) in misty-step/harness. Keep the incident owner and status, observed evidence, and the required `## Pokayoke` and `## Follow-up` sections in each report. A warning or instruction is not a structural prevention mechanism.

For a closed postmortem, link the change that rules out the entire failure class **and its regression check** in `## Follow-up` (FND-INC-001). If the class is still possible, leave the postmortem open with an owned follow-up instead of declaring it closed.
