# Authentication & User Management System

This branch contains ONLY the authentication and user management components for focused code review.

## Included Components:
- AuthContext.tsx (363 lines) - Core authentication state management
- AuthScreen.tsx (120 lines) - Authentication screen entry point  
- AuthModal.tsx (327 lines) - Authentication modal with sign in/up/reset
- AuthPrompt.tsx (187 lines) - Onboarding authentication prompt
- ProfileScreen.tsx (1129 lines) - User profile and account management

## Key Features:
- Firebase Auth integration with Google Sign-In
- Automatic user document creation in Firestore
- Data migration logic for new users
- Retry mechanisms with exponential backoff
- Onboarding status tracking
- Account management functionality

## Review Focus:
Please provide feedback on architecture, error handling, UX flow, and code organization.

