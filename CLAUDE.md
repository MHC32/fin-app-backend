# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FinApp Haiti Backend is a financial management API specifically designed for the Haitian context. It provides authentication, account management, transactions, budgets, sols (traditional saving circles), investments, and AI-powered financial insights.

## Development Commands

- **Start development server**: `npm run dev` (uses nodemon)
- **Start production server**: `npm start`
- **Run tests**: `npm test` (currently placeholder - tests to be implemented)
- **Linting**: Uses ESLint (`eslint` package available but no specific script defined)
- **Formatting**: Prettier available (`prettier` package installed)

## Key Architecture

### Core Structure
```
src/
├── app.js              # Express server entry point
├── config/             # Database, JWT, and classification patterns
├── controllers/        # Request handlers with validation
├── middleware/         # Authentication and security middleware
├── models/             # Mongoose schemas (User, Account, Transaction, etc.)
├── routes/             # Express route definitions
├── services/           # Business logic (auth, ML, predictions, habits)
├── scripts/            # Debug and testing utilities
├── utils/              # Constants and ML helpers
└── tests/              # Test files (to be implemented)
```

### Database & Models
- **MongoDB**: Primary database using Mongoose ODM
- **Connection**: MongoDB URI from `process.env.MONGODB_URI` or defaults to `mongodb://localhost:27017/finapp_haiti_dev`
- **Key Models**: User, Account, Transaction, Budget, Sol, Investment, Debt, HabitInsight, MLModel

### Authentication System
- **JWT-based**: Access tokens (short-lived) + Refresh tokens (7 days)
- **Multi-session**: Users can have multiple active sessions across devices
- **Security**: Rate limiting, account locking after failed attempts, secure password hashing
- **Haiti Context**: Phone number validation for Haitian format (+509xxxxxxxx), regional data

### Haiti-Specific Features
- **Regions**: 10 Haitian departments (ouest, nord, sud, artibonite, etc.)
- **Banks**: Local banks (Sogebank, Unibank, BNC, etc.) and mobile money (MonCash, NatCash)
- **Currencies**: HTG (Gourde) and USD support
- **Sols/Tontines**: Traditional saving circles with automated turn management
- **Cultural Context**: Category names in French with Haitian Creole examples

### AI/ML Features
- **TensorFlow.js**: Node.js implementation for server-side ML
- **Habit Analysis**: User spending pattern analysis
- **Predictions**: Financial forecasting and recommendations
- **Classification**: Automatic transaction categorization
- **ML Models**: Stored in MLModel collection for persistence

## Important Files & Patterns

### Constants (`src/utils/constants.js`)
Contains all Haiti-specific data: regions, banks, currencies, transaction categories, validation patterns. Always use these constants instead of hardcoding values.

### Authentication Flow
1. Routes (`src/routes/auth.js`) → Controllers (`src/controllers/authController.js`) → Services (`src/services/authService.js`) → Models (`src/models/User.js`)
2. Middleware (`src/middleware/auth.js`) handles token verification and user injection
3. Rate limiting applied at route level for security

### Error Handling
- Controllers return structured JSON responses with `success`, `message`, and `error` fields
- Services return `{success: boolean, error?: string, data?: any}` objects
- Global error handler in `app.js` catches unhandled errors

### Validation
- Express-validator used in controllers for input validation
- Mongoose schema validation for data integrity
- Custom validators for Haiti-specific formats (phone numbers, regions)

## Security Considerations

- **Password**: Bcrypt with cost 12
- **Rate Limiting**: Different limits for auth attempts, general API, and admin actions
- **JWT**: HS256 algorithm, configurable expiration times
- **Session Management**: Device tracking, cleanup of expired sessions
- **Headers**: Helmet for security headers, CORS configured for frontend

## Database Schema Notes

### User Model
- Multi-device session support with device fingerprinting
- Haiti-specific fields: region, phone validation, currency preference
- Account locking mechanism for security
- Notification preferences for different event types

### Transaction Categories
Predefined categories adapted for Haitian context:
- Income: salaire, business, freelance, investissement
- Expenses: alimentation, transport, logement, sante, education
- Special: sol (tontine), transfert

### Sol System
Traditional Haitian saving circles with:
- Participant management
- Turn rotation system
- Payment tracking
- Different sol types (classic, business, family, savings)

## Development Guidelines

1. **Always use constants** from `src/utils/constants.js` for Haiti-specific data
2. **Follow the service pattern**: Routes → Controllers → Services → Models
3. **Return structured responses** with success/error patterns
4. **Use proper validation** with express-validator and Mongoose schemas
5. **Handle async operations** properly with try-catch and error responses
6. **Test with scripts** in `src/scripts/` directory for debugging
7. **Maintain security** with proper authentication middleware and rate limiting

## Environment Variables

Required environment variables:
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret for JWT token signing
- `JWT_REFRESH_SECRET`: Secret for refresh tokens
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (defaults to 3001)

## API Standards

- All endpoints return JSON with consistent structure
- Use HTTP status codes appropriately
- Include timestamps in responses
- Provide meaningful error messages in French (primary language)
- Support both HTG and USD currencies throughout the system