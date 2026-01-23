Create a planning document for a feature with knowledge injection.

Usage: /eng-plan <feature-name>

This command:
1. Creates .engineering/features/<feature>/PLAN.md
2. Injects relevant knowledge from past features
3. Injects coding standards from manifesto.md
4. Provides structured planning template

Example:
  /eng-plan user-authentication

The generated PLAN.md includes:
- Feature overview section
- Technical approach
- Files to modify
- Test strategy
- Knowledge from similar past features

Use after /eng-start to create a structured plan before implementation.
